import { describe, expect, it } from "vitest";
import { extendedTools } from "./extended-tools";
import { getStationByName } from "./stations";

describe("extended tool station mapping", () => {
  it("maps every recategorised tool to a real implemented station", () => {
    expect(extendedTools.map(tool => [tool.id, tool.category])).toEqual([
      ["curl-to-any-language", "API"],
      ["env-audit", "Security"],
      ["mock-data", "JSON & Data"],
      ["conflict-parse", "Git & Version Control"],
    ]);
    for (const tool of extendedTools) expect(getStationByName((tool as { category: string }).category)).toBeTruthy();
    expect(extendedTools.some(tool => (tool as { category: string }).category === "Developer Tools")).toBe(false);
  });
});
