import { SpreadsheetError, type SpreadsheetInfo, type SpreadsheetResult, type SpreadsheetValues } from "./types";

type Request = { action: "inspect"; file: File } | { action: "run"; toolId: string; values: SpreadsheetValues };
type Response = { info?: SpreadsheetInfo; result?: SpreadsheetResult; error?: string; field?: string };

function workerRequest<T extends SpreadsheetInfo | SpreadsheetResult>(request: Request, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(new SpreadsheetError("Spreadsheet processing cancelled."));
  if (typeof Worker === "undefined") return Promise.reject(new SpreadsheetError("Spreadsheet processing requires local Web Worker support. Use a browser that permits workers; no server processing is used."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("../../../workers/spreadsheet.worker.ts", import.meta.url), { type: "module" }); }
    catch { reject(new SpreadsheetError("Could not start the local Spreadsheet worker. Check browser worker permissions.")); return; }
    let settled = false;
    const finish = (error?: SpreadsheetError, response?: T) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate();
      if (error) reject(error); else if (response) resolve(response); else reject(new SpreadsheetError("Local Spreadsheet processing returned no result."));
    };
    const cancel = () => finish(new SpreadsheetError("Spreadsheet processing cancelled."));
    const timer = setTimeout(() => finish(new SpreadsheetError("Spreadsheet processing exceeded 30 seconds. No partial output was returned.")), 30_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<Response>) => {
      if (signal?.aborted) { cancel(); return; }
      const response = event.data;
      if (response.error) finish(new SpreadsheetError(response.error, response.field));
      else finish(undefined, (request.action === "inspect" ? response.info : response.result) as T | undefined);
    };
    worker.onerror = () => finish(new SpreadsheetError("Local Spreadsheet processing failed. Check permissions and reload the page."));
    if (signal?.aborted) { cancel(); return; }
    try { worker.postMessage(request); }
    catch { finish(new SpreadsheetError("Could not send the local file to the Spreadsheet worker.")); }
  });
}

export function inspectSpreadsheet(file: File, signal?: AbortSignal): Promise<SpreadsheetInfo> {
  return workerRequest<SpreadsheetInfo>({ action: "inspect", file }, signal);
}

export function runSpreadsheet(id: string, values: SpreadsheetValues, signal?: AbortSignal): Promise<SpreadsheetResult> {
  // Every operation produces/reads workbook bytes, so every browser operation is offloaded.
  return workerRequest<SpreadsheetResult>({ action: "run", toolId: id, values }, signal);
}
