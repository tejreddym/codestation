import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const homeTitle = "Free Browser Developer Tools — 383 Utilities in 30 Stations";
export const homeBrandedTitle = `${homeTitle} | ${siteConfig.name}`;
export const homeDescription = "Explore 383 free, browser-based developer tools across 30 stations. Format, convert, hash, inspect and generate data locally with no uploads or accounts.";

export function buildHomeMetadata(origin?: string, indexing?: boolean): Metadata {
  const resolvedOrigin = arguments.length >= 1 ? origin : siteConfig.origin;
  const resolvedIndexing = arguments.length >= 2 ? Boolean(indexing) : siteConfig.indexing;

  return {
    title: { absolute: homeBrandedTitle },
    description: homeDescription,
    ...(resolvedOrigin ? {
      alternates: { canonical: `${resolvedOrigin}/` },
      openGraph: {
        title: homeTitle,
        description: homeDescription,
        url: resolvedOrigin,
        siteName: siteConfig.name,
        type: "website" as const,
        images: [{ url: `${resolvedOrigin}/og`, width: 1200, height: 630, alt: `${siteConfig.name} — 100% Local Developer Toolbox` }],
      },
      twitter: {
        card: "summary_large_image" as const,
        title: homeTitle,
        description: homeDescription,
        images: [`${resolvedOrigin}/og`],
      },
    } : {}),
    robots: resolvedIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const homeFaqs = [
  {
    question: "Is Code Station free?",
    answer: "Yes. All 383 browser tools are free and unlimited, and no account is required. Pro is only for the local MCP server used by AI agent clients.",
  },
  {
    question: "Are my files uploaded?",
    answer: "No. Files, text, and generated output stay in your browser. The explicit API Request Tester and remote images in Markdown previews are documented exceptions.",
  },
  {
    question: "How does local processing work?",
    answer: "Tools run in this browser with JavaScript and browser APIs. Code Station does not proxy inputs through a server, and results are not saved unless you copy or download them.",
  },
  {
    question: "Can AI agents use these tools?",
    answer: "Yes. Supported tools expose browser-native WebMCP through document.modelContext, and Code Station Pro provides a local stdio MCP server for agents such as Cursor and Claude Desktop.",
  },
] as const;
