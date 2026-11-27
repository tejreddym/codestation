"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalDefinition } from "@/config/local-contract";
import type { PdfToolId } from "@/config/pdf-tools";
import { buildOutputName } from "@/lib/tools/pdf/filenames";
import { renderPdfPageToCanvas } from "@/lib/tools/pdf/pdfjs";
import { usePdfDocument } from "@/lib/tools/pdf/usePdfDocument";
import {
  COMPRESSION_PRESETS,
  compressPdfDocument,
  formatBytes,
  type CompressionPresetKey,
  type CompressionResult,
  type CompressProgress,
} from "@/lib/tools/pdf/compress";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { DropZone } from "./ui/DropZone";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { ProgressBar } from "./ui/ProgressBar";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import styles from "./PdfCompressorTool.module.css";

type PdfCompressorToolProps = {
  definition: LocalDefinition<PdfToolId>;
};

export default function PdfCompressorTool({ definition }: PdfCompressorToolProps) {
  const { source, loading, error: fileError, open, clear, setError } = usePdfDocument();

  const [preset, setPreset] = useState<CompressionPresetKey>("balanced");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CompressProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Generate a small thumbnail of the first page when a document is opened
  useEffect(() => {
    let active = true;
    if (!source) {
      setThumbnailUrl(null);
      return;
    }

    const canvas = document.createElement("canvas");
    source.doc
      .getPage(1)
      .then(async (page) => {
        try {
          const viewport = page.getViewport({ scale: 1.0 });
          const thumbScale = Math.min(1.0, 150 / Math.max(viewport.width, viewport.height));
          await renderPdfPageToCanvas(page, thumbScale, canvas);
          canvas.toBlob(
            (blob) => {
              if (active && blob) {
                const url = URL.createObjectURL(blob);
                setThumbnailUrl(url);
              }
            },
            "image/jpeg",
            0.7,
          );
        } catch {
          // Thumbnail preview failure is non-fatal
        } finally {
          page.cleanup();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [source]);

  // Clean up thumbnail and download URLs on unmount
  useEffect(() => {
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      abortRef.current?.abort();
    };
  }, [thumbnailUrl]);

  function resetState() {
    setResult(null);
    setProgress(null);
    setStatusMessage("");
    setRunError(null);
  }

  async function handleFiles(files: FileList) {
    const file = files[0];
    if (!file) return;
    resetState();
    setError(null);
    await open(file);
  }

  function handleClear() {
    resetState();
    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl);
      setThumbnailUrl(null);
    }
    clear();
  }

  function handleCancel() {
    abortRef.current?.abort();
    setStatusMessage("Compressing cancelled. No file was saved.");
    setBusy(false);
  }

  async function handleCompress() {
    if (!source) return;

    resetState();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    try {
      const compressionResult = await compressPdfDocument(
        source.doc,
        {
          preset,
          originalSize: source.file.size,
          onProgress: (p) => setProgress(p),
          signal: controller.signal,
        },
      );

      if (controller.signal.aborted) {
        setStatusMessage("Compressing cancelled.");
        return;
      }

      setResult(compressionResult);

      if (compressionResult.savingsBytes > 0) {
        setStatusMessage(
          `Compression reduced file size by ${compressionResult.savingsPercentage}% (${formatBytes(
            compressionResult.savingsBytes,
          )} saved)!`,
        );
      } else {
        setStatusMessage(
          "Original file was already compact. Downsampling vector elements did not reduce file size further.",
        );
      }
    } catch (compressErr) {
      if (controller.signal.aborted) {
        setStatusMessage("Compressing cancelled.");
      } else {
        const msg =
          compressErr instanceof Error
            ? compressErr.message
            : "An unexpected error occurred during compression.";
        setRunError(`Compression failed: ${msg}`);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleDownload() {
    if (!result || !source) return;
    const blob = new Blob([result.compressedBytes as unknown as BlobPart], { type: "application/pdf" });
    const filename = buildOutputName(source.file.name, "compressed", "pdf");
    downloadBlob(blob, filename, "application/pdf");
  }

  return (
    <div
      className={styles.compressorContainer}
      data-webmcp-tool="codestation_pdf_compressor"
      data-webmcp-category="PDF"
      data-webmcp-slug="pdf-compressor"
    >
      <ToolLayout kind="data">
        <Panel title={definition.name} headingId="pdf-compressor-heading" padded>
          {!source ? (
            <DropZone
              id="pdf-file-dropzone"
              label="Choose a PDF file to compress"
              accept=".pdf,application/pdf"
              disabled={loading}
              onFiles={handleFiles}
            >
              <div className={styles.dropTitle}>Choose a PDF file to compress</div>
              <div className={styles.dropSub}>
                100% browser-based size reduction with zero server uploads
              </div>
            </DropZone>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              {/* Document Overview Card */}
              <div className={styles.docInfoCard}>
                <div className={styles.thumbnailContainer}>
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt="First page preview"
                      className={styles.thumbnail}
                    />
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--secondary)" }}>
                      PDF
                    </span>
                  )}
                </div>
                <div className={styles.docMeta}>
                  <div className={styles.docName} title={source.file.name}>
                    {source.file.name}
                  </div>
                  <div className={styles.docSpecs}>
                    <span>{source.pageCount} page{source.pageCount === 1 ? "" : "s"}</span>
                    <span>•</span>
                    <span>{formatBytes(source.file.size)}</span>
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={handleClear}
                  >
                    Change File
                  </Button>
                </div>
              </div>

              {/* Quality Preset Selector */}
              <div>
                <label
                  id="preset-selector-label"
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--secondary)",
                  }}
                >
                  Select Compression Preset
                </label>
                <div
                  className={styles.presetGrid}
                  role="radiogroup"
                  aria-labelledby="preset-selector-label"
                >
                  {(
                    Object.keys(COMPRESSION_PRESETS) as CompressionPresetKey[]
                  ).map((key) => {
                    const item = COMPRESSION_PRESETS[key];
                    const isSelected = preset === key;
                    return (
                      <div
                        key={key}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        className={`${styles.presetCard} ${
                          isSelected ? styles.presetCardSelected : ""
                        }`}
                        onClick={() => !busy && setPreset(key)}
                        onKeyDown={(e) => {
                          if (!busy && (e.key === " " || e.key === "Enter")) {
                            e.preventDefault();
                            setPreset(key);
                          }
                        }}
                      >
                        <div className={styles.presetHeader}>
                          <span className={styles.presetName}>{item.name}</span>
                          <span className={styles.presetDpi}>{item.dpi} DPI</span>
                        </div>
                        <span className={styles.presetDesc}>{item.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Indicator */}
              {busy && progress && (
                <div style={{ marginTop: "var(--space-2)" }}>
                  <ProgressBar
                    label={`Compressing PDF (${progress.stage} page ${progress.current} of ${progress.total})`}
                    value={progress.current}
                    max={progress.total}
                    detail={
                      <span>
                        Stage: {progress.stage} • Page {progress.current} of {progress.total}
                      </span>
                    }
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.actionsBar}>
                <div className={styles.buttonGroup}>
                  {!busy ? (
                    <Button
                      variant="primary"
                      onClick={handleCompress}
                      disabled={busy}
                    >
                      Compress PDF
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={handleCancel}
                    >
                      Cancel Compression
                    </Button>
                  )}
                  {result && !busy && (
                    <Button variant="secondary" onClick={handleClear}>
                      Compress Another PDF
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Feedback and Notifications */}
          {(fileError || error) && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <Callout kind="error">{fileError || error}</Callout>
            </div>
          )}

          {statusMessage && !error && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <StatusLine>{statusMessage}</StatusLine>
            </div>
          )}

          {/* Compression Results Card */}
          {result && (
            <div style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-4)" }}>
              <h3
                style={{
                  fontSize: "var(--text-md)",
                  fontWeight: 700,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                Compression Results
              </h3>
              <div className={styles.comparisonGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Original Size</span>
                  <span className={styles.metricValue}>{formatBytes(result.originalSize)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Compressed Size</span>
                  <span className={styles.metricValue}>{formatBytes(result.compressedSize)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Bytes Saved</span>
                  <span className={styles.metricValue}>
                    {result.savingsBytes > 0
                      ? formatBytes(result.savingsBytes)
                      : "0 B"}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Reduction</span>
                  <span
                    className={`${styles.metricValue} ${
                      result.savingsPercentage > 0
                        ? styles.savingsBadgeSuccess
                        : result.savingsPercentage === 0
                        ? styles.savingsBadgeNeutral
                        : styles.savingsBadgeNegative
                    }`}
                  >
                    {result.savingsPercentage > 0
                      ? `-${result.savingsPercentage}%`
                      : `${result.savingsPercentage}%`}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <Button variant="primary" onClick={handleDownload}>
                  Download Compressed PDF ({formatBytes(result.compressedSize)})
                </Button>
              </div>
            </div>
          )}

          <div style={{ marginTop: "var(--space-6)" }}>
            <PrivacyNote>
              100% in-browser PDF size reduction. Pages are rendered into memory canvases and
              re-encoded with zero server uploads, data collection, or telemetry.
            </PrivacyNote>
          </div>
        </Panel>
      </ToolLayout>
    </div>
  );
}
