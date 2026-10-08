import Link from "next/link";
import styles from "@/app/Home.module.css";

export default function SiteFooter() {
  return <footer className="footer"><div className={`shell footer-closing ${styles.closing}`}><span>Back to what you’re building.</span><span aria-hidden="true">[ CS ↗ ]</span></div><div className="shell footer-grid">
    <div><strong className={`footer-wordmark ${styles.footerWordmark}`}>Code Station</strong><p className="muted">Browser-first developer utilities with documented limits and local processing where supported.</p></div>
    <nav aria-label="Footer"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/licenses">Licenses</Link><Link href="/site-directory">Site directory</Link></nav>
  </div></footer>;
}
