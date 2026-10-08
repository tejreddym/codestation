import { describe, expect, it } from "vitest";
import { temperatureScales } from "@/config/temperature-tools";
import { convertTemperature, convertTemperatureValue } from "./engine";

describe("absolute temperature conversion", () => {
  it("catalogs exactly Celsius, Fahrenheit, and Kelvin", () => {
    expect(temperatureScales.map((scale) => scale.id)).toEqual(["celsius", "fahrenheit", "kelvin"]);
  });

  it.each([
    ["celsius", "fahrenheit", "0", 32],
    ["celsius", "kelvin", "100", 373.15],
    ["fahrenheit", "celsius", "32", 0],
    ["fahrenheit", "kelvin", "-459.67", 0],
    ["kelvin", "celsius", "273.15", 0],
    ["kelvin", "fahrenheit", "373.15", 212],
    ["celsius", "fahrenheit", "-40", -40],
  ] as const)("converts %s to %s", (from, to, input, expected) => expect(convertTemperatureValue(input, from, to)).toBeCloseTo(expected, 10));

  it("accepts the absolute-zero boundary and rejects anything below it", () => {
    expect(convertTemperature({ from: "celsius", to: "kelvin", value: "-273.15" }).text).toBe("0");
    expect(convertTemperature({ from: "celsius", to: "fahrenheit", value: "-273.15" }).value).toBeCloseTo(-459.67, 10);
    expect(convertTemperature({ from: "kelvin", to: "fahrenheit", value: "0" }).value).toBeCloseTo(-459.67, 10);
    expect(convertTemperature({ from: "fahrenheit", to: "celsius", value: "-459.67" }).value).toBeCloseTo(-273.15, 10);
    for (const [scale, value] of [["celsius", "-273.150001"], ["fahrenheit", "-459.670001"], ["kelvin", "-0.000001"]] as const) {
      expect(() => convertTemperatureValue(value, scale, "kelvin")).toThrow(/absolute zero/);
    }
  });

  it("rejects malformed, non-finite, and overlarge temperatures", () => {
    for (const value of ["", "1,000", "Infinity", "1e101", "1e-400", "hello"]) expect(() => convertTemperatureValue(value, "celsius", "fahrenheit")).toThrow();
  });
});
