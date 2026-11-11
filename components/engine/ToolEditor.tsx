"use client";

import React, { useState } from "react";
import { Sparkles, Clipboard, Trash2 } from "lucide-react";
import styles from "./UniversalToolShell.module.css";

export interface ToolEditorProps {
  value: string;
  onChange: (value: string) => void;
  sampleValue?: string;
  disabled?: boolean;
  onRun?: () => void;
  placeholder?: string;
  label?: string;
}

export function ToolEditor({
  value,
  onChange,
  sampleValue,
  disabled = false,
  onRun,
  placeholder = "Enter input...",
  label = "Input Data",
}: ToolEditorProps) {
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  const handlePaste = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        onChange(text);
        setClipboardNotice(null);
      } else {
        setClipboardNotice("Clipboard API unavailable. Please paste manually using Cmd+V / Ctrl+V.");
      }
    } catch {
      setClipboardNotice("Clipboard access denied. Please paste manually using Cmd+V / Ctrl+V.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRun?.();
    }
  };

  const lineCount = value ? value.split("\n").length : 0;
  const charCount = value ? value.length : 0;

  return (
    <div className={styles.editorContainer} data-testid="tool-editor">
      <div className={styles.editorToolbar}>
        <span className={styles.editorLabel}>{label}</span>

        <div className={styles.editorStats}>
          {lineCount} {lineCount === 1 ? "line" : "lines"} • {charCount} chars
        </div>

        <div className={styles.editorActions}>
          {sampleValue !== undefined && (
            <button
              type="button"
              data-testid="btn-load-sample"
              className={styles.btn}
              disabled={disabled}
              onClick={() => onChange(sampleValue)}
            >
              <Sparkles size={13} style={{ color: "var(--accent)" }} aria-hidden="true" />
              Load Sample
            </button>
          )}

          <button
            type="button"
            data-testid="btn-paste-clipboard"
            className={styles.btn}
            disabled={disabled}
            onClick={handlePaste}
          >
            <Clipboard size={13} aria-hidden="true" />
            Paste from Clipboard
          </button>

          <button
            type="button"
            data-testid="btn-clear"
            className={styles.btn}
            disabled={disabled || !value}
            onClick={() => onChange("")}
          >
            <Trash2 size={13} aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      {clipboardNotice && (
        <p
          style={{ margin: 0, fontSize: "12px", color: "var(--yellow)" }}
          data-testid="clipboard-notice"
          role="status"
        >
          {clipboardNotice}
        </p>
      )}

      <textarea
        role="textbox"
        aria-label="Input Editor"
        data-testid="tool-editor-textarea"
        className={styles.editorTextarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}
