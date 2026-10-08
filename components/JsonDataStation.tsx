"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import Link from "next/link";
import { useSafePathname, useSafeRouter } from "./useSafeNavigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getJsonDataDefinition, type DataInputField, type JsonDataDefinition, type JsonDataToolId } from "@/config/json-data-tools";
import type { DataInputs, DataResult } from "@/lib/tools/json-data/types";
import styles from "./JsonDataStation.module.css";
import { capabilityForRoute, capabilitiesFor } from "@/config/conversion-capabilities";
import { useConverterSession } from "./ConverterSession";

function defaults(definition: JsonDataDefinition): DataInputs {
  return Object.fromEntries(definition.dataContract.fields.map((field) => [field.name, field.defaultValue ?? ""]));
}

/** Closed branches mount their children on demand; values are always React text. */
function TreeNode({ label, value, root = false }: { label: string; value: unknown; root?: boolean }) {
  const [open, setOpen] = useState(root);
  const [visibleCount, setVisibleCount] = useState(200);
  const isArray = Array.isArray(value);
  const type = value === null ? "null" : isArray ? "array" : typeof value;
  if (value === null || typeof value !== "object") {
    return <div className={styles.leaf}><strong>{label}</strong> <span className={styles.type}>{type}</span> <span>{JSON.stringify(value)}</span></div>;
  }
  const entries = Object.entries(value);
  return <details className={styles.branch} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><strong>{label}</strong> <span className={styles.type}>{type} · {entries.length} {isArray ? "items" : "keys"}</span></summary>
    {open && <div className={styles.children}>{entries.slice(0, visibleCount).map(([key, child]) => <TreeNode key={key} label={isArray ? `[${key}]` : JSON.stringify(key)} value={child} />)}{entries.length > visibleCount && <button type="button" className={styles.button} onClick={() => setVisibleCount(count => count + 200)}>Show next {Math.min(200, entries.length - visibleCount)} nodes</button>}</div>}
  </details>;
}

type InputError = { message: string; fields: string[] };

function Station({ definition }: { definition: JsonDataDefinition }) {
  const contract = definition.dataContract;
  const scope = `json-data-${definition.slug}`;
  const [inputs, setInputs] = useState<DataInputs>(() => defaults(definition));
  const [result, setResult] = useState<DataResult | null>(null);
  const [error, setError] = useState<InputError | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const session = useConverterSession();
  const converter = capabilityForRoute(pathname);
  const converterSource = converter?.family === "json-data" ? converter.source : undefined;
  const savedSource = converterSource ? session.get("json-data") : undefined;
  const targets = converterSource ? capabilitiesFor("json-data", savedSource?.format ?? converterSource).map(item => item.target) : [];
  const revision = useRef(0);
  const processing = useRef<AbortController | null>(null);
  const paired = definition.pairedTool ? getJsonDataDefinition(definition.pairedTool) : undefined;

  useEffect(() => () => { revision.current += 1; processing.current?.abort(); }, []);
  useEffect(() => {
    if (savedSource?.value && typeof savedSource.value === "string" && inputs.input === defaults(definition).input) {
      setInputs(current => ({ ...current, input: savedSource.value as string }));
    }
  // Compatible route changes are the only remounts that consult this memory session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.slug]);
  useToolHandoff(definition.slug, text => edit("input", text));

  function invalidate() {
    processing.current?.abort();
    revision.current += 1;
    setBusy(false);
    setResult(null);
    setError(null);
    setNotice("");
    setActionError("");
  }

  function edit(name: string, value: string) {
    invalidate();
    setInputs((current) => ({ ...current, [name]: value }));
    if (name === "input" && converterSource) session.set({ family: "json-data", format: converterSource, value });
  }

  function clear() {
    invalidate();
    setInputs(defaults(definition));
    if (converterSource) session.clear("json-data");
  }

  function selectTarget(target: string) {
    const source = savedSource?.format ?? converterSource;
    const next = source && capabilitiesFor("json-data", source).find(item => item.target === target);
    if (next && next.route !== pathname) router.push(next.route);
  }

  function example() {
    invalidate();
    setInputs({ ...defaults(definition), ...contract.examples[0].inputs });
    setNotice("Example loaded. Run the tool to see its result.");
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    invalidate();
    const missing = contract.fields.filter((field) => field.required && !inputs[field.name]?.length);
    if (missing.length) {
      setError({ message: `Enter ${missing.map((field) => field.label.toLowerCase()).join(" and ")}.`, fields: missing.map((field) => field.name) });
      document.getElementById(`${scope}-${missing[0].name}`)?.focus();
      return;
    }
    const currentRevision = revision.current;
    setBusy(true);
    try {
      const { runDataToolClient } = await import("@/lib/tools/json-data/client");
      if (currentRevision !== revision.current) return;
      processing.current = new AbortController();
      const next = await runDataToolClient(definition.slug, { ...inputs }, processing.current.signal);
      if (currentRevision !== revision.current) return;
      setResult(next);
      setNotice(next.invalid ? "Validation found errors. Review the result." : "Result ready.");
    } catch (cause) {
      if (currentRevision !== revision.current) return;
      const field = cause && typeof cause === "object" && "field" in cause && typeof cause.field === "string" ? cause.field : undefined;
      setError({
        message: cause instanceof Error ? cause.message : "Could not process this input. Check the format and try again.",
        fields: field && contract.fields.some((item) => item.name === field) ? [field] : contract.fields.map((item) => item.name),
      });
    } finally {
      if (currentRevision === revision.current) setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    const currentRevision = revision.current;
    setNotice("");
    setActionError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(result.text);
      if (revision.current === currentRevision) setNotice("Result copied.");
    } catch {
      if (revision.current === currentRevision) setActionError("Could not copy. Select the result and copy it manually.");
    }
  }

  function download() {
    if (!result || !contract.output.extension || result.invalid) return;
    setNotice("");
    setActionError("");
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([result.text], { type: `${contract.output.mimeType ?? "text/plain"};charset=utf-8` }));
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${definition.slug}.${contract.output.extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      setNotice("Download started.");
    } catch {
      setActionError("Could not start the download. Copy or select the result instead.");
    } finally {
      anchor?.remove();
      if (url) {
        const objectUrl = url;
        const revoke = URL.revokeObjectURL.bind(URL);
        window.setTimeout(() => revoke(objectUrl), 1000);
      }
    }
  }

  function fieldControl(field: DataInputField) {
    const id = `${scope}-${field.name}`;
    const fieldError = error?.fields.includes(field.name);
    const invalidResult = result?.invalid && (field.name === "input" || field.name === "secondary");
    const describedBy = [field.hint ? `${id}-hint` : "", fieldError ? `${scope}-error` : "", invalidResult ? `${scope}-result` : ""].filter(Boolean).join(" ") || undefined;
    const common = {
      id, name: field.name, value: inputs[field.name] ?? "", required: field.required,
      "aria-invalid": Boolean(fieldError || invalidResult), "aria-describedby": describedBy,
      className: styles.control,
      onChange: (event: { target: { value: string } }) => edit(field.name, event.target.value),
    };
    return <div className={styles.field} key={field.name}>
      <label htmlFor={id}>{field.label}</label>
      {field.control === "select" ? <select {...common}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        : field.control === "textarea" ? <textarea {...common} className={`${styles.control} ${field.name === "input" || field.name === "secondary" ? styles.editor : styles.smallEditor}`} placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />
          : <input {...common} type="text" placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />}
      {field.hint && <p id={`${id}-hint`} className={styles.hint}>{field.hint}</p>}
    </div>;
  }

  return <div className={styles.station}>
    {paired && <nav className={styles.direction} aria-label="Conversion direction">
      <span><strong>{definition.inputFormat}</strong> <span aria-hidden="true">→</span> <strong>{definition.outputFormat}</strong></span>
      <Link className={styles.reverseLink} href={`/tools/${paired.slug}`}>Switch to {paired.name} <span aria-hidden="true">↔</span></Link>
    </nav>}
    <div className={styles.layout}>
      <form className={styles.panel} onSubmit={run} noValidate aria-labelledby={`${scope}-input-heading`}>
        <div className={styles.panelHead}><h2 id={`${scope}-input-heading`}>Input</h2><span className={styles.format}>Accepts {definition.inputFormat}</span>{converterSource && <label className={styles.format} htmlFor={`${scope}-output-format`}>Output Format <select id={`${scope}-output-format`} value={converter?.target ?? ""} onChange={event => selectTarget(event.target.value)}><option value="" disabled>Choose target</option>{targets.map(target => <option key={target} value={target}>{target.toUpperCase()}</option>)}</select><small>Source: {savedSource?.format ?? converterSource} (selected route)</small></label>}</div>
        <div className={styles.fields}>{contract.fields.map(fieldControl)}</div>
        {error && <p className={styles.error} id={`${scope}-error`} role="alert">Invalid: {error.message}</p>}
        <div className={styles.actions}>
          <button className={`${styles.button} ${styles.primary}`} type="submit" disabled={busy}>{busy ? "Processing…" : contract.action}</button>
          <button className={styles.button} type="button" onClick={example}>Load example</button>
          <button className={styles.button} type="button" onClick={clear}>Clear</button>
        </div>
      </form>
      <section className={styles.panel} aria-labelledby={`${scope}-output-heading`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${scope}-output-heading`}>{contract.output.label}</h2>
          {result && <div className={styles.outputActions}>
            <button className={styles.button} type="button" onClick={copy}>Copy</button>
            {contract.output.kind === "data" && contract.output.extension && !result.invalid && <button className={styles.button} type="button" onClick={download}>Download .{contract.output.extension}</button>}
          </div>}
        </div>
        {result ? <div id={`${scope}-result`} className={result.invalid ? styles.invalidResult : styles.result}>
          {definition.slug.endsWith("validator") && <p><strong>{result.invalid ? "Invalid" : "Valid"}</strong></p>}
          {contract.output.kind === "tree" && "tree" in result ? <div className={styles.tree}><TreeNode key={revision.current} label="$" value={result.tree} root /></div>
            : <pre className={styles.output} tabIndex={0} aria-label={contract.output.label}>{result.text}</pre>}
        </div> : <p className={styles.empty}>{busy ? "Processing your input locally…" : `Enter ${definition.inputFormat}, then choose “${contract.action}”. Your result will appear here.`}</p>}
        {actionError && <p className={styles.error} role="alert">{actionError}</p>}
      </section>
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    <p className={styles.privacy}>Processed in your browser. Inputs stay in this page’s memory and are not uploaded or saved.</p>
    {contract.notes.length > 0 && <ul className={styles.notes}>{contract.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
  </div>;
}

export default function JsonDataStation({ toolId }: { toolId: JsonDataToolId }) {
  const definition = getJsonDataDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
