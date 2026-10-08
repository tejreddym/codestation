import type { DataInputs, DataResult } from "./types";

/** A disposable worker keeps parsing and schema/query work off the UI thread. */
export async function runDataToolClient(slug: string, inputs: DataInputs, signal: AbortSignal): Promise<DataResult> {
  if (signal.aborted) throw new Error("Processing cancelled.");
  if (typeof Worker === "undefined") {
    const { runDataTool } = await import("./index");
    if (signal.aborted) throw new Error("Processing cancelled.");
    return runDataTool(slug, inputs);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../../workers/json-data.worker.ts", import.meta.url), { type: "module" });
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new Error("Processing cancelled.")); };
    timer = setTimeout(() => { cleanup(); reject(new Error("Processing exceeded 15 seconds. Use a smaller document or simpler query/schema.")); }, 15_000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: DataResult; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("Processing returned no result."));
    };
    worker.onerror = () => { cleanup(); reject(new Error("Local processing could not start. Reload this page and try again.")); };
    worker.postMessage({ slug, inputs });
  });
}
