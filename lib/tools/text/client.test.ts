import { afterEach, describe, expect, it, vi } from "vitest";
import { runTextTool } from "./client";
class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor(public url: URL) { FakeWorker.last = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Text worker safety", () => {
  it("uses local simple processing for small text, never regex/diff fallback", async () => {
    vi.stubGlobal("Worker", undefined);
    expect((await runTextTool("reverse-text", { text: "abc" })).rows[0].value).toBe("cba");
    for (const slug of ["regex-line-extractor", "text-diff"]) await expect(runTextTool(slug, { text: "x", pattern: "x" })).rejects.toThrow(/requires local Web Worker/);
    await expect(runTextTool("reverse-text", { text: "x".repeat(20_000) })).rejects.toThrow(/Worker/);
  });
  it.each(["text-diff", "regex-line-extractor", "random-text-generator", "reverse-text"])("%s offloads relevant workloads and terminates", async slug => {
    vi.stubGlobal("Worker", FakeWorker); const values = slug === "reverse-text" ? { text: "x".repeat(20_000) } : { text: "x" };
    const pending = runTextTool(slug, values); expect(FakeWorker.last.url.pathname).toMatch(/text-station.worker.ts$/); expect(FakeWorker.last.postMessage).toHaveBeenCalledWith({ slug, values });
    FakeWorker.last.onmessage!({ data: { result: { rows: [{ label: "Result", value: "x" }] } } }); await pending; expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it.each([["regex-line-extractor", 1500], ["text-diff", 10000]] as const)("%s timeout %s is enforced", async (slug, timeout) => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", FakeWorker); const pending = runTextTool(slug, {}); const rejected = expect(pending).rejects.toThrow(/no partial result/);
    await vi.advanceTimersByTimeAsync(timeout); await rejected; expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("cancels processing and never restarts it automatically", async () => {
    vi.stubGlobal("Worker", FakeWorker); const controller = new AbortController(); const pending = runTextTool("text-diff", {}, controller.signal); controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/); expect(FakeWorker.last.terminate).toHaveBeenCalledOnce(); await expect(runTextTool("reverse-text", {}, controller.signal)).rejects.toThrow(/cancelled/);
  });
  it("bounds input before worker transfer and handles worker failure", async () => {
    const constructor = vi.fn(); vi.stubGlobal("Worker", constructor); await expect(runTextTool("text-counter", { text: "x".repeat(1_000_001) })).rejects.toThrow(/1,000,000/); expect(constructor).not.toHaveBeenCalled();
    vi.stubGlobal("Worker", FakeWorker); const pending = runTextTool("text-diff", {}); FakeWorker.last.onerror!(); await expect(pending).rejects.toThrow(/failed/); expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
});
