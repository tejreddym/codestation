"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { EmptyState } from "./ui/EmptyState";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { ProgressBar } from "./ui/ProgressBar";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { Select, TextInput } from "./ui/controls";
import { downloadBlob } from "./ui/useDownload";
import ui from "./ui/ui.module.css";
import styles from "./VideoThumbnailTool.module.css";
import {
  clampFrameCount,
  evenTimestamps,
  formatDuration,
  frameFilename,
  isVideoFile,
  sanitizeBaseName,
  scaledDimensions,
  type ThumbnailFormat,
  type ThumbnailMaxWidth,
} from "@/lib/tools/video/thumbnail";

type Frame = {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  timestamp: number;
  width: number;
  height: number;
};

type Source = {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
};

const id = "video-thumbnail";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function waitForFrame(video: HTMLVideoElement, timeout = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const timer = window.setTimeout(
      () => finish(new Error("Video decoding timed out after 10 seconds.")),
      timeout,
    );
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => finish());
      // requestVideoFrameCallback can stay idle while paused; the decoded frame is still usable.
      window.setTimeout(() => finish(), 250);
    } else {
      window.setTimeout(() => finish(), 50);
    }
  });
}

function seekVideo(video: HTMLVideoElement, requested: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = Math.max(0, Math.min(requested, Math.max(0, duration - 0.001)));
  if (Math.abs(video.currentTime - target) < 0.001) return waitForFrame(video);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (error) reject(error); else resolve();
    };
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      waitForFrame(video).then(() => finish()).catch(finish);
    };
    const onError = () => finish(new Error("This browser could not decode the video while seeking."));
    const timer = window.setTimeout(
      () => finish(new Error("Video seek timed out after 10 seconds.")),
      10_000,
    );
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError, { once: true });
    try {
      video.currentTime = target;
    } catch {
      finish(new Error("This video cannot seek to that point."));
    }
  });
}

export default function VideoThumbnailTool() {
  const [values, setValues] = useState({ frames: "3", format: "png", quality: "92", maxWidth: "original" });
  const [source, setSource] = useState<Source | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [playhead, setPlayhead] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const ownedUrls = useRef(new Set<string>());
  const run = useRef<{ cancelled: boolean } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const owned = ownedUrls.current;
    return () => {
      mounted.current = false;
      if (run.current) run.current.cancelled = true;
      for (const url of owned) URL.revokeObjectURL(url);
      owned.clear();
    };
  }, []);

  function own(url: string) {
    ownedUrls.current.add(url);
    return url;
  }

  function releaseFrames(list: Frame[]) {
    for (const frame of list) {
      URL.revokeObjectURL(frame.url);
      ownedUrls.current.delete(frame.url);
    }
  }

  function clearFrames() {
    releaseFrames(frames);
    setFrames([]);
    setProgress({ done: 0, total: 0 });
  }

  function reset(clearInput = true) {
    if (run.current) run.current.cancelled = true;
    pendingFile.current = null;
    run.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    for (const url of ownedUrls.current) URL.revokeObjectURL(url);
    ownedUrls.current.clear();
    setSource(null);
    setVideoUrl("");
    setPlayhead(0);
    setFrames([]);
    setProgress({ done: 0, total: 0 });
    setLoading(false);
    setBusy(false);
    setError("");
    setNotice("");
    if (clearInput && fileInput.current) fileInput.current.value = "";
  }

  function chooseFile(file: File | null) {
    if (!file) {
      reset();
      return;
    }
    if (!isVideoFile(file.name, file.type)) {
      reset();
      setError("Choose a video file such as MP4, WebM, MOV, M4V or OGV. Audio and other files cannot be captured.");
      setNotice("No video was loaded.");
      return;
    }
    reset(false);
    pendingFile.current = file;
    const url = own(URL.createObjectURL(file));
    setVideoUrl(url);
    setLoading(true);
    setNotice("Reading video metadata locally…");
  }

  function loadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.videoWidth || !video.videoHeight) {
      setLoading(false);
      setError("This file has no decodable video track. Audio-only files and unsupported containers cannot produce frames.");
      setNotice("Choose a video with a picture track.");
      return;
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      setLoading(false);
      setError("This video has no usable duration, so frames cannot be positioned.");
      setNotice("Choose a supported video file.");
      return;
    }
    setSource({
      name: pendingFile.current?.name ?? "video",
      size: pendingFile.current?.size ?? 0,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    });
    setPlayhead(0);
    setLoading(false);
    setError("");
    setNotice("Video ready. Choose a frame action; every capture stays in this browser.");
  }

  function mediaError() {
    setLoading(false);
    setError("This browser could not decode the video. The file may be corrupt or use an unsupported codec.");
    setNotice("No frames were captured.");
  }

  function change(name: keyof typeof values, value: string) {
    setValues(current => ({ ...current, [name]: value }));
  }

  async function captureOne(timestamp: number, index: number): Promise<Frame> {
    const video = videoRef.current;
    if (!video || !source) throw new Error("Choose a decodable video first.");
    await seekVideo(video, timestamp);
    const maxWidth: ThumbnailMaxWidth = values.maxWidth === "original"
      ? "original"
      : (Number(values.maxWidth) as ThumbnailMaxWidth);
    const dimensions = scaledDimensions(video.videoWidth, video.videoHeight, maxWidth);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
    context.drawImage(video, 0, 0, dimensions.width, dimensions.height);

    const format: ThumbnailFormat = values.format === "jpeg" ? "jpeg" : "png";
    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const quality = Math.min(100, Math.max(1, Number(values.quality) || 92)) / 100;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error("The browser could not encode this frame.")),
        mime,
        format === "jpeg" ? quality : undefined,
      );
    });
    const url = own(URL.createObjectURL(blob));
    return {
      id: `${index}-${timestamp}-${blob.size}`,
      name: frameFilename(source.name, index, timestamp, format),
      url,
      blob,
      timestamp,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  async function capture(times: number[]) {
    if (!source || busy || times.length === 0) return;
    const token = { cancelled: false };
    run.current = token;
    releaseFrames(frames);
    setFrames([]);
    setError("");
    setBusy(true);
    setProgress({ done: 0, total: times.length });
    setNotice(times.length === 1 ? "Capturing the current frame locally…" : `Capturing ${times.length} frames locally…`);
    const captured: Frame[] = [];
    try {
      for (let index = 0; index < times.length; index++) {
        if (token.cancelled) break;
        const frame = await captureOne(times[index], index + 1);
        if (!mounted.current || token.cancelled) {
          URL.revokeObjectURL(frame.url);
          ownedUrls.current.delete(frame.url);
          break;
        }
        captured.push(frame);
        setFrames([...captured]);
        setProgress({ done: index + 1, total: times.length });
        setPlayhead(times[index]);
      }
      if (!mounted.current || run.current !== token) return;
      if (token.cancelled) {
        setNotice(`Cancelled after ${captured.length} of ${times.length} frame${times.length === 1 ? "" : "s"}. Capture again to start over.`);
      } else {
        setNotice(times.length === 1 ? "Frame captured. Download it below." : `${captured.length} frames captured. Download individually or as a ZIP.`);
      }
    } catch (cause) {
      if (mounted.current && run.current === token) {
        setError(cause instanceof Error ? cause.message : "Could not capture this video frame.");
        setNotice(captured.length ? `${captured.length} frame${captured.length === 1 ? "" : "s"} captured before the error.` : "No frames were captured.");
      }
    } finally {
      if (run.current === token) run.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  function capturePlayhead() {
    if (!source) return;
    void capture([Math.min(playhead, source.duration - 0.001)]);
  }

  function captureSequence() {
    if (!source) return;
    void capture(evenTimestamps(source.duration, clampFrameCount(values.frames)));
  }

  function cancel() {
    if (!run.current) return;
    run.current.cancelled = true;
    setNotice("Cancelling after the current frame…");
  }

  async function downloadZip() {
    if (frames.length < 2) return;
    setNotice("Building ZIP locally…");
    try {
      const { zipSync } = await import("fflate");
      const entries: Record<string, Uint8Array> = {};
      for (const frame of frames) entries[frame.name] = new Uint8Array(await frame.blob.arrayBuffer());
      const zipped = zipSync(entries, { level: 0 });
      downloadBlob(
        new Blob([zipped as unknown as BlobPart], { type: "application/zip" }),
        `${sanitizeBaseName(source?.name ?? "video")}-frames.zip`,
        "application/zip",
      );
      setNotice(`Downloaded ${frames.length} frames as a ZIP archive.`);
    } catch {
      setNotice("Could not build the ZIP archive. Download individual frames instead.");
    }
  }

  const disabled = busy || loading || !source;

  return (
    <ToolLayout kind="data" className={styles.videoContainer}>
      <div className={styles.videoLayout}>
        <Panel title="Source video" headingId={`${id}-source`} padded>
          <div className={styles.videoFields}>
            <Field
              id={`${id}-file`}
              label="Video file"
              hint="MP4, WebM, MOV, M4V or OGV. The browser decodes it locally; nothing is uploaded."
            >
              <input
                id={`${id}-file`}
                ref={fileInput}
                className={ui.control}
                type="file"
                accept="video/*,.mp4,.webm,.mov,.m4v,.ogv"
                disabled={busy}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : `${id}-file-hint`}
                onChange={event => chooseFile(event.target.files?.[0] ?? null)}
              />
            </Field>

            {source && (
              <dl className={styles.videoMeta} aria-label="Video metadata">
                <div><dt>File</dt><dd>{source.name}</dd></div>
                <div><dt>Size</dt><dd>{formatBytes(source.size)}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(source.duration)}</dd></div>
                <div><dt>Dimensions</dt><dd>{source.width} × {source.height} px</dd></div>
              </dl>
            )}

            <video
              key={videoUrl || "no-video"}
              ref={videoRef}
              className={styles.videoElement}
              src={videoUrl || undefined}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={loadedMetadata}
              onError={mediaError}
            />

            {source && (
              <>
                <Field id={`${id}-playhead`} label="Playhead" hint={`Single frame at ${formatDuration(playhead)}.`}>
                  <input
                    id={`${id}-playhead`}
                    className={styles.range}
                    type="range"
                    min="0"
                    max={Math.max(0, source.duration)}
                    step="0.01"
                    value={Math.min(playhead, source.duration)}
                    disabled={busy}
                    aria-valuetext={formatDuration(playhead)}
                    onChange={event => {
                      const next = Number(event.target.value);
                      setPlayhead(next);
                      if (videoRef.current) videoRef.current.currentTime = Math.min(next, source.duration - 0.001);
                    }}
                  />
                </Field>

                <div className={styles.videoControls}>
                  <Field id={`${id}-frames`} label="Evenly spaced frames">
                    <Select
                      id={`${id}-frames`}
                      value={values.frames}
                      disabled={busy}
                      onChange={event => change("frames", event.target.value)}
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map(count => (
                        <option key={count} value={String(count)}>{count}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field id={`${id}-format`} label="Image format">
                    <Select
                      id={`${id}-format`}
                      value={values.format}
                      disabled={busy}
                      onChange={event => change("format", event.target.value)}
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                    </Select>
                  </Field>
                  <Field id={`${id}-quality`} label="JPEG quality (%)">
                    <TextInput
                      id={`${id}-quality`}
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      inputMode="numeric"
                      value={values.quality}
                      disabled={busy || values.format !== "jpeg"}
                      onChange={event => change("quality", event.target.value)}
                    />
                  </Field>
                  <Field id={`${id}-maxWidth`} label="Maximum width">
                    <Select
                      id={`${id}-maxWidth`}
                      value={values.maxWidth}
                      disabled={busy}
                      onChange={event => change("maxWidth", event.target.value)}
                    >
                      <option value="original">Original (no upscaling)</option>
                      <option value="1920">1920 px</option>
                      <option value="1280">1280 px</option>
                      <option value="640">640 px</option>
                    </Select>
                  </Field>
                </div>

                <div className={styles.videoActions}>
                  <Button variant="primary" disabled={disabled} onClick={capturePlayhead}>Capture current frame</Button>
                  <Button disabled={disabled} onClick={captureSequence}>
                    Capture {clampFrameCount(values.frames)} evenly spaced
                  </Button>
                  {busy && <Button variant="danger" onClick={cancel}>Cancel</Button>}
                  <Button disabled={busy} onClick={() => reset()}>Clear</Button>
                </div>
                <Hint>Frames are captured at their decoded positions. Very short clips may repeat a frame; all output is clamped to 4096 px per side.</Hint>
              </>
            )}
          </div>
        </Panel>

        <Panel
          title="Captured frames"
          headingId={`${id}-output`}
          padded
          actions={frames.length > 1 ? (
            <Button size="sm" disabled={busy} onClick={() => void downloadZip()}>Download ZIP</Button>
          ) : undefined}
        >
          {busy && progress.total > 0 && (
            <ProgressBar label="Capturing frames" value={progress.done} max={progress.total} />
          )}
          {frames.length ? (
            <div className={styles.frameGrid}>
              {frames.map(frame => (
                <figure className={styles.frame} key={frame.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame.url} alt={`Captured frame at ${formatDuration(frame.timestamp)}`} />
                  <figcaption>
                    <span>{formatDuration(frame.timestamp)} · {frame.width} × {frame.height}</span>
                    <a href={frame.url} download={frame.name}>Download {frame.name.split(".").pop()?.toUpperCase()}</a>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <EmptyState>Choose a local video, then capture the playhead frame or evenly spaced thumbnails.</EmptyState>
          )}
        </Panel>
      </div>

      {error && <Callout kind="error" id={`${id}-error`}>{error}</Callout>}
      <StatusLine id={`${id}-status`} className={styles.videoStatus}>{notice}</StatusLine>
      <PrivacyNote>Video decoding and frame capture stay in this browser. The file and captured frames are never uploaded, saved or added to a route.</PrivacyNote>
    </ToolLayout>
  );
}
