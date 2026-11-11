"use client";
import Link from "next/link";
import { Fragment, useMemo, useState } from 'react';
import type { ToolDefinition } from '@/config/tools';
import { searchTools } from '@/lib/tool-search';
import ToolCard from './ToolCard';
import BannerAd from './BannerAd';
const anchor = (name: string) => `tools-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
export default function DirectoryBrowser({ tools, category }: { tools: ToolDefinition[]; category?: string }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => searchTools(tools, query), [tools, query]);
  const groups = [...new Set(visible.map(t => t.category))].map(name => ({ name, tools: visible.filter(t => t.category === name) }));
  return (
    <>
      <label className="field-label" htmlFor="directory-search">Find a tool</label>
      <input id="directory-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names, formats or tasks" />
      <p className="muted" role="status">{visible.length} tools{query ? ` matching “${query}”` : ''}. Use Control or Command K to search from any page.</p>
      <div className="directory-layout">
        <nav className="directory-index" aria-label="Tool categories">
          <span className="section-kicker">JUMP TO A CATEGORY</span>
          {groups.map(g => <a href={`#${anchor(g.name)}`} key={g.name}><span>{g.name}</span><span>{g.tools.length}</span></a>)}
          {category && <Link className="directory-all" href="/tools">All developer tools ↗</Link>}
        </nav>
        <div className="directory-groups">
          {groups.map((g, i) => (
            <Fragment key={g.name}>
              {i > 0 && i % 3 === 0 && (
                <div style={{ display: "flex", justifyContent: "center", margin: "32px 0 24px", width: "100%" }}>
                  <BannerAd size="leaderboard" />
                </div>
              )}
              <section className="directory-group" id={anchor(g.name)} aria-labelledby={`${anchor(g.name)}-heading`}>
                <div className="directory-group-heading">
                  <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h2 id={`${anchor(g.name)}-heading`}>{g.name}</h2>
                  <span>{g.tools.length} tools</span>
                </div>
                <div className="tool-grid">{g.tools.map(t => <ToolCard key={t.id} tool={t} />)}</div>
              </section>
            </Fragment>
          ))}
          {!visible.length && <p>{tools.length ? "No tools match. Try JSON, image or encode." : "That station does not have any tools yet."}</p>}
          <div style={{ display: "flex", justifyContent: "center", margin: "40px 0 20px", width: "100%" }}>
            <BannerAd size="leaderboard" />
          </div>
        </div>
      </div>
    </>
  );
}
