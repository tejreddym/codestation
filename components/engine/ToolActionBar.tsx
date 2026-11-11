"use client";

import React, { useState } from "react";
import { Copy, Check, Download, Share2 } from "lucide-react";
import type { ToolResult } from "@/lib/engine/types";
import type { BlobUrlRegistry } from "@/lib/engine/blobRegistry";
import styles from "./UniversalToolShell.module.css";

export interface ToolActionBarProps {
  result: ToolResult | null;
  onWorkflowChain?: (output: unknown) => void;
  disabled?: boolean;
  suggestedFilename?: string;
  mimeType?: string;
  blobRegistry?: BlobUrlRegistry;
}

export function ToolActionBar({
  result,
  onWorkflowChain,
  disabled = false,
  suggestedFilename = "output.txt",
  mimeType = "text/plain",
  blobRegistry,
}: ToolActionBarProps) {
  const [copied, setCopied] = useState(false);

  const hasResult = result !== null && result.data !== undefined && result.data !== null;

  const handleCopy = async () => {
    if (!hasResult) return;
    try {
      const textToCopy =
        typeof result.data === "object"
          ? JSON.stringify(result.data, null, 2)
          : String(result.data);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    if (!hasResult) return;

    const rawFilename = result.suggestedFilename || suggestedFilename;
    const sanitizedFilename = rawFilename.replace(/[/\\:*?"<>|]/g, "_");

    let blobUrl: string | null = null;
    let isTransient = false;

    if (typeof result.metadata?.blobUrl === "string") {
      blobUrl = result.metadata.blobUrl;
    } else if (result.data instanceof Blob) {
      blobUrl = URL.createObjectURL(result.data);
      isTransient = true;
    } else {
      const blob = new Blob([String(result.data)], {
        type: result.mimeType || mimeType,
      });
      blobUrl = URL.createObjectURL(blob);
      isTransient = true;
    }

    const anchor = document.createElement("a");
    anchor.download = sanitizedFilename;
    anchor.href = blobUrl;
    anchor.click();

    if (isTransient) {
      if (blobRegistry) {
        blobRegistry.scheduleRevocation(blobUrl, 60_000);
      } else {
        URL.revokeObjectURL(blobUrl);
      }
    }
  };

  return (
    <div className={styles.actionBar} data-testid="tool-action-bar">
      <div className={styles.actionGroup}>
        <button
          type="button"
          data-testid="btn-action-copy"
          className={`${styles.btn} ${copied ? styles.btnCopied : ""}`}
          disabled={disabled || !hasResult}
          onClick={handleCopy}
          aria-label={copied ? "Copied output to clipboard" : "Copy output to clipboard"}
        >
          {copied ? (
            <>
              <Check size={14} aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy size={14} aria-hidden="true" />
              Copy
            </>
          )}
        </button>

        <button
          type="button"
          data-testid="btn-action-download"
          className={styles.btn}
          disabled={disabled || !hasResult}
          onClick={handleDownload}
          aria-label="Download output file"
        >
          <Download size={14} aria-hidden="true" />
          Download
        </button>

        {onWorkflowChain && (
          <button
            type="button"
            data-testid="btn-action-chain"
            className={`${styles.btn} ${styles.btnChain}`}
            disabled={disabled || !hasResult}
            onClick={() => onWorkflowChain(result?.data)}
          >
            <Share2 size={14} aria-hidden="true" />
            Chain to Workflow
          </button>
        )}
      </div>

      {hasResult && result.durationMs !== undefined && (
        <span
          className={styles.durationBadge}
          data-testid="result-duration"
          aria-label={`Execution duration: ${result.durationMs} milliseconds`}
        >
          {result.durationMs}ms
        </span>
      )}
    </div>
  );
}
