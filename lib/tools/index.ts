/** Small, dependency-free helpers for Code Station's local-first tools. */
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/** Format JSON after parsing it, throwing SyntaxError for invalid JSON. */
export function formatJson(value: string, indent = 2): string {
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) {
    throw new RangeError("indent must be an integer between 0 and 10");
  }
  return JSON.stringify(JSON.parse(value), null, indent);
}

/** Return true when `value` is a complete, valid JSON document. */
export function validateJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/** Parse and serialize JSON without insignificant whitespace. */
export function minifyJson(value: string): string {
  return JSON.stringify(JSON.parse(value));
}

export function jsonToYaml(value: string): string { return stringifyYaml(JSON.parse(value)); }
export function yamlToJson(value: string): string { return JSON.stringify(parseYaml(value), null, 2); }

function csvEscape(value: unknown): string { const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export function jsonToCsv(value: string): string {
  const rows = JSON.parse(value); if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Expected a JSON array of objects.");
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))]; return [keys.join(","), ...rows.map((row) => keys.map((key) => csvEscape(row[key])).join(","))].join("\n");
}
export function csvToJson(value: string): string {
  const rows = parseCsv(value); if (rows.length < 1 || rows[0].length === 0) throw new Error("Add a CSV header row before converting.");
  const headers = rows[0]; return JSON.stringify(rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2);
}
function parseCsv(value: string): string[][] { const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; for (let i = 0; i < value.length; i += 1) { const char = value[i]; if (char === '"' && quoted && value[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && value[i + 1] === "\n") i += 1; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += char; } if (cell || row.length) { row.push(cell); rows.push(row); } if (quoted) throw new Error("CSV contains an unclosed quoted field."); return rows; }
export function jsonDiff(left: string, right: string): string { const a = JSON.parse(left); const b = JSON.parse(right); return JSON.stringify(diffValue(a, b), null, 2); }
function diffValue(a: unknown, b: unknown): unknown { if (JSON.stringify(a) === JSON.stringify(b)) return { status: "unchanged", value: a }; if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) { const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(); return Object.fromEntries(keys.map((key) => [key, diffValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])])); } return { status: a === undefined ? "added" : b === undefined ? "removed" : "changed", before: a, after: b }; }
export function jsonTree(value: string): string { return JSON.stringify(JSON.parse(value), null, 2); }

export function generateJsonSchema(value: string): string {
  const sample = JSON.parse(value);
  const infer = (node: unknown): Record<string, unknown> => {
    if (node === null) return { type: "null" };
    if (Array.isArray(node)) return { type: "array", items: node.length ? infer(node[0]) : {} };
    if (typeof node === "object") { const properties = Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([key, child]) => [key, infer(child)])); return { type: "object", properties, required: Object.keys(properties), additionalProperties: false }; }
    return { type: typeof node === "number" && Number.isInteger(node) ? "integer" : typeof node };
  };
  return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...infer(sample) }, null, 2);
}

export function testJsonPath(value: string, expression: string): string {
  const root = JSON.parse(value); const query = expression.trim();
  if (!query.startsWith("$")) throw new Error("JSONPath must start with $.");
  const tokens = query.slice(1).match(/(?:\.([A-Za-z_$][\w$-]*)|\[([0-9]+|\*)\])/g) ?? [];
  if (tokens.join("") !== query.slice(1)) throw new Error("Supported JSONPath syntax: $.property, $[0], and $[*].");
  let current: unknown[] = [root];
  for (const token of tokens) { const next: unknown[] = []; for (const item of current) { if (token.startsWith(".")) { const key = token.slice(1); if (item && typeof item === "object" && !Array.isArray(item) && key in item) next.push((item as Record<string, unknown>)[key]); } else { const selector = token.slice(1, -1); if (!Array.isArray(item)) continue; if (selector === "*") next.push(...item); else if (item[Number(selector)] !== undefined) next.push(item[Number(selector)]); } } current = next; }
  return JSON.stringify({ expression: query, count: current.length, matches: current }, null, 2);
}

function jsonLines(value: string): unknown[] { const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); if (!lines.length) throw new Error("Add at least one JSON Lines record."); return lines.map((line, index) => { try { return JSON.parse(line); } catch { throw new Error(`Invalid JSON Lines record at line ${index + 1}.`); } }); }
export function formatJsonLines(value: string): string { return jsonLines(value).map((record) => JSON.stringify(record, null, 2)).join("\n\n"); }
export function validateJsonLines(value: string): string { const records = jsonLines(value); return `Valid JSON Lines: ${records.length} record${records.length === 1 ? "" : "s"}.`; }
export function jsonToJsonLines(value: string): string { const parsed = JSON.parse(value); if (!Array.isArray(parsed)) throw new Error("JSON to JSON Lines expects a top-level array."); return parsed.map((record) => JSON.stringify(record)).join("\n"); }
export function jsonLinesToJson(value: string): string { return JSON.stringify(jsonLines(value), null, 2); }

function decodeBase64Url(value: string): string { return decodeBase64(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)); }
export function decodeJwt(value: string): string { const parts = value.trim().split("."); if (parts.length !== 3) throw new Error("A JWT must contain three dot-separated sections."); try { return JSON.stringify({ header: JSON.parse(decodeBase64Url(parts[0])), payload: JSON.parse(decodeBase64Url(parts[1])), signature: parts[2], note: "Decoded for inspection only. Signature validity was not verified." }, null, 2); } catch { throw new Error("JWT header and payload must contain valid Base64URL-encoded JSON."); } }
const htmlEntities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function encodeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => htmlEntities[character]); }
export function decodeHtml(value: string): string { const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }; return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (_, entity: string) => entity.startsWith("#x") ? String.fromCodePoint(parseInt(entity.slice(2), 16)) : entity.startsWith("#") ? String.fromCodePoint(parseInt(entity.slice(1), 10)) : named[entity.toLowerCase()] ?? `&${entity};`); }
export function encodeUnicode(value: string): string { return Array.from(value, (character) => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(" "); }
export function decodeUnicode(value: string): string { const points = value.match(/(?:U\+|\\u\{?)([\da-f]{2,6})\}?/gi); if (!points || points.join(" ").replace(/\s/g, "") !== value.replace(/\s/g, "")) throw new Error("Use Unicode values such as U+1F680 or U+0041."); return points.map((point) => String.fromCodePoint(parseInt(point.replace(/U\+|\\u\{|\\u/gi, ""), 16))).join(""); }
export function encodeHex(value: string): string { return utf8Encode(value).map((byte) => byte.toString(16).padStart(2, "0")).join(" "); }
export function decodeHex(value: string): string { const clean = value.replace(/[\s:-]/g, ""); if (!/^(?:[\da-f]{2})+$/i.test(clean)) throw new Error("Enter hexadecimal bytes, for example 48 65 6C 6C 6F."); return utf8Decode(clean.match(/../g)!.map((byte) => parseInt(byte, 16))); }
export async function digestText(value: string, algorithm: "SHA-256" | "SHA-512"): Promise<string> { if (!globalThis.crypto?.subtle) throw new Error("Web Crypto hashing is unavailable in this browser."); const bytes = new TextEncoder().encode(value); const digest = await globalThis.crypto.subtle.digest(algorithm, bytes); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
export function generateRandomString(length: number, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"): string { if (!Number.isInteger(length) || length < 1 || length > 512) throw new RangeError("Length must be an integer between 1 and 512."); if (!alphabet) throw new RangeError("Alphabet must not be empty."); return Array.from(randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join(""); }
export function testRegex(pattern: string, flags: string, text: string): string { let regex: RegExp; try { regex = new RegExp(pattern, flags); } catch (cause) { throw new Error(cause instanceof Error ? cause.message : "Invalid regular expression."); } const matches: Array<Record<string, unknown>> = []; if (!regex.global) { const match = regex.exec(text); if (match) matches.push({ match: match[0], index: match.index, groups: match.groups ?? {}, captures: match.slice(1) }); } else { let match: RegExpExecArray | null; while ((match = regex.exec(text)) !== null) { matches.push({ match: match[0], index: match.index, groups: match.groups ?? {}, captures: match.slice(1) }); if (match[0] === "") regex.lastIndex += 1; } } return JSON.stringify({ count: matches.length, matches }, null, 2); }

function utf8Encode(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    let code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + next - 0xdc00;
        i += 1;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

function utf8Decode(bytes: number[]): string {
  let result = "";
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++];
    let code: number;
    if (first < 0x80) code = first;
    else if (first >= 0xc2 && first <= 0xdf && i < bytes.length) code = ((first & 31) << 6) | (bytes[i++] & 63);
    else if (first >= 0xe0 && first <= 0xef && i + 1 < bytes.length) code = ((first & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else if (first >= 0xf0 && first <= 0xf4 && i + 2 < bytes.length) code = ((first & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else throw new Error("Invalid UTF-8 data");
    if (code <= 0xffff) result += String.fromCharCode(code);
    else { const n = code - 0x10000; result += String.fromCharCode(0xd800 | (n >> 10), 0xdc00 | (n & 1023)); }
  }
  return result;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode UTF-8 text as standard Base64. */
export function encodeBase64(value: string): string {
  const bytes = utf8Encode(value);
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]; const b = bytes[i + 1]; const c = bytes[i + 2];
    output += BASE64[a >> 2] + BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    output += b === undefined ? "=" : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    output += c === undefined ? "=" : BASE64[c & 63];
  }
  return output;
}

/** Decode standard Base64 UTF-8 text; throws for malformed input. */
export function decodeBase64(value: string): string {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Invalid Base64 string");
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 4) {
    const a = BASE64.indexOf(value[i]); const b = BASE64.indexOf(value[i + 1]);
    const c = value[i + 2] === "=" ? 0 : BASE64.indexOf(value[i + 2]);
    const d = value[i + 3] === "=" ? 0 : BASE64.indexOf(value[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (value[i + 2] !== "=") bytes.push(((b & 15) << 4) | (c >> 2));
    if (value[i + 3] !== "=") bytes.push(((c & 3) << 6) | d);
  }
  return utf8Decode(bytes);
}

/** Percent-encode text for use as a URL component. */
export function encodeUrl(value: string): string { return encodeURIComponent(value); }

/** Decode a percent-encoded URL component. */
export function decodeUrl(value: string): string { return decodeURIComponent(value); }

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) throw new Error("Secure random generation is unavailable in this browser.");
  return cryptoObject.getRandomValues(bytes);
}

/** Generate a RFC 4122 version 4 UUID. */
export function generateUuid(): string {
  const bytes = randomBytes(16); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  return [bytes.slice(0, 4), bytes.slice(4, 6), bytes.slice(6, 8), bytes.slice(8, 10), bytes.slice(10)].map((part) => Array.from(part, (n) => n.toString(16).padStart(2, "0")).join("")).join("-");
}

/** Options controlling password length and the characters eligible for selection. */
export interface PasswordOptions { length?: number; alphabet?: string; }

/** Generate a random password. Defaults to 16 characters from a printable-safe alphabet. */
export function generatePassword(options: PasswordOptions = {}): string {
  const length = options.length ?? 16; const alphabet = options.alphabet ?? "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  if (!Number.isInteger(length) || length < 1) throw new RangeError("length must be a positive integer");
  if (!alphabet.length) throw new RangeError("alphabet must not be empty");
  if (length > 512) throw new RangeError("length must be an integer between 1 and 512");
  const characters: string[] = [];
  const limit = 256 - (256 % alphabet.length);
  while (characters.length < length) {
    for (const byte of randomBytes(Math.max(16, Math.min(512, (length - characters.length) * 2)))) {
      if (byte < limit) characters.push(alphabet[byte % alphabet.length]);
      if (characters.length === length) break;
    }
  }
  return characters.join("");
}

/** Unit used by Unix timestamp conversion helpers. */
export type TimestampUnit = "seconds" | "milliseconds";

/** Convert a Unix timestamp to a Date. */
export function timestampToDate(timestamp: number, unit: TimestampUnit = "seconds"): Date {
  if (!Number.isFinite(timestamp)) throw new TypeError("timestamp must be finite");
  const date = new Date(unit === "seconds" ? timestamp * 1000 : timestamp);
  if (Number.isNaN(date.getTime())) throw new RangeError("timestamp is out of range");
  return date;
}

/** Convert a Date (or parseable date value) to a Unix timestamp. */
export function dateToTimestamp(value: Date | string | number, unit: TimestampUnit = "seconds"): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) throw new RangeError("invalid date");
  return unit === "seconds" ? Math.floor(milliseconds / 1000) : milliseconds;
}

/** Format a Unix timestamp as an ISO-8601 string. */
export function formatTimestamp(timestamp: number, unit: TimestampUnit = "seconds"): string { return timestampToDate(timestamp, unit).toISOString(); }

/** Result returned by {@link countText}. Character counts use UTF-16 code units. */
export interface TextCounts { characters: number; charactersNoSpaces: number; words: number; lines: number; }

/** Count UTF-16 characters, non-whitespace characters, words, and lines in text. */
export function countText(value: string): TextCounts {
  return { characters: value.length, charactersNoSpaces: value.replace(/\s/g, "").length, words: value.trim() ? value.trim().split(/\s+/u).length : 0, lines: value.length ? value.split(/\r\n|\r|\n/).length : 0 };
}

export * from "./encoding-station";
