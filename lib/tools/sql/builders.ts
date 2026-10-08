import { CONDITION_OPERATORS, type SqlCondition, type SqlDialect, type SqlLiteral, type SqlResult, type SqlValues } from "./types";
import { jsonLiteral, quoteIdentifier, readDialect, sqlLiteral, sqlText } from "./literals";
import { parseCsv } from "../json-data/csv";
import { jsonObjectKeys, parseJson } from "../json-data/json";

function list(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a structured list.`);
  if (value.length > maximum) throw new Error(`${label} exceeds the ${maximum}-item limit.`);
  return value;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function identifiers(value: unknown, dialect: SqlDialect, label = "Columns", allowEmpty = false): string[] {
  const names = list(value, label, 100).map(name => sqlText(name, label));
  if (!allowEmpty && !names.length) throw new Error(`${label} must contain at least one column.`);
  names.forEach(name => quoteIdentifier(name, dialect));
   if (new Set(names.map(name => dialect === "PostgreSQL" ? name : name.toLocaleLowerCase("en-US"))).size !== names.length) throw new Error(`${label} cannot contain duplicate column names.`);
  return names;
}

function result(label: string, value: string, warnings?: string[]): SqlResult {
  if (value.length > 2_000_000) throw new Error("Generated SQL exceeds the 2,000,000-character output limit.");
  return { rows: [{ label, value }], ...(warnings?.length ? { warnings } : {}) };
}

export function buildConditions(value: unknown, dialect: SqlDialect, logicalOperator: "AND" | "OR" = "AND"): string {
  if (logicalOperator !== "AND" && logicalOperator !== "OR") throw new Error("Logical operator must be AND or OR.");
  let outputLength = 0;
  const checkedLiteral = (literal: SqlLiteral): string => {
    const output = sqlLiteral(literal, dialect);
    outputLength += output.length;
    if (outputLength > 2_000_000) throw new Error("Generated SQL exceeds the 2,000,000-character output limit.");
    return output;
  };
  return list(value, "Conditions", 100).map((item, index) => {
    const condition = record(item, `Condition ${index + 1}`);
    const column = quoteIdentifier(sqlText(condition.column, "Condition column"), dialect);
    const operator = condition.operator;
    if (typeof operator !== "string" || !CONDITION_OPERATORS.includes(operator as SqlCondition["operator"])) throw new Error("Choose a supported condition operator.");
    const values = list(condition.values, "Condition values", 100);
    if (operator === "IS NULL" || operator === "IS NOT NULL") {
      if (values.length) throw new Error(`${operator} must have no values.`);
      return `${column} ${operator}`;
    }
    const multiple = operator === "IN" || operator === "NOT IN";
    if (!values.length || (!multiple && values.length !== 1)) throw new Error(multiple ? `${operator} requires at least one value.` : `${operator} requires exactly one value.`);
    const literals = values.map(item => {
      const literal = record(item, "Condition value") as unknown as SqlLiteral;
      if (literal.type === "NULL") throw new Error("Use IS NULL or IS NOT NULL to compare NULL values.");
      if ((operator === "LIKE" || operator === "NOT LIKE") && literal.type !== "String") throw new Error("LIKE and NOT LIKE require a String value.");
      return checkedLiteral(literal);
    });
    return `${column} ${operator} ${multiple ? `(${literals.join(", ")})` : literals[0]}`;
  }).join(` ${logicalOperator} `);
}

function insert(table: string, columns: string[], rows: string[][], dialect: SqlDialect): string {
  if (!rows.length) throw new Error("No rows. Provide at least one data row.");
  if (rows.length > 1_000) throw new Error("Rows exceed the 1,000-row limit.");
  return `INSERT INTO ${table} (${columns.map(column => quoteIdentifier(column, dialect)).join(", ")})\nVALUES\n${rows.map(row => {
    if (row.length !== columns.length) throw new Error("Every row must have exactly one value per column.");
    return `  (${row.join(", ")})`;
  }).join(",\n")};`;
}

export async function runBuilder(toolId: string, values: SqlValues): Promise<SqlResult> {
  const dialect = readDialect(values.dialect);
  let outputLength = 0;
  const checkedLiteral = (literal: SqlLiteral): string => {
    const output = sqlLiteral(literal, dialect);
    outputLength += output.length;
    if (outputLength > 2_000_000) throw new Error("Generated SQL exceeds the 2,000,000-character output limit.");
    return output;
  };
  if (toolId === "sql-escape-helper") {
    return result("Escaped SQL literal", sqlLiteral({ type: values.valueType as SqlLiteral["type"], value: sqlText(values.value, "Value") }, dialect));
  }
  if (toolId === "sql-where-builder") {
    const logicalOperator = values.logicalOperator;
    if (logicalOperator !== "AND" && logicalOperator !== "OR") throw new Error("Logical operator must be AND or OR.");
    const conditions = buildConditions(values.conditions, dialect, logicalOperator);
    if (!conditions) throw new Error("Provide at least one condition.");
    return result("SQL WHERE clause", `WHERE ${conditions}`);
  }
  const table = quoteIdentifier(sqlText(values.table, "Table"), dialect, true);
  if (toolId === "json-to-sql") {
    const parsed = parseJson(sqlText(values.json, "JSON"));
    const rows = list(parsed, "JSON rows", 1_000);
    if (!rows.length) throw new Error("No rows. Provide a nonempty JSON array of objects.");
    const objects = rows.map((row, index) => record(row, `JSON row ${index + 1}`));
    const columns = identifiers(jsonObjectKeys(objects[0]), dialect);
    const keys = new Set(columns);
    const literals = objects.map((object, index) => {
      const rowKeys = jsonObjectKeys(object);
      if (rowKeys.length !== columns.length || rowKeys.some(key => !keys.has(key))) throw new Error(`JSON row ${index + 1} must have exactly the same keys as the first row.`);
      return columns.map(column => jsonLiteral(object[column], dialect));
    });
    return result("SQL INSERT statements", insert(table, columns, literals, dialect));
  }
  if (toolId === "csv-to-sql") {
    const csv = sqlText(values.csv, "CSV").replace(/^\uFEFF/, "");
    const records = parseCsv(csv);
    const columns = identifiers(records[0], dialect, "CSV headers");
    if (records.length > 1_001) throw new Error("CSV data exceeds the 1,000-row limit.");
    return result("SQL INSERT statements", insert(table, columns, records.slice(1).map(row => row.map(value => sqlLiteral({ type: "String", value }, dialect))), dialect));
  }
  if (toolId === "sql-insert-generator") {
    const columns = identifiers(values.columns, dialect);
    const rows = list(values.rows, "Rows", 1_000).map(row => {
      const cells = list(row, "Row values", 100);
      if (cells.length !== columns.length) throw new Error("Every row must have exactly one value per column.");
      return cells.map(cell => checkedLiteral(record(cell, "Row value") as unknown as SqlLiteral));
    });
    return result("SQL INSERT statement", insert(table, columns, rows, dialect));
  }
  const conditions = buildConditions(values.conditions, dialect);
  const where = conditions ? `\nWHERE ${conditions}` : "";
  if (toolId === "sql-update-generator") {
    const assignments = list(values.assignments, "Assignments", 100).map(item => record(item, "Assignment"));
    const columns = identifiers(assignments.map(item => item.column), dialect, "Assignment columns");
    const set = assignments.map((item, index) => `${quoteIdentifier(columns[index], dialect)} = ${checkedLiteral(record(item.value, "Assignment value") as unknown as SqlLiteral)}`).join(",\n  ");
    return result("SQL UPDATE statement", `UPDATE ${table}\nSET ${set}${where};`, conditions ? undefined : ["This UPDATE has no WHERE clause and may affect every row."]);
  }
  if (toolId === "sql-delete-generator") {
    return result("SQL DELETE statement", `DELETE FROM ${table}${where};`, conditions ? undefined : ["This DELETE has no WHERE clause and may delete every row."]);
  }
  if (toolId === "sql-select-builder") {
    const columns = identifiers(values.columns, dialect, "Columns", true);
    const orders = list(values.orderBy, "ORDER BY", 100).map(item => record(item, "Order"));
    identifiers(orders.map(order => order.column), dialect, "ORDER BY columns", true);
    const orderSql = orders.map(order => {
      if (order.direction !== "ASC" && order.direction !== "DESC") throw new Error("ORDER BY direction must be ASC or DESC.");
      return `${quoteIdentifier(sqlText(order.column, "ORDER BY column"), dialect)} ${order.direction}`;
    });
    const limit = values.limit === undefined ? "" : sqlText(values.limit, "Limit");
    if (limit && (!/^[1-9]\d{0,6}$/.test(limit) || Number(limit) > 1_000_000)) throw new Error("Limit must be a positive integer from 1 to 1,000,000.");
    const top = limit && dialect === "SQL Server" ? ` TOP (${limit})` : "";
    const tail = limit && dialect !== "SQL Server" ? `\nLIMIT ${limit}` : "";
    return result("SQL SELECT statement", `SELECT${top} ${columns.length ? columns.map(column => quoteIdentifier(column, dialect)).join(", ") : "*"}\nFROM ${table}${where}${orderSql.length ? `\nORDER BY ${orderSql.join(", ")}` : ""}${tail};`);
  }
  throw new Error("Unsupported SQL builder.");
}
