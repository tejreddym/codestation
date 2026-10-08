import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { tools } from "@/config/tools";
import { stations } from "@/config/stations";

// Only canonical public pages belong here; query variants and legacy redirects are excluded.
const infoRoutes = ["/about", "/privacy", "/terms", "/licenses", "/site-directory", "/workbench", "/settings", "/workflows", "/batch-images", "/feedback", "/offline"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteConfig.origin) return [];
  const routes = [
    "/",
    "/tools",
    ...stations.filter((station) => station.route.startsWith("/stations/")).map((station) => station.route),
    ...tools.map((tool) => `/tools/${tool.slug}`),
    ...infoRoutes,
  ];
  return [...new Set(routes)].map((route) => ({
    url: `${siteConfig.origin}${route}`,
    changeFrequency: route === "/" || route === "/tools" ? "weekly" as const : "monthly" as const,
    priority: route === "/" ? 1 : route === "/tools" ? .8 : .7,
  }));
}
