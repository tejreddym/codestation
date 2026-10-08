/** Lightweight contracts only; SQL processing is loaded by the station on action. */
import { SQL_DIALECTS, VALUE_TYPES, type SqlDialect } from "../lib/tools/sql/types";

export const sqlToolIds = ["sql-formatter", "sql-minifier", "sql-validator", "json-to-sql", "sql-to-json", "csv-to-sql", "sql-to-csv", "sql-to-markdown", "sql-insert-generator", "sql-update-generator", "sql-delete-generator", "sql-select-builder", "sql-where-builder", "database-connection-string-builder", "database-connection-string-parser", "er-diagram-generator", "sql-escape-helper"] as const;
export type SqlToolId = typeof sqlToolIds[number];
export type SqlInputField = {
  name: string;
  label: string;
  control: "text" | "textarea" | "select" | "password" | "columns" | "rows" | "assignments" | "conditions" | "order";
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  inputMode?: "numeric";
};
export type SqlToolContract = {
  fields: readonly SqlInputField[];
  defaults: Readonly<Record<string, unknown>>;
  example: Readonly<Record<string, unknown>>;
  action: string;
  outputs: readonly string[];
  outputLabel: string;
  copy: boolean;
  downloadExtension?: "csv";
  notices: readonly string[];
  purpose: string;
  usage: string;
  privacyMessage: string;
};
export type SqlToolDefinition = {
  id: SqlToolId;
  slug: SqlToolId;
  route: string;
  inputType: string;
  outputType: string;
  dialects?: readonly SqlDialect[];
  name: string;
  description: string;
  category: "SQL & Database";
  keywords: readonly string[];
  sqlContract: SqlToolContract;
  relatedTools: readonly SqlToolId[];
  seo: { title: string; description: string };
};

const dialect: SqlInputField = { name: "dialect", label: "SQL dialect", control: "select", options: SQL_DIALECTS };
const table: SqlInputField = { name: "table", label: "Table name", control: "text", placeholder: "users", hint: "A table identifier, optionally qualified by a schema. Identifiers are quoted for the selected dialect." };
const sql = (label = "SQL text"): SqlInputField => ({ name: "sql", label, control: "textarea", placeholder: "SELECT id, name FROM users WHERE id = 1;" });
const columns = (label: string): SqlInputField => ({ name: "columns", label, control: "columns" });
const conditions = (label: string): SqlInputField => ({ name: "conditions", label, control: "conditions", optional: true, hint: "Add typed conditions. Multiple conditions are joined with AND." });
const generatedNotice = "Review generated SQL before use. Prefer prepared statements and parameterized queries for application data. These tools do not execute SQL or connect to a database.";
const parserNotice = "Parsing supports a bounded subset of the selected dialect, not every database-specific extension. Unsupported syntax is rejected rather than executed.";
const insertNotice = "Accepts literal VALUES inserts with explicit columns. Expressions, INSERT SELECT and database lookups are unsupported.";
const privacyMessage = "Processed locally in your browser. Inputs and results are not uploaded or saved by this page.";
const credentialPrivacy = "Generated locally. Credentials are not sent anywhere.";
const selectExample = "SELECT id, name FROM users WHERE id = 1;";
const insertExample = "INSERT INTO users (id, name) VALUES (1, 'Tej'), (2, 'Ada, Lovelace');";
const numberOne = { type: "Number", value: "1" };
const idCondition = { column: "id", operator: "=", values: [numberOne] };

function define(
  id: SqlToolId, name: string, description: string, fields: readonly SqlInputField[],
  action: string, outputs: readonly string[], usage: string, example: Record<string, unknown>,
  notices: readonly string[], relatedTools: readonly SqlToolId[],
  options: { copy?: boolean; downloadExtension?: "csv"; privacyMessage?: string } = {},
): SqlToolDefinition {
  const defaults = Object.fromEntries(fields.map(field => [field.name,
    field.control === "select" ? field.options?.[0] ?? "" :
      ["columns", "rows", "assignments", "conditions", "order"].includes(field.control) ? [] : "",
  ]));
  return {
    id, slug: id, route: `/tools/${id}`, name, description, category: "SQL & Database",
    inputType: fields.map(field => field.label).join(" + "), outputType: outputs.join(" + "),
    ...(fields.some(field => field.name === "dialect") ? { dialects: SQL_DIALECTS } : {}),
    keywords: [...new Set([...name.toLowerCase().split(/[\s-]+/), "sql", "database", "local", "browser"])],
    relatedTools, seo: { title: `${name} — Browser-local SQL Tool`, description },
    sqlContract: {
      fields, defaults, example, action, outputs,
      outputLabel: outputs.length === 1 ? outputs[0] : `${name} results`,
      copy: options.copy ?? true, downloadExtension: options.downloadExtension,
      notices: fields.some(field => field.name === "dialect") ? [...notices, "Literal interpretation assumes PostgreSQL standard_conforming_strings=on, MySQL default backslash escaping with ANSI_QUOTES off, and SQL Server quoted identifiers. Session modes and collations are not inspected."] : notices, purpose: description,
      usage: `${usage} Choose “${action}”.${options.copy === false ? "" : " Copy copies the exact visible result value."} Clear removes all inputs and results and restores initial options.`,
      privacyMessage: options.privacyMessage ?? privacyMessage,
    },
  };
}

export const sqlTools: readonly SqlToolDefinition[] = [
  define("sql-formatter", "SQL Formatter", "Format SQL with readable indentation for an explicitly selected SQL dialect.", [sql(), dialect], "Format", ["Formatted SQL"], "Enter SQL and choose its dialect.", { sql: selectExample, dialect: "PostgreSQL" }, ["Formatting improves layout; it does not validate database objects or execute a query."], ["sql-minifier", "sql-validator", "sql-select-builder"]),
  define("sql-minifier", "SQL Minifier", "Reduce SQL layout whitespace while preserving string literals and token boundaries.", [sql(), dialect], "Minify", ["Minified SQL"], "Enter SQL and select its dialect.", { sql: "SELECT id, name\nFROM users\nWHERE id = 1;", dialect: "PostgreSQL" }, ["Minification changes layout, not database state. Review dialect-specific syntax before use."], ["sql-formatter", "sql-validator", "sql-escape-helper"]),
  define("sql-validator", "SQL Validator", "Check supported SQL syntax and view its validity, syntax error and error location locally.", [sql(), dialect], "Validate", ["Valid/Invalid status", "Syntax error message", "Error location"], "Enter SQL and select the dialect to validate.", { sql: selectExample, dialect: "PostgreSQL" }, [parserNotice, "Syntax validation does not verify tables, columns, permissions, or database state."], ["sql-formatter", "sql-minifier", "sql-select-builder"], { copy: false }),
  define("json-to-sql", "JSON to SQL Insert", "Convert a JSON array of objects into dialect-aware SQL INSERT statements.", [{ name: "json", label: "JSON array of objects", control: "textarea", placeholder: '[{"id":1,"name":"Tej"}]' }, table, dialect], "Convert", ["SQL INSERT statements"], "Enter an array of flat JSON objects, a table name and its SQL dialect.", { json: '[{"id":1,"name":"Tej"},{"id":2,"name":"Ada, Lovelace"}]', table: "users", dialect: "PostgreSQL" }, ["Flat objects with scalar values are supported; nested arrays and objects are rejected.", generatedNotice], ["sql-to-json", "csv-to-sql", "sql-insert-generator"]),
  define("sql-to-json", "SQL Insert to JSON", "Convert supported literal SQL INSERT statements into a JSON array of objects.", [sql("SQL INSERT statements"), dialect], "Convert", ["JSON array of objects"], "Enter literal VALUES inserts with explicit column names and choose their dialect.", { sql: insertExample, dialect: "PostgreSQL" }, [insertNotice, parserNotice], ["json-to-sql", "sql-to-csv", "sql-to-markdown"]),
  define("csv-to-sql", "CSV to SQL Insert", "Convert a CSV header and data rows into dialect-aware SQL INSERT statements.", [{ name: "csv", label: "CSV text", control: "textarea", placeholder: 'id,name\n1,Tej\n2,"Ada, Lovelace"', hint: "The first row supplies column names. CSV values are strings; empty fields remain empty strings." }, table, dialect], "Convert", ["SQL INSERT statements"], "Enter comma-separated CSV with a header, then choose a table and dialect.", { csv: 'id,name\n1,Tej\n2,"Ada, Lovelace"', table: "users", dialect: "PostgreSQL" }, [generatedNotice], ["sql-to-csv", "json-to-sql", "sql-insert-generator"]),
  define("sql-to-csv", "SQL Insert to CSV", "Convert supported literal SQL INSERT statements to CSV text with a header row.", [sql("SQL INSERT statements"), dialect], "Convert", ["CSV text"], "Enter literal VALUES inserts with explicit columns and choose their dialect. Download CSV saves the visible CSV as a local .csv file.", { sql: insertExample, dialect: "PostgreSQL" }, [insertNotice, "CSV is textual: SQL NULL becomes an empty field, so NULL and an empty string cannot be distinguished in the CSV output."], ["csv-to-sql", "sql-to-json", "sql-to-markdown"], { downloadExtension: "csv" }),
  define("sql-to-markdown", "SQL Insert to Markdown Table", "Convert supported literal SQL INSERT statements into a readable Markdown table.", [sql("SQL INSERT statements"), dialect], "Convert", ["Markdown table"], "Enter literal VALUES inserts with explicit columns and choose their dialect.", { sql: insertExample, dialect: "PostgreSQL" }, [insertNotice, "The result is inert Markdown text; it is not rendered as user-provided HTML."], ["sql-to-json", "sql-to-csv", "sql-insert-generator"]),
  define("sql-insert-generator", "SQL INSERT Generator", "Build a SQL INSERT statement from explicit columns and typed row values.", [table, columns("Column names"), { name: "rows", label: "Row values", control: "rows", hint: "Each row must contain one typed value for every column." }, dialect], "Generate", ["SQL INSERT statement"], "Set the table, add columns and enter typed values for each row.", { table: "users", columns: ["id", "name"], rows: [[numberOne, { type: "String", value: "Tej" }]], dialect: "PostgreSQL" }, [generatedNotice], ["sql-update-generator", "json-to-sql", "csv-to-sql"]),
  define("sql-update-generator", "SQL UPDATE Generator", "Build a SQL UPDATE statement with typed assignments and explicit WHERE conditions.", [table, { name: "assignments", label: "Column/value assignments", control: "assignments" }, conditions("WHERE conditions"), dialect], "Generate", ["SQL UPDATE statement"], "Set the table, add typed column assignments and optional AND-joined conditions.", { table: "users", assignments: [{ column: "name", value: { type: "String", value: "Tej" } }], conditions: [idCondition], dialect: "PostgreSQL" }, ["Without WHERE conditions, the generated UPDATE affects all rows. The result displays an all-rows warning.", generatedNotice], ["sql-delete-generator", "sql-insert-generator", "sql-where-builder"]),
  define("sql-delete-generator", "SQL DELETE Generator", "Build a SQL DELETE statement with optional explicit WHERE conditions and an all-rows warning.", [table, conditions("WHERE conditions"), dialect], "Generate", ["SQL DELETE statement"], "Set the table and add optional AND-joined conditions.", { table: "users", conditions: [idCondition], dialect: "PostgreSQL" }, ["Without WHERE conditions, the generated DELETE affects all rows. The result displays an all-rows warning.", generatedNotice], ["sql-update-generator", "sql-select-builder", "sql-where-builder"]),
  define("sql-select-builder", "SQL SELECT Builder", "Build a SQL SELECT statement from columns, typed conditions, ordering and an optional limit.", [table, { ...columns("Selected columns"), optional: true, hint: "No selected columns means SELECT *." }, conditions("WHERE conditions"), { name: "orderBy", label: "ORDER BY", control: "order", optional: true }, { name: "limit", label: "Limit", control: "text", optional: true, inputMode: "numeric", placeholder: "100", hint: "Optional positive integer, 1–1,000,000. SQL Server uses TOP; the other dialects use LIMIT." }, dialect], "Generate", ["SQL SELECT statement"], "Set the table and optional columns, AND-joined conditions, ordering and limit.", { table: "users", columns: ["id", "name"], conditions: [idCondition], orderBy: [{ column: "id", direction: "ASC" }], limit: "100", dialect: "PostgreSQL" }, [generatedNotice], ["sql-where-builder", "sql-formatter", "sql-validator"]),
  define("sql-where-builder", "SQL WHERE Builder", "Build a standalone SQL WHERE clause from typed conditions joined with AND or OR.", [{ ...conditions("Conditions"), optional: false, hint: "Add typed conditions, then select how they are joined." }, { name: "logicalOperator", label: "Logical operator", control: "select", options: ["AND", "OR"] }, dialect], "Generate", ["SQL WHERE clause"], "Add conditions, select AND or OR and choose a SQL dialect.", { conditions: [idCondition], logicalOperator: "AND", dialect: "PostgreSQL" }, [generatedNotice], ["sql-select-builder", "sql-update-generator", "sql-delete-generator"]),
  define("database-connection-string-builder", "Database Connection String Builder", "Build a PostgreSQL, MySQL or SQL Server connection string locally from explicit connection fields.", [
    { name: "databaseType", label: "Database type", control: "select", options: SQL_DIALECTS.filter(value => value !== "SQLite") },
    { name: "host", label: "Host", control: "text", placeholder: "db.example.com" },
    { name: "port", label: "Port", control: "text", optional: true, inputMode: "numeric", placeholder: "5432", hint: "Optional explicit port, 1–65535. Blank uses the database default: PostgreSQL 5432, MySQL 3306 or SQL Server 1433." },
    { name: "database", label: "Database name", control: "text", placeholder: "demo" },
    { name: "username", label: "Username", control: "text", placeholder: "demo_user" },
    { name: "password", label: "Password", control: "password", placeholder: "Your password", hint: "Masked while entering. The generated connection string contains the password; copy only where you intend to use it." },
    { name: "parameters", label: "Parameters", control: "textarea", optional: true, placeholder: "sslmode=require", hint: "Optional key=value parameters, one per line." },
  ], "Generate", ["Connection string"], "Select the database type and enter its connection details. Parameters use one key=value per line. The example uses fictional public demonstration values.", { databaseType: "PostgreSQL", host: "db.example.com", port: "5432", database: "demo", username: "demo_user", password: "PUBLIC_EXAMPLE_ONLY", parameters: "sslmode=require" }, ["This tool only constructs text; it does not test or open a database connection."], ["database-connection-string-parser", "sql-escape-helper", "sql-validator"], { privacyMessage: credentialPrivacy }),
  define("database-connection-string-parser", "Database Connection String Parser", "Inspect supported PostgreSQL, MySQL or SQL Server connection strings while keeping the password masked.", [{ name: "connectionString", label: "Connection string", control: "password", placeholder: "Paste a connection string", hint: "The source stays masked. Supports PostgreSQL/MySQL URIs and SQL Server semicolon-separated connection strings." }], "Parse", ["Database type", "Host", "Port", "Database name", "Username", "Masked password", "Parameters"], "Enter a supported connection string. Parsed passwords remain masked and are never revealed.", { connectionString: "postgresql://demo_user@db.example.com:5432/demo?sslmode=require" }, ["Parsing inspects text only; it does not test credentials or connect to a database."], ["database-connection-string-builder", "sql-validator", "sql-escape-helper"], { copy: false, privacyMessage: credentialPrivacy }),
  define("er-diagram-generator", "ER Diagram Generator", "Generate a local entity relationship diagram from supported CREATE TABLE statements.", [sql("CREATE TABLE SQL"), dialect], "Generate", ["Entity relationship diagram", "Parsed tables", "Columns", "Primary keys", "Foreign-key relationships"], "Enter CREATE TABLE statements with column definitions and key constraints, then choose their dialect.", { sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100));\nCREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, FOREIGN KEY (user_id) REFERENCES users(id));", dialect: "PostgreSQL" }, [parserNotice, "Only tables and relationships declared in the supplied SQL are shown. The diagram does not inspect a live database."], ["sql-validator", "sql-formatter", "sql-select-builder"]),
  define("sql-escape-helper", "SQL Escape Helper", "Escape a typed value as a SQL literal for an explicitly chosen dialect.", [{ name: "value", label: "Value", control: "textarea", placeholder: "O'Reilly", hint: "String values preserve whitespace. Value is ignored and disabled when the value type is NULL." }, { name: "valueType", label: "Value type", control: "select", options: VALUE_TYPES }, dialect], "Escape", ["Escaped SQL literal"], "Enter a value, choose String, Number, Boolean or NULL and select the dialect.", { value: "O'Reilly", valueType: "String", dialect: "PostgreSQL" }, ["Escaping values is not a substitute for parameterized queries."], ["sql-insert-generator", "sql-where-builder", "sql-update-generator"]),
];

export function isSqlToolId(id: string): id is SqlToolId { return sqlTools.some(tool => tool.id === id); }
export function getSqlDefinition(idOrSlug: string): SqlToolDefinition | undefined { return sqlTools.find(tool => tool.id === idOrSlug || tool.slug === idOrSlug); }
