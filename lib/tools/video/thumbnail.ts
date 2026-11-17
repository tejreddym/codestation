/** Pure helpers for intentional, bounded video thumbnail capture. */

export const MIN_THUMBNAIL_FRAMES = 1;
export const MAX_THUMBNAIL_FRAMES = 12;
/** Hard ceiling for either captured dimension, independent of the requested width. */
export const MAX_THUMBNAIL_DIMENSION = 4096;
export const MAX_THUMBNAIL_QUALITY = 1;

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv"] as const;

export type ThumbnailFormat = "png" | "jpeg";
export type ThumbnailMaxWidth = "original" | 1920 | 1280 | 640;

export function clampFrameCount(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(MAX_THUMBNAIL_FRAMES, Math.max(MIN_THUMBNAIL_FRAMES, Math.floor(number)));
}

/**
 * Evenly spaced sample times inside the clip, at the centre of each slot.
 * Centres avoid black opening/closing frames while keeping uniform spacing.
 */
export function evenTimestamps(duration: number, count: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("A positive video duration is required.");
  const total = clampFrameCount(count);
  const step = duration / total;
  return Array.from({ length: total }, (_, index) => {
    const time = (index + 0.5) * step;
    return Number(Math.min(time, duration - 0.001).toFixed(3));
  });
}

/** Scales down to the requested width and clamps both dimensions to 4096 px. */
export function scaledDimensions(
  width: number,
  height: number,
  maxWidth: ThumbnailMaxWidth = "original",
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error("Video dimensions must be positive numbers.");
  }
  const sourceWidth = Math.floor(width);
  const sourceHeight = Math.floor(height);
  const requested = maxWidth === "original" ? sourceWidth : Math.min(sourceWidth, Math.floor(maxWidth));
  const clamped = Math.min(requested, MAX_THUMBNAIL_DIMENSION);
  const scale = Math.min(1, clamped / sourceWidth, MAX_THUMBNAIL_DIMENSION / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

export function sanitizeBaseName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const withoutExtension = base.replace(/\.[^.]+$/, "");
  const safe = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return safe || "video";
}

export function frameFilename(
  sourceName: string,
  index: number,
  timestamp: number,
  format: ThumbnailFormat,
): string {
  const safeIndex = String(clampFrameCount(index)).padStart(2, "0");
  const time = Number.isFinite(timestamp) && timestamp >= 0 ? timestamp.toFixed(3) : "0.000";
  return `${sanitizeBaseName(sourceName)}-frame-${safeIndex}-${time}s.${format === "jpeg" ? "jpg" : "png"}`;
}

export function isVideoFile(name: string, mime: string): boolean {
  if (mime.trim().toLowerCase().startsWith("video/")) return true;
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return (VIDEO_EXTENSIONS as readonly string[]).includes(extension);
}
