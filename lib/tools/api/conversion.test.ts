import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { ApiError } from "./types";
import { convertApi } from "./curl";

const run = (id: string, input: string) => convertApi(id, { input });

describe("API request conversions", () => {
  it("converts quoted cURL URLs, methods, headers, and JSON to Fetch", async () => {
    const result = await run("curl-to-fetch", `curl -X POST -H 'Content-Type: application/json' --data-raw '{"name":"Ada","ok":true}' "https://example.test/items?q=hello%20world"`);
    expect(result.text).toContain('fetch("https://example.test/items?q=hello%20world"');
    expect(result.text).toContain("JSON.stringify({");
    expect(result.text).toContain('"Content-Type": "application/json"');
  });

  it.each(["curl-to-fetch", "curl-to-axios"])("generates syntactically valid JavaScript for %s", async (id) => {
    for (const input of [
      "curl 'https://example.test/path?q=a&x=b'",
      `curl -X PUT -H 'Content-Type: application/json' -d '{"nested":[null,false,{"x":"quote\\\"and\\nline"}]}' https://example.test`,
      `curl --data-raw 'one'"'"'two\\three' -H 'X-Sample: <script>' https://example.test`,
    ]) {
      const result = await run(id, input);
      const compiled = ts.transpileModule(result.text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
      expect(compiled.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)).toEqual([]);
      expect(result.copyText).toBe(result.text);
    }
  });

  it("generates a minimal valid Fetch GET without inventing a body", async () => {
    const result = await run("curl-to-fetch", "curl https://example.test/a?x=1");
    expect(result.text).toBe('const response = await fetch("https://example.test/a?x=1");\nconst data = await response.text();');
    expect(result.data?.body).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it.each(["-X PATCH", "-XPATCH", "--request PATCH", "--request=PATCH"])("supports request option %s", async (option) => {
    const result = await run("curl-to-fetch", `curl ${option} 'https://example.test/a%20b?q=1'`);
    expect(result.data?.method).toBe("PATCH");
    expect(result.data?.url).toBe("https://example.test/a%20b?q=1");
  });

  it.each(["-H 'X-Test: café'", "-H'X-Test: café'", "--header 'X-Test: café'", "--header='X-Test: café'"])("supports header option %s", async (option) => {
    const result = await run("curl-to-fetch", `curl ${option} https://example.test`);
    expect(result.data?.headers).toEqual([["X-Test", "café"]]);
  });

  it.each(["-d 'a=1'", "-da=1", "--data 'a=1'", "--data-raw 'a=1'", "--data-binary 'a=1'", "--data=a=1"])("supports literal body option %s and cURL's form type", async (option) => {
    const result = await run("curl-to-fetch", `curl ${option} https://example.test`);
    expect(result.data?.method).toBe("POST");
    expect(result.data?.body).toBe("a=1");
    expect(result.data?.headers).toEqual([["Content-Type", "application/x-www-form-urlencoded"]]);
  });

  it("combines repeated data and URL-encoded fields, preserving existing URL query", async () => {
    const result = await run("curl-to-fetch", `curl --data-urlencode 'name=Zoë & λ' --data-urlencode '=raw value' --data 'extra=1' 'https://example.test/?fixed=true'`);
    expect(result.data?.body).toBe("name=Zo%C3%AB%20%26%20%CE%BB&raw%20value&extra=1");
    expect(result.data?.url).toBe("https://example.test/?fixed=true");
  });

  it("URL-encodes RFC 3986 reserved punctuation in form values", async () => {
    const result = await run("curl-to-fetch", `curl --data-urlencode "value=!*()" https://example.test`);
    expect(result.data?.body).toBe("value=%21%2A%28%29");
  });

  it("preserves Fetch literal query brackets using --globoff", async () => {
    const curl = await run("fetch-to-curl", `fetch('https://example.test/?filter[]=one&ids={a,b}')`);
    expect(curl.text).toContain("--globoff");
    const back = await run("curl-to-fetch", curl.text);
    expect(back.data?.url).toBe("https://example.test/?filter[]=one&ids={a,b}");
  });

  it("accepts IPv6 without treating its authority as a cURL range", async () => {
    const result = await run("curl-to-fetch", `curl 'http://[ABCD::1]:8080/path'`);
    expect(result.data?.url).toBe("http://[ABCD::1]:8080/path");
  });

  it("preserves custom cURL method casing and discloses runtime normalization", async () => {
    const result = await run("curl-to-axios", "curl -X custom https://example.test");
    expect(result.data?.method).toBe("custom");
    expect(result.text).toContain('method: "custom"');
    expect(result.warnings?.join(" ")).toContain("method casing");
  });

  it.each(["GET", "HEAD", "get", "head"])("rejects body-bearing %s for Fetch while Python retains the method/body", async (method) => {
    const source = `curl -X ${method} -d 'a=1' https://example.test`;
    await expect(run("curl-to-fetch", source)).rejects.toThrow("Fetch does not support a body");
    const python = await run("curl-to-python-requests", source);
    expect(python.data?.method).toBe(method);
    expect(python.data?.body).toBe("a=1");
  });

  it.each(["CONNECT", "TRACE", "TRACK"])("rejects Fetch-forbidden method %s", async (method) => {
    await expect(run("curl-to-fetch", `curl -X ${method} https://example.test`)).rejects.toThrow("Fetch forbids");
    await expect(run("fetch-to-curl", `fetch('https://example.test', {method:'${method}'})`)).rejects.toThrow("Fetch forbids");
  });

  it("warns about browser transport limits without silently dropping headers or body", async () => {
    const result = await run("curl-to-fetch", "curl -H 'Host: example.test' -H 'X-Name: λ' https://example.test");
    expect(result.text).toContain('"Host": "example.test"');
    expect(result.text).toContain('"X-Name": "λ"');
    expect(result.warnings?.join(" ")).toContain("forbidden request headers");
    expect(result.warnings?.join(" ")).toContain("Non-Latin-1");
    const axios = await run("curl-to-axios", "curl -X GET -d 'a=1' https://example.test");
    expect(axios.text).toContain('data: "a=1"');
    expect(axios.warnings?.join(" ")).toContain("GET or HEAD body");
  });

  it("preserves double-quoted backslashes and quoted semicolons", async () => {
    const result = await run("curl-to-fetch", 'curl -d "a=\\n;b=c" https://example.test');
    expect(result.data?.body).toBe("a=\\n;b=c");
  });

  it("supports POSIX line continuations and quoted apostrophes", async () => {
    const result = await run("curl-to-fetch", "curl \\\n --data-raw 'it'\"'\"'s λ' \\\n https://example.test");
    expect(result.data?.body).toBe("it's λ");
  });

  it("converts form and basic authentication to Axios and Python", async () => {
    const axios = await run("curl-to-axios", "curl -u 'alice:p@ss' -d 'a=1&b=two' https://example.test/login");
    expect(axios.text).toContain('method: "POST"');
    expect(axios.text).toContain('data: "a=1&b=two"');
    expect(axios.text).toContain("Authorization");
    const python = await run("curl-to-python-requests", "curl -u 'alice:p@ss' https://example.test/private");
    expect(python.text).toContain("Basic YWxpY2U6cEBzcw==");
    expect(python.text).toContain("requests.request");
  });

  it.each(["-u 'müller:密碼'", "--user 'müller:密碼'", "--user='müller:密碼'", "-umüller:密碼"])("encodes explicit UTF-8 Basic authentication: %s", async (option) => {
    const result = await run("curl-to-fetch", `curl ${option} https://example.test`);
    expect(result.data?.headers).toEqual([["Authorization", `Basic ${Buffer.from("müller:密碼", "utf8").toString("base64")}`]]);
    expect(result.text).not.toContain("密碼");
  });

  it("honors an explicit Authorization header over --user", async () => {
    const result = await run("curl-to-fetch", "curl -u 'ignored:secret' -H 'Authorization: Bearer example' https://example.test");
    expect(result.data?.headers).toEqual([["Authorization", "Bearer example"]]);
    expect(result.warnings).toEqual(["The explicit Authorization header takes precedence over --user."]);
    expect(result.text).not.toContain("ignored");
  });

  it("does not include credentials in errors", async () => {
    for (const source of ["curl --user SECRET https://example.test", "curl -u 'name:SECRET' --cert=SECRET https://example.test", "curl 'https://name:SECRET@example.test'", "curl -u 'name:SECRET' -X '?' https://example.test"]) {
      try { await run("curl-to-fetch", source); throw new Error("Expected rejection"); }
      catch (error) { expect(error).toBeInstanceOf(ApiError); expect((error as Error).message).not.toContain("SECRET"); }
    }
  });

  it.each(["{\"enabled\":true,\"items\":[null,false,\"λ\"]}", "[1,2,3]", "false", "42", "null", '"hello"'])("converts safe JSON to Fetch/Axios/Python: %s", async (body) => {
    const source = `curl -H 'Content-Type: application/json' --data-raw '${body}' https://example.test`;
    const fetch = await run("curl-to-fetch", source);
    expect(fetch.text).toContain("JSON.stringify(");
    const axios = await run("curl-to-axios", source);
    if (body.startsWith("{") || body.startsWith("[")) expect(axios.text).not.toContain("transformRequest");
    else expect(axios.text).toContain("transformRequest");
    const python = await run("curl-to-python-requests", source);
    expect(python.text).toContain(body === "null" ? 'data="null".encode("utf-8")' : "json=");
    expect(python.text).toContain("\n)\n");
  });

  it("renders JSON booleans/null as Python literals", async () => {
    const result = await run("curl-to-python-requests", `curl -H 'Content-Type: application/json' -d '{"yes":true,"no":false,"nil":null}' https://example.test`);
    expect(result.text).toContain('json={"yes": True, "no": False, "nil": None}');
  });

  it.each(['{"n":9007199254740993}', '{"__proto__":{"x":1}}', '{"n":1e400}', '{"not":json}'])("preserves unsafe or invalid JSON as raw text: %s", async (body) => {
    const result = await run("curl-to-axios", `curl -H 'Content-Type: application/json' --data-raw '${body}' https://example.test`);
    expect(result.text).toContain("transformRequest");
    expect(result.data?.body).toBe(body);
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it("warns about JSON normalization and preserves an explicit Content-Length", async () => {
    const source = `curl -H 'Content-Type: application/json' -d '{ "x": 1 }' https://example.test`;
    expect((await run("curl-to-fetch", source)).warnings).toContain("The JSON body is reserialized; formatting and escape spelling may change.");
    const exact = await run("curl-to-fetch", `${source} -H 'Content-Length: 10'`);
    expect(exact.text).not.toContain("JSON.stringify");
    expect(exact.warnings?.join(" ")).toContain("Content-Length");
  });

  it("supports static Fetch literals and JSON.stringify without executing them", async () => {
    const result = await run("fetch-to-curl", `fetch("https://example.test/api?q=\u2603", {method: "POST", headers: {"X-Test": "\u00e9"}, body: JSON.stringify({answer: 42, tags: ["\u03bb"]})})`);
    expect(result.text).toContain("--request 'POST'");
    expect(result.text).toContain("--header 'X-Test: é'");
    expect(result.text).toContain("answer");
  });

  it.each(["{answer: 42, list: [null, true, -2.5e2]}", "[1,'λ',false]", "true", "null", "4", "'text'"])("serializes static JSON.stringify data: %s", async (data) => {
    const result = await run("fetch-to-curl", `fetch('https://example.test', {method: 'POST', body: JSON.stringify(${data})})`);
    expect(result.text).toContain("--data-raw");
    expect(result.data?.headers).toEqual([["Content-Type", "text/plain;charset=UTF-8"]]);
    expect(() => JSON.parse(result.data?.body as string)).not.toThrow();
  });

  it("preserves a static Fetch body exactly through generated cURL", async () => {
    const fetch = `fetch('https://example.test/?q=hello%20world', {'method': 'post', headers: {'X-Name': '\\u00e9', 'X-Empty': ''}, body: 'it\\'s \\u{1f642}\\nline'})`;
    const curl = await run("fetch-to-curl", fetch);
    const back = await run("curl-to-fetch", curl.text);
    expect(back.data).toEqual(curl.data);
    expect(back.data?.body).toBe("it's 🙂\nline");
  });

  it("accepts trailing literal-object commas and one optional semicolon", async () => {
    const result = await run("fetch-to-curl", `fetch("https://example.test", {method: "PATCH", headers: {"X-Test": "value",}, body: JSON.stringify({a:[1,],}),});`);
    expect(result.data?.body).toBe('{"a":[1]}');
  });

  it.each([
    ["curl --cert secret.pem https://example.test", "Unsupported cURL option: --cert"],
    ["curl --insecure https://example.test", "Unsupported cURL option: --insecure"],
    ["curl -L https://example.test", "Unsupported cURL option: -L"],
    ["curl -F a=1 https://example.test", "Unsupported cURL option: -F"],
    ["curl -d @secret https://example.test", "body file references"],
    ["curl --data-binary @secret https://example.test", "body file references"],
    ["curl --data-urlencode a@secret https://example.test", "file references"],
    ["curl -H 'X-Test:' https://example.test", "suppression or empty headers"],
    ["curl -H 'X-Test: one' -H 'x-test: two' https://example.test", "Duplicate header"],
    ["curl --url https://example.test --url https://two.test", "Multiple URLs"],
    ["curl 'https://example.test/[1-3]'", "range patterns"],
    ["curl 'https://example.test/{a,b}'", "glob patterns"],
    ["curl 'ftp://example.test/'", "Only HTTP and HTTPS"],
    ["curl --request", "requires a value"],
    ["curl -X '' https://example.test", "HTTP method is invalid"],
    ["curl -H 'X-Test: one\\\nInjected: yes' https://example.test", "Header values"],
    ["curl \"https://example.test/$URL\"", "variable expansion"],
    ["curl https://example.test; echo injected", "command separators"],
    ["curl https://example.test?a=1&b=2", "command separators"],
    ["curl 'https://example.test", "unterminated quote"],
  ])("rejects unsupported or malformed cURL with useful error: %s", async (source, message) => {
    await expect(run("curl-to-fetch", source)).rejects.toThrow(message);
  });

  it("keeps --data-raw @ values literal and supports --url", async () => {
    const result = await run("curl-to-fetch", "curl --data-raw '@literal' --url=https://example.test");
    expect(result.data?.body).toBe("@literal");
  });

  it.each([
    "fetch(url)", "fetch('https://example.test' + path)", "fetch(`https://example.test/${path}`)",
    "fetch('https://example.test', options)", "fetch('https://example.test', {method: getMethod()})",
    "fetch('https://example.test', {headers: new Headers()})", "fetch('https://example.test', {headers: {[key]: 'value'}})",
    "fetch('https://example.test', {method: 'POST', body: payload})", "fetch('https://example.test', {method: 'POST', body: {a: 1}})",
    "fetch('https://example.test', {method: 'POST', body: JSON.stringify({a: getValue()})})",
    "fetch('https://example.test', {method: 'POST', body: JSON.stringify([window.location])})",
    "fetch('https://example.test', {method: 'POST', body: JSON.stringify({__proto__: {polluted:true}})})",
    "fetch('https://example.test', {method: 'POST', body: JSON.stringify(9007199254740993)})",
    "fetch('https://example.test', {method: 'POST', body: JSON.stringify(Infinity)})",
    "fetch('https://example.test', {method: 'POST', body: JSON.stringify(null, replacer)})",
    "fetch('https://example.test', {credentials: 'include'})", "fetch('/relative')", "fetch('https://example.test').then(handle)",
    "fetch('https://example.test'); alert(1)", "fetch('https://example.test', {method: 'POST', body: () => 'text'})",
    "fetch('https://example.test', {method: 'POST', body: JSON.stringify({a: 1, a: 2})})",
    "fetch('https://example.test', {method: 'GET', body: 'text'})", "fetch('https://example.test', {method: 'HEAD', body: 'text'})",
    "fetch('https://example.test', {headers: {'X-Name': 42}})", "fetch('https://example.test', {method: 'POST', body: '\\0'})",
    "fetch('https://example.test', {method: 'POST', body: '\\uD800'})", "fetch('https://example.test', {method: 'POST', body: '\\01'})",
    "fetch('https://example.test', {method: 'POST', body: '\\u{110000}'})", "fetch('https://example.test', /* static */ {})",
  ])("rejects malformed, dynamic, or unsupported Fetch source: %s", async (source) => {
    await expect(run("fetch-to-curl", source)).rejects.toBeInstanceOf(ApiError);
  });

  it.each(["fetch(", "fetch('", "fetch('https://example.test'", "fetch('https://example.test', {method:", "fetch('https://example.test', {method:'POST',body:JSON.stringify([1,])", "fetch('https://example.test');;"])("reports malformed Fetch without incidental exceptions: %s", async (source) => {
    await expect(run("fetch-to-curl", source)).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects unsupported switches, dynamic Fetch, malformed input, empty input, and limits", async () => {
    await expect(run("curl-to-fetch", "curl --cert secret.pem https://example.test")).rejects.toThrow("Unsupported cURL option: --cert");
    await expect(run("fetch-to-curl", "fetch(url, {method: getMethod()})")).rejects.toBeInstanceOf(ApiError);
    await expect(run("fetch-to-curl", `fetch("https://example.test", {body: "unterminated})`)).rejects.toThrow("Malformed Fetch expression");
    await expect(run("curl-to-fetch", " ")).rejects.toThrow("Enter a cURL or Fetch request");
    await expect(run("curl-to-fetch", `curl ${"x".repeat(200_001)}`)).rejects.toThrow("200,000-character limit");
  });

  it("bounds options, headers, body parts, tokens, and static nesting", async () => {
    await expect(run("curl-to-fetch", `curl ${"-X POST ".repeat(1001)} https://example.test`)).rejects.toThrow("too many options");
    await expect(run("curl-to-fetch", `curl ${Array.from({length:201}, (_, index) => `-H 'X-${index}: value'`).join(" ")} https://example.test`)).rejects.toThrow("Too many headers");
    await expect(run("curl-to-fetch", `curl ${"-d 'a' ".repeat(201)} https://example.test`)).rejects.toThrow("Too many body options");
    await expect(run("fetch-to-curl", `fetch('https://example.test',{method:'POST',body:JSON.stringify([${"0,".repeat(6000)}])})`)).rejects.toThrow("too many tokens");
    await expect(run("fetch-to-curl", `fetch('https://example.test',{method:'POST',body:JSON.stringify(${'['.repeat(34)}0${']'.repeat(34)})})`)).rejects.toThrow("32-level");
    await expect(run("curl-to-python-requests", `curl -H 'Content-Type: application/json' -d '${'['.repeat(34)}0${']'.repeat(34)}' https://example.test`)).rejects.toThrow("32-level");
  });

  it("bounds escaped output without truncation", async () => {
    const source = "curl --data-raw '" + "\u0001".repeat(180_000) + "' https://example.test";
    await expect(run("curl-to-fetch", source)).rejects.toThrow("1,000,000-character limit");
  });

  it("accepts the input boundary and rejects invalid source Unicode/NUL", async () => {
    const prefix = "curl --data-raw '";
    const suffix = "' https://example.test";
    const boundary = prefix + "x".repeat(200_000 - prefix.length - suffix.length) + suffix;
    expect((await run("curl-to-fetch", boundary)).data?.body).toHaveLength(200_000 - prefix.length - suffix.length);
    await expect(run("curl-to-fetch", "curl '\uD800' https://example.test")).rejects.toThrow("Unicode surrogate");
    await expect(run("curl-to-fetch", "curl -d '\0' https://example.test")).rejects.toThrow("NUL");
  });

  it("does not perform network access or execute source text", async () => {
    const network = vi.fn(() => { throw new Error("network"); });
    const execution = vi.fn(() => { throw new Error("execution"); });
    vi.stubGlobal("fetch", network); vi.stubGlobal("XMLHttpRequest", network); vi.stubGlobal("WebSocket", network);
    vi.stubGlobal("eval", execution); vi.stubGlobal("Function", execution);
    try {
      const result = await run("fetch-to-curl", `fetch("https://example.test", {method: "POST", body: JSON.stringify({constructor: "Function('return 1')"})})`);
      expect(result.data?.body).toContain("Function('return 1')");
      await expect(run("fetch-to-curl", "fetch('https://example.test', {method:'POST',body:(()=>{globalThis.INJECTED=true})()})")).rejects.toBeInstanceOf(ApiError);
      await run("curl-to-python-requests", "curl -d 'literal $(command)' https://example.test");
      expect(network).not.toHaveBeenCalled();
      expect(execution).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
