import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { stations } from "@/config/stations";
import { tools } from "@/config/tools";
import PersonalTools from "@/components/PersonalTools";
import NativeAd from "@/components/NativeAd";
import BannerAd from "@/components/BannerAd";
import StationMark from "@/components/StationMark";
import { DataPreview, ImagePreview, ColorPreview } from "@/components/HomeGraphics";
import HomeSearch, { type ToolCardMetadata } from "@/components/HomeSearch";
import { JsonLd } from "@/components/StructuredData";
import { siteConfig } from "@/config/site";
import styles from "./Home.module.css";

const lightweightTools: ToolCardMetadata[] = tools.map(tool => ({
  id: tool.id,
  slug: tool.slug,
  name: tool.name,
  category: tool.category,
  description: tool.description,
  keywords: tool.keywords,
  featured: tool.featured,
}));

const showcases = [
  { slug: "json-formatter", title: "A little order. A lot of clarity.", description: "Give structured data room to make sense.", label: "01 / STRUCTURED DATA", Graphic: DataPreview },
  { slug: "png-to-webp", title: "Same image. New format.", description: "Move from PNG to WebP, right in your browser.", label: "02 / IMAGE CONVERSION", Graphic: ImagePreview },
  { slug: "color-converter", title: "Find your expression.", description: "Translate colors between HEX, RGB, and HSL.", label: "03 / COLOR & CSS", Graphic: ColorPreview },
].map(item => ({ ...item, tool: tools.find(tool => tool.slug === item.slug) })).filter(item => item.tool);

export default function HomePage() {
  return (
    <main className={styles.page}>
      <JsonLd schema={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteConfig.name,
        description: siteConfig.description,
        ...(siteConfig.origin ? { url: siteConfig.origin } : {})
      } as any} />
      <div className={`shell ${styles.container}`}>
        <HomeSearch tools={lightweightTools}>
          <PersonalTools />
        </HomeSearch>

        <section className={styles.showcase} aria-labelledby="showcase-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>SMALL TOOLS, USEFUL POSSIBILITIES</span>
              <h2 id="showcase-title">Make room for the work.</h2>
            </div>
            <span className={styles.sectionNote}>
              A few things you can do here <ArrowDown size={16} aria-hidden="true" />
            </span>
          </div>
          <div className={styles.showcaseGrid}>
            {showcases.map(({ title, description, label, Graphic, tool }, index) => (
              <article className={`${styles.showcasePanel} ${index === 0 ? styles.dataPanel : ""}`} key={tool!.id}>
                <span className={styles.previewLabel}>{label}</span>
                <div className={styles.preview}><Graphic /></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <Link href={`/tools/${tool!.slug}`} prefetch={false}>
                  {tool!.name}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <NativeAd className={styles.nativeAd} />

        <section className={styles.directory} id="categories" aria-labelledby="categories-title">
          <div className={styles.directoryIntro}>
            <span className={styles.kicker}>THE STATION INDEX</span>
            <h2 id="categories-title">Choose a station</h2>
            <p>Different tasks.<br />A place for each.</p>
            <span className={styles.indexCount}>{String(stations.length).padStart(2, "0")} stations <ArrowDown size={17} aria-hidden="true" /></span>
          </div>
          <div>
            <div className={styles.stationList}>
              {stations.map(station => (
                <Link className={styles.station} href={station.route} key={station.id}>
                  <StationMark large label={station.name} />
                  <div>
                    <h3>{station.name}</h3>
                    <p>{station.description}</p>
                    <span className={styles.count}>{station.toolCount} available tools</span>
                  </div>
                  <ArrowUpRight className={styles.stationArrow} size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <p className={styles.pending}>
              <strong>Hardware &amp; IoT</strong>
              <span>Pending — not yet available or included in counts.</span>
            </p>
          </div>
        </section>

        <section className={styles.proSection} aria-labelledby="pro-title">
          <div className={styles.proCopy}>
            <span className={styles.kicker}>LEVEL UP YOUR WORKFLOW</span>
            <h2 id="pro-title">Code Station Pro: Local MCP for AI Agents</h2>
            <p>
              All 300+ browser developer tools are 100% free, private, and unlimited. Upgrade to Code Station Pro to supercharge Cursor, Claude Desktop, Windsurf, and AI coding agents with our local Model Context Protocol server.
            </p>
          </div>
          <div className={styles.proActions}>
            <div className={styles.proPrice}>
              Starts at <strong>₹199 / mo</strong> ($2.99 / mo) • Lifetime option available
            </div>
            <div className={styles.proButtons}>
              <Link href="/pro" className={styles.proBtnPrimary}>
                Get Pro for AI <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs" className={styles.proBtnSecondary}>
                Explore Docs &amp; MCP <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div style={{ display: "flex", justifyContent: "center", margin: "48px 0 24px", width: "100%" }}>
          <BannerAd size="leaderboard" />
        </div>

        <section className={styles.principles} aria-labelledby="principles-title">
          <div className={styles.principleMark} aria-hidden="true">[<span>↗</span>]</div>
          <div>
            <span className={styles.kicker}>A CLEAR BOUNDARY</span>
            <h2 id="principles-title">Know what each tool does.</h2>
            <p>Most utilities calculate or transform data in the browser. A small number of tools have documented exceptions, such as the explicit API Request Tester or browser requests caused by remote images in Markdown previews. Read each station’s limitations before relying on output.</p>
            <div className={styles.principleLinks}>
              <Link href="/about">About Code Station <ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/privacy">Privacy and processing <ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/site-directory">Site directory <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
