import { describe, expect, it } from "vitest";
import {
  buildConventionalCommit,
  formatCommitBuilderOutput,
  parseConventionalCommit,
} from "./commit";

describe("Git commit engine", () => {
  it("builds a scoped conventional commit", () => {
    const result = buildConventionalCommit({
      type: "feat",
      scope: "api",
      description: "add rate limiting",
      body: "Limits requests per API key.",
    });
    expect(result.message).toBe("feat(api): add rate limiting\n\nLimits requests per API key.");
    expect(result.hints).toEqual([]);
  });

  it("adds the bang and BREAKING CHANGE footer for breaking changes", () => {
    const result = buildConventionalCommit({
      type: "feat",
      description: "remove legacy endpoint",
      breaking: true,
      breakingDescription: "Use /v2 instead.",
    });
    expect(result.message).toContain("feat!: remove legacy endpoint");
    expect(result.message).toContain("BREAKING CHANGE: Use /v2 instead.");
    expect(result.hints.some((hint) => hint.includes("BREAKING CHANGE"))).toBe(true);
  });

  it("does not duplicate an explicit BREAKING CHANGE footer", () => {
    const result = buildConventionalCommit({
      type: "fix",
      description: "change semantics",
      breaking: true,
      footer: "BREAKING CHANGE: Existing callers must migrate.",
    });
    expect(result.message.match(/BREAKING CHANGE/g)).toHaveLength(1);
  });

  it("warns when the subject exceeds 72 characters", () => {
    const result = buildConventionalCommit({ type: "docs", description: "a".repeat(80) });
    expect(result.hints[0]).toContain("80 characters");
  });

  it("rejects unknown types and malformed scopes", () => {
    expect(() => buildConventionalCommit({ type: "banana", description: "x" })).toThrow(/Unknown commit type/);
    expect(() => buildConventionalCommit({ type: "feat", scope: "bad scope", description: "x" })).toThrow(/Scope/);
    expect(() => buildConventionalCommit({ type: "feat", description: "   " })).toThrow(/description/i);
  });

  it("parses a full conventional commit with body and footer", () => {
    const parsed = parseConventionalCommit(
      "feat(parser)!: support nested options\n\nAdds recursive parsing.\n\nBREAKING CHANGE: Options are now objects."
    );
    expect(parsed.valid).toBe(true);
    expect(parsed.type).toBe("feat");
    expect(parsed.scope).toBe("parser");
    expect(parsed.breaking).toBe(true);
    expect(parsed.breakingDescription).toBe("Options are now objects.");
    expect(parsed.body).toBe("Adds recursive parsing.");
    expect(parsed.footer).toContain("BREAKING CHANGE:");
    expect(parsed.errors).toEqual([]);
  });

  it("reports malformed headers and unknown types", () => {
    const malformed = parseConventionalCommit("updated the docs");
    expect(malformed.valid).toBe(false);
    expect(malformed.errors[0]).toMatch(/Header must match/);

    const unknown = parseConventionalCommit("banana: add fruit");
    expect(unknown.valid).toBe(false);
    expect(unknown.errors[0]).toContain('"banana"');
  });

  it("handles empty input and bounds large input", () => {
    expect(parseConventionalCommit("   ").errors).toEqual(["Commit message is empty."]);
    expect(() => parseConventionalCommit("x".repeat(200_001))).toThrow(/200 KB/);
  });

  it("formats hints for display", () => {
    const text = formatCommitBuilderOutput({
      message: "feat: x",
      hints: ["Keep it short."],
    });
    expect(text).toBe("feat: x\n\nHints:\n- Keep it short.");
    expect(formatCommitBuilderOutput({ message: "fix: y", hints: [] })).toBe("fix: y");
  });
});
