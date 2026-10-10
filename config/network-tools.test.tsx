import { describe, expect, it } from "vitest";
import { networkTools, networkToolIds } from "./network-tools";

describe("network tools registry", () => {
  it("defines all network tool ids", () => {
    expect(networkTools.map((t) => t.id)).toEqual(networkToolIds);
  });

  it("assigns category and localContract to every network tool", () => {
    for (const tool of networkTools) {
      expect(tool.category).toBe("Network & DevOps");
      expect(tool.localContract.fields.length).toBeGreaterThan(0);
      expect(tool.localContract.outputs.length).toBeGreaterThan(0);
    }
  });
});
