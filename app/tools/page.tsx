import Link from "next/link";
import { tools } from "@/config/tools";
import DirectoryBrowser from "@/components/DirectoryBrowser";
import StationGlyph from "@/components/StationGlyph";

export const metadata = { title: "All developer tools", description: "Browse Code Station's practical browser-first developer utilities." };

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const visibleTools = category ? tools.filter((tool) => tool.category === category) : tools;
  return <main className="shell"><section className="tool-page directory-page">
    <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> / </span><Link href="/tools" aria-current={category ? undefined : "page"}>Tools</Link>{category && <><span aria-hidden="true"> / </span><Link href={`/tools?category=${encodeURIComponent(category)}`} aria-current="page">{category}</Link></>}</nav>
    <div className="station-intro"><div className="page-heading"><div><div className="eyebrow"><span className="bracket-label">TOOL REGISTRY</span> {visibleTools.length} {visibleTools.length === 1 ? "tool" : "tools"}</div><h1>{category ? `${category} Station` : <>A tool for<br />the task at hand.</>}</h1><p className="lead">{category ? `Tools for focused ${category.toLowerCase()} work.` : "Practical utilities for the work between your editor, terminal, and browser."}</p></div></div><StationGlyph category={category ?? "Converters"} /></div>
    <DirectoryBrowser tools={visibleTools} category={category}/>
  </section></main>;
}
