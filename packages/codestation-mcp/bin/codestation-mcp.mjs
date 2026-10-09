#!/usr/bin/env node

// mcp/cli.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

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
  "codestation_json_to_zod"
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
function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}
function calendarText(parts) {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}
function clockText(parts) {
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(parts.millisecond, 3)}`;
}
function offsetText(milliseconds) {
  if (!milliseconds) return "Z";
  const seconds = Math.abs(milliseconds) / SECOND;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return `${milliseconds < 0 ? "-" : "+"}${pad(hours)}:${pad(minutes)}${remainder ? `:${pad(remainder)}` : ""}`;
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
  const fail = (message) => {
    throw new Error(`${spec.label}: ${message}`);
  };
  if (expression.length > 128) fail("field exceeds the 128-character limit.");
  if (!expression) fail("field cannot be empty.");
  const endpoint = (text2) => {
    let value;
    if (/^\d+$/.test(text2)) value = Number(text2);
    else if (spec.name === "month" && MONTH_NAMES.includes(text2.toUpperCase())) value = MONTH_NAMES.indexOf(text2.toUpperCase()) + 1;
    else if (spec.name === "dayOfWeek" && WEEKDAY_NAMES.includes(text2.toUpperCase())) value = WEEKDAY_NAMES.indexOf(text2.toUpperCase());
    else return fail("use integer values, permitted month/weekday names, *, ranges, lists or steps.");
    if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) fail(`value must be between ${spec.min} and ${spec.max}.`);
    return value;
  };
  const selected = /* @__PURE__ */ new Set();
  for (const item of expression.split(",")) {
    if (!item) fail("lists cannot contain empty items.");
    const pieces = item.split("/");
    if (pieces.length > 2 || !pieces[0]) fail("malformed step notation.");
    let step = 1;
    if (pieces.length === 2) {
      if (!/^\d+$/.test(pieces[1])) fail("step must be a positive integer.");
      step = Number(pieces[1]);
      if (!Number.isSafeInteger(step) || step < 1 || step > spec.max - spec.min + 1) fail(`step must be between 1 and ${spec.max - spec.min + 1}.`);
    }
    const base = pieces[0];
    let first;
    let last;
    if (base === "*") {
      first = spec.min;
      last = spec.max;
    } else {
      const range = base.split("-");
      if (range.length > 2 || range.some((value) => !value)) fail("malformed range; negative values are not supported.");
      first = endpoint(range[0]);
      last = range.length === 2 ? endpoint(range[1]) : pieces.length === 2 ? spec.max : first;
      if (last < first) fail("descending or wrapping ranges are not supported.");
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
var pad2 = (value) => String(value).padStart(2, "0");
function explainCron(cron) {
  let timing;
  if (cron.hour.values.length === 1 && cron.minute.values.length === 1 && cron.second.values.length === 1) {
    timing = `At ${pad2(cron.hour.values[0])}:${pad2(cron.minute.values[0])}${cron.hasSeconds ? `:${pad2(cron.second.values[0])}` : ""}`;
  } else if (cron.hasSeconds && cron.hour.expression === "*" && cron.minute.expression === "*" && cron.second.expression === "*") timing = "Every second";
  else if (cron.hour.expression === "*" && cron.minute.expression === "*" && !cron.hasSeconds) timing = "Every minute (at second 0)";
  else if (cron.hour.expression === "*" && /^\*\/\d+$/.test(cron.minute.expression) && !cron.hasSeconds) timing = `Every ${Number(cron.minute.expression.slice(2))} minutes within each hour (at second 0)`;
  else if (cron.hour.expression === "*" && cron.minute.values.length === 1 && cron.second.values.length === 1) timing = `Every hour at minute ${cron.minute.values[0]}, second ${cron.second.values[0]}`;
  else timing = `${cron.hasSeconds ? "Seconds-first schedule" : "Unix schedule (at second 0)"}: hours ${cron.hour.expression === "*" ? "every hour" : cron.hour.values.map(pad2).join(", ")}; minutes ${cron.minute.expression === "*" ? "every minute" : cron.minute.values.map(pad2).join(", ")}${cron.hasSeconds ? `; seconds ${cron.second.expression === "*" ? "every second" : cron.second.values.map(pad2).join(", ")}` : ""}`;
  const months = cron.month.values.length === 12 ? "" : `; in ${cron.month.values.map((value) => FULL_MONTHS[value - 1]).join(", ")}`;
  const dom = cron.dayOfMonth.values.length === 31 ? "every day of month" : `day of month ${cron.dayOfMonth.values.join(", ")}`;
  const dow = cron.dayOfWeek.values.length === 7 ? "every weekday (Sunday\u2013Saturday)" : cron.dayOfWeek.values.map((value) => FULL_WEEKDAYS[value]).join(", ");
  const days = cron.dayMode === "or" ? `when either ${dom} OR weekday ${dow} matches` : cron.dayOfMonth.values.length === 31 && cron.dayOfWeek.values.length === 7 ? "every day" : cron.dayOfMonth.values.length === 31 ? `on ${dow}` : cron.dayOfWeek.values.length === 7 ? `on ${dom}` : `when both ${dom} AND weekday ${dow} match`;
  return `${timing}; ${days}${months}.`;
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

// mcp/server.ts
function createMcpServer(cliKey) {
  const license = resolveLicense(cliKey);
  const server = new Server(
    {
      name: "codestation-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  const tools = [
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
    }
  ];
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    if (PRO_TOOLS.has(name) && !license.isPro) {
      return {
        content: [
          {
            type: "text",
            text: getProUpgradeNotice(name)
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
  });
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
async function readInput(arg) {
  if (arg && arg !== "-") {
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
  switch (command.toLowerCase()) {
    case "jwt": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp jwt <jwt_token>\n");
        return true;
      }
      try {
        const decoded = JSON.parse(decodeJwt(input));
        process.stdout.write("\n=== JWT HEADER ===\n");
        process.stdout.write(JSON.stringify(decoded.header, null, 2) + "\n");
        process.stdout.write("\n=== JWT PAYLOAD ===\n");
        process.stdout.write(JSON.stringify(decoded.payload, null, 2) + "\n");
        if (decoded.payload.exp) {
          const expDate = new Date(decoded.payload.exp * 1e3);
          const isExpired = Date.now() > expDate.getTime();
          process.stdout.write(
            `
Expiry: ${expDate.toISOString()} (${isExpired ? "EXPIRED" : "Valid until " + expDate.toLocaleString()})

`
          );
        }
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}
`);
      }
      return true;
    }
    case "sql": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write('Usage: npx codestation-mcp sql "<query>" [--dialect postgresql|mysql|sqlite|sqlserver]\n');
        return true;
      }
      let dialect = "postgresql";
      const dialectIdx = args.indexOf("--dialect");
      if (dialectIdx !== -1 && args[dialectIdx + 1]) {
        dialect = args[dialectIdx + 1].toLowerCase();
      }
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
      try {
        const { format } = await import("sql-formatter");
        const formatted = format(input, { language: lang, tabWidth: 2 });
        process.stdout.write(formatted + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}
`);
      }
      return true;
    }
    case "cron": {
      const input = args.join(" ").replace(/--key\s+[^\s]+/g, "").trim();
      if (!input) {
        process.stderr.write('Usage: npx codestation-mcp cron "<cron_expression>"\nExample: npx codestation-mcp cron "0 9 * * 1-5"\n');
        return true;
      }
      try {
        const parsed = parseCron(input);
        const explanation = explainCron(parsed);
        const next = nextCronRun(parsed, (/* @__PURE__ */ new Date()).toISOString(), "UTC");
        process.stdout.write(`
Expression:  ${input}
`);
        process.stdout.write(`Description: ${explanation}
`);
        process.stdout.write(`Next run:    ${next.dateTime} (${next.duration})

`);
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}
`);
      }
      return true;
    }
    case "hash": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write('Usage: npx codestation-mcp hash "<string>" [--alg sha256|sha512|md5|sha1|crc32]\n');
        return true;
      }
      let alg = "sha256";
      const algIdx = args.indexOf("--alg");
      if (algIdx !== -1 && args[algIdx + 1]) {
        alg = args[algIdx + 1].toLowerCase();
      }
      let result = "";
      if (alg === "sha256") result = await sha256(input);
      else if (alg === "sha512") result = await sha512(input);
      else if (alg === "md5") result = md5(input);
      else if (alg === "sha1") result = sha1(input);
      else if (alg === "crc32") result = crc32(input);
      else result = await sha256(input);
      process.stdout.write(`${alg.toUpperCase()}: ${result}
`);
      return true;
    }
    case "ts":
    case "types": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write('Usage: npx codestation-mcp ts "<json_string_or_file>" [RootName]\n');
        return true;
      }
      const rootName = args[1] || "Root";
      try {
        const tsOutput = jsonToTypescript(input, rootName);
        process.stdout.write(tsOutput + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}
`);
      }
      return true;
    }
    case "zod": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write('Usage: npx codestation-mcp zod "<json_string_or_file>" [rootSchema]\n');
        return true;
      }
      const rootName = args[1] || "rootSchema";
      try {
        const zodOutput = jsonToZod(input, rootName);
        process.stdout.write(zodOutput + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}
`);
      }
      return true;
    }
    case "uuid": {
      const count = parseInt(args[0], 10) || 1;
      for (let i = 0; i < count; i++) {
        process.stdout.write(crypto.randomUUID() + "\n");
      }
      return true;
    }
    case "json": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write('Usage: npx codestation-mcp json "<raw_json>"\n');
        return true;
      }
      try {
        const formatted = formatJson(input, 2);
        process.stdout.write(formatted + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}
`);
      }
      return true;
    }
    default:
      return false;
  }
}

// mcp/cli.ts
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
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stderr.write("codestation-mcp v1.1.0\n");
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
    const handled = await handleCliSubcommand(args[0], args.slice(1));
    if (handled) {
      process.exit(0);
    }
  }
  let cliKey;
  const keyIndex = args.indexOf("--key");
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    cliKey = args[keyIndex + 1];
  }
  const { server, license } = createMcpServer(cliKey);
  if (license.isPro) {
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
