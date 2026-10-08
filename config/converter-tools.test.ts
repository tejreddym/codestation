import { describe, expect, it } from "vitest";
import { conversionCapabilities } from "./conversion-capabilities";
import { converterCategories, converterEntries, converterToolIds, getConverterCategory, getConverterEntry } from "./converter-tools";
import { getTool } from "./tools";
import { getStation } from "./stations";

describe("converter discovery registry", () => {
  it("uses canonical registered tools and deduplicates routes by tool identity", () => {
    expect(converterEntries.length).toBeGreaterThan(0);
    expect(new Set(converterToolIds).size).toBe(converterToolIds.length);
    for (const entry of converterEntries) {
      expect(getTool(entry.tool.slug)?.id).toBe(entry.tool.id);
      expect(entry.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("exposes categories from capabilities, including all supported families", () => {
    const families = new Set(conversionCapabilities.map(capability => capability.family));
    expect(new Set(converterEntries.map(entry => entry.category.family))).toEqual(families);
     expect(getConverterCategory("structured-data")?.name).toBe("Structured Data");
     expect(converterCategories.filter(category => category.name === "Images")).toHaveLength(1);
  });

  it("registers a Converters station without moving existing category ownership", () => {
     expect(getStation("converters")).toMatchObject({ route: "/stations/converters", toolCount: converterEntries.length });
     expect(converterEntries.filter(entry => entry.category.name === "Units & Temperature")).toHaveLength(2);
     expect(converterEntries.filter(entry => entry.category.name === "Numbers")).toHaveLength(1);
    expect(getConverterEntry("json-to-yaml")?.tool.category).toBe("JSON & Data");
  });
});
