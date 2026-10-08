/** Browser-independent contracts for the JavaScript Regex station. */
export const regexToolIds = ["regex-tester", "regex-escape", "regex-replace-tester", "regex-match-inspector", "regex-group-extractor", "regex-flag-tester", "regex-pattern-builder", "regex-capture-group-tester", "regex-split-tester"] as const;
export type RegexToolId = (typeof regexToolIds)[number];
export type RegexFieldName = "pattern" | "text" | "flags" | "replacement" | "literal" | "mode" | "quantifier" | "caseSensitivity";
export type RegexInputField = {
  name: RegexFieldName;
  label: string;
  control: "textarea" | "select" | "checkbox-group";
  options?: readonly string[];
  hint?: string;
};
export type RegexToolContract = {
  fields: readonly RegexInputField[];
  action: string;
  outputLabel: string;
  outputs: readonly string[];
  defaults: Readonly<Record<string, string>>;
  example: Readonly<Record<string, string>>;
  notices: readonly string[];
  privacyMessage: string;
  purpose: string;
  usage: string;
};

const pattern: RegexInputField = { name: "pattern", label: "Regex Pattern", control: "textarea", hint: "JavaScript pattern source, without / delimiters. Empty patterns are valid." };
const text: RegexInputField = { name: "text", label: "Test text", control: "textarea" };
const flags: RegexInputField = { name: "flags", label: "Flags", control: "checkbox-group", options: ["g", "i", "m", "s", "u", "y", "d"], hint: "No flags are selected by default. Unsupported browser flags produce a clear error." };
const matchingFields = [pattern, text, flags];
const matchingExample = { pattern: "\\b[A-Z][a-z]+\\b", text: "Hello Tej, Welcome To Code Station.", flags: "g" };
const groupsExample = { pattern: "(\\d{4})-(\\d{2})-(\\d{2})", text: "2026-10-03", flags: "" };
const engineNotice = "Uses your browser’s JavaScript RegExp engine. Positions and lengths are zero-based UTF-16 code units; end positions are exclusive. Without g, matching returns only the first match. Sticky y starts at position 0.";
const limitsNotice = "Limits: 16,384 pattern code units, 200,000 text code units, 2,000 matches or split parts, and 4,000,000 output code units. User regex execution requires a local worker with a 1,500 ms timeout. Oversized results fail rather than being truncated.";
const select = (name: RegexFieldName, label: string, options: readonly string[], hint?: string): RegexInputField => ({ name, label, control: "select", options, hint });

function define(id: RegexToolId, name: string, description: string, fields: readonly RegexInputField[], action: string, outputs: readonly string[], usage: string, example: Record<string, string>, notices: readonly string[] = [engineNotice, limitsNotice]) {
  const regexContract: RegexToolContract = {
    fields, action, outputs, outputLabel: outputs[0],
    defaults: Object.fromEntries(fields.map(field => [field.name, field.control === "select" ? field.options?.[0] ?? "" : ""])),
    example, notices,
    privacyMessage: "Processed locally in your browser. Inputs and results are not uploaded or saved by this page.",
    purpose: description,
    usage: `${usage} Choose “${action}”, then copy individual result values if needed. Clear removes all inputs and results and restores option defaults.`,
  };
  return {
    id, slug: id, name, description, category: "Regex" as const,
    keywords: [...new Set([...name.toLowerCase().split(/[\s-]+/), "regexp", "javascript", "local", "browser"])],
    featured: id === "regex-tester" ? true : undefined,
    regexContract,
    relatedTools: (["regex-tester", "regex-match-inspector", "regex-escape"] as const).filter(slug => slug !== id),
    seo: { title: `${name} — JavaScript Regex in your browser`, description },
  };
}

export const regexTools = [
  define("regex-tester", "Regex Tester", "Test a JavaScript regular expression locally and see match status, counts, text, positions and capture groups.", matchingFields, "Test regex", ["Matches", "Match count", "Match status", "Capture groups"], "Enter a JavaScript pattern and test text, then select any flags.", matchingExample),
  define("regex-escape", "Regex Escape", "Escape plain text for literal matching in a JavaScript regular expression, entirely in your browser.", [{ name: "literal", label: "Plain text", control: "textarea" }], "Escape text", ["Escaped text"], "Enter the literal text to escape.", { literal: "hello.world?" }, ["Produces JavaScript regex pattern source, without slash delimiters or flags.", limitsNotice]),
  define("regex-replace-tester", "Regex Replace Tester", "Preview JavaScript regex replacements locally, including replacement tokens and the number of replacements.", [...matchingFields, { name: "replacement", label: "Replacement text", control: "textarea", hint: "JavaScript replacement tokens such as $&, $1 and $<name> are supported. Empty text removes matches." }], "Replace text", ["Replaced text", "Replacement count"], "Enter a pattern, test text and replacement text. Select g to replace every match.", { pattern: "\\bcat\\b", text: "cat dog cat", replacement: "fox", flags: "g" }),
  define("regex-match-inspector", "Regex Match Inspector", "Inspect each JavaScript regex match with numbered cards, exact text, start and end offsets, length and groups.", matchingFields, "Inspect matches", ["Match list", "Match positions", "Match lengths", "Capture groups"], "Enter a JavaScript pattern and test text, then choose flags for the matches to inspect.", matchingExample),
  define("regex-group-extractor", "Regex Group Extractor", "Extract numbered and named JavaScript regex capture values per match, keeping empty and unmatched groups distinct.", matchingFields, "Extract groups", ["Extracted groups"], "Enter a pattern containing capture groups and the text to extract them from.", groupsExample),
  define("regex-flag-tester", "Regex Flag Tester", "Compare a JavaScript regex independently with no flags and each of g, i, m, s, u, y and d, including browser support errors.", [pattern, text], "Compare flags", ["Flag comparisons"], "Enter one JavaScript pattern and test text. Each of the eight rows runs independently with its named flag only.", { pattern: "^code$", text: "Code\ncode" }, ["Rows compare No flags, g, i, m, s, u, y and d independently, never cumulatively. Unsupported flags or invalid patterns are reported on their own row.", engineNotice, limitsNotice]),
  define("regex-pattern-builder", "Regex Pattern Builder", "Build JavaScript regex source from literal text or a character mode and quantifier, with clear case-insensitive usage guidance.", [
    { name: "literal", label: "Literal text", control: "textarea", hint: "Used only with Exact text. Other modes ignore this text." },
    select("mode", "Character matching mode", ["Exact text", "Any character", "Digit", "Non-digit", "Word character", "Non-word character", "Whitespace", "Non-whitespace"]),
    select("quantifier", "Quantifier", ["Exactly once", "Zero or one", "Zero or more", "One or more"]),
    select("caseSensitivity", "Case sensitivity", ["Case sensitive", "Case insensitive"]),
  ], "Build pattern", ["Generated pattern"], "Choose a character matching mode and quantifier. Enter literal text only for Exact text and choose case sensitivity.", { literal: "hello.world?", mode: "Exact text", quantifier: "Exactly once", caseSensitivity: "Case sensitive" }, ["Output is JavaScript pattern source only, without slash delimiters or flags. Case insensitive requires the i flag when using the generated pattern. Literal text is used only in Exact text mode.", limitsNotice]),
  define("regex-capture-group-tester", "Regex Capture Group Tester", "Inspect JavaScript regex capture definitions, non-capturing groups and lookarounds alongside per-match capture values.", matchingFields, "Test capture groups", ["Group definitions", "Match captures"], "Enter a pattern with groups or lookarounds and test text. Definitions and captured values appear separately.", groupsExample),
  define("regex-split-tester", "Regex Split Tester", "Split text with a JavaScript regex separator and inspect numbered parts, including captured separators, empty values and unmatched captures.", matchingFields, "Split text", ["Split parts", "Part count"], "Enter a JavaScript separator pattern and test text. Captured separators are included in JavaScript split results; g is not needed to split every separator.", { pattern: "[,;]", text: "one,two;three", flags: "" }, ["Uses JavaScript String.prototype.split semantics. All applicable separators are considered regardless of g; captured separators are included and unmatched captures appear as null. Empty separators advance according to the selected Unicode behavior.", limitsNotice]),
] as const;

export type RegexToolDefinition = (typeof regexTools)[number];
export function isRegexToolId(id: string): id is RegexToolId { return regexTools.some(tool => tool.id === id); }
export function getRegexDefinition(idOrSlug: string): RegexToolDefinition | undefined { return regexTools.find(tool => tool.id === idOrSlug || tool.slug === idOrSlug); }
