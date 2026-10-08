import type { SecurityResult, SecurityValues } from "./types";

export const LOWERCASE_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
export const UPPERCASE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const DIGIT_ALPHABET = "0123456789";
/** All 32 printable ASCII punctuation characters, in code-point order; no spaces. */
export const SYMBOL_ALPHABET = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
export const NANOID_ALPHABET = "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const RANDOM_STRING_ALPHABETS = {
  Alphanumeric: LOWERCASE_ALPHABET + UPPERCASE_ALPHABET + DIGIT_ALPHABET,
  "Lowercase letters": LOWERCASE_ALPHABET,
  "Uppercase letters": UPPERCASE_ALPHABET,
  Digits: DIGIT_ALPHABET,
  "Letters + digits + symbols": LOWERCASE_ALPHABET + UPPERCASE_ALPHABET + DIGIT_ALPHABET + SYMBOL_ALPHABET,
} as const;
export const MAX_ANALYSIS_CODE_UNITS = 1_000_000;
/** An estimate of a hypothetical uniform generator, not measured password security. */
export const CHARACTER_SET_MODEL = {
  lowercase: 26, uppercase: 26, digits: 10, punctuation: 32, space: 1,
  other: "Each distinct observed non-ASCII or ASCII control code point adds one candidate.",
} as const;

const ZERO = BigInt(0);
const ONE = BigInt(1);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_TIME = 281_474_976_710_655;
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
// Resource limit for a broken/mock random source. Exhaustion throws; it never substitutes biased output.
const MAX_REJECTION_ATTEMPTS = 4096;

function text(values: SecurityValues, key: string, label: string): string {
  if (typeof values[key] !== "string") throw new Error(`${label} is required.`);
  return values[key] as string;
}

export function parseStrictInteger(value: unknown, label = "Value"): bigint {
  if (typeof value !== "string" || value.length > 32 || !/^[+-]?\d+$/.test(value)) {
    throw new Error(`${label} must be a whole decimal integer.`);
  }
  const parsed = BigInt(value);
  if (parsed < -MAX_SAFE || parsed > MAX_SAFE) throw new Error(`${label} must be a safe integer.`);
  return parsed;
}

function boundedInteger(values: SecurityValues, key: string, label: string, minimum: number, maximum: number): number {
  const value = parseStrictInteger(values[key], label);
  if (value < BigInt(minimum) || value > BigInt(maximum)) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return Number(value);
}

function requireRandom(): Crypto {
  const source = globalThis.crypto;
  if (!source || typeof source.getRandomValues !== "function") {
    throw new Error("Secure random generation is unavailable in this browser.");
  }
  return source;
}

export function secureRandomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 1 || length > 65_536) throw new Error("Invalid random byte count.");
  const source = requireRandom();
  const bytes = new Uint8Array(length);
  try { source.getRandomValues(bytes); } catch { throw new Error("Secure random generation failed."); }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    result += BASE64URL_ALPHABET[a >> 2] + BASE64URL_ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) result += BASE64URL_ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) result += BASE64URL_ALPHABET[c & 63];
  }
  return result;
}

/** Exact inclusive integer sampling, including ranges that cross zero and exceed 53 bits in width. */
export function secureRandomInteger(minimum: bigint, maximum: bigint): bigint {
  if (minimum < -MAX_SAFE || maximum > MAX_SAFE || minimum > maximum) throw new Error("Invalid safe-integer range.");
  requireRandom();
  const span = maximum - minimum + ONE;
  if (span === ONE) return minimum;
  const bits = (span - ONE).toString(2).length;
  const byteCount = Math.ceil(bits / 8);
  const mask = 255 >>> (byteCount * 8 - bits);
  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt += 1) {
    const bytes = secureRandomBytes(byteCount);
    bytes[0] &= mask;
    let candidate = ZERO;
    for (const byte of bytes) candidate = (candidate << BigInt(8)) | BigInt(byte);
    if (candidate < span) return minimum + candidate;
  }
  throw new Error("Secure random generation exceeded its retry limit. Try again.");
}

/** Rejection sampling avoids byte-modulo bias for non-power-of-two alphabets. */
export function secureRandomString(length: number, alphabet: string): string {
  if (!Number.isInteger(length) || length < 1 || length > 256) throw new Error("Invalid random string length.");
  if (alphabet.length < 1 || alphabet.length > 256 || new Set(alphabet).size !== alphabet.length || /[^\x20-\x7e]/.test(alphabet)) {
    throw new Error("Invalid random character alphabet.");
  }
  const limit = 256 - (256 % alphabet.length);
  let result = "";
  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt += 1) {
    for (const byte of secureRandomBytes(Math.min(512, Math.max(16, (length - result.length) * 2)))) {
      if (byte < limit) result += alphabet[byte % alphabet.length];
      if (result.length === length) return result;
    }
  }
  throw new Error("Secure random generation exceeded its retry limit. Try again.");
}

export function generateSecurePassword(values: SecurityValues): string {
  const length = boundedInteger(values, "length", "Length", 4, 256);
  const classes: string[] = [];
  for (const [key, alphabet] of [
    ["uppercase", UPPERCASE_ALPHABET], ["lowercase", LOWERCASE_ALPHABET],
    ["numbers", DIGIT_ALPHABET], ["symbols", SYMBOL_ALPHABET],
  ]) {
    if (typeof values[key] !== "boolean") throw new Error("Character class selections must be true or false.");
    if (values[key]) classes.push(alphabet);
  }
  if (!classes.length) throw new Error("Select at least one character class.");
  if (length < classes.length) throw new Error("Length must accommodate every enabled character class.");
  // One secure mandatory choice per class, secure remaining choices, then unbiased Fisher–Yates.
  // This guarantees coverage; it does not claim uniformity over all coverage-constrained strings.
  const characters = classes.map((alphabet) => secureRandomString(1, alphabet));
  if (length > classes.length) characters.push(...secureRandomString(length - classes.length, classes.join("")));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const other = Number(secureRandomInteger(ZERO, BigInt(index)));
    [characters[index], characters[other]] = [characters[other], characters[index]];
  }
  return characters.join("");
}

function timestamp48(): number {
  const timestamp = Date.now();
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > MAX_TIME) throw new Error("The clock is outside the 48-bit timestamp range.");
  return timestamp;
}

function canonicalUuid(compact: string): string {
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function generateSecureUuid(version: "4" | "7"): string {
  if (version !== "4" && version !== "7") throw new Error("Select UUID version 4 or 7.");
  const bytes = secureRandomBytes(16);
  if (version === "7") {
    let timestamp = timestamp48();
    for (let index = 5; index >= 0; index -= 1) {
      bytes[index] = timestamp % 256;
      timestamp = Math.floor(timestamp / 256);
    }
  }
  bytes[6] = (bytes[6] & 15) | (version === "4" ? 0x40 : 0x70);
  bytes[8] = (bytes[8] & 63) | 0x80;
  return canonicalUuid(bytesToHex(bytes));
}

export interface UuidDetails { normalized: string; version: string; variant: string; validity: string }

/** Accept canonical, compact, paired-braced canonical, and canonical urn:uuid forms. */
export function parseSecurityUuid(input: string): UuidDetails {
  if (typeof input !== "string" || input.length > 128) throw new Error("Enter a valid UUID.");
  let value = input.trim().toLowerCase();
  const prefixed = value.startsWith("urn:uuid:");
  if (prefixed) value = value.slice(9);
  const braced = value.startsWith("{") || value.endsWith("}");
  if (braced) {
    if (prefixed || !value.startsWith("{") || !value.endsWith("}")) throw new Error("UUID braces must be properly paired around a canonical UUID.");
    value = value.slice(1, -1);
  }
  if (!prefixed && !braced && /^[0-9a-f]{32}$/.test(value)) value = canonicalUuid(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new Error("Enter a valid canonical, compact, braced, or URN UUID.");
  if (value === "00000000-0000-0000-0000-000000000000") {
    return { normalized: value, version: "Not applicable (Nil UUID)", variant: "NCS bit pattern (Nil special value)", validity: "Valid Nil UUID" };
  }
  if (value === "ffffffff-ffff-ffff-ffff-ffffffffffff") {
    return { normalized: value, version: "Not applicable (Max UUID)", variant: "Reserved bit pattern (Max special value)", validity: "Valid Max UUID" };
  }
  const variant = parseInt(value[19], 16);
  if (variant < 8) return { normalized: value, version: "Not applicable (legacy variant)", variant: "NCS (legacy)", validity: "Valid legacy variant format; not an RFC 9562 UUID" };
  if (variant < 12) {
    const version = parseInt(value[14], 16);
    if (version < 1 || version > 8) throw new Error("UUID has an unsupported or reserved RFC version.");
    return { normalized: value, version: String(version), variant: "RFC 9562 / RFC 4122", validity: "Valid UUID format" };
  }
  if (variant < 14) return { normalized: value, version: "Not applicable (legacy variant)", variant: "Microsoft (legacy)", validity: "Valid legacy variant format; not an RFC 9562 UUID" };
  throw new Error("UUID uses a reserved future variant; only the Max special value is supported.");
}

export function generateSecureUlid(): string {
  let timestamp = timestamp48();
  let prefix = "";
  for (let index = 0; index < 10; index += 1) {
    prefix = ULID_ALPHABET[timestamp % 32] + prefix;
    timestamp = Math.floor(timestamp / 32);
  }
  let randomness = ZERO;
  for (const byte of secureRandomBytes(10)) randomness = (randomness << BigInt(8)) | BigInt(byte);
  let suffix = "";
  for (let index = 0; index < 16; index += 1) {
    suffix = ULID_ALPHABET[Number(randomness & BigInt(31))] + suffix;
    randomness >>= BigInt(5);
  }
  return prefix + suffix;
}

function validateAnalysisInput(input: string): void {
  if (typeof input !== "string") throw new Error("Text input is required.");
  if (input.length > MAX_ANALYSIS_CODE_UNITS) throw new Error("Analysis is limited to 1,000,000 UTF-16 code units.");
}

export interface CharacterSetEstimate { length: number; characterSetSize: number; estimatedBits: number; categories: number }

export function estimateCharacterSet(input: string): CharacterSetEstimate {
  validateAnalysisInput(input);
  let length = 0;
  const categories = new Set<string>();
  const other = new Set<string>();
  for (const character of input) {
    length += 1;
    const point = character.codePointAt(0)!;
    if (point >= 97 && point <= 122) categories.add("lowercase");
    else if (point >= 65 && point <= 90) categories.add("uppercase");
    else if (point >= 48 && point <= 57) categories.add("digits");
    else if (point === 32) categories.add("space");
    else if (point >= 33 && point <= 126) categories.add("punctuation");
    else other.add(character);
  }
  let characterSetSize = other.size;
  for (const category of categories) characterSetSize += CHARACTER_SET_MODEL[category as "lowercase" | "uppercase" | "digits" | "space" | "punctuation"];
  return { length, characterSetSize, estimatedBits: characterSetSize > 1 ? length * Math.log2(characterSetSize) : 0, categories: categories.size + (other.size ? 1 : 0) };
}

export const STRENGTH_LABELS = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"] as const;
export interface PasswordStrength { score: number; label: typeof STRENGTH_LABELS[number]; feedback: string }
const COMMON_PATTERNS = ["password", "passw0rd", "qwerty", "letmein", "welcome", "admin", "iloveyou", "monkey", "dragon", "football", "abc123", "123456", "changeme", "correcthorsebatterystaple"];

/** Local, bounded heuristic only; no breach lookup or claim of crack-time/security assurance. */
export function estimatePasswordStrength(input: string): PasswordStrength {
  const model = estimateCharacterSet(input);
  if (!model.length) return { score: 0, label: "Very Weak", feedback: "Enter a password to estimate strength. This local estimate is not a security guarantee." };
  const characters = Array.from(input);
  const counts = new Map<string, number>();
  let maximumCount = 0, run = 0, maximumRun = 0, sequences = 0;
  let lastDelta = 0, sequenceRun = 1;
  for (let index = 0; index < characters.length; index += 1) {
    const count = (counts.get(characters[index]) ?? 0) + 1;
    counts.set(characters[index], count);
    maximumCount = Math.max(maximumCount, count);
    run = index > 0 && characters[index] === characters[index - 1] ? run + 1 : 1;
    maximumRun = Math.max(maximumRun, run);
    const delta = index > 0 ? characters[index].toLowerCase().codePointAt(0)! - characters[index - 1].toLowerCase().codePointAt(0)! : 0;
    sequenceRun = Math.abs(delta) === 1 ? (delta === lastDelta ? sequenceRun + 1 : 2) : 1;
    if (sequenceRun >= 3) sequences += 1;
    lastDelta = delta;
  }
  // Linear-time prefix function recognizes complete repeated blocks, including long patterns.
  const prefix = new Uint32Array(characters.length);
  for (let index = 1; index < characters.length; index += 1) {
    let matched = prefix[index - 1];
    while (matched > 0 && characters[index] !== characters[matched]) matched = prefix[matched - 1];
    if (characters[index] === characters[matched]) matched += 1;
    prefix[index] = matched;
  }
  const period = characters.length - prefix[characters.length - 1];
  const repeated = period < characters.length && characters.length % period === 0;
  const lowercase = input.toLowerCase();
  const normalized = lowercase.replace(/[@04!1$357]/g, (character) => ({ "@": "a", "0": "o", "4": "a", "!": "i", "1": "i", "$": "s", "3": "e", "5": "s", "7": "t" })[character]!);
  const compact = normalized.replace(/[\s_-]+/g, "");
  const common = COMMON_PATTERNS.some((pattern) => lowercase.includes(pattern) || normalized.includes(pattern) || compact.includes(pattern));
  const feedback: string[] = [];
  let score = Math.min(100, Math.round(Math.min(model.length, 128) * Math.log2(Math.max(1, model.characterSetSize)) / 1.4));
  if (model.length < 8) { score = Math.min(score, 25); feedback.push("Use at least 12–16 characters."); }
  else if (model.length < 12) { score = Math.min(score, 55); feedback.push("Add more length."); }
  if (model.categories < 2) { score -= 10; feedback.push("Increase character variety or use several unrelated words."); }
  if (counts.size <= 3) score = Math.min(score, 20);
  if (maximumCount / model.length > 0.5) score = Math.min(score, 30);
  if (repeated || maximumRun >= 4) {
    score = repeated ? Math.min(score, period <= 8 ? 25 : 50) : score - 20;
    feedback.push("Avoid repeated characters and repeated blocks.");
  }
  if (sequences >= Math.max(2, model.length / 4)) { score = Math.min(score, 35); feedback.push("Avoid predictable character sequences."); }
  if (common) { score = Math.min(score, 25); feedback.push("Avoid common passwords and familiar patterns."); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (!feedback.length) feedback.push("Length and variety are helpful; use a unique, randomly generated password.");
  feedback.push("Local estimate only; not a security guarantee.");
  return { score, label: STRENGTH_LABELS[Math.min(4, Math.floor(score / 20))], feedback: feedback.join(" ") };
}

function partsResult(parts: { label: string; value: string }[]): SecurityResult {
  return { text: parts.map(({ label, value }) => `${label}: ${value}`).join("\n"), parts };
}

export function runSecurityGenerators(slug: string, values: SecurityValues): SecurityResult {
  switch (slug) {
    case "uuid-generator": {
      const version = text(values, "version", "UUID version");
      if (version !== "4" && version !== "7") throw new Error("Select UUID version 4 or 7.");
      return { text: generateSecureUuid(version) };
    }
    case "uuid-parser": {
      const uuid = parseSecurityUuid(text(values, "input", "UUID"));
      return partsResult([
        { label: "UUID version", value: uuid.version }, { label: "UUID variant", value: uuid.variant },
        { label: "Normalized UUID", value: uuid.normalized }, { label: "Validity status", value: uuid.validity },
      ]);
    }
    case "password-generator": return { text: generateSecurePassword(values) };
    case "ulid-generator": return { text: generateSecureUlid() };
    case "nanoid-generator": return { text: secureRandomString(values.length === undefined ? 21 : boundedInteger(values, "length", "Length", 4, 256), NANOID_ALPHABET) };
    case "random-number-generator": {
      const minimum = parseStrictInteger(values.minimum, "Minimum");
      const maximum = parseStrictInteger(values.maximum, "Maximum");
      const count = boundedInteger(values, "count", "Count", 1, 1000);
      if (minimum > maximum) throw new Error("Maximum must be greater than or equal to minimum.");
      return { text: Array.from({ length: count }, () => secureRandomInteger(minimum, maximum).toString()).join("\n") };
    }
    case "random-string-generator": {
      const length = boundedInteger(values, "length", "Length", 1, 256);
      const selection = text(values, "characterSet", "Character set");
      if (!Object.hasOwn(RANDOM_STRING_ALPHABETS, selection)) throw new Error("Select a supported character set.");
      return { text: secureRandomString(length, RANDOM_STRING_ALPHABETS[selection as keyof typeof RANDOM_STRING_ALPHABETS]) };
    }
    case "secure-token-generator": {
      const count = boundedInteger(values, "bytes", "Byte count", 8, 256);
      const encoding = text(values, "encoding", "Encoding");
      if (encoding !== "Hex" && encoding !== "Base64URL") throw new Error("Select Hex or Base64URL encoding.");
      const bytes = secureRandomBytes(count);
      return { text: encoding === "Hex" ? bytesToHex(bytes) : bytesToBase64Url(bytes) };
    }
    case "hex-random-generator": return { text: bytesToHex(secureRandomBytes(boundedInteger(values, "bytes", "Byte count", 1, 256))) };
    case "secret-key-generator": {
      const size = text(values, "keySize", "Key size");
      if (size !== "128" && size !== "192" && size !== "256") throw new Error("Select a 128-, 192-, or 256-bit key size.");
      return partsResult([
        { label: "Random secret key", value: bytesToHex(secureRandomBytes(Number(size) / 8)) },
        { label: "Key size", value: `${size} bits` },
      ]);
    }
    case "entropy-calculator": {
      const model = estimateCharacterSet(text(values, "input", "Input"));
      return partsResult([
        { label: "Length", value: String(model.length) }, { label: "Character set size", value: String(model.characterSetSize) },
        { label: "Estimated entropy in bits", value: String(Number(model.estimatedBits.toFixed(2))) },
      ]);
    }
    case "password-strength-checker": {
      const strength = estimatePasswordStrength(text(values, "input", "Password"));
      return partsResult([
        { label: "Strength score", value: String(strength.score) }, { label: "Strength label", value: strength.label },
        { label: "Feedback", value: strength.feedback },
      ]);
    }
    default: throw new Error("Unsupported Security generator or analyzer.");
  }
}
