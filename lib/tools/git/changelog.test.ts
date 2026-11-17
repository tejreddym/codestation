import { describe, expect, it } from "vitest";
import { generateChangelog } from "./changelog";

describe("Changelog generator", () => {
  it("groups one-line conventional commits and surfaces breaking changes", () => {
    const result = generateChangelog(
      [
        "a1b2c3d feat(api): add export endpoint",
        "b2c3d4e fix: handle empty payloads",
        "c3d4e5f feat!: remove legacy route",
        "d4e5f6a docs: document the API",
        "e5f6a7b random maintenance work",
      ].join("\n")
    );

    expect(result.commitCount).toBe(5);
    expect(result.breakingCount).toBe(1);
    expect(result.markdown).toContain("# Changelog");
    expect(result.markdown).toContain("## Breaking Changes");
    expect(result.markdown).toContain("- remove legacy route (c3d4e5f)");
    expect(result.markdown).toContain("## Features");
    expect(result.markdown).toContain("**api:** add export endpoint (a1b2c3d)");
    expect(result.markdown).toContain("## Bug Fixes");
    expect(result.markdown).toContain("## Documentation");
    expect(result.markdown).toContain("## Other Changes");
    expect(result.markdown.indexOf("## Breaking Changes")).toBeLessThan(result.markdown.indexOf("## Features"));
  });

  it("parses full git log output with bodies", () => {
    const log = [
      "commit 0123456789abcdef0123456789abcdef01234567",
      "Author: Dev <dev@example.com>",
      "Date:   Tue Nov 11 10:00:00 2025 +0000",
      "",
      "    feat(core): add caching",
      "",
      "    Uses an in-memory cache.",
      "",
      "    BREAKING CHANGE: Cache keys changed.",
      "",
      "commit fedcba9876543210fedcba9876543210fedcba98",
      "Author: Dev <dev@example.com>",
      "Date:   Mon Nov 10 10:00:00 2025 +0000",
      "",
      "    fix!: correct cache eviction",
      "",
    ].join("\n");

    const result = generateChangelog(log);
    expect(result.commitCount).toBe(2);
    expect(result.breakingCount).toBe(2);
    expect(result.markdown).toContain("(0123456)");
    expect(result.markdown).toContain("Cache keys changed.");
    expect(result.markdown).toContain("**core:** add caching");
  });

  it("extracts the BREAKING CHANGE footer from full log bodies", () => {
    const result = generateChangelog(
      ["commit abcdef1234567890", "", "    chore: tidy", "", "    BREAKING CHANGE: config moved", ""].join("\n")
    );
    expect(result.breakingCount).toBe(1);
    expect(result.markdown).toContain("config moved");
  });

  it("treats plain non-conventional lines as other changes", () => {
    const result = generateChangelog("Initial import\nFix typo");
    expect(result.commitCount).toBe(2);
    expect(result.markdown).toContain("## Other Changes");
    expect(result.markdown).toContain("- Initial import");
  });

  it("rejects empty input and bounds large input", () => {
    expect(() => generateChangelog("   ")).toThrow(/Paste git log/);
    expect(() => generateChangelog("x".repeat(200_001))).toThrow(/200 KB/);
  });
});
