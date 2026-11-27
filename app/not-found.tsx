import Link from "next/link";
import styles from "@/components/FallbackPages.module.css";

const QUICK_STATIONS = [
  ["JSON & Data", "/stations/json-data"],
  ["PDF Studio", "/stations/pdf"],
  ["Video Studio", "/stations/video"],
  ["Encoding", "/stations/encoding"],
  ["Security", "/stations/security"],
  ["Productivity", "/stations/productivity"],
  ["Code Generation", "/stations/code-generation"],
  ["Converters", "/stations/converters"],
  ["Site Directory", "/site-directory"],
] as const;

export default function NotFound() {
  return (
    <main className={`shell ${styles.boundaryPage}`}>
      <section className={styles.card} aria-labelledby="not-found-title">
        <span className={styles.codeBadge}>HTTP 404 · Route Not Found</span>
        <h1 id="not-found-title" className={styles.title}>
          We could not find that station or tool.
        </h1>
        <p className={styles.description}>
          The page you requested may have moved or its slug may be misspelled.
          Browse all 383 browser-local tools, press <kbd>Cmd/Ctrl + K</kbd> to
          search immediately, or jump straight into a station below.
        </p>

        <div className={styles.actions}>
          <Link href="/tools" className={styles.primaryLink}>
            Browse all tools
          </Link>
          <Link href="/#categories" className={styles.secondaryLink}>
            View all stations
          </Link>
          <Link href="/" className={styles.secondaryLink}>
            Go home
          </Link>
        </div>

        <div className={styles.stationSection}>
          <h2 className={styles.stationHeading}>Popular Stations &amp; Index</h2>
          <ul className={styles.stationGrid}>
            {QUICK_STATIONS.map(([name, href]) => (
              <li key={href}>
                <Link href={href} className={styles.stationLink}>
                  <span>{name}</span>
                  <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
