import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000;
export const NPM_LATEST_URL = "https://registry.npmjs.org/codestation-mcp/latest";

export interface CachedUpdateInfo {
  checkedAt: number;
  latestVersion: string;
}

export interface UpdateCheckResult {
  status: "skipped" | "cached" | "fetched" | "error";
  updateAvailable: boolean;
  latestVersion?: string;
}

export interface UpdateCheckOptions {
  currentVersion: string;
  argv?: string[];
  env?: Record<string, string | undefined>;
  cacheFile?: string;
  now?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  onNotice?: (message: string) => void;
  forceInTest?: boolean;
}

function defaultCacheFile(): string {
  return path.join(os.homedir(), ".codestation", "update-check.json");
}

function parseSemverParts(version: string): [number, number, number] | null {
  const cleaned = version.trim().replace(/^v/i, "").split("-")[0];
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(cleaned);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Returns -1 when current < latest, 0 when equal, 1 when current > latest. */
export function compareSemver(current: string, latest: string): number {
  const a = parseSemverParts(current);
  const b = parseSemverParts(latest);
  if (!a || !b) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function shouldSkipUpdateCheck(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  forceInTest = false
): boolean {
  if (argv.includes("--no-update-check")) return true;
  const optOut = env.CODESTATION_NO_UPDATE_CHECK?.trim().toLowerCase();
  if (optOut === "1" || optOut === "true") return true;
  if (env.NO_UPDATE_NOTIFIER === "1" || env.NO_UPDATE_NOTIFIER === "true") return true;
  if (env.CI === "1" || env.CI === "true") return true;
  if (!forceInTest && env.NODE_ENV === "test") return true;
  return false;
}

export function formatUpdateNotice(currentVersion: string, latestVersion: string): string {
  return `\n[codestation-mcp] Update available: v${currentVersion} -> v${latestVersion} (run: npx -y codestation-mcp@latest). Pass --no-update-check or set CODESTATION_NO_UPDATE_CHECK=1 to disable.\n`;
}

function readCache(cacheFile: string): CachedUpdateInfo | null {
  try {
    if (!fs.existsSync(cacheFile)) return null;
    const raw = fs.readFileSync(cacheFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CachedUpdateInfo>;
    if (typeof parsed.checkedAt === "number" && typeof parsed.latestVersion === "string") {
      return { checkedAt: parsed.checkedAt, latestVersion: parsed.latestVersion };
    }
  } catch {
    // Ignore malformed cache files.
  }
  return null;
}

function writeCache(cacheFile: string, info: CachedUpdateInfo): void {
  try {
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify(info, null, 2), "utf-8");
  } catch {
    // Cache writes are best-effort; never break CLI execution.
  }
}

export async function checkForCliUpdate(
  options: UpdateCheckOptions
): Promise<UpdateCheckResult> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  if (shouldSkipUpdateCheck(argv, env, options.forceInTest)) {
    return { status: "skipped", updateAvailable: false };
  }

  const now = options.now ?? Date.now();
  const cacheFile = options.cacheFile ?? defaultCacheFile();
  const notify = options.onNotice ?? ((msg: string) => process.stderr.write(msg));

  const cached = readCache(cacheFile);
  if (cached && now - cached.checkedAt >= 0 && now - cached.checkedAt < UPDATE_CHECK_TTL_MS) {
    const updateAvailable = compareSemver(options.currentVersion, cached.latestVersion) < 0;
    if (updateAvailable) {
      notify(formatUpdateNotice(options.currentVersion, cached.latestVersion));
    }
    return { status: "cached", updateAvailable, latestVersion: cached.latestVersion };
  }

  const fetchImpl = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { status: "error", updateAvailable: false };
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 1200;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof (timer as NodeJS.Timeout).unref === "function") {
    (timer as NodeJS.Timeout).unref();
  }

  try {
    const response = await fetchImpl(NPM_LATEST_URL, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: "error", updateAvailable: false };
    }
    const payload = (await response.json()) as { version?: unknown };
    const latestVersion = typeof payload.version === "string" ? payload.version.trim() : "";
    if (!latestVersion || !parseSemverParts(latestVersion)) {
      return { status: "error", updateAvailable: false };
    }

    writeCache(cacheFile, { checkedAt: now, latestVersion });
    const updateAvailable = compareSemver(options.currentVersion, latestVersion) < 0;
    if (updateAvailable) {
      notify(formatUpdateNotice(options.currentVersion, latestVersion));
    }
    return { status: "fetched", updateAvailable, latestVersion };
  } catch {
    return { status: "error", updateAvailable: false };
  } finally {
    clearTimeout(timer);
  }
}
