/**
 * Pure calculation utilities and in-browser recording engine for Video Trimmer.
 * 100% browser-side processing with zero server uploads and zero network traffic.
 */

export const SUPPORTED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv"] as const;

export type VideoFormatChoice = "mp4" | "webm";

export interface TrimOptions {
  startTime: number;
  endTime: number;
  mimeType?: string;
  videoBitsPerSecond?: number;
}

export interface TrimValidationResult {
  valid: boolean;
  error?: string;
}

export interface VideoMimeCapabilities {
  mp4: boolean;
  webm: boolean;
  preferredMime: string;
}

/**
 * Format a number of seconds into standard SMPTE timecode (HH:MM:SS:FF) if fps is provided,
 * or HH:MM:SS.mmm if fps is omitted.
 */
export function formatTimecode(seconds: number, fps?: number): string {
  const hasValidFps = typeof fps === "number" && Number.isFinite(fps) && fps > 0;

  if (!Number.isFinite(seconds) || seconds < 0) {
    return hasValidFps ? "00:00:00:00" : "00:00:00.000";
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const fraction = seconds - totalSeconds;

  const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");
  const pad3 = (n: number) => String(Math.floor(n)).padStart(3, "0");

  if (hasValidFps) {
    const maxFrame = Math.round(fps) - 1;
    const frameNumber = Math.min(maxFrame, Math.floor(fraction * fps + 0.005));
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}:${pad2(frameNumber)}`;
  }

  const millis = Math.floor(fraction * 1000);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}.${pad3(millis)}`;
}

/**
 * Parse a timecode string (HH:MM:SS:FF, HH:MM:SS.mmm, MM:SS.mmm, MM:SS:FF, or seconds) into seconds.
 */
export function parseTimecode(timecode: string, fps: number = 30): number {
  if (typeof timecode !== "string") {
    throw new Error("Timecode must be a string.");
  }

  const trimmed = timecode.trim();
  if (!trimmed) {
    throw new Error("Timecode cannot be empty.");
  }

  // Pure numeric seconds string (e.g. "12.34" or "45")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = Number(trimmed);
    if (!Number.isFinite(val) || val < 0) {
      throw new Error(`Invalid timecode: "${timecode}"`);
    }
    return val;
  }

  // Split by colon
  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 4) {
    throw new Error(`Invalid timecode format: "${timecode}"`);
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let framesOrMillis = 0;
  let isFrames = false;

  if (parts.length === 4) {
    // HH:MM:SS:FF
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    seconds = Number(parts[2]);
    framesOrMillis = Number(parts[3]);
    isFrames = true;
  } else if (parts.length === 3) {
    // HH:MM:SS or HH:MM:SS.mmm or MM:SS:FF
    // If the last part has a dot, it's HH:MM:SS.mmm
    if (parts[2].includes(".")) {
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
      const [secPart, milliPart] = parts[2].split(".");
      seconds = Number(secPart);
      framesOrMillis = Number(`0.${milliPart}`) * 1000;
      isFrames = false;
    } else {
      // Check if parts[2] could be frames or seconds
      // Standard: 3 parts is HH:MM:SS (with seconds potentially having frames if separated by colon)
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
      seconds = Number(parts[2]);
      isFrames = false;
    }
  } else if (parts.length === 2) {
    // MM:SS or MM:SS.mmm
    if (parts[1].includes(".")) {
      minutes = Number(parts[0]);
      const [secPart, milliPart] = parts[1].split(".");
      seconds = Number(secPart);
      framesOrMillis = Number(`0.${milliPart}`) * 1000;
      isFrames = false;
    } else {
      minutes = Number(parts[0]);
      seconds = Number(parts[1]);
    }
  }

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(framesOrMillis) ||
    hours < 0 ||
    minutes < 0 ||
    minutes >= 60 ||
    seconds < 0 ||
    seconds >= 60 ||
    framesOrMillis < 0
  ) {
    throw new Error(`Invalid timecode values: "${timecode}"`);
  }

  let total = hours * 3600 + minutes * 60 + seconds;
  if (isFrames) {
    const validFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
    if (framesOrMillis >= Math.round(validFps)) {
      throw new Error(`Frame number ${framesOrMillis} exceeds frame rate ${validFps}`);
    }
    total += framesOrMillis / validFps;
    return Number(total.toFixed(6));
  } else if (framesOrMillis > 0) {
    total += framesOrMillis / 1000;
  }

  return Number(total.toFixed(4));
}

/**
 * Convert seconds to frame count at a given frame rate.
 */
export function secondsToFrames(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(fps) || fps <= 0) {
    return 0;
  }
  return Math.round(seconds * fps);
}

/**
 * Convert frame count to seconds at a given frame rate.
 */
export function framesToSeconds(frames: number, fps: number): number {
  if (!Number.isFinite(frames) || frames < 0 || !Number.isFinite(fps) || fps <= 0) {
    return 0;
  }
  return Number((frames / fps).toFixed(4));
}

/**
 * Validate trim start and end ranges against clip duration.
 */
export function validateTrimRange(start: number, end: number, duration: number): TrimValidationResult {
  if (!Number.isFinite(start) || start < 0) {
    return { valid: false, error: "Start time must be a non-negative number." };
  }
  if (!Number.isFinite(end) || end <= 0) {
    return { valid: false, error: "End time must be greater than zero." };
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return { valid: false, error: "Video duration must be greater than zero." };
  }
  if (start >= end) {
    return { valid: false, error: "Start time must be strictly less than end time." };
  }
  if (start >= duration) {
    return { valid: false, error: "Start time cannot exceed video duration." };
  }
  // Allow a tiny floating-point leeway (50ms) for end time at duration boundary
  if (end > duration + 0.05) {
    return { valid: false, error: "End time cannot exceed video duration." };
  }
  if (end - start < 0.1 - 1e-5) {
    return { valid: false, error: "Trimmed slice duration must be at least 0.1 seconds." };
  }
  return { valid: true };
}

/**
 * Inspect browser MediaRecorder capabilities for MP4 and WebM recording.
 */
export function resolveSupportedVideoMimeTypes(): VideoMimeCapabilities {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return {
      mp4: false,
      webm: true,
      preferredMime: "video/webm",
    };
  }

  const mp4Types = [
    "video/mp4;codecs=avc1",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264",
    "video/mp4",
  ];

  const webmTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  let mp4Supported = false;
  let preferredMp4Mime = "";
  for (const type of mp4Types) {
    if (MediaRecorder.isTypeSupported(type)) {
      mp4Supported = true;
      if (!preferredMp4Mime) preferredMp4Mime = type;
      break;
    }
  }

  let webmSupported = false;
  let preferredWebmMime = "";
  for (const type of webmTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      webmSupported = true;
      if (!preferredWebmMime) preferredWebmMime = type;
      break;
    }
  }

  let preferredMime = "video/webm";
  if (webmSupported && preferredWebmMime) {
    preferredMime = preferredWebmMime;
  } else if (mp4Supported && preferredMp4Mime) {
    preferredMime = preferredMp4Mime;
  }

  return {
    mp4: mp4Supported,
    webm: webmSupported,
    preferredMime,
  };
}

/**
 * Helper to wait for the next decoded frame or seek event on a video element.
 */
export function waitForVideoSeek(video: HTMLVideoElement, targetTime: number, timeout = 10_000): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const clamped = Math.max(0, Math.min(targetTime, Math.max(0, duration - 0.001)));

  if (Math.abs(video.currentTime - clamped) < 0.01) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video seek timed out."));
    }, timeout);

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Video playback error while seeking."));
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });

    try {
      video.currentTime = clamped;
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error("Failed to set video position."));
    }
  });
}

/**
 * 100% in-browser video trimming engine using MediaStream capture and MediaRecorder.
 * Zero server uploads, zero network requests, zero external binaries.
 */
export async function trimVideoInBrowser(
  video: HTMLVideoElement,
  options: TrimOptions,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (signal?.aborted) {
    throw new DOMException("Trim operation was aborted", "AbortError");
  }

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const validation = validateTrimRange(options.startTime, options.endTime, duration);
  if (!validation.valid) {
    throw new Error(validation.error ?? "Invalid trim range.");
  }

  const sliceDuration = options.endTime - options.startTime;

  // 1. Seek video to startTime
  await waitForVideoSeek(video, options.startTime);

  if (signal?.aborted) {
    throw new DOMException("Trim operation was aborted", "AbortError");
  }

  // 2. Obtain stream from video element
  const videoAny = video as unknown as {
    captureStream?: (fps?: number) => MediaStream;
    mozCaptureStream?: (fps?: number) => MediaStream;
  };

  let stream: MediaStream | undefined;
  if (typeof videoAny.captureStream === "function") {
    stream = videoAny.captureStream();
  } else if (typeof videoAny.mozCaptureStream === "function") {
    stream = videoAny.mozCaptureStream();
  }

  if (!stream) {
    throw new Error("This browser does not support video stream capture.");
  }

  // 3. Resolve MIME type
  const caps = resolveSupportedVideoMimeTypes();
  let mimeType = options.mimeType;
  if (!mimeType) {
    mimeType = caps.preferredMime;
  }

  // Fallback if requested MIME is not supported
  if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = caps.preferredMime;
    }
  }

  const recorderOptions: MediaRecorderOptions = {};
  if (mimeType) {
    recorderOptions.mimeType = mimeType;
  }
  if (options.videoBitsPerSecond && options.videoBitsPerSecond > 0) {
    recorderOptions.videoBitsPerSecond = options.videoBitsPerSecond;
  }

  const chunks: Blob[] = [];

  return new Promise<Blob>((resolve, reject) => {
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream!, recorderOptions);
    } catch (err) {
      // Retry without specific options if instantiation failed
      try {
        recorder = new MediaRecorder(stream!);
      } catch (innerErr) {
        return reject(innerErr instanceof Error ? innerErr : new Error("Could not initialize MediaRecorder."));
      }
    }

    let progressRafId: number | null = null;
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (progressRafId !== null) {
        cancelAnimationFrame(progressRafId);
        progressRafId = null;
      }
      video.removeEventListener("timeupdate", checkTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      try {
        video.pause();
      } catch {}
    };

    const stopRecording = () => {
      if (recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {}
      }
    };

    const checkTime = () => {
      const current = video.currentTime;
      const elapsed = Math.max(0, current - options.startTime);
      const ratio = Math.min(1, Math.max(0, elapsed / sliceDuration));
      onProgress?.(ratio);

      if (current >= options.endTime - 0.02) {
        cleanup();
        stopRecording();
      }
    };

    const onEnded = () => {
      cleanup();
      stopRecording();
    };

    const onError = () => {
      cleanup();
      stopRecording();
      reject(new Error("Video playback error occurred during trimming."));
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Trim operation was aborted", "AbortError"));
      stopRecording();
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      cleanup();
      if (signal?.aborted) return;
      const outputType = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type: outputType });
      onProgress?.(1);
      resolve(blob);
    };

    recorder.onerror = (event: Event) => {
      cleanup();
      reject(new Error("MediaRecorder error during trimming: " + (event as ErrorEvent).message));
    };

    // Smooth progress polling loop alongside timeupdate
    const pollProgress = () => {
      if (settled) return;
      checkTime();
      progressRafId = requestAnimationFrame(pollProgress);
    };

    video.addEventListener("timeupdate", checkTime);
    video.addEventListener("ended", onEnded, { once: true });
    video.addEventListener("error", onError, { once: true });

    // Start recording & playback
    try {
      recorder.start(100); // 100ms chunk slices
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((playErr) => {
          cleanup();
          stopRecording();
          reject(new Error("Could not start video playback: " + playErr.message));
        });
      }
      progressRafId = requestAnimationFrame(pollProgress);
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error("Failed to start MediaRecorder."));
    }
  });
}
