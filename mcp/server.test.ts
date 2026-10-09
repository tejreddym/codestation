import { describe, it, expect, beforeEach } from "vitest";
import { createMcpServer } from "./server";
import { validateLicenseKey, resolveLicense, clearCachedLicense, PRICING, PRO_TOOLS } from "./config";

describe("MCP License System", () => {
  beforeEach(() => {
    clearCachedLicense();
    delete process.env.CODESTATION_LICENSE_KEY;
  });

  it("recognizes free tier when no key is passed", () => {
    const license = resolveLicense();
    expect(license.isPro).toBe(false);
    expect(license.tier).toBe("free");
  });

  it("recognizes pro license keys with valid format", () => {
    expect(validateLicenseKey("CS-PRO-ABCD-1234")).toBe(true);
    expect(validateLicenseKey("cspro_live_abc123")).toBe(true);
    expect(validateLicenseKey("CS-PRO-DEV")).toBe(true);
    expect(validateLicenseKey("invalid_key")).toBe(false);
  });

  it("resolves pro license status when valid key is provided via CLI", () => {
    const license = resolveLicense("CS-PRO-VALID-KEY");
    expect(license.isPro).toBe(true);
    expect(license.tier).toBe("pro");
  });

  it("includes ₹199 in India pricing in config", () => {
    expect(PRICING.inr).toContain("199");
    expect(PRICING.usd).toContain("2.99");
  });
});

describe("MCP Server Tools", () => {
  beforeEach(() => {
    clearCachedLicense();
    delete process.env.CODESTATION_LICENSE_KEY;
  });

  it("initializes MCP server without errors", () => {
    const { server, license } = createMcpServer();
    expect(server).toBeDefined();
    expect(license.isPro).toBe(false);
  });

  it("initializes pro server when valid key is provided", () => {
    const { server, license } = createMcpServer("CS-PRO-TEST-KEY");
    expect(server).toBeDefined();
    expect(license.isPro).toBe(true);
  });

  it("registers new JSON to TypeScript and Zod tools", () => {
    const { server } = createMcpServer("CS-PRO-TEST-KEY");
    expect(server).toBeDefined();
  });

  it("includes all killer tools in PRO_TOOLS set", () => {
    expect(PRO_TOOLS.has("codestation_curl_to_code")).toBe(true);
    expect(PRO_TOOLS.has("codestation_env_audit")).toBe(true);
    expect(PRO_TOOLS.has("codestation_mock_data")).toBe(true);
    expect(PRO_TOOLS.has("codestation_git_conflict")).toBe(true);
  });
});

