import { describe, expect, it } from "vitest";
import { extractPalette } from "./palette";

describe("deterministic sampled alpha-weighted palette", () => {
  it("excludes transparent colors and weights semitransparent colors by actual alpha", () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128, 0, 255, 0, 0]);
    expect(extractPalette(pixels, 2)).toEqual([
      { hex: "#FF0000", rgb: { r: 255, g: 0, b: 0 }, percentage: 66.6 },
      { hex: "#0000FF", rgb: { r: 0, g: 0, b: 255 }, percentage: 33.4 },
    ]);
  });
  it("returns actual unique colors rather than fabricated duplicate padding", () => {
    expect(extractPalette(new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 255]), 12)).toEqual([{ hex: "#010203", rgb: { r: 1, g: 2, b: 3 }, percentage: 100 }]);
  });
  it("deterministically clusters gradients without exceeding the requested count", () => {
    const pixels = new Uint8ClampedArray(256 * 4); for (let i = 0; i < 256; i++) pixels.set([i, i, i, 255], i * 4);
    const palette = extractPalette(pixels, 4); expect(palette).toHaveLength(4); expect(extractPalette(pixels, 4)).toEqual(palette); expect(palette.reduce((sum, p) => sum + p.percentage, 0)).toBeCloseTo(100, 0);
  });
  it.each([0, 1, 13, 2.5, NaN])("rejects invalid cluster count %s", count => expect(() => extractPalette(new Uint8ClampedArray([0, 0, 0, 255]), count)).toThrow());
  it("rejects fully transparent/empty samples", () => { expect(() => extractPalette(new Uint8ClampedArray(4), 2)).toThrow(/visible/); expect(() => extractPalette(new Uint8ClampedArray(), 2)).toThrow(/visible/); });
});
