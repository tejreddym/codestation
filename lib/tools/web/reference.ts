import { WebError, webResult, type WebValues, type WebResult } from "./types";
import { assertScalars, inspectText } from "./inspect-shared";
import { HTTP_HEADERS, HTTP_STATUSES, MIME_TYPES } from "./reference-data";

function statusLookup(values: WebValues): WebResult {
  const input = inspectText(values, "input", true).trim();
  if (!/^[1-5]\d{2}$/.test(input)) throw new WebError("Enter a three-digit HTTP status code from 100 to 599.", "input");
  const code = Number(input);
  const entry = HTTP_STATUSES[code];
  const category = ["Informational", "Success", "Redirection", "Client error", "Server error"][Math.floor(code / 100) - 1];
  return webResult({ code, statusText: entry?.[0] ?? "Unknown/unassigned in local reference", category: `${Math.floor(code / 100)}xx ${category}`, description: entry?.[1] ?? "Not assigned in this curated local reference. No specific meaning is inferred." },
    entry ? undefined : ["The numeric class is known, but this local reference has no assigned entry for this code."]);
}

function mimeLookup(values: WebValues): WebResult {
  const input = inspectText(values, "input", true).trim().toLowerCase();
  const mime = input.split(";", 1)[0].trim();
  const extension = input.startsWith(".") ? input : `.${input}`;
  const entry = MIME_TYPES.find(row => row.mime === mime || row.extensions.includes(extension));
  if (!entry) throw new WebError("No entry was found in the curated local MIME reference. Enter a common extension or MIME type.", "input");
  return webResult({ mime: entry.mime, extensions: [...entry.extensions], category: entry.mime.split("/")[0] },
    ["Curated common mappings only; extensions do not verify a file's actual content."]);
}

function headerReference(values: WebValues): WebResult {
  const name = inspectText(values, "input", true).trim().toLowerCase();
  const entry = HTTP_HEADERS.find(row => row.name.toLowerCase() === name);
  if (!entry) throw new WebError("No entry was found in the curated local header reference. Enter a header name only.", "input");
  return { ...webResult({ name: entry.name, category: entry.category, purpose: entry.purpose, example: entry.example }), copyText: entry.example };
}

function parseAgent(values: WebValues): WebResult {
  const raw = inspectText(values, "input", true);
  if (/[\u0000-\u001f\u007f]/.test(raw)) throw new WebError("User-agent text must be a single line without control characters.", "input");
  let browser = "Unknown";
  let version = "Unknown";
  const browserRules: readonly [string, RegExp][] = [
    ["Microsoft Edge", /\b(?:EdgA|EdgiOS|Edg|Edge)\/([\d.]+)/],
    ["Opera", /\b(?:OPR|OPiOS|Opera)\/([\d.]+)/],
    ["Samsung Internet", /\bSamsungBrowser\/([\d.]+)/],
    ["Firefox", /\b(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Chrome", /\b(?:Chrome|CriOS)\/([\d.]+)/],
    ["Internet Explorer", /\bMSIE ([\d.]+)/],
    ["Internet Explorer", /\brv:([\d.]+)/],
    ["Safari", /\bVersion\/([\d.]+)/],
    ["curl", /\bcurl\/([\d.]+)/i],
    ["Wget", /\bWget\/([\d.]+)/i],
  ];
  for (const [name, expression] of browserRules) {
    if (name === "Safari" && !/\bSafari\//.test(raw)) continue;
    if (name === "Internet Explorer" && expression.source.startsWith("\\brv:") && !/\bTrident\//.test(raw)) continue;
    const match = expression.exec(raw);
    if (match) { browser = name; version = match[1]; break; }
  }
  const botMatch = /\b(Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|Slurp|facebookexternalhit|Twitterbot|Applebot)(?:\/([\d.]+))?/i.exec(raw);
  const bot = Boolean(botMatch) || /\b(?:[a-z\d_-]*(?:bot|crawler|spider))\b/i.test(raw);
  if (botMatch) { browser = botMatch[1]; version = botMatch[2] ?? "Unknown"; }
  let os = "Unknown";
  const windows = /\bWindows NT ([\d.]+)/.exec(raw);
  const ios = /\b(?:CPU(?: iPhone)? OS|iPhone OS) ([\d_]+)/.exec(raw);
  const android = /\bAndroid(?: ([\d.]+))?/.exec(raw);
  const mac = /\bMac OS X(?: ([\d_]+))?/.exec(raw);
  if (ios) os = `iOS ${ios[1].replaceAll("_", ".")}`;
  else if (android) os = `Android${android[1] ? ` ${android[1]}` : ""}`;
  else if (windows) {
    const known: Record<string, string> = { "10.0": "Windows 10 or 11", "6.3": "Windows 8.1", "6.2": "Windows 8", "6.1": "Windows 7", "6.0": "Windows Vista", "5.1": "Windows XP" };
    os = known[windows[1]] ?? `Windows NT ${windows[1]}`;
  } else if (/\bCrOS\b/.test(raw)) os = "Chrome OS";
  else if (mac) os = `macOS${mac[1] ? ` ${mac[1].replaceAll("_", ".")}` : ""}`;
  else if (/\bLinux\b/.test(raw)) os = "Linux";
  let device = "unknown";
  if (bot) device = "bot";
  else if (/\biPad\b|\bTablet\b/i.test(raw) || (android && !/\bMobile\b/.test(raw))) device = "tablet";
  else if (/\biPhone\b|\biPod\b|\bMobile\b|\bWindows Phone\b/i.test(raw)) device = "mobile";
  else if (windows || mac || /\bLinux\b|\bCrOS\b/.test(raw)) device = "desktop";
  let engine = "Unknown";
  // iOS branded browsers retain WebKit; modern desktop Chromium browsers use Blink.
  if (/\bEdge\//.test(raw)) engine = "EdgeHTML";
  else if (/\bAppleWebKit\//.test(raw)) engine = /\b(?:Chrome|Chromium|EdgA|Edg|OPR|SamsungBrowser)\//.test(raw) && !/\biPhone\b|\biPad\b|\biPod\b/.test(raw) ? "Blink" : "WebKit";
  else if (/\bTrident\//.test(raw)) engine = "Trident";
  else if (/\bGecko\//.test(raw)) engine = "Gecko";
  return webResult({ browser, version, os, device, engine, raw }, [
    "Heuristic interpretation of supplied text only. User agents may be reduced, spoofed or ambiguous; this does not identify the actual browser or device.",
    ...(browser === "Unknown" ? ["No recognized browser token was found; unknown fields are left explicit."] : []),
  ]);
}

function scalar(code: number): boolean { return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff); }

async function entityReference(values: WebValues): Promise<WebResult> {
  const input = inspectText(values, "input");
  if (!input) throw new WebError("Enter a character, named entity, numeric entity, or Unicode code point.", "input");
  const { decodeHTMLStrict, encodeHTML } = await import("entities");
  // The encoder's ASCII fast path skips the named ASCII ligature; the decoder supports it.
  const encodeReference = (text: string) => text === "fj" ? "&fjlig;" : encodeHTML(text);
  const trimmed = input.trim();
  const numeric = /^&#(\d+);$/.exec(trimmed);
  const hexadecimal = /^&#x([\da-f]+);$/i.exec(trimmed);
  const codepoint = /^(?:U\+|0x)([\da-f]{1,6})$/i.exec(trimmed);
  let character: string;
  let named: string | null = null;
  if (numeric || hexadecimal || codepoint) {
    const code = Number.parseInt((numeric ?? hexadecimal ?? codepoint)![1], numeric ? 10 : 16);
    if (!scalar(code)) throw new WebError("Enter a valid Unicode scalar from U+0000 to U+10FFFF, excluding surrogates.", "input");
    character = String.fromCodePoint(code);
  } else {
    const nameMatch = /^&?([a-z][a-z\d]+);?$/i.exec(trimmed);
    const candidate = nameMatch ? `&${nameMatch[1]};` : "";
    const decoded = candidate ? decodeHTMLStrict(candidate) : candidate;
    if (candidate && decoded !== candidate) { character = decoded; named = candidate; }
    else {
      assertScalars(input, "input");
      const encoded = encodeReference(input);
      const points = Array.from(input);
      if (points.length !== 1 && !/^&[a-z][a-z\d]*;$/i.test(encoded)) {
        throw new WebError("Enter one Unicode scalar or one recognized named entity (including a named multi-code-point form).", "input");
      }
      character = input;
    }
  }
  const canonical = encodeReference(character);
  if (!named && /^&[a-z][a-z\d]*;$/i.test(canonical)) named = canonical;
  const codes = Array.from(character, char => char.codePointAt(0)!);
  const warnings: string[] = [];
  if (codes.length > 1) warnings.push("This named HTML entity represents multiple Unicode code points; decimal and hexadecimal forms concatenate their numeric references.");
  if (codes.some(code => code === 0 || (code >= 0x80 && code <= 0x9f) || code === 13)) warnings.push("Numeric references show the exact Unicode scalars. An HTML parser may replace or remap these control-code references under HTML rules.");
  return { ...webResult({ character, named, decimal: codes.map(code => `&#${code};`).join(""), hexadecimal: codes.map(code => `&#x${code.toString(16).toUpperCase()};`).join("") }, warnings), copyText: character };
}

export async function referenceWeb(id: string, values: WebValues): Promise<WebResult> {
  switch (id) {
    case "http-status-code-lookup": return statusLookup(values);
    case "mime-type-lookup": return mimeLookup(values);
    case "http-header-reference": return headerReference(values);
    case "user-agent-parser": return parseAgent(values);
    case "html-entity-reference": return entityReference(values);
    default: throw new WebError("This Web inspection tool is not supported.");
  }
}
