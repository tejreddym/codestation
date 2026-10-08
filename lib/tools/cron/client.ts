import type { CronResult, CronValues } from "./types";

/** Schedule evaluation stays in memory; Next Run never blocks the UI thread. */
export async function runCronTool(toolId: string, values: CronValues, signal?: AbortSignal): Promise<CronResult> {
  if (signal?.aborted) throw new Error("Cron processing cancelled.");
  for (const [name, value] of Object.entries(values)) {
    const limit = name === "expression" ? 1024 : name === "description" ? 500 : name === "reference" ? 64 : 128;
    if (typeof value !== "string" || value.length > limit) {
      if (toolId === "cron-validator") return { rows: [{ label: "Valid/Invalid status", value: "Invalid" }, { label: "Error message", value: "Cron expression exceeds the 1,024-character limit or is not text." }] };
      throw new Error(`Input exceeds the ${limit.toLocaleString("en-US")}-character limit or is not text.`);
    }
  }
  if (toolId !== "cron-next-run") {
    const { runCron } = await import("./engine");
    if (signal?.aborted) throw new Error("Cron processing cancelled.");
    return runCron(toolId, values);
  }
  if (typeof Worker === "undefined") throw new Error("Next Run requires local Web Worker support. Use a browser that permits workers; no server calculation is used.");
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("../../../workers/cron.worker.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("Could not start the local Cron worker. Check browser worker permissions.")); return; }
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new Error("Cron processing cancelled.")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Cron calculation exceeded 10 seconds. No partial result was returned.")); }, 10_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: CronResult; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("Cron worker returned no result."));
    };
    worker.onerror = () => { cleanup(); reject(new Error("Local Cron calculation failed. Check worker permissions and reload the page.")); };
    try { worker.postMessage({ toolId, values }); }
    catch { cleanup(); reject(new Error("Could not send input to the local Cron worker.")); }
  });
}
