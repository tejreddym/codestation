"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalDefinition } from "@/config/local-contract";
import type { PdfToolId } from "@/config/pdf-tools";
import { buildOutputName } from "@/lib/tools/pdf/filenames";
import { parsePageRange } from "@/lib/tools/pdf/page-range";
import { renderPdfPageToCanvas } from "@/lib/tools/pdf/pdfjs";
import { formatFileSize, usePdfDocument } from "@/lib/tools/pdf/usePdfDocument";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { CanvasStage } from "./ui/CanvasStage";
import { DataTable } from "./ui/DataTable";
import { DropZone } from "./ui/DropZone";
import { Field } from "./ui/Field";
import { OutputPanel } from "./ui/OutputPanel";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { ProgressBar } from "./ui/ProgressBar";
import { StatusLine } from "./ui/StatusLine";
import { RangeInput, Select, TextInput } from "./ui/controls";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import ui from "./ui/ui.module.css";
import styles from "./PdfImagesTool.module.css";

const MAX_RENDER_PAGES = 100;
const WARN_PAGES_AT_300_DPI = 50;
const DPI_OPTIONS = [72, 150, 300] as const;
type Dpi = (typeof DPI_OPTIONS)[number];
type ImageFormat = "png" | "jpeg";

type RenderedPage = {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  filename: string;
};

type Preview = {
  blob: Blob;
  pageNumber: number;
  width: number;
  height: number;
};

type Selection = {
  indexes: number[];
  error: string | null;
};

function readSelection(input: string, pageCount: number): Selection {
  try {
    return { indexes: parsePageRange(input, pageCount), error: null };
  } catch (selectionError) {
    return {
      indexes: [],
      error:
        selectionError instanceof Error
          ? selectionError.message
          : "Enter page numbers or ranges, for example 1-3, 5.",
    };
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode this page. Try a lower resolution."));
      },
      type,
      quality,
    );
  });
}

type PdfImagesToolProps = {
  definition: LocalDefinition<PdfToolId>;
};

export default function PdfImagesTool({ definition }: PdfImagesToolProps) {
  const { source, loading, error: fileError, open, clear, setError } = usePdfDocument();
  const [rangeInput, setRangeInput] = useState("all");
  const [dpi, setDpi] = useState<Dpi>(150);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [quality, setQuality] = useState(0.9);
  const [results, setResults] = useState<RenderedPage[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setRunError] = useState<string | null>(null);
  const [archiveName, setArchiveName] = useState("document-images.zip");
  const abortRef = useRef<AbortController | null>(null);

  const selection = useMemo(
    () => (source ? readSelection(rangeInput, source.pageCount) : { indexes: [], error: null }),
    [rangeInput, source],
  );
  const tooMany = selection.indexes.length > MAX_RENDER_PAGES;
  const dpiWarning = dpi === 300 && selection.indexes.length > WARN_PAGES_AT_300_DPI;
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const extension = format === "png" ? "png" : "jpg";
  const scale = dpi / 72;

  useEffect(() => {
    if (!preview) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(preview.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function resetResults() {
    setResults([]);
    setPreview(null);
    setProgress(0);
    setProgressTotal(0);
    setStatus("");
    setRunError(null);
  }

  async function handleFiles(files: FileList) {
    const file = files[0];
    if (!file) return;
    resetResults();
    setError(null);
    await open(file);
  }

  function handleClear() {
    resetResults();
    clear();
  }

  function cancelRender() {
    abortRef.current?.abort();
    setStatus("Cancelling rendering and closing the PDF document…");
    clear();
  }

  async function renderImages() {
    if (!source) return;
    const current = readSelection(rangeInput, source.pageCount);
    if (current.error) {
      setRunError(current.error);
      return;
    }
    if (current.indexes.length === 0) {
      setRunError("Select at least one page to render.");
      return;
    }
    if (current.indexes.length > MAX_RENDER_PAGES) {
      setRunError(
        `This run selects ${current.indexes.length} pages. Render at most ${MAX_RENDER_PAGES} pages per run, then use another page range.`,
      );
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setRunError(null);
    setStatus("");
    setResults([]);
    setPreview(null);
    setProgress(0);
    setProgressTotal(current.indexes.length);
    setArchiveName(buildOutputName(source.file.name, "images", "zip"));

    let completed = 0;
    try {
      for (let index = 0; index < current.indexes.length; index += 1) {
        if (controller.signal.aborted) break;
        const pageNumber = current.indexes[index] + 1;
        setStatus(`Rendering page ${pageNumber} at ${dpi} DPI…`);
        const page = await source.doc.getPage(pageNumber);
        const canvas = document.createElement("canvas");
        try {
          await renderPdfPageToCanvas(page, scale, canvas, controller.signal);
          const blob = await canvasToBlob(canvas, mime, format === "jpeg" ? quality : undefined);
          if (controller.signal.aborted) break;
          const rendered: RenderedPage = {
            pageNumber,
            blob,
            width: canvas.width,
            height: canvas.height,
            bytes: blob.size,
            filename: buildOutputName(source.file.name, `page-${String(pageNumber).padStart(3, "0")}`, extension),
          };
          completed += 1;
          setResults((previous) => [...previous, rendered]);
          if (completed === 1) {
            setPreview({ blob, pageNumber, width: canvas.width, height: canvas.height });
          }
          setProgress(completed);
        } finally {
          page.cleanup();
          canvas.width = 0;
          canvas.height = 0;
        }
      }

      if (controller.signal.aborted) {
        setStatus(
          completed > 0
            ? `Cancelled after ${completed} page${completed === 1 ? "" : "s"}. The PDF document was closed; re-upload it to continue.`
            : "Cancelled. The PDF document was closed; re-upload it to try again.",
        );
      } else {
        setStatus(`Rendered ${completed} page${completed === 1 ? "" : "s"} at ${dpi} DPI (${format.toUpperCase()}).`);
      }
    } catch (renderError) {
      if (controller.signal.aborted) {
        setStatus("Cancelled. The PDF document was closed; re-upload it to try again.");
      } else {
        setRunError(
          renderError instanceof Error && renderError.message
            ? `Could not render the PDF: ${renderError.message}`
            : "Could not render this PDF.",
        );
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function downloadZip() {
    if (results.length === 0) return;
    try {
      const { zipSync } = await import("fflate");
      const entries: Record<string, Uint8Array> = {};
      for (const result of results) {
        entries[result.filename] = new Uint8Array(await result.blob.arrayBuffer());
      }
      const zipped = zipSync(entries, { level: 0 });
      downloadBlob(new Blob([zipped as unknown as BlobPart], { type: "application/zip" }), archiveName, "application/zip");
    } catch (zipError) {
      setRunError(zipError instanceof Error ? `Could not build the ZIP: ${zipError.message}` : "Could not build the ZIP.");
    }
  }

  return (
    <ToolLayout kind="file" className={styles.imagesContainer}>
      <Panel title={definition.name} headingId="pdf-to-images-heading" padded>
        <p className={ui.hint}>{definition.description}</p>

        <div className={ui.field}>
          <span className={ui.fieldLabel}>Source PDF</span>
          <span className={ui.hint}>Choose a PDF and render its pages as images in this browser.</span>
        </div>
        <DropZone
          label="Choose a PDF file"
          accept=".pdf,application/pdf"
          disabled={loading || busy}
          onFiles={handleFiles}
        >
          <span className={styles.imagesDropTitle}>
            {source ? `Selected: ${source.file.name}` : "Click or drag a PDF file here"}
          </span>
          <span className={styles.imagesDropSub}>
            {source
              ? `${formatFileSize(source.file.size)} · ${source.pageCount} page${source.pageCount === 1 ? "" : "s"}`
              : "PDF only · images are generated locally"}
          </span>
        </DropZone>

        {loading && <StatusLine>Reading the PDF and starting the local worker…</StatusLine>}
        {fileError && <Callout kind="error">{fileError}</Callout>}

        <div className={styles.imagesControls}>
          <Field
            id="pdf-images-range"
            label="Pages"
            hint={`Use all, or numbers and ranges such as 1-3, 5. Up to ${MAX_RENDER_PAGES} pages per run.`}
          >
            <TextInput
              id="pdf-images-range"
              name="pdf-images-range"
              value={rangeInput}
              disabled={!source || busy}
              onChange={(event) => setRangeInput(event.target.value)}
              placeholder="all"
            />
          </Field>
          <Field id="pdf-images-dpi" label="Resolution" hint={`Scale ${scale.toFixed(2)}× (${dpi} DPI ÷ 72).`}>
            <Select
              id="pdf-images-dpi"
              name="pdf-images-dpi"
              value={dpi}
              disabled={!source || busy}
              onChange={(event) => setDpi(Number(event.target.value) as Dpi)}
            >
              {DPI_OPTIONS.map((option) => (
                <option key={option} value={option}>{option} DPI</option>
              ))}
            </Select>
          </Field>
          <Field id="pdf-images-format" label="Image format">
            <Select
              id="pdf-images-format"
              name="pdf-images-format"
              value={format}
              disabled={!source || busy}
              onChange={(event) => setFormat(event.target.value as ImageFormat)}
            >
              <option value="png">PNG (lossless)</option>
              <option value="jpeg">JPEG (smaller files)</option>
            </Select>
          </Field>
          {format === "jpeg" && (
            <Field id="pdf-images-quality" label={`JPEG quality (${Math.round(quality * 100)}%)`}>
              <RangeInput
                id="pdf-images-quality"
                name="pdf-images-quality"
                min={50}
                max={100}
                step={5}
                value={Math.round(quality * 100)}
                disabled={!source || busy}
                onChange={(event) => setQuality(Number(event.target.value) / 100)}
              />
            </Field>
          )}
        </div>

        {selection.error && <Callout kind="error">{selection.error}</Callout>}
        {tooMany && (
          <Callout kind="error">
            This selection contains {selection.indexes.length} pages. Render at most {MAX_RENDER_PAGES} pages per run.
          </Callout>
        )}
        {dpiWarning && !tooMany && (
          <Callout kind="warning">
            Rendering {selection.indexes.length} pages at 300 DPI can use a lot of memory. Keep this tab open, or choose 150 DPI for a faster run.
          </Callout>
        )}
        {source && !selection.error && (
          <p className={ui.metadata}>
            {selection.indexes.length} page{selection.indexes.length === 1 ? "" : "s"} selected · {dpi} DPI · {format.toUpperCase()}
          </p>
        )}

        <div className={ui.actions}>
          <Button
            variant="primary"
            onClick={renderImages}
            disabled={!source || loading || busy || tooMany || selection.indexes.length === 0 || Boolean(selection.error)}
          >
            {busy ? "Rendering…" : "Render Images"}
          </Button>
          {busy && <Button variant="danger" onClick={cancelRender}>Cancel</Button>}
          <Button onClick={handleClear} disabled={!source || loading || busy}>Clear</Button>
        </div>

        {busy && (
          <ProgressBar
            label="Rendering page images"
            value={progress}
            max={progressTotal}
            detail={`${progress} of ${progressTotal} pages complete`}
          />
        )}

        <StatusLine>{status}</StatusLine>
        {error && <Callout kind="error">{error}</Callout>}
        <PrivacyNote>
          PDF.js renders each page to a canvas on this device, then encodes it locally. The document and the images never leave your browser.
        </PrivacyNote>
      </Panel>

      <OutputPanel
        title="Rendered pages"
        headingId="pdf-to-images-output"
        label="Rendered page images"
        value={results.length > 0 ? `${results.length} pages rendered` : ""}
        empty="Choose a PDF and render images to see per-page downloads here."
        downloadDisabled={results.length === 0}
        busy={busy}
        extraActions={
          <Button size="sm" onClick={downloadZip} disabled={results.length === 0}>
            Download ZIP ({results.length})
          </Button>
        }
      >
        {results.length > 0 ? (
          <div className={styles.imagesResults}>
            <DataTable
              className={styles.imagesTable}
              caption={`Rendered page images at ${dpi} DPI (${format.toUpperCase()})`}
              columns={["Page", "Dimensions", "Size", "Download", "Preview"]}
              rows={results.map((result) => [
                `Page ${result.pageNumber}`,
                `${result.width} × ${result.height} px`,
                formatFileSize(result.bytes),
                <Button
                  key={`download-${result.pageNumber}`}
                  size="sm"
                  onClick={() => downloadBlob(result.blob, result.filename, mime)}
                >
                  Download
                </Button>,
                <Button
                  key={`preview-${result.pageNumber}`}
                  size="sm"
                  onClick={() =>
                    setPreview({
                      blob: result.blob,
                      pageNumber: result.pageNumber,
                      width: result.width,
                      height: result.height,
                    })
                  }
                >
                  Preview
                </Button>,
              ])}
            />
            {previewUrl && preview ? (
              <CanvasStage
                kind="bitmap"
                label={`Preview of rendered page ${preview.pageNumber}`}
                background="checker"
                footer={`Page ${preview.pageNumber} · ${preview.width} × ${preview.height} px`}
              >
                {/* Object URLs are revoked when the preview changes, on clear and on unmount. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.imagesPreview}
                  src={previewUrl}
                  alt={`Rendered preview of PDF page ${preview.pageNumber}`}
                />
              </CanvasStage>
            ) : null}
          </div>
        ) : undefined}
      </OutputPanel>
    </ToolLayout>
  );
}
