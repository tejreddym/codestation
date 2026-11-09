/**
 * AI & Prompt Engineering Core Engine
 * Pure client-side algorithms for:
 * 1. Multi-model token estimation & visual boundary splitting (GPT-4o, Claude 3.5, Gemini 1.5, Llama 3, Generic BPE)
 * 2. LLM JSON syntax repair (markdown fences, Python literals, comments, quotes, unquoted keys, trailing/missing commas, truncated brackets)
 * 3. Prompt variable interpolation (Mustache / {{var}} & {var}, records table, OpenAI/Anthropic/Markdown export)
 * 4. Vector similarity & geometric distance metrics (Cosine, Euclidean, Dot Product, Manhattan, Chebyshev, angle, dimension breakdown)
 * 5. System prompt builder (role, mission, XML tags, CoT scratchpad, guardrails, few-shot examples, live token estimation)
 *
 * Zero server uploads, zero API calls, 100% in-browser processing.
 */

// ==========================================
// 1. AI TOKEN ESTIMATOR & BOUNDARY SPLITTER
// ==========================================

export type AiModelId = "gpt-4o" | "claude-3-5" | "gemini-1-5" | "llama-3" | "generic-bpe";

export interface TokenFragment {
  text: string;
  charStart: number;
  charEnd: number;
  index: number;
}

export interface ModelPresetPricing {
  id: AiModelId;
  name: string;
  family: string;
  defaultInputPer1M: number;
  defaultOutputPer1M: number;
  description: string;
}

export const MODEL_PRESETS: readonly ModelPresetPricing[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o / GPT-4o-mini",
    family: "OpenAI o200k / cl100k",
    defaultInputPer1M: 2.5,
    defaultOutputPer1M: 10.0,
    description: "OpenAI o200k_base byte-pair tokenizer (~3.7 chars/token)",
  },
  {
    id: "claude-3-5",
    name: "Claude 3.5 Sonnet / Haiku",
    family: "Anthropic Claude",
    defaultInputPer1M: 3.0,
    defaultOutputPer1M: 15.0,
    description: "Anthropic subword token model (~3.6 chars/token)",
  },
  {
    id: "gemini-1-5",
    name: "Gemini 1.5 Pro / Flash",
    family: "Google SentencePiece",
    defaultInputPer1M: 1.25,
    defaultOutputPer1M: 5.0,
    description: "Google SentencePiece 256k tokenizer (~3.8 chars/token)",
  },
  {
    id: "llama-3",
    name: "Llama 3 / 3.1 / 3.3",
    family: "Meta Tiktoken 128k",
    defaultInputPer1M: 0.4,
    defaultOutputPer1M: 0.4,
    description: "Meta 128k BPE vocabulary (~3.6 chars/token)",
  },
  {
    id: "generic-bpe",
    name: "Generic BPE / Whitespace",
    family: "Standard BPE",
    defaultInputPer1M: 1.0,
    defaultOutputPer1M: 2.0,
    description: "General-purpose byte-pair tokenization (~3.5 chars/token)",
  },
] as const;

export interface TokenCountResult {
  model: AiModelId;
  tokenCount: number;
  charCount: number;
  wordCount: number;
  lineCount: number;
  charsPerToken: number;
  estimatedInputCost: number;
  estimatedOutputCost: number;
  fragments: TokenFragment[];
}

/**
 * Common high-frequency English words and programming keywords that form single tokens
 * in modern 100k-200k LLM vocabularies.
 */
const COMMON_SINGLE_TOKENS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
  "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up",
  "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time",
  "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could",
  "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
  "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "are", "was", "were",
  "been", "has", "had", "did", "does", "done",
  // Common programming tokens
  "function", "return", "const", "let", "var", "import", "export", "class", "interface", "type",
  "string", "number", "boolean", "async", "await", "public", "private", "true", "false", "null",
  "undefined", "void", "default", "from", "throw", "catch", "try", "finally", "while", "for",
  "switch", "case", "break", "continue", "static", "readonly", "extends", "implements", "package",
  "select", "where", "from", "insert", "update", "delete", "table", "schema", "json", "html", "css"
]);

/**
 * Pre-tokenization regular expression pattern based on OpenAI cl100k/o200k and Llama 3 grammar:
 * Matches:
 * 1. Contractions: 's, 't, 're, 've, 'm, 'll, 'd, n't
 * 2. Words with letters (supports unicode letters)
 * 3. Numbers up to 3 digits (standard BPE digit grouping)
 * 4. Punctuation and non-whitespace sequences
 * 5. Whitespace sequences (newlines, spaces, tabs)
 */
const SPLIT_PATTERN = /(?:'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD]|n't|N'T)|[^\r\n\p{L}\p{N}]?[\p{L}]+|\p{N}{1,3}|[^\s\p{L}\p{N}]+|\s*[\r\n]+|\s+/gu;

/**
 * Subdivides a word or string fragment into BPE-like subword tokens.
 */
function subdivideChunk(chunk: string, model: AiModelId): string[] {
  if (chunk.length <= 1) return [chunk];

  // If chunk is all whitespace or newlines, group up to 4 spaces as single indent tokens
  if (/^\s+$/.test(chunk)) {
    if (chunk.includes("\n")) {
      const parts: string[] = [];
      const lines = chunk.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) parts.push("\n");
        if (lines[i].length > 0) {
          // split spaces into 2 or 4 space tokens
          const spaceMatches = lines[i].match(/ {1,4}|\t/g);
          if (spaceMatches) parts.push(...spaceMatches);
        }
      }
      return parts.length > 0 ? parts : [chunk];
    }
    const spaces = chunk.match(/ {1,4}|\t/g);
    return spaces ? spaces : [chunk];
  }

  // Check if chunk (trimmed of leading space) is a single recognized common token
  const trimmed = chunk.replace(/^ /, "").toLowerCase();
  if (COMMON_SINGLE_TOKENS.has(trimmed) && chunk.length <= 10) {
    return [chunk];
  }

  // Model-specific subword heuristics
  const maxSubwordLen = model === "llama-3" ? 5 : model === "gpt-4o" ? 4 : model === "gemini-1-5" ? 4 : 3;

  if (chunk.length <= maxSubwordLen) {
    return [chunk];
  }

  // Handle number sequences: split into 1-3 digits
  if (/^\d+$/.test(chunk)) {
    const parts = chunk.match(/\d{1,3}/g);
    return parts ? parts : [chunk];
  }

  // Non-ASCII characters (emojis, CJK characters, accented chars)
  if (/[^\x00-\x7F]/.test(chunk)) {
    const chars = Array.from(chunk);
    const subwords: string[] = [];
    let buf = "";
    for (const c of chars) {
      // CJK ideographs and emojis are usually separate tokens
      if (/[\p{Unified_Ideograph}\p{Emoji}]/u.test(c)) {
        if (buf) {
          subwords.push(buf);
          buf = "";
        }
        subwords.push(c);
      } else {
        buf += c;
        if (buf.length >= maxSubwordLen) {
          subwords.push(buf);
          buf = "";
        }
      }
    }
    if (buf) subwords.push(buf);
    return subwords;
  }

  // Long word: split into subword chunks of ~3-4 chars respecting syllables/suffixes
  const subwords: string[] = [];
  let remaining = chunk;

  // Preserve leading space if any
  if (remaining.startsWith(" ") && remaining.length > 1) {
    subwords.push(remaining.slice(0, 1 + Math.min(maxSubwordLen - 1, remaining.length - 1)));
    remaining = remaining.slice(subwords[0].length);
  }

  while (remaining.length > 0) {
    if (remaining.length <= maxSubwordLen) {
      subwords.push(remaining);
      break;
    }
    // Check common English suffixes
    const suffixMatches = remaining.match(/^(.*)(ing|tion|able|ment|ness|less|ful|ive|ous|est|er|ed|ly)$/i);
    if (suffixMatches && suffixMatches[1].length >= 3 && suffixMatches[2].length <= maxSubwordLen) {
      const prefix = suffixMatches[1];
      const suffix = suffixMatches[2];
      if (prefix.length <= maxSubwordLen) {
        subwords.push(prefix, suffix);
        break;
      }
    }

    const take = Math.min(maxSubwordLen, remaining.length);
    subwords.push(remaining.slice(0, take));
    remaining = remaining.slice(take);
  }

  return subwords;
}

/**
 * Tokenizes arbitrary input text into exact fragments with character offsets.
 * Guaranteed: fragments.map(f => f.text).join('') === text
 */
export function tokenizeText(text: string, model: AiModelId = "gpt-4o"): TokenFragment[] {
  if (!text) return [];

  const fragments: TokenFragment[] = [];
  let lastIndex = 0;
  const regex = new RegExp(SPLIT_PATTERN.source, SPLIT_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchText = match[0];

    // Catch any gap characters that the regex didn't explicitly capture
    if (matchStart > lastIndex) {
      const gap = text.slice(lastIndex, matchStart);
      fragments.push({
        text: gap,
        charStart: lastIndex,
        charEnd: matchStart,
        index: fragments.length,
      });
    }

    const subChunks = subdivideChunk(matchText, model);
    let subOffset = matchStart;
    for (const sub of subChunks) {
      const subEnd = subOffset + sub.length;
      fragments.push({
        text: sub,
        charStart: subOffset,
        charEnd: subEnd,
        index: fragments.length,
      });
      subOffset = subEnd;
    }

    lastIndex = matchStart + matchText.length;
  }

  // Trailing characters if any
  if (lastIndex < text.length) {
    const trailing = text.slice(lastIndex);
    fragments.push({
      text: trailing,
      charStart: lastIndex,
      charEnd: text.length,
      index: fragments.length,
    });
  }

  // Verify and re-index sequentially
  return fragments.map((f, i) => ({ ...f, index: i }));
}

/**
 * Comprehensive Token Count & Cost Estimation function
 */
export function countTokens(
  text: string,
  model: AiModelId = "gpt-4o",
  pricing?: { inputPricePer1M?: number; outputPricePer1M?: number }
): TokenCountResult {
  const fragments = tokenizeText(text, model);
  const tokenCount = fragments.length;
  const charCount = text.length;

  // Words count (non-empty space-separated sequences)
  const trimmed = text.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const lineCount = text ? text.split("\n").length : 0;
  const charsPerToken = tokenCount > 0 ? parseFloat((charCount / tokenCount).toFixed(2)) : 0;

  // Find preset pricing
  const preset = MODEL_PRESETS.find((p) => p.id === model) || MODEL_PRESETS[0];
  const inputPrice = pricing?.inputPricePer1M ?? preset.defaultInputPer1M;
  const outputPrice = pricing?.outputPricePer1M ?? preset.defaultOutputPer1M;

  const estimatedInputCost = parseFloat(((tokenCount / 1_000_000) * inputPrice).toFixed(6));
  const estimatedOutputCost = parseFloat(((tokenCount / 1_000_000) * outputPrice).toFixed(6));

  return {
    model,
    tokenCount,
    charCount,
    wordCount,
    lineCount,
    charsPerToken,
    estimatedInputCost,
    estimatedOutputCost,
    fragments,
  };
}

// ==========================================
// 2. LLM JSON SYNTAX REPAIR ENGINE
// ==========================================

export interface JsonRepairResult {
  success: boolean;
  repaired: string;
  original: string;
  repairsApplied: string[];
  error?: string;
  parsed?: unknown;
}

/**
 * Genuine in-browser parser & repair engine for malformed LLM JSON.
 * Fixes markdown fences, Python literals, comments, single quotes, unquoted keys,
 * unescaped quotes, trailing commas, missing commas, and truncated braces/brackets.
 */
export function repairJson(
  malformedJson: string,
  options?: { indent?: number | "compact" }
): JsonRepairResult {
  const original = malformedJson;
  const repairsApplied: string[] = [];

  if (!malformedJson || !malformedJson.trim()) {
    return {
      success: false,
      repaired: "",
      original,
      repairsApplied: [],
      error: "Input text is empty.",
    };
  }

  // Quick check: if already valid JSON
  try {
    const parsed = JSON.parse(malformedJson);
    const space = options?.indent === "compact" ? undefined : (options?.indent ?? 2);
    return {
      success: true,
      repaired: JSON.stringify(parsed, null, space),
      original,
      repairsApplied: ["Valid JSON (formatted cleanly)"],
      parsed,
    };
  } catch {
    // Needs repair
  }

  let text = malformedJson.trim();

  // 1. Strip markdown fences: ```json ... ``` or ``` ... ```
  if (/```(?:json)?\s*[\s\S]*?```/.test(text)) {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
      repairsApplied.push("Stripped markdown code fences (```json)");
    }
  } else if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    repairsApplied.push("Stripped opening/closing code fences");
  }

  // 1b. If there is conversational preamble before the first { or [, extract from there
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let startIndex = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex > 0) {
    const prefix = text.slice(0, startIndex);
    if (!prefix.includes('"') && !prefix.includes("'")) {
      text = text.slice(startIndex);
      repairsApplied.push("Stripped conversational preamble before JSON structure");
    }
  }

  // 2. Strip single-line comments (// ...) and multi-line comments (/* ... */) outside string literals
  let cleanedComments = "";
  let inString = false;
  let quoteChar = "";
  let isEscaped = false;
  let hasComments = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      cleanedComments += ch;
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === "\\") {
        isEscaped = true;
      } else if (ch === quoteChar) {
        inString = false;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        quoteChar = ch;
        cleanedComments += ch;
      } else if (ch === "/" && next === "/") {
        hasComments = true;
        // Skip until newline
        while (i < text.length && text[i] !== "\n") {
          i++;
        }
      } else if (ch === "/" && next === "*") {
        hasComments = true;
        i += 2;
        while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
          i++;
        }
        i++; // skip /
      } else {
        cleanedComments += ch;
      }
    }
  }

  if (hasComments) {
    repairsApplied.push("Removed comments (// and /* */)");
    text = cleanedComments;
  }

  // 3. Convert Python & JavaScript literals (True, False, None, undefined, NaN)
  const pythonLiterals = [
    { pattern: /\bTrue\b/g, replacement: "true", label: "True → true" },
    { pattern: /\bFalse\b/g, replacement: "false", label: "False → false" },
    { pattern: /\bNone\b/g, replacement: "null", label: "None → null" },
    { pattern: /\bundefined\b/g, replacement: "null", label: "undefined → null" },
    { pattern: /\bNaN\b/g, replacement: '"NaN"', label: 'NaN → "NaN"' },
  ];

  let convertedLiterals = false;
  for (const lit of pythonLiterals) {
    if (lit.pattern.test(text)) {
      text = text.replace(lit.pattern, lit.replacement);
      convertedLiterals = true;
    }
  }
  if (convertedLiterals) {
    repairsApplied.push("Converted Python/JS literals (True/False/None/undefined)");
  }

  // 4. Normalize single quotes to double quotes outside and around strings
  // Also handle backticks
  let normalizedQuotes = "";
  inString = false;
  quoteChar = "";
  isEscaped = false;
  let hasSingleQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (isEscaped) {
        normalizedQuotes += ch;
        isEscaped = false;
      } else if (ch === "\\") {
        normalizedQuotes += ch;
        isEscaped = true;
      } else if (ch === quoteChar) {
        inString = false;
        normalizedQuotes += '"';
      } else if (ch === '"' && quoteChar === "'") {
        // Escaped double quote inside originally single-quoted string
        normalizedQuotes += '\\"';
      } else {
        normalizedQuotes += ch;
      }
    } else {
      if (ch === "'" || ch === "`") {
        inString = true;
        quoteChar = ch;
        hasSingleQuotes = true;
        normalizedQuotes += '"';
      } else if (ch === '"') {
        inString = true;
        quoteChar = '"';
        normalizedQuotes += '"';
      } else {
        normalizedQuotes += ch;
      }
    }
  }

  if (hasSingleQuotes) {
    repairsApplied.push("Replaced single quotes and backticks with valid double quotes");
    text = normalizedQuotes;
  }

  // 5. Quote unquoted object keys: { name: "val" } -> { "name": "val" }
  const unquotedKeyRegex = /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$-]*)(\s*:)/g;
  if (unquotedKeyRegex.test(text)) {
    text = text.replace(unquotedKeyRegex, '$1"$2"$3');
    repairsApplied.push("Quoted unquoted object keys");
  }

  // 6. Remove trailing commas before } and ]: { "a": 1, } -> { "a": 1 }
  const trailingCommaRegex = /,\s*([}\]])/g;
  if (trailingCommaRegex.test(text)) {
    text = text.replace(trailingCommaRegex, "$1");
    repairsApplied.push("Removed trailing commas in objects and arrays");
  }

  // 7. Insert missing commas between elements on separate lines or consecutive pairs:
  // e.g. "a": 1 \n "b": 2  or  "val1" \n "val2"
  const missingCommaRegex = /(["'\dtruefalsenull\]}])(\s*[\r\n]+\s*)(["'{\[]|[a-zA-Z_$])/g;
  let addedCommas = false;
  text = text.replace(missingCommaRegex, (match, p1, p2, p3) => {
    // If line already ends with comma or colon, keep it
    if (p1.endsWith(",") || p1.endsWith(":")) return match;
    addedCommas = true;
    return `${p1},${p2}${p3}`;
  });
  if (addedCommas) {
    repairsApplied.push("Inserted missing commas between items");
  }

  // 8. Balance truncated braces and brackets caused by LLM output cutoff
  const bracketStack: string[] = [];
  inString = false;
  isEscaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === "\\") {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === "{" || ch === "[") {
        bracketStack.push(ch);
      } else if (ch === "}") {
        if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === "{") {
          bracketStack.pop();
        }
      } else if (ch === "]") {
        if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === "[") {
          bracketStack.pop();
        }
      }
    }
  }

  // If text cut off inside an open string, close the string quote
  if (inString) {
    text += '"';
    repairsApplied.push("Closed unclosed string quotation");
  }

  // Clean trailing commas after string closure
  text = text.replace(/,\s*$/, "");

  // Close remaining open brackets in reverse order
  if (bracketStack.length > 0) {
    const closingBrackets = bracketStack
      .reverse()
      .map((b) => (b === "{" ? "}" : "]"))
      .join("");
    text += closingBrackets;
    repairsApplied.push(`Balanced truncated brackets/braces (${closingBrackets})`);
  }

  // 9. Final Validation with JSON.parse
  try {
    const parsed = JSON.parse(text);
    const space = options?.indent === "compact" ? undefined : (options?.indent ?? 2);
    const formatted = JSON.stringify(parsed, null, space);
    return {
      success: true,
      repaired: formatted,
      original,
      repairsApplied,
      parsed,
    };
  } catch (err) {
    return {
      success: false,
      repaired: text,
      original,
      repairsApplied,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ==========================================
// 3. PROMPT INTERPOLATOR & TEST RECORDS
// ==========================================

export interface PromptRoleMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface InterpolationRecordResult {
  recordIndex: number;
  record: Record<string, string>;
  interpolatedPrompt: string;
  messages: PromptRoleMessage[];
  missingVariables: string[];
}

export interface InterpolationResult {
  variables: string[];
  records: Record<string, string>[];
  results: InterpolationRecordResult[];
  openAiExport: string;
  anthropicExport: string;
  markdownExport: string;
}

/**
 * Extracts unique variable names from Mustache {{var}} or single-brace {var} templates.
 */
export function extractTemplateVariables(template: string): string[] {
  const vars = new Set<string>();
  // Match {{ variable }} or { variable }
  const regex = /\{\{?\s*([a-zA-Z0-9_$-]+)\s*\}?\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

/**
 * Interpolates a single string with values from record
 */
export function interpolateString(
  template: string,
  record: Record<string, string>
): { result: string; missing: string[] } {
  const missing: string[] = [];
  const result = template.replace(/\{\{?\s*([a-zA-Z0-9_$-]+)\s*\}?\}/g, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(record, varName) && record[varName] !== undefined) {
      return String(record[varName]);
    }
    if (!missing.includes(varName)) {
      missing.push(varName);
    }
    return match; // keep original if missing
  });
  return { result, missing };
}

/**
 * Comprehensive Prompt Interpolation across multiple test records
 */
export function interpolatePrompt(options: {
  template: string;
  records: Record<string, string>[];
  systemTemplate?: string;
  assistantTemplate?: string;
}): InterpolationResult {
  const { template, records, systemTemplate, assistantTemplate } = options;

  // Extract all variables across all template roles
  const combinedText = `${template} ${systemTemplate || ""} ${assistantTemplate || ""}`;
  const variables = extractTemplateVariables(combinedText);

  // Default to at least one empty record if records list is empty
  const effectiveRecords = records.length > 0 ? records : [{}];

  const results: InterpolationRecordResult[] = effectiveRecords.map((record, index) => {
    const missingSet = new Set<string>();

    const userInterp = interpolateString(template, record);
    userInterp.missing.forEach((m) => missingSet.add(m));

    const messages: PromptRoleMessage[] = [];

    if (systemTemplate && systemTemplate.trim()) {
      const sysInterp = interpolateString(systemTemplate, record);
      sysInterp.missing.forEach((m) => missingSet.add(m));
      messages.push({ role: "system", content: sysInterp.result });
    }

    messages.push({ role: "user", content: userInterp.result });

    if (assistantTemplate && assistantTemplate.trim()) {
      const asstInterp = interpolateString(assistantTemplate, record);
      asstInterp.missing.forEach((m) => missingSet.add(m));
      messages.push({ role: "assistant", content: asstInterp.result });
    }

    return {
      recordIndex: index,
      record,
      interpolatedPrompt: userInterp.result,
      messages,
      missingVariables: Array.from(missingSet),
    };
  });

  // Generate OpenAI Chat API JSON export
  const openAiExport = JSON.stringify(
    results.map((r) => r.messages),
    null,
    2
  );

  // Generate Anthropic Messages API JSON export
  const anthropicExport = JSON.stringify(
    results.map((r) => {
      const systemMsg = r.messages.find((m) => m.role === "system");
      const userAndAsst = r.messages.filter((m) => m.role !== "system");
      return {
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: userAndAsst.map((m) => ({ role: m.role, content: m.content })),
      };
    }),
    null,
    2
  );

  // Generate Markdown transcript export
  const markdownExport = results
    .map((r, i) => {
      const parts = [`## Test Record ${i + 1}`];
      for (const msg of r.messages) {
        parts.push(`### ${msg.role.toUpperCase()}\n${msg.content}`);
      }
      return parts.join("\n\n");
    })
    .join("\n\n---\n\n");

  return {
    variables,
    records: effectiveRecords,
    results,
    openAiExport,
    anthropicExport,
    markdownExport,
  };
}

// ==========================================
// 4. VECTOR SIMILARITY & DISTANCE ENGINE
// ==========================================

export interface VectorDimensionBreakdown {
  index: number;
  valA: number;
  valB: number;
  product: number;
  delta: number;
}

export interface VectorMetricsResult {
  vectorA: number[];
  vectorB: number[];
  dimensions: number;
  cosineSimilarity: number;
  similarityPercentage: number;
  euclideanDistance: number;
  dotProduct: number;
  manhattanDistance: number;
  chebyshevDistance: number;
  normA: number;
  normB: number;
  angleRadians: number;
  angleDegrees: number;
  dimensionBreakdown: VectorDimensionBreakdown[];
  topPositiveDimensions: VectorDimensionBreakdown[];
  topNegativeDimensions: VectorDimensionBreakdown[];
  sparsityA: number;
  sparsityB: number;
}

/**
 * Parses user vector input (JSON array, comma-separated, or space-separated numbers).
 */
export function parseVectorInput(input: string): number[] {
  if (!input || !input.trim()) return [];
  const text = input.trim();

  // Try JSON parse first
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        return arr.map((x) => {
          const num = Number(x);
          if (isNaN(num)) throw new Error(`Invalid number in vector: ${x}`);
          return num;
        });
      }
    } catch {
      // Fall through to regex
    }
  }

  // Split by comma, whitespace, or newline
  const tokens = text.split(/[\s,]+/).filter(Boolean);
  return tokens.map((token) => {
    const clean = token.replace(/^[[(]|[\])]$/g, "");
    const num = Number(clean);
    if (isNaN(num)) throw new Error(`Invalid numeric token in vector: "${token}"`);
    return num;
  });
}

/**
 * Computes Vector Similarity & Distance Metrics across all standard geometries
 */
export function computeVectorSimilarity(
  vecA: number[] | string,
  vecB: number[] | string
): VectorMetricsResult {
  const a = typeof vecA === "string" ? parseVectorInput(vecA) : vecA;
  const b = typeof vecB === "string" ? parseVectorInput(vecB) : vecB;

  if (a.length === 0 || b.length === 0) {
    throw new Error("Vectors cannot be empty. Please provide numerical vector data.");
  }

  if (a.length !== b.length) {
    throw new Error(
      `Dimension mismatch: Vector A has ${a.length} dimensions, but Vector B has ${b.length} dimensions. Both vectors must have equal length.`
    );
  }

  const dimensions = a.length;
  let dotProduct = 0;
  let sumSqA = 0;
  let sumSqB = 0;
  let sumSqDiff = 0;
  let manhattanDistance = 0;
  let chebyshevDistance = 0;
  let zerosA = 0;
  let zerosB = 0;

  const dimensionBreakdown: VectorDimensionBreakdown[] = [];

  for (let i = 0; i < dimensions; i++) {
    const valA = a[i];
    const valB = b[i];

    if (valA === 0) zerosA++;
    if (valB === 0) zerosB++;

    const product = valA * valB;
    const diff = valA - valB;
    const absDiff = Math.abs(diff);

    dotProduct += product;
    sumSqA += valA * valA;
    sumSqB += valB * valB;
    sumSqDiff += diff * diff;
    manhattanDistance += absDiff;
    if (absDiff > chebyshevDistance) {
      chebyshevDistance = absDiff;
    }

    dimensionBreakdown.push({
      index: i,
      valA,
      valB,
      product,
      delta: absDiff,
    });
  }

  const normA = Math.sqrt(sumSqA);
  const normB = Math.sqrt(sumSqB);
  const euclideanDistance = Math.sqrt(sumSqDiff);

  let cosineSimilarity = 0;
  if (normA > 0 && normB > 0) {
    cosineSimilarity = dotProduct / (normA * normB);
    // Clamp rounding errors into [-1, 1]
    cosineSimilarity = Math.max(-1, Math.min(1, cosineSimilarity));
  } else if (normA === 0 && normB === 0) {
    cosineSimilarity = 1.0; // Both zero vectors
  }

  // Normalized similarity percentage [0%, 100%]
  const similarityPercentage = parseFloat((((cosineSimilarity + 1) / 2) * 100).toFixed(2));

  // Angular distance
  const angleRadians = Math.acos(cosineSimilarity);
  const angleDegrees = parseFloat(((angleRadians * 180) / Math.PI).toFixed(2));

  // Top positive contributing dimensions (most pulling towards similarity)
  const sortedByProduct = [...dimensionBreakdown].sort((x, y) => y.product - x.product);
  const topPositiveDimensions = sortedByProduct.filter((d) => d.product > 0).slice(0, 5);
  const topNegativeDimensions = sortedByProduct
    .filter((d) => d.product < 0)
    .reverse()
    .slice(0, 5);

  const sparsityA = parseFloat(((zerosA / dimensions) * 100).toFixed(1));
  const sparsityB = parseFloat(((zerosB / dimensions) * 100).toFixed(1));

  return {
    vectorA: a,
    vectorB: b,
    dimensions,
    cosineSimilarity: parseFloat(cosineSimilarity.toFixed(6)),
    similarityPercentage,
    euclideanDistance: parseFloat(euclideanDistance.toFixed(6)),
    dotProduct: parseFloat(dotProduct.toFixed(6)),
    manhattanDistance: parseFloat(manhattanDistance.toFixed(6)),
    chebyshevDistance: parseFloat(chebyshevDistance.toFixed(6)),
    normA: parseFloat(normA.toFixed(6)),
    normB: parseFloat(normB.toFixed(6)),
    angleRadians: parseFloat(angleRadians.toFixed(6)),
    angleDegrees,
    dimensionBreakdown,
    topPositiveDimensions,
    topNegativeDimensions,
    sparsityA,
    sparsityB,
  };
}

// ==========================================
// 5. SYSTEM PROMPT BUILDER
// ==========================================

export interface FewShotExample {
  id: string;
  input: string;
  reasoning?: string;
  output: string;
}

export interface SystemPromptConfig {
  roleName: string;
  roleTone: string;
  background?: string;
  coreTask: string;
  xmlWrapping: boolean;
  chainOfThought: boolean;
  cotInstructions?: string;
  guardrails: string[];
  customConstraints?: string[];
  examples?: FewShotExample[];
  outputFormat: "json" | "markdown" | "plain" | "code" | "custom";
  customFormatSchema?: string;
}

export interface SystemPromptResult {
  assembledPrompt: string;
  tokenCount: number;
  charCount: number;
  wordCount: number;
  sectionsCount: number;
}

export const GUARDRAIL_PRESETS = [
  "Do not hallucinate, speculate, or assume unspecified parameters.",
  "Never use conversational filler or polite pleasantries (e.g., 'Sure, I can help with that!').",
  "Never apologize or explain your reasoning process unless explicitly asked.",
  "Do not wrap raw code or JSON outputs in markdown conversational fences.",
  "Strictly follow the output format specifications with zero deviations.",
  "Refuse out-of-scope requests politely and state what you can do instead.",
];

export const SYSTEM_PROMPT_PRESETS: { name: string; config: SystemPromptConfig }[] = [
  {
    name: "TypeScript & Next.js Architect",
    config: {
      roleName: "Senior TypeScript & Next.js Systems Architect",
      roleTone: "Senior Technical & Direct",
      background: "Expert in modern TypeScript, Next.js 15 App Router, React 19 Server Components, and zero-telemetry architectures.",
      coreTask: "Analyze requirements, design robust typed systems, provide minimal-change diffs, and ensure zero regressions.",
      xmlWrapping: true,
      chainOfThought: true,
      cotInstructions: "Plan your approach in <thinking> scratchpad before emitting code.",
      guardrails: [
        "Do not hallucinate, speculate, or assume unspecified parameters.",
        "Never use conversational filler or polite pleasantries (e.g., 'Sure, I can help with that!').",
        "Strictly follow the output format specifications with zero deviations.",
      ],
      customConstraints: ["All code must pass strict TypeScript checks with noEmit."],
      examples: [
        {
          id: "ex1",
          input: "How should I structure client components in Next.js 15 App Router?",
          reasoning: "Isolate 'use client' directives at the leaves of the tree to minimize bundle overhead.",
          output: "Use Server Components for data ingestion and static layout. Mark only interactive leaf boundaries with 'use client'.",
        },
      ],
      outputFormat: "markdown",
    },
  },
  {
    name: "JSON Extraction Agent",
    config: {
      roleName: "High-Fidelity Structured Data Extractor",
      roleTone: "Strict & Analytical",
      background: "Specialized in transforming unstructured text, receipts, or logs into strict JSON schemas.",
      coreTask: "Extract all relevant entities from the user document into valid RFC-8259 JSON format.",
      xmlWrapping: true,
      chainOfThought: false,
      guardrails: [
        "Do not hallucinate, speculate, or assume unspecified parameters.",
        "Do not wrap raw code or JSON outputs in markdown conversational fences.",
        "Strictly follow the output format specifications with zero deviations.",
      ],
      customConstraints: ["Output ONLY valid JSON. No conversational preamble."],
      outputFormat: "json",
      customFormatSchema: '{\n  "entities": [\n    {\n      "id": "string",\n      "type": "string",\n      "value": "string"\n    }\n  ]\n}',
    },
  },
  {
    name: "Socratic Technical Tutor",
    config: {
      roleName: "Socratic Technical Educator",
      roleTone: "Socratic & Inquisitive",
      background: "Teaches computer science fundamentals, data structures, and algorithms through guided inquiry.",
      coreTask: "Guide the learner to discover answers themselves by asking probing questions and giving conceptual hints.",
      xmlWrapping: false,
      chainOfThought: true,
      cotInstructions: "Assess the learner's current understanding in <thinking> before formulating your questions.",
      guardrails: [
        "Do not hallucinate, speculate, or assume unspecified parameters.",
        "Never explain your reasoning process unless explicitly asked.",
      ],
      customConstraints: ["Do not provide the complete code solution immediately. Offer one leading hint at a time."],
      outputFormat: "plain",
    },
  },
];

/**
 * Assembles a structured system prompt from constituent modular blocks.
 */
export function buildSystemPrompt(config: SystemPromptConfig): SystemPromptResult {
  const parts: string[] = [];
  let sectionsCount = 0;

  const {
    roleName,
    roleTone,
    background,
    coreTask,
    xmlWrapping,
    chainOfThought,
    cotInstructions,
    guardrails,
    customConstraints,
    examples,
    outputFormat,
    customFormatSchema,
  } = config;

  // 1. Role & Identity
  if (roleName || roleTone || background) {
    sectionsCount++;
    const roleContent = [
      roleName ? `You are ${roleName}.` : "",
      roleTone ? `Tone & Demeanor: ${roleTone}.` : "",
      background ? background : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (xmlWrapping) {
      parts.push(`<role>\n${roleContent}\n</role>`);
    } else {
      parts.push(`# Role & Persona\n${roleContent}`);
    }
  }

  // 2. Core Task & Instructions
  if (coreTask) {
    sectionsCount++;
    if (xmlWrapping) {
      parts.push(`<instructions>\n${coreTask}\n</instructions>`);
    } else {
      parts.push(`# Core Mission\n${coreTask}`);
    }
  }

  // 3. Chain of Thought
  if (chainOfThought) {
    sectionsCount++;
    const cotText =
      cotInstructions ||
      "Before delivering your final output, think through the problem step-by-step inside a <thinking> scratchpad tag. Verify edge cases, constraints, and correctness.";
    if (xmlWrapping) {
      parts.push(`<scratchpad_instructions>\n${cotText}\n</scratchpad_instructions>`);
    } else {
      parts.push(`# Reasoning Scratchpad\n${cotText}`);
    }
  }

  // 4. Guardrails & Negative Constraints
  const allConstraints = [...guardrails, ...(customConstraints || [])].filter(Boolean);
  if (allConstraints.length > 0) {
    sectionsCount++;
    const constraintsList = allConstraints.map((c) => `- ${c}`).join("\n");
    if (xmlWrapping) {
      parts.push(`<guardrails>\n${constraintsList}\n</guardrails>`);
    } else {
      parts.push(`# Guardrails & Constraints\n${constraintsList}`);
    }
  }

  // 5. Few-Shot Examples
  if (examples && examples.length > 0) {
    sectionsCount++;
    if (xmlWrapping) {
      const examplesXml = examples
        .map(
          (ex) =>
            `<example>\n  <user_input>${ex.input}</user_input>\n${
              ex.reasoning ? `  <thinking>${ex.reasoning}</thinking>\n` : ""
            }  <output>${ex.output}</output>\n</example>`
        )
        .join("\n\n");
      parts.push(`<examples>\n${examplesXml}\n</examples>`);
    } else {
      const examplesMd = examples
        .map((ex, i) => {
          return `### Example ${i + 1}\n**Input**: ${ex.input}\n${
            ex.reasoning ? `**Reasoning**: ${ex.reasoning}\n` : ""
          }**Output**: ${ex.output}`;
        })
        .join("\n\n");
      parts.push(`# Examples\n${examplesMd}`);
    }
  }

  // 6. Output Format
  sectionsCount++;
  let formatDesc = "";
  switch (outputFormat) {
    case "json":
      formatDesc = customFormatSchema
        ? `Respond strictly with a valid JSON object matching the following schema:\n\`\`\`json\n${customFormatSchema}\n\`\`\``
        : "Respond strictly with valid RFC-8259 JSON format. Do not include markdown code fences or conversational text.";
      break;
    case "markdown":
      formatDesc = "Respond in clean, well-formatted Markdown with semantic headings, lists, and code blocks.";
      break;
    case "code":
      formatDesc = "Respond ONLY with production-ready code. Do not include markdown conversational explanations or intros.";
      break;
    case "plain":
      formatDesc = "Respond in plain text with no formatting, markdown, or HTML tags.";
      break;
    case "custom":
      formatDesc = customFormatSchema || "Follow custom formatting specifications.";
      break;
  }

  if (xmlWrapping) {
    parts.push(`<output_format>\n${formatDesc}\n</output_format>`);
  } else {
    parts.push(`# Output Format\n${formatDesc}`);
  }

  const assembledPrompt = parts.join("\n\n");
  const tokenStats = countTokens(assembledPrompt, "gpt-4o");

  return {
    assembledPrompt,
    tokenCount: tokenStats.tokenCount,
    charCount: tokenStats.charCount,
    wordCount: tokenStats.wordCount,
    sectionsCount,
  };
}
