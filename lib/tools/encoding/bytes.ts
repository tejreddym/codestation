import type { EncodingInputs, EncodingResult } from "./types";

export const MAX_ENCODING_INPUT = 1_000_000;
export const MAX_BASE58_INPUT = 16_384;
const MAX_UTF8_BYTES = MAX_ENCODING_INPUT * 3;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function assertInputLimit(value: string): void {
  if (value.length > MAX_ENCODING_INPUT) throw new Error("Input exceeds the 1,000,000 UTF-16 code-unit limit.");
}

/** TextEncoder silently replaces lone surrogates, so validate before encoding. */
export function assertWellFormedUnicode(value: string): void {
  assertInputLimit(value);
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Text contains an unpaired Unicode surrogate.");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error("Text contains an unpaired Unicode surrogate.");
    }
  }
}

export function encodeUtf8(value: string): Uint8Array {
  assertWellFormedUnicode(value);
  return new TextEncoder().encode(value);
}

/** Fatal UTF-8 decoding preserves a leading U+FEFF rather than consuming it. */
export function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.length > MAX_UTF8_BYTES) throw new Error("Byte input exceeds the 3,000,000-byte limit.");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error("Decoded bytes are not valid UTF-8 text.");
  }
}

export function encodeBase64Bytes(bytes: Uint8Array): string {
  if (bytes.length > MAX_UTF8_BYTES) throw new Error("Byte input exceeds the 3,000,000-byte limit.");
  const output: string[] = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    output.push(BASE64[a >> 2] + BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]
      + (b === undefined ? "=" : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)])
      + (c === undefined ? "=" : BASE64[c & 63]));
  }
  return output.join("");
}

/** Strict RFC 4648 standard alphabet, required padding and zero unused bits. */
export function decodeBase64Bytes(value: string): Uint8Array {
  assertInputLimit(value);
  return decodeBase64Validated(value);
}

function decodeBase64Validated(value: string): Uint8Array {
  if (!value) return new Uint8Array();
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const dataLength = value.length - padding;
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+$/.test(value.slice(0, dataLength))) {
    throw new Error("Use standard Base64 with its required = padding and no whitespace.");
  }
  const last = BASE64.indexOf(value[dataLength - 1]);
  if ((padding === 2 && (last & 15) !== 0) || (padding === 1 && (last & 3) !== 0)) {
    throw new Error("Base64 contains nonzero unused padding bits.");
  }
  const bytes = new Uint8Array(value.length / 4 * 3 - padding);
  let offset = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64.indexOf(value[index]);
    const b = BASE64.indexOf(value[index + 1]);
    const c = value[index + 2] === "=" ? 0 : BASE64.indexOf(value[index + 2]);
    const d = value[index + 3] === "=" ? 0 : BASE64.indexOf(value[index + 3]);
    bytes[offset++] = (a << 2) | (b >> 4);
    if (offset < bytes.length) bytes[offset++] = ((b & 15) << 4) | (c >> 2);
    if (offset < bytes.length) bytes[offset++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

/** Accept either correctly padded or unpadded Base64URL, never mixed alphabets. */
export function decodeBase64UrlBytes(value: string): Uint8Array {
  assertInputLimit(value);
  const paddingAt = value.indexOf("=");
  const data = paddingAt < 0 ? value : value.slice(0, paddingAt);
  const padding = paddingAt < 0 ? "" : value.slice(paddingAt);
  if (!/^[A-Za-z0-9_-]*$/.test(data) || (padding !== "" && padding !== "=" && padding !== "==")
    || data.length % 4 === 1 || (padding !== "" && value.length % 4 !== 0)) {
    throw new Error("Use valid Base64URL characters with optional correct = padding.");
  }
  const standard = data.replace(/-/g, "+").replace(/_/g, "/");
  return decodeBase64Validated(standard + "=".repeat((4 - data.length % 4) % 4));
}

export function encodeBase64(value: string): string { return encodeBase64Bytes(encodeUtf8(value)); }
export function decodeBase64(value: string): string { return decodeUtf8(decodeBase64Bytes(value)); }
export function encodeBase64Url(value: string): string { return encodeBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
export function decodeBase64Url(value: string): string { return decodeUtf8(decodeBase64UrlBytes(value)); }

export function encodeBase32(value: string): string {
  const bytes = encodeUtf8(value);
  const output: string[] = [];
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output.push(BASE32[(buffer >>> bits) & 31]);
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits) output.push(BASE32[(buffer << (5 - bits)) & 31]);
  return output.join("") + "=".repeat((8 - output.length % 8) % 8);
}

export function decodeBase32(value: string): string {
  assertInputLimit(value);
  if (!value) return "";
  const paddingAt = value.indexOf("=");
  const data = paddingAt < 0 ? value : value.slice(0, paddingAt);
  const padding = paddingAt < 0 ? "" : value.slice(paddingAt);
  const expectedPadding: Record<number, number> = { 0: 0, 2: 6, 4: 4, 5: 3, 7: 1 };
  if (!data || value.length % 8 !== 0 || !/^[A-Z2-7]+$/.test(data)
    || !/^=*$/.test(padding) || padding.length !== expectedPadding[data.length % 8]) {
    throw new Error("Use uppercase RFC 4648 Base32 (A–Z, 2–7) with its required = padding.");
  }
  const bytes = new Uint8Array(Math.floor(data.length * 5 / 8));
  let buffer = 0;
  let bits = 0;
  let offset = 0;
  for (const character of data) {
    buffer = (buffer << 5) | BASE32.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset++] = (buffer >>> bits) & 255;
    }
    buffer &= (1 << bits) - 1;
  }
  if (buffer !== 0) throw new Error("Base32 contains nonzero unused padding bits.");
  return decodeUtf8(bytes);
}

function assertBase58Limit(length: number, unit: string): void {
  if (length > MAX_BASE58_INPUT) throw new Error(`Base58 input is limited to 16,384 ${unit} to keep local conversion responsive.`);
}

export function encodeBase58(value: string): string {
  assertBase58Limit(value.length, "UTF-8 bytes");
  const bytes = encodeUtf8(value);
  assertBase58Limit(bytes.length, "UTF-8 bytes");
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading += 1;
  let number = BigInt(0);
  for (let index = leading; index < bytes.length; index += 1) number = (number << BigInt(8)) | BigInt(bytes[index]);
  const digits: string[] = [];
  while (number > BigInt(0)) {
    digits.push(BASE58[Number(number % BigInt(58))]);
    number /= BigInt(58);
  }
  return "1".repeat(leading) + digits.reverse().join("");
}

export function decodeBase58(value: string): string {
  if (value.length > 22_528) throw new Error("Base58 input is limited to 22,528 encoded characters (16,384 decoded bytes).");
  let number = BigInt(0);
  for (const character of value) {
    const digit = BASE58.indexOf(character);
    if (digit < 0) throw new Error("Use the Bitcoin Base58 alphabet (no 0, O, I, l, punctuation or whitespace).");
    number = number * BigInt(58) + BigInt(digit);
  }
  let leading = 0;
  while (leading < value.length && value[leading] === "1") leading += 1;
  const reversed: number[] = [];
  while (number > BigInt(0)) {
    reversed.push(Number(number & BigInt(255)));
    number >>= BigInt(8);
  }
  assertBase58Limit(leading + reversed.length, "decoded bytes");
  const bytes = new Uint8Array(leading + reversed.length);
  for (let index = 0; index < reversed.length; index += 1) bytes[leading + index] = reversed[reversed.length - 1 - index];
  return decodeUtf8(bytes);
}

function groups(value: string): string[] {
  assertInputLimit(value);
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
}

export function encodeHexadecimal(value: string): string {
  return Array.from(encodeUtf8(value), (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join("");
}

export function decodeHexadecimal(value: string): string {
  const tokens = groups(value);
  for (const token of tokens) {
    if (token.length % 2 !== 0 || !/^[\da-fA-F]+$/.test(token)) throw new Error("Use complete hexadecimal byte pairs, optionally separated by whitespace; omit 0x and punctuation.");
  }
  const data = tokens.join("");
  const bytes = new Uint8Array(data.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(data.slice(index * 2, index * 2 + 2), 16);
  return decodeUtf8(bytes);
}

export const encodeHex = encodeHexadecimal;
export const decodeHex = decodeHexadecimal;

export function encodeBinary(value: string): string {
  return Array.from(encodeUtf8(value), (byte) => byte.toString(2).padStart(8, "0")).join(" ");
}

export function decodeBinary(value: string): string {
  const tokens = groups(value);
  if (tokens.some((token) => !/^[01]{8}$/.test(token))) throw new Error("Use exactly eight binary digits per byte, separated by whitespace.");
  return decodeUtf8(Uint8Array.from(tokens, (token) => parseInt(token, 2)));
}

export function encodeAscii(value: string): string {
  assertWellFormedUnicode(value);
  const output: string[] = [];
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code > 127) throw new Error("ASCII only supports U+0000 through U+007F.");
    output.push(String(code));
  }
  return output.join(" ");
}

export function decodeAscii(value: string): string {
  return groups(value).map((token) => {
    if (!/^[0-9]+$/.test(token) || Number(token) > 127) throw new Error("Use decimal ASCII codes from 0 through 127, separated by whitespace.");
    return String.fromCharCode(Number(token));
  }).join("");
}

export function encodeOctal(value: string): string {
  return Array.from(encodeUtf8(value), (byte) => byte.toString(8).padStart(3, "0")).join(" ");
}

export function decodeOctal(value: string): string {
  const tokens = groups(value);
  if (tokens.some((token) => !/^[0-3][0-7]{2}$/.test(token))) throw new Error("Use exactly three octal digits per byte, from 000 through 377, separated by whitespace.");
  return decodeUtf8(Uint8Array.from(tokens, (token) => parseInt(token, 8)));
}

export function encodeUnicode(value: string): string {
  assertWellFormedUnicode(value);
  return Array.from(value, (character) => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(" ");
}

export function decodeUnicode(value: string): string {
  return groups(value).map((token) => {
    if (!/^U\+[\da-fA-F]{4,6}$/.test(token)) throw new Error("Use whitespace-separated Unicode scalar values such as U+0041 or U+1F680.");
    const code = parseInt(token.slice(2), 16);
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new Error("Unicode values must be scalar code points (not surrogates), at most U+10FFFF.");
    return String.fromCodePoint(code);
  }).join("");
}

/** Ordinary printable ASCII survives; literal backslashes become doubled. */
export function encodeUnicodeEscapes(value: string): string {
  assertWellFormedUnicode(value);
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === 0x5c) output.push("\\\\");
    else if (unit >= 0x20 && unit <= 0x7e) output.push(value[index]);
    else output.push(`\\u${unit.toString(16).toUpperCase().padStart(4, "0")}`);
  }
  return output.join("");
}

/** Only \\uXXXX and doubled backslashes are interpreted; no script evaluation. */
export function decodeUnicodeEscapes(value: string): string {
  assertWellFormedUnicode(value);
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\") {
      output.push(value[index]);
    } else if (value[index + 1] === "\\") {
      output.push("\\");
      index += 1;
    } else if (value[index + 1] === "u") {
      const digits = value.slice(index + 2, index + 6);
      if (!/^[\da-fA-F]{4}$/.test(digits)) throw new Error("Unicode escapes must use \\u followed by exactly four hexadecimal digits.");
      output.push(String.fromCharCode(parseInt(digits, 16)));
      index += 5;
    } else {
      // Other sequences, including literal \\n, remain ordinary text.
      output.push("\\");
    }
  }
  const text = output.join("");
  assertWellFormedUnicode(text);
  return text;
}

const OPERATIONS: Readonly<Record<string, (value: string) => string>> = {
  "base64-encoder": encodeBase64,
  "base64-decoder": decodeBase64,
  "base64-url-encoder": encodeBase64Url,
  "base64-url-decoder": decodeBase64Url,
  "base32-encoder": encodeBase32,
  "base32-decoder": decodeBase32,
  "base58-encoder": encodeBase58,
  "base58-decoder": decodeBase58,
  "hexadecimal-encoder": encodeHexadecimal,
  "hexadecimal-decoder": decodeHexadecimal,
  "text-to-hex": encodeHexadecimal,
  "hex-to-text": decodeHexadecimal,
  "binary-encoder": encodeBinary,
  "binary-decoder": decodeBinary,
  "text-to-ascii": encodeAscii,
  "ascii-to-text": decodeAscii,
  "text-to-octal": encodeOctal,
  "octal-to-text": decodeOctal,
  "text-to-unicode": encodeUnicode,
  "unicode-to-text": decodeUnicode,
  "unicode-escape-encoder": encodeUnicodeEscapes,
  "unicode-escape-decoder": decodeUnicodeEscapes,
};

export function runByteTool(slug: string, inputs: EncodingInputs): EncodingResult {
  const operation = Object.hasOwn(OPERATIONS, slug) ? OPERATIONS[slug] : undefined;
  if (!operation) throw new Error("Unknown byte or Unicode encoding tool.");
  assertInputLimit(inputs.input);
  return { text: operation(inputs.input) };
}
