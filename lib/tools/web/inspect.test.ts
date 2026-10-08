import { describe, expect, it } from "vitest";
import { inspectWeb } from "./inspect";
import { WebError, type WebValues } from "./types";

const data = async (id: string, values: WebValues) => (await inspectWeb(id, values)).data!;
const build = (values: WebValues = {}) => inspectWeb("url-builder", { scheme: "https", hostname: "example.com", ...values });

describe("URL parser", () => {
  it("uses native URL rules and preserves repeated query order", async () => {
    const result = await data("url-parser", { url: "HTTPS://us%C3%A9r:TOP_SECRET@BÜCHER.example:8443/a%20b/%E2%9C%93?x=1&x=2&=empty&space=a+b#caf%C3%A9" });
    expect(result).toMatchObject({ scheme: "https", protocol: "https:", username: "usér", rawUsername: "us%C3%A9r", passwordPresent: "Present", hostname: "xn--bcher-kva.example", port: "8443", pathname: "/a%20b/%E2%9C%93", decodedPathname: "/a b/✓", fragment: "café", rawFragment: "caf%C3%A9" });
    expect(result.parameters).toEqual([{ key: "x", value: "1" }, { key: "x", value: "2" }, { key: "", value: "empty" }, { key: "space", value: "a b" }]);
    expect(JSON.stringify(result)).not.toContain("TOP_SECRET");
    expect(result).not.toHaveProperty("password");
  });
  it("does not expose an empty password and drops a default port", async () => {
    expect(await data("url-parser", { url: "https://u:@example.com:443" })).toMatchObject({ passwordPresent: "Not present", port: "", pathname: "/", parameters: [], fragment: "" });
  });
  it.each(["https://[2001:db8::1]:8080/x", "mailto:someone@example.com", "data:text/plain,hello", "file:///a/b"])("supports native absolute URL %s", async url => {
    expect((await data("url-parser", { url })).protocol).toBe(new URL(url).protocol);
  });
  it("warns for invalid UTF-8 in components without failing", async () => {
    const result = await inspectWeb("url-parser", { url: "https://example.com/%FF#%ZZ" });
    expect(result.data).toMatchObject({ decodedPathname: "/%FF", fragment: "%ZZ" });
    expect(result.warnings).toHaveLength(2);
  });
  it.each(["", " ", "relative/path", "https://", "https://user:PRIVATE@[invalid"])("rejects malformed URL without echoing credentials: %s", async url => {
    await expect(inspectWeb("url-parser", { url })).rejects.toMatchObject({ name: "WebError", field: "url" });
    try { await inspectWeb("url-parser", { url }); } catch (error) { expect(String(error)).not.toContain("PRIVATE"); }
  });
});

describe("URL builder", () => {
  it("encodes decoded fields exactly once with IDN hosts", async () => {
    const result = await build({ hostname: "bücher.example", username: "a@b%", password: "x:y%", port: "8080", pathname: "/café/100%/a?b#c", parameters: [{ key: "q", value: "a+b 50%" }, { key: "q", value: "✓" }], fragment: "hello #50%" });
    expect(result.text).toBe("https://a%40b%25:x%3Ay%25@xn--bcher-kva.example:8080/caf%C3%A9/100%25/a%3Fb%23c?q=a%2Bb+50%25&q=%E2%9C%93#hello%20%2350%25");
    expect(result.copyText).toBe(result.text);
  });
  it.each(["2001:db8::1", "[2001:db8::1]"])("accepts IPv6 hostname %s", async hostname => {
    expect((await build({ hostname, port: "65535" })).text).toBe("https://[2001:db8::1]:65535/");
  });
  it("uses native default port and path normalization", async () => {
    const result = await build({ port: "443", pathname: "/a/../b/./c" });
    expect(result.text).toBe("https://example.com/b/c");
    expect(result.warnings?.[0]).toContain("Dot path segments");
  });
  it("supports native empty username with password", async () => {
    expect((await build({ password: "secret" })).text).toBe("https://:secret@example.com/");
  });
  it("handles empty optional fields and empty parameter keys", async () => {
    expect((await build()).text).toBe("https://example.com/");
    expect((await build({ pathname: "hello", parameters: [{ key: "", value: "" }] })).text).toBe("https://example.com/hello?=");
  });
  it("never treats a decoded percent escape as already encoded", async () => {
    expect((await build({ pathname: "/%2F", fragment: "%20", parameters: [{ key: "%", value: "%20" }] })).text).toBe("https://example.com/%252F?%25=%2520#%2520");
  });
  it.each(["0", "65536", "-1", "1.5", "1e2", " 80", "", "00000"])("validates port %s", async port => {
    if (port === "") expect((await build({ port })).text).toBe("https://example.com/");
    else await expect(build({ port })).rejects.toMatchObject({ field: "port" });
  });
  it.each(["", "example.com:443", "[::1]:443", "u@example.com", "example.com/a", "example.com?x", " example.com", "%65xample.com", "[not-ip]"])("rejects non-host input %s", async hostname => {
    await expect(build({ hostname })).rejects.toMatchObject({ field: "hostname" });
  });
  it.each(["ftp", "HTTPS", "https:", ""])("rejects scheme %s", async scheme => {
    await expect(build({ scheme })).rejects.toMatchObject({ field: "scheme" });
  });
  it.each(["username", "password", "pathname", "fragment"])("rejects non-scalar Unicode in %s", async field => {
    await expect(build({ [field]: "\ud800" })).rejects.toMatchObject({ field });
  });
});

describe("query strings", () => {
  it("keeps duplicates, blank values, empty keys, decoded spaces and Unicode", async () => {
    expect(await data("query-string-parser", { input: "?a=1&a=2&empty&=x&%E9%9B%AA=%F0%9F%98%80+%2B&&" })).toEqual({ parameters: [{ key: "a", value: "1" }, { key: "a", value: "2" }, { key: "empty", value: "" }, { key: "", value: "x" }, { key: "雪", value: "😀 +" }], count: 5 });
  });
  it.each(["", "?", "&&"])("empty query %s is valid", async input => {
    expect(await data("query-string-parser", { input })).toEqual({ parameters: [], count: 0 });
  });
  it("extracts only the URL query, excluding credentials and fragment", async () => {
    const result = await inspectWeb("query-string-parser", { input: "https://u:SECRET@example.com/x?q=1#z=2" });
    expect(result.data).toEqual({ parameters: [{ key: "q", value: "1" }], count: 1 });
    expect(result.text).not.toContain("SECRET");
  });
  it("handles opaque absolute URLs", async () => {
    expect(await data("query-string-parser", { input: "mailto:hello@example.com?subject=Hi" })).toEqual({ parameters: [{ key: "subject", value: "Hi" }], count: 1 });
  });
  it("uses URLSearchParams replacement behavior for malformed UTF-8", async () => {
    expect(await data("query-string-parser", { input: "a=%FF&b=%ZZ" })).toEqual({ parameters: [{ key: "a", value: "�" }, { key: "b", value: "%ZZ" }], count: 2 });
  });
  it("generates query text with a leading question mark and supports empty rows", async () => {
    const parameters = [{ key: "q", value: "a b+c&雪" }, { key: "q", value: "" }, { key: "", value: "=" }];
    const result = await inspectWeb("query-string-generator", { parameters });
    expect(result.text).toBe("?q=a+b%2Bc%26%E9%9B%AA&q=&=%3D");
    expect(result.copyText).toBe(result.text);
    expect((await data("query-string-parser", { input: result.text })).parameters).toEqual(parameters);
    expect((await inspectWeb("query-string-generator", { parameters: [] })).text).toBe("?");
  });
  it.each([{}, { key: "x" }, { key: 1, value: "" }, null, ["x", "y"]])("rejects malformed parameter row %j", async row => {
    await expect(inspectWeb("query-string-generator", { parameters: [row] })).rejects.toMatchObject({ field: "parameters" });
  });
  it.each(["bad", { key: "a", value: "b" }])("rejects non-array rows %j", async parameters => {
    await expect(inspectWeb("query-string-generator", { parameters })).rejects.toMatchObject({ field: "parameters" });
  });
});

describe("URL fragment and path analysis", () => {
  it.each(["#caf%C3%A9+a", "https://example.com/#caf%C3%A9+a"])("decodes fragment without converting plus: %s", async input => {
    expect(await data("url-fragment-parser", { input })).toEqual({ raw: "caf%C3%A9+a", decoded: "café+a" });
  });
  it.each(["#", "https://example.com", "https://example.com/#"])("accepts an empty fragment %s", async input => {
    expect(await data("url-fragment-parser", { input })).toEqual({ raw: "", decoded: "" });
  });
  it.each(["", "fragment", "http://"])("rejects neither URL nor #fragment %s", async input => {
    await expect(inspectWeb("url-fragment-parser", { input })).rejects.toMatchObject({ field: "input" });
  });
  it("analyzes only the URL pathname and final segment extension", async () => {
    expect(await data("url-path-analyzer", { input: "https://u:SECRET@example.com/folder.name/caf%C3%A9.tar.gz?q=x#part" })).toEqual({ pathname: "/folder.name/caf%C3%A9.tar.gz", pathSegments: ["folder.name", "café.tar.gz"], segmentCount: 2, filename: "café.tar.gz", extension: "gz" });
  });
  it.each(["/folder.txt/", "/", "", "/a//b/"])("trailing slash denotes directory: %s", async input => {
    expect(await data("url-path-analyzer", { input })).toMatchObject({ filename: "", extension: "" });
  });
  it.each(["/a.b/file", "/.gitignore", "/file."])("does not infer extension for %s", async input => {
    expect((await data("url-path-analyzer", { input })).extension).toBe("");
  });
  it("keeps an escaped slash in one decoded segment", async () => {
    expect(await data("url-path-analyzer", { input: "/a%2Fb/file%2Ejson" })).toMatchObject({ pathSegments: ["a/b", "file.json"], segmentCount: 2, extension: "json" });
  });
  it.each(["/a?b", "/a#b"])("rejects mixed pathname %s", async input => {
    await expect(inspectWeb("url-path-analyzer", { input })).rejects.toMatchObject({ field: "input" });
  });
});

describe("percent encoding inspection", () => {
  it("groups multibyte UTF-8 and reports original zero-based positions", async () => {
    const result = await inspectWeb("url-encoding-inspector", { input: "😀%E9%9B%AA %F0%9F%98%80+%20" });
    expect(result.data).toMatchObject({ decodedPreview: "😀雪 😀+ ", encodedSequences: [{ raw: "%E9%9B%AA", decoded: "雪", position: 2, end: 11, valid: true }, { raw: "%F0%9F%98%80", decoded: "😀", position: 12, end: 24, valid: true }, { raw: "%20", decoded: " ", position: 25, end: 28, valid: true }] });
    expect(result.copyText).toBe("😀雪 😀+ ");
  });
  it.each(["%", "%2", "%ZZ", "%C0%AF", "%ED%A0%80", "%F4%90%80%80", "%E2%82", "%80"])("preserves invalid percent/UTF-8 input %s", async input => {
    const result = await inspectWeb("url-encoding-inspector", { input });
    expect(result.copyText).toBe(input);
    expect(result.warnings?.length).toBeGreaterThan(0);
    expect(result.data?.encodedSequences).toEqual(expect.arrayContaining([expect.objectContaining({ valid: false, position: 0 })]));
  });
  it("decodes valid bytes alongside invalid bytes in the same percent run", async () => {
    const result = await inspectWeb("url-encoding-inspector", { input: "%41%FF%E2%9C%93%42" });
    expect(result.copyText).toBe("A%FF✓B");
    expect(result.data?.encodedSequences).toEqual([expect.objectContaining({ invalidPositions: [3], valid: false })]);
  });
  it("still inspects a later valid escape after malformed syntax", async () => {
    expect((await inspectWeb("url-encoding-inspector", { input: "%G%41" })).copyText).toBe("%GA");
  });
  it.each(["", "plain + Unicode 雪"])("supports unencoded/empty text %s", async input => {
    expect(await data("url-encoding-inspector", { input })).toMatchObject({ encodedSequences: [], decodedPreview: input });
  });
});

describe("resource and safe error boundaries", () => {
  it("supports exactly 200,000 text units and rejects one more", async () => {
    expect((await inspectWeb("url-encoding-inspector", { input: "x".repeat(200_000) })).copyText).toHaveLength(200_000);
    await expect(inspectWeb("url-encoding-inspector", { input: "x".repeat(200_001) })).rejects.toMatchObject({ field: "input" });
  });
  it("caps total structured URL and parameter text", async () => {
    await expect(build({ username: "x".repeat(100_000), pathname: "y".repeat(100_000) })).rejects.toBeInstanceOf(WebError);
    await expect(inspectWeb("query-string-generator", { parameters: [{ key: "x".repeat(100_001), value: "y".repeat(100_000) }] })).rejects.toMatchObject({ field: "parameters" });
  });
  it("supports exactly 1,000 parameter rows, rejects 1,001", async () => {
    const parameters = Array.from({ length: 1000 }, () => ({ key: "a", value: "" }));
    expect((await data("query-string-parser", { input: (await inspectWeb("query-string-generator", { parameters })).text })).count).toBe(1000);
    await expect(inspectWeb("query-string-generator", { parameters: [...parameters, parameters[0]] })).rejects.toMatchObject({ field: "parameters" });
    await expect(inspectWeb("query-string-parser", { input: "a&".repeat(1001) })).rejects.toMatchObject({ field: "input" });
  });
  it("caps segments and percent run rows", async () => {
    expect((await data("url-path-analyzer", { input: "/x".repeat(1000) })).segmentCount).toBe(1000);
    await expect(inspectWeb("url-path-analyzer", { input: "/x".repeat(1001) })).rejects.toMatchObject({ field: "input" });
    expect((await data("url-encoding-inspector", { input: "%41 ".repeat(1000) })).encodedSequences).toHaveLength(1000);
    await expect(inspectWeb("url-encoding-inspector", { input: "%41 ".repeat(1001) })).rejects.toMatchObject({ field: "input" });
  });
  it("rejects wrong field types and unknown tools", async () => {
    await expect(inspectWeb("url-parser", { url: 123 })).rejects.toMatchObject({ field: "url" });
    await expect(inspectWeb("unknown-tool", {})).rejects.toBeInstanceOf(WebError);
  });
});
