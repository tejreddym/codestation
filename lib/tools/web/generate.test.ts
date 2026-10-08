import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWeb } from "./generate";
import { WebError, type WebValues } from "./types";

const gen = (id: string, values: WebValues = {}) => generateWeb(id, values);
async function invalid(id: string, values: WebValues, field: string) {
  await expect(gen(id, values)).rejects.toMatchObject({ name: "WebError", field });
}

afterEach(() => vi.unstubAllGlobals());

describe("inert metadata generation", () => {
  it("escapes title and attributes while preserving Unicode", async () => {
    const { text } = await gen("meta-tag-generator", { title: '雪 🚀 </title><script>"&\'</script>', description: '" onload="alert(1)', author: "Émilie & 李", robots: "noindex, nofollow", themeColor: "#0a1B2c" });
    expect(text).toBe('<title>雪 🚀 &lt;/title&gt;&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;</title>\n<meta name="description" content="&quot; onload=&quot;alert(1)">\n<meta name="author" content="Émilie &amp; 李">\n<meta name="robots" content="noindex, nofollow">\n<meta name="theme-color" content="#0a1B2c">');
    expect(text).not.toContain("<script>");
  });
  it("omits empty metadata and does not invent content", async () => {
    expect(await gen("meta-tag-generator")).toEqual({ text: "" });
    expect((await gen("meta-tag-generator", { title: "Only" })).text).toBe("<title>Only</title>");
    expect((await gen("open-graph-generator")).text).toBe("");
  });
  it.each(["index, follow", "noindex, follow", "index, nofollow", "noindex, nofollow"])("accepts the exact robots choice %s", async (robots) => {
    expect((await gen("meta-tag-generator", { robots })).text).toContain(`content="${robots}"`);
  });
  it("rejects wrong options and non-text fields", async () => {
    await invalid("meta-tag-generator", { robots: "all" }, "robots");
    await invalid("meta-tag-generator", { title: 7 }, "title");
    await invalid("meta-tag-generator", { description: null }, "description");
  });
  it.each(["#abc", "#aBcD", "#123456", "#12345678", "rebeccapurple", "transparent", "rgb(0, 128, 255)", "rgba(0, 1, 2, .5)"])("accepts practical color %s", async (themeColor) => {
    expect((await gen("meta-tag-generator", { themeColor })).text).toContain("theme-color");
  });
  it.each(["#ab", "#ggg", "rgb(256, 0, 0)", "rgb(0, 0, 0, .5)", "rgba(0, 0, 0)", "url(https://example.com)", "var(--color)", "red; color: blue"])("rejects color %s", async (themeColor) => {
    await invalid("meta-tag-generator", { themeColor }, "themeColor");
  });
  it("generates all Open Graph fields with escaped URL query", async () => {
    const result = await gen("open-graph-generator", { title: "A < B", description: "你好", url: "https://example.com/?a=1&b=2", imageUrl: "https://example.com/image.png", siteName: 'Site "Name"', type: "article" });
    expect(result.text.split("\n")).toHaveLength(6);
    expect(result.text).toContain('<meta property="og:url" content="https://example.com/?a=1&amp;b=2">');
    expect(result.text).toContain('content="Site &quot;Name&quot;"');
    await invalid("open-graph-generator", { type: "video" }, "type");
  });
  it("preview is a local model plus a privacy/exact-rendering warning", async () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected network"); });
    vi.stubGlobal("fetch", fetch);
    const preview = { title: "<script>☃</script>", description: "A description", url: "https://example.com/", imageUrl: "https://remote.invalid/image.png", siteName: "Example" };
    const result = await gen("open-graph-preview", preview);
    expect(result.preview).toEqual(preview);
    expect(result.text).toContain(`title: ${preview.title}`);
    expect(result.warnings?.join(" ")).toMatch(/illustrative.*not an exact/);
    expect(result.warnings?.join(" ")).toMatch(/not fetched.*privacy/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["javascript:alert(1)", "data:image/png,a", "/relative", "ftp://example.com/", "https://user:secret@example.com/", " https://example.com", "https://example.com\nX", "https://"])("rejects metadata URL %s", async (url) => {
    await invalid("open-graph-generator", { url }, "url");
    await invalid("open-graph-preview", { imageUrl: url }, "imageUrl");
    await invalid("twitter-card-generator", { cardType: "summary", imageUrl: url }, "imageUrl");
  });
  it("Twitter has exact names and optional empty fields", async () => {
    const result = await gen("twitter-card-generator", { cardType: "summary_large_image", title: 'Hello "世界"', imageUrl: "https://example.com/x.png?a=1&b=2", siteHandle: "@code_station", creatorHandle: "@Alice1" });
    expect(result.text).toContain('name="twitter:card" content="summary_large_image"');
    expect(result.text).toContain('name="twitter:title" content="Hello &quot;世界&quot;"');
    expect(result.text).toContain('name="twitter:site" content="@code_station"');
    expect(result.text).not.toContain("twitter:description");
    expect((await gen("twitter-card-generator", { cardType: "summary" })).text).toBe('<meta name="twitter:card" content="summary">');
    await invalid("twitter-card-generator", {}, "cardType");
    await invalid("twitter-card-generator", { cardType: "player" }, "cardType");
  });
  it.each(["name", "@", "@abcdefghijklmnop", "@two words", "@名前", "@abc\nInjected", "@a-b"])("rejects Twitter handle %s", async (siteHandle) => {
    await invalid("twitter-card-generator", { cardType: "summary", siteHandle }, "siteHandle");
  });
});

describe("canonical URL", () => {
  it("normalizes through native URL and removes only the fragment", async () => {
    const result = await gen("canonical-url-generator", { url: "HTTPS://EXAMPLE.COM:443/a/../雪?q=a%20b&x=1&x=2#section" });
    const canonicalUrl = "https://example.com/%E9%9B%AA?q=a%20b&x=1&x=2";
    const canonicalTag = `<link rel="canonical" href="https://example.com/%E9%9B%AA?q=a%20b&amp;x=1&amp;x=2">`;
    expect(result.data).toEqual({ canonicalUrl, canonicalTag });
    expect(result.text).toBe(`${canonicalUrl}\n${canonicalTag}`);
  });
  it("preserves search order, empty keys and encoding", async () => {
    expect((await gen("canonical-url-generator", { url: "http://example.com/?b=2&a=&b=3&q=a+b#x" })).data?.canonicalUrl).toBe("http://example.com/?b=2&a=&b=3&q=a+b");
  });
  it("rejects credentials with no credential echo", async () => {
    try { await gen("canonical-url-generator", { url: "https://alice:very-secret@example.com/" }); throw new Error("Expected rejection"); }
    catch (error) { expect(error).toBeInstanceOf(WebError); expect(String(error)).not.toContain("very-secret"); }
    await invalid("canonical-url-generator", { url: "https://user@example.com" }, "url");
    await invalid("canonical-url-generator", {}, "url");
  });
});

describe("robots.txt", () => {
  it("supports multiple ordered groups and sitemap URLs", async () => {
    const result = await gen("robots-txt-generator", { groups: [{ userAgent: "*", allow: ["/public", "/search?*"], disallow: ["/private", ""] }, { userAgent: "ExampleBot", allow: ["/"], disallow: ["/secret$"] }], sitemaps: ["https://example.com/sitemap.xml", "https://example.com/map.xml?a=1&b=2"] });
    expect(result.text).toBe("User-agent: *\nAllow: /public\nAllow: /search?*\nDisallow: /private\nDisallow: \n\nUser-agent: ExampleBot\nAllow: /\nDisallow: /secret$\n\nSitemap: https://example.com/sitemap.xml\nSitemap: https://example.com/map.xml?a=1&b=2");
    expect(result.warnings).toEqual(["robots.txt controls crawler guidance. It is not an access-control or security mechanism."]);
  });
  it("omits absent lists without inventing directives", async () => {
    expect((await gen("robots-txt-generator", { groups: [{ userAgent: "*" }] })).text).toBe("User-agent: *");
    expect((await gen("robots-txt-generator")).text).toBe("");
  });
  it.each(["/safe\nAllow: /", "/safe\rDisallow: /", "/path # comment", "https://example.com/", "/path\u0085Sitemap: x"])("blocks directive injection %s", async (rule) => {
    await invalid("robots-txt-generator", { groups: [{ userAgent: "*", disallow: [rule] }] }, "groups.0.disallow.0");
  });
  it("validates nested types and crawler tokens", async () => {
    await invalid("robots-txt-generator", { groups: [null] }, "groups.0");
    await invalid("robots-txt-generator", { groups: [{ userAgent: "*\nDisallow: /" }] }, "groups.0.userAgent");
    await invalid("robots-txt-generator", { groups: [{ userAgent: "Two Bots" }] }, "groups.0.userAgent");
    await invalid("robots-txt-generator", { groups: [{ userAgent: "*", allow: [7] }] }, "groups.0.allow.0");
    await invalid("robots-txt-generator", { groups: [{ userAgent: "*", disallow: "/" }] }, "groups.0.disallow");
    await invalid("robots-txt-generator", { sitemaps: ["javascript:alert(1)"] }, "sitemaps.0");
    await invalid("robots-txt-generator", { sitemaps: ["https://example.com/#comment"] }, "sitemaps.0");
  });
});

describe("sitemap XML", () => {
  it("escapes URL markup and retains supplied factual dates", async () => {
    const result = await gen("sitemap-generator", { entries: [{ url: "https://example.com/雪?a=1&b=2", lastmod: "2024-02-29", changefreq: "weekly", priority: "0.80" }, { url: "https://example.com/second", lastmod: "2026-10-05T12:00:00.123456Z", priority: "1.0" }] });
    expect(result.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.text).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(result.text).toContain("<loc>https://example.com/雪?a=1&amp;b=2</loc>");
    expect(result.text).toContain("<lastmod>2024-02-29</lastmod>");
    expect(result.text).toContain("<lastmod>2026-10-05T12:00:00.123456Z</lastmod>");
    expect(result.text).toContain("<priority>0.80</priority>");
  });
  it("does not supply modification time, frequency or priority", async () => {
    const { text } = await gen("sitemap-generator", { entries: [{ url: "https://example.com/" }] });
    expect(text).not.toMatch(/lastmod|changefreq|priority/);
    await invalid("sitemap-generator", {}, "entries");
  });
  it.each(["2023-02-29", "1900-02-29", "2024-04-31", "0000-01-01", "2024-13-01", "2024-00-01", "2024-01-00", "2024-01-01T24:00:00Z", "2024-01-01T00:00:60Z", "2024-01-01T00:00:00", "2024-01-01T00:00:00+24:00", "today", "2024-1-1"])("rejects invalid lastmod %s", async (lastmod) => {
    await invalid("sitemap-generator", { entries: [{ url: "https://example.com/", lastmod }] }, "entries.0.lastmod");
  });
  it.each(["0001-01-01", "2000-02-29", "9999-12-31", "2024-01-01T03:04:05-05:30"])("accepts valid lastmod %s", async (lastmod) => {
    expect((await gen("sitemap-generator", { entries: [{ url: "https://example.com", lastmod }] })).text).toContain(`<lastmod>${lastmod}</lastmod>`);
  });
  it.each(["-0.1", "1.1", "2", "NaN", "1e-1", "0x1", "0.5 ", "1.", ""])("handles priority %s without numeric coercion", async (priority) => {
    if (!priority) expect((await gen("sitemap-generator", { entries: [{ url: "https://example.com", priority }] })).text).not.toContain("<priority>");
    else await invalid("sitemap-generator", { entries: [{ url: "https://example.com", priority }] }, "entries.0.priority");
  });
  it("validates rows, URLs, frequency, XML and numeric field types", async () => {
    await invalid("sitemap-generator", { entries: ["https://example.com"] }, "entries.0");
    await invalid("sitemap-generator", { entries: [{ url: "data:text/xml,x" }] }, "entries.0.url");
    await invalid("sitemap-generator", { entries: [{ url: "https://example.com", changefreq: "sometimes" }] }, "entries.0.changefreq");
    await invalid("sitemap-generator", { entries: [{ url: "https://example.com/\uffff" }] }, "entries.0.url");
    await invalid("sitemap-generator", { entries: [{ url: "https://example.com", priority: 0.5 }] }, "entries.0.priority");
  });
});

describe("manifest JSON", () => {
  it("emits exact manifest keys, Unicode JSON and icon metadata", async () => {
    const result = await gen("web-app-manifest-generator", { name: 'Code 雪 "Station"', shortName: "Code", startUrl: "/?a=1&b=2", scope: "/", display: "standalone", themeColor: "#123456", backgroundColor: "white", icons: [{ src: "icons/192.png", sizes: "192x192 512x512", type: "image/png", purpose: "any maskable" }, { src: "https://example.com/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "monochrome" }] });
    expect(JSON.parse(result.text)).toEqual({ name: 'Code 雪 "Station"', short_name: "Code", start_url: "/?a=1&b=2", scope: "/", display: "standalone", theme_color: "#123456", background_color: "white", icons: [{ src: "icons/192.png", sizes: "192x192 512x512", type: "image/png", purpose: "any maskable" }, { src: "https://example.com/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "monochrome" }] });
    expect(result.data).toEqual(JSON.parse(result.text));
    expect(result.text).toContain('\n  "name"');
    expect(result.warnings?.join(" ")).toMatch(/alone.*complete PWA/);
  });
  it("omits optional values and empty icons", async () => {
    expect((await gen("web-app-manifest-generator", { name: "Only", shortName: "", icons: [] })).text).toBe('{\n  "name": "Only"\n}');
    await invalid("web-app-manifest-generator", {}, "name");
    await invalid("web-app-manifest-generator", { name: "X", display: "window" }, "display");
  });
  it.each(["javascript:alert(1)", "data:image/png,x", "//remote.example/icon.png", "https://u:secret@example.com/icon.png", "path\\icon.png", "https://example.com/\n"])("rejects unsafe manifest URL %s", async (url) => {
    await invalid("web-app-manifest-generator", { name: "X", startUrl: url }, "startUrl");
    await invalid("web-app-manifest-generator", { name: "X", icons: [{ src: url }] }, "icons.0.src");
  });
  it.each(["/", "./start", "../app", "?version=1", "https://example.com/start"])("accepts relative or HTTP URL %s", async (startUrl) => {
    expect((await gen("web-app-manifest-generator", { name: "X", startUrl })).data?.start_url).toBe(startUrl);
  });
  it.each(["0x0", "192", "192X192", "192x192 192x192", "192x192  512x512", "-1x2", "100000x2"])("rejects malformed sizes %s", async (sizes) => {
    await invalid("web-app-manifest-generator", { name: "X", icons: [{ src: "/a.png", sizes }] }, "icons.0.sizes");
  });
  it.each(["text/html", "image/png; charset=utf-8", "image/", "image/png\nInjected"])("rejects malformed icon MIME %s", async (type) => {
    await invalid("web-app-manifest-generator", { name: "X", icons: [{ src: "/a.png", type }] }, "icons.0.type");
  });
  it.each(["adaptive", "maskable maskable", "any,maskable", "any  maskable"])("rejects malformed purpose %s", async (purpose) => {
    await invalid("web-app-manifest-generator", { name: "X", icons: [{ src: "/a.png", purpose }] }, "icons.0.purpose");
  });
  it("rejects malformed nested rows and required icon source", async () => {
    await invalid("web-app-manifest-generator", { name: "X", icons: [null] }, "icons.0");
    await invalid("web-app-manifest-generator", { name: "X", icons: [{}] }, "icons.0.src");
    await invalid("web-app-manifest-generator", { name: "X", icons: [{ src: "/a.png", sizes: [192] }] }, "icons.0.sizes");
  });
});

describe("generator bounds and isolation", () => {
  it("rejects unknown IDs", async () => { await expect(gen("unknown")).rejects.toBeInstanceOf(WebError); });
  it("accepts the exact per-field bound and rejects overflow", async () => {
    expect((await gen("meta-tag-generator", { title: "x".repeat(200_000) })).text.length).toBe(200_015);
    await invalid("meta-tag-generator", { title: "x".repeat(200_001) }, "title");
  });
  it("rejects aggregate input overflow", async () => {
    await invalid("open-graph-generator", { title: "x".repeat(200_000), description: "x".repeat(200_000), url: `https://example.com/${"x".repeat(199_980)}`, imageUrl: `https://example.com/${"x".repeat(199_980)}`, siteName: "x".repeat(200_000), type: "website" }, "type");
  });
  it("supports 1,000 rows, rejects overflow and non-list structures", async () => {
    expect((await gen("sitemap-generator", { entries: Array.from({ length: 1_000 }, () => ({ url: "https://example.com" })) })).text.match(/<url>/g)).toHaveLength(1_000);
    await invalid("sitemap-generator", { entries: Array.from({ length: 1_001 }, () => ({ url: "https://example.com" })) }, "entries");
    await invalid("robots-txt-generator", { groups: [{ userAgent: "*", allow: Array(1_001).fill("/") }] }, "groups.0.allow");
    await invalid("robots-txt-generator", { groups: [{ userAgent: "*", allow: Array(1_000).fill("") }] }, "groups.0.allow");
    await invalid("web-app-manifest-generator", { name: "X", icons: {} }, "icons");
  });
  it.each(["bad\ud800", "bad\udc00", "a\u0000b"])("rejects invalid Unicode %s", async (title) => {
    await invalid("meta-tag-generator", { title }, "title");
  });
  it("does not perform network or storage operations for any generator", async () => {
    const fetch = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", storage);
    const cases: [string, WebValues][] = [["meta-tag-generator", { title: "A" }], ["open-graph-generator", { imageUrl: "https://example.com/a.png" }], ["open-graph-preview", { imageUrl: "https://example.com/a.png" }], ["twitter-card-generator", { cardType: "summary" }], ["canonical-url-generator", { url: "https://example.com" }], ["robots-txt-generator", {}], ["sitemap-generator", { entries: [{ url: "https://example.com" }] }], ["web-app-manifest-generator", { name: "A", icons: [{ src: "https://example.com/a.png" }] }]];
    for (const [id, values] of cases) await gen(id, values);
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
