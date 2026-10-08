import { describe, expect, it } from "vitest";
import { dateTimeTools, isDateTimeToolId } from "./date-time-tools";
import { getTool, tools } from "./tools";

describe("Date & Time discovery", () => {
  it("registers 17 exact contracts with the canonical Unix converter", () => {
    expect(dateTimeTools).toHaveLength(17);
    expect(new Set(tools.map((tool) => tool.slug)).size).toBe(tools.length);
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length);
    expect(getTool("unix-timestamp-converter")).toMatchObject({ category: "Date & Time", featured: true });
    expect(getTool("timestamp-converter")).toBeUndefined();
    expect(isDateTimeToolId("timestamp-converter")).toBe(false);
    expect(isDateTimeToolId("not-a-tool")).toBe(false);
  });

  it.each(dateTimeTools)("exposes $id to routes, search, and the station listing", (tool) => {
    expect(getTool(tool.slug)).toEqual(tool);
    expect(tool.category).toBe("Date & Time");
    expect(tool.description.length).toBeGreaterThan(30);
    expect(tool.keywords.length).toBeGreaterThan(2);
    expect(isDateTimeToolId(tool.id)).toBe(true);
  });

  it("pairs date/timestamp directions while keeping distinct identities", () => {
    const forward = getTool("date-to-timestamp")!;
    const reverse = getTool(forward.pairedTool!)!;
    expect(reverse.pairedTool).toBe(forward.id);
    expect(reverse.pairId).toBe(forward.pairId);
    expect(reverse.inputFormat).toBe(forward.outputFormat);
    expect(reverse.direction).not.toBe(forward.direction);
  });
});
