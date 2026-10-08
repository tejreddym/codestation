import type { TextResult, TextValues } from "./types";

export async function runTextTool(slug: string, values: TextValues, signal?: AbortSignal): Promise<TextResult> {
  if (signal?.aborted) throw new Error("Text processing cancelled.");
  let size = 0;
  for (const value of Object.values(values)) if (typeof value === "string") {
    if (value.length > 1_000_000) throw new Error("Each input is limited to 1,000,000 UTF-16 code units.");
    size += value.length;
  }
  if (slug === "regex-line-extractor" && String(values.pattern ?? "").length > 16_384) throw new Error("Regex pattern exceeds the 16,384-character limit.");
  const generator = slug === "lorem-ipsum-generator" || slug === "random-text-generator";
  const mandatory = slug === "regex-line-extractor" || slug === "text-diff";
  const offload = mandatory || size > 16_384 || generator;
  if (!offload || typeof Worker === "undefined") {
    if (mandatory || size > 16_384 || (generator && (Number(values.length ?? values.amount) > 1000 || !["Words", "Characters"].includes(String(values.unit))))) {
      throw new Error("This operation requires local Web Worker support to keep the page responsive. Enable workers or use a supported browser.");
    }
    const { runText } = await import("./engine");
    if (signal?.aborted) throw new Error("Text processing cancelled.");
    return runText(slug, values);
  }
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("../../../workers/text-station.worker.ts", import.meta.url), { type: "module" }); }
    catch { reject(new Error("Could not start local text processing. Check browser worker permissions.")); return; }
    const milliseconds = slug === "regex-line-extractor" ? 1500 : 10_000;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new Error("Text processing cancelled.")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Text processing exceeded ${milliseconds.toLocaleString("en-US")} ms. Use a smaller input or simpler pattern; no partial result was returned.`)); }, milliseconds);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: TextResult; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("Text processing returned no result."));
    };
    worker.onerror = () => { cleanup(); reject(new Error("Local text processing failed. Reload the page and try again.")); };
    try { worker.postMessage({ slug, values }); }
    catch { cleanup(); reject(new Error("Could not send input to the local text worker.")); }
  });
}
