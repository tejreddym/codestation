"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { getSqlDefinition, type SqlToolDefinition, type SqlToolId } from "@/config/sql-tools";
import type { SqlResult, SqlValues } from "@/lib/tools/sql/types";
import SqlStructuredFields from "./SqlStructuredFields";
import SqlErDiagram from "./SqlErDiagram";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Select, Textarea, TextInput } from "./ui/controls";
import { EmptyState } from "./ui/EmptyState";
import { Field, Hint } from "./ui/Field";
import { OutputText } from "./ui/OutputPanel";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
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
  const { copy: copyText } = useCopy();
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
    const ok = await copyText(value);
    if (!mounted.current || revision.current !== currentRevision) return;
    setNotice(
      ok
        ? `${label} copied${value === "" ? " (empty value)" : ""}.`
        : "Could not copy. Select the result and copy it manually."
    );
  }

  function downloadCsv(value: string) {
    try {
      downloadBlob(value, "sql-inserts.csv", "text/csv;charset=utf-8");
      setNotice("CSV download requested.");
    } catch {
      setNotice("Could not download CSV. Copy the CSV result to a local file instead.");
    }
  }

  const columnNames = Array.isArray(values.columns) ? values.columns.filter((value): value is string => typeof value === "string") : [];

  return <div className={styles.station}>
    <ToolLayout kind="form" className={styles.layout}>
      <Panel title={`${definition.name} input`} headingId={`${id}-input`} padded>
        <form className={styles.form} onSubmit={event => void submit(event)} noValidate autoComplete="off" aria-labelledby={`${id}-input`} aria-describedby={error ? `${id}-error` : undefined}>
          <div className={styles.fields}>
            {contract.fields.map(field => {
              const fieldId = `${id}-${field.name}`;
              const describedBy = [field.hint ? `${fieldId}-hint` : "", error ? `${id}-error` : "", validatorInvalid && field.name === "sql" ? `${id}-row-1 ${id}-row-2` : ""].filter(Boolean).join(" ") || undefined;
              if (field.control === "columns" || field.control === "rows" || field.control === "assignments" || field.control === "conditions" || field.control === "order") {
                return <div className={styles.full} key={field.name}>
                  <SqlStructuredFields kind={field.control} id={fieldId} label={field.label} value={values[field.name]} onChange={(value, action) => change(field.name, value, action)} columns={field.control === "rows" ? columnNames : undefined} describedBy={describedBy} invalid={!!error} />
                  {field.hint && <Hint id={`${fieldId}-hint`}>{field.hint}</Hint>}
                </div>;
              }
              const disabled = definition.id === "sql-escape-helper" && field.name === "value" && values.valueType === "NULL";
              const common = {
                id: fieldId, name: field.name,
                value: typeof values[field.name] === "string" ? values[field.name] as string : "",
                required: !field.optional && !disabled,
                disabled, "aria-describedby": describedBy, "aria-invalid": error || validatorInvalid && field.name === "sql" ? true as const : undefined,
                onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(field.name, event.target.value),
                placeholder: field.placeholder, autoComplete: "off", spellCheck: false, autoCapitalize: "off" as const,
              };
              return <Field key={field.name} id={fieldId} label={<>{field.label}{field.optional && <span className={styles.optional}> (optional)</span>}</>} hint={field.hint}>
                {field.control === "select" ? <Select {...common}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</Select>
                  : field.control === "textarea" ? <Textarea {...common} rows={field.name === "parameters" ? 4 : 9} wrap="off" className={`${ui.control} ${ui.textarea} ${ui.mono}`} />
                    : <TextInput {...common} type={field.control === "password" ? "password" : "text"} inputMode={field.inputMode} />}
              </Field>;
            })}
            {contract.notices.map(text => <Hint className={styles.note} key={text}>{text}</Hint>)}
          </div>
          <div className={ui.actions}>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Processing…" : contract.action}</Button>
            <Button onClick={() => load(contract.example)}>Load example</Button>
            <Button onClick={() => load(contract.defaults)}>Clear</Button>
          </div>
        </form>
      </Panel>
      <Panel title={contract.outputLabel} headingId={`${id}-result`} aria-busy={busy || undefined} padded>
        {result ? <div className={styles.result}>
          {!!result.warnings?.length && <div className={styles.warning} role="alert">
            <strong>Review before use</strong>
            {result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
          </div>}
          {result.schema && <div className={styles.diagram}><h3 className={styles.sectionTitle}>Entity relationship diagram</h3><SqlErDiagram schema={result.schema} /></div>}
          <dl className={styles.resultList}>{result.rows.map((row, index) => {
            const value = definition.id === "database-connection-string-parser" && /password/i.test(row.label) ? "••••••••" : row.value;
            return <div key={`${row.label}-${index}`}>
              <dt className={styles.rowHead}>
                <span>{row.label}</span>
                <div className={styles.resultActions}>
                  {contract.copy && <Button size="sm" aria-label={`Copy ${row.label}`} onClick={() => void copy(value, row.label)}>Copy</Button>}
                  {contract.downloadExtension === "csv" && row.label === "CSV text" && <Button size="sm" onClick={() => downloadCsv(value)}>Download CSV</Button>}
                </div>
              </dt>
              <dd id={`${id}-row-${index}`} className={styles.rowBody}>
                <OutputText label={row.label} value={value} className={styles.rowOutput} />
                {value === "" && <Hint>{contract.copy ? "Empty value — Copy copies exactly zero characters." : "Empty value."}</Hint>}
              </dd>
            </div>;
          })}</dl>
        </div> : <EmptyState>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</EmptyState>}
      </Panel>
    </ToolLayout>
    {error && <Callout kind="error" ref={errorRef} id={`${id}-error`} className={styles.alert} tabIndex={-1}>{error}</Callout>}
    <StatusLine className={styles.status}>{notice}</StatusLine>
    <PrivacyNote className={styles.privacy}>{contract.privacyMessage}</PrivacyNote>
  </div>;
}

export default function SqlDatabaseStation({ toolId }: { toolId: SqlToolId }) {
  const definition = getSqlDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
