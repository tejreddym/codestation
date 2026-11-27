import Link from "next/link";
import { JsonLd } from "./StructuredData";
import styles from "./ComparePage.module.css";

export interface ComparisonRow {
  criterion: string;
  codeStation: string;
  competitor: string;
}

export interface ComparisonFaq {
  question: string;
  answer: string;
}

export interface RelatedStationLink {
  label: string;
  href: string;
  note: string;
}

export interface VersusPageProps {
  competitorName: string;
  title: string;
  intro: string;
  summary: string;
  rows: readonly ComparisonRow[];
  whereCompetitorShines: readonly string[];
  whereCodeStationStandsOut: readonly string[];
  relatedLinks: readonly RelatedStationLink[];
  faqs: readonly ComparisonFaq[];
}

export function CompareVersusPage({
  competitorName,
  title,
  intro,
  summary,
  rows,
  whereCompetitorShines,
  whereCodeStationStandsOut,
  relatedLinks,
  faqs,
}: VersusPageProps) {
  const faqSchema = {
    "@context": "https://schema.org" as const,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className={`shell ${styles.page}`}>
      <JsonLd schema={faqSchema} />
      <article className={styles.content}>
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/compare">Compare</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{competitorName}</span>
        </nav>

        <header className={styles.heading}>
          <div>
            <span className="eyebrow bracket-label">CODE STATION / COMPARISON</span>
            <h1>{title}</h1>
            <p className="lead">{intro}</p>
          </div>
        </header>

        <div className={styles.body}>
          <p>{summary}</p>

          <h2>Side-by-side comparison</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Code Station</th>
                  <th scope="col">{competitorName}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.criterion}>
                    <td><strong>{row.criterion}</strong></td>
                    <td>{row.codeStation}</td>
                    <td>{row.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Honest trade-offs</h2>
          <div className={styles.twoCol}>
            <section className={styles.panelBox}>
              <h3>Where {competitorName} shines</h3>
              <ul>
                {whereCompetitorShines.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className={styles.panelBox}>
              <h3>Where Code Station stands out</h3>
              <ul>
                {whereCodeStationStandsOut.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>

          <h2>Explore matching Code Station tools</h2>
          <ul>
            {relatedLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}><strong>{item.label}</strong></Link> — {item.note}
              </li>
            ))}
          </ul>

          <h2>Frequently asked questions</h2>
          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <section key={faq.question} className={styles.faqItem}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </section>
            ))}
          </div>

          <div className={styles.ctaRow}>
            <Link href="/tools" className={styles.ctaPrimary}>Browse all 383 tools →</Link>
            <Link href="/pro" className={styles.ctaSecondary}>Explore Code Station Pro (MCP)</Link>
            <Link href="/compare" className={styles.ctaSecondary}>All comparisons</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
