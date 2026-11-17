"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search, X } from "lucide-react";
import {
  featuredPaletteTools,
  paletteActions,
  paletteStations,
  paletteTools,
  type PaletteAction,
  type PaletteStation,
  type PaletteTool,
} from "@/lib/command-palette/catalog";
import { searchTools } from "@/lib/tool-search";
import { useSafeRouter } from "./useSafeNavigation";
import styles from "./CommandPalette.module.css";

interface CommandPaletteDialogProps {
  open: boolean;
  onClose: () => void;
}

type ResultKind = "tool" | "station" | "action";

interface ResultItem {
  kind: ResultKind;
  id: string;
  label: string;
  meta: string;
  description: string;
  href: string;
}

interface ResultGroup {
  id: string;
  label: string;
  results: readonly ResultItem[];
}

const GROUP_LIMIT = 8;

function toolResult(tool: PaletteTool): ResultItem {
  return {
    kind: "tool",
    id: tool.slug,
    label: tool.name,
    meta: tool.category,
    description: tool.description,
    href: `/tools/${tool.slug}`,
  };
}

function stationResult(station: PaletteStation): ResultItem {
  return {
    kind: "station",
    id: station.id,
    label: station.name,
    meta: "Station",
    description: station.description,
    href: station.route,
  };
}

function actionResult(action: PaletteAction): ResultItem {
  return {
    kind: "action",
    id: action.id,
    label: action.label,
    meta: "Action",
    description: action.description,
    href: action.href,
  };
}

export default function CommandPaletteDialog({ open, onClose }: CommandPaletteDialogProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useSafeRouter();

  const groups = useMemo<ResultGroup[]>(() => {
    const value = query.trim();
    if (!value) {
      return [
        { id: "tools", label: "Tools", results: featuredPaletteTools.slice(0, GROUP_LIMIT).map(toolResult) },
        { id: "actions", label: "Actions", results: paletteActions.slice(0, GROUP_LIMIT).map(actionResult) },
      ].filter((group) => group.results.length > 0);
    }

    const normalized = value.toLowerCase();
    const matchedTools = searchTools(paletteTools, value).slice(0, GROUP_LIMIT).map(toolResult);
    const matchedStations = paletteStations
      .filter(
        (station) =>
          station.name.toLowerCase().includes(normalized) ||
          station.description.toLowerCase().includes(normalized)
      )
      .slice(0, GROUP_LIMIT)
      .map(stationResult);
    const matchedActions = paletteActions
      .filter((action) =>
        [action.label, action.description, ...action.keywords].some((candidate) =>
          candidate.toLowerCase().includes(normalized)
        )
      )
      .slice(0, GROUP_LIMIT)
      .map(actionResult);

    return [
      { id: "tools", label: "Tools", results: matchedTools },
      { id: "stations", label: "Stations", results: matchedStations },
      { id: "actions", label: "Actions", results: matchedActions },
    ].filter((group) => group.results.length > 0);
  }, [query]);

  const indexedGroups = useMemo(() => {
    let offset = 0;
    return groups.map((group) => {
      const start = offset;
      offset += group.results.length;
      return { ...group, start };
    });
  }, [groups]);

  const total = indexedGroups.reduce((count, group) => count + group.results.length, 0);
  const items = useMemo(() => indexedGroups.flatMap((group) => group.results), [indexedGroups]);
  const activeIndex = total ? Math.min(active, total - 1) : 0;

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    setActive((current) => (current < total ? current : Math.max(0, total - 1)));
  }, [total]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !total) return;
    document.getElementById(`cp-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open, total]);

  if (!open) return null;

  const activate = (item: ResultItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  const move = (next: number) => {
    if (!total) return;
    setActive(Math.max(0, Math.min(total - 1, next)));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(activeIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(activeIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(total - 1);
        break;
      case "Enter":
        event.preventDefault();
        activate(items[activeIndex]);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        onClose();
        break;
      case "Tab": {
        const first = inputRef.current;
        const last = closeRef.current;
        if (!first || !last) break;
        const current = document.activeElement;
        if (event.shiftKey && current === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && current === last) {
          event.preventDefault();
          first.focus();
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        aria-describedby="command-palette-hint"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.dialogHeader}>
          <h2 id="command-palette-title">Command palette</h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close command palette"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.searchRow}>
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-listbox"
            aria-autocomplete="list"
            aria-labelledby="command-palette-title"
            aria-activedescendant={total ? `cp-option-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search tools, stations, and actions…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd className={styles.kbd} aria-hidden="true">
            esc
          </kbd>
        </div>

        <p className={styles.srOnly} role="status" aria-live="polite">
          {total} {total === 1 ? "result" : "results"}
        </p>

        <div id="command-palette-listbox" role="listbox" aria-label="Command palette results" className={styles.results}>
          {total ? (
            indexedGroups.map((group) => (
              <div
                key={group.id}
                role="group"
                aria-labelledby={`cp-group-${group.id}`}
                className={styles.group}
              >
                <div id={`cp-group-${group.id}`} className={styles.groupLabel} aria-hidden="true">
                  {group.label}
                </div>
                <ul role="presentation" className={styles.groupList}>
                  {group.results.map((result, localIndex) => {
                    const index = group.start + localIndex;
                    const selected = index === activeIndex;
                    return (
                      <li
                        key={`${group.id}-${result.id}`}
                        id={`cp-option-${index}`}
                        role="option"
                        aria-selected={selected}
                        className={`${styles.resultRow} ${selected ? styles.resultSelected : ""}`}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => activate(result)}
                      >
                        <span className={styles.resultLabel}>{result.label}</span>
                        <span className={styles.resultMeta}>{result.meta}</span>
                        <span className={styles.resultDescription}>{result.description}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          ) : (
            <p className={styles.empty}>No tools, stations, or actions match “{query.trim()}”.</p>
          )}
        </div>

        <div id="command-palette-hint" className={styles.footer}>
          <span>
            <kbd className={styles.kbd}>↑</kbd>
            <kbd className={styles.kbd}>↓</kbd> navigate
          </span>
          <span>
            <CornerDownLeft size={13} aria-hidden="true" /> open
          </span>
          <span>
            <kbd className={styles.kbd}>esc</kbd> close
          </span>
          <span className={styles.footerNote}>Local only · no requests or storage</span>
        </div>
      </div>
    </div>
  );
}
