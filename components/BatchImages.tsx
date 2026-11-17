"use client";

import { useEffect, useRef, useState } from "react";
import { batchFilename, maxBatchBytes, validateBatch } from "@/lib/workbench/batch";
import { Button } from "./ui/Button";
import { ColorInput, Select, TextInput } from "./ui/controls";
import { DropZone } from "./ui/DropZone";
import { EmptyState } from "./ui/EmptyState";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import ui from "./ui/ui.module.css";
import styles from "./BatchImages.module.css";

type Row = { name: string; state: "ready" | "working" | "done" | "error"; blob?: Blob; output?: string; message?: string };

export default function BatchImages() {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState("webp");
  const [quality, setQuality] = useState("85");
  const [background, setBackground] = useState("#FFFFFF");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => () => { generation.current++; }, []);

  function reset() {
    generation.current++;
    setBusy(false);
    setRows(files.map(f => ({ name: f.name, state: "ready" })));
    setStatus("");
  }

  function choose(nextFiles: File[]) {
    generation.current++;
    setBusy(false);
    setFiles(nextFiles);
    setRows(nextFiles.map(f => ({ name: f.name, state: "ready" })));
    try {
      validateBatch(nextFiles);
      setStatus("Ready to convert.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Invalid batch.");
    }
  }

  async function convert() {
    const version = ++generation.current;
    setBusy(true);
    setRows(files.map(f => ({ name: f.name, state: "ready" })));
    let bytes = 0;
    try {
      validateBatch(files);
      if (!/^\d+$/.test(quality) || Number(quality) < 1 || Number(quality) > 100) throw new Error("Quality must be a whole number from 1 to 100.");
      const { runImage } = await import("@/lib/tools/image/engine");
      for (let index = 0; index < files.length; index++) {
        if (version !== generation.current) return;
        setStatus(`Converting ${index + 1} of ${files.length}`);
        setRows(r => r.map((row, i) => i === index ? { ...row, state: "working" } : row));
        try {
          const result = await runImage(`png-to-${target}`, { file: files[index], quality, background: target === "jpg" ? background : "transparent" });
          if (version !== generation.current) return;
          if (!result.blob) throw new Error("No converted image was returned.");
          if (bytes + result.blob.size > maxBatchBytes) throw new Error("Output memory limit reached (64 MiB). Use a smaller batch.");
          bytes += result.blob.size;
          setRows(r => r.map((row, i) => i === index ? { ...row, state: "done", blob: result.blob, output: batchFilename(files[index].name, index, target), message: result.warnings?.join(" ") } : row));
        } catch (error) {
          if (version !== generation.current) return;
          setRows(r => r.map((row, i) => i === index ? { ...row, state: "error", message: error instanceof Error ? error.message : "Conversion failed." } : row));
        }
      }
      setStatus("Batch finished. Review each file before downloading.");
    } catch (e) {
      if (version === generation.current) setStatus(e instanceof Error ? e.message : "Batch failed.");
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function zip() {
    const version = generation.current;
    try {
      setStatus("Preparing ZIP…");
      const { zipSync } = await import("fflate");
      const entries: Record<string, Uint8Array> = {};
      for (const row of rows) {
        if (row.blob && row.output) entries[row.output] = new Uint8Array(await row.blob.arrayBuffer());
        if (version !== generation.current) return;
      }
      const data = zipSync(entries, { level: 0 });
      download(new Blob([data as BlobPart], { type: "application/zip" }), "code-station-images.zip");
      setStatus("ZIP download requested. Only successful files are included.");
    } catch {
      setStatus("ZIP could not be prepared. Download files individually or use a smaller batch.");
    }
  }

  const successful = rows.some(row => row.blob);

  return (
    <ToolLayout kind="data" className={styles.container}>
      <Panel title="Batch conversion" headingId="batch-images-heading" padded>
        <div className={styles.stack}>
          <Hint>
            PNG → JPG or WebP, processed one at a time. Up to 20 files, 16 MiB each and 64 MiB total;
            outputs are also capped at 64 MiB. Files remain in memory.
          </Hint>

          <DropZone
            key={inputKey}
            id="batch-files"
            label="PNG files"
            accept="image/png,.png"
            multiple
            disabled={busy}
            onFiles={list => choose(Array.from(list))}
          >
            <span className={styles.dropText}>Drop PNG files here, or click to choose</span>
            <span className={styles.dropSub}>PNG only · processed locally in this browser</span>
          </DropZone>

          <div className={styles.options}>
            <Field id="batch-target" label="Output format">
              <Select
                id="batch-target"
                value={target}
                onChange={e => { reset(); setTarget(e.target.value); }}
              >
                <option value="webp">WebP</option>
                <option value="jpg">JPG</option>
              </Select>
            </Field>
            <Field id="batch-quality" label="Quality">
              <TextInput
                id="batch-quality"
                type="number"
                min="1"
                max="100"
                step="1"
                value={quality}
                onChange={e => { reset(); setQuality(e.target.value); }}
              />
            </Field>
            {target === "jpg" && (
              <Field id="batch-background" label="Background">
                <ColorInput
                  id="batch-background"
                  value={background}
                  onChange={e => { reset(); setBackground(e.target.value); }}
                />
              </Field>
            )}
          </div>

          <Hint>
            Native browser encoding removes source metadata and flattens animation. JPG fills transparent
            areas with your chosen background. Original files remain unchanged.
          </Hint>

          <div className={ui.actions}>
            <Button variant="primary" disabled={busy || !files.length} onClick={() => void convert()}>
              Convert batch
            </Button>
            {busy && (
              <Button
                onClick={() => {
                  reset();
                  setStatus("Cancelled. Any in-progress native conversion will finish silently; its result is discarded.");
                }}
              >
                Cancel batch
              </Button>
            )}
            <Button
              onClick={() => {
                generation.current++;
                setBusy(false);
                setFiles([]);
                setRows([]);
                setStatus("Cleared.");
                setInputKey(key => key + 1);
              }}
            >
              Clear files
            </Button>
            <Button disabled={busy || !successful} onClick={() => void zip()}>
              Download successful files as ZIP
            </Button>
          </div>

          <StatusLine>{status}</StatusLine>
        </div>
      </Panel>

      <Panel level={3} title="Batch queue" headingId="batch-images-queue" padded>
        <div className={styles.stack}>
          <progress aria-label="Batch progress" max={Math.max(1, rows.length)} value={rows.filter(row => row.state === "done" || row.state === "error").length} />
          {rows.length > 0 ? (
            <ul className={styles.results}>
              {rows.map((row, index) => (
                <li key={index} className={styles.resultItem}>
                  <div className={styles.resultHead}>
                    <strong className={styles.resultName}>{row.name}</strong>
                    <span className={styles.resultState}>{row.state}</span>
                    {row.blob && (
                      <Button size="sm" onClick={() => download(row.blob!, row.output!)}>
                        Download {row.output}
                      </Button>
                    )}
                  </div>
                  {row.message && <p className={styles.resultMessage}>{row.message}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Choose PNG files to build a conversion queue.</EmptyState>
          )}
        </div>
      </Panel>
    </ToolLayout>
  );
}
