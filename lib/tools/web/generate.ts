import { WebError, type WebResult, type WebValues } from "./types";

const MAX_TEXT = 200_000;
const MAX_ROWS = 1_000;
const MAX_TOTAL = 1_000_000;
const ROBOTS_WARNING = "robots.txt controls crawler guidance. It is not an access-control or security mechanism.";

/** Escaping here produces copyable, inert source. Never insert the result as HTML. */
function escapeMarkup(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

class Inputs {
  private total = 0;
  private rowTotal = 0;

  text(record: WebValues, field: string, path = field, required = false): string {
    const value = record[field];
    if (value === undefined) {
      if (required) throw new WebError("This field is required.", path);
      return "";
    }
    if (typeof value !== "string") throw new WebError("Enter a text value.", path);
    if (value.length > MAX_TEXT) throw new WebError("Text is limited to 200,000 characters per field.", path);
    this.total += value.length;
    if (this.total > MAX_TOTAL) throw new WebError("Combined input is limited to 1,000,000 characters.", path);
    if (/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
      throw new WebError("Text must contain valid Unicode without null characters.", path);
    }
    if (required && !value.trim()) throw new WebError("This field is required.", path);
    return value;
  }

  rows(record: WebValues, field: string, path = field): unknown[] {
    const value = record[field];
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new WebError("Enter a list of rows.", path);
    if (value.length > MAX_ROWS) throw new WebError("Lists are limited to 1,000 rows.", path);
    this.rowTotal += value.length;
    if (this.rowTotal > MAX_ROWS) throw new WebError("Combined lists are limited to 1,000 rows, including nested directives.", path);
    return value;
  }
}

function object(value: unknown, field: string): WebValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WebError("Each row must be an object.", field);
  return value as WebValues;
}

function choice(value: string, options: readonly string[], field: string, required = false): string {
  if (!value && !required) return "";
  if (!options.includes(value)) throw new WebError(`Choose one of: ${options.join(", ")}.`, field);
  return value;
}

function noControls(value: string, field: string): void {
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw new WebError("Control characters and line breaks are not allowed here.", field);
}

function httpUrl(value: string, field: string): string {
  noControls(value, field);
  if (value !== value.trim() || !/^https?:\/\//i.test(value)) throw new WebError("Enter an absolute HTTP or HTTPS URL without surrounding spaces.", field);
  let url: URL;
  try { url = new URL(value); } catch { throw new WebError("Enter a valid HTTP or HTTPS URL.", field); }
  if (!url.hostname || (url.protocol !== "http:" && url.protocol !== "https:")) throw new WebError("Enter a valid HTTP or HTTPS URL.", field);
  if (url.username || url.password) throw new WebError("URLs containing credentials are not supported.", field);
  return url.href;
}

function optionalHttp(value: string, field: string): string {
  if (value) httpUrl(value, field);
  return value;
}

function color(value: string, field: string): string {
  if (!value) return "";
  // Portable, practical CSS color subset; no CSS evaluation or DOM style parsing.
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return value;
  if (/^(?:transparent|black|white|red|green|blue|yellow|gray|grey|silver|maroon|purple|fuchsia|lime|olive|navy|teal|aqua|orange|rebeccapurple)$/i.test(value)) return value;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i.exec(value);
  if (rgb && rgb.slice(1, 4).every((part) => Number(part) <= 255) && (value.toLowerCase().startsWith("rgba(") === (rgb[4] !== undefined))) return value;
  throw new WebError("Use a hex color, a supported basic color name, or rgb()/rgba() with 0–255 channels.", field);
}

function meta(name: string, value: string, property = false): string {
  return value ? `<meta ${property ? "property" : "name"}="${name}" content="${escapeMarkup(value)}">` : "";
}

function lines(values: string[]): WebResult { return { text: values.filter(Boolean).join("\n") }; }

function handle(value: string, field: string): string {
  if (value && !/^@[A-Za-z0-9_]{1,15}$/.test(value)) throw new WebError("Enter @ followed by 1–15 ASCII letters, numbers or underscores.", field);
  return value;
}

function validDate(value: string, field: string): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) throw new WebError("Enter YYYY-MM-DD or an ISO instant with seconds and an explicit offset.", field);
  const [, yearText, monthText, dayText, hour, minute, second, zone] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new WebError("Enter a real Gregorian date in years 0001–9999.", field);
  if (hour !== undefined && (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) || !Number.isFinite(Date.parse(value)))) {
    throw new WebError("Enter a valid ISO instant; leap seconds and out-of-range times/offsets are not supported.", field);
  }
  return value;
}

function xmlText(value: string, field: string): string {
  if (/[\u0001-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value)) throw new WebError("This value contains characters that XML cannot represent.", field);
  return escapeMarkup(value);
}

function manifestUrl(value: string, field: string): string {
  if (!value) return "";
  noControls(value, field);
  if (value !== value.trim() || /\\/u.test(value) || value.startsWith("//")) throw new WebError("Use a relative URL or an absolute HTTP/HTTPS URL.", field);
  if (/^[A-Za-z][A-Za-z\d+.-]*:/u.test(value)) { httpUrl(value, field); return value; }
  try { new URL(value, "https://manifest.invalid/"); } catch { throw new WebError("Enter a valid relative URL.", field); }
  return value;
}

function robots(values: WebValues, input: Inputs): WebResult {
  const groups = input.rows(values, "groups");
  const blocks = groups.map((row, index) => {
    const path = `groups.${index}`;
    const group = object(row, path);
    const agent = input.text(group, "userAgent", `${path}.userAgent`, true);
    noControls(agent, `${path}.userAgent`);
    if (!/^(?:\*|[A-Za-z_-][A-Za-z\d_.-]*)$/.test(agent)) throw new WebError("Enter * or a crawler product token without spaces or directives.", `${path}.userAgent`);
    const output = [`User-agent: ${agent}`];
    for (const key of ["allow", "disallow"] as const) {
      input.rows(group, key, `${path}.${key}`).forEach((rule, ruleIndex) => {
        const field = `${path}.${key}.${ruleIndex}`;
        const value = input.text({ value: rule }, "value", field);
        noControls(value, field);
        if (value && (!value.startsWith("/") || /[#\s]/u.test(value))) throw new WebError("Enter a path beginning with /, without spaces or comments; an empty directive is allowed.", field);
        output.push(`${key === "allow" ? "Allow" : "Disallow"}: ${value}`);
      });
    }
    return output.join("\n");
  });
  const sitemaps = input.rows(values, "sitemaps").map((value, index) => {
    const field = `sitemaps.${index}`;
    const url = input.text({ value }, "value", field, true);
    httpUrl(url, field);
    if (/[#\s]/u.test(url)) throw new WebError("Sitemap directives cannot contain spaces, comments or fragments.", field);
    return `Sitemap: ${url}`;
  });
  if (sitemaps.length) blocks.push(sitemaps.join("\n"));
  return { text: blocks.join("\n\n"), warnings: [ROBOTS_WARNING] };
}

function sitemap(values: WebValues, input: Inputs): WebResult {
  const entries = input.rows(values, "entries");
  if (!entries.length) throw new WebError("Add at least one sitemap URL.", "entries");
  const elements = entries.map((row, index) => {
    const path = `entries.${index}`;
    const entry = object(row, path);
    const url = input.text(entry, "url", `${path}.url`, true);
    httpUrl(url, `${path}.url`);
    const lastmod = validDate(input.text(entry, "lastmod", `${path}.lastmod`), `${path}.lastmod`);
    const changefreq = choice(input.text(entry, "changefreq", `${path}.changefreq`), ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"], `${path}.changefreq`);
    const priority = input.text(entry, "priority", `${path}.priority`);
    if (priority && (!/^(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)$/.test(priority) || Number(priority) > 1)) throw new WebError("Priority must be a decimal from 0 to 1.", `${path}.priority`);
    const fields = [["loc", url], ["lastmod", lastmod], ["changefreq", changefreq], ["priority", priority]];
    return `  <url>\n${fields.filter(([, value]) => value).map(([name, value]) => `    <${name}>${xmlText(value, `${path}.${name === "loc" ? "url" : name}`)}</${name}>`).join("\n")}\n  </url>`;
  });
  return { text: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${elements.join("\n")}\n</urlset>` };
}

function manifest(values: WebValues, input: Inputs): WebResult {
  const result: Record<string, unknown> = { name: input.text(values, "name", "name", true) };
  const shortName = input.text(values, "shortName");
  if (shortName) result.short_name = shortName;
  for (const [field, key] of [["startUrl", "start_url"], ["scope", "scope"]]) {
    const value = manifestUrl(input.text(values, field), field);
    if (value) result[key] = value;
  }
  const display = choice(input.text(values, "display"), ["browser", "standalone", "minimal-ui", "fullscreen"], "display");
  if (display) result.display = display;
  for (const [field, key] of [["themeColor", "theme_color"], ["backgroundColor", "background_color"]]) {
    const value = color(input.text(values, field), field);
    if (value) result[key] = value;
  }
  const icons = input.rows(values, "icons").map((row, index) => {
    const path = `icons.${index}`;
    const icon = object(row, path);
    const result: Record<string, string> = { src: manifestUrl(input.text(icon, "src", `${path}.src`, true), `${path}.src`) };
    const sizes = input.text(icon, "sizes", `${path}.sizes`);
    if (sizes) {
      const tokens = sizes.split(" ");
      if (tokens.some((token) => token !== "any" && !/^[1-9]\d{0,4}x[1-9]\d{0,4}$/.test(token)) || new Set(tokens).size !== tokens.length) throw new WebError("Use any or space-separated positive sizes such as 192x192 512x512.", `${path}.sizes`);
      result.sizes = sizes;
    }
    const type = input.text(icon, "type", `${path}.type`);
    if (type) {
      if (!/^image\/[a-zA-Z\d][a-zA-Z\d!#$&^_.+-]*$/.test(type)) throw new WebError("Use an image MIME type such as image/png or image/svg+xml, without parameters.", `${path}.type`);
      result.type = type;
    }
    const purpose = input.text(icon, "purpose", `${path}.purpose`);
    if (purpose) {
      const tokens = purpose.split(" ");
      if (tokens.some((token) => !["any", "maskable", "monochrome"].includes(token)) || new Set(tokens).size !== tokens.length) throw new WebError("Use unique space-separated icon purposes: any, maskable, monochrome.", `${path}.purpose`);
      result.purpose = purpose;
    }
    return result;
  });
  if (icons.length) result.icons = icons;
  return { text: JSON.stringify(result, null, 2), data: result, warnings: ["A manifest alone does not make a complete PWA; installation also depends on browser requirements, HTTPS and other app capabilities."] };
}

export async function generateWeb(id: string, values: WebValues): Promise<WebResult> {
  const input = new Inputs();
  const text = (field: string) => input.text(values, field);
  switch (id) {
    case "meta-tag-generator": {
      const title = text("title");
      return lines([title ? `<title>${escapeMarkup(title)}</title>` : "", meta("description", text("description")), meta("author", text("author")), meta("robots", choice(text("robots"), ["index, follow", "noindex, follow", "index, nofollow", "noindex, nofollow"], "robots")), meta("theme-color", color(text("themeColor"), "themeColor"))]);
    }
    case "open-graph-generator": {
      return lines([meta("og:title", text("title"), true), meta("og:description", text("description"), true), meta("og:url", optionalHttp(text("url"), "url"), true), meta("og:image", optionalHttp(text("imageUrl"), "imageUrl"), true), meta("og:site_name", text("siteName"), true), meta("og:type", choice(text("type"), ["website", "article", "profile"], "type"), true)]);
    }
    case "open-graph-preview": {
      const preview = { title: text("title"), description: text("description"), url: optionalHttp(text("url"), "url"), imageUrl: optionalHttp(text("imageUrl"), "imageUrl"), siteName: text("siteName") };
      return { preview, text: Object.entries(preview).map(([key, value]) => `${key}: ${value}`).join("\n"), warnings: ["This preview is illustrative, not an exact rendering by any platform. Remote images are not fetched; an image placeholder protects privacy."] };
    }
    case "twitter-card-generator": {
      return lines([meta("twitter:card", choice(text("cardType"), ["summary", "summary_large_image"], "cardType", true)), meta("twitter:title", text("title")), meta("twitter:description", text("description")), meta("twitter:image", optionalHttp(text("imageUrl"), "imageUrl")), meta("twitter:site", handle(text("siteHandle"), "siteHandle")), meta("twitter:creator", handle(text("creatorHandle"), "creatorHandle"))]);
    }
    case "canonical-url-generator": {
      const url = new URL(httpUrl(input.text(values, "url", "url", true), "url"));
      url.hash = "";
      const canonicalUrl = url.href;
      const canonicalTag = `<link rel="canonical" href="${escapeMarkup(canonicalUrl)}">`;
      return { text: `${canonicalUrl}\n${canonicalTag}`, data: { canonicalUrl, canonicalTag } };
    }
    case "robots-txt-generator": return robots(values, input);
    case "sitemap-generator": return sitemap(values, input);
    case "web-app-manifest-generator": return manifest(values, input);
    default: throw new WebError("Unknown Web generator.");
  }
}
