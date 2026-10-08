import type { RegexResult, RegexValues } from "./types";

/** No main-thread fallback for arbitrary RegExp, even for short inputs. */
export async function runRegexTool(slug: string, values: RegexValues, signal?: AbortSignal): Promise<RegexResult> {
  if (signal?.aborted) throw new Error("Regex processing cancelled.");
  for (const [key, value] of Object.entries(values)) {
    const limit = key === "pattern" ? 16_384 : 200_000;
    if (typeof value !== "string" || value.length > limit) throw new Error(`Input exceeds the ${limit.toLocaleString("en-US")}-code-unit limit or is not text.`);
  }
  if (slug === "regex-escape" || slug === "regex-pattern-builder") {
    const { runRegex } = await import("./engine");
    if (signal?.aborted) throw new Error("Regex processing cancelled.");
    return runRegex(slug, values);
  }
  if (typeof Worker === "undefined") throw new Error("Regex execution requires Web Worker support. Enable workers or use a supported browser; no unsafe main-thread fallback is used.");
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("../../../workers/regex-station.worker.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("Could not start the local regex worker. Check browser worker permissions.")); return; }
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new Error("Regex processing cancelled.")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Regex timed out after 1,500 ms. Use a simpler pattern or smaller input; no partial result was returned.")); }, 1500);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: RegexResult; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("Regex worker returned no result."));
    };
    worker.onerror = () => { cleanup(); reject(new Error("Could not process this regular expression in the local worker.")); };
    try { worker.postMessage({ slug, values }); }
    catch { cleanup(); reject(new Error("Could not send the input to the local regex worker.")); }
  });
}
