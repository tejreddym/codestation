import Link from "next/link";
import styles from "./InformationalPage.module.css";

export function InformationalPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return <main className={`shell ${styles.page}`}><article className={styles.content}>
    <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> / </span><span aria-current="page">{title}</span></nav>
    <header className={styles.heading}><div><span className="eyebrow bracket-label">CODE STATION / INFORMATION</span><h1>{title}</h1>{intro && <p className="lead">{intro}</p>}</div><span className={styles.mark} aria-hidden="true">[<i>↗</i>]</span></header>
    <div className={styles.body}>{children}</div>
  </article></main>;
}

export { styles as informationalStyles };
