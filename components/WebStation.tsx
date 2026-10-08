"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { getWebDefinition, type WebToolId } from "@/config/web-tools";
import { WebError, type WebResult, type WebValues } from "@/lib/tools/web/types";
import WebStructuredFields, { webFieldMatches, type WebStructuredKind } from "./WebStructuredFields";
import styles from "./WebStation.module.css";

type Definition = NonNullable<ReturnType<typeof getWebDefinition>>;
type ImageResult = { blob: Blob; width: number; height: number; url: string };
const structured = new Set(["parameters", "groups", "sitemaps", "entries", "icons"]);
const inspection = new Set(["url-parser", "url-builder", "query-string-parser", "query-string-generator", "http-status-code-lookup", "mime-type-lookup", "http-header-reference", "user-agent-parser", "html-entity-reference", "url-fragment-parser", "url-path-analyzer", "url-encoding-inspector"]);

function clone(values: Readonly<WebValues>): WebValues {
  return JSON.parse(JSON.stringify(values)) as WebValues;
}

// Reject over-budget values rather than cutting off input or presenting incomplete output.
function checkBudget(value: unknown, output = false) {
  let nodes = 0; let total = 0;
  function visit(item: unknown, depth: number) {
    if (++nodes > 20000 || depth > 16) throw new WebError("The structured value exceeds the local processing limit.");
    if (typeof item === "string") {
      if (!output && item.length > 200000) throw new WebError("An input exceeds the 200,000-character field limit.");
      total += item.length;
    } else if (Array.isArray(item)) {
      if (!output && item.length > 1000) throw new WebError("An input exceeds the 1,000-row local processing limit.");
      for (const entry of item) visit(entry, depth + 1);
    } else if (item && typeof item === "object") {
      for (const [key, entry] of Object.entries(item)) { total += key.length; visit(entry, depth + 1); }
    }
    if (total > (output ? 4000000 : 1000000)) throw new WebError(`${output ? "Output" : "Input"} exceeds the local processing limit.`);
  }
  visit(value, 0);
}

function StructuredResult({ value, label }: { value: unknown; label: string }) {
  if (Array.isArray(value)) return value.length ? <ol className={styles.dataArray} aria-label={label}>{value.map((entry, index) => <li key={index}><StructuredResult value={entry} label={`${label} ${index + 1}`} /></li>)}</ol> : <span className={styles.scalar}>[]</span>;
  if (value && typeof value === "object") return <dl className={styles.dataList}>{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd><StructuredResult value={entry} label={`${label} ${key}`} /></dd></div>)}</dl>;
  return <span className={styles.scalar}>{value === null ? "null" : value === undefined ? "" : String(value)}</span>;
}

function Station({ definition }: { definition: Definition }) {
  const { webContract: contract } = definition;
  const id = `web-${definition.id}`;
  const outputLabel = contract.outputs.join(" · ");
  const [values, setValues] = useState<WebValues>(() => clone(contract.defaults));
  const [result, setResult] = useState<WebResult | null>(null);
  const [image, setImage] = useState<ImageResult | null>(null);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const file = useRef<File | null>(null);
  const imageUrl = useRef<string | null>(null);
  const downloadUrls = useRef(new Set<string>());

  function releaseImage() {
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = null;
  }

  useToolHandoff(definition.slug, text => change(definition.slug === "url-parser" ? "url" : "input", text));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current += 1;
      file.current = null;
      releaseImage();
      for (const url of downloadUrls.current) URL.revokeObjectURL(url);
      downloadUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const path = error.field?.replace(/\[(\d+)\]/g, ".$1");
    const controls = Array.from(form.current?.querySelectorAll<HTMLElement>("[data-web-field]") ?? []);
    const control = path ? controls.find(node => node.dataset.webField === path) ?? controls.find(node => node.dataset.webField?.startsWith(`${path}.`)) : undefined;
    if (control) control.focus(); else errorRef.current?.focus();
  }, [error]);

  function invalidate() {
    revision.current += 1;
    releaseImage();
    setImage(null);
    setResult(null);
    setError(null);
    setNotice("");
    setBusy(false);
  }

  function change(name: string, value: unknown) {
    invalidate();
    setValues(current => ({ ...current, [name]: value }));
  }

  function load(next: Readonly<WebValues>) {
    invalidate();
    file.current = null;
    if (fileInput.current) fileInput.current.value = "";
    setValues(clone({ ...contract.defaults, ...next }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    const currentRevision = revision.current;
    const snapshot = clone(values);
    const selectedFile = file.current;
    const active = () => mounted.current && revision.current === currentRevision;
    setBusy(true);
    setNotice("Processing locally…");
    try {
      for (const field of contract.fields) {
        try { checkBudget(snapshot[field.name]); }
        catch (cause) { throw new WebError(cause instanceof Error ? cause.message : "Input exceeds the local processing limit.", field.name); }
      }
      checkBudget(snapshot);
      if (definition.id === "favicon-generator") {
        if (!selectedFile) throw new WebError("Choose a local image file.", "file");
        const { generateFavicon } = await import("@/lib/tools/web/favicon");
        if (!active()) return;
        const next = await generateFavicon(selectedFile, Number(snapshot.size));
        if (!active()) return;
        const url = URL.createObjectURL(next.blob);
        imageUrl.current = url;
        setImage({ ...next, url });
      } else {
        let next: WebResult;
        if (inspection.has(definition.id)) {
          const { inspectWeb } = await import("@/lib/tools/web/inspect");
          if (!active()) return;
          next = await inspectWeb(definition.id, snapshot);
        } else {
          const { generateWeb } = await import("@/lib/tools/web/generate");
          if (!active()) return;
          next = await generateWeb(definition.id, snapshot);
        }
        if (!active()) return;
        checkBudget(next, true);
        setResult(next);
      }
      if (active()) setNotice("Result ready.");
    } catch (cause) {
      if (active()) {
        setError(cause instanceof WebError ? { text: cause.message, field: cause.field } : { text: "Could not process these inputs. Check the supported format and try again." });
        setNotice("Check the input error.");
      }
    } finally {
      if (active()) setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    const currentRevision = revision.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(result.copyText ?? result.text);
      if (mounted.current && revision.current === currentRevision) setNotice("Result copied.");
    } catch {
      if (mounted.current && revision.current === currentRevision) setNotice("Could not copy. Select the result and copy it manually.");
    }
  }

  function download() {
    const extension = contract.downloadExtension;
    if (!extension || !result && !image) return;
    let url: string | undefined;
    try {
      const mime = extension === "xml" ? "application/xml;charset=utf-8" : extension === "webmanifest" ? "application/manifest+json;charset=utf-8" : "text/plain;charset=utf-8";
      const blob = extension === "png" ? image?.blob : result ? new Blob([result.text], { type: mime }) : undefined;
      if (!blob) return;
      url = URL.createObjectURL(blob);
      downloadUrls.current.add(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${definition.id}.${extension}`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      setNotice("Download requested.");
    } catch { setNotice("Could not download the result. Try again."); }
    finally {
      if (url) {
        const ownedUrl = url;
        setTimeout(() => {
          if (downloadUrls.current.delete(ownedUrl)) URL.revokeObjectURL(ownedUrl);
        }, 0);
      }
    }
  }

  return <div className={styles.station}>
    <div className={styles.layout}>
      <form ref={form} className={styles.panel} onSubmit={event => void submit(event)} noValidate autoComplete="off" aria-labelledby={`${id}-input-heading`}>
        <div className={styles.panelHead}><h2 id={`${id}-input-heading`}>{definition.name} input</h2><button type="button" className="button" onClick={() => load(contract.example)}>Load example</button></div>
        <div className={styles.fields}>{contract.fields.map(field => {
          const fieldId = `${id}-${field.name}`;
          const invalid = webFieldMatches(error?.field, field.name);
          const describedBy = [field.hint ? `${fieldId}-hint` : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
          if (structured.has(field.control)) return <div key={field.name} className={styles.field}>
            <WebStructuredFields kind={field.control as WebStructuredKind} name={field.name} id={fieldId} label={field.label} value={values[field.name]} onChange={value => change(field.name, value)} describedBy={describedBy} errorField={error?.field} />
            {field.hint && <p id={`${fieldId}-hint`} className={styles.hint}>{field.hint}</p>}
          </div>;
          const props = {
            id: fieldId, name: field.name, "data-web-field": field.name, className: styles.input,
            required: !field.optional, "aria-describedby": describedBy, "aria-invalid": invalid || undefined,
          };
          const controlled = {
            ...props, value: typeof values[field.name] === "string" ? values[field.name] as string : "",
            onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(field.name, event.target.value),
          };
          return <div key={field.name} className={styles.field}>
            <label htmlFor={fieldId}>{field.label}{field.optional && <span className={styles.optional}> (optional)</span>}</label>
            {field.control === "file" ? <input {...props} ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" onChange={event => { invalidate(); file.current = event.target.files?.[0] ?? null; }} />
              : field.control === "select" ? <select {...controlled}>{field.options?.map(option => <option key={option} value={option}>{definition.id === "favicon-generator" && field.name === "size" ? `${option}×${option}` : option}</option>)}</select>
                : field.control === "textarea" ? <textarea {...controlled} rows={8} className={`${styles.input} ${styles.textarea}`} wrap="off" placeholder={field.placeholder} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                  : <input {...controlled} type={field.control === "password" || definition.id === "url-parser" && field.name === "url" ? "password" : "text"} placeholder={field.placeholder} autoComplete="off" autoCapitalize="off" spellCheck={false} />}
            {field.hint && <p id={`${fieldId}-hint`} className={styles.hint}>{field.hint}</p>}
          </div>;
        })}{contract.notices.map(text => <p className={styles.note} key={text}>{text}</p>)}</div>
        <div className={styles.actions}><button type="submit" className="button primary" disabled={busy}>{busy ? "Processing…" : contract.action}</button><button type="button" className="button" onClick={() => load(contract.defaults)}>Clear</button></div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-result`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-result`}>{outputLabel}</h2>{(result || image) && <div className={styles.resultActions}>
          {contract.copy && result && <button type="button" className="button" aria-label={`Copy ${outputLabel}`} onClick={() => void copy()}>Copy</button>}
          {contract.downloadExtension && <button type="button" className="button" onClick={download}>Download {contract.downloadExtension.toUpperCase()}</button>}
        </div>}</div>
        {result || image ? <div className={styles.result}>
          {!!result?.warnings?.length && <div className={styles.warning} role="alert"><strong>Review before use</strong>{result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
          {image ? <figure className={styles.favicon}><img src={image.url} width={image.width} height={image.height} alt={`Generated ${image.width} by ${image.height} PNG favicon`} /><figcaption>{image.width} × {image.height} PNG · {image.blob.size} bytes</figcaption></figure>
            : result?.preview ? <article className={styles.preview} aria-label="Local Open Graph preview">
              <div className={styles.imagePlaceholder}><strong>Image placeholder</strong><p>Remote image loading is blocked by local privacy: no image request is sent.</p><span>{result.preview.imageUrl || "No image URL entered."}</span></div>
              <div className={styles.previewContent}><p>{result.preview.siteName}</p><h3>{result.preview.title}</h3><p>{result.preview.description}</p><p>{result.preview.url}</p></div>
            </article>
              : result?.data ? <div className={styles.structuredOutput} tabIndex={0} aria-label={`${outputLabel} value`}><StructuredResult value={result.data} label={outputLabel} /></div>
                : <pre className={styles.output} tabIndex={0} aria-label={`${outputLabel} value`}>{result?.text}</pre>}
        </div> : <p className={styles.empty}>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error.text}</p>}
    <p className={styles.status} role="status" aria-atomic="true">{notice}</p>
    {definition.pairedTool && <a className={styles.pairLink} href={`/tools/${definition.pairedTool}`}>Open {getWebDefinition(definition.pairedTool)?.name ?? "paired tool"}</a>}
    <p className={styles.privacy}>All processing stays in this browser. Inputs are not transmitted or saved.</p>
  </div>;
}

export default function WebStation({ toolId }: { toolId: WebToolId }) {
  const definition = getWebDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.id} definition={definition} />;
}
