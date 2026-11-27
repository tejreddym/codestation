// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  formatTimecode,
  parseTimecode,
  secondsToFrames,
  framesToSeconds,
  validateTrimRange,
  resolveSupportedVideoMimeTypes,
  trimVideoInBrowser,
  waitForVideoSeek,
} from "./trimmer";

describe("Video Trimmer Pure Calculations", () => {
  describe("formatTimecode", () => {
    it("formats zero seconds correctly", () => {
      expect(formatTimecode(0)).toBe("00:00:00.000");
      expect(formatTimecode(0, 30)).toBe("00:00:00:00");
    });

    it("formats seconds without fps as milliseconds", () => {
      expect(formatTimecode(65.5)).toBe("00:01:05.500");
      expect(formatTimecode(3661.125)).toBe("01:01:01.125");
    });

    it("formats seconds with fps as frames", () => {
      // 65.5s at 30fps: 0.5 * 30 = 15 frames
      expect(formatTimecode(65.5, 30)).toBe("00:01:05:15");
      // 10s at 24fps
      expect(formatTimecode(10, 24)).toBe("00:00:10:00");
      // 10.5s at 24fps: 0.5 * 24 = 12 frames
      expect(formatTimecode(10.5, 24)).toBe("00:00:10:12");
    });

    it("handles negative and non-finite values safely", () => {
      expect(formatTimecode(-5)).toBe("00:00:00.000");
      expect(formatTimecode(-5, 30)).toBe("00:00:00:00");
      expect(formatTimecode(NaN)).toBe("00:00:00.000");
      expect(formatTimecode(Infinity)).toBe("00:00:00.000");
    });

    it("handles fractional frame rates correctly without dropping final frames", () => {
      // 29.97 fps (NTSC): nominal 30 fps, final frame index is 29
      expect(formatTimecode(29 / 29.97, 29.97)).toBe("00:00:00:29");
      // 23.976 fps (Film): nominal 24 fps, final frame index is 23
      expect(formatTimecode(23 / 23.976, 23.976)).toBe("00:00:00:23");
      // 59.94 fps: nominal 60 fps, final frame index is 59
      expect(formatTimecode(59 / 59.94, 59.94)).toBe("00:00:00:59");
    });

    it("safely falls back to millisecond format when fps is Infinity", () => {
      expect(formatTimecode(10.5, Infinity)).toBe("00:00:10.500");
    });
  });

  describe("parseTimecode", () => {
    it("parses numeric strings", () => {
      expect(parseTimecode("45.5")).toBe(45.5);
      expect(parseTimecode("0")).toBe(0);
      expect(parseTimecode("120")).toBe(120);
    });

    it("parses SMPTE HH:MM:SS:FF format with fps", () => {
      // 00:01:05:15 at 30fps -> 60 + 5 + 15/30 = 65.5
      expect(parseTimecode("00:01:05:15", 30)).toBe(65.5);
      expect(parseTimecode("01:00:00:00", 30)).toBe(3600);
    });

    it("parses HH:MM:SS.mmm format", () => {
      expect(parseTimecode("00:01:05.500")).toBe(65.5);
      expect(parseTimecode("01:02:03.250")).toBe(3723.25);
    });

    it("parses MM:SS and MM:SS.mmm formats", () => {
      expect(parseTimecode("02:30")).toBe(150);
      expect(parseTimecode("01:15.500")).toBe(75.5);
    });

    it("throws on invalid formats and values", () => {
      expect(() => parseTimecode("")).toThrow();
      expect(() => parseTimecode("invalid")).toThrow();
      expect(() => parseTimecode("00:99:00:00")).toThrow();
      expect(() => parseTimecode("00:00:99:00")).toThrow();
      expect(() => parseTimecode("-01:00:00")).toThrow();
      expect(() => parseTimecode("1:2:3:4:5")).toThrow();
      expect(() => parseTimecode("00:00:00:30", 29.97)).toThrow(/exceeds frame rate/);
      expect(() => parseTimecode("00:00:00:99", 30)).toThrow(/exceeds frame rate/);
    });

    it("round-trips all frames 0..29 at 29.97 fps", () => {
      for (let f = 0; f < 30; f++) {
        const expected = `00:00:00:${String(f).padStart(2, "0")}`;
        const seconds = parseTimecode(expected, 29.97);
        const formatted = formatTimecode(seconds, 29.97);
        expect(formatted).toBe(expected);
      }
    });
  });

  describe("secondsToFrames & framesToSeconds", () => {
    it("converts seconds to frames at 30 fps", () => {
      expect(secondsToFrames(0, 30)).toBe(0);
      expect(secondsToFrames(1, 30)).toBe(30);
      expect(secondsToFrames(1.5, 30)).toBe(45);
      expect(secondsToFrames(2.997, 29.97)).toBe(90);
    });

    it("converts frames to seconds at 30 fps", () => {
      expect(framesToSeconds(0, 30)).toBe(0);
      expect(framesToSeconds(30, 30)).toBe(1);
      expect(framesToSeconds(45, 30)).toBe(1.5);
    });

    it("handles boundary inputs gracefully", () => {
      expect(secondsToFrames(-5, 30)).toBe(0);
      expect(framesToSeconds(-10, 30)).toBe(0);
      expect(secondsToFrames(5, 0)).toBe(0);
      expect(framesToSeconds(5, 0)).toBe(0);
    });
  });

  describe("validateTrimRange", () => {
    const duration = 60;

    it("accepts valid slice within duration", () => {
      expect(validateTrimRange(10, 20, duration)).toEqual({ valid: true });
      expect(validateTrimRange(0, 60, duration)).toEqual({ valid: true });
    });

    it("rejects negative start time", () => {
      const res = validateTrimRange(-1, 10, duration);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Start time must be a non-negative/);
    });

    it("rejects non-positive end time", () => {
      const res = validateTrimRange(0, 0, duration);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/End time must be greater than zero/);
    });

    it("rejects start time >= end time", () => {
      const res = validateTrimRange(15, 10, duration);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Start time must be strictly less than end time/);
    });

    it("rejects start time >= duration", () => {
      const res = validateTrimRange(65, 70, duration);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Start time cannot exceed/);
    });

    it("rejects end time beyond duration (outside tolerance)", () => {
      const res = validateTrimRange(10, 65, duration);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/End time cannot exceed/);
    });

    it("allows end time within 50ms tolerance of duration boundary", () => {
      expect(validateTrimRange(10, 60.03, duration)).toEqual({ valid: true });
    });

    it("rejects slice duration under 0.1s", () => {
      const res = validateTrimRange(10, 10.05, duration);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/must be at least 0.1 seconds/);
    });

    it("evaluates high boundary floating-point precision properly", () => {
      expect(validateTrimRange(119.9, 120.0, 120.0)).toEqual({ valid: true });
    });
  });

  describe("resolveSupportedVideoMimeTypes", () => {
    it("reports capability based on MediaRecorder.isTypeSupported", () => {
      const originalMediaRecorder = window.MediaRecorder;

      // Mock MediaRecorder supporting webm
      (window as any).MediaRecorder = {
        isTypeSupported: (type: string) => type.includes("webm"),
      };

      const caps = resolveSupportedVideoMimeTypes();
      expect(caps.webm).toBe(true);
      expect(caps.preferredMime).toContain("webm");

      // Mock MediaRecorder supporting mp4
      (window as any).MediaRecorder = {
        isTypeSupported: (type: string) => type.includes("mp4"),
      };

      const mp4Caps = resolveSupportedVideoMimeTypes();
      expect(mp4Caps.mp4).toBe(true);
      expect(mp4Caps.preferredMime).toContain("mp4");

      window.MediaRecorder = originalMediaRecorder;
    });
  });
});

describe("In-Browser Video Trimmer Engine", () => {
  it("rejects immediately if signal is already aborted", async () => {
    const video = document.createElement("video");
    const controller = new AbortController();
    controller.abort();

    await expect(
      trimVideoInBrowser(video, { startTime: 0, endTime: 5 }, undefined, controller.signal)
    ).rejects.toThrow(/aborted/);
  });

  it("rejects on invalid trim range", async () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "duration", { value: 10, writable: true });

    await expect(
      trimVideoInBrowser(video, { startTime: 8, endTime: 5 })
    ).rejects.toThrow(/Start time must be strictly less than end time/);
  });

  it("handles seek wait and resolves when target time is already matched", async () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "duration", { value: 10, writable: true });
    video.currentTime = 5.0;

    await expect(waitForVideoSeek(video, 5.0)).resolves.toBeUndefined();
  });

  it("records video stream chunks and returns assembled Blob", async () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "duration", { value: 30, writable: true });

    let currentTimeVal = 0;
    Object.defineProperty(video, "currentTime", {
      get: () => currentTimeVal,
      set: (val: number) => {
        currentTimeVal = val;
        setTimeout(() => video.dispatchEvent(new Event("seeked")), 0);
      },
      configurable: true,
    });

    // Mock captureStream
    const mockTrack = { stop: vi.fn(), kind: "video" };
    const mockStream = {
      getTracks: () => [mockTrack],
    } as unknown as MediaStream;

    (video as any).captureStream = () => mockStream;
    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();

    // Mock MediaRecorder
    class MockMediaRecorder {
      state = "inactive";
      mimeType = "video/webm";
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;

      start() {
        this.state = "recording";
        setTimeout(() => {
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(["sample-video-chunk"], { type: "video/webm" }) });
          }
        }, 10);
      }

      stop() {
        this.state = "inactive";
        setTimeout(() => {
          if (this.onstop) this.onstop();
        }, 10);
      }
    }

    (window as any).MediaRecorder = MockMediaRecorder;
    (window as any).MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    const progressUpdates: number[] = [];
    const trimPromise = trimVideoInBrowser(
      video,
      { startTime: 2, endTime: 6, mimeType: "video/webm" },
      (p) => progressUpdates.push(p)
    );

    // Simulate video playing past endTime
    setTimeout(() => {
      currentTimeVal = 4;
      video.dispatchEvent(new Event("timeupdate"));
    }, 30);

    setTimeout(() => {
      currentTimeVal = 6.0;
      video.dispatchEvent(new Event("timeupdate"));
    }, 60);

    const resultBlob = await trimPromise;
    expect(resultBlob).toBeInstanceOf(Blob);
    expect(resultBlob.type).toBe("video/webm");
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(video.pause).toHaveBeenCalled();
  });

  it("rejects with AbortError when aborted during recording without race condition", async () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "duration", { value: 30, writable: true });
    Object.defineProperty(video, "currentTime", { value: 2, writable: true });

    const mockTrack = { stop: vi.fn(), kind: "video" };
    const mockStream = { getTracks: () => [mockTrack] } as unknown as MediaStream;
    (video as any).captureStream = () => mockStream;
    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();

    class SynchronousStopRecorder {
      state = "inactive";
      mimeType = "video/webm";
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        if (this.onstop) this.onstop();
      }
    }

    (window as any).MediaRecorder = SynchronousStopRecorder;
    (window as any).MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    const controller = new AbortController();
    const trimPromise = trimVideoInBrowser(
      video,
      { startTime: 2, endTime: 6 },
      undefined,
      controller.signal
    );

    controller.abort();

    await expect(trimPromise).rejects.toThrow(/aborted/);
  });
});
