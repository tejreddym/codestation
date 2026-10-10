import { describe, expect, it } from "vitest";
import { codeTools, codeToolIds } from "./code-tools";

describe("code generation tools registry", () => {
  it("defines all code tool ids matching the array", () => {
    expect(codeTools.map((t) => t.id)).toEqual(codeToolIds);
  });

  it("assigns category and contracts to every tool", () => {
    for (const tool of codeTools) {
      expect(tool.category).toBe("Code Generation");
      expect(tool.localContract.fields.length).toBeGreaterThan(0);
      expect(tool.localContract.outputs.length).toBeGreaterThan(0);
      expect(tool.localContract.notices.length).toBeGreaterThan(0);
    }
  });
});
