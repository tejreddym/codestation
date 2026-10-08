import { describe, expect, it } from "vitest";
import { sqlTools } from "@/config/sql-tools";
import { runSql } from "./engine";
import { readDialect, quoteIdentifier, sqlLiteral } from "./literals";
import { parseInsertData, formatSqlTool, minifySqlTool } from "./transforms";
import { parseDdl } from "./ddl";
import { SQL_DIALECTS, CONDITION_OPERATORS, type SqlDialect, type SqlValues } from "./types";
const number = (value: string) => ({ type: "Number", value });
const string = (value: string) => ({ type: "String", value });
const condition = (operator = "=", values: unknown[] = [number("1")]) => ({ column: "id", operator, values });
const value = async (id: string, values: SqlValues) => (await runSql(id, values)).rows[0].value;

describe.each(SQL_DIALECTS)("SQL public examples in %s", dialect => {
  it.each(sqlTools)("$id exact output contract and no input mutation", async tool => {
    const values = structuredClone({ ...tool.sqlContract.defaults, ...tool.sqlContract.example, ...(tool.sqlContract.fields.some(field => field.name === "dialect") ? { dialect } : {}) });
    const before = structuredClone(values); const result = await runSql(tool.id, values); expect(result.rows.map(row => row.label)).toEqual(tool.sqlContract.outputs); expect(values).toEqual(before);
  });
});

describe("bounded inputs and invalid contracts", () => {
  it.each(sqlTools)("$id processes a Unicode example", async tool => {
    const text = "Café తెలుగు हिन्दी 👩‍💻 中文 العربية";
    const values = structuredClone({ ...tool.sqlContract.defaults, ...tool.sqlContract.example });
    if (tool.id === "er-diagram-generator") values.sql = 'CREATE TABLE "తెలుగు" (id INTEGER PRIMARY KEY, name VARCHAR(100));';
    else if ("sql" in values) values.sql = tool.id.includes("formatter") || tool.id.includes("minifier") || tool.id.includes("validator") ? `SELECT '${text}' AS note;` : `INSERT INTO users(name) VALUES('${text}');`;
    else if ("json" in values) values.json = JSON.stringify([{ name: text }]);
    else if ("csv" in values) values.csv = `name\n${text}`;
    else if ("connectionString" in values) values.connectionString = `postgresql://demo:PUBLIC@host/${encodeURIComponent(text)}`;
    else if ("password" in values) values.password = text;
    else if ("value" in values) values.value = text;
    else if ("rows" in values) values.rows = [[number("1"), string(text)]];
    else if ("assignments" in values) values.assignments = [{ column: "name", value: string(text) }];
    else if ("conditions" in values) values.conditions = [condition("=", [string(text)])];
    expect((await runSql(tool.id, values)).rows.map(row => row.label)).toEqual(tool.sqlContract.outputs);
  });
  it.each(sqlTools)("$id processes a reasonable large example", async tool => {
    const text = "x".repeat(20000); const values = structuredClone({ ...tool.sqlContract.defaults, ...tool.sqlContract.example });
    if (tool.id === "er-diagram-generator") values.sql = Array.from({ length: 10 }, (_, i) => `CREATE TABLE t${i} (${Array.from({ length: 20 }, (_, j) => `c${j} INTEGER`).join(",")});`).join("\n");
    else if ("sql" in values) values.sql = ["sql-formatter", "sql-minifier", "sql-validator"].includes(tool.id) ? `SELECT '${text}' AS note;` : `INSERT INTO users(name) VALUES('${text}');`;
    else if ("json" in values) values.json = JSON.stringify([{ name: text }]);
    else if ("csv" in values) values.csv = `name\n${text}`;
    else if ("connectionString" in values) values.connectionString = `postgresql://demo:${text}@host/demo`;
    else if ("password" in values) values.password = text;
    else if ("value" in values) values.value = text;
    else if ("rows" in values) values.rows = [[number("1"), string(text)]];
    else if ("assignments" in values) values.assignments = [{ column: "name", value: string(text) }];
    else if ("conditions" in values) values.conditions = [condition("=", [string(text)])];
    expect((await runSql(tool.id, values)).rows.map(row => row.label)).toEqual(tool.sqlContract.outputs);
  });
  it.each(sqlTools)("$id handles empty required data explicitly", async tool => {
    const defaults = structuredClone(tool.sqlContract.defaults);
    if (tool.id === "sql-validator") expect((await runSql(tool.id, defaults)).rows[0].value).toBe("Invalid");
    else if (tool.id === "sql-escape-helper") expect(await value(tool.id, defaults)).toBe("''");
    else await expect(runSql(tool.id, defaults)).rejects.toThrow();
  });
  it.each(["Other", "postgres", "", null, 1])("rejects unsupported dialect %s", dialect => expect(() => readDialect(dialect)).toThrow());
  it.each(SQL_DIALECTS)("rejects invalid names, numbers and type markers in %s", dialect => {
    for (const name of ["", "users;DROP", "a b", "a..b", "x'", "1table", "x".repeat(129)]) expect(() => quoteIdentifier(name, dialect, true)).toThrow();
    for (const n of ["NaN", "Infinity", "1;DROP", "1 + 2", "", "1e999", "1e-999"]) expect(() => sqlLiteral(number(n) as never, dialect)).toThrow();
    expect(() => sqlLiteral({ type: "Boolean", value: "yes" }, dialect)).toThrow(); expect(() => sqlLiteral(string("x\0y") as never, dialect)).toThrow();
  });
  it("rejects excessive SQL/depth and unsafe JSON precision without truncation", async () => {
    await expect(runSql("sql-to-json", { sql: "x".repeat(200001), dialect: "PostgreSQL" })).rejects.toThrow(/200,000/);
    await expect(runSql("sql-minifier", { sql: "SELECT " + "(".repeat(129) + "1" + ")".repeat(129), dialect: "PostgreSQL" })).rejects.toThrow(/nesting/);
    for (const json of ['[{"id":9007199254740993}]', '[{"id":0.1234567890123456789}]', '[{"id":1,"id":2}]', '[{"id":{}}]', '[{"id":1},{"other":2}]', '[]', '{}', '[null]', '[1]', 'bad']) await expect(runSql("json-to-sql", { json, table: "users", dialect: "PostgreSQL" })).rejects.toThrow();
  });
  it("preserves case-distinct quoted PostgreSQL columns but rejects default case-insensitive duplicates", async () => {
    const sql = await value("json-to-sql", { json: '[{"name":"a","Name":"b"}]', table: "users", dialect: "PostgreSQL" });
    expect((await parseInsertData(sql, "PostgreSQL")).columns).toEqual(["name", "Name"]);
    await expect(runSql("json-to-sql", { json: '[{"name":"a","Name":"b"}]', table: "users", dialect: "MySQL" })).rejects.toThrow(/duplicate/);
    expect(() => quoteIdentifier("x".repeat(64), "PostgreSQL")).toThrow(/63 UTF-8/); expect(() => quoteIdentifier("x".repeat(65), "MySQL")).toThrow(/64 characters/);
  });
});

describe.each(SQL_DIALECTS)("literal and builder fidelity in %s", dialect => {
  it.each(["O'Reilly", "say \"hello\"", "Café తెలుగు हिन्दी 👩‍💻 中文 العربية", "C:\\folder\\file", "comma,pipe|newline\nnext", "-- DROP; SELECT ' UPDATE", ""])("roundtrips generated literal fixture %#", async text => {
    const sql = await value("sql-insert-generator", { table: "users", columns: ["name"], rows: [[string(text)]], dialect });
    expect((await parseInsertData(sql, dialect)).rows).toEqual([[text]]);
    expect(await value("sql-escape-helper", { value: text, valueType: "String", dialect })).toBe(sqlLiteral(string(text) as never, dialect));
  });
  it("encodes null/boolean/numeric values and qualified identifiers", async () => {
    const sql = await value("json-to-sql", { json: '[{"id":1,"active":true,"name":null},{"name":"x","active":false,"id":2}]', table: "public.users", dialect });
    expect(sql).toContain(quoteIdentifier("public.users", dialect, true)); const parsed = await parseInsertData(sql, dialect);
    expect(parsed.columns).toEqual(["id", "active", "name"]); expect(parsed.rows).toEqual(dialect === "SQL Server" ? [[1, 1, null], [2, 0, "x"]] : [[1, true, null], [2, false, "x"]]);
    expect(await value("sql-escape-helper", { value: "ignored", valueType: "NULL", dialect })).toBe("NULL");
    expect(await value("sql-escape-helper", { value: "123.4500", valueType: "Number", dialect })).toBe("123.4500");
  });
  it("preserves CSV cells as strings including quoted commas/newlines/empty/NULL", async () => {
    const csv = 'name,note\r\n"Tej, R","He said ""hello""\nagain"\r\n,NULL\r\n"",""';
    const sql = await value("csv-to-sql", { csv, table: "users", dialect }); expect((await parseInsertData(sql, dialect)).rows).toEqual([["Tej, R", 'He said "hello"\nagain'], ["", "NULL"], ["", ""]]);
    await expect(runSql("csv-to-sql", { csv: "id,name\n1", table: "users", dialect })).rejects.toThrow(); await expect(runSql("csv-to-sql", { csv: "id,id\n1,2", table: "users", dialect })).rejects.toThrow();
  });
  it("generates explicit all-row warnings without invented conditions", async () => {
    const update = await runSql("sql-update-generator", { table: "users", assignments: [{ column: "name", value: string("O'Reilly") }, { column: "id", value: number("2") }], conditions: [], dialect });
    expect(update.warnings).toContain("This UPDATE has no WHERE clause and may affect every row."); expect(update.rows[0].value).not.toContain("WHERE");
    const deletion = await runSql("sql-delete-generator", { table: "users", conditions: [], dialect }); expect(deletion.warnings).toContain("This DELETE has no WHERE clause and may delete every row.");
    const safe = await runSql("sql-update-generator", { table: "users", assignments: [{ column: "name", value: string("x") }], conditions: [condition()], dialect }); expect(safe.warnings).toBeUndefined(); expect(safe.rows[0].value).toContain("WHERE");
  });
  it("SELECT * and dialect-specific limits use structured conditions/order", async () => {
    const sql = await value("sql-select-builder", { table: "users", columns: [], conditions: [condition(">=", [number("18")])], orderBy: [{ column: "id", direction: "DESC" }], limit: "10", dialect });
    expect(sql).toContain("*"); expect(sql).toContain("DESC"); expect(sql).toContain(dialect === "SQL Server" ? "TOP (10)" : "LIMIT 10");
    for (const limit of ["0", "-1", "1.5", "10;DROP", "1000001"]) await expect(runSql("sql-select-builder", { table: "users", columns: [], conditions: [], orderBy: [], limit, dialect })).rejects.toThrow();
  });
  it.each(CONDITION_OPERATORS)("WHERE operator %s has the correct value cardinality", async operator => {
    const values = operator === "IS NULL" || operator === "IS NOT NULL" ? [] : operator === "IN" || operator === "NOT IN" ? [number("1"), number("2")] : operator === "LIKE" || operator === "NOT LIKE" ? [string("A'%")] : [number("18")];
    const sql = await value("sql-where-builder", { conditions: [condition(operator, values)], logicalOperator: "AND", dialect }); expect(sql).toContain(operator); expect(sql).not.toContain("FROM");
    if (operator.includes("NULL")) expect(sql).not.toContain("'NULL'"); if (operator === "IN" || operator === "NOT IN") expect(sql).toContain("(1, 2)");
  });
  it("AND/OR work and invalid cardinality/options fail", async () => {
    expect(await value("sql-where-builder", { conditions: [condition(), condition(">", [number("2")])], logicalOperator: "OR", dialect })).toContain(" OR ");
    for (const item of [condition("IN", []), condition("=", []), condition("IS NULL", [string("x")]), condition("=", [{ type: "NULL", value: "" }]), condition("unsupported")]) await expect(runSql("sql-where-builder", { conditions: [item], logicalOperator: "AND", dialect })).rejects.toThrow();
    await expect(runSql("sql-update-generator", { table: "users", assignments: [], conditions: [], dialect })).rejects.toThrow();
    await expect(runSql("sql-insert-generator", { table: "users", columns: ["id"], rows: [[number("1"), number("2")]], dialect })).rejects.toThrow();
  });
});

describe("INSERT-only extraction and outputs", () => {
  it.each(SQL_DIALECTS)("extracts single/multiple statements, SQL null and safe numbers in %s", async dialect => {
    const sql = "INSERT INTO users (id,name,note) VALUES (-1, 'O''Reilly', NULL), (2.5, 'Tej', 'x'); INSERT INTO users (id,name,note) VALUES (3,'Alex','y');";
    const result = await value("sql-to-json", { sql, dialect }); expect(JSON.parse(result)).toEqual([{ id: -1, name: "O'Reilly", note: null }, { id: 2.5, name: "Tej", note: "x" }, { id: 3, name: "Alex", note: "y" }]);
  });
  it.each(["SELECT 1;", "UPDATE users SET id=1;", "DELETE FROM users;", "INSERT INTO users VALUES(1);", "INSERT INTO users(id) SELECT 1;", "INSERT INTO users(id) VALUES(DEFAULT);", "INSERT INTO users(id) VALUES(now());", "INSERT INTO users(id) VALUES(1) RETURNING id;", "INSERT INTO users(id,id) VALUES(1,2);", "INSERT INTO users(id) VALUES(9007199254740993);", "INSERT INTO users(id) VALUES(0.1234567890123456789);", "INSERT INTO users(id) VALUES(1); INSERT INTO other(id) VALUES(2);"])("rejects unsupported or lossy conversion %#", sql => expect(parseInsertData(sql, "PostgreSQL")).rejects.toThrow());
  it("decodes PostgreSQL E/dollar/newline literals without losing their value", async () => {
    expect((await parseInsertData("INSERT INTO users(name) VALUES (E'line\\nnext'), ($tag$O'Reilly$tag$), ('a'\n'b');", "PostgreSQL")).rows).toEqual([["line\nnext"], ["O'Reilly"], ["ab"]]);
  });
  it("CSV quotes multiline/commas/quotes and Markdown escapes pipes/backslashes", async () => {
    const sql = "INSERT INTO users (name,note) VALUES ('A,B','O''Reilly'), ('a|b','line\nnext'), ('c\\d',NULL);";
    const csv = await runSql("sql-to-csv", { sql, dialect: "PostgreSQL" }); expect(csv.rows[0].value).toContain('"A,B"'); expect(csv.rows[0].value).toContain('"line\nnext"'); expect(csv.warnings?.join(" ")).toContain("NULL");
    const markdown = await value("sql-to-markdown", { sql, dialect: "PostgreSQL" }); expect(markdown).toContain("a\\|b"); expect(markdown).toContain("c\\\\d"); expect(markdown).toContain("<br>");
  });
});

describe("formatter, minifier and parser validation", () => {
  it.each(SQL_DIALECTS)("formats common DML, JOIN, subquery and CTE forms in %s", async dialect => {
    for (const sql of ["SELECT id,name FROM users WHERE id=1;", "INSERT INTO users(id,name) VALUES(1,'SELECT UPDATE DELETE');", "UPDATE users SET name='x' WHERE id=1;", "DELETE FROM users WHERE id=1;", "SELECT u.id FROM users u JOIN posts p ON u.id=p.user_id;", "SELECT id FROM users WHERE id IN (SELECT user_id FROM posts);", "WITH t AS (SELECT id FROM users) SELECT id FROM t;", "SELECT 'WHERE FROM -- /* comment */' AS note;", "-- public comment\nSELECT 1;"]) {
      const output = await formatSqlTool(sql, dialect); expect(output.rows[0].value.length).toBeGreaterThan(0); if (sql.includes("'SELECT UPDATE DELETE'")) expect(output.rows[0].value).toContain("'SELECT UPDATE DELETE'");
    }
  });
  it.each(SQL_DIALECTS)("minifies without altering quoted content in %s", async dialect => {
    const sql = "SELECT  'not -- a comment; /* keep */' AS note, 1 /* remove */ + 2;"; const output = (await minifySqlTool(sql, dialect)).rows[0].value;
    expect(output).toContain("'not -- a comment; /* keep */'"); expect(output).not.toContain("/* remove */"); expect(output).toContain("1 + 2");
  });
  it("preserves semantic comment hints and PG newline continuation", async () => {
    expect((await minifySqlTool("SELECT /*! STRAIGHT_JOIN */ id FROM users;", "MySQL")).rows[0].value).toContain("/*! STRAIGHT_JOIN */");
    expect((await minifySqlTool("SELECT 'a'\n'b';", "PostgreSQL")).rows[0].value).toContain("'a'\n'b'");
    expect((await formatSqlTool("SELECT 'a'\n'b';", "PostgreSQL")).rows[0].value).toContain("'a'\n'b'");
  });
  it.each(SQL_DIALECTS)("invalid SQL reports sanitized parser locations in %s", async dialect => {
    const result = await runSql("sql-validator", { sql: "SELECT FROM;", dialect }); expect(result.rows[0].value).toBe("Invalid"); expect(result.rows[1].value).not.toContain("Expected"); expect(result.rows[2].value).toMatch(/Line|Unavailable/);
    await expect(runSql("sql-minifier", { sql: "SELECT 'unclosed", dialect })).rejects.toThrow(/Unterminated/);
    await expect(runSql("sql-formatter", { sql: "SELECT FROM;", dialect })).rejects.toThrow();
  });
  it("dialect selection affects parser acceptance and limit syntax", async () => {
    expect((await runSql("sql-validator", { sql: "SELECT 1::integer;", dialect: "PostgreSQL" })).rows[0].value).toBe("Valid");
    expect((await runSql("sql-validator", { sql: "SELECT 1::integer;", dialect: "MySQL" })).rows[0].value).toBe("Invalid");
    expect((await runSql("sql-validator", { sql: "SELECT TOP (1) id FROM users;", dialect: "SQL Server" })).rows[0].value).toBe("Valid");
    expect((await runSql("sql-validator", { sql: "SELECT id FROM users LIMIT 1;", dialect: "SQL Server" })).rows[0].value).toBe("Invalid");
  });
});

describe("ER schema fidelity without inference", () => {
  it.each(SQL_DIALECTS)("parses one/table/composite PK and FK declarations in %s", async dialect => {
    const sql = "CREATE TABLE users (tenant INTEGER, id INTEGER, name VARCHAR(100), PRIMARY KEY (tenant,id)); CREATE TABLE posts (id INTEGER PRIMARY KEY, tenant INTEGER, user_id INTEGER, FOREIGN KEY (tenant,user_id) REFERENCES users(tenant,id));";
    const schema = await parseDdl(sql, dialect); expect(schema.tables).toHaveLength(2); expect(schema.tables[0].primaryKeys).toEqual(["tenant", "id"]); expect(schema.relationships).toEqual([{ fromTable: "posts", fromColumns: ["tenant", "user_id"], toTable: "users", toColumns: ["tenant", "id"] }]);
    const noLinks = await parseDdl("CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER);", dialect); expect(noLinks.relationships).toEqual([]);
  });
  it("retains inline and external references, Unicode names and composite columns", async () => {
    const schema = await parseDdl('CREATE TABLE "తెలుగు" (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES external_table(id));', "PostgreSQL"); expect(schema.tables[0].name).toBe("తెలుగు"); expect(schema.relationships[0].toTable).toBe("external_table");
  });
  it.each(["CREATE TABLE users ();", "CREATE TABLE users (id INTEGER, id INTEGER);", "CREATE TABLE users (id INTEGER, PRIMARY KEY(missing));", "CREATE TABLE users (id INTEGER); ALTER TABLE users ADD x INTEGER;", "CREATE TABLE users (id INTEGER, FOREIGN KEY(id) REFERENCES users(id,x));", "SELECT 1;"])("rejects malformed or unsupported DDL %#", sql => expect(parseDdl(sql, "PostgreSQL")).rejects.toThrow());
  it("rejects missing local target columns and excessive table counts", async () => {
    await expect(parseDdl("CREATE TABLE users (id INTEGER); CREATE TABLE posts (id INTEGER REFERENCES users(missing));", "PostgreSQL")).rejects.toThrow(/missing column/);
    await expect(parseDdl(Array.from({ length: 51 }, (_, i) => `CREATE TABLE t${i}(id INTEGER);`).join("\n"), "PostgreSQL")).rejects.toThrow(/50 tables/);
  });
});

describe("connection representation and credential redaction", () => {
  it.each(["PostgreSQL", "MySQL", "SQL Server"])("builds/parses %s with special characters locally", async databaseType => {
    const input = { databaseType, host: "db.example.com", port: "", database: "demo/名;data", username: "demo@user", password: 'DEMO:p@ss/word;"encoded"', parameters: "sslmode=require\nAccessToken=PUBLIC_TOKEN" };
    const connection = await value("database-connection-string-builder", input); const parsed = await runSql("database-connection-string-parser", { connectionString: connection });
    const rows = Object.fromEntries(parsed.rows.map(row => [row.label, row.value])); expect(rows["Database type"]).toBe(databaseType); expect(rows["Database name"]).toBe(input.database); expect(rows.Username).toBe(input.username); expect(rows["Masked password"]).toBe("••••••••"); expect(rows.Parameters).not.toContain("PUBLIC_TOKEN"); expect(JSON.stringify(parsed)).not.toContain(input.password);
    if (databaseType !== "SQL Server") expect(connection).toContain(encodeURIComponent(input.password)); else expect(connection).toContain('Password="DEMO:p@ss/word;""encoded"""');
  });
  it("masks nested credentials and never reveals password length", async () => {
    const result = await runSql("database-connection-string-parser", { connectionString: "postgresql://demo:PUBLIC_LONG_PASSWORD@db.example.com/demo?note=postgresql%3A%2F%2Fa%3Asecret%40host%2Fx&pwd2=PUBLIC_TOKEN" });
    expect(JSON.stringify(result)).not.toContain("PUBLIC_LONG_PASSWORD"); expect(JSON.stringify(result)).not.toContain("PUBLIC_TOKEN"); expect(JSON.stringify(result)).not.toContain("secret"); expect(result.rows[5].value).toBe("••••••••");
  });
  it.each(["", "not a connection", "postgresql://u:%ZZ@host/db", "postgresql://u:p@host/db#secret", "postgresql://u:p@host/a/b", "mysql://u:p@host:70000/db", 'Data Source="host;Password=PUBLIC";Initial Catalog=demo;', "Data Source=host;Server=other;Database=demo;"])("rejects malformed connections without echoing input %#", connectionString => expect(runSql("database-connection-string-parser", { connectionString })).rejects.toThrow());
  it("rejects unsafe host/port/parameter overrides and supports IPv6", async () => {
    const base = { databaseType: "PostgreSQL", host: "db.example.com", port: "5432", database: "demo", username: "demo", password: "PUBLIC", parameters: "" };
    for (const options of [{ host: "x/?@other" }, { port: "0" }, { port: "65536" }, { parameters: "password=PUBLIC" }, { parameters: "sslmode=require\nsslmode=disable" }]) await expect(runSql("database-connection-string-builder", { ...base, ...options })).rejects.toThrow();
    expect(await value("database-connection-string-builder", { ...base, host: "::1" })).toContain("@[::1]:5432/");
  });
});
