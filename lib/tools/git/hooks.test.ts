import { describe, expect, it } from "vitest";
import { generateGitHook } from "./hooks";

describe("Git hooks generator", () => {
  it("writes a bounded pre-commit script", () => {
    const result = generateGitHook({
      hook: "pre-commit",
      commands: "npm run lint\nnpm test",
    });
    expect(result.filename).toBe("pre-commit");
    expect(result.commandCount).toBe(2);
    expect(result.script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(result.script).toContain("set -e");
    expect(result.script).toContain("npm run lint\nnpm test");
    expect(result.script).toContain("does not run this script");
    expect(result.installInstructions).toContain("chmod +x .git/hooks/pre-commit");
  });

  it("adds the commit-msg argument guard", () => {
    const result = generateGitHook({ hook: "commit-msg", commands: "grep -q . \"$MESSAGE_FILE\"" });
    expect(result.script).toContain('MESSAGE_FILE="${1:-}"');
    expect(result.script).toContain("missing commit message file");
  });

  it("adds pre-push and pre-rebase argument variables", () => {
    expect(generateGitHook({ hook: "pre-push", commands: "echo \"$REMOTE\"" }).script).toContain('REMOTE="${1:-}"');
    expect(generateGitHook({ hook: "pre-rebase", commands: "echo \"$UPSTREAM\"" }).script).toContain('UPSTREAM="${1:-}"');
  });

  it("omits set -e when failFast is false", () => {
    const result = generateGitHook({ hook: "pre-commit", commands: "npm test", failFast: false });
    expect(result.script).not.toContain("set -e");
  });

  it("emits a placeholder when no commands are provided", () => {
    const result = generateGitHook({ hook: "pre-commit", commands: "" });
    expect(result.commandCount).toBe(0);
    expect(result.script).toContain("Add one command per line");
  });

  it("rejects unknown hooks, shebang commands and oversized input", () => {
    expect(() => generateGitHook({ hook: "post-merge" as never, commands: "" })).toThrow(/Choose one of/);
    expect(() => generateGitHook({ hook: "pre-commit", commands: "#!/bin/bash" })).toThrow(/shebang/);
    expect(() => generateGitHook({ hook: "pre-commit", commands: "x".repeat(200_001) })).toThrow(/200 KB/);
  });
});
