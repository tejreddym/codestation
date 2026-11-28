/**
 * Browser audio decoding helpers. No React, no storage and no network.
 * Decoding prefers a memory-only OfflineAudioContext so browsers without
 * active audio output hardware do not stall on AudioContext creation/resume,
 * falling back to a short-lived AudioContext closed in `finally`.
 */

type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
};

const AUDIO_EXTENSION = /\.(mp3|wav|wave|ogg|oga|m4a|aac|flac|webm|opus|aif|aiff|caf)$/i;

export function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext ?? null;
}

export function getOfflineAudioContextConstructor(): typeof OfflineAudioContext | null {
  if (typeof window === "undefined") return null;
  return window.OfflineAudioContext ?? (window as WebkitAudioWindow).webkitOfflineAudioContext ?? null;
}

export function createAudioContext(): AudioContext {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) throw new Error("Web Audio API is not supported in this browser.");
  return new AudioContextConstructor();
}

export async function resumeAudioContext(context: AudioContext): Promise<void> {
  if (context.state === "suspended") await context.resume();
}

/**
 * Decodes a local file into an AudioBuffer. The file never leaves the page.
 * Uses OfflineAudioContext when available to avoid hardware AudioContext hangs.
 */
export async function decodeAudioFile(file: File, context?: AudioContext): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer();
  const OfflineAudioContextConstructor = getOfflineAudioContextConstructor();
  if (OfflineAudioContextConstructor) {
    const offline = new OfflineAudioContextConstructor(1, 1, 44100);
    return offline.decodeAudioData(bytes.slice(0));
  }

  if (context) {
    return context.decodeAudioData(bytes.slice(0));
  }

  const fallbackContext = createAudioContext();
  try {
    return await fallbackContext.decodeAudioData(bytes.slice(0));
  } finally {
    await fallbackContext.close().catch(() => undefined);
  }
}

export function isAudioFile(name: string, type: string): boolean {
  return type.toLowerCase().startsWith("audio/") || AUDIO_EXTENSION.test(name);
}

export function audioFileRejection(): string {
  return "Choose an audio file such as MP3, WAV, OGG, M4A, AAC or FLAC. Other files cannot be decoded.";
}

export function decodeFailureMessage(): string {
  return "This audio file could not be decoded. It may be corrupt or use a codec this browser does not support.";
}

/** Copies the channels out of an AudioBuffer into plain Float32Arrays. */
export function readChannels(buffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }
  return channels;
}
