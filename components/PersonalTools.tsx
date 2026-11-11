"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { getTool, type ToolDefinition } from "@/config/tools";
import { useWorkbench } from "./WorkbenchProvider";

export function FavoriteButton({ slug }: { slug: string }) {
  const { preferences, toggleFavorite } = useWorkbench();
  const active = preferences.favorites.includes(slug);
  const tool = getTool(slug);
  return (
    <button
      type="button"
      className="favorite-button"
      aria-label={`${active ? "Remove" : "Add"} ${tool?.name ?? "tool"} ${active ? "from" : "to"} favorites`}
      aria-pressed={active}
      onClick={() => toggleFavorite(slug)}
    >
      <Star size={17} fill={active ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

function PersonalSection({
  label,
  ids,
  isFavorites,
}: {
  label: string;
  ids: readonly string[];
  isFavorites?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const validTools: ToolDefinition[] = [];
  for (const id of ids) {
    const tool = getTool(id);
    if (tool) validTools.push(tool);
  }

  const hasMore = validTools.length > 4;
  const isExpanded = hasMore && expanded;
  const displayedTools = hasMore && !isExpanded ? validTools.slice(0, 4) : validTools;
  const sectionId = label.toLowerCase().replace(/\s+/g, "-");
  const listId = `personal-list-${sectionId}`;

  return (
    <div className="personal-tools-section" data-section={sectionId}>
      <h2>{label}</h2>
      {validTools.length > 0 ? (
        <>
          <ul id={listId}>
            {displayedTools.map((tool) => (
              <li key={tool.id}>
                <Link href={`/tools/${tool.slug}`}>{tool.name}</Link>
                {isFavorites && <FavoriteButton slug={tool.slug} />}
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="personal-tools-toggle"
              aria-expanded={isExpanded}
              aria-controls={listId}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </>
      ) : (
        <p className="muted">
          {label === "Favorites"
            ? "Use a star to keep a tool here."
            : "Tools you visit appear here. Only tool names are remembered."}
        </p>
      )}
    </div>
  );
}

export default function PersonalTools({ always = false }: { always?: boolean }) {
  const { preferences, ready } = useWorkbench();
  if (!always && (!ready || (!preferences.favorites.length && !preferences.recent.length))) {
    return null;
  }

  return (
    <section className="personal-tools" aria-label="Your tools">
      <PersonalSection label="Favorites" ids={preferences.favorites} isFavorites />
      <PersonalSection label="Recently used" ids={preferences.recent} />
    </section>
  );
}

