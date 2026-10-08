import { dollarDelimiter, identifierValue, lexSql, significantTokens, SqlSyntaxError, TokenCursor, type SqlToken } from "./lexer";
import { parseSql } from "./parser";
import { readDialect } from "./literals";
import type { SqlDialect, SqlResult } from "./types";

const formatterLanguages = { PostgreSQL: "postgresql", MySQL: "mysql", SQLite: "sqlite", "SQL Server": "transactsql" } as const;
const parserWarning = "Acceptance is limited to the selected dialect's local parser subset; this does not check database objects, permissions, or execution semantics.";

export async function validateSqlTool(sql: string, dialect: SqlDialect): Promise<SqlResult> {
  dialect = readDialect(dialect);
  try {
    await parseSql(sql, dialect);
    return { rows: [{ label: "Valid/Invalid status", value: "Valid" }, { label: "Syntax error message", value: "None" }, { label: "Error location", value: "None" }], warnings: [parserWarning] };
  } catch (error) {
    const safe = error instanceof SqlSyntaxError ? error : new SqlSyntaxError("The selected dialect parser could not process this SQL.");
    return { rows: [{ label: "Valid/Invalid status", value: "Invalid" }, { label: "Syntax error message", value: safe.message }, { label: "Error location", value: safe.line && safe.column ? `Line ${safe.line}, Column ${safe.column}` : "Unavailable" }], warnings: [parserWarning] };
  }
}

/** Retain every surviving token's spelling; never recreate literals from a normalized AST. */
export async function minifySqlTool(sql: string, dialect: SqlDialect): Promise<SqlResult> {
  dialect = readDialect(dialect);
  const tokens = lexSql(sql, dialect);
  const surviving = significantTokens(tokens);
  const containsContinuation = dialect === "PostgreSQL" && surviving.some((token, i) => i > 0 && token.kind === "string" && surviving[i - 1].kind === "string" && /[\r\n]/.test(sql.slice(surviving[i - 1].end, token.start)));
  const knownParserExtension = containsContinuation || tokens.some(token => token.kind === "protected" || (token.kind === "comment" && token.text.slice(2).includes("/*")));
  await parseSql(sql, dialect).catch(async error => {
    // Valid dialect extensions can be outside the bundled parser. A conservative lexical
    // minifier is still useful, but must not claim syntactic validation for them.
    if (!(error instanceof SqlSyntaxError)) throw error;
    if (dialect === "SQL Server" && surviving[0]?.text.toUpperCase() === "CREATE" && surviving.some(token => token.kind === "word" && token.text.toUpperCase() === "REFERENCES")) {
      const { parseDdl } = await import("./ddl");
      await parseDdl(sql, dialect);
      return;
    }
    if (!knownParserExtension) throw error;
  });
  let output = "", pending = "", previous: SqlToken | undefined;
  for (const token of tokens) {
    if (token.kind === "space") { pending += token.text; continue; }
    if (token.kind === "comment") {
      // Treat deleted comments as a separator (never fuse a--b, a/*x*/b, etc.).
      pending += token.text.includes("\n") || token.text.includes("\r") ? "\n" : " ";
      continue;
    }
    if (previous && pending) {
      const continuation = /[\r\n]/.test(pending) && ((dialect === "PostgreSQL" && previous.kind === "string" && token.kind === "string") || dialect === "SQL Server");
      output += continuation ? "\n" : " ";
    }
    output += token.text;
    previous = token; pending = "";
  }
  return { rows: [{ label: "Minified SQL", value: output }], warnings: ["Formatting whitespace and ordinary comments are removed conservatively. Executable/hint comments and newline-sensitive PostgreSQL string continuation are preserved. This is not a database syntax check."] };
}

export async function formatSqlTool(sql: string, dialect: SqlDialect): Promise<SqlResult> {
  dialect = readDialect(dialect);
  const sourceTokens = significantTokens(lexSql(sql, dialect));
  let warning: string | undefined;
  try { await parseSql(sql, dialect); }
  catch (error) {
    if (!(error instanceof SqlSyntaxError)) throw error;
    const continuation = dialect === "PostgreSQL" && sourceTokens.some((token, index) => index > 0 && token.kind === "string" && sourceTokens[index - 1].kind === "string" && /[\r\n]/.test(sql.slice(sourceTokens[index - 1].end, token.start)));
    const specialComments = lexSql(sql, dialect).some(token => token.kind === "protected" || token.kind === "comment" && token.text.slice(2).includes("/*"));
    if (dialect === "SQL Server" && sourceTokens[0]?.text.toUpperCase() === "CREATE" && sourceTokens.some(token => token.kind === "word" && token.text.toUpperCase() === "REFERENCES")) {
      const { parseDdl } = await import("./ddl"); await parseDdl(sql, dialect);
    } else if (continuation || specialComments) warning = "Layout preserves this dialect extension, but the local parser could not validate its complete syntax. This result is not syntax-validation proof.";
    else throw error;
  }
  const { format } = await import("sql-formatter");
  let output: string;
  try { output = format(sql, { language: formatterLanguages[dialect], tabWidth: 2 }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    const position = /\bline (\d+) column (\d+)\b/i.exec(message);
    throw new SqlSyntaxError("The selected dialect formatter cannot process this syntax. Check syntax or unsupported dialect extensions.", position ? { line: Number(position[1]), column: Number(position[2]) } : undefined);
  }
  const targetTokens = significantTokens(lexSql(output, dialect));
  if (sourceTokens.length !== targetTokens.length || sourceTokens.some((token, i) => token.kind !== targetTokens[i].kind || token.text !== targetTokens[i].text)) {
    throw new SqlSyntaxError("Formatting would change SQL tokens; this dialect syntax is unsupported by the formatter.");
  }
  // sql-formatter joins adjacent strings. PostgreSQL uses the newline itself as
  // a continuation operator, so restore this part of the source grammar.
  const fixes: { start: number; end: number; value: string }[] = [];
  if (dialect === "PostgreSQL") for (let i = 1; i < sourceTokens.length; i++) {
    const before = sourceTokens[i - 1], current = sourceTokens[i];
    if (before.kind === "string" && current.kind === "string") {
      const sourceGap = sql.slice(before.end, current.start);
      const targetGap = output.slice(targetTokens[i - 1].end, targetTokens[i].start);
      if (/[\r\n]/.test(sourceGap) !== /[\r\n]/.test(targetGap)) {
        // Preserve any original comments too; they can determine continuation.
        fixes.push({ start: targetTokens[i - 1].end, end: targetTokens[i].start, value: sourceGap });
      }
    }
  }
  for (const fix of fixes.reverse()) output = output.slice(0, fix.start) + fix.value + output.slice(fix.end);
  return { rows: [{ label: "Formatted SQL", value: output }], ...(warning ? { warnings: [warning] } : {}) };
}

function canonicalNumber(text: string): string {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text)!;
  let digits = (match[2] + (match[3] ?? "")).replace(/^0+/, "");
  if (!digits) return "0";
  let exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  while (digits.endsWith("0")) { digits = digits.slice(0, -1); exponent++; }
  return `${match[1] === "-" ? "-" : ""}${digits}e${exponent}`;
}

function exactNumber(text: string, token: SqlToken): number {
  const value = Number(text);
  if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)) || canonicalNumber(text) !== canonicalNumber(String(value))) {
    throw new SqlSyntaxError("A SQL number cannot be represented safely as a JavaScript/JSON number; conversion would lose precision.", token);
  }
  return value;
}

function decodeString(token: SqlToken, dialect: SqlDialect): string {
  let text = token.text;
  if (text[0] === "$") {
    const tag = dollarDelimiter(text)!;
    return text.slice(tag.length, -tag.length);
  }
  const prefix = /^[eEnN]'/.test(text) ? text[0].toUpperCase() : "";
  if (prefix) text = text.slice(1);
  const quote = text[0];
  text = text.slice(1, -1).split(quote + quote).join(quote);
  if (dialect !== "MySQL" && !(dialect === "PostgreSQL" && prefix === "E")) return text;
  let output = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "\\") { output += text[i]; continue; }
    const next = text[++i];
    if (next === undefined) throw new SqlSyntaxError("Incomplete SQL string escape.", token);
    const common: Record<string, string> = { "0": "\0", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\", "'": "'", '"': '"' };
    if (dialect === "MySQL") {
      const mysql: Record<string, string> = { "0": "\0", b: "\b", n: "\n", r: "\r", t: "\t", Z: "\x1a", "\\": "\\", "'": "'", '"': '"', "%": "\\%", "_": "\\_" };
      output += mysql[next] ?? next; continue;
    }
    if (/[0-7]/.test(next)) {
      const digits = /^[0-7]{1,3}/.exec(text.slice(i))![0], value = parseInt(digits, 8);
      if (value > 127) throw new SqlSyntaxError("Non-ASCII PostgreSQL byte escapes need a database encoding and are unsupported.", token);
      if (value === 0) throw new SqlSyntaxError("PostgreSQL string literals cannot contain a zero byte.", token);
      output += String.fromCharCode(value); i += digits.length - 1;
    } else if (next === "x") {
      const digits = /^[0-9a-fA-F]{1,2}/.exec(text.slice(i + 1))?.[0];
      if (!digits) throw new SqlSyntaxError("Invalid PostgreSQL hexadecimal string escape.", token);
      // Non-ASCII byte escapes depend on database encoding, which is unavailable.
      const value = parseInt(digits, 16);
      if (value > 127) throw new SqlSyntaxError("Non-ASCII PostgreSQL byte escapes need a database encoding and are unsupported.", token);
      if (value === 0) throw new SqlSyntaxError("PostgreSQL string literals cannot contain a zero byte.", token);
      output += String.fromCharCode(value); i += digits.length;
    } else if (next === "u" || next === "U") {
      const length = next === "u" ? 4 : 8, digits = text.slice(i + 1, i + 1 + length);
      if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(digits)) throw new SqlSyntaxError("Invalid PostgreSQL Unicode string escape.", token);
      const value = parseInt(digits, 16);
      if (value === 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) throw new SqlSyntaxError("Unsupported Unicode code point in PostgreSQL escape.", token);
      output += String.fromCodePoint(value); i += length;
    } else output += common[next] ?? next;
  }
  return output;
}

type InsertCell = string | number | boolean | null;

function readCell(cursor: TokenCursor, dialect: SqlDialect, sql: string): InsertCell {
  let token = cursor.take();
  if (token.kind === "string") {
    let value = decodeString(token, dialect);
    while (cursor.peek()?.kind === "string") {
      const next = cursor.peek()!;
      if (dialect !== "PostgreSQL" || !/[\r\n]/.test(sql.slice(token.end, next.start)) || next.text[0] !== "'") cursor.fail("Adjacent string literals are unsupported except PostgreSQL newline continuation.");
      cursor.take(); value += decodeString(next, dialect); token = next;
    }
    return value;
  }
  let sign = "";
  if (token.text === "+" || token.text === "-") { sign = token.text; token = cursor.take(); }
  if (token.kind === "number") return exactNumber(sign + token.text, token);
  if (sign) cursor.fail("Unary signs require a numeric literal.");
  if (token.text.toUpperCase() === "NULL") return null;
  if (token.text.toUpperCase() === "TRUE" || token.text.toUpperCase() === "FALSE") {
    if (dialect === "SQL Server") cursor.fail("SQL Server Boolean values must be numeric 1/0 literals.");
    return token.text.toUpperCase() === "TRUE";
  }
  cursor.fail("INSERT conversion supports literal VALUES only; expressions, functions, casts, DEFAULT and SELECT are unsupported.");
}

function nameKey(name: string, dialect: SqlDialect): string { return dialect === "PostgreSQL" ? name : name.toLowerCase(); }
function readName(cursor: TokenCursor, dialect: SqlDialect): string {
  const token = cursor.take(), name = identifierValue(token);
  if (name.length > 128) cursor.fail("INSERT identifiers are limited to 128 characters.");
  return dialect === "PostgreSQL" && token.kind === "word" ? name.toLowerCase() : name;
}
function readQualifiedName(cursor: TokenCursor, dialect: SqlDialect): string {
  const parts = [readName(cursor, dialect)]; while (cursor.accept(".")) parts.push(readName(cursor, dialect));
  const maximumParts = dialect === "SQL Server" ? 4 : dialect === "PostgreSQL" ? 3 : 2;
  if (parts.length > maximumParts) cursor.fail("The table identifier has unsupported qualification for the selected dialect.");
  if (parts.some(part => part.includes("."))) cursor.fail("Quoted table identifiers containing dots are unsupported; use explicit qualification parts.");
  return parts.join(".");
}

export async function parseInsertData(sql: string, dialect: SqlDialect): Promise<{ columns: string[]; rows: InsertCell[][] }> {
  dialect = readDialect(dialect);
  const cursor = new TokenCursor(significantTokens(lexSql(sql, dialect)));
  let columns: string[] | undefined, table: string | undefined, statements = 0;
  const rows: InsertCell[][] = [];
  while (cursor.peek()) {
    if (++statements > 200) cursor.fail("SQL exceeds the 200-statement limit.");
    cursor.expect("INSERT"); cursor.expect("INTO");
    const currentTable = readQualifiedName(cursor, dialect);
    cursor.expect("("); const currentColumns: string[] = [];
    do { currentColumns.push(readName(cursor, dialect)); } while (cursor.accept(","));
    cursor.expect(")");
    if (currentColumns.length > 500) cursor.fail("INSERT conversion is limited to 500 columns.");
    if (new Set(currentColumns.map(name => nameKey(name, dialect))).size !== currentColumns.length) cursor.fail("Duplicate INSERT column names are unsupported.");
    if (columns && (currentTable !== table || currentColumns.length !== columns.length || currentColumns.some((name, i) => name !== columns![i]))) cursor.fail("All INSERT statements must use the same exact table identifier and identical ordered column names.");
    columns ??= currentColumns; table ??= currentTable;
    cursor.expect("VALUES");
    do {
      cursor.expect("("); const row: InsertCell[] = [];
      do { row.push(readCell(cursor, dialect, sql)); } while (cursor.accept(","));
      cursor.expect(")");
      if (row.length !== columns.length) cursor.fail("INSERT row arity does not match the named columns.");
      rows.push(row);
      if (rows.length > 10_000) cursor.fail("INSERT conversion is limited to 10,000 rows.");
    } while (cursor.accept(","));
    if (cursor.peek() && !cursor.accept(";")) cursor.fail("INSERT modifiers, conflict/duplicate clauses, RETURNING, and additional expressions are unsupported.");
  }
  if (!columns || !rows.length) throw new SqlSyntaxError("Enter INSERT statements with named columns and literal VALUES.");
  return { columns, rows };
}

export async function insertOutput(toolId: string, sql: string, dialect: SqlDialect): Promise<SqlResult> {
  const { columns, rows } = await parseInsertData(sql, dialect);
  // Repeated column names can amplify a short INSERT into a very large object array.
  // Check before allocating the output, not after JSON.stringify has created it.
  const keySize = columns.reduce((total, column) => total + JSON.stringify(column).length + 10, 0);
  let projectedSize = columns.join(",").length + 100;
  for (const row of rows) {
    projectedSize += keySize + row.reduce<number>((total, value) => total + JSON.stringify(value).length + 6, 0);
    if (projectedSize > 2_000_000) throw new SqlSyntaxError("INSERT conversion exceeds the 2,000,000-character output budget.");
  }
  if (toolId === "sql-to-json") return { rows: [{ label: "JSON array of objects", value: JSON.stringify(rows.map(row => Object.fromEntries(columns.map((column, i) => [column, row[i]]))), null, 2) }] };
  if (toolId === "sql-to-csv") {
    const csv = (value: InsertCell): string => value === null ? "" : typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : String(value);
    return { rows: [{ label: "CSV text", value: [columns.map(csv).join(","), ...rows.map(row => row.map(csv).join(","))].join("\r\n") }], warnings: ["CSV has no intrinsic null type: SQL NULL is an unquoted empty cell; empty strings are quoted empty cells. A CSV reader may discard this distinction."] };
  }
  if (toolId === "sql-to-markdown") {
    const markdown = (value: InsertCell): string => value === null ? "NULL" : String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, "<br>");
    const line = (values: InsertCell[]) => `| ${values.map(markdown).join(" | ")} |`;
    return { rows: [{ label: "Markdown table", value: [line(columns), line(columns.map(() => "---")), ...rows.map(line)].join("\n") }] };
  }
  throw new SqlSyntaxError("Unsupported SQL INSERT conversion tool.");
}
