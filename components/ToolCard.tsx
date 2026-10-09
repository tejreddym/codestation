import Link from "next/link";
import type { ToolDefinition } from "@/config/tools";
import { FavoriteButton } from "./PersonalTools";
import StationMark from "./StationMark";

import { isProTool } from "@/config/pro-tools";

export default function ToolCard({ tool, category }: { tool: ToolDefinition; category?: string }) {
  const isPro = isProTool(tool.id);
  return <div className="tool-card-row"><Link className="tool-card" href={`/tools/${tool.slug}`}>
    <span className="tool-card-symbol" aria-hidden="true"><StationMark large label={tool.category} /></span>
    <div className="tool-card-copy">
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
        <span className="tag" style={{ margin: 0 }}>{category ?? tool.category}</span>
        {isPro && <span className="tag" style={{ margin: 0, background: "var(--yellow)", color: "#17191c", fontWeight: 800 }}>PRO</span>}
      </div>
      <h3>{tool.name}</h3><p>{tool.description}</p></div>
    <span className="tool-arrow" aria-hidden="true">↗</span>
  </Link><FavoriteButton slug={tool.slug} /></div>;
}
