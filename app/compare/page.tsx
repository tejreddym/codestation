import Link from "next/link";
import { metadataForRoute } from "@/config/site";
import { JsonLd } from "@/components/StructuredData";
import styles from "@/components/ComparePage.module.css";

export const metadata = metadataForRoute(
  "/compare",
  "Compare Code Station — vs IT-Tools, CyberChef & DevToys",
  "Objective side-by-side comparisons of Code Station against IT-Tools, CyberChef, and DevToys across local privacy, tool scope, offline PWA, embeds, and MCP AI integration."
);

const hubFaqs = [
  {
    question: "How is Code Station different from other developer toolboxes?",
    answer:
      "Code Station combines 383 browser-local tools across 30 stations with browser-native WebMCP (document.modelContext), the codestation-mcp local stdio server, shareable #state= URL hash permalinks, embeddable widgets, and offline PWA support.",
  },
  {
    question: "Are all 383 Code Station tools free in the browser?",
    answer:
      "Yes. Every web tool runs free and client-side with zero uploads or accounts required. Code Station Pro is strictly optional for unlocking extra tools in the local codestation-mcp server for AI assistants.",
  },
  {
    question: "When should I pick another tool instead of Code Station?",
    answer:
      "Pick CyberChef when you need deep multi-step binary/forensics recipe chains, IT-Tools when you specifically require self-hosted Docker containers on an internal intranet, or DevToys when you prefer a native offline desktop app integrated with your OS.",
  },
];

export default function CompareHubPage() {
  const faqSchema = {
    "@context": "https://schema.org" as const,
    "@type": "FAQPage",
    mainEntity: hubFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <main className={`shell ${styles.page}`}>
      <JsonLd schema={faqSchema} />
      <article className={styles.content}>
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Compare</span>
        </nav>

        <header className={styles.heading}>
          <div>
            <span className="eyebrow bracket-label">CODE STATION / COMPARISONS</span>
            <h1>How Code Station compares</h1>
            <p className="lead">
              Honest, factual comparisons with popular developer toolboxes—where each excels, where Code Station differs, and how to pick the right fit.
            </p>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.cardsGrid}>
            <section className={styles.card}>
              <h3>Code Station vs IT-Tools</h3>
              <p>
                Compare IT-Tools&apos; lightweight self-hosted Docker toolbox with Code Station&apos;s 383 utilities, WebMCP, MCP CLI, permalinks, and embed widgets.
              </p>
              <Link href="/compare/it-tools" className={styles.cardLink}>Read IT-Tools comparison →</Link>
            </section>

            <section className={styles.card}>
              <h3>Code Station vs CyberChef</h3>
              <p>
                Compare CyberChef&apos;s deep binary and forensics recipe pipeline with Code Station&apos;s 30 modern full-stack developer stations and AI MCP bridge.
              </p>
              <Link href="/compare/cyberchef" className={styles.cardLink}>Read CyberChef comparison →</Link>
            </section>

            <section className={styles.card}>
              <h3>Code Station vs DevToys</h3>
              <p>
                Compare DevToys&apos; native desktop UX with Code Station&apos;s zero-install browser runtime, mobile/Chromebook reach, offline PWA, and permalinks.
              </p>
              <Link href="/compare/devtoys" className={styles.cardLink}>Read DevToys comparison →</Link>
            </section>
          </div>

          <h2>Quick feature overview</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  <th scope="col">Code Station</th>
                  <th scope="col">IT-Tools</th>
                  <th scope="col">CyberChef</th>
                  <th scope="col">DevToys</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Primary runtime</strong></td>
                  <td>Web + Offline PWA + local MCP</td>
                  <td>Web + self-hosted Docker</td>
                  <td>Web (single-page pipeline)</td>
                  <td>Native desktop (Win / macOS / Linux)</td>
                </tr>
                <tr>
                  <td><strong>Tool coverage</strong></td>
                  <td>383 tools across 30 stations</td>
                  <td>~75–85 general dev tools</td>
                  <td>300+ crypto/binary/encoding operations</td>
                  <td>~35–45 core desktop utilities + plugins</td>
                </tr>
                <tr>
                  <td><strong>AI / MCP integration</strong></td>
                  <td>Browser WebMCP + <code>codestation-mcp</code></td>
                  <td>None built in</td>
                  <td>None built in</td>
                  <td>None built in</td>
                </tr>
                <tr>
                  <td><strong>Shareable state permalinks</strong></td>
                  <td>Client-only <code>#state=</code> URL hash</td>
                  <td>URL query params on select tools</td>
                  <td>URL hash recipe + input sharing</td>
                  <td>N/A (local desktop app)</td>
                </tr>
                <tr>
                  <td><strong>Embeddable widgets</strong></td>
                  <td><code>/embed/[slug]</code> iframe mode</td>
                  <td>No dedicated chromeless embed mode</td>
                  <td>Community self-hosted iframe</td>
                  <td>Desktop only</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Frequently asked questions</h2>
          <div className={styles.faqList}>
            {hubFaqs.map((faq) => (
              <section key={faq.question} className={styles.faqItem}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </section>
            ))}
          </div>

          <div className={styles.ctaRow}>
            <Link href="/tools" className={styles.ctaPrimary}>Try any of 383 tools free →</Link>
            <Link href="/pro" className={styles.ctaSecondary}>Explore Code Station Pro (MCP)</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
