"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import { useSafePathname, useSafeRouter } from "./useSafeNavigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getJsonDataDefinition, type DataInputField, type JsonDataDefinition, type JsonDataToolId } from "@/config/json-data-tools";
import type { DataInputs, DataResult } from "@/lib/tools/json-data/types";
import { Button, ButtonLink } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Select, Textarea, TextInput } from "./ui/controls";
import { EmptyState } from "./ui/EmptyState";
import { Field } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { cx } from "./ui/cx";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { useCopy } from "./ui/useCopy";
import { useToolPermalink } from "./useToolPermalink";
import ui from "./ui/ui.module.css";
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
    {open && <div className={styles.children}>{entries.slice(0, visibleCount).map(([key, child]) => <TreeNode key={key} label={isArray ? `[${key}]` : JSON.stringify(key)} value={child} />)}{entries.length > visibleCount && <Button size="sm" onClick={() => setVisibleCount(count => count + 200)}>Show next {Math.min(200, entries.length - visibleCount)} nodes</Button>}</div>}
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
  const { copy: copyText } = useCopy();
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
    clearLinkFeedback();
  }

  async function executeWithInputs(targetInputs: DataInputs) {
    const missing = contract.fields.filter((field) => field.required && !targetInputs[field.name]?.length);
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
      const next = await runDataToolClient(definition.slug, { ...targetInputs }, processing.current.signal);
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

  const { copyLink, copiedLink, linkNotice, linkError, clearLinkFeedback } = useToolPermalink({
    getState: () => {
      const controls: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(inputs)) {
        if (key !== "input") controls[key] = val;
      }
      return { input: inputs.input ?? "", controls };
    },
    getOutputText: () => result?.text ?? null,
    onHydrate: (state) => {
      const nextInputs: DataInputs = { ...defaults(definition) };
      if (state.controls) {
        for (const field of contract.fields) {
          const val = state.controls[field.name];
          if (typeof val === "string") nextInputs[field.name] = val;
        }
      }
      if (typeof state.input === "string") {
        nextInputs.input = state.input;
      }
      invalidate();
      setInputs(nextInputs);
      if (converterSource && nextInputs.input) {
        session.set({ family: "json-data", format: converterSource, value: nextInputs.input });
      }
      void executeWithInputs(nextInputs);
    },
  });

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
    await executeWithInputs(inputs);
  }

  async function copy() {
    if (!result) return;
    const currentRevision = revision.current;
    setNotice("");
    setActionError("");
    const ok = await copyText(result.text);
    if (revision.current !== currentRevision) return;
    if (ok) setNotice("Result copied.");
    else setActionError("Could not copy. Select the result and copy it manually.");
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
      "aria-invalid": Boolean(fieldError || invalidResult) || undefined, "aria-describedby": describedBy,
      onChange: (event: { target: { value: string } }) => edit(field.name, event.target.value),
    };
    const editorClass = field.name === "input" || field.name === "secondary" ? styles.editor : styles.smallEditor;
    return <Field key={field.name} id={id} label={field.label} hint={field.hint}>
      {field.control === "select" ? <Select {...common}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
        : field.control === "textarea" ? <Textarea {...common} className={cx(ui.mono, editorClass)} placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />
          : <TextInput {...common} type="text" placeholder={field.placeholder} spellCheck={false} autoComplete="off" autoCapitalize="off" />}
    </Field>;
  }

  return <div className={styles.station}>
    {paired && <nav className={`${ui.pair} ${styles.direction}`} aria-label="Conversion direction">
      <span className={ui.pairLabel}><strong>{definition.inputFormat}</strong> <span aria-hidden="true">→</span> <strong>{definition.outputFormat}</strong></span>
      <ButtonLink href={`/tools/${paired.slug}`} size="sm" variant="ghost" aria-label={`Switch to ${paired.name}`}>Switch to {paired.name} <span aria-hidden="true">↔</span></ButtonLink>
    </nav>}
    <ToolLayout kind="form" className={styles.layout}>
      <Panel
        title="Input"
        headingId={`${scope}-input-heading`}
        actions={<>
          <span className={styles.format}>Accepts {definition.inputFormat}</span>
          {converterSource && <label className={styles.converter} htmlFor={`${scope}-output-format`}>
            <span>Output Format</span>
            <Select id={`${scope}-output-format`} value={converter?.target ?? ""} onChange={event => selectTarget(event.target.value)}>
              <option value="" disabled>Choose target</option>
              {targets.map(target => <option key={target} value={target}>{target.toUpperCase()}</option>)}
            </Select>
            <small className={styles.format}>Source: {savedSource?.format ?? converterSource} (selected route)</small>
          </label>}
        </>}
        padded
      >
        <form onSubmit={run} noValidate aria-labelledby={`${scope}-input-heading`}>
          <div className={styles.fields}>{contract.fields.map(fieldControl)}</div>
          {error && <Callout kind="error" id={`${scope}-error`} className={styles.alert}>Invalid: {error.message}</Callout>}
          <div className={ui.actions}>
            <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>{busy ? "Processing…" : contract.action}</Button>
            <Button onClick={example}>Load example</Button>
            <Button onClick={clear}>Clear</Button>
            <Button onClick={() => void copyLink()}>{copiedLink ? "Link copied" : "Copy Link"}</Button>
          </div>
          {linkError && <Callout kind="error" className={styles.alert}>{linkError}</Callout>}
        </form>
      </Panel>
      <Panel
        title={contract.output.label}
        headingId={`${scope}-output-heading`}
        aria-busy={busy || undefined}
        padded
        actions={result ? <>
          <Button size="sm" onClick={copy}>Copy</Button>
          {contract.output.kind === "data" && contract.output.extension && !result.invalid && <Button size="sm" onClick={download}>Download .{contract.output.extension}</Button>}
        </> : undefined}
      >
        {result ? <div id={`${scope}-result`} className={cx(styles.result, result.invalid && styles.invalidResult)}>
          {definition.slug.endsWith("validator") && <p className={styles.verdict}><strong>{result.invalid ? "Invalid" : "Valid"}</strong></p>}
          {contract.output.kind === "tree" && "tree" in result ? <div className={styles.tree}><TreeNode key={revision.current} label="$" value={result.tree} root /></div>
            : <pre className={ui.output} tabIndex={0} aria-label={contract.output.label}>{result.text}</pre>}
        </div> : <EmptyState>{busy ? "Processing your input locally…" : `Enter ${definition.inputFormat}, then choose “${contract.action}”. Your result will appear here.`}</EmptyState>}
        {actionError && <Callout kind="error" className={styles.alert}>{actionError}</Callout>}
      </Panel>
    </ToolLayout>
    <StatusLine>{linkNotice || notice}</StatusLine>
    <PrivacyNote>Processed in your browser. Inputs stay in this page’s memory and are not uploaded or saved.</PrivacyNote>
    {contract.notes.length > 0 && <ul className={styles.notes}>{contract.notes.map((note) => <li key={note} className={ui.hint}>{note}</li>)}</ul>}
  </div>;
}

export default function JsonDataStation({ toolId }: { toolId: JsonDataToolId }) {
  const definition = getJsonDataDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
