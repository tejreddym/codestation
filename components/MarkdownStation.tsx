"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode, createElement } from "react";
import { useSafePathname, useSafeRouter } from "./useSafeNavigation";
import { getMarkdownDefinition, type MarkdownToolId } from "@/config/markdown-tools";
import { capabilityForRoute, capabilitiesFor } from "@/config/conversion-capabilities";
import { useConverterSession } from "./ConverterSession";
import { MarkdownError, type MarkdownResult } from "@/lib/tools/markdown/types";
import { Button, ButtonLink } from "./ui/Button";
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
import styles from "./MarkdownStation.module.css";

type Def = NonNullable<ReturnType<typeof getMarkdownDefinition>>;

const previewTags = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "STRONG", "EM", "CODE", "PRE", "BLOCKQUOTE", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "A", "IMG"]);

function SafePreview({ html }: { html: string }) {
  if (typeof DOMParser === "undefined") return <pre className={ui.output}>{html}</pre>;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node, key: string): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as HTMLElement;
    if (!previewTags.has(el.tagName)) return Array.from(el.childNodes).map((child, i) => walk(child, `${key}-${i}`));
    const attrs: Record<string, string> = {};
    for (const name of ["href", "src", "alt", "title", "class"]) {
      const value = el.getAttribute(name);
      if (value && (!["href", "src"].includes(name) || /^(?:https?:|mailto:|#|\/)/i.test(value))) attrs[name === "class" ? "className" : name] = value;
    }
    return createElement(el.tagName.toLowerCase(), { ...attrs, key }, Array.from(el.childNodes).map((child, i) => walk(child, `${key}-${i}`)));
  };
  return <div className={styles.preview} aria-label="Rendered sanitized Markdown preview">{Array.from(doc.body.childNodes).map((node, i) => walk(node, String(i)))}</div>;
}

function Station({ definition }: { definition: Def }) {
  const c = definition.localContract;
  const id = `markdown-${definition.id}`;
  const [values, setValues] = useState<Record<string, unknown>>({ ...c.defaults });
  const [result, setResult] = useState<MarkdownResult | null>(null);
  const [error, setError] = useState<MarkdownError | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { copy: copyText } = useCopy();
  const rev = useRef(0);
  const mounted = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const err = useRef<HTMLParagraphElement>(null);
  const pathname = useSafePathname();
  const router = useSafeRouter();
  const session = useConverterSession();
  const converter = capabilityForRoute(pathname);
  const converterSource = converter?.family === "markdown" ? converter.source : undefined;
  const saved = converterSource ? session.get("markdown") : undefined;
  const sourceField = c.fields.find(field => field.name === "source" || field.name === "html")?.name;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; rev.current++; };
  }, []);
  useEffect(() => {
    if (saved?.value && sourceField && typeof saved.value === "string") setValues(v => ({ ...v, [sourceField]: saved.value }));
  }, [definition.id]);
  useEffect(() => {
    if (error) {
      const el = form.current?.querySelector(`[data-field="${error.field}"]`) as HTMLElement | null;
      (el ?? err.current)?.focus();
    }
  }, [error]);

  const change = (name: string, value: unknown) => {
    rev.current++;
    setResult(null);
    setError(null);
    setNotice("");
    setValues(v => ({ ...v, [name]: value }));
    if (name === sourceField && converterSource && typeof value === "string") session.set({ family: "markdown", format: converterSource, value });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const current = ++rev.current;
    setBusy(true);
    setError(null);
    setNotice("Processing locally…");
    try {
      const { runMarkdown } = await import("@/lib/tools/markdown/engine");
      const next = await runMarkdown(definition.id, values);
      if (!mounted.current || current !== rev.current) return;
      setResult(next);
      setNotice("Result ready.");
    } catch (cause) {
      if (mounted.current && current === rev.current) {
        setError(cause instanceof MarkdownError ? cause : new MarkdownError("Could not process this Markdown input."));
        setNotice("Check the input error.");
      }
    } finally {
      if (mounted.current && current === rev.current) setBusy(false);
    }
  }

  function clear() {
    rev.current++;
    setResult(null);
    setError(null);
    setNotice("");
    setValues({ ...c.defaults });
    if (converterSource) session.clear("markdown");
  }

  function selectTarget(target: string) {
    const next = converterSource && capabilitiesFor("markdown", converterSource).find(item => item.target === target);
    if (next && next.route !== pathname) router.push(next.route);
  }

  async function copy() {
    if (!result) return;
    const ok = await copyText(result.text);
    setNotice(ok ? "Result copied." : "Could not copy. Select the result and copy it manually.");
  }

  const output = result?.text;
  const isHtml = definition.id === "markdown-preview" || definition.id === "markdown-to-html";
  const html = isHtml && output ? output : "";

  return <div className={styles.station}>
    {definition.pairedTool && <nav className={`${ui.pair} ${styles.pairNav}`} aria-label="Paired tool">
      <span className={ui.pairLabel}>Markdown conversion</span>
      <ButtonLink href={`/tools/${definition.pairedTool}`} size="sm" variant="ghost">Open {getMarkdownDefinition(definition.pairedTool)?.name}</ButtonLink>
    </nav>}
    <ToolLayout kind="form" className={styles.layout}>
      <Panel
        title={`${definition.name} input`}
        headingId={`${id}-input`}
        padded
        actions={converterSource ? <label className={styles.converter}>
          <span>Output Format</span>
          <Select id={`${id}-output-format`} value={converter?.target ?? ""} onChange={event => selectTarget(event.target.value)}>
            <option value="" disabled>Choose target</option>
            {capabilitiesFor("markdown", converterSource).map(item => <option key={item.target} value={item.target}>{item.target.toUpperCase()}</option>)}
          </Select>
          <small>Source: {saved?.format ?? converterSource} (selected route)</small>
        </label> : undefined}
      >
        <form ref={form} onSubmit={submit} noValidate aria-labelledby={`${id}-input`} aria-describedby={`${id}-status`} aria-busy={busy}>
          <div className={styles.fields}>
            {c.fields.map(field => {
              const fieldId = `${id}-${field.name}`;
              const common = {
                id: fieldId,
                name: field.name,
                "data-field": field.name,
                value: String(values[field.name] ?? ""),
                "aria-describedby": error ? `${id}-error` : undefined,
                "aria-invalid": error ? true : undefined,
                onChange: (event: { target: { value: string } }) => change(field.name, event.target.value),
              };
              return <Field key={field.name} id={fieldId} label={field.label}>
                {field.control === "select"
                  ? <Select {...common}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</Select>
                  : field.control === "number"
                    ? <TextInput {...common} type="number" min={field.min} max={field.max} />
                    : <Textarea {...common} placeholder={field.optional ? "Optional" : ""} spellCheck={false} autoComplete="off" autoCapitalize="off" />}
              </Field>;
            })}
          </div>
          {c.notices.map(note => <Hint key={note}>{note}</Hint>)}
          <div className={ui.actions}>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Processing…" : c.action}</Button>
            <Button onClick={clear}>Clear</Button>
          </div>
          {error && <Callout kind="error" ref={err} id={`${id}-error`} tabIndex={-1} className={styles.alert}>{error.message}</Callout>}
        </form>
      </Panel>
      <Panel
        title={c.outputs.join(" · ")}
        headingId={`${id}-output`}
        padded
        aria-busy={busy || undefined}
        actions={result ? <Button size="sm" onClick={() => void copy()}>Copy</Button> : undefined}
      >
        {result ? <div className={styles.result}>
          {result.warnings?.map(warning => <Hint key={warning}>{warning}</Hint>)}
          {isHtml ? <>
            <SafePreview html={html} />
            <details className={styles.source}>
              <summary>Sanitized HTML source</summary>
              <pre className={ui.output} tabIndex={0} aria-label="Sanitized HTML source">{html}</pre>
            </details>
          </> : <pre className={ui.output} tabIndex={0} aria-label="Markdown result">{output}</pre>}
        </div> : <EmptyState>Your result will appear after you {c.action.toLowerCase()}. Editing an input clears the previous result.</EmptyState>}
      </Panel>
    </ToolLayout>
    <StatusLine id={`${id}-status`}>{notice}</StatusLine>
    <PrivacyNote>All processing stays in this browser. Markdown, HTML and extracted links are not transmitted or saved.</PrivacyNote>
  </div>;
}

export default function MarkdownStation({ toolId }: { toolId: MarkdownToolId }) {
  const definition = getMarkdownDefinition(toolId);
  return definition ? <Station key={definition.id} definition={definition} /> : null;
}
