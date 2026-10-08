import { WebError, webResult, type WebValues, type WebResult } from "./types";
import { absoluteUrl, assertScalars, inspectPercent, inspectText, parameterRows, searchRows, INSPECT_TEXT_LIMIT, INSPECT_ROW_LIMIT } from "./inspect-shared";
import { referenceWeb } from "./reference";

function parseUrl(values: WebValues): WebResult {
  const url = absoluteUrl(inspectText(values, "url", true), "url");
  const path = inspectPercent(url.pathname, "url");
  const fragment = inspectPercent(url.hash.slice(1), "url");
  const username = inspectPercent(url.username, "url");
  return webResult({
    scheme: url.protocol.slice(0, -1), protocol: url.protocol,
    username: username.decoded, rawUsername: url.username, passwordPresent: url.password !== "" ? "Present" : "Not present",
    hostname: url.hostname, port: url.port, pathname: url.pathname, decodedPathname: path.decoded,
    parameters: searchRows(url.search, "url"), rawQuery: url.search.slice(1),
    fragment: fragment.decoded, rawFragment: url.hash.slice(1),
  }, [...username.warnings, ...path.warnings, ...fragment.warnings]);
}

function buildUrl(values: WebValues): WebResult {
  const scheme = inspectText(values, "scheme", true);
  if (scheme !== "https" && scheme !== "http") throw new WebError("Choose http or https.", "scheme");
  const hostname = inspectText(values, "hostname", true);
  if (/[\s\/@?#\\%]/.test(hostname)) throw new WebError("Enter only a hostname, IPv4 address, or IPv6 address.", "hostname");
  assertScalars(hostname, "hostname");
  let host = hostname;
  if (host.startsWith("[") && !/^\[[\da-f:.]+\]$/i.test(host)) throw new WebError("Enter an IPv6 address without a port.", "hostname");
  if (host.includes(":") && !host.startsWith("[")) host = `[${host}]`;
  let url: URL;
  try { url = new URL(`${scheme}://${host}/`); } catch { throw new WebError("Enter a valid hostname or IP address.", "hostname"); }
  if (url.port || url.username || url.password || url.pathname !== "/") throw new WebError("The hostname must not include a port or URL components.", "hostname");
  const port = inspectText(values, "port");
  if (port && (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)) throw new WebError("Port must be a whole number from 1 to 65535.", "port");
  url.port = port;
  const username = inspectText(values, "username");
  const password = inspectText(values, "password");
  const pathname = inspectText(values, "pathname");
  const fragment = inspectText(values, "fragment");
  for (const [field, text] of Object.entries({ username, password, pathname, fragment })) assertScalars(text, field);
  const parameters = parameterRows(values);
  if (hostname.length + username.length + password.length + pathname.length + fragment.length + parameters.reduce((sum, row) => sum + row.key.length + row.value.length, 0) > INSPECT_TEXT_LIMIT) {
    throw new WebError("Combined URL fields are limited to 200,000 characters.");
  }
  url.username = encodeURIComponent(username);
  url.password = encodeURIComponent(password);
  const encodedPath = pathname.split("/").map(segment => encodeURIComponent(segment)).join("/");
  url.pathname = encodedPath;
  const query = new URLSearchParams();
  for (const { key, value } of parameters) query.append(key, value);
  url.search = query.toString();
  url.hash = fragment ? encodeURIComponent(fragment) : "";
  const warnings = pathname.split("/").some(segment => segment === "." || segment === "..")
    ? ["Dot path segments are normalized according to the URL standard."] : undefined;
  return { text: url.href, data: { url: url.href }, copyText: url.href, warnings };
}

function parseQuery(values: WebValues): WebResult {
  const input = inspectText(values, "input");
  const query = /^[a-z][a-z\d+.-]*:/i.test(input.trim()) ? absoluteUrl(input, "input").search : input;
  const parameters = searchRows(query, "input");
  return webResult({ parameters, count: parameters.length });
}

function generateQuery(values: WebValues): WebResult {
  const query = new URLSearchParams();
  for (const { key, value } of parameterRows(values)) query.append(key, value);
  const text = `?${query.toString()}`;
  return { text, data: { query: text }, copyText: text };
}

function parseFragment(values: WebValues): WebResult {
  const input = inspectText(values, "input", true);
  const raw = input.startsWith("#") ? input.slice(1) : absoluteUrl(input, "input").hash.slice(1);
  const { decoded, warnings } = inspectPercent(raw);
  return { ...webResult({ raw, decoded }, warnings), copyText: decoded };
}

function analyzePath(values: WebValues): WebResult {
  const input = inspectText(values, "input");
  const pathname = /^[a-z][a-z\d+.-]*:/i.test(input.trim()) ? absoluteUrl(input, "input").pathname : input;
  if (pathname.includes("?") || pathname.includes("#")) throw new WebError("Enter a pathname without a query or fragment, or an absolute URL.", "input");
  const rawSegments = pathname.split("/").filter(segment => segment !== "");
  if (rawSegments.length > INSPECT_ROW_LIMIT) throw new WebError("Use at most 1,000 path segments.", "input");
  const inspected = rawSegments.map(segment => inspectPercent(segment));
  const segments = inspected.map(segment => segment.decoded);
  const directory = pathname === "" || pathname.endsWith("/");
  const filename = directory ? "" : (segments.at(-1) ?? "");
  const dot = filename.lastIndexOf(".");
  // Dotfiles and a trailing dot do not imply an extension.
  const extension = dot > 0 && dot < filename.length - 1 ? filename.slice(dot + 1) : "";
  return webResult({ pathname, pathSegments: segments, segmentCount: segments.length, filename, extension }, inspected.flatMap(segment => segment.warnings).slice(0, 10));
}

function encodingInspector(values: WebValues): WebResult {
  const { runs, decoded, warnings } = inspectPercent(inspectText(values, "input"));
  return { ...webResult({ encodedSequences: runs, decodedCharacters: runs.map(run => run.decoded), positions: runs.map(run => ({ position: run.position, end: run.end })), decodedPreview: decoded }, warnings), copyText: decoded };
}

/** Browser-local URL inspection and curated references. Never visits a URL. */
export async function inspectWeb(id: string, values: WebValues): Promise<WebResult> {
  switch (id) {
    case "url-parser": return parseUrl(values);
    case "url-builder": return buildUrl(values);
    case "query-string-parser": return parseQuery(values);
    case "query-string-generator": return generateQuery(values);
    case "url-fragment-parser": return parseFragment(values);
    case "url-path-analyzer": return analyzePath(values);
    case "url-encoding-inspector": return encodingInspector(values);
    default: return referenceWeb(id, values);
  }
}
