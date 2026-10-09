import type { LicenseRecord } from "./types";
import { hashLicenseKey } from "./hash";

// In-memory fallback map for local development, builds, and unit testing
const localFallbackStore = new Map<string, LicenseRecord>();

function getKVNamespace(): any {
  try {
    // Dynamic check for OpenNext Cloudflare context
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
 * Verifies if a given raw license key is active, unexpired, and within allowed device limits.
 */
export async function verifyLicenseKey(
  rawKey: string,
  deviceId?: string,
  deviceName?: string
): Promise<{
  valid: boolean;
  tier: "pro" | "free";
  plan?: string;
  expiresAt?: number | null;
  message: string;
  deviceCount?: number;
  maxDevices?: number;
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
      deviceCount: 1,
      maxDevices: 3,
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
  const now = Date.now();
  if (record.expiresAt !== null && now > record.expiresAt) {
    return {
      valid: false,
      tier: "free",
      expiresAt: record.expiresAt,
      message: "License has expired. Please renew your subscription.",
    };
  }

  // Device binding & anti-sharing enforcement
  const maxDevices = record.maxDevices || 3;
  let devices = record.devices || [];

  // Prune inactive devices older than 30 days
  devices = devices.filter((d) => now - d.lastSeen < 30 * 86400 * 1000);

  if (deviceId) {
    const existingIndex = devices.findIndex((d) => d.id === deviceId);
    if (existingIndex !== -1) {
      // Device already registered, refresh timestamp
      devices[existingIndex].lastSeen = now;
      if (deviceName) devices[existingIndex].name = deviceName;
    } else {
      // New device attempting to use key
      if (devices.length >= maxDevices) {
        return {
          valid: false,
          tier: "free",
          message: `Device limit reached (${devices.length}/${maxDevices} active devices). To use on a new device, reset devices at https://codestation.in/pro`,
          deviceCount: devices.length,
          maxDevices,
        };
      }
      // Register new device
      devices.push({
        id: deviceId,
        lastSeen: now,
        name: deviceName || "Unknown device",
      });
    }

    // Update record with modified devices
    record.devices = devices;
    await saveLicense(cleanKey, record);
  }

  return {
    valid: true,
    tier: "pro",
    plan: record.plan,
    expiresAt: record.expiresAt,
    message: "License is active and valid",
    deviceCount: devices.length,
    maxDevices,
  };
}

/**
 * Resets all active devices for a license (e.g. user moved to new computers).
 */
export async function resetLicenseDevices(rawKey: string): Promise<boolean> {
  const record = await getLicenseByRawKey(rawKey.trim());
  if (!record) return false;

  record.devices = [];
  await saveLicense(rawKey.trim(), record);
  return true;
}

/**
 * Clears local test store (used in unit tests)
 */
export function clearTestStore(): void {
  localFallbackStore.clear();
}
