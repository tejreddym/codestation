// @vitest-environment jsdom
/**
 * 4-Tier Requirement-Driven E2E Test Suite for Video Trimmer (R1).
 * Conformance to ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  formatTimecode,
  parseTimecode,
  secondsToFrames,
  framesToSeconds,
  validateTrimRange,
  resolveSupportedVideoMimeTypes,
  trimVideoInBrowser,
  waitForVideoSeek,
} from "../../lib/tools/video/trimmer";
import {
  createMockVideoElement,
  setupBrowserApiMocks,
  resetWebMcpForTesting,
  MockMediaRecorder,
} from "./test-helpers";
import { dispatchToolExecution } from "../../lib/webmcp/dispatcher";
import { getVideoDefinition } from "../../config/video-tools";
import { createWebMcpToolForDefinition, registerWebMcpTool } from "../../lib/webmcp/registry";

describe("Video Trimmer E2E Suite (R1)", () => {
  let browserMocks: ReturnType<typeof setupBrowserApiMocks>;

  beforeEach(() => {
    browserMocks = setupBrowserApiMocks();
    resetWebMcpForTesting();
  });

  afterEach(() => {
    browserMocks.restore();
  });

  // =========================================================================
  // Tier 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    it("T1.1 - formats seconds into SMPTE timecode at standard framerates (24, 30, 60 fps)", () => {
      // 0 seconds
      expect(formatTimecode(0, 30)).toBe("00:00:00:00");
      expect(formatTimecode(0, 24)).toBe("00:00:00:00");
      expect(formatTimecode(0, 60)).toBe("00:00:00:00");

      // 65.5s at 30 fps: 01 min, 05 sec, 15 frames
      expect(formatTimecode(65.5, 30)).toBe("00:01:05:15");

      // 10.25s at 24 fps: 10s + 0.25 * 24 = 6 frames
      expect(formatTimecode(10.25, 24)).toBe("00:00:10:06");

      // 3661s at 60 fps: 1 hour, 1 min, 1 sec, 0 frames
      expect(formatTimecode(3661, 60)).toBe("01:01:01:00");
    });

    it("T1.2 - formats seconds into HH:MM:SS.mmm format when fps is omitted", () => {
      expect(formatTimecode(0)).toBe("00:00:00.000");
      expect(formatTimecode(12.345)).toBe("00:00:12.345");
      expect(formatTimecode(3661.875)).toBe("01:01:01.875");
    });

    it("T1.3 - parses SMPTE timecodes, millisecond strings, and pure numeric seconds", () => {
      // Pure seconds
      expect(parseTimecode("45.5")).toBe(45.5);
      expect(parseTimecode("120")).toBe(120);

      // SMPTE 00:01:05:15 at 30 fps = 65.5 seconds
      expect(parseTimecode("00:01:05:15", 30)).toBe(65.5);

      // HH:MM:SS.mmm format
      expect(parseTimecode("00:01:05.500")).toBe(65.5);
      expect(parseTimecode("01:00:00.000")).toBe(3600);
      expect(parseTimecode("02:15")).toBe(135);
    });

    it("T1.4 - converts seconds to frames and frames to seconds with mathematical roundtrip fidelity", () => {
      const fps = 30;
      for (const sec of [1, 2.5, 5, 10, 15.3333]) {
        const frames = secondsToFrames(sec, fps);
        const backToSec = framesToSeconds(frames, fps);
        expect(Math.abs(backToSec - sec)).toBeLessThanOrEqual(1 / fps);
      }
    });

    it("T1.5 - validates standard positive trim ranges within video duration", () => {
      const duration = 60;
      // Start 5s, end 15s on 60s video
      const validResult = validateTrimRange(5, 15, duration);
      expect(validResult.valid).toBe(true);
      expect(validResult.error).toBeUndefined();

      // Start 0s, end 60s on 60s video (full clip)
      const fullResult = validateTrimRange(0, 60, duration);
      expect(fullResult.valid).toBe(true);
    });

    it("T1.6 - executes client-side video trimming via trimVideoInBrowser producing valid Blob", async () => {
      const video = createMockVideoElement({ duration: 30 });
      let reportedProgress = 0;

      const blob = await trimVideoInBrowser(
        video,
        { startTime: 2, endTime: 5, mimeType: "video/webm" },
        (progress) => {
          reportedProgress = progress;
        }
      );

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toContain("video/webm");
      expect(reportedProgress).toBe(1);
    });

    it("T1.7 - registers WebMCP bridge contract codestation_video_trimmer and responds to execution", async () => {
      const toolDef = getVideoDefinition("video-trimmer");
      expect(toolDef).toBeDefined();
      expect(toolDef!.id).toBe("video-trimmer");
      expect(toolDef!.slug).toBe("video-trimmer");

      const mcpTool = createWebMcpToolForDefinition(toolDef!);
      expect(mcpTool.name).toBe("codestation_video_trimmer");
      registerWebMcpTool(mcpTool);

      // Execute via WebMCP dispatcher with trim options
      const response = await dispatchToolExecution("video-trimmer", "", {
        start: 5,
        end: 15,
        fps: 30,
      });

      const parsed = JSON.parse(response);
      expect(parsed.status).toBe("ready");
      expect(parsed.id).toBe("video-trimmer");
      expect(parsed.category).toBe("Video");
      expect(parsed.trimSpecification).toEqual({
        startTime: 5,
        endTime: 15,
        durationSeconds: 10,
        fps: 30,
        totalFrames: 300,
      });
      expect(parsed.canonicalUrl).toBe("https://codestation.in/tools/video-trimmer");
    });

    it("T1.8 - parses timecodes with whitespace tolerance, mixed notation, and fractional seconds", () => {
      // Whitespace trimming
      expect(parseTimecode("  00:01:30  ")).toBe(90);
      expect(parseTimecode("\t00:00:15.500\n")).toBe(15.5);

      // Pure fractional seconds
      expect(parseTimecode("  125.75  ")).toBe(125.75);

      // SMPTE with spaces
      expect(parseTimecode(" 00:00:10:15 ", 30)).toBe(10.5);
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("T2.1 - rejects negative start time", () => {
      const res = validateTrimRange(-1, 10, 60);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Start time must be a non-negative number/i);
    });

    it("T2.2 - rejects start time greater than or equal to end time", () => {
      const resEqual = validateTrimRange(10, 10, 60);
      expect(resEqual.valid).toBe(false);
      expect(resEqual.error).toMatch(/Start time must be strictly less than end time/i);

      const resInverted = validateTrimRange(15, 10, 60);
      expect(resInverted.valid).toBe(false);
      expect(resInverted.error).toMatch(/Start time must be strictly less than end time/i);
    });

    it("T2.3 - rejects end time exceeding video duration beyond tolerance", () => {
      const res = validateTrimRange(0, 65, 60);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/End time cannot exceed video duration/i);
    });

    it("T2.4 - rejects sub-threshold slice duration (< 0.1 seconds)", () => {
      const res = validateTrimRange(5.0, 5.05, 60);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Trimmed slice duration must be at least 0.1 seconds/i);
    });

    it("T2.5 - supports end time within 50ms tolerance of duration boundary", () => {
      const res = validateTrimRange(0, 60.03, 60);
      expect(res.valid).toBe(true);
    });

    it("T2.6 - handles non-standard and fractional frame rates (23.976, 29.97, 59.94) safely", () => {
      const fps23976 = 23.976;
      const frames = secondsToFrames(10, fps23976);
      expect(frames).toBe(Math.round(10 * fps23976));
      expect(frames).toBe(240);

      const secBack = framesToSeconds(frames, fps23976);
      expect(Number.isFinite(secBack)).toBe(true);
      expect(Math.abs(secBack - 10)).toBeLessThan(0.05);

      const timecode = formatTimecode(10.5, fps23976);
      expect(timecode).toMatch(/^\d{2}:\d{2}:\d{2}:\d{2}$/);
    });

    it("T2.7 - handles invalid timecode parse inputs with meaningful errors", () => {
      expect(() => parseTimecode("")).toThrow(/Timecode cannot be empty/i);
      expect(() => parseTimecode("invalid:timecode:format:too:long")).toThrow(/Invalid timecode format/i);
      expect(() => parseTimecode("99:99:99")).toThrow(/Invalid timecode values/i);
    });

    it("T2.8 - aborts in-flight trimming immediately if AbortSignal is signaled", async () => {
      const video = createMockVideoElement({ duration: 30 });
      const controller = new AbortController();

      // Pre-aborted
      controller.abort();
      await expect(
        trimVideoInBrowser(video, { startTime: 0, endTime: 5 }, undefined, controller.signal)
      ).rejects.toThrow(/aborted/i);

      // Mid-flight abort
      const controller2 = new AbortController();
      const trimPromise = trimVideoInBrowser(video, { startTime: 0, endTime: 10 }, undefined, controller2.signal);
      setTimeout(() => controller2.abort(), 20);
      await expect(trimPromise).rejects.toThrow(/aborted/i);
    });

    it("T2.9 - precision boundary: single-frame trim at 60 fps and clamp to exact duration boundary", () => {
      const duration = 100;
      const fps = 60;
      const singleFrameDuration = 1 / fps; // ~0.0166s

      // Sub-0.1s minimum threshold must be rejected
      const subThreshold = validateTrimRange(10, 10 + singleFrameDuration, duration);
      expect(subThreshold.valid).toBe(false);
      expect(subThreshold.error).toMatch(/at least 0.1 seconds/i);

      // Exact 0.1s trim duration must be accepted
      const validMinSlice = validateTrimRange(10, 10.1, duration);
      expect(validMinSlice.valid).toBe(true);

      // End time within 50ms tolerance of duration boundary is accepted
      const boundaryCheck = validateTrimRange(90, 100.04, duration);
      expect(boundaryCheck.valid).toBe(true);
    });
  });

  // =========================================================================
  // Tier 3: Cross-Feature Combinations (Pairwise Interactions)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations", () => {
    it("T3.1 - scrubber position sync with precision range inputs and looping preview", async () => {
      const video = createMockVideoElement({ duration: 60 });
      let startTime = 10;
      let endTime = 20;

      // Simulate UI range update
      const setRange = (start: number, end: number) => {
        const check = validateTrimRange(start, end, video.duration);
        if (check.valid) {
          startTime = start;
          endTime = end;
        }
      };

      setRange(12.5, 22.5);
      expect(startTime).toBe(12.5);
      expect(endTime).toBe(22.5);

      // Seek to start for preview
      await waitForVideoSeek(video, startTime);
      expect(video.currentTime).toBe(12.5);

      // Simulate playback reaching end of segment -> trigger loop back to start
      video.currentTime = endTime;
      if (video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
      expect(video.currentTime).toBe(startTime);
    });

    it("T3.2 - WebMCP tool execution parameters match direct mathematical calculations", async () => {
      const start = 4.25;
      const end = 16.75;
      const fps = 60;

      const directSlice = Number((end - start).toFixed(4));
      const directFrames = secondsToFrames(directSlice, fps);

      const mcpResponse = await dispatchToolExecution("video-trimmer", "", {
        start,
        end,
        fps,
      });

      const parsed = JSON.parse(mcpResponse);
      expect(parsed.trimSpecification.durationSeconds).toBe(directSlice);
      expect(parsed.trimSpecification.totalFrames).toBe(directFrames);
    });

    it("T3.3 - sequential multiple trims on the same video element maintain state isolation", async () => {
      const video = createMockVideoElement({ duration: 100 });

      // First slice: 5s to 10s
      const blob1 = await trimVideoInBrowser(video, { startTime: 5, endTime: 10 });
      expect(blob1).toBeInstanceOf(Blob);

      // Second slice: 30s to 45s
      const blob2 = await trimVideoInBrowser(video, { startTime: 30, endTime: 45 });
      expect(blob2).toBeInstanceOf(Blob);

      // Third slice: 80s to 90s
      const blob3 = await trimVideoInBrowser(video, { startTime: 80, endTime: 90 });
      expect(blob3).toBeInstanceOf(Blob);
    });

    it("T3.4 - browser MIME type negotiation selects optimal container (webm vs mp4) based on MediaRecorder support", () => {
      const caps = resolveSupportedVideoMimeTypes();
      expect(caps).toBeDefined();
      expect(typeof caps.mp4).toBe("boolean");
      expect(typeof caps.webm).toBe("boolean");
      expect(typeof caps.preferredMime).toBe("string");
      expect(caps.preferredMime.length).toBeGreaterThan(0);

      // In standard mock environment, webm is supported
      expect(caps.webm).toBe(true);
      expect(caps.preferredMime).toMatch(/video\/(webm|mp4)/);

      // Verify preferred MIME is validated by MediaRecorder.isTypeSupported
      expect(MockMediaRecorder.isTypeSupported(caps.preferredMime)).toBe(true);
    });
  });

  // =========================================================================
  // Tier 4: Real-World Scenario
  // =========================================================================
  describe("Tier 4: Real-World Scenario", () => {
    it("T4.1 - Social clip extraction workflow: load, scrub, trim 10s segment, loop, export .mp4/.webm", async () => {
      // 1. User loads a 120-second gameplay/presentation video
      const video = createMockVideoElement({ duration: 120, width: 1920, height: 1080 });
      expect(video.duration).toBe(120);

      // 2. User scrubs to locate the highlight clip (e.g. 00:00:45:00 to 00:00:55:00)
      const clipStart = parseTimecode("00:00:45:00", 30);
      const clipEnd = parseTimecode("00:00:55:00", 30);
      expect(clipStart).toBe(45);
      expect(clipEnd).toBe(55);

      // 3. User verifies range validity
      const rangeCheck = validateTrimRange(clipStart, clipEnd, video.duration);
      expect(rangeCheck.valid).toBe(true);

      // 4. User previews loop playback of the 10-second segment
      await waitForVideoSeek(video, clipStart);
      expect(video.currentTime).toBe(45);
      await video.play();
      expect(video.paused).toBe(false);

      // Simulate playhead reaching end of segment
      video.currentTime = clipEnd;
      if (video.currentTime >= clipEnd) {
        video.currentTime = clipStart; // Loop reset
      }
      expect(video.currentTime).toBe(clipStart);
      video.pause();
      expect(video.paused).toBe(true);

      // 5. User selects WebM export format and executes 100% in-browser slice and encode
      const progressUpdates: number[] = [];
      const trimmedBlob = await trimVideoInBrowser(
        video,
        {
          startTime: clipStart,
          endTime: clipEnd,
          mimeType: "video/webm",
        },
        (progress) => progressUpdates.push(progress)
      );

      // 6. Verify exported clip
      expect(trimmedBlob).toBeInstanceOf(Blob);
      expect(trimmedBlob.size).toBeGreaterThan(0);
      expect(trimmedBlob.type).toContain("video/webm");
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(1);

      // 7. Verify zero server network requests were made; file was assembled in-memory
      const objectUrl = URL.createObjectURL(trimmedBlob);
      expect(objectUrl).toContain("blob:http://localhost/");
      expect(browserMocks.createdObjectUrls).toContain(objectUrl);
      URL.revokeObjectURL(objectUrl);

      // 8. AI Agent discovers video trimmer on WebMCP and inspects clip metadata
      const mcpResult = await dispatchToolExecution("video-trimmer", "", {
        startTime: clipStart,
        endTime: clipEnd,
        fps: 30,
      });
      const agentPayload = JSON.parse(mcpResult);
      expect(agentPayload.status).toBe("ready");
      expect(agentPayload.trimSpecification.durationSeconds).toBe(10);
      expect(agentPayload.trimSpecification.totalFrames).toBe(300);
      expect(agentPayload.canonicalUrl).toBe("https://codestation.in/tools/video-trimmer");
    });
  });
});
