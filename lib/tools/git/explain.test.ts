import { describe, expect, it } from "vitest";
import { explainGitCommand, formatGitCommandExplanation } from "./explain";

describe("Git command explainer", () => {
  it("explains reset --hard as destructive", () => {
    const result = explainGitCommand("git reset --hard HEAD~1");
    expect(result.subcommand).toBe("reset");
    expect(result.flags).toEqual([{ flag: "--hard" }]);
    expect(result.risks[0]).toContain("discards uncommitted changes");
    expect(result.note).toMatch(/never executes/);
  });

  it("detects clean -fd", () => {
    const result = explainGitCommand("$ git clean -fd");
    expect(result.subcommand).toBe("clean");
    expect(result.risks[0]).toContain("untracked files and directories");
  });

  it("distinguishes forced pushes from force-with-lease", () => {
    expect(explainGitCommand("git push --force origin main").risks[0]).toContain("forced push");
    expect(explainGitCommand("git push --force-with-lease").risks[0]).toContain("refuses when the remote changed");
  });

  it("detects branch -D and rebase risks", () => {
    expect(explainGitCommand("git branch -D feature").risks[0]).toContain("not merged");
    expect(explainGitCommand("git rebase main").risks[0]).toContain("rewrites commit history");
  });

  it("parses long flags with values and quoted arguments", () => {
    const result = explainGitCommand('git commit --message="fix: quoted value" -am');
    expect(result.subcommand).toBe("commit");
    expect(result.flags).toContainEqual({ flag: "--message", value: "fix: quoted value" });
    expect(result.flags).toContainEqual({ flag: "-am" });
    expect(result.risks).toEqual([]);
  });

  it("returns a neutral summary for safe commands", () => {
    const result = explainGitCommand("git status");
    expect(result.summary).toBe("Show the working-tree and index state.");
    expect(result.risks).toEqual([]);
  });

  it("rejects empty commands and unclosed quotes", () => {
    expect(() => explainGitCommand("  ")).toThrow(/Enter a Git command/);
    expect(() => explainGitCommand('git commit -m "unclosed')).toThrow(/unclosed quote/);
    expect(() => explainGitCommand("git")).toThrow(/subcommand/);
  });

  it("formats a readable explanation", () => {
    const text = formatGitCommandExplanation(explainGitCommand("git push --force"));
    expect(text).toContain("Subcommand: push");
    expect(text).toContain("Flags: --force");
    expect(text).toContain("Risks:");
    expect(text).toContain("Note:");
  });
});
