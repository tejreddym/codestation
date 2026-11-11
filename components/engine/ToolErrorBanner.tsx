"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import type { ValidationResult } from "@/lib/engine/types";
import styles from "./UniversalToolShell.module.css";

export interface ToolErrorBannerProps {
  error: Error | string | null;
  validation?: ValidationResult | null;
  onDismiss?: () => void;
}

export function ToolErrorBanner({ error, validation, onDismiss }: ToolErrorBannerProps) {
  if (!error && (!validation || validation.valid)) {
    return null;
  }

  const errorMessage =
    typeof error === "string"
      ? error
      : error?.message ||
        validation?.errors?.[0] ||
        validation?.diagnostics?.[0]?.message ||
        "An unexpected error occurred.";

  const diagnostics = validation?.diagnostics || [];

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="tool-error-banner"
      className={styles.errorBanner}
      tabIndex={-1}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flex: 1 }}>
        <AlertTriangle size={18} style={{ color: "var(--red)", flexShrink: 0, marginTop: "2px" }} aria-hidden="true" />
        <div className={styles.errorDetails}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "14px" }} data-testid="error-message">
            {errorMessage}
          </p>
          {diagnostics.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: "18px", fontSize: "12px" }} data-testid="diagnostics-list">
              {diagnostics.map((diag, idx) => (
                <li key={idx} data-testid="diagnostic-item">
                  {diag.line !== undefined && diag.column !== undefined ? (
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                      Line {diag.line}, Column {diag.column}:{" "}
                    </span>
                  ) : diag.field ? (
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                      Field &apos;{diag.field}&apos;:{" "}
                    </span>
                  ) : null}
                  <span>{diag.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          data-testid="btn-dismiss-error"
          aria-label="Dismiss error"
          className={styles.btn}
          style={{
            padding: "2px 6px",
            fontSize: "12px",
            border: "none",
            background: "transparent",
            color: "var(--red)",
            boxShadow: "none",
            minHeight: "auto",
          }}
          onClick={onDismiss}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
