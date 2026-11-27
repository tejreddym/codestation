import { describe, it, expect, beforeEach } from "vitest";
import { hashLicenseKey, generateLicenseKey, isValidKeyFormat } from "./hash";
import {
  INDIVIDUAL_PRICING,
  TEAM_PRICING,
  resolvePlanPricing,
} from "./pricing";
import {
  saveLicense,
  getLicenseByRawKey,
  verifyLicenseKey,
  revokeLicenseDevice,
  clearTestStore,
} from "./storage";

describe("License Hashing & Generation", () => {
  it("generates correctly formatted keys", () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^CS-PRO-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(isValidKeyFormat(key)).toBe(true);
  });

  it("produces deterministic SHA-256 hashes", async () => {
    const key = "CS-PRO-DEMO-TEST-1234";
    const hash1 = await hashLicenseKey(key);
    const hash2 = await hashLicenseKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 256 bits = 64 hex chars
  });

  it("produces different hashes for different keys (collision resistance)", async () => {
    const key1 = generateLicenseKey();
    const key2 = generateLicenseKey();
    const hash1 = await hashLicenseKey(key1);
    const hash2 = await hashLicenseKey(key2);
    expect(hash1).not.toBe(hash2);
  });
});

describe("License Storage & Verification", () => {
  beforeEach(() => {
    clearTestStore();
  });

  it("verifies a valid active monthly license", async () => {
    const key = generateLicenseKey();
    const thirtyDaysAhead = Date.now() + 30 * 86400 * 1000;

    await saveLicense(key, {
      status: "active",
      tier: "pro",
      plan: "monthly",
      createdAt: Date.now(),
      expiresAt: thirtyDaysAhead,
    });

    const result = await verifyLicenseKey(key);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.expiresAt).toBe(thirtyDaysAhead);
  });

  it("verifies a valid lifetime license with null expiresAt", async () => {
    const key = generateLicenseKey();

    await saveLicense(key, {
      status: "active",
      tier: "pro",
      plan: "lifetime",
      createdAt: Date.now(),
      expiresAt: null,
    });

    const result = await verifyLicenseKey(key);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.expiresAt).toBeNull();
  });

  it("fails verification for an expired license", async () => {
    const key = generateLicenseKey();
    const pastDate = Date.now() - 10000; // already expired

    await saveLicense(key, {
      status: "active",
      tier: "pro",
      plan: "monthly",
      createdAt: Date.now() - 31 * 86400 * 1000,
      expiresAt: pastDate,
    });

    const result = await verifyLicenseKey(key);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("expired");
  });

  it("fails verification for an unknown key", async () => {
    const result = await verifyLicenseKey("CS-PRO-NONEXISTENT");
    expect(result.valid).toBe(false);
  });

  it("enforces device limit of 3 devices per license to prevent sharing", async () => {
    const key = generateLicenseKey();
    await saveLicense(key, {
      status: "active",
      tier: "pro",
      plan: "lifetime",
      createdAt: Date.now(),
      expiresAt: null,
      maxDevices: 3,
    });

    // Register device 1, 2, 3
    expect((await verifyLicenseKey(key, "device_1", "MacBook")).valid).toBe(true);
    expect((await verifyLicenseKey(key, "device_2", "Windows PC")).valid).toBe(true);
    expect((await verifyLicenseKey(key, "device_3", "Linux Desktop")).valid).toBe(true);

    // Existing device should still verify
    expect((await verifyLicenseKey(key, "device_1")).valid).toBe(true);

    // 4th device should be rejected to prevent key sharing
    const fourthDevice = await verifyLicenseKey(key, "device_4", "Unknown Laptop");
    expect(fourthDevice.valid).toBe(false);
    expect(fourthDevice.message).toContain("Device limit reached");
  });

  it("resets devices when requested", async () => {
    const key = generateLicenseKey();
    await saveLicense(key, {
      status: "active",
      tier: "pro",
      plan: "lifetime",
      createdAt: Date.now(),
      expiresAt: null,
      maxDevices: 1,
    });

    expect((await verifyLicenseKey(key, "device_1")).valid).toBe(true);
    expect((await verifyLicenseKey(key, "device_2")).valid).toBe(false);

    // Reset devices
    const { resetLicenseDevices } = await import("./storage");
    await resetLicenseDevices(key);

    // Device 2 can now register
    expect((await verifyLicenseKey(key, "device_2")).valid).toBe(true);
  });

  it("preserves backward compatibility for legacy individual records without planType or seatLimit", async () => {
    const key = generateLicenseKey();
    await saveLicense(key, {
      status: "active",
      tier: "pro",
      plan: "monthly",
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400 * 1000,
    });

    const stored = await getLicenseByRawKey(key);
    expect(stored?.planType).toBe("individual");
    expect(stored?.seatLimit).toBe(3);
    expect(stored?.maxDevices).toBe(3);

    const verified = await verifyLicenseKey(key, "legacy_dev_1", "Legacy Laptop");
    expect(verified.valid).toBe(true);
    expect(verified.planType).toBe("individual");
    expect(verified.seatLimit).toBe(3);
    expect(verified.maxDevices).toBe(3);
    expect(verified.deviceCount).toBe(1);
  });

  it("enforces configurable Team seat pools (5/10/25) and revokes individual seats", async () => {
    const key = generateLicenseKey();
    await saveLicense(key, {
      status: "active",
      tier: "pro",
      plan: "team",
      planType: "team",
      seatLimit: 5,
      orgName: "  Acme Engineering  ",
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 86400 * 1000,
    });

    for (let i = 1; i <= 5; i += 1) {
      const res = await verifyLicenseKey(key, `seat_${i}`, `Engineer ${i}`);
      expect(res.valid).toBe(true);
      expect(res.planType).toBe("team");
      expect(res.seatLimit).toBe(5);
      expect(res.orgName).toBe("Acme Engineering");
      expect(res.deviceCount).toBe(i);
    }

    // Re-verifying existing seat refreshes rather than consuming a new slot
    expect((await verifyLicenseKey(key, "seat_2", "Engineer 2 Updated")).valid).toBe(true);

    // 6th distinct device is blocked
    const sixth = await verifyLicenseKey(key, "seat_6", "Contractor");
    expect(sixth.valid).toBe(false);
    expect(sixth.message).toContain("Team seat limit reached (5/5");

    // Revoke single stale seat
    const revoked = await revokeLicenseDevice(key, { deviceId: "seat_3" });
    expect(revoked.revoked).toBe(true);
    expect(revoked.deviceCount).toBe(4);
    expect(revoked.devices?.some((d) => d.id === "seat_3")).toBe(false);

    // New device can now claim freed slot
    const sixthAfterRevoke = await verifyLicenseKey(key, "seat_6", "Contractor");
    expect(sixthAfterRevoke.valid).toBe(true);
    expect(sixthAfterRevoke.deviceCount).toBe(5);
  });

  it("resolves central pricing tiers cleanly for individual and team plans", () => {
    expect(INDIVIDUAL_PRICING.monthly.amountPaise).toBe(19900);
    expect(INDIVIDUAL_PRICING.lifetime.amountPaise).toBe(99900);
    expect(TEAM_PRICING[5].amountPaise).toBe(79900);
    expect(TEAM_PRICING[10].amountPaise).toBe(149900);
    expect(TEAM_PRICING[25].amountPaise).toBe(349900);

    const team10 = resolvePlanPricing({ plan: "team", seatLimit: 10 });
    expect(team10.ok).toBe(true);
    if (team10.ok) {
      expect(team10.pricing.seatLimit).toBe(10);
      expect(team10.pricing.amountPaise).toBe(149900);
    }

    const invalidTeam = resolvePlanPricing({ plan: "team", seatLimit: 7 });
    expect(invalidTeam.ok).toBe(false);
  });
});
