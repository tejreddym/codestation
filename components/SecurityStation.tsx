"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSecurityDefinition, getSecurityNotices, type SecurityDefinition, type SecurityInputField, type SecurityToolId } from "@/config/security-tools";
import type { SecurityRequest, SecurityResult, SecurityValues } from "@/lib/tools/security/types";
import styles from "./SecurityStation.module.css";

type InputError = { message: string; fields: string[] };

function Station({ definition }: { definition: SecurityDefinition }) {
  const contract = definition.securityContract;
  const scope = `security-${definition.slug}`;
  const [values, setValues] = useState<SecurityValues>(() => ({ ...contract.defaults }));
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [error, setError] = useState<InputError | null>(null);
  const [notice, setNotice] = useState("");
  const [copyError, setCopyError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const revision = useRef(0);
  const processing = useRef<AbortController | null>(null);
  const notices = getSecurityNotices(definition, values);
  const algorithm = typeof values.algorithm === "string" ? values.algorithm : undefined;

  useToolHandoff(definition.slug, text => edit("input", text));

  useEffect(() => {
    const element = fileInput.current;
    return () => {
      revision.current += 1;
      processing.current?.abort();
      processing.current = null;
      if (element) element.value = "";
    };
  }, []);

  useEffect(() => {
    if (error) document.getElementById(`${scope}-${error.fields[0] ?? "submit"}`)?.focus();
  }, [error, scope]);

  function releaseFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function invalidate() {
    revision.current += 1;
    if (processing.current) releaseFile();
    processing.current?.abort();
    processing.current = null;
    setBusy(false);
    setResult(null);
    setError(null);
    setNotice("");
    setCopyError("");
  }

  function edit(name: string, value: string | boolean) {
    invalidate();
    setValues(current => ({ ...current, [name]: value }));
  }

  function clear() {
    invalidate();
    releaseFile();
    setValues({ ...contract.defaults });
  }

  function example() {
    if (!contract.example) return;
    invalidate();
    releaseFile();
    setValues({ ...contract.defaults, ...contract.example });
    setNotice("Public example loaded. Run the tool to see its result.");
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processing.current) return;
    const request: SecurityRequest = { values: { ...values }, ...(file ? { file } : {}) };
    invalidate();
    const currentRevision = revision.current;
    const controller = new AbortController();
    processing.current = controller;
    // The request alone owns the selected File during processing. The control and
    // component state release it immediately, including on cancellation/failure.
    releaseFile();
    setBusy(true);
    setNotice("Processing locally…");
    try {
      const { runSecurityTool } = await import("@/lib/tools/security/client");
      if (currentRevision !== revision.current || controller.signal.aborted) return;
      const next = await runSecurityTool(definition.slug, request, controller.signal);
      if (currentRevision !== revision.current || controller.signal.aborted) return;
      setResult(next);
      setNotice(definition.id === "file-hash-generator" ? "Result ready. File selection released; reselect a file to run again." : "Result ready.");
    } catch (cause) {
      if (currentRevision !== revision.current || controller.signal.aborted) return;
      const field = cause && typeof cause === "object" && "field" in cause && typeof cause.field === "string" ? cause.field : undefined;
      const fields = field && contract.fields.some(item => item.name === field) ? [field] : contract.fields.map(item => item.name);
      setError({ message: cause instanceof Error ? cause.message : "Could not process the input. Check the fields and try again.", fields });
      setNotice("");
    } finally {
      delete request.file;
      if (currentRevision === revision.current) {
        processing.current = null;
        setBusy(false);
        releaseFile();
      }
    }
  }

  async function copy(value: string, label: string) {
    const currentRevision = revision.current;
    setNotice("");
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      if (currentRevision === revision.current) setNotice(`${label} copied.`);
    } catch {
      if (currentRevision === revision.current) setCopyError("Could not copy. Select the result and copy it manually.");
    }
  }

  function fieldControl(field: SecurityInputField) {
    const id = `${scope}-${field.name}`;
    const invalid = Boolean(error?.fields.includes(field.name));
    const describedBy = [field.hint ? `${id}-hint` : "", invalid ? `${scope}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = { id, name: field.name, "aria-invalid": invalid, "aria-describedby": describedBy };
    const editable = {
      ...common, value: String(values[field.name] ?? ""),
      onChange: (event: { target: { value: string } }) => edit(field.name, event.target.value),
      className: styles.control,
    };
    let control;
    if (field.control === "checkbox") {
      control = <label className={styles.checkboxLabel} htmlFor={id}><input {...common} type="checkbox" checked={values[field.name] === true} onChange={event => edit(field.name, event.target.checked)} />{field.label}</label>;
    } else if (field.control === "select") {
      control = <select {...editable}>{field.options?.map(option => <option key={option} value={option}>{field.name === "version" ? `UUID v${option}` : field.name === "keySize" ? `${option} bits` : option}</option>)}</select>;
    } else if (field.control === "file") {
      control = <input {...common} ref={fileInput} className={styles.control} type="file" disabled={busy} onChange={event => {
        const selected = event.currentTarget.files?.[0] ?? null;
        invalidate();
        setFile(selected);
      }} />;
    } else if (field.control === "textarea") {
      control = <textarea {...editable} className={`${styles.control} ${styles.editor}`} placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />;
    } else {
      control = <input {...editable} type={field.control} min={field.min} max={field.max} step={field.control === "number" ? 1 : undefined} placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />;
    }
    return <div className={styles.field} key={field.name}>
      {field.control !== "checkbox" && <label htmlFor={id}>{field.label}</label>}
      {control}
      {field.hint && <p className={styles.hint} id={`${id}-hint`}>{field.hint}</p>}
    </div>;
  }

  return <div className={styles.station}>
    <div className={styles.layout}>
      <form className={styles.panel} onSubmit={run} noValidate aria-labelledby={`${scope}-input-heading`} autoComplete="off">
        <div className={styles.panelHead}><h2 id={`${scope}-input-heading`}>{contract.fields.length ? "Inputs" : "Generate"}</h2>{algorithm && <span className={styles.algorithm}>Algorithm: {algorithm}</span>}</div>
        <div className={styles.fields}>{contract.fields.length ? contract.fields.map(fieldControl) : <p className={styles.hint}>No input needed. Generate one ULID locally.</p>}</div>
        {error && <p className={styles.error} id={`${scope}-error`} role="alert">{error.message}</p>}
        <div className={styles.actions}>
          <button id={`${scope}-submit`} className={`${styles.button} ${styles.primary}`} type="submit" disabled={busy} aria-busy={busy}>{busy ? "Processing…" : contract.action}</button>
          {contract.example && <button className={styles.button} type="button" onClick={example}>Load example</button>}
          <button className={styles.button} type="button" onClick={clear}>Clear</button>
        </div>
      </form>
      <section className={styles.panel} aria-labelledby={`${scope}-output-heading`} aria-busy={busy}>
        <div className={styles.panelHead}>
          <h2 id={`${scope}-output-heading`}>{algorithm ? `${contract.outputLabel} · ${algorithm}` : contract.outputLabel}</h2>
          {result && !result.parts && <button className={styles.button} type="button" onClick={() => copy(result.text, "Result")}>Copy</button>}
        </div>
        {result ? <div className={styles.result}>
          {result.parts ? result.parts.map((part, index) => <section className={styles.part} key={`${index}-${part.label}`} aria-labelledby={`${scope}-part-${index}`}>
            <div className={styles.partHead}><h3 id={`${scope}-part-${index}`}>{part.label}</h3><button className={styles.button} type="button" onClick={() => copy(part.value, part.label)}>Copy {part.label}</button></div>
            <pre className={`${styles.output} ${styles.partOutput}`} tabIndex={0} aria-label={part.label}>{part.value}</pre>
          </section>) : <pre className={styles.output} tabIndex={0} aria-label={contract.outputLabel}>{result.text}</pre>}
        </div> : <p className={styles.empty}>{busy ? "Processing locally…" : `Choose “${contract.action}” to see the result here.`}</p>}
        {copyError && <p className={styles.error} role="alert">{copyError}</p>}
      </section>
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    <p className={styles.privacy}>{contract.privacyMessage}</p>
    {notices.length > 0 && <ul className={styles.notes}>{notices.map(item => <li key={item}>{item}</li>)}</ul>}
  </div>;
}

export default function SecurityStation({ toolId }: { toolId: SecurityToolId }) {
  const definition = getSecurityDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
