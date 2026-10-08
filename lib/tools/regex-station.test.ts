import { describe, expect, it } from "vitest";
import { advanceStringIndex, escapeRegexLiteral, runRegexOperation } from "./regex-station";

describe("regex station helpers", () => {
  it("escapes every regex metacharacter", () => expect(escapeRegexLiteral("a+b[c]./\\")).toBe("a\\+b\\[c\\]\\.\\/\\\\"));
  it("advances empty Unicode matches by a code point", () => expect(advanceStringIndex("🚀x", 0, true)).toBe(2));
  it("returns named groups and offsets", () => {
    const result = runRegexOperation({ operation: "groups", pattern: "(?<name>\\w+)", flags: "g", text: "Ada Lin" });
    expect(result.matches?.map((match) => [match.index, match.groups.name])).toEqual([[0, "Ada"], [4, "Lin"]]);
  });
  it("handles zero-length global Unicode matches without looping", () => {
    const result = runRegexOperation({ operation: "inspect", pattern: "(?=.)", flags: "gu", text: "🚀x", limit: 10 });
    expect(result.count).toBe(2);
  });
  it("previews replacements and split results", () => {
    expect(runRegexOperation({ operation: "replace", pattern: "cat", flags: "gi", text: "Cat cat", replacement: "dog" }).output).toBe("dog dog");
    expect(runRegexOperation({ operation: "split", pattern: ",", flags: "g", text: "a,b,c" }).parts).toEqual(["a", "b", "c"]);
  });
});
