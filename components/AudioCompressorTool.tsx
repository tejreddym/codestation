"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioDefinition } from "@/config/audio-tools";
import {
  decodeAudioFile,
  decodeFailureMessage,
  audioFileRejection,
  isAudioFile,
  readChannels,
} from "@/lib/tools/audio/decode";
import {
  COMPRESSOR_RULES,
  DEFAULT_COMPRESSOR_FIELDS,
  MAX_OUTPUT_WARNING_BYTES,
  applyGainDb,
  estimateWavBytes,
  formatDb,
  gainReductionDb,
  measurePeakDb,
  measureRmsDb,
  normalizePeak,
  sanitizeCompressorFields,
  type CompressorFieldValues,
  type CompressorNumericKey,
} from "@/lib/tools/audio/compressor";
import { renderCompressedChannels } from "@/lib/tools/audio/compressor-render";
import { encodeWavFromChannels, formatAudioTime } from "@/lib/tools/audio/engine";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Checkbox, TextInput } from "./ui/controls";
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
import styles from "./AudioCompressorTool.module.css";

type Source = {
  name: string;
  size: number;
  buffer: AudioBuffer;
};

type Result = {
  bytes: Uint8Array;
  duration: number;
  sampleRate: number;
  channels: number;
  inputPeakDb: number;
  inputRmsDb: number;
  compressedRmsDb: number;
  reductionDb: number;
  outputPeakDb: number;
  outputRmsDb: number;
  makeupGainDb: number;
  normalizationGainDb: number;
};

const id = "audio-compressor";

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioCompressorTool() {
  const definition = getAudioDefinition("audio-compressor")!;
  const [fields, setFields] = useState<CompressorFieldValues>(DEFAULT_COMPRESSOR_FIELDS);
  const [normalizePeakOutput, setNormalizePeakOutput] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<"decode" | "process" | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dropKey, setDropKey] = useState(0);
  const mounted = useRef(true);
  const decodeToken = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const { settings, errors } = sanitizeCompressorFields(fields, normalizePeakOutput);
  const hasErrors = Object.keys(errors).length > 0;
  const estimatedBytes = source
    ? estimateWavBytes(source.buffer.length, source.buffer.numberOfChannels)
    : 0;

  function updateField(key: CompressorNumericKey, value: string) {
    setFields(current => ({ ...current, [key]: value }));
  }

  function resetResult() {
    setResult(null);
    setNotice("");
  }

  function clear() {
    if (busy) return;
    decodeToken.current += 1;
    setSource(null);
    setResult(null);
    setError("");
    setNotice("");
    setProgress(0);
    setDropKey(key => key + 1);
  }

  async function chooseFile(file: File | null) {
    if (!file || busy) return;
    resetResult();
    setError("");
    setProgress(0);

    if (!isAudioFile(file.name, file.type)) {
      setSource(null);
      setError(audioFileRejection());
      setDropKey(key => key + 1);
      return;
    }

    const token = ++decodeToken.current;
    setBusy("decode");
    setNotice("Decoding the audio locally…");
    try {
      const buffer = await decodeAudioFile(file);
      if (!mounted.current || token !== decodeToken.current) return;
      setSource({ name: file.name, size: file.size, buffer });
      setProgress(1);
      setNotice("Audio ready. Adjust the compressor settings, then process.");
    } catch {
      if (!mounted.current || token !== decodeToken.current) return;
      setSource(null);
      setError(decodeFailureMessage());
      setNotice("No audio was loaded.");
      setDropKey(key => key + 1);
    } finally {
      if (mounted.current && token === decodeToken.current) setBusy(null);
    }
  }

  async function compress() {
    if (!source || busy || hasErrors) return;
    setError("");
    setResult(null);
    setBusy("process");
    setProgress(1);
    setNotice("Rendering DynamicsCompressorNode offline…");

    try {
      const inputChannels = readChannels(source.buffer);
      const inputPeakDb = measurePeakDb(inputChannels);
      const inputRmsDb = measureRmsDb(inputChannels);
      const compressed = await renderCompressedChannels(source.buffer, settings);
      if (!mounted.current) return;
      setProgress(2);

      const compressedRmsDb = measureRmsDb(compressed);
      const reductionDb = gainReductionDb(inputRmsDb, compressedRmsDb);
      const withMakeup = applyGainDb(compressed, settings.makeupGainDb);
      let outputChannels = withMakeup;
      let normalizationGainDb = 0;
      if (settings.normalizePeak) {
        const normalized = normalizePeak(withMakeup, -1);
        outputChannels = normalized.channels;
        normalizationGainDb = normalized.gainDb;
      }
      setProgress(3);

      const bytes = encodeWavFromChannels(outputChannels, source.buffer.sampleRate);
      if (!mounted.current) return;
      setResult({
        bytes,
        duration: source.buffer.duration,
        sampleRate: source.buffer.sampleRate,
        channels: outputChannels.length,
        inputPeakDb,
        inputRmsDb,
        compressedRmsDb,
        reductionDb,
        outputPeakDb: measurePeakDb(outputChannels),
        outputRmsDb: measureRmsDb(outputChannels),
        makeupGainDb: settings.makeupGainDb,
        normalizationGainDb,
      });
      setProgress(4);
      setNotice("Compression finished. The WAV download is ready.");
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : "Could not compress this audio file.");
      setNotice("No output was created.");
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  const disabled = Boolean(busy) || !source || hasErrors;
  const outputName = source ? `${source.name.replace(/\.[^/.]+$/, "") || "audio"}-compressed.wav` : "compressed.wav";

  return (
    <ToolLayout kind="data" className={styles.container}>
      <Panel title={definition.name} headingId={`${id}-heading`} padded>
        <p className={ui.hint}>
          A local DynamicsCompressorNode chain shapes loud and quiet parts, then the result is encoded as a 16-bit PCM WAV.
          Threshold, ratio, attack, release, knee and makeup gain are reported with measured input/output levels.
        </p>

        <div className={styles.form}>
          <DropZone
            key={dropKey}
            label="Audio file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            disabled={Boolean(busy)}
            onFiles={files => void chooseFile(files[0] ?? null)}
          >
            <span>Select or drop one audio file</span>
            <span className={ui.hint}>{source ? source.name : "MP3, WAV, OGG, M4A, AAC or FLAC. Nothing is uploaded."}</span>
          </DropZone>

          {source && (
            <dl className={styles.sourceMeta} aria-label="Source audio metadata">
              <div><dt>File</dt><dd>{source.name}</dd></div>
              <div><dt>Size</dt><dd>{formatSize(source.size)}</dd></div>
              <div><dt>Duration</dt><dd>{formatAudioTime(source.buffer.duration)}</dd></div>
              <div><dt>Format</dt><dd>{source.buffer.sampleRate.toLocaleString()} Hz · {source.buffer.numberOfChannels === 1 ? "mono" : `${source.buffer.numberOfChannels} channels`}</dd></div>
            </dl>
          )}

          {error && <Callout kind="error" id={`${id}-error`}>{error}</Callout>}

          <fieldset className={styles.settings}>
            <legend className={styles.legend}>Compressor settings</legend>
            <div className={styles.fieldGrid}>
              {(Object.keys(COMPRESSOR_RULES) as CompressorNumericKey[]).map(key => {
                const rule = COMPRESSOR_RULES[key];
                return (
                  <Field
                    key={key}
                    id={`${id}-${key}`}
                    label={`${rule.label} (${rule.unit})`}
                    hint={`${rule.min}–${rule.max} ${rule.unit}. Default ${rule.fallback}.`}
                    error={errors[key]}
                  >
                    <TextInput
                      id={`${id}-${key}`}
                      type="number"
                      inputMode="decimal"
                      min={rule.min}
                      max={rule.max}
                      step={rule.step}
                      value={fields[key]}
                      disabled={Boolean(busy)}
                      aria-invalid={errors[key] ? true : undefined}
                      aria-describedby={errors[key] ? `${id}-${key}-error` : `${id}-${key}-hint`}
                      onChange={event => updateField(key, event.target.value)}
                    />
                  </Field>
                );
              })}
            </div>
            <Checkbox
              label="Peak-normalise the output to −1 dBFS after makeup gain"
              checked={normalizePeakOutput}
              disabled={Boolean(busy)}
              onChange={event => setNormalizePeakOutput(event.target.checked)}
            />
          </fieldset>

          {estimatedBytes > MAX_OUTPUT_WARNING_BYTES && (
            <Callout kind="warning">
              Estimated WAV output is {formatSize(estimatedBytes)}, above 100 MB. Rendering may be slow or fail on
              low-memory devices. The browser tab needs enough memory for the decoded and rendered copies.
            </Callout>
          )}

          <div className={ui.actions}>
            <Button variant="primary" disabled={disabled} onClick={() => void compress()}>
              Compress audio
            </Button>
            <Button disabled={Boolean(busy)} onClick={clear}>Clear</Button>
          </div>

          {busy && (
            <ProgressBar
              label={busy === "decode" ? "Reading audio" : "Compressing audio"}
              value={progress}
              max={4}
              detail={busy === "decode"
                ? "Decoding the local file in browser memory."
                : ["Rendering the offline compressor…", "Applying makeup and measuring levels…", "Encoding 16-bit PCM WAV…", "Finishing…"][Math.min(3, Math.max(0, progress - 1))]}
            />
          )}
        </div>
      </Panel>

      <OutputPanel
        title="Compressed output"
        headingId={`${id}-output`}
        label="compressed audio result"
        empty="Choose an audio file and run the compressor to see measured levels and a WAV download."
        busy={busy === "process"}
        downloadDisabled={!result}
        onDownload={result ? () => downloadBlob(new Blob([result.bytes as unknown as BlobPart], { type: "audio/wav" }), outputName) : undefined}
        filename={result ? outputName : undefined}
        mimeType="audio/wav"
      >
        {result ? (
          <div className={styles.result}>
            <dl className={styles.metrics} aria-label="Compression measurements">
              <div><dt>Input peak</dt><dd>{formatDb(result.inputPeakDb)}</dd></div>
              <div><dt>Input RMS</dt><dd>{formatDb(result.inputRmsDb)}</dd></div>
              <div><dt>Compressed RMS</dt><dd>{formatDb(result.compressedRmsDb)}</dd></div>
              <div><dt>Measured gain reduction</dt><dd>{result.reductionDb.toFixed(1)} dB</dd></div>
              <div><dt>Output peak</dt><dd>{formatDb(result.outputPeakDb)}</dd></div>
              <div><dt>Output RMS</dt><dd>{formatDb(result.outputRmsDb)}</dd></div>
              <div><dt>Makeup gain</dt><dd>{result.makeupGainDb.toFixed(1)} dB</dd></div>
              <div><dt>Normalisation gain</dt><dd>{result.normalizationGainDb === 0 ? "0.0 dB" : `${result.normalizationGainDb.toFixed(1)} dB`}</dd></div>
              <div><dt>Duration</dt><dd>{formatAudioTime(result.duration)}</dd></div>
              <div><dt>Sample rate</dt><dd>{result.sampleRate.toLocaleString()} Hz</dd></div>
              <div><dt>Channels</dt><dd>{result.channels}</dd></div>
              <div><dt>WAV size</dt><dd>{formatSize(result.bytes.length)}</dd></div>
            </dl>
            <p className={ui.metadata}>
              Gain reduction is the measured RMS difference before makeup gain. With a −24 dB threshold and a
              signal below it, reduction can legitimately read 0 dB.
            </p>
          </div>
        ) : undefined}
      </OutputPanel>

      <StatusLine id={`${id}-status`}>{notice}</StatusLine>
      <PrivacyNote>
        Decoding, offline compression and WAV encoding stay in this browser. The audio file and output are never
        uploaded, saved or added to a route.
      </PrivacyNote>
    </ToolLayout>
  );
}
