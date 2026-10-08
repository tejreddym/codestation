import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectSpreadsheet, runSpreadsheet } from "./client";

class WorkerStub {
  static instances: WorkerStub[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor(public url: URL, public options: unknown) { WorkerStub.instances.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); WorkerStub.instances = []; });
describe("mandatory local disposable Spreadsheet workers", () => {
  it("requires workers even for small CSV instead of blocking the main thread", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(runSpreadsheet("csv-to-excel", { source: "a\nb" })).rejects.toThrow("Web Worker");
  });
  it("inspection uses inspect protocol and terminates on successful result", async () => {
    vi.stubGlobal("Worker", WorkerStub);
    const file = new File(["x"], "x.xlsx"), promise = inspectSpreadsheet(file);
    const worker = WorkerStub.instances[0];
    expect(worker.options).toEqual({ type: "module" }); expect(worker.url.pathname).toContain("spreadsheet.worker.ts");
    expect(worker.postMessage).toHaveBeenCalledWith({ action: "inspect", file });
    const info = { sheetNames: ["Data"], sheets: [] }; worker.onmessage!({ data: { info } });
    await expect(promise).resolves.toEqual(info); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("run protocol returns genuine structured Blob results", async () => {
    vi.stubGlobal("Worker", WorkerStub);
    const promise = runSpreadsheet("csv-to-excel", { source: "a\nb" });
    const worker = WorkerStub.instances[0], result = { data: { rowCount: 1 }, files: [{ name: "a.xlsx", blob: new Blob(["bytes"]) }] };
    expect(worker.postMessage).toHaveBeenCalledWith({ action: "run", toolId: "csv-to-excel", values: { source: "a\nb" } });
    worker.onmessage!({ data: { result } }); await expect(promise).resolves.toEqual(result);
  });
  it("rejects timeout after 30 seconds, terminates and ignores late responses", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", WorkerStub);
    const promise = runSpreadsheet("csv-to-excel", {}), expectation = expect(promise).rejects.toThrow("30 seconds");
    const worker = WorkerStub.instances[0]; await vi.advanceTimersByTimeAsync(30_000); await expectation;
    worker.onmessage!({ data: { result: { data: {} } } }); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("aborts promptly, rejects stale successes and skips already-aborted work", async () => {
    vi.stubGlobal("Worker", WorkerStub); const controller = new AbortController();
    const promise = runSpreadsheet("csv-to-excel", {}, controller.signal); controller.abort();
    const worker = WorkerStub.instances[0]; worker.onmessage!({ data: { result: { data: {} } } });
    await expect(promise).rejects.toThrow("cancelled"); expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(runSpreadsheet("csv-to-excel", {}, controller.signal)).rejects.toThrow("cancelled");
    expect(WorkerStub.instances).toHaveLength(1);
  });
  it("preserves field-specific worker errors and rejects missing results", async () => {
    vi.stubGlobal("Worker", WorkerStub);
    const promise = runSpreadsheet("csv-to-excel", {}); WorkerStub.instances[0].onmessage!({ data: { error: "Invalid CSV", field: "source" } });
    await expect(promise).rejects.toMatchObject({ name: "SpreadsheetError", message: "Invalid CSV", field: "source" });
    const missing = runSpreadsheet("csv-to-excel", {}); WorkerStub.instances[1].onmessage!({ data: {} }); await expect(missing).rejects.toThrow("no result");
  });
  it("terminates on worker runtime/serialization errors", async () => {
    vi.stubGlobal("Worker", WorkerStub);
    const promise = runSpreadsheet("csv-to-excel", {}); WorkerStub.instances[0].onerror!(); await expect(promise).rejects.toThrow("failed");
    class UncloneableWorker extends WorkerStub { postMessage = vi.fn(() => { throw new Error("clone"); }); }
    vi.stubGlobal("Worker", UncloneableWorker);
    await expect(runSpreadsheet("csv-to-excel", {})).rejects.toThrow("Could not send");
    expect(WorkerStub.instances[1].terminate).toHaveBeenCalledOnce();
  });
});
