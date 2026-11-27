import Script from "next/script";
import {
  CLOUDFLARE_ANALYTICS_SCRIPT_SRC,
  getCloudflareAnalyticsToken,
} from "@/config/analytics";

/**
 * Optional cookie-free Cloudflare Web Analytics beacon.
 * Renders nothing unless NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN is configured.
 */
export default function CloudflareWebAnalytics() {
  const token = getCloudflareAnalyticsToken();
  if (!token) return null;

  return (
    <Script
      id="cf-web-analytics"
      src={CLOUDFLARE_ANALYTICS_SCRIPT_SRC}
      strategy="afterInteractive"
      defer
      data-cf-beacon={JSON.stringify({ token, spa: true })}
    />
  );
}
