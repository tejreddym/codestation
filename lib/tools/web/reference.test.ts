import { describe, expect, it, vi } from "vitest";
import { inspectWeb } from "./inspect";
import { HTTP_HEADERS, HTTP_STATUSES, MIME_TYPES } from "./reference-data";
import { WebError } from "./types";

const lookup = async (id: string, input: string) => (await inspectWeb(id, { input })).data!;

describe("local HTTP status reference", () => {
  it.each(Object.entries(HTTP_STATUSES))("returns assigned curated status %s", async (code, entry) => {
    expect(await lookup("http-status-code-lookup", code)).toMatchObject({ code: Number(code), statusText: entry[0], description: entry[1] });
  });
  it.each([["100", "Informational"], ["200", "Success"], ["301", "Redirection"], ["404", "Client error"], ["500", "Server error"]])("classifies %s", async (input, category) => {
    expect((await lookup("http-status-code-lookup", input)).category).toBe(`${input[0]}xx ${category}`);
  });
  it.each(["299", "399", "599"])("never invents a specific meaning for %s", async input => {
    const result = await inspectWeb("http-status-code-lookup", { input });
    expect(result.data).toMatchObject({ statusText: "Unknown/unassigned in local reference" });
    expect(result.data?.description).toContain("No specific meaning is inferred");
    expect(result.warnings?.length).toBeGreaterThan(0);
  });
  it.each(["", "99", "600", "999", "200 OK", "200.0", "2e2", "0200", "-200"])("rejects invalid code %s", async input => {
    await expect(inspectWeb("http-status-code-lookup", { input })).rejects.toMatchObject({ field: "input" });
  });
  it("trims code whitespace", async () => {
    expect((await lookup("http-status-code-lookup", " 200 ")).statusText).toBe("OK");
  });
});

describe("local curated MIME reference", () => {
  it.each(MIME_TYPES)("looks up $mime", async entry => {
    expect(await lookup("mime-type-lookup", entry.mime)).toMatchObject({ mime: entry.mime, extensions: [...entry.extensions], category: entry.mime.split("/")[0] });
  });
  it.each([[".json", "application/json"], ["json", "application/json"], [".PNG", "image/png"], ["TEXT/HTML", "text/html"], ["text/html; charset=UTF-8", "text/html"], [" .JPG ", "image/jpeg"], [".js", "text/javascript"]])("maps %s to %s", async (input, mime) => {
    expect((await lookup("mime-type-lookup", input)).mime).toBe(mime);
  });
  it.each(["", ".unknown", "application/x-made-up", "image/whatever", "https://example.com/a.png", "x.json", "<script>"])("does not infer content or fetch %s", async input => {
    await expect(inspectWeb("mime-type-lookup", { input })).rejects.toMatchObject({ field: "input" });
  });
  it("discloses that extension mappings do not verify file content", async () => {
    expect((await inspectWeb("mime-type-lookup", { input: ".json" })).warnings?.[0]).toContain("do not verify");
  });
});

describe("local HTTP header reference", () => {
  it.each(HTTP_HEADERS)("canonicalizes $name case-insensitively and copies its example", async entry => {
    const result = await inspectWeb("http-header-reference", { input: ` ${entry.name.toUpperCase()} ` });
    expect(result.data).toEqual({ name: entry.name, category: entry.category, purpose: entry.purpose, example: entry.example });
    expect(result.copyText).toBe(entry.example);
  });
  it.each(["", "X-Made-Up", "Content-Type: text/html", "Authorization: SECRET", "ContentType"])("rejects names absent from the reference %s", async input => {
    await expect(inspectWeb("http-header-reference", { input })).rejects.toMatchObject({ field: "input" });
    try { await inspectWeb("http-header-reference", { input }); } catch (error) { expect(String(error)).not.toContain("SECRET"); }
  });
});

describe("bounded user-agent heuristics", () => {
  const vectors = [
    { raw: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36", browser: "Chrome", version: "125.0.0.0", os: "Windows 10 or 11", device: "desktop", engine: "Blink" },
    { raw: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/125.0 Safari/537.36 Edg/125.1", browser: "Microsoft Edge", version: "125.1", device: "desktop", engine: "Blink" },
    { raw: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/42.0 Safari/537.36 Edge/12.0", browser: "Microsoft Edge", version: "12.0", engine: "EdgeHTML" },
    { raw: "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0", browser: "Firefox", version: "125.0", os: "Linux", device: "desktop", engine: "Gecko" },
    { raw: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15", browser: "Safari", version: "17.5", os: "macOS 14.5", device: "desktop", engine: "WebKit" },
    { raw: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1", browser: "Safari", os: "iOS 17.5", device: "mobile", engine: "WebKit" },
    { raw: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1", browser: "Safari", os: "iOS 17.5", device: "tablet", engine: "WebKit" },
    { raw: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/125.0 Mobile/15E148 Safari/604.1", browser: "Chrome", version: "125.0", device: "mobile", engine: "WebKit" },
    { raw: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 FxiOS/125.0 Mobile/15E148 Safari/604.1", browser: "Firefox", engine: "WebKit" },
    { raw: "Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36", browser: "Chrome", os: "Android 14", device: "mobile", engine: "Blink" },
    { raw: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0 Safari/537.36", os: "Android 14", device: "tablet" },
    { raw: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0 Safari/537.36 SamsungBrowser/25.0", browser: "Samsung Internet", version: "25.0", engine: "Blink" },
    { raw: "Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36 OPR/110.0", browser: "Opera", version: "110.0", engine: "Blink" },
    { raw: "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko", browser: "Internet Explorer", version: "11.0", os: "Windows 7", engine: "Trident" },
    { raw: "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)", browser: "Internet Explorer", version: "8.0", engine: "Trident" },
    { raw: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", browser: "Googlebot", version: "2.1", device: "bot" },
    { raw: "bingbot/2.0", browser: "bingbot", version: "2.0", device: "bot" },
    { raw: "ExampleCrawler/1.2", browser: "Unknown", version: "Unknown", device: "bot" },
    { raw: "curl/8.7.1", browser: "curl", version: "8.7.1", device: "unknown", engine: "Unknown" },
    { raw: "Wget/1.21.4", browser: "Wget", version: "1.21.4" },
    { raw: "hello 雪", browser: "Unknown", version: "Unknown", os: "Unknown", device: "unknown", engine: "Unknown" },
    { raw: "Safari/605.1", browser: "Unknown", version: "Unknown" },
    { raw: "Version/17.5", browser: "Unknown", version: "Unknown" },
    { raw: "rv:123.0", browser: "Unknown", version: "Unknown" },
  ];
  it.each(vectors)("interprets $raw transparently", async ({ raw, ...expected }) => {
    const result = await inspectWeb("user-agent-parser", { input: raw });
    expect(result.data).toMatchObject({ raw, ...expected });
    expect(result.warnings?.[0]).toContain("Heuristic");
  });
  it.each(["", " ", "Chrome/125\n", "abc\rdef", "abc\u0000def"])("rejects empty or malformed agent %j", async input => {
    await expect(inspectWeb("user-agent-parser", { input })).rejects.toMatchObject({ field: "input" });
  });
  it("handles long non-matching token sequences within the text bound", async () => {
    const result = await lookup("user-agent-parser", "Version/17.5 ".repeat(10_000));
    expect(result.browser).toBe("Unknown");
    await expect(inspectWeb("user-agent-parser", { input: "x".repeat(200_001) })).rejects.toBeInstanceOf(WebError);
  });
});

describe("HTML entity reference without HTML execution", () => {
  it.each(["amp", "&amp;", "&amp", "&", "U+0026", "&#38;", "&#x26;", "0x26"])("resolves ampersand %s", async input => {
    expect(await lookup("html-entity-reference", input)).toEqual({ character: "&", named: "&amp;", decimal: "&#38;", hexadecimal: "&#x26;" });
  });
  it.each([["copy", "©", "&#169;", "&#xA9;"], ["&lt;", "<", "&#60;", "&#x3C;"], ["😀", "😀", "&#128512;", "&#x1F600;"], ["U+1F600", "😀", "&#128512;", "&#x1F600;"], ["&#x1f600;", "😀", "&#128512;", "&#x1F600;"], ["雪", "雪", "&#38634;", "&#x96EA;"], [" ", " ", "&#32;", "&#x20;"], ["U+10FFFF", "\u{10ffff}", "&#1114111;", "&#x10FFFF;"]])("resolves %s exactly", async (input, character, decimal, hexadecimal) => {
    const result = await inspectWeb("html-entity-reference", { input });
    expect(result.data).toMatchObject({ character, decimal, hexadecimal });
    expect(result.copyText).toBe(character);
  });
  it("preserves the selected named alias while reporting exact code points", async () => {
    expect(await lookup("html-entity-reference", "&COPY;")).toMatchObject({ character: "©", named: "&COPY;" });
  });
  it.each(["&NotEqualTilde;", "NotEqualTilde", "≂̸"])("reports multi-code-point named form %s explicitly", async input => {
    const result = await inspectWeb("html-entity-reference", { input });
    expect(result.data).toMatchObject({ character: "≂̸", decimal: "&#8770;&#824;", hexadecimal: "&#x2242;&#x338;" });
    expect(result.warnings?.[0]).toContain("multiple Unicode code points");
  });
  it.each(["fjlig", "fj"])("supports named ASCII sequence %s", async input => {
    expect(await lookup("html-entity-reference", input)).toMatchObject({ character: "fj", named: "&fjlig;" });
  });
  it.each(["U+0000", "&#0;", "&#128;", "&#x80;"])("reports control scalars without HTML numeric remapping: %s", async input => {
    const result = await inspectWeb("html-entity-reference", { input });
    const code = input === "U+0000" || input === "&#0;" ? 0 : 128;
    expect(result.data?.character).toBe(String.fromCodePoint(code));
    expect(result.warnings?.[0]).toContain("replace or remap");
  });
  it.each(["", "notanentity", "&unknown;", "&#xZZ;", "&#-1;", "&#1114112;", "&#55296;", "&#xDFFF;", "U+110000", "U+D800", "\ud800", "two characters", "<script>", "&amp;&lt;"])("rejects invalid or non-scalar reference %j", async input => {
    await expect(inspectWeb("html-entity-reference", { input })).rejects.toMatchObject({ field: "input" });
  });
  it("is case sensitive for actual HTML entity names", async () => {
    await expect(inspectWeb("html-entity-reference", { input: "&Amp;" })).rejects.toMatchObject({ field: "input" });
  });
});

describe("local-only reference processing", () => {
  it("does not invoke a network fetch while processing references and URLs", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Unexpected fetch"); });
    try {
      for (const [id, input] of [["http-status-code-lookup", "200"], ["mime-type-lookup", ".png"], ["http-header-reference", "Origin"], ["user-agent-parser", "curl/8.0"], ["html-entity-reference", "&amp;"], ["query-string-parser", "https://example.com/?a=b"]]) await inspectWeb(id, { input });
      await inspectWeb("url-parser", { url: "https://example.com/" });
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it.each(["http-status-code-lookup", "mime-type-lookup", "http-header-reference", "html-entity-reference"])("enforces text bounds for %s", async id => {
    await expect(inspectWeb(id, { input: "x".repeat(200_001) })).rejects.toMatchObject({ field: "input" });
  });
});
