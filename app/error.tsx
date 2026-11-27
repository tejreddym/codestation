"use client";

import Link from "next/link";
import styles from "@/components/FallbackPages.module.css";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={`shell ${styles.boundaryPage}`}>
      <section className={styles.card} role="alert" aria-labelledby="error-title">
        <span className={styles.codeBadge}>Workspace Error Boundary</span>
        <h1 id="error-title" className={styles.title}>
          Something interrupted this view.
        </h1>
        <p className={styles.description}>
          Code Station processes data strictly inside your browser, so nothing was
          uploaded. You can reset this route cleanly or navigate back to the tool
          directory.
        </p>

        {error?.digest && (
          <p className={styles.digestNote}>
            Reference digest: <code>{error.digest}</code>
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
          <Link href="/tools" className={styles.secondaryLink}>
            Browse all tools
          </Link>
          <Link href="/contact" className={styles.secondaryLink}>
            Report issue
          </Link>
        </div>
      </section>
    </main>
  );
}
