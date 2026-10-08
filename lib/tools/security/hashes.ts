import type { SecurityRequest, SecurityResult, SecurityValues } from "./types";

export const SECURITY_TEXT_LIMIT = 1_000_000;
export const SECURITY_FILE_LIMIT = 64 * 1024 * 1024;

type ShaAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
type ChecksumAlgorithm = ShaAlgorithm | "MD5" | "CRC32";

function isSha(value: string): value is ShaAlgorithm {
  return value === "SHA-1" || value === "SHA-256" || value === "SHA-384" || value === "SHA-512";
}

function checksumAlgorithm(value: unknown): ChecksumAlgorithm {
  if (typeof value !== "string" || (!isSha(value) && value !== "MD5" && value !== "CRC32")) {
    throw new Error("Select a supported checksum algorithm.");
  }
  return value;
}

function textValue(values: SecurityValues, key: string, label: string): string {
  const value = values[key];
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  if (value.length > SECURITY_TEXT_LIMIT) throw new Error(`${label} exceeds the 1,000,000 UTF-16 code unit limit.`);
  return value;
}

/** Reject malformed UTF-16 rather than silently encoding a replacement character. */
function utf8(value: string, label: string): Uint8Array<ArrayBuffer> {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`${label} contains an unpaired UTF-16 surrogate.`);
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} contains an unpaired UTF-16 surrogate.`);
    }
  }
  return new TextEncoder().encode(value);
}

function subtleCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable. Use a supported browser in a secure context.");
  return globalThis.crypto.subtle;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("");
}

function crc32(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

/** Hash exact bytes; the caller owns and clears its buffer. No algorithm fallback. */
export async function hashBytes(bytes: Uint8Array<ArrayBuffer>, algorithm: string): Promise<string> {
  const selected = checksumAlgorithm(algorithm);
  if (bytes.byteLength > SECURITY_FILE_LIMIT) throw new Error("Input exceeds the 64 MiB byte limit.");
  if (selected === "CRC32") return crc32(bytes);
  if (selected === "MD5") {
    const { md5 } = await import("./md5");
    return md5(bytes);
  }
  const subtle = subtleCrypto();
  try {
    return hex(await subtle.digest(selected, bytes));
  } catch {
    throw new Error("Unable to calculate the selected hash in this browser.");
  }
}

async function hashText(values: SecurityValues, algorithm: string): Promise<SecurityResult> {
  const bytes = utf8(textValue(values, "input", "Input"), "Input");
  try {
    return { text: await hashBytes(bytes, algorithm) };
  } finally {
    bytes.fill(0);
  }
}

async function hmac(values: SecurityValues): Promise<SecurityResult> {
  const selected = values.algorithm;
  if (selected !== "HMAC-SHA-256" && selected !== "HMAC-SHA-384" && selected !== "HMAC-SHA-512") {
    throw new Error("Select HMAC-SHA-256, HMAC-SHA-384, or HMAC-SHA-512.");
  }
  const secret = textValue(values, "secret", "Secret");
  if (secret.length === 0) throw new Error("Secret must not be empty; this tool requires a non-empty HMAC key.");
  const message = textValue(values, "message", "Message");
  const subtle = subtleCrypto();
  const keyBytes = utf8(secret, "Secret");
  let messageBytes: Uint8Array<ArrayBuffer> | undefined;
  try {
    messageBytes = utf8(message, "Message");
    try {
      const key = await subtle.importKey("raw", keyBytes, { name: "HMAC", hash: selected.slice(5) }, false, ["sign"]);
      return { text: hex(await subtle.sign("HMAC", key, messageBytes)) };
    } catch {
      throw new Error("Unable to calculate the selected HMAC in this browser.");
    }
  } finally {
    keyBytes.fill(0);
    messageBytes?.fill(0);
  }
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  const divisor = bytes < 1024 * 1024 ? 1024 : 1024 * 1024;
  const unit = divisor === 1024 ? "KiB" : "MiB";
  return `${(bytes / divisor).toFixed(2)} ${unit} (${bytes} bytes)`;
}

async function hashFile(request: SecurityRequest): Promise<SecurityResult> {
  const algorithm = request.values.algorithm;
  if (typeof algorithm !== "string" || !isSha(algorithm)) {
    throw new Error("Select SHA-1, SHA-256, SHA-384, or SHA-512 for file hashing.");
  }
  const file = request.file;
  // Structural checking accepts browser Files across realms and worker clones.
  if (!file || typeof file !== "object" || typeof file.name !== "string" ||
      !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.arrayBuffer !== "function") {
    throw new Error("Select a file to hash.");
  }
  if (file.size > SECURITY_FILE_LIMIT) throw new Error("File exceeds the 64 MiB (67108864 bytes) limit.");
  // Fail before allocating a file buffer when Web Crypto is unavailable.
  subtleCrypto();
  let bytes: Uint8Array<ArrayBuffer> | undefined;
  try {
    try {
      const buffer = await file.arrayBuffer();
      // The tag also accepts cross-realm ArrayBuffers; SharedArrayBuffer is excluded.
      if (Object.prototype.toString.call(buffer) !== "[object ArrayBuffer]") throw new Error();
      bytes = new Uint8Array(buffer);
    } catch {
      throw new Error("Unable to read the selected file.");
    }
    if (bytes.byteLength !== file.size || bytes.byteLength > SECURITY_FILE_LIMIT) {
      throw new Error("The selected file size changed or exceeds the 64 MiB limit.");
    }
    const hash = await hashBytes(bytes, algorithm);
    const parts = [
      { label: "File name", value: file.name },
      { label: "File size", value: fileSize(file.size) },
      { label: "Algorithm", value: algorithm },
      { label: "Hash", value: hash }
    ];
    return { text: parts.map(part => `${part.label}: ${part.value}`).join("\n"), parts };
  } finally {
    bytes?.fill(0);
  }
}

export async function runSecurityHash(slug: string, request: SecurityRequest): Promise<SecurityResult> {
  const { values } = request;
  switch (slug) {
    case "sha-256-generator": return hashText(values, "SHA-256");
    case "sha-384-generator": return hashText(values, "SHA-384");
    case "sha-512-generator": return hashText(values, "SHA-512");
    case "sha-1-generator": return hashText(values, "SHA-1");
    case "md5-generator": return hashText(values, "MD5");
    case "crc32-generator": return hashText(values, "CRC32");
    case "checksum-generator": return hashText(values, checksumAlgorithm(values.algorithm));
    case "hmac-generator": return hmac(values);
    case "file-hash-generator": return hashFile(request);
    case "hash-compare": {
      const a = textValue(values, "hashA", "First hash").trim();
      const b = textValue(values, "hashB", "Second hash").trim();
      if (!a || !b) throw new Error("Enter both hashes to compare.");
      return { text: a === b ? "Match" : "Does not match" };
    }
    default: throw new Error("Unsupported security hash tool.");
  }
}
