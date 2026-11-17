"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import type { LocalDefinition } from "@/config/local-contract";
import type { PdfToolId } from "@/config/pdf-tools";
import { buildOutputName } from "@/lib/tools/pdf/filenames";
import { renderPdfPageToCanvas } from "@/lib/tools/pdf/pdfjs";
import { moveItem, orderMap, removeItems } from "@/lib/tools/pdf/reorder";
import { formatFileSize, usePdfDocument } from "@/lib/tools/pdf/usePdfDocument";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { CanvasStage } from "./ui/CanvasStage";
import { DataTable } from "./ui/DataTable";
import { DropZone } from "./ui/DropZone";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { ProgressBar } from "./ui/ProgressBar";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import ui from "./ui/ui.module.css";
import styles from "./PdfReorderTool.module.css";

type PdfReorderToolProps = {
  definition: LocalDefinition<PdfToolId>;
};

export default function PdfReorderTool({ definition }: PdfReorderToolProps) {
  const { source, loading, error: fileError, open, clear, setError } = usePdfDocument();
  const [order, setOrder] = useState<number[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [thumbDone, setThumbDone] = useState(0);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState("");
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (pendingFocus.current) {
      document.getElementById(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  }, [order]);

  useEffect(() => {
    if (!source) {
      setThumbDone(0);
      return;
    }
    let cancelled = false;
    setThumbDone(0);
    setThumbError(null);

    const renderThumbnails = async () => {
      for (let pageIndex = 0; pageIndex < source.pageCount; pageIndex += 1) {
        if (cancelled) return;
        let page;
        try {
          page = await source.doc.getPage(pageIndex + 1);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.max(0.1, Math.min(1.4, 150 / baseViewport.width));
          const canvas = canvasRefs.current.get(pageIndex);
          if (canvas) {
            await renderPdfPageToCanvas(page, scale, canvas);
          }
        } catch {
          if (!cancelled) setThumbError("Some page thumbnails could not be rendered. Reordering and export still work.");
        } finally {
          page?.cleanup();
        }
        if (!cancelled) setThumbDone(pageIndex + 1);
      }
    };

    void renderThumbnails();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const mapping = useMemo(() => orderMap(order), [order]);
  const changed = useMemo(
    () => source !== null && (order.length !== source.pageCount || order.some((page, index) => page !== index)),
    [order, source],
  );

  function resetAll() {
    setOrder([]);
    setThumbDone(0);
    setThumbError(null);
    setExportError(null);
    setSuccess("");
    setStatus("");
    setDragIndex(null);
    setDragOver(null);
  }

  async function handleFiles(files: FileList) {
    const file = files[0];
    if (!file) return;
    resetAll();
    setError(null);
    const loaded = await open(file);
    if (loaded) {
      setOrder(Array.from({ length: loaded.pageCount }, (_, index) => index));
      setStatus(`Loaded ${loaded.pageCount} page${loaded.pageCount === 1 ? "" : "s"}. Drag cards or use Move up/down.`);
    }
  }

  function handleClear() {
    resetAll();
    clear();
  }

  function movePage(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return;
    const original = order[from];
    setOrder((previous) => moveItem(previous, from, to));
    const preferred =
      to > 0
        ? `reorder-up-${original}`
        : to < order.length - 1
          ? `reorder-down-${original}`
          : `reorder-card-${original}`;
    pendingFocus.current = preferred;
    setStatus(`Moved original page ${original + 1} to position ${to + 1}.`);
  }

  function removePage(index: number) {
    const original = order[index];
    const remaining = removeItems(order, [index]);
    setOrder(remaining);
    const nextFocus = remaining[Math.min(index, remaining.length - 1)];
    pendingFocus.current = nextFocus !== undefined ? `reorder-card-${nextFocus}` : null;
    setStatus(`Removed original page ${original + 1}.`);
  }

  function resetOrder() {
    if (!source) return;
    setOrder(Array.from({ length: source.pageCount }, (_, index) => index));
    pendingFocus.current = source.pageCount > 0 ? "reorder-card-0" : null;
    setStatus("Restored the original page order.");
  }

  function handleDrop(target: number) {
    if (dragIndex !== null) movePage(dragIndex, target);
    setDragIndex(null);
    setDragOver(null);
  }

  async function exportPdf() {
    if (!source) return;
    if (order.length === 0) {
      setExportError("Keep at least one page before exporting.");
      return;
    }
    setBusy(true);
    setExportError(null);
    setSuccess("");
    setStatus("Building the reordered PDF locally…");

    try {
      const originalDoc = await PDFDocument.load(source.bytes);
      if (originalDoc.getPageCount() !== source.pageCount) {
        throw new Error("The source page count changed while the tool was open. Re-upload the PDF.");
      }
      const reordered = await PDFDocument.create();
      const copied = await reordered.copyPages(originalDoc, order);
      for (const page of copied) reordered.addPage(page);
      const bytes = await reordered.save();

      const verification = await PDFDocument.load(bytes);
      if (verification.getPageCount() !== order.length) {
        throw new Error("The exported PDF did not reopen with the expected page count.");
      }

      downloadBlob(
        new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        buildOutputName(source.file.name, "reordered", "pdf"),
        "application/pdf",
      );
      setSuccess(
        `Exported ${order.length} page${order.length === 1 ? "" : "s"} in the new order. The generated file reopened successfully with ${verification.getPageCount()} page${verification.getPageCount() === 1 ? "" : "s"}.`,
      );
      setStatus("Reordered PDF downloaded.");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not build the reordered PDF.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolLayout kind="file" className={styles.reorderContainer}>
      <Panel title={definition.name} headingId="pdf-reorder-pages-heading" padded>
        <p className={ui.hint}>{definition.description}</p>

        <div className={ui.field}>
          <span className={ui.fieldLabel}>Source PDF</span>
          <span className={ui.hint}>Choose a PDF, then arrange its pages. The original file is never modified.</span>
        </div>
        <DropZone
          label="Choose a PDF file"
          accept=".pdf,application/pdf"
          disabled={loading || busy}
          onFiles={handleFiles}
        >
          <span className={styles.reorderDropTitle}>
            {source ? `Selected: ${source.file.name}` : "Click or drag a PDF file here"}
          </span>
          <span className={styles.reorderDropSub}>
            {source
              ? `${formatFileSize(source.file.size)} · ${source.pageCount} page${source.pageCount === 1 ? "" : "s"}`
              : "PDF only · thumbnails render locally"}
          </span>
        </DropZone>

        {loading && <StatusLine>Reading the PDF and preparing thumbnails…</StatusLine>}
        {fileError && <Callout kind="error">{fileError}</Callout>}

        <div className={ui.actions}>
          <Button variant="primary" onClick={exportPdf} disabled={!source || loading || busy || order.length === 0}>
            {busy ? "Exporting…" : "Export Reordered PDF"}
          </Button>
          <Button onClick={resetOrder} disabled={!source || loading || busy}>Reset Order</Button>
          <Button onClick={handleClear} disabled={!source || loading || busy}>Clear</Button>
        </div>
        <StatusLine>{status}</StatusLine>
        {success && <Callout kind="success">{success}</Callout>}
        {exportError && <Callout kind="error">{exportError}</Callout>}
        <PrivacyNote>
          Reordering and PDF generation happen in this browser with PDF.js and pdf-lib. No page content is uploaded.
        </PrivacyNote>
      </Panel>

      {source && (
        <Panel
          title="Page order"
          headingId="pdf-reorder-pages-order"
          actions={
            <span className={styles.reorderCount}>
              {order.length} page{order.length === 1 ? "" : "s"}
              {changed ? " · changed" : " · original order"}
            </span>
          }
          padded
        >
          {thumbError && <Callout kind="warning">{thumbError}</Callout>}
          {thumbDone < source.pageCount && (
            <ProgressBar
              label="Rendering page thumbnails"
              value={thumbDone}
              max={source.pageCount}
              detail={`${thumbDone} of ${source.pageCount} pages`}
            />
          )}
          <CanvasStage
            kind="bitmap"
            label="PDF page thumbnails in output order"
            background="grid"
            footer="Drag a card to a new position, or focus a card and use Move up / Move down."
          >
            <ol className={styles.reorderGrid} aria-label="Pages in output order">
              {order.map((originalPage, position) => {
                return (
                  <li
                    key={originalPage}
                    id={`reorder-card-${originalPage}`}
                    className={`${styles.reorderCard} ${dragOver === position ? styles.reorderDropTarget : ""}`}
                    tabIndex={-1}
                    draggable
                    aria-label={`Position ${position + 1}, original page ${originalPage + 1}`}
                    onDragStart={(event) => {
                      setDragIndex(position);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(originalPage));
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOver(position);
                    }}
                    onDragLeave={() => setDragOver((current) => (current === position ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop(position);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOver(null);
                    }}
                  >
                    <div className={styles.reorderCardHeader}>
                      <span className={styles.reorderPosition}>#{position + 1}</span>
                      <span className={styles.reorderOriginal}>original page {originalPage + 1}</span>
                    </div>
                    <canvas
                      ref={(element) => {
                        if (element) canvasRefs.current.set(originalPage, element);
                        else canvasRefs.current.delete(originalPage);
                      }}
                      className={styles.reorderCanvas}
                      role="img"
                      aria-label={`Thumbnail of original page ${originalPage + 1}`}
                    />
                    <div className={styles.reorderCardActions}>
                      <Button
                        id={`reorder-up-${originalPage}`}
                        size="sm"
                        aria-label={`Move original page ${originalPage + 1} up from position ${position + 1}`}
                        disabled={position === 0 || busy}
                        onClick={() => movePage(position, position - 1)}
                      >
                        Move up
                      </Button>
                      <Button
                        id={`reorder-down-${originalPage}`}
                        size="sm"
                        aria-label={`Move original page ${originalPage + 1} down from position ${position + 1}`}
                        disabled={position === order.length - 1 || busy}
                        onClick={() => movePage(position, position + 1)}
                      >
                        Move down
                      </Button>
                      <Button
                        id={`reorder-remove-${originalPage}`}
                        size="sm"
                        variant="danger"
                        aria-label={`Remove original page ${originalPage + 1} from the output`}
                        disabled={busy}
                        onClick={() => removePage(position)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CanvasStage>
          {order.length === 0 && (
            <Callout kind="warning">
              Every page has been removed. Use Reset Order to restore all {source.pageCount} pages.
            </Callout>
          )}
        </Panel>
      )}

      {source && (
        <Panel title="Mapping summary" headingId="pdf-reorder-pages-mapping" padded>
          <p className={ui.metadata}>
            Each new position maps to the original page it came from. Removed pages are omitted.
          </p>
          <DataTable
            caption="New document position to original page"
            columns={["New position", "Original page", "Status"]}
            rows={mapping.map((entry, index) => [
              `#${entry.position}`,
              `original page ${entry.originalPage}`,
              entry.originalPage === index + 1 ? "Unchanged" : "Moved",
            ])}
            empty="No pages remain in the output."
          />
        </Panel>
      )}
    </ToolLayout>
  );
}
