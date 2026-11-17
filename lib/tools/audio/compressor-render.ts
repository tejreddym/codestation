/**
 * Browser-only offline render for the audio compressor.
 * DynamicsCompressorNode is rendered in memory; no playback or upload occurs.
 */

import { readChannels } from "./decode";
import type { CompressorSettings } from "./compressor";

export async function renderCompressedChannels(
  buffer: AudioBuffer,
  settings: CompressorSettings,
): Promise<Float32Array[]> {
  if (buffer.numberOfChannels < 1 || buffer.length < 1) {
    throw new Error("This audio file has no samples to compress.");
  }

  const context = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const source = context.createBufferSource();
  source.buffer = buffer;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = settings.thresholdDb;
  compressor.ratio.value = settings.ratio;
  compressor.attack.value = settings.attackSeconds;
  compressor.release.value = settings.releaseSeconds;
  compressor.knee.value = settings.kneeDb;

  source.connect(compressor);
  compressor.connect(context.destination);
  source.start(0);

  const rendered = await context.startRendering();
  return readChannels(rendered);
}
