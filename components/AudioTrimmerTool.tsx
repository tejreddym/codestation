"use client";

import { useState, useEffect, useRef } from "react";
import { getAudioDefinition } from "@/config/audio-tools";
import {
  createAudioContext,
  decodeAudioFile,
  resumeAudioContext,
} from "@/lib/tools/audio/decode";
import {
  encodeWavFromChannels,
  computeWaveformPeaks,
  formatAudioTime,
} from "@/lib/tools/audio/engine";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { CanvasStage } from "./ui/CanvasStage";
import { DropZone } from "./ui/DropZone";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { RangeInput } from "./ui/controls";
import { ToolLayout } from "./ui/ToolLayout";
import ui from "./ui/ui.module.css";
import styles from "./AudioStation.module.css";

export default function AudioTrimmerTool() {
  const definition = getAudioDefinition("audio-trimmer")!;

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
      const decoded = await decodeAudioFile(file);
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

  useEffect(() => {
    return () => {
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {}
      }
      void audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  async function toggleAudioPlayback() {
    if (!audioBuffer) return;

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
      const ctx = audioContextRef.current ?? createAudioContext();
      audioContextRef.current = ctx;
      await resumeAudioContext(ctx);
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
    <ToolLayout kind="data" className={styles.container}>
      <Panel title={definition.name} headingId="audio-trimmer-heading" padded>
        <Hint>{definition.description}</Hint>
        <div className={styles.formCol}>
          <DropZone
            label="Select Audio File (MP3, WAV, AAC, OGG, M4A, FLAC)"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            onFiles={files => {
              const file = files[0];
              if (file) void handleAudioUpload(file);
            }}
          >
            <span>Select Audio File (MP3, WAV, AAC, OGG, M4A, FLAC)</span>
            <span className={ui.hint}>{audioFile ? audioFile.name : "Drop a file here or choose one from your device."}</span>
          </DropZone>

          {audioError && <Callout kind="error">{audioError}</Callout>}

          {audioBuffer && (
            <>
              <CanvasStage
                kind="bitmap"
                label="Waveform and selected region"
                background="plain"
                footer={<div className={styles.timeDisplay}>
                  <span>Start: {formatAudioTime(trimStart)}</span>
                  <span>Total: {formatAudioTime(audioDuration)}</span>
                  <span>End: {formatAudioTime(trimEnd)}</span>
                </div>}
              >
                <canvas ref={waveformCanvasRef} width={700} height={120} className={styles.waveformCanvas} />
              </CanvasStage>

              <div className={styles.ranges}>
                <Field id="trim-start-range" label={`Start Time (${trimStart.toFixed(1)}s)`}>
                  <RangeInput
                    id="trim-start-range"
                    min={0}
                    max={Math.max(0, trimEnd - 0.1)}
                    step={0.1}
                    value={trimStart}
                    onChange={e => setTrimStart(parseFloat(e.target.value))}
                  />
                </Field>
                <Field id="trim-end-range" label={`End Time (${trimEnd.toFixed(1)}s)`}>
                  <RangeInput
                    id="trim-end-range"
                    min={trimStart + 0.1}
                    max={audioDuration}
                    step={0.1}
                    value={trimEnd}
                    onChange={e => setTrimEnd(parseFloat(e.target.value))}
                  />
                </Field>
              </div>

              <div className={ui.actions}>
                <Button onClick={() => void toggleAudioPlayback()}>{isPlayingAudio ? "Stop Preview" : "Play Selection"}</Button>
                <Button variant="primary" onClick={downloadTrimmedWav}>Download Trimmed WAV</Button>
              </div>
            </>
          )}
        </div>
      </Panel>
    </ToolLayout>
  );
}
