import { describe, expect, it } from "vitest";
import { PageRangeError, formatPageRange, parsePageRange } from "./page-range";
import { assemblePageText, buildTextDownload } from "./text";
import { buildOutputName, sanitizeFileStem } from "./filenames";
import { moveItem, orderMap, removeItems } from "./reorder";

describe("parsePageRange", () => {
  it("parses lists, closed ranges and surrounding whitespace into zero-based indexes", () => {
    expect(parsePageRange("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
    expect(parsePageRange(" 1 - 2 , 4 ", 10)).toEqual([0, 1, 3]);
    expect(parsePageRange("7", 7)).toEqual([6]);
  });

  it("treats all, ALL and an empty value as the whole document", () => {
    expect(parsePageRange("all", 3)).toEqual([0, 1, 2]);
    expect(parsePageRange("  ALL ", 3)).toEqual([0, 1, 2]);
    expect(parsePageRange("", 3)).toEqual([0, 1, 2]);
    expect(parsePageRange("   ", 0)).toEqual([]);
  });

  it("supports open-ended ranges", () => {
    expect(parsePageRange("-3", 10)).toEqual([0, 1, 2]);
    expect(parsePageRange("4-", 6)).toEqual([3, 4, 5]);
    expect(parsePageRange("3-", 3)).toEqual([2]);
  });

  it("de-duplicates and sorts selections", () => {
    expect(parsePageRange("2,1-2,2", 5)).toEqual([0, 1]);
    expect(parsePageRange("5,1,3", 5)).toEqual([0, 2, 4]);
  });

  it("rejects reversed ranges", () => {
    expect(() => parsePageRange("5-2", 10)).toThrow(PageRangeError);
    expect(() => parsePageRange("5-2", 10)).toThrow(/reversed/);
  });

  it("rejects pages outside the document", () => {
    expect(() => parsePageRange("0", 5)).toThrow(/outside this document \(1-5\)/);
    expect(() => parsePageRange("6", 5)).toThrow(/outside this document/);
    expect(() => parsePageRange("4-", 3)).toThrow(/outside this document/);
    expect(() => parsePageRange("-6", 5)).toThrow(/outside this document/);
  });

  it("rejects malformed input and ambiguous all", () => {
    expect(() => parsePageRange("1--3", 5)).toThrow(/not a valid page number or range/);
    expect(() => parsePageRange("abc", 5)).toThrow(/not a valid page number or range/);
    expect(() => parsePageRange("1;2", 5)).toThrow(/not a valid page number or range/);
    expect(() => parsePageRange("1,,2", 5)).toThrow(/empty items/);
    expect(() => parsePageRange("all,2", 5)).toThrow(/by itself/);
  });
});

describe("formatPageRange", () => {
  it("compacts consecutive page indexes", () => {
    expect(formatPageRange([0, 1, 2, 4])).toBe("1-3, 5");
    expect(formatPageRange([2])).toBe("3");
    expect(formatPageRange([1, 1, 2])).toBe("2-3");
    expect(formatPageRange([])).toBe("");
  });
});

describe("assemblePageText", () => {
  it("honors line breaks, paragraph gaps and repeated spaces", () => {
    const text = assemblePageText([
      { str: "Hello    wide   world", transform: [1, 0, 0, 1, 10, 700], height: 12, hasEOL: true },
      { str: "second line", transform: [1, 0, 0, 1, 10, 688], height: 12, hasEOL: false },
      { str: "Next paragraph", transform: [1, 0, 0, 1, 10, 640], height: 12, hasEOL: false },
    ]);
    expect(text).toBe("Hello wide world\nsecond line\n\nNext paragraph");
  });

  it("joins only conservative lowercase hyphenation across a line break", () => {
    expect(
      assemblePageText([
        { str: "inter-", transform: [1, 0, 0, 1, 10, 700], height: 12, hasEOL: true },
        { str: "national", transform: [1, 0, 0, 1, 10, 688], height: 12, hasEOL: true },
        { str: "Agreement", transform: [1, 0, 0, 1, 10, 676], height: 12 },
      ]),
    ).toBe("international\nAgreement");

    expect(
      assemblePageText([
        { str: "COVID-", transform: [1, 0, 0, 1, 10, 700], height: 12, hasEOL: true },
        { str: "19 relief", transform: [1, 0, 0, 1, 10, 688], height: 12 },
      ]),
    ).toBe("COVID-\n19 relief");
  });

  it("ignores marked-content entries and trims trailing whitespace", () => {
    expect(
      assemblePageText([
        { type: "beginMarkedContent" },
        { str: "Only text  ", transform: [1, 0, 0, 1, 10, 700], height: 12, hasEOL: true },
        { type: "endMarkedContent" },
        { str: "", transform: [1, 0, 0, 1, 10, 688], height: 12, hasEOL: true },
      ]),
    ).toBe("Only text");
    expect(assemblePageText([])).toBe("");
  });
});

describe("buildTextDownload", () => {
  it("adds page separators and a trailing newline", () => {
    expect(
      buildTextDownload([
        { pageNumber: 1, text: "First page" },
        { pageNumber: 3, text: "  Third page\n" },
        { pageNumber: 4, text: "" },
      ]),
    ).toBe("--- Page 1 ---\nFirst page\n\n--- Page 3 ---\nThird page\n\n--- Page 4 ---\n\n");
  });

  it("returns an empty string when no pages are selected", () => {
    expect(buildTextDownload([])).toBe("");
  });
});

describe("sanitizeFileStem", () => {
  it("removes paths, extensions and reserved characters", () => {
    expect(sanitizeFileStem("../../Secret Report.pdf")).toBe("Secret Report");
    expect(sanitizeFileStem('a<>:"|?*b.pdf')).toBe("a-b");
    expect(sanitizeFileStem("bad/name\\here.pdf")).toBe("here");
  });

  it("collapses whitespace and leading or trailing punctuation", () => {
    expect(sanitizeFileStem("  ..report   name .pdf")).toBe("report name");
    expect(sanitizeFileStem("Résumé 2024.pdf")).toBe("Résumé 2024");
  });

  it("falls back for empty names and avoids Windows device names", () => {
    expect(sanitizeFileStem(".pdf")).toBe("document");
    expect(sanitizeFileStem("   ")).toBe("document");
    expect(sanitizeFileStem("CON.pdf")).toBe("CON-file");
  });

  it("bounds long names", () => {
    expect(sanitizeFileStem(`${"a".repeat(120)}.pdf`)).toHaveLength(80);
  });
});

describe("buildOutputName", () => {
  it("builds sanitized download and ZIP entry names", () => {
    expect(buildOutputName("../../My Report.pdf", "text", "txt")).toBe("My Report-text.txt");
    expect(buildOutputName("scan.pdf", "pages", ".zip")).toBe("scan-pages.zip");
    expect(buildOutputName("x.pdf", "page 1", "png")).toBe("x-page 1.png");
  });
});

describe("reorder helpers", () => {
  it("moves items without mutating the input", () => {
    const source = ["a", "b", "c", "d"];
    const moved = moveItem(source, 0, 2);
    expect(moved).toEqual(["b", "c", "a", "d"]);
    expect(source).toEqual(["a", "b", "c", "d"]);
    expect(moveItem(source, 3, 3)).toEqual(source);
    expect(moveItem(source, 3, 3)).not.toBe(source);
  });

  it("rejects out-of-range moves", () => {
    expect(() => moveItem(["a"], 1, 0)).toThrow(RangeError);
    expect(() => moveItem(["a"], 0, 4)).toThrow(RangeError);
    expect(() => moveItem(["a"], -1, 0)).toThrow(RangeError);
  });

  it("removes selected indexes and validates them", () => {
    expect(removeItems(["a", "b", "c", "d"], new Set([1, 3]))).toEqual(["a", "c"]);
    expect(removeItems(["a", "b", "c"], [0])).toEqual(["b", "c"]);
    expect(() => removeItems(["a", "b"], [2])).toThrow(RangeError);
  });

  it("describes positions and original one-based pages", () => {
    expect(orderMap([2, 0, 1])).toEqual([
      { position: 1, originalPage: 3 },
      { position: 2, originalPage: 1 },
      { position: 3, originalPage: 2 },
    ]);
    expect(() => orderMap([-1])).toThrow(RangeError);
  });
});
