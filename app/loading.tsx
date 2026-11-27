import styles from "@/components/FallbackPages.module.css";

export default function Loading() {
  return (
    <main className={`shell ${styles.boundaryPage}`}>
      <section
        className={styles.card}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading Code Station workspace"
      >
        <span className={styles.codeBadge}>Loading Workspace</span>
        <h1 className={styles.title}>Preparing local browser tools…</h1>
        <p className={styles.description}>
          Loading interface controls and in-browser engines.
        </p>
        <div className={styles.loadingTrack} aria-hidden="true">
          <div className={styles.loadingBar} />
        </div>
      </section>
    </main>
  );
}
