"use client";

import { useMemo, useState } from "react";
import { escapeRegexLiteral, type RegexOperation, type RegexResult } from "@/lib/tools/regex-station";

type Props = { toolId: string };
const operationFor: Record<string, RegexOperation> = { "regex-tester": "test", "regex-replace-tester": "replace", "regex-match-inspector": "inspect", "regex-group-extractor": "groups", "regex-flag-tester": "flags", "regex-capture-group-tester": "capture", "regex-split-tester": "split" };
const defaults: Record<string, string> = { "regex-tester": "Code", "regex-replace-tester": "Code", "regex-match-inspector": "\\w+", "regex-group-extractor": "(?<key>\\w+)=(?<value>\\w+)", "regex-flag-tester": "^code$", "regex-capture-group-tester": "(\\w+)@(\\w+\\.\\w+)", "regex-split-tester": ",\\s*" };

function runInWorker(payload: unknown): Promise<RegexResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/regex.worker.ts", import.meta.url));
    const timeout = window.setTimeout(() => { worker.terminate(); reject(new Error("Regex timed out. Try a shorter input or simpler pattern.")); }, 1500);
    worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: RegexResult; error?: string }>) => { window.clearTimeout(timeout); worker.terminate(); event.data.ok ? resolve(event.data.result ?? {}) : reject(new Error(event.data.error)); };
    worker.onerror = () => { window.clearTimeout(timeout); worker.terminate(); reject(new Error("Could not run the regular expression.")); };
    worker.postMessage(payload);
  });
}

function downloadResult(output: string, filename: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Highlighted({ text, matches }: { text: string; matches: Array<{ index: number; end: number }> }) {
  const pieces: React.ReactNode[] = []; let cursor = 0;
  matches.slice().sort((a, b) => a.index - b.index).forEach((match, index) => { if (match.index < cursor) return; pieces.push(<span key={`text-${index}`}>{text.slice(cursor, match.index)}</span>); pieces.push(<mark key={`match-${index}`}>{text.slice(match.index, match.end)}</mark>); cursor = match.end; });
  pieces.push(<span key="tail">{text.slice(cursor)}</span>); return <>{pieces}</>;
}

/* ── Pattern Builder presets ─────────────────────────────── */
const PATTERN_PRESETS: Array<{ label: string; pattern: string; description: string }> = [
  { label: "Digits", pattern: "\\d+", description: "One or more digits" },
  { label: "Word", pattern: "[A-Za-z]+", description: "One or more letters" },
  { label: "Word characters", pattern: "\\w+", description: "Letters, digits, underscore" },
  { label: "Whitespace", pattern: "\\s+", description: "One or more whitespace characters" },
  { label: "Email", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.]+", description: "Email-like pattern" },
  { label: "URL", pattern: "https?://\\S+", description: "HTTP/HTTPS URL" },
  { label: "IP address", pattern: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}", description: "IPv4 address" },
  { label: "Hex color", pattern: "#[0-9a-fA-F]{3,8}", description: "CSS hex color" },
  { label: "Start of line", pattern: "^", description: "Anchor: beginning of line" },
  { label: "End of line", pattern: "$", description: "Anchor: end of line" },
  { label: "Word boundary", pattern: "\\b", description: "Word boundary position" },
  { label: "Any character", pattern: ".", description: "Any single character except newline" },
];

/* ── Flag checkboxes ─────────────────────────────────────── */
const FLAG_INFO: Array<{ flag: string; label: string; description: string }> = [
  { flag: "g", label: "Global", description: "Find all matches, not just the first" },
  { flag: "i", label: "Case-insensitive", description: "Match letters regardless of case" },
  { flag: "m", label: "Multiline", description: "^ and $ match line boundaries" },
  { flag: "s", label: "Dotall", description: ". matches newline characters" },
  { flag: "u", label: "Unicode", description: "Enable Unicode support" },
  { flag: "y", label: "Sticky", description: "Match only from lastIndex" },
];

export default function RegexStation({ toolId }: Props) {
  const [pattern, setPattern] = useState(defaults[toolId] ?? "Code");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("Code Station\ncode locally");
  const [replacement, setReplacement] = useState("[match]");
  const [result, setResult] = useState<RegexResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const operation = operationFor[toolId];
  const builder = toolId === "regex-pattern-builder";
  const flagTester = toolId === "regex-flag-tester";

  const builtPattern = useMemo(() => {
    if (!builder) return pattern;
    return `${pattern ? `(?=${pattern})` : ""}`;
  }, [builder, pattern]);

  const toggleFlag = (flag: string) => {
    setFlags(prev => prev.includes(flag) ? prev.replace(flag, "") : prev + flag);
  };

  const execute = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (toolId === "regex-escape") {
        setResult({ escaped: escapeRegexLiteral(text) });
      } else if (builder) {
        setResult({ pattern: builtPattern });
      } else {
        setResult(await runInWorker({ operation, pattern, flags, text, replacement, limit: 2000 }));
      }
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Could not process input.");
    } finally { setBusy(false); }
  };

  const output = result?.output ?? result?.escaped ?? (result?.parts ? result.parts.join("\n") : result?.pattern ?? (result ? JSON.stringify(result, null, 2) : ""));

  const copy = async () => { if (!output) return; await navigator.clipboard?.writeText(output); setNotice("Copied"); };
  const download = () => { if (!output) return; downloadResult(output, "regex-result.txt"); setNotice("Downloaded"); };
  const clear = () => { setText(""); setResult(null); setError(""); setNotice(""); };

  return <div className="regex-station">
    <div className="option-grid regex-options">
      <label>Pattern<input value={pattern} onChange={(event) => setPattern(event.target.value)} aria-label="Regular expression pattern" /></label>
      {flagTester ? (
        <fieldset>
          <legend>Flags</legend>
          <div className="check-grid">
            {FLAG_INFO.map(({ flag, label, description }) => (
              <label key={flag} title={description}>
                <input type="checkbox" checked={flags.includes(flag)} onChange={() => toggleFlag(flag)} />
                {label} ({flag})
              </label>
            ))}
          </div>
          <p className="muted">Current flags: <code>{flags || "(none)"}</code></p>
        </fieldset>
      ) : (
        <label>Flags<input value={flags} onChange={(event) => setFlags(event.target.value)} aria-label="Regular expression flags" placeholder="g m i s u y" /></label>
      )}
      {operation === "replace" && <label>Replacement<input value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label>}
    </div>

    {builder && <fieldset><legend>Pattern builder — common patterns</legend><div className="check-grid">{PATTERN_PRESETS.map(({ label, pattern: p, description }) => (
      <label key={label} title={description}>
        <input type="radio" name="builder" checked={pattern === p} onChange={() => setPattern(p)} /> {label}
      </label>
    ))}</div><p className="muted">Select a pattern or type a custom one above. The preview shows a lookahead for building complex patterns.</p></fieldset>}

    <div className="tool-layout">
      <div className="panel">
        <div className="panel-head"><span>{toolId === "regex-escape" ? "Literal input" : "Sample text"}</span><button className="button" onClick={() => setText("Code Station\ncode locally")}>Example</button></div>
        <textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="Regex sample text" />
      </div>
      <div className="panel">
        <div className="panel-head"><span>Result</span><span><button className="button" onClick={copy} disabled={!output}>Copy</button> <button className="button" onClick={download} disabled={!output}>Download</button></span></div>
        <div className="output" aria-live="polite">{result?.matches && operation === "inspect" ? <Highlighted text={text} matches={result.matches} /> : output || "Your result will appear here."}</div>
      </div>
    </div>
    <div className="actions"><button className="button primary" onClick={execute} disabled={busy}>{busy ? "Running…" : "Run regex"}</button><button className="button" onClick={clear}>Clear</button></div>
    {result?.count !== undefined && <p className="muted" aria-live="polite">{result.count} match{result.count === 1 ? "" : "es"}{result.truncated ? " (limited)" : ""}</p>}
    {error && <div className="error" role="alert">{error}</div>}
    {notice && <div className="muted" role="status">{notice}</div>}
    <p className="privacy">↳ Runs locally in a timed worker. Nothing is sent to Code Station.</p>
  </div>;
}
