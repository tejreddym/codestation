import type { TextResult, TextValues } from "./types";
import { assertLineCount, assertOutputSize, HIT_LIMIT, INPUT_LIMIT, positiveInteger, randomIndex, readLines, writeLines } from "./shared";
import { characterCount, convertCase, graphemes, paragraphCount, sentenceCount, slugify, wordCount } from "./unicode";

export { segmentationAvailable } from "./unicode";

const row = (label: string, value: string | number): TextResult["rows"][number] => ({ label, value: String(value) });
const one = (label: string, value: string | number): TextResult => ({ rows: [row(label, value)] });
function stringValue(values: TextValues, key: string, fallback = ""): string {
  if (values[key] === undefined) return fallback;
  if (typeof values[key] !== "string") throw new Error("Text and option values must be strings.");
  return values[key] as string;
}

function choice(values: TextValues, key: string, options: string[], fallback: string): string {
  const value = stringValue(values, key, fallback);
  if (!options.includes(value)) throw new Error(`Choose a supported ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
  return value;
}

function caseSensitive(values: TextValues): boolean {
  return choice(values, "caseSensitivity", ["Case-sensitive", "Case-insensitive"], "Case-sensitive") === "Case-sensitive";
}

function checkInput(values: TextValues): void {
  for (const value of Object.values(values)) {
    if (typeof value !== "string") continue;
    if (value.length > INPUT_LIMIT) throw new Error("Each input must contain at most 1,000,000 characters.");
    assertLineCount(value);
  }
}

function finish(result: TextResult): TextResult {
  assertOutputSize(result.rows.reduce((sum, item) => sum + item.label.length + item.value.length, 0)
    + (result.diff?.reduce((sum, item) => sum + item.kind.length + item.text.length, 0) ?? 0));
  return result;
}

function replaceLiteral(text: string, values: TextValues): TextResult {
  const find = stringValue(values, "find");
  if (!find) throw new Error("Enter non-empty text to find.");
  const replacement = stringValue(values, "replacement");
  const sensitive = caseSensitive(values);
  if (values.replaceAll !== undefined && typeof values.replaceAll !== "boolean") throw new Error("Replace all must be true or false.");
  const all = values.replaceAll === undefined ? true : values.replaceAll === true;
  let pattern: RegExp;
  try {
    pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), `${all ? "g" : ""}${sensitive ? "u" : "iu"}`);
  } catch {
    throw new Error("The literal search could not be prepared. Use a shorter search value.");
  }
  let count = 0;
  let size = text.length;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    count++;
    size += replacement.length - match[0].length;
    assertOutputSize(size);
    if (!all) break;
  }
  // Include the second result and labels in the budget before allocating the replacement.
  assertOutputSize(size + String(count).length + "Updated textReplacement count".length);
  pattern.lastIndex = 0;
  return { rows: [row("Updated text", text.replace(pattern, () => replacement)), row("Replacement count", count)] };
}

const LOREM_WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit voluptate velit esse cillum fugiat nulla pariatur".split(" ");
const PLACEHOLDER_WORDS = "amber birch cedar delta ember fern garden harbor island juniper kite lantern meadow north ocean pebble quartz river stone timber valley willow xenon yellow zephyr".split(" ");
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generate(values: TextValues, random: boolean): TextResult {
  const unit = choice(values, "unit", random ? ["Characters", "Words", "Sentences", "Paragraphs"] : ["Words", "Sentences", "Paragraphs"], random ? "Characters" : "Words");
  const maximum = unit === "Characters" ? 100_000 : unit === "Words" ? 10_000 : unit === "Sentences" ? 1_000 : 100;
  const amount = positiveInteger(stringValue(values, random ? "length" : "amount", random ? "100" : "50"), maximum, random ? "Length" : "Amount");
  const wordsPerUnit = unit === "Words" ? 1 : unit === "Sentences" ? 12 : 36;
  const vocabulary = random ? PLACEHOLDER_WORDS : LOREM_WORDS;
  const maximumWord = Math.max(...vocabulary.map((word) => word.length));
  assertOutputSize(unit === "Characters" ? amount + 100 : amount * wordsPerUnit * (maximumWord + 3) + 100);
  let cursor = 0;
  const word = () => random ? vocabulary[randomIndex(vocabulary.length)] : vocabulary[cursor++ % vocabulary.length];
  const sentence = () => {
    const text = Array.from({ length: 12 }, word).join(" ");
    return text[0].toUpperCase() + text.slice(1) + ".";
  };
  let text: string;
  if (unit === "Characters") text = Array.from({ length: amount }, () => ALPHABET[randomIndex(ALPHABET.length)]).join("");
  else if (unit === "Words") text = Array.from({ length: amount }, word).join(" ");
  else if (unit === "Sentences") text = Array.from({ length: amount }, sentence).join(" ");
  else text = Array.from({ length: amount }, () => Array.from({ length: 3 }, sentence).join(" ")).join("\n\n");
  return { rows: [row(random ? "Generated random text" : "Generated Lorem Ipsum", text), row("Generated count", amount)] };
}

function trimUrl(candidate: string): string {
  const balances: Record<string, number> = { ")": 0, "]": 0, "}": 0 };
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  for (const character of candidate) {
    if (pairs[character]) balances[pairs[character]]--;
    else if (Object.hasOwn(balances, character)) balances[character]++;
  }
  let end = candidate.length;
  while (end) {
    const character = candidate[end - 1];
    if (/[.,!?;:]/.test(character)) end--;
    else if (balances[character] > 0) { balances[character]--; end--; }
    else break;
  }
  return candidate.slice(0, end);
}

function extract(text: string, kind: "url" | "email" | "number"): TextResult {
  if (kind === "email") return extractEmails(text);
  const pattern = kind === "url" ? /https?:\/\/[^\s<>"'`]+/giu
    : /[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g;
  const hits: string[] = [];
  let size = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    let value = match[0];
    if (kind === "url") {
      value = trimUrl(value);
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname) continue;
      } catch { continue; }
    }
    if (hits.length === HIT_LIMIT) throw new Error("Extraction exceeds the 10,000-match limit. Use a smaller input.");
    size += value.length + 1;
    assertOutputSize(size + 100);
    hits.push(value);
  }
  const labels = kind === "url" ? ["Extracted URLs", "URL count"] : ["Extracted numbers", "Number count"];
  return { rows: [row(labels[0], hits.join("\n")), row(labels[1], hits.length)] };
}

function extractEmails(text: string): TextResult {
  const hits: string[] = [];
  const localCharacter = /[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]/;
  const domainCharacter = /[A-Za-z0-9.-]/;
  const localPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
  const domainPattern = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
  // Scan outwards from @ instead of retrying a greedy email regex at every input
  // position. Runs without an @ remain linear, even for very large pasted text.
  for (let at = text.indexOf("@"); at !== -1; at = text.indexOf("@", at + 1)) {
    let start = at;
    let end = at + 1;
    while (start > 0 && localCharacter.test(text[start - 1])) start--;
    while (end < text.length && domainCharacter.test(text[end])) end++;
    while (start < at && text[start] === ".") start++;
    while (end > at + 1 && text[end - 1] === ".") end--;
    if (!localPattern.test(text.slice(start, at)) || !domainPattern.test(text.slice(at + 1, end))) continue;
    if (hits.length === HIT_LIMIT) throw new Error("Extraction exceeds the 10,000-match limit. Use a smaller input.");
    hits.push(text.slice(start, end));
  }
  return { rows: [row("Extracted email addresses", hits.join("\n")), row("Email count", hits.length)] };
}

/** This branch must run inside the disposable worker enforced by the Text client. */
function regexLines(text: string, values: TextValues): TextResult {
  const source = stringValue(values, "pattern");
  const flags = stringValue(values, "flags");
  if (source.length > 16_384) throw new Error("The pattern exceeds the 16,384-character limit.");
  if (!/^[gimsuyd]*$/.test(flags) || new Set(flags).size !== flags.length) throw new Error("Use each supported regex flag at most once: g, i, m, s, u, y, d.");
  let pattern: RegExp;
  try { pattern = new RegExp(source, flags); }
  catch { throw new Error("The regular expression is invalid or uses flags unsupported by this browser."); }
  const lines = readLines(text);
  const matches: string[] = [];
  for (const line of lines.records) {
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      if (matches.length === HIT_LIMIT) throw new Error("Extraction exceeds the 10,000-matching-line limit. Use a smaller input.");
      matches.push(line);
    }
  }
  return { rows: [row("Matching lines", writeLines(lines, matches)), row("Match count", matches.length)] };
}

async function execute(slug: string, values: TextValues): Promise<TextResult> {
  const text = stringValue(values, "text");
  switch (slug) {
    case "text-counter": return { rows: [
      row("Character count", characterCount(text)),
      row("Character count without spaces", characterCount(text.replace(/\s/gu, ""))),
      row("Word count", wordCount(text)),
      row("Line count", readLines(text).records.length),
      row("Sentence count", sentenceCount(text)),
      row("Paragraph count", paragraphCount(text)),
    ] };
    case "sentence-counter": return one("Sentence count", sentenceCount(text));
    case "paragraph-counter": return one("Paragraph count", paragraphCount(text));
    case "character-counter-without-spaces": return one("Character count excluding spaces and whitespace", characterCount(text.replace(/\s/gu, "")));
    case "reverse-text": return one("Reversed text", Array.from(graphemes(text)).reverse().join(""));
    case "case-converter": return one("Transformed text", convertCase(text, stringValue(values, "caseType", "UPPERCASE")));
    case "duplicate-line-remover":
    case "line-deduplicator": {
      const lines = readLines(text);
      const sensitive = caseSensitive(values);
      const seen = new Set<string>();
      const unique = lines.records.filter((line) => {
        const key = sensitive ? line : line.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const value = writeLines(lines, unique);
      return slug === "duplicate-line-remover" ? one("Text with duplicate lines removed", value)
        : { rows: [row("Deduplicated text", value), row("Removed duplicate count", lines.records.length - unique.length)] };
    }
    case "sort-lines": {
      const lines = readLines(text);
      const sensitive = caseSensitive(values);
      const direction = choice(values, "sortOrder", ["A → Z", "Z → A"], "A → Z") === "A → Z" ? 1 : -1;
      const sorted = lines.records.map((line, index) => ({ line, index, key: sensitive ? line : line.toLowerCase() }))
        .sort((a, b) => a.key === b.key ? a.index - b.index : (a.key < b.key ? -1 : 1) * direction).map(({ line }) => line);
      return one("Sorted text", writeLines(lines, sorted));
    }
    case "reverse-lines": {
      const lines = readLines(text);
      return one("Reversed line order", writeLines(lines, lines.records.reverse()));
    }
    case "whitespace-cleaner": {
      const lines = readLines(text);
      return one("Cleaned text", writeLines(lines, lines.records.map((line) => line.replace(/[\t ]+/g, " ").trim())));
    }
    case "empty-line-remover": {
      const lines = readLines(text);
      return one("Text without empty lines", writeLines(lines, lines.records.filter((line) => /\S/u.test(line))));
    }
    case "prefix-suffix-adder": {
      const lines = readLines(text);
      const prefix = stringValue(values, "prefix");
      const suffix = stringValue(values, "suffix");
      const size = lines.records.reduce((sum, line) => sum + line.length + prefix.length + suffix.length, 0)
        + Math.max(0, lines.records.length - 1 + Number(lines.terminal)) * lines.separator.length;
      assertOutputSize(size + "Text with prefix and suffix applied to every line".length);
      return one("Text with prefix and suffix applied to every line", writeLines(lines, lines.records.map((line) => prefix + line + suffix)));
    }
    case "line-shuffler": {
      const lines = readLines(text);
      for (let i = lines.records.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [lines.records[i], lines.records[j]] = [lines.records[j], lines.records[i]];
      }
      return one("Shuffled lines", writeLines(lines));
    }
    case "find-replace": return replaceLiteral(text, values);
    case "text-diff": return (await import("./diff")).diffText(stringValue(values, "textA"), stringValue(values, "textB"));
    case "slug-generator": return one("URL slug", slugify(text));
    case "lorem-ipsum-generator": return generate(values, false);
    case "random-text-generator": return generate(values, true);
    case "url-extractor": return extract(text, "url");
    case "email-extractor": return extract(text, "email");
    case "number-extractor": return extract(text, "number");
    case "regex-line-extractor": return regexLines(text, values);
    case "text-normalizer": return one("Normalized text", text.normalize("NFC").replace(/\r\n|\r/g, "\n"));
    case "tabs-to-spaces":
    case "spaces-to-tabs": {
      const width = positiveInteger(stringValue(values, "width", "4"), 16, "Width");
      if (slug === "tabs-to-spaces") {
        let tabs = 0;
        for (let i = 0; i < text.length; i++) if (text[i] === "\t") tabs++;
        assertOutputSize(text.length + tabs * (width - 1) + "Text with tabs replaced by spaces".length);
        return one("Text with tabs replaced by spaces", text.replace(/\t/g, " ".repeat(width)));
      }
      return one("Text with spaces converted to tabs", text.replace(new RegExp(` {${width}}`, "g"), "\t"));
    }
    case "line-ending-converter":
    case "lf-to-crlf":
    case "crlf-to-lf": {
      const ending = slug === "lf-to-crlf" ? "CRLF" : slug === "crlf-to-lf" ? "LF" : choice(values, "lineEnding", ["LF", "CRLF", "CR"], "LF");
      const separator = ending === "CRLF" ? "\r\n" : ending === "CR" ? "\r" : "\n";
      const result = text.replace(/\r\n|\r|\n/g, separator);
      return one(slug === "lf-to-crlf" ? "Text with CRLF line endings" : slug === "crlf-to-lf" ? "Text with LF line endings" : "Text with normalized line endings", result);
    }
    case "bom-detector": {
      const present = text.startsWith("\uFEFF");
      return { rows: [row("BOM detected status", present ? "Yes" : "No"), row("BOM type", present ? "Unicode U+FEFF; original byte encoding cannot be inferred" : "None")] };
    }
    case "bom-remover": return one("Text without leading BOM", text.startsWith("\uFEFF") ? text.slice(1) : text);
    default: throw new Error("This Text tool is not supported.");
  }
}

/** Browser-local engine. The client owns disposable worker execution and cancellation. */
export async function runText(slug: string, values: TextValues): Promise<TextResult> {
  checkInput(values);
  return finish(await execute(slug, values));
}
