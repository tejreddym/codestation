import { afterEach, describe, expect, it, vi } from "vitest";
import { runDataToolClient } from "./client";

class TestWorker {
  static last: TestWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor(public url: URL) { TestWorker.last = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("disposable local worker", () => {
  it("returns output and terminates the worker", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const promise = runDataToolClient("json-formatter", { input: "{}" }, new AbortController().signal);
    expect(TestWorker.last.url.pathname).toMatch(/workers\/json-data.worker.ts$/);
    expect(TestWorker.last.postMessage).toHaveBeenCalledWith({ slug: "json-formatter", inputs: { input: "{}" } });
    TestWorker.last.onmessage!({ data: { result: { text: "{}" } } });
    expect(await promise).toEqual({ text: "{}" }); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("cancels pending work on clear/navigation", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const controller = new AbortController();
    const promise = runDataToolClient("json-formatter", { input: "{}" }, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow(/cancelled/); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("terminates expensive work after 15 seconds", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", TestWorker);
    const promise = runDataToolClient("json-formatter", { input: "{}" }, new AbortController().signal);
    const rejection = expect(promise).rejects.toThrow(/15 seconds/);
    await vi.advanceTimersByTimeAsync(15_000); await rejection;
    expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
});
