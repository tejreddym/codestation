"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Clipboard, Clock, History as HistoryIcon, Sparkles, X } from "lucide-react";
import { useSafeRouter } from "./useSafeNavigation";
import { useWorkbench } from "./WorkbenchProvider";
import { detectClipboardContent, type Detection, type DetectionResult } from "@/lib/workbench/detection";
import { getTool } from "@/config/tools";
import styles from "./ClipboardOmniTriage.module.css";

const SESSION_STORAGE_KEY = "codestation_triage_history";
const MAX_HISTORY_ITEMS = 10;

export type TriageHistoryItem = {
  id: string;
  timestamp: number;
  text: string;
  preview: string;
  format: string;
  confidence: "high" | "possible";
  score: number;
  slug: string;
  toolName: string;
};

export default function ClipboardOmniTriage() {
  const [text, setText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TriageHistoryItem[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useSafeRouter();
  const { queueInput } = useWorkbench();

  // Load triage history from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY_ITEMS));
        }
      }
    } catch {
      // sessionStorage unavailable or blocked
    }
  }, []);

  // Global keyboard shortcut: Cmd/Ctrl + Shift + V focuses the triage bar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;
      const isV = event.key.toLowerCase() === "v" || event.code === "KeyV";

      if (isModifier && isShift && isV) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Run format detection
  const detectionResult: DetectionResult = useMemo(() => {
    if (!text.trim()) {
      return {
        matches: [],
        topMatch: null,
        text: "",
        timestamp: Date.now(),
        format: null,
        confidence: null,
        score: 0,
      };
    }
    return detectClipboardContent(text);
  }, [text]);

  // Persist detection to sessionStorage
  const saveToHistory = useCallback((content: string, top: Detection) => {
    try {
      const toolDef = getTool(top.slug);
      const newEntry: TriageHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        text: content,
        preview: content.trim().replace(/\s+/g, " ").slice(0, 70),
        format: top.format,
        confidence: top.confidence,
        score: top.score,
        slug: top.slug,
        toolName: toolDef?.name ?? top.slug,
      };

      setHistory(prev => {
        const filtered = prev.filter(item => item.text !== content);
        const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore storage quota errors
        }
        return updated;
      });
    } catch {
      // ignore
    }
  }, []);

  // Open tool with input pre-filled
  const handleOpenTool = useCallback(
    (slug: string, detection?: Detection) => {
      const content = text.trim();
      if (!content) return;

      queueInput(slug, content);

      if (detection) {
        saveToHistory(content, detection);
      } else if (detectionResult.topMatch) {
        saveToHistory(content, detectionResult.topMatch);
      }

      try {
        sessionStorage.setItem("codestation_pending_input", JSON.stringify({ slug, text: content }));
      } catch {
        // ignore
      }

      const truncatedParam = encodeURIComponent(content.slice(0, 2000));
      router.push(`/tools/${slug}?input=${truncatedParam}`);
    },
    [text, queueInput, saveToHistory, detectionResult.topMatch, router]
  );

  // Paste from clipboard handler
  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          setText(clipText);
          inputRef.current?.focus();
        }
      }
    } catch {
      // Browser permissions or clipboard read unavailable; focus input for manual paste
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setText("");
    inputRef.current?.focus();
  };

  const handleClearHistory = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setHistory([]);
  };

  const handleSelectHistoryItem = (item: TriageHistoryItem) => {
    setText(item.text);
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const { topMatch, matches } = detectionResult;
  const topTool = topMatch ? getTool(topMatch.slug) : null;
  const alternativeMatches = matches.slice(1, 4);

  return (
    <section
      className={styles.container}
      aria-label="Clipboard Omni-Triage"
      data-webmcp-tool="codestation_clipboard_triage"
      data-testid="clipboard-omni-triage"
    >
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          <Sparkles size={14} aria-hidden="true" />
          Smart Clipboard Omni-Triage
        </span>
        <span className={styles.shortcutTip} title="Press Cmd/Ctrl + Shift + V anywhere to focus">
          <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>
        </span>
      </div>

      <div className={styles.inputGroup}>
        <div className={styles.textareaWrapper}>
          <textarea
            ref={inputRef}
            className={styles.textarea}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)"
            aria-label="Paste anything here to auto-detect format"
            rows={2}
          />
          {text && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              aria-label="Clear triage input"
              title="Clear input"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <button
              type="button"
              className={styles.pasteButton}
              onClick={handlePasteClipboard}
              title="Paste content from clipboard"
            >
              <Clipboard size={14} aria-hidden="true" />
              Paste from clipboard
            </button>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              className={styles.historyToggle}
              onClick={() => setHistoryOpen(prev => !prev)}
              aria-expanded={historyOpen}
            >
              <HistoryIcon size={14} aria-hidden="true" />
              Recent ({history.length})
            </button>
          )}
        </div>
      </div>

      {/* History Drawer */}
      {historyOpen && (
        <div className={styles.historyDrawer} role="region" aria-label="Recent triage detections">
          <div className={styles.historyHeader}>
            <span>Recent Clipboard Triage (Session)</span>
            <button type="button" className={styles.clearHistoryBtn} onClick={handleClearHistory}>
              Clear history
            </button>
          </div>
          {history.length === 0 ? (
            <div className={styles.emptyHistory}>No recent detections stored in this session.</div>
          ) : (
            <ul className={styles.historyList}>
              {history.map(item => (
                <li
                  key={item.id}
                  className={styles.historyItem}
                  onClick={() => handleSelectHistoryItem(item)}
                  title="Click to load into triage bar"
                >
                  <span className={styles.historySnippet}>{item.preview}</span>
                  <div className={styles.historyMeta}>
                    <span className={styles.historyFormat}>{item.format}</span>
                    <span
                      className={`${styles.badge} ${
                        item.confidence === "high" ? styles.badgeHigh : styles.badgePossible
                      }`}
                    >
                      {item.score}%
                    </span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Detection Results */}
      {topMatch && (
        <div className={styles.resultPanel} role="status" aria-live="polite">
          <div className={styles.feedbackRow}>
            <div className={styles.formatInfo}>
              <span className={styles.formatLabel}>{topMatch.format}</span>
              <span
                className={`${styles.badge} ${
                  topMatch.confidence === "high" ? styles.badgeHigh : styles.badgePossible
                }`}
              >
                <span className={styles.badgeDot} />
                {topMatch.confidence === "high" ? "High Confidence" : "Possible Match"}
              </span>
              <span className={styles.scoreText}>Confidence: {topMatch.score}%</span>
            </div>

            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => handleOpenTool(topMatch.slug, topMatch)}
              >
                Open in {topTool?.name ?? topMatch.slug}
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>

              {alternativeMatches.map(alt => {
                const altTool = getTool(alt.slug);
                return (
                  <button
                    key={alt.slug}
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => handleOpenTool(alt.slug, alt)}
                  >
                    {altTool?.name ?? alt.slug}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>

          <p className={styles.reasonNote}>{topMatch.reason}</p>
        </div>
      )}
    </section>
  );
}
