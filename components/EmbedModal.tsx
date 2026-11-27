"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Code2, X } from "lucide-react";
import { trapModalTabFocus } from "@/lib/a11y/focusTrap";
import {
  EMBED_HEIGHT_PRESETS,
  buildEmbedIframeSnippet,
  buildEmbedUrl,
  type EmbedTheme,
} from "@/lib/embed/snippet";
import styles from "./Embed.module.css";

export interface EmbedModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  toolName: string;
  includeHash?: string;
}

export function EmbedModal({
  open,
  onClose,
  slug,
  toolName,
  includeHash,
}: EmbedModalProps) {
  const [theme, setTheme] = useState<EmbedTheme>("auto");
  const [height, setHeight] = useState<number>(520);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const headingId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtnRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      trapModalTabFocus(event, dialogRef.current);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const opener = previousFocusRef.current;
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const embedUrl = buildEmbedUrl({ slug, theme, hash: includeHash });
  const snippet = buildEmbedIframeSnippet({
    slug,
    title: toolName,
    theme,
    height,
    hash: includeHash,
  });

  const handleCopy = async () => {
    setCopyError("");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
        return;
      }
      setCopyError("Clipboard API unavailable. Select and copy the code manually.");
    } catch {
      setCopyError("Could not copy automatically. Select and copy the code manually.");
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="embed-modal"
      >
        <div className={styles.dialogHeader}>
          <h2 id={headingId} className={styles.dialogTitle}>
            <Code2 size={15} strokeWidth={2} aria-hidden="true" />
            Embed {toolName}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeButton}
            aria-label="Close embed dialog"
            onClick={onClose}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.controlsRow}>
            <label className={styles.fieldLabel}>
              Theme
              <select
                className={styles.select}
                aria-label="Embed theme"
                data-testid="embed-theme-select"
                value={theme}
                onChange={(event) => setTheme(event.target.value as EmbedTheme)}
              >
                <option value="auto">Auto (viewer preference)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <label className={styles.fieldLabel}>
              Height
              <select
                className={styles.select}
                aria-label="Embed height"
                data-testid="embed-height-select"
                value={String(height)}
                onChange={(event) => setHeight(Number(event.target.value))}
              >
                {EMBED_HEIGHT_PRESETS.map((preset) => (
                  <option key={preset} value={String(preset)}>
                    {preset}px
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.fieldLabel}>
            HTML iframe snippet
            <textarea
              className={styles.codeBox}
              aria-label="Embed iframe code"
              data-testid="embed-snippet-textarea"
              readOnly
              value={snippet}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>

          <p className={styles.previewNote} data-testid="embed-preview-note">
            <strong>Live preview note:</strong> Embeds load chromeless at{" "}
            <code>{embedUrl}</code> with no site navigation or ads, run 100% locally in the
            viewer&apos;s browser, and support <code>?theme=light|dark</code> and{" "}
            <code>#state=</code> URL hash permalinks.
          </p>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.copyBtn}
              data-testid="btn-copy-embed-code"
              onClick={() => void handleCopy()}
            >
              {copied ? "Embed Code Copied!" : "Copy Embed Code"}
            </button>
            <span className={styles.statusText} role="status" aria-live="polite">
              {copyError || (copied ? "Iframe snippet copied to clipboard." : "")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmbedToolButton({ slug, toolName }: { slug: string; toolName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.embedTrigger}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Code2 size={15} strokeWidth={2} aria-hidden="true" />
        Embed
      </button>
      <EmbedModal
        open={open}
        onClose={() => setOpen(false)}
        slug={slug}
        toolName={toolName}
      />
    </>
  );
}
