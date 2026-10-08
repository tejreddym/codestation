import { ApiError, apiResult, type ApiResult, type ApiValues } from "./types";
import { runJsonTool } from "../json-data/json";

export const API_TEXT_LIMIT = 200_000;
export const API_ROW_LIMIT = 1_000;
export const NETWORK_WARNING = "Network or CORS error. The request may have been blocked by the target server's CORS policy. Code Station sends API test requests directly from your browser and does not bypass CORS through a proxy. The browser cannot distinguish a network failure from a CORS rejection; no TLS bypass or automatic retry is used.";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type ApiMethod = typeof METHODS[number];
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export type Pair = { name: string; value: string };
export type Parameter = { key: string; value: string };

export function text(value: unknown, field: string, limit = API_TEXT_LIMIT): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ApiError(`${field} must be text.`, field);
  if (value.length > limit) throw new ApiError(`${field} exceeds the ${limit.toLocaleString("en-US")} character limit.`, field);
  return value;
}

export function validateApiInput(value: unknown): void {
  const seen = new Set<object>(); let nodes = 0; let total = 0;
  const visit = (item: unknown, depth: number): void => {
    if (++nodes > 10_000) throw new ApiError("Input exceeds the 10,000-node limit.");
    if (typeof item === "string") { text(item, "Input"); total += item.length; if (total > 1_000_000) throw new ApiError("Combined input exceeds the 1,000,000-character limit."); return; }
    if (!item || typeof item !== "object") return;
    if (depth > 40) throw new ApiError("Input nesting exceeds the 40-level limit.");
    if (seen.has(item)) throw new ApiError("Input contains a circular reference.");
    seen.add(item);
    if (Array.isArray(item) && item.length > API_ROW_LIMIT) throw new ApiError("Input exceeds the 1,000-row limit.");
    for (const [key, child] of Object.entries(item)) { text(key, "Input key"); visit(child, depth + 1); }
    seen.delete(item);
  };
  visit(value, 0);
}

export function boundedResult(result: ApiResult): ApiResult {
  if (JSON.stringify(result).length > API_TEXT_LIMIT) throw new ApiError("Result exceeds the 200,000-character output limit. Reduce the input.");
  return result;
}

export function rows<T extends Record<string, unknown>>(value: unknown, field: string): T[] {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw new ApiError(`${field} must be a list.`, field);
  if (value.length > API_ROW_LIMIT) throw new ApiError(`${field} exceeds the ${API_ROW_LIMIT.toLocaleString("en-US")} row limit.`, field);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new ApiError(`${field} row ${index + 1} must be an object.`, field);
    return row as T;
  });
}

function pairRows(value: unknown, field: string, keyName: string, valueName: string): Pair[] {
  return rows<Record<string, unknown>>(value, field).map((row, index) => {
    const name = text(row[keyName], `${field} row ${index + 1} ${keyName}`);
    const val = text(row[valueName], `${field} row ${index + 1} ${valueName}`);
    return { name, value: val };
  });
}

export function headerRows(value: unknown, field = "headers"): Pair[] {
  return pairRows(value, field, "name", "value").map((header, index) => {
    if (!TOKEN.test(header.name)) throw new ApiError(`Invalid header name in row ${index + 1}. Header names must use HTTP token characters.`, field);
    if (/[\x00-\x08\x0A-\x1F\x7F]/.test(header.value)) throw new ApiError(`Header value in row ${index + 1} contains a prohibited control character or line break.`, field);
    return header;
  });
}

export function parameterRows(value: unknown, field = "parameters"): Parameter[] {
  return pairRows(value, field, "key", "value").map((item, index) => {
    if (/[\r\n]/.test(item.name) || /[\r\n]/.test(item.value)) throw new ApiError(`Parameter row ${index + 1} contains a line break.`, field);
    return { key: item.name, value: item.value };
  });
}

export function method(value: unknown): ApiMethod {
  const result = value === undefined ? "GET" : text(value, "method").toUpperCase();
  if (!(METHODS as readonly string[]).includes(result)) throw new ApiError("Select a supported HTTP method.", "method");
  return result as ApiMethod;
}

export function url(value: unknown): URL {
  const raw = text(value, "url");
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new ApiError("Enter a valid URL using the http or https scheme.", "url"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new ApiError("Only http and https URLs are supported.", "url");
  if (parsed.username || parsed.password) throw new ApiError("URL credentials are not supported. Use an explicit Authorization header.", "url");
  return parsed;
}

export function addParameters(input: URL, parameters: Parameter[]): URL {
  const result = new URL(input.href);
  parameters.forEach(parameter => result.searchParams.append(parameter.key, parameter.value));
  return result;
}

export function jsonBody(body: string, bodyType: string): { body?: string; contentType?: string } {
  if (bodyType === "None" || bodyType === "") return {};
  if (bodyType === "JSON") {
    try { return { body: runJsonTool("json-formatter", { input: body }).text, contentType: "application/json" }; }
    catch { throw new ApiError("Body is not valid JSON.", "body"); }
  }
  if (bodyType === "Text") return { body, contentType: "text/plain" };
  if (bodyType === "application/x-www-form-urlencoded") return { body, contentType: "application/x-www-form-urlencoded" };
  throw new ApiError("Select None, JSON, Text, or application/x-www-form-urlencoded for the body.", "bodyType");
}

function shell(value: string): string { return `'${value.replace(/'/g, `'\\''`)}'`; }
function js(value: string): string { return JSON.stringify(value); }

export function buildRest(values: ApiValues): ApiResult {
  const httpMethod = method(values.method);
  const parameters = parameterRows(values.parameters);
  const target = addParameters(url(values.url), parameters);
  const headers = headerRows(values.headers);
  const bodyType = text(values.bodyType ?? "None", "bodyType");
  const body = text(values.body, "body");
  const prepared = jsonBody(body, bodyType);
  const effectiveHeaders = [...headers];
  if (prepared.contentType && !effectiveHeaders.some(h => h.name.toLowerCase() === "content-type")) effectiveHeaders.push({ name: "Content-Type", value: prepared.contentType });
  const warning = (httpMethod === "GET" || httpMethod === "HEAD") && prepared.body !== undefined ? "GET and HEAD requests do not support a request body in fetch; the generated fetch request omits it." : undefined;
  const curl = ["curl", ...(httpMethod === "HEAD" ? ["--head"] : []), "-X", httpMethod, shell(target.href), ...effectiveHeaders.flatMap(h => ["-H", shell(`${h.name}: ${h.value}`)]), ...(prepared.body !== undefined && !warning ? ["--data-raw", shell(prepared.body)] : [])].join(" ");
  const fetchInit: string[] = [`method: ${js(httpMethod)}`];
  if (effectiveHeaders.length) fetchInit.push(`headers: ${JSON.stringify(effectiveHeaders.map(h => [h.name, h.value]), null, 2)}`);
  if (prepared.body !== undefined && !warning) fetchInit.push(`body: ${js(prepared.body)}`);
  const fetchCode = `fetch(${js(target.href)}, {\n  ${fetchInit.join(",\n  ")}\n})`;
  const summary = `${httpMethod} ${target.href}${effectiveHeaders.length ? `\n${effectiveHeaders.map(h => `${h.name}: ${h.value}`).join("\n")}` : ""}${prepared.body !== undefined ? `\n\n${prepared.body}` : ""}`;
  const warnings = warning ? [warning] : [];
  if (new Set(headers.map(h => h.name.toLowerCase())).size !== headers.length) warnings.push("Duplicate headers retain their order in the generated header list and curl. The browser Headers implementation may combine duplicate values.");
  return apiResult({ method: httpMethod, url: target.href, parameters, headers: effectiveHeaders, body: prepared.body ?? "", bodyType, summary, curl, fetch: fetchCode }, warnings.length ? warnings : undefined);
}

export function buildRawHttp(values: ApiValues): ApiResult {
  const httpMethod = method(values.method);
  const rawTarget = text(values.path ?? values.url, "path");
  let target = rawTarget || "/";
  let host: string | undefined;
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(target)) { const absolute = url(target); host = absolute.host; target = `${absolute.pathname || "/"}${absolute.search}`; }
  else if (!target.startsWith("/")) target = `/${target}`;
  if (/[\s\x00-\x1F\x7F]/.test(target) || target.includes("#")) throw new ApiError("Request path cannot contain whitespace, control characters, or a fragment. URL-encode those characters.", "path");
  const version = values.httpVersion ?? "HTTP/1.1";
  if (version !== "HTTP/1.0" && version !== "HTTP/1.1") throw new ApiError("Select HTTP/1.1 or HTTP/1.0.", "httpVersion");
  const headers = headerRows(values.headers);
  if (host && !headers.some(h => h.name.toLowerCase() === "host")) headers.unshift({ name: "Host", value: host });
  const body = text(values.body, "body");
  const raw = `${httpMethod} ${target} ${version}\r\n${headers.map(h => `${h.name}: ${h.value}`).join("\r\n")}${headers.length ? "\r\n" : ""}\r\n${body}`;
  return apiResult({ method: httpMethod, path: target, httpVersion: version, headers, body, raw }, undefined);
}

function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === "function") return btoa(binary);
  // This branch is only for non-browser test runtimes; it avoids a Node import in the browser bundle.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) { const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0); output += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + (i + 1 < bytes.length ? alphabet[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? alphabet[n & 63] : "="); }
  return output;
}

export function buildBasicAuth(values: ApiValues): ApiResult {
  const username = text(values.username, "username"); const password = text(values.password, "password");
  if (username.includes(":")) throw new ApiError("Basic Auth username cannot contain a colon.", "username");
  const value = `Basic ${utf8Base64(`${username}:${password}`)}`;
  return apiResult({ scheme: "Basic", username, authorization: value, header: `Authorization: ${value}`, explanation: "Basic credentials are encoded, not encrypted. Send this header only over HTTPS." });
}

export function buildBearer(values: ApiValues): ApiResult {
  const token = text(values.token, "token").trim();
  if (!token) throw new ApiError("Enter a bearer token.", "token");
  if (/[\s\x00-\x1F\x7F]/.test(token)) throw new ApiError("Token cannot contain internal whitespace or control characters.", "token");
  const value = `Bearer ${token}`;
  return apiResult({ scheme: "Bearer", token, authorization: value, header: `Authorization: ${value}`, explanation: "The token is trimmed at the edges and is never logged or persisted." });
}

export function buildHeaderBlock(values: ApiValues): ApiResult {
  const entries = headerRows(values.entries ?? values.headers, "entries");
  const object: Record<string, string | string[]> = Object.create(null);
  entries.forEach(entry => { const existing = object[entry.name]; object[entry.name] = existing === undefined ? entry.value : Array.isArray(existing) ? [...existing, entry.value] : [existing, entry.value]; });
  const raw = entries.map(entry => `${entry.name}: ${entry.value}`).join("\r\n");
  // fromEntries creates own data properties even for names such as __proto__.
  const javascript = `const headers = Object.fromEntries(${JSON.stringify(Object.entries(object), null, 2)});`;
  return apiResult({ entries, raw, headers: object, javascript, count: entries.length }, entries.some(entry => Array.isArray(object[entry.name])) ? ["Repeated names use arrays in the JavaScript object so values are not lost. Use the ordered entries for Headers/fetch; the browser may combine duplicate values."] : undefined);
}

export function parseHeaderBlock(values: ApiValues): ApiResult {
  const raw = text(values.raw ?? values.headers ?? values.text, "raw");
  if (/\r(?!\n)/.test(raw)) throw new ApiError("Malformed header block: use LF or CRLF line endings.", "raw");
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const entries: Array<{ name: string; value: string; line: number }> = [];
  lines.forEach((line, index) => {
    if (!line) return;
    if (/^[ \t]/.test(line)) throw new ApiError(`Malformed header on line ${index + 1}: continuation lines are not supported.`, "raw");
    const colon = line.indexOf(":");
    if (colon <= 0) throw new ApiError(`Malformed header on line ${index + 1}: expected Name: value.`, "raw");
    const name = line.slice(0, colon); const value = line.slice(colon + 1).replace(/^[ \t]+/, "");
    if (!TOKEN.test(name)) throw new ApiError(`Malformed header name on line ${index + 1}.`, "raw");
    if (/[\x00-\x08\x0A-\x1F\x7F]/.test(value)) throw new ApiError(`Malformed header value on line ${index + 1}.`, "raw");
    entries.push({ name, value, line: index + 1 });
    if (entries.length > API_ROW_LIMIT) throw new ApiError("Header block exceeds the 1,000-row limit.", "raw");
  });
  const grouped: Record<string, string[]> = Object.create(null); entries.forEach(entry => { (grouped[entry.name] ??= []).push(entry.value); });
  return apiResult({ entries, headers: grouped, count: entries.length, emptyValues: entries.filter(entry => entry.value === "").length }, undefined);
}

async function readResponse(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let output = "";
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      output += decoder.decode(part.value, { stream: true });
      if (output.length > API_TEXT_LIMIT) { await reader.cancel(); throw new ApiError("Response body exceeds the 200,000-character limit. No truncated response is returned."); }
    }
    output += decoder.decode();
    if (output.length > API_TEXT_LIMIT) throw new ApiError("Response body exceeds the 200,000-character limit.");
    return output;
  } finally { reader.releaseLock(); }
}

/** The tester's sole network boundary: one browser fetch, no retries or proxy. */
export async function executeApiRequest(values: ApiValues, signal?: AbortSignal): Promise<ApiResult> {
  validateApiInput(values);
  const prepared = buildRest(values);
  const data = prepared.data!;
  const target = data.url as string;
  const httpMethod = data.method as ApiMethod;
  const headers = (data.headers as Pair[]).map(header => [header.name, header.value] as [string, string]);
  headers.forEach((header, index) => { if (/[^\x00-\xFF]/.test(header[1])) throw new ApiError(`Header value in row ${index + 1} cannot be sent by browser fetch: HTTP header values must fit in a ByteString. Use an encoded value.`, "headers"); });
  const body = values.bodyType && values.bodyType !== "None" && httpMethod !== "GET" && httpMethod !== "HEAD" ? data.body as string : undefined;
  const started = performance.now();
  if (signal?.aborted) return boundedResult(apiResult({ state: "Aborted", statusCode: null, statusText: "Aborted", responseHeaders: [], responseBody: "", responseTime: 0 }, ["Request aborted. No retry was performed."]));
  try {
    const response = await fetch(target, { method: httpMethod, headers, ...(body !== undefined ? { body } : {}), signal, credentials: "omit" });
    const responseHeaders: Array<{ name: string; value: string }> = [];
    response.headers.forEach((value, name) => { responseHeaders.push({ name, value }); if (responseHeaders.length > API_ROW_LIMIT) throw new ApiError("Response headers exceed the 1,000-row limit."); });
    const responseBody = await readResponse(response);
    const warnings = [...(prepared.warnings ?? []), "Browser fetch enforces forbidden-header rules and may normalize whitespace or combine duplicate values. Only response headers exposed by the browser and CORS can be displayed."];
    const result = apiResult({ statusCode: response.status, statusText: response.statusText, responseHeaders, responseBody, responseTime: Math.round((performance.now() - started) * 100) / 100, state: "Completed", ok: response.ok }, warnings);
    return boundedResult(result);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted || (error && typeof error === "object" && "name" in error && error.name === "AbortError")) return boundedResult(apiResult({ state: "Aborted", statusCode: null, statusText: "Aborted", responseHeaders: [], responseBody: "", responseTime: Math.round((performance.now() - started) * 100) / 100 }, ["Request aborted. No retry was performed."]));
    return boundedResult(apiResult({ state: "Network or CORS error", statusCode: null, statusText: "Network or CORS error", responseHeaders: [], responseBody: "", responseTime: Math.round((performance.now() - started) * 100) / 100 }, [NETWORK_WARNING]));
  }
}
