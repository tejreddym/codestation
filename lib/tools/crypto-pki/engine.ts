/**
 * Engine for Station 24: WebPKI & Advanced Cryptography.
 * 
 * Pure client-side Web Crypto API (crypto.subtle) and ASN.1 DER parser.
 * Zero external telemetry or server roundtrips.
 */

// Helper to satisfy strict TypeScript DOM BufferSource type across all TS versions
function asBuffer(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

// ============================================================================
// Common Byte / Encoding Utilities
// ============================================================================

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string: length must be even");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const cleanB64 = base64.replace(/\s+/g, "");
  const binary = atob(cleanB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const b64 = bytesToBase64(bytes);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): Uint8Array {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  return base64ToBytes(b64);
}

export function formatPem(base64: string, label: string): string {
  const clean = base64.replace(/\s+/g, "");
  const lines = clean.match(/.{1,64}/g) || [clean];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export function parsePem(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9\s_-]+-----/g, "")
    .replace(/-----END [A-Z0-9\s_-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!b64) throw new Error("No cryptographic data found in PEM");
  return base64ToBytes(b64);
}

export function getRandomBytes(len: number): Uint8Array {
  const array = new Uint8Array(len);
  globalThis.crypto.getRandomValues(array);
  return array;
}

// ============================================================================
// Tool 1: AES-GCM Crypto
// ============================================================================

export interface AesKeyOptions {
  mode: "raw" | "passphrase";
  keyLength?: 128 | 256;
  rawKey?: string; // hex or base64 or utf8
  rawKeyEncoding?: "hex" | "base64" | "utf8";
  passphrase?: string;
  salt?: Uint8Array | string; // hex, base64, or text (16 bytes)
  saltEncoding?: "hex" | "base64" | "utf8";
  iterations?: number; // default 100,000
}

export interface AesEncryptOptions extends AesKeyOptions {
  iv?: Uint8Array | string; // 12 bytes
  ivEncoding?: "hex" | "base64" | "utf8";
  aad?: Uint8Array | string; // Additional Authenticated Data
  aadEncoding?: "hex" | "base64" | "utf8";
}

export interface AesPayload {
  ciphertext: Uint8Array | string;
  iv: Uint8Array | string;
  tag?: Uint8Array | string;
  salt?: Uint8Array | string;
  aad?: Uint8Array | string;
  encoding?: "hex" | "base64" | "raw";
}

export interface AesResult {
  ciphertext: string;
  ciphertextHex: string;
  ciphertextBase64: string;
  iv: string;
  ivBase64: string;
  tag: string;
  tagBase64: string;
  salt?: string;
  saltBase64?: string;
  aad?: string;
  combined: string;
  jsonBundle: string;
}

function resolveBuffer(
  input?: Uint8Array | string,
  encoding: "hex" | "base64" | "utf8" = "hex"
): Uint8Array | undefined {
  if (!input) return undefined;
  if (input instanceof Uint8Array) return input;
  if (encoding === "hex") return hexToBytes(input);
  if (encoding === "base64") return base64ToBytes(input);
  return new TextEncoder().encode(input);
}

export function generateAesKey(length: 128 | 256 = 256): { hex: string; base64: string } {
  const bytes = getRandomBytes(length / 8);
  return {
    hex: bytesToHex(bytes),
    base64: bytesToBase64(bytes),
  };
}

export async function deriveAesKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = 100000,
  length: 128 | 256 = 256
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    asBuffer(enc.encode(passphrase)),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function getCryptoKey(options: AesKeyOptions): Promise<{ key: CryptoKey; salt?: Uint8Array }> {
  const length = options.keyLength || 256;
  if (options.mode === "passphrase") {
    if (!options.passphrase) {
      throw new Error("Passphrase is required in passphrase derivation mode");
    }
    const salt = options.salt
      ? resolveBuffer(options.salt, options.saltEncoding || "hex")!
      : getRandomBytes(16);
    const key = await deriveAesKeyFromPassphrase(
      options.passphrase,
      salt,
      options.iterations || 100000,
      length
    );
    return { key, salt };
  }

  // Raw key mode
  if (!options.rawKey) {
    throw new Error("Raw key is required in raw key mode");
  }
  const rawKeyBytes = resolveBuffer(options.rawKey, options.rawKeyEncoding || "hex")!;
  if (rawKeyBytes.length !== length / 8) {
    throw new Error(`Invalid raw key size: expected ${length / 8} bytes for ${length}-bit AES, got ${rawKeyBytes.length} bytes`);
  }

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    asBuffer(rawKeyBytes),
    { name: "AES-GCM", length },
    false,
    ["encrypt", "decrypt"]
  );
  return { key };
}

export async function encryptAesGcm(
  data: Uint8Array | string,
  options: AesEncryptOptions
): Promise<AesResult> {
  const plaintext = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const { key, salt } = await getCryptoKey(options);

  const iv = options.iv
    ? resolveBuffer(options.iv, options.ivEncoding || "hex")!
    : getRandomBytes(12);

  if (iv.length !== 12) {
    throw new Error(`AES-GCM standard nonce must be 12 bytes (96-bit). Received ${iv.length} bytes.`);
  }

  const aad = resolveBuffer(options.aad, options.aadEncoding || "utf8");

  const algorithmParams: AesGcmParams = {
    name: "AES-GCM",
    iv: asBuffer(iv),
    tagLength: 128,
  };
  if (aad && aad.byteLength > 0) {
    algorithmParams.additionalData = asBuffer(aad);
  }

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    algorithmParams,
    key,
    asBuffer(plaintext)
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  // Web Crypto AES-GCM appends the 16-byte tag to the ciphertext
  const tagLength = 16;
  const ciphertextBytes = encryptedBytes.subarray(0, encryptedBytes.length - tagLength);
  const tagBytes = encryptedBytes.subarray(encryptedBytes.length - tagLength);

  const ctHex = bytesToHex(ciphertextBytes);
  const ctB64 = bytesToBase64(ciphertextBytes);
  const ivHex = bytesToHex(iv);
  const ivB64 = bytesToBase64(iv);
  const tagHex = bytesToHex(tagBytes);
  const tagB64 = bytesToBase64(tagBytes);
  const saltHex = salt ? bytesToHex(salt) : undefined;
  const saltB64 = salt ? bytesToBase64(salt) : undefined;
  const aadText = options.aad ? (typeof options.aad === "string" ? options.aad : bytesToHex(options.aad)) : undefined;

  const combined = saltHex
    ? `${saltHex}:${ivHex}:${ctHex}:${tagHex}`
    : `${ivHex}:${ctHex}:${tagHex}`;

  const jsonBundle = JSON.stringify(
    {
      cipher: "AES-GCM",
      keyLength: options.keyLength || 256,
      iv: ivB64,
      tag: tagB64,
      ciphertext: ctB64,
      salt: saltB64,
      aad: aadText,
      combined,
    },
    null,
    2
  );

  return {
    ciphertext: ctB64,
    ciphertextHex: ctHex,
    ciphertextBase64: ctB64,
    iv: ivHex,
    ivBase64: ivB64,
    tag: tagHex,
    tagBase64: tagB64,
    salt: saltHex,
    saltBase64: saltB64,
    aad: aadText,
    combined,
    jsonBundle,
  };
}

export async function decryptAesGcm(
  payload: AesPayload | string,
  options: AesKeyOptions
): Promise<string> {
  let parsedPayload: AesPayload;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.startsWith("{")) {
      try {
        const json = JSON.parse(trimmed);
        parsedPayload = {
          ciphertext: json.ciphertext || "",
          iv: json.iv || "",
          tag: json.tag || "",
          salt: json.salt,
          aad: json.aad,
          encoding: "base64",
        };
      } catch {
        throw new Error("Invalid JSON bundle format for AES decryption");
      }
    } else if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      if (parts.length === 4) {
        // salt:iv:ciphertext:tag
        parsedPayload = {
          salt: parts[0],
          iv: parts[1],
          ciphertext: parts[2],
          tag: parts[3],
          encoding: "hex",
        };
      } else if (parts.length === 3) {
        // iv:ciphertext:tag
        parsedPayload = {
          iv: parts[0],
          ciphertext: parts[1],
          tag: parts[2],
          encoding: "hex",
        };
      } else {
        throw new Error("Invalid combined string format. Expected 'iv:ciphertext:tag' or 'salt:iv:ciphertext:tag'");
      }
    } else {
      throw new Error("Unrecognized payload format. Provide a JSON bundle, combined string, or payload object.");
    }
  } else {
    parsedPayload = payload;
  }

  const encoding = parsedPayload.encoding || "hex";

  function resolveBytes(
    input?: Uint8Array | string,
    defaultEncoding: "hex" | "base64" = "hex"
  ): Uint8Array | undefined {
    if (!input) return undefined;
    if (input instanceof Uint8Array) return input;
    if (typeof input === "string") {
      const clean = input.trim();
      // Auto-detect 24-char hex IV (12 bytes) or 32-char hex tag (16 bytes)
      if (/^[0-9a-fA-F]{24}$/.test(clean)) {
        return hexToBytes(clean);
      }
      if (/^[0-9a-fA-F]{32}$/.test(clean)) {
        return hexToBytes(clean);
      }
      return resolveBuffer(clean, defaultEncoding);
    }
    return undefined;
  }

  const effectiveOptions: AesKeyOptions = { ...options };
  if (parsedPayload.salt && options.mode === "passphrase") {
    effectiveOptions.salt = resolveBytes(parsedPayload.salt, encoding === "base64" ? "base64" : "hex");
  }

  const { key } = await getCryptoKey(effectiveOptions);

  const iv = resolveBytes(parsedPayload.iv, encoding === "base64" ? "base64" : "hex");
  if (!iv || iv.length !== 12) {
    throw new Error(`AES-GCM decryption requires a 12-byte IV/nonce. Received ${iv ? iv.length : 0} bytes.`);
  }

  const ctBytes = resolveBytes(parsedPayload.ciphertext, encoding === "base64" ? "base64" : "hex");
  if (!ctBytes) {
    throw new Error("Ciphertext is missing");
  }

  let fullEncrypted: Uint8Array;
  if (parsedPayload.tag) {
    const tagBytes = resolveBytes(parsedPayload.tag, encoding === "base64" ? "base64" : "hex");
    if (!tagBytes || tagBytes.length !== 16) {
      throw new Error("AES-GCM authentication tag must be 16 bytes (128 bits)");
    }
    fullEncrypted = new Uint8Array(ctBytes.length + tagBytes.length);
    fullEncrypted.set(ctBytes, 0);
    fullEncrypted.set(tagBytes, ctBytes.length);
  } else {
    fullEncrypted = ctBytes;
  }

  const aad = resolveBuffer(parsedPayload.aad, "utf8");

  const algorithmParams: AesGcmParams = {
    name: "AES-GCM",
    iv: asBuffer(iv),
    tagLength: 128,
  };
  if (aad && aad.byteLength > 0) {
    algorithmParams.additionalData = asBuffer(aad);
  }

  try {
    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      algorithmParams,
      key,
      asBuffer(fullEncrypted)
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error(
      "Decryption failed: authentication tag mismatch or corrupted ciphertext. The key, IV, AAD, or ciphertext may be incorrect."
    );
  }
}

// ============================================================================
// Tool 2: RSA Key Generator
// ============================================================================

export interface RsaKeyPairPem {
  privateKeyPem: string;
  publicKeyPem: string;
  modulusLength: 2048 | 3072 | 4096;
  publicExponent: number;
  fingerprint: string;
  generatedAt: string;
}

export async function generateRsaKeyPair(
  modulusLength: 2048 | 3072 | 4096 = 2048
): Promise<RsaKeyPairPem> {
  const keyPair = (await globalThis.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength,
      publicExponent: asBuffer(new Uint8Array([1, 0, 1])), // 65537
      hash: "SHA-256",
    } as RsaHashedKeyGenParams,
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;

  const privateKeyDer = await globalThis.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const publicKeyDer = await globalThis.crypto.subtle.exportKey("spki", keyPair.publicKey);

  const privBytes = new Uint8Array(privateKeyDer);
  const pubBytes = new Uint8Array(publicKeyDer);

  const privateKeyPem = formatPem(bytesToBase64(privBytes), "PRIVATE KEY");
  const publicKeyPem = formatPem(bytesToBase64(pubBytes), "PUBLIC KEY");

  const fpDigest = await globalThis.crypto.subtle.digest("SHA-256", asBuffer(pubBytes));
  const fpBytes = new Uint8Array(fpDigest);
  const fingerprint = `SHA256:${Array.from(fpBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")}`;

  return {
    privateKeyPem,
    publicKeyPem,
    modulusLength,
    publicExponent: 65537,
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Tool 3: JWT Signer & Verifier
// ============================================================================

export type JwtAlgorithm = "HS256" | "HS384" | "HS512" | "RS256";

export interface JwtHeader {
  alg: JwtAlgorithm;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface JwtVerifyOptions {
  clockSkew?: number; // seconds, default 60
  expectedIssuer?: string;
  expectedAudience?: string;
  currentTimestamp?: number; // seconds
}

export interface JwtVerifyResult {
  valid: boolean;
  signatureValid: boolean;
  expired: boolean;
  notBeforeValid: boolean;
  header: JwtHeader;
  payload: JwtPayload;
  rawHeader: string;
  rawPayload: string;
  error?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  notBefore?: Date;
}

function getHmacHash(alg: JwtAlgorithm): string {
  switch (alg) {
    case "HS256":
      return "SHA-256";
    case "HS384":
      return "SHA-384";
    case "HS512":
      return "SHA-512";
    default:
      throw new Error(`Unsupported HMAC algorithm: ${alg}`);
  }
}

export async function signJwt(
  header: JwtHeader,
  payload: JwtPayload,
  secretOrKey: string | CryptoKey
): Promise<string> {
  const enc = new TextEncoder();
  const fullHeader: JwtHeader = { typ: "JWT", ...header };
  const headerStr = JSON.stringify(fullHeader);
  const payloadStr = JSON.stringify(payload);

  const headerB64 = base64UrlEncode(headerStr);
  const payloadB64 = base64UrlEncode(payloadStr);
  const signingInput = `${headerB64}.${payloadB64}`;
  const signingInputBytes = enc.encode(signingInput);

  let signatureBytes: Uint8Array;

  if (fullHeader.alg.startsWith("HS")) {
    let key: CryptoKey;
    if (typeof secretOrKey === "string") {
      key = await globalThis.crypto.subtle.importKey(
        "raw",
        asBuffer(enc.encode(secretOrKey)),
        { name: "HMAC", hash: getHmacHash(fullHeader.alg) },
        false,
        ["sign"]
      );
    } else {
      key = secretOrKey;
    }
    const sig = await globalThis.crypto.subtle.sign("HMAC", key, asBuffer(signingInputBytes));
    signatureBytes = new Uint8Array(sig);
  } else if (fullHeader.alg === "RS256") {
    let key: CryptoKey;
    if (typeof secretOrKey === "string") {
      const der = parsePem(secretOrKey);
      key = await globalThis.crypto.subtle.importKey(
        "pkcs8",
        asBuffer(der),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
      );
    } else {
      key = secretOrKey;
    }
    const sig = await globalThis.crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, asBuffer(signingInputBytes));
    signatureBytes = new Uint8Array(sig);
  } else {
    throw new Error(`Unsupported JWT algorithm: ${fullHeader.alg}`);
  }

  const signatureB64 = base64UrlEncode(signatureBytes);
  return `${signingInput}.${signatureB64}`;
}

export async function verifyJwt(
  token: string,
  secretOrKey: string | CryptoKey,
  options: JwtVerifyOptions = {}
): Promise<JwtVerifyResult> {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return {
      valid: false,
      signatureValid: false,
      expired: false,
      notBeforeValid: false,
      header: { alg: "HS256" },
      payload: {},
      rawHeader: "",
      rawPayload: "",
      error: "Malformed JWT: expected 3 dot-separated parts (header.payload.signature)",
    };
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: JwtHeader;
  let payload: JwtPayload;
  let rawHeader = "";
  let rawPayload = "";

  try {
    rawHeader = new TextDecoder().decode(base64UrlDecode(headerB64));
    header = JSON.parse(rawHeader);
  } catch {
    return {
      valid: false,
      signatureValid: false,
      expired: false,
      notBeforeValid: false,
      header: { alg: "HS256" },
      payload: {},
      rawHeader,
      rawPayload,
      error: "Invalid JWT header JSON or base64url encoding",
    };
  }

  try {
    rawPayload = new TextDecoder().decode(base64UrlDecode(payloadB64));
    payload = JSON.parse(rawPayload);
  } catch {
    return {
      valid: false,
      signatureValid: false,
      expired: false,
      notBeforeValid: false,
      header,
      payload: {},
      rawHeader,
      rawPayload,
      error: "Invalid JWT payload JSON or base64url encoding",
    };
  }

  // Cryptographic signature check
  const enc = new TextEncoder();
  const signingInput = `${headerB64}.${payloadB64}`;
  const signingInputBytes = enc.encode(signingInput);
  const signatureBytes = base64UrlDecode(sigB64);
  let signatureValid = false;

  try {
    if (header.alg.startsWith("HS")) {
      let key: CryptoKey;
      if (typeof secretOrKey === "string") {
        key = await globalThis.crypto.subtle.importKey(
          "raw",
          asBuffer(enc.encode(secretOrKey)),
          { name: "HMAC", hash: getHmacHash(header.alg) },
          false,
          ["verify"]
        );
      } else {
        key = secretOrKey;
      }
      signatureValid = await globalThis.crypto.subtle.verify("HMAC", key, asBuffer(signatureBytes), asBuffer(signingInputBytes));
    } else if (header.alg === "RS256") {
      let key: CryptoKey;
      if (typeof secretOrKey === "string") {
        const der = parsePem(secretOrKey);
        key = await globalThis.crypto.subtle.importKey(
          "spki",
          asBuffer(der),
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"]
        );
      } else {
        key = secretOrKey;
      }
      signatureValid = await globalThis.crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, asBuffer(signatureBytes), asBuffer(signingInputBytes));
    } else {
      return {
        valid: false,
        signatureValid: false,
        expired: false,
        notBeforeValid: false,
        header,
        payload,
        rawHeader,
        rawPayload,
        error: `Unsupported JWT algorithm: ${header.alg}`,
      };
    }
  } catch {
    signatureValid = false;
  }

  // Claim validation
  const now = options.currentTimestamp ?? Math.floor(Date.now() / 1000);
  const clockSkew = options.clockSkew ?? 60;

  let expired = false;
  let notBeforeValid = true;
  let validationError: string | undefined;

  if (typeof payload.exp === "number") {
    if (now > payload.exp + clockSkew) {
      expired = true;
      validationError = `Token expired at ${new Date(payload.exp * 1000).toISOString()}`;
    }
  }

  if (typeof payload.nbf === "number") {
    if (now < payload.nbf - clockSkew) {
      notBeforeValid = false;
      validationError = `Token not active until ${new Date(payload.nbf * 1000).toISOString()}`;
    }
  }

  if (options.expectedIssuer && payload.iss !== options.expectedIssuer) {
    validationError = `Issuer mismatch: expected '${options.expectedIssuer}', got '${payload.iss}'`;
  }

  if (options.expectedAudience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(options.expectedAudience)) {
      validationError = `Audience mismatch: expected '${options.expectedAudience}'`;
    }
  }

  if (!signatureValid) {
    validationError = "Signature verification failed";
  }

  const valid = signatureValid && !expired && notBeforeValid && !validationError;

  return {
    valid,
    signatureValid,
    expired,
    notBeforeValid,
    header,
    payload,
    rawHeader,
    rawPayload,
    error: validationError,
    issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
    expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
    notBefore: payload.nbf ? new Date(payload.nbf * 1000) : undefined,
  };
}

// ============================================================================
// Tool 4: CSR (PKCS#10) Inspector & ASN.1 Parser
// ============================================================================

export interface Asn1Node {
  tag: number;
  headerLen: number;
  contentLen: number;
  raw: Uint8Array;
  fullBytes: Uint8Array;
  sub: Asn1Node[];
}

export function parseDer(bytes: Uint8Array, offset = 0): Asn1Node {
  if (offset >= bytes.length) {
    throw new Error(`Unexpected end of DER stream at offset ${offset}`);
  }
  const tag = bytes[offset];
  const lenByte = bytes[offset + 1];
  let headerLen = 2;
  let contentLen = 0;

  if (lenByte < 0x80) {
    contentLen = lenByte;
  } else {
    const numBytes = lenByte & 0x7f;
    headerLen = 2 + numBytes;
    for (let i = 0; i < numBytes; i++) {
      contentLen = (contentLen << 8) | bytes[offset + 2 + i];
    }
  }

  const raw = bytes.subarray(offset + headerLen, offset + headerLen + contentLen);
  const fullBytes = bytes.subarray(offset, offset + headerLen + contentLen);
  const node: Asn1Node = { tag, headerLen, contentLen, raw, fullBytes, sub: [] };

  // Constructed types: SEQUENCE (0x30), SET (0x31), Context tags [0..3] (0xa0..0xa3)
  if (tag === 0x30 || tag === 0x31 || (tag >= 0xa0 && tag <= 0xa3)) {
    let subOffset = 0;
    while (subOffset < raw.length) {
      const child = parseDer(raw, subOffset);
      node.sub.push(child);
      subOffset += child.headerLen + child.contentLen;
    }
  }

  return node;
}

export const OID_MAP: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "1.2.840.113549.1.9.1": "emailAddress",
  "1.2.840.113549.1.1.1": "RSA Encryption",
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.10045.2.1": "EC Public Key (Elliptic Curve)",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  "1.3.101.112": "Ed25519",
  "1.2.840.113549.1.9.14": "extensionRequest",
  "2.5.29.17": "subjectAltName",
};

export function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const first = bytes[0];
  const parts = [Math.floor(first / 40), first % 40];
  let val = 0;
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i];
    val = (val << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) {
      parts.push(val);
      val = 0;
    }
  }
  return parts.join(".");
}

export function parseNameNode(seq: Asn1Node): Record<string, string> {
  const out: Record<string, string> = {};
  for (const set of seq.sub) {
    for (const rdn of set.sub) {
      if (rdn.sub.length >= 2) {
        const oid = decodeOid(rdn.sub[0].raw);
        const nameKey = OID_MAP[oid] || oid;
        const textVal = new TextDecoder().decode(rdn.sub[1].raw);
        out[nameKey] = textVal;
      }
    }
  }
  return out;
}

export interface CsrSubject {
  commonName?: string;
  organization?: string;
  organizationalUnit?: string;
  locality?: string;
  stateOrProvince?: string;
  country?: string;
  emailAddress?: string;
  [key: string]: string | undefined;
}

export interface CsrPublicKeyInfo {
  algorithm: string;
  algorithmOid: string;
  bitLength?: number;
  modulusHex?: string;
  exponent?: number;
  curve?: string;
  fingerprintSha256: string;
}

export interface CsrDetails {
  version: number;
  subject: CsrSubject;
  subjectString: string;
  publicKey: CsrPublicKeyInfo;
  signatureAlgorithm: string;
  signatureAlgorithmOid: string;
  signatureHex: string;
  subjectAltNames: string[];
  attributes: { oid: string; name: string }[];
  signatureValid: boolean;
  signatureVerificationNote?: string;
  asn1Tree: string;
}

export async function parseCsr(csrPemOrDer: string | Uint8Array): Promise<CsrDetails> {
  let der: Uint8Array;
  if (typeof csrPemOrDer === "string") {
    der = parsePem(csrPemOrDer);
  } else {
    der = csrPemOrDer;
  }

  const root = parseDer(der);
  if (root.tag !== 0x30 || root.sub.length < 3) {
    throw new Error("Invalid PKCS#10 CSR: root must be a SEQUENCE of 3 elements (Info, Algo, Signature)");
  }

  const certReqInfo = root.sub[0];
  const sigAlgoNode = root.sub[1];
  const sigBitString = root.sub[2];

  // 1. Version
  let version = 0;
  if (certReqInfo.sub[0]?.tag === 0x02 && certReqInfo.sub[0].raw.length > 0) {
    version = certReqInfo.sub[0].raw[0];
  }

  // 2. Subject Name
  const subjectNode = certReqInfo.sub[1];
  const rawSubject = parseNameNode(subjectNode);
  const subject: CsrSubject = {
    commonName: rawSubject.CN,
    organization: rawSubject.O,
    organizationalUnit: rawSubject.OU,
    locality: rawSubject.L,
    stateOrProvince: rawSubject.ST,
    country: rawSubject.C,
    emailAddress: rawSubject.emailAddress,
    ...rawSubject,
  };
  const subjectParts: string[] = [];
  if (subject.commonName) subjectParts.push(`CN=${subject.commonName}`);
  if (subject.organization) subjectParts.push(`O=${subject.organization}`);
  if (subject.organizationalUnit) subjectParts.push(`OU=${subject.organizationalUnit}`);
  if (subject.locality) subjectParts.push(`L=${subject.locality}`);
  if (subject.stateOrProvince) subjectParts.push(`ST=${subject.stateOrProvince}`);
  if (subject.country) subjectParts.push(`C=${subject.country}`);
  const subjectString = subjectParts.join(", ");

  // 3. Subject Public Key Info
  const spkiNode = certReqInfo.sub[2];
  const pkAlgoOid = spkiNode.sub[0]?.sub[0] ? decodeOid(spkiNode.sub[0].sub[0].raw) : "";
  const pkAlgoName = OID_MAP[pkAlgoOid] || pkAlgoOid || "Unknown Public Key";

  let bitLength: number | undefined;
  let modulusHex: string | undefined;
  let exponent: number | undefined;

  // Parse RSA details if applicable
  if (pkAlgoOid === "1.2.840.113549.1.1.1" && spkiNode.sub[1]) {
    try {
      // First byte of BIT STRING is unused bits (0x00)
      const pkDer = spkiNode.sub[1].raw.subarray(1);
      const pkSeq = parseDer(pkDer);
      if (pkSeq.tag === 0x30 && pkSeq.sub.length >= 2) {
        const modBytes = pkSeq.sub[0].raw;
        // strip leading 0x00 padding byte if present
        const cleanMod = modBytes[0] === 0x00 ? modBytes.subarray(1) : modBytes;
        bitLength = cleanMod.length * 8;
        modulusHex = bytesToHex(cleanMod);

        const expBytes = pkSeq.sub[1].raw;
        let expVal = 0;
        for (const b of expBytes) expVal = (expVal << 8) | b;
        exponent = expVal;
      }
    } catch {
      // ignore
    }
  }

  const pubKeySha = await globalThis.crypto.subtle.digest("SHA-256", asBuffer(spkiNode.fullBytes));
  const fpBytes = new Uint8Array(pubKeySha);
  const fingerprintSha256 = `SHA256:${Array.from(fpBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")}`;

  const publicKey: CsrPublicKeyInfo = {
    algorithm: pkAlgoName,
    algorithmOid: pkAlgoOid,
    bitLength,
    modulusHex,
    exponent,
    fingerprintSha256,
  };

  // 4. Attributes & SANs
  const subjectAltNames: string[] = [];
  const attributes: { oid: string; name: string }[] = [];

  const attrNode = certReqInfo.sub.find((n) => n.tag === 0xa0);
  if (attrNode) {
    for (const attr of attrNode.sub) {
      if (attr.sub.length >= 2) {
        const attrOid = decodeOid(attr.sub[0].raw);
        const attrName = OID_MAP[attrOid] || attrOid;
        attributes.push({ oid: attrOid, name: attrName });

        // Check for extensionRequest (1.2.840.113549.1.9.14)
        if (attrOid === "1.2.840.113549.1.9.14") {
          const extSet = attr.sub[1];
          const extSeq = extSet.sub[0];
          if (extSeq) {
            for (const ext of extSeq.sub) {
              if (ext.sub.length >= 2) {
                const extOid = decodeOid(ext.sub[0].raw);
                if (extOid === "2.5.29.17") {
                  // SubjectAltName OCTET STRING
                  const octetNode = ext.sub[ext.sub.length - 1];
                  try {
                    const sanSeq = parseDer(octetNode.raw);
                    for (const generalName of sanSeq.sub) {
                      const tagNum = generalName.tag & 0x1f;
                      if (tagNum === 2) {
                        // DNS name (0x82)
                        subjectAltNames.push(`DNS:${new TextDecoder().decode(generalName.raw)}`);
                      } else if (tagNum === 7) {
                        // IP Address (0x87)
                        const ipBytes = generalName.raw;
                        if (ipBytes.length === 4) {
                          subjectAltNames.push(`IP:${Array.from(ipBytes).join(".")}`);
                        } else if (ipBytes.length === 16) {
                          const parts: string[] = [];
                          for (let i = 0; i < 16; i += 2) {
                            parts.push(((ipBytes[i] << 8) | ipBytes[i + 1]).toString(16));
                          }
                          subjectAltNames.push(`IP:${parts.join(":")}`);
                        }
                      } else if (tagNum === 1) {
                        // Email (0x81)
                        subjectAltNames.push(`Email:${new TextDecoder().decode(generalName.raw)}`);
                      } else if (tagNum === 6) {
                        // URI (0x86)
                        subjectAltNames.push(`URI:${new TextDecoder().decode(generalName.raw)}`);
                      }
                    }
                  } catch {
                    // ignore
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // 5. Signature Algorithm & Signature
  const sigAlgoOid = sigAlgoNode.sub[0] ? decodeOid(sigAlgoNode.sub[0].raw) : "";
  const signatureAlgorithm = OID_MAP[sigAlgoOid] || sigAlgoOid || "Unknown Signature Algorithm";

  const rawSig = sigBitString.raw;
  // First byte of BIT STRING is unused bits
  const sigBytes = rawSig.subarray(1);
  const signatureHex = bytesToHex(sigBytes);

  // 6. Cryptographic Self-Signature Verification
  let signatureValid = false;
  let signatureVerificationNote: string | undefined;

  try {
    let hashName: string | undefined;
    if (sigAlgoOid === "1.2.840.113549.1.1.11") hashName = "SHA-256";
    else if (sigAlgoOid === "1.2.840.113549.1.1.12") hashName = "SHA-384";
    else if (sigAlgoOid === "1.2.840.113549.1.1.13") hashName = "SHA-512";
    else if (sigAlgoOid === "1.2.840.113549.1.1.5") hashName = "SHA-1";

    if (hashName && pkAlgoOid === "1.2.840.113549.1.1.1") {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        "spki",
        asBuffer(spkiNode.fullBytes),
        { name: "RSASSA-PKCS1-v1_5", hash: hashName },
        false,
        ["verify"]
      );

      signatureValid = await globalThis.crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        asBuffer(sigBytes),
        asBuffer(certReqInfo.fullBytes)
      );
      signatureVerificationNote = signatureValid
        ? "Verified: Valid self-signature with embedded RSA public key"
        : "Failed: Signature does not match embedded public key";
    } else {
      signatureVerificationNote = `Algorithm ${signatureAlgorithm} not directly verified by Web Crypto`;
    }
  } catch (err) {
    signatureValid = false;
    signatureVerificationNote = `Verification error: ${(err as Error).message}`;
  }

  // Visual ASN.1 Tree representation
  const asn1Tree = [
    `SEQUENCE (Length: ${root.contentLen})`,
    `  CertificationRequestInfo (Version: ${version + 1})`,
    `    Subject: ${subjectString || "Empty"}`,
    `    SubjectPublicKeyInfo: ${pkAlgoName} (${bitLength ? `${bitLength}-bit` : "Unknown size"})`,
    `    Attributes: ${attributes.map((a) => a.name).join(", ") || "None"}`,
    `      SANs: ${subjectAltNames.join(", ") || "None"}`,
    `  SignatureAlgorithm: ${signatureAlgorithm}`,
    `  Signature: ${sigBytes.length} bytes (${signatureValid ? "Valid" : "Unverified/Invalid"})`,
  ].join("\n");

  return {
    version: version + 1,
    subject,
    subjectString,
    publicKey,
    signatureAlgorithm,
    signatureAlgorithmOid: sigAlgoOid,
    signatureHex,
    subjectAltNames,
    attributes,
    signatureValid,
    signatureVerificationNote,
    asn1Tree,
  };
}

// ============================================================================
// Tool 5: CSP (Content Security Policy) Builder
// ============================================================================

export interface CspDirectives {
  "default-src"?: string[];
  "script-src"?: string[];
  "style-src"?: string[];
  "img-src"?: string[];
  "connect-src"?: string[];
  "font-src"?: string[];
  "object-src"?: string[];
  "media-src"?: string[];
  "frame-src"?: string[];
  "worker-src"?: string[];
  "manifest-src"?: string[];
  "base-uri"?: string[];
  "form-action"?: string[];
  "frame-ancestors"?: string[];
  "sandbox"?: string[];
  "upgrade-insecure-requests"?: boolean;
  "block-all-mixed-content"?: boolean;
  "report-uri"?: string[];
  "report-to"?: string[];
}

export interface CspWarning {
  directive: string;
  severity: "critical" | "warning" | "info";
  message: string;
  recommendation: string;
}

export interface CspHeaderResult {
  headerString: string;
  formattedHeader: string;
  metaHtml: string;
  nginxConfig: string;
  apacheConfig: string;
  nextConfigSnippet: string;
  grade: "A+" | "A" | "B" | "C" | "F";
  warnings: CspWarning[];
  score: number;
}

export const DEFAULT_CSP_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "upgrade-insecure-requests": true,
};

export function buildCspHeader(directives: CspDirectives): CspHeaderResult {
  const parts: string[] = [];
  const warnings: CspWarning[] = [];
  let score = 100;

  const directiveKeys = Object.keys(directives) as (keyof CspDirectives)[];

  for (const key of directiveKeys) {
    const val = directives[key];
    if (val === undefined) continue;

    if (typeof val === "boolean") {
      if (val) {
        parts.push(key);
      }
    } else if (Array.isArray(val) && val.length > 0) {
      const cleanTokens = val.map((t) => t.trim()).filter(Boolean);
      if (cleanTokens.length > 0) {
        parts.push(`${key} ${cleanTokens.join(" ")}`);
      }
    }
  }

  // Security checks & warnings
  const scriptSrc = directives["script-src"] || [];
  const styleSrc = directives["style-src"] || [];
  const objectSrc = directives["object-src"] || [];
  const defaultSrc = directives["default-src"] || [];
  const baseUri = directives["base-uri"] || [];
  const frameAncestors = directives["frame-ancestors"] || [];

  if (scriptSrc.includes("'unsafe-inline'")) {
    warnings.push({
      directive: "script-src",
      severity: "critical",
      message: "'unsafe-inline' enables arbitrary inline scripts, defeating core XSS protections.",
      recommendation: "Replace with nonces, hashes ('sha256-...'), or move scripts to external files.",
    });
    score -= 35;
  }

  if (scriptSrc.includes("'unsafe-eval'")) {
    warnings.push({
      directive: "script-src",
      severity: "critical",
      message: "'unsafe-eval' permits runtime code evaluation (eval, Function), enabling code injection.",
      recommendation: "Refactor dynamic evaluations or use WebAssembly with 'wasm-unsafe-eval'.",
    });
    score -= 25;
  }

  if (styleSrc.includes("'unsafe-inline'")) {
    warnings.push({
      directive: "style-src",
      severity: "warning",
      message: "'unsafe-inline' allows arbitrary inline CSS which may enable data exfiltration via CSS injection.",
      recommendation: "Use style nonces or strict external stylesheets where feasible.",
    });
    score -= 10;
  }

  if (objectSrc.length === 0 || !objectSrc.includes("'none'")) {
    warnings.push({
      directive: "object-src",
      severity: "warning",
      message: "object-src is not set to 'none'. Legacy plugins (Flash, Java) may be embedded.",
      recommendation: "Set object-src 'none' to block plugin-based exploits.",
    });
    score -= 15;
  }

  if (defaultSrc.length === 0) {
    warnings.push({
      directive: "default-src",
      severity: "warning",
      message: "Missing default-src directive. Unspecified fetch directives will have no fallback restrictions.",
      recommendation: "Specify default-src 'self' or default-src 'none'.",
    });
    score -= 15;
  } else if (defaultSrc.includes("*")) {
    warnings.push({
      directive: "default-src",
      severity: "critical",
      message: "default-src uses wildcard (*), allowing resource loads from arbitrary origins.",
      recommendation: "Restrict default-src to 'self' or specific trusted origins.",
    });
    score -= 25;
  }

  if (baseUri.length === 0 || baseUri.includes("*")) {
    warnings.push({
      directive: "base-uri",
      severity: "warning",
      message: "Missing base-uri directive allows attackers to inject malicious <base> tags.",
      recommendation: "Set base-uri 'self' or base-uri 'none'.",
    });
    score -= 10;
  }

  if (frameAncestors.length === 0) {
    warnings.push({
      directive: "frame-ancestors",
      severity: "info",
      message: "Missing frame-ancestors directive leaves the site vulnerable to UI Redressing / Clickjacking.",
      recommendation: "Set frame-ancestors 'none' or frame-ancestors 'self'.",
    });
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  let grade: "A+" | "A" | "B" | "C" | "F";
  if (score >= 90) grade = "A+";
  else if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else grade = "F";

  const policyBody = parts.join("; ");
  const headerString = `Content-Security-Policy: ${policyBody}`;
  const formattedHeader = parts.map((p) => `  ${p};`).join("\n");

  const metaHtml = `<meta http-equiv="Content-Security-Policy" content="${policyBody}">`;
  const nginxConfig = `add_header Content-Security-Policy "${policyBody}" always;`;
  const apacheConfig = `Header set Content-Security-Policy "${policyBody}"`;
  const nextConfigSnippet = `// next.config.js\nmodule.exports = {\n  async headers() {\n    return [\n      {\n        source: '/(.*)',\n        headers: [\n          {\n            key: 'Content-Security-Policy',\n            value: "${policyBody.replace(/"/g, '\\"')}",\n          },\n        ],\n      },\n    ];\n  },\n};`;

  return {
    headerString,
    formattedHeader,
    metaHtml,
    nginxConfig,
    apacheConfig,
    nextConfigSnippet,
    grade,
    warnings,
    score,
  };
}
