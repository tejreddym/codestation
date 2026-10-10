import { describe, expect, it } from "vitest";
import { cssPlaygroundTools, cssPlaygroundToolIds } from "./css-playground-tools";

describe("CSS playground tools registry", () => {
  it("defines all CSS playground tool ids", () => {
    expect(cssPlaygroundTools.map((t) => t.id)).toEqual(cssPlaygroundToolIds);
  });

  it("assigns category Frontend & CSS and local contracts", () => {
    for (const tool of cssPlaygroundTools) {
      expect(tool.category).toBe("Frontend & CSS");
      expect(tool.localContract.fields.length).toBeGreaterThan(0);
      expect(tool.localContract.outputs.length).toBeGreaterThan(0);
    }
  });
});
