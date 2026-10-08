"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getEncodingDefinition, type EncodingDefinition, type EncodingInputField, type EncodingToolId } from "@/config/encoding-tools";
import type { EncodingInputs, EncodingResult } from "@/lib/tools/encoding/types";
import styles from "./EncodingStation.module.css";

type InputError = { message: string; fields: string[] };

function Station({ definition }: { definition: EncodingDefinition }) {
  const contract = definition.encodingContract;
  const scope = `encoding-${definition.slug}`;
  const [inputs, setInputs] = useState<EncodingInputs>(() => ({ input: "", ...(definition.slug === "data-uri-encoder" ? { mime: "" } : {}) }));
  const [result, setResult] = useState<EncodingResult | null>(null);
  const [error, setError] = useState<InputError | null>(null);
  const [notice, setNotice] = useState("");
  const [copyError, setCopyError] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const processing = useRef<AbortController | null>(null);
  const paired = definition.pairedTool ? getEncodingDefinition(definition.pairedTool) : undefined;
  const isJwt = definition.slug === "jwt-decoder";

  useToolHandoff(definition.slug, text => edit("input", text));

  useEffect(() => () => { revision.current += 1; processing.current?.abort(); }, []);

  function invalidate() {
    revision.current += 1;
    processing.current?.abort();
    processing.current = null;
    setBusy(false);
    setResult(null);
    setError(null);
    setNotice("");
    setCopyError("");
  }

  function edit(name: EncodingInputField["name"], value: string) {
    invalidate();
    setInputs((current) => ({ ...current, [name]: value }));
  }

  function clear() {
    invalidate();
    setInputs({ input: "", ...(contract.fields.some((field) => field.name === "mime") ? { mime: "" } : {}) });
  }

  function example() {
    invalidate();
    setInputs({ ...contract.example });
    setNotice("Example loaded. Run the tool to see its result.");
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    invalidate();
    const currentRevision = revision.current;
    const controller = new AbortController();
    processing.current = controller;
    setBusy(true);
    setNotice("Processing your input locally…");
    try {
      const { runEncodingTool } = await import("@/lib/tools/encoding/client");
      if (currentRevision !== revision.current) return;
      const next = await runEncodingTool(definition.slug, { ...inputs }, controller.signal);
      if (currentRevision !== revision.current) return;
      setResult(next);
      setNotice("Result ready.");
    } catch (cause) {
      if (currentRevision !== revision.current) return;
      const field = cause && typeof cause === "object" && "field" in cause && typeof cause.field === "string" ? cause.field : undefined;
      const fields = field && contract.fields.some((item) => item.name === field) ? [field] : contract.fields.map((item) => item.name);
      setError({ message: cause instanceof Error ? cause.message : "Could not process this input. Check the format and try again.", fields });
      setNotice("");
      document.getElementById(`${scope}-${fields[0]}`)?.focus();
    } finally {
      if (currentRevision === revision.current) {
        processing.current = null;
        setBusy(false);
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

  function fieldControl(field: EncodingInputField) {
    const id = `${scope}-${field.name}`;
    const invalid = Boolean(error?.fields.includes(field.name));
    const describedBy = [field.hint ? `${id}-hint` : "", invalid ? `${scope}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = {
      id, name: field.name, value: inputs[field.name] ?? "", placeholder: field.placeholder,
      "aria-invalid": invalid, "aria-describedby": describedBy,
      onChange: (event: { target: { value: string } }) => edit(field.name, event.target.value),
      spellCheck: false, autoComplete: "off", autoCapitalize: "off",
    };
    return <div className={styles.field} key={field.name}>
      <label htmlFor={id}>{field.label}</label>
      {field.control === "textarea" ? <textarea {...common} className={`${styles.control} ${styles.editor}`} />
        : <input {...common} className={styles.control} type="text" />}
      {field.hint && <p id={`${id}-hint`} className={styles.hint}>{field.hint}</p>}
    </div>;
  }

  return <div className={styles.station}>
    {paired && <nav className={styles.direction} aria-label="Conversion direction">
      <span><strong>{definition.inputFormat}</strong> <span aria-hidden="true">→</span> <strong>{definition.outputFormat}</strong></span>
      <Link className={styles.reverseLink} href={`/tools/${paired.slug}`}>Switch to {paired.name} <span aria-hidden="true">↔</span></Link>
    </nav>}
    {isJwt && <p className={styles.jwtNote}>{contract.notes[0]}</p>}
    <div className={styles.layout}>
      <form className={styles.panel} onSubmit={run} noValidate aria-labelledby={`${scope}-input-heading`}>
        <div className={styles.panelHead}><h2 id={`${scope}-input-heading`}>Input</h2><span className={styles.format}>Accepts {contract.acceptedFormat}</span></div>
        <div className={styles.fields}>{contract.fields.map(fieldControl)}</div>
        {error && <p className={styles.error} id={`${scope}-error`} role="alert">{error.message}</p>}
        <div className={styles.actions}>
          <button className={`${styles.button} ${styles.primary}`} type="submit" disabled={busy} aria-busy={busy}>{busy ? "Processing…" : contract.action}</button>
          <button className={styles.button} type="button" onClick={example}>Load example</button>
          <button className={styles.button} type="button" onClick={clear}>Clear</button>
        </div>
      </form>
      <section className={styles.panel} aria-labelledby={`${scope}-output-heading`} aria-busy={busy}>
        <div className={styles.panelHead}>
          <h2 id={`${scope}-output-heading`}>{contract.outputLabel}</h2>
          {result && !result.parts && <button className={styles.button} type="button" onClick={() => copy(result.text, "Result")}>Copy</button>}
        </div>
        {result ? <div className={styles.result}>
          {result.parts ? result.parts.map((part, index) => <section className={styles.part} key={part.label} aria-labelledby={`${scope}-part-${index}`}>
            <div className={styles.partHead}><h3 id={`${scope}-part-${index}`}>{part.label}</h3><button className={styles.button} type="button" onClick={() => copy(part.value, part.label)}>Copy {part.label}</button></div>
            <pre className={`${styles.output} ${styles.partOutput}`} tabIndex={0} aria-label={part.label}>{part.value}</pre>
          </section>) : <pre className={styles.output} tabIndex={0} aria-label={contract.outputLabel}>{result.text}</pre>}
        </div> : <p className={styles.empty}>{busy ? "Processing your input locally…" : `Choose “${contract.action}” to see the result here.`}</p>}
        {copyError && <p className={styles.error} role="alert">{copyError}</p>}
      </section>
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    <p className={styles.privacy}>{contract.privacyMessage}</p>
    {contract.notes.length > 0 && <ul className={styles.notes}>{contract.notes.slice(isJwt ? 1 : 0).map((note) => <li key={note}>{note}</li>)}</ul>}
  </div>;
}

export default function EncodingStation({ toolId }: { toolId: EncodingToolId }) {
  const definition = getEncodingDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
