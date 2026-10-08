"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { getApiDefinition, type ApiToolId } from "@/config/api-tools";
import { ApiError, type ApiResult, type ApiValues } from "@/lib/tools/api/types";
import ApiStructuredFields, { apiFieldMatches, type ApiStructuredKind } from "./ApiStructuredFields";
import styles from "./ApiStation.module.css";

type Definition = NonNullable<ReturnType<typeof getApiDefinition>>;
const conversionTools = new Set(["curl-to-fetch", "fetch-to-curl", "curl-to-axios", "curl-to-python-requests"]);
const structured = new Set(["entries", "headers", "parameters", "fields", "arguments", "selectedFields"]);
const clone = (values: Readonly<ApiValues>): ApiValues => JSON.parse(JSON.stringify(values)) as ApiValues;

function checkBudget(value: unknown, output = false) {
  let nodes = 0; let total = 0;
  function visit(item: unknown, depth: number) {
    if (++nodes > 20000 || depth > 16) throw new ApiError("The structured value exceeds the local processing limit.");
    if (typeof item === "string") {
      if (!output && item.length > 200000) throw new ApiError("An input exceeds the 200,000-character field limit.");
      total += item.length;
    } else if (Array.isArray(item)) {
      if (!output && item.length > 1000) throw new ApiError("An input exceeds the 1,000-row local processing limit.");
      for (const entry of item) visit(entry, depth + 1);
    } else if (item && typeof item === "object") {
      for (const [key, entry] of Object.entries(item)) { total += key.length; visit(entry, depth + 1); }
    }
    if (total > (output ? 4000000 : 1000000)) throw new ApiError(`${output ? "Output" : "Input"} exceeds the local processing limit.`);
  }
  visit(value, 0);
}

function Station({ definition }: { definition: Definition }) {
  const { apiContract: contract } = definition;
  const id = `api-${definition.id}`;
  const tester = definition.id === "api-request-tester";
  const rest = definition.id === "rest-api-request-builder";
  const outputLabel = contract.outputs.join(" · ");
  const [values, setValues] = useState<ApiValues>(() => clone(contract.defaults));
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current += 1; controller.current?.abort(); controller.current = null; };
  }, []);

  useEffect(() => {
    if (!error) return;
    const path = error.field?.replace(/\[(\d+)\]/g, ".$1");
    const controls = Array.from(form.current?.querySelectorAll<HTMLElement>("[data-api-field]") ?? []);
    const control = path ? controls.find(node => node.dataset.apiField === path) ?? controls.find(node => node.dataset.apiField?.startsWith(`${path}.`)) : undefined;
    if (control) control.focus(); else errorRef.current?.focus();
  }, [error]);

  function invalidate() {
    revision.current += 1;
    controller.current?.abort(); controller.current = null;
    setResult(null); setError(null); setNotice(""); setBusy(false);
  }

  function change(name: string, value: unknown) {
    invalidate(); setValues(current => ({ ...current, [name]: value }));
  }

  function load(next: Readonly<ApiValues>) {
    invalidate(); setValues(clone({ ...contract.defaults, ...next }));
  }

  function cancel() {
    invalidate(); setNotice("Aborted. Request cancelled.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    invalidate();
    const currentRevision = revision.current;
    const snapshot = clone(values);
    const active = () => mounted.current && revision.current === currentRevision;
    const requestController = tester ? new AbortController() : null;
    controller.current = requestController;
    setBusy(true); setNotice(tester ? "Sending…" : "Processing locally…");
    try {
      for (const field of contract.fields) {
        try { checkBudget(snapshot[field.name]); }
        catch (cause) { throw new ApiError(cause instanceof Error ? cause.message : "Input exceeds the local processing limit.", field.name); }
      }
      checkBudget(snapshot);
      let next: ApiResult;
      if (tester) {
        const { executeApiRequest } = await import("@/lib/tools/api/request");
        if (!active()) return;
        next = await executeApiRequest(snapshot, requestController!.signal);
      } else if (conversionTools.has(definition.id)) {
        const { convertApi } = await import("@/lib/tools/api/curl");
        if (!active()) return;
        next = await convertApi(definition.id, snapshot);
      } else {
        const { localApi } = await import("@/lib/tools/api/local");
        if (!active()) return;
        next = await localApi(definition.id, snapshot);
      }
      if (!active()) return;
      checkBudget(next, true);
      if (tester) next = { ...next, text: JSON.stringify({ statusCode: next.data?.statusCode, statusText: next.data?.statusText, responseHeaders: next.data?.responseHeaders, responseBody: next.data?.responseBody, responseTime: next.data?.responseTime }, null, 2) };
      setResult(next);
      if (tester) {
        const status = Number(next.data?.statusCode ?? next.data?.status);
        const state = next.data?.state;
        setNotice(state === "Aborted" ? "Aborted. Request cancelled." : state === "Network or CORS error" ? "Network/CORS error." : status >= 400 || next.data?.ok === false ? `HTTP error${Number.isFinite(status) && status > 0 ? ` ${status}` : ""}. Response received.` : "Success. Response received.");
      } else setNotice("Result ready.");
    } catch (cause) {
      if (!active()) return;
      if (requestController?.signal.aborted || cause && typeof cause === "object" && "name" in cause && cause.name === "AbortError") setNotice("Aborted. Request cancelled.");
      else {
        const apiError = cause instanceof ApiError;
        const text = apiError ? cause.message : tester ? "Network/CORS error. The browser could not read a response." : "Could not process these inputs. Check the supported format and try again.";
        setError({ text, field: apiError ? cause.field : undefined });
        setNotice(tester && !apiError ? "Network/CORS error." : "Check the input error.");
      }
    } finally {
      if (active()) { setBusy(false); controller.current = null; }
    }
  }

  async function copy(text: string) {
    const currentRevision = revision.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (mounted.current && revision.current === currentRevision) setNotice(tester ? "Response copied." : "Result copied.");
    } catch {
      if (mounted.current && revision.current === currentRevision) setNotice("Could not copy. Select the result and copy it manually.");
    }
  }

  const curl = typeof result?.data?.curl === "string" ? result.data.curl : undefined;
  const fetchCode = typeof result?.data?.fetch === "string" ? result.data.fetch : undefined;
  const copyField = (contract as { copyField?: string }).copyField;
  const contractCopy = copyField ? result?.data?.[copyField] : undefined;
  const copyValue = result?.data?.valid === false ? "" : result?.copyText ?? (typeof contractCopy === "string" ? contractCopy : contractCopy !== undefined ? JSON.stringify(contractCopy, null, 2) : tester && typeof result?.data?.responseBody === "string" ? result.data.responseBody : result?.text ?? "");
  const canCopy = result && contract.copy && result.data?.valid !== false && (!tester || !["Aborted", "Network or CORS error"].includes(String(result.data?.state)));

  return <div className={styles.station}>
    <div className={styles.layout}>
      <form ref={form} className={styles.panel} onSubmit={event => void submit(event)} noValidate autoComplete="off" aria-labelledby={`${id}-input-heading`}>
        <div className={styles.panelHead}><h2 id={`${id}-input-heading`}>{definition.name} input</h2><button type="button" className="button" onClick={() => load(contract.example)}>Load example</button></div>
        <div className={styles.fields}>{contract.fields.map(field => {
          const fieldId = `${id}-${field.name}`;
          const invalid = apiFieldMatches(error?.field, field.name);
          const describedBy = [field.hint ? `${fieldId}-hint` : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
          if (structured.has(field.control)) return <div key={field.name} className={styles.field}>
            <ApiStructuredFields kind={field.control as ApiStructuredKind} name={field.name} id={fieldId} label={field.label} value={values[field.name]} onChange={value => change(field.name, value)} describedBy={describedBy} errorField={error?.field} />
            {field.hint && <p id={`${fieldId}-hint`} className={styles.hint}>{field.hint}</p>}
          </div>;
          const controlled = {
            id: fieldId, name: field.name, "data-api-field": field.name, className: styles.input,
            required: !field.optional, "aria-describedby": describedBy, "aria-invalid": invalid || undefined,
            value: typeof values[field.name] === "string" ? values[field.name] as string : "",
            onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(field.name, event.target.value),
          };
          return <div key={field.name} className={styles.field}>
            <label htmlFor={fieldId}>{field.label}{field.optional && <span className={styles.optional}> (optional)</span>}</label>
            {field.control === "select" ? <select {...controlled}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
              : field.control === "textarea" ? <textarea {...controlled} rows={7} className={`${styles.input} ${styles.textarea}`} wrap="off" placeholder={field.placeholder} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                : <input {...controlled} type={field.control === "password" || field.name === "password" || field.name === "token" ? "password" : "text"} placeholder={field.placeholder} autoComplete="off" autoCapitalize="off" spellCheck={false} />}
            {field.hint && <p id={`${fieldId}-hint`} className={styles.hint}>{field.hint}</p>}
          </div>;
        })}{contract.notices.map(text => <p className={styles.note} key={text}>{text}</p>)}</div>
        <div className={styles.actions}><button type="submit" className="button primary" disabled={busy}>{busy ? tester ? "Sending…" : "Processing…" : contract.action}</button>
          {tester && busy && <button type="button" className="button" onClick={cancel}>Cancel</button>}
          <button type="button" className="button" onClick={() => load(contract.defaults)}>Clear</button></div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-result`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-result`}>{outputLabel}</h2>{canCopy && <div className={styles.resultActions}>
          {rest ? <><button type="button" className="button" disabled={curl === undefined} onClick={() => curl !== undefined && void copy(curl)}>Copy cURL</button><button type="button" className="button" disabled={fetchCode === undefined} onClick={() => fetchCode !== undefined && void copy(fetchCode)}>Copy Fetch</button></>
            : <button type="button" className="button" aria-label={tester ? "Copy Response" : `Copy ${outputLabel}`} onClick={() => void copy(copyValue)}>{tester ? "Copy Response" : "Copy"}</button>}
        </div>}</div>
        {result ? <div className={styles.result}>
          {!!result.warnings?.length && <div className={styles.warning} role="alert">{result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
          {rest && curl !== undefined && fetchCode !== undefined ? <>{typeof result.data?.summary === "string" && <div><h3>Request summary</h3><pre className={styles.output} tabIndex={0} aria-label="Request summary value">{result.data.summary}</pre></div>}<div><h3>cURL</h3><pre className={styles.output} tabIndex={0} aria-label="cURL value">{curl}</pre></div><div><h3>Fetch</h3><pre className={styles.output} tabIndex={0} aria-label="Fetch value">{fetchCode}</pre></div></>
            : <><pre className={styles.output} tabIndex={0} aria-label={`${outputLabel} value`}>{!tester && copyField ? copyValue : result.text}</pre>{!tester && copyField && contract.outputs.length > 1 && <pre className={styles.output} tabIndex={0} aria-label={`${outputLabel} details`}>{result.text}</pre>}</>}
        </div> : <p className={styles.empty}>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error.text}</p>}
    <p className={styles.status} role="status" aria-atomic="true">{notice}</p>
    {definition.pairedTool && <a className={styles.pairLink} href={`/tools/${definition.pairedTool}`}>Open {getApiDefinition(definition.pairedTool)?.name ?? "paired tool"}</a>}
    <p className={styles.privacy}>{tester ? "Only Send Request contacts the supplied endpoint directly from this browser. Inputs and responses are not saved. Browser CORS rules apply." : "All processing stays in this browser. Inputs are not transmitted or saved."}</p>
  </div>;
}

export default function ApiStation({ toolId }: { toolId: ApiToolId }) {
  const definition = getApiDefinition(toolId);
  return definition ? <Station key={definition.id} definition={definition} /> : null;
}
