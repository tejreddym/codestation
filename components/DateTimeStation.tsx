"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { dateTimeWeekdays, getDateTimeDefinition, type DateTimeToolDefinition, type DateTimeToolId } from "@/config/date-time-tools";
import type { DateTimeResult, DateTimeValues } from "@/lib/tools/date-time/types";
import styles from "./DateTimeStation.module.css";

const COMMON_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"];

function Station({ definition }: { definition: DateTimeToolDefinition }) {
  const { dateTimeContract: contract } = definition;
  const id = `date-time-${definition.slug}`;
  const [values, setValues] = useState<DateTimeValues>(() => ({ ...contract.defaults }));
  const [result, setResult] = useState<DateTimeResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [zones, setZones] = useState(COMMON_ZONES);
  const revision = useRef(0);
  const mounted = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    mounted.current = true;
    try {
      const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf?.("timeZone") ?? [];
      setZones([...new Set([...COMMON_ZONES, ...supported])].sort());
    } catch { /* Keep usable common suggestions when enumeration is unavailable. */ }
    return () => { mounted.current = false; revision.current += 1; };
  }, []);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function invalidate() {
    revision.current += 1;
    setResult(null);
    setError("");
    setNotice("");
    setBusy(false);
  }

  function change(name: string, value: string) {
    invalidate();
    setValues(current => ({ ...current, [name]: value }));
  }

  function load(next: Readonly<DateTimeValues>) {
    invalidate();
    setValues({ ...contract.defaults, ...next });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    const currentRevision = revision.current;
    const snapshot = { ...values };
    setBusy(true);
    try {
      const missing = contract.fields.find(field => !field.optional && (!field.when || snapshot[field.when.field] === field.when.value) && !snapshot[field.name]?.trim());
      if (missing) throw new Error(`${missing.label} is required.`);
      const { runDateTime } = await import("@/lib/tools/date-time/engine");
      if (!mounted.current || revision.current !== currentRevision) return;
      const next = runDateTime(definition.slug, snapshot);
      if (!mounted.current || revision.current !== currentRevision) return;
      setResult(next);
      setNotice("Result ready.");
    } catch (cause) {
      if (mounted.current && revision.current === currentRevision) setError(cause instanceof Error ? cause.message : "Could not calculate a result. Check your inputs.");
    } finally {
      if (mounted.current && revision.current === currentRevision) setBusy(false);
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

  const paired = "pairedTool" in definition ? getDateTimeDefinition(definition.pairedTool) : undefined;

  return <div className={styles.station}>
    {paired && "inputFormat" in definition && <nav className={styles.pair} aria-label="Date and timestamp conversion direction">
      <span>{definition.inputFormat} → {definition.outputFormat}</span>
      <Link className={styles.related} href={`/tools/${paired.slug}`}>Switch to {paired.name} →</Link>
    </nav>}
    <div className={styles.layout}>
      <form className={styles.panel} onSubmit={event => void submit(event)} noValidate aria-labelledby={`${id}-input`} aria-describedby={error ? `${id}-error` : undefined}>
        <div className={styles.panelHead}><h2 id={`${id}-input`}>{definition.name} input</h2><button type="button" className="button" onClick={() => load(contract.example)}>Load example</button></div>
        <div className={styles.fields}>
          {contract.fields.filter(field => !field.when || values[field.when.field] === field.when.value).map(field => {
            const fieldId = `${id}-${field.name}`;
            const describedBy = [field.hint ? `${fieldId}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
            if (field.control === "checkbox-group") return <fieldset id={fieldId} className={styles.fieldset} key={field.name} aria-describedby={describedBy}>
              <legend>{field.label}</legend>
              {(field.options ?? []).map(day => <label className={styles.checkbox} key={day} htmlFor={`${fieldId}-${day}`}>
                <input id={`${fieldId}-${day}`} name={field.name} type="checkbox" value={day} checked={(values[field.name] ?? "").split(",").includes(day)} aria-describedby={describedBy} aria-invalid={error ? true : undefined} onChange={event => {
                  const selected = new Set((values[field.name] ?? "").split(",").filter(Boolean));
                  if (event.target.checked) selected.add(day); else selected.delete(day);
                  change(field.name, dateTimeWeekdays.filter(weekday => selected.has(weekday)).join(","));
                }} /><span>{day}</span>
              </label>)}
              {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
            </fieldset>;
            const shared = { id: fieldId, name: field.name, className: styles.input, value: values[field.name] ?? "", required: !field.optional, "aria-describedby": describedBy, "aria-invalid": error ? true as const : undefined };
            return <div className={styles.field} key={field.name}>
              <label htmlFor={fieldId}>{field.label}</label>
              {field.control === "select" ? <select {...shared} onChange={event => change(field.name, event.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
                : field.control === "textarea" ? <textarea {...shared} rows={3} placeholder={field.placeholder} onChange={event => change(field.name, event.target.value)} autoComplete="off" spellCheck={false} />
                  : <input {...shared} type={field.control === "date" || field.control === "time" ? field.control : "text"} min={field.control === "date" ? "0001-01-01" : undefined} max={field.control === "date" ? "9999-12-31" : undefined} step={field.control === "time" ? "0.001" : undefined} list={field.control === "timezone" ? `${fieldId}-zones` : undefined} placeholder={field.placeholder} inputMode={field.name === "year" ? "numeric" : undefined} onChange={event => change(field.name, event.target.value)} autoComplete="off" spellCheck={false} />}
              {field.control === "timezone" && <datalist id={`${fieldId}-zones`}>{zones.map(timezone => <option value={timezone} key={timezone} />)}</datalist>}
              {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
            </div>;
          })}
          {contract.notices.map(text => <p className={styles.note} key={text}>{text}</p>)}
        </div>
        <div className={styles.actions}><button type="submit" className="button primary" disabled={busy}>{busy ? "Calculating…" : contract.action}</button><button type="button" className="button" onClick={() => load(contract.defaults)}>Clear</button></div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-result`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-result`}>{contract.outputLabel}</h2></div>
        {result ? <div className={styles.result}><dl className={styles.resultList}>{result.rows.map((row, index) => <div key={`${row.label}-${index}`}>
          <dt className={styles.rowHead}><span>{row.label}</span><button type="button" className="button" aria-label={`Copy ${row.label}`} onClick={() => void copy(row.value, row.label)}>Copy</button></dt>
          <dd><pre className={styles.output} tabIndex={0} aria-label={`${row.label} value`}>{row.value}</pre>{row.value === "" && <p className={styles.hint}>Empty value — Copy copies exactly zero characters.</p>}</dd>
        </div>)}</dl></div> : <p className={styles.empty}>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
    <p className={styles.status} role="status" aria-atomic="true">{notice}</p>
    <p className={styles.privacy}>{contract.privacyMessage}</p>
  </div>;
}

export default function DateTimeStation({ toolId }: { toolId: DateTimeToolId }) {
  const definition = getDateTimeDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
