/**
 * Browser-only WebM/Opus recording.
 * The decoded buffer is rendered through OfflineAudioContext, then played in
 * real time into a MediaStreamAudioDestinationNode recorded by MediaRecorder.
 * Nothing is uploaded; the recorder and graph are torn down on finish/cancel.
 */

import { WEBM_OPUS_MIME, webmOpusSupported } from "./converter";
import { createAudioContext } from "./decode";

export type WebmRecordingOptions = {
  bitrateKbps: number;
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
};

function abortError(): DOMException {
  return new DOMException("Conversion cancelled.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export async function recordAudioBufferToWebm(
  buffer: AudioBuffer,
  options: WebmRecordingOptions,
): Promise<Blob> {
  throwIfAborted(options.signal);
  if (!webmOpusSupported()) {
    throw new Error("This browser cannot record audio/webm with Opus. Choose WAV instead.");
  }
  if (buffer.numberOfChannels < 1 || buffer.length < 1) {
    throw new Error("This audio file has no samples to convert.");
  }

  const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const offlineSource = offline.createBufferSource();
  offlineSource.buffer = buffer;
  offlineSource.connect(offline.destination);
  offlineSource.start(0);
  const rendered = await offline.startRendering();
  throwIfAborted(options.signal);

  const live = createAudioContext();
  await live.resume();

  const destination = live.createMediaStreamDestination();
  const source = live.createBufferSource();
  source.buffer = rendered;
  source.connect(destination);

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(destination.stream, {
      mimeType: WEBM_OPUS_MIME,
      audioBitsPerSecond: Math.max(1, Math.round(options.bitrateKbps)) * 1000,
    });
  } catch {
    source.disconnect();
    destination.disconnect();
    await live.close().catch(() => undefined);
    throw new Error("This browser could not start a WebM/Opus recorder. Choose WAV instead.");
  }

  return new Promise<Blob>((resolve, reject) => {
    const chunks: Blob[] = [];
    let finished = false;
    let cancelled = false;
    let animation = 0;

    const cleanup = async () => {
      if (animation) {
        window.cancelAnimationFrame(animation);
        animation = 0;
      }
      options.signal?.removeEventListener("abort", onAbort);
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
      destination.disconnect();
      await live.close().catch(() => undefined);
    };

    const fail = (cause: unknown) => {
      if (finished) return;
      finished = true;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      void cleanup().finally(() => reject(error));
    };

    const complete = () => {
      if (finished) return;
      if (cancelled) {
        fail(abortError());
        return;
      }
      finished = true;
      const blob = new Blob(chunks, { type: recorder.mimeType || WEBM_OPUS_MIME });
      void cleanup().finally(() => resolve(blob));
    };

    const onAbort = () => {
      if (finished || cancelled) return;
      cancelled = true;
      options.onProgress?.(0);
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else fail(abortError());
      } catch {
        fail(abortError());
      }
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    };

    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = event => {
      const message = "error" in event && event.error instanceof Error
        ? event.error.message
        : "The browser stopped the WebM recorder unexpectedly.";
      fail(new Error(message));
    };
    recorder.onstop = complete;
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      recorder.start(250);
      source.start();
    } catch (cause) {
      fail(cause);
      return;
    }

    const startAt = live.currentTime;
    const tick = () => {
      if (finished) return;
      const ratio = Math.min(1, Math.max(0, (live.currentTime - startAt) / rendered.duration));
      options.onProgress?.(ratio);
      animation = window.requestAnimationFrame(tick);
    };
    animation = window.requestAnimationFrame(tick);

    source.onended = () => {
      options.onProgress?.(1);
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else complete();
      } catch {
        complete();
      }
    };
  });
}
