"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import styles from "./VideoTrimmerTool.module.css";
import {
  formatTimecode,
  parseTimecode,
  secondsToFrames,
  framesToSeconds,
  validateTrimRange,
  resolveSupportedVideoMimeTypes,
  trimVideoInBrowser,
  type VideoFormatChoice,
} from "@/lib/tools/video/trimmer";
import { sanitizeBaseName } from "@/lib/tools/video/thumbnail";

interface VideoSource {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
}

const FPS_OPTIONS = [
  { value: "24", label: "24 fps (Film)" },
  { value: "25", label: "25 fps (PAL)" },
  { value: "29.97", label: "29.97 fps (NTSC)" },
  { value: "30", label: "30 fps (Standard Web)" },
  { value: "60", label: "60 fps (High Motion)" },
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoTrimmerTool() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [playhead, setPlayhead] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [fps, setFps] = useState<number>(30);
  const [loopSelection, setLoopSelection] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormatChoice>("webm");

  const [loading, setLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string>("");

  const [caps, setCaps] = useState(() => resolveSupportedVideoMimeTypes());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const ownedUrls = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update capabilities on client mount
  useEffect(() => {
    const resolved = resolveSupportedVideoMimeTypes();
    setCaps(resolved);
    if (resolved.mp4 && !resolved.webm) {
      setSelectedFormat("mp4");
    } else {
      setSelectedFormat("webm");
    }
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = ownedUrls.current;
    return () => {
      for (const u of urls) {
        URL.revokeObjectURL(u);
      }
      urls.clear();
    };
  }, []);

  const registerUrl = useCallback((url: string) => {
    ownedUrls.current.add(url);
    return url;
  }, []);

  const revokeUrl = useCallback((url: string) => {
    if (url && ownedUrls.current.has(url)) {
      URL.revokeObjectURL(url);
      ownedUrls.current.delete(url);
    }
  }, []);

  // Handle source file selection
  const handleFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      setLoading(true);
      setExportedBlob(null);
      if (exportedUrl) {
        revokeUrl(exportedUrl);
        setExportedUrl("");
      }

      if (videoUrl) {
        revokeUrl(videoUrl);
        setVideoUrl("");
      }

      const url = registerUrl(URL.createObjectURL(file));

      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = url;

      try {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("This browser could not decode the video file."));
          };
          const cleanup = () => {
            probe.removeEventListener("loadedmetadata", onLoaded);
            probe.removeEventListener("error", onError);
          };
          probe.addEventListener("loadedmetadata", onLoaded, { once: true });
          probe.addEventListener("error", onError, { once: true });
        });

        const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
        if (duration <= 0) {
          throw new Error("Video has an invalid or zero duration.");
        }

        setSource({
          name: file.name,
          size: file.size,
          duration,
          width: probe.videoWidth || 1920,
          height: probe.videoHeight || 1080,
        });

        setVideoUrl(url);
        setTrimStart(0);
        setTrimEnd(Math.min(10, duration));
        setPlayhead(0);
      } catch (err) {
        revokeUrl(url);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load video file.");
        setSource(null);
        setVideoUrl("");
      } finally {
        setLoading(false);
      }
    },
    [videoUrl, exportedUrl, registerUrl, revokeUrl]
  );

  // Video time updates and loop handling
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    setPlayhead(current);

    if (loopSelection && !isExporting) {
      if (current >= trimEnd - 0.05) {
        video.currentTime = trimStart;
        if (video.paused) {
          video.play().catch(() => {});
        }
      }
    }
  }, [loopSelection, isExporting, trimStart, trimEnd]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [trimStart, trimEnd]);

  const playSelection = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = trimStart;
    video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
  }, [trimStart]);

  // Scrubber click
  const handleScrubberClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!source || !scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = ratio * source.duration;

      const video = videoRef.current;
      if (video) {
        video.currentTime = targetTime;
        setPlayhead(targetTime);
      }
    },
    [source]
  );

  // Marker drag helpers
  const handleMarkerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, marker: "start" | "end") => {
      e.preventDefault();
      e.stopPropagation();
      const scrubber = scrubberRef.current;
      if (!scrubber || !source) return;

      const pointerId = e.pointerId;
      (e.currentTarget as HTMLElement).setPointerCapture(pointerId);

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!scrubber || !source) return;
        const rect = scrubber.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
        const time = Number((ratio * source.duration).toFixed(2));

        if (marker === "start") {
          const maxStart = Math.max(0, trimEnd - 0.1);
          const newStart = Math.max(0, Math.min(time, maxStart));
          setTrimStart(newStart);
          if (videoRef.current) {
            videoRef.current.currentTime = newStart;
            setPlayhead(newStart);
          }
        } else {
          const minEnd = Math.min(source.duration, trimStart + 0.1);
          const newEnd = Math.max(minEnd, Math.min(time, source.duration));
          setTrimEnd(newEnd);
          if (videoRef.current) {
            videoRef.current.currentTime = newEnd;
            setPlayhead(newEnd);
          }
        }
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        try {
          (upEvent.currentTarget as HTMLElement)?.releasePointerCapture(pointerId);
        } catch {}
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [source, trimStart, trimEnd]
  );

  // Marker keyboard adjustment
  const handleMarkerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, marker: "start" | "end") => {
      if (!source) return;
      const step = e.shiftKey ? 1.0 : 0.1;
      let handled = false;

      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        handled = true;
        if (marker === "start") {
          const newStart = Math.max(0, trimStart - step);
          setTrimStart(Number(newStart.toFixed(2)));
        } else {
          const newEnd = Math.max(trimStart + 0.1, trimEnd - step);
          setTrimEnd(Number(newEnd.toFixed(2)));
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        handled = true;
        if (marker === "start") {
          const newStart = Math.min(trimEnd - 0.1, trimStart + step);
          setTrimStart(Number(newStart.toFixed(2)));
        } else {
          const newEnd = Math.min(source.duration, trimEnd + step);
          setTrimEnd(Number(newEnd.toFixed(2)));
        }
      }

      if (handled) {
        e.preventDefault();
      }
    },
    [source, trimStart, trimEnd]
  );

  // Quick set buttons
  const setStartToPlayhead = useCallback(() => {
    if (!source) return;
    const newStart = Math.min(playhead, Math.max(0, trimEnd - 0.1));
    setTrimStart(Number(newStart.toFixed(2)));
  }, [source, playhead, trimEnd]);

  const setEndToPlayhead = useCallback(() => {
    if (!source) return;
    const newEnd = Math.max(playhead, Math.min(source.duration, trimStart + 0.1));
    setTrimEnd(Number(newEnd.toFixed(2)));
  }, [source, playhead, trimStart]);

  // Steppers
  const adjustTrimStart = useCallback(
    (deltaSeconds: number) => {
      if (!source) return;
      const newStart = Math.max(0, Math.min(trimEnd - 0.1, trimStart + deltaSeconds));
      setTrimStart(Number(newStart.toFixed(2)));
    },
    [source, trimStart, trimEnd]
  );

  const adjustTrimEnd = useCallback(
    (deltaSeconds: number) => {
      if (!source) return;
      const newEnd = Math.max(trimStart + 0.1, Math.min(source.duration, trimEnd + deltaSeconds));
      setTrimEnd(Number(newEnd.toFixed(2)));
    },
    [source, trimStart, trimEnd]
  );

  // Slice metrics
  const sliceDuration = useMemo(() => {
    return Math.max(0, trimEnd - trimStart);
  }, [trimStart, trimEnd]);

  const sliceFrames = useMemo(() => {
    return secondsToFrames(sliceDuration, fps);
  }, [sliceDuration, fps]);

  // Start Trim & Export
  const handleExport = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !source) return;

    setErrorMessage(null);
    setExportedBlob(null);
    if (exportedUrl) {
      revokeUrl(exportedUrl);
      setExportedUrl("");
    }

    const validation = validateTrimRange(trimStart, trimEnd, source.duration);
    if (!validation.valid) {
      setErrorMessage(validation.error ?? "Invalid trim range.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsExporting(true);
    setExportProgress(0);

    let mimeType = selectedFormat === "mp4" ? "video/mp4" : "video/webm";
    if (selectedFormat === "mp4" && !caps.mp4) {
      mimeType = caps.preferredMime;
    }

    try {
      const blob = await trimVideoInBrowser(
        video,
        {
          startTime: trimStart,
          endTime: trimEnd,
          mimeType,
        },
        (progress) => setExportProgress(progress),
        controller.signal
      );

      const url = registerUrl(URL.createObjectURL(blob));
      setExportedBlob(blob);
      setExportedUrl(url);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setErrorMessage("Export operation was canceled.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Video trimming failed.");
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [source, trimStart, trimEnd, selectedFormat, caps, exportedUrl, registerUrl, revokeUrl]);

  const handleCancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!exportedBlob || !source) return;
    const base = sanitizeBaseName(source.name);
    const ext = selectedFormat === "mp4" ? "mp4" : "webm";
    const filename = `${base}-trimmed-${trimStart.toFixed(1)}s-${trimEnd.toFixed(1)}s.${ext}`;
    downloadBlob(exportedBlob, filename, exportedBlob.type);
  }, [exportedBlob, source, selectedFormat, trimStart, trimEnd]);

  return (
    <div className={styles.container} data-webmcp-tool="video-trimmer" data-webmcp-slug="video-trimmer" data-webmcp-category="Video">
      <ToolLayout kind="form">
        <div className={styles.layout}>
          {/* Left Column: Player & Interactive Timeline Scrubber */}
          <div className={styles.playerSection}>
            <Panel title="Video Preview & Timeline">
              {!source ? (
                <EmptyState>
                  <span style={{ display: "block", marginBottom: "var(--space-2)", color: "var(--muted)" }}>
                    Choose a local video file (.mp4, .webm, .mov, .m4v, .ogv) to trim in your browser.
                  </span>
                  <label className={ui.button}>
                    Select Video File
                    <input
                      type="file"
                      accept="video/*,.mp4,.webm,.mov,.m4v,.ogv"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </label>
                </EmptyState>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {/* Video Stage */}
                  <div className={styles.videoStage}>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className={styles.videoPlayer}
                      playsInline
                      preload="auto"
                      onTimeUpdate={handleTimeUpdate}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onClick={togglePlay}
                    />
                  </div>

                  {/* Interactive Scrubber */}
                  <div
                    ref={scrubberRef}
                    className={styles.timelineScrubber}
                    onClick={handleScrubberClick}
                    title="Click to jump playhead. Drag marker brackets to adjust trim slice."
                  >
                    {/* Selected Slice Highlight */}
                    <div
                      className={styles.timelineSlice}
                      style={{
                        left: `${(trimStart / source.duration) * 100}%`,
                        width: `${((trimEnd - trimStart) / source.duration) * 100}%`,
                      }}
                    />

                    {/* Current Playhead */}
                    <div
                      className={styles.playhead}
                      style={{ left: `${(playhead / source.duration) * 100}%` }}
                    />

                    {/* Start Marker Handle [ */}
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label="Trim start time"
                      aria-valuenow={trimStart}
                      aria-valuemin={0}
                      aria-valuemax={Number((trimEnd - 0.1).toFixed(2))}
                      className={`${styles.markerHandle} ${styles.startMarker}`}
                      style={{ left: `${(trimStart / source.duration) * 100}%` }}
                      onPointerDown={(e) => handleMarkerPointerDown(e, "start")}
                      onKeyDown={(e) => handleMarkerKeyDown(e, "start")}
                      title="Trim Start. Drag or use arrow keys."
                    >
                      [
                    </div>

                    {/* End Marker Handle ] */}
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label="Trim end time"
                      aria-valuenow={trimEnd}
                      aria-valuemin={Number((trimStart + 0.1).toFixed(2))}
                      aria-valuemax={Number(source.duration.toFixed(2))}
                      className={`${styles.markerHandle} ${styles.endMarker}`}
                      style={{ left: `${(trimEnd / source.duration) * 100}%` }}
                      onPointerDown={(e) => handleMarkerPointerDown(e, "end")}
                      onKeyDown={(e) => handleMarkerKeyDown(e, "end")}
                      title="Trim End. Drag or use arrow keys."
                    >
                      ]
                    </div>
                  </div>

                  {/* Time Ticks */}
                  <div className={styles.timeTicks}>
                    <span>00:00:00</span>
                    <span style={{ color: "var(--accent)" }}>
                      Slice: {formatTimecode(sliceDuration, fps)} ({sliceFrames} frames)
                    </span>
                    <span>{formatTimecode(source.duration, fps)}</span>
                  </div>

                  {/* Playback Controls Bar */}
                  <div className={styles.playbackBar}>
                    <div className={styles.playbackControls}>
                      <Button
                        type="button"
                        variant={isPlaying ? "secondary" : "primary"}
                        onClick={togglePlay}
                      >
                        {isPlaying ? "Pause" : "Play"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={playSelection}>
                        Play Slice
                      </Button>
                      <Button
                        type="button"
                        variant={loopSelection ? "secondary" : "ghost"}
                        onClick={() => setLoopSelection(!loopSelection)}
                      >
                        {loopSelection ? "Loop: ON" : "Loop: OFF"}
                      </Button>
                    </div>

                    <div className={styles.playheadTime}>
                      {formatTimecode(playhead, fps)}
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* Right Column: Precision Trim Controls & Export Panel */}
          <div className={styles.controlsSection}>
            {source && (
              <Panel title="Source Clip Details">
                <dl className={styles.fileMeta}>
                  <div>
                    <dt>File Name</dt>
                    <dd>{source.name}</dd>
                  </div>
                  <div>
                    <dt>File Size</dt>
                    <dd>{formatBytes(source.size)}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>{formatTimecode(source.duration, fps)} ({source.duration.toFixed(2)}s)</dd>
                  </div>
                  <div>
                    <dt>Resolution</dt>
                    <dd>{source.width} × {source.height}</dd>
                  </div>
                </dl>
              </Panel>
            )}

            <Panel title="Precision Trim Points">
              {!source ? (
                <Hint>Load a video file to calibrate trim points and frame rates.</Hint>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <Field id="video-trimmer-fps" label="Frame Rate (FPS)">
                    <Select
                      id="video-trimmer-fps"
                      value={String(fps)}
                      onChange={(e) => setFps(Number(e.target.value))}
                    >
                      {FPS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {/* Start Point Controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "var(--text-xs)", color: "var(--foreground)" }}>
                        Start Point: {formatTimecode(trimStart, fps)}
                      </strong>
                      <Button type="button" variant="ghost" onClick={setStartToPlayhead}>
                        Set Start to Playhead [
                      </Button>
                    </div>

                    <div className={styles.rangeInputsGrid}>
                      <div>
                        <Field id="video-trimmer-start-seconds" label="Start (Seconds)">
                          <TextInput
                            id="video-trimmer-start-seconds"
                            type="number"
                            step="0.01"
                            min="0"
                            max={String(Math.max(0, trimEnd - 0.1))}
                            value={String(trimStart)}
                            onChange={(e) => {
                              const num = Number(e.target.value);
                              if (Number.isFinite(num) && num >= 0 && num < trimEnd) {
                                setTrimStart(num);
                              }
                            }}
                          />
                        </Field>
                      </div>
                      <div>
                        <Field id="video-trimmer-start-frame" label="Start (Frame)">
                          <TextInput
                            id="video-trimmer-start-frame"
                            type="number"
                            step="1"
                            min="0"
                            value={String(secondsToFrames(trimStart, fps))}
                            onChange={(e) => {
                              const f = Number(e.target.value);
                              if (Number.isFinite(f) && f >= 0) {
                                const s = framesToSeconds(f, fps);
                                if (s < trimEnd) setTrimStart(s);
                              }
                            }}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className={styles.stepperGroup}>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimStart(-1)}>
                        -1s
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimStart(1)}>
                        +1s
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimStart(-1 / fps)}>
                        -1f
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimStart(1 / fps)}>
                        +1f
                      </Button>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: "1px solid var(--line)" }} />

                  {/* End Point Controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "var(--text-xs)", color: "var(--foreground)" }}>
                        End Point: {formatTimecode(trimEnd, fps)}
                      </strong>
                      <Button type="button" variant="ghost" onClick={setEndToPlayhead}>
                        Set End to Playhead ]
                      </Button>
                    </div>

                    <div className={styles.rangeInputsGrid}>
                      <div>
                        <Field id="video-trimmer-end-seconds" label="End (Seconds)">
                          <TextInput
                            id="video-trimmer-end-seconds"
                            type="number"
                            step="0.01"
                            min={String(trimStart + 0.1)}
                            max={String(source.duration)}
                            value={String(trimEnd)}
                            onChange={(e) => {
                              const num = Number(e.target.value);
                              if (Number.isFinite(num) && num > trimStart && num <= source.duration) {
                                setTrimEnd(num);
                              }
                            }}
                          />
                        </Field>
                      </div>
                      <div>
                        <Field id="video-trimmer-end-frame" label="End (Frame)">
                          <TextInput
                            id="video-trimmer-end-frame"
                            type="number"
                            step="1"
                            value={String(secondsToFrames(trimEnd, fps))}
                            onChange={(e) => {
                              const f = Number(e.target.value);
                              if (Number.isFinite(f) && f > 0) {
                                const s = framesToSeconds(f, fps);
                                if (s > trimStart && s <= source.duration) setTrimEnd(s);
                              }
                            }}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className={styles.stepperGroup}>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimEnd(-1)}>
                        -1s
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimEnd(1)}>
                        +1s
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimEnd(-1 / fps)}>
                        -1f
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => adjustTrimEnd(1 / fps)}>
                        +1f
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Export Settings">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div>
                  <Field id="video-trimmer-format" label="Export Container Format">
                    <div className={styles.formatOptions}>
                      <button
                        type="button"
                        className={`${styles.formatBadge} ${selectedFormat === "webm" ? styles.formatBadgeActive : ""}`}
                        onClick={() => setSelectedFormat("webm")}
                      >
                        <strong>.webm</strong>
                        <span className={`${styles.capabilityPill} ${caps.webm ? styles.supportedPill : styles.unsupportedPill}`}>
                          {caps.webm ? "Supported" : "Browser Limited"}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.formatBadge} ${selectedFormat === "mp4" ? styles.formatBadgeActive : ""}`}
                        onClick={() => setSelectedFormat("mp4")}
                      >
                        <strong>.mp4</strong>
                        <span className={`${styles.capabilityPill} ${caps.mp4 ? styles.supportedPill : styles.unsupportedPill}`}>
                          {caps.mp4 ? "Supported" : "Browser Limited"}
                        </span>
                      </button>
                    </div>
                  </Field>
                </div>

                {errorMessage && (
                  <Callout kind="error">
                    {errorMessage}
                  </Callout>
                )}

                {isExporting && (
                  <div className={styles.exportProgressBox}>
                    <ProgressBar
                      label="Trimming & Encoding slice"
                      value={Math.round(exportProgress * 100)}
                      max={100}
                    />
                    <Button type="button" variant="ghost" onClick={handleCancelExport}>
                      Cancel Export
                    </Button>
                  </div>
                )}

                {!isExporting && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!source || isExporting}
                    onClick={handleExport}
                  >
                    Trim & Export Video ({sliceDuration.toFixed(2)}s)
                  </Button>
                )}

                {exportedBlob && exportedUrl && (
                  <div className={styles.downloadCard}>
                    <div>
                      <strong style={{ fontSize: "var(--text-sm)", color: "var(--foreground)" }}>
                        Trimmed Video Ready ({formatBytes(exportedBlob.size)})
                      </strong>
                    </div>
                    <video src={exportedUrl} controls playsInline />
                    <Button type="button" variant="primary" onClick={handleDownload}>
                      Download Trimmed Video
                    </Button>
                  </div>
                )}
              </div>
            </Panel>

            <PrivacyNote>
              All video decoding, frame slicing, and recording run 100% inside your browser. Your videos never touch any remote server or external network.
            </PrivacyNote>
          </div>
        </div>
      </ToolLayout>
    </div>
  );
}
