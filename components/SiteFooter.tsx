import Link from "next/link";
import styles from "@/app/Home.module.css";

const PH_HREF = "https://www.producthunt.com/products/code-station?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-code-station";
const PH_ALT = "Code Station - A private toolbox for everyday developer workflows | Product Hunt";
const PH_LIGHT_SRC = "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1275124&theme=light&t=1791566327433";
const PH_DARK_SRC = "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1275124&theme=dark&t=1791566313727";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className={`shell footer-closing ${styles.closing}`}>
        <span>Back to what you’re building.</span>
        <span aria-hidden="true">[ CS ↗ ]</span>
      </div>
      <div className="shell footer-grid">
        <div>
          <strong className={`footer-wordmark ${styles.footerWordmark}`}>Code Station</strong>
          <p className="muted">
            Browser-first developer utilities with documented limits and local processing where supported.
          </p>
          <div className="footer-producthunt">
            <a
              href={PH_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="ph-badge-link ph-badge-light-wrap"
              aria-label={PH_ALT}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PH_LIGHT_SRC}
                alt={PH_ALT}
                width={250}
                height={54}
                className="ph-badge-img"
              />
            </a>
            <a
              href={PH_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="ph-badge-link ph-badge-dark-wrap"
              aria-label={PH_ALT}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PH_DARK_SRC}
                alt={PH_ALT}
                width={250}
                height={54}
                className="ph-badge-img"
              />
            </a>
          </div>
        </div>
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/pro">Pro</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/licenses">Licenses</Link>
          <Link href="/site-directory">Site directory</Link>
        </nav>
      </div>
    </footer>
  );
}
