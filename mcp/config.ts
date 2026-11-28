import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface LicenseStatus {
  isPro: boolean;
  licenseKey?: string;
  source: "cli" | "env" | "cache" | "none";
  tier: "free" | "pro";
  planType?: "individual" | "team";
  orgName?: string;
  verifiedAt?: number;
  graceExpiresAt?: number;
  machineFingerprint?: string;
}

export interface CachedLicense {
  key: string;
  verifiedAt: number;
  lastCheckedAt?: number;
  isPro: boolean;
  tier?: "free" | "pro";
  planType?: "individual" | "team";
  orgName?: string;
  deviceFingerprint?: string;
  expiresAt?: number;
}

export interface LicenseCacheOptions {
  cacheFile?: string;
  now?: number;
  forceInTest?: boolean;
  fingerprint?: string;
}

export interface OnlineVerifyOptions extends LicenseCacheOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  allowOfflineFallback?: boolean;
}

export interface OnlineVerifyResult {
  valid: boolean;
  offlineFallback?: boolean;
  revoked?: boolean;
  tier?: "free" | "pro";
  planType?: "individual" | "team";
  orgName?: string;
  expiresAt?: number;
  message: string;
  cached?: CachedLicense;
}

export const OFFLINE_GRACE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const BACKGROUND_REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_VERIFY_ENDPOINT = "https://codestation.in/api/v1/license/verify";

export const PRICING = {
  inr: "₹199 / month",
  usd: "$2.99 / month",
  lifetimeInr: "₹999 one-time",
  lifetimeUsd: "$19.00 one-time",
  upgradeUrl: "https://codestation.in/pro",
};

/**
 * Exact 15 core developer utilities available without a license key in codestation-mcp.
 * Plus the 3 universal discovery/router tools (list, describe, run for free slugs).
 */
export const FREE_TIER_SLUGS: ReadonlySet<string> = new Set([
  "json-formatter",
  "json-validator",
  "json-minifier",
  "base64-encoder",
  "base64-decoder",
  "url-encoder",
  "url-decoder",
  "uuid-generator",
  "sha-256-generator",
  "jwt-decoder",
  "unix-timestamp-converter",
  "regex-tester",
  "cron-explainer",
  "text-diff",
  "markdown-to-html",
]);

/** Common alias slugs mapped to canonical free-tier utilities */
export const FREE_TIER_ALIASES: ReadonlyMap<string, string> = new Map([
  ["timestamp-convert", "unix-timestamp-converter"],
  ["timestamp-converter", "unix-timestamp-converter"],
  ["sha256", "sha-256-generator"],
  ["sha-256", "sha-256-generator"],
  ["format-json", "json-formatter"],
]);

export function isFreeTierSlug(slugOrId: string): boolean {
  const norm = slugOrId.trim().toLowerCase().replace(/^codestation[-_]/, "").replace(/_/g, "-");
  if (FREE_TIER_SLUGS.has(norm)) return true;
  const canonical = FREE_TIER_ALIASES.get(norm);
  return Boolean(canonical && FREE_TIER_SLUGS.has(canonical));
}

/** Direct MCP tool names in TOP_25 / server that are Pro-gated under the Freemium model */
export const PRO_TOOLS = new Set([
  "codestation_json_to_yaml",
  "codestation_json_path",
  "codestation_json_diff",
  "codestation_csv_json",
  "codestation_case_convert",
  "codestation_format_sql",
  "codestation_cidr_calc",
  "codestation_token_count",
  "codestation_json_to_typescript",
  "codestation_json_to_zod",
  "codestation_curl_to_code",
  "codestation_env_audit",
  "codestation_mock_data",
  "codestation_git_conflict",
  "codestation_hmac",
  "codestation_cron_next_runs",
  "codestation_timezone_convert",
  "codestation_business_days",
  "codestation_json_schema",
  "codestation_ulid",
  "codestation_nanoid",
  "codestation_html_codec",
]);

export const FREE_DIRECT_MCP_TOOLS = new Set([
  "codestation_list_tools",
  "codestation_describe_tool",
  "codestation_run_tool",
  "codestation_format_json",
  "codestation_base64",
  "codestation_url_codec",
  "codestation_uuid",
  "codestation_hash",
  "codestation_jwt_decode",
  "codestation_timestamp_convert",
  "codestation_regex_test",
  "codestation_cron_explain",
  "codestation_text_diff",
  "codestation_markdown_to_html",
]);

const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".codestation");
const DEFAULT_CACHE_FILE = path.join(DEFAULT_CACHE_DIR, "license.json");

export function getLicenseCacheFilePath(overridePath?: string): string {
  if (overridePath && overridePath.trim()) {
    return path.resolve(overridePath.trim());
  }
  const envPath = process.env.CODESTATION_LICENSE_CACHE_FILE;
  if (envPath && envPath.trim()) {
    return path.resolve(envPath.trim());
  }
  return DEFAULT_CACHE_FILE;
}

function shouldSkipDiskCacheInTest(options?: LicenseCacheOptions): boolean {
  if (options?.forceInTest || options?.cacheFile || process.env.CODESTATION_LICENSE_CACHE_FILE) {
    return false;
  }
  return process.env.NODE_ENV === "test";
}

/**
 * Generates a deterministic machine fingerprint bound to OS hostname, platform,
 * architecture, and username — deliberately excluding Node version or cwd so
 * runtime upgrades and directory changes do not consume extra device seats.
 */
export function getStableMachineFingerprint(
  env: NodeJS.ProcessEnv = process.env,
  overrides?: { hostname?: string; platform?: string; arch?: string; username?: string }
): string {
  const hostname = (overrides?.hostname ?? os.hostname() ?? "unknown-host").toLowerCase().trim();
  const platform = (overrides?.platform ?? process.platform).toLowerCase().trim();
  const arch = (overrides?.arch ?? process.arch).toLowerCase().trim();
  let username = overrides?.username;
  if (!username) {
    try {
      username = os.userInfo().username;
    } catch {
      username = env.USER || env.USERNAME || "unknown-user";
    }
  }
  const payload = `codestation-fp-v1|${hostname}|${platform}|${arch}|${username.toLowerCase().trim()}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function readCachedLicense(options?: LicenseCacheOptions): CachedLicense | null {
  if (shouldSkipDiskCacheInTest(options)) return null;

  const cacheFile = getLicenseCacheFilePath(options?.cacheFile);
  const now = options?.now ?? Date.now();
  const currentFingerprint = options?.fingerprint ?? getStableMachineFingerprint();

  try {
    if (!fs.existsSync(cacheFile)) return null;
    const raw = fs.readFileSync(cacheFile, "utf-8");
    const data = JSON.parse(raw) as CachedLicense;
    if (!data || !data.isPro || typeof data.key !== "string" || typeof data.verifiedAt !== "number") {
      return null;
    }
    if (data.deviceFingerprint && data.deviceFingerprint !== currentFingerprint) {
      return null;
    }
    if (typeof data.expiresAt === "number" && now > data.expiresAt) {
      return null;
    }
    if (now - data.verifiedAt >= OFFLINE_GRACE_WINDOW_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearCachedLicense(options?: LicenseCacheOptions): boolean {
  if (shouldSkipDiskCacheInTest(options)) return false;

  const cacheFile = getLicenseCacheFilePath(options?.cacheFile);
  try {
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      return true;
    }
  } catch {
    // Ignore cache clear errors
  }
  return false;
}

export function saveCachedLicense(
  key: string,
  isPro: boolean,
  extra?: Partial<Omit<CachedLicense, "key" | "isPro">>,
  options?: LicenseCacheOptions
): CachedLicense | null {
  if (shouldSkipDiskCacheInTest(options)) return null;

  const cacheFile = getLicenseCacheFilePath(options?.cacheFile);
  const cacheDir = path.dirname(cacheFile);
  const now = options?.now ?? Date.now();
  const fingerprint = options?.fingerprint ?? getStableMachineFingerprint();

  const cache: CachedLicense = {
    key,
    isPro,
    tier: isPro ? "pro" : "free",
    verifiedAt: extra?.verifiedAt ?? now,
    lastCheckedAt: extra?.lastCheckedAt ?? now,
    deviceFingerprint: extra?.deviceFingerprint ?? fingerprint,
    ...(extra?.planType ? { planType: extra.planType } : {}),
    ...(extra?.orgName ? { orgName: extra.orgName } : {}),
    ...(extra?.expiresAt !== undefined ? { expiresAt: extra.expiresAt } : {}),
  };

  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2) + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });
    try {
      fs.chmodSync(cacheFile, 0o600);
    } catch {
      // Ignore chmod issues on filesystems without POSIX permissions
    }
    return cache;
  } catch {
    return null;
  }
}

/**
 * Validates whether a given license key has a valid Pro/Team key format.
 */
export function validateLicenseKey(rawKey?: string | null): boolean {
  if (!rawKey) return false;
  const key = rawKey.trim();
  if (!key) return false;

  if (/^CS-(?:PRO|TEAM)-[A-Za-z0-9_-]+$/i.test(key) || key.startsWith("cspro_")) {
    return true;
  }

  if (key === "PRO_DEMO_KEY" || key === "CS-PRO-DEV") {
    return true;
  }

  return false;
}

export function resolveLicense(cliKey?: string, options?: LicenseCacheOptions): LicenseStatus {
  const fingerprint = options?.fingerprint ?? getStableMachineFingerprint();

  // 1. Check CLI Argument
  if (cliKey) {
    const cleaned = cliKey.trim();
    if (validateLicenseKey(cleaned)) {
      saveCachedLicense(cleaned, true, undefined, options);
      return {
        isPro: true,
        licenseKey: cleaned,
        source: "cli",
        tier: "pro",
        machineFingerprint: fingerprint,
      };
    }
  }

  // 2. Check Environment Variable
  const envKey = process.env.CODESTATION_LICENSE_KEY?.trim();
  if (envKey) {
    if (validateLicenseKey(envKey)) {
      saveCachedLicense(envKey, true, undefined, options);
      return {
        isPro: true,
        licenseKey: envKey,
        source: "env",
        tier: "pro",
        machineFingerprint: fingerprint,
      };
    }
  }

  // 3. Check Cached License File (within 14-day offline grace window & matching machine fingerprint)
  const cached = readCachedLicense(options);
  if (cached && cached.isPro) {
    return {
      isPro: true,
      licenseKey: cached.key,
      source: "cache",
      tier: "pro",
      planType: cached.planType,
      orgName: cached.orgName,
      verifiedAt: cached.verifiedAt,
      graceExpiresAt: cached.verifiedAt + OFFLINE_GRACE_WINDOW_MS,
      machineFingerprint: fingerprint,
    };
  }

  return { isPro: false, source: "none", tier: "free", machineFingerprint: fingerprint };
}

/**
 * Verifies a Pro / Team license key against the Code Station licensing API.
 * Falls back cleanly to offline grace mode when unreachable unless explicitly revoked (HTTP 403/401).
 */
export async function verifyLicenseOnline(
  rawKey: string,
  options?: OnlineVerifyOptions
): Promise<OnlineVerifyResult> {
  const key = rawKey.trim();
  if (!validateLicenseKey(key)) {
    return {
      valid: false,
      revoked: true,
      message: "Invalid license key format. Expected CS-PRO-... or cspro_... key.",
    };
  }

  const endpoint = options?.endpoint || process.env.CODESTATION_VERIFY_URL || DEFAULT_VERIFY_ENDPOINT;
  const fetchFn = options?.fetchFn ?? globalThis.fetch;
  const fingerprint = options?.fingerprint ?? getStableMachineFingerprint();
  const now = options?.now ?? Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 2500);
  if (typeof timer.unref === "function") timer.unref();

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        deviceId: fingerprint,
        deviceName: os.hostname(),
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, any>;

    if (res.ok && data.valid === true) {
      const planType = data.planType === "team" ? "team" : "individual";
      const orgName = typeof data.orgName === "string" ? data.orgName : undefined;
      const expiresAt = typeof data.expiresAt === "number" ? data.expiresAt : undefined;
      const cached = saveCachedLicense(
        key,
        true,
        {
          verifiedAt: now,
          lastCheckedAt: now,
          planType,
          orgName,
          expiresAt,
          deviceFingerprint: fingerprint,
        },
        options
      );
      return {
        valid: true,
        tier: "pro",
        planType,
        orgName,
        expiresAt,
        message: typeof data.message === "string" ? data.message : "License verified online.",
        cached: cached ?? undefined,
      };
    }

    if (res.status === 401 || res.status === 403 || data.valid === false) {
      return {
        valid: false,
        revoked: true,
        message:
          typeof data.message === "string"
            ? data.message
            : "License verification failed or seat limit exceeded.",
      };
    }

    if (options?.allowOfflineFallback !== false) {
      const cached = saveCachedLicense(
        key,
        true,
        { verifiedAt: now, lastCheckedAt: now, deviceFingerprint: fingerprint },
        options
      );
      return {
        valid: true,
        offlineFallback: true,
        tier: "pro",
        message: `Activated in 14-day offline grace mode (API returned HTTP ${res.status}).`,
        cached: cached ?? undefined,
      };
    }

    return {
      valid: false,
      message: `Verification endpoint returned HTTP ${res.status}.`,
    };
  } catch {
    if (options?.allowOfflineFallback !== false) {
      const cached = saveCachedLicense(
        key,
        true,
        { verifiedAt: now, lastCheckedAt: now, deviceFingerprint: fingerprint },
        options
      );
      return {
        valid: true,
        offlineFallback: true,
        tier: "pro",
        message: "Activated in 14-day offline grace mode (network unreachable).",
        cached: cached ?? undefined,
      };
    }
    return {
      valid: false,
      message: "Unable to reach Code Station licensing API.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Silently revalidates a cached license in the background when online and past
 * the 24h check interval. Never writes to stdout or throws when offline.
 */
export async function revalidateLicenseInBackground(
  license: LicenseStatus,
  options?: OnlineVerifyOptions
): Promise<boolean> {
  if (!license.isPro || !license.licenseKey) return false;
  if (shouldSkipDiskCacheInTest(options)) return false;

  const now = options?.now ?? Date.now();
  const cached = readCachedLicense(options);
  if (cached) {
    const lastChecked = cached.lastCheckedAt ?? cached.verifiedAt;
    if (now - lastChecked < BACKGROUND_REVALIDATE_INTERVAL_MS) {
      return false;
    }
  }

  const endpoint = options?.endpoint || process.env.CODESTATION_VERIFY_URL || DEFAULT_VERIFY_ENDPOINT;
  const fetchFn = options?.fetchFn ?? globalThis.fetch;
  const fingerprint = options?.fingerprint ?? license.machineFingerprint ?? getStableMachineFingerprint();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 2000);
  if (typeof timer.unref === "function") timer.unref();

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: license.licenseKey,
        deviceId: fingerprint,
        deviceName: os.hostname(),
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (res.ok && data.valid === true) {
      saveCachedLicense(
        license.licenseKey,
        true,
        {
          verifiedAt: now,
          lastCheckedAt: now,
          planType: data.planType === "team" ? "team" : cached?.planType,
          orgName: typeof data.orgName === "string" ? data.orgName : cached?.orgName,
          expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : cached?.expiresAt,
          deviceFingerprint: fingerprint,
        },
        options
      );
      return true;
    }

    if ((res.status === 401 || res.status === 403) && data.valid === false) {
      clearCachedLicense(options);
      return false;
    }
  } catch {
    // Offline — keep existing 14-day grace cache intact silently
  } finally {
    clearTimeout(timer);
  }
  return false;
}

export function getProUpgradeNotice(toolName: string): string {
  return [
    `🔒 Tool "${toolName}" requires Code Station Pro.`,
    ``,
    `Free Tier includes the 3 universal discovery tools plus 15 core utilities (JSON format/validate/minify, Base64, URL encode/decode, UUID v4, SHA-256, JWT decode, Unix timestamp, Regex, Cron explain, Text Diff, Markdown->HTML).`,
    `Upgrade to Code Station Pro / Team to unlock all 300+ Node utilities, local PDF/XLSX/ZIP/Image file tools, and --stations expansion:`,
    `  • India: ${PRICING.inr} (or ${PRICING.lifetimeInr})`,
    `  • Global: ${PRICING.usd} (or ${PRICING.lifetimeUsd})`,
    `  • Upgrade URL: ${PRICING.upgradeUrl}`,
    ``,
    `Activate your key:`,
    `  codestation login CS-PRO-YOURKEY`,
    `  npx codestation-mcp --key CS-PRO-YOURKEY`,
    `  export CODESTATION_LICENSE_KEY=CS-PRO-YOURKEY`,
  ].join("\n");
}
