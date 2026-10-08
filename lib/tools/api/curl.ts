import { ApiError, type ApiResult, type ApiValues, apiText } from "./types";

const MAX_INPUT = 200_000;
const MAX_OUTPUT = 1_000_000;
const MAX_TOKENS = 10_000;
const MAX_OPTIONS = 1_000;
const MAX_HEADERS = 200;

type RequestModel = {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body?: string;
  jsonBody?: unknown;
  warnings: string[];
};

function fail(message: string): never { throw new ApiError(message, "input"); }

function boundedInput(values: ApiValues): string {
  const source = apiText(values, "command") || apiText(values, "input") || apiText(values, "source") || apiText(values, "code") || apiText(values, "curl") || apiText(values, "value");
  if (source.length > MAX_INPUT) fail("Input exceeds the 200,000-character limit. Use a smaller request.");
  if (/\0/.test(source)) fail("Request input cannot contain NUL characters.");
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(source)) fail("Request input contains an invalid Unicode surrogate.");
  return source;
}

function ensureOutput(text: string): string {
  if (text.length > MAX_OUTPUT) fail("Generated output exceeds the 1,000,000-character limit. Use a smaller request.");
  return text;
}

function jsonString(value: string): string {
  return JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function pyString(value: string): string { return jsonString(value); }

function shellQuote(value: string): string { return `'${value.replace(/'/g, `'"'"'`)}'`; }

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    out += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)] + (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)] : "=") + (i + 2 < bytes.length ? alphabet[c & 63] : "=");
  }
  return out;
}

function checkUrl(url: string, globDisabled = false): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { fail("Request URL must be an absolute HTTP or HTTPS URL."); }
  if (!/^https?:$/.test(parsed.protocol)) fail("Only HTTP and HTTPS request URLs are supported.");
  if (parsed.username || parsed.password) fail("URL-embedded credentials are unsupported; use explicit cURL --user authentication.");
  if (/[\r\n\0]/.test(url)) fail("Request URL contains an invalid control character.");
  if (!globDisabled && /[{}]/.test(url)) fail("cURL URL glob patterns are unsupported; use --globoff or percent-encode literal braces.");
  if (!globDisabled && /[\[\]]/.test(parsed.pathname + parsed.search + parsed.hash)) fail("cURL URL range patterns are unsupported; use --globoff or percent-encode literal brackets.");
}

function validateHeaders(headers: Array<[string, string]>): void {
  const seen = new Set<string>();
  for (const [name, value] of headers) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) fail("Invalid header name.");
    if (name === "__proto__") fail("The __proto__ header name is unsupported in generated object literals.");
    if (/[\r\n\0]/.test(value)) fail("Header values cannot contain carriage returns, newlines, or NUL.");
    if (seen.has(name.toLowerCase())) fail("Duplicate header names are unsupported; combine their values explicitly.");
    seen.add(name.toLowerCase());
  }
  if (headers.length > MAX_HEADERS) fail("Too many headers (limit 200).");
}

function checkStaticData(value: unknown, depth = 0, budget = { nodes: 0 }): boolean {
  if (depth > 32 || ++budget.nodes > MAX_TOKENS) fail("Static data exceeds the 32-level or 10,000-value limit.");
  if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (Array.isArray(value)) return value.every((item) => checkStaticData(item, depth + 1, budget));
  if (value && typeof value === "object") return Object.entries(value).every(([key, item]) => key !== "__proto__" && checkStaticData(item, depth + 1, budget));
  return true;
}

function inspectJson(request: RequestModel): void {
  if (request.body === undefined || !request.headers.some(([name, value]) => name.toLowerCase() === "content-type" && /^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(value))) return;
  try {
    const data: unknown = JSON.parse(request.body);
    if (!checkStaticData(data)) { request.warnings.push("JSON with unsafe numeric precision or __proto__ keys is kept as raw text."); return; }
    if (request.headers.some(([name]) => name.toLowerCase() === "content-length")) { request.warnings.push("The body is kept as raw text to preserve its explicit Content-Length."); return; }
    request.jsonBody = data;
    if (JSON.stringify(data) !== request.body) request.warnings.push("The JSON body is reserialized; formatting and escape spelling may change.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    request.warnings.push("Content-Type declares JSON, but the body is not valid JSON; it is kept as raw text.");
  }
}

function tokenizeShell(source: string): string[] {
  const out: string[] = [];
  let token = "";
  let quote: "single" | "double" | undefined;
  let started = false;
  const push = () => { if (started) { out.push(token); token = ""; started = false; } };
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quote === "single") {
      if (ch === "'") quote = undefined;
      else token += ch;
      started = true;
      continue;
    }
    if (quote === "double") {
      if (ch === '"') { quote = undefined; started = true; continue; }
      if (ch === "$") fail("Shell variable expansion is unsupported; use literal cURL values.");
      if (ch === "`") fail("Shell substitutions and command separators are unsupported.");
      if (ch === "\\") {
        const next = source[++i];
        if (next === undefined) fail("Malformed cURL: unterminated escape.");
        if (next === "\n") continue;
        token += ['"', "\\", "$", "`"].includes(next) ? next : `\\${next}`;
      } else token += ch;
      started = true;
      continue;
    }
    if (ch === "'") { quote = "single"; started = true; continue; }
    if (ch === '"') { quote = "double"; started = true; continue; }
    if (/\s/.test(ch)) { push(); continue; }
    if (ch === "$") fail("Shell variable expansion is unsupported; use literal cURL values.");
    if ("`;|><&()".includes(ch)) fail("Shell substitutions, redirections, and command separators are unsupported; quote literal values.");
    if (ch === "\\") {
      const next = source[++i];
      if (next === undefined) fail("Malformed cURL: unterminated escape.");
      if (next !== "\n") token += next;
    } else token += ch;
    started = true;
    if (out.length > MAX_TOKENS) fail("cURL request has too many tokens (limit 10,000).");
  }
  if (quote) fail("Malformed cURL: unterminated quote.");
  push();
  if (out.length > MAX_TOKENS) fail("cURL request has too many tokens (limit 10,000).");
  return out;
}

function addHeader(headers: Array<[string, string]>, value: string): void {
  const colon = value.indexOf(":");
  if (colon < 0 && value.endsWith(";")) { headers.push([value.slice(0, -1), ""]); validateHeaders(headers); return; }
  if (colon <= 0) fail("Invalid header: expected `Name: value`.");
  const name = value.slice(0, colon).trim();
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) fail("Invalid header name.");
  if (!value.slice(colon + 1).trim()) fail("cURL header suppression or empty headers are unsupported.");
  headers.push([name, value.slice(colon + 1).trim()]);
  if (headers.length > MAX_HEADERS) fail("Too many headers (limit 200).");
}

function parseCurl(source: string): RequestModel {
  const tokens = tokenizeShell(source.trim());
  if (!tokens.length) fail("Enter a cURL command.");
  if (tokens[0].toLowerCase() !== "curl") fail("cURL input must start with `curl`.");
  const headers: Array<[string, string]> = [];
  const bodyParts: string[] = [];
  let method: string | undefined;
  let url: string | undefined;
  let basicAuth: [string, string] | undefined;
  let globDisabled = false;
  const warnings: string[] = [];
  let optionCount = 0;
  const need = (index: number, option: string): string => {
    const value = tokens[index + 1];
    if (value === undefined) fail(`Option ${option} requires a value.`);
    return value;
  };
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith("-") && ++optionCount > MAX_OPTIONS) fail("cURL request has too many options (limit 1,000).");
    let option = token;
    let inline: string | undefined;
    const equals = option.indexOf("=");
    if (option.startsWith("--") && equals > 2) { inline = option.slice(equals + 1); option = option.slice(0, equals); }
    const take = (name: string): string => {
      if (inline !== undefined) return inline;
      const value = need(i, name);
      i += 1;
      return value;
    };
    if ((option === "--globoff" || option === "-g") && inline === undefined) { globDisabled = true; continue; }
    if (option === "--url") { if (url !== undefined) fail("Multiple URLs are unsupported."); url = take(option); continue; }
    if (option === "--request") { method = take(option); continue; }
    if (option === "-X") { method = take(option); continue; }
    if (option.startsWith("-X") && option.length > 2) { method = option.slice(2); continue; }
    if (option === "--header") { addHeader(headers, take(option)); continue; }
    if (option === "-H") { addHeader(headers, take(option)); continue; }
    if (option.startsWith("-H") && option.length > 2) { addHeader(headers, option.slice(2)); continue; }
    if (option === "--data" || option === "--data-raw" || option === "--data-binary" || option === "-d") {
      const value = take(option);
      if (option !== "--data-raw" && value.startsWith("@")) fail("cURL body file references are unsupported; provide literal data using --data-raw.");
      bodyParts.push(value);
      if (bodyParts.length > 200) fail("Too many body options (limit 200).");
      continue;
    }
    if (option.startsWith("-d") && option.length > 2) { if (option[2] === "@") fail("cURL body file references are unsupported; provide literal data using --data-raw."); bodyParts.push(option.slice(2)); continue; }
    if (option === "--data-urlencode") {
      const value = take(option);
      const at = value.indexOf("@");
      if (at >= 0 && (at === 0 || value.slice(0, at).indexOf("=") < 0)) fail("--data-urlencode file references are unsupported; provide literal data.");
      const eq = value.indexOf("=");
      const encode = (text: string) => encodeURIComponent(text).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
      try { bodyParts.push(eq < 0 ? encode(value) : `${eq > 0 ? `${value.slice(0, eq)}=` : ""}${encode(value.slice(eq + 1))}`); }
      catch { fail("URL-encoded body data contains an invalid Unicode surrogate."); }
      continue;
    }
    if (option === "-u" || option === "--user") {
      const value = take(option);
      const colon = value.indexOf(":");
      if (colon < 0) fail("Basic authentication must use the literal `username:password` form.");
      basicAuth = [value.slice(0, colon), value.slice(colon + 1)];
      continue;
    }
    if (option.startsWith("-u") && option.length > 2) {
      const value = option.slice(2); const colon = value.indexOf(":");
      if (colon < 0) fail("Basic authentication must use the literal `username:password` form.");
      basicAuth = [value.slice(0, colon), value.slice(colon + 1)];
      continue;
    }
    if (option === "--") { if (tokens.length - i !== 2 || url !== undefined) fail("Expected one URL after --; multiple URLs are unsupported."); url = tokens[++i]; continue; }
    if (option.startsWith("-")) fail(`Unsupported cURL option${/^--?[A-Za-z][A-Za-z-]{0,40}$/.test(option) ? `: ${option}` : ""}. The request was not converted.`);
    if (url) fail("Multiple URLs are unsupported.");
    url = token;
  }
  if (!url) fail("cURL request is missing a URL.");
  if (!url.trim()) fail("cURL request URL cannot be empty.");
  if (bodyParts.length > 200) fail("Too many body options (limit 200).");
  const body = bodyParts.length ? bodyParts.join("&") : undefined;
  if (method === undefined) method = body === undefined ? "GET" : "POST";
  if (!/^[A-Za-z][A-Za-z0-9!#$%&'*+.^_`|~-]{0,31}$/.test(method)) fail("HTTP method is invalid.");
  if (body !== undefined && !headers.some(([name]) => name.toLowerCase() === "content-type")) headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
  if (basicAuth) {
    if (headers.some(([name]) => name.toLowerCase() === "authorization")) warnings.push("The explicit Authorization header takes precedence over --user.");
    else headers.push(["Authorization", `Basic ${base64Utf8(`${basicAuth[0]}:${basicAuth[1]}`)}`]);
  }
  checkUrl(url, globDisabled);
  validateHeaders(headers);
  const request: RequestModel = { method, url, headers, body, warnings };
  inspectJson(request);
  return request;
}

type JsToken = { kind: "string" | "identifier" | "number" | "punct" | "eof"; value: string };

function lexJs(source: string): JsToken[] {
  const tokens: JsToken[] = [];
  let i = 0;
  const add = (kind: JsToken["kind"], value: string) => { tokens.push({ kind, value }); if (tokens.length > MAX_TOKENS) fail("Fetch expression has too many tokens (limit 10,000)."); };
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === "/" && source[i + 1] === "/") fail("Comments are unsupported in Fetch input; provide a static expression.");
    if (ch === "'" || ch === '"') {
      const quote = ch; let value = ""; let closed = false; i += 1;
      while (i < source.length) {
        const c = source[i++];
        if (c === quote) { closed = true; break; }
        if (c === "\\") {
          const e = source[i++];
          if (e === undefined) fail("Malformed Fetch expression: unterminated string.");
          if (e === "n") value += "\n"; else if (e === "r") value += "\r"; else if (e === "t") value += "\t"; else if (e === "b") value += "\b"; else if (e === "f") value += "\f"; else if (e === "v") value += "\v"; else if (e === "0") { if (/\d/.test(source[i] ?? "")) fail("Legacy octal string escapes are unsupported."); value += "\0"; }
          else if (e === "u") {
            if (source[i] === "{") { const end = source.indexOf("}", i + 1); const hex = source.slice(i + 1, end); if (end < 0 || !/^[0-9A-Fa-f]{1,6}$/.test(hex) || parseInt(hex, 16) > 0x10ffff) fail("Malformed Fetch expression: invalid Unicode escape."); value += String.fromCodePoint(parseInt(hex, 16)); i = end + 1; }
            else { const hex = source.slice(i, i + 4); if (!/^[0-9A-Fa-f]{4}$/.test(hex)) fail("Malformed Fetch expression: invalid Unicode escape."); value += String.fromCharCode(parseInt(hex, 16)); i += 4; }
          }
          else if (e === "x") { const hex = source.slice(i, i + 2); if (!/^[0-9A-Fa-f]{2}$/.test(hex)) fail("Malformed Fetch expression: invalid hexadecimal escape."); value += String.fromCharCode(parseInt(hex, 16)); i += 2; }
          else if (e === "\n") { /* line continuation */ }
          else if (e === "\r") { if (source[i] === "\n") i += 1; }
          else if (/\d/.test(e)) fail("Legacy octal string escapes are unsupported.");
          else value += e;
        } else { if (c === "\n" || c === "\r") fail("Malformed Fetch expression: unescaped newline in string."); value += c; }
      }
      if (!closed) fail("Malformed Fetch expression: unterminated string.");
      add("string", value); continue;
    }
    if (ch === "`") fail("Fetch templates are dynamic and unsupported; use a quoted URL/string.");
    if (/[A-Za-z_$]/.test(ch)) { const start = i++; while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) i += 1; add("identifier", source.slice(start, i)); continue; }
    if (/[0-9-]/.test(ch)) { const start = i++; while (i < source.length && /[0-9.eE+-]/.test(source[i])) i += 1; const value = source.slice(start, i); if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) fail("Malformed Fetch expression: invalid number."); add("number", value); continue; }
    if ("{}[]():,;.".includes(ch)) { add("punct", ch); i += 1; continue; }
    fail(`Unsupported Fetch syntax at character ${i + 1}; use only static literals.`);
  }
  add("eof", "");
  return tokens;
}

class StaticJson { constructor(readonly value: unknown) {} }

class JsReader {
  private index = 0;
  private nodes = 0;
  constructor(private readonly tokens: JsToken[]) {}
  peek(): JsToken { return this.tokens[this.index]; }
  take(value?: string): JsToken { const token = this.tokens[this.index++]; if (value !== undefined && token.value !== value) fail(`Malformed Fetch expression: expected '${value}'.`); return token; }
  expression(depth = 0, stringifyAllowed = true): unknown {
    if (depth > 32 || ++this.nodes > MAX_TOKENS) fail("Static data exceeds the 32-level or 10,000-value limit.");
    const token = this.peek();
    if (token.kind === "string") { this.take(); return token.value; }
    if (token.kind === "number") { this.take(); const value = Number(token.value); if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail("Static numeric values must be finite and use safe integer precision."); return value; }
    if (token.kind === "identifier") {
      if (token.value === "true" || token.value === "false") { this.take(); return token.value === "true"; }
      if (token.value === "null") { this.take(); return null; }
      if (token.value === "JSON" && stringifyAllowed) {
        this.take("JSON"); this.take("."); this.take("stringify"); this.take("(");
        const value = this.expression(depth + 1, false); this.take(")");
        return new StaticJson(value);
      }
      fail("Fetch values must be static literals or JSON.stringify(static data).");
    }
    if (token.value === "{") {
      this.take("{"); const object: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      if (this.peek().value !== "}") while (true) {
        const key = this.take(); if (key.kind !== "identifier" && key.kind !== "string") fail("Fetch object keys must be static identifiers or strings.");
        if (key.value === "__proto__") fail("__proto__ object-literal keys are unsupported; provide a static JSON string body instead.");
        if (Object.hasOwn(object, key.value)) fail("Duplicate object-literal keys are unsupported.");
        this.take(":"); object[key.value] = this.expression(depth + 1, stringifyAllowed && depth === 0);
        if (this.peek().value === "}") break;
        this.take(","); if (this.peek().value === "}") break;
      }
      this.take("}"); return object;
    }
    if (token.value === "[") {
      this.take("["); const array: unknown[] = [];
      if (this.peek().value !== "]") while (true) {
        array.push(this.expression(depth + 1, false)); if (this.peek().value === "]") break; this.take(","); if (this.peek().value === "]") break;
      }
      this.take("]"); return array;
    }
    fail("Fetch values must be static literals.");
  }
}

function parseFetch(source: string): RequestModel {
  const tokens = lexJs(source.trim());
  const reader = new JsReader(tokens);
  if (reader.peek().value !== "fetch") fail("Fetch input must be a static fetch(...) call.");
  reader.take("fetch"); reader.take("(");
  const urlToken = reader.take();
  if (urlToken.kind !== "string") fail("Fetch URL must be a static string literal.");
  const url = urlToken.value;
  let method = "GET";
  let headers: Array<[string, string]> = [];
  let body: string | undefined;
  let jsonBody: unknown;
  if (reader.peek().value === ",") {
    reader.take(",");
    if (reader.peek().value !== ")") {
      const options = reader.expression();
      if (!options || typeof options !== "object" || Array.isArray(options) || options instanceof StaticJson) fail("Fetch options must be a static object literal.");
      for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
        if (key === "method") { if (typeof value !== "string") fail("Fetch method must be a static string."); method = /^(?:delete|get|head|options|post|put)$/i.test(value) ? value.toUpperCase() : value; }
        else if (key === "headers") {
          if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof StaticJson) fail("Fetch headers must be a static object literal.");
          headers = Object.entries(value as Record<string, unknown>).map(([name, headerValue]) => { if (typeof headerValue !== "string") fail("Fetch header values must be static strings."); return [name, headerValue]; });
          if (headers.length > MAX_HEADERS) fail("Too many headers (limit 200).");
        } else if (key === "body") {
          if (typeof value === "string") body = value;
          else if (value instanceof StaticJson) { body = JSON.stringify(value.value); jsonBody = value.value; }
          else fail("Fetch body must be a static string or JSON.stringify(static data).");
        } else fail(`Unsupported Fetch option: ${key}. Use only method, headers, and body.`);
      }
      if (reader.peek().value === ",") reader.take(",");
    }
  }
  reader.take(")");
  if (reader.peek().value === ";") reader.take(";");
  if (reader.peek().kind !== "eof") fail("Malformed Fetch expression: trailing syntax is unsupported.");
  if (body !== undefined && (method === "GET" || method === "HEAD")) fail("Fetch does not support a body with GET or HEAD; use an explicit body-capable method.");
  if (!/^[A-Za-z][A-Za-z0-9!#$%&'*+.^_`|~-]{0,31}$/.test(method)) fail("HTTP method is invalid.");
  if (/^(?:CONNECT|TRACE|TRACK)$/i.test(method)) fail("Fetch forbids CONNECT, TRACE, and TRACK methods.");
  checkUrl(url, true);
  if (body !== undefined && /\0/.test(body)) fail("A NUL-containing Fetch body cannot be represented as a cURL argument.");
  if (body !== undefined && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(body)) fail("Fetch body contains an invalid Unicode surrogate.");
  if (body !== undefined && !headers.some(([name]) => name.toLowerCase() === "content-type")) headers.push(["Content-Type", "text/plain;charset=UTF-8"]);
  validateHeaders(headers);
  return { method, url, headers, body, jsonBody, warnings: [] };
}

function renderHeaders(headers: Array<[string, string]>, indent: string): string {
  return headers.map(([name, value]) => `${indent}${jsonString(name)}: ${jsonString(value)}`).join(",\n");
}

function jsData(value: unknown, indent: number): string {
  return JSON.stringify(value, null, 2).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029").split("\n").map((line, index) => index ? " ".repeat(indent) + line : line).join("\n");
}

function pythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "string") return pyString(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : fail("JSON body contains a non-finite number.");
  if (Array.isArray(value)) return `[${value.map((item) => pythonLiteral(item)).join(", ")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${pyString(key)}: ${pythonLiteral(item)}`).join(", ")}}`;
  fail("JSON body contains an unsupported value.");
}

function fetchCode(request: RequestModel): string {
  const hasBody = request.body !== undefined;
  const lines = [`const response = await fetch(${jsonString(request.url)}${hasBody || request.headers.length || request.method !== "GET" ? ", {" : ");"}`];
  if (lines[0].endsWith(", {")) {
    lines.push(`  method: ${jsonString(request.method)},`);
    if (request.headers.length) lines.push("  headers: {", renderHeaders(request.headers, "    "), "  },");
    if (hasBody) lines.push(`  body: ${request.jsonBody !== undefined ? `JSON.stringify(${jsData(request.jsonBody, 2)})` : jsonString(request.body ?? "")},`);
    lines.push("});");
  }
  lines.push("const data = await response.text();");
  return lines.join("\n");
}

function axiosCode(request: RequestModel): string {
  const lines = ["import axios from \"axios\";", "", "const response = await axios({", `  method: ${jsonString(request.method)},`, `  url: ${jsonString(request.url)},`];
  if (request.headers.length) lines.push("  headers: {", renderHeaders(request.headers, "    "), "  },");
  if (request.body !== undefined) {
    const structured = request.jsonBody !== null && typeof request.jsonBody === "object";
    lines.push(`  data: ${structured ? jsData(request.jsonBody, 2) : jsonString(request.body)},`);
    if (!structured) lines.push("  transformRequest: [(data) => data],");
  }
  lines.push("});", "", "const data = response.data;");
  return lines.join("\n");
}

function pythonCode(request: RequestModel): string {
  const lines = ["import requests"];
  lines.push("", "headers = {");
  for (const [name, value] of request.headers) {
    lines.push(`    ${pyString(name)}: ${pyString(value)},`);
  }
  lines.push("}", "", `response = requests.request(`, `    ${pyString(request.method)},`, `    ${pyString(request.url)},`, "    headers=headers,");
  if (request.body !== undefined) {
    lines[lines.length - 1] = request.jsonBody !== undefined && request.jsonBody !== null ? `    headers=headers,\n    json=${pythonLiteral(request.jsonBody)},` : `    headers=headers,\n    data=${pyString(request.body)}.encode("utf-8"),`;
  }
  lines.push(")", "", "data = response.text");
  return lines.join("\n");
}

function curlCode(request: RequestModel): string {
  const parts = ["curl", "--request", shellQuote(request.method)];
  if (/[{}\[\]]/.test(request.url)) parts.push("--globoff");
  for (const [name, value] of request.headers) parts.push("--header", shellQuote(value ? `${name}: ${value}` : `${name};`));
  if (request.body !== undefined) parts.push("--data-raw", shellQuote(request.body));
  parts.push(shellQuote(request.url));
  return parts.join(" ");
}

function resultFor(id: string, request: RequestModel): ApiResult {
  let output: string;
  if (id === "curl-to-fetch") {
    if (request.body !== undefined && /^(?:GET|HEAD)$/i.test(request.method)) fail("Fetch does not support a body with GET or HEAD; choose another conversion or a body-capable method.");
    if (/^(?:CONNECT|TRACE|TRACK)$/i.test(request.method)) fail("Fetch forbids CONNECT, TRACE, and TRACK methods.");
    output = fetchCode(request);
    if (request.headers.some(([name]) => /^(?:host|cookie|content-length|connection|origin|referer|accept-encoding)$/i.test(name))) request.warnings.push("Browser Fetch may ignore forbidden request headers; run the snippet in a compatible environment to preserve them.");
    if (/^(?:delete|get|head|options|post|put)$/i.test(request.method) && request.method !== request.method.toUpperCase()) request.warnings.push("Fetch normalizes the casing of standard HTTP methods.");
  }
  else if (id === "curl-to-axios") {
    output = axiosCode(request);
    if (request.method !== request.method.toUpperCase()) request.warnings.push("Axios transports may normalize HTTP method casing.");
    if (request.body !== undefined && /^(?:GET|HEAD)$/i.test(request.method)) request.warnings.push("Browser Axios transports may omit a GET or HEAD body; use a body-capable transport.");
  }
  else if (id === "curl-to-python-requests") output = pythonCode(request);
  else output = curlCode(request);
  if ((id === "curl-to-fetch" || id === "curl-to-axios") && request.headers.some(([, value]) => /[^\x00-\xFF]/.test(value))) request.warnings.push("Non-Latin-1 header values may be rejected by browser header APIs.");
  output = ensureOutput(output);
  return { text: output, copyText: output, data: { method: request.method, url: request.url, headers: request.headers, body: request.body ?? null }, warnings: request.warnings };
}

/** Convert only static, text representations of HTTP requests. No request is made. */
export async function convertApi(id: string, values: ApiValues): Promise<ApiResult> {
  try {
  if (!["curl-to-fetch", "fetch-to-curl", "curl-to-axios", "curl-to-python-requests"].includes(id)) fail(`Unsupported API conversion: ${id}.`);
  const source = boundedInput(values);
  if (!source.trim()) fail("Enter a cURL or Fetch request.");
  const request = id === "fetch-to-curl" ? parseFetch(source) : parseCurl(source);
  return resultFor(id, request);
  } catch (error) {
    if (error instanceof ApiError) throw new ApiError(error.message, id === "fetch-to-curl" ? "code" : "command");
    throw error;
  }
}
