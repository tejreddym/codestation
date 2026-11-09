import type { Metadata } from "next";

/** A public origin is opt-in; an unverified hostname must never become a canonical URL. */
export function getVerifiedSiteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const origin = new URL(value.trim());
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) return undefined;
    if (origin.pathname !== "/") return undefined;
    const host = origin.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]" || host === "::1" || /^10\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return undefined;
    origin.pathname = "";
    return origin.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function isIndexingEnabled(origin?: string, setting: string | undefined = process.env.SITE_INDEXING): boolean {
  const effectiveOrigin = arguments.length === 0 ? getVerifiedSiteOrigin() : origin;
  return setting === "index" && !!effectiveOrigin;
}

const verifiedOrigin = getVerifiedSiteOrigin();

export const siteConfig = {
  name: "Code Station",
  /** Empty when NEXT_PUBLIC_SITE_URL is absent or unsafe. The root metadata caller must guard it before new URL(). */
  domain: verifiedOrigin ?? "",
  origin: verifiedOrigin,
  indexing: isIndexingEnabled(verifiedOrigin),
  tagline: "Your everyday developer toolbox.",
  description: "Fast, 100% in-browser developer toolbox with native WebMCP (Web Model Context Protocol) support for AI agents. 395+ tools across 25 stations—including WebPKI Cryptography, AI & Prompts, PDF tools, Code Generation, Compression & Archives, CIDR Networking, Hashes, Developer Math, and Converters—with zero server uploads.",
};

export function metadataForPage(path: string, title: string, description: string): Metadata {
  const safePath = /^\/[^?#]*$/.test(path) ? path : "/";
  return {
    title,
    description,
    ...(siteConfig.origin ? { alternates: { canonical: `${siteConfig.origin}${safePath}` }, openGraph: { title, description, url: `${siteConfig.origin}${safePath}`, siteName: siteConfig.name, type: "website" as const } } : {}),
    robots: siteConfig.indexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

/** Metadata for a public route. Indexing is opt-in and requires a verified origin. */
export function metadataForRoute(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: siteConfig.indexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const categories = ["JSON & Data", "Encoding", "Security", "Text", "Date & Time"] as const;
