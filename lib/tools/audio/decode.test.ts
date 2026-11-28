// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeAudioFile, isAudioFile, readChannels } from "./decode";

function makeWavTestFile(): File {
  const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
  return {
    name: "tone.wav",
    type: "audio/wav",
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as unknown as File;
}

describe("audio decode helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "OfflineAudioContext");
    Reflect.deleteProperty(window, "webkitOfflineAudioContext");
    Reflect.deleteProperty(window, "AudioContext");
    Reflect.deleteProperty(window, "webkitAudioContext");
  });

  it("recognises audio MIME types and common audio extensions", () => {
    expect(isAudioFile("track.mp3", "audio/mpeg")).toBe(true);
    expect(isAudioFile("track.unknown", "audio/mpeg")).toBe(true);
    expect(isAudioFile("TRACK.M4A", "")).toBe(true);
    expect(isAudioFile("track.webm", "video/webm")).toBe(true);
    expect(isAudioFile("document.pdf", "application/pdf")).toBe(false);
    expect(isAudioFile("clip.mp4", "video/mp4")).toBe(false);
  });

  it("reads each channel from an AudioBuffer as a Float32Array", () => {
    const channel0 = new Float32Array([0.1, 0.2]);
    const channel1 = new Float32Array([-0.1, -0.2]);
    const buffer = {
      numberOfChannels: 2,
      getChannelData: (index: number) => (index === 0 ? channel0 : channel1),
    } as unknown as AudioBuffer;
    const channels = readChannels(buffer);
    expect(channels).toHaveLength(2);
    expect(channels[0]).toHaveLength(2);
    expect(channels[0][0]).toBeCloseTo(0.1);
    expect(channels[0][1]).toBeCloseTo(0.2);
    expect(channels[1][0]).toBeCloseTo(-0.1);
    expect(channels[1][1]).toBeCloseTo(-0.2);
  });

  it("prefers OfflineAudioContext over hardware AudioContext when decoding", async () => {
    const fakeBuffer = { duration: 0.1, sampleRate: 44100 } as AudioBuffer;
    const decodeAudioData = vi.fn().mockResolvedValue(fakeBuffer);
    const offlineCtor = vi.fn().mockImplementation(() => ({ decodeAudioData }));
    const audioCtor = vi.fn();

    Object.defineProperty(window, "OfflineAudioContext", {
      configurable: true,
      writable: true,
      value: offlineCtor,
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: audioCtor,
    });

    const result = await decodeAudioFile(makeWavTestFile());
    expect(result).toBe(fakeBuffer);
    expect(offlineCtor).toHaveBeenCalledWith(1, 1, 44100);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(audioCtor).not.toHaveBeenCalled();
  });

  it("falls back to AudioContext only when OfflineAudioContext is unavailable and closes it in finally", async () => {
    const fakeBuffer = { duration: 0.1, sampleRate: 44100 } as AudioBuffer;
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(fakeBuffer);
    const audioCtor = vi.fn().mockImplementation(() => ({ decodeAudioData, close }));

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: audioCtor,
    });

    const result = await decodeAudioFile(makeWavTestFile());
    expect(result).toBe(fakeBuffer);
    expect(audioCtor).toHaveBeenCalledTimes(1);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes fallback AudioContext even when decoding rejects", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockRejectedValue(new Error("EncodingError"));
    const audioCtor = vi.fn().mockImplementation(() => ({ decodeAudioData, close }));

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: audioCtor,
    });

    await expect(decodeAudioFile(makeWavTestFile())).rejects.toThrow("EncodingError");
    expect(close).toHaveBeenCalledTimes(1);
  });
});
