import { identifierValue, lexSql, significantTokens, SqlSyntaxError, TokenCursor, type SqlToken } from "./lexer";
import { readDialect } from "./literals";
import { parseSql } from "./parser";
import type { SqlDialect, SqlForeignKey, SqlResult, SqlSchema, SqlTable } from "./types";

function key(name: string, dialect: SqlDialect): string { return dialect === "PostgreSQL" ? name : name.toLowerCase(); }
function name(cursor: TokenCursor, dialect: SqlDialect): string {
  const token = cursor.take(), value = identifierValue(token);
  if (value.length > 128) cursor.fail("DDL identifiers are limited to 128 characters.");
  return dialect === "PostgreSQL" && token.kind === "word" ? value.toLowerCase() : value;
}
function qualified(cursor: TokenCursor, dialect: SqlDialect): string {
  const parts = [name(cursor, dialect)]; while (cursor.accept(".")) parts.push(name(cursor, dialect));
  if (parts.length > 3) cursor.fail("Table names may have at most three qualification parts.");
  if (parts.some(part => part.includes("."))) cursor.fail("Quoted identifiers containing dots are unsupported; use explicit qualification parts.");
  return parts.join(".");
}
function columns(cursor: TokenCursor, dialect: SqlDialect): string[] {
  cursor.expect("("); const values: string[] = [];
  do { values.push(name(cursor, dialect)); } while (cursor.accept(",")); cursor.expect(")");
  if (new Set(values.map(value => key(value, dialect))).size !== values.length) cursor.fail("Duplicate columns in a key constraint.");
  return values;
}
function parenthesized(cursor: TokenCursor, allowEmpty = false): SqlToken[] {
  cursor.expect("("); let depth = 1; const result: SqlToken[] = [];
  while (depth) {
    const token = cursor.take();
    if (token.text === "(") depth++;
    if (token.text === ")") depth--;
    if (depth) result.push(token);
  }
  if (!result.length && !allowEmpty) cursor.fail("Empty parenthesized SQL definition is unsupported.");
  return result;
}
function reference(cursor: TokenCursor, dialect: SqlDialect, localColumns: string[]): SqlForeignKey {
  cursor.expect("REFERENCES"); const referencedTable = qualified(cursor, dialect), referencedColumns = columns(cursor, dialect);
  if (localColumns.length !== referencedColumns.length) cursor.fail("Foreign-key column counts do not match the referenced column counts.");
  let match = false; const actions = new Set<string>();
  while (cursor.is("MATCH") || cursor.is("ON")) {
    if (cursor.accept("MATCH")) {
      if (match) cursor.fail("Duplicate foreign-key MATCH clause."); match = true;
      if (!cursor.accept("SIMPLE") && !cursor.accept("FULL") && !cursor.accept("PARTIAL")) cursor.fail("Unsupported foreign-key MATCH clause.");
    } else {
      cursor.expect("ON"); const action = cursor.take().text.toUpperCase();
      if ((action !== "DELETE" && action !== "UPDATE") || actions.has(action)) cursor.fail("Invalid or duplicate foreign-key action."); actions.add(action);
      if (cursor.accept("SET")) { if (!cursor.accept("NULL") && !cursor.accept("DEFAULT")) cursor.fail("Unsupported foreign-key SET action."); }
      else if (cursor.accept("NO")) cursor.expect("ACTION");
      else if (!cursor.accept("CASCADE") && !cursor.accept("RESTRICT")) cursor.fail("Unsupported foreign-key action.");
    }
  }
  return { columns: localColumns, referencedTable, referencedColumns };
}

function dataType(cursor: TokenCursor, dialect: SqlDialect, sql: string): string {
  const start = cursor.peek()?.start;
  if (start === undefined) cursor.fail("A declared column type is required.");
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
    if (cursor.accept("WITH") || cursor.accept("WITHOUT")) { cursor.expect("TIME"); cursor.expect("ZONE"); }
  }
  if (dialect === "MySQL") { cursor.accept("UNSIGNED"); cursor.accept("ZEROFILL"); }
  if (dialect === "PostgreSQL") while (cursor.accept("[")) { if (cursor.peek()?.kind === "number") cursor.take(); cursor.expect("]"); }
  const end = cursor.tokens[cursor.index - 1].end;
  return sql.slice(start, end).trim();
}

function parseDefinition(tokens: SqlToken[], table: SqlTable, dialect: SqlDialect, sql: string): void {
  const cursor = new TokenCursor(tokens);
  if (cursor.accept("CONSTRAINT")) name(cursor, dialect);
  if (cursor.accept("PRIMARY")) {
    cursor.expect("KEY"); if (dialect === "SQL Server") { cursor.accept("CLUSTERED"); cursor.accept("NONCLUSTERED"); }
    if (table.primaryKeys.length) cursor.fail("A table may declare only one primary key.");
    table.primaryKeys = columns(cursor, dialect);
  } else if (cursor.accept("FOREIGN")) {
    cursor.expect("KEY"); const localColumns = columns(cursor, dialect);
    table.foreignKeys.push(reference(cursor, dialect, localColumns));
  } else if (cursor.accept("UNIQUE")) {
    columns(cursor, dialect); // Valid constraint, not represented as an ER relationship.
  } else if (cursor.accept("CHECK")) {
    parenthesized(cursor); // Checked by the selected parser below.
  } else {
    const columnName = name(cursor, dialect);
    if (table.columns.some(column => key(column.name, dialect) === key(columnName, dialect))) cursor.fail("Duplicate column identifiers in CREATE TABLE.");
    const declaredType = dataType(cursor, dialect, sql);
    const column = { name: columnName, dataType: declaredType, primaryKey: false, nullable: true };
    let explicitNullability = false, hasDefault = false, hasReference = false, primary = false;
    while (cursor.peek()) {
      if (cursor.accept("CONSTRAINT")) { name(cursor, dialect); continue; }
      if (cursor.accept("PRIMARY")) {
        cursor.expect("KEY"); if (primary || table.primaryKeys.length) cursor.fail("A table may declare only one primary key.");
        primary = true; table.primaryKeys = [columnName]; column.primaryKey = true;
      } else if (cursor.accept("NOT")) {
        cursor.expect("NULL"); if (explicitNullability) cursor.fail("Duplicate column nullability declaration."); explicitNullability = true; column.nullable = false;
      } else if (cursor.accept("NULL")) {
        if (explicitNullability) cursor.fail("Duplicate column nullability declaration."); explicitNullability = true; column.nullable = true;
      } else if (cursor.is("REFERENCES")) {
        if (hasReference) cursor.fail("Duplicate inline foreign-key declaration."); hasReference = true;
        table.foreignKeys.push(reference(cursor, dialect, [columnName]));
      } else if (cursor.accept("DEFAULT")) {
        if (hasDefault) cursor.fail("Duplicate column DEFAULT declaration."); hasDefault = true;
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
        // A uniqueness constraint does not imply a primary or foreign key.
      } else if (cursor.accept("CHECK")) parenthesized(cursor);
      else if (cursor.accept("COLLATE")) qualified(cursor, dialect);
      else if (cursor.accept("AUTO_INCREMENT")) { if (dialect !== "MySQL") cursor.fail("AUTO_INCREMENT is supported only for MySQL."); }
      else if (cursor.accept("AUTOINCREMENT")) { if (dialect !== "SQLite" || !primary || declaredType.toUpperCase() !== "INTEGER") cursor.fail("SQLite AUTOINCREMENT requires an INTEGER PRIMARY KEY."); }
      else if (cursor.accept("IDENTITY")) { if (dialect !== "SQL Server") cursor.fail("IDENTITY is supported only for SQL Server."); if (cursor.is("(")) parenthesized(cursor); }
      else cursor.fail("Unsupported column constraint or definition; no schema details were discarded.");
    }
    table.columns.push(column);
  }
  if (cursor.peek()) cursor.fail("Unsupported table constraint options; no schema details were discarded.");
}

/** Small exact CREATE TABLE grammar supplements the SQL Server library's broken REFERENCES grammar. */
export async function parseDdl(sql: string, dialect: SqlDialect): Promise<SqlSchema> {
  dialect = readDialect(dialect);
  const tokens = significantTokens(lexSql(sql, dialect)), cursor = new TokenCursor(tokens);
  const tables: SqlTable[] = []; let totalColumns = 0, totalRelationships = 0;
  const serverValidationTokens: SqlToken[] = [];
  while (cursor.peek()) {
    const tableStart = cursor.index;
    cursor.expect("CREATE");
    if (cursor.accept("TEMP") || cursor.accept("TEMPORARY")) { if (dialect === "SQL Server") cursor.fail("SQL Server temporary tables use a # table name."); }
    cursor.expect("TABLE");
    if (cursor.accept("IF")) { if (dialect === "SQL Server") cursor.fail("IF NOT EXISTS is unsupported for SQL Server CREATE TABLE."); cursor.expect("NOT"); cursor.expect("EXISTS"); }
    const table: SqlTable = { name: qualified(cursor, dialect), columns: [], primaryKeys: [], foreignKeys: [] };
    if (tables.some(existing => key(existing.name, dialect) === key(table.name, dialect))) cursor.fail("Duplicate CREATE TABLE identifiers.");
    cursor.expect("("); const openIndex = cursor.index - 1; const definitions: SqlToken[][] = []; let segment: SqlToken[] = [], depth = 0;
    while (cursor.peek() && !(cursor.is(")") && depth === 0)) {
      const token = cursor.take();
      if (token.text === "," && depth === 0) {
        if (!segment.length) cursor.fail("Empty CREATE TABLE definition."); definitions.push(segment); segment = [];
      } else {
        if (token.text === "(") depth++; else if (token.text === ")") depth--;
        segment.push(token);
      }
    }
    if (!segment.length) cursor.fail("CREATE TABLE needs nonempty named columns and no trailing comma."); definitions.push(segment);
    cursor.expect(")"); const closeIndex = cursor.index - 1;
    for (const definition of definitions) parseDefinition(definition, table, dialect, sql);
    if (!table.columns.length) cursor.fail("CREATE TABLE needs at least one named column.");
    const local = new Set(table.columns.map(column => key(column.name, dialect)));
    for (const primaryKey of table.primaryKeys) if (!local.has(key(primaryKey, dialect))) cursor.fail("A primary-key column is not declared in its table.");
    for (const foreignKey of table.foreignKeys) for (const column of foreignKey.columns) if (!local.has(key(column, dialect))) cursor.fail("A foreign-key column is not declared in its table.");
    for (const column of table.columns) {
      column.primaryKey = table.primaryKeys.some(primaryKey => key(primaryKey, dialect) === key(column.name, dialect));
      // SQLite permits NULL in some non-INTEGER primary keys; retain its declared nullability.
      if (column.primaryKey && (dialect !== "SQLite" || (table.primaryKeys.length === 1 && column.dataType.toUpperCase() === "INTEGER"))) column.nullable = false;
    }
    tables.push(table); totalColumns += table.columns.length; totalRelationships += table.foreignKeys.length;
    if (tables.length > 50 || totalColumns > 500 || totalRelationships > 200) cursor.fail("DDL is limited to 50 tables, 500 columns and 200 foreign-key relationships.");
    if (cursor.peek() && !cursor.accept(";")) cursor.fail("Only CREATE TABLE statements are supported; table options, ALTER and other statements are unsupported.");
    if (dialect === "SQL Server") {
      // Validate all other grammar with the real selected engine after removing only
      // already-validated REFERENCES clauses, which node-sql-parser 5.4.0 cannot parse.
      serverValidationTokens.push(...tokens.slice(tableStart, openIndex + 1));
      const retained: SqlToken[][] = [];
      for (const definition of definitions) {
        let start = 0;
        if (definition[0]?.text.toUpperCase() === "CONSTRAINT") start = 2;
        if (definition[start]?.text.toUpperCase() === "FOREIGN") continue;
        const referenceIndex = definition.findIndex(token => token.kind === "word" && token.text.toUpperCase() === "REFERENCES");
        if (referenceIndex < 0) retained.push(definition);
        else {
          const refCursor = new TokenCursor(definition); refCursor.index = referenceIndex;
          reference(refCursor, dialect, ["column"]);
          const refStart = definition[referenceIndex - 2]?.text.toUpperCase() === "CONSTRAINT" ? referenceIndex - 2 : referenceIndex;
          retained.push([...definition.slice(0, refStart), ...definition.slice(refCursor.index)]);
        }
      }
      retained.forEach((definition, index) => { if (index) serverValidationTokens.push({ ...tokens[openIndex], text: "," }); serverValidationTokens.push(...definition); });
      serverValidationTokens.push(tokens[closeIndex], { ...tokens[closeIndex], text: ";" });
    }
  }
  // The native subset parser above rejects unsupported definitions rather than ignoring
  // them. The dialect library additionally checks DEFAULT/CHECK expression grammar.
  await parseSql(dialect === "SQL Server" ? serverValidationTokens.map(token => token.text).join(" ") : sql, dialect);
  const relationships = tables.flatMap(table => table.foreignKeys.map(foreignKey => ({ fromTable: table.name, fromColumns: foreignKey.columns, toTable: foreignKey.referencedTable, toColumns: foreignKey.referencedColumns })));
  for (const relationship of relationships) {
    const target = tables.find(table => key(table.name, dialect) === key(relationship.toTable, dialect));
    if (target && relationship.toColumns.some(column => !target.columns.some(candidate => key(candidate.name, dialect) === key(column, dialect)))) throw new SqlSyntaxError("A foreign key references a missing column in a locally declared table.");
    if (target) relationship.toTable = target.name;
  }
  return { tables, relationships };
}

export async function ddlOutput(sql: string, dialect: SqlDialect): Promise<SqlResult> {
  const schema = await parseDdl(sql, dialect);
  const columns = schema.tables.flatMap(table => table.columns.map(column => `${table.name}.${column.name}: ${column.dataType}${column.primaryKey ? " [PK]" : ""}${column.nullable === false ? " NOT NULL" : ""}`));
  const primaryKeys = schema.tables.filter(table => table.primaryKeys.length).map(table => `${table.name}: (${table.primaryKeys.join(", ")})`);
  const relationships = schema.relationships.map(link => `${link.fromTable} (${link.fromColumns.join(", ")}) → ${link.toTable} (${link.toColumns.join(", ")})`);
  return { schema, rows: [
    { label: "Entity relationship diagram", value: [`Tables: ${schema.tables.map(table => table.name).join(", ")}`, ...relationships].join("\n") },
    { label: "Parsed tables", value: schema.tables.map(table => table.name).join("\n") },
    { label: "Columns", value: columns.join("\n") },
    { label: "Primary keys", value: primaryKeys.join("\n") || "None declared" },
    { label: "Foreign-key relationships", value: relationships.join("\n") || "None declared" },
  ], warnings: ["Relationships come only from explicitly declared foreign keys. External referenced tables are retained. This does not verify database objects or referential integrity."] };
}
