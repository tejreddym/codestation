/**
 * Policy Generator Engine Entrypoint & Dispatcher
 * Code Station — Browser-Native Developer Tools
 */

import { generateCookiePolicy } from "./generators/cookie-policy";
import { generateDisclaimer } from "./generators/disclaimer";
import { generatePrivacyPolicy } from "./generators/privacy-policy";
import { generateRefundPolicy } from "./generators/refund-policy";
import { generateTermsAndConditions } from "./generators/terms-and-conditions";
import { getPolicyPreset, listPolicyPresets } from "./presets";
import { toJson, toHtml, toMarkdown, toPlainText } from "./serializers";
import {
  PolicyDocument,
  PolicyOutputFormat,
  PolicyToolId,
  SerializerOptions,
} from "./types";

/**
 * Generate a strongly-typed Universal Policy Document AST from tool ID and input options.
 * Guarantees zero-crash keystroke resilience on empty, partial, or malformed options.
 */
export function generatePolicyDocument(
  toolId: PolicyToolId,
  options: Record<string, unknown> = {}
): PolicyDocument {
  const safeOptions = options && typeof options === "object" ? options : {};

  switch (toolId) {
    case "privacy-policy-generator":
      return generatePrivacyPolicy(safeOptions);
    case "terms-and-conditions-generator":
      return generateTermsAndConditions(safeOptions);
    case "cookie-policy-generator":
      return generateCookiePolicy(safeOptions);
    case "disclaimer-generator":
      return generateDisclaimer(safeOptions);
    case "refund-policy-generator":
      return generateRefundPolicy(safeOptions);
    default:
      throw new Error(`Unsupported policy tool ID: ${toolId}`);
  }
}

/**
 * Serialize a PolicyDocument AST into Plain Text, Markdown, Semantic HTML5, or JSON.
 */
export function serializePolicyDocument(
  doc: PolicyDocument,
  format: PolicyOutputFormat = "markdown",
  options?: SerializerOptions
): string {
  if (!doc) {
    throw new Error("Cannot serialize an undefined or null PolicyDocument");
  }

  switch (format) {
    case "text":
      return toPlainText(doc, options);
    case "markdown":
      return toMarkdown(doc, options);
    case "html":
      return toHtml(doc, options);
    case "json":
      return toJson(doc, options);
    default:
      return toMarkdown(doc, options);
  }
}

/**
 * Unified generation pipeline: options -> Document AST -> formatted output string.
 * Used directly by client UI workspace and WebMCP execution dispatcher.
 */
export function generatePolicyText(
  toolId: PolicyToolId,
  format: PolicyOutputFormat = "markdown",
  options: Record<string, unknown> = {}
): string {
  const doc = generatePolicyDocument(toolId, options);
  const serializerOptions: SerializerOptions = {
    standaloneHtml: options?.standaloneHtml === true,
    indentSpaces: typeof options?.indentSpaces === "number" ? options.indentSpaces : 2,
    includeMetadataBlock: options?.includeMetadataBlock !== false,
  };
  return serializePolicyDocument(doc, format, serializerOptions);
}

export { getPolicyPreset, listPolicyPresets };
export * from "./types";
export * from "./serializers";
