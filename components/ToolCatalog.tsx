"use client";

import { useMemo, useState, Fragment } from "react";
import type { ToolDefinition } from "@/config/tools";
import { searchTools } from "@/lib/tool-search";
import ToolCard from "./ToolCard";
import BannerAd from "./BannerAd";

export type ToolCategoryFilter = { id: string; name: string; toolIds: readonly string[] };

type ToolCatalogProps = {
  name: string;
  heading?: string;
  searchName?: string;
  tools: readonly ToolDefinition[];
  description?: string;
  categoryFilters?: readonly ToolCategoryFilter[];
  categoryLabels?: Readonly<Record<string, string>>;
  emptyMessage?: string;
};

export default function ToolCatalog({ name, heading, searchName, tools, description, categoryFilters, categoryLabels, emptyMessage }: ToolCatalogProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const filtered = useMemo(() => {
    const categoryIds = categoryFilters?.find(filter => filter.id === category)?.toolIds;
    const scoped = categoryIds ? tools.filter(tool => categoryIds.includes(String(tool.id))) : tools;
    return searchTools(scoped, query);
  }, [category, categoryFilters, query, tools]);
  const hasFilters = Boolean(query || category !== "all");
  const visibleName = searchName ?? name;
  const searchId = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-tool-search`;

  function resetFilters() {
    setQuery("");
    setCategory("all");
  }

  return <section className="section" aria-labelledby={`${searchId}-heading`}>
    <div className="section-head"><div>
      <h2 id={`${searchId}-heading`}>{heading ?? `${name} tools`}</h2>
      {description && <p className="muted">{description}</p>}
    </div></div>
    <div className="catalog-toolbar">
      <label className="search" htmlFor={searchId}><span aria-hidden="true">⌕</span><span>Search</span><input id={searchId} aria-label={`Search ${visibleName} tools`} placeholder={`Search ${visibleName} tools`} value={query} autoComplete="off" onChange={event => setQuery(event.target.value)} /></label>
      <button type="button" className="button secondary" onClick={() => setQuery("")} disabled={!query}>Clear search</button>
      {categoryFilters && <label className="station-category-filter" htmlFor={`${searchId}-category`}>Category<select id={`${searchId}-category`} aria-label="Category" value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categoryFilters.map(filter => <option value={filter.id} key={filter.id}>{filter.name}</option>)}</select></label>}
      {categoryFilters && <button type="button" className="button secondary" onClick={resetFilters} disabled={!hasFilters}>Reset filters</button>}
    </div>
    <p className="muted" role="status" aria-live="off">{filtered.length} of {tools.length} tools</p>
    {filtered.length ? <div className="tool-grid">{filtered.map((tool, i) => {
      const showAd = i > 0 && i % 6 === 0;
      return (
        <Fragment key={tool.id}>
          {showAd && <div style={{ display: 'flex', justifyContent: 'center', gridColumn: '1 / -1', margin: '20px 0' }}><BannerAd size="leaderboard" /></div>}
          <ToolCard tool={tool} category={categoryLabels?.[String(tool.id)]} />
        </Fragment>
      );
    })}</div> : <div className="empty-state"><p className="muted">{emptyMessage ?? `No ${name} tools match that search.`}</p>{hasFilters && <button type="button" className="button secondary" onClick={resetFilters}>Reset filters</button>}</div>}
  </section>;
}
