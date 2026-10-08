import type { RegexFlagRow, RegexMatch, RegexResult, RegexValues } from "./types";
import { replacementLength } from "./replacement";
import { scanGroups } from "./structure";

const PATTERN_LIMIT = 16_384;
const INPUT_LIMIT = 200_000;
const ITEM_LIMIT = 2_000;
const OUTPUT_LIMIT = 4_000_000;
const FLAG_OPTIONS = ["", "g", "i", "m", "s", "u", "y", "d"];

class OutputBudget {
  private used = 0;

  add(length: number): void {
    this.used += length;
    if (this.used > OUTPUT_LIMIT) throw new Error("Result exceeds the 4,000,000-character output limit. Reduce the input or the number of captures.");
  }
}

function input(values: RegexValues, key: string, limit = INPUT_LIMIT): string {
  const value = values[key] ?? "";
  if (value.length > limit) throw new Error(`${key === "pattern" ? "Pattern" : key === "replacement" ? "Replacement" : key === "literal" ? "Literal text" : "Text"} exceeds the ${limit.toLocaleString("en-US")}-character limit.`);
  return value;
}

function compile(pattern: string, flags: string): RegExp {
  const seen = new Set<string>();
  for (const flag of flags) {
    if (!FLAG_OPTIONS.includes(flag) || flag === "") throw new Error("Unsupported flag. Use only g, i, m, s, u, y, or d, without spaces or delimiters.");
    if (seen.has(flag)) throw new Error("Duplicate flag. Include each selected flag only once.");
    seen.add(flag);
  }
  if (seen.has("d")) {
    try {
      new RegExp("", "d");
    } catch {
      throw new Error("This browser does not support the d (match indices) flag. Remove d or use a browser with match-index support.");
    }
  }
  try {
    return new RegExp(pattern, flags);
  } catch {
    // Native errors can include the entire input pattern. Never forward them.
    throw new Error("Invalid JavaScript regular expression. Check escapes, brackets, group syntax, quantifiers, and the selected flags.");
  }
}

function advanceStringIndex(text: string, index: number, unicode: boolean): number {
  if (!unicode || index + 1 >= text.length) return index + 1;
  const first = text.charCodeAt(index);
  const second = text.charCodeAt(index + 1);
  return index + (first >= 0xd800 && first <= 0xdbff && second >= 0xdc00 && second <= 0xdfff ? 2 : 1);
}

function visitMatches(regex: RegExp, text: string, visit: (match: RegExpExecArray, number: number) => void): number {
  regex.lastIndex = 0;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (++count > ITEM_LIMIT) throw new Error("Result exceeds the 2,000-match limit. Reduce the text or use a more selective pattern.");
    visit(match, count);
    if (!regex.global) break;
    if (match[0].length === 0) regex.lastIndex = advanceStringIndex(text, regex.lastIndex, regex.unicode);
  }
  return count;
}

function escapeLiteral(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function build(values: RegexValues): RegexResult {
  const modes: Record<string, string> = {
    "Any character": ".", Digit: "\\d", "Non-digit": "\\D", "Word character": "\\w",
    "Non-word character": "\\W", Whitespace: "\\s", "Non-whitespace": "\\S",
  };
  const quantifiers: Record<string, string> = { "Exactly once": "", "Zero or one": "?", "Zero or more": "*", "One or more": "+" };
  const mode = values.mode ?? "Exact text";
  const quantifier = values.quantifier ?? "Exactly once";
  const sensitivity = values.caseSensitivity ?? "Case sensitive";
  if (!Object.hasOwn(quantifiers, quantifier)) throw new Error("Select a supported quantifier.");
  if (sensitivity !== "Case sensitive" && sensitivity !== "Case insensitive") throw new Error("Select case-sensitive or case-insensitive matching.");
  let source: string;
  if (mode === "Exact text") {
    const literal = input(values, "literal");
    source = escapeLiteral(literal);
    // Without a Unicode flag an astral character occupies two regex atoms.
    // An empty literal needs a group too, since a bare quantifier is invalid.
    if (quantifiers[quantifier] && literal.length !== 1) source = `(?:${source})`;
  } else if (Object.hasOwn(modes, mode)) {
    source = modes[mode];
  } else {
    throw new Error("Select a supported pattern-building mode.");
  }
  return { kind: "builder", text: source + quantifiers[quantifier] };
}

function flagMatrix(pattern: string, text: string): RegexResult {
  const rows: RegexFlagRow[] = [];
  const budget = new OutputBudget();
  for (const flags of FLAG_OPTIONS) {
    let regex: RegExp;
    try {
      regex = compile(pattern, flags);
    } catch (error) {
      rows.push({ flags, valid: false, matched: null, count: null, first: null, error: (error as Error).message });
      continue;
    }
    let first: string | null = null;
    const count = visitMatches(regex, text, (match, number) => {
      if (number === 1) {
        budget.add(match[0].length + 128);
        first = match[0];
      }
    });
    rows.push({ flags, valid: true, matched: count > 0, count, first });
  }
  return { kind: "flags", rows };
}

/** Execute only in the disposable regex worker, whose caller owns the timeout. */
export function runRegex(slug: string, values: RegexValues): RegexResult {
  if (slug === "regex-escape") return { kind: "escape", text: escapeLiteral(input(values, "literal")) };
  if (slug === "regex-pattern-builder") return build(values);
  const kinds = {
    "regex-tester": "test", "regex-replace-tester": "replace", "regex-match-inspector": "inspect",
    "regex-group-extractor": "groups", "regex-flag-tester": "flags", "regex-capture-group-tester": "capture", "regex-split-tester": "split",
  } as const;
  if (!Object.hasOwn(kinds, slug)) throw new Error("Unknown regex tool.");
  const kind = kinds[slug as keyof typeof kinds];
  const pattern = input(values, "pattern", PATTERN_LIMIT);
  const text = input(values, "text");
  if (kind === "flags") return flagMatrix(pattern, text);
  const regex = compile(pattern, values.flags ?? "");
  const budget = new OutputBudget();

  if (kind === "split") {
    // One extra part distinguishes a complete native result from truncation.
    const parts = text.split(regex, ITEM_LIMIT + 1).map(part => part === undefined ? null : part);
    if (parts.length > ITEM_LIMIT) throw new Error("Result exceeds the 2,000-part limit. Reduce the text or use a more selective separator.");
    for (const part of parts) budget.add(part === null ? 4 : part.length + 4);
    return { kind, parts, count: parts.length };
  }

  if (kind === "replace") {
    const replacement = input(values, "replacement");
    let predictedLength = text.length;
    const count = visitMatches(regex, text, match => {
      predictedLength += replacementLength(replacement, match, text.length) - match[0].length;
      if (predictedLength > OUTPUT_LIMIT) throw new Error("Replacement exceeds the 4,000,000-character output limit. Reduce the replacement, input, or number of matches.");
    });
    budget.add(predictedLength);
    regex.lastIndex = 0;
    return { kind, text: text.replace(regex, replacement), count, matched: count > 0 };
  }

  const structure = scanGroups(pattern);
  const names = new Map(structure.filter(group => group.number !== undefined && group.name !== undefined).map(group => [group.number!, group.name!]));
  const definitions = kind === "capture" ? structure.map(group => {
    budget.add(group.end - group.start + (group.name?.length ?? 0) + 96);
    return { ...group, source: pattern.slice(group.start, group.end) };
  }) : undefined;
  const matches: RegexMatch[] = [];
  const count = visitMatches(regex, text, (match, number) => {
    budget.add(match[0].length + 96);
    const groups = [];
    for (let groupNumber = 1; groupNumber < match.length; groupNumber++) {
      const name = names.get(groupNumber);
      const value = match[groupNumber] ?? null;
      // Include duplicated named/numbered payload and structural overhead so
      // even thousands of empty captures cannot produce an unbounded message.
      budget.add((value?.length ?? 4) + (name?.length ?? 0) + 80);
      groups.push({ number: groupNumber, ...(name !== undefined ? { name } : {}), value,
        ...(match.indices ? { indices: match.indices[groupNumber] ?? null } : {}) });
    }
    matches.push({ number, value: match[0], start: match.index, end: match.index + match[0].length,
      length: match[0].length, groups, ...(match.indices ? { indices: match.indices[0] } : {}) });
  });
  return { kind, count, matched: count > 0, matches, ...(definitions ? { definitions } : {}) };
}
