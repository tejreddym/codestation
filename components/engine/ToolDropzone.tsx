"use client";

import React, { useState, useRef, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import type { FileReadMode } from "@/lib/engine/types";
import styles from "./UniversalToolShell.module.css";

export interface ToolDropzoneProps {
  accept?: string;
  maxBytes?: number;
  maxFiles?: number;
  readAs?: FileReadMode;
  onFileLoaded: (content: string, file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  selectedFile?: File | null;
  onClearFile?: () => void;
}

export function ToolDropzone({
  accept,
  maxBytes = 5 * 1024 * 1024,
  maxFiles = 1,
  readAs = "text",
  onFileLoaded,
  onError,
  disabled = false,
  selectedFile = null,
  onClearFile,
}: ToolDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndReadFile = useCallback(
    async (file: File) => {
      if (file.size > maxBytes) {
        onError(`File exceeds size limit of ${maxBytes} bytes (received ${file.size} bytes).`);
        return;
      }

      if (accept && accept.trim() !== "" && accept !== "*/*") {
        const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
        const fileType = (file.type || "").toLowerCase();
        const fileName = (file.name || "").toLowerCase();

        const matches = acceptedTypes.some((pattern) => {
          if (pattern.startsWith(".")) {
            return fileName.endsWith(pattern);
          }
          if (pattern.endsWith("/*")) {
            const prefix = pattern.slice(0, -2);
            return fileType.startsWith(prefix);
          }
          return fileType === pattern;
        });

        if (!matches) {
          onError(`MIME type not accepted. Expected: ${accept}, got: ${file.type || "unknown"}.`);
          return;
        }
      }

      try {
        if (readAs === "dataUrl") {
          const reader = new FileReader();
          reader.onload = () => {
            onFileLoaded(String(reader.result || ""), file);
          };
          reader.onerror = () => {
            onError("Failed to read file as Data URL.");
          };
          reader.readAsDataURL(file);
        } else {
          // Default text mode (or stringified buffer)
          const text = await file.text();
          onFileLoaded(text, file);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : "Failed to read file.");
      }
    },
    [accept, maxBytes, readAs, onError, onFileLoaded]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (maxFiles === 1 && files.length > 1) {
      onError("Multiple files rejected. Only a single file is accepted.");
      return;
    }

    validateAndReadFile(files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (maxFiles === 1 && files.length > 1) {
      onError("Multiple files rejected. Only a single file is accepted.");
      return;
    }

    validateAndReadFile(files[0]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      role="region"
      aria-label="File Upload Dropzone"
      data-testid="tool-dropzone"
      tabIndex={disabled ? -1 : 0}
      className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ""} ${
        disabled ? styles.dropzoneDisabled : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onClick={() => {
        if (!disabled && fileInputRef.current) {
          fileInputRef.current.click();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        data-testid="dropzone-file-input"
        className="sr-only"
        accept={accept}
        multiple={maxFiles > 1}
        disabled={disabled}
        onChange={handleFileChange}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
        <Upload size={24} style={{ color: "var(--accent)" }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: "13px", color: "var(--secondary)" }}>
          Drag &amp; drop file here or{" "}
          <span style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 700 }}>
            browse
          </span>
          {accept && (
            <span style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>
              Accepted: {accept}
            </span>
          )}
        </p>
      </div>

      {selectedFile && (
        <div className={styles.fileChip} onClick={(e) => e.stopPropagation()}>
          <FileText size={14} aria-hidden="true" />
          <span>{selectedFile.name}</span>
          <span style={{ color: "var(--muted)" }}>
            ({(selectedFile.size / 1024).toFixed(1)} KB)
          </span>
          {onClearFile && (
            <button
              type="button"
              className={styles.fileChipRemove}
              onClick={onClearFile}
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
