"use client";
import { sqlTools } from "@/config/sql-tools";
import ToolCatalog from "./ToolCatalog";

/** Compatibility adapter for callers that still import the SQL catalog. */
export default function SqlDatabaseCatalog() {
  return <ToolCatalog name="SQL & Database" tools={sqlTools} description="Generate and inspect text only. No database connections or query execution." emptyMessage="No SQL & Database tools match that search." />;
}
