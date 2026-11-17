"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getEncodingDefinition, type EncodingDefinition, type EncodingInputField, type EncodingToolId } from "@/config/encoding-tools";
import type { EncodingInputs, EncodingResult } from "@/lib/tools/encoding/types";
import { Button, ButtonLink } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { TextInput, Textarea } from "./ui/controls";
import { EmptyState } from "./ui/EmptyState";
import { Field } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
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
  const { copy: copyText } = useCopy();
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
    const ok = await copyText(value);
    if (currentRevision !== revision.current) return;
    if (ok) setNotice(`${label} copied.`);
    else setCopyError("Could not copy. Select the result and copy it manually.");
  }

  function fieldControl(field: EncodingInputField) {
    const id = `${scope}-${field.name}`;
    const invalid = Boolean(error?.fields.includes(field.name));
    const describedBy = [field.hint ? `${id}-hint` : "", invalid ? `${scope}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = {
      id, name: field.name, value: inputs[field.name] ?? "", placeholder: field.placeholder,
      "aria-invalid": invalid || undefined, "aria-describedby": describedBy,
      onChange: (event: { target: { value: string } }) => edit(field.name, event.target.value),
      spellCheck: false, autoComplete: "off", autoCapitalize: "off" as const,
    };
    return <Field key={field.name} id={id} label={field.label} hint={field.hint}>
      {field.control === "textarea" ? <Textarea {...common} /> : <TextInput {...common} type="text" />}
    </Field>;
  }

  return <div className={styles.station}>
    {paired && <nav className={`${ui.pair} ${styles.direction}`} aria-label="Conversion direction">
      <span className={ui.pairLabel}><strong>{definition.inputFormat}</strong> <span aria-hidden="true">→</span> <strong>{definition.outputFormat}</strong></span>
      <ButtonLink href={`/tools/${paired.slug}`} size="sm" variant="ghost" aria-label={`Switch to ${paired.name}`}>Switch to {paired.name} <span aria-hidden="true">↔</span></ButtonLink>
    </nav>}
    {isJwt && <Callout kind="warning">{contract.notes[0]}</Callout>}
    <ToolLayout kind="form" className={styles.layout}>
      <Panel
        title="Input"
        headingId={`${scope}-input-heading`}
        actions={<span className={styles.format}>Accepts {contract.acceptedFormat}</span>}
        padded
      >
        <form onSubmit={run} noValidate aria-labelledby={`${scope}-input-heading`}>
          <div className={styles.fields}>{contract.fields.map(fieldControl)}</div>
          {error && <Callout kind="error" id={`${scope}-error`} className={styles.alert}>{error.message}</Callout>}
          <div className={ui.actions}>
            <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>{busy ? "Processing…" : contract.action}</Button>
            <Button onClick={example}>Load example</Button>
            <Button onClick={clear}>Clear</Button>
          </div>
        </form>
      </Panel>
      <Panel
        title={contract.outputLabel}
        headingId={`${scope}-output-heading`}
        aria-busy={busy || undefined}
        actions={result && !result.parts
          ? <Button size="sm" onClick={() => copy(result.text, "Result")}>Copy</Button>
          : undefined}
        padded
      >
        {result ? <div className={styles.result}>
          {result.parts
            ? result.parts.map((part, index) => <Panel
                key={part.label}
                level={3}
                title={part.label}
                headingId={`${scope}-part-${index}`}
                actions={<Button size="sm" onClick={() => copy(part.value, part.label)}>Copy {part.label}</Button>}
              >
                <pre className={ui.output} tabIndex={0} aria-label={part.label}>{part.value}</pre>
              </Panel>)
            : <pre className={ui.output} tabIndex={0} aria-label={contract.outputLabel}>{result.text}</pre>}
        </div> : <EmptyState>{busy ? "Processing your input locally…" : `Choose “${contract.action}” to see the result here.`}</EmptyState>}
        {copyError && <Callout kind="error" className={styles.alert}>{copyError}</Callout>}
      </Panel>
    </ToolLayout>
    <StatusLine>{notice}</StatusLine>
    <PrivacyNote>{contract.privacyMessage}</PrivacyNote>
    {contract.notes.length > 0 && <ul className={styles.notes}>{contract.notes.slice(isJwt ? 1 : 0).map((note) => <li key={note} className={ui.hint}>{note}</li>)}</ul>}
  </div>;
}

export default function EncodingStation({ toolId }: { toolId: EncodingToolId }) {
  const definition = getEncodingDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.slug} definition={definition} />;
}
