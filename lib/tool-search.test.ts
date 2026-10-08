import { describe, expect, it } from "vitest";
import { searchTools } from "./tool-search";

const metadata = [
  { id: "description-hit", name: "JSON Formatter", description: "Format structured data", keywords: ["pretty"] },
  { id: "name-hit", name: "JSON Validator", description: "Check data", keywords: ["json"] },
  { id: "description-hit", name: "JSON Formatter", description: "Duplicate metadata", keywords: ["json"] },
  { id: "keyword-hit", name: "CSV Tool", description: "Rows", keywords: ["JSON"] },
] as const;

describe("searchTools", () => {
  it("normalizes whitespace/case and ranks exact or name matches first", () => {
    expect(searchTools(metadata, "  json   validator ").map(tool => tool.id)).toEqual(["name-hit"]);
    expect(searchTools(metadata, "json").map(tool => tool.id)).toEqual(["description-hit", "name-hit", "keyword-hit"]);
  });

  it("deduplicates metadata by tool identity and returns all tools for an empty query", () => {
    expect(searchTools(metadata, "").map(tool => tool.id)).toEqual(["description-hit", "name-hit", "keyword-hit"]);
    expect(new Set(searchTools(metadata, "formatter").map(tool => tool.id)).size).toBe(1);
  });
});
