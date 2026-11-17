import { describe, expect, it } from "vitest";
import { generateGitAttributes } from "./attributes";

describe("Git attributes generator", () => {
  it("writes the default auto line-ending policy", () => {
    const result = generateGitAttributes({ eol: "auto" });
    expect(result.content).toContain("* text=auto");
    expect(result.ruleCount).toBe(1);
  });

  it("writes lf, crlf and preserve policies", () => {
    expect(generateGitAttributes({ eol: "lf" }).content).toContain("* text=auto eol=lf");
    expect(generateGitAttributes({ eol: "crlf" }).content).toContain("* text=auto eol=crlf");
    expect(generateGitAttributes({ eol: "preserve" }).content).toContain("* -text");
  });

  it("emits binary, linguist and export-ignore rules", () => {
    const result = generateGitAttributes({
      eol: "lf",
      binaryGlobs: "*.png\n*.pdf, *.zip",
      linguistGlobs: "dist/**",
      linguistFlag: "generated",
      exportIgnore: "docs/**\n.git*",
    });
    expect(result.content).toContain("*.png binary");
    expect(result.content).toContain("*.pdf binary");
    expect(result.content).toContain("*.zip binary");
    expect(result.content).toContain("dist/** linguist-generated=true");
    expect(result.content).toContain("docs/** export-ignore");
  });

  it("supports every linguist flag", () => {
    expect(generateGitAttributes({ eol: "auto", linguistGlobs: "vendor/**", linguistFlag: "vendored" }).content)
      .toContain("linguist-vendored=true");
    expect(generateGitAttributes({ eol: "auto", linguistGlobs: "docs/**", linguistFlag: "documentation" }).content)
      .toContain("linguist-documentation=true");
  });

  it("rejects invalid patterns", () => {
    expect(() => generateGitAttributes({ eol: "auto", binaryGlobs: "bad pattern" })).toThrow(/cannot contain whitespace/);
    expect(() => generateGitAttributes({ eol: "auto", binaryGlobs: 'bad"pattern' })).toThrow(/cannot contain whitespace or quotes/);
  });

  it("requires globs when a linguist flag is selected", () => {
    expect(() => generateGitAttributes({ eol: "auto", linguistFlag: "generated" })).toThrow(/path glob/);
  });

  it("rejects unknown policies", () => {
    expect(() => generateGitAttributes({ eol: "mixed" as never })).toThrow(/line-ending policy/);
  });

  it("deduplicates repeated rules", () => {
    const result = generateGitAttributes({ eol: "auto", binaryGlobs: "*.png\n*.png" });
    expect(result.content.match(/\*\.png binary/g)).toHaveLength(1);
  });

  it("bounds large input", () => {
    expect(() => generateGitAttributes({ eol: "auto", binaryGlobs: "x".repeat(200_001) })).toThrow(/200 KB/);
  });
});
