"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getTextDefinition, type TextToolDefinition, type TextToolId } from "@/config/text-tools";
import type { TextResult, TextValues } from "@/lib/tools/text/types";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Checkbox, CheckboxGroup, Select, Textarea, TextInput } from "./ui/controls";
import { EmptyState } from "./ui/EmptyState";
import { Field, Hint } from "./ui/Field";
import { OutputText } from "./ui/OutputPanel";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { useCopy } from "./ui/useCopy";
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
  const { copy: copyText } = useCopy();
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
    const ok = await copyText(value);
    if (!mounted.current || revision.current !== currentRevision) return;
    setNotice(
      ok
        ? `${label} copied${value === "" ? " (empty value)" : ""}.`
        : "Could not copy. Select the result and copy it manually."
    );
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
      <Panel headingId={`${id}-input`} title={`${definition.name} input`} padded actions={<Button size="sm" onClick={() => load(contract.example)}>Load example</Button>}>
        <form onSubmit={event => void submit(event)} noValidate aria-describedby={error ? `${id}-error` : undefined}>
          <div className={styles.fields}>
            {contract.fields.map(field => {
              const fieldId = `${id}-${field.name}`;
              const describedBy = [field.hint ? `${fieldId}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
              if (field.control === "checkbox-group") return <CheckboxGroup
                key={field.name}
                id={fieldId}
                legend={field.label}
                name={field.name}
                describedBy={describedBy}
                invalid={Boolean(error)}
                hint={field.hint}
                hintId={`${fieldId}-hint`}
                options={(field.options ?? []).map(flag => ({ value: flag, label: flag, checked: String(values[field.name] ?? "").includes(flag) }))}
                onChange={event => {
                  const selected = new Set(String(values[field.name] ?? ""));
                  if (event.target.checked) selected.add(event.target.value); else selected.delete(event.target.value);
                  change(field.name, (field.options ?? []).filter(option => selected.has(option)).join(""));
                }}
              />;
              if (field.control === "checkbox") return <div className={styles.field} key={field.name}>
                <Checkbox
                  id={fieldId}
                  name={field.name}
                  label={field.label}
                  checked={values[field.name] === true}
                  aria-describedby={describedBy}
                  aria-invalid={error ? true : undefined}
                  onChange={event => change(field.name, event.target.checked)}
                />
                {field.hint && <Hint id={`${fieldId}-hint`}>{field.hint}</Hint>}
              </div>;
              const shared = { id: fieldId, name: field.name, value: String(values[field.name] ?? ""), "aria-describedby": describedBy, "aria-invalid": error ? true as const : undefined };
              return <Field key={field.name} id={fieldId} label={field.label} hint={field.hint}>
                {field.control === "textarea" ? <Textarea {...shared} rows={7} placeholder={String(contract.example[field.name] ?? "")} autoComplete="off" spellCheck={false} onChange={event => change(field.name, event.target.value)} />
                  : field.control === "select" ? <Select {...shared} onChange={event => change(field.name, event.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</Select>
                    : <TextInput {...shared} type={field.control} min={field.min} max={field.max} step={field.control === "number" ? 1 : undefined} autoComplete="off" spellCheck={false} onChange={event => change(field.name, event.target.value)} />}
              </Field>;
            })}
          </div>
          <div className={styles.actions}><Button type="submit" variant="primary" disabled={busy}>{busy ? "Processing…" : contract.action}</Button><Button onClick={() => load(contract.defaults)}>Clear</Button></div>
          <div className={styles.notes}>{contract.notices.map(text => <p key={text}>{text}</p>)}</div>
        </form>
      </Panel>
      <Panel headingId={`${id}-result`} title={contract.outputLabel} aria-busy={busy || undefined} padded>
        {result ? <dl className={styles.results}>{result.rows.map((row, index) => <div className={styles.result} key={`${index}-${row.label}`}>
          <dt className={styles.rowHead}><span>{row.label}</span>{!(index === 0 && diff && diff.length > 0) && <Button size="sm" aria-label={`Copy ${row.label}`} onClick={() => void copy(row.value, row.label)}>Copy</Button>}</dt>
          <dd>{index === 0 && diff && diff.length > 0 ? <div className={styles.diff} aria-label={`${row.label} value`}>
            <Hint>Each card shows original content with an explicit change label. Copy copies that card’s exact text, including its original line ending.</Hint>
            <Hint>{diff.length} total diff rows. Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, diff.length)}.</Hint>
            {diff.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item, offset) => {
              const position = page * PAGE_SIZE + offset + 1;
              const label = `${diffLabels[item.kind]} · row ${position}`;
              const ending = /\r\n$/.test(item.text) ? "CRLF" : /\n$/.test(item.text) ? "LF" : /\r$/.test(item.text) ? "CR" : "No line ending";
              return <div className={styles.diffCard} key={position}>
                <div className={styles.rowHead}><span>{label}</span><Button size="sm" aria-label={`Copy ${label}`} onClick={() => void copy(item.text, label)}>Copy</Button></div>
                <OutputText label={label} value={item.text} /><Hint>{ending}</Hint>
              </div>;
            })}
            {pages > 1 && <nav className={styles.pagination} aria-label="Diff result pages"><Button size="sm" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</Button><span role="status">Page {page + 1} of {pages}</span><Button size="sm" disabled={page + 1 === pages} onClick={() => setPage(current => current + 1)}>Next</Button></nav>}
          </div> : <OutputText label={row.label} value={row.value} />}
          {row.value === "" && <Hint>Empty value — Copy copies exactly zero characters.</Hint>}</dd>
        </div>)}</dl> : <EmptyState>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</EmptyState>}
      </Panel>
    </div>
    {error && <Callout ref={errorRef} kind="error" id={`${id}-error`} tabIndex={-1}>{error}</Callout>}
    <StatusLine>{notice}</StatusLine>
    <PrivacyNote>{contract.privacyMessage}</PrivacyNote>
  </div>;
}

export default function TextWorkspace({ toolId }: { toolId: TextToolId }) {
  const definition = getTextDefinition(toolId);
  return definition ? <Workspace key={definition.slug} definition={definition} /> : null;
}
