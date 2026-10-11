import { describe, it, expect } from "vitest";
import { encodeWavFromChannels, computeWaveformPeaks, formatAudioTime } from "./engine";

describe("Audio Engine", () => {
  it("formats audio time accurately", () => {
    expect(formatAudioTime(0)).toBe("0:00.0");
    expect(formatAudioTime(65.4)).toBe("1:05.4");
    expect(formatAudioTime(125)).toBe("2:05.0");
  });

  it("computes waveform peaks accurately", () => {
    const data = new Float32Array([0.1, -0.5, 0.8, -0.2, 0.0, 0.4]);
    const peaks = computeWaveformPeaks(data, 2);
    expect(peaks.length).toBe(2);
    expect(peaks[0]).toBeCloseTo(0.8);
    expect(peaks[1]).toBeCloseTo(0.4);
  });

  it("encodes valid 16-bit PCM WAV with proper headers", () => {
    const sampleRate = 44100;
    const channel1 = new Float32Array(44100); // 1 sec of audio
    // Fill with simple sine wave
    for (let i = 0; i < channel1.length; i++) {
      channel1[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const wavBytes = encodeWavFromChannels([channel1], sampleRate);
    expect(wavBytes.length).toBe(44 + 44100 * 2);

    // Verify header magic
    const headerStr = String.fromCharCode(...wavBytes.slice(0, 4));
    expect(headerStr).toBe("RIFF");
    const waveStr = String.fromCharCode(...wavBytes.slice(8, 12));
    expect(waveStr).toBe("WAVE");
    const fmtStr = String.fromCharCode(...wavBytes.slice(12, 16));
    expect(fmtStr).toBe("fmt ");
    const dataStr = String.fromCharCode(...wavBytes.slice(36, 40));
    expect(dataStr).toBe("data");
  });

  it("slices specified sample range correctly", () => {
    const channel1 = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
    const wavBytes = encodeWavFromChannels([channel1], 8000, 1, 3);
    // (3 - 1) = 2 samples * 2 bytes = 4 bytes of data + 44 header = 48 bytes
    expect(wavBytes.length).toBe(48);
  });
});
