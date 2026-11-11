"use client";

import React from "react";
import { FileDown, Download } from "lucide-react";
import type { ToolResult, ToolOutput } from "@/lib/engine/types";
import styles from "./UniversalToolShell.module.css";

export interface ToolOutputPreviewProps {
  result: ToolResult | null;
  outputConfig?: ToolOutput;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function ToolOutputPreview({ result, outputConfig }: ToolOutputPreviewProps) {
  if (!result || result.data === undefined || result.data === null) {
    return (
      <div className={styles.outputEmpty} data-testid="output-empty">
        Run the tool to see output here.
      </div>
    );
  }

  const mimeType = result.mimeType || (outputConfig && "mimeType" in outputConfig ? outputConfig.mimeType : "");
  const isImage =
    outputConfig?.type === "image" ||
    Boolean(mimeType && mimeType.startsWith("image/"));

  const isBlobOrBinary =
    !isImage &&
    (result.data instanceof Blob ||
      outputConfig?.type === "blob" ||
      outputConfig?.type === "binary" ||
      outputConfig?.type === "file");

  const isTable =
    !isImage &&
    !isBlobOrBinary &&
    (outputConfig?.type === "table" ||
      (Array.isArray(result.data) && result.data.length > 0 && typeof result.data[0] === "object"));

  // 1. Image Preview Mode
  if (isImage) {
    const src =
      (typeof result.metadata?.blobUrl === "string" ? result.metadata.blobUrl : null) ||
      (result.data instanceof Blob ? URL.createObjectURL(result.data) : String(result.data));

    return (
      <div className={styles.outputPreviewBox} data-testid="tool-output-preview">
        <div className={styles.imageWrapper}>
          <img
            data-testid="preview-image"
            src={src}
            alt="Tool output preview"
            className={styles.previewImage}
          />
        </div>
      </div>
    );
  }

  // 2. Binary / Blob Download Card Mode
  if (isBlobOrBinary) {
    const blob = result.data instanceof Blob ? result.data : null;
    const size = blob ? formatBytes(blob.size) : "Binary Output";
    const filename =
      result.suggestedFilename ||
      (outputConfig && "suggestedFilename" in outputConfig && typeof outputConfig.suggestedFilename === "string"
        ? outputConfig.suggestedFilename
        : "download.bin");
    const displayMime = mimeType || "application/octet-stream";

    const handleBlobDownload = () => {
      const url =
        (typeof result.metadata?.blobUrl === "string" ? result.metadata.blobUrl : null) ||
        (blob ? URL.createObjectURL(blob) : null);
      if (!url) return;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
    };

    return (
      <div className={styles.outputPreviewBox} data-testid="tool-output-preview">
        <div className={styles.blobCard} data-testid="blob-download-card">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <FileDown size={32} style={{ color: "var(--accent)" }} aria-hidden="true" />
            <div className={styles.blobCardInfo}>
              <span className={styles.blobCardFilename}>{filename}</span>
              <div className={styles.blobCardMeta}>
                <span>{size}</span>
                <span className={styles.blobCardMime}>{displayMime}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleBlobDownload}
            aria-label={`Download ${filename}`}
          >
            <Download size={14} aria-hidden="true" />
            Download
          </button>
        </div>
      </div>
    );
  }

  // 3. Structured Table Mode
  if (isTable && Array.isArray(result.data)) {
    const headers = Object.keys(result.data[0] || {});
    return (
      <div className={styles.outputPreviewBox} data-testid="tool-output-preview">
        <div className={styles.tableWrapper}>
          <table className={styles.previewTable} data-testid="preview-table">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((row: Record<string, unknown>, rowIdx: number) => (
                <tr key={rowIdx}>
                  {headers.map((h) => (
                    <td key={h}>{String(row[h] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 4. Formatted Text / Code Mode (Default)
  const textContent =
    typeof result.data === "object" ? JSON.stringify(result.data, null, 2) : String(result.data);

  return (
    <div className={styles.outputPreviewBox} data-testid="tool-output-preview">
      <pre data-testid="preview-text" className={styles.outputPre}>
        <code>{textContent}</code>
      </pre>
    </div>
  );
}
