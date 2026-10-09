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
  });

  it("resolves keeping 'theirs'", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "theirs");
    expect(res.resolvedContent).toContain("return price * 0.75;");
    expect(res.resolvedContent).not.toContain("return price * 0.8;");
    expect(res.resolvedContent).not.toContain("<<<<<<<");
    expect(res.resolvedContent).not.toContain(">>>>>>>");
  });

  it("resolves keeping 'both'", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "both");
    expect(res.resolvedContent).toContain("return price * 0.8;");
    expect(res.resolvedContent).toContain("return price * 0.75;");
  });

  it("formats visual report", () => {
    const res = parseAndResolveGitConflicts(sampleConflictFile, "analyze");
    const report = formatConflictReport(res);
    expect(report).toContain("GIT CONFLICT RESOLVER");
    expect(report).toContain("feature/festive-sale");
  });
});
