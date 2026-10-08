/** Older engines use code points/Unicode word runs rather than grapheme segmentation. */
export const segmentationAvailable = typeof Intl.Segmenter === "function";

export function graphemes(text: string): Iterable<string> {
  if (!segmentationAvailable) return Array.from(text);
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text);
  return (function* () { for (const segment of segments) yield segment.segment; })();
}

export function characterCount(text: string): number {
  let count = 0;
  for (const _ of graphemes(text)) count++;
  return count;
}

export function wordCount(text: string): number {
  if (!segmentationAvailable) return (text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu) ?? []).length;
  let count = 0;
  for (const word of new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)) {
    if (word.isWordLike) count++;
  }
  return count;
}

export function sentenceCount(text: string): number {
  const hasContent = (value: string) => /[\p{L}\p{N}]/u.test(value);
  if (!segmentationAvailable) return text.split(/[.!?。！？]+(?:\s+|$)/u).filter(hasContent).length;
  let count = 0;
  for (const sentence of new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text)) {
    if (hasContent(sentence.segment)) count++;
  }
  return count;
}

export function paragraphCount(text: string): number {
  return text.replace(/\r\n|\r/g, "\n").split(/\n[^\S\n]*\n(?:[^\S\n]*\n)*/u)
    .filter((paragraph) => /\S/u.test(paragraph)).length;
}

function initialUpper(text: string): string {
  return text.replace(/[\p{L}\p{N}]/u, (character) => character.toUpperCase());
}

/** Readable styles preserve punctuation. Identifier styles remove only whitespace, _ and -. */
export function convertCase(text: string, style: string): string {
  switch (style) {
    case "UPPERCASE": return text.toUpperCase();
    case "lowercase": return text.toLowerCase();
    case "Title Case": return text.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu, initialUpper);
    case "Sentence case": {
      let atStart = true;
      return Array.from(text.toLowerCase(), (character) => {
        if (/[.!?。！？]/u.test(character)) atStart = true;
        if (atStart && /[\p{L}\p{N}]/u.test(character)) {
          atStart = false;
          return character.toUpperCase();
        }
        return character;
      }).join("");
    }
  }
  if (!["camelCase", "PascalCase", "snake_case", "kebab-case", "CONSTANT_CASE"].includes(style)) {
    throw new Error("Choose a supported case style.");
  }
  // Keep combining marks attached to the letter preceding each case boundary.
  const words = text.replace(/(\p{Lu}\p{M}*)(\p{Lu}\p{M}*\p{Ll})/gu, "$1 $2")
    .replace(/([\p{Ll}\p{N}]\p{M}*)(\p{Lu})/gu, "$1 $2")
    .split(/[\s_-]+/u).filter(Boolean).map((word) => word.toLowerCase());
  switch (style) {
    case "camelCase": return words.map((word, index) => index ? initialUpper(word) : word).join("");
    case "PascalCase": return words.map(initialUpper).join("");
    case "snake_case": return words.join("_");
    case "kebab-case": return words.join("-");
    default: return words.join("_").toUpperCase();
  }
}

/** Unicode slugs retain non-Latin letters and their marks; Latin accent marks are folded. */
export function slugify(text: string): string {
  return text.normalize("NFKD").replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, "-").replace(/^-+|-+$/g, "");
}
