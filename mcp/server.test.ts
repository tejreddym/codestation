import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createMcpServer, executeMcpTool, getMcpTools } from "./server";
import { validateLicenseKey, resolveLicense, clearCachedLicense, PRICING } from "./config";
import { checkToolAccess } from "../config/shared-registry";
import {
  UPDATE_CHECK_TTL_MS,
  checkForCliUpdate,
  compareSemver,
  shouldSkipUpdateCheck,
} from "./update-check";

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

  it("ensures every MCP_TOOLS entry passes checkToolAccess under an entitled tier", () => {
    const proLicense = resolveLicense("CS-PRO-TEST-KEY");
    for (const tool of getMcpTools()) {
      const access = checkToolAccess(tool.name, proLicense);
      expect(access.allowed, `${tool.name} failed access check: ${access.reason}`).toBe(true);
    }
  });

  it("executes all newly added free tools and handles invalid inputs", async () => {
    const free = resolveLicense();

    // ULID
    const ulidRes = await executeMcpTool("codestation_ulid", { count: 3 }, free);
    expect(ulidRes.isError).toBeFalsy();
    const ulids = ulidRes.content[0].text.split("\n");
    expect(ulids).toHaveLength(3);
    for (const id of ulids) expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const badUlid = await executeMcpTool("codestation_ulid", { count: 99 }, free);
    expect(badUlid.isError).toBe(true);
    expect(badUlid.content[0].text).toContain("between 1 and 50");

    // NanoID
    const nanoRes = await executeMcpTool("codestation_nanoid", { length: 12, count: 2 }, free);
    expect(nanoRes.isError).toBeFalsy();
    const nanoids = nanoRes.content[0].text.split("\n");
    expect(nanoids).toHaveLength(2);
    expect(nanoids[0]).toHaveLength(12);

    const badNano = await executeMcpTool("codestation_nanoid", { length: 1 }, free);
    expect(badNano.isError).toBe(true);

    // JSON Diff
    const diffRes = await executeMcpTool(
      "codestation_json_diff",
      { left: '{"a":1,"b":2}', right: '{"a":1,"b":3,"c":4}' },
      free
    );
    expect(diffRes.isError).toBeFalsy();
    const diffParsed = JSON.parse(diffRes.content[0].text);
    expect(diffParsed.b.status).toBe("changed");
    expect(diffParsed.c.status).toBe("added");

    const badDiff = await executeMcpTool(
      "codestation_json_diff",
      { left: "{not-json", right: "{}" },
      free
    );
    expect(badDiff.isError).toBe(true);

    // JSONPath
    const pathRes = await executeMcpTool(
      "codestation_json_path",
      { json: '{"users":[{"name":"Ada"},{"name":"Lin"}]}', expression: "$.users[*].name" },
      free
    );
    expect(pathRes.isError).toBeFalsy();
    expect(JSON.parse(pathRes.content[0].text).matches).toEqual(["Ada", "Lin"]);

    const badPath = await executeMcpTool(
      "codestation_json_path",
      { json: '{"a":1}', expression: "no-dollar" },
      free
    );
    expect(badPath.isError).toBe(true);

    // HTML Codec
    const htmlEnc = await executeMcpTool(
      "codestation_html_codec",
      { text: '<div class="x">&</div>', action: "encode" },
      free
    );
    expect(htmlEnc.content[0].text).toBe("&lt;div class=&quot;x&quot;&gt;&amp;&lt;/div&gt;");
    const htmlDec = await executeMcpTool(
      "codestation_html_codec",
      { text: "&lt;b&gt;Hi&lt;/b&gt;", action: "decode" },
      free
    );
    expect(htmlDec.content[0].text).toBe("<b>Hi</b>");

    const badHtml = await executeMcpTool(
      "codestation_html_codec",
      { text: "hi", action: "invalid" },
      free
    );
    expect(badHtml.isError).toBe(true);

    // CSV <-> JSON
    const csvToJsonRes = await executeMcpTool(
      "codestation_csv_json",
      { input: "name,role\nAda,Engineer", direction: "csv-to-json" },
      free
    );
    expect(JSON.parse(csvToJsonRes.content[0].text)).toEqual([{ name: "Ada", role: "Engineer" }]);

    const badCsv = await executeMcpTool(
      "codestation_csv_json",
      { input: '{"not":"array"}', direction: "json-to-csv" },
      free
    );
    expect(badCsv.isError).toBe(true);

    // Base64 validation edge case + roundtrip
    const b64 = await executeMcpTool("codestation_base64", { text: "Code Station", action: "encode" }, free);
    expect(b64.content[0].text).toBe("Q29kZSBTdGF0aW9u");
    const badB64 = await executeMcpTool("codestation_base64", { text: "!!!invalid!!!", action: "decode" }, free);
    expect(badB64.isError).toBe(true);
  });

  it("executes cron_next_runs for pro tier, gates free tier, and rejects invalid cron/timezone", async () => {
    const free = resolveLicense();
    const blocked = await executeMcpTool("codestation_cron_next_runs", { expression: "0 9 * * 1-5" }, free);
    expect(blocked.isError).toBe(true);
    expect(blocked.content[0].text).toContain("Code Station Pro");

    const pro = resolveLicense("CS-PRO-TEST-KEY");
    const res = await executeMcpTool(
      "codestation_cron_next_runs",
      {
        expression: "0 9 * * *",
        count: 3,
        timeZone: "UTC",
        startFrom: "2026-10-01T00:00:00Z",
      },
      pro
    );
    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.runs).toHaveLength(3);
    expect(parsed.runs[0].dateTime).toContain("09:00:00");

    const badCron = await executeMcpTool(
      "codestation_cron_next_runs",
      { expression: "invalid cron", startFrom: "2026-10-01T00:00:00Z" },
      pro
    );
    expect(badCron.isError).toBe(true);
  });
});

describe("MCP CLI Update Check", () => {
  it("compares semver strings and respects opt-out flags/env", () => {
    expect(compareSemver("1.2.1", "1.3.0")).toBe(-1);
    expect(compareSemver("1.2.1", "1.2.1")).toBe(0);
    expect(compareSemver("2.0.0", "1.9.9")).toBe(1);

    expect(shouldSkipUpdateCheck(["--no-update-check"], {}, true)).toBe(true);
    expect(shouldSkipUpdateCheck([], { CODESTATION_NO_UPDATE_CHECK: "1" }, true)).toBe(true);
    expect(shouldSkipUpdateCheck(["status"], {}, true)).toBe(false);
  });

  it("caches update results for 24h and handles network failures silently", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-update-test-"));
    const cacheFile = path.join(tmpDir, "update-check.json");
    const notices: string[] = [];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: "1.4.0" }), { status: 200 })
    );

    try {
      const first = await checkForCliUpdate({
        currentVersion: "1.2.1",
        argv: ["status"],
        env: {},
        cacheFile,
        now: 1_000_000,
        fetchFn: fetchMock as unknown as typeof fetch,
        onNotice: (msg) => notices.push(msg),
        forceInTest: true,
      });
      expect(first).toEqual({ status: "fetched", updateAvailable: true, latestVersion: "1.4.0" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(notices[0]).toContain("v1.2.1 -> v1.4.0");

      // Within 24h -> served from cache without calling fetch again
      const second = await checkForCliUpdate({
        currentVersion: "1.2.1",
        argv: ["status"],
        env: {},
        cacheFile,
        now: 1_000_000 + UPDATE_CHECK_TTL_MS - 10_000,
        fetchFn: fetchMock as unknown as typeof fetch,
        onNotice: (msg) => notices.push(msg),
        forceInTest: true,
      });
      expect(second.status).toBe("cached");
      expect(second.updateAvailable).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Network failure after TTL expiry fails gracefully
      const failingFetch = vi.fn().mockRejectedValue(new Error("offline"));
      const third = await checkForCliUpdate({
        currentVersion: "1.2.1",
        argv: ["status"],
        env: {},
        cacheFile,
        now: 1_000_000 + UPDATE_CHECK_TTL_MS + 10_000,
        fetchFn: failingFetch as unknown as typeof fetch,
        onNotice: (msg) => notices.push(msg),
        forceInTest: true,
      });
      expect(third).toEqual({ status: "error", updateAvailable: false });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
