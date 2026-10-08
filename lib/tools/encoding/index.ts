import type { EncodingInputs, EncodingResult } from "./types";
import { getEncodingDefinition } from "@/config/encoding-tools";

/** Local-only dispatch; full entity/IDNA tables load only when their tool is used. */
export async function runEncoding(slug: string, inputs: EncodingInputs): Promise<EncodingResult> {
  const definition = getEncodingDefinition(slug);
  if (!definition) throw new Error("Unknown Encoding tool.");
  if (inputs.input.length > 1_000_000) throw new Error("Input exceeds the 1,000,000-character limit. Use a smaller input.");
  try {
    const structured = /^(?:url-|html-|jwt-|data-uri-|punycode-)/.test(slug);
    const result = structured
      ? await (await import("./structured")).runStructuredTool(slug, inputs)
      : (await import("./bytes")).runByteTool(slug, inputs);
    if (result.text.length > 8_000_000) throw new Error("Output exceeds the 8,000,000-character limit. Use a smaller input.");
    return result;
  } catch (cause) {
    const message = cause instanceof RangeError ? "Input exceeds a processing limit. Use a smaller input." : cause instanceof Error ? cause.message : "Conversion could not complete.";
    throw new Error(`${definition.name}: ${message}`);
  }
}
