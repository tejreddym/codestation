import { runBuilder } from "./builders";
import { runConnection } from "./connections";
import { readDialect, sqlText } from "./literals";
import type { SqlResult, SqlValues } from "./types";

export async function runSql(toolId: string, values: SqlValues): Promise<SqlResult> {
  let result: SqlResult;
  if (toolId === "database-connection-string-builder" || toolId === "database-connection-string-parser") {
    result = runConnection(toolId, values);
  } else if (["sql-formatter", "sql-minifier", "sql-validator", "sql-to-json", "sql-to-csv", "sql-to-markdown", "er-diagram-generator"].includes(toolId)) {
    const dialect = readDialect(values.dialect);
    const sql = sqlText(values.sql, "SQL");
    if (toolId === "er-diagram-generator") {
      const { ddlOutput } = await import("./ddl"); result = await ddlOutput(sql, dialect);
    } else {
      const { formatSqlTool, minifySqlTool, validateSqlTool, insertOutput } = await import("./transforms");
      result = toolId === "sql-formatter" ? await formatSqlTool(sql, dialect)
        : toolId === "sql-minifier" ? await minifySqlTool(sql, dialect)
        : toolId === "sql-validator" ? await validateSqlTool(sql, dialect)
        : await insertOutput(toolId, sql, dialect);
    }
  } else result = await runBuilder(toolId, values);
  if (JSON.stringify(result).length > 2_000_000) throw new Error("The complete result exceeds the 2,000,000-character output budget. Use a smaller input.");
  return result;
}
