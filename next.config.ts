import type { NextConfig } from "next";
import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { jsonDataTools } from "./config/json-data-tools";
import { encodingLegacyRedirects } from "./config/encoding-tools";
import { securityLegacyRedirects } from "./config/security-tools";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      alasql$: path.resolve(process.cwd(), "node_modules/alasql/dist/alasql.min.js"),
    };
    return config;
  },
  async redirects() {
    return [...jsonDataTools.filter(tool => tool.id !== tool.slug).map(tool => ({
      source: `/tools/${tool.id}`, destination: `/tools/${tool.slug}`, permanent: true,
    })), ...Object.entries({ ...encodingLegacyRedirects, ...securityLegacyRedirects, "timestamp-converter": "unix-timestamp-converter", "character-counter-no-spaces": "character-counter-without-spaces" }).map(([source, destination]) => ({ source: `/tools/${source}`, destination: `/tools/${destination}`, permanent: true }))];
  },
  async headers() {
    return [
      {
        source: "/((?!embed(?:/|$)).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/pro",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/pro/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/embed",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Keep `next dev` compatible with the Cloudflare Worker runtime while the
// OpenNext preview/deploy commands remain the production path.
initOpenNextCloudflareForDev();
