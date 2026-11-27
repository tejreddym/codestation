import { getTool } from "@/config/tools";
import { getStation } from "@/config/stations";

export interface OgCardData {
  badge: string;
  title: string;
  description: string;
  footerBadge: string;
  brandHost: string;
  isDefault: boolean;
}

function truncateText(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

export function resolveOgCardData(params: {
  type?: string | null;
  slug?: string | null;
}): OgCardData {
  const type = params.type?.trim().toLowerCase() ?? "";
  const slug = params.slug?.trim() ?? "";

  if (type === "tool" && slug) {
    const tool = getTool(slug);
    if (tool) {
      return {
        badge: tool.category.toUpperCase(),
        title: tool.name,
        description: truncateText(tool.description, 145),
        footerBadge: "100% Local · Browser-Only",
        brandHost: "codestation.in",
        isDefault: false,
      };
    }
  }

  if (type === "station" && slug) {
    const station = getStation(slug);
    if (station) {
      return {
        badge: `STATION · ${station.toolCount} TOOLS`,
        title: `${station.name} Station`,
        description: truncateText(station.description, 145),
        footerBadge: "100% Local · Browser-Only",
        brandHost: "codestation.in",
        isDefault: false,
      };
    }
  }

  return {
    badge: "383 DEVELOPER TOOLS · 30 STATIONS",
    title: "Code Station",
    description:
      "Fast, browser-local developer utilities to format, convert, hash, and inspect data with zero server uploads.",
    footerBadge: "100% Local · Browser-Only",
    brandHost: "codestation.in",
    isDefault: true,
  };
}

export function ogImagePathForRoute(path: string): string {
  if (path.startsWith("/tools/")) {
    const slug = path.slice("/tools/".length).split("/")[0];
    if (slug) return `/og?type=tool&slug=${encodeURIComponent(slug)}`;
  }
  if (path.startsWith("/stations/")) {
    const slug = path.slice("/stations/".length).split("/")[0];
    if (slug) return `/og?type=station&slug=${encodeURIComponent(slug)}`;
  }
  return "/og";
}
