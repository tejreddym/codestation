"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { getSpreadsheetDefinition, type SpreadsheetToolId } from "@/config/spreadsheet-tools";
import { useSafePathname, useSafeRouter } from "./useSafeNavigation";
import { capabilityForRoute, capabilitiesFor } from "@/config/conversion-capabilities";
import { useConverterSession } from "./ConverterSession";
import { SpreadsheetError, type SpreadsheetInfo, type SpreadsheetResult, type SpreadsheetValues } from "@/lib/tools/spreadsheet/types";
import { ingestTabularData, executeSqlOnTable, exportQueryResultToCsv, exportQueryResultToJson, type IngestedTable, type SqlQueryResult } from "@/lib/tools/spreadsheet/sql-engine";
import SpreadsheetControls from "./SpreadsheetControls";
import SpreadsheetPreview, { SpreadsheetData } from "./SpreadsheetPreview";
import { Button, ButtonLink } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { Field, Hint } from "./ui/Field";
import { Select, Textarea, TextInput } from "./ui/controls";
import { EmptyState } from "./ui/EmptyState";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
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
  const { copy: copyText } = useCopy();
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
    return () => { mounted.current = false; revision.current += 1; work.current?.abort(); inspection.current?.abort(); revokeDownloads(); };
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
    const ok = await copyText(result.text);
    if (!mounted.current || current !== revision.current) return;
    setNotice(ok ? "Generated text copied." : "Could not copy. Select the generated text and copy it manually.");
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
    <ToolLayout kind="form" className={styles.layout}>
      <Panel title={`${definition.name} input`} headingId={`${id}-input`} padded aria-busy={busy || inspecting}>
        <form ref={form} className={styles.form} onSubmit={submit} noValidate autoComplete="off" aria-labelledby={`${id}-input`} aria-describedby={`${id}-status${error ? ` ${id}-error` : ""}`}>
          {isConverter && <Field id={`${id}-output-format`} label="Output Format" hint={`Source: ${saved?.format ?? converter?.source} (selected route)`}>
            <Select id={`${id}-output-format`} value={converter?.target ?? ""} onChange={event => selectTarget(event.target.value)}>
              <option value="" disabled>Choose target</option>
              {targetOptions.map(target => <option key={target}>{target.toUpperCase()}</option>)}
            </Select>
          </Field>}
          <SpreadsheetControls id={id} fields={contract.fields} values={values} info={info} error={error} onChange={change} onFiles={(name, files) => void chooseFiles(name, files)} />
          {contract.notices.map((text, index) => <Hint key={index} className={styles.note}>{text}</Hint>)}
          <div className={ui.actions}>
            <Button type="submit" variant="primary" disabled={busy || inspecting}>{busy ? "Processing…" : contract.action}</Button>
            <Button onClick={clear}>Clear</Button>
            {busy && <Button onClick={() => { invalidate(); setNotice("Processing cancelled."); }}>Cancel</Button>}
          </div>
        </form>
      </Panel>
      <Panel
        title={outputs}
        headingId={`${id}-output`}
        padded
        aria-busy={busy}
        actions={result?.text !== undefined ? <Button size="sm" aria-label={`Copy ${contract.outputs[0] ?? "generated text"}`} onClick={() => void copy()}>Copy</Button> : undefined}
      >
        {result ? <div className={styles.result}>
          {!!result.warnings?.length && <div className={styles.warning} role="alert">{result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
          {result.text !== undefined && <pre className={ui.output} tabIndex={0} aria-label="Generated text">{result.text}</pre>}
          {result.preview && <SpreadsheetPreview id={id} preview={result.preview} switching={busy} onSheet={isViewer ? sheet => void process({ ...values, sheet }, true) : undefined} />}
          {Object.keys(result.data).length > 0 && <div aria-label={`${outputs} values`}><SpreadsheetData value={result.data} /></div>}
          {!!result.files?.length && <div className={ui.actions} aria-label="Generated files">{result.files.map((file, index) => <Button size="sm" key={index} onClick={() => download(file)}>Download {file.name}</Button>)}</div>}
        </div> : <EmptyState>Your result will appear after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</EmptyState>}
      </Panel>
    </ToolLayout>
    {error && <Callout kind="error" ref={errorRef} id={`${id}-error`} className={styles.error} tabIndex={-1}>{error.message}</Callout>}
    <StatusLine id={`${id}-status`} className={styles.status}>{notice}</StatusLine>
    {definition.pairedTool && <ButtonLink size="sm" className={styles.pairLink} href={`/tools/${definition.pairedTool}`}>Open {getSpreadsheetDefinition(definition.pairedTool)?.name ?? "paired tool"}</ButtonLink>}
    <PrivacyNote className={styles.privacy}>All processing stays in this browser. Files, names and cells are not transmitted or saved.</PrivacyNote>
  </div>;
}

const DEFAULT_SQL_DATA = `department,salary,status
Engineering,120000,active
Engineering,140000,active
Marketing,95000,active
HR,80000,inactive`;

const DEFAULT_SQL_QUERY = `SELECT department, COUNT(*), AVG(salary) FROM table WHERE status = 'active' GROUP BY department`;

const SAMPLE_SQL_QUERIES = [
  { label: "Acceptance (Group & Avg)", query: "SELECT department, COUNT(*), AVG(salary) FROM table WHERE status = 'active' GROUP BY department" },
  { label: "Select All (Limit 10)", query: "SELECT * FROM table LIMIT 10" },
  { label: "High Earners (Filter & Sort)", query: "SELECT department, salary FROM table WHERE salary > 90000 ORDER BY salary DESC" },
  { label: "Aggregations Summary", query: "SELECT COUNT(*) as [count], MIN(salary) as min_sal, MAX(salary) as max_sal, AVG(salary) as avg_sal FROM table" },
  { label: "Table alias 'data'", query: "SELECT * FROM data WHERE status = 'active'" },
];

function SpreadsheetSqlStation({ definition }: { definition: Definition }) {
  const id = `spreadsheet-${definition.id}`;
  const [dataText, setDataText] = useState(DEFAULT_SQL_DATA);
  const [query, setQuery] = useState(DEFAULT_SQL_QUERY);
  const [ingestedTable, setIngestedTable] = useState<IngestedTable | null>(null);
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { copy: copyText } = useCopy();

  function downloadText(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  // Ingest tabular data whenever dataText changes
  useEffect(() => {
    const trimmed = dataText.trim();
    if (!trimmed) {
      setIngestedTable(null);
      setResult(null);
      setError(null);
      setNotice("Enter CSV or TSV data to begin.");
      return;
    }
    setIsIngesting(true);
    try {
      const table = ingestTabularData(trimmed);
      setIngestedTable(table);
      setError(null);
      setNotice(`Ingested ${table.rowCount} row(s) in ${table.parseTimeMs}ms. Ready to query table.`);
    } catch (err) {
      setIngestedTable(null);
      setError(err instanceof Error ? err.message : String(err));
      setNotice("Data ingestion error.");
    } finally {
      setIsIngesting(false);
    }
  }, [dataText]);

  // Execute query against ingested table
  const runQuery = useCallback(async (tableToUse?: IngestedTable, queryToUse?: string) => {
    const activeTable = tableToUse ?? ingestedTable;
    const activeQuery = queryToUse ?? query;

    if (!activeTable) {
      setError("Please provide valid CSV or TSV data first.");
      return;
    }
    if (!activeQuery.trim()) {
      setError("Please enter an SQL query.");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setNotice("Executing query in browser…");
    try {
      const res = await executeSqlOnTable(activeTable, activeQuery);
      if (res.error) {
        setError(res.error);
        setResult(null);
        setNotice("Query execution error.");
      } else {
        setResult(res);
        setPageIndex(0);
        setError(null);
        setNotice(`Query returned ${res.rowCount} row(s) in ${res.executionTimeMs}ms.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
      setNotice("Query execution failed.");
    } finally {
      setIsExecuting(false);
    }
  }, [ingestedTable, query]);

  // Execute initial query once table is ingested
  useEffect(() => {
    if (ingestedTable && !result && !error) {
      void runQuery(ingestedTable, query);
    }
  }, [ingestedTable, result, error, runQuery, query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void runQuery();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsIngesting(true);
    setNotice(`Reading ${file.name}…`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = typeof event.target?.result === "string" ? event.target.result : "";
      setDataText(text);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      setError(`Failed to read file: ${file.name}`);
      setIsIngesting(false);
    };
    reader.readAsText(file);
  };

  const handleCopyCsv = async () => {
    if (!result) return;
    const csv = exportQueryResultToCsv(result);
    const ok = await copyText(csv);
    setNotice(ok ? "Results copied as CSV." : "Could not copy to clipboard.");
  };

  const handleCopyJson = async () => {
    if (!result) return;
    const json = exportQueryResultToJson(result);
    const ok = await copyText(json);
    setNotice(ok ? "Results copied as JSON." : "Could not copy to clipboard.");
  };

  const handleDownloadCsv = () => {
    if (!result) return;
    const csv = exportQueryResultToCsv(result);
    downloadText(csv, "query_results.csv", "text/csv;charset=utf-8;");
    setNotice("CSV file download requested.");
  };

  const handleDownloadJson = () => {
    if (!result) return;
    const json = exportQueryResultToJson(result);
    downloadText(json, "query_results.json", "application/json;charset=utf-8;");
    setNotice("JSON file download requested.");
  };

  const handleReset = () => {
    setDataText(DEFAULT_SQL_DATA);
    setQuery(DEFAULT_SQL_QUERY);
    setPageIndex(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Pagination slice
  const totalRows = result?.rowCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const startRowIdx = currentPage * pageSize;
  const endRowIdx = Math.min(startRowIdx + pageSize, totalRows);
  const visibleRows = result ? result.rows.slice(startRowIdx, endRowIdx) : [];

  return (
    <div className={styles.station}>
      <ToolLayout kind="form" className={styles.layout}>
        <Panel
          title={definition.name}
          headingId={`${id}-input`}
          padded
          aria-busy={isIngesting || isExecuting}
          actions={<>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isIngesting}>Upload CSV/TSV</Button>
            <Button size="sm" onClick={handleReset}>Reset Sample</Button>
          </>}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <div className={styles.form}>
            <Field id={`${id}-data`} label="CSV or TSV Data (Table: 'table' / 'data')">
              <Textarea
                id={`${id}-data`}
                className={ui.mono}
                rows={6}
                value={dataText}
                spellCheck={false}
                autoCapitalize="off"
                placeholder="Paste CSV or TSV data here..."
                onChange={(e) => setDataText(e.target.value)}
              />
            </Field>

            {ingestedTable && (
              <div className={styles.schema} aria-label="Detected table schema">
                <strong>Table &apos;table&apos;:</strong>
                <span>{ingestedTable.rowCount} row(s)</span>
                {ingestedTable.columns.map((col) => (
                  <span key={col.name} className={styles.schemaBadge}>
                    {col.name}{" "}
                    <span className={col.type === "numeric" ? styles.typeNumeric : styles.typeText}>
                      ({col.type})
                    </span>
                  </span>
                ))}
              </div>
            )}

            <Field id={`${id}-query`} label="SQL Query" hint="Shortcut: Cmd/Ctrl + Enter">
              <Textarea
                id={`${id}-query`}
                className={ui.mono}
                rows={4}
                value={query}
                spellCheck={false}
                autoCapitalize="off"
                placeholder="SELECT ... FROM table WHERE ..."
                onKeyDown={handleKeyDown}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>

            <fieldset className={ui.fieldset}>
              <legend className={ui.legend}>Sample Queries</legend>
              <div className={styles.sampleBar}>
                {SAMPLE_SQL_QUERIES.map((sq, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    onClick={() => {
                      setQuery(sq.query);
                      void runQuery(ingestedTable ?? undefined, sq.query);
                    }}
                  >
                    {sq.label}
                  </Button>
                ))}
              </div>
            </fieldset>

            <div className={ui.actions}>
              <Button variant="primary" disabled={isExecuting || isIngesting} onClick={() => void runQuery()}>
                {isExecuting && <span className={styles.spinner} aria-hidden="true" />}
                {isExecuting ? "Executing…" : "Execute SQL"}
              </Button>
              <Button disabled={isExecuting} onClick={() => setQuery("")}>Clear Query</Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Query Results"
          headingId={`${id}-output`}
          padded
          aria-busy={isExecuting}
          actions={result && result.rowCount > 0 ? <>
            <Button size="sm" onClick={handleCopyCsv}>Copy CSV</Button>
            <Button size="sm" onClick={handleCopyJson}>Copy JSON</Button>
            <Button size="sm" onClick={handleDownloadCsv}>Download CSV</Button>
            <Button size="sm" onClick={handleDownloadJson}>Download JSON</Button>
          </> : undefined}
        >
          {isExecuting ? (
            <p className={styles.status}>
              <span className={styles.spinner} aria-hidden="true" /> Executing SQL query in browser…
            </p>
          ) : result ? (
            <div className={styles.result}>
              <span className={styles.metrics}>
                {result.rowCount} row(s) returned in {result.executionTimeMs}ms ({result.columns.length} columns)
              </span>

              {result.columns.length > 0 ? (
                <>
                  <div className={ui.tableWrap} tabIndex={0} aria-label="Query results table">
                    <table data-testid="sql-results-table" className={ui.table}>
                      <thead>
                        <tr>
                          {result.columns.map((col, idx) => (
                            <th key={idx} scope="col">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.length > 0 ? (
                          visibleRows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx}>
                                  {cell === null || cell === undefined ? (
                                    <span className={styles.nullCell}>NULL</span>
                                  ) : typeof cell === "boolean" ? (
                                    cell ? "TRUE" : "FALSE"
                                  ) : (
                                    String(cell)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={result.columns.length} className={styles.emptyCell}>Query returned 0 rows.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalRows > 0 && (
                    <div className={styles.pagination}>
                      <div className={styles.paginationControls}>
                        <Button size="sm" disabled={currentPage === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>← Previous</Button>
                        <span>Page {currentPage + 1} of {totalPages} ({startRowIdx + 1}–{endRowIdx} of {totalRows})</span>
                        <Button size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}>Next →</Button>
                      </div>
                      <div className={styles.pageSize}>
                        <Field id={`${id}-pagesize`} label="Rows per page:">
                          <Select
                            id={`${id}-pagesize`}
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setPageIndex(0);
                            }}
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState>Query executed successfully but produced no output columns.</EmptyState>
              )}
            </div>
          ) : (
            <EmptyState>Your query results will appear here. Press Execute SQL or Cmd/Ctrl + Enter to run.</EmptyState>
          )}
        </Panel>
      </ToolLayout>

      {error && <Callout kind="error" id={`${id}-error`} className={styles.error}>{error}</Callout>}

      <StatusLine id={`${id}-status`} className={styles.status}>{notice}</StatusLine>

      <PrivacyNote className={styles.privacy}>All SQL queries execute 100% in-browser using AlaSQL. Zero server uploads, tracking, or network roundtrips.</PrivacyNote>
    </div>
  );
}

export default function SpreadsheetStation({ toolId }: { toolId: SpreadsheetToolId }) {
  const definition = getSpreadsheetDefinition(toolId);
  if (!definition) return null;
  if (toolId === "spreadsheet-sql-query") {
    return <SpreadsheetSqlStation key={definition.id} definition={definition} />;
  }
  return <Station key={definition.id} definition={definition} />;
}
