import type { DataInputs, DataResult } from "./types";
import { parseJson, jsonObjectKeys } from "./json";

type CsvRecord = { values: string[]; row: number };

function csvError(message: string, row: number, column: number): Error {
  return new Error(`Row ${row}, column ${column}: ${message}`);
}

function checkDelimiter(delimiter: string): void {
  if (delimiter.length !== 1 || /["\r\n]/.test(delimiter)) {
    throw new Error("Choose a single delimiter other than a quote or line break.");
  }
}

/** Strict RFC-style fields; record numbers are logical rows, including quoted newlines. */
function readRecords(input: string, delimiter: string): CsvRecord[] {
  checkDelimiter(delimiter);
  if (input.length === 0) throw new Error("Input is empty. Enter CSV data first.");
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let field = "";
  let state: "start" | "plain" | "quoted" | "closed" = "start";
  let endedRecord = false;
  const finishField = () => { values.push(field); field = ""; state = "start"; };
  const finishRecord = () => {
    finishField();
    records.push({ values, row: records.length + 1 });
    values = [];
  };

  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    endedRecord = false;
    if (state === "quoted") {
      if (character === '"') {
        if (input[index + 1] === '"') { field += '"'; index++; }
        else state = "closed";
      } else field += character;
      continue;
    }
    if (character === delimiter) { finishField(); continue; }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && input[index + 1] === "\n") index++;
      finishRecord();
      endedRecord = true;
      continue;
    }
    if (state === "closed") {
      throw csvError("Unexpected text after a closing quote; expected a delimiter or line break.", records.length + 1, values.length + 1);
    }
    if (character === '"') {
      if (state !== "start") throw csvError("A quote must start a field; escape embedded quotes inside a quoted field.", records.length + 1, values.length + 1);
      state = "quoted";
    } else {
      field += character;
      state = "plain";
    }
  }
  if (state === "quoted") throw csvError("Unclosed quoted field.", records.length + 1, values.length + 1);
  // A terminal record separator ends its row; it does not create an extra row.
  if (!endedRecord) finishRecord();
  return records;
}

function rectangular(records: CsvRecord[]): string[][] {
  if (!records.length) throw new Error("Input is empty. Enter at least one nonblank CSV row.");
  const width = records[0].values.length;
  for (const record of records) {
    if (record.values.length !== width) {
      throw csvError(`Expected ${width} columns but found ${record.values.length}.`, record.row, Math.min(width, record.values.length) + 1);
    }
  }
  return records.map(record => record.values);
}

/** Comma is always the default; delimiter detection is a separate explicit operation. */
export function parseCsv(input: string, delimiter = ","): string[][] {
  return rectangular(readRecords(input, delimiter));
}

/** Quote according to the destination delimiter, including lone empty records. */
export function stringifyCsv(rows: readonly (readonly string[])[], delimiter = ","): string {
  checkDelimiter(delimiter);
  return rows.map(row => row.map(value => {
    if (value.includes(delimiter) || /["\r\n]/.test(value) || (row.length === 1 && value === "")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(delimiter)).join("\n");
}

function headersOf(rows: string[][]): string[] {
  const seen = new Set<string>();
  rows[0].forEach((header, index) => {
    if (!header.trim()) throw csvError("Header names must not be empty.", 1, index + 1);
    if (seen.has(header)) throw csvError(`Duplicate header ${JSON.stringify(header)}.`, 1, index + 1);
    seen.add(header);
  });
  return rows[0];
}

function columnIndex(headers: string[], name: string): number {
  if (!name) throw new Error("Choose a column by its exact header name.");
  const index = headers.indexOf(name);
  if (index < 0) throw new Error(`Unknown column ${JSON.stringify(name)}. Use an exact header name.`);
  return index;
}

function columnNames(value: string, label: string): string[] {
  if (!value.trim()) throw new Error(`Enter ${label} as header names or a JSON array of names.`);
  let names: unknown;
  if (value.trimStart().startsWith("[")) {
    try { names = JSON.parse(value); }
    catch { throw new Error(`Invalid ${label}: expected a JSON array of header names.`); }
  } else {
    names = value.split(/\r\n|\r|\n/);
  }
  if (!Array.isArray(names) || !names.length || names.some(name => typeof name !== "string" || !name.trim())) {
    throw new Error(`Invalid ${label}: provide at least one nonempty header name.`);
  }
  const result = names as string[];
  if (new Set(result).size !== result.length) throw new Error(`Duplicate names in ${label} are not allowed.`);
  return result;
}

function jsonToCsv(input: string): string {
  if (!input.trim()) throw new Error("Input is empty. Enter a JSON array of objects first.");
  let parsed: unknown;
  try { parsed = parseJson(input); }
  catch (error) { throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of objects.");
  if (!parsed.length) return "";
  const objects: Record<string, unknown>[] = parsed.map((item, index) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error(`JSON row ${index + 1} must be an object.`);
    return item as Record<string, unknown>;
  });
  const headers = jsonObjectKeys(objects[0]);
  if (!headers.length) throw new Error("The first JSON object must have at least one key.");
  const keySet = new Set(headers);
  const rows = objects.map((object, index) => {
    const keys = Object.keys(object);
    if (keys.length !== headers.length || keys.some(key => !keySet.has(key))) {
      throw new Error(`JSON row ${index + 1} has incompatible keys. Every object must have exactly the first object's keys.`);
    }
    return headers.map(key => {
      const value = object[key];
      if (typeof value === "string") return value;
      // JSON serialization preserves nested objects/arrays without [object Object].
      return JSON.stringify(value, (_key, nested: unknown) => {
        if (typeof nested === "number" && !Number.isFinite(nested)) throw new Error(`JSON row ${index + 1}, key ${JSON.stringify(key)} contains a number outside the finite range.`);
        return nested;
      });
    });
  });
  return stringifyCsv([headers, ...rows]);
}

const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function finiteNumber(value: string): number | undefined {
  if (!numericPattern.test(value.trim())) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number)) ? number : undefined;
}

function isDateLike(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  const [, y, m, d, hour, minute, second, zoneHour, zoneMinute] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && (hour === undefined || (Number(hour) <= 23 && Number(minute) <= 59 && Number(second ?? 0) <= 59))
    && (zoneHour === undefined || (Number(zoneHour) <= 23 && Number(zoneMinute) <= 59));
}

function analyzeColumn(rows: string[][], column: string): string {
  const index = columnIndex(headersOf(rows), column);
  const values = rows.slice(1).map(row => row[index]);
  const nonempty = values.filter(value => value !== "");
  const types = { integer: 0, decimal: 0, boolean: 0, "date-like": 0, text: 0 };
  let min: number | undefined, max: number | undefined;
  for (const value of nonempty) {
    const number = finiteNumber(value);
    if (number !== undefined) {
      types[/^[+-]?\d+$/.test(value.trim()) ? "integer" : "decimal"]++;
      min = min === undefined ? number : Math.min(min, number);
      max = max === undefined ? number : Math.max(max, number);
    } else if (/^(true|false)$/i.test(value)) types.boolean++;
    else if (isDateLike(value)) types["date-like"]++;
    else types.text++;
  }
  const sorted = Object.entries(types).sort((left, right) => right[1] - left[1]);
  // Mixed numeric columns are decimal; ties and weak majorities remain text.
  const numericCount = types.integer + types.decimal;
  const predominantType = nonempty.length === 0 ? "empty"
    : numericCount / nonempty.length >= 0.8 ? (types.decimal ? "decimal" : "integer")
    : sorted[0][1] / nonempty.length >= 0.8 ? sorted[0][0] : "text";
  return JSON.stringify({
    rowCount: values.length, nonempty: nonempty.length, empty: values.length - nonempty.length,
    unique: new Set(values).size, predominantType, types,
    ...(numericCount ? { minimum: min, maximum: max } : {}),
  }, null, 2);
}

function detectDelimiter(input: string): string {
  if (!input.length) throw new Error("Input is empty. Enter delimited data first.");
  const candidates = [",", ";", "\t", "|"];
  const scores = candidates.flatMap(delimiter => {
    try {
      const records = readRecords(input, delimiter);
      const frequencies = new Map<number, number>();
      for (const { values } of records) frequencies.set(values.length, (frequencies.get(values.length) ?? 0) + 1);
      const [columnCount, matchingRows] = [...frequencies].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      if (columnCount < 2) return [];
      return [{ delimiter, columnCount, rowCount: records.length, matchingRows, consistency: matchingRows / records.length }];
    } catch { return []; }
  }).sort((a, b) => b.consistency - a.consistency || b.matchingRows - a.matchingRows || b.columnCount - a.columnCount);
  if (!scores.length) throw new Error("No delimiter could be detected. Use valid comma, semicolon, tab, or pipe-separated fields.");
  if (scores.length > 1 && scores[0].consistency === scores[1].consistency && scores[0].matchingRows === scores[1].matchingRows && scores[0].columnCount === scores[1].columnCount) {
    throw new Error("Delimiter detection is ambiguous: multiple delimiters have the same row consistency and column count.");
  }
  const best = scores[0];
  const names: Record<string, string> = { ",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe" };
  return JSON.stringify({ delimiter: names[best.delimiter], columnCount: best.columnCount }, null, 2);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function markdownTable(rows: string[][]): string {
  const cell = (value: string) => escapeHtml(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|")
    .replace(/([`*_\[\]~])/g, "\\$1").replace(/\r\n|\r|\n/g, "<br>");
  const line = (row: string[]) => `| ${row.map(cell).join(" | ")} |`;
  return [line(rows[0]), `| ${rows[0].map(() => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
}

function htmlTable(rows: string[][]): string {
  const cell = (value: string) => escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
  return ["<table>", "  <thead>", `    <tr>${rows[0].map(value => `<th scope="col">${cell(value)}</th>`).join("")}</tr>`,
    "  </thead>", "  <tbody>", ...rows.slice(1).map(row => `    <tr>${row.map(value => `<td>${cell(value)}</td>`).join("")}</tr>`),
    "  </tbody>", "</table>"].join("\n");
}

function filterRows(rows: string[][], inputs: DataInputs): string[][] {
  const index = columnIndex(headersOf(rows), inputs.column ?? "");
  const value = inputs.value ?? "";
  const operator = inputs.operator ?? "Equals";
  const literal: Record<string, (cell: string) => boolean> = {
    Equals: cell => cell === value,
    "Not equals": cell => cell !== value,
    Contains: cell => cell.includes(value),
    "Starts with": cell => cell.startsWith(value),
    "Ends with": cell => cell.endsWith(value),
  };
  if (Object.hasOwn(literal, operator)) return [rows[0], ...rows.slice(1).filter(row => literal[operator](row[index]))];
  const numeric: Record<string, (left: number, right: number) => boolean> = {
    "Greater than": (left, right) => left > right,
    "Greater than or equal": (left, right) => left >= right,
    "Less than": (left, right) => left < right,
    "Less than or equal": (left, right) => left <= right,
  };
  if (!Object.hasOwn(numeric, operator)) throw new Error(`Unknown filter operator ${JSON.stringify(operator)}.`);
  const target = finiteNumber(value);
  if (target === undefined) throw new Error("Numeric comparisons require a finite numeric comparison value.");
  return [rows[0], ...rows.slice(1).filter((row, rowIndex) => {
    const number = finiteNumber(row[index]);
    if (number === undefined) throw csvError("Numeric comparisons require a finite number; empty and nonnumeric cells cannot be compared.", rowIndex + 2, index + 1);
    return numeric[operator](number, target);
  })];
}

export function runCsvTool(id: string, inputs: DataInputs): DataResult {
  const input = inputs.input ?? "";
  if (id === "csv-validator") {
    try {
      parseCsv(input);
      return { text: "Valid CSV." };
    } catch (error) { return { text: `Invalid CSV: ${error instanceof Error ? error.message : String(error)}`, invalid: true }; }
  }
  if (id === "json-to-csv") return { text: jsonToCsv(input) };
  if (id === "csv-delimiter-detector") return { text: detectDelimiter(input) };
  if (id === "csv-cleaner") {
    // Trim ordinary boundary whitespace, retaining non-layout controls such as VT/FF.
    const records = readRecords(input, ",").map(record => ({ ...record, values: record.values.map(value => value.replace(/^[^\S\u000b\u000c]+|[^\S\u000b\u000c]+$/gu, "")) }))
      .filter(record => record.values.some(value => value !== ""));
    return { text: stringifyCsv(rectangular(records)) };
  }
  const rows = parseCsv(input, id === "tsv-to-csv" ? "\t" : ",");
  switch (id) {
    case "csv-to-json": {
      const headers = headersOf(rows);
      const tree = rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
      return { text: JSON.stringify(tree, null, 2), tree };
    }
    case "csv-formatter":
    case "tsv-to-csv": return { text: stringifyCsv(rows) };
    case "csv-to-tsv": return { text: stringifyCsv(rows, "\t") };
    case "csv-column-analyzer": return { text: analyzeColumn(rows, inputs.column ?? "") };
    case "csv-to-markdown": return { text: markdownTable(rows) };
    case "csv-to-html":
    case "csv-to-html-table": return { text: htmlTable(rows) };
    case "csv-column-reorderer": {
      const headers = headersOf(rows);
      const names = columnNames(inputs.order ?? "", "the column order");
      const indexes = names.map(name => columnIndex(headers, name));
      return { text: stringifyCsv(rows.map(row => indexes.map(index => row[index]))) };
    }
    case "csv-row-filter": return { text: stringifyCsv(filterRows(rows, inputs)) };
    case "csv-data-deduplicator":
    case "csv-deduplicator": {
      const headers = headersOf(rows);
      const names = inputs.keys?.trim() ? columnNames(inputs.keys, "key columns") : headers;
      const indexes = names.map(name => columnIndex(headers, name));
      const seen = new Set<string>();
      const unique = rows.slice(1).filter(row => {
        const key = JSON.stringify(indexes.map(index => row[index]));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { text: stringifyCsv([headers, ...unique]) };
    }
    case "csv-transposer": return { text: stringifyCsv(rows[0].map((_, index) => rows.map(row => row[index]))) };
    default: throw new Error(`Unknown CSV tool: ${id}.`);
  }
}
