import { describe, it, expect, beforeEach } from "vitest";
import { createMcpServer, executeMcpTool, getMcpTools } from "./server";
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

describe("MCP Server Tools & Execution", () => {
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

  it("lists all registered tools in getMcpTools", () => {
    const tools = getMcpTools();
    expect(tools.length).toBeGreaterThanOrEqual(15);
    expect(tools.some(t => t.name === "codestation_curl_to_code")).toBe(true);
    expect(tools.some(t => t.name === "codestation_env_audit")).toBe(true);
    expect(tools.some(t => t.name === "codestation_mock_data")).toBe(true);
    expect(tools.some(t => t.name === "codestation_git_conflict")).toBe(true);
  });

  it("executes free tools for free-tier users", async () => {
    const freeLicense = resolveLicense();
    const res = await executeMcpTool("codestation_uuid", { count: 2 }, freeLicense);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text.split("\n").length).toBe(2);
  });

  it("blocks pro tools when user has free tier", async () => {
    const freeLicense = resolveLicense();
    const res = await executeMcpTool("codestation_curl_to_code", { curl: "curl https://api.example.com" }, freeLicense);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Code Station Pro");
  });

  it("executes pro tools when user has pro tier", async () => {
    const proLicense = resolveLicense("CS-PRO-TEST-KEY");
    const curlRes = await executeMcpTool("codestation_curl_to_code", { curl: "curl https://api.example.com" }, proLicense);
    expect(curlRes.isError).toBeFalsy();
    expect(curlRes.content[0].text).toContain("fetch");

    const mockRes = await executeMcpTool("codestation_mock_data", { template: "users", count: 3 }, proLicense);
    expect(mockRes.isError).toBeFalsy();
    expect(JSON.parse(mockRes.content[0].text).length).toBe(3);
  });

  it("handles unknown tool gracefully", async () => {
    const license = resolveLicense();
    const res = await executeMcpTool("codestation_nonexistent", {}, license);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("not registered in Code Station registry");
  });
});
