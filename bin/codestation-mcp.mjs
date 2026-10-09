#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// lib/tools/sql/types.ts
var SQL_DIALECTS, VALUE_TYPES, CONDITION_OPERATORS;
var init_types = __esm({
  "lib/tools/sql/types.ts"() {
    "use strict";
    SQL_DIALECTS = ["PostgreSQL", "MySQL", "SQLite", "SQL Server"];
    VALUE_TYPES = ["String", "Number", "Boolean", "NULL"];
    CONDITION_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "LIKE", "NOT LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"];
  }
});

// lib/tools/sql/literals.ts
function readDialect(value) {
  if (typeof value !== "string" || !SQL_DIALECTS.includes(value)) {
    throw new Error("Choose PostgreSQL, MySQL, SQLite, or SQL Server.");
  }
  return value;
}
function sqlText(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  if (value.length > SQL_TEXT_LIMIT) throw new Error(`${label} exceeds the 200,000-character limit.`);
  return value;
}
function quoteIdentifier(name2, dialect, qualified2 = false) {
  readDialect(dialect);
  if (typeof name2 !== "string") throw new Error("Identifiers must be text.");
  const parts = qualified2 ? name2.split(".") : [name2];
  const maximumParts = dialect === "SQL Server" ? 4 : dialect === "PostgreSQL" ? 3 : 2;
  if (parts.some((part) => dialect === "PostgreSQL" ? new TextEncoder().encode(part).length > 63 : dialect === "MySQL" ? [...part].length > 64 : part.length > 128)) {
    throw new Error("Identifiers exceed the supported length: PostgreSQL 63 UTF-8 bytes, MySQL 64 characters, SQLite/SQL Server 128 UTF-16 units.");
  }
  if (parts.length > maximumParts || parts.some((part) => part.length > 128 || !/^[\p{L}_][\p{L}\p{M}\p{N}_$]*$/u.test(part))) {
    throw new Error(`Use raw identifiers of 1\u2013128 characters: start with a letter or underscore, then letters, marks, numbers, underscore, or $. This dialect allows at most ${maximumParts} table qualification parts.`);
  }
  return parts.map((part) => dialect === "MySQL" ? `\`${part}\`` : dialect === "SQL Server" ? `[${part}]` : `"${part}"`).join(".");
}
function stringLiteral(value, dialect) {
  if (value.includes("\0")) throw new Error("SQL strings cannot contain a NUL character.");
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
    throw new Error("SQL strings must contain valid Unicode, without unpaired surrogates.");
  }
  let escaped = value;
  if (dialect === "MySQL") escaped = escaped.replace(/\\/g, "\\\\").replace(/\x1a/g, "\\Z");
  escaped = escaped.replace(/'/g, "''");
  return `${dialect === "SQL Server" ? "N" : ""}'${escaped}'`;
}
function sqlLiteral(literal, dialect) {
  readDialect(dialect);
  if (!literal || typeof literal !== "object" || Array.isArray(literal) || !VALUE_TYPES.includes(literal.type)) {
    throw new Error("Choose String, Number, Boolean, or NULL for each value.");
  }
  const value = sqlText(literal.value, "Literal value");
  if (literal.type === "NULL") return "NULL";
  if (literal.type === "String") return stringLiteral(value, dialect);
  if (literal.type === "Boolean") {
    if (!/^(true|false)$/i.test(value)) throw new Error("Boolean values must be true or false.");
    const truth = value.toLowerCase() === "true";
    return dialect === "SQL Server" ? truth ? "1" : "0" : truth ? "TRUE" : "FALSE";
  }
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new Error("Number values must be finite decimal numbers, with an optional exponent and no SQL expressions.");
  }
  if (Number(value) === 0 && /[1-9]/.test(value.split(/[eE]/)[0])) throw new Error("Number is too small to represent as a finite nonzero number.");
  return value;
}
function jsonLiteral(value, dialect) {
  if (value === null) return sqlLiteral({ type: "NULL", value: "" }, dialect);
  if (typeof value === "string") return sqlLiteral({ type: "String", value }, dialect);
  if (typeof value === "boolean") return sqlLiteral({ type: "Boolean", value: String(value) }, dialect);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new Error("JSON numbers must be finite and integers must be safe; quote precision-sensitive numbers as strings.");
    }
    return sqlLiteral({ type: "Number", value: String(value) }, dialect);
  }
  throw new Error("JSON SQL values must be strings, numbers, booleans, or null; nested arrays and objects are unsupported.");
}
var SQL_TEXT_LIMIT;
var init_literals = __esm({
  "lib/tools/sql/literals.ts"() {
    "use strict";
    init_types();
    SQL_TEXT_LIMIT = 2e5;
  }
});

// lib/tools/sql/lexer.ts
function dollarDelimiter(text3) {
  return /^(?:\$\$|\$[\p{L}_][\p{L}\p{M}\p{N}_]*\$)/u.exec(text3)?.[0];
}
function lexSql(sql, dialect) {
  if (typeof sql !== "string" || !sql.trim()) throw new SqlSyntaxError("Enter SQL to process.");
  if (sql.length > 2e5) throw new SqlSyntaxError("SQL exceeds the 200,000-character limit.");
  const tokens = [];
  let i = 0, line = 1, column = 1, depth = 0, statements = 0;
  const fail = (message) => {
    throw new SqlSyntaxError(message, { line, column });
  };
  const push = (kind, end) => {
    const text3 = sql.slice(i, end);
    tokens.push({ kind, text: text3, start: i, end, line, column });
    for (let j = i; j < end; j++) {
      if (sql[j] === "\n" || sql[j] === "\r" && sql[j + 1] !== "\n") {
        line++;
        column = 1;
      } else column++;
    }
    i = end;
    if (tokens.length > 5e4) fail("SQL exceeds the 50,000-token limit.");
  };
  while (i < sql.length) {
    const ch = sql[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      push("space", j);
      continue;
    }
    if (ch === "\0") fail("SQL contains an unsupported NUL character.");
    if (sql.startsWith("--", i) && (dialect !== "MySQL" || i + 2 === sql.length || /[\s\x00-\x1f]/.test(sql[i + 2])) || ch === "#" && dialect === "MySQL") {
      let j = i + 1;
      while (j < sql.length && !/[\r\n]/.test(sql[j])) j++;
      push("comment", j);
      continue;
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
        } else if (sql.startsWith("*/", j)) {
          nesting--;
          j += 2;
        } else j++;
      }
      if (nesting) fail("Unterminated SQL block comment.");
      push(protectedComment ? "protected" : "comment", j);
      continue;
    }
    if (dialect === "PostgreSQL" && ch === "$") {
      const delimiter = dollarDelimiter(sql.slice(i));
      if (delimiter) {
        const end = sql.indexOf(delimiter, i + delimiter.length);
        if (end < 0) fail("Unterminated PostgreSQL dollar-quoted string.");
        push("string", end + delimiter.length);
        continue;
      }
    }
    const prefixed = (dialect === "PostgreSQL" && /[eE]/.test(ch) || (dialect === "SQL Server" || dialect === "MySQL") && /[nN]/.test(ch)) && sql[i + 1] === "'";
    const quote = prefixed ? "'" : ch;
    if (quote === "'" || quote === '"' || quote === "`" || quote === "[") {
      if (quote === "`" && dialect !== "MySQL" && dialect !== "SQLite") fail("Backtick identifiers are unsupported for the selected dialect.");
      if (quote === "[" && dialect !== "SQL Server" && dialect !== "SQLite") {
        push("symbol", i + 1);
        continue;
      }
      const closing = quote === "[" ? "]" : quote;
      const kind = quote === "'" || quote === '"' && dialect === "MySQL" ? "string" : "identifier";
      const escapes = kind === "string" && dialect === "MySQL" || prefixed && dialect === "PostgreSQL";
      let j = i + (prefixed ? 2 : 1), closed = false;
      while (j < sql.length) {
        if (escapes && sql[j] === "\\") {
          j += 2;
          continue;
        }
        if (sql[j] === closing) {
          if (sql[j + 1] === closing) {
            j += 2;
            continue;
          }
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (!closed) fail(kind === "string" ? "Unterminated SQL string literal." : "Unterminated quoted SQL identifier.");
      push(kind, j);
      continue;
    }
    if (/[A-Za-z_\u0080-\uffff]/.test(ch) || ch === "@" && dialect === "SQL Server" || ch === "#" && dialect === "SQL Server") {
      let j = i + 1;
      while (j < sql.length && /[A-Za-z0-9_$@#\u0080-\uffff]/.test(sql[j])) j++;
      push("word", j);
      continue;
    }
    if (/[0-9]/.test(ch) || ch === "." && /[0-9]/.test(sql[i + 1] ?? "")) {
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(sql.slice(i))[0];
      push("number", i + number.length);
      continue;
    }
    if (ch === "(") {
      if (++depth > 128) fail("SQL nesting exceeds the 128-level limit.");
    }
    if (ch === ")") {
      if (--depth < 0) fail("Unexpected closing parenthesis.");
    }
    if (ch === ";" && ++statements > 200) fail("SQL exceeds the 200-statement limit.");
    const operator = /^(?:->>|->|#>>|#>|::|>=|<=|<>|!=|\|\||&&|:=|!~\*|!~|~\*|<<|>>)/.exec(sql.slice(i))?.[0];
    if (operator === "::" && dialect !== "PostgreSQL") fail("PostgreSQL :: casts are unsupported for the selected dialect.");
    push("symbol", i + (operator?.length ?? 1));
  }
  if (depth) throw new SqlSyntaxError("Unclosed SQL parenthesis.", { line, column });
  if (!tokens.some((t) => t.kind !== "space" && t.kind !== "comment")) throw new SqlSyntaxError("Enter a SQL statement, not only comments.");
  return tokens;
}
function significantTokens(tokens) {
  return tokens.filter((t) => t.kind !== "space" && t.kind !== "comment");
}
function identifierValue(token) {
  if (!token || token.kind !== "word" && token.kind !== "identifier") throw new SqlSyntaxError("A named SQL identifier is required.", token);
  if (token.kind === "word") return token.text;
  const end = token.text[0] === "[" ? "]" : token.text[0];
  return token.text.slice(1, -1).split(end + end).join(end);
}
var SqlSyntaxError, TokenCursor;
var init_lexer = __esm({
  "lib/tools/sql/lexer.ts"() {
    "use strict";
    SqlSyntaxError = class extends Error {
      constructor(message, location) {
        super(message);
        this.name = "SqlSyntaxError";
        this.line = location?.line;
        this.column = location?.column;
        this.stack = `${this.name}: ${message}`;
      }
    };
    TokenCursor = class {
      constructor(tokens) {
        this.tokens = tokens;
        this.index = 0;
      }
      peek() {
        return this.tokens[this.index];
      }
      is(text3) {
        return this.peek()?.text.toUpperCase() === text3.toUpperCase();
      }
      take() {
        const token = this.tokens[this.index++];
        if (!token) this.fail("Unexpected end of SQL.");
        return token;
      }
      accept(text3) {
        if (!this.is(text3)) return false;
        this.index++;
        return true;
      }
      expect(text3) {
        if (!this.accept(text3)) this.fail("Unexpected SQL syntax in the supported statement subset.");
      }
      identifier() {
        return identifierValue(this.take());
      }
      qualifiedIdentifier() {
        const parts = [this.identifier()];
        while (this.accept(".")) parts.push(this.identifier());
        if (parts.length > 3) this.fail("SQL identifiers may have at most three qualification parts.");
        return parts.join(".");
      }
      fail(message) {
        throw new SqlSyntaxError(message, this.peek() ?? this.tokens[this.tokens.length - 1]);
      }
    };
  }
});

// lib/tools/sql/parser.ts
async function parseSql(sql, dialect) {
  dialect = readDialect(dialect);
  lexSql(sql, dialect);
  const parserModule = await engines[dialect]();
  try {
    const exported = parserModule;
    const Parser = exported.Parser ?? exported.default?.Parser;
    if (!Parser) throw new SqlSyntaxError("The local dialect parser could not initialize.");
    const ast = new Parser().astify(sql);
    const statements = Array.isArray(ast) ? ast : [ast];
    if (!statements.length || statements.length > 200) throw new SqlSyntaxError("SQL must contain between 1 and 200 statements.");
    if (statements.some((statement) => typeof statement.type !== "string")) throw new SqlSyntaxError("The selected parser returned an unsupported statement form.");
    if (dialect === "SQL Server") {
      const pending = [...statements];
      while (pending.length) {
        const value = pending.pop();
        if (!value || typeof value !== "object") continue;
        const record2 = value;
        if (record2.type === "select" && record2.limit) throw new SqlSyntaxError("LIMIT is unsupported for SQL Server; use its native TOP or OFFSET/FETCH syntax.");
        pending.push(...Object.values(record2).filter((child) => child && typeof child === "object"));
      }
    }
    return statements;
  } catch (error) {
    if (error instanceof SqlSyntaxError) throw error;
    const location = error?.location?.start;
    const safeLocation = typeof location?.line === "number" && typeof location.column === "number" ? { line: location.line, column: location.column } : void 0;
    throw new SqlSyntaxError(`SQL is invalid or unsupported by the ${dialect} parser's supported syntax subset.`, safeLocation);
  }
}
var engines;
var init_parser = __esm({
  "lib/tools/sql/parser.ts"() {
    "use strict";
    init_lexer();
    init_literals();
    init_lexer();
    engines = {
      PostgreSQL: () => import("node-sql-parser/build/postgresql"),
      MySQL: () => import("node-sql-parser/build/mysql"),
      SQLite: () => import("node-sql-parser/build/sqlite"),
      "SQL Server": () => import("node-sql-parser/build/transactsql")
    };
  }
});

// lib/tools/sql/ddl.ts
var ddl_exports = {};
__export(ddl_exports, {
  ddlOutput: () => ddlOutput,
  parseDdl: () => parseDdl
});
function key(name2, dialect) {
  return dialect === "PostgreSQL" ? name2 : name2.toLowerCase();
}
function name(cursor, dialect) {
  const token = cursor.take(), value = identifierValue(token);
  if (value.length > 128) cursor.fail("DDL identifiers are limited to 128 characters.");
  return dialect === "PostgreSQL" && token.kind === "word" ? value.toLowerCase() : value;
}
function qualified(cursor, dialect) {
  const parts = [name(cursor, dialect)];
  while (cursor.accept(".")) parts.push(name(cursor, dialect));
  if (parts.length > 3) cursor.fail("Table names may have at most three qualification parts.");
  if (parts.some((part) => part.includes("."))) cursor.fail("Quoted identifiers containing dots are unsupported; use explicit qualification parts.");
  return parts.join(".");
}
function columns(cursor, dialect) {
  cursor.expect("(");
  const values = [];
  do {
    values.push(name(cursor, dialect));
  } while (cursor.accept(","));
  cursor.expect(")");
  if (new Set(values.map((value) => key(value, dialect))).size !== values.length) cursor.fail("Duplicate columns in a key constraint.");
  return values;
}
function parenthesized(cursor, allowEmpty = false) {
  cursor.expect("(");
  let depth = 1;
  const result2 = [];
  while (depth) {
    const token = cursor.take();
    if (token.text === "(") depth++;
    if (token.text === ")") depth--;
    if (depth) result2.push(token);
  }
  if (!result2.length && !allowEmpty) cursor.fail("Empty parenthesized SQL definition is unsupported.");
  return result2;
}
function reference(cursor, dialect, localColumns) {
  cursor.expect("REFERENCES");
  const referencedTable = qualified(cursor, dialect), referencedColumns = columns(cursor, dialect);
  if (localColumns.length !== referencedColumns.length) cursor.fail("Foreign-key column counts do not match the referenced column counts.");
  let match = false;
  const actions = /* @__PURE__ */ new Set();
  while (cursor.is("MATCH") || cursor.is("ON")) {
    if (cursor.accept("MATCH")) {
      if (match) cursor.fail("Duplicate foreign-key MATCH clause.");
      match = true;
      if (!cursor.accept("SIMPLE") && !cursor.accept("FULL") && !cursor.accept("PARTIAL")) cursor.fail("Unsupported foreign-key MATCH clause.");
    } else {
      cursor.expect("ON");
      const action = cursor.take().text.toUpperCase();
      if (action !== "DELETE" && action !== "UPDATE" || actions.has(action)) cursor.fail("Invalid or duplicate foreign-key action.");
      actions.add(action);
      if (cursor.accept("SET")) {
        if (!cursor.accept("NULL") && !cursor.accept("DEFAULT")) cursor.fail("Unsupported foreign-key SET action.");
      } else if (cursor.accept("NO")) cursor.expect("ACTION");
      else if (!cursor.accept("CASCADE") && !cursor.accept("RESTRICT")) cursor.fail("Unsupported foreign-key action.");
    }
  }
  return { columns: localColumns, referencedTable, referencedColumns };
}
function dataType(cursor, dialect, sql) {
  const start = cursor.peek()?.start;
  if (start === void 0) cursor.fail("A declared column type is required.");
  const first = name(cursor, dialect).toUpperCase();
  while (cursor.accept(".")) name(cursor, dialect);
  if (first === "DOUBLE") cursor.accept("PRECISION");
  if (first === "CHARACTER" || first === "CHAR" || first === "BIT") cursor.accept("VARYING");
  if (first === "NATIONAL") {
    if (!cursor.accept("VARCHAR") && !cursor.accept("CHAR") && !cursor.accept("CHARACTER")) cursor.fail("Unsupported NATIONAL column type.");
    cursor.accept("VARYING");
  }
  if (cursor.is("(")) {
    const args = parenthesized(cursor);
    if (args.some((token, i) => i % 2 === 1 ? token.text !== "," : token.kind !== "number" && token.kind !== "string" && token.text.toUpperCase() !== "MAX") || args.length % 2 === 0) cursor.fail("Unsupported column-type parameters.");
  }
  if (first === "TIMESTAMP" || first === "TIME") {
    if (cursor.accept("WITH") || cursor.accept("WITHOUT")) {
      cursor.expect("TIME");
      cursor.expect("ZONE");
    }
  }
  if (dialect === "MySQL") {
    cursor.accept("UNSIGNED");
    cursor.accept("ZEROFILL");
  }
  if (dialect === "PostgreSQL") while (cursor.accept("[")) {
    if (cursor.peek()?.kind === "number") cursor.take();
    cursor.expect("]");
  }
  const end = cursor.tokens[cursor.index - 1].end;
  return sql.slice(start, end).trim();
}
function parseDefinition(tokens, table, dialect, sql) {
  const cursor = new TokenCursor(tokens);
  if (cursor.accept("CONSTRAINT")) name(cursor, dialect);
  if (cursor.accept("PRIMARY")) {
    cursor.expect("KEY");
    if (dialect === "SQL Server") {
      cursor.accept("CLUSTERED");
      cursor.accept("NONCLUSTERED");
    }
    if (table.primaryKeys.length) cursor.fail("A table may declare only one primary key.");
    table.primaryKeys = columns(cursor, dialect);
  } else if (cursor.accept("FOREIGN")) {
    cursor.expect("KEY");
    const localColumns = columns(cursor, dialect);
    table.foreignKeys.push(reference(cursor, dialect, localColumns));
  } else if (cursor.accept("UNIQUE")) {
    columns(cursor, dialect);
  } else if (cursor.accept("CHECK")) {
    parenthesized(cursor);
  } else {
    const columnName = name(cursor, dialect);
    if (table.columns.some((column2) => key(column2.name, dialect) === key(columnName, dialect))) cursor.fail("Duplicate column identifiers in CREATE TABLE.");
    const declaredType = dataType(cursor, dialect, sql);
    const column = { name: columnName, dataType: declaredType, primaryKey: false, nullable: true };
    let explicitNullability = false, hasDefault = false, hasReference = false, primary = false;
    while (cursor.peek()) {
      if (cursor.accept("CONSTRAINT")) {
        name(cursor, dialect);
        continue;
      }
      if (cursor.accept("PRIMARY")) {
        cursor.expect("KEY");
        if (primary || table.primaryKeys.length) cursor.fail("A table may declare only one primary key.");
        primary = true;
        table.primaryKeys = [columnName];
        column.primaryKey = true;
      } else if (cursor.accept("NOT")) {
        cursor.expect("NULL");
        if (explicitNullability) cursor.fail("Duplicate column nullability declaration.");
        explicitNullability = true;
        column.nullable = false;
      } else if (cursor.accept("NULL")) {
        if (explicitNullability) cursor.fail("Duplicate column nullability declaration.");
        explicitNullability = true;
        column.nullable = true;
      } else if (cursor.is("REFERENCES")) {
        if (hasReference) cursor.fail("Duplicate inline foreign-key declaration.");
        hasReference = true;
        table.foreignKeys.push(reference(cursor, dialect, [columnName]));
      } else if (cursor.accept("DEFAULT")) {
        if (hasDefault) cursor.fail("Duplicate column DEFAULT declaration.");
        hasDefault = true;
        const start = cursor.index;
        if (cursor.is("(")) parenthesized(cursor);
        else {
          if (cursor.is("+") || cursor.is("-")) cursor.take();
          cursor.take();
          if (cursor.is("(")) parenthesized(cursor, true);
          while (cursor.accept("::")) qualified(cursor, dialect);
        }
        if (cursor.index === start) cursor.fail("A DEFAULT expression is required.");
      } else if (cursor.accept("UNIQUE")) {
      } else if (cursor.accept("CHECK")) parenthesized(cursor);
      else if (cursor.accept("COLLATE")) qualified(cursor, dialect);
      else if (cursor.accept("AUTO_INCREMENT")) {
        if (dialect !== "MySQL") cursor.fail("AUTO_INCREMENT is supported only for MySQL.");
      } else if (cursor.accept("AUTOINCREMENT")) {
        if (dialect !== "SQLite" || !primary || declaredType.toUpperCase() !== "INTEGER") cursor.fail("SQLite AUTOINCREMENT requires an INTEGER PRIMARY KEY.");
      } else if (cursor.accept("IDENTITY")) {
        if (dialect !== "SQL Server") cursor.fail("IDENTITY is supported only for SQL Server.");
        if (cursor.is("(")) parenthesized(cursor);
      } else cursor.fail("Unsupported column constraint or definition; no schema details were discarded.");
    }
    table.columns.push(column);
  }
  if (cursor.peek()) cursor.fail("Unsupported table constraint options; no schema details were discarded.");
}
async function parseDdl(sql, dialect) {
  dialect = readDialect(dialect);
  const tokens = significantTokens(lexSql(sql, dialect)), cursor = new TokenCursor(tokens);
  const tables = [];
  let totalColumns = 0, totalRelationships = 0;
  const serverValidationTokens = [];
  while (cursor.peek()) {
    const tableStart = cursor.index;
    cursor.expect("CREATE");
    if (cursor.accept("TEMP") || cursor.accept("TEMPORARY")) {
      if (dialect === "SQL Server") cursor.fail("SQL Server temporary tables use a # table name.");
    }
    cursor.expect("TABLE");
    if (cursor.accept("IF")) {
      if (dialect === "SQL Server") cursor.fail("IF NOT EXISTS is unsupported for SQL Server CREATE TABLE.");
      cursor.expect("NOT");
      cursor.expect("EXISTS");
    }
    const table = { name: qualified(cursor, dialect), columns: [], primaryKeys: [], foreignKeys: [] };
    if (tables.some((existing) => key(existing.name, dialect) === key(table.name, dialect))) cursor.fail("Duplicate CREATE TABLE identifiers.");
    cursor.expect("(");
    const openIndex = cursor.index - 1;
    const definitions = [];
    let segment = [], depth = 0;
    while (cursor.peek() && !(cursor.is(")") && depth === 0)) {
      const token = cursor.take();
      if (token.text === "," && depth === 0) {
        if (!segment.length) cursor.fail("Empty CREATE TABLE definition.");
        definitions.push(segment);
        segment = [];
      } else {
        if (token.text === "(") depth++;
        else if (token.text === ")") depth--;
        segment.push(token);
      }
    }
    if (!segment.length) cursor.fail("CREATE TABLE needs nonempty named columns and no trailing comma.");
    definitions.push(segment);
    cursor.expect(")");
    const closeIndex = cursor.index - 1;
    for (const definition of definitions) parseDefinition(definition, table, dialect, sql);
    if (!table.columns.length) cursor.fail("CREATE TABLE needs at least one named column.");
    const local = new Set(table.columns.map((column) => key(column.name, dialect)));
    for (const primaryKey of table.primaryKeys) if (!local.has(key(primaryKey, dialect))) cursor.fail("A primary-key column is not declared in its table.");
    for (const foreignKey of table.foreignKeys) for (const column of foreignKey.columns) if (!local.has(key(column, dialect))) cursor.fail("A foreign-key column is not declared in its table.");
    for (const column of table.columns) {
      column.primaryKey = table.primaryKeys.some((primaryKey) => key(primaryKey, dialect) === key(column.name, dialect));
      if (column.primaryKey && (dialect !== "SQLite" || table.primaryKeys.length === 1 && column.dataType.toUpperCase() === "INTEGER")) column.nullable = false;
    }
    tables.push(table);
    totalColumns += table.columns.length;
    totalRelationships += table.foreignKeys.length;
    if (tables.length > 50 || totalColumns > 500 || totalRelationships > 200) cursor.fail("DDL is limited to 50 tables, 500 columns and 200 foreign-key relationships.");
    if (cursor.peek() && !cursor.accept(";")) cursor.fail("Only CREATE TABLE statements are supported; table options, ALTER and other statements are unsupported.");
    if (dialect === "SQL Server") {
      serverValidationTokens.push(...tokens.slice(tableStart, openIndex + 1));
      const retained = [];
      for (const definition of definitions) {
        let start = 0;
        if (definition[0]?.text.toUpperCase() === "CONSTRAINT") start = 2;
        if (definition[start]?.text.toUpperCase() === "FOREIGN") continue;
        const referenceIndex = definition.findIndex((token) => token.kind === "word" && token.text.toUpperCase() === "REFERENCES");
        if (referenceIndex < 0) retained.push(definition);
        else {
          const refCursor = new TokenCursor(definition);
          refCursor.index = referenceIndex;
          reference(refCursor, dialect, ["column"]);
          const refStart = definition[referenceIndex - 2]?.text.toUpperCase() === "CONSTRAINT" ? referenceIndex - 2 : referenceIndex;
          retained.push([...definition.slice(0, refStart), ...definition.slice(refCursor.index)]);
        }
      }
      retained.forEach((definition, index) => {
        if (index) serverValidationTokens.push({ ...tokens[openIndex], text: "," });
        serverValidationTokens.push(...definition);
      });
      serverValidationTokens.push(tokens[closeIndex], { ...tokens[closeIndex], text: ";" });
    }
  }
  await parseSql(dialect === "SQL Server" ? serverValidationTokens.map((token) => token.text).join(" ") : sql, dialect);
  const relationships = tables.flatMap((table) => table.foreignKeys.map((foreignKey) => ({ fromTable: table.name, fromColumns: foreignKey.columns, toTable: foreignKey.referencedTable, toColumns: foreignKey.referencedColumns })));
  for (const relationship of relationships) {
    const target = tables.find((table) => key(table.name, dialect) === key(relationship.toTable, dialect));
    if (target && relationship.toColumns.some((column) => !target.columns.some((candidate) => key(candidate.name, dialect) === key(column, dialect)))) throw new SqlSyntaxError("A foreign key references a missing column in a locally declared table.");
    if (target) relationship.toTable = target.name;
  }
  return { tables, relationships };
}
async function ddlOutput(sql, dialect) {
  const schema = await parseDdl(sql, dialect);
  const columns2 = schema.tables.flatMap((table) => table.columns.map((column) => `${table.name}.${column.name}: ${column.dataType}${column.primaryKey ? " [PK]" : ""}${column.nullable === false ? " NOT NULL" : ""}`));
  const primaryKeys = schema.tables.filter((table) => table.primaryKeys.length).map((table) => `${table.name}: (${table.primaryKeys.join(", ")})`);
  const relationships = schema.relationships.map((link) => `${link.fromTable} (${link.fromColumns.join(", ")}) \u2192 ${link.toTable} (${link.toColumns.join(", ")})`);
  return { schema, rows: [
    { label: "Entity relationship diagram", value: [`Tables: ${schema.tables.map((table) => table.name).join(", ")}`, ...relationships].join("\n") },
    { label: "Parsed tables", value: schema.tables.map((table) => table.name).join("\n") },
    { label: "Columns", value: columns2.join("\n") },
    { label: "Primary keys", value: primaryKeys.join("\n") || "None declared" },
    { label: "Foreign-key relationships", value: relationships.join("\n") || "None declared" }
  ], warnings: ["Relationships come only from explicitly declared foreign keys. External referenced tables are retained. This does not verify database objects or referential integrity."] };
}
var init_ddl = __esm({
  "lib/tools/sql/ddl.ts"() {
    "use strict";
    init_lexer();
    init_literals();
    init_parser();
  }
});

// lib/tools/sql/transforms.ts
var transforms_exports = {};
__export(transforms_exports, {
  formatSqlTool: () => formatSqlTool,
  insertOutput: () => insertOutput,
  minifySqlTool: () => minifySqlTool,
  parseInsertData: () => parseInsertData,
  validateSqlTool: () => validateSqlTool
});
async function validateSqlTool(sql, dialect) {
  dialect = readDialect(dialect);
  try {
    await parseSql(sql, dialect);
    return { rows: [{ label: "Valid/Invalid status", value: "Valid" }, { label: "Syntax error message", value: "None" }, { label: "Error location", value: "None" }], warnings: [parserWarning] };
  } catch (error) {
    const safe = error instanceof SqlSyntaxError ? error : new SqlSyntaxError("The selected dialect parser could not process this SQL.");
    return { rows: [{ label: "Valid/Invalid status", value: "Invalid" }, { label: "Syntax error message", value: safe.message }, { label: "Error location", value: safe.line && safe.column ? `Line ${safe.line}, Column ${safe.column}` : "Unavailable" }], warnings: [parserWarning] };
  }
}
async function minifySqlTool(sql, dialect) {
  dialect = readDialect(dialect);
  const tokens = lexSql(sql, dialect);
  const surviving = significantTokens(tokens);
  const containsContinuation = dialect === "PostgreSQL" && surviving.some((token, i) => i > 0 && token.kind === "string" && surviving[i - 1].kind === "string" && /[\r\n]/.test(sql.slice(surviving[i - 1].end, token.start)));
  const knownParserExtension = containsContinuation || tokens.some((token) => token.kind === "protected" || token.kind === "comment" && token.text.slice(2).includes("/*"));
  await parseSql(sql, dialect).catch(async (error) => {
    if (!(error instanceof SqlSyntaxError)) throw error;
    if (dialect === "SQL Server" && surviving[0]?.text.toUpperCase() === "CREATE" && surviving.some((token) => token.kind === "word" && token.text.toUpperCase() === "REFERENCES")) {
      const { parseDdl: parseDdl2 } = await Promise.resolve().then(() => (init_ddl(), ddl_exports));
      await parseDdl2(sql, dialect);
      return;
    }
    if (!knownParserExtension) throw error;
  });
  let output2 = "", pending = "", previous;
  for (const token of tokens) {
    if (token.kind === "space") {
      pending += token.text;
      continue;
    }
    if (token.kind === "comment") {
      pending += token.text.includes("\n") || token.text.includes("\r") ? "\n" : " ";
      continue;
    }
    if (previous && pending) {
      const continuation = /[\r\n]/.test(pending) && (dialect === "PostgreSQL" && previous.kind === "string" && token.kind === "string" || dialect === "SQL Server");
      output2 += continuation ? "\n" : " ";
    }
    output2 += token.text;
    previous = token;
    pending = "";
  }
  return { rows: [{ label: "Minified SQL", value: output2 }], warnings: ["Formatting whitespace and ordinary comments are removed conservatively. Executable/hint comments and newline-sensitive PostgreSQL string continuation are preserved. This is not a database syntax check."] };
}
async function formatSqlTool(sql, dialect) {
  dialect = readDialect(dialect);
  const sourceTokens = significantTokens(lexSql(sql, dialect));
  let warning;
  try {
    await parseSql(sql, dialect);
  } catch (error) {
    if (!(error instanceof SqlSyntaxError)) throw error;
    const continuation = dialect === "PostgreSQL" && sourceTokens.some((token, index) => index > 0 && token.kind === "string" && sourceTokens[index - 1].kind === "string" && /[\r\n]/.test(sql.slice(sourceTokens[index - 1].end, token.start)));
    const specialComments = lexSql(sql, dialect).some((token) => token.kind === "protected" || token.kind === "comment" && token.text.slice(2).includes("/*"));
    if (dialect === "SQL Server" && sourceTokens[0]?.text.toUpperCase() === "CREATE" && sourceTokens.some((token) => token.kind === "word" && token.text.toUpperCase() === "REFERENCES")) {
      const { parseDdl: parseDdl2 } = await Promise.resolve().then(() => (init_ddl(), ddl_exports));
      await parseDdl2(sql, dialect);
    } else if (continuation || specialComments) warning = "Layout preserves this dialect extension, but the local parser could not validate its complete syntax. This result is not syntax-validation proof.";
    else throw error;
  }
  const { format } = await import("sql-formatter");
  let output2;
  try {
    output2 = format(sql, { language: formatterLanguages[dialect], tabWidth: 2 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const position = /\bline (\d+) column (\d+)\b/i.exec(message);
    throw new SqlSyntaxError("The selected dialect formatter cannot process this syntax. Check syntax or unsupported dialect extensions.", position ? { line: Number(position[1]), column: Number(position[2]) } : void 0);
  }
  const targetTokens = significantTokens(lexSql(output2, dialect));
  if (sourceTokens.length !== targetTokens.length || sourceTokens.some((token, i) => token.kind !== targetTokens[i].kind || token.text !== targetTokens[i].text)) {
    throw new SqlSyntaxError("Formatting would change SQL tokens; this dialect syntax is unsupported by the formatter.");
  }
  const fixes = [];
  if (dialect === "PostgreSQL") for (let i = 1; i < sourceTokens.length; i++) {
    const before = sourceTokens[i - 1], current = sourceTokens[i];
    if (before.kind === "string" && current.kind === "string") {
      const sourceGap = sql.slice(before.end, current.start);
      const targetGap = output2.slice(targetTokens[i - 1].end, targetTokens[i].start);
      if (/[\r\n]/.test(sourceGap) !== /[\r\n]/.test(targetGap)) {
        fixes.push({ start: targetTokens[i - 1].end, end: targetTokens[i].start, value: sourceGap });
      }
    }
  }
  for (const fix of fixes.reverse()) output2 = output2.slice(0, fix.start) + fix.value + output2.slice(fix.end);
  return { rows: [{ label: "Formatted SQL", value: output2 }], ...warning ? { warnings: [warning] } : {} };
}
function canonicalNumber(text3) {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text3);
  let digits = (match[2] + (match[3] ?? "")).replace(/^0+/, "");
  if (!digits) return "0";
  let exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  while (digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    exponent++;
  }
  return `${match[1] === "-" ? "-" : ""}${digits}e${exponent}`;
}
function exactNumber(text3, token) {
  const value = Number(text3);
  if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value) || canonicalNumber(text3) !== canonicalNumber(String(value))) {
    throw new SqlSyntaxError("A SQL number cannot be represented safely as a JavaScript/JSON number; conversion would lose precision.", token);
  }
  return value;
}
function decodeString(token, dialect) {
  let text3 = token.text;
  if (text3[0] === "$") {
    const tag = dollarDelimiter(text3);
    return text3.slice(tag.length, -tag.length);
  }
  const prefix = /^[eEnN]'/.test(text3) ? text3[0].toUpperCase() : "";
  if (prefix) text3 = text3.slice(1);
  const quote = text3[0];
  text3 = text3.slice(1, -1).split(quote + quote).join(quote);
  if (dialect !== "MySQL" && !(dialect === "PostgreSQL" && prefix === "E")) return text3;
  let output2 = "";
  for (let i = 0; i < text3.length; i++) {
    if (text3[i] !== "\\") {
      output2 += text3[i];
      continue;
    }
    const next = text3[++i];
    if (next === void 0) throw new SqlSyntaxError("Incomplete SQL string escape.", token);
    const common = { "0": "\0", b: "\b", f: "\f", n: "\n", r: "\r", t: "	", v: "\v", "\\": "\\", "'": "'", '"': '"' };
    if (dialect === "MySQL") {
      const mysql = { "0": "\0", b: "\b", n: "\n", r: "\r", t: "	", Z: "", "\\": "\\", "'": "'", '"': '"', "%": "\\%", "_": "\\_" };
      output2 += mysql[next] ?? next;
      continue;
    }
    if (/[0-7]/.test(next)) {
      const digits = /^[0-7]{1,3}/.exec(text3.slice(i))[0], value = parseInt(digits, 8);
      if (value > 127) throw new SqlSyntaxError("Non-ASCII PostgreSQL byte escapes need a database encoding and are unsupported.", token);
      if (value === 0) throw new SqlSyntaxError("PostgreSQL string literals cannot contain a zero byte.", token);
      output2 += String.fromCharCode(value);
      i += digits.length - 1;
    } else if (next === "x") {
      const digits = /^[0-9a-fA-F]{1,2}/.exec(text3.slice(i + 1))?.[0];
      if (!digits) throw new SqlSyntaxError("Invalid PostgreSQL hexadecimal string escape.", token);
      const value = parseInt(digits, 16);
      if (value > 127) throw new SqlSyntaxError("Non-ASCII PostgreSQL byte escapes need a database encoding and are unsupported.", token);
      if (value === 0) throw new SqlSyntaxError("PostgreSQL string literals cannot contain a zero byte.", token);
      output2 += String.fromCharCode(value);
      i += digits.length;
    } else if (next === "u" || next === "U") {
      const length = next === "u" ? 4 : 8, digits = text3.slice(i + 1, i + 1 + length);
      if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(digits)) throw new SqlSyntaxError("Invalid PostgreSQL Unicode string escape.", token);
      const value = parseInt(digits, 16);
      if (value === 0 || value > 1114111 || value >= 55296 && value <= 57343) throw new SqlSyntaxError("Unsupported Unicode code point in PostgreSQL escape.", token);
      output2 += String.fromCodePoint(value);
      i += length;
    } else output2 += common[next] ?? next;
  }
  return output2;
}
function readCell(cursor, dialect, sql) {
  let token = cursor.take();
  if (token.kind === "string") {
    let value = decodeString(token, dialect);
    while (cursor.peek()?.kind === "string") {
      const next = cursor.peek();
      if (dialect !== "PostgreSQL" || !/[\r\n]/.test(sql.slice(token.end, next.start)) || next.text[0] !== "'") cursor.fail("Adjacent string literals are unsupported except PostgreSQL newline continuation.");
      cursor.take();
      value += decodeString(next, dialect);
      token = next;
    }
    return value;
  }
  let sign = "";
  if (token.text === "+" || token.text === "-") {
    sign = token.text;
    token = cursor.take();
  }
  if (token.kind === "number") return exactNumber(sign + token.text, token);
  if (sign) cursor.fail("Unary signs require a numeric literal.");
  if (token.text.toUpperCase() === "NULL") return null;
  if (token.text.toUpperCase() === "TRUE" || token.text.toUpperCase() === "FALSE") {
    if (dialect === "SQL Server") cursor.fail("SQL Server Boolean values must be numeric 1/0 literals.");
    return token.text.toUpperCase() === "TRUE";
  }
  cursor.fail("INSERT conversion supports literal VALUES only; expressions, functions, casts, DEFAULT and SELECT are unsupported.");
}
function nameKey(name2, dialect) {
  return dialect === "PostgreSQL" ? name2 : name2.toLowerCase();
}
function readName(cursor, dialect) {
  const token = cursor.take(), name2 = identifierValue(token);
  if (name2.length > 128) cursor.fail("INSERT identifiers are limited to 128 characters.");
  return dialect === "PostgreSQL" && token.kind === "word" ? name2.toLowerCase() : name2;
}
function readQualifiedName(cursor, dialect) {
  const parts = [readName(cursor, dialect)];
  while (cursor.accept(".")) parts.push(readName(cursor, dialect));
  const maximumParts = dialect === "SQL Server" ? 4 : dialect === "PostgreSQL" ? 3 : 2;
  if (parts.length > maximumParts) cursor.fail("The table identifier has unsupported qualification for the selected dialect.");
  if (parts.some((part) => part.includes("."))) cursor.fail("Quoted table identifiers containing dots are unsupported; use explicit qualification parts.");
  return parts.join(".");
}
async function parseInsertData(sql, dialect) {
  dialect = readDialect(dialect);
  const cursor = new TokenCursor(significantTokens(lexSql(sql, dialect)));
  let columns2, table, statements = 0;
  const rows = [];
  while (cursor.peek()) {
    if (++statements > 200) cursor.fail("SQL exceeds the 200-statement limit.");
    cursor.expect("INSERT");
    cursor.expect("INTO");
    const currentTable = readQualifiedName(cursor, dialect);
    cursor.expect("(");
    const currentColumns = [];
    do {
      currentColumns.push(readName(cursor, dialect));
    } while (cursor.accept(","));
    cursor.expect(")");
    if (currentColumns.length > 500) cursor.fail("INSERT conversion is limited to 500 columns.");
    if (new Set(currentColumns.map((name2) => nameKey(name2, dialect))).size !== currentColumns.length) cursor.fail("Duplicate INSERT column names are unsupported.");
    if (columns2 && (currentTable !== table || currentColumns.length !== columns2.length || currentColumns.some((name2, i) => name2 !== columns2[i]))) cursor.fail("All INSERT statements must use the same exact table identifier and identical ordered column names.");
    columns2 ??= currentColumns;
    table ??= currentTable;
    cursor.expect("VALUES");
    do {
      cursor.expect("(");
      const row = [];
      do {
        row.push(readCell(cursor, dialect, sql));
      } while (cursor.accept(","));
      cursor.expect(")");
      if (row.length !== columns2.length) cursor.fail("INSERT row arity does not match the named columns.");
      rows.push(row);
      if (rows.length > 1e4) cursor.fail("INSERT conversion is limited to 10,000 rows.");
    } while (cursor.accept(","));
    if (cursor.peek() && !cursor.accept(";")) cursor.fail("INSERT modifiers, conflict/duplicate clauses, RETURNING, and additional expressions are unsupported.");
  }
  if (!columns2 || !rows.length) throw new SqlSyntaxError("Enter INSERT statements with named columns and literal VALUES.");
  return { columns: columns2, rows };
}
async function insertOutput(toolId, sql, dialect) {
  const { columns: columns2, rows } = await parseInsertData(sql, dialect);
  const keySize = columns2.reduce((total, column) => total + JSON.stringify(column).length + 10, 0);
  let projectedSize = columns2.join(",").length + 100;
  for (const row of rows) {
    projectedSize += keySize + row.reduce((total, value) => total + JSON.stringify(value).length + 6, 0);
    if (projectedSize > 2e6) throw new SqlSyntaxError("INSERT conversion exceeds the 2,000,000-character output budget.");
  }
  if (toolId === "sql-to-json") return { rows: [{ label: "JSON array of objects", value: JSON.stringify(rows.map((row) => Object.fromEntries(columns2.map((column, i) => [column, row[i]]))), null, 2) }] };
  if (toolId === "sql-to-csv") {
    const csv = (value) => value === null ? "" : typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : String(value);
    return { rows: [{ label: "CSV text", value: [columns2.map(csv).join(","), ...rows.map((row) => row.map(csv).join(","))].join("\r\n") }], warnings: ["CSV has no intrinsic null type: SQL NULL is an unquoted empty cell; empty strings are quoted empty cells. A CSV reader may discard this distinction."] };
  }
  if (toolId === "sql-to-markdown") {
    const markdown = (value) => value === null ? "NULL" : String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, "<br>");
    const line = (values) => `| ${values.map(markdown).join(" | ")} |`;
    return { rows: [{ label: "Markdown table", value: [line(columns2), line(columns2.map(() => "---")), ...rows.map(line)].join("\n") }] };
  }
  throw new SqlSyntaxError("Unsupported SQL INSERT conversion tool.");
}
var formatterLanguages, parserWarning;
var init_transforms = __esm({
  "lib/tools/sql/transforms.ts"() {
    "use strict";
    init_lexer();
    init_parser();
    init_literals();
    formatterLanguages = { PostgreSQL: "postgresql", MySQL: "mysql", SQLite: "sqlite", "SQL Server": "transactsql" };
    parserWarning = "Acceptance is limited to the selected dialect's local parser subset; this does not check database objects, permissions, or execution semantics.";
  }
});

// mcp/cli.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// mcp/config.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
var PRICING = {
  inr: "\u20B9199 / month",
  usd: "$2.99 / month",
  lifetimeInr: "\u20B9999 one-time",
  lifetimeUsd: "$19.00 one-time",
  upgradeUrl: "https://codestation.in/pro"
};
var PRO_TOOLS = /* @__PURE__ */ new Set([
  "codestation_hash",
  "codestation_hmac",
  "codestation_jwt_decode",
  "codestation_format_sql",
  "codestation_cron_explain",
  "codestation_timezone_convert",
  "codestation_business_days",
  "codestation_regex_test",
  "codestation_json_schema"
]);
var CACHE_DIR = path.join(os.homedir(), ".codestation");
var CACHE_FILE = path.join(CACHE_DIR, "license.json");
function readCachedLicense() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (Date.now() - data.verifiedAt < 30 * 24 * 60 * 60 * 1e3) {
        return data;
      }
    }
  } catch {
  }
  return null;
}
function saveCachedLicense(key2, isPro) {
  try {
    if (process.env.NODE_ENV === "test") return;
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cache = {
      key: key2,
      verifiedAt: Date.now(),
      isPro
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
  }
}
function validateLicenseKey(rawKey) {
  if (!rawKey) return false;
  const key2 = rawKey.trim();
  if (!key2) return false;
  if (/^CS-PRO-[A-Za-z0-9_-]+$/i.test(key2) || key2.startsWith("cspro_")) {
    return true;
  }
  if (key2 === "PRO_DEMO_KEY" || key2 === "CS-PRO-DEV") {
    return true;
  }
  return false;
}
function resolveLicense(cliKey) {
  if (cliKey) {
    const valid = validateLicenseKey(cliKey);
    if (valid) {
      saveCachedLicense(cliKey, true);
      return { isPro: true, licenseKey: cliKey, source: "cli", tier: "pro" };
    }
  }
  const envKey = process.env.CODESTATION_LICENSE_KEY;
  if (envKey) {
    const valid = validateLicenseKey(envKey);
    if (valid) {
      saveCachedLicense(envKey, true);
      return { isPro: true, licenseKey: envKey, source: "env", tier: "pro" };
    }
  }
  const cached = readCachedLicense();
  if (cached && cached.isPro) {
    return { isPro: true, licenseKey: cached.key, source: "cache", tier: "pro" };
  }
  return { isPro: false, source: "none", tier: "free" };
}
function getProUpgradeNotice(toolName) {
  return [
    `\u{1F512} Tool "${toolName}" is a Code Station Pro feature.`,
    ``,
    `Get Code Station Pro:`,
    `  \u2022 India: ${PRICING.inr} (or ${PRICING.lifetimeInr})`,
    `  \u2022 Global: ${PRICING.usd} (or ${PRICING.lifetimeUsd})`,
    `  \u2022 Upgrade URL: ${PRICING.upgradeUrl}`,
    ``,
    `To activate, launch with:`,
    `  npx codestation-mcp --key CS-PRO-YOURKEY`,
    `or set environment variable:`,
    `  export CODESTATION_LICENSE_KEY=CS-PRO-YOURKEY`
  ].join("\n");
}

// lib/tools/index.ts
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// lib/tools/encoding-station.ts
function utf8(value) {
  return new TextEncoder().encode(value);
}
function text(bytes2) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes2);
}
function encodeBase64Url(value) {
  const bytes2 = utf8(value);
  let binary = "";
  for (const byte of bytes2) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("Invalid Base64URL input.");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(padded);
    return text(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    throw new Error("Base64URL input is not valid Base64 or UTF-8 text.");
  }
}
var encodeUrlComponent = encodeURIComponent;
function decodeUrlComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("URL component contains invalid percent escapes.");
  }
}
function encodeHexadecimal(value) {
  return Array.from(utf8(value), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}
function decodeHexadecimal(value) {
  const clean = value.replace(/[\s:-]/g, "");
  if (!/^(?:[\da-f]{2})+$/i.test(clean)) throw new Error("Use hexadecimal byte pairs such as 48 65 6c 6c 6f.");
  try {
    return text(Uint8Array.from(clean.match(/../g), (byte) => parseInt(byte, 16)));
  } catch {
    throw new Error("Hexadecimal input is not valid UTF-8 text.");
  }
}

// lib/tools/index.ts
function formatJson(value, indent = 2) {
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) {
    throw new RangeError("indent must be an integer between 0 and 10");
  }
  return JSON.stringify(JSON.parse(value), null, indent);
}
function minifyJson(value) {
  return JSON.stringify(JSON.parse(value));
}
function jsonToYaml(value) {
  return stringifyYaml(JSON.parse(value));
}
function yamlToJson(value) {
  return JSON.stringify(parseYaml(value), null, 2);
}
function generateJsonSchema(value) {
  const sample = JSON.parse(value);
  const infer = (node) => {
    if (node === null) return { type: "null" };
    if (Array.isArray(node)) return { type: "array", items: node.length ? infer(node[0]) : {} };
    if (typeof node === "object") {
      const properties = Object.fromEntries(Object.entries(node).map(([key2, child]) => [key2, infer(child)]));
      return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
    }
    return { type: typeof node === "number" && Number.isInteger(node) ? "integer" : typeof node };
  };
  return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...infer(sample) }, null, 2);
}
function decodeBase64Url2(value) {
  return decodeBase64(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
}
function decodeJwt(value) {
  const parts = value.trim().split(".");
  if (parts.length !== 3) throw new Error("A JWT must contain three dot-separated sections.");
  try {
    return JSON.stringify({ header: JSON.parse(decodeBase64Url2(parts[0])), payload: JSON.parse(decodeBase64Url2(parts[1])), signature: parts[2], note: "Decoded for inspection only. Signature validity was not verified." }, null, 2);
  } catch {
    throw new Error("JWT header and payload must contain valid Base64URL-encoded JSON.");
  }
}
function testRegex(pattern, flags, text3) {
  let regex;
  try {
    regex = new RegExp(pattern, flags);
  } catch (cause) {
    throw new Error(cause instanceof Error ? cause.message : "Invalid regular expression.");
  }
  const matches = [];
  if (!regex.global) {
    const match = regex.exec(text3);
    if (match) matches.push({ match: match[0], index: match.index, groups: match.groups ?? {}, captures: match.slice(1) });
  } else {
    let match;
    while ((match = regex.exec(text3)) !== null) {
      matches.push({ match: match[0], index: match.index, groups: match.groups ?? {}, captures: match.slice(1) });
      if (match[0] === "") regex.lastIndex += 1;
    }
  }
  return JSON.stringify({ count: matches.length, matches }, null, 2);
}
function utf8Decode(bytes2) {
  let result2 = "";
  for (let i = 0; i < bytes2.length; ) {
    const first = bytes2[i++];
    let code;
    if (first < 128) code = first;
    else if (first >= 194 && first <= 223 && i < bytes2.length) code = (first & 31) << 6 | bytes2[i++] & 63;
    else if (first >= 224 && first <= 239 && i + 1 < bytes2.length) code = (first & 15) << 12 | (bytes2[i++] & 63) << 6 | bytes2[i++] & 63;
    else if (first >= 240 && first <= 244 && i + 2 < bytes2.length) code = (first & 7) << 18 | (bytes2[i++] & 63) << 12 | (bytes2[i++] & 63) << 6 | bytes2[i++] & 63;
    else throw new Error("Invalid UTF-8 data");
    if (code <= 65535) result2 += String.fromCharCode(code);
    else {
      const n = code - 65536;
      result2 += String.fromCharCode(55296 | n >> 10, 56320 | n & 1023);
    }
  }
  return result2;
}
var BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeBase64(value) {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Invalid Base64 string");
  const bytes2 = [];
  for (let i = 0; i < value.length; i += 4) {
    const a = BASE64.indexOf(value[i]);
    const b = BASE64.indexOf(value[i + 1]);
    const c = value[i + 2] === "=" ? 0 : BASE64.indexOf(value[i + 2]);
    const d = value[i + 3] === "=" ? 0 : BASE64.indexOf(value[i + 3]);
    bytes2.push(a << 2 | b >> 4);
    if (value[i + 2] !== "=") bytes2.push((b & 15) << 4 | c >> 2);
    if (value[i + 3] !== "=") bytes2.push((c & 3) << 6 | d);
  }
  return utf8Decode(bytes2);
}

// lib/tools/security-station.ts
var encoder = () => new TextEncoder();
function bytes(input) {
  return typeof input === "string" ? encoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
}
function webBytes(input) {
  return bytes(input).slice().buffer;
}
function hex(input) {
  return Array.from(input, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function requireCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable in this environment.");
  return globalThis.crypto;
}
function words(input) {
  const length = input.length + 9 + 63 >> 6 << 4;
  const out = new Array(length).fill(0);
  input.forEach((byte, index) => {
    out[index >> 2] |= byte << (index & 3) * 8;
  });
  out[input.length >> 2] |= 128 << (input.length & 3) * 8;
  const bitLength = input.length * 8;
  out[length - 2] = bitLength & 4294967295;
  out[length - 1] = Math.floor(bitLength / 4294967296);
  return out;
}
function rotl(value, count) {
  return value << count | value >>> 32 - count;
}
function littleHex(value) {
  return [0, 8, 16, 24].map((shift) => (value >>> shift & 255).toString(16).padStart(2, "0")).join("");
}
function md5(input) {
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  let a = 1732584193, b = 4023233417, c = 2562383102, d = 271733878;
  const m = words(bytes(input));
  for (let offset = 0; offset < m.length; offset += 16) {
    let aa = a, bb = b, cc = c, dd = d;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) {
        f = bb & cc | ~bb & dd;
        g = i;
      } else if (i < 32) {
        f = dd & bb | ~dd & cc;
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = bb ^ cc ^ dd;
        g = (3 * i + 5) % 16;
      } else {
        f = cc ^ (bb | ~dd);
        g = 7 * i % 16;
      }
      const next = dd;
      dd = cc;
      cc = bb;
      bb = bb + rotl(aa + f + k[i] + m[offset + g] | 0, s[i]) | 0;
      aa = next;
    }
    a = a + aa | 0;
    b = b + bb | 0;
    c = c + cc | 0;
    d = d + dd | 0;
  }
  return littleHex(a) + littleHex(b) + littleHex(c) + littleHex(d);
}
function sha1(input) {
  const source = bytes(input);
  const padded = new Uint8Array(source.length + 9 + 63 >> 6 << 6);
  padded.set(source);
  padded[source.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, source.length * 8);
  let h0 = 1732584193, h1 = 4023233417, h2 = 2562383102, h3 = 271733878, h4 = 3285377520;
  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Uint32Array(80);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1) >>> 0;
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? b & c | ~b & d : i < 40 ? b ^ c ^ d : i < 60 ? b & c | b & d | c & d : b ^ c ^ d;
      const t = rotl(a, 5) + f + e + w[i] + (i < 20 ? 1518500249 : i < 40 ? 1859775393 : i < 60 ? 2400959708 : 3395469782) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    h0 = h0 + a | 0;
    h1 = h1 + b | 0;
    h2 = h2 + c | 0;
    h3 = h3 + d | 0;
    h4 = h4 + e | 0;
  }
  return [h0, h1, h2, h3, h4].map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}
async function hash(input, algorithm = "SHA-256") {
  const result2 = await requireCrypto().subtle.digest(algorithm, webBytes(input));
  return hex(new Uint8Array(result2));
}
var sha256 = (input) => hash(input, "SHA-256");
var sha384 = (input) => hash(input, "SHA-384");
var sha512 = (input) => hash(input, "SHA-512");
async function hmac(input, secret, algorithm = "SHA-256") {
  const crypto2 = requireCrypto();
  const key2 = await crypto2.subtle.importKey("raw", webBytes(secret), { name: "HMAC", hash: algorithm }, false, ["sign"]);
  return hex(new Uint8Array(await crypto2.subtle.sign("HMAC", key2, webBytes(input))));
}
var hmacSha256 = (input, secret) => hmac(input, secret, "SHA-256");
var hmacSha512 = (input, secret) => hmac(input, secret, "SHA-512");
function crc32(input) {
  let crc = 4294967295;
  for (const byte of bytes(input)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
  }
  return ((crc ^ 4294967295) >>> 0).toString(16).padStart(8, "0");
}

// lib/tools/text-station.ts
var MAX_TEXT_LENGTH = 1e6;
var MAX_DIFF_LINES = 2e3;
var MAX_DIFF_CELLS = 4e6;
var LOREM_WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  " consequat",
  "duis",
  "aute",
  "irure",
  "in",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
  "excepteur",
  "sint",
  "occaecat",
  "cupidatat",
  "non",
  "proident",
  "sunt",
  "culpa",
  "qui",
  "officia",
  "deserunt",
  "mollit",
  "anim",
  "id",
  "est",
  "laborum"
].map((word) => word.trim());
function assertText(value, name2 = "text") {
  if (typeof value !== "string") throw new TypeError(`${name2} must be a string.`);
  if (value.length > MAX_TEXT_LENGTH) throw new RangeError(`${name2} must be at most ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
  return value;
}
function parseLines(value) {
  assertText(value);
  const firstCrLf = value.indexOf("\r\n");
  const firstLf = value.indexOf("\n");
  const firstCr = value.indexOf("\r");
  let ending = "\n";
  if (firstCrLf >= 0 && (firstLf < 0 || firstCrLf <= firstLf)) ending = "\r\n";
  else if (firstCr >= 0 && (firstLf < 0 || firstCr < firstLf)) ending = "\r";
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return { lines: [], ending, trailingBreak: false };
  const trailingBreak = normalized.endsWith("\n");
  const body = trailingBreak ? normalized.slice(0, -1) : normalized;
  return { lines: body ? body.split("\n") : [""], ending, trailingBreak };
}
function firstCharacterUpper(value, locale) {
  const characters = Array.from(value);
  if (!characters.length) return value;
  return characters[0].toLocaleUpperCase(locale) + characters.slice(1).join("");
}
function wordsOf(value) {
  return value.replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2").match(/[\p{L}\p{N}]+/gu) ?? [];
}
function convertCase(value, style, options = {}) {
  assertText(value);
  const locale = options.locale;
  if (style === "upper") return value.toLocaleUpperCase(locale);
  if (style === "lower") return value.toLocaleLowerCase(locale);
  if (style === "title") {
    return value.toLocaleLowerCase(locale).replace(/(^|[\s\-_\/.])([\p{L}\p{N}])/gu, (_, separator, character) => `${separator}${character.toLocaleUpperCase(locale)}`);
  }
  if (style === "sentence") {
    const lower = value.toLocaleLowerCase(locale);
    return lower.replace(/(^|[.!?…。！？]\s+)(\s*)([\p{L}\p{N}])/gu, (_, boundary, whitespace, character) => `${boundary}${whitespace}${character.toLocaleUpperCase(locale)}`);
  }
  const words2 = wordsOf(value).map((word) => word.toLocaleLowerCase(locale));
  if (style === "camel") return words2.map((word, index) => index === 0 ? word : firstCharacterUpper(word, locale)).join("");
  if (style === "pascal") return words2.map((word) => firstCharacterUpper(word, locale)).join("");
  if (style === "snake") return words2.join("_");
  if (style === "kebab") return words2.join("-");
  if (style === "constant") return words2.map((word) => word.toLocaleUpperCase(locale)).join("_");
  throw new Error(`Unsupported case style: ${String(style)}.`);
}
function escapeRegex(value) {
  return value.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}
function diffOperations(left, right) {
  if (left.length > MAX_DIFF_LINES || right.length > MAX_DIFF_LINES) throw new RangeError(`Text diff supports at most ${MAX_DIFF_LINES.toLocaleString()} lines per side.`);
  if (left.length * right.length > MAX_DIFF_CELLS) throw new RangeError("Text diff inputs are too large to compare safely; reduce the number of lines.");
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i2 = left.length - 1; i2 >= 0; i2 -= 1) {
    for (let j2 = right.length - 1; j2 >= 0; j2 -= 1) table[i2][j2] = left[i2] === right[j2] ? table[i2 + 1][j2 + 1] + 1 : Math.max(table[i2 + 1][j2], table[i2][j2 + 1]);
  }
  const operations = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      operations.push({ type: "equal", text: left[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      operations.push({ type: "deletion", text: left[i] });
      i += 1;
    } else {
      operations.push({ type: "addition", text: right[j] });
      j += 1;
    }
  }
  while (i < left.length) operations.push({ type: "deletion", text: left[i++] });
  while (j < right.length) operations.push({ type: "addition", text: right[j++] });
  return operations;
}
function buildUnified(operations) {
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;
  const lines = operations.map((operation) => {
    if (operation.type === "equal") return { type: "context", text: operation.text, oldLine: oldLine++, newLine: newLine++ };
    if (operation.type === "deletion") {
      removed += 1;
      return { type: "deletion", text: operation.text, oldLine: oldLine++, newLine: null };
    }
    added += 1;
    return { type: "addition", text: operation.text, oldLine: null, newLine: newLine++ };
  });
  const text3 = ["--- left", "+++ right", ...lines.map((line) => `${line.type === "context" ? " " : line.type === "deletion" ? "-" : "+"}${line.text}`)].join("\n");
  return { lines, text: text3, added, removed };
}
function buildSideBySide(operations) {
  const rows = [];
  let leftLine = 1;
  let rightLine = 1;
  for (let i = 0; i < operations.length; i += 1) {
    const operation = operations[i];
    if (operation.type === "equal") {
      rows.push({ type: "equal", left: { line: leftLine++, text: operation.text }, right: { line: rightLine++, text: operation.text } });
      continue;
    }
    const deleted = [];
    const added = [];
    while (i < operations.length && operations[i].type !== "equal") {
      if (operations[i].type === "deletion") deleted.push(operations[i].text);
      else added.push(operations[i].text);
      i += 1;
    }
    i -= 1;
    const width = Math.max(deleted.length, added.length);
    for (let offset = 0; offset < width; offset += 1) {
      const left = deleted[offset];
      const right = added[offset];
      rows.push({
        type: left !== void 0 && right !== void 0 ? "changed" : left !== void 0 ? "removed" : "added",
        left: left === void 0 ? null : { line: leftLine++, text: left },
        right: right === void 0 ? null : { line: rightLine++, text: right }
      });
    }
  }
  return rows;
}
function textDiff(left, right) {
  const leftParsed = parseLines(left);
  const rightParsed = parseLines(right);
  const operations = diffOperations(leftParsed.lines, rightParsed.lines);
  const unified = buildUnified(operations);
  const sideBySide = buildSideBySide(operations);
  return {
    changed: unified.added > 0 || unified.removed > 0,
    added: unified.added,
    removed: unified.removed,
    unified: unified.text,
    unifiedLines: unified.lines,
    sideBySide,
    unifiedData: unified.lines,
    sideBySideData: sideBySide
  };
}
function diffText(left, right) {
  return textDiff(left, right).unified;
}
function slugify(value, separator = "-") {
  assertText(value);
  assertText(separator, "separator");
  if (!separator || separator.length > 16 || /[\p{L}\p{N}]/u.test(separator)) throw new Error("Slug separator must be 1\u201316 non-alphanumeric characters.");
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, separator).replace(new RegExp(`(?:${escapeRegex(separator)})+`, "g"), separator).replace(new RegExp(`^${escapeRegex(separator)}|${escapeRegex(separator)}$`, "g"), "");
}

// lib/tools/date-time-station.ts
var SECOND = 1e3;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var MIN_DATE = -621355968e5;
var MAX_DATE = 253402300799999;
function integer(value, name2, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name2} must be an integer between ${min} and ${max}.`);
  return value;
}
function inputText(value, name2 = "Date", max = 256) {
  if (typeof value !== "string") throw new TypeError(`${name2} must be text.`);
  const text3 = value.trim();
  if (!text3) throw new Error(`${name2} cannot be empty.`);
  if (text3.length > max) throw new RangeError(`${name2} must be at most ${max} characters.`);
  return text3;
}
function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysInMonth(year, month) {
  return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function validateParts(parts) {
  integer(parts.year, "Year", 1, 9999);
  integer(parts.month, "Month", 1, 12);
  integer(parts.day, "Day", 1, daysInMonth(parts.year, parts.month));
  integer(parts.hour, "Hour", 0, 23);
  integer(parts.minute, "Minute", 0, 59);
  integer(parts.second, "Second", 0, 59);
  integer(parts.millisecond, "Millisecond", 0, 999);
}
function utcMilliseconds(parts) {
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0, parts.millisecond ?? 0);
  return date.getTime();
}
function checkedDate(milliseconds) {
  if (!Number.isFinite(milliseconds)) throw new RangeError("Date or timestamp must be finite and valid.");
  if (milliseconds < MIN_DATE || milliseconds > MAX_DATE) throw new RangeError("Date must be within Gregorian years 0001\u20139999 in UTC.");
  return new Date(milliseconds);
}
function timestampUnit(unit) {
  if (unit !== "seconds" && unit !== "milliseconds") throw new Error("Timestamp unit must be seconds or milliseconds.");
  return unit;
}
function timestampToDate(value, unit = "seconds") {
  timestampUnit(unit);
  let number;
  if (typeof value === "string") {
    const text3 = inputText(value, "Timestamp");
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(text3)) throw new Error("Timestamp must be a decimal number, without exponent notation.");
    number = Number(text3);
  } else if (typeof value === "number") number = value;
  else throw new TypeError("Timestamp must be a number or numeric text.");
  if (!Number.isFinite(number)) throw new RangeError("Timestamp must be finite.");
  if (unit === "milliseconds" && !Number.isInteger(number)) throw new RangeError("A millisecond timestamp must be an integer.");
  return checkedDate(unit === "seconds" ? Math.round(number * SECOND) : number);
}
function zoneFormatter(timeZone) {
  const zone = inputText(timeZone, "Time zone", 128);
  if (/^[+-]/.test(zone)) throw new Error("Use an IANA time zone such as America/New_York, Asia/Kolkata, or UTC.");
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      calendar: "gregory",
      numberingSystem: "latn",
      era: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
  } catch {
    throw new Error(`Unknown or unsupported IANA time zone: ${zone}.`);
  }
}
function validateTimeZone(timeZone) {
  return zoneFormatter(timeZone).resolvedOptions().timeZone;
}
function zoneParts(milliseconds, formatter) {
  const fields = Object.fromEntries(formatter.formatToParts(new Date(milliseconds)).map((part) => [part.type, part.value]));
  return {
    year: fields.era === "BC" ? 1 - Number(fields.year) : Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
    millisecond: (milliseconds % SECOND + SECOND) % SECOND
  };
}
function disambiguation(value = "reject") {
  if (!["reject", "earlier", "later"].includes(value)) throw new Error("Time disambiguation must be reject, earlier, or later.");
  return value;
}
function sameParts(left, right) {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute && left.second === right.second && left.millisecond === right.millisecond;
}
function localToDate(parts, formatter, choice) {
  const wall = utcMilliseconds(parts);
  const offsets = /* @__PURE__ */ new Set();
  for (let hours = -48; hours <= 48; hours += 12) {
    const sample = wall + hours * HOUR;
    offsets.add(utcMilliseconds(zoneParts(sample, formatter)) - sample);
  }
  const matches = [...offsets].map((offset) => wall - offset).filter((candidate) => sameParts(zoneParts(candidate, formatter), parts)).sort((a, b) => a - b);
  const zone = formatter.resolvedOptions().timeZone;
  if (!matches.length) throw new Error(`This local time does not exist in ${zone} because of a time-zone clock change. Choose another time or an explicit UTC offset.`);
  if (matches.length > 1 && choice === "reject") throw new Error(`This local time occurs twice in ${zone}. Choose earlier or later, or supply an explicit UTC offset.`);
  return checkedDate(choice === "later" ? matches[matches.length - 1] : matches[0]);
}
function offsetMilliseconds(value) {
  if (/^z$/i.test(value)) return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(value);
  if (!match) throw new Error("UTC offset must be Z or \xB1HH:mm.");
  const hours = integer(Number(match[2]), "Offset hour", 0, 23);
  const minutes = integer(Number(match[3]), "Offset minute", 0, 59);
  if (match[1] === "-" && hours === 0 && minutes === 0) throw new Error("The unknown UTC offset -00:00 cannot identify an instant. Use Z or a known offset.");
  return (match[1] === "-" ? -1 : 1) * (hours * HOUR + minutes * MINUTE);
}
function partsToDate(parts, offset, options) {
  validateParts(parts);
  const choice = disambiguation(options.disambiguation);
  const formatter = zoneFormatter(options.timeZone ?? "UTC");
  return offset ? checkedDate(utcMilliseconds(parts) - offsetMilliseconds(offset)) : localToDate(parts, formatter, choice);
}
function parseDateTime(value, options = {}) {
  timestampUnit(options.timestampUnit ?? "milliseconds");
  disambiguation(options.disambiguation);
  if (options.timeZone !== void 0) validateTimeZone(options.timeZone);
  if (value instanceof Date) return checkedDate(value.getTime());
  if (typeof value === "number") return timestampToDate(value, options.timestampUnit ?? "milliseconds");
  const text3 = inputText(value);
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text3)) return timestampToDate(text3, options.timestampUnit ?? "milliseconds");
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/.exec(text3);
  if (!match) throw new Error("Use YYYY-MM-DD, an ISO date/time with up to 3 fractional digits, or an explicit numeric timestamp.");
  return partsToDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "").padEnd(3, "0"))
  }, match[8], options);
}
function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}
function calendarText(parts) {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}
function clockText(parts) {
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(parts.millisecond, 3)}`;
}
function offsetText(milliseconds) {
  if (!milliseconds) return "Z";
  const seconds = Math.abs(milliseconds) / SECOND;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return `${milliseconds < 0 ? "-" : "+"}${pad(hours)}:${pad(minutes)}${remainder ? `:${pad(remainder)}` : ""}`;
}
function getZonedDateTime(value, timeZone = "UTC", options = {}) {
  const date = parseDateTime(value, options);
  const formatter = zoneFormatter(timeZone);
  const parts = zoneParts(date.getTime(), formatter);
  validateParts(parts);
  const offset = utcMilliseconds(parts) - date.getTime();
  const renderedOffset = offsetText(offset);
  return {
    ...parts,
    timeZone: formatter.resolvedOptions().timeZone,
    offsetMinutes: offset / MINUTE,
    offset: renderedOffset,
    unixMilliseconds: date.getTime(),
    iso: date.toISOString(),
    dateTime: `${calendarText(parts)}T${clockText(parts)}${renderedOffset}`
  };
}
function formatRfc3339(value, timeZoneOrOptions = "UTC", options = {}) {
  const timeZone = typeof timeZoneOrOptions === "string" ? timeZoneOrOptions : timeZoneOrOptions.timeZone ?? "UTC";
  const parseOptions = typeof timeZoneOrOptions === "string" ? options : timeZoneOrOptions;
  const zoned = getZonedDateTime(value, timeZone, parseOptions);
  if (!Number.isInteger(zoned.offsetMinutes)) throw new Error("RFC3339 cannot represent this historical sub-minute UTC offset. Format in UTC instead.");
  return zoned.dateTime;
}
function convertTimeZone(value, targetTimeZone, options = {}) {
  const parseOptions = typeof options === "string" ? { timeZone: options } : options;
  return formatRfc3339(value, targetTimeZone, parseOptions);
}
function convertBetweenTimeZones(value, sourceTimeZone, targetTimeZone) {
  return convertTimeZone(value, targetTimeZone, { timeZone: sourceTimeZone });
}
var relativeUnits = [
  { unit: "year", milliseconds: 365 * DAY },
  { unit: "quarter", milliseconds: 91 * DAY },
  { unit: "month", milliseconds: 30 * DAY },
  { unit: "week", milliseconds: 7 * DAY },
  { unit: "day", milliseconds: DAY },
  { unit: "hour", milliseconds: HOUR },
  { unit: "minute", milliseconds: MINUTE },
  { unit: "second", milliseconds: SECOND }
];
function calendarCompare(left, right) {
  return utcMilliseconds(left) - utcMilliseconds(right);
}
function calendarDayNumber(date) {
  return Math.floor(utcMilliseconds(date) / DAY);
}
function calendarFromDayNumber(day) {
  const date = new Date(day * DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
function calendarWeekday(date) {
  return new Date(utcMilliseconds(date)).getUTCDay();
}
function dateCalendar(value, options) {
  const zoned = getZonedDateTime(value, options.timeZone ?? "UTC", { timeZone: options.timeZone ?? "UTC" });
  return { year: zoned.year, month: zoned.month, day: zoned.day };
}
function weekdaysInclusive(start, end) {
  if (calendarCompare(start, end) > 0) return -weekdaysInclusive(end, start);
  const first = calendarDayNumber(start);
  const total = calendarDayNumber(end) - first + 1;
  const weeks = Math.floor(total / 7);
  let count = weeks * 5;
  for (let day = first + weeks * 7; day <= calendarDayNumber(end); day += 1) {
    const weekday = new Date(day * DAY).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}
function businessDaysBetween(start, end, options = {}) {
  const left = dateCalendar(start, options);
  const right = dateCalendar(end, options);
  if (calendarCompare(left, right) === 0) return (options.inclusiveStart ?? true) && (options.inclusiveEnd ?? false) && calendarWeekday(left) !== 0 && calendarWeekday(left) !== 6 ? 1 : 0;
  const direction = calendarCompare(left, right) < 0 ? 1 : -1;
  const earlier = direction > 0 ? left : right;
  const later = direction > 0 ? right : left;
  let first = calendarDayNumber(earlier);
  let last = calendarDayNumber(later);
  const includeEarlier = direction > 0 ? options.inclusiveStart ?? true : options.inclusiveEnd ?? false;
  const includeLater = direction > 0 ? options.inclusiveEnd ?? false : options.inclusiveStart ?? true;
  if (!includeEarlier) first += 1;
  if (!includeLater) last -= 1;
  if (first > last) return 0;
  return direction * weekdaysInclusive(calendarFromDayNumber(first), calendarFromDayNumber(last));
}

// lib/tools/cron/parser.ts
var MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
var WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
var SPECS = [
  { name: "second", label: "Second", min: 0, max: 59 },
  { name: "minute", label: "Minute", min: 0, max: 59 },
  { name: "hour", label: "Hour", min: 0, max: 23 },
  { name: "dayOfMonth", label: "Day of month", min: 1, max: 31 },
  { name: "month", label: "Month", min: 1, max: 12 },
  { name: "dayOfWeek", label: "Day of week", min: 0, max: 7 }
];
function parseField(expression, spec) {
  const fail = (message) => {
    throw new Error(`${spec.label}: ${message}`);
  };
  if (expression.length > 128) fail("field exceeds the 128-character limit.");
  if (!expression) fail("field cannot be empty.");
  const endpoint = (text3) => {
    let value;
    if (/^\d+$/.test(text3)) value = Number(text3);
    else if (spec.name === "month" && MONTH_NAMES.includes(text3.toUpperCase())) value = MONTH_NAMES.indexOf(text3.toUpperCase()) + 1;
    else if (spec.name === "dayOfWeek" && WEEKDAY_NAMES.includes(text3.toUpperCase())) value = WEEKDAY_NAMES.indexOf(text3.toUpperCase());
    else return fail("use integer values, permitted month/weekday names, *, ranges, lists or steps.");
    if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) fail(`value must be between ${spec.min} and ${spec.max}.`);
    return value;
  };
  const selected = /* @__PURE__ */ new Set();
  for (const item of expression.split(",")) {
    if (!item) fail("lists cannot contain empty items.");
    const pieces = item.split("/");
    if (pieces.length > 2 || !pieces[0]) fail("malformed step notation.");
    let step = 1;
    if (pieces.length === 2) {
      if (!/^\d+$/.test(pieces[1])) fail("step must be a positive integer.");
      step = Number(pieces[1]);
      if (!Number.isSafeInteger(step) || step < 1 || step > spec.max - spec.min + 1) fail(`step must be between 1 and ${spec.max - spec.min + 1}.`);
    }
    const base = pieces[0];
    let first;
    let last;
    if (base === "*") {
      first = spec.min;
      last = spec.max;
    } else {
      const range = base.split("-");
      if (range.length > 2 || range.some((value) => !value)) fail("malformed range; negative values are not supported.");
      first = endpoint(range[0]);
      last = range.length === 2 ? endpoint(range[1]) : pieces.length === 2 ? spec.max : first;
      if (last < first) fail("descending or wrapping ranges are not supported.");
    }
    for (let value = first; value <= last; value += step) selected.add(spec.name === "dayOfWeek" && value === 7 ? 0 : value);
  }
  return { ...spec, expression, values: [...selected].sort((a, b) => a - b), wildcard: expression.startsWith("*") };
}
function parseCron(expression) {
  if (typeof expression !== "string" || !expression.trim()) throw new Error("Enter a cron expression.");
  if (expression.length > 1024) throw new Error("Cron expression exceeds the 1,024-character limit.");
  if (/[?#]/.test(expression) || /(?:^|[\s,/-])(?:L|LW|\d+[LW]|W|H(?:\([^)]*\))?)(?=$|[\s,/-])/i.test(expression) || /\b(?:cron|rate)\s*\(/i.test(expression)) {
    throw new Error("Quartz, AWS and Jenkins extensions (?, L, W, # and H) are not supported; use Unix numeric cron notation.");
  }
  if (expression.includes("@")) throw new Error("Cron macros are not supported; enter five Unix fields or six seconds-first fields.");
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length !== 5 && tokens.length !== 6) throw new Error("Expected five Unix fields or six seconds-first fields; years, commands, comments and environment assignments are not supported.");
  const hasSeconds = tokens.length === 6;
  const fields = tokens.map((token, index) => parseField(token, SPECS[index + (hasSeconds ? 0 : 1)]));
  const second = hasSeconds ? fields[0] : parseField("0", SPECS[0]);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.slice(hasSeconds ? 1 : 0);
  return { expression, hasSeconds, fields, second, minute, hour, dayOfMonth, month, dayOfWeek, dayMode: dayOfMonth.wildcard || dayOfWeek.wildcard ? "and" : "or" };
}

// lib/tools/cron/explain.ts
var FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var FULL_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var pad2 = (value) => String(value).padStart(2, "0");
function explainCron(cron) {
  let timing;
  if (cron.hour.values.length === 1 && cron.minute.values.length === 1 && cron.second.values.length === 1) {
    timing = `At ${pad2(cron.hour.values[0])}:${pad2(cron.minute.values[0])}${cron.hasSeconds ? `:${pad2(cron.second.values[0])}` : ""}`;
  } else if (cron.hasSeconds && cron.hour.expression === "*" && cron.minute.expression === "*" && cron.second.expression === "*") timing = "Every second";
  else if (cron.hour.expression === "*" && cron.minute.expression === "*" && !cron.hasSeconds) timing = "Every minute (at second 0)";
  else if (cron.hour.expression === "*" && /^\*\/\d+$/.test(cron.minute.expression) && !cron.hasSeconds) timing = `Every ${Number(cron.minute.expression.slice(2))} minutes within each hour (at second 0)`;
  else if (cron.hour.expression === "*" && cron.minute.values.length === 1 && cron.second.values.length === 1) timing = `Every hour at minute ${cron.minute.values[0]}, second ${cron.second.values[0]}`;
  else timing = `${cron.hasSeconds ? "Seconds-first schedule" : "Unix schedule (at second 0)"}: hours ${cron.hour.expression === "*" ? "every hour" : cron.hour.values.map(pad2).join(", ")}; minutes ${cron.minute.expression === "*" ? "every minute" : cron.minute.values.map(pad2).join(", ")}${cron.hasSeconds ? `; seconds ${cron.second.expression === "*" ? "every second" : cron.second.values.map(pad2).join(", ")}` : ""}`;
  const months = cron.month.values.length === 12 ? "" : `; in ${cron.month.values.map((value) => FULL_MONTHS[value - 1]).join(", ")}`;
  const dom = cron.dayOfMonth.values.length === 31 ? "every day of month" : `day of month ${cron.dayOfMonth.values.join(", ")}`;
  const dow = cron.dayOfWeek.values.length === 7 ? "every weekday (Sunday\u2013Saturday)" : cron.dayOfWeek.values.map((value) => FULL_WEEKDAYS[value]).join(", ");
  const days = cron.dayMode === "or" ? `when either ${dom} OR weekday ${dow} matches` : cron.dayOfMonth.values.length === 31 && cron.dayOfWeek.values.length === 7 ? "every day" : cron.dayOfMonth.values.length === 31 ? `on ${dow}` : cron.dayOfWeek.values.length === 7 ? `on ${dom}` : `when both ${dom} AND weekday ${dow} match`;
  return `${timing}; ${days}${months}.`;
}

// lib/tools/sql/builders.ts
init_types();
init_literals();

// lib/tools/json-data/json.ts
import { Validator, format as schemaFormats } from "@cfworker/json-schema";
var MAX_INPUT = 1e6;
var MAX_NODES = 5e4;
var MAX_DEPTH = 100;
var sourceKeys = /* @__PURE__ */ new WeakMap();
var own = (value, key2) => Object.prototype.hasOwnProperty.call(value, key2);
var keys = (value) => sourceKeys.get(value) ?? Object.keys(value);
var jsonObjectKeys = keys;
function checkInput(input) {
  if (input.length > MAX_INPUT) throw new Error("Input exceeds the 1,000,000-character limit. Split it into smaller documents.");
}
var JsonError = class extends Error {
  constructor(input, offset, reason) {
    const lines = input.slice(0, offset).split(/\r\n|\r|\n/);
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    super(`${reason} (line ${line}, column ${column}).`);
    this.line = line;
    this.column = column;
  }
};
function decimalIdentity(raw) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  let digits = (match[2] + (match[3] ?? "")).replace(/^0+/, "");
  if (!digits) return "0";
  let exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  const trailing = /0+$/.exec(digits)?.[0].length ?? 0;
  if (trailing) {
    digits = digits.slice(0, -trailing);
    exponent += trailing;
  }
  return `${match[1]}${digits}e${exponent}`;
}
function readJson(input, preserveNumbers = false) {
  checkInput(input);
  let position = 0;
  let nodes = 0;
  const tokens = [];
  const fail = (reason, at = position) => {
    throw new JsonError(input, at, reason);
  };
  const white = () => {
    while (position < input.length && /[ \t\r\n]/.test(input[position])) position++;
  };
  const punctuation = () => {
    const raw = input[position++];
    tokens.push({ raw, kind: "punctuation" });
    return raw;
  };
  const string = () => {
    const start = position++;
    while (position < input.length) {
      const char = input[position++];
      if (char === '"') {
        const raw = input.slice(start, position);
        try {
          const value2 = JSON.parse(raw);
          tokens.push({ raw, kind: "literal" });
          return value2;
        } catch {
          return fail("Invalid JSON string or escape sequence", start);
        }
      }
      if (char.charCodeAt(0) < 32) fail("Unescaped control character in JSON string", position - 1);
      if (char === "\\") {
        const escaped = input[position++];
        if (escaped === "u") {
          if (!/^[\da-fA-F]{4}$/.test(input.slice(position, position + 4))) fail("Unicode escapes require four hexadecimal digits", position);
          position += 4;
        } else if (!escaped || !'"\\/bfnrt'.includes(escaped)) fail("Invalid JSON escape sequence", position - 1);
      }
    }
    return fail("Unterminated JSON string", start);
  };
  const value = (depth) => {
    white();
    if (depth > MAX_DEPTH) fail(`JSON nesting exceeds the ${MAX_DEPTH}-level limit`);
    if (++nodes > MAX_NODES) fail(`JSON exceeds the ${MAX_NODES.toLocaleString("en-US")}-node limit`);
    const char = input[position];
    if (char === '"') return string();
    if (char === "{" || char === "[") {
      const isArray = punctuation() === "[";
      const close = isArray ? "]" : "}";
      const result2 = isArray ? [] : /* @__PURE__ */ Object.create(null);
      const ordered = [];
      white();
      if (input[position] !== close) {
        while (true) {
          white();
          if (isArray) result2.push(value(depth + 1));
          else {
            if (input[position] !== '"') fail("Expected a double-quoted object property name");
            const keyPosition = position;
            const key2 = string();
            if (!preserveNumbers && own(result2, key2)) fail(`Duplicate object key ${JSON.stringify(key2)} is ambiguous for this transformation; no values were discarded`, keyPosition);
            white();
            if (input[position] !== ":") fail("Expected ':' after object property name");
            punctuation();
            result2[key2] = value(depth + 1);
            ordered.push(key2);
          }
          white();
          if (input[position] === close) break;
          if (input[position] !== ",") fail(`Expected ',' or '${close}'`);
          punctuation();
        }
      }
      punctuation();
      if (!isArray) sourceKeys.set(result2, ordered);
      return result2;
    }
    const start = position;
    const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(input.slice(position))?.[0];
    if (!literal) fail(position === input.length ? "Expected a JSON value; input is empty or incomplete" : "Expected a JSON value");
    position += literal.length;
    tokens.push({ raw: literal, kind: "literal" });
    if (literal === "true") return true;
    if (literal === "false") return false;
    if (literal === "null") return null;
    const number = Number(literal);
    if (!preserveNumbers && (!Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number) || decimalIdentity(literal) !== decimalIdentity(String(number)))) {
      fail(`Number ${literal.slice(0, 80)} cannot be represented without precision loss. Use a quoted string, or the source-preserving JSON Formatter/Minifier`, start);
    }
    return number;
  };
  const parsed = value(0);
  white();
  if (position !== input.length) fail("Unexpected characters after JSON value");
  return { value: parsed, tokens };
}
function parseJson(input) {
  return readJson(input).value;
}

// lib/tools/json-data/csv.ts
function csvError(message, row, column) {
  return new Error(`Row ${row}, column ${column}: ${message}`);
}
function checkDelimiter(delimiter) {
  if (delimiter.length !== 1 || /["\r\n]/.test(delimiter)) {
    throw new Error("Choose a single delimiter other than a quote or line break.");
  }
}
function readRecords(input, delimiter) {
  checkDelimiter(delimiter);
  if (input.length === 0) throw new Error("Input is empty. Enter CSV data first.");
  const records = [];
  let values = [];
  let field = "";
  let state = "start";
  let endedRecord = false;
  const finishField = () => {
    values.push(field);
    field = "";
    state = "start";
  };
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
        if (input[index + 1] === '"') {
          field += '"';
          index++;
        } else state = "closed";
      } else field += character;
      continue;
    }
    if (character === delimiter) {
      finishField();
      continue;
    }
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
  if (!endedRecord) finishRecord();
  return records;
}
function rectangular(records) {
  if (!records.length) throw new Error("Input is empty. Enter at least one nonblank CSV row.");
  const width = records[0].values.length;
  for (const record2 of records) {
    if (record2.values.length !== width) {
      throw csvError(`Expected ${width} columns but found ${record2.values.length}.`, record2.row, Math.min(width, record2.values.length) + 1);
    }
  }
  return records.map((record2) => record2.values);
}
function parseCsv(input, delimiter = ",") {
  return rectangular(readRecords(input, delimiter));
}

// lib/tools/sql/builders.ts
function list(value, label, maximum) {
  if (!Array.isArray(value)) throw new Error(`${label} must be a structured list.`);
  if (value.length > maximum) throw new Error(`${label} exceeds the ${maximum}-item limit.`);
  return value;
}
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function identifiers(value, dialect, label = "Columns", allowEmpty = false) {
  const names = list(value, label, 100).map((name2) => sqlText(name2, label));
  if (!allowEmpty && !names.length) throw new Error(`${label} must contain at least one column.`);
  names.forEach((name2) => quoteIdentifier(name2, dialect));
  if (new Set(names.map((name2) => dialect === "PostgreSQL" ? name2 : name2.toLocaleLowerCase("en-US"))).size !== names.length) throw new Error(`${label} cannot contain duplicate column names.`);
  return names;
}
function result(label, value, warnings) {
  if (value.length > 2e6) throw new Error("Generated SQL exceeds the 2,000,000-character output limit.");
  return { rows: [{ label, value }], ...warnings?.length ? { warnings } : {} };
}
function buildConditions(value, dialect, logicalOperator = "AND") {
  if (logicalOperator !== "AND" && logicalOperator !== "OR") throw new Error("Logical operator must be AND or OR.");
  let outputLength = 0;
  const checkedLiteral = (literal) => {
    const output2 = sqlLiteral(literal, dialect);
    outputLength += output2.length;
    if (outputLength > 2e6) throw new Error("Generated SQL exceeds the 2,000,000-character output limit.");
    return output2;
  };
  return list(value, "Conditions", 100).map((item, index) => {
    const condition = record(item, `Condition ${index + 1}`);
    const column = quoteIdentifier(sqlText(condition.column, "Condition column"), dialect);
    const operator = condition.operator;
    if (typeof operator !== "string" || !CONDITION_OPERATORS.includes(operator)) throw new Error("Choose a supported condition operator.");
    const values = list(condition.values, "Condition values", 100);
    if (operator === "IS NULL" || operator === "IS NOT NULL") {
      if (values.length) throw new Error(`${operator} must have no values.`);
      return `${column} ${operator}`;
    }
    const multiple = operator === "IN" || operator === "NOT IN";
    if (!values.length || !multiple && values.length !== 1) throw new Error(multiple ? `${operator} requires at least one value.` : `${operator} requires exactly one value.`);
    const literals = values.map((item2) => {
      const literal = record(item2, "Condition value");
      if (literal.type === "NULL") throw new Error("Use IS NULL or IS NOT NULL to compare NULL values.");
      if ((operator === "LIKE" || operator === "NOT LIKE") && literal.type !== "String") throw new Error("LIKE and NOT LIKE require a String value.");
      return checkedLiteral(literal);
    });
    return `${column} ${operator} ${multiple ? `(${literals.join(", ")})` : literals[0]}`;
  }).join(` ${logicalOperator} `);
}
function insert(table, columns2, rows, dialect) {
  if (!rows.length) throw new Error("No rows. Provide at least one data row.");
  if (rows.length > 1e3) throw new Error("Rows exceed the 1,000-row limit.");
  return `INSERT INTO ${table} (${columns2.map((column) => quoteIdentifier(column, dialect)).join(", ")})
VALUES
${rows.map((row) => {
    if (row.length !== columns2.length) throw new Error("Every row must have exactly one value per column.");
    return `  (${row.join(", ")})`;
  }).join(",\n")};`;
}
async function runBuilder(toolId, values) {
  const dialect = readDialect(values.dialect);
  let outputLength = 0;
  const checkedLiteral = (literal) => {
    const output2 = sqlLiteral(literal, dialect);
    outputLength += output2.length;
    if (outputLength > 2e6) throw new Error("Generated SQL exceeds the 2,000,000-character output limit.");
    return output2;
  };
  if (toolId === "sql-escape-helper") {
    return result("Escaped SQL literal", sqlLiteral({ type: values.valueType, value: sqlText(values.value, "Value") }, dialect));
  }
  if (toolId === "sql-where-builder") {
    const logicalOperator = values.logicalOperator;
    if (logicalOperator !== "AND" && logicalOperator !== "OR") throw new Error("Logical operator must be AND or OR.");
    const conditions2 = buildConditions(values.conditions, dialect, logicalOperator);
    if (!conditions2) throw new Error("Provide at least one condition.");
    return result("SQL WHERE clause", `WHERE ${conditions2}`);
  }
  const table = quoteIdentifier(sqlText(values.table, "Table"), dialect, true);
  if (toolId === "json-to-sql") {
    const parsed = parseJson(sqlText(values.json, "JSON"));
    const rows = list(parsed, "JSON rows", 1e3);
    if (!rows.length) throw new Error("No rows. Provide a nonempty JSON array of objects.");
    const objects = rows.map((row, index) => record(row, `JSON row ${index + 1}`));
    const columns2 = identifiers(jsonObjectKeys(objects[0]), dialect);
    const keys2 = new Set(columns2);
    const literals = objects.map((object, index) => {
      const rowKeys = jsonObjectKeys(object);
      if (rowKeys.length !== columns2.length || rowKeys.some((key2) => !keys2.has(key2))) throw new Error(`JSON row ${index + 1} must have exactly the same keys as the first row.`);
      return columns2.map((column) => jsonLiteral(object[column], dialect));
    });
    return result("SQL INSERT statements", insert(table, columns2, literals, dialect));
  }
  if (toolId === "csv-to-sql") {
    const csv = sqlText(values.csv, "CSV").replace(/^\uFEFF/, "");
    const records = parseCsv(csv);
    const columns2 = identifiers(records[0], dialect, "CSV headers");
    if (records.length > 1001) throw new Error("CSV data exceeds the 1,000-row limit.");
    return result("SQL INSERT statements", insert(table, columns2, records.slice(1).map((row) => row.map((value) => sqlLiteral({ type: "String", value }, dialect))), dialect));
  }
  if (toolId === "sql-insert-generator") {
    const columns2 = identifiers(values.columns, dialect);
    const rows = list(values.rows, "Rows", 1e3).map((row) => {
      const cells = list(row, "Row values", 100);
      if (cells.length !== columns2.length) throw new Error("Every row must have exactly one value per column.");
      return cells.map((cell) => checkedLiteral(record(cell, "Row value")));
    });
    return result("SQL INSERT statement", insert(table, columns2, rows, dialect));
  }
  const conditions = buildConditions(values.conditions, dialect);
  const where = conditions ? `
WHERE ${conditions}` : "";
  if (toolId === "sql-update-generator") {
    const assignments = list(values.assignments, "Assignments", 100).map((item) => record(item, "Assignment"));
    const columns2 = identifiers(assignments.map((item) => item.column), dialect, "Assignment columns");
    const set = assignments.map((item, index) => `${quoteIdentifier(columns2[index], dialect)} = ${checkedLiteral(record(item.value, "Assignment value"))}`).join(",\n  ");
    return result("SQL UPDATE statement", `UPDATE ${table}
SET ${set}${where};`, conditions ? void 0 : ["This UPDATE has no WHERE clause and may affect every row."]);
  }
  if (toolId === "sql-delete-generator") {
    return result("SQL DELETE statement", `DELETE FROM ${table}${where};`, conditions ? void 0 : ["This DELETE has no WHERE clause and may delete every row."]);
  }
  if (toolId === "sql-select-builder") {
    const columns2 = identifiers(values.columns, dialect, "Columns", true);
    const orders = list(values.orderBy, "ORDER BY", 100).map((item) => record(item, "Order"));
    identifiers(orders.map((order) => order.column), dialect, "ORDER BY columns", true);
    const orderSql = orders.map((order) => {
      if (order.direction !== "ASC" && order.direction !== "DESC") throw new Error("ORDER BY direction must be ASC or DESC.");
      return `${quoteIdentifier(sqlText(order.column, "ORDER BY column"), dialect)} ${order.direction}`;
    });
    const limit = values.limit === void 0 ? "" : sqlText(values.limit, "Limit");
    if (limit && (!/^[1-9]\d{0,6}$/.test(limit) || Number(limit) > 1e6)) throw new Error("Limit must be a positive integer from 1 to 1,000,000.");
    const top = limit && dialect === "SQL Server" ? ` TOP (${limit})` : "";
    const tail = limit && dialect !== "SQL Server" ? `
LIMIT ${limit}` : "";
    return result("SQL SELECT statement", `SELECT${top} ${columns2.length ? columns2.map((column) => quoteIdentifier(column, dialect)).join(", ") : "*"}
FROM ${table}${where}${orderSql.length ? `
ORDER BY ${orderSql.join(", ")}` : ""}${tail};`);
  }
  throw new Error("Unsupported SQL builder.");
}

// lib/tools/sql/connections.ts
init_literals();
var defaults = { PostgreSQL: "5432", MySQL: "3306", "SQL Server": "1433" };
var mask = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
var normalize = (key2) => key2.toLowerCase().replace(/[\s_-]/g, "");
var coreNames = /* @__PURE__ */ new Set(["host", "hostname", "server", "datasource", "address", "addr", "networkaddress", "port", "database", "dbname", "initialcatalog", "username", "user", "userid", "uid", "password", "pwd", "pass"]);
var privateName = (key2) => /password|pwd|passphrase|token|secret|credential|auth|(?:^|[\s_-])key|accesskey|privatekey|sslkey|clientkey|certificate|signature|sastoken/i.test(key2) || /^(pass|apikey|key)$/i.test(normalize(key2));
function text2(value, label, required = false) {
  const result2 = sqlText(value, label);
  if (/[\x00-\x1f\x7f]/.test(result2)) throw new Error(`${label} cannot contain control characters.`);
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(result2)) throw new Error(`${label} must contain valid Unicode.`);
  if (required && !result2.trim()) throw new Error(`${label} is required.`);
  return result2;
}
function port(value, type) {
  if (!value) return defaults[type];
  if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) throw new Error("Port must be an integer from 1 to 65,535, or blank for the database default.");
  return value;
}
function host(value) {
  if (!value || value !== value.trim() || /[\s/?@#\\]/u.test(value)) throw new Error("Host must be a hostname, IP address, or IPv6 address without a scheme, path, or credentials.");
  if (value.includes(":")) {
    const bracketed = value.startsWith("[") && value.endsWith("]") ? value : `[${value}]`;
    try {
      const url = new URL(`http://${bracketed}/`);
      if (!url.hostname.startsWith("[")) throw new Error();
      return url.hostname;
    } catch {
      throw new Error("Enter a valid IPv6 address; zone identifiers and host:port syntax are unsupported.");
    }
  }
  if (!/^[\p{L}\p{N}._-]+$/u.test(value) || value.length > 253) throw new Error("Enter a valid hostname or IP address.");
  try {
    return new URL(`http://${value}/`).hostname;
  } catch {
    throw new Error("Enter a valid hostname or IP address.");
  }
}
function decode(value, query = false) {
  try {
    return decodeURIComponent(query ? value.replace(/\+/g, " ") : value);
  } catch {
    throw new Error("Connection string contains invalid percent encoding.");
  }
}
function validateParameters(parameters2, rejectCore) {
  if (parameters2.length > 100) throw new Error("Parameters exceed the 100-entry limit.");
  const seen = /* @__PURE__ */ new Set();
  return parameters2.map(({ key: key2, value }) => {
    if (!/^[A-Za-z][A-Za-z0-9 ._-]{0,127}$/.test(key2)) throw new Error("Parameter names must start with a letter and contain only letters, numbers, spaces, dots, underscores, or hyphens.");
    const normalized = normalize(key2);
    if (seen.has(normalized)) throw new Error("Duplicate connection parameter names are unsupported.");
    seen.add(normalized);
    if (rejectCore && coreNames.has(normalized)) throw new Error("Parameters cannot override host, port, database, username, or password fields.");
    return { key: key2, value: text2(value, "Parameter value") };
  });
}
function parameters(value) {
  if (!value.trim()) return [];
  if (value.startsWith("?") || value.includes("&") && !/[\r\n]/.test(value)) return queryParameters(value.replace(/^\?/, ""));
  return validateParameters(value.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "").map((line) => {
    const equals = line.indexOf("=");
    if (equals < 1) throw new Error("Parameters must use one key=value per line, or URL query syntax beginning with ?.");
    return { key: line.slice(0, equals).trim(), value: line.slice(equals + 1) };
  }), true);
}
function queryParameters(query, rejectCore = true) {
  if (!query) return [];
  return validateParameters(query.split("&").map((pair) => {
    const equals = pair.indexOf("=");
    if (equals < 1) throw new Error("Each URL parameter must use key=value syntax.");
    return { key: decode(pair.slice(0, equals), true), value: decode(pair.slice(equals + 1), true) };
  }), rejectCore);
}
function adoQuote(value) {
  return `"${value.replace(/"/g, '""')}"`;
}
function build(values) {
  const type = values.databaseType;
  if (type !== "PostgreSQL" && type !== "MySQL" && type !== "SQL Server") throw new Error("Choose PostgreSQL, MySQL, or SQL Server.");
  const hostname = host(text2(values.host, "Host", true));
  const serverPort = port(text2(values.port, "Port"), type);
  const database = text2(values.database, "Database", true);
  const username = text2(values.username, "Username", true);
  const password = text2(values.password, "Password");
  const extra = parameters(values.parameters === void 0 ? "" : sqlText(values.parameters, "Parameters"));
  let connection;
  if (type === "SQL Server") {
    connection = `Data Source=${adoQuote(`${hostname},${serverPort}`)};Initial Catalog=${adoQuote(database)};User ID=${adoQuote(username)};Password=${adoQuote(password)};${extra.map((item) => `${item.key}=${adoQuote(item.value)};`).join("")}`;
  } else {
    const query = extra.length ? `?${extra.map((item) => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`).join("&")}` : "";
    connection = `${type === "PostgreSQL" ? "postgresql" : "mysql"}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostname}:${serverPort}/${encodeURIComponent(database)}${query}`;
  }
  if (connection.length > 2e6) throw new Error("Connection string exceeds the output limit.");
  return { rows: [{ label: "Connection string", value: connection }] };
}
function redacted(item) {
  let inspection = item.value;
  for (let round = 0; round < 2; round++) {
    try {
      inspection = decodeURIComponent(inspection);
    } catch {
      break;
    }
  }
  const secretValue = /[a-z][a-z\d+.-]*:\/\/[^\s/]*@/i.test(inspection) || /(?:password|pwd|token|secret|credential|auth|access.?key|private.?key|api.?key|signature)\s*(?:=|:)/i.test(inspection);
  return { key: item.key, value: privateName(item.key) || secretValue ? mask : item.value };
}
function output(type, hostname, serverPort, database, username, extra) {
  return { rows: [
    { label: "Database type", value: type },
    { label: "Host", value: hostname },
    { label: "Port", value: serverPort },
    { label: "Database name", value: database },
    { label: "Username", value: username },
    { label: "Masked password", value: mask },
    { label: "Parameters", value: extra.length ? extra.map(redacted).map((item) => `${item.key}=${item.value}`).join("\n") : "None" }
  ] };
}
function parseUri(input) {
  const scheme = /^(postgresql|postgres|mysql):\/\//i.exec(input);
  if (!scheme) throw new Error("Use a PostgreSQL/MySQL URI or a SQL Server ADO.NET connection string.");
  const type = scheme[1].toLowerCase() === "mysql" ? "MySQL" : "PostgreSQL";
  const authority = input.slice(scheme[0].length).split(/[/?#]/, 1)[0];
  if ((authority.match(/@/g) ?? []).length > 1) throw new Error("Encode @ inside URI credentials; multiple userinfo separators are ambiguous.");
  if (input.includes("#")) throw new Error("Connection URI fragments are unsupported; encode # inside field values.");
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid database connection URI.");
  }
  const username = text2(decode(url.username), "Username");
  text2(decode(url.password), "Password");
  const database = text2(decode(url.pathname.replace(/^\//, "")), "Database", true);
  if (url.pathname.slice(1).includes("/")) throw new Error("Database paths must be one encoded path segment.");
  const hostname = host(url.hostname);
  const serverPort = port(url.port, type);
  const extra = queryParameters(url.search.replace(/^\?/, ""));
  return output(type, hostname, serverPort, database, username, extra);
}
function adoParameters(input) {
  const pairs = [];
  let position = 0;
  while (position < input.length) {
    while (/[\s;]/.test(input[position] ?? "") && position < input.length) position++;
    if (position === input.length) break;
    const start = position;
    while (position < input.length && input[position] !== "=" && input[position] !== ";") position++;
    if (input[position] !== "=") throw new Error("ADO.NET connection entries must use key=value syntax.");
    const key2 = input.slice(start, position++).trim();
    while (input[position] === " ") position++;
    let value = "";
    const quote = input[position];
    if (quote === '"' || quote === "'") {
      position++;
      let closed = false;
      while (position < input.length) {
        const character = input[position++];
        if (character !== quote) {
          value += character;
          continue;
        }
        if (input[position] === quote) {
          value += quote;
          position++;
        } else {
          closed = true;
          break;
        }
      }
      if (!closed) throw new Error("ADO.NET connection string has an unclosed quoted value.");
      while (input[position] === " ") position++;
      if (position < input.length && input[position] !== ";") throw new Error("Unexpected text after a quoted ADO.NET value.");
    } else {
      const startValue = position;
      while (position < input.length && input[position] !== ";") position++;
      value = input.slice(startValue, position).trim();
      if (/["']/.test(value)) throw new Error("Quote the entire ADO.NET value when it contains quotes.");
    }
    pairs.push({ key: key2, value });
    if (input[position] === ";") position++;
    if (pairs.length > 100) throw new Error("Connection entries exceed the 100-entry limit.");
  }
  return validateParameters(pairs, false);
}
function parseAdo(input) {
  const pairs = adoParameters(input);
  const aliases = {
    server: "host",
    datasource: "host",
    address: "host",
    addr: "host",
    networkaddress: "host",
    host: "host",
    initialcatalog: "database",
    database: "database",
    dbname: "database",
    userid: "username",
    uid: "username",
    user: "username",
    username: "username",
    password: "password",
    pwd: "password",
    pass: "password",
    port: "port"
  };
  const core = /* @__PURE__ */ new Map();
  const extra = [];
  for (const pair of pairs) {
    const normalized = normalize(pair.key);
    const key2 = Object.prototype.hasOwnProperty.call(aliases, normalized) ? aliases[normalized] : void 0;
    if (!key2) {
      extra.push(pair);
      continue;
    }
    if (core.has(key2)) throw new Error("Connection string contains duplicate aliases for a core field.");
    core.set(key2, pair.value);
  }
  const source = (core.get("host") ?? "").replace(/^tcp:/i, "");
  const parts = source.split(",");
  if (parts.length > 2 || parts.length === 2 && core.has("port")) throw new Error("SQL Server host and port are ambiguous; supply one port.");
  const hostname = host(parts[0].trim());
  const serverPort = port((parts[1] ?? core.get("port") ?? "").trim(), "SQL Server");
  const database = text2(core.get("database") ?? "", "Database", true);
  return output("SQL Server", hostname, serverPort, database, core.get("username") ?? "", extra);
}
function runConnection(toolId, values) {
  if (toolId === "database-connection-string-builder") return build(values);
  if (toolId !== "database-connection-string-parser") throw new Error("Unsupported connection string tool.");
  const input = sqlText(values.connectionString, "Connection string").trim();
  if (!input) throw new Error("Enter a connection string.");
  if (/[\x00-\x1f\x7f]/.test(input)) throw new Error("Connection strings cannot contain control characters.");
  return /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(input) ? parseUri(input) : parseAdo(input);
}

// lib/tools/sql/engine.ts
init_literals();
async function runSql(toolId, values) {
  let result2;
  if (toolId === "database-connection-string-builder" || toolId === "database-connection-string-parser") {
    result2 = runConnection(toolId, values);
  } else if (["sql-formatter", "sql-minifier", "sql-validator", "sql-to-json", "sql-to-csv", "sql-to-markdown", "er-diagram-generator"].includes(toolId)) {
    const dialect = readDialect(values.dialect);
    const sql = sqlText(values.sql, "SQL");
    if (toolId === "er-diagram-generator") {
      const { ddlOutput: ddlOutput2 } = await Promise.resolve().then(() => (init_ddl(), ddl_exports));
      result2 = await ddlOutput2(sql, dialect);
    } else {
      const { formatSqlTool: formatSqlTool2, minifySqlTool: minifySqlTool2, validateSqlTool: validateSqlTool2, insertOutput: insertOutput2 } = await Promise.resolve().then(() => (init_transforms(), transforms_exports));
      result2 = toolId === "sql-formatter" ? await formatSqlTool2(sql, dialect) : toolId === "sql-minifier" ? await minifySqlTool2(sql, dialect) : toolId === "sql-validator" ? await validateSqlTool2(sql, dialect) : await insertOutput2(toolId, sql, dialect);
    }
  } else result2 = await runBuilder(toolId, values);
  if (JSON.stringify(result2).length > 2e6) throw new Error("The complete result exceeds the 2,000,000-character output budget. Use a smaller input.");
  return result2;
}

// mcp/server.ts
function createMcpServer(cliKey) {
  const license = resolveLicense(cliKey);
  const server = new Server(
    {
      name: "codestation-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  const tools = [
    // ----------------- FREE TOOLS -----------------
    {
      name: "codestation_uuid",
      description: "Generate cryptographically secure v4 UUIDs. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          count: {
            type: "integer",
            description: "Number of UUIDs to generate (1 to 50, default: 1)",
            minimum: 1,
            maximum: 50
          }
        }
      }
    },
    {
      name: "codestation_base64",
      description: "Encode or decode Base64 and URL-safe Base64 strings. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The string to encode or decode" },
          action: {
            type: "string",
            enum: ["encode", "decode"],
            description: "Whether to encode or decode"
          },
          urlSafe: {
            type: "boolean",
            description: "Whether to use URL-safe Base64 (default: false)"
          }
        },
        required: ["text", "action"]
      }
    },
    {
      name: "codestation_url_codec",
      description: "URL encode or decode string components. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to URL-encode or URL-decode" },
          action: {
            type: "string",
            enum: ["encode", "decode"],
            description: "Action to perform"
          }
        },
        required: ["text", "action"]
      }
    },
    {
      name: "codestation_hex_codec",
      description: "Encode UTF-8 string to hexadecimal byte pairs or decode hex to text. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text or hex string" },
          action: {
            type: "string",
            enum: ["encode", "decode"],
            description: "Action to perform"
          }
        },
        required: ["text", "action"]
      }
    },
    {
      name: "codestation_format_json",
      description: "Prettify, format, and validate a JSON string. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          json: { type: "string", description: "Raw JSON string to format" },
          indent: {
            type: "integer",
            description: "Number of spaces for indentation (0-8, default: 2)",
            minimum: 0,
            maximum: 8
          }
        },
        required: ["json"]
      }
    },
    {
      name: "codestation_minify_json",
      description: "Minify JSON by stripping all whitespace. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          json: { type: "string", description: "JSON string to minify" }
        },
        required: ["json"]
      }
    },
    {
      name: "codestation_json_to_yaml",
      description: "Convert JSON to clean YAML format. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          json: { type: "string", description: "Valid JSON string" }
        },
        required: ["json"]
      }
    },
    {
      name: "codestation_yaml_to_json",
      description: "Convert YAML formatted text to JSON. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          yaml: { type: "string", description: "YAML text string" }
        },
        required: ["yaml"]
      }
    },
    {
      name: "codestation_case_convert",
      description: "Convert text into different naming conventions (camelCase, snake_case, kebab-case, PascalCase, CONSTANT_CASE, etc.). [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The string or identifier to convert" },
          targetCase: {
            type: "string",
            enum: ["camel", "pascal", "snake", "kebab", "constant", "title", "sentence", "upper", "lower"],
            description: "Target casing style"
          }
        },
        required: ["text", "targetCase"]
      }
    },
    {
      name: "codestation_text_diff",
      description: "Generate a clean line-by-line unified diff between original and modified text. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          original: { type: "string", description: "The original text content" },
          modified: { type: "string", description: "The updated text content" }
        },
        required: ["original", "modified"]
      }
    },
    {
      name: "codestation_slugify",
      description: "Convert strings to clean, SEO-friendly URL slugs. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to slugify" },
          separator: { type: "string", description: "Separator character (default: '-')" }
        },
        required: ["text"]
      }
    },
    // ----------------- PRO TOOLS (₹199 / $2.99) -----------------
    {
      name: "codestation_hash",
      description: "Generate cryptographic hashes (SHA-256, SHA-512, MD5, SHA-1, CRC-32). [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to hash" },
          algorithm: {
            type: "string",
            enum: ["SHA-256", "SHA-384", "SHA-512", "MD5", "SHA-1", "CRC32"],
            description: "Hash algorithm to apply (default: SHA-256)"
          }
        },
        required: ["text"]
      }
    },
    {
      name: "codestation_hmac",
      description: "Compute HMAC signatures using Web Crypto. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Input message string" },
          secret: { type: "string", description: "Secret key" },
          algorithm: {
            type: "string",
            enum: ["SHA-256", "SHA-512"],
            description: "HMAC algorithm (default: SHA-256)"
          }
        },
        required: ["text", "secret"]
      }
    },
    {
      name: "codestation_jwt_decode",
      description: "Inspect & decode JSON Web Token (JWT) header, payload claims, and signature in local memory without transmitting secrets. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          token: { type: "string", description: "Full JWT string (header.payload.signature)" }
        },
        required: ["token"]
      }
    },
    {
      name: "codestation_format_sql",
      description: "Format, beautify, and indent SQL queries across PostgreSQL, MySQL, SQLite, and standard SQL. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Raw SQL query to format" },
          dialect: {
            type: "string",
            enum: ["PostgreSQL", "MySQL", "SQLite", "SQL Server"],
            description: "SQL dialect (default: PostgreSQL)"
          }
        },
        required: ["sql"]
      }
    },
    {
      name: "codestation_cron_explain",
      description: "Parse and explain 5-field Unix cron expressions in clear plain English. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "5-field cron expression, e.g. '*/15 9-17 * * 1-5'"
          }
        },
        required: ["expression"]
      }
    },
    {
      name: "codestation_timezone_convert",
      description: "Accurately convert a date/time string from one IANA timezone to another using runtime IANA rules. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          dateTime: {
            type: "string",
            description: "ISO date-time string, e.g. '2026-10-09T14:30:00'"
          },
          sourceTimeZone: {
            type: "string",
            description: "Source IANA timezone (e.g. 'America/New_York', 'Asia/Kolkata', 'UTC')"
          },
          targetTimeZone: {
            type: "string",
            description: "Target IANA timezone (e.g. 'Asia/Kolkata', 'Europe/London', 'UTC')"
          }
        },
        required: ["dateTime", "sourceTimeZone", "targetTimeZone"]
      }
    },
    {
      name: "codestation_business_days",
      description: "Calculate exact working/business days between two dates, excluding weekends. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
          endDate: { type: "string", description: "End date (YYYY-MM-DD)" }
        },
        required: ["startDate", "endDate"]
      }
    },
    {
      name: "codestation_regex_test",
      description: "Test regular expressions against target text and return structured match groups and indices. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern (without bounding slashes)" },
          text: { type: "string", description: "Text to search within" },
          flags: {
            type: "string",
            description: "Regex flags (e.g. 'g', 'i', 'm', default: 'g')"
          }
        },
        required: ["pattern", "text"]
      }
    },
    {
      name: "codestation_json_schema",
      description: "Infer a Draft 2020-12 JSON Schema structure from sample JSON data. [Pro Tier: \u20B9199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          json: { type: "string", description: "Sample JSON string" }
        },
        required: ["json"]
      }
    }
  ];
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: name2, arguments: args = {} } = request.params;
    if (PRO_TOOLS.has(name2) && !license.isPro) {
      return {
        content: [
          {
            type: "text",
            text: getProUpgradeNotice(name2)
          }
        ],
        isError: true
      };
    }
    try {
      let outputText = "";
      switch (name2) {
        // --- Free tools ---
        case "codestation_uuid": {
          const count = Math.min(Math.max(Number(args.count ?? 1), 1), 50);
          const uuids = Array.from({ length: count }, () => crypto.randomUUID());
          outputText = count === 1 ? uuids[0] : uuids.join("\n");
          break;
        }
        case "codestation_base64": {
          const text3 = String(args.text ?? "");
          const action = String(args.action ?? "encode");
          const urlSafe = Boolean(args.urlSafe);
          if (action === "encode") {
            if (urlSafe) {
              outputText = encodeBase64Url(text3);
            } else {
              outputText = Buffer.from(text3, "utf-8").toString("base64");
            }
          } else {
            if (urlSafe) {
              outputText = decodeBase64Url(text3);
            } else {
              outputText = Buffer.from(text3, "base64").toString("utf-8");
            }
          }
          break;
        }
        case "codestation_url_codec": {
          const text3 = String(args.text ?? "");
          const action = String(args.action ?? "encode");
          outputText = action === "encode" ? encodeUrlComponent(text3) : decodeUrlComponent(text3);
          break;
        }
        case "codestation_hex_codec": {
          const text3 = String(args.text ?? "");
          const action = String(args.action ?? "encode");
          outputText = action === "encode" ? encodeHexadecimal(text3) : decodeHexadecimal(text3);
          break;
        }
        case "codestation_format_json": {
          const json = String(args.json ?? "");
          const indent = args.indent !== void 0 ? Number(args.indent) : 2;
          outputText = formatJson(json, indent);
          break;
        }
        case "codestation_minify_json": {
          outputText = minifyJson(String(args.json ?? ""));
          break;
        }
        case "codestation_json_to_yaml": {
          outputText = jsonToYaml(String(args.json ?? ""));
          break;
        }
        case "codestation_yaml_to_json": {
          outputText = yamlToJson(String(args.yaml ?? ""));
          break;
        }
        case "codestation_case_convert": {
          const text3 = String(args.text ?? "");
          const targetCase = String(args.targetCase ?? "camel");
          outputText = convertCase(text3, targetCase);
          break;
        }
        case "codestation_text_diff": {
          outputText = diffText(String(args.original ?? ""), String(args.modified ?? ""));
          break;
        }
        case "codestation_slugify": {
          outputText = slugify(String(args.text ?? ""), String(args.separator ?? "-"));
          break;
        }
        // --- Pro tools ---
        case "codestation_hash": {
          const text3 = String(args.text ?? "");
          const algo = String(args.algorithm ?? "SHA-256").toUpperCase();
          if (algo === "MD5") outputText = md5(text3);
          else if (algo === "SHA-1") outputText = sha1(text3);
          else if (algo === "SHA-256") outputText = await sha256(text3);
          else if (algo === "SHA-384") outputText = await sha384(text3);
          else if (algo === "SHA-512") outputText = await sha512(text3);
          else if (algo === "CRC32") outputText = crc32(text3);
          else throw new Error(`Unsupported hash algorithm: ${algo}`);
          break;
        }
        case "codestation_hmac": {
          const text3 = String(args.text ?? "");
          const secret = String(args.secret ?? "");
          const algo = String(args.algorithm ?? "SHA-256").toUpperCase();
          if (algo === "SHA-512") {
            outputText = await hmacSha512(text3, secret);
          } else {
            outputText = await hmacSha256(text3, secret);
          }
          break;
        }
        case "codestation_jwt_decode": {
          outputText = decodeJwt(String(args.token ?? ""));
          break;
        }
        case "codestation_format_sql": {
          const sql = String(args.sql ?? "");
          const dialect = String(args.dialect ?? "PostgreSQL");
          const res = await runSql("sql-formatter", { sql, dialect });
          outputText = res.rows?.find((r) => r.label === "Formatted SQL")?.value ?? "";
          break;
        }
        case "codestation_cron_explain": {
          const parsed = parseCron(String(args.expression ?? ""));
          outputText = explainCron(parsed);
          break;
        }
        case "codestation_timezone_convert": {
          const dateTime = String(args.dateTime ?? "");
          const sourceZone = String(args.sourceTimeZone ?? "UTC");
          const targetZone = String(args.targetTimeZone ?? "UTC");
          outputText = convertBetweenTimeZones(dateTime, sourceZone, targetZone);
          break;
        }
        case "codestation_business_days": {
          const start = String(args.startDate ?? "");
          const end = String(args.endDate ?? "");
          const days = businessDaysBetween(start, end);
          outputText = `${days} business day${days === 1 ? "" : "s"}`;
          break;
        }
        case "codestation_regex_test": {
          const pattern = String(args.pattern ?? "");
          const text3 = String(args.text ?? "");
          const flags = String(args.flags ?? "g");
          outputText = testRegex(pattern, flags, text3);
          break;
        }
        case "codestation_json_schema": {
          outputText = generateJsonSchema(String(args.json ?? ""));
          break;
        }
        default:
          throw new Error(`Unknown tool: ${name2}`);
      }
      return {
        content: [{ type: "text", text: outputText }]
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true
      };
    }
  });
  return { server, license };
}

// mcp/cli.ts
function printHelp() {
  process.stderr.write(`
Code Station MCP Server
Local-first developer toolbox for AI assistants (Cursor, Claude Desktop, Antigravity)

Usage:
  npx codestation-mcp [options]

Options:
  --key <license_key>     Activate Code Station Pro features
  --help, -h              Show this help message
  --version, -v           Show version information

Pricing:
  \u2022 Free Tier:            Unlimited Base64, JSON, YAML, UUID, Text Diff, Case conversion
  \u2022 Pro Tier (India):     ${PRICING.inr} (or ${PRICING.lifetimeInr})
  \u2022 Pro Tier (Global):    ${PRICING.usd} (or ${PRICING.lifetimeUsd})
  \u2022 Upgrade / Account:    ${PRICING.upgradeUrl}

Configuration for Claude Desktop (claude_desktop_config.json):
  {
    "mcpServers": {
      "codestation": {
        "command": "npx",
        "args": ["-y", "codestation-mcp", "--key", "YOUR_PRO_KEY"]
      }
    }
  }

`);
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stderr.write("codestation-mcp v1.0.0\n");
    process.exit(0);
  }
  let cliKey;
  const keyIndex = args.indexOf("--key");
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    cliKey = args[keyIndex + 1];
  }
  const { server, license } = createMcpServer(cliKey);
  if (license.isPro) {
    process.stderr.write(`[Code Station MCP] Pro Tier Active (License: ${license.licenseKey?.slice(0, 8)}...). All tools unlocked.
`);
  } else {
    process.stderr.write(
      `[Code Station MCP] Running in Free Tier. Pro tools available at ${PRICING.inr} / ${PRICING.usd} (${PRICING.upgradeUrl})
`
    );
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[Code Station MCP] Connected to stdio. Ready for tool requests.\n");
}
main().catch((err) => {
  process.stderr.write(`[Code Station MCP Error] ${err instanceof Error ? err.stack : String(err)}
`);
  process.exit(1);
});
