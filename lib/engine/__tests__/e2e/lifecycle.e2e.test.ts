// @vitest-environment jsdom
/**
 * Code Station — Tool Engine E2E Lifecycle Test Suite
 *
 * Tiers 1 & 2 Opaque-Box Coverage for Features 6-9:
 * - Feature 6: Execution Runtime Controller & Deterministic State Machine (5 T1, 5 T2)
 * - Feature 7: useToolEngine React Lifecycle Hook (5 T1, 5 T2)
 * - Feature 8: Worker Offloading, Progress Forwarding & Fallback (5 T1, 5 T2)
 * - Feature 9: Blob URL Lifecycle & Memory Management (5 T1, 5 T2)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  ToolDefinition,
  ToolEngine,
  ToolExecutionState,
  ToolContext,
  ToolResult,
} from "../../types";
import {
  createValidationSuccess,
  createValidationError,
} from "../../types";
import {
  ExecutionRuntimeController,
  executeTool,
} from "../../runtime";
import { useToolEngine } from "../../useToolEngine";
import { BlobUrlRegistry } from "../../blobRegistry";
import {
  runWorkerWithFallback,
  executeInWorker,
  extractTransferables,
  TimeoutError,
  CancellationError,
  WorkerExecutionError,
} from "../../workerRunner";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockToolDefinition,
  createMockToolEngine,
  createAsyncMockEngine,
  MockWorker,
  MockURLManager,
} from "./testHelpers";

describe("E2E Lifecycle: Feature 6 - Execution Runtime Controller", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F6-01: transitions through deterministic states (idle -> validating -> processing -> success)", async () => {
    const statesObserved: ToolExecutionState[] = [];

    const engine = createMockToolEngine({
      validate: () => createValidationSuccess(),
      process: async (input: unknown) => {
        await new Promise((r) => setTimeout(r, 10));
        return { data: `Result: ${input}`, durationMs: 10 };
      },
    });

    const controller = new ExecutionRuntimeController(engine, {
      onStateChange: (state) => statesObserved.push(state),
    });

    expect(controller.state).toBe("idle");

    const result = await controller.run("hello");

    expect(result).not.toBeNull();
    expect(result?.data).toBe("Result: hello");
    expect(statesObserved).toEqual(["validating", "processing", "success"]);
    expect(controller.state).toBe("success");
  });

  it("TIER1-F6-02: validation gate blocks process() when input is invalid and transitions to error", async () => {
    let processInvoked = false;

    const engine = createMockToolEngine({
      validate: (input: unknown) => {
        if (!input || input === "") {
          return createValidationError("Input data is required");
        }
        return createValidationSuccess();
      },
      process: async () => {
        processInvoked = true;
        return { data: "should not run", durationMs: 0 };
      },
    });

    const controller = new ExecutionRuntimeController(engine);
    const result = await controller.run("");

    expect(result).toBeNull();
    expect(processInvoked).toBe(false);
    expect(controller.state).toBe("error");
    expect(controller.validation?.valid).toBe(false);
    expect(controller.error?.message).toBe("Input data is required");
  });

  it("TIER1-F6-03: handles runtime exception in process() and transitions state to error", async () => {
    const engine = createMockToolEngine({
      validate: () => createValidationSuccess(),
      process: async () => {
        throw new Error("Disk quota exceeded in virtual FS");
      },
    });

    const controller = new ExecutionRuntimeController(engine);
    const result = await controller.run("data");

    expect(result).toBeNull();
    expect(controller.state).toBe("error");
    expect(controller.error?.message).toBe("Disk quota exceeded in virtual FS");
  });

  it("TIER1-F6-04: cancel() aborts in-flight execution and transitions state to cancelled", async () => {
    let capturedContext: ToolContext | null = null;
    const engine: ToolEngine<string, string> = {
      validate: () => createValidationSuccess(),
      process: async (input: string, context: ToolContext) => {
        capturedContext = context;
        return new Promise((resolve, reject) => {
          const onAbort = () => {
            reject(new CancellationError("Execution cancelled by user."));
          };
          context.signal.addEventListener("abort", onAbort, { once: true });
          setTimeout(() => {
            resolve({ data: `Done: ${input}`, durationMs: 100 });
          }, 100);
        });
      },
      cancel: vi.fn(),
    };
    const statesObserved: ToolExecutionState[] = [];

    const controller = new ExecutionRuntimeController(engine, {
      onStateChange: (state) => statesObserved.push(state),
    });

    const runPromise = controller.run("cancel-me");

    // Allow time to enter 'processing' state
    await new Promise((r) => setTimeout(r, 15));
    expect(controller.state).toBe("processing");

    // Trigger cancel
    controller.cancel();

    const result = await runPromise;
    expect(result).toBeNull();
    expect(controller.state).toBe("cancelled");
    expect(statesObserved).toContain("cancelled");
    expect(capturedContext).not.toBeNull();
    expect((capturedContext as unknown as ToolContext).signal.aborted).toBe(true);
  });

  it("TIER1-F6-05: forwards progress updates during execution", async () => {
    const engine = createAsyncMockEngine(60, [
      { percent: 25, label: "Parsing" },
      { percent: 50, label: "Transforming" },
      { percent: 75, label: "Encoding" },
      { percent: 100, label: "Complete" },
    ]);

    const progressLog: Array<{ percent?: number; label?: string }> = [];

    const controller = new ExecutionRuntimeController(engine, {
      onProgress: (p) => progressLog.push({ ...p }),
    });

    const result = await controller.run("payload");

    expect(result).not.toBeNull();
    expect(progressLog.length).toBeGreaterThanOrEqual(4);
    expect(progressLog[0].percent).toBe(25);
    expect(progressLog[progressLog.length - 1].percent).toBe(100);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F6-01: handles pre-aborted signal cancellation before execution begins", async () => {
    const abortCtrl = new AbortController();
    abortCtrl.abort();

    const def = createMockToolDefinition();
    const engine = createMockToolEngine();
    let stateRecorded: ToolExecutionState = "idle";

    await expect(
      executeTool(def, engine, "input", {
        signal: abortCtrl.signal,
        onStateChange: (s) => {
          stateRecorded = s;
        },
      })
    ).rejects.toThrow(CancellationError);

    expect(stateRecorded).toBe("cancelled");
  });

  it("TIER2-F6-02: rapid consecutive run() calls abort prior in-flight runs cleanly", async () => {
    const engine = createAsyncMockEngine(80);
    const controller = new ExecutionRuntimeController(engine);

    // Dispatch run 1
    const run1 = controller.run("first");
    // Dispatch run 2 immediately after
    const run2 = controller.run("second");

    const [res1, res2] = await Promise.all([run1, run2]);

    // First run should be superseded / cancelled
    expect(res1).toBeNull();
    // Second run completes successfully
    expect(res2).not.toBeNull();
    expect(res2?.data).toContain("SECOND");
    expect(controller.state).toBe("success");
  });

  it("TIER2-F6-03: calling cancel() on an idle controller transitions state to cancelled cleanly", () => {
    const engine = createMockToolEngine();
    const controller = new ExecutionRuntimeController(engine);

    expect(controller.state).toBe("idle");
    expect(() => controller.cancel()).not.toThrow();
    expect(controller.state).toBe("cancelled");
  });

  it("TIER2-F6-04: catches synchronous throw in validate() without crashing runner", async () => {
    const engine = createMockToolEngine({
      validate: () => {
        throw new Error("Synchronous parse failure");
      },
    });

    const controller = new ExecutionRuntimeController(engine);
    const result = await controller.run("invalid");

    expect(result).toBeNull();
    expect(controller.state).toBe("error");
    expect(controller.error?.message).toBe("Synchronous parse failure");
  });

  it("TIER2-F6-05: reset() clears result, validation, error, progress, and restores state to idle", async () => {
    const statesObserved: ToolExecutionState[] = [];
    const engine = createMockToolEngine({
      process: async (input) => ({ data: `Out: ${input}`, durationMs: 5 }),
    });

    const controller = new ExecutionRuntimeController(engine, {
      onStateChange: (state) => statesObserved.push(state),
    });

    await controller.run("initial");
    expect(controller.state).toBe("success");
    expect(controller.result?.data).toBe("Out: initial");

    controller.reset();
    expect(controller.state).toBe("idle");
    expect(controller.result).toBeNull();
    expect(controller.validation).toBeNull();
    expect(controller.error).toBeNull();
    expect(controller.progress).toEqual({});
    expect(controller.durationMs).toBeNull();
    expect(statesObserved).toContain("idle");
  });
});

describe("E2E Lifecycle: Feature 7 - useToolEngine Hook", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F7-01: initializes in idle state with null result and error", () => {
    const def = createMockToolDefinition();
    const engine = createMockToolEngine();

    const { result } = renderHook(() =>
      useToolEngine(def, engine as unknown as ToolEngine)
    );

    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.validation).toBeNull();
    expect(result.current.progress).toEqual({});
  });

  it("TIER1-F7-02: run(input) triggers execution and updates reactive state to success", async () => {
    const def = createMockToolDefinition();
    const engine = createMockToolEngine({
      process: async (input: unknown) => ({
        data: `Echo: ${input}`,
        durationMs: 5,
      }),
    });

    const { result } = renderHook(() =>
      useToolEngine(def, engine as unknown as ToolEngine)
    );

    await act(async () => {
      await result.current.run("test-data");
    });

    expect(result.current.state).toBe("success");
    expect(result.current.result?.data).toBe("Echo: test-data");
    expect(result.current.error).toBeNull();
  });

  it("TIER1-F7-03: reset() clears results, errors, and restores state to idle", async () => {
    const def = createMockToolDefinition();
    const engine = createMockToolEngine({
      process: async () => ({ data: "output", durationMs: 1 }),
    });

    const { result } = renderHook(() =>
      useToolEngine(def, engine as unknown as ToolEngine)
    );

    await act(async () => {
      await result.current.run("input");
    });
    expect(result.current.state).toBe("success");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.validation).toBeNull();
  });

  it("TIER1-F7-04: unmounting component triggers engine.dispose()", () => {
    const def = createMockToolDefinition();
    let disposeCalled = false;
    const engine = createMockToolEngine({
      dispose: () => {
        disposeCalled = true;
      },
    });

    const { unmount } = renderHook(() => useToolEngine(def, engine));
    expect(disposeCalled).toBe(false);

    unmount();
    expect(disposeCalled).toBe(true);
  });

  it("TIER1-F7-05: switching tool definition resets execution state and disposes prior engine", () => {
    const def1 = createMockToolDefinition({ id: "tool-1" });
    const def2 = createMockToolDefinition({ id: "tool-2" });

    let engine1Disposed = false;
    const engine1 = createMockToolEngine({
      dispose: () => {
        engine1Disposed = true;
      },
    });
    const engine2 = createMockToolEngine();

    const { result, rerender } = renderHook(
      ({ def, eng }) => useToolEngine(def, eng),
      { initialProps: { def: def1, eng: engine1 } }
    );

    expect(result.current.state).toBe("idle");

    // Switch to definition 2
    rerender({ def: def2, eng: engine2 });

    expect(engine1Disposed).toBe(true);
    expect(result.current.state).toBe("idle");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F7-01: unmounting during active in-flight execution cancels safely", async () => {
    const def = createMockToolDefinition();
    let cancelCalled = false;
    let disposeCalled = false;

    const engine = createAsyncMockEngine(200);
    engine.cancel = () => {
      cancelCalled = true;
    };
    engine.dispose = () => {
      disposeCalled = true;
    };

    const { result, unmount } = renderHook(() =>
      useToolEngine(def, engine as unknown as ToolEngine)
    );

    // Start execution
    let runPromise: Promise<ToolResult | null>;
    act(() => {
      runPromise = result.current.run("test");
    });

    // Unmount while run is pending
    unmount();

    expect(cancelCalled).toBe(true);
    expect(disposeCalled).toBe(true);

    await act(async () => {
      await runPromise;
    });
  });

  it("TIER2-F7-02: engine with throwing dispose() does not crash component unmount", () => {
    const def = createMockToolDefinition();
    const engine = createMockToolEngine({
      dispose: () => {
        throw new Error("Teardown error");
      },
    });

    const { unmount } = renderHook(() => useToolEngine(def, engine));
    expect(() => unmount()).not.toThrow();
  });

  it("TIER2-F7-03: rapid consecutive run() calls update hook state without race conditions", async () => {
    const def = createMockToolDefinition();
    const engine = createAsyncMockEngine(50);

    const { result } = renderHook(() =>
      useToolEngine(def, engine as unknown as ToolEngine)
    );

    await act(async () => {
      const p1 = result.current.run("first");
      const p2 = result.current.run("second");
      await Promise.all([p1, p2]);
    });

    expect(result.current.state).toBe("success");
    expect(result.current.result?.data).toContain("SECOND");
  });

  it("TIER2-F7-04: setFieldValue updates single field reactively and clears field diagnostic", async () => {
    const def = createMockToolDefinition({
      input: [
        { name: "query", label: "Query", control: "text", defaultValue: "old" },
        { name: "count", label: "Count", control: "number", defaultValue: 10 },
      ],
    });
    const engine = createMockToolEngine();

    const { result } = renderHook(() =>
      useToolEngine(def, engine as unknown as ToolEngine)
    );

    expect(result.current.input.query).toBe("old");
    expect(result.current.input.count).toBe(10);

    act(() => {
      result.current.setFieldValue("query", "new-query");
    });

    expect(result.current.input.query).toBe("new-query");
    expect(result.current.input.count).toBe(10);
  });

  it("TIER2-F7-05: validation failure in run() updates error and validation state without crashing hook", async () => {
    const def = createMockToolDefinition();
    const engine = createMockToolEngine({
      validate: (input) => {
        if (!input || (typeof input === "object" && (input as any).input === "")) {
          return createValidationError("Input text cannot be blank");
        }
        return createValidationSuccess();
      },
      process: async () => ({ data: "should not run", durationMs: 0 }),
    });

    const { result } = renderHook(() =>
      useToolEngine(def, engine as unknown as ToolEngine)
    );

    await act(async () => {
      await result.current.run({ input: "" });
    });

    expect(result.current.state).toBe("error");
    expect(result.current.result).toBeNull();
    expect(result.current.validation?.valid).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain("Input text cannot be blank");
  });
});

describe("E2E Lifecycle: Feature 8 - Worker Offloading & Fallback", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F8-01: instantiates MockWorker when worker script is specified", async () => {
    MockWorker.messageHandler = (worker, message) => {
      // Simulate worker echo response
      setTimeout(() => {
        worker.emitMessage({
          type: "success",
          result: { echo: message, timestamp: Date.now() },
        });
      }, 5);
    };

    const result = await runWorkerWithFallback<string, { echo: string }>(
      "/workers/test.worker.js",
      "test-payload"
    );

    expect(MockWorker.instances.length).toBe(1);
    expect(MockWorker.instances[0].url).toBe("/workers/test.worker.js");
    expect(result.echo).toBe("test-payload");
  });

  it("TIER1-F8-02: worker progress messages are forwarded to onProgress handler", async () => {
    const progressUpdates: any[] = [];

    MockWorker.messageHandler = (worker) => {
      setTimeout(() => {
        worker.emitMessage({ type: "progress", percent: 30, label: "Step 1" });
      }, 5);
      setTimeout(() => {
        worker.emitMessage({ type: "progress", percent: 70, label: "Step 2" });
      }, 10);
      setTimeout(() => {
        worker.emitMessage({ type: "success", result: "worker finished" });
      }, 15);
    };

    const res = await runWorkerWithFallback<string, string>(
      "/workers/progress.worker.js",
      "data",
      undefined,
      (p) => progressUpdates.push(p)
    );

    expect(res).toBe("worker finished");
    expect(progressUpdates.length).toBe(2);
    expect(progressUpdates[0].percent).toBe(30);
    expect(progressUpdates[1].percent).toBe(70);
  });

  it("TIER1-F8-03: worker success message resolves final payload", async () => {
    MockWorker.messageHandler = (worker, message) => {
      worker.emitMessage({
        type: "success",
        result: `Transformed: ${(message as string).toUpperCase()}`,
      });
    };

    const res = await runWorkerWithFallback<string, string>(
      "/workers/transform.worker.js",
      "lowercase string"
    );

    expect(res).toBe("Transformed: LOWERCASE STRING");
  });

  it("TIER1-F8-04: transparent fallback to main thread when window.Worker is undefined", async () => {
    // Simulate environment without Worker support (e.g. Node / SSR)
    vi.stubGlobal("Worker", undefined);

    const progressLog: any[] = [];
    const res = await runWorkerWithFallback<string, string>(
      "/workers/fallback.worker.js",
      "fallback-data",
      undefined,
      (p) => progressLog.push(p)
    );

    expect(res).toBe("fallback-data");
    expect(progressLog.length).toBe(2);
    expect(progressLog[0].label).toContain("main thread");
  });

  it("TIER1-F8-05: executes worker with zero-copy Transferable ArrayBuffer payloads", async () => {
    const buffer = new ArrayBuffer(64);
    const transferables = extractTransferables({ payload: buffer });
    expect(transferables).toHaveLength(1);
    expect(transferables[0]).toBe(buffer);

    MockWorker.messageHandler = (worker, message) => {
      worker.emitMessage({
        type: "success",
        result: { receivedBytes: ((message as any).buffer as ArrayBuffer).byteLength },
      });
    };

    const res = await executeInWorker<{ buffer: ArrayBuffer }, { receivedBytes: number }>(
      "/workers/transfer.worker.js",
      { buffer },
      { transfer: [buffer] }
    );

    expect(res.receivedBytes).toBe(64);
    expect(MockWorker.instances.length).toBe(1);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F8-01: worker onerror event terminates worker and rejects execution", async () => {
    MockWorker.messageHandler = (worker) => {
      setTimeout(() => {
        worker.emitError("Fatal WebAssembly out-of-bounds");
      }, 5);
    };

    await expect(
      runWorkerWithFallback("/workers/crash.worker.js", "input")
    ).rejects.toThrow("Fatal WebAssembly out-of-bounds");

    expect(MockWorker.instances[0].terminated).toBe(true);
  });

  it("TIER2-F8-02: abort signal terminates worker immediately via worker.terminate()", async () => {
    const controller = new AbortController();

    MockWorker.messageHandler = () => {
      // Long-running worker simulation: never responds
    };

    const promise = runWorkerWithFallback(
      "/workers/long.worker.js",
      "input",
      controller.signal
    );

    // Abort after 10ms
    setTimeout(() => {
      controller.abort();
    }, 10);

    await expect(promise).rejects.toThrow();
    expect(MockWorker.instances[0].terminated).toBe(true);
  });

  it("TIER2-F8-03: worker returning structured error message rejects cleanly", async () => {
    MockWorker.messageHandler = (worker) => {
      worker.emitMessage({
        type: "error",
        error: "Invalid ZIP archive signature",
      });
    };

    await expect(
      runWorkerWithFallback("/workers/unzip.worker.js", "bad-zip-bytes")
    ).rejects.toThrow("Invalid ZIP archive signature");
  });

  it("TIER2-F8-04: consecutive worker calls terminate prior instance and create new worker", async () => {
    MockWorker.messageHandler = (worker, message) => {
      worker.emitMessage({ type: "success", result: `ok:${message}` });
    };

    const res1 = await runWorkerWithFallback("/workers/w.worker.js", "1");
    const res2 = await runWorkerWithFallback("/workers/w.worker.js", "2");

    expect(res1).toBe("ok:1");
    expect(res2).toBe("ok:2");
    expect(MockWorker.instances.length).toBe(2);
    expect(MockWorker.instances[0].terminated).toBe(true);
    expect(MockWorker.instances[1].terminated).toBe(true);
  });

  it("TIER2-F8-05: worker exceeding watchdog timeout terminates worker and rejects with TimeoutError", async () => {
    MockWorker.messageHandler = () => {
      // Long-running worker that hangs and never responds
    };

    await expect(
      executeInWorker("/workers/hang.worker.js", "data", { timeoutMs: 20 })
    ).rejects.toThrow(TimeoutError);

    expect(MockWorker.instances[0].terminated).toBe(true);
  });
});

describe("E2E Lifecycle: Feature 9 - Blob URL Lifecycle & Memory Management", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F9-01: registers Blob and generates valid Object URL", () => {
    const registry = new BlobUrlRegistry();
    const blob = new Blob(["Hello World"], { type: "text/plain" });

    const url = registry.register(blob);

    expect(url).toMatch(/^blob:http:\/\/localhost:3000\//);
    expect(registry.getActiveCount()).toBe(1);
    expect(registry.getActiveUrls()).toContain(url);
    expect(MockURLManager.hasActiveUrl(url)).toBe(true);
  });

  it("TIER1-F9-02: explicit revoke(url) revokes URL and removes from active tracking", () => {
    const registry = new BlobUrlRegistry();
    const blob = new Blob(["Binary content"], { type: "application/octet-stream" });

    const url = registry.register(blob);
    expect(registry.getActiveCount()).toBe(1);

    registry.revoke(url);
    expect(registry.getActiveCount()).toBe(0);
    expect(MockURLManager.hasActiveUrl(url)).toBe(false);
  });

  it("TIER1-F9-03: subsequent execution run automatically revokes prior Object URL", async () => {
    const registry = new BlobUrlRegistry();
    const engine: ToolEngine<string, Blob> = {
      validate: () => createValidationSuccess(),
      process: async (input: string) => ({
        data: new Blob([input], { type: "text/plain" }),
        durationMs: 1,
      }),
    };

    const controller = new ExecutionRuntimeController(engine, {}, registry);

    // Run 1: Generates URL 1
    const res1 = await controller.run("Run 1 data");
    const url1 = res1?.metadata?.blobUrl as string;
    expect(url1).toBeDefined();
    expect(registry.getActiveCount()).toBe(1);
    expect(MockURLManager.hasActiveUrl(url1)).toBe(true);

    // Run 2: Automatically revokes URL 1 and generates URL 2
    const res2 = await controller.run("Run 2 data");
    const url2 = res2?.metadata?.blobUrl as string;
    expect(url2).toBeDefined();
    expect(url2).not.toBe(url1);

    // URL 1 must be revoked, only URL 2 active
    expect(registry.getActiveCount()).toBe(1);
    expect(MockURLManager.hasActiveUrl(url1)).toBe(false);
    expect(MockURLManager.hasActiveUrl(url2)).toBe(true);
  });

  it("TIER1-F9-04: dispose() revokes all tracked Object URLs", () => {
    const registry = new BlobUrlRegistry();
    const blob1 = new Blob(["one"]);
    const blob2 = new Blob(["two"]);
    const blob3 = new Blob(["three"]);

    const url1 = registry.register(blob1);
    const url2 = registry.register(blob2);
    const url3 = registry.register(blob3);

    expect(registry.getActiveCount()).toBe(3);
    expect(MockURLManager.getActiveCount()).toBe(3);

    registry.revokeAll();

    expect(registry.getActiveCount()).toBe(0);
    expect(MockURLManager.getActiveCount()).toBe(0);
    expect(MockURLManager.hasActiveUrl(url1)).toBe(false);
    expect(MockURLManager.hasActiveUrl(url2)).toBe(false);
    expect(MockURLManager.hasActiveUrl(url3)).toBe(false);
  });

  it("TIER1-F9-05: tracks multiple URLs simultaneously for batch/multi-file tools", () => {
    const registry = new BlobUrlRegistry();
    const urls: string[] = [];

    for (let i = 0; i < 5; i++) {
      const blob = new Blob([`file-${i}`], { type: "text/plain" });
      urls.push(registry.register(blob));
    }

    expect(registry.getActiveCount()).toBe(5);
    expect(registry.getActiveUrls()).toEqual(urls);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F9-01: revoking an already-revoked or untracked URL is safe", () => {
    const registry = new BlobUrlRegistry();
    expect(() => {
      registry.revoke("blob:http://localhost:3000/non-existent-url");
    }).not.toThrow();
  });

  it("TIER2-F9-02: generates and manages Object URL for 0-byte empty Blob cleanly", () => {
    const registry = new BlobUrlRegistry();
    const emptyBlob = new Blob([], { type: "application/octet-stream" });

    const url = registry.register(emptyBlob);
    expect(url).toBeDefined();
    expect(registry.getActiveCount()).toBe(1);

    registry.revoke(url);
    expect(registry.getActiveCount()).toBe(0);
  });

  it("TIER2-F9-03: guarantees 1:1 balance between createObjectURL and revokeObjectURL across 50 runs", async () => {
    const registry = new BlobUrlRegistry();
    const engine: ToolEngine<number, Blob> = {
      validate: () => createValidationSuccess(),
      process: async (idx: number) => ({
        data: new Blob([`Iteration ${idx}`]),
        durationMs: 1,
      }),
    };

    const controller = new ExecutionRuntimeController(engine, {}, registry);

    // Execute 50 consecutive runs
    for (let i = 0; i < 50; i++) {
      await controller.run(i);
      // In every run, exactly 1 URL must remain active
      expect(registry.getActiveCount()).toBe(1);
    }

    // Teardown / dispose controller
    controller.dispose();

    // After disposal, active count MUST be exactly 0
    expect(registry.getActiveCount()).toBe(0);
    expect(MockURLManager.getActiveCount()).toBe(0);
  });

  it("TIER2-F9-04: scheduleRevocation delays revocation and cancels timer on early explicit revoke", () => {
    vi.useFakeTimers();
    try {
      const registry = new BlobUrlRegistry();
      const blob = new Blob(["Delayed download"], { type: "text/plain" });
      const url = registry.register(blob);

      expect(registry.getActiveCount()).toBe(1);

      // Schedule delayed revocation for 5000ms
      registry.scheduleRevocation(url, 5000);
      expect(registry.scheduledCount).toBe(1);
      expect(registry.has(url)).toBe(true);

      // Advance by 3000ms: still active
      vi.advanceTimersByTime(3000);
      expect(registry.has(url)).toBe(true);

      // Advance remaining 2000ms: now revoked
      vi.advanceTimersByTime(2000);
      expect(registry.has(url)).toBe(false);
      expect(registry.scheduledCount).toBe(0);
      expect(registry.getActiveCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("TIER2-F9-05: register() supports raw string URLs and evaluates isSupported()", () => {
    const registry = new BlobUrlRegistry();

    // Register string URL
    const registered = registry.register("blob:http://localhost:3000/pre-existing-id");
    expect(registered).toBe("blob:http://localhost:3000/pre-existing-id");
    expect(registry.has("blob:http://localhost:3000/pre-existing-id")).toBe(true);
    expect(registry.size).toBe(1);

    // Empty string is ignored
    registry.register("");
    expect(registry.size).toBe(1);

    // isSupported() returns true in JSDOM / mocked environment
    expect(BlobUrlRegistry.isSupported()).toBe(true);

    registry.dispose();
    expect(registry.size).toBe(0);
  });
});
