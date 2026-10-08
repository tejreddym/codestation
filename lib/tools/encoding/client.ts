import type { EncodingInputs, EncodingResult } from "./types";

/** Small linear conversions stay native; large inputs and Base58 run off-thread. */
export async function runEncodingTool(slug: string, inputs: EncodingInputs, signal?: AbortSignal): Promise<EncodingResult> {
  if (signal?.aborted) throw new Error("Conversion cancelled.");
  if (inputs.input.length > 1_000_000) throw new Error("Input exceeds the 1,000,000-character limit. Use a smaller input.");
  const expensive = slug.startsWith("base58-") || inputs.input.length > 16_384;
  if (!expensive) {
    const { runEncoding } = await import("./index");
    if (signal?.aborted) throw new Error("Conversion cancelled.");
    return runEncoding(slug, inputs);
  }
  if (typeof Worker === "undefined") {
    if (inputs.input.length > 16_384 || (slug.startsWith("base58-") && inputs.input.length > 2048)) {
      throw new Error("This input needs Web Worker support for responsive local processing. Use a smaller input or a browser with workers enabled.");
    }
    return (await import("./index")).runEncoding(slug, inputs);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../../workers/encoding.worker.ts", import.meta.url), { type: "module" });
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new Error("Conversion cancelled.")); };
    timer = setTimeout(() => { cleanup(); reject(new Error("Conversion exceeded 10 seconds. Use a smaller input.")); }, 10_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: EncodingResult; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("Conversion returned no result."));
    };
    worker.onerror = () => { cleanup(); reject(new Error("Local worker could not start. Reload the page or use a smaller input.")); };
    worker.postMessage({ slug, inputs });
  });
}
