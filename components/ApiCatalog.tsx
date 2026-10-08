"use client";
import { apiTools } from "@/config/api-tools";
import ToolCatalog from "./ToolCatalog";

/** Compatibility adapter for callers that still import the API catalog. */
export default function ApiCatalog() {
  return <ToolCatalog name="API" tools={apiTools} description="Generate and inspect locally. Only API Request Tester sends an explicit browser request." emptyMessage="No API tools match that search." />;
}
