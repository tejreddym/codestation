import { afterEach, describe, expect, it, vi } from "vitest";
import { runRegexTool } from "./client";

class TestWorker {
  static last: TestWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor(public url: URL) { TestWorker.last = this; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Regex worker lifecycle", () => {
  it("requires workers for even short user regex; no synchronous fallback", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(runRegexTool("regex-tester", { pattern: "(a+)+$", text: "a" })).rejects.toThrow(/requires Web Worker/);
    expect((await runRegexTool("regex-escape", { literal: "a.b" })).text).toBe("a\\.b");
    expect((await runRegexTool("regex-pattern-builder", { literal: "a.b" })).text).toBe("a\\.b");
  });
  it("posts input only to local worker and terminates after response", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const values = { pattern: "a", text: "abc", flags: "" };
    const pending = runRegexTool("regex-tester", values);
    expect(TestWorker.last.url.pathname).toMatch(/workers\/regex-station.worker.ts$/);
    expect(TestWorker.last.postMessage).toHaveBeenCalledWith({ slug: "regex-tester", values });
    TestWorker.last.onmessage!({ data: { result: { kind: "test", count: 1 } } });
    expect((await pending).count).toBe(1); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("times out and terminates expensive work at 1500ms without partial results", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", TestWorker);
    const pending = runRegexTool("regex-tester", { pattern: "(a+)+$", text: "public synthetic fixture" });
    const rejected = expect(pending).rejects.toThrow(/1,500 ms.*no partial/);
    await vi.advanceTimersByTimeAsync(1500); await rejected; expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("aborts on Clear/navigation and refuses already cancelled work", async () => {
    vi.stubGlobal("Worker", TestWorker); const controller = new AbortController();
    const pending = runRegexTool("regex-tester", { pattern: "a", text: "a" }, controller.signal);
    controller.abort(); await expect(pending).rejects.toThrow(/cancelled/); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
    await expect(runRegexTool("regex-tester", {}, controller.signal)).rejects.toThrow(/cancelled/);
  });
  it("handles worker compile errors, startup failures and runtime errors", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const pending = runRegexTool("regex-tester", { pattern: "[" });
    TestWorker.last.onmessage!({ data: { error: "Invalid JavaScript regular expression." } });
    await expect(pending).rejects.toThrow(/Invalid/); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
    const other = runRegexTool("regex-tester", {}); TestWorker.last.onerror!(); await expect(other).rejects.toThrow(/local worker/);
    vi.stubGlobal("Worker", class { constructor() { throw new Error("Private browser data"); } });
    await expect(runRegexTool("regex-tester", {})).rejects.toThrow(/Could not start/);
  });
  it("validates sizes before creating a worker", async () => {
    const worker = vi.fn(); vi.stubGlobal("Worker", worker);
    await expect(runRegexTool("regex-tester", { pattern: "a".repeat(16_385) })).rejects.toThrow(/16,384/);
    await expect(runRegexTool("regex-tester", { text: "a".repeat(200_001) })).rejects.toThrow(/200,000/);
    expect(worker).not.toHaveBeenCalled();
  });
});
