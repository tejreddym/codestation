import { describe, expect, it } from "vitest";
import { unitCatalog, unitCategories, unitDefinitions } from "@/config/unit-tools";
import { convertUnit, convertUnitValue } from "./engine";

describe("unit catalog and pure conversion engine", () => {
  it("exposes all requested dimensions and non-empty authoritative units", () => {
    expect(unitCategories).toEqual(["length", "mass", "area", "volume", "speed", "digital"]);
    for (const category of unitCategories) expect(unitCatalog[category].length).toBeGreaterThan(1);
    expect(new Set(unitDefinitions.map((unit) => unit.id)).size).toBe(unitDefinitions.length);
  });

  it.each([
    ["length", "inch", "meter", "1", 0.0254],
    ["length", "foot", "meter", "1", 0.3048],
    ["length", "kilometer", "mile", "1", 0.621371192237334],
    ["mass", "pound", "kilogram", "1", 0.45359237],
    ["area", "acre", "square-meter", "1", 4046.8564224],
    ["volume", "us-gallon", "liter", "1", 3.785411784],
    ["volume", "liter", "cubic-meter", "1", 0.001],
    ["volume", "imperial-gallon", "liter", "1", 4.54609],
    ["speed", "mile-per-hour", "kilometer-per-hour", "60", 96.56064],
    ["digital", "byte", "bit", "1", 8],
    ["digital", "kilobyte", "byte", "1", 1000],
    ["digital", "kibibyte", "byte", "1", 1024],
    ["digital", "gibibyte", "byte", "1", 1_073_741_824],
  ] as const)("converts %s values without cross-category aliases", (category, from, to, input, expected) => {
    expect(convertUnitValue(input, from, to, category)).toBeCloseTo(expected, 10);
  });

  it("returns a stable display value and preserves the source input", () => {
    expect(convertUnit({ category: "length", from: "meter", to: "centimeter", value: "-1.50" })).toEqual({
      category: "length", from: "meter", to: "centimeter", input: "-1.50", value: -150, text: "-150",
    });
  });

  it("rejects malformed, non-finite, overlarge, and cross-category requests", () => {
    for (const value of ["", "1,000", "Infinity", "NaN", "1e101", "1e-400", "."]) expect(() => convertUnitValue(value, "meter", "foot")).toThrow();
    expect(() => convertUnitValue("1", "meter", "gram", "length")).toThrow();
    expect(() => convertUnitValue("1", "meter", "foot", "mass")).toThrow();
    expect(() => convertUnitValue(Number.POSITIVE_INFINITY, "meter", "foot")).toThrow();
  });
});
