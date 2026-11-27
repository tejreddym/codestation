export const CLOUDFLARE_ANALYTICS_SCRIPT_SRC =
  "https://static.cloudflareinsights.com/beacon.min.js";

const VALID_CF_TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Cloudflare Web Analytics is strictly opt-in via NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN.
 * Keep this direct property lookup so Next.js inlines NEXT_PUBLIC_* cleanly at build time.
 */
export function getCloudflareAnalyticsToken(): string | null {
  const raw = process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN?.trim() ?? "";
  if (!raw || !VALID_CF_TOKEN.test(raw)) {
    return null;
  }
  return raw;
}

export function isCloudflareAnalyticsEnabled(): boolean {
  return getCloudflareAnalyticsToken() !== null;
}
