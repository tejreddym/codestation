"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { getSpreadsheetDefinition, type SpreadsheetToolId } from "@/config/spreadsheet-tools";
import { useSafePathname, useSafeRouter } from "./useSafeNavigation";
import { capabilityForRoute, capabilitiesFor } from "@/config/conversion-capabilities";
import { useConverterSession } from "./ConverterSession";
import { SpreadsheetError, type SpreadsheetInfo, type SpreadsheetResult, type SpreadsheetValues } from "@/lib/tools/spreadsheet/types";
import SpreadsheetControls from "./SpreadsheetControls";
import SpreadsheetPreview, { SpreadsheetData } from "./SpreadsheetPreview";
import styles from "./SpreadsheetStation.module.css";

type Definition = NonNullable<ReturnType<typeof getSpreadsheetDefinition>>;
type InputError = { message: string; field?: string };

function Station({ definition }: { definition: Definition }) {
  const contract = definition.localContract;
  const id = `spreadsheet-${definition.id}`;
  const [values, setValues] = useState<SpreadsheetValues>(() => ({ ...contract.defaults }));
  const [info, setInfo] = useState<SpreadsheetInfo | null>(null);
  const [result, setResult] = useState<SpreadsheetResult | null>(null);
  const [error, setError] = useState<InputError | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const revision = useRef(0);
  const mounted = useRef(false);
  const work = useRef<AbortController | null>(null);
  const inspection = useRef<AbortController | null>(null);
  const downloadUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const isViewer = definition.id.endsWith("viewer");
  const pathname = useSafePathname();
  const router = useSafeRouter();
  const session = useConverterSession();
  const converter = capabilityForRoute(pathname);
  const isConverter = converter?.family === "spreadsheet";
  const saved = isConverter ? session.get("spreadsheet") : undefined;
  const targetOptions = isConverter ? capabilitiesFor("spreadsheet", saved?.format ?? converter.source).map(item => item.target) : [];

  function revokeDownloads() {
    for (const [url, timer] of downloadUrls.current) { clearTimeout(timer); URL.revokeObjectURL(url); }
    downloadUrls.current.clear();
  }
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current++; work.current?.abort(); inspection.current?.abort(); revokeDownloads(); };
  }, []);
  useLayoutEffect(() => {
    if (!error) return;
    const control = Array.from(form.current?.querySelectorAll<HTMLElement>("[data-spreadsheet-field]") ?? []).find(node => node.dataset.spreadsheetField === error.field);
    if (control) control.focus(); else errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!saved) return;
    if (saved.value instanceof File && definition.localContract.fields.some(field => field.name === "file") && !info) void chooseFiles("file", [saved.value]);
    if (typeof saved.value === "string" && definition.localContract.fields.some(field => field.name === "source")) setValues(previous => ({ ...previous, source: saved.value }));
  // Source sessions intentionally live above the route boundary and are memory-only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id]);

  function invalidate() {
    revision.current++; work.current?.abort(); work.current = null; inspection.current?.abort(); inspection.current = null;
    revokeDownloads(); setResult(null); setError(null); setNotice(""); setBusy(false); setInspecting(false);
  }
  function resetFileElement(name: string) {
    const input = form.current?.elements.namedItem(name);
    if (input instanceof HTMLInputElement) input.value = "";
  }
  function change(name: string, value: unknown) {
    invalidate();
    if (name === "source") resetFileElement("textFile");
    setValues(previous => {
      const next = { ...previous, [name]: value };
      if (name === "source") next.textFile = null;
      if (name === "sheet") { next.column = ""; next.keys = []; next.order = (info?.sheets.find(sheet => sheet.name === value)?.headers ?? []).map((_, index) => String(index)); }
      return next;
    });
    if (name === "source" && isConverter && typeof value === "string") session.set({ family: "spreadsheet", format: converter.source, value });
  }
  async function chooseFiles(name: string, files: File[]) {
    invalidate();
    const file = files[0] ?? null;
    setValues(previous => ({ ...previous, [name]: name === "files" ? files : file, ...(name === "textFile" ? { source: "" } : {}), ...(name === "file" ? { sheet: "", column: "", keys: [], order: [] } : {}) }));
    if (isConverter && file) {
      const looksXlsx = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || /\.xlsx$/i.test(file.name);
      if (name === "textFile" && looksXlsx) { session.set({ family: "spreadsheet", format: "xlsx", value: file }); router.replace("/tools/excel-to-csv"); return; }
      session.set({ family: "spreadsheet", format: name === "textFile" ? (converter.source === "tsv" ? "tsv" : "csv") : "xlsx", value: file });
    }
    if (name !== "file") return;
    setInfo(null);
    if (!file) return;
    const controller = new AbortController(); inspection.current = controller;
    const current = revision.current;
    const active = () => mounted.current && revision.current === current && !controller.signal.aborted;
    setInspecting(true); setNotice("Reading local workbook…");
    try {
      const { inspectSpreadsheet } = await import("@/lib/tools/spreadsheet/client");
      if (!active()) return;
      const next = await inspectSpreadsheet(file, controller.signal);
      if (!active()) return;
      if (!next.sheets.length) throw new SpreadsheetError("This workbook has no readable sheets.", "file");
      setInfo(next);
      setValues(previous => ({ ...previous, sheet: next.sheetNames[0], column: "", keys: [], order: next.sheets[0].headers.map((_, index) => String(index)) }));
      setNotice("Local workbook ready. Choose the action to process it.");
    } catch (cause) {
      if (active()) { setError(cause instanceof SpreadsheetError ? { message: cause.message, field: cause.field ?? "file" } : { message: "Could not read this local workbook. Choose a supported XLSX file.", field: "file" }); setNotice(""); }
    } finally { if (active()) { setInspecting(false); inspection.current = null; } }
  }
  function clear() {
    invalidate(); setInfo(null); setValues({ ...contract.defaults });
    for (const input of form.current?.querySelectorAll<HTMLInputElement>("input[type=file]") ?? []) input.value = "";
    if (isConverter) session.clear("spreadsheet");
  }
  function selectTarget(target: string) {
    const source = saved?.format ?? converter?.source;
    const next = source && capabilitiesFor("spreadsheet", source).find(item => item.target === target);
    if (next && next.route !== pathname) router.push(next.route);
  }
  function validate(snapshot: SpreadsheetValues) {
    const alternatives = contract.fields.some(field => field.name === "textFile");
    for (const field of contract.fields) {
      const value = snapshot[field.name];
      if (field.name === "file" && !value) throw new SpreadsheetError("Choose a local XLSX workbook.", "file");
      if (field.name === "files" && (!Array.isArray(value) || value.length < 2)) throw new SpreadsheetError("Choose at least two local XLSX workbooks.", "files");
      if (field.name === "source" && alternatives && snapshot.textFile) continue;
      if (field.name === "textFile" || field.optional || ["keys", "order", "file", "files"].includes(field.name)) continue;
      if (value === undefined || value === null || String(value).trim() === "") throw new SpreadsheetError(`${field.label} is required.`, field.name);
    }
    if (contract.fields.some(field => field.name === "file") && !info) throw new SpreadsheetError("Choose a readable local XLSX workbook first.", "file");
  }
  async function process(snapshot: SpreadsheetValues, keepResult = false) {
    if (!keepResult) invalidate(); else { revision.current++; work.current?.abort(); revokeDownloads(); setError(null); }
    const current = revision.current;
    const controller = new AbortController(); work.current = controller;
    const active = () => mounted.current && revision.current === current && !controller.signal.aborted;
    setBusy(true); setNotice("Processing locally…");
    try {
      validate(snapshot);
      const { runSpreadsheet } = await import("@/lib/tools/spreadsheet/client");
      if (!active()) return;
      const next = await runSpreadsheet(definition.id, snapshot, controller.signal);
      if (!active()) return;
      setResult(next); setNotice("Result ready.");
    } catch (cause) {
      if (active()) { setError(cause instanceof SpreadsheetError ? { message: cause.message, field: cause.field } : { message: "Could not process the spreadsheet. Check the file and inputs." }); setNotice("Check the input error."); }
    } finally { if (active()) { setBusy(false); work.current = null; } }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void process({ ...values }); }
  async function copy() {
    if (result?.text === undefined) return;
    const current = revision.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(result.text);
      if (mounted.current && current === revision.current) setNotice("Generated text copied.");
    } catch { if (mounted.current && current === revision.current) setNotice("Could not copy. Select the generated text and copy it manually."); }
  }
  function download(file: NonNullable<SpreadsheetResult["files"]>[number]) {
    let url = "";
    try {
      url = URL.createObjectURL(file.blob);
      const owned = url;
      const timer = setTimeout(() => { if (downloadUrls.current.delete(owned)) URL.revokeObjectURL(owned); }, 1000);
      downloadUrls.current.set(url, timer);
      const link = document.createElement("a"); link.href = url; link.download = file.name;
      document.body.appendChild(link); try { link.click(); } finally { link.remove(); }
      setNotice("Download requested.");
    } catch { if (url && downloadUrls.current.has(url)) { clearTimeout(downloadUrls.current.get(url)); downloadUrls.current.delete(url); URL.revokeObjectURL(url); } setNotice("Could not download the result. Try again."); }
  }
  const outputs = contract.outputs.join(" · ");
  return <div className={styles.station}>
    <div className={styles.layout}>
      <form ref={form} className={styles.panel} onSubmit={submit} noValidate autoComplete="off" aria-labelledby={`${id}-input`} aria-describedby={`${id}-status${error ? ` ${id}-error` : ""}`} aria-busy={busy || inspecting}>
        <div className={styles.panelHead}><h2 id={`${id}-input`}>{definition.name} input</h2>{isConverter && <label>Output Format <select id={`${id}-output-format`} className={styles.input} value={converter?.target ?? ""} onChange={event => selectTarget(event.target.value)}><option value="" disabled>Choose target</option>{targetOptions.map(target => <option key={target}>{target.toUpperCase()}</option>)}</select><small>Source: {saved?.format ?? converter?.source} (selected route)</small></label>}</div>
        <SpreadsheetControls id={id} fields={contract.fields} values={values} info={info} error={error} onChange={change} onFiles={(name, files) => void chooseFiles(name, files)} />
        <div className={styles.fields}>{contract.notices.map((text, index) => <p key={index} className={styles.note}>{text}</p>)}</div>
        <div className={`${styles.actions} ${styles.formActions}`}><button type="submit" className="button primary" disabled={busy || inspecting}>{busy ? "Processing…" : contract.action}</button><button type="button" className="button" onClick={clear}>Clear</button>{busy && <button type="button" className="button" onClick={() => { invalidate(); setNotice("Processing cancelled."); }}>Cancel</button>}</div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-output`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-output`}>{outputs}</h2>{result?.text !== undefined && <button type="button" className="button" aria-label={`Copy ${contract.outputs[0] ?? "generated text"}`} onClick={() => void copy()}>Copy</button>}</div>
        {result ? <div className={styles.result}>
          {!!result.warnings?.length && <div className={styles.warning} role="alert">{result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
          {result.text !== undefined && <pre className={styles.output} tabIndex={0} aria-label="Generated text">{result.text}</pre>}
          {result.preview && <SpreadsheetPreview id={id} preview={result.preview} switching={busy} onSheet={isViewer ? sheet => void process({ ...values, sheet }, true) : undefined} />}
          {Object.keys(result.data).length > 0 && <div aria-label={`${outputs} values`}><SpreadsheetData value={result.data} /></div>}
          {!!result.files?.length && <div className={styles.actions} aria-label="Generated files">{result.files.map((file, index) => <button key={index} type="button" className="button" onClick={() => download(file)}>Download {file.name}</button>)}</div>}
        </div> : <p className={styles.empty}>Your result will appear after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error.message}</p>}
    <p id={`${id}-status`} className={styles.status} role="status" aria-atomic="true">{notice}</p>
    {definition.pairedTool && <a className={styles.pairLink} href={`/tools/${definition.pairedTool}`}>Open {getSpreadsheetDefinition(definition.pairedTool)?.name ?? "paired tool"}</a>}
    <p className={styles.privacy}>All processing stays in this browser. Files, names and cells are not transmitted or saved.</p>
  </div>;
}

export default function SpreadsheetStation({ toolId }: { toolId: SpreadsheetToolId }) {
  const definition = getSpreadsheetDefinition(toolId);
  return definition ? <Station key={definition.id} definition={definition} /> : null;
}
