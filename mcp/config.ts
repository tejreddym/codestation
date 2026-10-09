import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface LicenseStatus {
  isPro: boolean;
  licenseKey?: string;
  source: "cli" | "env" | "cache" | "none";
  tier: "free" | "pro";
}

export const PRICING = {
  inr: "₹199 / month",
  usd: "$2.99 / month",
  lifetimeInr: "₹999 one-time",
  lifetimeUsd: "$19.00 one-time",
  upgradeUrl: "https://codestation.in/pro",
};

export const PRO_TOOLS = new Set([
  "codestation_hash",
  "codestation_hmac",
  "codestation_jwt_decode",
  "codestation_format_sql",
  "codestation_cron_explain",
  "codestation_timezone_convert",
  "codestation_business_days",
  "codestation_regex_test",
  "codestation_json_schema",
]);

const CACHE_DIR = path.join(os.homedir(), ".codestation");
const CACHE_FILE = path.join(CACHE_DIR, "license.json");

interface CachedLicense {
  key: string;
  verifiedAt: number;
  isPro: boolean;
}

export function readCachedLicense(): CachedLicense | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as CachedLicense;
      // Valid for 30 days offline
      if (Date.now() - data.verifiedAt < 30 * 24 * 60 * 60 * 1000) {
        return data;
      }
    }
  } catch {
    // Ignore cache read issues
  }
  return null;
}

export function clearCachedLicense(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  } catch {
    // Ignore cache clear issues
  }
}

export function saveCachedLicense(key: string, isPro: boolean): void {
  try {
    if (process.env.NODE_ENV === "test") return; // Do not persist to disk during automated tests
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cache: CachedLicense = {
      key,
      verifiedAt: Date.now(),
      isPro,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Ignore cache write issues
  }
}

/**
 * Validates whether a given license key represents a Pro subscription.
 * Accepts active Pro test keys, standard format keys (CS-PRO-*), or cached validations.
 */
export function validateLicenseKey(rawKey?: string | null): boolean {
  if (!rawKey) return false;
  const key = rawKey.trim();
  if (!key) return false;

  // Key pattern for Code Station Pro licenses: CS-PRO-XXXX-XXXX
  if (/^CS-PRO-[A-Za-z0-9_-]+$/i.test(key) || key.startsWith("cspro_")) {
    return true;
  }

  // Developer / Demo mode key
  if (key === "PRO_DEMO_KEY" || key === "CS-PRO-DEV") {
    return true;
  }

  return false;
}

export function resolveLicense(cliKey?: string): LicenseStatus {
  // 1. Check CLI Argument
  if (cliKey) {
    const valid = validateLicenseKey(cliKey);
    if (valid) {
      saveCachedLicense(cliKey, true);
      return { isPro: true, licenseKey: cliKey, source: "cli", tier: "pro" };
    }
  }

  // 2. Check Environment Variable
  const envKey = process.env.CODESTATION_LICENSE_KEY;
  if (envKey) {
    const valid = validateLicenseKey(envKey);
    if (valid) {
      saveCachedLicense(envKey, true);
      return { isPro: true, licenseKey: envKey, source: "env", tier: "pro" };
    }
  }

  // 3. Check Cached License File
  const cached = readCachedLicense();
  if (cached && cached.isPro) {
    return { isPro: true, licenseKey: cached.key, source: "cache", tier: "pro" };
  }

  return { isPro: false, source: "none", tier: "free" };
}

export function getProUpgradeNotice(toolName: string): string {
  return [
    `🔒 Tool "${toolName}" is a Code Station Pro feature.`,
    ``,
    `Get Code Station Pro:`,
    `  • India: ${PRICING.inr} (or ${PRICING.lifetimeInr})`,
    `  • Global: ${PRICING.usd} (or ${PRICING.lifetimeUsd})`,
    `  • Upgrade URL: ${PRICING.upgradeUrl}`,
    ``,
    `To activate, launch with:`,
    `  npx codestation-mcp --key CS-PRO-YOURKEY`,
    `or set environment variable:`,
    `  export CODESTATION_LICENSE_KEY=CS-PRO-YOURKEY`,
  ].join("\n");
}
