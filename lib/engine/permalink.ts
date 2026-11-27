/**
 * Browser-native URL hash permalink codec (`#state=...` / `#s=...`).
 *
 * All serialization happens strictly client-side in the URL hash fragment so
 * user inputs are never transmitted to any server over HTTP. Binary inputs
 * (`File`, `Blob`, `ArrayBuffer`, typed arrays) are excluded automatically.
 */

export const MAX_PERMALINK_HASH_LENGTH = 8192;
const MAX_DECODED_BYTES = 1024 * 1024; // 1 MiB safety cap against corrupt streams

export interface ToolPermalinkState {
  v: 1;
  input?: string;
  controls?: Record<string, unknown>;
}

export type EncodePermalinkResult =
  | { ok: true; token: string; hash: string; urlLength?: number }
  | { ok: false; reason: "empty" | "too-large"; message: string; length?: number; maxLength?: number };

export type BuildPermalinkResult =
  | { ok: true; url: string; hash: string }
  | { ok: false; reason: "empty" | "too-large"; message: string };

function isBinaryValue(value: unknown): boolean {
  if (typeof File !== "undefined" && value instanceof File) return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (typeof ArrayBuffer !== "undefined" && (value instanceof ArrayBuffer || ArrayBuffer.isView(value))) {
    return true;
  }
  return false;
}

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (isBinaryValue(value)) return undefined;

  if (Array.isArray(value)) {
    const next: unknown[] = [];
    for (const item of value) {
      const cleaned = sanitizeJsonValue(item, depth + 1);
      if (cleaned !== undefined) next.push(cleaned);
    }
    return next;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitizeJsonValue(v, depth + 1);
      if (cleaned !== undefined) {
        out[k] = cleaned;
      }
    }
    return out;
  }

  return undefined;
}

export function sanitizePermalinkInput(input: unknown): string | undefined {
  if (typeof input === "string") return input;
  return undefined;
}

export function sanitizePermalinkControls(
  controls?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!controls || typeof controls !== "object" || Array.isArray(controls)) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(controls)) {
    const cleaned = sanitizeJsonValue(value, 0);
    if (cleaned !== undefined) {
      out[key] = cleaned;
      count += 1;
    }
  }
  return count > 0 ? out : undefined;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(encoded: string): Uint8Array | null {
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function readStreamCapped(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== "function") return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const stream = new Blob([copy.buffer]).stream().pipeThrough(cs);
    return await readStreamCapped(stream, MAX_DECODED_BYTES);
  } catch {
    return null;
  }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream !== "function") return null;
  try {
    const ds = new DecompressionStream("deflate-raw");
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const stream = new Blob([copy.buffer]).stream().pipeThrough(ds);
    return await readStreamCapped(stream, MAX_DECODED_BYTES);
  } catch {
    return null;
  }
}

export function extractPermalinkToken(hashOrUrl: string): string | null {
  if (!hashOrUrl || typeof hashOrUrl !== "string") return null;
  const hashIndex = hashOrUrl.indexOf("#");
  const fragment = hashIndex >= 0 ? hashOrUrl.slice(hashIndex + 1) : hashOrUrl;
  if (!fragment) return null;

  for (const part of fragment.split("&")) {
    if (part.startsWith("state=")) {
      const value = part.slice("state=".length).trim();
      return value || null;
    }
    if (part.startsWith("s=")) {
      const value = part.slice("s=".length).trim();
      return value || null;
    }
  }
  return null;
}

export async function encodeToolPermalink(
  payload: { input?: unknown; controls?: Record<string, unknown> },
  options?: { compress?: boolean; maxHashLength?: number }
): Promise<EncodePermalinkResult> {
  const input = sanitizePermalinkInput(payload.input);
  const controls = sanitizePermalinkControls(payload.controls);

  const hasText = typeof input === "string" && input.length > 0;
  const hasControls = Boolean(controls && Object.keys(controls).length > 0);
  if (!hasText && !hasControls) {
    return {
      ok: false,
      reason: "empty",
      message: "Enter text or configure options before creating a share link.",
    };
  }

  const state: ToolPermalinkState = {
    v: 1,
    ...(typeof input === "string" ? { input } : {}),
    ...(controls ? { controls } : {}),
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(state));
  const plainToken = `p.${toBase64Url(jsonBytes)}`;

  let chosenToken = plainToken;
  if (options?.compress !== false) {
    const compressed = await deflateRaw(jsonBytes);
    if (compressed && compressed.byteLength > 0) {
      const compressedToken = `z.${toBase64Url(compressed)}`;
      if (compressedToken.length < plainToken.length) {
        chosenToken = compressedToken;
      }
    }
  }

  const hash = `#state=${chosenToken}`;
  const maxLength = options?.maxHashLength ?? MAX_PERMALINK_HASH_LENGTH;
  if (hash.length > maxLength) {
    return {
      ok: false,
      reason: "too-large",
      length: hash.length,
      maxLength,
      message: `Input is too large to share via URL link (${hash.length.toLocaleString()} / ${maxLength.toLocaleString()} chars max).`,
    };
  }

  return { ok: true, token: chosenToken, hash };
}

export async function buildToolPermalinkUrl(
  baseHref: string,
  payload: { input?: unknown; controls?: Record<string, unknown> },
  options?: { compress?: boolean; maxHashLength?: number }
): Promise<BuildPermalinkResult> {
  const encoded = await encodeToolPermalink(payload, options);
  if (!encoded.ok) {
    return { ok: false, reason: encoded.reason, message: encoded.message };
  }
  const cleanBase = baseHref.split("#")[0] || "/";
  return {
    ok: true,
    hash: encoded.hash,
    url: `${cleanBase}${encoded.hash}`,
  };
}

export async function decodePermalinkHash(hashOrUrl: string): Promise<ToolPermalinkState | null> {
  try {
    const token = extractPermalinkToken(hashOrUrl);
    if (!token || token.length > MAX_PERMALINK_HASH_LENGTH * 2) return null;

    let rawBytes: Uint8Array | null = null;
    if (token.startsWith("z.")) {
      const compressed = fromBase64Url(token.slice(2));
      if (!compressed) return null;
      rawBytes = await inflateRaw(compressed);
    } else if (token.startsWith("p.")) {
      rawBytes = fromBase64Url(token.slice(2));
    } else {
      rawBytes = fromBase64Url(token);
    }

    if (!rawBytes || rawBytes.byteLength === 0 || rawBytes.byteLength > MAX_DECODED_BYTES) {
      return null;
    }

    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const candidate = parsed as Record<string, unknown>;
    if (candidate.v !== 1) return null;

    const input = candidate.input === undefined ? undefined : typeof candidate.input === "string" ? candidate.input : null;
    if (input === null) return null;

    let controls: Record<string, unknown> | undefined;
    if (candidate.controls !== undefined) {
      if (!candidate.controls || typeof candidate.controls !== "object" || Array.isArray(candidate.controls)) {
        return null;
      }
      controls = sanitizePermalinkControls(candidate.controls as Record<string, unknown>);
    }

    return {
      v: 1,
      ...(input !== undefined ? { input } : {}),
      ...(controls ? { controls } : {}),
    };
  } catch {
    return null;
  }
}
