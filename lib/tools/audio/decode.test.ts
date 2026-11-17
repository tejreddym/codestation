import { describe, expect, it } from "vitest";
import { isAudioFile, readChannels } from "./decode";

describe("audio decode helpers", () => {
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
});
