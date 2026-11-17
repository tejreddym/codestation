import { describe, expect, it } from "vitest";
import {
  CONVERTER_BITRATES,
  DEFAULT_WEBM_BITRATE,
  WEBM_OPUS_MIME,
  WEBM_OPUS_SAMPLE_RATE,
  converterFilename,
  converterFormatLabel,
  converterMimeType,
  formatBytes,
  sanitizeBitrate,
  webmOpusSupported,
} from "./converter";

describe("audio converter helpers", () => {
  it("accepts only the documented WebM bitrates", () => {
    expect(CONVERTER_BITRATES).toEqual([96, 128, 192]);
    expect(sanitizeBitrate("96")).toBe(96);
    expect(sanitizeBitrate(192)).toBe(192);
    expect(sanitizeBitrate("320")).toBe(DEFAULT_WEBM_BITRATE);
    expect(sanitizeBitrate("")).toBe(DEFAULT_WEBM_BITRATE);
    expect(sanitizeBitrate("fast")).toBe(DEFAULT_WEBM_BITRATE);
  });

  it("detects WebM/Opus support without throwing", () => {
    expect(webmOpusSupported({ isTypeSupported: mime => mime === WEBM_OPUS_MIME })).toBe(true);
    expect(webmOpusSupported({ isTypeSupported: () => false })).toBe(false);
    expect(webmOpusSupported({})).toBe(false);
    expect(webmOpusSupported(null)).toBe(false);
    expect(webmOpusSupported({
      isTypeSupported: () => {
        throw new Error("probe failed");
      },
    })).toBe(false);
  });

  it("never changes the chosen extension or MIME type", () => {
    expect(WEBM_OPUS_SAMPLE_RATE).toBe(48_000);
    expect(converterFilename("Voice Memo.m4a", "wav")).toBe("Voice Memo-converted.wav");
    expect(converterFilename("Voice Memo.m4a", "webm")).toBe("Voice Memo-converted.webm");
    expect(converterFilename("audio", "webm")).toBe("audio-converted.webm");
    expect(converterMimeType("wav")).toBe("audio/wav");
    expect(converterMimeType("webm")).toBe(WEBM_OPUS_MIME);
    expect(converterFormatLabel("wav")).toMatch(/16-bit PCM/);
    expect(converterFormatLabel("webm")).toMatch(/Opus/);
  });

  it("formats output sizes for the result summary", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(Number.NaN)).toBe("Unknown size");
  });
});
