#!/usr/bin/env node

// mcp/cli.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// mcp/config.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
var PRICING = {
  inr: "\u20B9199 / month",
  usd: "$2.99 / month",
  lifetimeInr: "\u20B9999 one-time",
  lifetimeUsd: "$19.00 one-time",
  upgradeUrl: "https://codestation.in/pro"
};
var PRO_TOOLS = /* @__PURE__ */ new Set([
  "codestation_hash",
  "codestation_hmac",
  "codestation_jwt_decode",
  "codestation_format_sql",
  "codestation_cron_explain",
  "codestation_timezone_convert",
  "codestation_business_days",
  "codestation_regex_test",
  "codestation_json_schema",
  "codestation_json_to_typescript",
  "codestation_json_to_zod",
  "codestation_curl_to_code",
  "codestation_env_audit",
  "codestation_mock_data",
  "codestation_git_conflict"
]);
var CACHE_DIR = path.join(os.homedir(), ".codestation");
var CACHE_FILE = path.join(CACHE_DIR, "license.json");
function readCachedLicense() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (Date.now() - data.verifiedAt < 30 * 24 * 60 * 60 * 1e3) {
        return data;
      }
    }
  } catch {
  }
  return null;
}
function saveCachedLicense(key, isPro) {
  try {
    if (process.env.NODE_ENV === "test") return;
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cache = {
      key,
      verifiedAt: Date.now(),
      isPro
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
  }
}
function validateLicenseKey(rawKey) {
  if (!rawKey) return false;
  const key = rawKey.trim();
  if (!key) return false;
  if (/^CS-PRO-[A-Za-z0-9_-]+$/i.test(key) || key.startsWith("cspro_")) {
    return true;
  }
  if (key === "PRO_DEMO_KEY" || key === "CS-PRO-DEV") {
    return true;
  }
  return false;
}
function resolveLicense(cliKey) {
  if (cliKey) {
    const valid = validateLicenseKey(cliKey);
    if (valid) {
      saveCachedLicense(cliKey, true);
      return { isPro: true, licenseKey: cliKey, source: "cli", tier: "pro" };
    }
  }
  const envKey = process.env.CODESTATION_LICENSE_KEY;
  if (envKey) {
    const valid = validateLicenseKey(envKey);
    if (valid) {
      saveCachedLicense(envKey, true);
      return { isPro: true, licenseKey: envKey, source: "env", tier: "pro" };
    }
  }
  const cached = readCachedLicense();
  if (cached && cached.isPro) {
    return { isPro: true, licenseKey: cached.key, source: "cache", tier: "pro" };
  }
  return { isPro: false, source: "none", tier: "free" };
}
function getProUpgradeNotice(toolName) {
  return [
    `\u{1F512} Tool "${toolName}" is a Code Station Pro feature.`,
    ``,
    `Get Code Station Pro:`,
    `  \u2022 India: ${PRICING.inr} (or ${PRICING.lifetimeInr})`,
    `  \u2022 Global: ${PRICING.usd} (or ${PRICING.lifetimeUsd})`,
    `  \u2022 Upgrade URL: ${PRICING.upgradeUrl}`,
    ``,
    `To activate, launch with:`,
    `  npx codestation-mcp --key CS-PRO-YOURKEY`,
    `or set environment variable:`,
    `  export CODESTATION_LICENSE_KEY=CS-PRO-YOURKEY`
  ].join("\n");
}

// lib/tools/api/types.ts
var ApiError = class extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
    this.name = "ApiError";
  }
};
var apiText = (values, field) => typeof values[field] === "string" ? values[field] : "";

// lib/tools/api/curl.ts
var MAX_INPUT = 2e5;
var MAX_OUTPUT = 1e6;
var MAX_TOKENS = 1e4;
var MAX_OPTIONS = 1e3;
var MAX_HEADERS = 200;
function fail(message) {
  throw new ApiError(message, "input");
}
function boundedInput(values) {
  const source = apiText(values, "command") || apiText(values, "input") || apiText(values, "source") || apiText(values, "code") || apiText(values, "curl") || apiText(values, "value");
  if (source.length > MAX_INPUT) fail("Input exceeds the 200,000-character limit. Use a smaller request.");
  if (/\0/.test(source)) fail("Request input cannot contain NUL characters.");
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(source)) fail("Request input contains an invalid Unicode surrogate.");
  return source;
}
function ensureOutput(text2) {
  if (text2.length > MAX_OUTPUT) fail("Generated output exceeds the 1,000,000-character limit. Use a smaller request.");
  return text2;
}
function jsonString(value) {
  return JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function pyString(value) {
  return jsonString(value);
}
function shellQuote(value) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
function base64Utf8(value) {
  const bytes2 = new TextEncoder().encode(value);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes2.length; i += 3) {
    const a = bytes2[i], b = bytes2[i + 1] ?? 0, c = bytes2[i + 2] ?? 0;
    out += alphabet[a >> 2] + alphabet[(a & 3) << 4 | b >> 4] + (i + 1 < bytes2.length ? alphabet[(b & 15) << 2 | c >> 6] : "=") + (i + 2 < bytes2.length ? alphabet[c & 63] : "=");
  }
  return out;
}
function checkUrl(url, globDisabled = false) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("Request URL must be an absolute HTTP or HTTPS URL.");
  }
  if (!/^https?:$/.test(parsed.protocol)) fail("Only HTTP and HTTPS request URLs are supported.");
  if (parsed.username || parsed.password) fail("URL-embedded credentials are unsupported; use explicit cURL --user authentication.");
  if (/[\r\n\0]/.test(url)) fail("Request URL contains an invalid control character.");
  if (!globDisabled && /[{}]/.test(url)) fail("cURL URL glob patterns are unsupported; use --globoff or percent-encode literal braces.");
  if (!globDisabled && /[\[\]]/.test(parsed.pathname + parsed.search + parsed.hash)) fail("cURL URL range patterns are unsupported; use --globoff or percent-encode literal brackets.");
}
function validateHeaders(headers) {
  const seen = /* @__PURE__ */ new Set();
  for (const [name, value] of headers) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) fail("Invalid header name.");
    if (name === "__proto__") fail("The __proto__ header name is unsupported in generated object literals.");
    if (/[\r\n\0]/.test(value)) fail("Header values cannot contain carriage returns, newlines, or NUL.");
    if (seen.has(name.toLowerCase())) fail("Duplicate header names are unsupported; combine their values explicitly.");
    seen.add(name.toLowerCase());
  }
  if (headers.length > MAX_HEADERS) fail("Too many headers (limit 200).");
}
function checkStaticData(value, depth = 0, budget = { nodes: 0 }) {
  if (depth > 32 || ++budget.nodes > MAX_TOKENS) fail("Static data exceeds the 32-level or 10,000-value limit.");
  if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (Array.isArray(value)) return value.every((item) => checkStaticData(item, depth + 1, budget));
  if (value && typeof value === "object") return Object.entries(value).every(([key, item]) => key !== "__proto__" && checkStaticData(item, depth + 1, budget));
  return true;
}
function inspectJson(request) {
  if (request.body === void 0 || !request.headers.some(([name, value]) => name.toLowerCase() === "content-type" && /^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(value))) return;
  try {
    const data = JSON.parse(request.body);
    if (!checkStaticData(data)) {
      request.warnings.push("JSON with unsafe numeric precision or __proto__ keys is kept as raw text.");
      return;
    }
    if (request.headers.some(([name]) => name.toLowerCase() === "content-length")) {
      request.warnings.push("The body is kept as raw text to preserve its explicit Content-Length.");
      return;
    }
    request.jsonBody = data;
    if (JSON.stringify(data) !== request.body) request.warnings.push("The JSON body is reserialized; formatting and escape spelling may change.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    request.warnings.push("Content-Type declares JSON, but the body is not valid JSON; it is kept as raw text.");
  }
}
function tokenizeShell(source) {
  const out = [];
  let token = "";
  let quote;
  let started = false;
  const push = () => {
    if (started) {
      out.push(token);
      token = "";
      started = false;
    }
  };
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quote === "single") {
      if (ch === "'") quote = void 0;
      else token += ch;
      started = true;
      continue;
    }
    if (quote === "double") {
      if (ch === '"') {
        quote = void 0;
        started = true;
        continue;
      }
      if (ch === "$") fail("Shell variable expansion is unsupported; use literal cURL values.");
      if (ch === "`") fail("Shell substitutions and command separators are unsupported.");
      if (ch === "\\") {
        const next = source[++i];
        if (next === void 0) fail("Malformed cURL: unterminated escape.");
        if (next === "\n") continue;
        token += ['"', "\\", "$", "`"].includes(next) ? next : `\\${next}`;
      } else token += ch;
      started = true;
      continue;
    }
    if (ch === "'") {
      quote = "single";
      started = true;
      continue;
    }
    if (ch === '"') {
      quote = "double";
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      continue;
    }
    if (ch === "$") fail("Shell variable expansion is unsupported; use literal cURL values.");
    if ("`;|><&()".includes(ch)) fail("Shell substitutions, redirections, and command separators are unsupported; quote literal values.");
    if (ch === "\\") {
      const next = source[++i];
      if (next === void 0) fail("Malformed cURL: unterminated escape.");
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
function addHeader(headers, value) {
  const colon = value.indexOf(":");
  if (colon < 0 && value.endsWith(";")) {
    headers.push([value.slice(0, -1), ""]);
    validateHeaders(headers);
    return;
  }
  if (colon <= 0) fail("Invalid header: expected `Name: value`.");
  const name = value.slice(0, colon).trim();
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) fail("Invalid header name.");
  if (!value.slice(colon + 1).trim()) fail("cURL header suppression or empty headers are unsupported.");
  headers.push([name, value.slice(colon + 1).trim()]);
  if (headers.length > MAX_HEADERS) fail("Too many headers (limit 200).");
}
function parseCurl(source) {
  const tokens = tokenizeShell(source.trim());
  if (!tokens.length) fail("Enter a cURL command.");
  if (tokens[0].toLowerCase() !== "curl") fail("cURL input must start with `curl`.");
  const headers = [];
  const bodyParts = [];
  let method;
  let url;
  let basicAuth;
  let globDisabled = false;
  const warnings = [];
  let optionCount = 0;
  const need = (index, option) => {
    const value = tokens[index + 1];
    if (value === void 0) fail(`Option ${option} requires a value.`);
    return value;
  };
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith("-") && ++optionCount > MAX_OPTIONS) fail("cURL request has too many options (limit 1,000).");
    let option = token;
    let inline;
    const equals = option.indexOf("=");
    if (option.startsWith("--") && equals > 2) {
      inline = option.slice(equals + 1);
      option = option.slice(0, equals);
    }
    const take = (name) => {
      if (inline !== void 0) return inline;
      const value = need(i, name);
      i += 1;
      return value;
    };
    if ((option === "--globoff" || option === "-g") && inline === void 0) {
      globDisabled = true;
      continue;
    }
    if (option === "--url") {
      if (url !== void 0) fail("Multiple URLs are unsupported.");
      url = take(option);
      continue;
    }
    if (option === "--request") {
      method = take(option);
      continue;
    }
    if (option === "-X") {
      method = take(option);
      continue;
    }
    if (option.startsWith("-X") && option.length > 2) {
      method = option.slice(2);
      continue;
    }
    if (option === "--header") {
      addHeader(headers, take(option));
      continue;
    }
    if (option === "-H") {
      addHeader(headers, take(option));
      continue;
    }
    if (option.startsWith("-H") && option.length > 2) {
      addHeader(headers, option.slice(2));
      continue;
    }
    if (option === "--data" || option === "--data-raw" || option === "--data-binary" || option === "-d") {
      const value = take(option);
      if (option !== "--data-raw" && value.startsWith("@")) fail("cURL body file references are unsupported; provide literal data using --data-raw.");
      bodyParts.push(value);
      if (bodyParts.length > 200) fail("Too many body options (limit 200).");
      continue;
    }
    if (option.startsWith("-d") && option.length > 2) {
      if (option[2] === "@") fail("cURL body file references are unsupported; provide literal data using --data-raw.");
      bodyParts.push(option.slice(2));
      continue;
    }
    if (option === "--data-urlencode") {
      const value = take(option);
      const at = value.indexOf("@");
      if (at >= 0 && (at === 0 || value.slice(0, at).indexOf("=") < 0)) fail("--data-urlencode file references are unsupported; provide literal data.");
      const eq = value.indexOf("=");
      const encode = (text2) => encodeURIComponent(text2).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
      try {
        bodyParts.push(eq < 0 ? encode(value) : `${eq > 0 ? `${value.slice(0, eq)}=` : ""}${encode(value.slice(eq + 1))}`);
      } catch {
        fail("URL-encoded body data contains an invalid Unicode surrogate.");
      }
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
      const value = option.slice(2);
      const colon = value.indexOf(":");
      if (colon < 0) fail("Basic authentication must use the literal `username:password` form.");
      basicAuth = [value.slice(0, colon), value.slice(colon + 1)];
      continue;
    }
    if (option === "--") {
      if (tokens.length - i !== 2 || url !== void 0) fail("Expected one URL after --; multiple URLs are unsupported.");
      url = tokens[++i];
      continue;
    }
    if (option.startsWith("-")) fail(`Unsupported cURL option${/^--?[A-Za-z][A-Za-z-]{0,40}$/.test(option) ? `: ${option}` : ""}. The request was not converted.`);
    if (url) fail("Multiple URLs are unsupported.");
    url = token;
  }
  if (!url) fail("cURL request is missing a URL.");
  if (!url.trim()) fail("cURL request URL cannot be empty.");
  if (bodyParts.length > 200) fail("Too many body options (limit 200).");
  const body = bodyParts.length ? bodyParts.join("&") : void 0;
  if (method === void 0) method = body === void 0 ? "GET" : "POST";
  if (!/^[A-Za-z][A-Za-z0-9!#$%&'*+.^_`|~-]{0,31}$/.test(method)) fail("HTTP method is invalid.");
  if (body !== void 0 && !headers.some(([name]) => name.toLowerCase() === "content-type")) headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
  if (basicAuth) {
    if (headers.some(([name]) => name.toLowerCase() === "authorization")) warnings.push("The explicit Authorization header takes precedence over --user.");
    else headers.push(["Authorization", `Basic ${base64Utf8(`${basicAuth[0]}:${basicAuth[1]}`)}`]);
  }
  checkUrl(url, globDisabled);
  validateHeaders(headers);
  const request = { method, url, headers, body, warnings };
  inspectJson(request);
  return request;
}
function lexJs(source) {
  const tokens = [];
  let i = 0;
  const add = (kind, value) => {
    tokens.push({ kind, value });
    if (tokens.length > MAX_TOKENS) fail("Fetch expression has too many tokens (limit 10,000).");
  };
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") fail("Comments are unsupported in Fetch input; provide a static expression.");
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = "";
      let closed = false;
      i += 1;
      while (i < source.length) {
        const c = source[i++];
        if (c === quote) {
          closed = true;
          break;
        }
        if (c === "\\") {
          const e = source[i++];
          if (e === void 0) fail("Malformed Fetch expression: unterminated string.");
          if (e === "n") value += "\n";
          else if (e === "r") value += "\r";
          else if (e === "t") value += "	";
          else if (e === "b") value += "\b";
          else if (e === "f") value += "\f";
          else if (e === "v") value += "\v";
          else if (e === "0") {
            if (/\d/.test(source[i] ?? "")) fail("Legacy octal string escapes are unsupported.");
            value += "\0";
          } else if (e === "u") {
            if (source[i] === "{") {
              const end = source.indexOf("}", i + 1);
              const hex2 = source.slice(i + 1, end);
              if (end < 0 || !/^[0-9A-Fa-f]{1,6}$/.test(hex2) || parseInt(hex2, 16) > 1114111) fail("Malformed Fetch expression: invalid Unicode escape.");
              value += String.fromCodePoint(parseInt(hex2, 16));
              i = end + 1;
            } else {
              const hex2 = source.slice(i, i + 4);
              if (!/^[0-9A-Fa-f]{4}$/.test(hex2)) fail("Malformed Fetch expression: invalid Unicode escape.");
              value += String.fromCharCode(parseInt(hex2, 16));
              i += 4;
            }
          } else if (e === "x") {
            const hex2 = source.slice(i, i + 2);
            if (!/^[0-9A-Fa-f]{2}$/.test(hex2)) fail("Malformed Fetch expression: invalid hexadecimal escape.");
            value += String.fromCharCode(parseInt(hex2, 16));
            i += 2;
          } else if (e === "\n") {
          } else if (e === "\r") {
            if (source[i] === "\n") i += 1;
          } else if (/\d/.test(e)) fail("Legacy octal string escapes are unsupported.");
          else value += e;
        } else {
          if (c === "\n" || c === "\r") fail("Malformed Fetch expression: unescaped newline in string.");
          value += c;
        }
      }
      if (!closed) fail("Malformed Fetch expression: unterminated string.");
      add("string", value);
      continue;
    }
    if (ch === "`") fail("Fetch templates are dynamic and unsupported; use a quoted URL/string.");
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) i += 1;
      add("identifier", source.slice(start, i));
      continue;
    }
    if (/[0-9-]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[0-9.eE+-]/.test(source[i])) i += 1;
      const value = source.slice(start, i);
      if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) fail("Malformed Fetch expression: invalid number.");
      add("number", value);
      continue;
    }
    if ("{}[]():,;.".includes(ch)) {
      add("punct", ch);
      i += 1;
      continue;
    }
    fail(`Unsupported Fetch syntax at character ${i + 1}; use only static literals.`);
  }
  add("eof", "");
  return tokens;
}
var StaticJson = class {
  constructor(value) {
    this.value = value;
  }
};
var JsReader = class {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
    this.nodes = 0;
  }
  peek() {
    return this.tokens[this.index];
  }
  take(value) {
    const token = this.tokens[this.index++];
    if (value !== void 0 && token.value !== value) fail(`Malformed Fetch expression: expected '${value}'.`);
    return token;
  }
  expression(depth = 0, stringifyAllowed = true) {
    if (depth > 32 || ++this.nodes > MAX_TOKENS) fail("Static data exceeds the 32-level or 10,000-value limit.");
    const token = this.peek();
    if (token.kind === "string") {
      this.take();
      return token.value;
    }
    if (token.kind === "number") {
      this.take();
      const value = Number(token.value);
      if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) fail("Static numeric values must be finite and use safe integer precision.");
      return value;
    }
    if (token.kind === "identifier") {
      if (token.value === "true" || token.value === "false") {
        this.take();
        return token.value === "true";
      }
      if (token.value === "null") {
        this.take();
        return null;
      }
      if (token.value === "JSON" && stringifyAllowed) {
        this.take("JSON");
        this.take(".");
        this.take("stringify");
        this.take("(");
        const value = this.expression(depth + 1, false);
        this.take(")");
        return new StaticJson(value);
      }
      fail("Fetch values must be static literals or JSON.stringify(static data).");
    }
    if (token.value === "{") {
      this.take("{");
      const object = /* @__PURE__ */ Object.create(null);
      if (this.peek().value !== "}") while (true) {
        const key = this.take();
        if (key.kind !== "identifier" && key.kind !== "string") fail("Fetch object keys must be static identifiers or strings.");
        if (key.value === "__proto__") fail("__proto__ object-literal keys are unsupported; provide a static JSON string body instead.");
        if (Object.hasOwn(object, key.value)) fail("Duplicate object-literal keys are unsupported.");
        this.take(":");
        object[key.value] = this.expression(depth + 1, stringifyAllowed && depth === 0);
        if (this.peek().value === "}") break;
        this.take(",");
        if (this.peek().value === "}") break;
      }
      this.take("}");
      return object;
    }
    if (token.value === "[") {
      this.take("[");
      const array = [];
      if (this.peek().value !== "]") while (true) {
        array.push(this.expression(depth + 1, false));
        if (this.peek().value === "]") break;
        this.take(",");
        if (this.peek().value === "]") break;
      }
      this.take("]");
      return array;
    }
    fail("Fetch values must be static literals.");
  }
};
function parseFetch(source) {
  const tokens = lexJs(source.trim());
  const reader = new JsReader(tokens);
  if (reader.peek().value !== "fetch") fail("Fetch input must be a static fetch(...) call.");
  reader.take("fetch");
  reader.take("(");
  const urlToken = reader.take();
  if (urlToken.kind !== "string") fail("Fetch URL must be a static string literal.");
  const url = urlToken.value;
  let method = "GET";
  let headers = [];
  let body;
  let jsonBody;
  if (reader.peek().value === ",") {
    reader.take(",");
    if (reader.peek().value !== ")") {
      const options = reader.expression();
      if (!options || typeof options !== "object" || Array.isArray(options) || options instanceof StaticJson) fail("Fetch options must be a static object literal.");
      for (const [key, value] of Object.entries(options)) {
        if (key === "method") {
          if (typeof value !== "string") fail("Fetch method must be a static string.");
          method = /^(?:delete|get|head|options|post|put)$/i.test(value) ? value.toUpperCase() : value;
        } else if (key === "headers") {
          if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof StaticJson) fail("Fetch headers must be a static object literal.");
          headers = Object.entries(value).map(([name, headerValue]) => {
            if (typeof headerValue !== "string") fail("Fetch header values must be static strings.");
            return [name, headerValue];
          });
          if (headers.length > MAX_HEADERS) fail("Too many headers (limit 200).");
        } else if (key === "body") {
          if (typeof value === "string") body = value;
          else if (value instanceof StaticJson) {
            body = JSON.stringify(value.value);
            jsonBody = value.value;
          } else fail("Fetch body must be a static string or JSON.stringify(static data).");
        } else fail(`Unsupported Fetch option: ${key}. Use only method, headers, and body.`);
      }
      if (reader.peek().value === ",") reader.take(",");
    }
  }
  reader.take(")");
  if (reader.peek().value === ";") reader.take(";");
  if (reader.peek().kind !== "eof") fail("Malformed Fetch expression: trailing syntax is unsupported.");
  if (body !== void 0 && (method === "GET" || method === "HEAD")) fail("Fetch does not support a body with GET or HEAD; use an explicit body-capable method.");
  if (!/^[A-Za-z][A-Za-z0-9!#$%&'*+.^_`|~-]{0,31}$/.test(method)) fail("HTTP method is invalid.");
  if (/^(?:CONNECT|TRACE|TRACK)$/i.test(method)) fail("Fetch forbids CONNECT, TRACE, and TRACK methods.");
  checkUrl(url, true);
  if (body !== void 0 && /\0/.test(body)) fail("A NUL-containing Fetch body cannot be represented as a cURL argument.");
  if (body !== void 0 && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(body)) fail("Fetch body contains an invalid Unicode surrogate.");
  if (body !== void 0 && !headers.some(([name]) => name.toLowerCase() === "content-type")) headers.push(["Content-Type", "text/plain;charset=UTF-8"]);
  validateHeaders(headers);
  return { method, url, headers, body, jsonBody, warnings: [] };
}
function renderHeaders(headers, indent) {
  return headers.map(([name, value]) => `${indent}${jsonString(name)}: ${jsonString(value)}`).join(",\n");
}
function jsData(value, indent) {
  return JSON.stringify(value, null, 2).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029").split("\n").map((line, index) => index ? " ".repeat(indent) + line : line).join("\n");
}
function pythonLiteral(value) {
  if (value === null) return "None";
  if (typeof value === "string") return pyString(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : fail("JSON body contains a non-finite number.");
  if (Array.isArray(value)) return `[${value.map((item) => pythonLiteral(item)).join(", ")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).map(([key, item]) => `${pyString(key)}: ${pythonLiteral(item)}`).join(", ")}}`;
  fail("JSON body contains an unsupported value.");
}
function fetchCode(request) {
  const hasBody = request.body !== void 0;
  const lines = [`const response = await fetch(${jsonString(request.url)}${hasBody || request.headers.length || request.method !== "GET" ? ", {" : ");"}`];
  if (lines[0].endsWith(", {")) {
    lines.push(`  method: ${jsonString(request.method)},`);
    if (request.headers.length) lines.push("  headers: {", renderHeaders(request.headers, "    "), "  },");
    if (hasBody) lines.push(`  body: ${request.jsonBody !== void 0 ? `JSON.stringify(${jsData(request.jsonBody, 2)})` : jsonString(request.body ?? "")},`);
    lines.push("});");
  }
  lines.push("const data = await response.text();");
  return lines.join("\n");
}
function axiosCode(request) {
  const lines = ['import axios from "axios";', "", "const response = await axios({", `  method: ${jsonString(request.method)},`, `  url: ${jsonString(request.url)},`];
  if (request.headers.length) lines.push("  headers: {", renderHeaders(request.headers, "    "), "  },");
  if (request.body !== void 0) {
    const structured = request.jsonBody !== null && typeof request.jsonBody === "object";
    lines.push(`  data: ${structured ? jsData(request.jsonBody, 2) : jsonString(request.body)},`);
    if (!structured) lines.push("  transformRequest: [(data) => data],");
  }
  lines.push("});", "", "const data = response.data;");
  return lines.join("\n");
}
function pythonCode(request) {
  const lines = ["import requests"];
  lines.push("", "headers = {");
  for (const [name, value] of request.headers) {
    lines.push(`    ${pyString(name)}: ${pyString(value)},`);
  }
  lines.push("}", "", `response = requests.request(`, `    ${pyString(request.method)},`, `    ${pyString(request.url)},`, "    headers=headers,");
  if (request.body !== void 0) {
    lines[lines.length - 1] = request.jsonBody !== void 0 && request.jsonBody !== null ? `    headers=headers,
    json=${pythonLiteral(request.jsonBody)},` : `    headers=headers,
    data=${pyString(request.body)}.encode("utf-8"),`;
  }
  lines.push(")", "", "data = response.text");
  return lines.join("\n");
}
function curlCode(request) {
  const parts = ["curl", "--request", shellQuote(request.method)];
  if (/[{}\[\]]/.test(request.url)) parts.push("--globoff");
  for (const [name, value] of request.headers) parts.push("--header", shellQuote(value ? `${name}: ${value}` : `${name};`));
  if (request.body !== void 0) parts.push("--data-raw", shellQuote(request.body));
  parts.push(shellQuote(request.url));
  return parts.join(" ");
}
function resultFor(id, request) {
  let output;
  if (id === "curl-to-fetch") {
    if (request.body !== void 0 && /^(?:GET|HEAD)$/i.test(request.method)) fail("Fetch does not support a body with GET or HEAD; choose another conversion or a body-capable method.");
    if (/^(?:CONNECT|TRACE|TRACK)$/i.test(request.method)) fail("Fetch forbids CONNECT, TRACE, and TRACK methods.");
    output = fetchCode(request);
    if (request.headers.some(([name]) => /^(?:host|cookie|content-length|connection|origin|referer|accept-encoding)$/i.test(name))) request.warnings.push("Browser Fetch may ignore forbidden request headers; run the snippet in a compatible environment to preserve them.");
    if (/^(?:delete|get|head|options|post|put)$/i.test(request.method) && request.method !== request.method.toUpperCase()) request.warnings.push("Fetch normalizes the casing of standard HTTP methods.");
  } else if (id === "curl-to-axios") {
    output = axiosCode(request);
    if (request.method !== request.method.toUpperCase()) request.warnings.push("Axios transports may normalize HTTP method casing.");
    if (request.body !== void 0 && /^(?:GET|HEAD)$/i.test(request.method)) request.warnings.push("Browser Axios transports may omit a GET or HEAD body; use a body-capable transport.");
  } else if (id === "curl-to-python-requests") output = pythonCode(request);
  else output = curlCode(request);
  if ((id === "curl-to-fetch" || id === "curl-to-axios") && request.headers.some(([, value]) => /[^\x00-\xFF]/.test(value))) request.warnings.push("Non-Latin-1 header values may be rejected by browser header APIs.");
  output = ensureOutput(output);
  return { text: output, copyText: output, data: { method: request.method, url: request.url, headers: request.headers, body: request.body ?? null }, warnings: request.warnings };
}
async function convertApi(id, values) {
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

// lib/tools/curl-to-code.ts
function goEscapeString(str) {
  return JSON.stringify(str);
}
function generateGoHttp(req) {
  const lines = [
    "package main",
    "",
    "import (",
    '	"fmt"',
    '	"io"',
    '	"net/http"'
  ];
  if (req.body !== void 0 && req.body !== "") {
    lines.push('	"strings"');
  }
  lines.push(")", "", "func main() {", "	client := &http.Client{}", "");
  if (req.body !== void 0 && req.body !== "") {
    lines.push(`	body := strings.NewReader(${goEscapeString(req.body)})`);
    lines.push(`	req, err := http.NewRequest(${goEscapeString(req.method)}, ${goEscapeString(req.url)}, body)`);
  } else {
    lines.push(`	req, err := http.NewRequest(${goEscapeString(req.method)}, ${goEscapeString(req.url)}, nil)`);
  }
  lines.push("	if err != nil {", "		panic(err)", "	}", "");
  if (req.headers.length > 0) {
    for (const [name, val] of req.headers) {
      lines.push(`	req.Header.Set(${goEscapeString(name)}, ${goEscapeString(val)})`);
    }
    lines.push("");
  }
  lines.push(
    "	resp, err := client.Do(req)",
    "	if err != nil {",
    "		panic(err)",
    "	}",
    "	defer resp.Body.Close()",
    "",
    "	resBody, err := io.ReadAll(resp.Body)",
    "	if err != nil {",
    "		panic(err)",
    "	}",
    "",
    "	fmt.Println(string(resBody))",
    "}"
  );
  return lines.join("\n");
}
function preprocessCurlCommand(cmd) {
  let processed = cmd;
  const warnings = [];
  if (/(?:^|\s)(?:-k|--insecure)(?:\s|$)/.test(processed)) {
    warnings.push("TLS certificate verification disabled (--insecure).");
    processed = processed.replace(/(?:^|\s)(?:-k|--insecure)(?=\s|$)/g, " ");
  }
  if (/(?:^|\s)(?:-L|--location)(?:\s|$)/.test(processed)) {
    warnings.push("Follow redirects requested (--location).");
    processed = processed.replace(/(?:^|\s)(?:-L|--location)(?=\s|$)/g, " ");
  }
  if (/(?:^|\s)--compressed(?:\s|$)/.test(processed)) {
    warnings.push("Request compression requested (--compressed).");
    processed = processed.replace(/(?:^|\s)--compressed(?=\s|$)/g, " -H 'Accept-Encoding: gzip, deflate, br'");
  }
  const cookieMatch = processed.match(/(?:^|\s)(?:-b|--cookie)\s+(['"]?)([^'"\s]+)\1/);
  if (cookieMatch) {
    const cookieVal = cookieMatch[2];
    processed = processed.replace(cookieMatch[0], ` -H 'Cookie: ${cookieVal}'`);
  }
  const formMatch = processed.match(/(?:^|\s)(?:-F|--form)\s+(['"]?)([^'"]+)\1/);
  if (formMatch) {
    warnings.push("Multipart form data parsed into request body.");
    const formVal = formMatch[2];
    processed = processed.replace(formMatch[0], ` -d '${formVal}' -H 'Content-Type: multipart/form-data'`);
  }
  const unknownFlags = processed.match(/(?:^|\s)(--(?:retry|max-time|connect-timeout|retry-delay)\s+[^\s]+)/g);
  if (unknownFlags) {
    for (const flag of unknownFlags) {
      warnings.push(`Unsupported option ${flag.trim()} omitted from code generation.`);
      processed = processed.replace(flag, " ");
    }
  }
  return { processed: processed.replace(/\s+/g, " ").trim(), warnings };
}
function redactAuthTokens(code) {
  let result = code.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{8,}/g, "Bearer [REDACTED]");
  result = result.replace(/Basic\s+[a-zA-Z0-9+/=]{10,}/g, "Basic [REDACTED]");
  return result;
}
async function curlToCode(curlCommand, target = "fetch", options = { redactAuth: true }) {
  const trimmed = curlCommand.trim();
  if (!trimmed) {
    throw new Error("cURL command cannot be empty.");
  }
  const { processed, warnings: prepWarnings } = preprocessCurlCommand(trimmed);
  let generatedCode = "";
  let lang = "typescript";
  const allWarnings = [...prepWarnings];
  if (target === "go") {
    const model = parseCurl(processed);
    generatedCode = generateGoHttp(model);
    lang = "go";
    if (model.warnings) allWarnings.push(...model.warnings);
  } else {
    const mapTarget = {
      fetch: "curl-to-fetch",
      axios: "curl-to-axios",
      python: "curl-to-python-requests"
    };
    const toolId = mapTarget[target] || "curl-to-fetch";
    const result = await convertApi(toolId, { command: processed });
    generatedCode = result.text;
    lang = target === "python" ? "python" : "typescript";
    if (result.warnings) allWarnings.push(...result.warnings);
  }
  if (options.redactAuth !== false) {
    generatedCode = redactAuthTokens(generatedCode);
  }
  return {
    code: generatedCode,
    language: lang,
    target,
    warnings: allWarnings
  };
}

// lib/tools/env-audit.ts
function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  const frequencies = /* @__PURE__ */ new Map();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
function maskSecret(val) {
  if (!val) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  if (val.length <= 8) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return val.slice(0, 4) + "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + val.slice(-4);
}
function parseInputLines(content) {
  const trimmedContent = content.trim();
  if (trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmedContent);
      const entries2 = [];
      let lineNum = 1;
      for (const [key, value] of Object.entries(parsed)) {
        entries2.push({
          line: lineNum++,
          key,
          value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
          raw: `${key}: ${value}`
        });
      }
      return { entries: entries2, errors: [] };
    } catch {
    }
  }
  const lines = content.split(/\r?\n/);
  const entries = [];
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      continue;
    }
    let key = "";
    let value = "";
    const envMatch = trimmed.match(/^(?:export\s+)?([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    const yamlMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (envMatch) {
      key = envMatch[1];
      value = envMatch[2];
    } else if (yamlMatch && !trimmed.startsWith("-")) {
      key = yamlMatch[1];
      value = yamlMatch[2];
    } else {
      if (trimmed.includes("=")) {
        const potentialKey = trimmed.split("=")[0].trim();
        errors.push({
          line: i + 1,
          key: potentialKey,
          severity: "MEDIUM",
          confidence: "LOW",
          category: "SYNTAX_ISSUE",
          message: `Variable key contains invalid identifier characters: "${potentialKey}"`,
          recommendation: "Ensure environment variable names only use letters, digits, underscores, and hyphens."
        });
      }
      continue;
    }
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else {
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
    }
    entries.push({
      line: i + 1,
      key,
      value,
      raw: rawLine
    });
  }
  return { entries, errors };
}
var WEAK_PASSWORD_PATTERNS = /* @__PURE__ */ new Set([
  "password",
  "123456",
  "12345678",
  "admin",
  "secret",
  "test",
  "changeme",
  "root",
  "qwerty"
]);
function auditEnv(envContent, exampleOrOptions) {
  const safeContent = envContent.length > 5e5 ? envContent.slice(0, 5e5) : envContent;
  let exampleContent;
  let filePath;
  let ignoreRules = [];
  if (typeof exampleOrOptions === "string") {
    exampleContent = exampleOrOptions;
  } else if (exampleOrOptions) {
    exampleContent = exampleOrOptions.example;
    filePath = exampleOrOptions.filePath;
    ignoreRules = exampleOrOptions.ignoreRules || [];
  }
  const { entries, errors } = parseInputLines(safeContent);
  const findings = errors.map((e) => ({ ...e, filePath }));
  const seenKeys = /* @__PURE__ */ new Map();
  const isIgnored = (key) => {
    return ignoreRules.some((rule) => {
      if (rule.endsWith("*")) {
        return key.startsWith(rule.slice(0, -1));
      }
      return key === rule;
    });
  };
  for (const entry of entries) {
    const { line, key, value } = entry;
    if (isIgnored(key)) {
      continue;
    }
    if (seenKeys.has(key)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "DUPLICATE_KEY",
        message: `Duplicate key "${key}" already defined at line ${seenKeys.get(key)}`,
        recommendation: "Remove duplicate definitions; the later entry will silently overwrite earlier ones."
      });
    } else {
      seenKeys.set(key, line);
    }
    if (value.trim() === "") {
      findings.push({
        filePath,
        line,
        key,
        severity: "INFO",
        confidence: "HIGH",
        category: "EMPTY_VALUE",
        message: `Variable "${key}" has an empty value`,
        recommendation: "Provide a default or populate the required configuration value."
      });
      continue;
    }
    if (/-----BEGIN\s+[A-Z\s]+KEY-----/i.test(value) || /-----BEGIN\s+PRIVATE\s+KEY-----/i.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Asymmetric Private Key detected in "${key}"`,
        recommendation: "Store private keys in a secure key vault or file, never unencrypted in configuration files.",
        maskedValue: "\u2022\u2022\u2022\u2022\u2022[PRIVATE KEY]\u2022\u2022\u2022\u2022\u2022"
      });
    }
    if (/(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Live AWS Access Key detected in "${key}"`,
        recommendation: "Revoke key in AWS IAM immediately and use AWS Secrets Manager or IAM roles.",
        maskedValue: maskSecret(value)
      });
    }
    if (/(?:sk|rk)_live_[0-9a-zA-Z]{24,}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Live Stripe Secret Key detected in "${key}"`,
        recommendation: "Roll this key in the Stripe dashboard. Never commit live secret keys to version control.",
        maskedValue: maskSecret(value)
      });
    }
    if (/gh[pousr]_[0-9a-zA-Z]{36}/.test(value) || /github_pat_[0-9a-zA-Z_]{82}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "CRITICAL",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `GitHub Personal Access Token detected in "${key}"`,
        recommendation: "Revoke token under GitHub Settings > Developer settings > Personal access tokens.",
        maskedValue: maskSecret(value)
      });
    }
    if (/^(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@[^\s]+/i.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Database connection string containing embedded credentials detected in "${key}"`,
        recommendation: "Use environment variables for user/password separately or store connection strings in a secure secret manager.",
        maskedValue: maskSecret(value)
      });
    }
    if (/sk-(?:proj-|live-)?[a-zA-Z0-9_-]{32,}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `OpenAI API Key detected in "${key}"`,
        recommendation: "Rotate this key in OpenAI platform dashboard.",
        maskedValue: maskSecret(value)
      });
    }
    if (/sk-ant-[a-zA-Z0-9_-]{32,}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Anthropic API Key detected in "${key}"`,
        recommendation: "Rotate this key in Anthropic Console.",
        maskedValue: maskSecret(value)
      });
    }
    if (/xox[baprs]-[0-9a-zA-Z]{10,48}/.test(value)) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "SECRET_LEAK",
        message: `Slack Token detected in "${key}"`,
        recommendation: "Rotate token in Slack API app settings.",
        maskedValue: maskSecret(value)
      });
    }
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes("pass") || lowerKey.includes("pwd") || lowerKey.includes("secret")) && WEAK_PASSWORD_PATTERNS.has(value.toLowerCase())) {
      findings.push({
        filePath,
        line,
        key,
        severity: "HIGH",
        confidence: "HIGH",
        category: "WEAK_VALUE",
        message: `Weak / default value detected for "${key}": "${value}"`,
        recommendation: "Generate a cryptographically random secret with at least 32 characters."
      });
    }
    if (value.length >= 24 && !value.includes("/") && !value.includes(" ") && calculateEntropy(value) > 4.5 && !findings.some((f) => f.line === line && f.category === "SECRET_LEAK")) {
      findings.push({
        filePath,
        line,
        key,
        severity: "MEDIUM",
        confidence: "MEDIUM",
        category: "HIGH_ENTROPY",
        message: `High-entropy random token detected in "${key}"`,
        recommendation: "Verify whether this is a sensitive API key or token that should be stored in a secret manager.",
        maskedValue: maskSecret(value)
      });
    }
  }
  if (exampleContent) {
    const { entries: exampleEntries } = parseInputLines(exampleContent);
    const exampleKeyMap = /* @__PURE__ */ new Map();
    for (const e of exampleEntries) {
      exampleKeyMap.set(e.key, e.line);
    }
    for (const [eKey] of exampleKeyMap) {
      if (!seenKeys.has(eKey)) {
        findings.push({
          filePath,
          key: eKey,
          severity: "HIGH",
          confidence: "HIGH",
          category: "MISSING_VAR",
          message: `Variable "${eKey}" documented in .env.example is missing from your environment`,
          recommendation: `Add "${eKey}" to your .env file or local environment.`
        });
      }
    }
    for (const [aKey, aLine] of seenKeys) {
      if (!exampleKeyMap.has(aKey) && !isIgnored(aKey)) {
        findings.push({
          filePath,
          line: aLine,
          key: aKey,
          severity: "LOW",
          confidence: "MEDIUM",
          category: "EXTRA_VAR",
          message: `Variable "${aKey}" exists in environment but is not documented in .env.example`,
          recommendation: `Document "${aKey}" in .env.example with an empty or placeholder value.`
        });
      }
    }
  }
  const stats = {
    critical: findings.filter((f) => f.severity === "CRITICAL").length,
    high: findings.filter((f) => f.severity === "HIGH").length,
    medium: findings.filter((f) => f.severity === "MEDIUM").length,
    low: findings.filter((f) => f.severity === "LOW").length,
    info: findings.filter((f) => f.severity === "INFO").length
  };
  const isSecure = stats.critical === 0 && stats.high === 0;
  let summary = "";
  if (findings.length === 0) {
    summary = "No environment or secret leak issues detected. Environment is clean.";
  } else if (isSecure) {
    summary = `Environment audit passed with ${findings.length} minor notice${findings.length === 1 ? "" : "s"} (${stats.medium} medium, ${stats.low} low, ${stats.info} info).`;
  } else {
    summary = `Security Alert: Found ${stats.critical} critical and ${stats.high} high severity finding${stats.critical + stats.high === 1 ? "" : "s"} that require remediation.`;
  }
  return {
    filePath,
    totalVariables: seenKeys.size,
    findings,
    stats,
    isSecure,
    summary
  };
}
function formatEnvAuditReport(result) {
  const lines = [];
  lines.push("\n=== CODE STATION ENVIRONMENT AUDIT REPORT ===");
  if (result.filePath) {
    lines.push(`File:            ${result.filePath}`);
  }
  lines.push(`Total Variables: ${result.totalVariables}`);
  lines.push(`Security Status: ${result.isSecure ? "PASS (Secure)" : "FAIL (Action Required)"}`);
  lines.push(
    `Breakdown:       ${result.stats.critical} Critical, ${result.stats.high} High, ${result.stats.medium} Medium, ${result.stats.low} Low, ${result.stats.info} Info
`
  );
  if (result.findings.length === 0) {
    lines.push("\u2713 No leaked secrets or environment discrepancies found.\n");
    return lines.join("\n");
  }
  for (const f of result.findings) {
    const loc = f.line ? ` (Line ${f.line})` : "";
    const masked = f.maskedValue ? ` [Value: ${f.maskedValue}]` : "";
    lines.push(`[${f.severity}] ${f.key}${loc}: ${f.message}${masked}`);
    lines.push(`  \u2192 Recommendation: ${f.recommendation}
`);
  }
  return lines.join("\n");
}

// lib/tools/mock-data.ts
var Prng = class {
  constructor(seed) {
    this.state = seed !== void 0 ? seed >>> 0 || 1 : Math.floor(Math.random() * 2147483647) || 1;
  }
  next() {
    this.state = this.state * 16807 % 2147483647;
    return (this.state - 1) / 2147483646;
  }
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }
  uuid() {
    const hex2 = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        s += "-";
      } else if (i === 14) {
        s += "4";
      } else if (i === 19) {
        s += hex2[Math.floor(this.next() * 4) + 8];
      } else {
        s += hex2[Math.floor(this.next() * 16)];
      }
    }
    return s;
  }
};
var FIRST_NAMES = [
  "Ada",
  "Alan",
  "Linus",
  "Grace",
  "Tim",
  "Margaret",
  "Donald",
  "Barbara",
  "Guido",
  "Ken",
  "Dennis",
  "Bjarne",
  "James",
  "Brendan",
  "Sophie",
  "Leslie",
  "Edsger",
  "Claude",
  "Radia",
  "Katherine"
];
var LAST_NAMES = [
  "Lovelace",
  "Turing",
  "Torvalds",
  "Hopper",
  "Berners-Lee",
  "Hamilton",
  "Knuth",
  "Liskov",
  "van Rossum",
  "Thompson",
  "Ritchie",
  "Stroustrup",
  "Gosling",
  "Eich",
  "Wilson",
  "Lamport",
  "Dijkstra",
  "Shannon",
  "Perlman",
  "Johnson"
];
var DOMAINS = ["example.com", "codestation.in", "acme.dev", "testmail.org", "infra.net"];
var CITIES = ["San Francisco", "London", "Bengaluru", "Berlin", "Tokyo", "Seattle", "Toronto", "Sydney", "Singapore", "Amsterdam"];
var COUNTRIES = ["United States", "United Kingdom", "India", "Germany", "Japan", "Canada", "Australia", "Singapore", "Netherlands", "France"];
var PRODUCT_PREFIXES = ["Pro", "Cloud", "Hyper", "Ultra", "Tactile", "Quantum", "Nexus", "Dev", "Micro", "Turbo"];
var CATEGORIES = ["Developer Tools", "Cloud Services", "Security & Auth", "Database", "Networking", "Analytics"];
var ROLES = ["admin", "developer", "maintainer", "viewer", "operator"];
var STATUSES = ["active", "pending", "suspended", "archived"];
var ORDER_STATUSES = ["completed", "processing", "shipped", "refunded"];
var PAYMENT_METHODS = ["card", "upi", "netbanking", "wire"];
function inferTypeFromName(name) {
  const lower = name.toLowerCase();
  if (lower === "id" || lower.endsWith("_id") || lower.endsWith("id")) return "uuid";
  if (lower.includes("email")) return "email";
  if (lower.includes("first_name") || lower.includes("firstname")) return "firstName";
  if (lower.includes("last_name") || lower.includes("lastname")) return "lastName";
  if (lower.includes("name")) return "name";
  if (lower.includes("price") || lower.includes("amount") || lower.includes("total") || lower.includes("salary")) return "price";
  if (lower.includes("count") || lower.includes("age") || lower.includes("qty") || lower.includes("number")) return "number";
  if (lower.startsWith("is_") || lower.startsWith("has_") || lower.includes("active") || lower.includes("enabled")) return "boolean";
  if (lower.includes("date") || lower.includes("created_at") || lower.includes("updated_at") || lower.includes("time")) return "date";
  if (lower.includes("status")) return "status";
  if (lower.includes("role")) return "role";
  if (lower.includes("city")) return "city";
  if (lower.includes("country")) return "country";
  if (lower.includes("sku") || lower.includes("code")) return "sku";
  if (lower.includes("phone")) return "phone";
  return "name";
}
function parseJsonSchema(schemaInput) {
  let schema;
  if (typeof schemaInput === "string") {
    try {
      schema = JSON.parse(schemaInput);
    } catch {
      throw new Error("Invalid JSON schema: Malformed JSON string.");
    }
  } else {
    schema = schemaInput;
  }
  if (!schema || typeof schema !== "object") {
    throw new Error("Invalid JSON schema: Schema must be an object.");
  }
  const tableName = schema.title || "records";
  const properties = schema.properties || {};
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const columns = [];
  for (const [propName, propDef] of Object.entries(properties)) {
    if (!propDef || typeof propDef !== "object") continue;
    let type = "name";
    if (propDef.enum && Array.isArray(propDef.enum)) {
      type = "status";
    } else if (propDef.type === "integer" || propDef.type === "number") {
      type = propDef.format === "price" || propName.toLowerCase().includes("price") ? "price" : "number";
    } else if (propDef.type === "boolean") {
      type = "boolean";
    } else if (propDef.format === "date-time" || propDef.format === "date") {
      type = "date";
    } else if (propDef.format === "uuid") {
      type = "uuid";
    } else if (propDef.format === "email") {
      type = "email";
    } else {
      type = inferTypeFromName(propName);
    }
    columns.push({
      name: propName,
      type,
      nullable: !required.has(propName),
      enum: propDef.enum && Array.isArray(propDef.enum) ? propDef.enum : void 0,
      defaultValue: propDef.default,
      unique: propName.toLowerCase() === "id" || propDef.unique === true
    });
  }
  if (columns.length === 0) {
    throw new Error("Invalid JSON schema: No properties found in schema definition.");
  }
  return { name: tableName, columns };
}
function parseSqlDdl(ddl) {
  const trimmed = ddl.trim();
  const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?\s*\(([\s\S]+)\)/i);
  if (!match) {
    throw new Error("Invalid SQL DDL: Expected `CREATE TABLE table_name (...)` statement.");
  }
  const tableName = match[1];
  const body = match[2];
  const lines = body.split(",\n").map((l) => l.trim()).filter(Boolean);
  const columns = [];
  for (const line of lines) {
    if (/^(?:PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|INDEX)\b/i.test(line)) {
      continue;
    }
    const colMatch = line.match(/^["`]?([A-Za-z0-9_]+)["`]?\s+([A-Za-z0-9_()]+)(.*)$/);
    if (!colMatch) continue;
    const colName = colMatch[1];
    const rawType = colMatch[2].toUpperCase();
    const rest = colMatch[3].toUpperCase();
    const notNull = rest.includes("NOT NULL") || rest.includes("PRIMARY KEY");
    const unique = rest.includes("UNIQUE") || rest.includes("PRIMARY KEY");
    let type = "name";
    if (rawType.includes("UUID")) type = "uuid";
    else if (rawType.includes("INT") || rawType.includes("SERIAL")) type = "number";
    else if (rawType.includes("NUMERIC") || rawType.includes("DECIMAL") || rawType.includes("FLOAT") || rawType.includes("DOUBLE")) type = "price";
    else if (rawType.includes("BOOL")) type = "boolean";
    else if (rawType.includes("DATE") || rawType.includes("TIME")) type = "date";
    else type = inferTypeFromName(colName);
    columns.push({
      name: colName,
      type,
      nullable: !notNull,
      unique
    });
  }
  if (columns.length === 0) {
    throw new Error("Invalid SQL DDL: No valid column definitions parsed.");
  }
  return { name: tableName, columns };
}
function parseCsvHeaders(headerLine) {
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (headers.length === 0) {
    throw new Error("Invalid CSV header input: At least one column header is required.");
  }
  const columns = headers.map((h) => ({
    name: h,
    type: inferTypeFromName(h),
    unique: h.toLowerCase() === "id",
    nullable: false
  }));
  return { name: "dataset", columns };
}
function generateValue(col, prng, rowIndex, usedUnique, context) {
  if (col.nullable && rowIndex > 1 && prng.next() < 0.1) {
    return null;
  }
  if (col.defaultValue !== void 0 && prng.next() < 0.15) {
    return col.defaultValue;
  }
  if (col.enum && col.enum.length > 0) {
    return prng.pick(col.enum);
  }
  let val;
  let attempts = 0;
  do {
    switch (col.type) {
      case "uuid":
        val = prng.uuid();
        break;
      case "firstName":
        val = prng.pick(FIRST_NAMES);
        break;
      case "lastName":
        val = prng.pick(LAST_NAMES);
        break;
      case "name": {
        const f = prng.pick(FIRST_NAMES);
        const l = prng.pick(LAST_NAMES);
        val = `${f} ${l}`;
        break;
      }
      case "email": {
        const f = (context.first_name || context.firstName || prng.pick(FIRST_NAMES)).toLowerCase();
        const l = (context.last_name || context.lastName || prng.pick(LAST_NAMES)).toLowerCase();
        const num = col.unique ? rowIndex + 1 : prng.int(10, 99);
        val = `${f}.${l}${num}@${prng.pick(DOMAINS)}`;
        break;
      }
      case "number":
        val = col.unique ? rowIndex + 1 : prng.int(1, 1e3);
        break;
      case "price":
        val = parseFloat((prng.int(10, 500) + prng.int(0, 99) / 100).toFixed(2));
        break;
      case "boolean":
        val = prng.next() > 0.5;
        break;
      case "date": {
        const pastDays = prng.int(1, 180);
        const d = new Date(Date.now() - pastDays * 864e5);
        val = d.toISOString();
        break;
      }
      case "status":
        val = prng.pick(STATUSES);
        break;
      case "role":
        val = prng.pick(ROLES);
        break;
      case "city":
        val = prng.pick(CITIES);
        break;
      case "country":
        val = prng.pick(COUNTRIES);
        break;
      case "sku":
        val = `${prng.pick(PRODUCT_PREFIXES).toUpperCase().slice(0, 3)}-${col.unique ? 1e3 + rowIndex : prng.int(1e3, 9999)}`;
        break;
      case "phone":
        val = `+1-555-${prng.int(100, 999)}-${1e3 + rowIndex}`;
        break;
      default:
        val = "mock_value";
    }
    attempts++;
  } while (col.unique && usedUnique.has(`${col.name}:${val}`) && attempts < 10);
  if (col.unique) {
    usedUnique.add(`${col.name}:${val}`);
  }
  return val;
}
function escapeSqlValue(val, dialect = "postgresql") {
  if (val === null || val === void 0) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") {
    if (dialect === "mysql") return val ? "1" : "0";
    return val ? "TRUE" : "FALSE";
  }
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}
function quoteIdentifier(id, dialect = "postgresql") {
  if (dialect === "mysql") return `\`${id}\``;
  if (dialect === "postgresql") return `"${id}"`;
  return id;
}
function recordsToCsv(records) {
  if (records.length === 0) return "";
  const columns = Object.keys(records[0]);
  const header = columns.join(",");
  const rows = records.map(
    (r) => columns.map((c) => {
      const val = r[c];
      if (val === null || val === void 0) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}
function generateMockDataset(options = {}) {
  const {
    template = "users",
    count = 10,
    format = "json",
    tableName = template,
    dialect = "postgresql",
    customSchema,
    jsonSchema,
    sqlDdl,
    csvHeaders,
    seed
  } = options;
  if (count < 1 || count > 5e3) {
    throw new Error(`Requested row count out of bounds (${count}). Must be between 1 and 5000.`);
  }
  let schema;
  if (jsonSchema) {
    schema = parseJsonSchema(jsonSchema);
  } else if (sqlDdl) {
    schema = parseSqlDdl(sqlDdl);
  } else if (csvHeaders) {
    schema = parseCsvHeaders(csvHeaders);
  } else if (template === "custom" && customSchema) {
    schema = {
      name: tableName,
      columns: Object.entries(customSchema).map(([col, type]) => ({
        name: col,
        type,
        unique: col.toLowerCase() === "id"
      }))
    };
  } else if (template === "products") {
    schema = {
      name: tableName === "products" ? "products" : tableName,
      columns: [
        { name: "id", type: "uuid", unique: true },
        { name: "sku", type: "sku", unique: true },
        { name: "title", type: "name" },
        { name: "category", type: "status", enum: CATEGORIES },
        { name: "price", type: "price" },
        { name: "stock", type: "number" },
        { name: "in_stock", type: "boolean" }
      ]
    };
  } else if (template === "orders") {
    schema = {
      name: tableName === "orders" ? "orders" : tableName,
      columns: [
        { name: "id", type: "uuid", unique: true },
        { name: "order_number", type: "sku", unique: true },
        { name: "customer_email", type: "email" },
        { name: "total", type: "price" },
        { name: "status", type: "status", enum: ORDER_STATUSES },
        { name: "payment_method", type: "status", enum: PAYMENT_METHODS },
        { name: "items_count", type: "number" },
        { name: "created_at", type: "date" }
      ]
    };
  } else {
    schema = {
      name: tableName === "users" ? "users" : tableName,
      columns: [
        { name: "id", type: "uuid", unique: true },
        { name: "first_name", type: "firstName" },
        { name: "last_name", type: "lastName" },
        { name: "name", type: "name" },
        { name: "email", type: "email", unique: true },
        { name: "role", type: "role", enum: ROLES },
        { name: "status", type: "status", enum: STATUSES },
        { name: "created_at", type: "date" }
      ]
    };
  }
  const prng = new Prng(seed);
  const usedUnique = /* @__PURE__ */ new Set();
  const records = [];
  for (let i = 0; i < count; i++) {
    const row = {};
    for (const col of schema.columns) {
      row[col.name] = generateValue(col, prng, i, usedUnique, row);
    }
    records.push(row);
  }
  const jsonStr = JSON.stringify(records, null, 2);
  const csvStr = recordsToCsv(records);
  let sqlStr;
  if (format === "sql" || options.tableName || sqlDdl) {
    const effectiveTable = schema.name || tableName;
    const columns = schema.columns.map((c) => c.name);
    const colList = columns.map((c) => quoteIdentifier(c, dialect)).join(", ");
    const valueRows = records.map((r) => {
      const rowVals = columns.map((c) => escapeSqlValue(r[c], dialect)).join(", ");
      return `  (${rowVals})`;
    });
    sqlStr = `INSERT INTO ${quoteIdentifier(effectiveTable, dialect)} (${colList})
VALUES
${valueRows.join(",\n")};`;
  }
  return {
    data: records,
    json: jsonStr,
    sql: sqlStr,
    csv: csvStr,
    count: records.length
  };
}

// lib/tools/git-conflict.ts
function parseAndResolveGitConflicts(content, strategy = "analyze") {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const hunks = [];
  let inConflict = false;
  let inBase = false;
  let inTheirs = false;
  let currentHunkStart = 0;
  let currentOursBranch = "";
  let currentTheirsBranch = "";
  let currentOursLines = [];
  let currentBaseLines = [];
  let currentTheirsLines = [];
  const outputLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("<<<<<<<")) {
      if (inConflict) {
        throw new Error(`Malformed Git conflict: Nested <<<<<<< marker at line ${i + 1}`);
      }
      inConflict = true;
      inBase = false;
      inTheirs = false;
      currentHunkStart = i + 1;
      currentOursBranch = line.slice(7).trim() || "HEAD";
      currentOursLines = [];
      currentBaseLines = [];
      currentTheirsLines = [];
      continue;
    }
    if (inConflict && !inTheirs && line.startsWith("|||||||")) {
      inBase = true;
      continue;
    }
    if (inConflict && !inTheirs && line.startsWith("=======")) {
      inBase = false;
      inTheirs = true;
      continue;
    }
    if (!inConflict && (line.startsWith("=======") || line.startsWith(">>>>>>>") || line.startsWith("|||||||"))) {
      throw new Error(`Malformed Git conflict: Unexpected ${line.slice(0, 7)} marker outside of conflict block at line ${i + 1}`);
    }
    if (inConflict && inTheirs && line.startsWith(">>>>>>>")) {
      currentTheirsBranch = line.slice(7).trim() || "incoming";
      const hunk = {
        hunkIndex: hunks.length + 1,
        startLine: currentHunkStart,
        endLine: i + 1,
        oursBranch: currentOursBranch,
        theirsBranch: currentTheirsBranch,
        oursLines: currentOursLines,
        theirsLines: currentTheirsLines,
        ...currentBaseLines.length > 0 ? { baseLines: currentBaseLines } : {}
      };
      hunks.push(hunk);
      if (strategy === "ours") {
        outputLines.push(...currentOursLines);
      } else if (strategy === "theirs") {
        outputLines.push(...currentTheirsLines);
      } else if (strategy === "both") {
        outputLines.push(...currentOursLines);
        outputLines.push(...currentTheirsLines);
      }
      inConflict = false;
      inBase = false;
      inTheirs = false;
      continue;
    }
    if (inConflict) {
      if (inTheirs) {
        currentTheirsLines.push(line);
      } else if (inBase) {
        currentBaseLines.push(line);
      } else {
        currentOursLines.push(line);
      }
    } else {
      outputLines.push(line);
    }
  }
  if (inConflict) {
    throw new Error(`Malformed Git conflict: Unclosed conflict marker starting at line ${currentHunkStart}`);
  }
  const hasConflicts = hunks.length > 0;
  const unresolvedCount = strategy === "analyze" ? hunks.length : 0;
  const resolvedContent = strategy !== "analyze" ? outputLines.join("\n") : void 0;
  let summary = "";
  if (!hasConflicts) {
    summary = "No merge conflict markers detected in input.";
  } else if (strategy === "analyze") {
    summary = `Found ${hunks.length} conflict hunk${hunks.length === 1 ? "" : "s"} (${unresolvedCount} unresolved). Inspect branches and choose a resolution strategy (ours, theirs, or both).`;
  } else {
    summary = `Successfully resolved ${hunks.length} conflict hunk${hunks.length === 1 ? "" : "s"} using "${strategy}" strategy. 0 conflicts remaining.`;
  }
  return {
    hasConflicts,
    conflictCount: hunks.length,
    unresolvedCount,
    hunks,
    resolvedContent,
    summary
  };
}
function formatConflictReport(result) {
  const lines = [];
  lines.push("\n=== CODE STATION GIT CONFLICT RESOLVER ===");
  lines.push(`Total Conflicts: ${result.conflictCount}`);
  lines.push(`Unresolved:      ${result.unresolvedCount}`);
  lines.push(`Status:          ${result.summary}
`);
  if (!result.hasConflicts) {
    return lines.join("\n");
  }
  for (const hunk of result.hunks) {
    lines.push(`[Hunk #${hunk.hunkIndex}] Lines ${hunk.startLine} to ${hunk.endLine}`);
    lines.push(`  Ours (${hunk.oursBranch}):    ${hunk.oursLines.length} lines`);
    lines.push(`  Theirs (${hunk.theirsBranch}): ${hunk.theirsLines.length} lines`);
    if (hunk.baseLines) {
      lines.push(`  Base (diff3):         ${hunk.baseLines.length} lines`);
    }
    lines.push("  Preview Ours:");
    for (const l of hunk.oursLines.slice(0, 3)) {
      lines.push(`    | ${l}`);
    }
    if (hunk.oursLines.length > 3) lines.push(`    | ... (+${hunk.oursLines.length - 3} more lines)`);
    lines.push("  Preview Theirs:");
    for (const l of hunk.theirsLines.slice(0, 3)) {
      lines.push(`    | ${l}`);
    }
    if (hunk.theirsLines.length > 3) lines.push(`    | ... (+${hunk.theirsLines.length - 3} more lines)`);
    lines.push("");
  }
  return lines.join("\n");
}

// lib/tools/index.ts
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// lib/tools/encoding-station.ts
function utf8(value) {
  return new TextEncoder().encode(value);
}
function text(bytes2) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes2);
}
function encodeBase64Url(value) {
  const bytes2 = utf8(value);
  let binary = "";
  for (const byte of bytes2) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("Invalid Base64URL input.");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(padded);
    return text(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    throw new Error("Base64URL input is not valid Base64 or UTF-8 text.");
  }
}
var encodeUrlComponent = encodeURIComponent;
function decodeUrlComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("URL component contains invalid percent escapes.");
  }
}
function encodeHexadecimal(value) {
  return Array.from(utf8(value), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}
function decodeHexadecimal(value) {
  const clean = value.replace(/[\s:-]/g, "");
  if (!/^(?:[\da-f]{2})+$/i.test(clean)) throw new Error("Use hexadecimal byte pairs such as 48 65 6c 6c 6f.");
  try {
    return text(Uint8Array.from(clean.match(/../g), (byte) => parseInt(byte, 16)));
  } catch {
    throw new Error("Hexadecimal input is not valid UTF-8 text.");
  }
}

// lib/tools/index.ts
function formatJson(value, indent = 2) {
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) {
    throw new RangeError("indent must be an integer between 0 and 10");
  }
  return JSON.stringify(JSON.parse(value), null, indent);
}
function minifyJson(value) {
  return JSON.stringify(JSON.parse(value));
}
function jsonToYaml(value) {
  return stringifyYaml(JSON.parse(value));
}
function yamlToJson(value) {
  return JSON.stringify(parseYaml(value), null, 2);
}
function generateJsonSchema(value) {
  const sample = JSON.parse(value);
  const infer = (node) => {
    if (node === null) return { type: "null" };
    if (Array.isArray(node)) return { type: "array", items: node.length ? infer(node[0]) : {} };
    if (typeof node === "object") {
      const properties = Object.fromEntries(Object.entries(node).map(([key, child]) => [key, infer(child)]));
      return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
    }
    return { type: typeof node === "number" && Number.isInteger(node) ? "integer" : typeof node };
  };
  return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...infer(sample) }, null, 2);
}
function decodeBase64Url2(value) {
  return decodeBase64(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
}
function decodeJwt(value) {
  const parts = value.trim().split(".");
  if (parts.length !== 3) throw new Error("A JWT must contain three dot-separated sections.");
  try {
    return JSON.stringify({ header: JSON.parse(decodeBase64Url2(parts[0])), payload: JSON.parse(decodeBase64Url2(parts[1])), signature: parts[2], note: "Decoded for inspection only. Signature validity was not verified." }, null, 2);
  } catch {
    throw new Error("JWT header and payload must contain valid Base64URL-encoded JSON.");
  }
}
function testRegex(pattern, flags, text2) {
  let regex;
  try {
    regex = new RegExp(pattern, flags);
  } catch (cause) {
    throw new Error(cause instanceof Error ? cause.message : "Invalid regular expression.");
  }
  const matches = [];
  if (!regex.global) {
    const match = regex.exec(text2);
    if (match) matches.push({ match: match[0], index: match.index, groups: match.groups ?? {}, captures: match.slice(1) });
  } else {
    let match;
    while ((match = regex.exec(text2)) !== null) {
      matches.push({ match: match[0], index: match.index, groups: match.groups ?? {}, captures: match.slice(1) });
      if (match[0] === "") regex.lastIndex += 1;
    }
  }
  return JSON.stringify({ count: matches.length, matches }, null, 2);
}
function utf8Decode(bytes2) {
  let result = "";
  for (let i = 0; i < bytes2.length; ) {
    const first = bytes2[i++];
    let code;
    if (first < 128) code = first;
    else if (first >= 194 && first <= 223 && i < bytes2.length) code = (first & 31) << 6 | bytes2[i++] & 63;
    else if (first >= 224 && first <= 239 && i + 1 < bytes2.length) code = (first & 15) << 12 | (bytes2[i++] & 63) << 6 | bytes2[i++] & 63;
    else if (first >= 240 && first <= 244 && i + 2 < bytes2.length) code = (first & 7) << 18 | (bytes2[i++] & 63) << 12 | (bytes2[i++] & 63) << 6 | bytes2[i++] & 63;
    else throw new Error("Invalid UTF-8 data");
    if (code <= 65535) result += String.fromCharCode(code);
    else {
      const n = code - 65536;
      result += String.fromCharCode(55296 | n >> 10, 56320 | n & 1023);
    }
  }
  return result;
}
var BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeBase64(value) {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Invalid Base64 string");
  const bytes2 = [];
  for (let i = 0; i < value.length; i += 4) {
    const a = BASE64.indexOf(value[i]);
    const b = BASE64.indexOf(value[i + 1]);
    const c = value[i + 2] === "=" ? 0 : BASE64.indexOf(value[i + 2]);
    const d = value[i + 3] === "=" ? 0 : BASE64.indexOf(value[i + 3]);
    bytes2.push(a << 2 | b >> 4);
    if (value[i + 2] !== "=") bytes2.push((b & 15) << 4 | c >> 2);
    if (value[i + 3] !== "=") bytes2.push((c & 3) << 6 | d);
  }
  return utf8Decode(bytes2);
}

// lib/tools/security-station.ts
var encoder = () => new TextEncoder();
function bytes(input) {
  return typeof input === "string" ? encoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
}
function webBytes(input) {
  return bytes(input).slice().buffer;
}
function hex(input) {
  return Array.from(input, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function requireCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable in this environment.");
  return globalThis.crypto;
}
function words(input) {
  const length = input.length + 9 + 63 >> 6 << 4;
  const out = new Array(length).fill(0);
  input.forEach((byte, index) => {
    out[index >> 2] |= byte << (index & 3) * 8;
  });
  out[input.length >> 2] |= 128 << (input.length & 3) * 8;
  const bitLength = input.length * 8;
  out[length - 2] = bitLength & 4294967295;
  out[length - 1] = Math.floor(bitLength / 4294967296);
  return out;
}
function rotl(value, count) {
  return value << count | value >>> 32 - count;
}
function littleHex(value) {
  return [0, 8, 16, 24].map((shift) => (value >>> shift & 255).toString(16).padStart(2, "0")).join("");
}
function md5(input) {
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  let a = 1732584193, b = 4023233417, c = 2562383102, d = 271733878;
  const m = words(bytes(input));
  for (let offset = 0; offset < m.length; offset += 16) {
    let aa = a, bb = b, cc = c, dd = d;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) {
        f = bb & cc | ~bb & dd;
        g = i;
      } else if (i < 32) {
        f = dd & bb | ~dd & cc;
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = bb ^ cc ^ dd;
        g = (3 * i + 5) % 16;
      } else {
        f = cc ^ (bb | ~dd);
        g = 7 * i % 16;
      }
      const next = dd;
      dd = cc;
      cc = bb;
      bb = bb + rotl(aa + f + k[i] + m[offset + g] | 0, s[i]) | 0;
      aa = next;
    }
    a = a + aa | 0;
    b = b + bb | 0;
    c = c + cc | 0;
    d = d + dd | 0;
  }
  return littleHex(a) + littleHex(b) + littleHex(c) + littleHex(d);
}
function sha1(input) {
  const source = bytes(input);
  const padded = new Uint8Array(source.length + 9 + 63 >> 6 << 6);
  padded.set(source);
  padded[source.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, source.length * 8);
  let h0 = 1732584193, h1 = 4023233417, h2 = 2562383102, h3 = 271733878, h4 = 3285377520;
  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Uint32Array(80);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1) >>> 0;
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? b & c | ~b & d : i < 40 ? b ^ c ^ d : i < 60 ? b & c | b & d | c & d : b ^ c ^ d;
      const t = rotl(a, 5) + f + e + w[i] + (i < 20 ? 1518500249 : i < 40 ? 1859775393 : i < 60 ? 2400959708 : 3395469782) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    h0 = h0 + a | 0;
    h1 = h1 + b | 0;
    h2 = h2 + c | 0;
    h3 = h3 + d | 0;
    h4 = h4 + e | 0;
  }
  return [h0, h1, h2, h3, h4].map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}
async function hash(input, algorithm = "SHA-256") {
  const result = await requireCrypto().subtle.digest(algorithm, webBytes(input));
  return hex(new Uint8Array(result));
}
var sha256 = (input) => hash(input, "SHA-256");
var sha384 = (input) => hash(input, "SHA-384");
var sha512 = (input) => hash(input, "SHA-512");
async function hmac(input, secret, algorithm = "SHA-256") {
  const crypto2 = requireCrypto();
  const key = await crypto2.subtle.importKey("raw", webBytes(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]);
  return hex(new Uint8Array(await crypto2.subtle.sign("HMAC", key, webBytes(input))));
}
var hmacSha256 = (input, secret) => hmac(input, secret, "SHA-256");
var hmacSha512 = (input, secret) => hmac(input, secret, "SHA-512");
function crc32(input) {
  let crc = 4294967295;
  for (const byte of bytes(input)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
  }
  return ((crc ^ 4294967295) >>> 0).toString(16).padStart(8, "0");
}

// lib/tools/json-to-types.ts
function toPascalCase(str) {
  const clean = str.replace(/[^a-zA-Z0-9]/g, " ");
  return clean.split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("") || "NestedType";
}
function isValidIdentifier(name) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}
function formatKey(key) {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}
function jsonToTypescript(jsonInput, rootName = "Root") {
  let parsed;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const interfaces = [];
  const createdNames = /* @__PURE__ */ new Set();
  function getUniqueName(base) {
    let name = toPascalCase(base);
    let counter = 1;
    while (createdNames.has(name)) {
      counter += 1;
      name = `${toPascalCase(base)}${counter}`;
    }
    createdNames.add(name);
    return name;
  }
  function resolveType(val, keyHint) {
    if (val === null) return "null";
    if (val === void 0) return "undefined";
    const type = typeof val;
    if (type === "string" || type === "number" || type === "boolean") {
      return type;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return "unknown[]";
      const itemTypes = /* @__PURE__ */ new Set();
      const sampleObjects = [];
      for (const item of val) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          sampleObjects.push(item);
        } else {
          itemTypes.add(resolveType(item, `${keyHint}Item`));
        }
      }
      if (sampleObjects.length > 0) {
        const merged = {};
        for (const obj of sampleObjects) {
          for (const [k, v] of Object.entries(obj)) {
            if (!merged[k]) merged[k] = { types: /* @__PURE__ */ new Set(), count: 0 };
            merged[k].count += 1;
            merged[k].types.add(resolveType(v, k));
          }
        }
        const lines = [];
        for (const [k, meta] of Object.entries(merged)) {
          const isOptional = meta.count < sampleObjects.length;
          const typeStr = Array.from(meta.types).join(" | ") || "unknown";
          const formattedKey = formatKey(k) + (isOptional ? "?" : "");
          lines.push(`  ${formattedKey}: ${typeStr};`);
        }
        const interfaceName = getUniqueName(`${keyHint}Item`);
        interfaces.unshift({
          name: interfaceName,
          body: `export interface ${interfaceName} {
${lines.join("\n")}
}`
        });
        itemTypes.add(interfaceName);
      }
      const union = Array.from(itemTypes).join(" | ");
      return union.includes(" | ") ? `(${union})[]` : `${union}[]`;
    }
    if (type === "object") {
      const obj = val;
      const lines = [];
      for (const [k, v] of Object.entries(obj)) {
        const typeStr = resolveType(v, k);
        lines.push(`  ${formatKey(k)}: ${typeStr};`);
      }
      const interfaceName = getUniqueName(keyHint);
      interfaces.unshift({
        name: interfaceName,
        body: `export interface ${interfaceName} {
${lines.join("\n")}
}`
      });
      return interfaceName;
    }
    return "unknown";
  }
  const rootTypeName = toPascalCase(rootName) || "Root";
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const rootType = resolveType(parsed, rootTypeName);
    const found = interfaces.find((i) => i.name === rootType);
    if (found) {
      found.name = rootTypeName;
      found.body = found.body.replace(`export interface ${rootType}`, `export interface ${rootTypeName}`);
    }
    return interfaces.map((i) => i.body).join("\n\n");
  } else if (Array.isArray(parsed)) {
    const itemType = resolveType(parsed, rootTypeName);
    return `${interfaces.map((i) => i.body).join("\n\n")}

export type ${rootTypeName} = ${itemType};`.trim();
  } else {
    const primitiveType = resolveType(parsed, rootTypeName);
    return `export type ${rootTypeName} = ${primitiveType};`;
  }
}
function jsonToZod(jsonInput, rootName = "rootSchema") {
  let parsed;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const schemas = [];
  const createdNames = /* @__PURE__ */ new Set();
  function getUniqueName(base) {
    let name = base.endsWith("Schema") ? base : `${base}Schema`;
    let counter = 1;
    while (createdNames.has(name)) {
      counter += 1;
      name = `${base}${counter}Schema`;
    }
    createdNames.add(name);
    return name;
  }
  function resolveZod(val, keyHint) {
    if (val === null) return "z.null()";
    if (val === void 0) return "z.undefined()";
    if (typeof val === "string") return "z.string()";
    if (typeof val === "number") return Number.isInteger(val) ? "z.number().int()" : "z.number()";
    if (typeof val === "boolean") return "z.boolean()";
    if (Array.isArray(val)) {
      if (val.length === 0) return "z.array(z.unknown())";
      const sampleObjects = [];
      const itemSchemas = /* @__PURE__ */ new Set();
      for (const item of val) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          sampleObjects.push(item);
        } else {
          itemSchemas.add(resolveZod(item, `${keyHint}Item`));
        }
      }
      if (sampleObjects.length > 0) {
        const merged = {};
        for (const obj of sampleObjects) {
          for (const [k, v] of Object.entries(obj)) {
            if (!merged[k]) merged[k] = { schemas: /* @__PURE__ */ new Set(), count: 0 };
            merged[k].count += 1;
            merged[k].schemas.add(resolveZod(v, k));
          }
        }
        const lines = [];
        for (const [k, meta] of Object.entries(merged)) {
          const isOptional = meta.count < sampleObjects.length;
          let schemaStr = Array.from(meta.schemas)[0] || "z.unknown()";
          if (meta.schemas.size > 1) {
            schemaStr = `z.union([${Array.from(meta.schemas).join(", ")}])`;
          }
          if (isOptional) {
            schemaStr += ".optional()";
          }
          lines.push(`  ${formatKey(k)}: ${schemaStr},`);
        }
        const schemaName = getUniqueName(`${keyHint}Item`);
        schemas.unshift({
          name: schemaName,
          body: `export const ${schemaName} = z.object({
${lines.join("\n")}
});`
        });
        itemSchemas.add(schemaName);
      }
      const union = Array.from(itemSchemas);
      if (union.length === 1) return `z.array(${union[0]})`;
      return `z.array(z.union([${union.join(", ")}]))`;
    }
    if (typeof val === "object") {
      const obj = val;
      const lines = [];
      for (const [k, v] of Object.entries(obj)) {
        lines.push(`  ${formatKey(k)}: ${resolveZod(v, k)},`);
      }
      const schemaName = getUniqueName(keyHint);
      schemas.unshift({
        name: schemaName,
        body: `export const ${schemaName} = z.object({
${lines.join("\n")}
});`
      });
      return schemaName;
    }
    return "z.unknown()";
  }
  const safeRootName = rootName.endsWith("Schema") ? rootName : `${rootName}Schema`;
  const typeName = toPascalCase(rootName.replace(/Schema$/i, "")) || "Root";
  const rootResult = resolveZod(parsed, safeRootName);
  const found = schemas.find((s) => s.name === rootResult);
  if (found) {
    found.name = safeRootName;
    found.body = found.body.replace(`export const ${rootResult}`, `export const ${safeRootName}`);
  }
  const header = `import { z } from "zod";

`;
  const schemaDeclarations = schemas.map((s) => s.body).join("\n\n");
  const typeExport = `

export type ${typeName} = z.infer<typeof ${safeRootName}>;`;
  return header + (schemaDeclarations ? `${schemaDeclarations}${typeExport}` : `export const ${safeRootName} = ${rootResult};${typeExport}`);
}

// lib/tools/cron/parser.ts
var MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
var WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
var SPECS = [
  { name: "second", label: "Second", min: 0, max: 59 },
  { name: "minute", label: "Minute", min: 0, max: 59 },
  { name: "hour", label: "Hour", min: 0, max: 23 },
  { name: "dayOfMonth", label: "Day of month", min: 1, max: 31 },
  { name: "month", label: "Month", min: 1, max: 12 },
  { name: "dayOfWeek", label: "Day of week", min: 0, max: 7 }
];
function parseField(expression, spec) {
  const fail2 = (message) => {
    throw new Error(`${spec.label}: ${message}`);
  };
  if (expression.length > 128) fail2("field exceeds the 128-character limit.");
  if (!expression) fail2("field cannot be empty.");
  const endpoint = (text2) => {
    let value;
    if (/^\d+$/.test(text2)) value = Number(text2);
    else if (spec.name === "month" && MONTH_NAMES.includes(text2.toUpperCase())) value = MONTH_NAMES.indexOf(text2.toUpperCase()) + 1;
    else if (spec.name === "dayOfWeek" && WEEKDAY_NAMES.includes(text2.toUpperCase())) value = WEEKDAY_NAMES.indexOf(text2.toUpperCase());
    else return fail2("use integer values, permitted month/weekday names, *, ranges, lists or steps.");
    if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) fail2(`value must be between ${spec.min} and ${spec.max}.`);
    return value;
  };
  const selected = /* @__PURE__ */ new Set();
  for (const item of expression.split(",")) {
    if (!item) fail2("lists cannot contain empty items.");
    const pieces = item.split("/");
    if (pieces.length > 2 || !pieces[0]) fail2("malformed step notation.");
    let step = 1;
    if (pieces.length === 2) {
      if (!/^\d+$/.test(pieces[1])) fail2("step must be a positive integer.");
      step = Number(pieces[1]);
      if (!Number.isSafeInteger(step) || step < 1 || step > spec.max - spec.min + 1) fail2(`step must be between 1 and ${spec.max - spec.min + 1}.`);
    }
    const base = pieces[0];
    let first;
    let last;
    if (base === "*") {
      first = spec.min;
      last = spec.max;
    } else {
      const range = base.split("-");
      if (range.length > 2 || range.some((value) => !value)) fail2("malformed range; negative values are not supported.");
      first = endpoint(range[0]);
      last = range.length === 2 ? endpoint(range[1]) : pieces.length === 2 ? spec.max : first;
      if (last < first) fail2("descending or wrapping ranges are not supported.");
    }
    for (let value = first; value <= last; value += step) selected.add(spec.name === "dayOfWeek" && value === 7 ? 0 : value);
  }
  return { ...spec, expression, values: [...selected].sort((a, b) => a - b), wildcard: expression.startsWith("*") };
}
function parseCron(expression) {
  if (typeof expression !== "string" || !expression.trim()) throw new Error("Enter a cron expression.");
  if (expression.length > 1024) throw new Error("Cron expression exceeds the 1,024-character limit.");
  if (/[?#]/.test(expression) || /(?:^|[\s,/-])(?:L|LW|\d+[LW]|W|H(?:\([^)]*\))?)(?=$|[\s,/-])/i.test(expression) || /\b(?:cron|rate)\s*\(/i.test(expression)) {
    throw new Error("Quartz, AWS and Jenkins extensions (?, L, W, # and H) are not supported; use Unix numeric cron notation.");
  }
  if (expression.includes("@")) throw new Error("Cron macros are not supported; enter five Unix fields or six seconds-first fields.");
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length !== 5 && tokens.length !== 6) throw new Error("Expected five Unix fields or six seconds-first fields; years, commands, comments and environment assignments are not supported.");
  const hasSeconds = tokens.length === 6;
  const fields = tokens.map((token, index) => parseField(token, SPECS[index + (hasSeconds ? 0 : 1)]));
  const second = hasSeconds ? fields[0] : parseField("0", SPECS[0]);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.slice(hasSeconds ? 1 : 0);
  return { expression, hasSeconds, fields, second, minute, hour, dayOfMonth, month, dayOfWeek, dayMode: dayOfMonth.wildcard || dayOfWeek.wildcard ? "and" : "or" };
}
function matchesCronDate(cron, year, month, day) {
  if (!cron.month.values.includes(month)) return false;
  const dom = cron.dayOfMonth.values.includes(day);
  const dow = cron.dayOfWeek.values.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
  return cron.dayMode === "and" ? dom && dow : dom || dow;
}

// lib/tools/cron/explain.ts
var FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var FULL_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var pad = (value) => String(value).padStart(2, "0");
function explainCron(cron) {
  let timing;
  if (cron.hour.values.length === 1 && cron.minute.values.length === 1 && cron.second.values.length === 1) {
    timing = `At ${pad(cron.hour.values[0])}:${pad(cron.minute.values[0])}${cron.hasSeconds ? `:${pad(cron.second.values[0])}` : ""}`;
  } else if (cron.hasSeconds && cron.hour.expression === "*" && cron.minute.expression === "*" && cron.second.expression === "*") timing = "Every second";
  else if (cron.hour.expression === "*" && cron.minute.expression === "*" && !cron.hasSeconds) timing = "Every minute (at second 0)";
  else if (cron.hour.expression === "*" && /^\*\/\d+$/.test(cron.minute.expression) && !cron.hasSeconds) timing = `Every ${Number(cron.minute.expression.slice(2))} minutes within each hour (at second 0)`;
  else if (cron.hour.expression === "*" && cron.minute.values.length === 1 && cron.second.values.length === 1) timing = `Every hour at minute ${cron.minute.values[0]}, second ${cron.second.values[0]}`;
  else timing = `${cron.hasSeconds ? "Seconds-first schedule" : "Unix schedule (at second 0)"}: hours ${cron.hour.expression === "*" ? "every hour" : cron.hour.values.map(pad).join(", ")}; minutes ${cron.minute.expression === "*" ? "every minute" : cron.minute.values.map(pad).join(", ")}${cron.hasSeconds ? `; seconds ${cron.second.expression === "*" ? "every second" : cron.second.values.map(pad).join(", ")}` : ""}`;
  const months = cron.month.values.length === 12 ? "" : `; in ${cron.month.values.map((value) => FULL_MONTHS[value - 1]).join(", ")}`;
  const dom = cron.dayOfMonth.values.length === 31 ? "every day of month" : `day of month ${cron.dayOfMonth.values.join(", ")}`;
  const dow = cron.dayOfWeek.values.length === 7 ? "every weekday (Sunday\u2013Saturday)" : cron.dayOfWeek.values.map((value) => FULL_WEEKDAYS[value]).join(", ");
  const days = cron.dayMode === "or" ? `when either ${dom} OR weekday ${dow} matches` : cron.dayOfMonth.values.length === 31 && cron.dayOfWeek.values.length === 7 ? "every day" : cron.dayOfMonth.values.length === 31 ? `on ${dow}` : cron.dayOfWeek.values.length === 7 ? `on ${dom}` : `when both ${dom} AND weekday ${dow} match`;
  return `${timing}; ${days}${months}.`;
}

// config/shared-registry.ts
function checkToolAccess(toolId, license) {
  const tool = SHARED_TOOLS.find(
    (t) => t.id === toolId || t.mcpMetadata.toolName === toolId || t.cliMetadata.command === toolId || t.cliMetadata.aliases.includes(toolId)
  );
  if (!tool) {
    return {
      allowed: false,
      status: "denied",
      reason: `Tool "${toolId}" is not registered in Code Station registry.`
    };
  }
  if (tool.accessLevel === "free" || tool.accessLevel === "local-only") {
    return { allowed: true, status: "granted" };
  }
  if (tool.accessLevel === "pro") {
    if (license?.isPro) {
      return { allowed: true, status: "granted" };
    }
    return {
      allowed: false,
      status: "denied",
      requiredTier: "pro",
      reason: `Tool "${tool.name}" requires Code Station Pro. Upgrade at https://codestation.in/pro or launch with --key CS-PRO-YOURKEY.`
    };
  }
  if (tool.accessLevel === "paid-key") {
    if (license?.isPro) {
      return { allowed: true, status: "granted" };
    }
    return {
      allowed: false,
      status: "denied",
      requiredTier: "paid-key",
      reason: `Tool "${tool.name}" requires a valid paid key.`
    };
  }
  return { allowed: true, status: "granted" };
}
var SHARED_TOOLS = [
  // 1. cURL to Any Language Generator
  {
    id: "curl-to-any-language",
    name: "cURL to Any Language Generator",
    description: "Convert literal cURL commands into idiomatic TypeScript (fetch/axios), Python (requests), or Go (net/http).",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "API",
    keywords: ["curl", "fetch", "axios", "python", "go", "generator", "api", "converter"],
    inputSchema: {
      type: "object",
      properties: {
        curl: { type: "string", description: "cURL command string to convert" },
        target: {
          type: "string",
          enum: ["fetch", "axios", "python", "go"],
          default: "fetch",
          description: "Target programming language/library"
        }
      },
      required: ["curl"]
    },
    outputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        language: { type: "string" },
        target: { type: "string" },
        warnings: { type: "array", items: { type: "string" } }
      }
    },
    cliMetadata: {
      command: "curl-to-any-language",
      aliases: ["curl", "curl-to-code"],
      description: "Convert cURL commands to TypeScript, Python, or Go code",
      examples: [
        'codestation curl-to-any-language "curl https://api.example.com" --target fetch',
        `codestation curl "curl -X POST https://api.example.com -d '{\\"name\\":\\"test\\"}'" --target python`
      ]
    },
    mcpMetadata: {
      toolName: "codestation_curl_to_code",
      description: "Convert cURL commands to TypeScript fetch/axios, Python requests, or Go net/http. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/curl-to-any-language",
      slug: "curl-to-any-language"
    },
    execute: async (input) => {
      const target = input.target || "fetch";
      return await curlToCode(input.curl, target);
    }
  },
  // 2. Environment & Secret Leak Scanner
  {
    id: "env-audit",
    name: "Environment & Secret Leak Scanner",
    description: "Audit .env and configuration files for exposed live secrets (Stripe, AWS, OpenAI, GitHub PAT, private keys) and diff against .env.example.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Security & Crypto",
    keywords: ["env", "audit", "secrets", "scanner", "leak", "security", "credentials"],
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "Content of environment or configuration file" },
        example: { type: "string", description: "Optional content of .env.example to compare against" },
        format: { type: "string", enum: ["report", "json"], default: "report" }
      },
      required: ["env"]
    },
    outputSchema: {
      type: "object",
      properties: {
        totalVariables: { type: "integer" },
        findings: { type: "array" },
        isSecure: { type: "boolean" },
        summary: { type: "string" }
      }
    },
    cliMetadata: {
      command: "env-audit",
      aliases: ["env", "audit-env"],
      description: "Scan .env files for leaked secrets and diff against .env.example",
      examples: [
        "codestation env-audit .env --example .env.example",
        "codestation env .env --json"
      ]
    },
    mcpMetadata: {
      toolName: "codestation_env_audit",
      description: "Scan environment variables for secret leaks and validate against .env.example. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/env-audit",
      slug: "env-audit"
    },
    execute: async (input) => {
      const res = auditEnv(input.env, input.example);
      if (input.format === "json") return res;
      return { report: formatEnvAuditReport(res), ...res };
    }
  },
  // 3. Realistic Mock Data & SQL Seeder
  {
    id: "mock-data",
    name: "Realistic Mock Data & SQL Seeder",
    description: "Generate realistic mock data records and SQL INSERT seed statements with deterministic seeds.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["mock", "data", "seed", "sql", "faker", "testing", "fixtures"],
    inputSchema: {
      type: "object",
      properties: {
        template: { type: "string", enum: ["users", "products", "orders", "custom"], default: "users" },
        count: { type: "integer", minimum: 1, maximum: 1e3, default: 10 },
        format: { type: "string", enum: ["json", "sql", "csv"], default: "json" },
        tableName: { type: "string", description: "Table name for SQL output" },
        seed: { type: "integer", description: "Deterministic random seed" },
        customSchema: { type: "object", description: "Custom field mapping" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        count: { type: "integer" },
        data: { type: "array" },
        json: { type: "string" },
        sql: { type: "string" }
      }
    },
    cliMetadata: {
      command: "mock-data",
      aliases: ["mock", "seeder"],
      description: "Generate realistic mock data in JSON or SQL format",
      examples: [
        "codestation mock-data users --count 10",
        "codestation mock products --count 5 --sql --table catalog"
      ]
    },
    mcpMetadata: {
      toolName: "codestation_mock_data",
      description: "Generate realistic mock data and SQL seeders for users, products, orders, or custom schemas. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/mock-data",
      slug: "mock-data"
    },
    execute: async (options) => {
      return generateMockDataset(options);
    }
  },
  // 4. Git Merge Conflict Resolver
  {
    id: "conflict-parse",
    name: "Git Merge Conflict Resolver",
    description: "Parse and resolve standard or diff3 Git merge conflict markers (<<<<<<< HEAD, =======, >>>>>>>).",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Text",
    keywords: ["git", "conflict", "merge", "resolver", "diff3", "ours", "theirs"],
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "File content containing conflict markers" },
        strategy: { type: "string", enum: ["analyze", "ours", "theirs", "both"], default: "analyze" }
      },
      required: ["content"]
    },
    outputSchema: {
      type: "object",
      properties: {
        hasConflicts: { type: "boolean" },
        conflictCount: { type: "integer" },
        hunks: { type: "array" },
        resolvedContent: { type: "string" },
        summary: { type: "string" }
      }
    },
    cliMetadata: {
      command: "conflict-parse",
      aliases: ["conflict", "git-conflict"],
      description: "Parse and resolve Git merge conflict markers",
      examples: [
        "codestation conflict-parse path/to/file.ts --strategy analyze",
        "codestation conflict path/to/file.ts --strategy ours"
      ]
    },
    mcpMetadata: {
      toolName: "codestation_git_conflict",
      description: "Parse and resolve Git merge conflict markers (<<<<<<< HEAD, =======, >>>>>>>). [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/conflict-parse",
      slug: "conflict-parse"
    },
    execute: async (input) => {
      const strategy = input.strategy || "analyze";
      const res = parseAndResolveGitConflicts(input.content, strategy);
      if (strategy === "analyze") {
        return { report: formatConflictReport(res), ...res };
      }
      return res;
    }
  },
  // 5. JSON to TypeScript Interfaces
  {
    id: "json-to-typescript",
    name: "JSON to TypeScript",
    description: "Generate type-safe TypeScript interfaces and types from sample JSON data.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "typescript", "interfaces", "types", "generator"],
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or payload" },
        rootName: { type: "string", default: "Root", description: "Name of root interface" }
      },
      required: ["json"]
    },
    outputSchema: {
      type: "object",
      properties: { code: { type: "string" } }
    },
    cliMetadata: {
      command: "ts",
      aliases: ["types", "json-to-ts"],
      description: "Generate clean TypeScript interfaces from JSON",
      examples: [`codestation ts '{"id":1,"name":"Ada"}' User`]
    },
    mcpMetadata: {
      toolName: "codestation_json_to_typescript",
      description: "Generate clean TypeScript interfaces and types from sample JSON data. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/json-to-typescript",
      slug: "json-to-typescript"
    },
    execute: async (input) => {
      return jsonToTypescript(input.json, input.rootName || "Root");
    }
  },
  // 6. JSON to Zod Validation Schema
  {
    id: "json-to-zod",
    name: "JSON to Zod",
    description: "Generate production-ready Zod validation schemas and inferred types from sample JSON.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "zod", "schema", "validation", "generator"],
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or payload" },
        rootName: { type: "string", default: "rootSchema", description: "Name of root schema" }
      },
      required: ["json"]
    },
    outputSchema: {
      type: "object",
      properties: { code: { type: "string" } }
    },
    cliMetadata: {
      command: "zod",
      aliases: ["json-to-zod"],
      description: "Generate production-ready Zod schema from JSON",
      examples: [`codestation zod '{"id":1,"name":"Ada"}' userSchema`]
    },
    mcpMetadata: {
      toolName: "codestation_json_to_zod",
      description: "Generate production-ready Zod validation schema and inferred types from sample JSON data. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/json-to-zod",
      slug: "json-to-zod"
    },
    execute: async (input) => {
      return jsonToZod(input.json, input.rootName || "rootSchema");
    }
  },
  // 7. JWT Decoder
  {
    id: "jwt-decoder",
    name: "JWT Decoder",
    description: "Inspect claims, header, and expiry of JSON Web Tokens in local memory.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Security & Crypto",
    keywords: ["jwt", "token", "decode", "claims", "header", "auth"],
    inputSchema: {
      type: "object",
      properties: { token: { type: "string", description: "JWT string" } },
      required: ["token"]
    },
    outputSchema: {
      type: "object",
      properties: { header: { type: "object" }, payload: { type: "object" } }
    },
    cliMetadata: {
      command: "jwt",
      aliases: ["jwt-decode"],
      description: "Decode & inspect JWT header, payload, and expiry",
      examples: ["codestation jwt eyJhbGci..."]
    },
    mcpMetadata: {
      toolName: "codestation_jwt_decode",
      description: "Inspect & decode JSON Web Token (JWT) header, payload claims, and signature in local memory. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/jwt-decoder",
      slug: "jwt-decoder"
    },
    execute: async (input) => {
      return JSON.parse(decodeJwt(input.token));
    }
  },
  // 8. SQL Formatter
  {
    id: "sql-formatter",
    name: "SQL Formatter",
    description: "Beautify, indent, and format SQL queries across PostgreSQL, MySQL, SQLite, and Transact-SQL.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "SQL & Database",
    keywords: ["sql", "format", "beautify", "postgres", "mysql", "sqlite"],
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query string" },
        dialect: { type: "string", default: "postgresql", description: "SQL dialect" }
      },
      required: ["sql"]
    },
    outputSchema: {
      type: "object",
      properties: { formatted: { type: "string" } }
    },
    cliMetadata: {
      command: "sql",
      aliases: ["format-sql"],
      description: "Format SQL query across dialects",
      examples: ['codestation sql "SELECT id, name FROM users WHERE active = true;" --dialect postgresql']
    },
    mcpMetadata: {
      toolName: "codestation_format_sql",
      description: "Format, beautify, and indent SQL queries across PostgreSQL, MySQL, SQLite, and standard SQL. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/sql-formatter",
      slug: "sql-formatter"
    },
    execute: async (input) => {
      const { format } = await import("sql-formatter");
      const dialectMap = {
        postgresql: "postgresql",
        postgres: "postgresql",
        mysql: "mysql",
        sqlite: "sqlite",
        sqlserver: "transactsql"
      };
      const lang = dialectMap[(input.dialect || "postgresql").toLowerCase()] || "sql";
      return format(input.sql, { language: lang, tabWidth: 2 });
    }
  },
  // 9. Cron Explainer
  {
    id: "cron-explain",
    name: "Cron Schedule Explainer",
    description: "Translate 5-field Unix cron expressions into human-readable English and calculate upcoming runtimes.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "Cron",
    keywords: ["cron", "schedule", "explain", "next-run", "unix"],
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "5-field cron expression, e.g. 0 9 * * 1-5" }
      },
      required: ["expression"]
    },
    outputSchema: {
      type: "object",
      properties: {
        expression: { type: "string" },
        explanation: { type: "string" }
      }
    },
    cliMetadata: {
      command: "cron",
      aliases: ["cron-explain"],
      description: "Explain cron schedule and project next 5 runtimes",
      examples: ['codestation cron "0 9 * * 1-5"']
    },
    mcpMetadata: {
      toolName: "codestation_cron_explain",
      description: "Parse and explain 5-field Unix cron expressions in clear plain English. [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/cron-expression-explainer",
      slug: "cron-expression-explainer"
    },
    execute: async (input) => {
      const parsed = parseCron(input.expression);
      return {
        expression: input.expression,
        explanation: explainCron(parsed)
      };
    }
  },
  // 10. Cryptographic Hasher
  {
    id: "hash-generator",
    name: "Cryptographic Digest Engine",
    description: "Compute deterministic cryptographic digests (SHA-256, SHA-512, MD5, SHA-1, CRC-32).",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Security & Crypto",
    keywords: ["hash", "sha256", "sha512", "md5", "sha1", "crc32", "digest"],
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Input text" },
        algorithm: { type: "string", enum: ["sha256", "sha512", "md5", "sha1", "crc32"], default: "sha256" }
      },
      required: ["text"]
    },
    outputSchema: {
      type: "object",
      properties: { hash: { type: "string" } }
    },
    cliMetadata: {
      command: "hash",
      aliases: ["digest"],
      description: "Compute cryptographic digest (sha256, sha512, md5, sha1, crc32)",
      examples: ['codestation hash "sample text" --alg sha256']
    },
    mcpMetadata: {
      toolName: "codestation_hash",
      description: "Compute deterministic cryptographic hashes (SHA-256, SHA-512, MD5, SHA-1, CRC-32). [Pro Tier]"
    },
    routeMetadata: {
      route: "/tools/sha-256",
      slug: "sha-256"
    },
    execute: async (input) => {
      const alg = (input.algorithm || "sha256").toLowerCase();
      if (alg === "sha256" || alg === "sha-256") return await sha256(input.text);
      if (alg === "sha512" || alg === "sha-512") return await sha512(input.text);
      if (alg === "md5") return md5(input.text);
      if (alg === "sha1" || alg === "sha-1") return sha1(input.text);
      if (alg === "crc32") return crc32(input.text);
      return await sha256(input.text);
    }
  },
  // 11. UUID Generator (Free Tier)
  {
    id: "uuid-generator",
    name: "UUID v4 Generator",
    description: "Generate RFC 4122 v4 cryptographically secure random UUIDs.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "local-only",
    category: "Security & Crypto",
    keywords: ["uuid", "random", "guid", "v4"],
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "integer", minimum: 1, maximum: 50, default: 1 }
      }
    },
    outputSchema: {
      type: "object",
      properties: { uuids: { type: "array", items: { type: "string" } } }
    },
    cliMetadata: {
      command: "uuid",
      aliases: ["guid"],
      description: "Generate random RFC 4122 v4 UUIDs",
      examples: ["codestation uuid 5"]
    },
    mcpMetadata: {
      toolName: "codestation_uuid",
      description: "Generate cryptographically secure v4 UUIDs. [Free Tier]"
    },
    routeMetadata: {
      route: "/tools/uuid-generator",
      slug: "uuid-generator"
    },
    execute: async (input) => {
      const count = Math.min(Math.max(input.count || 1, 1), 50);
      return Array.from({ length: count }, () => crypto.randomUUID());
    }
  },
  // 12. JSON Formatter & Minifier (Free Tier)
  {
    id: "json-formatter",
    name: "JSON Formatter & Validator",
    description: "Validate, beautify, indent, or compact raw JSON strings.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "format", "validate", "minify", "beautify"],
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Raw JSON string" },
        indent: { type: "integer", default: 2 }
      },
      required: ["json"]
    },
    outputSchema: {
      type: "object",
      properties: { formatted: { type: "string" } }
    },
    cliMetadata: {
      command: "json",
      aliases: ["format-json"],
      description: "Validate and pretty-print JSON",
      examples: [`codestation json '{"k":"v"}'`]
    },
    mcpMetadata: {
      toolName: "codestation_format_json",
      description: "Format, validate, and pretty-print raw JSON with indentation. [Free Tier]"
    },
    routeMetadata: {
      route: "/tools/json-formatter",
      slug: "json-formatter"
    },
    execute: async (input) => {
      return formatJson(input.json, input.indent ?? 2);
    }
  }
];

// lib/tools/text-station.ts
var MAX_TEXT_LENGTH = 1e6;
var MAX_DIFF_LINES = 2e3;
var MAX_DIFF_CELLS = 4e6;
var LOREM_WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  " consequat",
  "duis",
  "aute",
  "irure",
  "in",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
  "excepteur",
  "sint",
  "occaecat",
  "cupidatat",
  "non",
  "proident",
  "sunt",
  "culpa",
  "qui",
  "officia",
  "deserunt",
  "mollit",
  "anim",
  "id",
  "est",
  "laborum"
].map((word) => word.trim());
function assertText(value, name = "text") {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string.`);
  if (value.length > MAX_TEXT_LENGTH) throw new RangeError(`${name} must be at most ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
  return value;
}
function parseLines(value) {
  assertText(value);
  const firstCrLf = value.indexOf("\r\n");
  const firstLf = value.indexOf("\n");
  const firstCr = value.indexOf("\r");
  let ending = "\n";
  if (firstCrLf >= 0 && (firstLf < 0 || firstCrLf <= firstLf)) ending = "\r\n";
  else if (firstCr >= 0 && (firstLf < 0 || firstCr < firstLf)) ending = "\r";
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return { lines: [], ending, trailingBreak: false };
  const trailingBreak = normalized.endsWith("\n");
  const body = trailingBreak ? normalized.slice(0, -1) : normalized;
  return { lines: body ? body.split("\n") : [""], ending, trailingBreak };
}
function firstCharacterUpper(value, locale) {
  const characters = Array.from(value);
  if (!characters.length) return value;
  return characters[0].toLocaleUpperCase(locale) + characters.slice(1).join("");
}
function wordsOf(value) {
  return value.replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2").match(/[\p{L}\p{N}]+/gu) ?? [];
}
function convertCase(value, style, options = {}) {
  assertText(value);
  const locale = options.locale;
  if (style === "upper") return value.toLocaleUpperCase(locale);
  if (style === "lower") return value.toLocaleLowerCase(locale);
  if (style === "title") {
    return value.toLocaleLowerCase(locale).replace(/(^|[\s\-_\/.])([\p{L}\p{N}])/gu, (_, separator, character) => `${separator}${character.toLocaleUpperCase(locale)}`);
  }
  if (style === "sentence") {
    const lower = value.toLocaleLowerCase(locale);
    return lower.replace(/(^|[.!?…。！？]\s+)(\s*)([\p{L}\p{N}])/gu, (_, boundary, whitespace, character) => `${boundary}${whitespace}${character.toLocaleUpperCase(locale)}`);
  }
  const words2 = wordsOf(value).map((word) => word.toLocaleLowerCase(locale));
  if (style === "camel") return words2.map((word, index) => index === 0 ? word : firstCharacterUpper(word, locale)).join("");
  if (style === "pascal") return words2.map((word) => firstCharacterUpper(word, locale)).join("");
  if (style === "snake") return words2.join("_");
  if (style === "kebab") return words2.join("-");
  if (style === "constant") return words2.map((word) => word.toLocaleUpperCase(locale)).join("_");
  throw new Error(`Unsupported case style: ${String(style)}.`);
}
function escapeRegex(value) {
  return value.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}
function diffOperations(left, right) {
  if (left.length > MAX_DIFF_LINES || right.length > MAX_DIFF_LINES) throw new RangeError(`Text diff supports at most ${MAX_DIFF_LINES.toLocaleString()} lines per side.`);
  if (left.length * right.length > MAX_DIFF_CELLS) throw new RangeError("Text diff inputs are too large to compare safely; reduce the number of lines.");
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i2 = left.length - 1; i2 >= 0; i2 -= 1) {
    for (let j2 = right.length - 1; j2 >= 0; j2 -= 1) table[i2][j2] = left[i2] === right[j2] ? table[i2 + 1][j2 + 1] + 1 : Math.max(table[i2 + 1][j2], table[i2][j2 + 1]);
  }
  const operations = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      operations.push({ type: "equal", text: left[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      operations.push({ type: "deletion", text: left[i] });
      i += 1;
    } else {
      operations.push({ type: "addition", text: right[j] });
      j += 1;
    }
  }
  while (i < left.length) operations.push({ type: "deletion", text: left[i++] });
  while (j < right.length) operations.push({ type: "addition", text: right[j++] });
  return operations;
}
function buildUnified(operations) {
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;
  const lines = operations.map((operation) => {
    if (operation.type === "equal") return { type: "context", text: operation.text, oldLine: oldLine++, newLine: newLine++ };
    if (operation.type === "deletion") {
      removed += 1;
      return { type: "deletion", text: operation.text, oldLine: oldLine++, newLine: null };
    }
    added += 1;
    return { type: "addition", text: operation.text, oldLine: null, newLine: newLine++ };
  });
  const text2 = ["--- left", "+++ right", ...lines.map((line) => `${line.type === "context" ? " " : line.type === "deletion" ? "-" : "+"}${line.text}`)].join("\n");
  return { lines, text: text2, added, removed };
}
function buildSideBySide(operations) {
  const rows = [];
  let leftLine = 1;
  let rightLine = 1;
  for (let i = 0; i < operations.length; i += 1) {
    const operation = operations[i];
    if (operation.type === "equal") {
      rows.push({ type: "equal", left: { line: leftLine++, text: operation.text }, right: { line: rightLine++, text: operation.text } });
      continue;
    }
    const deleted = [];
    const added = [];
    while (i < operations.length && operations[i].type !== "equal") {
      if (operations[i].type === "deletion") deleted.push(operations[i].text);
      else added.push(operations[i].text);
      i += 1;
    }
    i -= 1;
    const width = Math.max(deleted.length, added.length);
    for (let offset = 0; offset < width; offset += 1) {
      const left = deleted[offset];
      const right = added[offset];
      rows.push({
        type: left !== void 0 && right !== void 0 ? "changed" : left !== void 0 ? "removed" : "added",
        left: left === void 0 ? null : { line: leftLine++, text: left },
        right: right === void 0 ? null : { line: rightLine++, text: right }
      });
    }
  }
  return rows;
}
function textDiff(left, right) {
  const leftParsed = parseLines(left);
  const rightParsed = parseLines(right);
  const operations = diffOperations(leftParsed.lines, rightParsed.lines);
  const unified = buildUnified(operations);
  const sideBySide = buildSideBySide(operations);
  return {
    changed: unified.added > 0 || unified.removed > 0,
    added: unified.added,
    removed: unified.removed,
    unified: unified.text,
    unifiedLines: unified.lines,
    sideBySide,
    unifiedData: unified.lines,
    sideBySideData: sideBySide
  };
}
function diffText(left, right) {
  return textDiff(left, right).unified;
}
function slugify(value, separator = "-") {
  assertText(value);
  assertText(separator, "separator");
  if (!separator || separator.length > 16 || /[\p{L}\p{N}]/u.test(separator)) throw new Error("Slug separator must be 1\u201316 non-alphanumeric characters.");
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, separator).replace(new RegExp(`(?:${escapeRegex(separator)})+`, "g"), separator).replace(new RegExp(`^${escapeRegex(separator)}|${escapeRegex(separator)}$`, "g"), "");
}

// lib/tools/date-time-station.ts
var SECOND = 1e3;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var MIN_DATE = -621355968e5;
var MAX_DATE = 253402300799999;
function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}
function inputText(value, name = "Date", max = 256) {
  if (typeof value !== "string") throw new TypeError(`${name} must be text.`);
  const text2 = value.trim();
  if (!text2) throw new Error(`${name} cannot be empty.`);
  if (text2.length > max) throw new RangeError(`${name} must be at most ${max} characters.`);
  return text2;
}
function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysInMonth(year, month) {
  return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function validateParts(parts) {
  integer(parts.year, "Year", 1, 9999);
  integer(parts.month, "Month", 1, 12);
  integer(parts.day, "Day", 1, daysInMonth(parts.year, parts.month));
  integer(parts.hour, "Hour", 0, 23);
  integer(parts.minute, "Minute", 0, 59);
  integer(parts.second, "Second", 0, 59);
  integer(parts.millisecond, "Millisecond", 0, 999);
}
function utcMilliseconds(parts) {
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0, parts.millisecond ?? 0);
  return date.getTime();
}
function checkedDate(milliseconds) {
  if (!Number.isFinite(milliseconds)) throw new RangeError("Date or timestamp must be finite and valid.");
  if (milliseconds < MIN_DATE || milliseconds > MAX_DATE) throw new RangeError("Date must be within Gregorian years 0001\u20139999 in UTC.");
  return new Date(milliseconds);
}
function timestampUnit(unit) {
  if (unit !== "seconds" && unit !== "milliseconds") throw new Error("Timestamp unit must be seconds or milliseconds.");
  return unit;
}
function timestampToDate(value, unit = "seconds") {
  timestampUnit(unit);
  let number;
  if (typeof value === "string") {
    const text2 = inputText(value, "Timestamp");
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(text2)) throw new Error("Timestamp must be a decimal number, without exponent notation.");
    number = Number(text2);
  } else if (typeof value === "number") number = value;
  else throw new TypeError("Timestamp must be a number or numeric text.");
  if (!Number.isFinite(number)) throw new RangeError("Timestamp must be finite.");
  if (unit === "milliseconds" && !Number.isInteger(number)) throw new RangeError("A millisecond timestamp must be an integer.");
  return checkedDate(unit === "seconds" ? Math.round(number * SECOND) : number);
}
function zoneFormatter(timeZone) {
  const zone = inputText(timeZone, "Time zone", 128);
  if (/^[+-]/.test(zone)) throw new Error("Use an IANA time zone such as America/New_York, Asia/Kolkata, or UTC.");
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      calendar: "gregory",
      numberingSystem: "latn",
      era: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
  } catch {
    throw new Error(`Unknown or unsupported IANA time zone: ${zone}.`);
  }
}
function validateTimeZone(timeZone) {
  return zoneFormatter(timeZone).resolvedOptions().timeZone;
}
function zoneParts(milliseconds, formatter) {
  const fields = Object.fromEntries(formatter.formatToParts(new Date(milliseconds)).map((part) => [part.type, part.value]));
  return {
    year: fields.era === "BC" ? 1 - Number(fields.year) : Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
    millisecond: (milliseconds % SECOND + SECOND) % SECOND
  };
}
function disambiguation(value = "reject") {
  if (!["reject", "earlier", "later"].includes(value)) throw new Error("Time disambiguation must be reject, earlier, or later.");
  return value;
}
function sameParts(left, right) {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute && left.second === right.second && left.millisecond === right.millisecond;
}
function localToDate(parts, formatter, choice) {
  const wall = utcMilliseconds(parts);
  const offsets = /* @__PURE__ */ new Set();
  for (let hours = -48; hours <= 48; hours += 12) {
    const sample = wall + hours * HOUR;
    offsets.add(utcMilliseconds(zoneParts(sample, formatter)) - sample);
  }
  const matches = [...offsets].map((offset) => wall - offset).filter((candidate) => sameParts(zoneParts(candidate, formatter), parts)).sort((a, b) => a - b);
  const zone = formatter.resolvedOptions().timeZone;
  if (!matches.length) throw new Error(`This local time does not exist in ${zone} because of a time-zone clock change. Choose another time or an explicit UTC offset.`);
  if (matches.length > 1 && choice === "reject") throw new Error(`This local time occurs twice in ${zone}. Choose earlier or later, or supply an explicit UTC offset.`);
  return checkedDate(choice === "later" ? matches[matches.length - 1] : matches[0]);
}
function offsetMilliseconds(value) {
  if (/^z$/i.test(value)) return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(value);
  if (!match) throw new Error("UTC offset must be Z or \xB1HH:mm.");
  const hours = integer(Number(match[2]), "Offset hour", 0, 23);
  const minutes = integer(Number(match[3]), "Offset minute", 0, 59);
  if (match[1] === "-" && hours === 0 && minutes === 0) throw new Error("The unknown UTC offset -00:00 cannot identify an instant. Use Z or a known offset.");
  return (match[1] === "-" ? -1 : 1) * (hours * HOUR + minutes * MINUTE);
}
function partsToDate(parts, offset, options) {
  validateParts(parts);
  const choice = disambiguation(options.disambiguation);
  const formatter = zoneFormatter(options.timeZone ?? "UTC");
  return offset ? checkedDate(utcMilliseconds(parts) - offsetMilliseconds(offset)) : localToDate(parts, formatter, choice);
}
function parseDateTime(value, options = {}) {
  timestampUnit(options.timestampUnit ?? "milliseconds");
  disambiguation(options.disambiguation);
  if (options.timeZone !== void 0) validateTimeZone(options.timeZone);
  if (value instanceof Date) return checkedDate(value.getTime());
  if (typeof value === "number") return timestampToDate(value, options.timestampUnit ?? "milliseconds");
  const text2 = inputText(value);
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text2)) return timestampToDate(text2, options.timestampUnit ?? "milliseconds");
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/.exec(text2);
  if (!match) throw new Error("Use YYYY-MM-DD, an ISO date/time with up to 3 fractional digits, or an explicit numeric timestamp.");
  return partsToDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "").padEnd(3, "0"))
  }, match[8], options);
}
function pad2(value, length = 2) {
  return String(value).padStart(length, "0");
}
function calendarText(parts) {
  return `${pad2(parts.year, 4)}-${pad2(parts.month)}-${pad2(parts.day)}`;
}
function clockText(parts) {
  return `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}.${pad2(parts.millisecond, 3)}`;
}
function offsetText(milliseconds) {
  if (!milliseconds) return "Z";
  const seconds = Math.abs(milliseconds) / SECOND;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return `${milliseconds < 0 ? "-" : "+"}${pad2(hours)}:${pad2(minutes)}${remainder ? `:${pad2(remainder)}` : ""}`;
}
function getZonedDateTime(value, timeZone = "UTC", options = {}) {
  const date = parseDateTime(value, options);
  const formatter = zoneFormatter(timeZone);
  const parts = zoneParts(date.getTime(), formatter);
  validateParts(parts);
  const offset = utcMilliseconds(parts) - date.getTime();
  const renderedOffset = offsetText(offset);
  return {
    ...parts,
    timeZone: formatter.resolvedOptions().timeZone,
    offsetMinutes: offset / MINUTE,
    offset: renderedOffset,
    unixMilliseconds: date.getTime(),
    iso: date.toISOString(),
    dateTime: `${calendarText(parts)}T${clockText(parts)}${renderedOffset}`
  };
}
function formatRfc3339(value, timeZoneOrOptions = "UTC", options = {}) {
  const timeZone = typeof timeZoneOrOptions === "string" ? timeZoneOrOptions : timeZoneOrOptions.timeZone ?? "UTC";
  const parseOptions = typeof timeZoneOrOptions === "string" ? options : timeZoneOrOptions;
  const zoned = getZonedDateTime(value, timeZone, parseOptions);
  if (!Number.isInteger(zoned.offsetMinutes)) throw new Error("RFC3339 cannot represent this historical sub-minute UTC offset. Format in UTC instead.");
  return zoned.dateTime;
}
function convertTimeZone(value, targetTimeZone, options = {}) {
  const parseOptions = typeof options === "string" ? { timeZone: options } : options;
  return formatRfc3339(value, targetTimeZone, parseOptions);
}
function convertBetweenTimeZones(value, sourceTimeZone, targetTimeZone) {
  return convertTimeZone(value, targetTimeZone, { timeZone: sourceTimeZone });
}
var relativeUnits = [
  { unit: "year", milliseconds: 365 * DAY },
  { unit: "quarter", milliseconds: 91 * DAY },
  { unit: "month", milliseconds: 30 * DAY },
  { unit: "week", milliseconds: 7 * DAY },
  { unit: "day", milliseconds: DAY },
  { unit: "hour", milliseconds: HOUR },
  { unit: "minute", milliseconds: MINUTE },
  { unit: "second", milliseconds: SECOND }
];
function calendarCompare(left, right) {
  return utcMilliseconds(left) - utcMilliseconds(right);
}
function calendarDayNumber(date) {
  return Math.floor(utcMilliseconds(date) / DAY);
}
function calendarFromDayNumber(day) {
  const date = new Date(day * DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
function calendarWeekday(date) {
  return new Date(utcMilliseconds(date)).getUTCDay();
}
function dateCalendar(value, options) {
  const zoned = getZonedDateTime(value, options.timeZone ?? "UTC", { timeZone: options.timeZone ?? "UTC" });
  return { year: zoned.year, month: zoned.month, day: zoned.day };
}
function weekdaysInclusive(start, end) {
  if (calendarCompare(start, end) > 0) return -weekdaysInclusive(end, start);
  const first = calendarDayNumber(start);
  const total = calendarDayNumber(end) - first + 1;
  const weeks = Math.floor(total / 7);
  let count = weeks * 5;
  for (let day = first + weeks * 7; day <= calendarDayNumber(end); day += 1) {
    const weekday = new Date(day * DAY).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}
function businessDaysBetween(start, end, options = {}) {
  const left = dateCalendar(start, options);
  const right = dateCalendar(end, options);
  if (calendarCompare(left, right) === 0) return (options.inclusiveStart ?? true) && (options.inclusiveEnd ?? false) && calendarWeekday(left) !== 0 && calendarWeekday(left) !== 6 ? 1 : 0;
  const direction = calendarCompare(left, right) < 0 ? 1 : -1;
  const earlier = direction > 0 ? left : right;
  const later = direction > 0 ? right : left;
  let first = calendarDayNumber(earlier);
  let last = calendarDayNumber(later);
  const includeEarlier = direction > 0 ? options.inclusiveStart ?? true : options.inclusiveEnd ?? false;
  const includeLater = direction > 0 ? options.inclusiveEnd ?? false : options.inclusiveStart ?? true;
  if (!includeEarlier) first += 1;
  if (!includeLater) last -= 1;
  if (first > last) return 0;
  return direction * weekdaysInclusive(calendarFromDayNumber(first), calendarFromDayNumber(last));
}

// mcp/server.ts
var MCP_TOOLS = [
  // ----------------- FREE TOOLS -----------------
  {
    name: "codestation_uuid",
    description: "Generate cryptographically secure v4 UUIDs. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "integer",
          description: "Number of UUIDs to generate (1 to 50, default: 1)",
          minimum: 1,
          maximum: 50
        }
      }
    }
  },
  {
    name: "codestation_base64",
    description: "Encode or decode Base64 and URL-safe Base64 strings. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The string to encode or decode" },
        action: {
          type: "string",
          enum: ["encode", "decode"],
          description: "Whether to encode or decode"
        },
        urlSafe: {
          type: "boolean",
          description: "Whether to use URL-safe Base64 (default: false)"
        }
      },
      required: ["text", "action"]
    }
  },
  {
    name: "codestation_url_codec",
    description: "URL encode or decode string components. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to URL-encode or URL-decode" },
        action: {
          type: "string",
          enum: ["encode", "decode"],
          description: "Action to perform"
        }
      },
      required: ["text", "action"]
    }
  },
  {
    name: "codestation_hex_codec",
    description: "Encode UTF-8 string to hexadecimal byte pairs or decode hex to text. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text or hex string" },
        action: {
          type: "string",
          enum: ["encode", "decode"],
          description: "Action to perform"
        }
      },
      required: ["text", "action"]
    }
  },
  {
    name: "codestation_format_json",
    description: "Prettify, format, and validate a JSON string. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Raw JSON string to format" },
        indent: {
          type: "integer",
          description: "Number of spaces for indentation (0-8, default: 2)",
          minimum: 0,
          maximum: 8
        }
      },
      required: ["json"]
    }
  },
  {
    name: "codestation_minify_json",
    description: "Minify JSON by stripping all whitespace. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "JSON string to minify" }
      },
      required: ["json"]
    }
  },
  {
    name: "codestation_json_to_yaml",
    description: "Convert JSON to clean YAML format. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Valid JSON string" }
      },
      required: ["json"]
    }
  },
  {
    name: "codestation_yaml_to_json",
    description: "Convert YAML formatted text to JSON. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        yaml: { type: "string", description: "YAML text string" }
      },
      required: ["yaml"]
    }
  },
  {
    name: "codestation_case_convert",
    description: "Convert text into different naming conventions (camelCase, snake_case, kebab-case, PascalCase, CONSTANT_CASE, etc.). [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The string or identifier to convert" },
        targetCase: {
          type: "string",
          enum: ["camel", "pascal", "snake", "kebab", "constant", "title", "sentence", "upper", "lower"],
          description: "Target casing style"
        }
      },
      required: ["text", "targetCase"]
    }
  },
  {
    name: "codestation_text_diff",
    description: "Generate a clean line-by-line unified diff between original and modified text. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        original: { type: "string", description: "The original text content" },
        modified: { type: "string", description: "The updated text content" }
      },
      required: ["original", "modified"]
    }
  },
  {
    name: "codestation_slugify",
    description: "Convert strings to clean, SEO-friendly URL slugs. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to slugify" },
        separator: { type: "string", description: "Separator character (default: '-')" }
      },
      required: ["text"]
    }
  },
  // ----------------- PRO TOOLS (₹199 / $2.99) -----------------
  {
    name: "codestation_hash",
    description: "Generate cryptographic hashes (SHA-256, SHA-512, MD5, SHA-1, CRC-32). [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to hash" },
        algorithm: {
          type: "string",
          enum: ["SHA-256", "SHA-384", "SHA-512", "MD5", "SHA-1", "CRC32"],
          description: "Hash algorithm to apply (default: SHA-256)"
        }
      },
      required: ["text"]
    }
  },
  {
    name: "codestation_hmac",
    description: "Compute HMAC signatures using Web Crypto. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Input message string" },
        secret: { type: "string", description: "Secret key" },
        algorithm: {
          type: "string",
          enum: ["SHA-256", "SHA-512"],
          description: "HMAC algorithm (default: SHA-256)"
        }
      },
      required: ["text", "secret"]
    }
  },
  {
    name: "codestation_jwt_decode",
    description: "Inspect & decode JSON Web Token (JWT) header, payload claims, and signature in local memory without transmitting secrets. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Full JWT string (header.payload.signature)" }
      },
      required: ["token"]
    }
  },
  {
    name: "codestation_format_sql",
    description: "Format, beautify, and indent SQL queries across PostgreSQL, MySQL, SQLite, and standard SQL. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "Raw SQL query to format" },
        dialect: {
          type: "string",
          enum: ["PostgreSQL", "MySQL", "SQLite", "SQL Server"],
          description: "SQL dialect (default: PostgreSQL)"
        }
      },
      required: ["sql"]
    }
  },
  {
    name: "codestation_cron_explain",
    description: "Parse and explain 5-field Unix cron expressions in clear plain English. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "5-field cron expression, e.g. '*/15 9-17 * * 1-5'"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "codestation_timezone_convert",
    description: "Accurately convert a date/time string from one IANA timezone to another using runtime IANA rules. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        dateTime: {
          type: "string",
          description: "ISO date-time string, e.g. '2026-10-09T14:30:00'"
        },
        sourceTimeZone: {
          type: "string",
          description: "Source IANA timezone (e.g. 'America/New_York', 'Asia/Kolkata', 'UTC')"
        },
        targetTimeZone: {
          type: "string",
          description: "Target IANA timezone (e.g. 'Asia/Kolkata', 'Europe/London', 'UTC')"
        }
      },
      required: ["dateTime", "sourceTimeZone", "targetTimeZone"]
    }
  },
  {
    name: "codestation_business_days",
    description: "Calculate exact working/business days between two dates, excluding weekends. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" }
      },
      required: ["startDate", "endDate"]
    }
  },
  {
    name: "codestation_regex_test",
    description: "Test regular expressions against target text and return structured match groups and indices. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern (without bounding slashes)" },
        text: { type: "string", description: "Text to search within" },
        flags: {
          type: "string",
          description: "Regex flags (e.g. 'g', 'i', 'm', default: 'g')"
        }
      },
      required: ["pattern", "text"]
    }
  },
  {
    name: "codestation_json_schema",
    description: "Infer a Draft 2020-12 JSON Schema structure from sample JSON data. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string" }
      },
      required: ["json"]
    }
  },
  {
    name: "codestation_json_to_typescript",
    description: "Generate clean TypeScript interfaces and types from sample JSON data. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or object representation" },
        rootName: { type: "string", description: "Name for the root interface (default: 'Root')" }
      },
      required: ["json"]
    }
  },
  {
    name: "codestation_json_to_zod",
    description: "Generate production-ready Zod validation schema and inferred types from sample JSON data. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or object representation" },
        rootName: { type: "string", description: "Name for the root schema (default: 'rootSchema')" }
      },
      required: ["json"]
    }
  },
  {
    name: "codestation_curl_to_code",
    description: "Convert cURL commands to TypeScript fetch/axios, Python requests, or Go net/http. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        curl: { type: "string", description: "cURL command string" },
        target: {
          type: "string",
          enum: ["fetch", "axios", "python", "go"],
          description: "Target programming language/library (default: 'fetch')"
        }
      },
      required: ["curl"]
    }
  },
  {
    name: "codestation_env_audit",
    description: "Scan environment variables for secret leaks (Stripe, AWS, OpenAI, GitHub PAT, private keys) and validate against .env.example. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "Contents of the .env file" },
        example: { type: "string", description: "Optional contents of .env.example to diff against" },
        format: {
          type: "string",
          enum: ["report", "json"],
          description: "Output format (default: 'report')"
        }
      },
      required: ["env"]
    }
  },
  {
    name: "codestation_mock_data",
    description: "Generate realistic mock data and SQL seeders for users, products, orders, or custom schemas. [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        template: {
          type: "string",
          enum: ["users", "products", "orders", "custom"],
          description: "Template type (default: 'users')"
        },
        count: {
          type: "integer",
          minimum: 1,
          maximum: 1e3,
          description: "Number of records to generate (default: 10)"
        },
        format: {
          type: "string",
          enum: ["json", "sql"],
          description: "Output format (default: 'json')"
        },
        tableName: {
          type: "string",
          description: "Optional SQL table name (defaults to template name)"
        },
        customSchema: {
          type: "object",
          description: "Optional custom schema mapping field names to types (uuid, name, email, price, date, boolean, number, status, role)"
        }
      }
    }
  },
  {
    name: "codestation_git_conflict",
    description: "Parse and resolve Git merge conflict markers (<<<<<<< HEAD, =======, >>>>>>>). [Pro Tier: \u20B9199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "File content containing Git conflict markers" },
        strategy: {
          type: "string",
          enum: ["analyze", "ours", "theirs", "both"],
          description: "Resolution strategy: analyze (report), ours (keep current), theirs (keep incoming), or both (keep both). Default: 'analyze'"
        }
      },
      required: ["content"]
    }
  }
];
async function executeMcpTool(name, args = {}, license) {
  const access = checkToolAccess(name, license);
  if (!access.allowed || PRO_TOOLS.has(name) && !license.isPro) {
    return {
      content: [
        {
          type: "text",
          text: access.reason || getProUpgradeNotice(name)
        }
      ],
      isError: true
    };
  }
  try {
    let outputText = "";
    switch (name) {
      // --- Free tools ---
      case "codestation_uuid": {
        const count = Math.min(Math.max(Number(args.count ?? 1), 1), 50);
        const uuids = Array.from({ length: count }, () => crypto.randomUUID());
        outputText = count === 1 ? uuids[0] : uuids.join("\n");
        break;
      }
      case "codestation_base64": {
        const text2 = String(args.text ?? "");
        const action = String(args.action ?? "encode");
        const urlSafe = Boolean(args.urlSafe);
        if (action === "encode") {
          if (urlSafe) {
            outputText = encodeBase64Url(text2);
          } else {
            outputText = Buffer.from(text2, "utf-8").toString("base64");
          }
        } else {
          if (urlSafe) {
            outputText = decodeBase64Url(text2);
          } else {
            outputText = Buffer.from(text2, "base64").toString("utf-8");
          }
        }
        break;
      }
      case "codestation_url_codec": {
        const text2 = String(args.text ?? "");
        const action = String(args.action ?? "encode");
        outputText = action === "encode" ? encodeUrlComponent(text2) : decodeUrlComponent(text2);
        break;
      }
      case "codestation_hex_codec": {
        const text2 = String(args.text ?? "");
        const action = String(args.action ?? "encode");
        outputText = action === "encode" ? encodeHexadecimal(text2) : decodeHexadecimal(text2);
        break;
      }
      case "codestation_format_json": {
        const json = String(args.json ?? "");
        const indent = args.indent !== void 0 ? Number(args.indent) : 2;
        outputText = formatJson(json, indent);
        break;
      }
      case "codestation_minify_json": {
        outputText = minifyJson(String(args.json ?? ""));
        break;
      }
      case "codestation_json_to_yaml": {
        outputText = jsonToYaml(String(args.json ?? ""));
        break;
      }
      case "codestation_yaml_to_json": {
        outputText = yamlToJson(String(args.yaml ?? ""));
        break;
      }
      case "codestation_case_convert": {
        const text2 = String(args.text ?? "");
        const targetCase = String(args.targetCase ?? "camel");
        outputText = convertCase(text2, targetCase);
        break;
      }
      case "codestation_text_diff": {
        outputText = diffText(String(args.original ?? ""), String(args.modified ?? ""));
        break;
      }
      case "codestation_slugify": {
        outputText = slugify(String(args.text ?? ""), String(args.separator ?? "-"));
        break;
      }
      // --- Pro tools ---
      case "codestation_hash": {
        const text2 = String(args.text ?? "");
        const algo = String(args.algorithm ?? "SHA-256").toUpperCase();
        if (algo === "MD5") outputText = md5(text2);
        else if (algo === "SHA-1") outputText = sha1(text2);
        else if (algo === "SHA-256") outputText = await sha256(text2);
        else if (algo === "SHA-384") outputText = await sha384(text2);
        else if (algo === "SHA-512") outputText = await sha512(text2);
        else if (algo === "CRC32") outputText = crc32(text2);
        else throw new Error(`Unsupported hash algorithm: ${algo}`);
        break;
      }
      case "codestation_hmac": {
        const text2 = String(args.text ?? "");
        const secret = String(args.secret ?? "");
        const algo = String(args.algorithm ?? "SHA-256").toUpperCase();
        if (algo === "SHA-512") {
          outputText = await hmacSha512(text2, secret);
        } else {
          outputText = await hmacSha256(text2, secret);
        }
        break;
      }
      case "codestation_jwt_decode": {
        outputText = decodeJwt(String(args.token ?? ""));
        break;
      }
      case "codestation_format_sql": {
        const sql = String(args.sql ?? "");
        const dialect = String(args.dialect ?? "PostgreSQL").toLowerCase();
        const { format } = await import("sql-formatter");
        const dialectMap = {
          postgresql: "postgresql",
          postgres: "postgresql",
          mysql: "mysql",
          sqlite: "sqlite",
          sqlserver: "transactsql",
          tsql: "transactsql",
          "sql server": "transactsql"
        };
        const lang = dialectMap[dialect] || "sql";
        outputText = format(sql, { language: lang, tabWidth: 2 });
        break;
      }
      case "codestation_cron_explain": {
        const parsed = parseCron(String(args.expression ?? ""));
        outputText = explainCron(parsed);
        break;
      }
      case "codestation_timezone_convert": {
        const dateTime = String(args.dateTime ?? "");
        const sourceZone = String(args.sourceTimeZone ?? "UTC");
        const targetZone = String(args.targetTimeZone ?? "UTC");
        outputText = convertBetweenTimeZones(dateTime, sourceZone, targetZone);
        break;
      }
      case "codestation_business_days": {
        const start = String(args.startDate ?? "");
        const end = String(args.endDate ?? "");
        const days = businessDaysBetween(start, end);
        outputText = `${days} business day${days === 1 ? "" : "s"}`;
        break;
      }
      case "codestation_regex_test": {
        const pattern = String(args.pattern ?? "");
        const text2 = String(args.text ?? "");
        const flags = String(args.flags ?? "g");
        outputText = testRegex(pattern, flags, text2);
        break;
      }
      case "codestation_json_schema": {
        outputText = generateJsonSchema(String(args.json ?? ""));
        break;
      }
      case "codestation_json_to_typescript": {
        const json = String(args.json ?? "");
        const rootName = args.rootName ? String(args.rootName) : "Root";
        outputText = jsonToTypescript(json, rootName);
        break;
      }
      case "codestation_json_to_zod": {
        const json = String(args.json ?? "");
        const rootName = args.rootName ? String(args.rootName) : "rootSchema";
        outputText = jsonToZod(json, rootName);
        break;
      }
      case "codestation_curl_to_code": {
        const curl = String(args.curl ?? "");
        const target = args.target ? String(args.target) : "fetch";
        const result = await curlToCode(curl, target);
        outputText = result.code;
        break;
      }
      case "codestation_env_audit": {
        const env = String(args.env ?? "");
        const example = args.example ? String(args.example) : void 0;
        const format = args.format ? String(args.format) : "report";
        const result = auditEnv(env, example);
        outputText = format === "json" ? JSON.stringify(result, null, 2) : formatEnvAuditReport(result);
        break;
      }
      case "codestation_mock_data": {
        const template = args.template ? String(args.template) : "users";
        const count = args.count ? Number(args.count) : 10;
        const format = args.format ? String(args.format) : "json";
        const tableName = args.tableName ? String(args.tableName) : void 0;
        const customSchema = args.customSchema;
        const result = generateMockDataset({ template, count, format, tableName, customSchema });
        outputText = format === "sql" && result.sql ? result.sql : result.json;
        break;
      }
      case "codestation_git_conflict": {
        const content = String(args.content ?? "");
        const strategy = args.strategy ? String(args.strategy) : "analyze";
        const result = parseAndResolveGitConflicts(content, strategy);
        if (strategy === "analyze") {
          outputText = formatConflictReport(result);
        } else {
          outputText = result.resolvedContent ?? content;
        }
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: outputText }]
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true
    };
  }
}
function createMcpServer(cliKey) {
  const license = resolveLicense(cliKey);
  const server = new Server(
    {
      name: "codestation-mcp",
      version: "1.2.1"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  const tools = MCP_TOOLS;
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return executeMcpTool(request.params.name, request.params.arguments || {}, license);
  });
  server.setRequestHandler(
    z.object({ method: z.literal("tools.list"), params: z.any().optional() }),
    async () => {
      return { tools };
    }
  );
  server.setRequestHandler(
    z.object({ method: z.literal("tools.describe"), params: z.any().optional() }),
    async (request) => {
      const params = request.params || {};
      const toolName = params.name || params.tool;
      const found = tools.find((t) => t.name === toolName);
      if (!found) {
        throw new Error(`Unknown tool: ${toolName}`);
      }
      const isPro = PRO_TOOLS.has(found.name);
      return {
        tool: found,
        accessLevel: isPro ? "pro" : "free",
        tier: isPro ? "pro" : "free"
      };
    }
  );
  server.setRequestHandler(
    z.object({ method: z.literal("tools.execute"), params: z.any().optional() }),
    async (request) => {
      const params = request.params || {};
      const toolName = params.name || params.tool;
      const toolArgs = params.arguments || params.parameters || {};
      return executeMcpTool(toolName, toolArgs, license);
    }
  );
  server.setRequestHandler(
    z.object({ method: z.literal("auth.status"), params: z.any().optional() }),
    async () => {
      return {
        authenticated: license.isPro,
        tier: license.tier,
        isPro: license.isPro,
        licenseKey: license.licenseKey ? license.licenseKey.slice(0, 8) + "..." : null
      };
    }
  );
  server.setRequestHandler(
    z.object({ method: z.literal("entitlements.status"), params: z.any().optional() }),
    async () => {
      return {
        tier: license.tier,
        isPro: license.isPro,
        active: true,
        entitlements: license.isPro ? ["all-tools", "offline-crypto", "high-volume-seeding", "pro-converters"] : ["free-tools", "standard-rate-limit"]
      };
    }
  );
  server.setRequestHandler(
    z.object({ method: z.literal("capabilities.list"), params: z.any().optional() }),
    async () => {
      return {
        capabilities: ["tools", "crypto", "offline", "pro-access", "zero-latency"]
      };
    }
  );
  return { server, license };
}

// mcp/setup.ts
import * as fs2 from "node:fs";
import * as path2 from "node:path";
import * as os2 from "node:os";
function getClaudeDesktopConfigPath() {
  const platform = process.platform;
  if (platform === "darwin") {
    return path2.join(os2.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path2.join(os2.homedir(), "AppData", "Roaming");
    return path2.join(appData, "Claude", "claude_desktop_config.json");
  } else {
    return path2.join(os2.homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
}
function getCursorGlobalConfigPath() {
  return path2.join(os2.homedir(), ".cursor", "mcp.json");
}
function getWindsurfConfigPath() {
  return path2.join(os2.homedir(), ".codeium", "windsurf", "mcp_config.json");
}
function mergeMcpConfig(filePath, mcpEntry) {
  try {
    const dir = path2.dirname(filePath);
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    let config = {};
    if (fs2.existsSync(filePath)) {
      try {
        const raw = fs2.readFileSync(filePath, "utf-8");
        config = JSON.parse(raw);
      } catch {
        config = {};
      }
    }
    if (!config.mcpServers || typeof config.mcpServers !== "object") {
      config.mcpServers = {};
    }
    config.mcpServers.codestation = mcpEntry;
    fs2.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    return { target: path2.basename(filePath), path: filePath, status: "configured" };
  } catch (err) {
    return {
      target: path2.basename(filePath),
      path: filePath,
      status: "error",
      message: err instanceof Error ? err.message : String(err)
    };
  }
}
async function runAutoSetup(licenseKey) {
  const cleanKey = licenseKey?.trim();
  if (cleanKey && validateLicenseKey(cleanKey)) {
    saveCachedLicense(cleanKey, true);
  }
  const mcpEntry = {
    command: "npx",
    args: cleanKey ? ["-y", "codestation-mcp", "--key", cleanKey] : ["-y", "codestation-mcp"]
  };
  const targets = [
    { name: "Claude Desktop", path: getClaudeDesktopConfigPath() },
    { name: "Cursor IDE (Global)", path: getCursorGlobalConfigPath() },
    { name: "Windsurf / Codeium", path: getWindsurfConfigPath() }
  ];
  const localCursorPath = path2.join(process.cwd(), ".cursor", "mcp.json");
  if (fs2.existsSync(path2.join(process.cwd(), ".cursor"))) {
    targets.push({ name: "Cursor IDE (Local Project)", path: localCursorPath });
  }
  const results = [];
  for (const t of targets) {
    const res = mergeMcpConfig(t.path, mcpEntry);
    res.target = t.name;
    results.push(res);
  }
  return results;
}

// mcp/cli-tools.ts
import * as fs3 from "node:fs";

// lib/tools/cron/next-run.ts
var DAY2 = 864e5;
var SIX_HOURS = 6 * 36e5;
var pad3 = (value, width = 2) => String(value).padStart(width, "0");
function parseCronReference(reference) {
  if (reference.length > 64) throw new Error("Reference exceeds the 64-character limit.");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(reference);
  if (!match) throw new Error("Reference must be an absolute ISO date/time: YYYY-MM-DDTHH:mm[:ss[.sss]] followed by Z or \xB1HH:mm.");
  const [year, month, day, hour, minute, second] = [match[1], match[2], match[3], match[4], match[5], match[6] ?? "0"].map(Number);
  if (year < 1970 || year > 2099) throw new Error("Reference years must be between 1970 and 2099.");
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days || hour > 23 || minute > 59 || second > 59) throw new Error("Reference contains an impossible calendar date or time.");
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  let offset = 0;
  if (match[8] !== "Z") {
    const offsetHour = Number(match[8].slice(1, 3));
    const offsetMinute = Number(match[8].slice(4, 6));
    if (offsetMinute > 59 || offsetHour > 14 || offsetHour === 14 && offsetMinute !== 0) throw new Error("Reference offset must be within \xB114:00, with valid minutes.");
    offset = (offsetHour * 60 + offsetMinute) * 6e4 * (match[8][0] === "-" ? -1 : 1);
  }
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds) - offset;
  const utcYear = new Date(instant).getUTCFullYear();
  if (utcYear < 1970 || utcYear > 2099) throw new Error("Reference instant must fall within UTC years 1970\u20132099.");
  return instant;
}
function zoneFormatter2(timezone) {
  if (!timezone || timezone !== timezone.trim()) throw new Error("Select a nonempty IANA timezone.");
  if (timezone.length > 128 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(timezone)) throw new Error("Enter a valid IANA timezone name; numeric offsets are not timezone names.");
  try {
    return new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
  } catch {
    throw new Error("Timezone is not a recognized IANA timezone in this runtime.");
  }
}
function wallTime(formatter, instant) {
  const parts = formatter.formatToParts(instant);
  const get = (name) => Number(parts.find((part) => part.type === name)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}
function offsetAt(formatter, instant) {
  const wholeSecond = Math.floor(instant / 1e3) * 1e3;
  const wall = wallTime(formatter, wholeSecond);
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - wholeSecond;
}
function offsetIntervals(formatter, midnight) {
  const start = midnight - 2 * DAY2;
  const end = midnight + 3 * DAY2;
  const intervals = [];
  let intervalStart = start;
  let priorOffset = offsetAt(formatter, start);
  for (let probe = start + SIX_HOURS; probe <= end; probe += SIX_HOURS) {
    const nextOffset = offsetAt(formatter, probe);
    if (nextOffset !== priorOffset) {
      let low = probe - SIX_HOURS;
      let high = probe;
      while (high - low > 1e3) {
        const middle = Math.floor((low + high) / 2e3) * 1e3;
        if (offsetAt(formatter, middle) === priorOffset) low = middle;
        else high = middle;
      }
      intervals.push({ start: intervalStart, end: high, offset: priorOffset });
      intervalStart = high;
      priorOffset = nextOffset;
    }
  }
  intervals.push({ start: intervalStart, end, offset: priorOffset });
  return intervals;
}
function selectedSecond(cron, lower, upper) {
  if (lower >= upper || lower >= 86400) return void 0;
  lower = Math.max(0, Math.ceil(lower));
  const firstHour = Math.floor(lower / 3600);
  for (const hour of cron.hour.values) {
    if (hour < firstHour) continue;
    const firstMinute = hour === firstHour ? Math.floor(lower % 3600 / 60) : 0;
    for (const minute of cron.minute.values) {
      if (minute < firstMinute) continue;
      const base = hour * 3600 + minute * 60;
      if (base >= upper) return void 0;
      const second = cron.second.values.find((value) => base + value >= lower);
      if (second !== void 0) return base + second < upper ? base + second : void 0;
    }
  }
  return void 0;
}
function formatCronDuration(milliseconds) {
  if (!Number.isSafeInteger(milliseconds)) throw new Error("Duration is outside supported integer precision.");
  const sign = milliseconds < 0 ? "-" : "+";
  let remainder = Math.abs(milliseconds);
  const pieces = [];
  for (const [size, name] of [[DAY2, "day"], [36e5, "hour"], [6e4, "minute"], [1e3, "second"], [1, "millisecond"]]) {
    const count = Math.floor(remainder / size);
    remainder %= size;
    if (count) pieces.push(`${count} ${name}${count === 1 ? "" : "s"}`);
  }
  return sign + (pieces.join(", ") || "0 seconds");
}
function nextCronRun(expression, reference, timezone) {
  const cron = typeof expression === "string" ? parseCron(expression) : expression;
  const instant = parseCronReference(reference);
  const formatter = zoneFormatter2(timezone);
  const referenceWall = wallTime(formatter, instant);
  if (referenceWall.year < 1970 || referenceWall.year > 2099) throw new Error("Reference in the selected timezone must fall within years 1970\u20132099.");
  const referenceDay = Date.UTC(referenceWall.year, referenceWall.month - 1, referenceWall.day);
  const firstDay = Math.max(Date.UTC(1970, 0, 1), referenceDay - 2 * DAY2);
  const searchEnd = Math.min(Date.UTC(2100, 0, 1), Date.UTC(referenceWall.year + 8, referenceWall.month - 1, referenceWall.day + 1));
  const utcReference = new Date(instant);
  const eightYearLimit = Date.UTC(utcReference.getUTCFullYear() + 8, utcReference.getUTCMonth(), utcReference.getUTCDate(), utcReference.getUTCHours(), utcReference.getUTCMinutes(), utcReference.getUTCSeconds(), utcReference.getUTCMilliseconds());
  const absoluteEnd = Math.min(Date.UTC(2100, 0, 1), eightYearLimit + 1);
  let best;
  let bestOffset = 0;
  for (let midnight = firstDay; midnight < searchEnd; midnight += DAY2) {
    if (best !== void 0 && midnight - DAY2 > best) break;
    const date = new Date(midnight);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (!matchesCronDate(cron, year, month, day)) continue;
    for (const interval of offsetIntervals(formatter, midnight)) {
      const lowerUtc = Math.max(interval.start, instant + 1, midnight - interval.offset, Date.UTC(1970, 0, 1));
      const upperUtc = Math.min(interval.end, midnight + DAY2 - interval.offset, absoluteEnd, best ?? Infinity);
      const second = selectedSecond(cron, (lowerUtc + interval.offset - midnight) / 1e3, (upperUtc + interval.offset - midnight) / 1e3);
      if (second === void 0) continue;
      const candidate = midnight + second * 1e3 - interval.offset;
      const actual = wallTime(formatter, candidate);
      if (actual.year !== year || actual.month !== month || actual.day !== day || actual.hour !== Math.floor(second / 3600) || actual.minute !== Math.floor(second % 3600 / 60) || actual.second !== second % 60) continue;
      if (candidate > instant && (best === void 0 || candidate < best)) {
        best = candidate;
        bestOffset = interval.offset;
      }
    }
  }
  if (best === void 0) throw new Error("No occurrence found within eight calendar years after the reference, ending no later than 2099. The expression may select impossible calendar dates.");
  if (bestOffset % 6e4 !== 0) throw new Error("This historical timezone offset includes seconds and cannot be represented by an RFC 3339 \xB1HH:mm offset; choose a reference after the zone adopted minute-based offsets.");
  const wall = wallTime(formatter, best);
  const offsetMinutes = Math.abs(bestOffset / 6e4);
  const offset = `${bestOffset < 0 ? "-" : "+"}${pad3(Math.floor(offsetMinutes / 60))}:${pad3(offsetMinutes % 60)}`;
  const dateTime = `${pad3(wall.year, 4)}-${pad3(wall.month)}-${pad3(wall.day)}T${pad3(wall.hour)}:${pad3(wall.minute)}:${pad3(wall.second)}${offset}[${timezone}]`;
  const durationMilliseconds = best - instant;
  return { instant: best, dateTime, timezone, durationMilliseconds, duration: formatCronDuration(durationMilliseconds) };
}

// mcp/cli-tools.ts
function stripAnsi(text2) {
  return text2.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}
async function readInput(arg) {
  if (arg && arg !== "-" && !arg.startsWith("-")) {
    if (fs3.existsSync(arg)) {
      return fs3.readFileSync(arg, "utf-8");
    }
    return arg;
  }
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data.trim()));
      process.stdin.on("error", reject);
    });
  }
  return "";
}
async function handleCliSubcommand(command, args) {
  const isNoColor = args.includes("--no-color") || process.env.NO_COLOR !== void 0;
  const isJson = args.includes("--json");
  const isHelp = args.includes("--help") || args.includes("-h");
  const out = (text2) => {
    process.stdout.write(isNoColor ? stripAnsi(text2) : text2);
  };
  const err = (text2) => {
    process.stderr.write(isNoColor ? stripAnsi(text2) : text2);
  };
  const cmd = command.toLowerCase();
  switch (cmd) {
    // -------------------------------------------------------------
    // STATUS
    // -------------------------------------------------------------
    case "status": {
      if (isHelp) {
        out("Usage: codestation status [--json] [--no-color]\nView Code Station license tier, active tools, and local MCP readiness.\n");
        return { handled: true, exitCode: 0 };
      }
      const license = resolveLicense();
      if (isJson) {
        out(
          JSON.stringify(
            {
              name: "Code Station",
              version: "1.2.1",
              license: {
                tier: license.tier,
                isPro: license.isPro,
                keyConfigured: Boolean(license.licenseKey)
              },
              toolCount: SHARED_TOOLS.length,
              privacy: "local-only",
              mcpReady: true
            },
            null,
            2
          ) + "\n"
        );
      } else {
        out("\n=== CODE STATION STATUS ===\n");
        out("Version:     1.2.1\n");
        out(`License:     ${license.isPro ? "PRO TIER (Active)" : "FREE TIER (Pro key not active)"}
`);
        out(`Tools:       ${SHARED_TOOLS.length} registered tools across Web, CLI & MCP
`);
        out("MCP Server:  Ready (Stdio transport)\n");
        out("Privacy:     Zero telemetry, memory-only execution\n\n");
      }
      return { handled: true, exitCode: 0 };
    }
    // -------------------------------------------------------------
    // cURL to Any Language Generator
    // -------------------------------------------------------------
    case "curl":
    case "curl-to-code":
    case "curl-to-any-language": {
      if (isHelp) {
        out('Usage: codestation curl-to-any-language "<curl_command>" [--target fetch|axios|python|go] [--json]\n');
        return { handled: true, exitCode: 0 };
      }
      const rawArg = args.find((a) => !a.startsWith("-"));
      const input = await readInput(rawArg);
      if (!input || !input.trim()) {
        err("Error: cURL command is required (provide as argument or via stdin).\n");
        return { handled: true, exitCode: 1 };
      }
      let target = "fetch";
      const targetIdx = args.indexOf("--target");
      if (targetIdx !== -1 && args[targetIdx + 1]) {
        target = args[targetIdx + 1].toLowerCase();
      }
      try {
        const res = await curlToCode(input, target);
        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else {
          out(res.code + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // Environment & Secret Leak Scanner
    // -------------------------------------------------------------
    case "env":
    case "audit-env":
    case "env-audit": {
      if (isHelp) {
        out("Usage: codestation env-audit [path/.env] [--example path/.env.example] [--json]\n");
        return { handled: true, exitCode: 0 };
      }
      let envContent = "";
      let envPath;
      const pathArg = args.find((a) => !a.startsWith("-"));
      if (pathArg && fs3.existsSync(pathArg)) {
        envPath = pathArg;
        envContent = fs3.readFileSync(pathArg, "utf-8");
      } else if (pathArg) {
        envContent = pathArg;
      } else if (fs3.existsSync(".env")) {
        envPath = ".env";
        envContent = fs3.readFileSync(".env", "utf-8");
      } else {
        envContent = await readInput();
      }
      if (!envContent || !envContent.trim()) {
        err("Error: No environment file or content provided to scan.\n");
        return { handled: true, exitCode: 1 };
      }
      let exampleContent;
      const exIdx = args.indexOf("--example");
      if (exIdx !== -1 && args[exIdx + 1] && fs3.existsSync(args[exIdx + 1])) {
        exampleContent = fs3.readFileSync(args[exIdx + 1], "utf-8");
      } else if (fs3.existsSync(".env.example")) {
        exampleContent = fs3.readFileSync(".env.example", "utf-8");
      }
      try {
        const res = auditEnv(envContent, { example: exampleContent, filePath: envPath });
        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else {
          out(formatEnvAuditReport(res) + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // Mock Data & SQL Seeder
    // -------------------------------------------------------------
    case "mock":
    case "seeder":
    case "mock-data": {
      if (isHelp) {
        out("Usage: codestation mock-data [users|products|orders|custom] [--count <n>] [--format json|sql|csv] [--seed <n>]\n");
        return { handled: true, exitCode: 0 };
      }
      let template = "users";
      const tmplArg = args.find((a) => !a.startsWith("-"));
      if (tmplArg && ["users", "products", "orders", "custom"].includes(tmplArg.toLowerCase())) {
        template = tmplArg.toLowerCase();
      }
      let count = 10;
      const countIdx = args.indexOf("--count");
      if (countIdx !== -1 && args[countIdx + 1]) {
        count = parseInt(args[countIdx + 1], 10);
      }
      let format = "json";
      if (args.includes("--sql")) format = "sql";
      else if (args.includes("--csv")) format = "csv";
      const formatIdx = args.indexOf("--format");
      if (formatIdx !== -1 && args[formatIdx + 1]) {
        format = args[formatIdx + 1].toLowerCase();
      }
      let tableName;
      const tableIdx = args.indexOf("--table");
      if (tableIdx !== -1 && args[tableIdx + 1]) {
        tableName = args[tableIdx + 1];
      }
      let dialect = "postgresql";
      const dialectIdx = args.indexOf("--dialect");
      if (dialectIdx !== -1 && args[dialectIdx + 1]) {
        dialect = args[dialectIdx + 1].toLowerCase();
      }
      let seed;
      const seedIdx = args.indexOf("--seed");
      if (seedIdx !== -1 && args[seedIdx + 1]) {
        seed = parseInt(args[seedIdx + 1], 10);
      }
      try {
        const res = generateMockDataset({
          template,
          count,
          format,
          tableName,
          dialect,
          seed
        });
        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else if (format === "sql") {
          out((res.sql || res.json) + "\n");
        } else if (format === "csv") {
          out((res.csv || res.json) + "\n");
        } else {
          out(res.json + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // Git Merge Conflict Resolver
    // -------------------------------------------------------------
    case "conflict":
    case "git-conflict":
    case "conflict-parse": {
      if (isHelp) {
        out("Usage: codestation conflict-parse <file_or_content> [--strategy analyze|ours|theirs|both] [--json]\n");
        return { handled: true, exitCode: 0 };
      }
      const fileArg = args.find((a) => !a.startsWith("-"));
      const input = await readInput(fileArg);
      if (!input || !input.trim()) {
        err("Error: Conflict file path or content required.\n");
        return { handled: true, exitCode: 1 };
      }
      let strategy = "analyze";
      const stratIdx = args.indexOf("--strategy");
      if (stratIdx !== -1 && args[stratIdx + 1]) {
        strategy = args[stratIdx + 1].toLowerCase();
      }
      try {
        const res = parseAndResolveGitConflicts(input, strategy);
        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else if (strategy === "analyze") {
          out(formatConflictReport(res) + "\n");
        } else {
          out((res.resolvedContent ?? input) + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // JWT Decoder
    // -------------------------------------------------------------
    case "jwt": {
      if (isHelp) {
        out("Usage: codestation jwt <token> [--json]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JWT token required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const decoded = JSON.parse(decodeJwt(input));
        if (isJson) {
          out(JSON.stringify(decoded, null, 2) + "\n");
        } else {
          out("\n=== JWT HEADER ===\n" + JSON.stringify(decoded.header, null, 2) + "\n");
          out("\n=== JWT PAYLOAD ===\n" + JSON.stringify(decoded.payload, null, 2) + "\n\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // SQL Formatter
    // -------------------------------------------------------------
    case "sql": {
      if (isHelp) {
        out('Usage: codestation sql "<query>" [--dialect postgresql|mysql|sqlite]\n');
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: SQL query required.\n");
        return { handled: true, exitCode: 1 };
      }
      let dialect = "postgresql";
      const dialectIdx = args.indexOf("--dialect");
      if (dialectIdx !== -1 && args[dialectIdx + 1]) {
        dialect = args[dialectIdx + 1].toLowerCase();
      }
      try {
        const { format } = await import("sql-formatter");
        const formatted = format(input, { language: dialect, tabWidth: 2 });
        out(formatted + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // Cron Explainer
    // -------------------------------------------------------------
    case "cron": {
      if (isHelp) {
        out('Usage: codestation cron "<expression>" [--json]\n');
        return { handled: true, exitCode: 0 };
      }
      const input = args.filter((a) => !a.startsWith("-")).join(" ").trim();
      if (!input) {
        err("Error: Cron expression required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const parsed = parseCron(input);
        const explanation = explainCron(parsed);
        const next = nextCronRun(parsed, (/* @__PURE__ */ new Date()).toISOString(), "UTC");
        if (isJson) {
          out(JSON.stringify({ expression: input, description: explanation, nextRun: next.dateTime }, null, 2) + "\n");
        } else {
          out(`
Expression:  ${input}
Description: ${explanation}
Next run:    ${next.dateTime} (${next.duration})

`);
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // Hasher
    // -------------------------------------------------------------
    case "hash": {
      if (isHelp) {
        out('Usage: codestation hash "<text>" [--alg sha256|sha512|md5|sha1|crc32]\n');
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: Text required to hash.\n");
        return { handled: true, exitCode: 1 };
      }
      let alg = "sha256";
      const algIdx = args.indexOf("--alg");
      if (algIdx !== -1 && args[algIdx + 1]) {
        alg = args[algIdx + 1].toLowerCase();
      }
      try {
        let result = "";
        if (alg === "sha256") result = await sha256(input);
        else if (alg === "sha512") result = await sha512(input);
        else if (alg === "md5") result = md5(input);
        else if (alg === "sha1") result = sha1(input);
        else if (alg === "crc32") result = crc32(input);
        else result = await sha256(input);
        if (isJson) {
          out(JSON.stringify({ algorithm: alg, digest: result }, null, 2) + "\n");
        } else {
          out(`${alg.toUpperCase()}: ${result}
`);
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // JSON to TypeScript Interfaces
    // -------------------------------------------------------------
    case "ts":
    case "types": {
      if (isHelp) {
        out('Usage: codestation ts "<json_payload>" [RootName]\n');
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JSON input required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const rootName = args[1] || "Root";
        out(jsonToTypescript(input, rootName) + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // JSON to Zod Schema
    // -------------------------------------------------------------
    case "zod": {
      if (isHelp) {
        out('Usage: codestation zod "<json_payload>" [rootSchema]\n');
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JSON input required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const rootName = args[1] || "rootSchema";
        out(jsonToZod(input, rootName) + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    // -------------------------------------------------------------
    // UUID Generator
    // -------------------------------------------------------------
    case "uuid": {
      if (isHelp) {
        out("Usage: codestation uuid [count]\n");
        return { handled: true, exitCode: 0 };
      }
      const count = Math.min(Math.max(parseInt(args[0], 10) || 1, 1), 100);
      for (let i = 0; i < count; i++) {
        out(crypto.randomUUID() + "\n");
      }
      return { handled: true, exitCode: 0 };
    }
    // -------------------------------------------------------------
    // JSON Formatter
    // -------------------------------------------------------------
    case "json": {
      if (isHelp) {
        out('Usage: codestation json "<raw_json>"\n');
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JSON input required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        out(formatJson(input, 2) + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}
`);
        return { handled: true, exitCode: 1 };
      }
    }
    default:
      return { handled: false, exitCode: 0 };
  }
}

// mcp/cli.ts
var PRO_ASCII_BADGE = `
  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
  \u2502  CODE STATION [PRO]  \u2022  LOCAL MCP & DEVELOPER TOOLBOX    \u2502
  \u2502  Zero-Latency Engine  \u2022  Device Memory  \u2022  Edge Crypto   \u2502
  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`;
function printHelp() {
  process.stderr.write(`
Code Station MCP Server & Developer CLI
Local-first developer toolbox for AI assistants (Cursor, Claude Desktop, Windsurf) and terminal workflows.

Usage:
  npx codestation-mcp [command|options]

1-Click AI Assistant Setup:
  npx codestation-mcp setup [--key <license_key>]
    Automatically configures Claude Desktop, Cursor IDE, and Windsurf.

Terminal Subcommands:
  jwt <token>                   Decode & inspect JWT header, payload, and expiry
  sql "<query>" [--dialect]     Format SQL query (postgresql, mysql, sqlite, sqlserver)
  cron "<expression>"           Explain cron schedule & project next 5 runtimes
  hash "<text>" [--alg]         Compute digest (sha256, sha512, md5, sha1, crc32)
  ts "<json_string|file>"       Generate clean TypeScript interfaces from JSON
  zod "<json_string|file>"      Generate production-ready Zod schema from JSON
  curl "<curl_cmd>" [--target]  Convert cURL to fetch, axios, python, or go
  env [path/.env] [--example]   Audit .env for leaked secrets & diff with .env.example
  mock [template] [--count]     Generate realistic mock data (users, products, orders)
  conflict <file> [--strategy]  Parse & resolve Git merge conflicts (ours, theirs, both)
  uuid [count]                  Generate random RFC 4122 v4 UUIDs
  json "<raw_json>"             Validate & pretty-print JSON

Stdio Server Options (for AI Assistants):
  --key <license_key>           Activate Code Station Pro features
  --help, -h                    Show this help message
  --version, -v                 Show version information

Pricing:
  \u2022 Free Tier:                  Unlimited Base64, JSON, YAML, UUID, Text Diff, Case conversion
  \u2022 Pro Tier (India):           ${PRICING.inr} (or ${PRICING.lifetimeInr})
  \u2022 Pro Tier (Global):          ${PRICING.usd} (or ${PRICING.lifetimeUsd})
  \u2022 Upgrade / Account:          ${PRICING.upgradeUrl}

`);
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) {
    process.stderr.write("codestation-mcp v1.2.1\n");
    process.exit(0);
  }
  if (args[0] === "setup") {
    let key;
    const keyIdx = args.indexOf("--key");
    if (keyIdx !== -1 && args[keyIdx + 1]) {
      key = args[keyIdx + 1];
    }
    process.stdout.write("\n=== Code Station 1-Click AI Setup ===\n");
    if (key) {
      process.stdout.write(`Activating with Pro Key: ${key.slice(0, 8)}...
`);
    } else {
      process.stdout.write("Configuring in Free Tier mode (run with --key anytime to activate Pro).\n");
    }
    const results = await runAutoSetup(key);
    for (const r of results) {
      if (r.status === "configured") {
        process.stdout.write(`  \u2714 ${r.target.padEnd(26)} Configured (${r.path})
`);
      } else {
        process.stdout.write(`  \u2716 ${r.target.padEnd(26)} Error: ${r.message}
`);
      }
    }
    process.stdout.write("\n\u2728 Setup complete! Restart your editor(s) to start using Code Station tools.\n\n");
    process.exit(0);
  }
  if (args.length > 0 && !args[0].startsWith("-")) {
    const res = await handleCliSubcommand(args[0], args.slice(1));
    if (res.handled) {
      process.exit(res.exitCode);
    }
  }
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  let cliKey;
  const keyIndex = args.indexOf("--key");
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    cliKey = args[keyIndex + 1];
  }
  const { server, license } = createMcpServer(cliKey);
  if (license.isPro) {
    process.stderr.write(PRO_ASCII_BADGE);
    process.stderr.write(`[Code Station MCP] Pro Tier Active (License: ${license.licenseKey?.slice(0, 8)}...). All tools unlocked.
`);
  } else {
    process.stderr.write(
      `[Code Station MCP] Running in Free Tier. Pro tools available at ${PRICING.inr} / ${PRICING.usd} (${PRICING.upgradeUrl})
`
    );
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[Code Station MCP] Connected to stdio. Ready for tool requests.\n");
}
main().catch((err) => {
  process.stderr.write(`[Code Station MCP Error] ${err instanceof Error ? err.stack : String(err)}
`);
  process.exit(1);
});
