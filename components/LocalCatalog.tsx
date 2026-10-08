"use client";
import type { ToolDefinition } from "@/config/tools";
import ToolCatalog from "./ToolCatalog";
export default function LocalCatalog({ name, tools }: { name: string; tools: readonly ToolDefinition[] }) {
  return <ToolCatalog name={name} tools={tools} emptyMessage="No matching tools." />;
}
