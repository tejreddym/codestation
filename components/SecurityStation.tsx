"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSecurityDefinition, getSecurityNotices, type SecurityDefinition, type SecurityInputField, type SecurityToolId } from "@/config/security-tools";
import type { SecurityRequest, SecurityResult, SecurityValues } from "@/lib/tools/security/types";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Select, Textarea, TextInput } from "./ui/controls";
import { EmptyState } from "./ui/EmptyState";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
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
  const { copy: copyText } = useCopy();
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
    const ok = await copyText(value);
    if (currentRevision !== revision.current) return;
    if (ok) setNotice(`${label} copied.`);
    else setCopyError("Could not copy. Select the result and copy it manually.");
  }

  function fieldControl(field: SecurityInputField) {
    const id = `${scope}-${field.name}`;
    const invalid = Boolean(error?.fields.includes(field.name));
    const describedBy = [field.hint ? `${id}-hint` : "", invalid ? `${scope}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = { id, name: field.name, "aria-invalid": invalid, "aria-describedby": describedBy };
    if (field.control === "checkbox") {
      return (
        <div className={ui.field} key={field.name}>
          <label className={ui.checkboxRow} htmlFor={id}>
            <input {...common} type="checkbox" checked={values[field.name] === true} onChange={event => edit(field.name, event.target.checked)} />
            <span>{field.label}</span>
          </label>
          {field.hint && <Hint id={`${id}-hint`}>{field.hint}</Hint>}
        </div>
      );
    }
    const editable = {
      ...common,
      value: String(values[field.name] ?? ""),
      onChange: (event: { target: { value: string } }) => edit(field.name, event.target.value),
    };
    return (
      <Field key={field.name} id={id} label={field.label} hint={field.hint}>
        {field.control === "select" ? (
          <Select {...editable}>{field.options?.map(option => <option key={option} value={option}>{field.name === "version" ? `UUID v${option}` : field.name === "keySize" ? `${option} bits` : option}</option>)}</Select>
        ) : field.control === "file" ? (
          <input {...common} ref={fileInput} className={ui.control} type="file" disabled={busy} onChange={event => {
            const selected = event.currentTarget.files?.[0] ?? null;
            invalidate();
            setFile(selected);
          }} />
        ) : field.control === "textarea" ? (
          <Textarea {...editable} placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />
        ) : (
          <TextInput {...editable} type={field.control} min={field.min} max={field.max} step={field.control === "number" ? 1 : undefined} placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />
        )}
      </Field>
    );
  }

  return (
    <div className={styles.station}>
      <ToolLayout kind="form">
        <Panel
          title={contract.fields.length ? "Inputs" : "Generate"}
          headingId={`${scope}-input-heading`}
          actions={algorithm ? <span className={styles.algorithm}>Algorithm: {algorithm}</span> : undefined}
          padded
        >
          <form className={styles.form} onSubmit={run} noValidate aria-labelledby={`${scope}-input-heading`} autoComplete="off">
            {contract.fields.length ? contract.fields.map(fieldControl) : <Hint>No input needed. Generate one ULID locally.</Hint>}
            {error && <Callout kind="error" id={`${scope}-error`}>{error.message}</Callout>}
            <div className={ui.actions}>
              <Button id={`${scope}-submit`} type="submit" variant="primary" disabled={busy} aria-busy={busy}>{busy ? "Processing…" : contract.action}</Button>
              {contract.example && <Button onClick={example}>Load example</Button>}
              <Button onClick={clear}>Clear</Button>
            </div>
          </form>
        </Panel>
        <Panel
          title={algorithm ? `${contract.outputLabel} · ${algorithm}` : contract.outputLabel}
          headingId={`${scope}-output-heading`}
          aria-busy={busy}
          actions={result && !result.parts ? <Button size="sm" onClick={() => copy(result.text, "Result")}>Copy</Button> : undefined}
          padded
        >
          {result ? (
            <div className={styles.result}>
              {result.parts ? result.parts.map((part, index) => (
                <Panel
                  key={`${index}-${part.label}`}
                  level={3}
                  title={part.label}
                  headingId={`${scope}-part-${index}`}
                  actions={<Button size="sm" onClick={() => copy(part.value, part.label)}>Copy {part.label}</Button>}
                  padded
                >
                  <pre className={`${ui.output} ${styles.partOutput}`} tabIndex={0} aria-label={part.label}>{part.value}</pre>
                </Panel>
              )) : <pre className={ui.output} tabIndex={0} aria-label={contract.outputLabel}>{result.text}</pre>}
            </div>
          ) : <EmptyState>{busy ? "Processing locally…" : `Choose “${contract.action}” to see the result here.`}</EmptyState>}
          {copyError && <Callout kind="error">{copyError}</Callout>}
        </Panel>
      </ToolLayout>
      <StatusLine className={styles.status}>{notice}</StatusLine>
      <PrivacyNote className={styles.privacy}>{contract.privacyMessage}</PrivacyNote>
      {notices.length > 0 && <ul className={styles.notes}>{notices.map(item => <li key={item} className={ui.hint}>{item}</li>)}</ul>}
    </div>
  );
}

export default function SecurityStation({ toolId }: { toolId: SecurityToolId }) {
  const definition = getSecurityDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
