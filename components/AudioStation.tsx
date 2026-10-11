"use client";

import { useState, useEffect, useRef } from "react";
import { getAudioDefinition, type AudioToolId } from "@/config/audio-tools";
import {
  encodeWavFromChannels,
  computeWaveformPeaks,
  formatAudioTime,
} from "@/lib/tools/audio/engine";
import styles from "./AudioStation.module.css";

export default function AudioStation({ toolId }: { toolId: AudioToolId }) {
  const definition = getAudioDefinition(toolId)!;

  // Audio Trimmer state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  async function handleAudioUpload(file: File) {
    setAudioError(null);
    setAudioFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error("Web Audio API is not supported in this browser.");
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const decoded = await ctx.decodeAudioData(buffer.slice(0));
      setAudioBuffer(decoded);
      setAudioDuration(decoded.duration);
      setTrimStart(0);
      setTrimEnd(Math.min(30, decoded.duration));

      const peaks = computeWaveformPeaks(decoded.getChannelData(0), 120);
      setWaveformPeaks(peaks);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Failed to decode audio file.");
      setAudioBuffer(null);
    }
  }

  function renderWaveform(peaks: number[], start: number, end: number, duration: number) {
    const canvas = waveformCanvasRef.current;
    if (!canvas || peaks.length === 0 || duration <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const startRatio = start / duration;
    const endRatio = end / duration;
    const barWidth = w / peaks.length;

    for (let i = 0; i < peaks.length; i++) {
      const barRatio = i / peaks.length;
      const isSelected = barRatio >= startRatio && barRatio <= endRatio;
      ctx.fillStyle = isSelected ? "#D9F975" : "#717B65";
      const barHeight = Math.max(3, peaks[i] * (h - 16));
      const y = (h - barHeight) / 2;
      ctx.fillRect(i * barWidth, y, Math.max(1, barWidth - 1.5), barHeight);
    }
  }

  useEffect(() => {
    if (waveformPeaks.length > 0 && audioDuration > 0) {
      renderWaveform(waveformPeaks, trimStart, trimEnd, audioDuration);
    }
  }, [waveformPeaks, trimStart, trimEnd, audioDuration]);

  function toggleAudioPlayback() {
    if (!audioBuffer || !audioContextRef.current) return;
    const ctx = audioContextRef.current;

    if (isPlayingAudio) {
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {}
      }
      setIsPlayingAudio(false);
      return;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      const dur = Math.max(0.05, trimEnd - trimStart);
      source.start(0, trimStart, dur);
      source.onended = () => {
        setIsPlayingAudio(false);
      };
      activeSourceRef.current = source;
      setIsPlayingAudio(true);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Playback error");
    }
  }

  function downloadTrimmedWav() {
    if (!audioBuffer) return;
    try {
      const channels: Float32Array[] = [];
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        channels.push(audioBuffer.getChannelData(ch));
      }
      const startSample = Math.floor(trimStart * audioBuffer.sampleRate);
      const endSample = Math.floor(trimEnd * audioBuffer.sampleRate);
      const wavBytes = encodeWavFromChannels(
        channels,
        audioBuffer.sampleRate,
        startSample,
        endSample
      );

      const blob = new Blob([wavBytes as unknown as BlobPart], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const originalName = audioFile ? audioFile.name.replace(/\.[^/.]+$/, "") : "audio";
      a.download = `${originalName}-trimmed.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Failed to encode WAV.");
    }
  }

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h2>{definition.name}</h2>
          <p>{definition.description}</p>
        </div>

        <div className={styles.body}>
          <div className={styles.formCol}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="audio-file-input">
                Select Audio File (MP3, WAV, AAC, OGG, M4A, FLAC)
              </label>
              <input
                id="audio-file-input"
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                className={styles.input}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAudioUpload(file);
                }}
              />
            </div>

            {audioError && <div className={styles.errorBanner}>{audioError}</div>}

            {audioBuffer && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Waveform &amp; Selected Region</label>
                  <canvas
                    ref={waveformCanvasRef}
                    width={700}
                    height={120}
                    className={styles.waveformCanvas}
                  />
                  <div className={styles.timeDisplay}>
                    <span>Start: {formatAudioTime(trimStart)}</span>
                    <span>Total: {formatAudioTime(audioDuration)}</span>
                    <span>End: {formatAudioTime(trimEnd)}</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="trim-start-range">
                      Start Time ({trimStart.toFixed(1)}s)
                    </label>
                    <input
                      id="trim-start-range"
                      type="range"
                      min={0}
                      max={Math.max(0, trimEnd - 0.1)}
                      step={0.1}
                      value={trimStart}
                      onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="trim-end-range">
                      End Time ({trimEnd.toFixed(1)}s)
                    </label>
                    <input
                      id="trim-end-range"
                      type="range"
                      min={trimStart + 0.1}
                      max={audioDuration}
                      step={0.1}
                      value={trimEnd}
                      onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={toggleAudioPlayback}
                  >
                    {isPlayingAudio ? "Stop Preview" : "Play Selection"}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={downloadTrimmedWav}
                  >
                    Download Trimmed WAV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
