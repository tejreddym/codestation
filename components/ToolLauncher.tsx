"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, Search } from "lucide-react";
import { tools, getTool } from "@/config/tools";
import { searchTools } from "@/lib/tool-search";
import { detectTools, type Detection } from "@/lib/workbench/detection";
import { useWorkbench } from "./WorkbenchProvider";
import { useSafePathname, useSafeRouter } from "./useSafeNavigation";

export default function ToolLauncher() {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<Detection[]>([]);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<'search' | 'detect'>('search');
  const [selected, setSelected] = useState(0);
  const { preferences, queueInput } = useWorkbench();
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const busy = useRef(false);
  const revision = useRef(0);
  const results = searchTools(tools, query).slice(0, 30);
  const close = useCallback(() => { revision.current++; dialog.current?.close(); setText(""); setMatches([]); setMessage(""); }, []);
  const openTool = useCallback((slug: string, value: string) => { queueInput(slug, value); close(); router.push(`/tools/${slug}`); }, [queueInput, close, router]);
  const inspect = useCallback((value: string, automatic = false) => {
    try {
      const found = detectTools(value).filter(item => getTool(item.slug));
      setText(value); setMatches(found); setMessage(found.length ? `${found.length} matching ${found.length === 1 ? 'tool' : 'tools'}. Detection is a suggestion, not validation.` : 'Clipboard has no text to inspect.');
      if (preferences.autoOpenSingle && found.length === 1 && found[0].confidence === 'high' && (!automatic || ['/', '/tools', '/workbench'].includes(pathname))) openTool(found[0].slug, value);
    } catch (error) { setText(""); setMatches([]); setMessage(error instanceof Error ? error.message : 'Could not detect this input.'); }
  }, [preferences.autoOpenSingle, pathname, openTool]);
  async function readClipboard() {
    setMode('detect'); dialog.current?.showModal();
    const version = ++revision.current;
    try { if (!navigator.clipboard?.readText) throw new Error('Unavailable'); const value = await navigator.clipboard.readText(); if (version === revision.current) inspect(value); }
    catch { if (version === revision.current) setMessage('Clipboard access was not available or was declined. Paste text below to detect it.'); }
  }
  useEffect(() => () => { revision.current++; }, []);
  useEffect(() => { if (dialog.current?.open && mode === "search") dialog.current.querySelector(".selected")?.scrollIntoView?.({ block: "nearest" }); }, [selected, mode]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setMode('search'); dialog.current?.showModal(); search.current?.focus(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!preferences.autoDetect) return;
    const focus = async () => {
      if (busy.current || document.visibilityState !== 'visible' || !document.hasFocus() || dialog.current?.open) return;
      busy.current = true; const version = revision.current;
      try {
        const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
        if (permission.state !== 'granted') return;
        const value = await navigator.clipboard.readText();
        if (version === revision.current) { setMode('detect'); inspect(value, true); }
      } catch { /* Unsupported browsers keep the explicit Paste action. No prompt loop. */ }
      finally { busy.current = false; }
    };
    window.addEventListener('focus', focus);
    // Invalidate pending clipboard reads on settings or route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { window.removeEventListener('focus', focus); revision.current++; };
  }, [preferences.autoDetect, inspect]);
  return <><button className="launcher-button" type="button" aria-label="Search tools (Control or Command K)" onClick={() => { setMode('search'); dialog.current?.showModal(); search.current?.focus(); }}><Search size={18} aria-hidden="true" /><span>Search</span></button><button className={`launcher-button ${matches.length ? "has-suggestions" : ""}`} type="button" aria-label={matches.length ? `Smart Detection: ${matches.length} suggestions` : 'Smart Detection: inspect clipboard'} onClick={() => { if (matches.length) { setMode('detect'); dialog.current?.showModal(); } else void readClipboard(); }}><Lightbulb size={19} aria-hidden="true" />{matches.length > 0 && <span>{matches.length}</span>}</button>
    <dialog ref={dialog} className="tool-launcher" onCancel={close} onClose={() => { revision.current++; setText(''); setMatches([]); }} aria-labelledby="launcher-title">
      <div className="launcher-heading"><h2 id="launcher-title">{mode === 'search' ? 'Find your next tool' : 'Smart Detection'}</h2><button className="button" onClick={close} type="button">Close</button></div>
      <div className="actions"><button className="button" type="button" onClick={() => setMode('search')}>Search tools</button><button className="button" type="button" onClick={() => setMode('detect')}>Detect content</button><Link href="/settings" onClick={close}>Detection settings</Link></div>
      {mode === 'search' ? <><label className="field-label" htmlFor="launcher-search">Search names, formats or tasks</label><input ref={search} id="launcher-search" type="search" value={query} autoComplete="off" onChange={event => { setQuery(event.target.value); setSelected(0); }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); } else if (event.key === 'Enter' && results[selected]) { close(); router.push(`/tools/${results[selected].slug}`); } }} aria-describedby="launcher-keyboard" /><p id="launcher-keyboard" className="muted">Arrow keys choose a result; Enter opens it. Tab reaches each link.</p><p className="sr-only" role="status">{results[selected]?.name}</p><ul className="launcher-results">{results.map((tool, index) => <li key={tool.slug}><Link className={selected === index ? 'selected' : ''} href={`/tools/${tool.slug}`} onClick={close}>{tool.name}<small>{tool.category}</small></Link></li>)}</ul>{!results.length && <p>No matching tools. Try a format such as JSON, CSV or PNG.</p>}</> : <><p>Inspect text locally. Suggestions fill a tool’s primary input, replacing existing text. Nothing runs automatically.</p><button type="button" className="button primary" onClick={() => void readClipboard()}>Paste from clipboard &amp; detect</button><label className="field-label" htmlFor="detection-text">Or paste text here</label><textarea id="detection-text" value={text} onChange={event => { setText(event.target.value); setMatches([]); }} maxLength={200001} /><button type="button" className="button" onClick={() => inspect(text)}>Detect pasted text</button><p role="status">{message}</p><ul className="launcher-results">{matches.map(match => <li key={match.slug}><button type="button" onClick={() => openTool(match.slug, text)}><Lightbulb size={17} aria-hidden="true" /><span>{getTool(match.slug)?.name}<small>{match.reason}</small></span><span>Open &amp; paste →</span></button></li>)}</ul></>}
    </dialog></>;
}
