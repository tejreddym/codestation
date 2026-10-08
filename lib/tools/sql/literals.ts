import { SQL_DIALECTS, VALUE_TYPES, type SqlDialect, type SqlLiteral } from "./types";

export const SQL_TEXT_LIMIT = 200_000;

export function readDialect(value: unknown): SqlDialect {
  if (typeof value !== "string" || !SQL_DIALECTS.includes(value as SqlDialect)) {
    throw new Error("Choose PostgreSQL, MySQL, SQLite, or SQL Server.");
  }
  return value as SqlDialect;
}

export function sqlText(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  if (value.length > SQL_TEXT_LIMIT) throw new Error(`${label} exceeds the 200,000-character limit.`);
  return value;
}

/** Accept raw names only. Quoting is always provided by the chosen dialect. */
export function quoteIdentifier(name: string, dialect: SqlDialect, qualified = false): string {
  readDialect(dialect);
  if (typeof name !== "string") throw new Error("Identifiers must be text.");
  const parts = qualified ? name.split(".") : [name];
  const maximumParts = dialect === "SQL Server" ? 4 : dialect === "PostgreSQL" ? 3 : 2;
  if (parts.some(part => dialect === "PostgreSQL" ? new TextEncoder().encode(part).length > 63 : dialect === "MySQL" ? [...part].length > 64 : part.length > 128)) {
    throw new Error("Identifiers exceed the supported length: PostgreSQL 63 UTF-8 bytes, MySQL 64 characters, SQLite/SQL Server 128 UTF-16 units.");
  }
  if (parts.length > maximumParts || parts.some(part => part.length > 128 || !/^[\p{L}_][\p{L}\p{M}\p{N}_$]*$/u.test(part))) {
    throw new Error(`Use raw identifiers of 1–128 characters: start with a letter or underscore, then letters, marks, numbers, underscore, or $. This dialect allows at most ${maximumParts} table qualification parts.`);
  }
  return parts.map(part => dialect === "MySQL" ? `\`${part}\`` : dialect === "SQL Server" ? `[${part}]` : `"${part}"`).join(".");
}

function stringLiteral(value: string, dialect: SqlDialect): string {
  if (value.includes("\0")) throw new Error("SQL strings cannot contain a NUL character.");
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
    throw new Error("SQL strings must contain valid Unicode, without unpaired surrogates.");
  }
  let escaped = value;
  // MySQL's default backslash escape mode; other dialects use ordinary quoted strings.
  if (dialect === "MySQL") escaped = escaped.replace(/\\/g, "\\\\").replace(/\x1a/g, "\\Z");
  escaped = escaped.replace(/'/g, "''");
  return `${dialect === "SQL Server" ? "N" : ""}'${escaped}'`;
}

export function sqlLiteral(literal: SqlLiteral, dialect: SqlDialect): string {
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
    return dialect === "SQL Server" ? (truth ? "1" : "0") : (truth ? "TRUE" : "FALSE");
  }
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new Error("Number values must be finite decimal numbers, with an optional exponent and no SQL expressions.");
  }
  if (Number(value) === 0 && /[1-9]/.test(value.split(/[eE]/)[0])) throw new Error("Number is too small to represent as a finite nonzero number.");
  // Keep the supplied decimal token; never round it through a JavaScript number.
  return value;
}

export function jsonLiteral(value: unknown, dialect: SqlDialect): string {
  if (value === null) return sqlLiteral({ type: "NULL", value: "" }, dialect);
  if (typeof value === "string") return sqlLiteral({ type: "String", value }, dialect);
  if (typeof value === "boolean") return sqlLiteral({ type: "Boolean", value: String(value) }, dialect);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new Error("JSON numbers must be finite and integers must be safe; quote precision-sensitive numbers as strings.");
    }
    return sqlLiteral({ type: "Number", value: String(value) }, dialect);
  }
  throw new Error("JSON SQL values must be strings, numbers, booleans, or null; nested arrays and objects are unsupported.");
}
