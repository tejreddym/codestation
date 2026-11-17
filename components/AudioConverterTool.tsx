"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioDefinition } from "@/config/audio-tools";
import {
  audioFileRejection,
  createAudioContext,
  decodeAudioFile,
  decodeFailureMessage,
  isAudioFile,
  resumeAudioContext,
} from "@/lib/tools/audio/decode";
import {
  CONVERTER_BITRATES,
  DEFAULT_WEBM_BITRATE,
  WEBM_OPUS_MIME,
  WEBM_OPUS_SAMPLE_RATE,
  converterFilename,
  converterFormatLabel,
  converterMimeType,
  formatBytes,
  isAudioOutputFormat,
  sanitizeBitrate,
  webmOpusSupported,
  type AudioOutputFormat,
} from "@/lib/tools/audio/converter";
import { encodeWavFromChannels, formatAudioTime } from "@/lib/tools/audio/engine";
import { recordAudioBufferToWebm } from "@/lib/tools/audio/webm";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Select } from "./ui/controls";
import { DropZone } from "./ui/DropZone";
import { Field } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { OutputPanel } from "./ui/OutputPanel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { ProgressBar } from "./ui/ProgressBar";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import ui from "./ui/ui.module.css";
import styles from "./AudioConverterTool.module.css";

type Source = {
  name: string;
  size: number;
  buffer: AudioBuffer;
};

type Output = {
  url: string;
  blob: Blob;
  filename: string;
  format: AudioOutputFormat;
  mimeType: string;
  duration: number;
  sampleRate: number;
  bitrateKbps: number | null;
};

const id = "audio-converter";

export default function AudioConverterTool() {
  const definition = getAudioDefinition("audio-converter")!;
  const [source, setSource] = useState<Source | null>(null);
  const [format, setFormat] = useState<AudioOutputFormat>("wav");
  const [bitrate, setBitrate] = useState(String(DEFAULT_WEBM_BITRATE));
  const [webmSupported, setWebmSupported] = useState<boolean | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dropKey, setDropKey] = useState(0);
  const mounted = useRef(true);
  const decodeToken = useRef(0);
  const outputUrl = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    setWebmSupported(webmOpusSupported());
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      if (outputUrl.current) {
        URL.revokeObjectURL(outputUrl.current);
        outputUrl.current = null;
      }
    };
  }, []);

  function releaseOutput() {
    if (outputUrl.current) {
      URL.revokeObjectURL(outputUrl.current);
      outputUrl.current = null;
    }
    setOutput(null);
  }

  function clear() {
    if (busy) return;
    decodeToken.current += 1;
    setSource(null);
    releaseOutput();
    setError("");
    setNotice("");
    setProgress(0);
    setDropKey(key => key + 1);
  }

  async function chooseFile(file: File | null) {
    if (!file || busy) return;
    releaseOutput();
    setError("");
    setNotice("");
    setProgress(0);

    if (!isAudioFile(file.name, file.type)) {
      setSource(null);
      setError(audioFileRejection());
      setDropKey(key => key + 1);
      return;
    }

    const token = ++decodeToken.current;
    const context = createAudioContext();
    setBusy(true);
    setNotice("Decoding the audio locally…");
    try {
      await resumeAudioContext(context);
      const buffer = await decodeAudioFile(file, context);
      if (!mounted.current || token !== decodeToken.current) return;
      setSource({ name: file.name, size: file.size, buffer });
      setNotice("Audio ready. Choose the output format, then convert.");
    } catch {
      if (!mounted.current || token !== decodeToken.current) return;
      setSource(null);
      setError(decodeFailureMessage());
      setNotice("No audio was loaded.");
      setDropKey(key => key + 1);
    } finally {
      await context.close().catch(() => undefined);
      if (mounted.current && token === decodeToken.current) setBusy(false);
    }
  }

  function finishOutput(blob: Blob, chosenFormat: AudioOutputFormat, chosenBitrate: number | null) {
    if (blob.size === 0) throw new Error("The browser produced an empty audio file. Try another format.");
    releaseOutput();
    const url = URL.createObjectURL(blob);
    outputUrl.current = url;
    setOutput({
      url,
      blob,
      filename: converterFilename(source?.name ?? "audio", chosenFormat),
      format: chosenFormat,
      mimeType: blob.type || converterMimeType(chosenFormat),
      duration: source?.buffer.duration ?? 0,
      sampleRate: chosenFormat === "webm" ? WEBM_OPUS_SAMPLE_RATE : source?.buffer.sampleRate ?? 0,
      bitrateKbps: chosenBitrate,
    });
  }

  async function convert() {
    if (!source || busy) return;
    if (format === "webm" && !webmSupported) {
      setError("This browser cannot record WebM/Opus. Choose WAV; the format will not be changed silently.");
      return;
    }

    releaseOutput();
    setError("");
    setNotice(format === "webm" ? "Recording WebM/Opus in real time…" : "Encoding 16-bit PCM WAV…");
    setBusy(true);
    setProgress(0);

    if (format === "wav") {
      try {
        const channels: Float32Array[] = [];
        for (let channel = 0; channel < source.buffer.numberOfChannels; channel += 1) {
          channels.push(source.buffer.getChannelData(channel));
        }
        const bytes = encodeWavFromChannels(channels, source.buffer.sampleRate);
        if (!mounted.current) return;
        finishOutput(new Blob([bytes as unknown as BlobPart], { type: "audio/wav" }), "wav", null);
        setProgress(100);
        setNotice("WAV conversion finished. Download or preview it below.");
      } catch (cause) {
        if (mounted.current) {
          setError(cause instanceof Error ? cause.message : "Could not encode this WAV file.");
          setNotice("No output was created.");
        }
      } finally {
        if (mounted.current) setBusy(false);
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const blob = await recordAudioBufferToWebm(source.buffer, {
        bitrateKbps: sanitizeBitrate(bitrate),
        signal: controller.signal,
        onProgress: ratio => {
          if (mounted.current) setProgress(Math.round(Math.max(0, Math.min(1, ratio)) * 100));
        },
      });
      if (!mounted.current) return;
      finishOutput(blob, "webm", sanitizeBitrate(bitrate));
      setProgress(100);
      setNotice("WebM/Opus conversion finished. Download or preview it below.");
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setProgress(0);
        setNotice("Conversion cancelled. No output file was created.");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not record WebM/Opus audio.");
        setNotice("No output was created.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  function cancel() {
    if (!abortRef.current) return;
    setNotice("Cancelling the recorder…");
    abortRef.current.abort();
  }

  const formatHint = format === "wav"
    ? "16-bit PCM WAV using the existing dependency-free encoder."
    : `Real-time MediaRecorder capture at ${sanitizeBitrate(bitrate)} kbps. Duration is limited by available memory and browser support.`;

  return (
    <ToolLayout kind="data" className={styles.container}>
      <Panel title={definition.name} headingId={`${id}-heading`} padded>
        <p className={ui.hint}>
          Convert one local audio file to 16-bit PCM WAV or WebM/Opus. Every format is explicit: MP3 is not available
          in this release, and the chosen format is never silently substituted.
        </p>

        <div className={styles.form}>
          <DropZone
            key={dropKey}
            label="Audio file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            disabled={busy}
            onFiles={files => void chooseFile(files[0] ?? null)}
          >
            <span>Select or drop one audio file</span>
            <span className={ui.hint}>{source ? source.name : "MP3, WAV, OGG, M4A, AAC or FLAC. Nothing is uploaded."}</span>
          </DropZone>

          {source && (
            <dl className={styles.sourceMeta} aria-label="Source audio metadata">
              <div><dt>File</dt><dd>{source.name}</dd></div>
              <div><dt>Size</dt><dd>{formatBytes(source.size)}</dd></div>
              <div><dt>Duration</dt><dd>{formatAudioTime(source.buffer.duration)}</dd></div>
              <div><dt>Sample rate</dt><dd>{source.buffer.sampleRate.toLocaleString()} Hz</dd></div>
              <div><dt>Channels</dt><dd>{source.buffer.numberOfChannels}</dd></div>
            </dl>
          )}

          <div className={styles.optionGrid}>
            <Field id={`${id}-format`} label="Output format" hint={formatHint}>
              <Select
                id={`${id}-format`}
                value={format}
                disabled={busy}
                onChange={event => {
                  if (!isAudioOutputFormat(event.target.value)) return;
                  if (event.target.value === "webm" && webmSupported === false) return;
                  setFormat(event.target.value);
                  releaseOutput();
                  setError("");
                  setNotice("");
                }}
              >
                <option value="wav">WAV · 16-bit PCM</option>
                <option value="webm" disabled={webmSupported === false}>WebM · Opus</option>
              </Select>
            </Field>

            {format === "webm" && (
              <Field id={`${id}-bitrate`} label="WebM bitrate" hint="Used only for the WebM/Opus recorder.">
                <Select
                  id={`${id}-bitrate`}
                  value={bitrate}
                  disabled={busy}
                  onChange={event => {
                    setBitrate(String(sanitizeBitrate(event.target.value)));
                    releaseOutput();
                  }}
                >
                  {CONVERTER_BITRATES.map(value => (
                    <option key={value} value={value}>{value} kbps</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {webmSupported === false && (
            <Callout kind="warning">
              This browser reports no support for <code>{WEBM_OPUS_MIME}</code>. The WebM/Opus option is disabled
              and WAV remains available. No different codec or format is substituted.
            </Callout>
          )}

          <p className={ui.metadata}>
            MP3 encoding is not available in this release. WAV and WebM/Opus are the only outputs; there is no
            silent fallback or format change.
          </p>

          {error && <Callout kind="error" id={`${id}-error`}>{error}</Callout>}

          <div className={ui.actions}>
            <Button variant="primary" disabled={busy || !source} onClick={() => void convert()}>
              Convert to {converterFormatLabel(format)}
            </Button>
            {busy && format === "webm" && <Button variant="danger" onClick={cancel}>Cancel</Button>}
            <Button disabled={busy} onClick={clear}>Clear</Button>
          </div>

          {busy && format === "webm" && (
            <ProgressBar
              label="Recording WebM/Opus"
              value={progress}
              max={100}
              detail={`${progress}% of the audio duration captured in real time.`}
            />
          )}
        </div>
      </Panel>

      <OutputPanel
        title="Converted output"
        headingId={`${id}-output`}
        label="converted audio result"
        empty="Choose an audio file and an output format, then convert to preview and download it."
        busy={busy}
        downloadDisabled={!output}
        onDownload={output ? () => downloadBlob(output.blob, output.filename, output.mimeType) : undefined}
        filename={output?.filename}
        mimeType={output?.mimeType}
      >
        {output ? (
          <div className={styles.result}>
            <audio className={styles.preview} controls src={output.url} aria-label="Converted audio preview" />
            <dl className={styles.metrics} aria-label="Converted audio metadata">
              <div><dt>Format</dt><dd>{converterFormatLabel(output.format)}</dd></div>
              <div><dt>File</dt><dd>{output.filename}</dd></div>
              <div><dt>MIME type</dt><dd>{output.mimeType}</dd></div>
              <div><dt>Output size</dt><dd>{formatBytes(output.blob.size)}</dd></div>
              <div><dt>Duration</dt><dd>{formatAudioTime(output.duration)}</dd></div>
              <div><dt>Sample rate</dt><dd>{output.sampleRate.toLocaleString()} Hz</dd></div>
              {output.bitrateKbps !== null && <div><dt>Target bitrate</dt><dd>{output.bitrateKbps} kbps</dd></div>}
            </dl>
          </div>
        ) : undefined}
      </OutputPanel>

      <StatusLine id={`${id}-status`}>{notice}</StatusLine>
      <PrivacyNote>
        Decoding, WAV encoding and real-time WebM recording stay in this browser. The source and converted audio are
        never uploaded, saved or added to a route.
      </PrivacyNote>
    </ToolLayout>
  );
}
