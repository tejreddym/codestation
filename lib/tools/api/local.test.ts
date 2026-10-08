import { afterEach, describe, expect, it, vi } from "vitest";
import { localApi } from "./local";
import { formatGraphql } from "./graphql";
import type { ApiValues } from "./types";

afterEach(() => vi.unstubAllGlobals());
const run = async (id: string, values: ApiValues = {}) => (await localApi(id, values)).data!;

describe("HTTP header tools", () => {
  it("preserves exact values, order, duplicates, casing, and Authorization", async () => {
    const entries = [{ name: "X-Foo", value: "one" }, { name: "x-foo", value: "two" }, { name: "X-Foo", value: "" }, { name: "Authorization", value: " Bearer  exact " }];
    const result = await run("http-header-builder", { entries });
    expect(result.entries).toEqual(entries);
    expect(result.raw).toBe("X-Foo: one\r\nx-foo: two\r\nX-Foo: \r\nAuthorization:  Bearer  exact ");
    expect(result.headers).toEqual({ "X-Foo": ["one", ""], "x-foo": "two", Authorization: " Bearer  exact " });
    expect(result.javascript).toContain('"Authorization",\n    " Bearer  exact "');
  });
  it("handles names that match JavaScript prototype properties", async () => {
    const result = await run("http-header-builder", { entries: [{ name: "__proto__", value: "safe" }, { name: "constructor", value: "data" }] });
    expect(result.headers).toEqual({ ["__proto__"]: "safe", constructor: "data" });
    expect(result.javascript).toContain("Object.fromEntries");
  });
  it.each(["", "X Foo", "X:Foo", "é", "X\tFoo", "X\nFoo", " X-Foo"])("rejects invalid name %j", async name => {
    await expect(localApi("http-header-builder", { entries: [{ name, value: "okay" }] })).rejects.toThrow(/header name/);
  });
  it.each(["a\nb", "a\rb", "a\0b", "a\x7Fb"])("rejects injected value %j", async value => {
    await expect(localApi("http-header-builder", { entries: [{ name: "X-Foo", value }] })).rejects.toThrow(/control character|line break/);
  });
  it("supports an empty block", async () => { expect(await run("http-header-builder")).toMatchObject({ raw: "", count: 0, entries: [] }); });
  it("parses original names and duplicates without losing empty values", async () => {
    const result = await run("http-header-parser", { raw: "X-Foo: first\r\nx-foo:\r\nX-Foo:\tsecond \r\nAuthorization: Bearer abc\r\n" });
    expect(result.count).toBe(4); expect(result.emptyValues).toBe(1);
    expect(result.entries).toEqual([{ name: "X-Foo", value: "first", line: 1 }, { name: "x-foo", value: "", line: 2 }, { name: "X-Foo", value: "second ", line: 3 }, { name: "Authorization", value: "Bearer abc", line: 4 }]);
  });
  it.each(["missing colon", "X Foo: okay", ": no-name", " X-Foo: bad", "X-Foo: x\rY: z", "X-Foo: \0"])("rejects malformed header block %j", async raw => { await expect(localApi("http-header-parser", { raw })).rejects.toThrow(/Malformed|malformed/); });
  it("rejects a parsed block over 1,000 rows", async () => { await expect(localApi("http-header-parser", { raw: "X: 1\n".repeat(1_001) })).rejects.toThrow(/1,000/); });
});

describe("request and authorization generation", () => {
  it("generates inert direct curl/fetch code with encoded query and exact duplicate headers", async () => {
    const result = await run("rest-api-request-builder", { method: "POST", url: "https://example.test/api?existing=yes", parameters: [{ key: "q", value: "雪 /'" }, { key: "q", value: "again" }], headers: [{ name: "X-Foo", value: "one" }, { name: "X-Foo", value: "two" }, { name: "Authorization", value: "Bearer exact" }], bodyType: "JSON", body: '{"name":"雪"}' });
    expect(result.url).toBe("https://example.test/api?existing=yes&q=%E9%9B%AA+%2F%27&q=again");
    expect(result.body).toBe('{\n  "name": "雪"\n}');
    expect(result.headers).toEqual([{ name: "X-Foo", value: "one" }, { name: "X-Foo", value: "two" }, { name: "Authorization", value: "Bearer exact" }, { name: "Content-Type", value: "application/json" }]);
    expect(result.curl).toContain("curl -X POST '"); expect(result.fetch).toContain('fetch("https://example.test');
    expect(result.fetch).toContain('[\n  [\n    "X-Foo",\n    "one"');
  });
  it("preserves exact existing Content-Type and Authorization values", async () => {
    const result = await run("rest-api-request-builder", { url: "http://localhost:8080", headers: [{ name: "content-type", value: "custom" }, { name: "Authorization", value: "exact" }], bodyType: "Text", body: "x" });
    expect(result.headers).toEqual([{ name: "content-type", value: "custom" }, { name: "Authorization", value: "exact" }]);
  });
  it.each(["GET", "HEAD"])("warns about %s bodies and omits them from executable code", async method => {
    const result = await localApi("rest-api-request-builder", { method, url: "https://example.test", bodyType: "Text", body: "body" });
    expect(result.warnings?.join(" ")).toContain("do not support a request body"); expect(result.data!.body).toBe("body"); expect(result.data!.fetch).not.toContain("body:"); expect(result.data!.curl).not.toContain("--data-raw");
    if (method === "HEAD") expect(result.data!.curl).toContain("--head");
  });
  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])("supports method %s", async method => { expect((await run("rest-api-request-builder", { method, url: "https://example.test" })).method).toBe(method); });
  it.each(["ftp://example.test", "javascript:alert(1)", "file:///path", "", "not a URL", "https://user:password@example.test"])("rejects target %j", async url => { await expect(localApi("rest-api-request-builder", { url })).rejects.toThrow(/URL|scheme|http/); });
  it.each(["TRACE", "CONNECT", "", "G ET"])("rejects method %j", async method => { await expect(localApi("rest-api-request-builder", { method, url: "https://example.test" })).rejects.toThrow(/method/); });
  it("rejects invalid JSON", async () => { await expect(localApi("rest-api-request-builder", { url: "https://example.test", bodyType: "JSON", body: "{" })).rejects.toThrow(/JSON/); });
  it("preserves numeric precision in JSON request bodies", async () => { const result = await run("rest-api-request-builder", { method: "POST", url: "https://example.test", bodyType: "JSON", body: '{"id":9007199254740993,"fine":0.1234567890123456789}' }); expect(result.body).toContain("9007199254740993"); expect(result.body).toContain("0.1234567890123456789"); });
  it("supports explicit form encoding without changing the source", async () => { const result = await run("rest-api-request-builder", { method: "POST", url: "https://example.test", bodyType: "application/x-www-form-urlencoded", body: "a=1&a=two+words" }); expect(result.body).toBe("a=1&a=two+words"); });
  it("shell-escapes quotes in body without executing them", async () => { const result = await run("rest-api-request-builder", { method: "POST", url: "https://example.test", bodyType: "Text", body: "'$(whoami)" }); expect(result.curl).toContain("'\\''"); expect(result.fetch).toContain("$(whoami)"); });
  it("derives Host and query path from a full URL for raw HTTP", async () => {
    const result = await run("http-request-builder", { method: "POST", path: "https://[::1]:8443/a?q=1#fragment", httpVersion: "HTTP/1.0", headers: [{ name: "X-Foo", value: "a" }, { name: "X-Foo", value: "b" }], body: "雪" });
    expect(result.raw).toBe("POST /a?q=1 HTTP/1.0\r\nHost: [::1]:8443\r\nX-Foo: a\r\nX-Foo: b\r\n\r\n雪");
  });
  it("preserves a supplied Host and exact header order", async () => { const result = await run("http-request-builder", { path: "http://example.test/path", headers: [{ name: "x", value: "1" }, { name: "host", value: "override.test" }, { name: "x", value: "2" }] }); expect(result.raw).toBe("GET /path HTTP/1.1\r\nx: 1\r\nhost: override.test\r\nx: 2\r\n\r\n"); });
  it.each(["/path\r\nInjected", "/space here", "/a#hash", "ftp://example.test/path"])("rejects unsafe raw target %j", async path => { await expect(localApi("http-request-builder", { path })).rejects.toThrow(); });
  it("rejects unsupported HTTP version", async () => { await expect(localApi("http-request-builder", { path: "/", httpVersion: "HTTP/2" })).rejects.toThrow(/HTTP\/1/); });
  it("encodes Basic Auth using UTF-8", async () => { const result = await run("basic-auth-header-generator", { username: "雪", password: "🔑:a" }); expect(result.header).toBe(`Authorization: Basic ${Buffer.from("雪:🔑:a", "utf8").toString("base64")}`); expect(result.explanation).toContain("HTTPS"); });
  it("supports empty Basic credentials", async () => { expect((await run("basic-auth-header-generator")).header).toBe("Authorization: Basic Og=="); });
  it("rejects colon in Basic username", async () => { await expect(localApi("basic-auth-header-generator", { username: "a:b", password: "c" })).rejects.toThrow(/colon/); });
  it("documents bearer edge trimming without changing internal contents", async () => { const result = await run("bearer-token-header-generator", { token: " \t abc.def+/= \t " }); expect(result.header).toBe("Authorization: Bearer abc.def+/="); expect(result.explanation).toContain("trimmed"); });
  it.each(["", " \t ", "abc\r\nX: x"])("rejects bearer %j", async token => { await expect(localApi("bearer-token-header-generator", { token })).rejects.toThrow(); });
});

describe("JSON request body and response formatting", () => {
  it("builds a typed JSON object with nested data and Unicode", async () => {
    const result = await run("json-request-body-builder", { fields: [{ key: "雪", value: "🔑", valueType: "String" }, { key: "n", value: "1.25e2", valueType: "Number" }, { key: "flag", value: "false", valueType: "Boolean" }, { key: "empty", value: "ignored", valueType: "Null" }, { key: "child", value: '{"id":1}', valueType: "JSON object" }, { key: "list", value: "[true,null]", valueType: "JSON array" }] });
    expect(JSON.parse(result.formatted as string)).toEqual({ 雪: "🔑", n: 125, flag: false, empty: null, child: { id: 1 }, list: [true, null] });
  });
  it("supports zero fields and empty string keys", async () => { expect((await run("json-request-body-builder")).formatted).toBe("{}"); expect(JSON.parse((await run("json-request-body-builder", { fields: [{ key: "", value: "", valueType: "String" }] })).formatted as string)).toEqual({ "": "" }); });
  it.each(["NaN", "Infinity", "01", "+1", " 1", "1x", "1e999", "9007199254740993", "0.1234567890123456789"])("rejects non-strict or lossy number %j", async value => { await expect(localApi("json-request-body-builder", { fields: [{ key: "n", value, valueType: "Number" }] })).rejects.toThrow(/number|Number/); });
  it.each(["TRUE", "False", "1", " false", ""])("rejects non-strict Boolean %j", async value => { await expect(localApi("json-request-body-builder", { fields: [{ key: "b", value, valueType: "Boolean" }] })).rejects.toThrow(/Boolean/); });
  it("rejects duplicate keys including prototype names", async () => { await expect(localApi("json-request-body-builder", { fields: [{ key: "__proto__", value: "1" }, { key: "__proto__", value: "2" }] })).rejects.toThrow(/Duplicate/); });
  it.each([{ valueType: "JSON object", value: "[]" }, { valueType: "JSON array", value: "{}" }, { valueType: "JSON object", value: "null" }, { valueType: "JSON object", value: '{"a":1,"a":2}' }, { valueType: "JSON object", value: "{" }])("rejects invalid nested JSON %j", async field => { await expect(localApi("json-request-body-builder", { fields: [{ key: "x", ...field }] })).rejects.toThrow(/JSON/); });
  it("formats JSON without losing large numeric values or duplicate properties", async () => { const result = await run("api-response-formatter", { format: "JSON", body: '{"id":9007199254740993,"a":1,"a":2}' }); expect(result.formatted).toBe('{\n  "id": 9007199254740993,\n  "a": 1,\n  "a": 2\n}'); });
  it.each(["", "{", "undefined", '{"a":Infinity}'])("rejects invalid JSON response %j", async body => { await expect(localApi("api-response-formatter", { format: "JSON", body })).rejects.toThrow(/JSON/); });
  it("auto-detects JSON, HTML, XML, and preserves text exactly", async () => { expect((await run("api-response-formatter", { body: "null" })).format).toBe("JSON"); expect((await run("api-response-formatter", { body: "<!doctype html><html></html>" })).format).toBe("HTML"); expect((await run("api-response-formatter", { body: "<root/>" })).format).toBe("XML"); const body = " \t雪\r\n\n"; expect((await run("api-response-formatter", { body })).formatted).toBe(body); expect((await run("api-response-formatter", { format: "Text", body })).formatted).toBe(body); });
  it("formats XML with attributes/entities and preserves mixed/leaf content", async () => { const body = '<root><child title="a > b">雪 &amp; ice</child><mixed>Hello <b>world</b>!</mixed></root>'; expect((await run("api-response-formatter", { body, format: "XML" })).formatted).toBe('<root>\n  <child title="a > b">雪 &amp; ice</child>\n  <mixed>Hello <b>world</b>!</mixed>\n</root>'); });
  it("preserves CDATA and xml:space content", async () => { const body = '<root xml:space="preserve">  <x/>  </root>'; expect((await run("api-response-formatter", { body, format: "XML" })).formatted).toBe(body); const cdata = '<root><![CDATA[<script>alert(1)</script>]]></root>'; expect((await run("api-response-formatter", { body: cdata, format: "XML" })).formatted).toBe(cdata); });
  it.each(['<!DOCTYPE root SYSTEM "https://example.test/schema"><root/>', '<!DOCTYPE r [<!ENTITY x SYSTEM "file:///secret">]><r>&x;</r>', "<a><b></a>", "<r>&unknown;</r>", "<r a='1' a='2'/>", ""])("rejects unsafe or malformed XML %j", async body => { await expect(localApi("api-response-formatter", { body, format: "XML" })).rejects.toThrow(/XML|DOCTYPE|entity/); });
  it("formats HTML source without creating a DOM", async () => { const body = '<html><body><h1 title="a > b">Snow</h1><img src="https://example.test/image"></body></html>'; expect((await run("api-response-formatter", { format: "HTML", body })).formatted).toBe('<html>\n  <body>\n    <h1 title="a > b">Snow</h1>\n    <img src="https://example.test/image">\n  </body>\n</html>'); });
  it("keeps script, preformatted, and omitted-closing-tag HTML inert", async () => { const body = '<script>throw new Error("executed")</script><p>text'; expect((await run("api-response-formatter", { body, format: "HTML" })).formatted).toBe(body); expect((await run("api-response-formatter", { body: "<p>text", format: "HTML" })).formatted).toBe("<p>text"); });
});

describe("GraphQL executable formatting and generation", () => {
  it("formats variables, aliases, directives, nested selections, fragments, input objects and lists", async () => {
    const query = 'query Q($id:ID!,$filter:[Int!]=[1,2]) @tag { alias:user(id:$id,filter:{ids:[1,2]}) { id ...Info ... on Admin @include(if:true) { permissions } } } fragment Info on User { name }';
    const result = await run("graphql-formatter", { query });
    expect(result.valid).toBe(true); expect(result.formatted).toContain("query Q($id: ID!, $filter: [Int!] = [1, 2]) @tag {"); expect(result.formatted).toContain("  alias: user(id: $id, filter: {ids: [1, 2]}) {"); expect(result.formatted).toContain("fragment Info on User {");
    expect(formatGraphql(result.formatted as string)).toBe(result.formatted);
  });
  it.each(["{ id }", "mutation M { save { id } }", "subscription S { changed { id } }", "fragment F on T { id }", 'query { find(text:"雪\\n🔑") { id } }', 'query { find(text:"""line\nnext""") { id } }'])("supports executable source %j", async query => { expect((await run("graphql-formatter", { query })).valid).toBe(true); });
  it("preserves comment text and warns about comment placement", async () => { const result = await localApi("graphql-formatter", { query: "# hello\nquery Q { id # 雪\n name }" }); expect(result.data!.formatted).toMatch(/^# hello\n# 雪\nquery Q/); expect(result.warnings?.join(" ")).toContain("start"); });
  it.each(["", "query", "query Q {}", "query { user( }", "query { user(id:) { id } }", "query { user(id:1 id:2) { id } }", "query { ... }", "query { :id }", "query Q($id ID) { id }", "query Q($id:Int=$x) { id }", 'query { field(arg:"bad\\q") }', 'query { field(arg:"unterminated) }', "query { field(arg:01) }", "query { field(arg:1e) }", "query { field(arg:1.0.2) }", "type User { id: ID }", "query { id } trailing", "query { field(arg:{a:1 a:2}) }", "query { field() }", "query Q() { id }"])("rejects malformed GraphQL %j", async query => { await expect(localApi("graphql-formatter", { query })).rejects.toThrow(/GraphQL|Expected|Missing|Invalid|Unsupported|Unterminated|Duplicate|empty|Variable/); });
  it("builds valid GraphQL with all argument types and nested field rows", async () => {
    const result = await run("graphql-query-builder", { operationType: "mutation", operationName: "Save", rootField: "save", arguments: [{ name: "name", value: "雪\n🔑", valueType: "String" }, { name: "id", value: "1", valueType: "Int" }, { name: "rate", value: "2", valueType: "Float" }, { name: "active", value: "true", valueType: "Boolean" }, { name: "empty", valueType: "Null" }, { name: "mode", value: "FAST", valueType: "Enum" }], selectedFields: ["id", { name: "user", children: ["name", { name: "profile", fields: ["avatar"] }] }] });
    expect(result.query).toContain('mutation Save {\n  save(name: "雪\\n🔑", id: 1, rate: 2.0, active: true, empty: null, mode: FAST) {'); expect(result.query).toContain("    user {\n      name\n      profile {\n        avatar"); expect(formatGraphql(result.query as string)).toBe(result.query);
  });
  it.each([{ valueType: "Int", value: "2147483648" }, { valueType: "Int", value: "1.0" }, { valueType: "Int", value: "01" }, { valueType: "Float", value: "Infinity" }, { valueType: "Boolean", value: "True" }, { valueType: "Enum", value: "null" }, { valueType: "Enum", value: "BAD VALUE" }])("rejects invalid builder argument %j", async argument => { await expect(localApi("graphql-query-builder", { rootField: "root", arguments: [{ name: "a", ...argument }], selectedFields: ["id"] })).rejects.toThrow(/GraphQL|true or false/); });
  it("rejects missing selections and injection in names", async () => { await expect(localApi("graphql-query-builder", { rootField: "root", selectedFields: [] })).rejects.toThrow(/Select/); await expect(localApi("graphql-query-builder", { rootField: "root { injected", selectedFields: ["id"] })).rejects.toThrow(/GraphQL name/); await expect(localApi("graphql-query-builder", { rootField: "root", selectedFields: ["id } hacked"] })).rejects.toThrow(/GraphQL names/); });
  it("bounds total nested fields and parser nesting", async () => { await expect(localApi("graphql-query-builder", { rootField: "root", selectedFields: [{ name: "first", children: Array.from({ length: 1_000 }, () => "id") }] })).rejects.toThrow(/1,000/); await expect(localApi("graphql-formatter", { query: "query { " + "field { ".repeat(101) + "id " + "} ".repeat(102) })).rejects.toThrow(/nesting/); });
  it("formats object-root variables preserving exact large JSON numbers", async () => { const result = await run("graphql-variables-formatter", { variables: '{"id":9007199254740993,"雪":true}' }); expect(result.valid).toBe(true); expect(result.formatted).toContain("9007199254740993"); });
  it.each(["", "{", "null", "[]", "true", "1", '"text"'])("reports invalid variables %j without throwing", async variables => { expect((await run("graphql-variables-formatter", { variables })).valid).toBe(false); });
});

describe("local privacy and resource limits", () => {
  it("never fetches or evaluates any local tool", async () => {
    const fetch = vi.fn(() => { throw new Error("network forbidden"); }); const evaluator = vi.fn(() => { throw new Error("evaluation forbidden"); });
    vi.stubGlobal("fetch", fetch); vi.stubGlobal("eval", evaluator);
    const cases: Array<[string, ApiValues]> = [["http-header-builder", {}], ["http-header-parser", {}], ["rest-api-request-builder", { url: "https://example.test" }], ["json-request-body-builder", {}], ["api-response-formatter", { format: "HTML", body: '<script>eval("payload")</script><img src="https://example.test">' }], ["api-response-formatter", { format: "XML", body: '<root href="https://example.test"/>' }], ["graphql-formatter", { query: "{ id }" }], ["graphql-query-builder", { rootField: "user", selectedFields: ["id"] }], ["graphql-variables-formatter", { variables: "{}" }], ["http-request-builder", {}], ["basic-auth-header-generator", {}], ["bearer-token-header-generator", { token: "x" }]];
    for (const [id, values] of cases) await localApi(id, values);
    expect(fetch).not.toHaveBeenCalled(); expect(evaluator).not.toHaveBeenCalled();
  });
  it("rejects oversized strings, rows, results, deeply nested and circular structures", async () => {
    await expect(localApi("api-response-formatter", { body: "x".repeat(200_001), format: "Text" })).rejects.toThrow(/200,000/);
    await expect(localApi("http-header-builder", { entries: Array.from({ length: 1_001 }, () => ({ name: "X", value: "1" })) })).rejects.toThrow(/1,000/);
    await expect(localApi("api-response-formatter", { body: "x".repeat(100_000), format: "Text" })).rejects.toThrow(/output limit/);
    const circular: ApiValues = {}; circular.loop = circular; await expect(localApi("http-header-builder", circular)).rejects.toThrow(/circular/);
    const deep: ApiValues = {}; let cursor = deep; for (let i = 0; i < 45; i++) { cursor.child = {}; cursor = cursor.child as ApiValues; } await expect(localApi("http-header-builder", deep)).rejects.toThrow(/nesting/);
  });
  it("does not dispatch the request tester from the local engine", async () => { await expect(localApi("api-request-tester", { url: "https://example.test" })).rejects.toThrow(/Unknown/); });
});
