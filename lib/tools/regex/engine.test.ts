import { describe, expect, it } from "vitest";
import { regexTools } from "@/config/regex-tools";
import { runRegex } from "./engine";
import type { RegexValues } from "./types";

const matching = ["regex-tester", "regex-match-inspector", "regex-group-extractor", "regex-capture-group-tester", "regex-replace-tester", "regex-split-tester"];
const run = (slug: string, pattern = "", text = "", flags = "", extra: RegexValues = {}) => runRegex(slug, { pattern, text, flags, ...extra });
const test = (pattern: string, text: string, flags = "") => run("regex-tester", pattern, text, flags);

describe("literal escape and structured builder", () => {
  it.each(["", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", "^", "$", "|", "\\", "hello.world?", "🚀é\n漢字", "/cat/", "<img src=x>", "x".repeat(200_000)])("escapes literal input %# without flags or delimiters", literal => {
    const { text } = runRegex("regex-escape", { literal });
    if (literal.length <= 16_384) expect(new RegExp(`^(?:${text})$`, "u").test(literal)).toBe(true);
    else expect(text).toBe(literal);
    if (literal === "hello.world?") expect(text).toBe("hello\\.world\\?");
  });
  const modes = ["Exact text", "Any character", "Digit", "Non-digit", "Word character", "Non-word character", "Whitespace", "Non-whitespace"];
  const quantifiers = ["Exactly once", "Zero or one", "Zero or more", "One or more"];
  it.each(modes.flatMap(mode => quantifiers.flatMap(quantifier => ["Case sensitive", "Case insensitive"].map(caseSensitivity => ({ mode, quantifier, caseSensitivity })))))("builds $mode / $quantifier / $caseSensitivity", values => {
    const result = runRegex("regex-pattern-builder", { literal: "hi.world", ...values });
    expect(() => new RegExp(result.text!)).not.toThrow(); expect(result.text).not.toContain("/i");
    const same = runRegex("regex-pattern-builder", { literal: "hi.world", ...values, caseSensitivity: "Case sensitive" });
    expect(result.text).toBe(same.text);
    if (values.mode === "Exact text" && values.quantifier === "One or more") expect(result.text).toBe("(?:hi\\.world)+");
    if (values.mode === "Digit") expect(result.text).toMatch(/^\\d/);
  });
  it.each(["", "🚀", "(", "a"])("quantifies whole exact literal %#", literal => {
    const { text } = runRegex("regex-pattern-builder", { literal, mode: "Exact text", quantifier: "One or more", caseSensitivity: "Case sensitive" });
    expect(new RegExp(`^(?:${text})$`).test(literal.repeat(3))).toBe(true);
  });
  it("rejects invented options and oversized literal text", () => {
    const invalid: RegexValues[] = [{ mode: "Email" }, { quantifier: "Exactly 8" }, { caseSensitivity: "Unicode" }];
    for (const extra of invalid) expect(() => runRegex("regex-pattern-builder", { literal: "abc", ...extra })).toThrow(/Select/);
    expect(() => runRegex("regex-escape", { literal: "x".repeat(200_001) })).toThrow(/200,000/);
  });
});

describe("groups and independent flags", () => {
  it("distinguishes definitions, full match, numbered/named/noncapturing/lookaround", () => {
    const pattern = "(?<word>(a))(?:b)(?=c)(?!d)(?<=b)(?<!z)";
    const result = run("regex-capture-group-tester", pattern, "abc", "d");
    expect(result.definitions?.map(g => [g.kind, g.number, g.name])).toEqual([["named", 1, "word"], ["capturing", 2, undefined], ["non-capturing", undefined, undefined], ["lookahead", undefined, undefined], ["lookahead", undefined, undefined], ["lookbehind", undefined, undefined], ["lookbehind", undefined, undefined]]);
    expect(result.matches?.[0].value).toBe("ab");
    expect(result.matches?.[0].groups.map(g => g.value)).toEqual(["a", "a"]);
    for (const def of result.definitions!) expect(def.source).toBe(pattern.slice(def.start, def.end));
  });
  it.each(["regex-capture-group-tester", "regex-group-extractor"])("%s handles escaped parentheses/classes/names/optional groups", slug => {
    const result = run(slug, String.raw`\(([()])(?<\u006eame>a)?(b)`, "((b ((ab", "g");
    expect(result.matches).toHaveLength(2);
    expect(result.matches?.[0].groups).toEqual([{ number: 1, value: "(" }, { number: 2, name: "name", value: null }, { number: 3, value: "b" }]);
    expect(result.matches?.[1].groups[1].value).toBe("a");
    expect(run(slug, "abc", "abc").matches?.[0].groups).toEqual([]);
  });
  it("keeps group definitions when there are no matches", () => {
    const result = run("regex-capture-group-tester", "(a)(?<b>b)(?:c)", "z");
    expect(result.matches).toEqual([]); expect(result.definitions).toHaveLength(3);
  });
  it.each(["^cat$", ".", "", "(?<x>a)?", "[", "\\a"])("compares every flag independently for %s", pattern => {
    const text = "Cat\ncat🚀a"; const result = run("regex-flag-tester", pattern, text, "gim");
    expect(result.rows?.map(row => row.flags)).toEqual(["", "g", "i", "m", "s", "u", "y", "d"]);
    for (const row of result.rows!) {
      let regex: RegExp; try { regex = new RegExp(pattern, row.flags); } catch { expect(row.valid).toBe(false); expect(row.count).toBeNull(); continue; }
      expect(row.valid).toBe(true); const first = regex.exec(text); expect(row.first).toBe(first?.[0] ?? null); expect(row.matched).toBe(first !== null);
      if (row.flags !== "g") expect(row.count).toBe(first ? 1 : 0);
      else expect(row.count).toBe([...text.matchAll(new RegExp(pattern, "g"))].length);
    }
  });
  it("does not include private pattern text in invalid-regex errors", () => {
    try { test("PRIVATE-MARKER[", "PRIVATE-TEXT"); } catch (cause) { expect(String(cause)).not.toContain("PRIVATE"); }
  });
});
describe("all Regex contracts", () => {
  it.each(regexTools)("$slug executes its public example without mutating input", tool => {
    const values = { ...tool.regexContract.defaults, ...tool.regexContract.example }; const before = { ...values };
    expect(runRegex(tool.slug, values).kind).toBeTruthy(); expect(values).toEqual(before);
  });
  describe.each(matching)("%s native matching edge cases", slug => {
    it.each(["", "x", "cat cat", "é🚀漢字", "<script>alert(1)</script>", "x".repeat(200_000)])("handles empty and populated text %#", text => {
      expect(() => run(slug, "z", text)).not.toThrow();
    });
    it.each(["", "g", "i", "m", "s", "u", "y", "d", "gimsuyd"])("accepts selected JavaScript flags %s", flags => {
      expect(() => run(slug, "(?<name>a)(b)?", "a ab", flags)).not.toThrow();
    });
    it.each(["gg", "v", "x", "g i", "/gi", "G"])("rejects invalid flags %s without normalizing", flags => {
      expect(() => run(slug, "a", "a", flags)).toThrow(/flag/i);
    });
    it.each(["(", "[", "*", "(?P<name>a)", "(?<name>a)(?<name>b)"])("rejects invalid JavaScript syntax %s", pattern => {
      expect(() => run(slug, pattern, "private-test-content")).toThrow(/Invalid JavaScript regular expression/);
    });
    it("accepts empty patterns and text per native behavior", () => {
      const result = run(slug, "", "", "g");
      if (slug === "regex-split-tester") expect(result.parts).toEqual([]);
      else expect(result.count).toBe(1);
    });
    it("rejects large inputs instead of slicing", () => {
      expect(() => run(slug, "x", "x".repeat(200_001))).toThrow(/200,000/);
      expect(() => run(slug, "x".repeat(16_385), "x")).toThrow(/16,384/);
    });
  });
});

describe("JavaScript RegExp semantics", () => {
  it("g controls first/all, with no hidden flags", () => {
    expect(test("cat", "cat cat").count).toBe(1);
    expect(test("cat", "cat cat", "g").count).toBe(2);
    expect(test("CAT", "cat", "").count).toBe(0);
    expect(test("CAT", "cat", "i").count).toBe(1);
    expect(test("^cat$", "dog\ncat").count).toBe(0);
    expect(test("^cat$", "dog\ncat", "m").matches?.[0].start).toBe(4);
    expect(test("a.b", "a\nb").count).toBe(0);
    expect(test("a.b", "a\nb", "s").count).toBe(1);
  });
  it("sticky starts at zero, stops at gaps and resets each run", () => {
    expect(test("a", "ba", "y").count).toBe(0);
    expect(test("a", "aa ba", "gy").count).toBe(2);
    expect(test("a", "aa", "y").count).toBe(1);
    expect(test("a", "aa", "y").matches?.[0].start).toBe(0);
  });
  it("Unicode advances empty matches by code point, offsets stay UTF-16", () => {
    expect(test("", "🚀x", "g").matches?.map(m => m.start)).toEqual([0, 1, 2, 3]);
    expect(test("", "🚀x", "gu").matches?.map(m => m.start)).toEqual([0, 2, 3]);
    expect(test(".", "🚀x", "gu").matches?.map(m => [m.value, m.start, m.end, m.length])).toEqual([["🚀", 0, 2, 2], ["x", 2, 3, 1]]);
    expect(test("\\p{Letter}+", "漢字", "u").count).toBe(1);
  });
  it("d exposes capture indices and unmatched null rather than fabricated values", () => {
    const match = test("(?<first>a)(b)?()", "a", "d").matches![0];
    expect(match.indices).toEqual([0, 1]);
    expect(match.groups).toEqual([{ number: 1, name: "first", value: "a", indices: [0, 1] }, { number: 2, value: null, indices: null }, { number: 3, value: "", indices: [1, 1] }]);
    expect(test("a", "a").matches?.[0].indices).toBeUndefined();
  });
  it("does not interpret slash-delimited input as another language", () => {
    expect(test("/cat/g", "cat").count).toBe(0);
    expect(test("/cat/g", "/cat/g").count).toBe(1);
  });
  it("reports explicit match and output limits, never incomplete success", () => {
    expect(test("a", "a".repeat(2000), "g").count).toBe(2000);
    expect(() => test("a", "a".repeat(2001), "g")).toThrow(/2,000-match/);
    expect(() => test("(a+)".replace("(a+)", "(".repeat(25) + "a+" + ")".repeat(25)), "a".repeat(200_000))).toThrow(/output limit/);
  });
});

describe("replacement and split are native JavaScript", () => {
  it.each(["", "g", "y", "gy", "u", "gu", "d"])("replacement respects %s", flags => {
    for (const pattern of ["cat", "(?<word>cat)( dog)?", "", "(a)?"]) for (const replacement of ["fox", "$&", "$1/$2", "$<word>", "$$", "$`-$'", "$01|$10|$99", ""]) {
      const text = "cat dog cat🚀";
      const result = run("regex-replace-tester", pattern, text, flags, { replacement });
      expect(result.text).toBe(text.replace(new RegExp(pattern, flags), replacement));
      let count = 0; text.replace(new RegExp(pattern, flags), () => { count++; return ""; }); expect(result.count).toBe(count);
    }
  });
  it("does not force global replacement and rejects explosive output", () => {
    expect(run("regex-replace-tester", "cat", "cat dog cat", "", { replacement: "fox" }).text).toBe("fox dog cat");
    expect(run("regex-replace-tester", "z", "cat", "g", { replacement: "fox" })).toMatchObject({ text: "cat", count: 0 });
    expect(() => run("regex-replace-tester", "a", "a".repeat(1000), "g", { replacement: "x".repeat(10_000) })).toThrow(/output limit/);
    expect(() => run("regex-replace-tester", "a", "a".repeat(1000) + "b".repeat(199_000), "g", { replacement: "$'" })).toThrow(/output limit/);
  });
  it.each(["", "g", "u", "gu", "y", "d"])("split matches native for %s including unmatched captures", flags => {
    for (const [pattern, text] of [["[,;]", "one,two;three"], ["[,]", "one"], ["(,)|(;)" , "a,b;c"], ["", "🚀x"], ["", ""], ["(,)", ",a,,b,"]]) {
      const expected = text.split(new RegExp(pattern, flags)).map(part => part === undefined ? null : part);
      const result = run("regex-split-tester", pattern, text, flags); expect(result.parts).toEqual(expected); expect(result.count).toBe(expected.length);
    }
    expect(() => run("regex-split-tester", ",", "x,".repeat(2000), flags)).toThrow(/2,000-part/);
  });
});
