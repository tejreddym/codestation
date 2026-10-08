"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getTextDefinition, type TextToolDefinition, type TextToolId } from "@/config/text-tools";
import type { TextResult, TextValues } from "@/lib/tools/text/types";
import styles from "./TextWorkspace.module.css";

const PAGE_SIZE = 50;
const diffLabels = { added: "+ Added", removed: "− Removed", unchanged: "= Unchanged" };

function Workspace({ definition }: { definition: TextToolDefinition }) {
  const contract = definition.textContract;
  const id = `text-${definition.slug}`;
  const [values, setValues] = useState<TextValues>(() => ({ ...contract.defaults }));
  const [result, setResult] = useState<TextResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const revision = useRef(0);
  const mounted = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useToolHandoff(definition.slug, text => change("text", text));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current += 1; pending.current?.abort(); };
  }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function invalidate() {
    revision.current += 1;
    pending.current?.abort();
    pending.current = null;
    setResult(null);
    setError("");
    setNotice("");
    setBusy(false);
    setPage(0);
  }

  function change(name: string, value: string | boolean) {
    invalidate();
    setValues(current => ({ ...current, [name]: value }));
  }

  function load(next: Readonly<TextValues>) {
    invalidate();
    setValues({ ...contract.defaults, ...next });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    const currentRevision = revision.current;
    const controller = new AbortController();
    pending.current = controller;
    const snapshot = { ...values };
    setBusy(true);
    try {
      const { runTextTool } = await import("@/lib/tools/text/client");
      if (!mounted.current || revision.current !== currentRevision || controller.signal.aborted) return;
      const next = await runTextTool(definition.slug, snapshot, controller.signal);
      if (!mounted.current || revision.current !== currentRevision || controller.signal.aborted) return;
      setResult(next);
      setNotice("Result ready.");
    } catch (cause) {
      if (mounted.current && revision.current === currentRevision && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Could not process this text. Check your inputs and try again.");
      }
    } finally {
      if (mounted.current && revision.current === currentRevision) {
        setBusy(false);
        pending.current = null;
      }
    }
  }

  async function copy(value: string, label: string) {
    const currentRevision = revision.current;
    setNotice("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      if (mounted.current && revision.current === currentRevision) setNotice(`${label} copied${value === "" ? " (empty value)" : ""}.`);
    } catch {
      if (mounted.current && revision.current === currentRevision) setNotice("Could not copy. Select the result and copy it manually.");
    }
  }

  const paired = definition.pairedTool ? getTextDefinition(definition.pairedTool) : undefined;
  const diff = result?.diff;
  const pages = Math.max(1, Math.ceil((diff?.length ?? 0) / PAGE_SIZE));

  return <div className={styles.station}>
    {paired && <nav className={styles.pair} aria-label="Text conversion direction">
      <span>{definition.inputFormat} → {definition.outputFormat}</span>
      <Link className={styles.link} href={`/tools/${paired.slug}`}>Switch to {paired.name} →</Link>
    </nav>}
    <div className={styles.layout}>
      <form className={styles.panel} onSubmit={event => void submit(event)} noValidate aria-labelledby={`${id}-input`} aria-describedby={error ? `${id}-error` : undefined}>
        <div className={styles.panelHead}><h2 id={`${id}-input`}>{definition.name} input</h2><button type="button" className={styles.button} onClick={() => load(contract.example)}>Load example</button></div>
        <div className={styles.fields}>
          {contract.fields.map(field => {
            const fieldId = `${id}-${field.name}`;
            const describedBy = [field.hint ? `${fieldId}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
            if (field.control === "checkbox-group") return <fieldset className={styles.fieldset} id={fieldId} key={field.name} aria-describedby={describedBy}>
              <legend>{field.label}</legend>
              <div className={styles.flags}>{field.options?.map(flag => <label className={styles.checkbox} key={flag} htmlFor={`${fieldId}-${flag}`}>
                <input type="checkbox" id={`${fieldId}-${flag}`} name={field.name} value={flag} checked={String(values[field.name] ?? "").includes(flag)} aria-describedby={describedBy} aria-invalid={error ? true : undefined} onChange={event => {
                  const selected = new Set(String(values[field.name] ?? ""));
                  if (event.target.checked) selected.add(flag); else selected.delete(flag);
                  change(field.name, (field.options ?? []).filter(option => selected.has(option)).join(""));
                }} /><span>{flag}</span>
              </label>)}</div>
              {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
            </fieldset>;
            if (field.control === "checkbox") return <div className={styles.field} key={field.name}>
              <label className={styles.checkbox} htmlFor={fieldId}><input type="checkbox" id={fieldId} name={field.name} checked={values[field.name] === true} aria-describedby={describedBy} aria-invalid={error ? true : undefined} onChange={event => change(field.name, event.target.checked)} /><span>{field.label}</span></label>
              {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
            </div>;
            const shared = { id: fieldId, name: field.name, className: styles.input, value: String(values[field.name] ?? ""), "aria-describedby": describedBy, "aria-invalid": error ? true as const : undefined };
            return <div className={styles.field} key={field.name}>
              <label htmlFor={fieldId}>{field.label}</label>
              {field.control === "textarea" ? <textarea {...shared} rows={7} placeholder={String(contract.example[field.name] ?? "")} autoComplete="off" spellCheck={false} onChange={event => change(field.name, event.target.value)} />
                : field.control === "select" ? <select {...shared} onChange={event => change(field.name, event.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
                  : <input {...shared} type={field.control} min={field.min} max={field.max} step={field.control === "number" ? 1 : undefined} autoComplete="off" spellCheck={false} onChange={event => change(field.name, event.target.value)} />}
              {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
            </div>;
          })}
        </div>
        <div className={styles.actions}><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? "Processing…" : contract.action}</button><button type="button" className={styles.button} onClick={() => load(contract.defaults)}>Clear</button></div>
        <div className={styles.notes}>{contract.notices.map(text => <p key={text}>{text}</p>)}</div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-result`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-result`}>{contract.outputLabel}</h2></div>
        {result ? <dl className={styles.results}>{result.rows.map((row, index) => <div className={styles.result} key={`${index}-${row.label}`}>
          <dt className={styles.rowHead}><span>{row.label}</span>{!(index === 0 && diff && diff.length > 0) && <button type="button" className={styles.button} aria-label={`Copy ${row.label}`} onClick={() => void copy(row.value, row.label)}>Copy</button>}</dt>
          <dd>{index === 0 && diff && diff.length > 0 ? <div className={styles.diff} aria-label={`${row.label} value`}>
            <p className={styles.hint}>Each card shows original content with an explicit change label. Copy copies that card’s exact text, including its original line ending.</p>
            <p className={styles.hint}>{diff.length} total diff rows. Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, diff.length)}.</p>
            {diff.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item, offset) => {
              const position = page * PAGE_SIZE + offset + 1;
              const label = `${diffLabels[item.kind]} · row ${position}`;
              const ending = /\r\n$/.test(item.text) ? "CRLF" : /\n$/.test(item.text) ? "LF" : /\r$/.test(item.text) ? "CR" : "No line ending";
              return <div className={styles.diffCard} key={position}>
                <div className={styles.rowHead}><span>{label}</span><button type="button" className={styles.button} aria-label={`Copy ${label}`} onClick={() => void copy(item.text, label)}>Copy</button></div>
                <pre className={styles.output} tabIndex={0} aria-label={`${label} value`}>{item.text}</pre><p className={styles.hint}>{ending}</p>
              </div>;
            })}
            {pages > 1 && <nav className={styles.pagination} aria-label="Diff result pages"><button type="button" className={styles.button} disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><span role="status">Page {page + 1} of {pages}</span><button type="button" className={styles.button} disabled={page + 1 === pages} onClick={() => setPage(current => current + 1)}>Next</button></nav>}
          </div> : <pre className={styles.output} tabIndex={0} aria-label={`${row.label} value`}>{row.value}</pre>}
          {row.value === "" && <p className={styles.hint}>Empty value — Copy copies exactly zero characters.</p>}</dd>
        </div>)}</dl> : <p className={styles.empty}>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
    <p className={styles.status} role="status" aria-atomic="true">{notice}</p>
    <p className={styles.privacy}>{contract.privacyMessage}</p>
  </div>;
}

export default function TextWorkspace({ toolId }: { toolId: TextToolId }) {
  const definition = getTextDefinition(toolId);
  return definition ? <Workspace key={definition.slug} definition={definition} /> : null;
}
