import { describe, it, expect, beforeEach } from "vitest";
import { hashLicenseKey, generateLicenseKey, isValidKeyFormat } from "./hash";
import { saveLicense, getLicenseByRawKey, verifyLicenseKey, clearTestStore } from "./storage";

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
});
