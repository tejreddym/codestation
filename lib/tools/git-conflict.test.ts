import { describe, it, expect } from "vitest";
import { parseAndResolveGitConflicts, formatConflictReport } from "./git-conflict";

describe("parseAndResolveGitConflicts", () => {
  const sampleConflictFile = `
function calculateDiscount(price: number): number {
<<<<<<< HEAD
  // Current branch: apply 20% discount
  return price * 0.8;
=======
  // Incoming branch: apply 25% festive discount
  return price * 0.75;
>>>>>>> feature/festive-sale
}

export default calculateDiscount;
`;

  it("analyzes conflict markers and reports branch details", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "analyze");
    expect(res.hasConflicts).toBe(true);
    expect(res.conflictCount).toBe(1);
    expect(res.unresolvedCount).toBe(1);
    expect(res.hunks[0].oursBranch).toBe("HEAD");
    expect(res.hunks[0].theirsBranch).toBe("feature/festive-sale");
    expect(res.hunks[0].oursLines.join("\n")).toContain("return price * 0.8;");
    expect(res.hunks[0].theirsLines.join("\n")).toContain("return price * 0.75;");
  });

  it("resolves keeping 'ours'", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "ours");
    expect(res.resolvedContent).toContain("return price * 0.8;");
    expect(res.resolvedContent).not.toContain("return price * 0.75;");
    expect(res.resolvedContent).not.toContain("<<<<<<<");
    expect(res.resolvedContent).not.toContain(">>>>>>>");
    expect(res.unresolvedCount).toBe(0);
  });

  it("resolves keeping 'theirs'", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "theirs");
    expect(res.resolvedContent).toContain("return price * 0.75;");
    expect(res.resolvedContent).not.toContain("return price * 0.8;");
    expect(res.resolvedContent).not.toContain("<<<<<<<");
    expect(res.resolvedContent).not.toContain(">>>>>>>");
    expect(res.unresolvedCount).toBe(0);
  });

  it("resolves keeping 'both'", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "both");
    expect(res.resolvedContent).toContain("return price * 0.8;");
    expect(res.resolvedContent).toContain("return price * 0.75;");
    expect(res.unresolvedCount).toBe(0);
  });

  it("handles diff3 style conflicts with base lines", () => {
    const diff3File = `
<<<<<<< main
const greeting = "Hello, World! 🚀";
||||||| base
const greeting = "Hello!";
=======
const greeting = "Hey there! 🚀";
>>>>>>> feature/friendly
`;
    const res = parseAndResolveGitConflicts(diff3File, "analyze");
    expect(res.conflictCount).toBe(1);
    expect(res.hunks[0].baseLines).toBeDefined();
    expect(res.hunks[0].baseLines![0]).toBe('const greeting = "Hello!";');
    expect(res.hunks[0].oursLines[0]).toContain("🚀");
  });

  it("handles empty ours and empty theirs sections", () => {
    const emptySections = `
<<<<<<< HEAD
=======
console.log("Only theirs exists");
>>>>>>> incoming
<<<<<<< HEAD
console.log("Only ours exists");
=======
>>>>>>> incoming
`;
    const res = parseAndResolveGitConflicts(emptySections, "analyze");
    expect(res.conflictCount).toBe(2);
    expect(res.hunks[0].oursLines.length).toBe(0);
    expect(res.hunks[0].theirsLines.length).toBe(1);
    expect(res.hunks[1].oursLines.length).toBe(1);
    expect(res.hunks[1].theirsLines.length).toBe(0);
  });

  it("handles mixed CRLF and LF line endings and Unicode", () => {
    const mixedFile = "Line 1\r\n<<<<<<< HEAD\r\nHello 🌍\r\n=======\r\nHola 🌎\r\n>>>>>>> branch\r\nLine 2\n";
    const res = parseAndResolveGitConflicts(mixedFile, "ours");
    expect(res.resolvedContent).toContain("Hello 🌍");
    expect(res.resolvedContent).not.toContain("\r");
  });

  it("throws clear error on malformed markers", () => {
    // Nested markers
    const nested = `<<<<<<< HEAD\n<<<<<<< NESTED\n=======\n>>>>>>>`;
    expect(() => parseAndResolveGitConflicts(nested)).toThrow(/Nested <<<<<<< marker/);

    // Unclosed markers
    const unclosed = `<<<<<<< HEAD\ncode here\n=======`;
    expect(() => parseAndResolveGitConflicts(unclosed)).toThrow(/Unclosed conflict marker/);

    // Orphan marker
    const orphan = `code here\n=======\nmore code`;
    expect(() => parseAndResolveGitConflicts(orphan)).toThrow(/Unexpected ======= marker/);
  });

  it("formats visual report", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "analyze");
    const report = formatConflictReport(res);
    expect(report).toContain("GIT CONFLICT RESOLVER");
    expect(report).toContain("feature/festive-sale");
  });
});
