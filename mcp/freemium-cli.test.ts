// @vitest-environment node
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKGROUND_REVALIDATE_INTERVAL_MS,
  FREE_TIER_SLUGS,
  OFFLINE_GRACE_WINDOW_MS,
  clearCachedLicense,
  getStableMachineFingerprint,
  readCachedLicense,
  resolveLicense,
  revalidateLicenseInBackground,
  saveCachedLicense,
  verifyLicenseOnline,
} from "./config";
import { handleCliSubcommand } from "./cli-tools";
import { describeBridgeTool, getToolSampleArgs } from "./registry-bridge";
import { executeMcpTool, getMcpTools } from "./server";
import { getTool } from "../config/tools";

describe("MCP Freemium Tier, 14-Day Offline Grace Cache & Pipeable CLI", () => {
  let tmpDir: string;
  let cacheFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codestation-freemium-"));
    cacheFile = path.join(tmpDir, "license.json");
    delete process.env.CODESTATION_LICENSE_KEY;
    delete process.env.CODESTATION_LICENSE_CACHE_FILE;
    delete process.env.CODESTATION_MCP_STATIONS;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("Freemium gating (Free 15 core utilities + 3 universal tools vs Pro)", () => {
    it("allows all 15 Free core utilities without a license key via codestation_run_tool", async () => {
      expect(FREE_TIER_SLUGS.size).toBe(15);
      const freeLicense = resolveLicense(undefined, { cacheFile, forceInTest: true });
      expect(freeLicense.tier).toBe("free");
      expect(freeLicense.isPro).toBe(false);

      for (const slug of FREE_TIER_SLUGS) {
        const meta = describeBridgeTool(slug);
        expect(meta?.tier, `Expected ${slug} to have tier=free`).toBe("free");

        const def = getTool(slug)!;
        const sample = getToolSampleArgs(def);
        const res = await executeMcpTool(
          "codestation_run_tool",
          { slug, input: sample.input ?? "", options: sample.options ?? {} },
          freeLicense
        );
        expect(res.isError, `Free tool ${slug} failed: ${res.content[0]?.text}`).toBeFalsy();
        expect(res.content[0].text.length).toBeGreaterThan(0);
      }
    });

    it("gates SHA-512/MD5 via codestation_hash on Free tier while allowing SHA-256", async () => {
      const free = resolveLicense(undefined, { cacheFile, forceInTest: true });
      const pro = resolveLicense("CS-PRO-HASH-KEY", { cacheFile, forceInTest: true });

      const freeSha256 = await executeMcpTool("codestation_hash", { text: "hello" }, free);
      expect(freeSha256.isError).toBeFalsy();
      expect(freeSha256.content[0].text).toHaveLength(64);

      const blockedSha512 = await executeMcpTool(
        "codestation_hash",
        { text: "hello", algorithm: "SHA-512" },
        free
      );
      expect(blockedSha512.isError).toBe(true);
      expect(blockedSha512.content[0].text).toContain("Code Station Pro");
      expect(blockedSha512.content[0].text).toContain("https://codestation.in/pro");

      const proSha512 = await executeMcpTool(
        "codestation_hash",
        { text: "hello", algorithm: "SHA-512" },
        pro
      );
      expect(proSha512.isError).toBeFalsy();
      expect(proSha512.content[0].text).toHaveLength(128);
    });

    it("returns helpful Pro upgrade notice naming tool and upgrade link on Pro tools, unlocking with Team/Pro keys", async () => {
      const free = resolveLicense(undefined, { cacheFile, forceInTest: true });
      const blocked = await executeMcpTool(
        "codestation_run_tool",
        { slug: "sql-formatter", input: "select id,name from users where active=1" },
        free
      );
      expect(blocked.isError).toBe(true);
      expect(blocked.content[0].text).toContain("sql_formatter");
      expect(blocked.content[0].text).toContain("Code Station Pro");
      expect(blocked.content[0].text).toContain("https://codestation.in/pro");

      const teamLicense = resolveLicense("CS-TEAM-ACME-001", { cacheFile, forceInTest: true });
      expect(teamLicense.isPro).toBe(true);
      const allowed = await executeMcpTool(
        "codestation_run_tool",
        { slug: "sql-formatter", input: "select id,name from users where active=1" },
        teamLicense
      );
      expect(allowed.isError).toBeFalsy();
      expect(allowed.content[0].text.toUpperCase()).toContain("SELECT");

      // --stations expansion gated on Free, unlocked on Team/Pro
      expect(getMcpTools({ stations: ["sql-database"] }, free)).toHaveLength(28);
      expect(getMcpTools({ stations: ["sql-database"] }, teamLicense).length).toBeGreaterThan(28);
    });
  });

  describe("Stable machine fingerprint & 14-day offline grace cache", () => {
    it("generates a deterministic machine fingerprint independent of Node version or cwd", () => {
      const fp1 = getStableMachineFingerprint(process.env, {
        hostname: "MacBook-Pro.local",
        platform: "darwin",
        arch: "arm64",
        username: "ada",
      });
      const fp2 = getStableMachineFingerprint(
        { ...process.env, PWD: "/other/dir" },
        {
          hostname: "macbook-pro.local",
          platform: "darwin",
          arch: "arm64",
          username: "Ada",
        }
      );
      expect(fp1).toMatch(/^[a-f0-9]{64}$/);
      expect(fp1).toBe(fp2);

      const fpDifferentHost = getStableMachineFingerprint(process.env, {
        hostname: "other-box.local",
        platform: "darwin",
        arch: "arm64",
        username: "ada",
      });
      expect(fpDifferentHost).not.toBe(fp1);
    });

    it("caches license with 0600 permissions, respects 14-day grace window, and rejects expiry or foreign fingerprints", () => {
      const start = Date.UTC(2026, 10, 1, 12, 0, 0);
      const fp = "test-machine-fp-1234";
      saveCachedLicense(
        "CS-PRO-GRACE-001",
        true,
        { verifiedAt: start, planType: "individual", deviceFingerprint: fp },
        { cacheFile, now: start, forceInTest: true, fingerprint: fp }
      );

      expect(fs.existsSync(cacheFile)).toBe(true);
      if (process.platform !== "win32") {
        const mode = fs.statSync(cacheFile).mode & 0o777;
        expect(mode).toBe(0o600);
      }

      // Day 13 -> valid offline grace
      const day13 = resolveLicense(undefined, {
        cacheFile,
        now: start + OFFLINE_GRACE_WINDOW_MS - 60_000,
        forceInTest: true,
        fingerprint: fp,
      });
      expect(day13.isPro).toBe(true);
      expect(day13.source).toBe("cache");
      expect(day13.licenseKey).toBe("CS-PRO-GRACE-001");

      // Different machine fingerprint -> rejected even inside 14-day window
      const foreign = resolveLicense(undefined, {
        cacheFile,
        now: start + 1000,
        forceInTest: true,
        fingerprint: "another-machine-fp",
      });
      expect(foreign.isPro).toBe(false);
      expect(foreign.tier).toBe("free");

      // Past 14 days -> offline grace expires cleanly back to Free
      const day14Plus = resolveLicense(undefined, {
        cacheFile,
        now: start + OFFLINE_GRACE_WINDOW_MS + 1000,
        forceInTest: true,
        fingerprint: fp,
      });
      expect(day14Plus.isPro).toBe(false);
      expect(day14Plus.tier).toBe("free");
      expect(clearCachedLicense({ cacheFile, forceInTest: true })).toBe(true);
    });

    it("silently revalidates in background, handles offline gracefully, and clears revoked keys", async () => {
      const t0 = Date.UTC(2026, 10, 1, 0, 0, 0);
      const t2 = t0 + BACKGROUND_REVALIDATE_INTERVAL_MS + 60_000;
      const fp = "reval-fp-1";

      saveCachedLicense(
        "CS-PRO-REVAL-1",
        true,
        { verifiedAt: t0, lastCheckedAt: t0, deviceFingerprint: fp },
        { cacheFile, now: t0, forceInTest: true, fingerprint: fp }
      );
      const lic = resolveLicense(undefined, { cacheFile, now: t2, forceInTest: true, fingerprint: fp });

      // Offline network error -> preserves cache silently
      const offlineFetch = vi.fn().mockRejectedValue(new Error("ENETUNREACH"));
      const offlineRes = await revalidateLicenseInBackground(lic, {
        cacheFile,
        now: t2,
        forceInTest: true,
        fingerprint: fp,
        fetchFn: offlineFetch as unknown as typeof fetch,
      });
      expect(offlineRes).toBe(false);
      expect(readCachedLicense({ cacheFile, now: t2, forceInTest: true, fingerprint: fp })?.key).toBe("CS-PRO-REVAL-1");

      // Online HTTP 200 valid -> refreshes verifiedAt & plan metadata
      const okFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ valid: true, planType: "team", orgName: "Code Station Team" }), { status: 200 })
      );
      const okRes = await revalidateLicenseInBackground(lic, {
        cacheFile,
        now: t2,
        forceInTest: true,
        fingerprint: fp,
        fetchFn: okFetch as unknown as typeof fetch,
      });
      expect(okRes).toBe(true);
      const refreshed = readCachedLicense({ cacheFile, now: t2, forceInTest: true, fingerprint: fp });
      expect(refreshed?.verifiedAt).toBe(t2);
      expect(refreshed?.orgName).toBe("Code Station Team");

      // Explicit revocation (403 valid: false) -> clears local cache
      const t3 = t2 + BACKGROUND_REVALIDATE_INTERVAL_MS + 60_000;
      const revokedFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ valid: false, message: "Key revoked" }), { status: 403 })
      );
      const revokedRes = await revalidateLicenseInBackground(lic, {
        cacheFile,
        now: t3,
        forceInTest: true,
        fingerprint: fp,
        fetchFn: revokedFetch as unknown as typeof fetch,
      });
      expect(revokedRes).toBe(false);
      expect(readCachedLicense({ cacheFile, now: t3, forceInTest: true, fingerprint: fp })).toBeNull();
    });

    it("rejects explicitly invalid/revoked keys on verifyLicenseOnline while allowing offline fallback", async () => {
      const fp = "login-fp-1";
      const badFormat = await verifyLicenseOnline("not-a-valid-key", { cacheFile, forceInTest: true, fingerprint: fp });
      expect(badFormat.valid).toBe(false);

      const serverRejected = await verifyLicenseOnline("CS-PRO-REVOKED-1", {
        cacheFile,
        forceInTest: true,
        fingerprint: fp,
        fetchFn: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ valid: false, message: "Device limit exceeded" }), { status: 403 })
        ) as unknown as typeof fetch,
      });
      expect(serverRejected.valid).toBe(false);
      expect(serverRejected.revoked).toBe(true);

      const offlineFallback = await verifyLicenseOnline("CS-PRO-OFFLINE-1", {
        cacheFile,
        forceInTest: true,
        fingerprint: fp,
        fetchFn: vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch,
      });
      expect(offlineFallback.valid).toBe(true);
      expect(offlineFallback.offlineFallback).toBe(true);
      expect(readCachedLicense({ cacheFile, forceInTest: true, fingerprint: fp })?.key).toBe("CS-PRO-OFFLINE-1");
    });
  });

  describe("Pipeable Local CLI (list, info, run, login, status, logout)", () => {
    it("supports codestation list, info, login, status, and logout", async () => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const io = {
        stdout: (c: string) => stdout.push(c),
        stderr: (c: string) => stderr.push(c),
        cacheOptions: { cacheFile, forceInTest: true },
        verifyOptions: {
          fetchFn: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ valid: true, planType: "individual" }), { status: 200 })
          ) as unknown as typeof fetch,
        },
      };

      // list filtered
      const listRes = await handleCliSubcommand(
        "list",
        ["--station", "json", "--tier", "free", "--search", "formatter", "--json"],
        io
      );
      expect(listRes.exitCode).toBe(0);
      const listJson = JSON.parse(stdout.join(""));
      expect(listJson.tools.some((t: { slug: string }) => t.slug === "json-formatter")).toBe(true);

      // info
      stdout.length = 0;
      const infoRes = await handleCliSubcommand("info", ["json-to-yaml"], io);
      expect(infoRes.exitCode).toBe(0);
      const infoText = stdout.join("");
      expect(infoText).toContain("json-to-yaml");
      expect(infoText).toContain("Tier:        PRO");
      expect(infoText).toContain("Runtime:     node-pure");

      // status before login
      stdout.length = 0;
      const statusFree = await handleCliSubcommand("status", ["--json"], io);
      expect(statusFree.exitCode).toBe(0);
      expect(JSON.parse(stdout.join("")).license.tier).toBe("free");

      // login -> status -> logout
      stdout.length = 0;
      const loginRes = await handleCliSubcommand("login", ["CS-PRO-CLI-9999"], io);
      expect(loginRes.exitCode).toBe(0);
      expect(stdout.join("")).toContain("activated");

      stdout.length = 0;
      const statusPro = await handleCliSubcommand("status", ["--json"], io);
      expect(statusPro.exitCode).toBe(0);
      const parsedStatus = JSON.parse(stdout.join(""));
      expect(parsedStatus.license.tier).toBe("pro");
      expect(parsedStatus.license.source).toBe("cache");
      expect(parsedStatus.license.offlineGraceRemainingDays).toBeGreaterThan(13);

      stdout.length = 0;
      const logoutRes = await handleCliSubcommand("logout", [], io);
      expect(logoutRes.exitCode).toBe(0);
      expect(stdout.join("")).toContain("Logged out");
      expect(fs.existsSync(cacheFile)).toBe(false);
    });

    it("runs free and pro tools via --input, --in/--out files, --options, and stdin piping", async () => {
      const stdout: string[] = [];
      const stderr: string[] = [];

      // Unlicensed run of Pro tool -> blocked cleanly on stderr
      const blocked = await handleCliSubcommand(
        "run",
        ["json-to-yaml", "--input", '{"a":1}'],
        {
          stdout: (c) => stdout.push(c),
          stderr: (c) => stderr.push(c),
          cacheOptions: { cacheFile, forceInTest: true },
        }
      );
      expect(blocked.exitCode).toBe(1);
      expect(stderr.join("")).toContain("Code Station Pro");
      expect(stderr.join("")).toContain("https://codestation.in/pro");

      // Piped stdin -> Pro tool unlocked via --key
      stdout.length = 0;
      stderr.length = 0;
      const pipedPro = await handleCliSubcommand(
        "run",
        ["json-to-yaml", "--key", "CS-PRO-PIPE-1"],
        {
          stdout: (c) => stdout.push(c),
          stderr: (c) => stderr.push(c),
          isStdinTTY: false,
          stdinText: async () => '{"service":"codestation","port":3000}\n',
          cacheOptions: { cacheFile, forceInTest: true },
        }
      );
      expect(pipedPro.exitCode).toBe(0);
      expect(stdout.join("")).toContain("service: codestation");
      expect(stdout.join("")).toContain("port: 3000");

      // --in + --out + --options file workflow (Free tool)
      const inJsonPath = path.join(tmpDir, "raw.json");
      const outJsonPath = path.join(tmpDir, "pretty.json");
      fs.writeFileSync(inJsonPath, '{"hello":"world","n":1}');
      stdout.length = 0;
      stderr.length = 0;
      const fileRun = await handleCliSubcommand(
        "run",
        ["json-formatter", "--in", inJsonPath, "--out", outJsonPath],
        {
          stdout: (c) => stdout.push(c),
          stderr: (c) => stderr.push(c),
          cacheOptions: { cacheFile, forceInTest: true },
        }
      );
      expect(fileRun.exitCode).toBe(0);
      expect(fs.readFileSync(outJsonPath, "utf-8")).toContain('  "hello": "world"');
    });

    it("supports real shell stdin piping cleanly through compiled CLI entry", () => {
      const bundlePath = path.join(process.cwd(), "bin/codestation-mcp.mjs");
      if (!fs.existsSync(bundlePath)) return;

      const res = spawnSync(
        process.execPath,
        [bundlePath, "--no-update-check", "run", "json-minifier"],
        {
          input: '{\n  "hello": "codestation",\n  "ok": true\n}\n',
          encoding: "utf-8",
          env: {
            ...process.env,
            CODESTATION_NO_UPDATE_CHECK: "1",
            CODESTATION_LICENSE_CACHE_FILE: cacheFile,
          },
          timeout: 10_000,
        }
      );
      expect(res.status).toBe(0);
      expect(res.stdout.trim()).toBe('{"hello":"codestation","ok":true}');
    });
  });
});
