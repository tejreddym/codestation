import { afterEach, describe, expect, it, vi } from "vitest";
import { runSecurityTool } from "./client";

class TestWorker {
  static last: TestWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor(public url: URL) { TestWorker.last = this; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("local security workers", () => {
  it("keeps small native work off the worker path", async () => {
    const worker = vi.fn(); vi.stubGlobal("Worker", worker);
    expect((await runSecurityTool("hash-compare", { values: { hashA: "test", hashB: "test" } })).text).toBe("Match");
    expect(worker).not.toHaveBeenCalled();
  });
  it("posts a File only to the local worker and terminates on completion", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const file = new File(["public-test"], "public.txt");
    const promise = runSecurityTool("file-hash-generator", { values: { algorithm: "SHA-256" }, file });
    expect(TestWorker.last.url.pathname).toMatch(/workers\/security.worker.ts$/);
    expect(TestWorker.last.postMessage).toHaveBeenCalledWith({ slug: "file-hash-generator", request: { values: { algorithm: "SHA-256" }, file } });
    TestWorker.last.onmessage!({ data: { result: { text: "public test result" } } });
    await promise; expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("terminates and rejects when Clear or navigation aborts", async () => {
    vi.stubGlobal("Worker", TestWorker); const controller = new AbortController();
    const promise = runSecurityTool("md5-generator", { values: { input: "x".repeat(20_000) } }, controller.signal);
    controller.abort(); await expect(promise).rejects.toThrow(/cancelled/); expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("terminates after 30 seconds", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", TestWorker);
    const promise = runSecurityTool("md5-generator", { values: { input: "x".repeat(20_000) } });
    const expected = expect(promise).rejects.toThrow(/30 seconds/);
    await vi.advanceTimersByTimeAsync(30_000); await expected;
    expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  });
  it("bounds file/text allocation before posting or using an unsafe large fallback", async () => {
    const worker = vi.fn(); vi.stubGlobal("Worker", worker);
    await expect(runSecurityTool("file-hash-generator", { values: { algorithm: "SHA-256" }, file: { size: 64 * 1024 * 1024 + 1 } as File })).rejects.toThrow(/64 MiB/);
    expect(worker).not.toHaveBeenCalled(); vi.stubGlobal("Worker", undefined);
    await expect(runSecurityTool("md5-generator", { values: { input: "x".repeat(20_000) } })).rejects.toThrow(/Worker/);
  });
});
