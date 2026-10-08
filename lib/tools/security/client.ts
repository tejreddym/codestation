import type { SecurityRequest, SecurityResult } from "./types";

/** Offload files and larger text; Web Crypto remains the source of SHA/HMAC work. */
export async function runSecurityTool(slug: string, request: SecurityRequest, signal?: AbortSignal): Promise<SecurityResult> {
  if (signal?.aborted) throw new Error("Processing cancelled.");
  let largestText = 0;
  for (const value of Object.values(request.values)) if (typeof value === "string") largestText = Math.max(largestText, value.length);
  if (largestText > 1_000_000) throw new Error("Input exceeds the 1,000,000-character limit.");
  if (request.file && request.file.size > 64 * 1024 * 1024) throw new Error("File exceeds the 64 MiB limit.");
  const offload = Boolean(request.file) || largestText > 16_384;
  if (!offload || typeof Worker === "undefined") {
    if (typeof Worker === "undefined" && (largestText > 16_384 || (request.file?.size ?? 0) > 8 * 1024 * 1024)) {
      throw new Error("Large input requires Web Worker support for responsive local processing. Use a smaller input or a browser with workers enabled.");
    }
    const { runSecurity } = await import("./index");
    if (signal?.aborted) throw new Error("Processing cancelled.");
    return runSecurity(slug, request);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../../workers/security.worker.ts", import.meta.url), { type: "module" });
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { cleanup(); reject(new Error("Processing cancelled.")); };
    timer = setTimeout(() => { cleanup(); reject(new Error("Processing exceeded 30 seconds. Use a smaller file or text input.")); }, 30_000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: SecurityResult; error?: string }>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
      else reject(new Error("Processing returned no result."));
    };
    worker.onerror = () => { cleanup(); reject(new Error("Local processing could not start. Reload the page and try again.")); };
    try { worker.postMessage({ slug, request }); }
    catch { cleanup(); reject(new Error("Local processing could not accept this input.")); }
  });
}
