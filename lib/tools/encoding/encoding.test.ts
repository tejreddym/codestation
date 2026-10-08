import { describe, expect, it } from "vitest";
import { encodingTools } from "@/config/encoding-tools";
import { runEncoding } from "./index";
import * as bytes from "./bytes";

const run = (slug: string, input: string, mime?: string) => runEncoding(slug, { input, ...(mime !== undefined ? { mime } : {}) });
const jwt = (header = '{"alg":"HS256"}', payload = '{"name":"Tej"}', signature = "AA") => `${bytes.encodeBase64Url(header)}.${bytes.encodeBase64Url(payload)}.${signature}`;
const invalidInputs: Record<string, string> = {
  "base64-decoder": "Zg=", "base64-url-decoder": "A", "base32-decoder": "MZ======", "base58-decoder": "0OIl",
  "hex-to-text": "ABC", "hexadecimal-decoder": "0x41", "binary-decoder": "0100000", "ascii-to-text": "128",
  "octal-to-text": "400", "unicode-to-text": "U+D800", "unicode-escape-decoder": "\\uD800",
  "url-decoder": "%G0", "url-component-decoder": "%C0%AF", "jwt-decoder": "a.b.c.d",
  "data-uri-decoder": "data:text/plain;base64,!!!!", "punycode-encoder": "bad label", "punycode-decoder": "xn--",
};

describe("URL, HTML, JWT, Data URI and domain boundaries", () => {
  it("distinguishes complete URLs from components without changing domains or plus signs", async () => {
    const url = "https://example.com/café?q=hello world&next=/a#part";
    expect((await run("url-encoder", url)).text).toBe("https://example.com/caf%C3%A9?q=hello%20world&next=/a#part");
    expect((await run("url-decoder", "https://example.com/a%2Fb?q=x%26y+z%20é")).text).toBe("https://example.com/a%2Fb?q=x%26y+z é");
    expect((await run("url-component-encoder", "hello world?name=Tej")).text).toBe("hello%20world%3Fname%3DTej");
    expect((await run("url-component-decoder", "a%2Fb%26c+d")).text).toBe("a/b&c+d");
    for (const input of ["%", "%A", "%GG", "%ED%A0%80", "%C0%AF"]) {
      await expect(run("url-decoder", input)).rejects.toThrow();
      await expect(run("url-component-decoder", input)).rejects.toThrow();
    }
  });
  it("supports complete HTML5 references, with inert markup output", async () => {
    expect((await run("html-encoder", `&<>"'`)).text).toBe("&amp;&lt;&gt;&quot;&#39;");
    for (const slug of ["html-decoder", "html-entity-decoder"]) {
      expect((await run(slug, "&NotEqualTilde; &#65; &#x1F680; &lt;script&gt;")).text).toBe("≂̸ A 🚀 <script>");
      expect((await run(slug, "&#x110000; &madeup;")).text).toBe("� &madeup;");
    }
    expect((await run("html-entity-encoder", "ABC123")).text).toBe("ABC123");
    const encoded = (await run("html-entity-encoder", "é©🚀")).text;
    expect((await run("html-entity-decoder", encoded)).text).toBe("é©🚀");
  });
  it("decodes JWT sections without verifying signatures and preserves numeric lexemes", async () => {
    const result = await run("jwt-decoder", jwt(undefined, '{"n":9007199254740993,"emoji":"🚀"}', "_w"));
    expect(result.parts?.map(part => part.label)).toEqual(["Header JSON", "Payload JSON", "Signature text"]);
    expect(result.parts?.[1].value).toContain("9007199254740993");
    expect(result.parts?.[2].value).toBe("_w"); // Arbitrary signature bytes are not decoded as UTF-8.
    expect((await run("jwt-decoder", jwt('{"alg":"none"}', "{}", ""))).parts?.[2].value).toBe("");
    for (const input of ["a.b", "a.b.c.d", jwt(undefined, "not json"), jwt(undefined, "[]"), jwt(undefined, "{}", "A"), jwt(undefined, "{}", "=="), jwt(undefined, "{}", ""), jwt('{"alg":"none"}', "{}", "AA"), jwt("{}")]) {
      await expect(run("jwt-decoder", input)).rejects.toThrow();
    }
  });
  it("round-trips percent and Base64 Data URIs with only the three contracted outputs", async () => {
    expect((await run("data-uri-encoder", "Hello, 🚀", "text/plain")).text).toBe("data:text/plain,Hello%2C%20%F0%9F%9A%80");
    const result = await run("data-uri-decoder", "data:text/plain;base64,SGVsbG8=");
    expect(result.parts).toEqual([{ label: "MIME type", value: "text/plain" }, { label: "Encoding mode", value: "Base64" }, { label: "Decoded data", value: "Hello" }]);
    expect((await run("data-uri-decoder", "data:,Hello%20world")).parts).toEqual([{ label: "MIME type", value: "text/plain;charset=US-ASCII" }, { label: "Encoding mode", value: "Percent-encoded" }, { label: "Decoded data", value: "Hello world" }]);
    expect((await run("data-uri-decoder", "data:text/html,%3Cscript%3Ealert(1)%3C%2Fscript%3E")).parts?.[2].value).toBe("<script>alert(1)</script>");
    for (const input of ["https://example.com", "data:text/plain", "data:text/plain;base64,!!!", "data:text/plain,%FF", "data:text/plain,%GG", "data:text/plain;charset=unknown,a", "data:text/plain;base64;foo=bar,QQ==", "data:text/plain,a#fragment"]) {
      await expect(run("data-uri-decoder", input)).rejects.toThrow();
    }
    for (const mime of ["", "bad", "text/plain,evil", "text/plain\n", "text/plain;base64"]) await expect(run("data-uri-encoder", "text", mime)).rejects.toThrow();
  });
  it("uses IDNA normalization and validates labels without URL parsing or DNS", async () => {
    expect((await run("punycode-encoder", "BÜCHER。example.")).text).toBe("xn--bcher-kva.example.");
    expect((await run("punycode-decoder", "xn--bcher-kva.example.")).text).toBe("bücher.example.");
    expect((await run("punycode-encoder", "123")).text).toBe("123");
    expect((await run("punycode-encoder", "faß.de")).text).toBe("xn--fa-hia.de");
    for (const value of ["https://example.com", "a..b", "-bad.example", "bad-.example", "bad_name", "a".repeat(64), "xn--", "xn--abc-", "a\u200db"]) await expect(run("punycode-encoder", value)).rejects.toThrow();
    await expect(run("punycode-decoder", "münich")).rejects.toThrow(/ASCII/);
  });
});

describe("all Encoding contracts", () => {
  it.each(encodingTools)("$slug executes its exact example", async (tool) => {
    const result = await runEncoding(tool.slug, tool.encodingContract.example);
    expect(typeof result.text).toBe("string"); expect(result.text.length).toBeGreaterThan(0);
  });
  it.each(encodingTools)("$slug handles empty input explicitly", async (tool) => {
    if (["jwt-decoder", "data-uri-decoder", "punycode-encoder", "punycode-decoder"].includes(tool.slug)) {
      await expect(run(tool.slug, "")).rejects.toThrow();
    } else {
      const result = await run(tool.slug, "", "text/plain");
      expect(result.text).toBe(tool.slug === "data-uri-encoder" ? "data:text/plain," : "");
    }
  });
  it.each(encodingTools)("$slug rejects malformed input rather than silently repairing", async (tool) => {
    // Text encoders accept every well-formed Unicode string (ASCII is intentionally narrower).
    if (tool.slug === "html-decoder" || tool.slug === "html-entity-decoder") {
      expect((await run(tool.slug, "&notAnEntity;")).text).toBe("¬AnEntity;"); // HTML5 legacy text-context behavior.
    } else if (tool.slug === "data-uri-encoder") await expect(run(tool.slug, "hello", "text/plain;base64")).rejects.toThrow();
    else await expect(run(tool.slug, invalidInputs[tool.slug] ?? "\uD800")).rejects.toThrow();
  });
  it.each(encodingTools)("$slug bounds excessive input", async (tool) => {
    await expect(run(tool.slug, "A".repeat(1_000_001), "text/plain")).rejects.toThrow(/1,000,000/);
  });
  it.each(encodingTools)("$slug has a defined Unicode result or format error", async (tool) => {
    const text = "é漢🚀";
    if (tool.slug === "text-to-ascii" || tool.slug === "ascii-to-text") return expect(run(tool.slug, text)).rejects.toThrow();
    if (tool.slug === "punycode-encoder") return expect((await run(tool.slug, "bücher.example")).text).toBe("xn--bcher-kva.example");
    if (tool.slug === "punycode-decoder") return expect((await run(tool.slug, "xn--bcher-kva.example")).text).toBe("bücher.example");
    if (tool.slug === "jwt-decoder") return expect((await run(tool.slug, jwt(undefined, JSON.stringify({ text })))).parts?.[1].value).toContain(text);
    if (tool.slug === "data-uri-encoder") return expect((await run(tool.slug, text, "text/plain")).text).toBe(`data:text/plain,${encodeURIComponent(text)}`);
    if (tool.slug === "data-uri-decoder") return expect((await run(tool.slug, `data:text/plain,${encodeURIComponent(text)}`)).parts?.[2].value).toBe(text);
    if (tool.direction === "reverse" && tool.pairedTool) {
      const encoded = await run(tool.pairedTool, text);
      expect((await run(tool.slug, encoded.text)).text).toBe(text);
    } else {
      const encoded = await run(tool.slug, text);
      expect(encoded.text.length).toBeGreaterThan(0);
      if (tool.pairedTool) expect((await run(tool.pairedTool, encoded.text)).text).toBe(text);
    }
  });
  it.each(encodingTools)("$slug processes a reasonable larger input", async (tool) => {
    const text = "Hello ".repeat(1000);
    if (tool.slug.startsWith("punycode-")) {
      const domain = Array(4).fill("a".repeat(60)).join(".");
      expect((await run(tool.slug, domain)).text).toBe(domain); return;
    }
    if (tool.slug === "jwt-decoder") { expect((await run(tool.slug, jwt(undefined, JSON.stringify({ text })))).parts?.[1].value).toContain(text); return; }
    if (tool.slug === "data-uri-encoder") { expect((await run(tool.slug, text, "text/plain")).text).toContain("data:text/plain,"); return; }
    if (tool.slug === "data-uri-decoder") { expect((await run(tool.slug, `data:text/plain,${encodeURIComponent(text)}`)).parts?.[2].value).toBe(text); return; }
    if (tool.direction === "reverse" && tool.pairedTool) {
      const encoded = await run(tool.pairedTool, text); expect((await run(tool.slug, encoded.text)).text).toBe(text);
    } else if (tool.pairedTool) {
      const encoded = await run(tool.slug, text); expect((await run(tool.pairedTool, encoded.text)).text).toBe(text);
    }
  });
});

describe("byte and Unicode conformance boundaries", () => {
  it.each(["", "f", "fo", "foo", "foob", "fooba", "foobar"])("matches RFC4648 vectors for %s", (input) => {
    expect(bytes.encodeBase64(input)).toBe(Buffer.from(input).toString("base64"));
    const expected = ["", "MY======", "MZXQ====", "MZXW6===", "MZXW6YQ=", "MZXW6YTB", "MZXW6YTBOI======"];
    expect(bytes.encodeBase32(input)).toBe(expected[input.length]);
    expect(bytes.decodeBase32(expected[input.length])).toBe(input);
  });
  it.each(["Zg", "Zg=", "Zg===", "Zh==", "Zm9=", "Zm=8", "Zm9v ", "!!!!"])("rejects malformed/canonical Base64 %s", input => {
    expect(() => bytes.decodeBase64(input)).toThrow();
  });
  it.each(["A", "Zg===", "Zh", "Zg+_", "Zg==\n", "===="])("rejects malformed Base64URL %s", input => {
    expect(() => bytes.decodeBase64Url(input)).toThrow();
  });
  it.each(["MY", "my======", "MZ======", "MY=====", "M=Y=====", "MY-=====", "MY====== "])("rejects malformed Base32 %s", input => {
    expect(() => bytes.decodeBase32(input)).toThrow();
  });
  it("rejects invalid UTF-8 in every byte decoder and preserves BOM", () => {
    for (const [decode, invalid] of [[bytes.decodeBase64, "/w=="], [bytes.decodeBase64Url, "_w"], [bytes.decodeBase32, "74======"], [bytes.decodeHexadecimal, "FF"], [bytes.decodeBinary, "11111111"], [bytes.decodeOctal, "377"], [bytes.decodeBase58, "5Q"]] as const) {
      expect(() => decode(invalid)).toThrow(/UTF-8/);
    }
    expect(bytes.decodeHexadecimal("EFBBBF41")).toBe("\uFEFFA");
    expect(bytes.decodeBase64(bytes.encodeBase64("\uFEFF🚀"))).toBe("\uFEFF🚀");
    expect(() => bytes.encodeBase64("\uD800")).toThrow(/surrogate/);
    expect(() => bytes.decodeHexadecimal("C080")).toThrow(/UTF-8/);
  });
  it("preserves Base58 leading zero bytes and maximum encode/decode round trip", () => {
    expect(bytes.encodeBase58("\0\0A")).toBe("1128");
    expect(bytes.decodeBase58("1128")).toBe("\0\0A");
    const source = "a".repeat(bytes.MAX_BASE58_INPUT);
    expect(bytes.decodeBase58(bytes.encodeBase58(source))).toBe(source);
    expect(() => bytes.encodeBase58(`${source}a`)).toThrow(/16,384/);
  });
  it("uses exact byte widths and strict numeric notation", () => {
    expect(bytes.encodeHexadecimal("é🚀")).toBe("C3A9F09F9A80");
    expect(bytes.encodeBinary("A")).toBe("01000001");
    expect(bytes.encodeOctal("A")).toBe("101");
    for (const value of ["41A", "0x41", "41:42", "4 1", "GG"]) expect(() => bytes.decodeHexadecimal(value)).toThrow();
    for (const value of ["1", "010000012", "0100000101000010"]) expect(() => bytes.decodeBinary(value)).toThrow();
    for (const value of ["1", "40", "400", "088", "101102"]) expect(() => bytes.decodeOctal(value)).toThrow();
    for (const value of ["128", "-1", "1e2", "0x41", "65.0"]) expect(() => bytes.decodeAscii(value)).toThrow();
    expect(bytes.decodeAscii("0 127")).toBe("\0\x7f");
  });
  it("represents scalar values and reversible Unicode escapes without executing code", () => {
    expect(bytes.encodeUnicode("Aé🚀")).toBe("U+0041 U+00E9 U+1F680");
    expect(bytes.decodeUnicode("U+10FFFF")).toBe(String.fromCodePoint(0x10ffff));
    for (const value of ["U+D800", "U+110000", "0041", "U+41", "U+004Z"]) expect(() => bytes.decodeUnicode(value)).toThrow();
    const text = 'ASCII \\u0041\n"é🚀"';
    expect(bytes.encodeUnicodeEscapes("Aé🚀")).toBe("A\\u00E9\\uD83D\\uDE80");
    expect(bytes.decodeUnicodeEscapes(bytes.encodeUnicodeEscapes(text))).toBe(text);
    expect(bytes.decodeUnicodeEscapes("plain \\n text")).toBe("plain \\n text");
    for (const value of ["\\u12", "\\uZZZZ", "\\uD800", "\\uDC00", "\\u{1F680}"]) expect(() => bytes.decodeUnicodeEscapes(value)).toThrow();
  });
});
