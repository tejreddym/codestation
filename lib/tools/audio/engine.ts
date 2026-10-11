/**
 * In-browser audio processing engine using Web Audio API and TypedArrays.
 * 100% client-side with zero external telemetry or file uploads.
 */

/**
 * Encodes Float32 PCM audio channels into a standard 16-bit PCM WAV (RIFF) byte buffer.
 */
export function encodeWavFromChannels(
  channels: Float32Array[],
  sampleRate: number,
  startSample: number = 0,
  endSample?: number
): Uint8Array {
  const numChannels = channels.length;
  if (numChannels === 0) {
    throw new Error("At least one audio channel is required.");
  }
  const totalAvailable = channels[0].length;
  const start = Math.max(0, Math.min(startSample, totalAvailable));
  const end = Math.min(totalAvailable, Math.max(start, endSample ?? totalAvailable));
  const numSamples = end - start;

  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, "RIFF");
  // file length minus 8
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(8, "WAVE");
  // format chunk identifier
  writeString(12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = raw PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate
  view.setUint32(28, byteRate, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(36, "data");
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write interleaved 16-bit PCM samples
  let offset = 44;
  for (let i = start; i < end; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Computes normalized waveform peak bars (0..1) from PCM channel data.
 */
export function computeWaveformPeaks(channelData: Float32Array, numBars: number = 100): number[] {
  if (channelData.length === 0 || numBars <= 0) return [];
  const blockSize = Math.floor(channelData.length / numBars);
  if (blockSize === 0) return [1];

  const peaks: number[] = [];
  for (let b = 0; b < numBars; b++) {
    const start = b * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    let max = 0;
    for (let i = start; i < end; i++) {
      const val = Math.abs(channelData[i]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }
  return peaks;
}

/**
 * Formats seconds into MM:SS.SS format.
 */
export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  const paddedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
  return `${mins}:${paddedSecs}`;
}
