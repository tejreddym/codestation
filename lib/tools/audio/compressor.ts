/**
 * Pure compressor settings, analysis and gain helpers.
 * Rendering through DynamicsCompressorNode lives in ./compressor-render.ts.
 */

export type CompressorNumericKey =
  | "threshold"
  | "ratio"
  | "attack"
  | "release"
  | "knee"
  | "makeupGain";

export type CompressorSettings = {
  thresholdDb: number;
  ratio: number;
  attackSeconds: number;
  releaseSeconds: number;
  kneeDb: number;
  makeupGainDb: number;
  normalizePeak: boolean;
};

export type CompressorFieldValues = Record<CompressorNumericKey, string>;
export type CompressorFieldErrors = Partial<Record<CompressorNumericKey, string>>;

type Rule = {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  fallback: number;
  setting: keyof Omit<CompressorSettings, "normalizePeak">;
};

export const COMPRESSOR_RULES: Record<CompressorNumericKey, Rule> = {
  threshold: { label: "Threshold", unit: "dB", min: -60, max: 0, step: 1, fallback: -24, setting: "thresholdDb" },
  ratio: { label: "Ratio", unit: ":1", min: 1, max: 20, step: 0.1, fallback: 4, setting: "ratio" },
  attack: { label: "Attack", unit: "s", min: 0, max: 1, step: 0.01, fallback: 0.01, setting: "attackSeconds" },
  release: { label: "Release", unit: "s", min: 0, max: 1, step: 0.01, fallback: 0.25, setting: "releaseSeconds" },
  knee: { label: "Knee", unit: "dB", min: 0, max: 40, step: 1, fallback: 30, setting: "kneeDb" },
  makeupGain: { label: "Makeup gain", unit: "dB", min: 0, max: 24, step: 0.5, fallback: 0, setting: "makeupGainDb" },
};

export const DEFAULT_COMPRESSOR_FIELDS: CompressorFieldValues = {
  threshold: String(COMPRESSOR_RULES.threshold.fallback),
  ratio: String(COMPRESSOR_RULES.ratio.fallback),
  attack: String(COMPRESSOR_RULES.attack.fallback),
  release: String(COMPRESSOR_RULES.release.fallback),
  knee: String(COMPRESSOR_RULES.knee.fallback),
  makeupGain: String(COMPRESSOR_RULES.makeupGain.fallback),
};

export const MAX_OUTPUT_WARNING_BYTES = 100 * 1024 * 1024;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rangeMessage(rule: Rule): string {
  return `${rule.label} must be between ${rule.min} and ${rule.max} ${rule.unit}.`;
}

/** Parses one numeric field, returning a clamped value plus a visible error. */
export function parseCompressorField(
  key: CompressorNumericKey,
  raw: string,
): { value: number; error?: string } {
  const rule = COMPRESSOR_RULES[key];
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: rule.fallback, error: `${rangeMessage(rule)} Using the default (${rule.fallback} ${rule.unit}).` };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return { value: rule.fallback, error: `${rangeMessage(rule)} Using the default (${rule.fallback} ${rule.unit}).` };
  }
  if (numeric < rule.min || numeric > rule.max) {
    const value = clamp(numeric, rule.min, rule.max);
    return { value, error: `${rangeMessage(rule)} The value is clamped to ${value} ${rule.unit}.` };
  }
  return { value: numeric };
}

export function sanitizeCompressorFields(
  fields: CompressorFieldValues,
  normalizePeak: boolean,
): { settings: CompressorSettings; errors: CompressorFieldErrors } {
  const errors: CompressorFieldErrors = {};
  const settings: CompressorSettings = {
    thresholdDb: COMPRESSOR_RULES.threshold.fallback,
    ratio: COMPRESSOR_RULES.ratio.fallback,
    attackSeconds: COMPRESSOR_RULES.attack.fallback,
    releaseSeconds: COMPRESSOR_RULES.release.fallback,
    kneeDb: COMPRESSOR_RULES.knee.fallback,
    makeupGainDb: COMPRESSOR_RULES.makeupGain.fallback,
    normalizePeak,
  };

  for (const key of Object.keys(COMPRESSOR_RULES) as CompressorNumericKey[]) {
    const parsed = parseCompressorField(key, fields[key]);
    if (parsed.error) errors[key] = parsed.error;
    settings[COMPRESSOR_RULES[key].setting] = parsed.value;
  }

  return { settings, errors };
}

/** Peak amplitude in dBFS, floored at -120 for digital silence. */
export function measurePeakDb(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      const value = Math.abs(channel[index]);
      if (value > peak) peak = value;
    }
  }
  return peak > 0 ? Math.max(-120, 20 * Math.log10(peak)) : -120;
}

/** RMS level in dBFS, floored at -120 for digital silence. */
export function measureRmsDb(channels: readonly Float32Array[]): number {
  let sum = 0;
  let count = 0;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      sum += channel[index] * channel[index];
      count += 1;
    }
  }
  if (count === 0 || sum <= 0) return -120;
  return Math.max(-120, 20 * Math.log10(Math.sqrt(sum / count)));
}

/** Returns new channel arrays with a constant gain applied. */
export function applyGainDb(
  channels: readonly Float32Array[],
  gainDb: number,
): Float32Array[] {
  const gain = Number.isFinite(gainDb) ? 10 ** (gainDb / 20) : 1;
  return channels.map(channel => {
    const output = new Float32Array(channel.length);
    for (let index = 0; index < channel.length; index += 1) {
      output[index] = channel[index] * gain;
    }
    return output;
  });
}

/**
 * Scales the whole signal so its highest sample reaches targetDb.
 * Silent signals are copied unchanged with a reported gain of 0 dB.
 */
export function normalizePeak(
  channels: readonly Float32Array[],
  targetDb = -1,
): { channels: Float32Array[]; gainDb: number } {
  const peakDb = measurePeakDb(channels);
  const safeTarget = Number.isFinite(targetDb) ? Math.min(0, targetDb) : -1;
  if (peakDb <= -120) return { channels: channels.map(channel => channel.slice()), gainDb: 0 };
  const gainDb = safeTarget - peakDb;
  return { channels: applyGainDb(channels, gainDb), gainDb };
}

/** Measured compressor reduction, independent of makeup gain. */
export function gainReductionDb(inputRmsDb: number, compressedRmsDb: number): number {
  if (!Number.isFinite(inputRmsDb) || !Number.isFinite(compressedRmsDb)) return 0;
  return Math.max(0, inputRmsDb - compressedRmsDb);
}

export function estimateWavBytes(totalFrames: number, channelCount: number): number {
  const frames = Number.isFinite(totalFrames) && totalFrames > 0 ? Math.floor(totalFrames) : 0;
  const channels = Number.isFinite(channelCount) && channelCount > 0 ? Math.floor(channelCount) : 0;
  return 44 + frames * channels * 2;
}

export function formatDb(value: number, suffix = "dBFS"): string {
  if (!Number.isFinite(value) || value <= -120) return `≤ -120 ${suffix}`;
  return `${value.toFixed(1)} ${suffix}`;
}
