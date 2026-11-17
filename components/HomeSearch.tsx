"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, Sparkles } from "lucide-react";
import { searchTools, type ToolSearchMetadata } from "@/lib/tool-search";
import { useSafeRouter } from "@/components/useSafeNavigation";
import { useWorkbench } from "@/components/WorkbenchProvider";
import { detectClipboardContent, type Detection } from "@/lib/workbench/detection";
import StationMark from "@/components/StationMark";
import { StationAssembly } from "@/components/HomeGraphics";
import styles from "@/app/Home.module.css";

export type ToolCardMetadata = ToolSearchMetadata & {
  slug: string;
  category: string;
  featured?: boolean;
};

interface HomeSearchProps {
  tools: readonly ToolCardMetadata[];
  children?: React.ReactNode;
}

export default function HomeSearch({ tools, children }: HomeSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useSafeRouter();
  const { queueInput } = useWorkbench();

  // Global keyboard shortcut: Cmd/Ctrl + Shift + V focuses the search bar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;
      const isV = event.key.toLowerCase() === "v" || event.code === "KeyV";

      if (isModifier && isShift && isV) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Format detection on query / pasted content
  const detectionResult = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const result = detectClipboardContent(trimmed);
    if (result.topMatch && result.topMatch.format !== "Plain Text" && result.topMatch.score >= 50) {
      return result;
    }
    return null;
  }, [query]);

  // Open tool with input pre-filled and persisted
  const handleOpenTool = useCallback((slug: string, detection: Detection) => {
    const content = query.trim();
    if (!content) return;
    queueInput(slug, content);
    try {
      sessionStorage.setItem("codestation_pending_input", JSON.stringify({ slug, text: content }));
      const stored = sessionStorage.getItem("codestation_triage_history");
      const prev = stored ? JSON.parse(stored) : [];
      const toolMatch = tools.find(t => t.slug === slug);
      const newEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        text: content,
        preview: content.replace(/\s+/g, " ").slice(0, 70),
        format: detection.format,
        confidence: detection.confidence,
        score: detection.score,
        slug,
        toolName: toolMatch?.name ?? slug,
      };
      sessionStorage.setItem("codestation_triage_history", JSON.stringify([newEntry, ...prev.filter((item: any) => item.text !== content)].slice(0, 10)));
    } catch {
      // ignore storage errors
    }
    const truncatedParam = encodeURIComponent(content.slice(0, 2000));
    router.push(`/tools/${slug}?input=${truncatedParam}`);
  }, [query, queueInput, router, tools]);

  const quickAccess = useMemo(
    () => tools.filter(tool => tool.featured).slice(0, 6),
    [tools]
  );

  const searchActive = Boolean(query.trim());
  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const directMatches = searchTools(tools, trimmed);
    if (directMatches.length > 0) return directMatches;
    if (detectionResult?.matches?.length) {
      const detected = detectionResult.matches
        .map(d => tools.find(t => t.slug === d.slug))
        .filter(Boolean) as ToolCardMetadata[];
      if (detected.length > 0) return detected;
    }
    return directMatches;
  }, [query, detectionResult, tools]);

  const resultsId = "home-search-results";
  const optionId = (index: number) => `home-search-option-${index}`;
  const selectedIndex = activeIndex >= 0 && activeIndex < searchResults.length ? activeIndex : -1;

  useEffect(() => {
    if (selectedIndex < 0) return;
    const option = document.getElementById(`home-search-option-${selectedIndex}`);
    option?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setActiveIndex(-1);
    searchInputRef.current?.focus();
  }, []);

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchActive) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(current => searchResults.length ? (current + 1) % searchResults.length : -1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(current => searchResults.length ? (current <= 0 ? searchResults.length - 1 : current - 1) : -1);
    } else if (event.key === "Enter") {
      const target = searchResults[selectedIndex] ?? searchResults[0];
      if (target) {
        event.preventDefault();
        router.push(`/tools/${target.slug}`);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
    }
  }

  const getToolName = useCallback((slug: string) => {
    return tools.find(t => t.slug === slug)?.name ?? slug;
  }, [tools]);

  return (
    <>
      <section className={styles.hero} data-searching={Boolean(query.trim())} aria-labelledby="home-title">
        <div className={styles.eyebrow}><span aria-hidden="true">[</span> 370+ PRIVATE TOOLS · WEBMCP BROWSER AI PROTOCOL · 30 STATIONS <span aria-hidden="true">]</span></div>
        <h1 id="home-title">Less friction.<br /><span>More building.</span></h1>
        <p className={styles.intro}>
          Code Station is a free browser-based toolbox for developers, designers, and technical teams: 381 focused utilities across 30 stations for formatting, converting, generating, and inspecting data. Native <strong>WebMCP (<code>document.modelContext</code>)</strong> lets AI agents run supported tools in the page, and everything stays client-side with zero server uploads.
        </p>
        <label className={styles.search} htmlFor="global-tool-search">
          <Search size={21} aria-hidden="true" />
          <span className="sr-only">Search all tools</span>
          <input
            id="global-tool-search"
            ref={searchInputRef}
            value={query}
            onChange={event => { setQuery(event.target.value); setActiveIndex(-1); }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search tools, formats, and tasks…"
            aria-label="Search all tools"
            role="combobox"
            aria-expanded={searchActive}
            aria-controls={searchActive ? resultsId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={searchActive && selectedIndex >= 0 ? optionId(selectedIndex) : undefined}
            autoComplete="off"
          />
        </label>
        {searchActive ? (
          <div className={styles.searchResults} id={resultsId} role="listbox" aria-label="Matching tools">
            <div className={styles.searchResultsHeader}>
              <p className={styles.searchHint} role="status" aria-live="polite">
                {searchResults.length} matching {searchResults.length === 1 ? "tool" : "tools"}
              </p>
              <button type="button" className={styles.searchClear} onClick={clearSearch}>Clear search</button>
            </div>
            {searchResults.length ? (
              <div className={styles.searchResultsList}>
                {searchResults.map((tool, index) => (
                  <Link
                    key={tool.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={selectedIndex === index}
                    tabIndex={-1}
                    className={styles.searchResult}
                    href={`/tools/${tool.slug}`}
                    prefetch={false}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <StationMark large label={tool.category} />
                    <span className={styles.searchResultBody}>
                      <h3>{tool.name}</h3>
                      <p>{tool.description}</p>
                    </span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.searchResultsEmpty}>No available tools match that search.</p>
            )}
          </div>
        ) : (
          <p className={styles.searchHint}>Search the registry or browse a station below.</p>
        )}
        {detectionResult && detectionResult.topMatch && (
          <div className={styles.searchTriage}>
            <div className={styles.searchTriageHeader}>
              <span className={styles.searchTriageFormat}>
                <Sparkles size={14} aria-hidden="true" />
                Detected: {detectionResult.topMatch.format}
              </span>
              <span className={`${styles.searchTriageBadge} ${detectionResult.topMatch.confidence === "high" ? styles.badgeHigh : styles.badgePossible}`}>
                {detectionResult.topMatch.score}% confidence
              </span>
              <span className={styles.searchTriageReason}>{detectionResult.topMatch.reason}</span>
            </div>
            <div className={styles.searchTriageActions}>
              <button
                type="button"
                className={styles.searchTriagePrimaryBtn}
                onClick={() => handleOpenTool(detectionResult.topMatch!.slug, detectionResult.topMatch!)}
              >
                Open in {getToolName(detectionResult.topMatch.slug)}
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
              {detectionResult.matches.slice(1, 4).map(alt => {
                return (
                  <button
                    key={alt.slug}
                    type="button"
                    className={styles.searchTriageSecondaryBtn}
                    onClick={() => handleOpenTool(alt.slug, alt)}
                  >
                    {getToolName(alt.slug)}
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <p className={styles.searchDetectHint}>Paste anything to detect format</p>
        <div className={styles.stage}><StationAssembly /><div className={styles.stageCaption} aria-hidden="true"><span>DIFFERENT PARTS. ONE WORKSPACE.</span><span>ASSEMBLED FOR THE EVERYDAY.</span></div></div>
      </section>

      {!searchActive && children}

      {!searchActive && (
      <section className={styles.quick} aria-labelledby="quick-access-title">
        <div className={styles.quickHeading}>
          <h2 id="quick-access-title">Quick access</h2>
          <Link href="/tools">Browse all tools <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className={styles.quickList}>
          {quickAccess.map(tool => (
            <Link className={styles.quickLink} href={`/tools/${tool.slug}`} key={tool.id} prefetch={false}>
              <StationMark large label={tool.category} />
              <span>
                <h3>{tool.name}</h3>
                <p>{tool.description}</p>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      )}
    </>
  );
}
