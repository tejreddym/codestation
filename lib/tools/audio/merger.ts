/**
 * Pure audio merger planning and assembly.
 * Inputs are normalised to the highest source sample rate and two channels;
 * mono sources are duplicated and optional silence is inserted between files.
 */

export const MERGER_MAX_DURATION_SECONDS = 30 * 60;
export const MERGER_MAX_GAP_SECONDS = 5;

export type MergeBufferInput = {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
};

export type MergePlan = {
  targetSampleRate: number;
  targetChannels: number;
  gapSeconds: number;
  gapFrames: number;
  totalFrames: number;
  totalDuration: number;
  withinLimit: boolean;
  reason?: string;
  resampledLengths: number[];
};

export function parseGapField(raw: string): { seconds: number; error?: string } {
  const trimmed = raw.trim();
  const numeric = Number(trimmed);
  if (!trimmed || !Number.isFinite(numeric)) {
    return { seconds: 0, error: "Silence gap must be a number between 0 and 5 seconds. Using 0 seconds." };
  }
  if (numeric < 0 || numeric > MERGER_MAX_GAP_SECONDS) {
    const seconds = Math.min(MERGER_MAX_GAP_SECONDS, Math.max(0, numeric));
    return { seconds, error: `Silence gap must be between 0 and 5 seconds. The value is clamped to ${seconds} seconds.` };
  }
  return { seconds: numeric };
}

export function resampledLength(
  sourceLength: number,
  sourceRate: number,
  targetRate: number,
): number {
  if (sourceLength <= 0 || sourceRate <= 0 || targetRate <= 0) return 0;
  if (sourceRate === targetRate) return Math.floor(sourceLength);
  return Math.max(0, Math.round(sourceLength * (targetRate / sourceRate)));
}

function formatLimitDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function planMerge(
  inputs: readonly MergeBufferInput[],
  gapSeconds: number,
  maxDurationSeconds = MERGER_MAX_DURATION_SECONDS,
): MergePlan {
  const targetSampleRate = inputs.reduce((highest, input) => Math.max(highest, input.sampleRate), 0);
  const safeGap = Number.isFinite(gapSeconds) ? Math.min(MERGER_MAX_GAP_SECONDS, Math.max(0, gapSeconds)) : 0;
  const gapFrames = targetSampleRate > 0 ? Math.round(safeGap * targetSampleRate) : 0;
  const resampledLengths = inputs.map(input => targetSampleRate > 0
    ? resampledLength(input.length, input.sampleRate, targetSampleRate)
    : 0);
  const sampleFrames = resampledLengths.reduce((sum, frames) => sum + frames, 0);
  const gaps = Math.max(0, inputs.length - 1);
  const totalFrames = sampleFrames + gapFrames * gaps;
  const totalDuration = targetSampleRate > 0 ? totalFrames / targetSampleRate : 0;
  const withinLimit = totalDuration <= maxDurationSeconds;

  return {
    targetSampleRate,
    targetChannels: 2,
    gapSeconds: safeGap,
    gapFrames,
    totalFrames,
    totalDuration,
    withinLimit,
    reason: withinLimit
      ? undefined
      : `The merged result would be ${formatLimitDuration(totalDuration)}, above the ${formatLimitDuration(maxDurationSeconds)} limit. Remove a file or shorten the gap.`,
    resampledLengths,
  };
}

function sourceChannelIndex(channelIndex: number, sourceChannels: number): number {
  if (sourceChannels <= 1) return 0;
  return Math.min(channelIndex, sourceChannels - 1);
}

/**
 * Writes one source into the target channel arrays at the given frame offset.
 * Returns the number of frames written, excluding the silence gap.
 */
export function writeSourceInto(
  target: readonly Float32Array[],
  targetOffset: number,
  source: AudioBuffer,
  targetRate: number,
): number {
  if (target.length < 2 || source.numberOfChannels < 1 || source.length < 1) return 0;
  const length = resampledLength(source.length, source.sampleRate, targetRate);
  if (length < 1) return 0;

  for (let channelIndex = 0; channelIndex < target.length; channelIndex += 1) {
    const output = target[channelIndex];
    const sourceData = source.getChannelData(sourceChannelIndex(channelIndex, source.numberOfChannels));
    if (source.sampleRate === targetRate) {
      output.set(sourceData.subarray(0, Math.min(length, sourceData.length)), targetOffset);
      continue;
    }

    const ratio = source.sampleRate / targetRate;
    for (let index = 0; index < length; index += 1) {
      const position = index * ratio;
      const leftIndex = Math.floor(position);
      if (leftIndex >= sourceData.length) break;
      const rightIndex = Math.min(leftIndex + 1, sourceData.length - 1);
      const fraction = position - leftIndex;
      output[targetOffset + index] =
        sourceData[leftIndex] * (1 - fraction) + sourceData[rightIndex] * fraction;
    }
  }

  return length;
}

export function assembleMerge(
  sources: readonly AudioBuffer[],
  plan: MergePlan,
): Float32Array[] {
  const target = Array.from({ length: plan.targetChannels }, () => new Float32Array(plan.totalFrames));
  let offset = 0;
  for (let index = 0; index < sources.length; index += 1) {
    offset += writeSourceInto(target, offset, sources[index], plan.targetSampleRate);
    if (index < sources.length - 1) offset += plan.gapFrames;
  }
  return target;
}

export function mergedFilename(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "").trim();
  return `${base || "audio"}-merged.wav`;
}
