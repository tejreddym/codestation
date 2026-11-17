import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPRESSOR_FIELDS,
  applyGainDb,
  estimateWavBytes,
  formatDb,
  gainReductionDb,
  measurePeakDb,
  measureRmsDb,
  normalizePeak,
  parseCompressorField,
  sanitizeCompressorFields,
} from "./compressor";

function constant(value: number, length = 100): Float32Array {
  return new Float32Array(length).fill(value);
}

describe("audio compressor helpers", () => {
  it("parses and clamps every numeric field with a visible error", () => {
    expect(parseCompressorField("threshold", "-24")).toEqual({ value: -24 });
    expect(parseCompressorField("ratio", "4").error).toBeUndefined();

    const tooLow = parseCompressorField("threshold", "-80");
    expect(tooLow.value).toBe(-60);
    expect(tooLow.error).toMatch(/between -60 and 0 dB/);
    expect(tooLow.error).toMatch(/clamped to -60/);

    const tooHigh = parseCompressorField("makeupGain", "30");
    expect(tooHigh.value).toBe(24);
    expect(tooHigh.error).toMatch(/clamped to 24/);

    const text = parseCompressorField("attack", "fast");
    expect(text.value).toBe(0.01);
    expect(text.error).toMatch(/default/);

    const empty = parseCompressorField("release", "");
    expect(empty.value).toBe(0.25);
    expect(empty.error).toMatch(/between 0 and 1/);
  });

  it("builds sanitized settings and reports only invalid fields", () => {
    const { settings, errors } = sanitizeCompressorFields(
      { ...DEFAULT_COMPRESSOR_FIELDS, threshold: "-80", knee: "10" },
      true,
    );
    expect(settings).toMatchObject({
      thresholdDb: -60,
      ratio: 4,
      attackSeconds: 0.01,
      releaseSeconds: 0.25,
      kneeDb: 10,
      makeupGainDb: 0,
      normalizePeak: true,
    });
    expect(Object.keys(errors)).toEqual(["threshold"]);
  });

  it("measures peak and RMS in dBFS with a silence floor", () => {
    const fullScale = [constant(1), constant(-1)];
    expect(measurePeakDb(fullScale)).toBeCloseTo(0, 5);
    expect(measurePeakDb([constant(0.5)])).toBeCloseTo(-6.0206, 3);
    expect(measurePeakDb([constant(0)])).toBe(-120);
    expect(measureRmsDb([constant(0.5)])).toBeCloseTo(-6.0206, 3);
    expect(measureRmsDb([constant(0)])).toBe(-120);
    expect(measureRmsDb([])).toBe(-120);
  });

  it("applies makeup gain without mutating the source", () => {
    const source = constant(0.25);
    const output = applyGainDb([source], 6.0206);
    expect(source[0]).toBeCloseTo(0.25);
    expect(output[0][0]).toBeCloseTo(0.5, 3);
  });

  it("normalises the peak to the requested ceiling and leaves silence untouched", () => {
    const normalised = normalizePeak([constant(0.5)], -1);
    expect(normalised.gainDb).toBeCloseTo(5.0206, 3);
    expect(measurePeakDb(normalised.channels)).toBeCloseTo(-1, 3);

    const silent = normalizePeak([constant(0)], -1);
    expect(silent.gainDb).toBe(0);
    expect(measurePeakDb(silent.channels)).toBe(-120);
  });

  it("computes gain reduction as a non-negative measured delta", () => {
    expect(gainReductionDb(-20, -24)).toBeCloseTo(4);
    expect(gainReductionDb(-24, -20)).toBe(0);
    expect(gainReductionDb(Number.NaN, -20)).toBe(0);
  });

  it("estimates 16-bit PCM WAV size and formats dB labels", () => {
    expect(estimateWavBytes(1000, 2)).toBe(44 + 4000);
    expect(estimateWavBytes(-10, 2)).toBe(44);
    expect(formatDb(-6.0206)).toBe("-6.0 dBFS");
    expect(formatDb(-120)).toBe("≤ -120 dBFS");
    expect(formatDb(Number.NEGATIVE_INFINITY)).toBe("≤ -120 dBFS");
  });
});
