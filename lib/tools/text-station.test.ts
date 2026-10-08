import { describe, expect, it, vi } from "vitest";
import {
  addPrefix,
  addSuffix,
  cleanWhitespace,
  convertCase,
  countText,
  dedupeLines,
  detectBom,
  detectLineEnding,
  extractEmails,
  extractLinesByRegex,
  extractNumbers,
  extractUrls,
  findAndReplace,
  generateLoremIpsum,
  generateRandomText,
  normalizeLineEndings,
  normalizeText,
  removeBom,
  removeEmptyLines,
  reverseLines,
  reverseText,
  shuffleLines,
  slugify,
  sortLines,
  spacesToTabs,
  tabsToSpaces,
  textDiff,
  toCamelCase,
  toConstantCase,
} from "./text-station";

describe("Text Station", () => {
  it("supports the requested case conversions", () => {
    expect(convertCase("hello world", "upper")).toBe("HELLO WORLD");
    expect(convertCase("hello WORLD", "lower")).toBe("hello world");
    expect(convertCase("hello-world", "title")).toBe("Hello-World");
    expect(convertCase("hello. world! again", "sentence")).toBe("Hello. World! Again");
    expect(toCamelCase("Hello world_value")).toBe("helloWorldValue");
    expect(convertCase("Hello world", "pascal")).toBe("HelloWorld");
    expect(convertCase("Hello world", "snake")).toBe("hello_world");
    expect(convertCase("Hello world", "kebab")).toBe("hello-world");
    expect(toConstantCase("Hello world")).toBe("HELLO_WORLD");
  });

  it("deduplicates, sorts, reverses, cleans, and decorates lines", () => {
    expect(dedupeLines("b\na\nb\n", { caseSensitive: false })).toBe("b\na\n");
    expect(sortLines("10\n2\n1", { numeric: true })).toBe("1\n2\n10");
    expect(reverseLines("one\ntwo\nthree")).toBe("three\ntwo\none");
    expect(reverseText("a🚀b")).toBe("b🚀a");
    expect(cleanWhitespace("  one\t  two  \n\n three ")).toBe("one two\n\nthree");
    expect(removeEmptyLines("one\n\n  \ntwo")).toBe("one\ntwo");
    expect(addPrefix("a\nb", "> ")).toBe("> a\n> b");
    expect(addSuffix("a\nb", ";")).toBe("a;\nb;");
  });

  it("finds and replaces literal and regular-expression matches with counts", () => {
    expect(findAndReplace("Cat cat", "cat", "dog", { caseSensitive: false })).toMatchObject({ text: "dog dog", count: 2 });
    expect(findAndReplace("a1 b22 c333", "\\d+", "N", { regex: true })).toMatchObject({ text: "aN bN cN", count: 3 });
    expect(findAndReplace("one one", "one", "two", { replaceAll: false }).count).toBe(1);
  });

  it("returns unified and side-by-side diff data", () => {
    const result = textDiff("same\nold", "same\nnew\nadded");
    expect(result.changed).toBe(true);
    expect(result.removed).toBe(1);
    expect(result.added).toBe(2);
    expect(result.unified).toContain("-old");
    expect(result.unified).toContain("+new");
    expect(result.sideBySide.some((row) => row.type === "changed")).toBe(true);
  });

  it("generates local slugs and bounded lorem ipsum", () => {
    expect(slugify(" Déjà vu: A title! ")).toBe("deja-vu-a-title");
    expect(generateLoremIpsum(8).split(/\s+/u)).toHaveLength(8);
    expect(generateLoremIpsum({ paragraphs: 2, wordsPerParagraph: 3 }).split("\n\n")).toHaveLength(2);
  });

  it("uses Web Crypto for random text and line shuffling", () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
      if (array) new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(1);
      return array;
    });
    expect(generateRandomText(12, { alphabet: "ab" })).toHaveLength(12);
    expect(shuffleLines("a\nb\nc")).toBe("a\nc\nb");
    expect(getRandomValues).toHaveBeenCalled();
    getRandomValues.mockRestore();
  });

  it("extracts common values and matching lines", () => {
    const input = "Visit https://example.com/path, email ada@example.com, values -12.5 and 42.";
    expect(extractUrls(input)).toEqual(["https://example.com/path"]);
    expect(extractEmails(input)).toEqual(["ada@example.com"]);
    expect(extractNumbers(input)).toEqual(["-12.5", "42"]);
    expect(extractLinesByRegex("keep: one\ndrop\nkeep: two", "^keep:", "i")).toEqual(["keep: one", "keep: two"]);
  });

  it("normalizes Unicode, tabs, spaces, line endings, and BOMs", () => {
    expect(normalizeText("e\u0301", "NFC")).toBe("é");
    expect(tabsToSpaces("a\tb", 2)).toBe("a  b");
    expect(spacesToTabs("a    b", 4)).toBe("a\tb");
    expect(detectLineEnding("a\r\nb")).toBe("crlf");
    expect(normalizeLineEndings("a\r\nb\rc", "lf")).toBe("a\nb\nc");
    expect(detectBom("\uFEFFtext")).toBe(true);
    expect(removeBom("\uFEFFtext")).toBe("text");
  });

  it("counts sentences, paragraphs, and characters without spaces", () => {
    expect(countText("Hello world.\nThis is a test!\n\n🚀 ok")).toEqual({
      characters: 34,
      charactersNoSpaces: 26,
      words: 7,
      sentences: 3,
      paragraphs: 2,
      lines: 4,
    });
  });
});
