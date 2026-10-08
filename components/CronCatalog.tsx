"use client";
import { cronTools } from "@/config/cron-tools";
import ToolCatalog from "./ToolCatalog";

/** Compatibility adapter for callers that still import the Cron catalog. */
export default function CronCatalog() {
  return <ToolCatalog name="Cron" tools={cronTools} description="Six local tools. No job execution or command scheduling." emptyMessage="No Cron tools match that search." />;
}
