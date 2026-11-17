"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  MERGER_MAX_DURATION_SECONDS,
  MERGER_MAX_GAP_SECONDS,
  mergedFilename,
  parseGapField,
  planMerge,
  writeSourceInto,
} from "@/lib/tools/audio/merger";
import { estimateWavBytes, MAX_OUTPUT_WARNING_BYTES } from "@/lib/tools/audio/compressor";
import { encodeWavFromChannels, formatAudioTime } from "@/lib/tools/audio/engine";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { TextInput } from "./ui/controls";
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
import styles from "./AudioMergerTool.module.css";

type SourceItem = {
  id: string;
  name: string;
  size: number;
  buffer: AudioBuffer;
};

type Result = {
  bytes: Uint8Array;
  duration: number;
  sampleRate: number;
  channels: number;
  sourceCount: number;
};

const id = "audio-merger";

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export default function AudioMergerTool() {
  const definition = getAudioDefinition("audio-merger")!;
  const [items, setItems] = useState<SourceItem[]>([]);
  const [gapRaw, setGapRaw] = useState("0");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<"decode" | "merge" | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dropKey, setDropKey] = useState(0);
  const counter = useRef(0);
  const mounted = useRef(true);
  const decodeToken = useRef(0);
  const run = useRef<{ cancelled: boolean } | null>(null);
  const pendingFocus = useRef<{ id: string; direction: "up" | "down" } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (run.current) run.current.cancelled = true;
    };
  }, []);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const primary = document.getElementById(`${id}-${pending.direction}-${pending.id}`) as HTMLButtonElement | null;
    const fallback = document.getElementById(`${id}-${pending.direction === "up" ? "down" : "up"}-${pending.id}`) as HTMLButtonElement | null;
    const target = primary && !primary.disabled ? primary : fallback && !fallback.disabled ? fallback : primary;
    target?.focus();
  }, [items]);

  const gap = parseGapField(gapRaw);
  const plan = useMemo(
    () => planMerge(items.map(item => item.buffer), gap.seconds),
    [items, gap.seconds],
  );
  const estimatedBytes = estimateWavBytes(plan.totalFrames, plan.targetChannels);
  const disabled = Boolean(busy) || items.length < 2 || Boolean(gap.error) || !plan.withinLimit;

  function resetResult() {
    setResult(null);
    setNotice("");
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    const list = Array.from(files);
    const invalid = list.filter(file => !isAudioFile(file.name, file.type));
    setError("");
    resetResult();
    if (invalid.length) {
      setError(`${audioFileRejection()} Rejected: ${invalid.map(file => file.name).join(", ")}.`);
      setDropKey(key => key + 1);
      return;
    }

    const token = ++decodeToken.current;
    const context = createAudioContext();
    setBusy("decode");
    setNotice(`Decoding ${list.length} audio file${list.length === 1 ? "" : "s"} locally…`);
    const decoded: SourceItem[] = [];
    let failed = "";
    try {
      await resumeAudioContext(context);
      for (const file of list) {
        try {
          const buffer = await decodeAudioFile(file, context);
          decoded.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${counter.current++}`,
            name: file.name,
            size: file.size,
            buffer,
          });
        } catch {
          failed = file.name;
          break;
        }
      }
      if (!mounted.current || token !== decodeToken.current) return;
      if (decoded.length) setItems(current => [...current, ...decoded]);
      if (failed) {
        setError(`${failed} could not be decoded. ${decodeFailureMessage()}`);
        setNotice(decoded.length
          ? `${decoded.length} file${decoded.length === 1 ? "" : "s"} added before the error.`
          : "No audio files were added.");
      } else {
        setNotice(`${decoded.length} file${decoded.length === 1 ? "" : "s"} added. Reorder them or merge.`);
      }
    } catch {
      if (mounted.current && token === decodeToken.current) {
        setError(decodeFailureMessage());
        setNotice("No audio files were added.");
      }
    } finally {
      await context.close().catch(() => undefined);
      if (mounted.current && token === decodeToken.current) {
        setBusy(null);
        setDropKey(key => key + 1);
      }
    }
  }

  function move(index: number, direction: "up" | "down") {
    if (busy) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const item = items[index];
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setItems(next);
    pendingFocus.current = { id: item.id, direction };
    resetResult();
  }

  function remove(index: number) {
    if (busy) return;
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
    resetResult();
    setNotice("File removed. The remaining order is unchanged.");
  }

  function clear() {
    if (busy) return;
    decodeToken.current += 1;
    run.current = null;
    setItems([]);
    setResult(null);
    setError("");
    setNotice("");
    setProgress(0);
    setGapRaw("0");
    setDropKey(key => key + 1);
  }

  async function merge() {
    if (disabled || busy) return;
    const token = { cancelled: false };
    run.current = token;
    setBusy("merge");
    setError("");
    setResult(null);
    setProgress(0);
    setNotice("Building the merged WAV in browser memory…");

    try {
      const channels = [
        new Float32Array(plan.totalFrames),
        new Float32Array(plan.totalFrames),
      ];
      let offset = 0;
      for (let index = 0; index < items.length; index += 1) {
        if (token.cancelled || !mounted.current) break;
        offset += writeSourceInto(channels, offset, items[index].buffer, plan.targetSampleRate);
        setProgress(index + 1);
        if (index < items.length - 1) offset += plan.gapFrames;
        await nextFrame();
      }

      if (!mounted.current || run.current !== token) return;
      if (token.cancelled) {
        setNotice("Merging cancelled. No output file was created.");
        return;
      }

      setNotice("Encoding the merged 16-bit PCM WAV…");
      const bytes = encodeWavFromChannels(channels, plan.targetSampleRate);
      if (!mounted.current || run.current !== token) return;
      setResult({
        bytes,
        duration: bytes.length > 44 ? (bytes.length - 44) / (plan.targetChannels * 2) / plan.targetSampleRate : 0,
        sampleRate: plan.targetSampleRate,
        channels: plan.targetChannels,
        sourceCount: items.length,
      });
      setNotice("Merge finished. The WAV download is ready.");
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Could not merge these audio files.");
        setNotice("No output was created.");
      }
    } finally {
      if (run.current === token) run.current = null;
      if (mounted.current) setBusy(null);
    }
  }

  function cancel() {
    if (!run.current) return;
    run.current.cancelled = true;
    setNotice("Cancelling after the current file…");
  }

  const outputName = mergedFilename(items[0]?.name ?? "audio");

  return (
    <ToolLayout kind="data" className={styles.container}>
      <Panel title={definition.name} headingId={`${id}-heading`} padded>
        <p className={ui.hint}>
          Join two or more local audio files in the listed order. Every input is normalised to the highest sample
          rate and two channels (mono is duplicated), and one 16-bit PCM WAV is exported. Optional silence is inserted between files.
        </p>

        <div className={styles.form}>
          <DropZone
            key={dropKey}
            label="Add audio files"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            multiple
            disabled={Boolean(busy)}
            onFiles={files => void addFiles(files)}
          >
            <span>Select or drop two or more audio files</span>
            <span className={ui.hint}>Files are appended in the order you choose; reorder them below.</span>
          </DropZone>

          {items.length > 0 && (
            <ol className={styles.list} aria-label="Audio files in merge order">
              {items.map((item, index) => (
                <li className={styles.row} key={item.id}>
                  <span className={styles.index} aria-hidden="true">{index + 1}</span>
                  <div className={styles.itemBody}>
                    <strong>{item.name}</strong>
                    <span>
                      {formatAudioTime(item.buffer.duration)} · {item.buffer.sampleRate.toLocaleString()} Hz ·{" "}
                      {item.buffer.numberOfChannels === 1 ? "mono" : `${item.buffer.numberOfChannels} channels`} ·{" "}
                      {formatSize(item.size)}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <Button
                      size="sm"
                      id={`${id}-up-${item.id}`}
                      aria-label={`Move ${item.name} up`}
                      disabled={Boolean(busy) || index === 0}
                      onClick={() => move(index, "up")}
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      id={`${id}-down-${item.id}`}
                      aria-label={`Move ${item.name} down`}
                      disabled={Boolean(busy) || index === items.length - 1}
                      onClick={() => move(index, "down")}
                    >
                      Down
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Remove ${item.name}`}
                      disabled={Boolean(busy)}
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {items.length > 0 && (
            <dl className={styles.summary} aria-label="Merge summary">
              <div><dt>Files</dt><dd>{items.length}</dd></div>
              <div><dt>Planned duration</dt><dd>{formatAudioTime(plan.totalDuration)}</dd></div>
              <div><dt>Target rate</dt><dd>{plan.targetSampleRate.toLocaleString()} Hz</dd></div>
              <div><dt>Channels</dt><dd>{plan.targetChannels}</dd></div>
              <div><dt>Estimated WAV</dt><dd>{formatSize(estimatedBytes)}</dd></div>
            </dl>
          )}

          <Field
            id={`${id}-gap`}
            label={`Silence between files (0–${MERGER_MAX_GAP_SECONDS} s)`}
            hint="Inserted between each consecutive pair of files. Default 0."
            error={gap.error}
          >
            <TextInput
              id={`${id}-gap`}
              type="number"
              inputMode="decimal"
              min={0}
              max={MERGER_MAX_GAP_SECONDS}
              step={0.1}
              value={gapRaw}
              disabled={Boolean(busy)}
              aria-invalid={gap.error ? true : undefined}
              aria-describedby={gap.error ? `${id}-gap-error` : `${id}-gap-hint`}
              onChange={event => {
                setGapRaw(event.target.value);
                resetResult();
              }}
            />
          </Field>

          {!plan.withinLimit && plan.reason && (
            <Callout kind="warning">{plan.reason}</Callout>
          )}
          {estimatedBytes > MAX_OUTPUT_WARNING_BYTES && plan.withinLimit && (
            <Callout kind="warning">
              Estimated WAV output is {formatSize(estimatedBytes)}, above 100 MB. Rendering may be slow or fail on
              low-memory devices. The limit is {MERGER_MAX_DURATION_SECONDS / 60} minutes of merged audio.
            </Callout>
          )}
          {error && <Callout kind="error" id={`${id}-error`}>{error}</Callout>}

          <div className={ui.actions}>
            <Button variant="primary" disabled={disabled} onClick={() => void merge()}>
              Merge {items.length || ""} files
            </Button>
            {busy === "merge" && <Button variant="danger" onClick={cancel}>Cancel</Button>}
            <Button disabled={Boolean(busy)} onClick={clear}>Clear</Button>
          </div>

          {busy === "merge" && (
            <ProgressBar
              label="Merging audio files"
              value={progress}
              max={Math.max(1, items.length)}
              detail={progress >= items.length ? "Encoding the merged WAV…" : `Writing file ${Math.min(items.length, progress + 1)} of ${items.length}.`}
            />
          )}
        </div>
      </Panel>

      <OutputPanel
        title="Merged output"
        headingId={`${id}-output`}
        label="merged audio result"
        empty="Add at least two files, set an optional gap, then merge to create one WAV download."
        busy={busy === "merge"}
        downloadDisabled={!result}
        onDownload={result ? () => downloadBlob(new Blob([result.bytes as unknown as BlobPart], { type: "audio/wav" }), outputName) : undefined}
        filename={result ? outputName : undefined}
        mimeType="audio/wav"
      >
        {result ? (
          <dl className={styles.metrics} aria-label="Merged audio metadata">
            <div><dt>Files merged</dt><dd>{result.sourceCount}</dd></div>
            <div><dt>Duration</dt><dd>{formatAudioTime(result.duration)}</dd></div>
            <div><dt>Sample rate</dt><dd>{result.sampleRate.toLocaleString()} Hz</dd></div>
            <div><dt>Channels</dt><dd>{result.channels}</dd></div>
            <div><dt>WAV size</dt><dd>{formatSize(result.bytes.length)}</dd></div>
            <div><dt>Output</dt><dd>16-bit PCM WAV</dd></div>
          </dl>
        ) : undefined}
      </OutputPanel>

      <StatusLine id={`${id}-status`}>{notice}</StatusLine>
      <PrivacyNote>
        Audio decoding and WAV assembly stay in this browser. Files are never uploaded, saved or added to a route.
      </PrivacyNote>
    </ToolLayout>
  );
}
