import { getJsonDataDefinition } from "@/config/json-data-tools";
import type { DataInputs, DataResult } from "./types";

/** Load only the family needed by the current action; no content leaves the browser. */
export async function runDataTool(id: string, inputs: DataInputs): Promise<DataResult> {
  const definition = getJsonDataDefinition(id);
  if (!definition) throw new Error("Unknown JSON & Data tool.");
  for (const value of Object.values(inputs)) {
    if (value.length > 1_000_000) throw new Error("Invalid input: maximum 1,000,000 characters per field. Split the document into smaller parts.");
  }
  const slug = definition.slug;
  try {
    let result: DataResult;
    if (slug.startsWith("csv-") || slug === "tsv-to-csv" || slug === "json-to-csv") {
      const { runCsvTool } = await import("./csv");
      result = runCsvTool(slug, inputs);
    } else if (/yaml|xml|toml/.test(slug)) {
      const { runMarkupTool } = await import("./markup");
      result = runMarkupTool(slug, inputs);
    } else {
      const { runJsonTool } = await import("./json");
      result = runJsonTool(slug, inputs);
    }
    if (result.invalid && !slug.endsWith("validator")) throw new Error(result.text.replace(/^Invalid input:\s*/, ""));
    if (result.text.length > 8_000_000) throw new Error("Output exceeds the 8,000,000-character limit. Use smaller input.");
    return result;
  } catch (cause) {
    const message = cause instanceof RangeError ? "Nesting or resource limit exceeded. Use a smaller document." : cause instanceof Error ? cause.message : "Unable to process this input.";
    throw new Error(`Invalid ${definition.inputFormat}: ${message}`);
  }
}
