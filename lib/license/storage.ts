import type {
  ActiveDevice,
  LicensePlan,
  LicensePlanType,
  LicenseRecord,
} from "./types";
import { INDIVIDUAL_SEAT_LIMIT } from "./pricing";
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

export function resolvePlanType(record: Pick<LicenseRecord, "plan" | "planType">): LicensePlanType {
  if (record.planType === "team" || record.plan === "team") {
    return "team";
  }
  return "individual";
}

export function resolveSeatLimit(
  record: Pick<LicenseRecord, "plan" | "planType" | "seatLimit" | "maxDevices">
): number {
  if (typeof record.seatLimit === "number" && record.seatLimit > 0) {
    return record.seatLimit;
  }
  if (typeof record.maxDevices === "number" && record.maxDevices > 0) {
    return record.maxDevices;
  }
  return resolvePlanType(record) === "team" ? 5 : INDIVIDUAL_SEAT_LIMIT;
}

export function sanitizeOrgName(raw?: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  return trimmed || undefined;
}

function pruneStaleDevices(devices: ActiveDevice[] | undefined, now: number): ActiveDevice[] {
  return (devices || []).filter((d) => now - d.lastSeen < 30 * 86400 * 1000);
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
  const planType = resolvePlanType(record);
  const seatLimit = resolveSeatLimit(record);
  const orgName = sanitizeOrgName(record.orgName);

  const normalizedRecord: LicenseRecord = {
    ...record,
    planType,
    seatLimit,
    maxDevices: seatLimit,
    ...(orgName ? { orgName } : {}),
  };

  if (kv && typeof kv.put === "function") {
    // If expiresAt is set, we can set expirationTtl in seconds with a 7-day grace buffer
    let options: { expirationTtl?: number } = {};
    if (normalizedRecord.expiresAt) {
      const ttlSeconds = Math.max(
        Math.floor((normalizedRecord.expiresAt - Date.now()) / 1000) + 7 * 86400,
        60
      );
      options = { expirationTtl: ttlSeconds };
    }
    await kv.put(kvKey, JSON.stringify(normalizedRecord), options);
  } else {
    // Fallback store
    localFallbackStore.set(kvKey, normalizedRecord);
  }

  return { keyHash, record: normalizedRecord };
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
 * Verifies if a given raw license key is active, unexpired, and within allowed seat/device limits.
 */
export async function verifyLicenseKey(
  rawKey: string,
  deviceId?: string,
  deviceName?: string
): Promise<{
  valid: boolean;
  tier: "pro" | "free";
  plan?: LicensePlan;
  planType?: LicensePlanType;
  seatLimit?: number;
  orgName?: string;
  expiresAt?: number | null;
  message: string;
  deviceCount?: number;
  maxDevices?: number;
  devices?: ActiveDevice[];
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
      planType: "individual",
      seatLimit: INDIVIDUAL_SEAT_LIMIT,
      expiresAt: null,
      message: "Developer license active",
      deviceCount: 1,
      maxDevices: INDIVIDUAL_SEAT_LIMIT,
      devices: [{ id: "dev-local", name: "Developer environment", lastSeen: Date.now() }],
    };
  }

  const record = await getLicenseByRawKey(cleanKey);
  if (!record) {
    return { valid: false, tier: "free", message: "License key not found or invalid" };
  }

  const planType = resolvePlanType(record);
  const seatLimit = resolveSeatLimit(record);
  const orgName = sanitizeOrgName(record.orgName);

  if (record.status !== "active") {
    return {
      valid: false,
      tier: "free",
      plan: record.plan,
      planType,
      seatLimit,
      ...(orgName ? { orgName } : {}),
      message: `License is ${record.status}`,
    };
  }

  // Check expiration if not a lifetime license
  const now = Date.now();
  if (record.expiresAt !== null && now > record.expiresAt) {
    return {
      valid: false,
      tier: "free",
      plan: record.plan,
      planType,
      seatLimit,
      ...(orgName ? { orgName } : {}),
      expiresAt: record.expiresAt,
      message: "License has expired. Please renew your subscription.",
    };
  }

  // Device/seat binding & anti-sharing enforcement (defaults to 3 seats for legacy records)
  let devices = pruneStaleDevices(record.devices, now);

  if (deviceId) {
    const existingIndex = devices.findIndex((d) => d.id === deviceId);
    if (existingIndex !== -1) {
      // Device already registered, refresh timestamp
      devices[existingIndex].lastSeen = now;
      if (deviceName) devices[existingIndex].name = deviceName;
    } else {
      // New device attempting to use key
      if (devices.length >= seatLimit) {
        return {
          valid: false,
          tier: "free",
          plan: record.plan,
          planType,
          seatLimit,
          ...(orgName ? { orgName } : {}),
          message:
            planType === "team"
              ? `Team seat limit reached (${devices.length}/${seatLimit} active seats). Revoke an inactive seat or reset devices at https://codestation.in/pro`
              : `Device limit reached (${devices.length}/${seatLimit} active devices). To use on a new device, reset devices at https://codestation.in/pro`,
          deviceCount: devices.length,
          maxDevices: seatLimit,
          devices,
        };
      }
      // Register new device/seat
      devices.push({
        id: deviceId,
        lastSeen: now,
        name: deviceName || "Unknown device",
      });
    }

    // Update record with modified devices
    record.devices = devices;
    record.planType = planType;
    record.seatLimit = seatLimit;
    record.maxDevices = seatLimit;
    await saveLicense(cleanKey, record);
  }

  return {
    valid: true,
    tier: "pro",
    plan: record.plan,
    planType,
    seatLimit,
    ...(orgName ? { orgName } : {}),
    expiresAt: record.expiresAt,
    message: "License is active and valid",
    deviceCount: devices.length,
    maxDevices: seatLimit,
    devices,
  };
}

export interface RevokeDeviceResult {
  found: boolean;
  revoked: boolean;
  status?: LicenseRecord["status"];
  plan?: LicensePlan;
  planType?: LicensePlanType;
  seatLimit?: number;
  orgName?: string;
  deviceCount?: number;
  maxDevices?: number;
  devices?: ActiveDevice[];
  message: string;
}

/**
 * Revokes a specific active device/seat ID or resets all active devices for a license.
 */
export async function revokeLicenseDevice(
  rawKey: string,
  options: { deviceId?: string; resetAll?: boolean }
): Promise<RevokeDeviceResult> {
  const cleanKey = rawKey.trim();
  const record = cleanKey ? await getLicenseByRawKey(cleanKey) : null;
  if (!record) {
    return {
      found: false,
      revoked: false,
      message: "License key not found.",
    };
  }

  const planType = resolvePlanType(record);
  const seatLimit = resolveSeatLimit(record);
  const orgName = sanitizeOrgName(record.orgName);

  if (record.status === "revoked") {
    return {
      found: true,
      revoked: false,
      status: record.status,
      plan: record.plan,
      planType,
      seatLimit,
      ...(orgName ? { orgName } : {}),
      message: "Cannot modify seats for a revoked license.",
    };
  }

  const now = Date.now();
  const activeDevices = pruneStaleDevices(record.devices, now);

  if (options.resetAll) {
    record.devices = [];
    record.planType = planType;
    record.seatLimit = seatLimit;
    record.maxDevices = seatLimit;
    await saveLicense(cleanKey, record);
    return {
      found: true,
      revoked: true,
      status: record.status,
      plan: record.plan,
      planType,
      seatLimit,
      ...(orgName ? { orgName } : {}),
      deviceCount: 0,
      maxDevices: seatLimit,
      devices: [],
      message: "All active device seats revoked.",
    };
  }

  const targetId = options.deviceId?.trim();
  if (!targetId) {
    return {
      found: true,
      revoked: false,
      status: record.status,
      plan: record.plan,
      planType,
      seatLimit,
      ...(orgName ? { orgName } : {}),
      deviceCount: activeDevices.length,
      maxDevices: seatLimit,
      devices: activeDevices,
      message: "Provide deviceId or resetAll: true.",
    };
  }

  const nextDevices = activeDevices.filter((d) => d.id !== targetId);
  if (nextDevices.length === activeDevices.length) {
    return {
      found: true,
      revoked: false,
      status: record.status,
      plan: record.plan,
      planType,
      seatLimit,
      ...(orgName ? { orgName } : {}),
      deviceCount: activeDevices.length,
      maxDevices: seatLimit,
      devices: activeDevices,
      message: "Device seat not found on this license.",
    };
  }

  record.devices = nextDevices;
  record.planType = planType;
  record.seatLimit = seatLimit;
  record.maxDevices = seatLimit;
  await saveLicense(cleanKey, record);

  return {
    found: true,
    revoked: true,
    status: record.status,
    plan: record.plan,
    planType,
    seatLimit,
    ...(orgName ? { orgName } : {}),
    deviceCount: nextDevices.length,
    maxDevices: seatLimit,
    devices: nextDevices,
    message: "Device seat revoked successfully.",
  };
}

/**
 * Resets all active devices for a license (e.g. user moved to new computers).
 */
export async function resetLicenseDevices(rawKey: string): Promise<boolean> {
  const res = await revokeLicenseDevice(rawKey, { resetAll: true });
  return res.found && res.revoked;
}

/**
 * Clears local test store (used in unit tests)
 */
export function clearTestStore(): void {
  localFallbackStore.clear();
}
