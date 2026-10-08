import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { jsonDataTools } from "./config/json-data-tools";
import { encodingLegacyRedirects } from "./config/encoding-tools";
import { securityLegacyRedirects } from "./config/security-tools";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [...jsonDataTools.filter(tool => tool.id !== tool.slug).map(tool => ({
      source: `/tools/${tool.id}`, destination: `/tools/${tool.slug}`, permanent: true,
    })), ...Object.entries({ ...encodingLegacyRedirects, ...securityLegacyRedirects, "timestamp-converter": "unix-timestamp-converter", "character-counter-no-spaces": "character-counter-without-spaces" }).map(([source, destination]) => ({ source: `/tools/${source}`, destination: `/tools/${destination}`, permanent: true }))];
  },
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "X-Frame-Options", value: "DENY" }] }];
  },
};

export default nextConfig;

// Keep `next dev` compatible with the Cloudflare Worker runtime while the
// OpenNext preview/deploy commands remain the production path.
initOpenNextCloudflareForDev();
