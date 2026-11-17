import { describe, expect, it } from "vitest";
import {
  MAX_THUMBNAIL_DIMENSION,
  clampFrameCount,
  evenTimestamps,
  formatDuration,
  frameFilename,
  isVideoFile,
  sanitizeBaseName,
  scaledDimensions,
} from "./thumbnail";

describe("video thumbnail helpers", () => {
  it("clamps intentional frame counts to 1–12", () => {
    expect(clampFrameCount(0)).toBe(1);
    expect(clampFrameCount(3)).toBe(3);
    expect(clampFrameCount(99)).toBe(12);
    expect(clampFrameCount(2.9)).toBe(2);
    expect(clampFrameCount(Number.NaN)).toBe(1);
  });

  it("spaces timestamps through the centre of each slot", () => {
    expect(evenTimestamps(3, 3)).toEqual([0.5, 1.5, 2.5]);
    expect(evenTimestamps(2, 4)).toEqual([0.25, 0.75, 1.25, 1.75]);
    expect(evenTimestamps(10, 1)).toEqual([5]);
    expect(() => evenTimestamps(0, 3)).toThrow(/positive video duration/);
  });

  it("scales down without upscaling and clamps every dimension", () => {
    expect(scaledDimensions(3840, 2160, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(scaledDimensions(640, 360, 1920)).toEqual({ width: 640, height: 360 });
    expect(scaledDimensions(640, 360, "original")).toEqual({ width: 640, height: 360 });
    expect(scaledDimensions(5000, 3000, "original")).toEqual({ width: 4096, height: 2458 });
    expect(scaledDimensions(3000, 5000, 640)).toEqual({ width: 640, height: 1067 });
    expect(Math.max(...Object.values(scaledDimensions(8000, 8000, 1920)))).toBeLessThanOrEqual(MAX_THUMBNAIL_DIMENSION);
    expect(() => scaledDimensions(0, 10, 640)).toThrow(/positive/);
  });

  it("formats durations and names frame files safely", () => {
    expect(formatDuration(5)).toBe("0:05.0");
    expect(formatDuration(65.25)).toBe("1:05.3");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0:00.0");
    expect(sanitizeBaseName("My Family Video (final).MP4")).toBe("my-family-video-final");
    expect(sanitizeBaseName("...")).toBe("video");
    expect(frameFilename("My Video.mp4", 2, 1.5, "png")).toBe("my-video-frame-02-1.500s.png");
    expect(frameFilename("clip.webm", 3, 0, "jpeg")).toBe("clip-frame-03-0.000s.jpg");
  });

  it("accepts video MIME types and known extensions only", () => {
    expect(isVideoFile("clip.mp4", "")).toBe(true);
    expect(isVideoFile("clip.mov", "application/octet-stream")).toBe(true);
    expect(isVideoFile("clip", "video/webm")).toBe(true);
    expect(isVideoFile("track.mp3", "audio/mpeg")).toBe(false);
    expect(isVideoFile("notes.txt", "text/plain")).toBe(false);
  });
});
