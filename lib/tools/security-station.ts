/**
 * Local-first Security Station helpers.
 *
 * MD5 and SHA-1 are included only for interoperability with legacy systems.
 * They are cryptographically broken for new signatures, passwords, or other
 * security decisions; prefer SHA-256 or stronger Web Crypto algorithms.
 */

export type HashInput = string | ArrayBuffer | Uint8Array;
export type SecureHashAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";
export type HmacAlgorithm = SecureHashAlgorithm;

const encoder = () => new TextEncoder();
function bytes(input: HashInput): Uint8Array { return typeof input === "string" ? encoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input); }
function webBytes(input: HashInput): ArrayBuffer { return bytes(input).slice().buffer as ArrayBuffer; }
function hex(input: Uint8Array): string { return Array.from(input, byte => byte.toString(16).padStart(2, "0")).join(""); }
function requireCrypto(): Crypto { if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable in this environment."); return globalThis.crypto; }
function words(input: Uint8Array): number[] { const length = (((input.length + 9 + 63) >> 6) << 4); const out = new Array<number>(length).fill(0); input.forEach((byte, index) => { out[index >> 2] |= byte << ((index & 3) * 8); }); out[input.length >> 2] |= 0x80 << ((input.length & 3) * 8); const bitLength = input.length * 8; out[length - 2] = bitLength & 0xffffffff; out[length - 1] = Math.floor(bitLength / 0x100000000); return out; }
function rotl(value: number, count: number): number { return (value << count) | (value >>> (32 - count)); }
function littleHex(value: number): string { return [0, 8, 16, 24].map(shift => ((value >>> shift) & 255).toString(16).padStart(2, "0")).join(""); }

/** MD5 digest, retained solely for legacy compatibility (not secure). */
export function md5(input: HashInput): string {
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000));
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const m = words(bytes(input));
  for (let offset = 0; offset < m.length; offset += 16) { let aa = a, bb = b, cc = c, dd = d; for (let i = 0; i < 64; i++) { let f: number, g: number; if (i < 16) { f = (bb & cc) | (~bb & dd); g = i; } else if (i < 32) { f = (dd & bb) | (~dd & cc); g = (5 * i + 1) % 16; } else if (i < 48) { f = bb ^ cc ^ dd; g = (3 * i + 5) % 16; } else { f = cc ^ (bb | ~dd); g = (7 * i) % 16; } const next = dd; dd = cc; cc = bb; bb = (bb + rotl((aa + f + k[i] + m[offset + g]) | 0, s[i])) | 0; aa = next; } a = (a + aa) | 0; b = (b + bb) | 0; c = (c + cc) | 0; d = (d + dd) | 0; }
  return littleHex(a) + littleHex(b) + littleHex(c) + littleHex(d);
}

/** SHA-1 digest, retained solely for legacy compatibility (not secure). */
export function sha1(input: HashInput): string {
  const source = bytes(input); const padded = new Uint8Array(((source.length + 9 + 63) >> 6) << 6); padded.set(source); padded[source.length] = 0x80; const view = new DataView(padded.buffer); view.setUint32(padded.length - 4, source.length * 8);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  for (let offset = 0; offset < padded.length; offset += 64) { const w = new Uint32Array(80); for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4); for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1) >>> 0; let a = h0, b = h1, c = h2, d = h3, e = h4; for (let i = 0; i < 80; i++) { const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d; const t = (rotl(a, 5) + f + e + w[i] + (i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6)) | 0; e = d; d = c; c = rotl(b, 30); b = a; a = t; } h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; }
  return [h0, h1, h2, h3, h4].map(value => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

/** Hash text or bytes with a modern Web Crypto digest. */
export async function hash(input: HashInput, algorithm: SecureHashAlgorithm = "SHA-256"): Promise<string> { const result = await requireCrypto().subtle.digest(algorithm, webBytes(input)); return hex(new Uint8Array(result)); }
/** Hash an ArrayBuffer (useful for locally selected files) without uploading it. */
export async function hashFile(file: ArrayBuffer, algorithm: SecureHashAlgorithm = "SHA-256"): Promise<string> { return hash(file, algorithm); }
export const sha256 = (input: HashInput) => hash(input, "SHA-256");
export const sha384 = (input: HashInput) => hash(input, "SHA-384");
export const sha512 = (input: HashInput) => hash(input, "SHA-512");
export const checksum = hash;

export async function hmac(input: HashInput, secret: HashInput, algorithm: HmacAlgorithm = "SHA-256"): Promise<string> { const crypto = requireCrypto(); const key = await crypto.subtle.importKey("raw", webBytes(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]); return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, webBytes(input)))); }
export const hmacSha256 = (input: HashInput, secret: HashInput) => hmac(input, secret, "SHA-256");
export const hmacSha384 = (input: HashInput, secret: HashInput) => hmac(input, secret, "SHA-384");
export const hmacSha512 = (input: HashInput, secret: HashInput) => hmac(input, secret, "SHA-512");

export function crc32(input: HashInput): string { let crc = 0xffffffff; for (const byte of bytes(input)) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0"); }
export function compareHashes(left: string, right: string): boolean { const a = left.trim().toLowerCase(), b = right.trim().toLowerCase(); let difference = a.length ^ b.length; const length = Math.max(a.length, b.length); for (let i = 0; i < length; i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return difference === 0; }
export const hashEquals = compareHashes;

export interface EntropyResult { length: number; uniqueCharacters: number; entropy: number; bitsPerCharacter: number; }
export function entropy(value: string): EntropyResult { const counts = new Map<string, number>(); for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1); const length = [...value].length; const entropy = length ? [...counts.values()].reduce((sum, count) => { const p = count / length; return sum - p * Math.log2(p); }, 0) : 0; return { length, uniqueCharacters: counts.size, entropy: entropy * length, bitsPerCharacter: entropy }; }
export const calculateEntropy = entropy;

export interface ParsedUuid { uuid: string; version: number | null; variant: string; }
export function parseUuid(value: string): ParsedUuid { const uuid = value.trim().toLowerCase().replace(/[{}]/g, ""); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) throw new Error("Invalid UUID."); const versionValue = parseInt(uuid[14], 16); const version = versionValue >= 1 && versionValue <= 8 ? versionValue : null; const variantNibble = parseInt(uuid[19], 16); const variant = (variantNibble & 8) === 0 ? "NCS" : (variantNibble & 4) === 0 ? "RFC 4122" : (variantNibble & 2) === 0 ? "Microsoft" : "future"; return { uuid, version, variant }; }

function randomBytes(length: number): Uint8Array { if (!Number.isInteger(length) || length < 0 || length > 65536) throw new RangeError("Length must be an integer between 0 and 65536."); const crypto = requireCrypto(); const result = new Uint8Array(length); for (let offset = 0; offset < length; offset += 65536) crypto.getRandomValues(result.subarray(offset, Math.min(offset + 65536, length))); return result; }
export function secureRandomNumber(min = 0, max = 1): number { if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new RangeError("Invalid random number range."); const random = randomBytes(4); const fraction = (random[0] * 0x1000000 + random[1] * 0x10000 + random[2] * 0x100 + random[3]) / 0x100000000; return min + fraction * (max - min); }
export function secureRandomHex(length = 32): string { return hex(randomBytes(Math.ceil(length / 2))).slice(0, length); }
export function secureRandomToken(length = 32, alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-."): string { if (!Number.isInteger(length) || length < 0 || !alphabet) throw new RangeError("Length must be non-negative and alphabet must not be empty."); return Array.from(randomBytes(length), byte => alphabet[byte % alphabet.length]).join(""); }
export const generateSecureToken = secureRandomToken;
export function secureRandomSecret(length = 32): string { return secureRandomToken(length, "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+"); }
export const generateRandomNumber = secureRandomNumber;
export const generateRandomHex = secureRandomHex;
export const generateSecret = secureRandomSecret;
export function uuid(): string { const result = randomBytes(16); result[6] = (result[6] & 15) | 64; result[8] = (result[8] & 63) | 128; const value = hex(result); return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`; }
export const generateUuid = uuid;
export function ulid(): string { const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; let time = Date.now(); let result = ""; for (let i = 9; i >= 0; i--) { result = alphabet[time % 32] + result; time = Math.floor(time / 32); } return result + secureRandomToken(16, alphabet); }
export function nanoid(length = 21): string { return secureRandomToken(length, "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"); }
export const parseUUID = parseUuid;
export const generateUlid = ulid;
export const generateNanoid = nanoid;
