"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatDiagnosticsBugReport,
  recordEngineDiagnostic,
  type EngineDiagnosticEvent,
} from "@/lib/engine/diagnostics";
import styles from "@/components/FallbackPages.module.css";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [diagnostic, setDiagnostic] = useState<EngineDiagnosticEvent | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const entry = recordEngineDiagnostic({
      toolSlug:
        typeof window !== "undefined" ? window.location.pathname || "app-route" : "app-route",
      stage: "route",
      error,
    });
    if (entry) {
      setDiagnostic(entry);
    }
  }, [error]);

  const report = formatDiagnosticsBugReport(diagnostic ? [diagnostic] : []);

  async function handleCopyReport() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
        setCopyStatus("Sanitized bug report copied to clipboard.");
        return;
      }
      setCopyStatus("Clipboard unavailable. Expand Inspect bug report to copy manually.");
    } catch {
      setCopyStatus("Could not copy automatically. Expand Inspect bug report to copy manually.");
    }
  }

  return (
    <main className={`shell ${styles.boundaryPage}`}>
      <section className={styles.card} role="alert" aria-labelledby="error-title">
        <span className={styles.codeBadge}>Workspace Error Boundary</span>
        <h1 id="error-title" className={styles.title}>
          Something interrupted this view.
        </h1>
        <p className={styles.description}>
          Code Station processes data strictly inside your browser, so nothing was
          uploaded. You can reset this route cleanly or copy a sanitized diagnostic
          summary.
        </p>

        {error?.digest && (
          <p className={styles.digestNote}>
            Reference digest: <code>{error.digest}</code>
          </p>
        )}

        {diagnostic && (
          <p className={styles.digestNote}>
            Error: <code>{diagnostic.errorName}: {diagnostic.errorMessage}</code>
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => reset()}
            className={styles.retryButton}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => void handleCopyReport()}
            className={styles.secondaryLink}
          >
            Copy bug report
          </button>
          <Link href="/settings#diagnostics" className={styles.secondaryLink}>
            Diagnostics in Settings
          </Link>
          <Link href="/tools" className={styles.secondaryLink}>
            Browse all tools
          </Link>
          <Link href="/contact" className={styles.secondaryLink}>
            Report issue
          </Link>
        </div>

        <p role="status" aria-live="polite" className={styles.description}>
          {copyStatus}
        </p>

        <details>
          <summary>Inspect sanitized bug report</summary>
          <pre>{report}</pre>
        </details>
      </section>
    </main>
  );
}
