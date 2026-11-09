import alasql from "alasql";
import { parseCsv, stringifyCsv } from "../json-data/csv";

export type SqlQueryResult = {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  rawObjects?: Record<string, any>[];
};

export type ColumnSchema = {
  name: string;
  type: "numeric" | "text";
  sampleValues: (string | number | null)[];
};

export type IngestedTable = {
  tableName: string;
  rowCount: number;
  columns: ColumnSchema[];
  objects: Record<string, any>[];
  parseTimeMs: number;
};

/**
 * Detect delimiter based on character frequencies in the first non-empty line.
 */
export function detectDelimiter(input: string): string {
  const firstLine = input.split(/\r\n|\r|\n/)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  if (semiCount > commaCount && semiCount > tabCount) return ";";
  return ",";
}

const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Ingest CSV or TSV data into typed JavaScript objects with numeric column detection.
 */
export function ingestTabularData(csvOrTsvText: string, options?: { delimiter?: string }): IngestedTable {
  const trimmed = csvOrTsvText.trim();
  if (!trimmed) {
    throw new Error("Input data is empty. Please upload or paste CSV/TSV data.");
  }

  // Normalize backslash-escaped quotes to standard RFC-4180 double-quotes
  const normalizedCsv = trimmed.includes('\\"') ? trimmed.replace(/\\"/g, '""') : trimmed;

  const startTime = performance.now();
  const delimiter = options?.delimiter || detectDelimiter(normalizedCsv);
  let rawRows: string[][];
  try {
    rawRows = parseCsv(normalizedCsv, delimiter);
  } catch (err) {
    throw new Error(`CSV parsing error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (rawRows.length === 0) {
    throw new Error("No data rows found in input.");
  }

  const rawHeaders = rawRows[0];
  const dataRows = rawRows.slice(1);

  // Ensure unique, non-empty column header identifiers
  const seenHeaders = new Map<string, number>();
  const headers = rawHeaders.map((raw, idx) => {
    const clean = raw.trim() || `col_${idx + 1}`;
    const count = seenHeaders.get(clean) ?? 0;
    seenHeaders.set(clean, count + 1);
    return count === 0 ? clean : `${clean}_${count + 1}`;
  });

  // Detect numeric columns: column must have at least one non-empty value and all non-empty values must be valid numbers
  const isNumericCols = headers.map((_, colIdx) => {
    let nonEmptyCount = 0;
    for (const row of dataRows) {
      const cell = (row[colIdx] ?? "").trim();
      if (cell === "") continue;
      nonEmptyCount++;
      if (!numericPattern.test(cell)) {
        return false;
      }
      const num = Number(cell);
      if (!Number.isFinite(num)) {
        return false;
      }
    }
    return nonEmptyCount > 0;
  });

  // Convert raw rows into typed objects
  const objects: Record<string, any>[] = dataRows.map(row => {
    const obj: Record<string, any> = {};
    headers.forEach((header, colIdx) => {
      const rawCell = row[colIdx] ?? "";
      const cellTrimmed = rawCell.trim();
      if (isNumericCols[colIdx]) {
        obj[header] = cellTrimmed === "" ? null : Number(cellTrimmed);
      } else {
        obj[header] = rawCell;
      }
    });
    return obj;
  });

  const columns: ColumnSchema[] = headers.map((name, colIdx) => ({
    name,
    type: isNumericCols[colIdx] ? "numeric" : "text",
    sampleValues: objects.slice(0, 5).map(o => o[name]),
  }));

  const parseTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    tableName: "table",
    rowCount: objects.length,
    columns,
    objects,
    parseTimeMs,
  };
}

/**
 * Normalizes SQL queries so unbracketed occurrences of the reserved word 'table'
 * reference the AlaSQL [table] identifier safely.
 */
export function normalizeSqlQuery(query: string): string {
  let normalized = query.trim();
  // Strip trailing semicolon
  if (normalized.endsWith(";")) {
    normalized = normalized.slice(0, -1).trim();
  }
  // Replace table after FROM, JOIN, INTO, UPDATE: e.g. FROM table -> FROM [table]
  normalized = normalized.replace(/\b(FROM|JOIN|INTO|UPDATE)\s+table\b/gi, "$1 [table]");
  // Replace comma table: e.g. FROM foo, table -> FROM foo, [table]
  normalized = normalized.replace(/(,\s*)table\b/gi, "$1[table]");
  // Replace table prefix: e.g. table.col -> [table].col
  normalized = normalized.replace(/\btable\./gi, "[table].");
  // Bracket SQL keywords commonly used as aliases after AS: e.g. AS count -> AS [count]
  normalized = normalized.replace(
    /\bAS\s+(count|sum|avg|min|max|date|table|order|group|key|value|number|string)\b/gi,
    "AS [$1]"
  );
  return normalized;
}

/**
 * Fallback to extract column names for queries returning 0 rows.
 */
function extractColumnsFromQuery(query: string, availableHeaders: string[]): string[] {
  const match = query.match(/^\s*SELECT\s+([\s\S]*?)\s+FROM\b/i);
  if (!match) return availableHeaders;
  const colPart = match[1].trim();
  if (colPart === "*") return availableHeaders;

  const cols: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < colPart.length; i++) {
    const c = colPart[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) cols.push(current.trim());

  return cols.map(c => {
    const asMatch = c.match(/\s+AS\s+([a-zA-Z0-9_]+)$/i) || c.match(/\s+([a-zA-Z0-9_]+)$/);
    return asMatch ? asMatch[1] : c;
  });
}

/**
 * Execute an SQL query against pre-ingested tabular data.
 */
export async function executeSqlOnTable(table: IngestedTable, query: string): Promise<SqlQueryResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: "SQL query is empty. Please enter a valid SQL query.",
    };
  }

  const startTime = performance.now();
  try {
    const db = new alasql.Database();
    // Register as both [table] and [data]
    db.exec("CREATE TABLE [table]");
    ((db as any).tables["table"]).data = table.objects;
    db.exec("CREATE TABLE [data]");
    ((db as any).tables["data"]).data = table.objects;

    const normalized = normalizeSqlQuery(trimmedQuery);
    const rawResult = db.exec(normalized);
    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    if (Array.isArray(rawResult)) {
      if (rawResult.length > 0) {
        const columns = Object.keys(rawResult[0]);
        // Validate that requested columns exist in table (AlaSQL returns undefined for missing properties rather than erroring)
        const tableCols = new Set(table.columns.map(c => c.name.toLowerCase()));
        for (const col of columns) {
          if (!tableCols.has(col.toLowerCase()) && rawResult.every(r => r[col] === undefined)) {
            throw new Error(`Column '${col}' does not exist in table.`);
          }
        }
        const rows = rawResult.map(r => columns.map(c => r[c] ?? null));
        return {
          columns,
          rows,
          rowCount: rawResult.length,
          executionTimeMs,
          rawObjects: rawResult,
        };
      }

      // 0 rows returned
      const availableHeaders = table.columns.map(c => c.name);
      const columns = extractColumnsFromQuery(trimmedQuery, availableHeaders);
      return {
        columns,
        rows: [],
        rowCount: 0,
        executionTimeMs,
        rawObjects: [],
      };
    }

    if (typeof rawResult === "number") {
      return {
        columns: ["affected_rows"],
        rows: [[rawResult]],
        rowCount: 1,
        executionTimeMs,
        rawObjects: [{ affected_rows: rawResult }],
      };
    }

    return {
      columns: ["result"],
      rows: [[String(rawResult)]],
      rowCount: 1,
      executionTimeMs,
      rawObjects: [{ result: rawResult }],
    };
  } catch (err) {
    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute an SQL query against CSV or TSV data in a single step.
 */
export async function executeSql(
  csvOrTsvText: string,
  query: string,
  options?: { delimiter?: string }
): Promise<SqlQueryResult> {
  const trimmedData = csvOrTsvText.trim();
  if (!trimmedData) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: "Input data is empty. Please upload or paste CSV/TSV data.",
    };
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: "SQL query is empty. Please enter a valid SQL query.",
    };
  }

  let table: IngestedTable;
  try {
    table = ingestTabularData(trimmedData, options);
  } catch (err) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return executeSqlOnTable(table, trimmedQuery);
}

/**
 * Format query results as standard RFC-4180 CSV.
 */
export function exportQueryResultToCsv(result: SqlQueryResult, delimiter = ","): string {
  if (result.columns.length === 0) return "";
  const headerRow = result.columns;
  const dataRows = result.rows.map(row =>
    row.map(cell => (cell === null || cell === undefined ? "" : String(cell)))
  );
  return stringifyCsv([headerRow, ...dataRows], delimiter);
}

/**
 * Format query results as JSON.
 */
export function exportQueryResultToJson(result: SqlQueryResult): string {
  if (result.rawObjects && result.rawObjects.length > 0) {
    return JSON.stringify(result.rawObjects, null, 2);
  }
  const objects = result.rows.map(row => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}
