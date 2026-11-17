/**
 * Pure audio converter decisions and filenames.
 * MP3 is intentionally absent: no encoder ships with this app.
 */

export type AudioOutputFormat = "wav" | "webm";

export const CONVERTER_FORMATS: readonly AudioOutputFormat[] = ["wav", "webm"];
export const WEBM_OPUS_MIME = "audio/webm;codecs=opus";
/** Opus inside WebM is always delivered at 48 kHz by the browser recorder. */
export const WEBM_OPUS_SAMPLE_RATE = 48_000;
export const CONVERTER_BITRATES = [96, 128, 192] as const;
export const DEFAULT_WEBM_BITRATE = 128;

type RecorderLike = {
  isTypeSupported?: (mimeType: string) => boolean;
};

export function isAudioOutputFormat(value: string): value is AudioOutputFormat {
  return (CONVERTER_FORMATS as readonly string[]).includes(value);
}

export function sanitizeBitrate(value: string | number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_WEBM_BITRATE;
  const match = CONVERTER_BITRATES.find(bitrate => bitrate === numeric);
  return match ?? DEFAULT_WEBM_BITRATE;
}

export function webmOpusSupported(recorder?: RecorderLike | null): boolean {
  const candidate = recorder ?? (typeof MediaRecorder === "undefined" ? undefined : MediaRecorder);
  if (!candidate || typeof candidate.isTypeSupported !== "function") return false;
  try {
    return candidate.isTypeSupported(WEBM_OPUS_MIME);
  } catch {
    return false;
  }
}

export function converterFilename(name: string, format: AudioOutputFormat): string {
  const base = name.replace(/\.[^/.]+$/, "").trim();
  return `${base || "audio"}-converted.${format}`;
}

export function converterMimeType(format: AudioOutputFormat): string {
  return format === "wav" ? "audio/wav" : WEBM_OPUS_MIME;
}

export function converterFormatLabel(format: AudioOutputFormat): string {
  return format === "wav" ? "WAV · 16-bit PCM" : "WebM · Opus";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
