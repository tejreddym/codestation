/**
 * Pure, local-first text helpers for Text Station.
 *
 * The module deliberately has no DOM, network, filesystem, or framework
 * dependencies. Generated and shuffled text uses Web Crypto rather than
 * Math.random so it is safe to use in a browser-only tool.
 */

export const MAX_TEXT_LENGTH = 1_000_000;
export const MAX_GENERATED_LENGTH = 100_000;
export const MAX_DIFF_LINES = 2_000;
export const MAX_DIFF_CELLS = 4_000_000;
export const MAX_MATCHES = 10_000;

export type NormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";
export type TextCase = "upper" | "lower" | "title" | "sentence" | "camel" | "pascal" | "snake" | "kebab" | "constant";
export type SortOrder = "ascending" | "descending";
export type LineEnding = "lf" | "crlf" | "cr";
export type DetectedLineEnding = LineEnding | "mixed" | "none";

export interface CaseOptions {
  locale?: string;
}

export interface LineOptions {
  /** Compare lines after trimming them for the key, while returning originals. */
  trimForComparison?: boolean;
  /** Compare without regard to letter case. */
  caseSensitive?: boolean;
}

export interface SortLinesOptions extends LineOptions {
  order?: SortOrder;
  numeric?: boolean;
  locale?: string;
}

export interface WhitespaceOptions {
  /** Collapse horizontal whitespace runs to one space. Defaults to true. */
  collapse?: boolean;
  /** Trim each line. Defaults to true. */
  trimLines?: boolean;
  /** Trim whitespace at the start and end of the whole result. Defaults to true. */
  trimText?: boolean;
  lineEnding?: LineEnding;
}

export interface PrefixSuffixOptions {
  /** Do not add the prefix/suffix to blank lines. */
  skipEmpty?: boolean;
}

export interface ReplaceOptions {
  /** Treat a string search value as a regular expression. */
  regex?: boolean;
  /** Regular-expression flags when regex is true. */
  flags?: string;
  /** Replace every match. Defaults to true. */
  replaceAll?: boolean;
  /** Case-insensitive matching for normal string searches. */
  caseSensitive?: boolean;
  /** Upper bound for replacements. Defaults to MAX_MATCHES. */
  maxMatches?: number;
}

export interface TextMatch {
  match: string;
  index: number;
  end: number;
}

export interface FindResult {
  matches: TextMatch[];
  count: number;
  truncated: boolean;
}

export interface ReplaceResult extends FindResult {
  text: string;
}

export type UnifiedLineType = "context" | "addition" | "deletion";

export interface UnifiedDiffLine {
  type: UnifiedLineType;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export type SideBySideLineType = "equal" | "changed" | "added" | "removed";

export interface SideBySideDiffRow {
  type: SideBySideLineType;
  left: { line: number; text: string } | null;
  right: { line: number; text: string } | null;
}

export interface TextDiffResult {
  changed: boolean;
  added: number;
  removed: number;
  unified: string;
  unifiedLines: UnifiedDiffLine[];
  sideBySide: SideBySideDiffRow[];
  /** Explicit data aliases make it easy for a UI to choose a renderer. */
  unifiedData: UnifiedDiffLine[];
  sideBySideData: SideBySideDiffRow[];
}

export interface LoremOptions {
  words?: number;
  paragraphs?: number;
  wordsPerParagraph?: number;
}

export interface RandomTextOptions {
  alphabet?: string;
}

export interface BomInfo {
  present: boolean;
  encoding: "utf-8" | "none";
}

export interface TextCounts {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
}

export type TextLineOperation = "sort" | "reverse" | "deduplicate" | "number" | "trim" | "remove-empty" | "filter" | "join";
export type TextGeneratorKind = "random" | "lorem" | "repeat" | "uuid" | "slug";
export type TextExtractorKind = "emails" | "urls" | "numbers" | "hashtags" | "mentions" | "quoted" | "words" | "lines";

const DEFAULT_RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo", " consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate", "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id", "est", "laborum",
].map((word) => word.trim());

function assertText(value: string, name = "text"): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string.`);
  if (value.length > MAX_TEXT_LENGTH) throw new RangeError(`${name} must be at most ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
  return value;
}

function assertBoundedInteger(value: number, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function lineEndingValue(value: LineEnding): string {
  if (value === "lf") return "\n";
  if (value === "crlf") return "\r\n";
  if (value === "cr") return "\r";
  throw new RangeError("Line ending must be lf, crlf, or cr.");
}

interface ParsedLines {
  lines: string[];
  ending: string;
  trailingBreak: boolean;
}

function parseLines(value: string): ParsedLines {
  assertText(value);
  const firstCrLf = value.indexOf("\r\n");
  const firstLf = value.indexOf("\n");
  const firstCr = value.indexOf("\r");
  let ending = "\n";
  if (firstCrLf >= 0 && (firstLf < 0 || firstCrLf <= firstLf)) ending = "\r\n";
  else if (firstCr >= 0 && (firstLf < 0 || firstCr < firstLf)) ending = "\r";
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return { lines: [], ending, trailingBreak: false };
  const trailingBreak = normalized.endsWith("\n");
  const body = trailingBreak ? normalized.slice(0, -1) : normalized;
  return { lines: body ? body.split("\n") : [""], ending, trailingBreak };
}

function renderLines(lines: string[], parsed: ParsedLines, ending = parsed.ending): string {
  const rendered = lines.join(ending);
  return parsed.trailingBreak && lines.length > 0 ? rendered + ending : rendered;
}

function firstCharacterUpper(value: string, locale?: string): string {
  const characters = Array.from(value);
  if (!characters.length) return value;
  return characters[0].toLocaleUpperCase(locale) + characters.slice(1).join("");
}

function firstCharacterLower(value: string, locale?: string): string {
  const characters = Array.from(value);
  if (!characters.length) return value;
  return characters[0].toLocaleLowerCase(locale) + characters.slice(1).join("");
}

function wordsOf(value: string): string[] {
  return (value
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
    .match(/[\p{L}\p{N}]+/gu) ?? []);
}

/** Convert text to one of the supported casing styles. */
export function convertCase(value: string, style: TextCase, options: CaseOptions = {}): string {
  assertText(value);
  const locale = options.locale;
  if (style === "upper") return value.toLocaleUpperCase(locale);
  if (style === "lower") return value.toLocaleLowerCase(locale);
  if (style === "title") {
    return value.toLocaleLowerCase(locale).replace(/(^|[\s\-_\/.])([\p{L}\p{N}])/gu, (_, separator: string, character: string) => `${separator}${character.toLocaleUpperCase(locale)}`);
  }
  if (style === "sentence") {
    const lower = value.toLocaleLowerCase(locale);
    return lower.replace(/(^|[.!?…。！？]\s+)(\s*)([\p{L}\p{N}])/gu, (_, boundary: string, whitespace: string, character: string) => `${boundary}${whitespace}${character.toLocaleUpperCase(locale)}`);
  }
  const words = wordsOf(value).map((word) => word.toLocaleLowerCase(locale));
  if (style === "camel") return words.map((word, index) => index === 0 ? word : firstCharacterUpper(word, locale)).join("");
  if (style === "pascal") return words.map((word) => firstCharacterUpper(word, locale)).join("");
  if (style === "snake") return words.join("_");
  if (style === "kebab") return words.join("-");
  if (style === "constant") return words.map((word) => word.toLocaleUpperCase(locale)).join("_");
  throw new Error(`Unsupported case style: ${String(style)}.`);
}

export const toUpperCase = (value: string, options?: CaseOptions): string => convertCase(value, "upper", options);
export const toLowerCase = (value: string, options?: CaseOptions): string => convertCase(value, "lower", options);
export const toTitleCase = (value: string, options?: CaseOptions): string => convertCase(value, "title", options);
export const toSentenceCase = (value: string, options?: CaseOptions): string => convertCase(value, "sentence", options);
export const toCamelCase = (value: string, options?: CaseOptions): string => convertCase(value, "camel", options);
export const toPascalCase = (value: string, options?: CaseOptions): string => convertCase(value, "pascal", options);
export const toSnakeCase = (value: string, options?: CaseOptions): string => convertCase(value, "snake", options);
export const toKebabCase = (value: string, options?: CaseOptions): string => convertCase(value, "kebab", options);
export const toConstantCase = (value: string, options?: CaseOptions): string => convertCase(value, "constant", options);
export const upperCase = toUpperCase;
export const lowerCase = toLowerCase;
export const titleCase = toTitleCase;
export const sentenceCase = toSentenceCase;
export const camelCase = toCamelCase;
export const pascalCase = toPascalCase;
export const snakeCase = toSnakeCase;
export const kebabCase = toKebabCase;
export const constantCase = toConstantCase;

function lineKey(line: string, options: LineOptions): string {
  const compared = options.trimForComparison ? line.trim() : line;
  return options.caseSensitive === false ? compared.toLocaleLowerCase() : compared;
}

/** Remove repeated lines while retaining the first occurrence and its formatting. */
export function dedupeLines(value: string, options: LineOptions = {}): string {
  const parsed = parseLines(value);
  const seen = new Set<string>();
  const lines = parsed.lines.filter((line) => {
    const key = lineKey(line, options);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return renderLines(lines, parsed);
}

export const removeDuplicateLines = dedupeLines;
export const removeDuplicates = dedupeLines;

/** Remove repeated whitespace-delimited words, retaining the first spelling. */
export function dedupeWords(value: string, caseSensitive = true): string {
  assertText(value);
  const seen = new Set<string>();
  return value.split(/(\s+)/u).map((part) => {
    if (/^\s+$/u.test(part) || !part) return part;
    const key = caseSensitive ? part : part.toLocaleLowerCase();
    if (seen.has(key)) return "";
    seen.add(key);
    return part;
  }).join("").replace(/\s{2,}/gu, " ").trim();
}

export const removeDuplicateWords = dedupeWords;

/** Sort lines with stable, locale-aware comparison. */
export function sortLines(value: string, options: SortLinesOptions = {}): string {
  const parsed = parseLines(value);
  const collator = new Intl.Collator(options.locale, {
    numeric: options.numeric ?? false,
    sensitivity: options.caseSensitive === false ? "base" : "variant",
  });
  const indexed = parsed.lines.map((line, index) => ({ line, index }));
  indexed.sort((left, right) => {
    const a = options.trimForComparison ? left.line.trim() : left.line;
    const b = options.trimForComparison ? right.line.trim() : right.line;
    const result = collator.compare(a, b);
    return (options.order === "descending" ? -result : result) || left.index - right.index;
  });
  return renderLines(indexed.map(({ line }) => line), parsed);
}

export const sortText = sortLines;

export function reverseLines(value: string): string {
  const parsed = parseLines(value);
  return renderLines([...parsed.lines].reverse(), parsed);
}

export function reverseText(value: string): string {
  assertText(value);
  return Array.from(value).reverse().join("");
}

/** Clean horizontal whitespace without destroying meaningful line breaks. */
export function cleanWhitespace(value: string, options: WhitespaceOptions = {}): string {
  const parsed = parseLines(value);
  const collapse = options.collapse ?? true;
  const trimLines = options.trimLines ?? true;
  let lines = parsed.lines.map((line) => {
    let result = line;
    if (collapse) result = result.replace(/[\t ]+/gu, " ");
    return trimLines ? result.trim() : result;
  });
  let result = renderLines(lines, parsed, options.lineEnding ? lineEndingValue(options.lineEnding) : "\n");
  if (options.trimText ?? true) result = result.trim();
  return result;
}

export const normalizeWhitespace = cleanWhitespace;

export function removeEmptyLines(value: string, trim = true): string {
  const parsed = parseLines(value);
  const lines = parsed.lines.filter((line) => trim ? line.trim().length > 0 : line.length > 0);
  return renderLines(lines, parsed);
}

export const stripEmptyLines = removeEmptyLines;

function mapLines(value: string, mapper: (line: string) => string, options: PrefixSuffixOptions): string {
  const parsed = parseLines(value);
  const lines = parsed.lines.map((line) => options.skipEmpty && line.trim() === "" ? line : mapper(line));
  return renderLines(lines, parsed);
}

export function addPrefix(value: string, prefix: string, options: PrefixSuffixOptions = {}): string {
  assertText(value);
  assertText(prefix, "prefix");
  return mapLines(value, (line) => prefix + line, options);
}

export function addSuffix(value: string, suffix: string, options: PrefixSuffixOptions = {}): string {
  assertText(value);
  assertText(suffix, "suffix");
  return mapLines(value, (line) => line + suffix, options);
}

export const prefixLines = addPrefix;
export const suffixLines = addSuffix;

function validateFlags(flags: string): string {
  if (typeof flags !== "string" || [...flags].some((flag) => !"dgimsuvy".includes(flag)) || new Set(flags).size !== flags.length) {
    throw new Error("Regular-expression flags must be unique and use only d, g, i, m, s, u, v, or y.");
  }
  return flags;
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}

function makeSearchRegex(search: string | RegExp, options: ReplaceOptions, global: boolean): RegExp {
  if (search instanceof RegExp) {
    const requested = validateFlags(search.flags);
    const withoutGlobal = requested.replace(/g/gu, "");
    const flags = global ? (requested.includes("g") ? requested : requested + "g") : withoutGlobal;
    try { return new RegExp(search.source, flags); } catch (error) { throw new Error(error instanceof Error ? error.message : "Invalid regular expression."); }
  }
  assertText(search, "search");
  const source = options.regex ? search : escapeRegex(search);
  let flags = options.regex ? validateFlags(options.flags ?? "") : options.caseSensitive === false ? "i" : "";
  if (global && !flags.includes("g")) flags += "g";
  if (!global) flags = flags.replace(/g/gu, "");
  try { return new RegExp(source, flags); } catch (error) { throw new Error(error instanceof Error ? error.message : "Invalid regular expression."); }
}

function matchLimit(value: number | undefined): number {
  return assertBoundedInteger(value ?? MAX_MATCHES, "maxMatches", 1, MAX_MATCHES);
}

function collectMatches(value: string, regex: RegExp, limit: number): { matches: TextMatch[]; total: number; truncated: boolean } {
  const matches: TextMatch[] = [];
  let total = 0;
  const scanner = new RegExp(regex.source, regex.flags);
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(value)) !== null) {
    total += 1;
    if (matches.length < limit) matches.push({ match: match[0], index: match.index, end: match.index + match[0].length });
    if (!regex.flags.includes("g")) break;
    if (match[0] === "") scanner.lastIndex += 1;
  }
  return { matches, total, truncated: total > matches.length };
}

export function findMatches(value: string, search: string | RegExp, options: ReplaceOptions = {}): TextMatch[] {
  assertText(value);
  const limit = matchLimit(options.maxMatches);
  const regex = makeSearchRegex(search, options, true);
  return collectMatches(value, regex, limit).matches;
}

export function findText(value: string, search: string | RegExp, options: ReplaceOptions = {}): FindResult {
  assertText(value);
  const limit = matchLimit(options.maxMatches);
  const regex = makeSearchRegex(search, options, true);
  const result = collectMatches(value, regex, limit);
  return { matches: result.matches, count: result.total, truncated: result.truncated };
}

/** Replace text and return both the replacement and a match count. */
export function findAndReplace(value: string, search: string | RegExp, replacement: string, options: ReplaceOptions = {}): ReplaceResult {
  assertText(value);
  assertText(replacement, "replacement");
  const replaceAll = options.replaceAll ?? true;
  const limit = matchLimit(options.maxMatches);
  const scanRegex = makeSearchRegex(search, options, replaceAll);
  const found = collectMatches(value, scanRegex, limit);
  if (found.total > limit) throw new RangeError(`Replacement would affect more than ${limit.toLocaleString()} matches.`);
  if (value.length + found.total * replacement.length > MAX_TEXT_LENGTH) throw new RangeError(`Replacement output must be at most ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
  const replaceRegex = makeSearchRegex(search, options, replaceAll);
  const text = value.replace(replaceRegex, replacement);
  return { text, matches: found.matches, count: found.total, truncated: false };
}

/** String-only replacement adapter for text-area consumers. */
export function replaceText(value: string, search: string | RegExp, replacement: string, options: ReplaceOptions = {}): string {
  return findAndReplace(value, search, replacement, options).text;
}

export const findReplace = findAndReplace;
export const replaceWithCount = findAndReplace;

interface DiffOperation {
  type: "equal" | "addition" | "deletion";
  text: string;
}

function diffOperations(left: string[], right: string[]): DiffOperation[] {
  if (left.length > MAX_DIFF_LINES || right.length > MAX_DIFF_LINES) throw new RangeError(`Text diff supports at most ${MAX_DIFF_LINES.toLocaleString()} lines per side.`);
  if (left.length * right.length > MAX_DIFF_CELLS) throw new RangeError("Text diff inputs are too large to compare safely; reduce the number of lines.");
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const operations: DiffOperation[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { operations.push({ type: "equal", text: left[i] }); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) { operations.push({ type: "deletion", text: left[i] }); i += 1; }
    else { operations.push({ type: "addition", text: right[j] }); j += 1; }
  }
  while (i < left.length) operations.push({ type: "deletion", text: left[i++] });
  while (j < right.length) operations.push({ type: "addition", text: right[j++] });
  return operations;
}

function buildUnified(operations: DiffOperation[]): { lines: UnifiedDiffLine[]; text: string; added: number; removed: number } {
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;
  const lines = operations.map((operation): UnifiedDiffLine => {
    if (operation.type === "equal") return { type: "context", text: operation.text, oldLine: oldLine++, newLine: newLine++ };
    if (operation.type === "deletion") { removed += 1; return { type: "deletion", text: operation.text, oldLine: oldLine++, newLine: null }; }
    added += 1;
    return { type: "addition", text: operation.text, oldLine: null, newLine: newLine++ };
  });
  const text = ["--- left", "+++ right", ...lines.map((line) => `${line.type === "context" ? " " : line.type === "deletion" ? "-" : "+"}${line.text}`)].join("\n");
  return { lines, text, added, removed };
}

function buildSideBySide(operations: DiffOperation[]): SideBySideDiffRow[] {
  const rows: SideBySideDiffRow[] = [];
  let leftLine = 1;
  let rightLine = 1;
  for (let i = 0; i < operations.length; i += 1) {
    const operation = operations[i];
    if (operation.type === "equal") {
      rows.push({ type: "equal", left: { line: leftLine++, text: operation.text }, right: { line: rightLine++, text: operation.text } });
      continue;
    }
    const deleted: string[] = [];
    const added: string[] = [];
    while (i < operations.length && operations[i].type !== "equal") {
      if (operations[i].type === "deletion") deleted.push(operations[i].text);
      else added.push(operations[i].text);
      i += 1;
    }
    i -= 1;
    const width = Math.max(deleted.length, added.length);
    for (let offset = 0; offset < width; offset += 1) {
      const left = deleted[offset];
      const right = added[offset];
      rows.push({
        type: left !== undefined && right !== undefined ? "changed" : left !== undefined ? "removed" : "added",
        left: left === undefined ? null : { line: leftLine++, text: left },
        right: right === undefined ? null : { line: rightLine++, text: right },
      });
    }
  }
  return rows;
}

/** Compare text line-by-line and expose render-ready unified and side-by-side data. */
export function textDiff(left: string, right: string): TextDiffResult {
  const leftParsed = parseLines(left);
  const rightParsed = parseLines(right);
  const operations = diffOperations(leftParsed.lines, rightParsed.lines);
  const unified = buildUnified(operations);
  const sideBySide = buildSideBySide(operations);
  return {
    changed: unified.added > 0 || unified.removed > 0,
    added: unified.added,
    removed: unified.removed,
    unified: unified.text,
    unifiedLines: unified.lines,
    sideBySide,
    unifiedData: unified.lines,
    sideBySideData: sideBySide,
  };
}

/** Return the unified diff text for simple text-area consumers. */
export function diffText(left: string, right: string): string {
  return textDiff(left, right).unified;
}

export const diffTextData = textDiff;

/** Make a URL-friendly slug while retaining letters from non-Latin scripts. */
export function slugify(value: string, separator = "-"): string {
  assertText(value);
  assertText(separator, "separator");
  if (!separator || separator.length > 16 || /[\p{L}\p{N}]/u.test(separator)) throw new Error("Slug separator must be 1–16 non-alphanumeric characters.");
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, separator).replace(new RegExp(`(?:${escapeRegex(separator)})+`, "g"), separator).replace(new RegExp(`^${escapeRegex(separator)}|${escapeRegex(separator)}$`, "g"), "");
}

export const toSlug = slugify;

function loremWordCount(value: number, name: string): number {
  return assertBoundedInteger(value, name, 1, 5_000);
}

/** Generate deterministic lorem ipsum locally; no network or random source is used. */
export function generateLoremIpsum(input: number | LoremOptions = 50): string {
  const options = typeof input === "number" ? { words: input } : input;
  const paragraphs = options.paragraphs ?? 1;
  const wordsPerParagraph = options.wordsPerParagraph ?? options.words ?? 50;
  loremWordCount(wordsPerParagraph, "wordsPerParagraph");
  assertBoundedInteger(paragraphs, "paragraphs", 1, 100);
  const output: string[] = [];
  for (let paragraph = 0; paragraph < paragraphs; paragraph += 1) {
    const words = Array.from({ length: wordsPerParagraph }, (_, index) => LOREM_WORDS[(paragraph * wordsPerParagraph + index) % LOREM_WORDS.length]);
    words[0] = firstCharacterUpper(words[0]);
    output.push(`${words.join(" ")}.`);
  }
  const result = output.join("\n\n");
  assertText(result, "generated lorem ipsum");
  return result;
}

export const loremIpsum = generateLoremIpsum;

function cryptoObject(): Crypto {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure browser randomness is unavailable; enable Web Crypto in this browser.");
  return globalThis.crypto;
}

function randomBytes(length: number): Uint8Array {
  assertBoundedInteger(length, "random byte length", 0, MAX_GENERATED_LENGTH);
  const bytes = new Uint8Array(length);
  const crypto = cryptoObject();
  for (let offset = 0; offset < length; offset += 65_536) crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65_536, length)));
  return bytes;
}

function randomIndex(length: number): number {
  if (!Number.isInteger(length) || length < 1) throw new RangeError("Random choice requires a non-empty collection.");
  if (length <= 256) {
    const limit = 256 - (256 % length);
    while (true) {
      const byte = randomBytes(1)[0];
      if (byte < limit) return byte % length;
    }
  }
  if (length > 0x1_0000_0000) throw new RangeError("Random choice collection is too large.");
  const limit = Math.floor(0x1_0000_0000 / length) * length;
  while (true) {
    const bytes = randomBytes(4);
    const value = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
    if (value < limit) return value % length;
  }
}

/** Generate a random character string using unbiased Web Crypto sampling. */
export function generateRandomText(length = 32, options: RandomTextOptions = {}): string {
  assertBoundedInteger(length, "length", 0, MAX_GENERATED_LENGTH);
  const alphabet = Array.from(options.alphabet ?? DEFAULT_RANDOM_ALPHABET);
  if (!alphabet.length) throw new RangeError("Random text alphabet must not be empty.");
  if (alphabet.length > 256) throw new RangeError("Random text alphabet must contain at most 256 characters.");
  const limit = 256 - (256 % alphabet.length);
  const output: string[] = [];
  while (output.length < length) {
    for (const byte of randomBytes(Math.max(16, Math.min(65_536, (length - output.length) * 2)))) {
      if (byte < limit) output.push(alphabet[byte % alphabet.length]);
      if (output.length === length) break;
    }
  }
  return output.join("");
}

export const randomText = generateRandomText;

function extract(value: string, pattern: RegExp, limit = MAX_MATCHES): string[] {
  assertText(value);
  const boundedLimit = assertBoundedInteger(limit, "limit", 1, MAX_MATCHES);
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  const result: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null && result.length < boundedLimit) {
    result.push(match[0]);
    if (match[0] === "") regex.lastIndex += 1;
  }
  return result;
}

function trimUrl(value: string): string {
  return value.replace(/[.,!?;:]+$/u, "").replace(/[\])}]+$/u, (suffix) => suffix.slice(0, Math.max(0, suffix.length - 1)));
}

export function extractUrls(value: string, limit = MAX_MATCHES): string[] {
  return extract(value, /(?:https?:\/\/|www\.)[^\s<>"']+/giu, limit).map(trimUrl);
}

export function extractEmails(value: string, limit = MAX_MATCHES): string[] {
  return extract(value, /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/giu, limit);
}

export function extractNumbers(value: string, limit = MAX_MATCHES): string[] {
  return extract(value, /[-+]?(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?(?:[eE][-+]?\d+)?%?/gu, limit);
}

function regexForLines(pattern: string | RegExp, flags = ""): RegExp {
  if (pattern instanceof RegExp) {
    try { return new RegExp(pattern.source, validateFlags(pattern.flags.replace(/[gy]/gu, ""))); } catch (error) { throw new Error(error instanceof Error ? error.message : "Invalid regular expression."); }
  }
  assertText(pattern, "pattern");
  try { return new RegExp(pattern, validateFlags(flags.replace(/[gy]/gu, ""))); } catch (error) { throw new Error(error instanceof Error ? error.message : "Invalid regular expression."); }
}

/** Return whole lines that match a regular expression. */
export function extractLinesByRegex(value: string, pattern: string | RegExp, flags = ""): string[] {
  const parsed = parseLines(value);
  const regex = regexForLines(pattern, flags);
  return parsed.lines.filter((line) => {
    regex.lastIndex = 0;
    return regex.test(line);
  });
}

export const extractRegexLines = extractLinesByRegex;
export const extractMatchingLines = extractLinesByRegex;

/** Shuffle lines in place conceptually, using a cryptographically secure Fisher-Yates draw. */
export function shuffleLines(value: string): string {
  const parsed = parseLines(value);
  const lines = [...parsed.lines];
  for (let index = lines.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [lines[index], lines[swap]] = [lines[swap], lines[index]];
  }
  return renderLines(lines, parsed);
}

export function normalizeText(value: string, form: NormalizationForm = "NFC"): string {
  assertText(value);
  const forms: readonly NormalizationForm[] = ["NFC", "NFD", "NFKC", "NFKD"];
  if (!forms.includes(form)) throw new Error("Normalization form must be NFC, NFD, NFKC, or NFKD.");
  return value.normalize(form);
}

export const normalizeUnicode = normalizeText;

export function tabsToSpaces(value: string, tabSize = 4): string {
  assertText(value);
  assertBoundedInteger(tabSize, "tabSize", 1, 16);
  return value.replace(/\t/gu, " ".repeat(tabSize));
}

export function spacesToTabs(value: string, tabSize = 4): string {
  assertText(value);
  assertBoundedInteger(tabSize, "tabSize", 1, 16);
  const spaces = new RegExp(` {${tabSize}}`, "g");
  return value.replace(spaces, "\t");
}

export function convertTabsAndSpaces(value: string, direction: "tabs-to-spaces" | "spaces-to-tabs", tabSize = 4): string {
  return direction === "tabs-to-spaces" ? tabsToSpaces(value, tabSize) : direction === "spaces-to-tabs" ? spacesToTabs(value, tabSize) : (() => { throw new Error("Direction must be tabs-to-spaces or spaces-to-tabs."); })();
}

export function detectLineEnding(value: string): DetectedLineEnding {
  assertText(value);
  const hasCrLf = /\r\n/u.test(value);
  const withoutCrLf = value.replace(/\r\n/g, "");
  const hasLf = /\n/u.test(withoutCrLf);
  const hasCr = /\r/u.test(withoutCrLf);
  const kinds = Number(hasCrLf) + Number(hasLf) + Number(hasCr);
  if (kinds === 0) return "none";
  if (kinds > 1) return "mixed";
  return hasCrLf ? "crlf" : hasLf ? "lf" : "cr";
}

export function normalizeLineEndings(value: string, ending: LineEnding = "lf"): string {
  assertText(value);
  return value.replace(/\r\n|\r|\n/g, lineEndingValue(ending));
}

export const convertLineEndings = normalizeLineEndings;

export function hasBom(value: string): boolean {
  assertText(value);
  return value.startsWith("\uFEFF");
}

export const detectBom = hasBom;

export function inspectBom(value: string): BomInfo {
  return { present: hasBom(value), encoding: hasBom(value) ? "utf-8" : "none" };
}

export function removeBom(value: string): string {
  assertText(value);
  return value.startsWith("\uFEFF") ? value.slice(1) : value;
}

export const stripBom = removeBom;

function sentenceParts(value: string): string[] {
  return value.match(/[^.!?…。！？]+(?:[.!?…。！？]+|$)/gu)?.map((part) => part.trim()).filter(Boolean) ?? [];
}

function paragraphParts(value: string): string[] {
  return value.replace(/\r\n?/g, "\n").split(/\n\s*\n+/u).map((part) => part.trim()).filter(Boolean);
}

export function countSentences(value: string): number {
  assertText(value);
  return sentenceParts(value).length;
}

export function countParagraphs(value: string): number {
  assertText(value);
  return paragraphParts(value).length;
}

export function countCharactersNoSpaces(value: string): number {
  assertText(value);
  return Array.from(value).filter((character) => !/\s/u.test(character)).length;
}

export function countText(value: string): TextCounts {
  assertText(value);
  const words = value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
  return {
    characters: Array.from(value).length,
    charactersNoSpaces: countCharactersNoSpaces(value),
    words: words.length,
    sentences: countSentences(value),
    paragraphs: countParagraphs(value),
    lines: value ? value.split(/\r\n|\r|\n/u).length : 0,
  };
}

/*
 * Small string-returning adapters used by the existing Text Station workbench.
 * The lower-level functions above keep structured data where callers need it;
 * these adapters keep the workbench's output contract as plain text.
 */

export function convertTextCase(value: string, style: TextCase | "alternating"): string {
  if (style !== "alternating") return convertCase(value, style);
  assertText(value);
  let letterIndex = 0;
  return Array.from(value, (character) => {
    if (!/[\p{L}]/u.test(character)) return character;
    const result = letterIndex % 2 === 0 ? character.toLocaleLowerCase() : character.toLocaleUpperCase();
    letterIndex += 1;
    return result;
  }).join("");
}

export interface PrefixSuffixTextOptions extends PrefixSuffixOptions {
  eachLine?: boolean;
}

export function prefixSuffixText(value: string, prefix = "", suffix = "", options: PrefixSuffixTextOptions = {}): string {
  assertText(value);
  assertText(prefix, "prefix");
  assertText(suffix, "suffix");
  if (options.eachLine === false) return prefix + value + suffix;
  return addSuffix(addPrefix(value, prefix, options), suffix, options);
}

export interface TransformTextLinesOptions {
  descending?: boolean;
  query?: string;
  separator?: string;
  startNumber?: number;
}

export function transformTextLines(value: string, operation: TextLineOperation, options: TransformTextLinesOptions = {}): string {
  assertText(value);
  if (operation === "sort") return sortLines(value, { order: options.descending ? "descending" : "ascending" });
  if (operation === "reverse") return reverseLines(value);
  if (operation === "deduplicate") return dedupeLines(value);
  if (operation === "remove-empty") return removeEmptyLines(value);
  const parsed = parseLines(value);
  if (operation === "trim") return renderLines(parsed.lines.map((line) => line.trim()), parsed);
  if (operation === "filter") {
    const query = options.query ?? "";
    assertText(query, "query");
    return renderLines(parsed.lines.filter((line) => line.includes(query)), parsed);
  }
  if (operation === "join") {
    const separator = options.separator ?? ", ";
    assertText(separator, "separator");
    return parsed.lines.join(separator);
  }
  if (operation === "number") {
    const start = options.startNumber ?? 1;
    assertBoundedInteger(start, "startNumber", 0, 1_000_000);
    return renderLines(parsed.lines.map((line, index) => `${start + index}. ${line}`), parsed);
  }
  throw new Error(`Unsupported line operation: ${String(operation)}.`);
}

function generateUuidText(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface GenerateTextOptions {
  source?: string;
  length?: number;
  count?: number;
  separator?: string;
}

export function generateText(kind: TextGeneratorKind, options: GenerateTextOptions = {}): string {
  const count = options.count ?? 1;
  assertBoundedInteger(count, "count", 1, 1_000);
  const separator = options.separator ?? "\n";
  assertText(separator, "separator");
  if (kind === "random") {
    const length = options.length ?? 32;
    return Array.from({ length: count }, () => generateRandomText(length)).join(separator);
  }
  if (kind === "lorem") {
    const wordsPerParagraph = options.length ?? 32;
    return generateLoremIpsum({ paragraphs: count, wordsPerParagraph });
  }
  if (kind === "repeat") {
    const source = options.source ?? "";
    assertText(source, "source");
    return Array.from({ length: count }, () => source).join(separator);
  }
  if (kind === "uuid") return Array.from({ length: count }, generateUuidText).join(separator);
  if (kind === "slug") return slugify(options.source ?? "");
  throw new Error(`Unsupported generator kind: ${String(kind)}.`);
}

export interface ExtractTextOptions {
  unique?: boolean;
}

function uniqueValues(values: string[], unique: boolean): string[] {
  return unique ? [...new Set(values)] : values;
}

export function extractText(value: string, kind: TextExtractorKind, options: ExtractTextOptions = {}): string {
  assertText(value);
  let values: string[];
  if (kind === "emails") values = extractEmails(value);
  else if (kind === "urls") values = extractUrls(value);
  else if (kind === "numbers") values = extractNumbers(value);
  else if (kind === "hashtags") values = value.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  else if (kind === "mentions") values = value.match(/@[\p{L}\p{N}_-]+/gu) ?? [];
  else if (kind === "quoted") values = [...value.matchAll(/["“”']([^"“”']+)["“”']/gu)].map((match) => match[1]);
  else if (kind === "words") values = value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
  else if (kind === "lines") values = parseLines(value).lines.filter((line) => line.trim().length > 0);
  else throw new Error(`Unsupported extractor kind: ${String(kind)}.`);
  if (values.length > MAX_MATCHES) throw new RangeError(`Extraction found more than ${MAX_MATCHES.toLocaleString()} matches; narrow the input first.`);
  return uniqueValues(values.slice(0, MAX_MATCHES), options.unique ?? false).join("\n");
}
