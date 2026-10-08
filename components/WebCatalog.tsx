"use client";
import { webTools } from "@/config/web-tools";
import ToolCatalog from "./ToolCatalog";

/** Compatibility adapter for callers that still import the Web catalog. */
export default function WebCatalog() {
  return <ToolCatalog name="Web" tools={webTools} description="Local parsing, generation and reference lookup. No URL fetching." emptyMessage="No Web tools match that search." />;
}
