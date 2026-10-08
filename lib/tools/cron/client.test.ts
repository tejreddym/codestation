import { afterEach, describe, expect, it, vi } from "vitest";
import { runCronTool } from "./client";
class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor(public url: URL) { FakeWorker.last = this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Cron local worker lifecycle", () => {
  it("runs bounded parsing locally but never falls back for Next Run", async () => {
    vi.stubGlobal("Worker", undefined);
    expect((await runCronTool("cron-validator", { expression: "* * * * *" })).rows[0].value).toBe("Valid");
    await expect(runCronTool("cron-next-run", {})).rejects.toThrow(/requires local Web Worker/);
  });
  it("uses the local worker and terminates after the response", async () => {
    vi.stubGlobal("Worker", FakeWorker); const values = { expression: "* * * * *", reference: "2026-10-05T00:00Z", timezone: "UTC" };
    const pending = runCronTool("cron-next-run", values); expect(FakeWorker.last.url.pathname).toMatch(/cron.worker.ts$/); expect(FakeWorker.last.postMessage).toHaveBeenCalledWith({ toolId: "cron-next-run", values });
    FakeWorker.last.onmessage!({ data: { result: { rows: [{ label: "Next run date/time", value: "result" }] } } }); expect((await pending).rows[0].value).toBe("result"); expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("enforces the 10-second deadline without partial output", async () => {
    vi.stubGlobal("Worker", FakeWorker); vi.useFakeTimers(); const pending = runCronTool("cron-next-run", {}); const rejected = expect(pending).rejects.toThrow(/10 seconds/);
    await vi.advanceTimersByTimeAsync(10000); await rejected; expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("cancels and rejects already aborted work", async () => {
    vi.stubGlobal("Worker", FakeWorker); const controller = new AbortController(); const pending = runCronTool("cron-next-run", {}, controller.signal); controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/); expect(FakeWorker.last.terminate).toHaveBeenCalledOnce(); await expect(runCronTool("cron-explainer", {}, controller.signal)).rejects.toThrow(/cancelled/);
  });
  it("reports worker errors without exposing input and permits a fresh request", async () => {
    vi.stubGlobal("Worker", FakeWorker); const pending = runCronTool("cron-next-run", { expression: "PRIVATE" }); FakeWorker.last.onerror!(); await expect(pending).rejects.toThrow(/Local Cron calculation failed/); expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
    const next = runCronTool("cron-next-run", {}); FakeWorker.last.onmessage!({ data: { error: "Invalid cron expression." } }); await expect(next).rejects.toThrow(/Invalid/);
  });
  it("checks bounds before transfer; validator returns an Invalid status", async () => {
    const constructor = vi.fn(); vi.stubGlobal("Worker", constructor);
    await expect(runCronTool("cron-next-run", { expression: "x".repeat(1025) })).rejects.toThrow(/1,024/); expect(constructor).not.toHaveBeenCalled();
    expect((await runCronTool("cron-validator", { expression: "x".repeat(1025) })).rows[0].value).toBe("Invalid");
    await expect(runCronTool("human-to-cron", { description: "x".repeat(501) })).rejects.toThrow(/500/);
  });
});
