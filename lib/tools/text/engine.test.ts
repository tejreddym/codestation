import { afterEach, describe, expect, it, vi } from "vitest";
import { textTools } from "@/config/text-tools";
import { runText } from "./engine";
import { readLines, randomIndex } from "./shared";
import { characterCount, paragraphCount, sentenceCount, wordCount } from "./unicode";
import type { TextValues } from "./types";
const run = async (slug: string, text: string, options: TextValues = {}) => (await runText(slug, { text, ...options })).rows;
const output = async (slug: string, text: string, options: TextValues = {}) => (await run(slug, text, options))[0].value;
const unicode = "Café e\u0301 తెలుగు हिन्दी 👩‍💻 🇮🇳 中文 العربية";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("literal find, native normalization and BOM", () => {
  it.each([true, false])("replaces literal text and literal dollars, all=%s", async replaceAll => {
    const rows = await run("find-replace", "[a]. [a]. [A].", { find: "[a].", replacement: "$& $1 $$", caseSensitivity: "Case-insensitive", replaceAll });
    expect(rows[0].value).toBe(replaceAll ? "$& $1 $$ $& $1 $$ $& $1 $$" : "$& $1 $$ [a]. [A]."); expect(rows[1].value).toBe(replaceAll ? "3" : "1");
  });
  it("handles empty replacement, nonmatches, case and Unicode index lengths", async () => {
    expect(await output("find-replace", "one one", { find: "one", replacement: "", replaceAll: true })).toBe(" ");
    expect((await run("find-replace", "one", { find: "two", replacement: "x" }))[1].value).toBe("0");
    expect(await output("find-replace", "Cat cat", { find: "cat", replacement: "dog", caseSensitivity: "Case-sensitive" })).toBe("Cat dog");
    expect(await output("find-replace", "İx Kx kx", { find: "kx", replacement: "!", caseSensitivity: "Case-insensitive" })).toBe("İx ! !");
    await expect(run("find-replace", "abc", { find: "", replacement: "x" })).rejects.toThrow(/non-empty/);
    await expect(run("find-replace", "a".repeat(1000), { find: "a", replacement: "x".repeat(5000) })).rejects.toThrow(/output limit/);
  });
  it.each([1, 2, 4, 16])("tabs/spaces exact group width %s", async width => {
    expect(await output("tabs-to-spaces", "a\tb\r\n\tc", { width: String(width) })).toBe(`a${" ".repeat(width)}b\r\n${" ".repeat(width)}c`);
    expect(await output("spaces-to-tabs", "a" + " ".repeat(width * 2 + (width > 1 ? 1 : 0)) + "b", { width: String(width) })).toBe("a\t\t" + (width > 1 ? " " : "") + "b");
  });
  it.each(["0", "17", "1.5", "", "bad"])("rejects width %s", async width => {
    await expect(run("tabs-to-spaces", "x", { width })).rejects.toThrow(); await expect(run("spaces-to-tabs", "x", { width })).rejects.toThrow();
  });
  it.each([["LF", "\n"], ["CRLF", "\r\n"], ["CR", "\r"]])("normalizes mixed endings to %s exactly", async (lineEnding, sep) => {
    const text = "a\r\nb\rc\nd\r\n";
    expect(await output("line-ending-converter", text, { lineEnding })).toBe(["a", "b", "c", "d", ""].join(sep));
    expect(await output("lf-to-crlf", text)).toBe("a\r\nb\r\nc\r\nd\r\n");
    expect(await output("crlf-to-lf", text)).toBe("a\nb\nc\nd\n");
  });
  it("normalizer always NFC plus LF and preserves punctuation/spaces", async () => {
    expect(await output("text-normalizer", "Cafe\u0301  !\r\nతెలుగు\rहिन्दी")).toBe("Café  !\nతెలుగు\nहिन्दी");
  });
  it("detects U+FEFF without inventing byte encoding and only removes leading BOM", async () => {
    expect((await run("bom-detector", "\uFEFFx"))[0].value).toBe("Yes"); expect((await run("bom-detector", "\uFEFFx"))[1].value).toContain("cannot be inferred");
    expect((await run("bom-detector", "x\uFEFF"))[0].value).toBe("No"); expect((await run("bom-detector", "\uFFFE"))[0].value).toBe("No");
    expect(await output("bom-remover", "\uFEFF\uFEFFa\uFEFF")).toBe("\uFEFFa\uFEFF"); expect(await output("bom-remover", "a\uFEFF")).toBe("a\uFEFF");
  });
  it("slugifies accents/spacing/punctuation while retaining non-Latin text", async () => {
    expect(await output("slug-generator", "Hello, World! This is Code Station")).toBe("hello-world-this-is-code-station");
    expect(await output("slug-generator", " Déjà  vu --- Café! ")).toBe("deja-vu-cafe");
    const result = await output("slug-generator", "తెలుగు हिन्दी 中文 العربية"); for (const fragment of ["తెలుగు", "हिन्दी", "中文", "العربية"]) expect(result).toContain(fragment);
  });
});

describe("generators without user source text", () => {
  const cases = [["lorem-ipsum-generator", "amount", "Words", 10000], ["lorem-ipsum-generator", "amount", "Sentences", 1000], ["lorem-ipsum-generator", "amount", "Paragraphs", 100], ["random-text-generator", "length", "Characters", 100000], ["random-text-generator", "length", "Words", 10000], ["random-text-generator", "length", "Sentences", 1000], ["random-text-generator", "length", "Paragraphs", 100]] as const;
  it.each(cases)("%s produces exact %s for %s", async (slug, key, unit, maximum) => {
    for (const amount of [1, 10, maximum]) {
      const result = await runText(slug, { [key]: String(amount), unit }); const text = result.rows[0].value;
      const count = unit === "Characters" ? characterCount(text) : unit === "Words" ? wordCount(text) : unit === "Sentences" ? sentenceCount(text) : paragraphCount(text);
      expect(count).toBe(amount); expect(result.rows[1].value).toBe(String(amount));
    }
    for (const amount of ["0", "-1", "1.5", "", String(maximum + 1), "100000000000000000000"]) await expect(runText(slug, { [key]: amount, unit })).rejects.toThrow();
    await expect(runText(slug, { [key]: "2", unit: "Other" })).rejects.toThrow();
  });
  it("does not copy source content into a generated fixture", async () => {
    const result = await runText("random-text-generator", { length: "100", unit: "Words", text: "PRIVATE-MARKER" }); expect(result.rows[0].value).not.toContain("PRIVATE-MARKER");
  });
});

describe("extractors preserve every occurrence", () => {
  it("extracts HTTP/S URLs with balanced punctuation but never www-only", async () => {
    const rows = await run("url-extractor", "See (https://example.com/path), https://example.com/a(b). HTTPS://example.com/?q=x&n=1; http://example.org https://example.org http://example.org www.example.org");
    expect(rows[0].value.split("\n")).toEqual(["https://example.com/path", "https://example.com/a(b)", "HTTPS://example.com/?q=x&n=1", "http://example.org", "https://example.org", "http://example.org"]); expect(rows[1].value).toBe("6");
    expect((await run("url-extractor", "No URLs here"))[1].value).toBe("0");
  });
  it("extracts repeated email-like values with Unicode around them", async () => {
    expect((await run("email-extractor", "తెలుగు <ada@example.com>, हिन्दी ada@example.com. 中文 lin+tag@example.org!"))[0].value).toBe("ada@example.com\nada@example.com\nlin+tag@example.org");
    expect((await run("email-extractor", "nothing @ invalid"))[1].value).toBe("0");
  });
  it("extracts signed integer/decimal text without semantic conversions", async () => {
    expect((await run("number-extractor", "-42 12.50 -.5 +0.75 7")).map(row => row.value)).toEqual(["-42\n12.50\n-.5\n+0.75\n7", "5"]);
    expect((await run("number-extractor", "No numbers"))[1].value).toBe("0");
  });
  it.each(["g", "i", "m", "s", "u", "y", "d", "gimsuyd", ""])("regex lines use native flags %s and reset state per line", async flags => {
    const text = "error: one\r\n info error: two\r\nerror: three\r\n";
    const regex = new RegExp("error:", flags); const expected = readLines(text).records.filter(line => { regex.lastIndex = 0; return regex.test(line); });
    const rows = await run("regex-line-extractor", text, { pattern: "error:", flags }); expect(rows[0].value).toBe(expected.join("\r\n") + "\r\n"); expect(rows[1].value).toBe(String(expected.length));
  });
  it("handles empty regex, zero matches, invalid syntax and invalid flags", async () => {
    expect((await run("regex-line-extractor", "a\nb", { pattern: "", flags: "g" }))[1].value).toBe("2");
    expect((await run("regex-line-extractor", "a\nb", { pattern: "z", flags: "" }))[0].value).toBe("");
    await expect(run("regex-line-extractor", "x", { pattern: "[", flags: "" })).rejects.toThrow(/invalid/);
    for (const flags of ["gg", "v", "/g", "x"]) await expect(run("regex-line-extractor", "x", { pattern: "x", flags })).rejects.toThrow(/flag/);
  });
  it.each([["url-extractor", "https://example.com "], ["email-extractor", "a@example.com "], ["number-extractor", "1 "], ["regex-line-extractor", "a\n"]])("%s rejects excessive matches instead of truncating", async (slug, repeated) => {
    await expect(run(slug, repeated.repeat(10001), { pattern: "a", flags: "g" })).rejects.toThrow(/10,000/);
  });
});

describe("readable bounded diff", () => {
  it.each([["", ""], ["same", "same"], ["same\nold\n", "same\nnew\nadded\n"], ["a\nb", "a"], ["a", "a\n"], ["a\r\n", "a\n"], [unicode, unicode + "!"], ["same\n".repeat(1500), "same\n".repeat(1500)]])("reconstructs both inputs and preserves line order %#", async (textA, textB) => {
    const result = await runText("text-diff", { textA, textB });
    expect(result.diff?.filter(row => row.kind !== "added").map(row => row.text).join("")).toBe(textA);
    expect(result.diff?.filter(row => row.kind !== "removed").map(row => row.text).join("")).toBe(textB);
    expect(result.rows[1].value).toBe(result.diff?.filter(row => row.kind === "added").map(row => row.text).join(""));
    expect(result.rows[2].value).toBe(result.diff?.filter(row => row.kind === "removed").map(row => row.text).join(""));
    if (textA !== textB) expect(result.diff?.some(row => row.kind !== "unchanged")).toBe(true);
  });
  it("explicitly limits diff size", async () => {
    await expect(runText("text-diff", { textA: "a\n".repeat(2001), textB: "b" })).rejects.toThrow(/2,000/);
  });
});

describe("all 31 Text contracts", () => {
  it.each(textTools)("$slug executes exact public example and output labels", async tool => {
    const values = { ...tool.textContract.defaults, ...tool.textContract.example }; const before = { ...values };
    expect((await runText(tool.id, values)).rows.map(row => row.label)).toEqual(tool.textContract.outputs); expect(values).toEqual(before);
  });
  describe.each(textTools)("$slug edges", tool => {
    it.each(["", "x", unicode, "<script>alert(1)</script>", "one\r\n\r\ntwo\n", "x".repeat(20_000)])("handles text fixture %# without changing supplied values", async text => {
      const values = { ...tool.textContract.defaults, ...tool.textContract.example };
      for (const field of tool.textContract.fields.filter(field => field.control === "textarea")) values[field.name] = text;
      const before = { ...values };
      expect((await runText(tool.id, values)).rows.map(row => row.label)).toEqual(tool.textContract.outputs); expect(values).toEqual(before);
    });
    it("rejects oversized or impossible input rather than truncating", async () => {
      const values = { ...tool.textContract.defaults, ...tool.textContract.example };
      const input = tool.textContract.fields.find(field => field.control === "textarea");
      if (input) values[input.name] = "x".repeat(1_000_001);
      else values[tool.id === "lorem-ipsum-generator" ? "amount" : "length"] = "0";
      await expect(runText(tool.id, values)).rejects.toThrow();
    });
  });
});

describe("Unicode counting and casing", () => {
  it("counts graphemes, whitespace-free graphemes and blank-line paragraphs", async () => {
    const rows = Object.fromEntries((await run("text-counter", "Hello World!\r\n\r\n👩‍💻 e\u0301")).map(row => [row.label, row.value]));
    expect(rows["Character count"]).toBe(String([...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment("Hello World!\r\n\r\n👩‍💻 e\u0301")].length));
    expect(rows["Character count without spaces"]).toBe("13"); expect(rows["Line count"]).toBe("3"); expect(rows["Paragraph count"]).toBe("2");
    expect((await run("text-counter", "")).every(row => row.value === "0")).toBe(true);
    expect(await output("character-counter-without-spaces", "👩‍💻 \t e\u0301\n")).toBe("2");
    expect(await output("text-counter", "🇮🇳")).toBe("1");
  });
  it.each(["abc", "e\u0301👩‍💻🇮🇳", "తెలుగు", "हिन्दी", "中文 العربية", unicode])("reverses graphemes without corrupting fixture %#", async text => {
    const expected = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(part => part.segment).reverse().join("");
    expect(await output("reverse-text", text)).toBe(expected);
  });
  it.each([["UPPERCASE", "HELLO WORLD"], ["lowercase", "hello world"], ["Title Case", "Hello World"], ["Sentence case", "Hello world"], ["camelCase", "helloWorld"], ["PascalCase", "HelloWorld"], ["snake_case", "hello_world"], ["kebab-case", "hello-world"], ["CONSTANT_CASE", "HELLO_WORLD"]])("case option %s", async (caseType, expected) => {
    expect(await output("case-converter", "Hello WORLD", { caseType })).toBe(expected);
    const result = await output("case-converter", "Café! తెలుగు हिन्दी 👩‍💻 中文", { caseType });
    for (const value of ["!", "తెలుగు", "हिन्दी", "👩‍💻", "中文"]) expect(result).toContain(value);
  });
  it("splits acronyms and preserves punctuation/combining marks", async () => {
    expect(await output("case-converter", "HTTPServer XMLParser", { caseType: "camelCase" })).toBe("httpServerXmlParser");
    expect(await output("case-converter", "foo, bar!", { caseType: "snake_case" })).toBe("foo,_bar!");
    expect(await output("case-converter", "e\u0301Test", { caseType: "snake_case" })).toBe("e\u0301_test");
    await expect(run("case-converter", "x", { caseType: "Other" })).rejects.toThrow();
  });
  it("counts sentences as estimates and paragraphs by blank separators", async () => {
    expect(await output("sentence-counter", "Hello!!! What?? Fine.")).toBe("3");
    expect(await output("sentence-counter", "... !!! ???")).toBe("0");
    expect(await output("paragraph-counter", "\n \nfirst\ncontinuation\r\n\t\r\nsecond\n\n")).toBe("2");
    expect(await output("paragraph-counter", " \t\r\n")).toBe("0");
  });
});

describe("line record preservation", () => {
  it.each(["\n", "\r\n", "\r"])("preserves content and terminal separator %#", async sep => {
    expect(await output("reverse-lines", [" a ", "", "b", ""].join(sep))).toBe(["b", "", " a ", ""].join(sep));
    expect(await output("prefix-suffix-adder", ["one", "", "two", ""].join(sep), { prefix: "- ", suffix: ";" })).toBe(["- one;", "- ;", "- two;", ""].join(sep));
    expect(await output("whitespace-cleaner", ["  one\t two  ", "", " three ", ""].join(sep))).toBe(["one two", "", "three", ""].join(sep));
    expect(await output("empty-line-remover", [" a ", "\t", "", " b  ", ""].join(sep))).toBe([" a ", " b  ", ""].join(sep));
    expect(await output("duplicate-line-remover", ["a", "a", "", "", ""].join(sep), { caseSensitivity: "Case-sensitive" })).toBe(["a", "", ""].join(sep));
  });
  it("normalizes mixed separators to the first, not arbitrary CRLF priority", async () => {
    expect(await output("reverse-lines", "one\rtwo\r\nthree\n")).toBe("three\rtwo\rone\r");
    expect(await output("reverse-lines", "one\ntwo\r\nthree\r")).toBe("three\ntwo\none\n");
  });
  it("preserves first spelling and whitespace for deduplication", async () => {
    expect(await output("duplicate-line-remover", "Apple\napple\n Apple \nApple", { caseSensitivity: "Case-insensitive" })).toBe("Apple\n Apple ");
    expect(await run("line-deduplicator", "a\na\nb", { caseSensitivity: "Case-sensitive" })).toEqual([{ label: "Deduplicated text", value: "a\nb" }, { label: "Removed duplicate count", value: "1" }]);
    expect((await run("line-deduplicator", "a\nb"))[1].value).toBe("0");
  });
  it("sorts stable exact/case-normalized keys without trimming or losing duplicates", async () => {
    const text = "b\nA\na\n\nb\n a ";
    expect(await output("sort-lines", text, { sortOrder: "A → Z", caseSensitivity: "Case-sensitive" })).toBe("\n a \nA\na\nb\nb");
    expect(await output("sort-lines", text, { sortOrder: "Z → A", caseSensitivity: "Case-insensitive" })).toBe("b\nb\nA\na\n a \n\n");
    expect(readLines(await output("reverse-lines", "\nb")).records).toEqual(["b", ""]);
  });
  it("shuffles a permutation with unbiased index sampling", async () => {
    const source = " a \r\n\r\nb\r\nb\r\n";
    for (let i = 0; i < 10; i++) {
      const shuffled = await output("line-shuffler", source); expect(shuffled.endsWith("\r\n")).toBe(true);
      expect(readLines(shuffled).records.sort()).toEqual(readLines(source).records.sort());
    }
    let calls = 0; vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(array => { (array as Uint32Array)[0] = calls++ === 0 ? 0xffffffff : 0; return array; });
    expect(randomIndex(3)).toBe(0); expect(calls).toBe(2);
  });
  it("enforces output and line limits rather than returning incomplete text", async () => {
    await expect(run("prefix-suffix-adder", "x\n".repeat(1000), { prefix: "a".repeat(10_000), suffix: "" })).rejects.toThrow(/output limit/);
    await expect(run("reverse-lines", "\n".repeat(100_001))).rejects.toThrow(/line limit/);
  });
});
