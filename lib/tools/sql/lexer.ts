import type { SqlDialect } from "./types";

export type SqlTokenKind = "space" | "comment" | "protected" | "string" | "identifier" | "word" | "number" | "symbol";
export interface SqlToken { kind: SqlTokenKind; text: string; start: number; end: number; line: number; column: number }

export function dollarDelimiter(text: string): string | undefined {
  return /^(?:\$\$|\$[\p{L}_][\p{L}\p{M}\p{N}_]*\$)/u.exec(text)?.[0];
}

export class SqlSyntaxError extends Error {
  readonly line?: number;
  readonly column?: number;
  constructor(message: string, location?: { line: number; column: number }) {
    super(message);
    this.name = "SqlSyntaxError";
    this.line = location?.line;
    this.column = location?.column;
    // Never attach the library's error, stack, source, or expected-token dump.
    this.stack = `${this.name}: ${message}`;
  }
}

/** Source-preserving lexer. It deliberately makes no database/session SQL-mode guesses. */
export function lexSql(sql: string, dialect: SqlDialect): SqlToken[] {
  if (typeof sql !== "string" || !sql.trim()) throw new SqlSyntaxError("Enter SQL to process.");
  if (sql.length > 200_000) throw new SqlSyntaxError("SQL exceeds the 200,000-character limit.");
  const tokens: SqlToken[] = [];
  let i = 0, line = 1, column = 1, depth = 0, statements = 0;
  const fail = (message: string) => { throw new SqlSyntaxError(message, { line, column }); };
  const push = (kind: SqlTokenKind, end: number) => {
    const text = sql.slice(i, end);
    tokens.push({ kind, text, start: i, end, line, column });
    for (let j = i; j < end; j++) {
      if (sql[j] === "\n" || (sql[j] === "\r" && sql[j + 1] !== "\n")) { line++; column = 1; }
      else column++;
    }
    i = end;
    if (tokens.length > 50_000) fail("SQL exceeds the 50,000-token limit.");
  };
  while (i < sql.length) {
    const ch = sql[i];
    if (/\s/.test(ch)) { let j = i + 1; while (j < sql.length && /\s/.test(sql[j])) j++; push("space", j); continue; }
    if (ch === "\0") fail("SQL contains an unsupported NUL character.");
    if ((sql.startsWith("--", i) && (dialect !== "MySQL" || i + 2 === sql.length || /[\s\x00-\x1f]/.test(sql[i + 2]))) || (ch === "#" && dialect === "MySQL")) {
      let j = i + 1; while (j < sql.length && !/[\r\n]/.test(sql[j])) j++; push("comment", j); continue;
    }
    if (sql.startsWith("/*", i)) {
      const protectedComment = sql[i + 2] === "!" || sql[i + 2] === "+";
      if (sql[i + 2] === "!" && dialect !== "MySQL") fail("Executable comments are supported only for MySQL.");
      let nesting = 1, j = i + 2;
      while (j < sql.length && nesting) {
        if (sql.startsWith("/*", j)) {
          if (dialect !== "PostgreSQL" && dialect !== "SQL Server") fail("Nested block comments are unsupported for the selected dialect.");
          if (++nesting > 128) fail("SQL comment nesting exceeds the 128-level limit.");
          j += 2;
        } else if (sql.startsWith("*/", j)) { nesting--; j += 2; } else j++;
      }
      if (nesting) fail("Unterminated SQL block comment.");
      push(protectedComment ? "protected" : "comment", j); continue;
    }
    if (dialect === "PostgreSQL" && ch === "$") {
      const delimiter = dollarDelimiter(sql.slice(i));
      if (delimiter) {
        const end = sql.indexOf(delimiter, i + delimiter.length);
        if (end < 0) fail("Unterminated PostgreSQL dollar-quoted string.");
        push("string", end + delimiter.length); continue;
      }
    }
    const prefixed = ((dialect === "PostgreSQL" && /[eE]/.test(ch)) || ((dialect === "SQL Server" || dialect === "MySQL") && /[nN]/.test(ch))) && sql[i + 1] === "'";
    const quote = prefixed ? "'" : ch;
    if (quote === "'" || quote === '"' || quote === "`" || quote === "[") {
      if (quote === "`" && dialect !== "MySQL" && dialect !== "SQLite") fail("Backtick identifiers are unsupported for the selected dialect.");
      if (quote === "[" && dialect !== "SQL Server" && dialect !== "SQLite") {
        push("symbol", i + 1); continue;
      }
      const closing = quote === "[" ? "]" : quote;
      const kind: SqlTokenKind = quote === "'" || (quote === '"' && dialect === "MySQL") ? "string" : "identifier";
      const escapes = (kind === "string" && dialect === "MySQL") || (prefixed && dialect === "PostgreSQL");
      let j = i + (prefixed ? 2 : 1), closed = false;
      while (j < sql.length) {
        if (escapes && sql[j] === "\\") { j += 2; continue; }
        if (sql[j] === closing) {
          if (sql[j + 1] === closing) { j += 2; continue; }
          j++; closed = true; break;
        }
        j++;
      }
      if (!closed) fail(kind === "string" ? "Unterminated SQL string literal." : "Unterminated quoted SQL identifier.");
      push(kind, j); continue;
    }
    if (/[A-Za-z_\u0080-\uffff]/.test(ch) || (ch === "@" && dialect === "SQL Server") || (ch === "#" && dialect === "SQL Server")) {
      let j = i + 1; while (j < sql.length && /[A-Za-z0-9_$@#\u0080-\uffff]/.test(sql[j])) j++;
      push("word", j); continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(sql[i + 1] ?? ""))) {
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(sql.slice(i))![0];
      push("number", i + number.length); continue;
    }
    if (ch === "(") { if (++depth > 128) fail("SQL nesting exceeds the 128-level limit."); }
    if (ch === ")") { if (--depth < 0) fail("Unexpected closing parenthesis."); }
    if (ch === ";" && ++statements > 200) fail("SQL exceeds the 200-statement limit.");
    const operator = /^(?:->>|->|#>>|#>|::|>=|<=|<>|!=|\|\||&&|:=|!~\*|!~|~\*|<<|>>)/.exec(sql.slice(i))?.[0];
    if (operator === "::" && dialect !== "PostgreSQL") fail("PostgreSQL :: casts are unsupported for the selected dialect.");
    push("symbol", i + (operator?.length ?? 1));
  }
  if (depth) throw new SqlSyntaxError("Unclosed SQL parenthesis.", { line, column });
  if (!tokens.some(t => t.kind !== "space" && t.kind !== "comment")) throw new SqlSyntaxError("Enter a SQL statement, not only comments.");
  return tokens;
}

export function significantTokens(tokens: SqlToken[]): SqlToken[] { return tokens.filter(t => t.kind !== "space" && t.kind !== "comment"); }

export function identifierValue(token: SqlToken | undefined): string {
  if (!token || (token.kind !== "word" && token.kind !== "identifier")) throw new SqlSyntaxError("A named SQL identifier is required.", token);
  if (token.kind === "word") return token.text;
  const end = token.text[0] === "[" ? "]" : token.text[0];
  return token.text.slice(1, -1).split(end + end).join(end);
}

export class TokenCursor {
  index = 0;
  constructor(readonly tokens: SqlToken[]) {}
  peek(): SqlToken | undefined { return this.tokens[this.index]; }
  is(text: string): boolean { return this.peek()?.text.toUpperCase() === text.toUpperCase(); }
  take(): SqlToken { const token = this.tokens[this.index++]; if (!token) this.fail("Unexpected end of SQL."); return token; }
  accept(text: string): boolean { if (!this.is(text)) return false; this.index++; return true; }
  expect(text: string): void { if (!this.accept(text)) this.fail("Unexpected SQL syntax in the supported statement subset."); }
  identifier(): string { return identifierValue(this.take()); }
  qualifiedIdentifier(): string { const parts = [this.identifier()]; while (this.accept(".")) parts.push(this.identifier()); if (parts.length > 3) this.fail("SQL identifiers may have at most three qualification parts."); return parts.join("."); }
  fail(message: string): never { throw new SqlSyntaxError(message, this.peek() ?? this.tokens[this.tokens.length - 1]); }
}
