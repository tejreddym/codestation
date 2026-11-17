import { describe, expect, it } from "vitest";
import {
  MERGER_MAX_DURATION_SECONDS,
  assembleMerge,
  mergedFilename,
  parseGapField,
  planMerge,
  resampledLength,
  writeSourceInto,
} from "./merger";

function fakeBuffer(channels: number[][], sampleRate: number): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    getChannelData: (index: number) => Float32Array.from(channels[index] ?? []),
  } as unknown as AudioBuffer;
}

describe("audio merger helpers", () => {
  it("validates and clamps the optional gap", () => {
    expect(parseGapField("0").error).toBeUndefined();
    expect(parseGapField("2.5")).toEqual({ seconds: 2.5 });
    expect(parseGapField("")).toEqual({
      seconds: 0,
      error: expect.stringContaining("between 0 and 5 seconds"),
    });
    expect(parseGapField("9")).toEqual({
      seconds: 5,
      error: expect.stringContaining("clamped to 5"),
    });
    expect(parseGapField("abc").seconds).toBe(0);
  });

  it("plans the highest sample rate, stereo output, gaps and the 30-minute limit", () => {
    const inputs = [
      { sampleRate: 8000, numberOfChannels: 1, length: 8000 },
      { sampleRate: 16000, numberOfChannels: 2, length: 16000 },
    ];
    const plan = planMerge(inputs, 0.5);
    expect(plan.targetSampleRate).toBe(16000);
    expect(plan.targetChannels).toBe(2);
    expect(plan.gapFrames).toBe(8000);
    expect(plan.resampledLengths).toEqual([16000, 16000]);
    expect(plan.totalFrames).toBe(40000);
    expect(plan.totalDuration).toBe(2.5);
    expect(plan.withinLimit).toBe(true);
    expect(plan.reason).toBeUndefined();

    const oversized = planMerge(
      [{ sampleRate: 48000, numberOfChannels: 2, length: 48000 * 2000 }],
      0,
    );
    expect(oversized.withinLimit).toBe(false);
    expect(oversized.totalDuration).toBe(2000);
    expect(oversized.reason).toMatch(/33:20/);
    expect(oversized.reason).toMatch(/30:00 limit/);
    expect(MERGER_MAX_DURATION_SECONDS).toBe(1800);
  });

  it("calculates resampled lengths deterministically", () => {
    expect(resampledLength(8000, 8000, 16000)).toBe(16000);
    expect(resampledLength(16000, 16000, 8000)).toBe(8000);
    expect(resampledLength(0, 16000, 8000)).toBe(0);
  });

  it("duplicates mono to both channels and inserts digital silence", () => {
    const first = fakeBuffer([Array(8000).fill(0.5)], 8000);
    const second = fakeBuffer([Array(8000).fill(1), Array(8000).fill(-1)], 8000);
    const plan = planMerge([first, second], 1);
    const merged = assembleMerge([first, second], plan);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toHaveLength(8000 * 3);
    for (let index = 0; index < 8000; index += 1) {
      expect(merged[0][index]).toBeCloseTo(0.5);
      expect(merged[1][index]).toBeCloseTo(0.5);
    }
    for (let index = 8000; index < 16000; index += 1) {
      expect(merged[0][index]).toBe(0);
      expect(merged[1][index]).toBe(0);
    }
    expect(merged[0][16000]).toBe(1);
    expect(merged[1][16000]).toBe(-1);
  });

  it("upsamples lower-rate sources with linear interpolation", () => {
    const source = fakeBuffer([[0, 1, 0, -1]], 4000);
    const plan = planMerge([source], 0);
    expect(plan.targetSampleRate).toBe(4000);
    const upsampledPlan = { ...plan, targetSampleRate: 8000, totalFrames: 8, resampledLengths: [8] };
    const target = [new Float32Array(8), new Float32Array(8)];
    expect(writeSourceInto(target, 0, source, 8000)).toBe(8);
    expect(target[0][0]).toBeCloseTo(0);
    expect(target[0][1]).toBeCloseTo(0.5);
    expect(target[0][2]).toBeCloseTo(1);
    expect(target[0][3]).toBeCloseTo(0.5);
    expect(target[0][4]).toBeCloseTo(0);
    expect(target[0][5]).toBeCloseTo(-0.5);
    expect(target[1][2]).toBeCloseTo(1);
    expect(upsampledPlan.targetSampleRate).toBe(8000);
  });

  it("names the merged output from the first file", () => {
    expect(mergedFilename("Intro Track.mp3")).toBe("Intro Track-merged.wav");
    expect(mergedFilename("audio")).toBe("audio-merged.wav");
  });
});
