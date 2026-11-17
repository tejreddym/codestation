/**
 * Compact discovery projection for the lazy command-palette dialog.
 * This module is imported only by the dynamic dialog chunk, never by the shell.
 */
import { tools } from "@/config/tools";
import { stations } from "@/config/stations";

export interface PaletteTool {
  id: string;
  slug: string;
  name: string;
  category: string;
  keywords: readonly string[];
  description: string;
  featured?: boolean;
}

export interface PaletteStation {
  id: string;
  name: string;
  route: string;
  description: string;
}

export interface PaletteAction {
  id: string;
  label: string;
  description: string;
  keywords: readonly string[];
  href: string;
}

export const paletteTools: readonly PaletteTool[] = tools.map((tool) => ({
  id: tool.slug,
  slug: tool.slug,
  name: tool.name,
  category: tool.category,
  keywords: tool.keywords,
  description: tool.description,
  ...(tool.featured ? { featured: true } : {}),
}));

export const paletteStations: readonly PaletteStation[] = stations.map((station) => ({
  id: station.id,
  name: station.name,
  route: station.route,
  description: station.description,
}));

export const paletteActions: readonly PaletteAction[] = [
  {
    id: "tools",
    label: "Tools directory",
    description: "Browse every registered developer tool.",
    keywords: ["tools", "directory", "catalog", "all"],
    href: "/tools",
  },
  {
    id: "stations",
    label: "Stations",
    description: "Jump to the station index on the homepage.",
    keywords: ["stations", "categories", "index", "home"],
    href: "/#categories",
  },
  {
    id: "workbench",
    label: "Workbench",
    description: "Collect favorites, recents, and queued input.",
    keywords: ["workbench", "favorites", "clipboard", "recent"],
    href: "/workbench",
  },
  {
    id: "workflows",
    label: "Workflows",
    description: "Chain tools into a repeatable local workflow.",
    keywords: ["workflows", "pipeline", "chain", "automation"],
    href: "/workflows",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Adjust detection and privacy preferences.",
    keywords: ["settings", "preferences", "detection", "theme"],
    href: "/settings",
  },
  {
    id: "offline",
    label: "Offline",
    description: "Manage the limited offline tool cache.",
    keywords: ["offline", "cache", "pwa", "install"],
    href: "/offline",
  },
  {
    id: "pro",
    label: "Pro",
    description: "Learn about the local MCP server and Pro license.",
    keywords: ["pro", "mcp", "license", "upgrade"],
    href: "/pro",
  },
  {
    id: "docs",
    label: "Docs",
    description: "Read the MCP, WebMCP, and station documentation.",
    keywords: ["docs", "documentation", "mcp", "help"],
    href: "/docs",
  },
];

export const featuredPaletteTools: readonly PaletteTool[] = paletteTools.filter((tool) => tool.featured);
