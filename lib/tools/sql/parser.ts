import type { AST } from "node-sql-parser";
import { lexSql, SqlSyntaxError } from "./lexer";
import { readDialect } from "./literals";
import type { SqlDialect } from "./types";

export { SqlSyntaxError } from "./lexer";
export type { AST } from "node-sql-parser";

const engines = {
  PostgreSQL: () => import("node-sql-parser/build/postgresql"),
  MySQL: () => import("node-sql-parser/build/mysql"),
  SQLite: () => import("node-sql-parser/build/sqlite"),
  "SQL Server": () => import("node-sql-parser/build/transactsql"),
};

export async function parseSql(sql: string, dialect: SqlDialect): Promise<AST[]> {
  dialect = readDialect(dialect);
  lexSql(sql, dialect);
  const parserModule = await engines[dialect]();
  try {
    const exported = parserModule as unknown as { Parser?: typeof import("node-sql-parser").Parser; default?: { Parser?: typeof import("node-sql-parser").Parser } };
    const Parser = exported.Parser ?? exported.default?.Parser;
    if (!Parser) throw new SqlSyntaxError("The local dialect parser could not initialize.");
    const ast = new Parser().astify(sql);
    const statements = Array.isArray(ast) ? ast : [ast];
    if (!statements.length || statements.length > 200) throw new SqlSyntaxError("SQL must contain between 1 and 200 statements.");
    // The Transact-SQL engine can interpret malformed queries (e.g. SELECT FROM)
    // as a bare variable/function assignment wrapper, rather than a SQL statement.
    if (statements.some(statement => typeof (statement as unknown as { type?: unknown }).type !== "string")) throw new SqlSyntaxError("The selected parser returned an unsupported statement form.");
    if (dialect === "SQL Server") {
      const pending: unknown[] = [...statements];
      while (pending.length) {
        const value = pending.pop();
        if (!value || typeof value !== "object") continue;
        const record = value as Record<string, unknown>;
        if (record.type === "select" && record.limit) throw new SqlSyntaxError("LIMIT is unsupported for SQL Server; use its native TOP or OFFSET/FETCH syntax.");
        pending.push(...Object.values(record).filter(child => child && typeof child === "object"));
      }
    }
    return statements;
  } catch (error) {
    if (error instanceof SqlSyntaxError) throw error;
    const location = (error as { location?: { start?: { line?: unknown; column?: unknown } } })?.location?.start;
    const safeLocation = typeof location?.line === "number" && typeof location.column === "number" ? { line: location.line, column: location.column } : undefined;
    throw new SqlSyntaxError(`SQL is invalid or unsupported by the ${dialect} parser's supported syntax subset.`, safeLocation);
  }
}
