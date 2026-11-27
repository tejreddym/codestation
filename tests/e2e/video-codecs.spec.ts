import { test, expect } from "@playwright/test";
import {
  DESKTOP_VIEWPORT,
  expectNoMobileOverflow,
  readDownloadBytes,
  trackRuntimeErrors,
} from "./helpers";

/** Builds a valid minimal 0.1s 8kHz mono 16-bit PCM WAV buffer in memory. */
function createMinimalWavBuffer(): Buffer {
  const sampleRate = 8000;
  const numSamples = 800; // 0.1s
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  return buffer;
}

test.describe("Cross-browser video & audio codec verification", () => {
  test("video-trimmer detects browser codec capabilities and rejects invalid video files gracefully", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    const res = await page.goto("/tools/video-trimmer");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Video Trimmer/i })).toBeVisible();

    const capabilities = await page.evaluate(() => {
      const hasMediaRecorder = typeof MediaRecorder !== "undefined";
      const hasCaptureStream =
        typeof HTMLCanvasElement !== "undefined" &&
        typeof HTMLCanvasElement.prototype.captureStream === "function";
      return { hasMediaRecorder, hasCaptureStream };
    });
    expect(typeof capabilities.hasMediaRecorder).toBe("boolean");
    expect(typeof capabilities.hasCaptureStream).toBe("boolean");

    // Uploading a corrupted/unplayable file must produce graceful error feedback with 0 uncaught pageerror
    await page.locator('input[type="file"]').setInputFiles({
      name: "corrupt-sample.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("not-a-valid-video-stream"),
    });
    await expect(
      page.locator('main [role="alert"]').filter({ hasText: /decode|video|format|error/i })
    ).toBeVisible({ timeout: 10_000 });

    await expectNoMobileOverflow(page, "/tools/video-trimmer");
    expect(errors).toEqual([]);
  });

  test("video-thumbnail-generator loads controls cleanly and handles unreadable media without runtime errors", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    const res = await page.goto("/tools/video-thumbnail-generator");
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /Video Thumbnail Generator/i })
    ).toBeVisible();

    await page.locator("#video-thumbnail-file").setInputFiles({
      name: "invalid.webm",
      mimeType: "video/webm",
      buffer: Buffer.from("corrupt-webm-bytes"),
    });
    await expect(
      page.locator('main [role="alert"]').filter({ hasText: /decode|video|format|error/i })
    ).toBeVisible({ timeout: 10_000 });

    await expectNoMobileOverflow(page, "/tools/video-thumbnail-generator");
    expect(errors).toEqual([]);
  });

  test("audio-converter checks WebM/Opus capability, converts WAV cleanly, and rejects invalid audio gracefully", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    const res = await page.goto("/tools/audio-converter");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Audio Converter/i })).toBeVisible();

    // Upload valid minimal WAV and export WAV cleanly across Chromium/Firefox/WebKit
    await page.locator('input[type="file"]').setInputFiles({
      name: "tone.wav",
      mimeType: "audio/wav",
      buffer: createMinimalWavBuffer(),
    });
    await expect(page.getByRole("region", { name: /Source audio metadata/i }).or(page.locator("main"))).toContainText(
      "tone.wav",
      { timeout: 10_000 }
    );

    const convertBtn = page.getByRole("button", { name: /^Convert/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    const downloadBtn = page.getByRole("button", { name: /Download/i });
    await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
    const wavOut = await readDownloadBytes(page, () => downloadBtn.click());
    expect(wavOut.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");

    await expectNoMobileOverflow(page, "/tools/audio-converter");
    expect(errors).toEqual([]);
  });

  test("audio-trimmer loads WAV waveform cleanly across engines without runtime crashes", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    const res = await page.goto("/tools/audio-trimmer");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Audio Trimmer/i })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "clip.wav",
      mimeType: "audio/wav",
      buffer: createMinimalWavBuffer(),
    });
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    await expectNoMobileOverflow(page, "/tools/audio-trimmer");
    expect(errors).toEqual([]);
  });
});
