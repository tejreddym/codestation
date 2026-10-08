import type { SqlResult, SqlValues } from "./types";

const parserTools = new Set(["sql-formatter", "sql-minifier", "sql-validator", "sql-to-json", "sql-to-csv", "sql-to-markdown", "er-diagram-generator"]);
export async function runSqlTool(toolId: string, values: SqlValues, signal?: AbortSignal): Promise<SqlResult> {
  if (signal?.aborted) throw new Error("SQL processing cancelled.");
  let size = 0, nodes = 0;
  function inspect(value: unknown, depth = 0): void {
    if (++nodes > 25_000 || depth > 16) throw new Error("Structured input exceeds the 25,000-node or 16-level limit.");
    if (typeof value === "string") {
      if (value.length > 200_000) throw new Error("Each input is limited to 200,000 UTF-16 code units.");
      size += value.length;
      if (size > 1_000_000) throw new Error("Combined inputs exceed the 1,000,000-character limit.");
    } else if (Array.isArray(value)) for (const entry of value) inspect(entry, depth + 1);
    else if (value && typeof value === "object") for (const entry of Object.values(value)) inspect(entry, depth + 1);
  }
  inspect(values);
  const mandatory = parserTools.has(toolId);
  const offload = mandatory || size > 16_384 || nodes > 1000;
  if (!offload) {
    const { runSql } = await import("./engine");
    if (signal?.aborted) throw new Error("SQL processing cancelled.");
    return runSql(toolId, values);
  }
  if (typeof Worker === "undefined") throw new Error("This SQL operation requires local Web Worker support. Enable workers or use a supported browser; no server processing is used.");
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("../../../workers/sql.worker.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("Could not start the local SQL worker. Check browser worker permissions.")); return; }
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new Error("SQL processing cancelled.")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("SQL processing exceeded 15 seconds. No partial result was returned.")); }, 15_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: SqlResult; error?: string }>) => {
      cleanup(); if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("Local SQL processing returned no result."));
    };
    worker.onerror = () => { cleanup(); reject(new Error("Local SQL processing failed. Check permissions and reload the page.")); };
    try { worker.postMessage({ toolId, values }); }
    catch { cleanup(); reject(new Error("Could not send input to the local SQL worker.")); }
  });
}
