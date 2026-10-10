import { describe, expect, it } from "vitest";
import { devMathTools, devMathToolIds } from "./dev-math-tools";

describe("developer math tools registry", () => {
  it("defines all developer math tool ids", () => {
    expect(devMathTools.map((t) => t.id)).toEqual(devMathToolIds);
  });

  it("assigns category Developer Math and local contracts", () => {
    for (const tool of devMathTools) {
      expect(tool.category).toBe("Developer Math");
      expect(tool.localContract.fields.length).toBeGreaterThan(0);
      expect(tool.localContract.outputs.length).toBeGreaterThan(0);
    }
  });
});
