"use client";

import { useState } from "react";
import styles from "./CopySnippet.module.css";

interface CopySnippetProps {
  code: string;
  title?: string;
  language?: string;
}

export function CopySnippet({ code, title, language = "json" }: CopySnippetProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Failed to copy
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{title || language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={styles.copyBtn}
          data-copied={copied}
          aria-label={copied ? "Copied to clipboard" : "Copy code"}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.codeBlock} tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
