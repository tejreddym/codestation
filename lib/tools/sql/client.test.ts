import { afterEach, describe, expect, it, vi } from "vitest";
import { runSqlTool } from "./client";
class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor(public url: URL) { FakeWorker.last = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("SQL isolation and resource lifecycle", () => {
  it("permits small local escaping but never main-thread parser fallback", async () => {
    vi.stubGlobal("Worker", undefined);
    expect((await runSqlTool("sql-escape-helper", { value: "O'Reilly", valueType: "String", dialect: "PostgreSQL" })).rows[0].value).toBe("'O''Reilly'");
    for (const tool of ["sql-formatter", "sql-validator", "sql-minifier", "sql-to-json", "er-diagram-generator"]) await expect(runSqlTool(tool, { sql: "SELECT 1", dialect: "PostgreSQL" })).rejects.toThrow(/requires local Web Worker/);
  });
  it("uses a local worker for parser work and terminates after success", async () => {
    vi.stubGlobal("Worker", FakeWorker); const values = { sql: "SELECT 1", dialect: "PostgreSQL" }; const pending = runSqlTool("sql-validator", values);
    expect(FakeWorker.last.url.pathname).toMatch(/sql.worker.ts$/); expect(FakeWorker.last.postMessage).toHaveBeenCalledWith({ toolId: "sql-validator", values });
    FakeWorker.last.onmessage!({ data: { result: { rows: [{ label: "Valid/Invalid status", value: "Valid" }] } } }); await pending; expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("enforces a 15-second deadline without partial output", async () => {
    vi.stubGlobal("Worker", FakeWorker); vi.useFakeTimers(); const pending = runSqlTool("sql-formatter", {}); const rejected = expect(pending).rejects.toThrow(/15 seconds/);
    await vi.advanceTimersByTimeAsync(15000); await rejected; expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("cancels in-flight and pre-aborted work", async () => {
    vi.stubGlobal("Worker", FakeWorker); const controller = new AbortController(); const pending = runSqlTool("sql-formatter", {}, controller.signal); controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/); expect(FakeWorker.last.terminate).toHaveBeenCalledOnce(); await expect(runSqlTool("sql-escape-helper", {}, controller.signal)).rejects.toThrow(/cancelled/);
  });
  it("preflights oversized/deep structures before transfer and offloads larger generators", async () => {
    vi.stubGlobal("Worker", FakeWorker); await expect(runSqlTool("sql-formatter", { sql: "x".repeat(200001) })).rejects.toThrow(/200,000/);
    let nested: unknown = "x"; for (let i = 0; i < 17; i++) nested = [nested]; await expect(runSqlTool("sql-insert-generator", { rows: nested })).rejects.toThrow(/16-level/);
    const pending = runSqlTool("sql-escape-helper", { value: "x".repeat(20000), valueType: "String", dialect: "PostgreSQL" }); expect(FakeWorker.last.postMessage).toHaveBeenCalled(); FakeWorker.last.onmessage!({ data: { result: { rows: [] } } }); await pending;
  });
  it("terminates failures and allows subsequent independent work", async () => {
    vi.stubGlobal("Worker", FakeWorker); const pending = runSqlTool("sql-formatter", {}); FakeWorker.last.onerror!(); await expect(pending).rejects.toThrow(/Local SQL processing failed/); expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
    const next = runSqlTool("sql-formatter", {}); FakeWorker.last.onmessage!({ data: { error: "Unsupported syntax." } }); await expect(next).rejects.toThrow(/Unsupported syntax/);
  });
});
