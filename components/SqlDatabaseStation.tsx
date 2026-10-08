"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { getSqlDefinition, type SqlToolDefinition, type SqlToolId } from "@/config/sql-tools";
import type { SqlResult, SqlValues } from "@/lib/tools/sql/types";
import SqlStructuredFields from "./SqlStructuredFields";
import SqlErDiagram from "./SqlErDiagram";
import styles from "./SqlDatabaseStation.module.css";

function clone(values: Readonly<SqlValues>): SqlValues {
  return JSON.parse(JSON.stringify(values)) as SqlValues;
}

function Station({ definition }: { definition: SqlToolDefinition }) {
  const { sqlContract: contract } = definition;
  const id = `sql-${definition.slug}`;
  const credentialTool = definition.id === "database-connection-string-builder" || definition.id === "database-connection-string-parser";
  const [values, setValues] = useState<SqlValues>(() => clone(contract.defaults));
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const validatorInvalid = definition.id === "sql-validator" && result?.rows[0]?.value === "Invalid";
  const revision = useRef(0);
  const mounted = useRef(false);
  const active = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current += 1;
      active.current?.abort();
      active.current = null;
    };
  }, []);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function invalidate() {
    revision.current += 1;
    active.current?.abort();
    active.current = null;
    setResult(null);
    setError("");
    setNotice("");
    setBusy(false);
  }

  function change(name: string, value: unknown, action?: { removedIndex?: number }) {
    invalidate();
    setValues(current => {
      if (name === "columns" && Array.isArray(value) && Array.isArray(current.columns) && Array.isArray(current.rows)) {
        const previousWidth = current.columns.length;
        const rows = current.rows.map(row => {
          if (!Array.isArray(row) || row.length !== previousWidth) return row;
          if (action?.removedIndex !== undefined) return row.filter((_, index) => index !== action.removedIndex);
          if (value.length > previousWidth) return [...row, ...Array.from({ length: value.length - previousWidth }, () => ({ type: "String", value: "" }))];
          return row;
        });
        return { ...current, [name]: value, rows };
      }
      return { ...current, [name]: value };
    });
  }

  function load(next: Readonly<SqlValues>) {
    invalidate();
    setValues(clone({ ...contract.defaults, ...next }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    const currentRevision = revision.current;
    const controller = new AbortController();
    active.current = controller;
    const snapshot = clone(values);
    setBusy(true);
    try {
      const { runSqlTool } = await import("@/lib/tools/sql/client");
      if (!mounted.current || revision.current !== currentRevision || controller.signal.aborted) return;
      const next = await runSqlTool(definition.id, snapshot, controller.signal);
      if (!mounted.current || revision.current !== currentRevision || controller.signal.aborted) return;
      setResult(next);
      setNotice(definition.id === "sql-validator" ? `Syntax status: ${next.rows[0]?.value}.` : "Result ready.");
    } catch (cause) {
      if (mounted.current && revision.current === currentRevision && !controller.signal.aborted) {
        // Connection-parser/library errors can contain their source. Never echo credentials.
        setError(credentialTool
          ? "Could not process the connection details. Check the supported format, required fields, port and parameters."
          : cause instanceof Error ? cause.message : "Could not process a result. Check your inputs.");
      }
    } finally {
      if (mounted.current && revision.current === currentRevision) {
        active.current = null;
        setBusy(false);
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

  function downloadCsv(value: string) {
    let url: string | undefined;
    try {
      const blob = new Blob([value], { type: "text/csv;charset=utf-8" });
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sql-inserts.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setNotice("CSV download requested.");
    } catch {
      setNotice("Could not download CSV. Copy the CSV result to a local file instead.");
    } finally {
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      }
    }
  }

  const columnNames = Array.isArray(values.columns) ? values.columns.filter((value): value is string => typeof value === "string") : [];

  return <div className={styles.station}>
    <div className={styles.layout}>
      <form className={styles.panel} onSubmit={event => void submit(event)} noValidate autoComplete="off" aria-labelledby={`${id}-input`} aria-describedby={error ? `${id}-error` : undefined}>
        <div className={styles.panelHead}>
          <h2 id={`${id}-input`}>{definition.name} input</h2>
          <button type="button" className="button" onClick={() => load(contract.example)}>Load example</button>
        </div>
        <div className={styles.fields}>
          {contract.fields.map(field => {
            const fieldId = `${id}-${field.name}`;
            const describedBy = [field.hint ? `${fieldId}-hint` : "", error ? `${id}-error` : "", validatorInvalid && field.name === "sql" ? `${id}-row-1 ${id}-row-2` : ""].filter(Boolean).join(" ") || undefined;
            if (field.control === "columns" || field.control === "rows" || field.control === "assignments" || field.control === "conditions" || field.control === "order") {
              return <div className={styles.field} key={field.name}>
                <SqlStructuredFields kind={field.control} id={fieldId} label={field.label} value={values[field.name]} onChange={(value, action) => change(field.name, value, action)} columns={field.control === "rows" ? columnNames : undefined} describedBy={describedBy} invalid={!!error} />
                {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
              </div>;
            }
            const disabled = definition.id === "sql-escape-helper" && field.name === "value" && values.valueType === "NULL";
            const shared = {
              id: fieldId, name: field.name, className: styles.input,
              value: typeof values[field.name] === "string" ? values[field.name] as string : "",
              required: !field.optional && !disabled,
              disabled, "aria-describedby": describedBy, "aria-invalid": error || validatorInvalid && field.name === "sql" ? true as const : undefined,
              onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(field.name, event.target.value),
            };
            return <div className={styles.field} key={field.name}>
              <label htmlFor={fieldId}>{field.label}{field.optional && <span className={styles.optional}> (optional)</span>}</label>
              {field.control === "select" ? <select {...shared}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
                : field.control === "textarea" ? <textarea {...shared} className={`${styles.input} ${styles.textarea}`} rows={field.name === "parameters" ? 4 : 9} wrap="off" placeholder={field.placeholder} autoComplete="off" spellCheck={false} autoCapitalize="off" />
                  : <input {...shared} type={field.control === "password" ? "password" : "text"} inputMode={field.inputMode} placeholder={field.placeholder} autoComplete="off" spellCheck={false} autoCapitalize="off" />}
              {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
            </div>;
          })}
          {contract.notices.map(text => <p className={styles.note} key={text}>{text}</p>)}
        </div>
        <div className={styles.actions}>
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Processing…" : contract.action}</button>
          <button type="button" className="button" onClick={() => load(contract.defaults)}>Clear</button>
        </div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-result`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-result`}>{contract.outputLabel}</h2></div>
        {result ? <div className={styles.result}>
          {!!result.warnings?.length && <div className={styles.warning} role="alert">
            <strong>Review before use</strong>
            {result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
          </div>}
          {result.schema && <div className={styles.diagram}><h3>Entity relationship diagram</h3><SqlErDiagram schema={result.schema} /></div>}
          <dl className={styles.resultList}>{result.rows.map((row, index) => {
            const value = definition.id === "database-connection-string-parser" && /password/i.test(row.label) ? "••••••••" : row.value;
            return <div key={`${row.label}-${index}`}>
              <dt className={styles.rowHead}>
                <span>{row.label}</span>
                <div className={styles.resultActions}>
                  {contract.copy && <button type="button" className="button" aria-label={`Copy ${row.label}`} onClick={() => void copy(value, row.label)}>Copy</button>}
                  {contract.downloadExtension === "csv" && row.label === "CSV text" && <button type="button" className="button" onClick={() => downloadCsv(value)}>Download CSV</button>}
                </div>
              </dt>
              <dd><pre id={`${id}-row-${index}`} className={styles.output} tabIndex={0} aria-label={`${row.label} value`}>{value}</pre>{value === "" && <p className={styles.hint}>Empty value{contract.copy ? " — Copy copies exactly zero characters." : "."}</p>}</dd>
            </div>;
          })}</dl>
        </div> : <p className={styles.empty}>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
    <p className={styles.status} role="status" aria-atomic="true">{notice}</p>
    <p className={styles.privacy}>{contract.privacyMessage}</p>
  </div>;
}

export default function SqlDatabaseStation({ toolId }: { toolId: SqlToolId }) {
  const definition = getSqlDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
