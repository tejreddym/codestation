"use client";

import React from "react";
import { StopCircle } from "lucide-react";
import type { ToolProgress } from "@/lib/engine/types";
import styles from "./UniversalToolShell.module.css";

export interface ToolProgressBarProps {
  isProcessing: boolean;
  progress: ToolProgress;
  onCancel?: () => void;
  canCancel?: boolean;
  elapsedMs?: number;
}

export function ToolProgressBar({
  isProcessing,
  progress,
  onCancel,
  canCancel = true,
  elapsedMs = 0,
}: ToolProgressBarProps) {
  if (!isProcessing) {
    return null;
  }

  const percent = progress.percent ?? 0;
  const label = progress.label || "Processing...";

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid="tool-progress-bar"
      className={styles.progressContainer}
    >
      <div className={styles.progressHeader}>
        <span data-testid="progress-label">{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span data-testid="progress-timer">{elapsedMs}ms</span>
          <span data-testid="progress-percent">{percent}%</span>
          {canCancel && onCancel && (
            <button
              type="button"
              data-testid="btn-progress-cancel"
              className={styles.btn}
              style={{
                color: "var(--red)",
                borderColor: "var(--red)",
                padding: "3px 8px",
                fontSize: "11px",
                minHeight: "26px",
              }}
              onClick={onCancel}
              aria-label="Cancel active execution"
            >
              <StopCircle size={12} aria-hidden="true" />
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className={styles.progressTrack}>
        <div
          data-testid="progress-fill"
          className={styles.progressFill}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
