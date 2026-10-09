import type { LicenseRecord } from "./types";
import { hashLicenseKey } from "./hash";

// In-memory fallback map for local development, builds, and unit testing
const localFallbackStore = new Map<string, LicenseRecord>();

function getKVNamespace(): any {
  try {
    // Dynamic check for OpenNext Cloudflare context
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    return ctx?.env?.LICENSE_KV ?? null;
  } catch {
    return null;
  }
}

/**
 * Persists a new license record indexed by the one-way SHA-256 hash of the raw key.
 * The raw plaintext key is never stored in KV.
 */
export async function saveLicense(
  rawKey: string,
  record: LicenseRecord
): Promise<{ keyHash: string; record: LicenseRecord }> {
  const keyHash = await hashLicenseKey(rawKey);
  const kvKey = `lic_${keyHash}`;
  const kv = getKVNamespace();

  if (kv && typeof kv.put === "function") {
    // If expiresAt is set, we can set expirationTtl in seconds with a 7-day grace buffer
    let options: { expirationTtl?: number } = {};
    if (record.expiresAt) {
      const ttlSeconds = Math.max(
        Math.floor((record.expiresAt - Date.now()) / 1000) + 7 * 86400,
        60
      );
      options = { expirationTtl: ttlSeconds };
    }
    await kv.put(kvKey, JSON.stringify(record), options);
  } else {
    // Fallback store
    localFallbackStore.set(kvKey, record);
  }

  return { keyHash, record };
}

/**
 * Retrieves a license record using the one-way hash of the provided key.
 */
export async function getLicenseByRawKey(
  rawKey: string
): Promise<LicenseRecord | null> {
  const keyHash = await hashLicenseKey(rawKey);
  const kvKey = `lic_${keyHash}`;
  const kv = getKVNamespace();

  if (kv && typeof kv.get === "function") {
    const data = await kv.get(kvKey, "json");
    return (data as LicenseRecord) ?? null;
  }

  return localFallbackStore.get(kvKey) ?? null;
}

/**
 * Verifies if a given raw license key is active and unexpired.
 */
export async function verifyLicenseKey(rawKey: string): Promise<{
  valid: boolean;
  tier: "pro" | "free";
  plan?: string;
  expiresAt?: number | null;
  message: string;
}> {
  const cleanKey = rawKey.trim();
  if (!cleanKey) {
    return { valid: false, tier: "free", message: "License key is missing or empty" };
  }

  // Developer bypass keys
  if (cleanKey === "CS-PRO-DEV" || cleanKey === "PRO_DEMO_KEY") {
    return {
      valid: true,
      tier: "pro",
      plan: "lifetime",
      expiresAt: null,
      message: "Developer license active",
    };
  }

  const record = await getLicenseByRawKey(cleanKey);
  if (!record) {
    return { valid: false, tier: "free", message: "License key not found or invalid" };
  }

  if (record.status !== "active") {
    return { valid: false, tier: "free", message: `License is ${record.status}` };
  }

  // Check expiration if not a lifetime license
  if (record.expiresAt !== null && Date.now() > record.expiresAt) {
    return {
      valid: false,
      tier: "free",
      expiresAt: record.expiresAt,
      message: "License has expired. Please renew your subscription.",
    };
  }

  return {
    valid: true,
    tier: "pro",
    plan: record.plan,
    expiresAt: record.expiresAt,
    message: "License is active and valid",
  };
}

/**
 * Clears local test store (used in unit tests)
 */
export function clearTestStore(): void {
  localFallbackStore.clear();
}
