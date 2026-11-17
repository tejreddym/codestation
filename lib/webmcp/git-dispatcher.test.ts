import { describe, expect, it } from "vitest";
import { dispatchToolExecution } from "./dispatcher";

describe("WebMCP dispatcher: Git & Version Control station", () => {
  it("dispatches conventional-commit-builder options", async () => {
    const output = await dispatchToolExecution("conventional-commit-builder", "", {
      type: "feat",
      scope: "api",
      description: "add pagination",
      body: "Cursor-based.",
    });
    expect(output).toBe("feat(api): add pagination\n\nCursor-based.");
  });

  it("dispatches conventional-commit-validator", async () => {
    const parsed = JSON.parse(await dispatchToolExecution("conventional-commit-validator", "fix: handle empty input"));
    expect(parsed.valid).toBe(true);
    expect(parsed.type).toBe("fix");
    expect(parsed.description).toBe("handle empty input");
  });

  it("dispatches git-command-explainer", async () => {
    const explanation = JSON.parse(await dispatchToolExecution("git-command-explainer", "git clean -fd"));
    expect(explanation.subcommand).toBe("clean");
    expect(explanation.risks[0]).toContain("untracked files");
    expect(explanation.note).toMatch(/never executes/);
  });

  it("dispatches changelog-generator", async () => {
    const markdown = await dispatchToolExecution(
      "changelog-generator",
      "a1b2c3d feat: add search\nb2c3d4e fix: correct typo"
    );
    expect(markdown).toContain("# Changelog");
    expect(markdown).toContain("## Features");
    expect(markdown).toContain("## Bug Fixes");
  });

  it("dispatches gitattributes-generator options", async () => {
    const content = await dispatchToolExecution("gitattributes-generator", "", {
      eol: "lf",
      binaryGlobs: "*.png",
      linguistGlobs: "dist/**",
      linguistFlag: "generated",
      exportIgnore: "docs/**",
    });
    expect(content).toContain("* text=auto eol=lf");
    expect(content).toContain("*.png binary");
    expect(content).toContain("dist/** linguist-generated=true");
    expect(content).toContain("docs/** export-ignore");
  });

  it("dispatches git-hooks-generator options", async () => {
    const result = JSON.parse(
      await dispatchToolExecution("git-hooks-generator", "", {
        hook: "commit-msg",
        commands: "grep -q . \"$MESSAGE_FILE\"",
      })
    );
    expect(result.filename).toBe("commit-msg");
    expect(result.script).toContain("#!/bin/sh");
    expect(result.script).toContain('MESSAGE_FILE="${1:-}"');
    expect(result.installInstructions).toContain("chmod +x");
  });

  it("accepts the codestation_ prefixed WebMCP names", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("codestation_git_command_explainer", "git push --force")
    );
    expect(parsed.risks[0]).toContain("forced push");
  });
});
