/**
 * Code Station — Universal Registry Adapter
 *
 * Adapts all 300+ tools from config/tools.ts into canonical ToolDefinition and ToolEngine contracts.
 * Provides dual-key resolution for legacy mismatched tool slugs and zero-regression fallbacks.
 */

import type {
  ToolDefinition as CanonicalToolDefinition,
  ToolEngine,
  ToolInput,
  ToolOutput,
  ToolResult,
  ValidationResult,
  ToolContext,
} from "../types";
import {
  createValidationSuccess,
  createValidationError,
} from "../types";
import { tools, getTool, type ToolDefinition as ConfigToolDefinition } from "@/config/tools";

// Dual-key lookup table for the 6 legacy mismatched tools
export const MISMATCHED_SLUG_ID_MAP: Record<string, string> = {
  "json-lines-formatter": "jsonl-formatter",
  "jsonl-formatter": "jsonl-formatter",
  "json-lines-validator": "jsonl-validator",
  "jsonl-validator": "jsonl-validator",
  "json-lines-to-json": "jsonl-to-json",
  "jsonl-to-json": "jsonl-to-json",
  "json-to-json-lines": "json-to-jsonl",
  "json-to-jsonl": "json-to-jsonl",
  "csv-to-html-table": "csv-to-html",
  "csv-to-html": "csv-to-html",
  "csv-data-deduplicator": "csv-deduplicator",
  "csv-deduplicator": "csv-deduplicator",
};

export function resolveToolKey(query: string): string {
  return MISMATCHED_SLUG_ID_MAP[query] || query;
}

export interface LegacyToolMetadata {
  id: string;
  slug?: string;
  name?: string;
  category?: string;
  description?: string;
  keywords?: readonly string[] | string[];
  offlineSupported?: boolean;
  processing?: "local" | "network-opt-in";
  input?: ToolInput[];
  output?: ToolOutput[];
  process?: (input: unknown) => Promise<unknown> | unknown;
  [key: string]: unknown;
}

/**
 * Maps any legacy or station tool metadata into canonical ToolDefinition and ToolEngine.
 */
export function adaptToolToEngine(
  legacyTool: LegacyToolMetadata,
  processor?: (input: unknown) => Promise<unknown> | unknown
): {
  definition: CanonicalToolDefinition;
  engine: ToolEngine;
} {
  const canonicalId = legacyTool.id;
  const canonicalSlug = legacyTool.slug || legacyTool.id;
  const isNetwork =
    legacyTool.processing === "network-opt-in" ||
    (legacyTool as unknown as { apiContract?: { sendsRequest?: boolean } })?.apiContract?.sendsRequest === true;

  const inputs: ToolInput[] =
    legacyTool.input && legacyTool.input.length > 0
      ? legacyTool.input
      : [
          {
            name: "input",
            label: "Input",
            control: "text",
            required: true,
          },
        ];

  const outputs: ToolOutput[] =
    legacyTool.output && legacyTool.output.length > 0
      ? legacyTool.output
      : [
          {
            id: "output",
            label: "Output",
            type: "text",
            copyable: true,
            downloadable: true,
          },
        ];

  const definition: CanonicalToolDefinition = {
    id: canonicalId,
    slug: canonicalSlug,
    name: legacyTool.name || canonicalId,
    category: legacyTool.category || "utilities",
    description: legacyTool.description || "",
    processing: isNetwork ? "network-opt-in" : "local",
    offlineSupported: legacyTool.offlineSupported ?? !isNetwork,
    input: inputs,
    output: outputs,
    keywords: legacyTool.keywords ? Array.from(legacyTool.keywords) : [],
  };

  const processFn = processor || legacyTool.process || ((inp: unknown) => inp);

  const engine: ToolEngine = {
    validate: (input: unknown): ValidationResult => {
      if (input === undefined || input === null) {
        return createValidationError("Input is required");
      }
      return createValidationSuccess();
    },
    process: async (input: unknown, _context: ToolContext): Promise<ToolResult> => {
      const start = performance.now();
      const output = await Promise.resolve(processFn(input));
      return {
        data: output,
        durationMs: Math.round(performance.now() - start),
      };
    },
  };

  return { definition, engine };
}

/**
 * Resolves a tool by slug or id and returns its adapted canonical definition & engine.
 */
export function getCanonicalTool(slugOrId: string): {
  definition: CanonicalToolDefinition;
  engine: ToolEngine;
} | null {
  const resolvedKey = resolveToolKey(slugOrId);
  const found = getTool(resolvedKey) || tools.find((t) => t.id === resolvedKey || t.slug === resolvedKey || t.id === slugOrId || t.slug === slugOrId);

  if (!found) {
    return null;
  }

  return adaptToolToEngine(found as unknown as LegacyToolMetadata);
}

/**
 * Returns canonical definitions and engines for all tools in config/tools.ts.
 */
export function getAllCanonicalTools(): Array<{
  definition: CanonicalToolDefinition;
  engine: ToolEngine;
}> {
  return tools.map((tool) => adaptToolToEngine(tool as unknown as LegacyToolMetadata));
}
