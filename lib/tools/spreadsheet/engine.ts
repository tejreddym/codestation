import type ExcelJS from "exceljs";
import { parseCsv, stringifyCsv as serializeCsv } from "../json-data/csv";
import { LIMITS, cancelled, dimensions, validateXlsx } from "./archive";
import { SpreadsheetError, type SpreadsheetInfo, type SpreadsheetResult, type SpreadsheetValues } from "./types";

type Book = ExcelJS.Workbook;
type Sheet = ExcelJS.Worksheet;
type Value = ExcelJS.CellValue;
type Output = NonNullable<SpreadsheetResult["files"]>[number];
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const retention = "XLSX output retains cell values, formulas, supported cell styles and row/column sizing. Other workbook metadata, merges, charts, images, tables, validations, comments, print settings and named ranges are not retained. Hyperlinks are flattened to their displayed text.";
const formulaWarning = "Formulas and cached results are retained without recalculation. Formula references are not rewritten when rows, columns or sheets change; cross-sheet references can refer to absent or renamed sheets.";
const injectionWarning = "Text exports prefix string cells beginning with =, +, -, @ (including after whitespace/control characters) with an apostrophe to prevent spreadsheet formula injection. Native numeric values, including negative numbers, are unchanged.";

function outputBudget(outputs: Output[]): void {
  if (outputs.reduce((bytes, output) => bytes + output.blob.size, 0) > LIMITS.fileBytes) throw new SpreadsheetError("Combined generated files exceed the 16 MiB output limit. No partial files were returned.");
}

const ids = new Set([
  "csv-to-excel", "excel-to-csv", "json-to-excel", "excel-to-json", "tsv-to-excel", "excel-to-tsv", "xlsx-to-html",
  "spreadsheet-viewer", "sheet-extractor", "workbook-inspector", "spreadsheet-transposer", "spreadsheet-column-reorderer",
  "spreadsheet-row-filter", "spreadsheet-deduplicator", "spreadsheet-column-analyzer", "spreadsheet-empty-row-cleaner",
  "spreadsheet-empty-column-cleaner", "workbook-merger", "workbook-splitter", "spreadsheet-split-by-column",
]);

async function library() {
  const excelModule = await import("exceljs");
  return excelModule.default ?? excelModule;
}

function string(values: SpreadsheetValues, name: string, fallback = ""): string {
  const value = values[name];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new SpreadsheetError(`Expected text for ${name}.`, name);
  if (value.length > LIMITS.textCharacters) throw new SpreadsheetError("Text inputs are limited to 2,000,000 characters.", name);
  return value;
}

function inputFile(value: unknown, field = "file"): File {
  // Structural check also supports genuine File instances from Node and browser realms.
  if (!value || typeof value !== "object" || !("arrayBuffer" in value) || typeof value.arrayBuffer !== "function"
    || !("size" in value) || typeof value.size !== "number" || !("name" in value) || typeof value.name !== "string") {
    throw new SpreadsheetError("Choose a local file first.", field);
  }
  if (value.size <= 0 || value.size > LIMITS.fileBytes) throw new SpreadsheetError("Choose a nonempty file no larger than 16 MiB.", field);
  return value as File;
}

function shape(sheet: Sheet): { rows: number; columns: number } {
  const rows = sheet.rowCount, columns = sheet.columnCount;
  dimensions(rows, columns);
  return { rows, columns };
}

function textValue(value: Value): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if ("formula" in value || "sharedFormula" in value) return textValue((value.result ?? null) as Value);
  if ("richText" in value) return value.richText.map(run => run.text).join("");
  if ("hyperlink" in value) return value.text;
  if ("error" in value) return value.error;
  return "";
}

function cellValue(cell: ExcelJS.Cell): Value {
  // ExcelJS's public .value getter drops falsy formula caches (0/false/"").
  // Its .result accessor retains them; explicitly restore before analysis/export.
  const value = cell.value;
  if (cell.type === 6 && value && typeof value === "object") return { ...value, result: cell.result } as Value;
  return value;
}

function resolved(value: Value): Value {
  if (value && typeof value === "object" && !(value instanceof Date) && ("formula" in value || "sharedFormula" in value)) return (value.result ?? null) as Value;
  return value;
}

function jsonValue(value: Value): string | number | boolean | null {
  const cached = resolved(value);
  if (cached === null || cached === undefined) return null;
  if (typeof cached === "number" || typeof cached === "boolean" || typeof cached === "string") return cached;
  return textValue(cached);
}

function empty(value: Value): boolean { return textValue(value) === ""; }

function formulas(sheet: Sheet): number {
  let count = 0;
  sheet.eachRow(row => row.eachCell(cell => { if (cell.type === 6) count++; }));
  return count;
}

function uniqueHeaders(sheet: Sheet, width: number): string[] {
  const used = new Set<string>();
  return Array.from({ length: width }, (_, i) => {
    const base = textValue(cellValue(sheet.getCell(1, i + 1))) || `Column ${i + 1}`;
    let name = base, suffix = 2;
    while (used.has(name)) name = `${base}_${suffix++}`;
    used.add(name); return name;
  });
}

function summary(book: Book): SpreadsheetInfo {
  return {
    sheetNames: book.worksheets.map(sheet => sheet.name),
    sheets: book.worksheets.map(sheet => {
      const { rows, columns } = shape(sheet);
      return { name: sheet.name, headers: uniqueHeaders(sheet, columns), rowCount: Math.max(0, rows - 1), columnCount: columns, formulaCount: formulas(sheet) };
    }),
  };
}

async function load(file: File, signal?: AbortSignal): Promise<Book> {
  cancelled(signal);
  const bytes = new Uint8Array(await inputFile(file).arrayBuffer());
  cancelled(signal);
  try { validateXlsx(bytes, signal); }
  catch (cause) { if (cause instanceof SpreadsheetError) throw cause; throw new SpreadsheetError("Malformed or unsupported XLSX ZIP/XML content.", "file"); }
  const Excel = await library();
  cancelled(signal);
  const book = new Excel.Workbook();
  try { await book.xlsx.load(bytes as unknown as ExcelJS.Buffer); }
  catch { throw new SpreadsheetError("The workbook could not be read as XLSX. Corrupt, encrypted and legacy formats are unsupported.", "file"); }
  cancelled(signal);
  if (!book.worksheets.length || book.worksheets.length > LIMITS.sheets) throw new SpreadsheetError("Choose a workbook with 1–64 worksheets.", "file");
  let area = 0;
  for (const sheet of book.worksheets) {
    const { rows, columns } = shape(sheet); area += rows * columns;
    if (area > LIMITS.cells) throw new SpreadsheetError("Combined worksheet ranges exceed 250,000 cells.", "file");
    sheet.eachRow(row => row.eachCell(cell => {
      if (textValue(cellValue(cell)).length > LIMITS.cellCharacters) throw new SpreadsheetError("Cell text is limited to 32,767 characters.", "file");
      if (cell.type === 6 && /\[[^\]]+\][^!]*!/.test(cell.formula)) throw new SpreadsheetError("External workbook formula links are unsupported.", "file");
    }));
  }
  return book;
}

export async function inspectSpreadsheet(file: File, signal?: AbortSignal): Promise<SpreadsheetInfo> {
  const book = await load(inputFile(file), signal);
  cancelled(signal);
  return summary(book);
}
export const inspect = inspectSpreadsheet;

function select(book: Book, values: SpreadsheetValues): Sheet {
  const name = string(values, "sheet", book.worksheets[0].name);
  const sheet = book.getWorksheet(name);
  if (!sheet) throw new SpreadsheetError("Choose an existing worksheet.", "sheet");
  return sheet;
}

function sheetName(name: string): string {
  if (!name || name.length > 31 || /[\\/*?:\[\]\x00-\x1f]/.test(name) || /^'|'$/.test(name) || name.toLowerCase() === "history") {
    throw new SpreadsheetError("Sheet names require 1–31 characters, no \\ / * ? : [ ] or control characters, no leading/trailing apostrophe, and cannot be History.", "sheetName");
  }
  return name;
}

function outputName(name: string): string {
  const clean = name.normalize("NFC").replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, "_").replace(/[. ]+$/g, "").replace(/^\.+/, "").slice(0, 100);
  const result = clean || "sheet";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result) ? `_${result}` : result;
}

function collisionName(base: string, used: Set<string>, max: number): string {
  let name = base.slice(0, max), suffix = 2;
  while (used.has(name.normalize("NFC").toLowerCase())) {
    const tail = `_${suffix++}`; name = `${base.slice(0, max - tail.length)}${tail}`;
  }
  used.add(name.normalize("NFC").toLowerCase()); return name;
}

function clone<T>(value: T): T { return structuredClone(value); }

function copyCell(source: ExcelJS.Cell, target: ExcelJS.Cell): void {
  const value = cellValue(source);
  if (source.type === 6) {
    // Materialize shared/array followers as ordinary formulas, preserving original references.
    const formula = source.formula;
    if (/\bHYPERLINK\s*\(/i.test(formula)) {
      // No clickable/executable link is emitted; cached display text remains.
      target.value = resolved(value);
    } else target.value = { formula, ...(source.result !== undefined ? { result: clone(source.result) } : {}) };
  } else if (value && typeof value === "object" && !(value instanceof Date) && "hyperlink" in value) target.value = value.text;
  else target.value = clone(value);
  target.style = clone(source.style);
}

function copyGrid(source: Sheet, target: Sheet, rowIndexes: number[], columnIndexes: number[], transposed = false): void {
  dimensions(transposed ? columnIndexes.length : rowIndexes.length, transposed ? rowIndexes.length : columnIndexes.length);
  for (let r = 0; r < rowIndexes.length; r++) {
    const sourceRow = source.getRow(rowIndexes[r]);
    if (!transposed) {
      const row = target.getRow(r + 1); row.height = sourceRow.height; row.hidden = sourceRow.hidden;
      row.outlineLevel = sourceRow.outlineLevel;
    }
    for (let c = 0; c < columnIndexes.length; c++) {
      const cell = sourceRow.getCell(columnIndexes[c]);
      if (cell.value !== null || Object.keys(cell.style).length > 0) copyCell(cell, target.getCell(transposed ? c + 1 : r + 1, transposed ? r + 1 : c + 1));
    }
  }
  if (!transposed) for (let c = 0; c < columnIndexes.length; c++) {
    const sourceColumn = source.getColumn(columnIndexes[c]), column = target.getColumn(c + 1);
    column.width = sourceColumn.width; column.hidden = sourceColumn.hidden; column.outlineLevel = sourceColumn.outlineLevel;
  }
}

function range(length: number): number[] { return Array.from({ length }, (_, i) => i + 1); }

async function write(book: Book, name: string, signal?: AbortSignal): Promise<Output> {
  cancelled(signal);
  let area = 0;
  if (book.worksheets.length > LIMITS.sheets) throw new SpreadsheetError("Output exceeds 64 worksheets.");
  for (const sheet of book.worksheets) { const { rows, columns } = shape(sheet); area += rows * columns; }
  if (area > LIMITS.cells) throw new SpreadsheetError("Output exceeds 250,000 cells.");
  book.calcProperties.fullCalcOnLoad = false;
  const data = await book.xlsx.writeBuffer();
  cancelled(signal);
  if (data.byteLength > LIMITS.fileBytes) throw new SpreadsheetError("Generated workbook exceeds 16 MiB.");
  const bytes = new Uint8Array(data.byteLength); bytes.set(new Uint8Array(data as unknown as ArrayBuffer));
  return { name: `${outputName(name)}.xlsx`, blob: new Blob([bytes], { type: MIME }) };
}

function counts(sheet: Sheet): { rowCount: number; columnCount: number } {
  const { rows, columns } = shape(sheet);
  return { rowCount: Math.max(0, rows - 1), columnCount: columns };
}

function cachedWarnings(sheet: Sheet): string[] {
  return formulas(sheet) ? ["Formula cells use their cached results only; formulas are not evaluated. Missing cached results export as empty cells/null."] : [];
}

function safeText(value: Value, state: { changed: boolean }): string {
  const text = textValue(value), cached = resolved(value);
  if (typeof cached !== "number" && typeof cached !== "boolean" && !(cached instanceof Date) && /^[\s\x00-\x20\x7f]*[=+\-@]/.test(text)) {
    state.changed = true; return `'${text}`;
  }
  return text;
}

function column(values: SpreadsheetValues, width: number, field = "column"): number {
  const raw = string(values, field);
  if (!/^(0|[1-9]\d*)$/.test(raw) || Number(raw) >= width) throw new SpreadsheetError("Choose a valid zero-based column index.", field);
  return Number(raw) + 1;
}

function columns(values: SpreadsheetValues, width: number, field: "order" | "keys"): number[] {
  const raw = values[field];
  if (!Array.isArray(raw) || !raw.length || raw.some(value => typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value) || Number(value) >= width)) {
    throw new SpreadsheetError(`Choose valid zero-based column indexes for ${field}.`, field);
  }
  const indexes = raw.map(value => Number(value) + 1);
  if (new Set(indexes).size !== indexes.length || (field === "order" && indexes.length !== width)) throw new SpreadsheetError(field === "order" ? "Column order must include every column exactly once." : "Key columns must not repeat.", field);
  return indexes;
}

function numeric(value: Value): number | undefined {
  const scalar = resolved(value);
  if (typeof scalar === "number") return Number.isFinite(scalar) ? scalar : undefined;
  if (typeof scalar !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(scalar.trim())) return undefined;
  const result = Number(scalar); return Number.isFinite(result) ? result : undefined;
}

function predicate(values: SpreadsheetValues): (value: Value) => boolean {
  const operator = string(values, "operator"), target = string(values, "value");
  const literal: Record<string, (left: string) => boolean> = {
    Equals: left => left === target, "Not equals": left => left !== target, Contains: left => left.includes(target),
    "Starts with": left => left.startsWith(target), "Ends with": left => left.endsWith(target),
  };
  if (Object.hasOwn(literal, operator)) return value => literal[operator](textValue(value));
  const numericOps: Record<string, (left: number, right: number) => boolean> = {
    "Greater than": (a, b) => a > b, "Greater than or equal": (a, b) => a >= b,
    "Less than": (a, b) => a < b, "Less than or equal": (a, b) => a <= b,
  };
  if (!Object.hasOwn(numericOps, operator)) throw new SpreadsheetError("Choose a supported filter operator.", "operator");
  const number = numeric(target);
  if (number === undefined) throw new SpreadsheetError("Numeric comparison requires a finite numeric value.", "value");
  return value => { const cell = numeric(value); return cell !== undefined && numericOps[operator](cell, number); };
}

async function sourceText(values: SpreadsheetValues, signal?: AbortSignal): Promise<string> {
  if (values.textFile !== undefined && values.textFile !== null) {
    const file = inputFile(values.textFile, "textFile");
    const bytes = new Uint8Array(await file.arrayBuffer()); cancelled(signal);
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new SpreadsheetError("CSV/TSV files must use valid UTF-8.", "textFile"); }
    if (text.length > LIMITS.textCharacters) throw new SpreadsheetError("Delimited input is limited to 2,000,000 characters.", "textFile");
    return text;
  }
  return string(values, "source").replace(/^\uFEFF/, "");
}

function validateRows(rows: Value[][]): void {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  dimensions(rows.length, width);
  for (const row of rows) for (const cell of row) {
    if (textValue(cell).length > LIMITS.cellCharacters) throw new SpreadsheetError("Cell text is limited to 32,767 characters.", "source");
    if (typeof cell === "number" && !Number.isFinite(cell)) throw new SpreadsheetError("JSON numbers must be finite.", "source");
  }
}

async function fromText(id: string, values: SpreadsheetValues, signal?: AbortSignal): Promise<SpreadsheetResult> {
  const source = await sourceText(values, signal);
  let rows: Value[][];
  if (id === "json-to-excel") {
    let data: unknown;
    try { data = JSON.parse(source); } catch { throw new SpreadsheetError("Enter valid JSON as an array of objects.", "source"); }
    if (!Array.isArray(data) || data.some(item => !item || typeof item !== "object" || Array.isArray(item))) throw new SpreadsheetError("JSON must be an array of objects.", "source");
    if (data.length >= LIMITS.rows) throw new SpreadsheetError("JSON input exceeds the row limit.", "source");
    const headers: string[] = [], seen = new Set<string>();
    for (const object of data as Record<string, unknown>[]) for (const key of Object.keys(object)) if (!seen.has(key)) {
      seen.add(key); headers.push(key);
      if (headers.length > LIMITS.columns) throw new SpreadsheetError("JSON input exceeds 512 columns.", "source");
    }
    dimensions(data.length ? data.length + 1 : 0, headers.length);
    if (data.length && !headers.length) throw new SpreadsheetError("Nonempty JSON arrays require at least one object key to create spreadsheet columns.", "source");
    rows = data.length ? [headers, ...data.map(object => headers.map(key => {
      const value: unknown = object[key];
      if (value === null || value === undefined) return null;
      if (["string", "number", "boolean"].includes(typeof value)) return value as string | number | boolean;
      return JSON.stringify(value, (_key, entry: unknown) => {
        if (typeof entry === "number" && !Number.isFinite(entry)) throw new SpreadsheetError("JSON numbers must be finite.", "source");
        return entry;
      });
    }))] : [];
  } else {
    try { rows = parseCsv(source, id === "tsv-to-excel" ? "\t" : ","); }
    catch (cause) { throw new SpreadsheetError(cause instanceof Error ? cause.message : "Invalid delimited text.", values.textFile ? "textFile" : "source"); }
  }
  validateRows(rows);
  const Excel = await library(); cancelled(signal);
  const book = new Excel.Workbook(), sheet = book.addWorksheet(sheetName(string(values, "sheetName", "Sheet1")));
  for (const row of rows) {
    const added = sheet.addRow(row);
    // Preserve trailing all-null JSON records, which ExcelJS otherwise omits.
    if (row.length && row.every(value => value === null)) added.height = 15;
  }
  const file = await write(book, sheet.name, signal);
  return { files: [file], data: id === "tsv-to-excel" ? {} : { rowCount: Math.max(0, rows.length - 1), columnCount: rows[0]?.length ?? 0 }, warnings: ["CSV/TSV fields are imported as literal strings. JSON scalar types are retained; nested objects and arrays become JSON strings. No formulas are inferred or evaluated."] };
}

function typeOf(value: Value): string {
  const cached = resolved(value);
  if (empty(cached)) return "empty";
  if (numeric(cached) !== undefined) return "numeric";
  if (cached instanceof Date) return "date";
  if (typeof cached === "boolean") return "boolean";
  if (cached && typeof cached === "object" && "error" in cached) return "error";
  return "text";
}

function analyze(sheet: Sheet, col: number): Record<string, unknown> {
  const { rows } = shape(sheet), values = range(Math.max(0, rows - 1)).map(i => cellValue(sheet.getCell(i + 1, col)));
  const nonempty = values.filter(value => !empty(value)), kinds = new Set(nonempty.map(typeOf));
  const detectedType = kinds.size === 0 ? "empty" : kinds.size === 1 ? [...kinds][0] : "mixed";
  const result: Record<string, unknown> = { rows: values.length, empty: values.length - nonempty.length, nonempty: nonempty.length, unique: new Set(values.map(value => JSON.stringify(jsonValue(value)))).size, detectedType };
  if (detectedType === "numeric") {
    const numbers = nonempty.map(value => numeric(value)!);
    let min = Infinity, max = -Infinity, avg = 0;
    numbers.forEach((number, i) => { min = Math.min(min, number); max = Math.max(max, number); avg = avg * (i / (i + 1)) + number / (i + 1); });
    if (!Number.isFinite(avg)) throw new SpreadsheetError("Numeric average exceeds the finite range.");
    Object.assign(result, { min, max, avg });
  }
  return result;
}

export async function runSpreadsheet(id: string, values: SpreadsheetValues, signal?: AbortSignal): Promise<SpreadsheetResult> {
  cancelled(signal);
  if (!ids.has(id)) throw new SpreadsheetError("Unknown Spreadsheet tool.");
  if (["csv-to-excel", "tsv-to-excel", "json-to-excel"].includes(id)) return fromText(id, values, signal);
  const Excel = await library(); cancelled(signal);
  if (id === "workbook-merger") {
    if (!Array.isArray(values.files) || values.files.length < 2 || values.files.length > LIMITS.sheets) throw new SpreadsheetError("Choose 2–64 XLSX files to merge.", "files");
    const book = new Excel.Workbook(), names = new Set<string>();
    let combinedBytes = 0, combinedCells = 0;
    for (const value of values.files) {
      const file = inputFile(value, "files"); combinedBytes += file.size;
      if (combinedBytes > LIMITS.fileBytes) throw new SpreadsheetError("Combined merge inputs are limited to 16 MiB.", "files");
      const source = await load(file, signal);
      for (const sheet of source.worksheets) {
        if (book.worksheets.length >= LIMITS.sheets) throw new SpreadsheetError("Merged output exceeds 64 sheets.", "files");
        const { rows, columns } = shape(sheet); combinedCells += rows * columns;
        if (combinedCells > LIMITS.cells) throw new SpreadsheetError("Merged output exceeds 250,000 cells.", "files");
        const name = collisionName(sheet.name, names, 31);
        copyGrid(sheet, book.addWorksheet(name), range(rows), range(columns));
      }
    }
    return { files: [await write(book, "merged-workbook", signal)], data: {}, warnings: [retention, formulaWarning, "Colliding sheet names receive deterministic numeric suffixes; formula sheet references retain their original names. HYPERLINK formulas are flattened to cached results."] };
  }
  const file = inputFile(values.file), book = await load(file, signal), info = summary(book);
  if (id === "workbook-inspector") return { data: {
    fileName: file.name, fileSize: file.size, sheetCount: info.sheets.length, sheetNames: info.sheetNames,
    perSheetDimensions: info.sheets.map(item => ({ name: item.name, rowCount: book.getWorksheet(item.name)!.rowCount, columnCount: item.columnCount })),
    formulaCount: info.sheets.reduce((sum, item) => sum + item.formulaCount, 0),
  }, warnings: ["Dimensions include the first row and styled/sparse ranges; no macros or formulas are executed."] };
  if (id === "workbook-splitter") {
    const outputs: Output[] = [], names = new Set<string>();
    for (const sheet of book.worksheets) {
      const target = new Excel.Workbook(), { rows, columns } = shape(sheet);
      copyGrid(sheet, target.addWorksheet(sheet.name), range(rows), range(columns));
      outputs.push(await write(target, collisionName(outputName(sheet.name), names, 100), signal));
      outputBudget(outputs);
    }
    return { files: outputs, data: { fileList: outputs.map(output => output.name) }, warnings: [retention, formulaWarning, "HYPERLINK formulas are flattened to cached results."] };
  }
  const sheet = select(book, values), { rows, columns: width } = shape(sheet);
  const cached = cachedWarnings(sheet);
  if (id === "spreadsheet-viewer") {
    const shownRows = Math.min(rows, 101), shownColumns = Math.min(width, 50);
    return { data: { ...counts(sheet), selectedSheet: sheet.name }, preview: { sheetNames: info.sheetNames, name: sheet.name, rows: range(shownRows).map(r => range(shownColumns).map(c => textValue(cellValue(sheet.getCell(r, c))))) }, warnings: [...cached, ...(rows > shownRows || width > shownColumns ? ["Preview displays at most the header plus 100 rows and 50 columns; counts describe the full worksheet."] : [])] };
  }
  if (id === "spreadsheet-column-analyzer") return { data: analyze(sheet, column(values, width)), warnings: [...cached, "Analysis excludes the first/header row. Unique count includes empty values; statistics are emitted only when every nonempty value is numeric."] };
  if (id === "excel-to-csv" || id === "excel-to-tsv") {
    const state = { changed: false };
    const text = serializeCsv(range(rows).map(r => range(width).map(c => safeText(cellValue(sheet.getCell(r, c)), state))), id === "excel-to-tsv" ? "\t" : ",");
    if (text.length > LIMITS.textCharacters) throw new SpreadsheetError("Text output exceeds 2,000,000 characters.");
    const extension = id === "excel-to-tsv" ? "tsv" : "csv";
    return { text, files: [{ name: `${outputName(sheet.name)}.${extension}`, blob: new Blob([text], { type: `${extension === "tsv" ? "text/tab-separated-values" : "text/csv"};charset=utf-8` }) }], data: extension === "csv" ? counts(sheet) : {}, warnings: [...cached, injectionWarning] };
  }
  if (id === "excel-to-json") {
    const state = { changed: false }, usedHeaders = new Set<string>();
    const headers = uniqueHeaders(sheet, width).map(header => {
      const base = safeText(header, state); let name = base, suffix = 2;
      while (usedHeaders.has(name)) name = `${base}_${suffix++}`;
      usedHeaders.add(name); return name;
    });
    const data = range(Math.max(0, rows - 1)).map(r => Object.fromEntries(headers.map((header, c) => {
      const value = cellValue(sheet.getCell(r + 1, c + 1)), scalar = jsonValue(value);
      return [header, typeof scalar === "string" ? safeText(value, state) : scalar];
    })));
    const text = JSON.stringify(data, null, 2);
    if (text.length > LIMITS.textCharacters) throw new SpreadsheetError("JSON output exceeds 2,000,000 characters.");
    return { text, data: counts(sheet), warnings: [...cached, injectionWarning, "The first row supplies headers; empty headers become Column N, duplicate/colliding names receive _2, _3 suffixes. Dates export as ISO strings, empty cells as null, errors as text."] };
  }
  if (id === "xlsx-to-html") {
    const state = { changed: false };
    const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const text = `<table>\n${range(rows).map(r => `  <tr>${range(width).map(c => `<${r === 1 ? 'th scope="col"' : "td"}>${escape(safeText(cellValue(sheet.getCell(r, c)), state))}</${r === 1 ? "th" : "td"}>`).join("")}</tr>`).join("\n")}\n</table>`;
    if (text.length > LIMITS.textCharacters) throw new SpreadsheetError("HTML output exceeds 2,000,000 characters.");
    return { text, data: counts(sheet), warnings: [...cached, injectionWarning, "HTML is escaped inert table source; hyperlinks, scripts and styles are not included."] };
  }
  const target = new Excel.Workbook(), warnings = [retention, formulaWarning, "HYPERLINK formulas are flattened to cached results."];
  const data: Record<string, unknown> = {};
  let rowIndexes = range(rows), columnIndexes = range(width), transpose = false;
  switch (id) {
    case "sheet-extractor": break;
    case "spreadsheet-transposer":
      transpose = true; dimensions(width, rows);
      Object.assign(data, { originalDimensions: { rows, columns: width }, newDimensions: { rows: width, columns: rows } }); break;
    case "spreadsheet-column-reorderer": columnIndexes = columns(values, width, "order"); break;
    case "spreadsheet-row-filter": {
      const col = column(values, width), matches = predicate(values);
      rowIndexes = rows ? [1, ...range(rows - 1).map(r => r + 1).filter(r => matches(cellValue(sheet.getCell(r, col))))] : [];
      Object.assign(data, { matched: Math.max(0, rowIndexes.length - 1), excluded: rows - rowIndexes.length });
      warnings.push("The first/header row is retained. Numeric comparisons exclude empty and nonnumeric cells; text comparisons are literal and case-sensitive."); break;
    }
    case "spreadsheet-deduplicator": {
      const keys = columns(values, width, "keys"), seen = new Set<string>();
      rowIndexes = rows ? [1, ...range(rows - 1).map(r => r + 1).filter(r => {
        const key = JSON.stringify(keys.map(c => jsonValue(cellValue(sheet.getCell(r, c)))));
        if (seen.has(key)) return false; seen.add(key); return true;
      })] : [];
      Object.assign(data, { original: Math.max(0, rows - 1), removed: rows - rowIndexes.length, final: Math.max(0, rowIndexes.length - 1) });
      warnings.push("The first/header row is retained; the first occurrence of each typed cached-value key is kept."); break;
    }
    case "spreadsheet-empty-row-cleaner": {
      rowIndexes = rowIndexes.filter(r => range(width).some(c => !empty(cellValue(sheet.getCell(r, c))) || sheet.getCell(r, c).type === 6));
      data.removed = rows - rowIndexes.length; break;
    }
    case "spreadsheet-empty-column-cleaner": {
      columnIndexes = columnIndexes.filter(c => range(rows).some(r => !empty(cellValue(sheet.getCell(r, c))) || sheet.getCell(r, c).type === 6));
      data.removed = width - columnIndexes.length; break;
    }
    case "spreadsheet-split-by-column": {
      const col = column(values, width), groups = new Map<string, { label: string; rows: number[] }>();
      for (let r = 2; r <= rows; r++) {
        const value = cellValue(sheet.getCell(r, col)), key = JSON.stringify(jsonValue(value));
        if (!groups.has(key)) {
          if (groups.size >= LIMITS.outputs) throw new SpreadsheetError("Split output is limited to 64 groups.", "column");
          groups.set(key, { label: textValue(value) || "empty", rows: [1] });
        }
        groups.get(key)!.rows.push(r);
      }
      const outputs: Output[] = [], names = new Set<string>();
      for (const group of groups.values()) {
        const workbook = new Excel.Workbook();
        copyGrid(sheet, workbook.addWorksheet(sheet.name), group.rows, columnIndexes);
        outputs.push(await write(workbook, collisionName(outputName(group.label), names, 100), signal));
        outputBudget(outputs);
      }
      return { files: outputs, data: { groupCount: groups.size, fileList: outputs.map(output => output.name) }, warnings: [...warnings, "Groups use typed cached values; empty values form one group. Each output retains the header. Filenames are sanitized and collision suffixes are deterministic."] };
    }
    default: throw new SpreadsheetError("Unknown Spreadsheet transformation.");
  }
  copyGrid(sheet, target.addWorksheet(sheet.name), rowIndexes, columnIndexes, transpose);
  return { files: [await write(target, sheet.name, signal)], data, warnings };
}
export const run = runSpreadsheet;
