"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUpRight, Search } from "lucide-react";
import { stations } from "@/config/stations";
import { tools } from "@/config/tools";
import { searchTools } from "@/lib/tool-search";
import PersonalTools from "@/components/PersonalTools";
import NativeAd from "@/components/NativeAd";
import StationMark from "@/components/StationMark";
import { StationAssembly, DataPreview, ImagePreview, ColorPreview } from "@/components/HomeGraphics";
import styles from "./Home.module.css";

const quickAccess = tools.filter(tool => tool.featured).slice(0, 6);
const showcases = [
  { slug: "json-formatter", title: "A little order. A lot of clarity.", description: "Give structured data room to make sense.", label: "01 / STRUCTURED DATA", Graphic: DataPreview },
  { slug: "png-to-webp", title: "Same image. New format.", description: "Move from PNG to WebP, right in your browser.", label: "02 / IMAGE CONVERSION", Graphic: ImagePreview },
  { slug: "color-converter", title: "Find your expression.", description: "Translate colors between HEX, RGB, and HSL.", label: "03 / COLOR & CSS", Graphic: ColorPreview },
].map(item => ({ ...item, tool: tools.find(tool => tool.slug === item.slug) })).filter(item => item.tool);

import { JsonLd } from "@/components/StructuredData";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => query.trim() ? searchTools(tools, query) : quickAccess, [query]);
  return <main className={styles.page}>
    <JsonLd schema={{
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      description: siteConfig.description,
      ...(siteConfig.origin ? { url: siteConfig.origin } : {})
    } as any} />
    <div className={`shell ${styles.container}`}>
      <section className={styles.hero} data-searching={Boolean(query.trim())} aria-labelledby="home-title">
        <div className={styles.eyebrow}><span aria-hidden="true">[</span> YOUR EVERYDAY DEVELOPER WORKBENCH <span aria-hidden="true">]</span></div>
        <h1 id="home-title">Less friction.<br /><span>More building.</span></h1>
        <p className={styles.intro}>Format, convert, inspect, and create with a workspace of focused developer tools.</p>
        <label className={styles.search} htmlFor="global-tool-search"><Search size={21} aria-hidden="true" /><span className="sr-only">Search all tools</span><input id="global-tool-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tools, formats, and tasks…" aria-label="Search all tools" autoComplete="off" /></label>
        <p className={styles.searchHint}>{query.trim() ? `${matches.length} matching tools` : "Search the registry or browse a station below."}</p>
        <div className={styles.stage}><StationAssembly /><div className={styles.stageCaption} aria-hidden="true"><span>DIFFERENT PARTS. ONE WORKSPACE.</span><span>ASSEMBLED FOR THE EVERYDAY.</span></div></div>
      </section>

      <PersonalTools />
      <section className={styles.quick} aria-labelledby="quick-access-title">
        <div className={styles.quickHeading}><h2 id="quick-access-title">{query.trim() ? "Matching tools" : "Quick access"}</h2><Link href="/tools">Browse all tools <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <div className={styles.quickList}>{matches.map(tool => <Link className={styles.quickLink} href={`/tools/${tool.slug}`} key={tool.id}><StationMark large label={tool.category} /><span><h3>{tool.name}</h3><p>{tool.description}</p></span><ArrowUpRight size={18} aria-hidden="true" /></Link>)}</div>
        {!matches.length && <div className={styles.empty}><p>No available tools match that search.</p><button type="button" onClick={() => setQuery("")}>Clear search</button></div>}
      </section>

      <section className={styles.showcase} aria-labelledby="showcase-title">
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>SMALL TOOLS, USEFUL POSSIBILITIES</span><h2 id="showcase-title">Make room for the work.</h2></div><span className={styles.sectionNote}>A few things you can do here <ArrowDown size={16} aria-hidden="true" /></span></div>
        <div className={styles.showcaseGrid}>{showcases.map(({ title, description, label, Graphic, tool }, index) => <article className={`${styles.showcasePanel} ${index === 0 ? styles.dataPanel : ""}`} key={tool!.id}><span className={styles.previewLabel}>{label}</span><div className={styles.preview}><Graphic /></div><h3>{title}</h3><p>{description}</p><Link href={`/tools/${tool!.slug}`}>{tool!.name}<ArrowUpRight size={18} aria-hidden="true" /></Link></article>)}</div>
      </section>

      <NativeAd className={styles.nativeAd} />

      <section className={styles.directory} id="categories" aria-labelledby="categories-title">
        <div className={styles.directoryIntro}><span className={styles.kicker}>THE STATION INDEX</span><h2 id="categories-title">Choose a station</h2><p>Different tasks.<br />A place for each.</p><span className={styles.indexCount}>{String(stations.length).padStart(2, "0")} stations <ArrowDown size={17} aria-hidden="true" /></span></div>
        <div><div className={styles.stationList}>{stations.map(station => <Link className={styles.station} href={station.route} key={station.id}><StationMark large label={station.name} /><div><h3>{station.name}</h3><p>{station.description}</p><span className={styles.count}>{station.toolCount} available tools</span></div><ArrowUpRight className={styles.stationArrow} size={18} aria-hidden="true" /></Link>)}</div><p className={styles.pending}><strong>Developer Math</strong><span>Pending — not yet available or included in counts.</span></p></div>
      </section>

      <section className={styles.principles} aria-labelledby="principles-title"><div className={styles.principleMark} aria-hidden="true">[<span>↗</span>]</div><div><span className={styles.kicker}>A CLEAR BOUNDARY</span><h2 id="principles-title">Know what each tool does.</h2><p>Most utilities calculate or transform data in the browser. A small number of tools have documented exceptions, such as the explicit API Request Tester or browser requests caused by remote images in Markdown previews. Read each station’s limitations before relying on output.</p><div className={styles.principleLinks}><Link href="/about">About Code Station <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/privacy">Privacy and processing <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/site-directory">Site directory <ArrowUpRight size={16} aria-hidden="true" /></Link></div></div></section>
    </div>
  </main>;
}
