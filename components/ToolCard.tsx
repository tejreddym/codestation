import Link from "next/link";
import type { ToolDefinition } from "@/config/tools";
import { FavoriteButton } from "./PersonalTools";
import StationMark from "./StationMark";

export default function ToolCard({ tool, category }: { tool: ToolDefinition; category?: string }) {
  return <div className="tool-card-row"><Link className="tool-card" href={`/tools/${tool.slug}`}>
    <span className="tool-card-symbol" aria-hidden="true"><StationMark large label={tool.category} /></span>
    <div className="tool-card-copy"><span className="tag">{category ?? tool.category}</span>
      <h3>{tool.name}</h3><p>{tool.description}</p></div>
    <span className="tool-arrow" aria-hidden="true">↗</span>
  </Link><FavoriteButton slug={tool.slug} /></div>;
}
