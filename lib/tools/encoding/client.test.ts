import { afterEach, describe, expect, it, vi } from "vitest";
import { runEncodingTool } from "./client";

class TestWorker {
  static last: TestWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor(public url: URL) { TestWorker.last = this; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Encoding selective worker", () => {
  it("keeps small linear work native", async () => {
    const constructor = vi.fn(); vi.stubGlobal("Worker", constructor);
    expect(await runEncodingTool("base64-encoder", { input: "Hi" })).toEqual({ text: "SGk=" });
    expect(constructor).not.toHaveBeenCalled();
  });
  it("uses a worker for Base58 and terminates after its result", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const promise = runEncodingTool("base58-encoder", { input: "Hello" });
    expect(TestWorker.last.url.pathname).toMatch(/workers\/encoding.worker.ts$/);
    expect(TestWorker.last.postMessage).toHaveBeenCalledWith({ slug: "base58-encoder", inputs: { input: "Hello" } });
    TestWorker.last.onmessage!({ data: { result: { text: "9Ajdvzr" } } });
    expect(await promise).toEqual({ text: "9Ajdvzr" }); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("uses a worker for larger otherwise linear conversions and aborts", async () => {
    vi.stubGlobal("Worker", TestWorker); const controller = new AbortController();
    const promise = runEncodingTool("base64-encoder", { input: "x".repeat(20_000) }, controller.signal);
    controller.abort(); await expect(promise).rejects.toThrow(/cancelled/); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("terminates after 10 seconds", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", TestWorker);
    const promise = runEncodingTool("base58-encoder", { input: "Hello" });
    const expected = expect(promise).rejects.toThrow(/10 seconds/);
    await vi.advanceTimersByTimeAsync(10_000); await expected; expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("does not silently freeze browsers without workers on large input", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(runEncodingTool("base64-encoder", { input: "x".repeat(20_000) })).rejects.toThrow(/Worker/);
    expect((await runEncodingTool("base58-encoder", { input: "Hello" })).text).toBe("9Ajdvzr");
  });
});
