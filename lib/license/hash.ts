/**
 * Secure one-way cryptographic hashing and key generation for Code Station Pro licenses.
 * Plaintext keys are never stored on Cloudflare servers; only one-way SHA-256 hashes are persisted.
 */

/**
 * Computes a deterministic SHA-256 hex digest of the raw license key.
 * This one-way hash serves as the storage key in Cloudflare KV.
 */
export async function hashLicenseKey(key: string): Promise<string> {
  const clean = key.trim();
  if (!clean) {
    throw new Error("Cannot hash an empty license key");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a human-friendly, cryptographically random license key.
 * Format: CS-PRO-XXXX-XXXX-XXXX (using Crockford alphanumeric characters excluding confusing O, 0, I, 1).
 */
export function generateLicenseKey(prefix = "CS-PRO"): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  // Unambiguous character set (no 0/O, 1/I)
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomString = "";
  for (let i = 0; i < bytes.length; i++) {
    randomString += alphabet[bytes[i] % alphabet.length];
  }

  const parts = [
    randomString.slice(0, 4),
    randomString.slice(4, 8),
    randomString.slice(8, 12),
  ];

  return `${prefix}-${parts.join("-")}`;
}

/**
 * Checks whether a key matches the standard Code Station Pro license format.
 */
export function isValidKeyFormat(rawKey?: string | null): boolean {
  if (!rawKey) return false;
  const key = rawKey.trim();
  return /^CS-PRO-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i.test(key)
    || /^CS-PRO-[A-Za-z0-9_-]+$/i.test(key);
}
