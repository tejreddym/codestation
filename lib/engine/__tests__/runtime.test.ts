// @vitest-environment jsdom
/**
 * Code Station — Tool Engine Runtime Unit & Lifecycle Test Suite
 * lib/engine/__tests__/runtime.test.ts
 *
 * Verifies Milestone 2 core runtime components:
 * - runtime.ts (executeTool, ExecutionRuntimeController, ValidationError, CancellationError, TimeoutError)
 * - blobRegistry.ts (BlobUrlRegistry)
 * - workerRunner.ts (executeInWorker, createWorkerRunnerHelper, createToolContext)
 * - useToolEngine.ts (useToolEngine hook)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  ToolDefinition,
  ToolEngine,
  ToolResult,
  ToolProgress,
  ToolExecutionState,
} from "../types";
import {
  createValidationSuccess,
  createValidationError,
} from "../types";
import {
  executeTool,
  ExecutionRuntimeController,
  ValidationError,
  CancellationError,
  TimeoutError,
  isToolEngineError,
  isValidationError,
  isCancellationError,
  isTimeoutError,
  safeDispose,
  safeCancel,
} from "../runtime";
import { BlobUrlRegistry } from "../blobRegistry";
import {
  executeInWorker,
  createWorkerRunnerHelper,
  createToolContext,
  WorkerExecutionError,
  WorkerNotSupportedError,
} from "../workerRunner";
import { useToolEngine } from "../useToolEngine";

// ============================================================================
// Test Utilities & Mocks
// ============================================================================

class MockURLTracker {
  static createdUrls = new Set<string>();
  static revokedUrls = new Set<string>();
  private static origCreate: typeof URL.createObjectURL;
  private static origRevoke: typeof URL.revokeObjectURL;
  private static id = 0;

  static install() {
    this.origCreate = URL.createObjectURL;
    this.origRevoke = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn((_blob: Blob | File) => {
      this.id++;
      const url = `blob:http://localhost:3000/mock-blob-${Date.now()}-${this.id}`;
      this.createdUrls.add(url);
      return url;
    });

    URL.revokeObjectURL = vi.fn((url: string) => {
      this.revokedUrls.add(url);
      this.createdUrls.delete(url);
    });
  }

  static reset() {
    this.createdUrls.clear();
    this.revokedUrls.clear();
    this.id = 0;
  }

  static restore() {
    this.reset();
    if (this.origCreate) URL.createObjectURL = this.origCreate;
    if (this.origRevoke) URL.revokeObjectURL = this.origRevoke;
  }
}

class MockWorker implements EventTarget {
  static instances: MockWorker[] = [];
  public url: string;
  public terminated = false;
  public messagesPosted: unknown[] = [];
  public onmessage: ((this: Worker, ev: MessageEvent) => void) | null = null;
  public onerror: ((this: AbstractWorker, ev: ErrorEvent) => void) | null = null;
  public onmessageerror: ((this: Worker, ev: MessageEvent) => void) | null = null;

  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  constructor(url: string | URL) {
    this.url = String(url);
    MockWorker.instances.push(this);
  }

  postMessage(message: unknown, _transfer?: Transferable[]): void {
    if (this.terminated) throw new Error("Worker terminated");
    this.messagesPosted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  emitMessage(data: unknown): void {
    if (this.terminated) return;
    const ev = { data, type: "message" } as MessageEvent;
    this.onmessage?.call(this as unknown as Worker, ev);
    this.listeners.get("message")?.forEach((l) => {
      if (typeof l === "function") l(ev);
      else l.handleEvent(ev);
    });
  }

  emitError(message: string): void {
    if (this.terminated) return;
    const ev = { message, type: "error" } as ErrorEvent;
    this.onerror?.call(this as unknown as AbstractWorker, ev);
    this.listeners.get("error")?.forEach((l) => {
      if (typeof l === "function") l(ev);
      else l.handleEvent(ev);
    });
  }

  static reset() {
    this.instances.forEach((w) => w.terminate());
    this.instances = [];
  }
}

function createTestDefinition(overrides?: Partial<ToolDefinition>): ToolDefinition {
  return {
    id: "test-tool",
    name: "Test Tool",
    category: "data",
    description: "Tool for testing runtime engine",
    processing: "local",
    offlineSupported: true,
    input: [
      { name: "text", label: "Text Input", control: "text", defaultValue: "initial text" },
      { name: "count", label: "Count", control: "number", defaultValue: 5 },
    ],
    output: [
      { id: "output", label: "Output", type: "text" },
    ],
    ...overrides,
  };
}

function createTestEngine(overrides?: Partial<ToolEngine>): ToolEngine {
  return {
    validate: vi.fn(() => createValidationSuccess()),
    process: vi.fn(async (input: unknown) => ({
      data: `Processed: ${JSON.stringify(input)}`,
      durationMs: 5,
    })),
    cancel: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// Suite 1: Runtime Controller State Machine (executeTool)
// ============================================================================

describe("Suite 1: Runtime Controller State Machine (executeTool)", () => {
  beforeEach(() => {
    MockURLTracker.install();
    MockURLTracker.reset();
  });

  afterEach(() => {
    MockURLTracker.restore();
  });

  it("1.1: Executes valid tool through full lifecycle and returns result", async () => {
    const def = createTestDefinition();
    const statesObserved: ToolExecutionState[] = [];
    const engine = createTestEngine({
      process: async (input: unknown) => ({
        data: `Echo: ${input}`,
        durationMs: 12,
      }),
    });

    const result = await executeTool(def, engine, "hello", {
      onStateChange: (s) => statesObserved.push(s),
    });

    expect(result.data).toBe("Echo: hello");
    expect(result.durationMs).toBe(12);
    expect(result.output).toBe("Echo: hello"); // Normalization check
    expect(statesObserved).toEqual(["validating", "processing", "success"]);
  });

  it("1.2: Calculates accurate non-negative durationMs using performance.now()", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async () => {
        await new Promise((r) => setTimeout(r, 15));
        return { data: "done", durationMs: -1 };
      },
    });

    const result = await executeTool(def, engine, {});
    expect(result.durationMs).toBeGreaterThanOrEqual(10);
  });

  it("1.3: Normalizes output field to equal data for backwards compatibility", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async () => ({
        data: "payload",
        durationMs: 5,
      }),
    });

    const result = await executeTool(def, engine, {});
    expect(result.output).toBe("payload");
    expect(result.data).toBe("payload");
  });

  it("1.4: Handles process() returning custom warnings and metadata", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async () => ({
        data: "result",
        durationMs: 5,
        warnings: ["Line 3 exceeds recommended length"],
        metadata: { rowCount: 150 },
      }),
    });

    const result = await executeTool(def, engine, {});
    expect(result.warnings).toEqual(["Line 3 exceeds recommended length"]);
    expect(result.metadata?.rowCount).toBe(150);
  });

  it("1.5: Handles runtime exception in process() and rethrows cleanly", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async () => {
        throw new Error("Internal processing buffer overflow");
      },
    });

    await expect(executeTool(def, engine, {})).rejects.toThrow(
      "Internal processing buffer overflow"
    );
  });

  it("1.6: Auto-registers Blob in blobRegistry when provided", async () => {
    const def = createTestDefinition();
    const registry = new BlobUrlRegistry();
    const testBlob = new Blob(["test-data"], { type: "text/plain" });

    const engine = createTestEngine({
      process: async () => ({
        data: testBlob,
        durationMs: 5,
      }),
    });

    const result = await executeTool(def, engine, {}, { blobRegistry: registry });
    expect(registry.size).toBe(1);
    expect(result.metadata?.blobUrl).toBeDefined();
    expect(registry.has(result.metadata?.blobUrl as string)).toBe(true);
  });
});

// ============================================================================
// Suite 2: Pre-Execution Validation Gate
// ============================================================================

describe("Suite 2: Pre-Execution Validation Gate", () => {
  it("2.1: Synchronous validate() returning invalid blocks process() from executing", async () => {
    const def = createTestDefinition();
    let processCalled = false;
    const engine = createTestEngine({
      validate: () => createValidationError("Input cannot be empty"),
      process: async () => {
        processCalled = true;
        return { data: "never", durationMs: 0 };
      },
    });

    await expect(executeTool(def, engine, "")).rejects.toThrow(ValidationError);
    expect(processCalled).toBe(false);
  });

  it("2.2: Asynchronous validate() returning invalid blocks process() from executing", async () => {
    const def = createTestDefinition();
    let processCalled = false;
    const engine = createTestEngine({
      validate: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return createValidationError("Async validation failed");
      },
      process: async () => {
        processCalled = true;
        return { data: "never", durationMs: 0 };
      },
    });

    await expect(executeTool(def, engine, "")).rejects.toThrow(ValidationError);
    expect(processCalled).toBe(false);
  });

  it("2.3: Thrown error in validate() is caught and wrapped into ValidationError", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      validate: () => {
        throw new SyntaxError("Unexpected token in input string");
      },
    });

    try {
      await executeTool(def, engine, "malformed");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).result.valid).toBe(false);
      expect((err as ValidationError).message).toContain("Unexpected token");
    }
  });

  it("2.4: Preserves structured diagnostics (field, line, column, severity) on ValidationError", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      validate: () => ({
        valid: false,
        diagnostics: [
          {
            field: "text",
            line: 4,
            column: 12,
            message: "Invalid syntax",
            severity: "error",
          },
        ],
      }),
    });

    try {
      await executeTool(def, engine, "bad");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const valErr = err as ValidationError;
      expect(valErr.result.diagnostics?.[0].line).toBe(4);
      expect(valErr.result.diagnostics?.[0].column).toBe(12);
      expect(valErr.result.diagnostics?.[0].field).toBe("text");
    }
  });
});

// ============================================================================
// Suite 3: Cancellation & Abort Mechanics
// ============================================================================

describe("Suite 3: Cancellation & Abort Mechanics", () => {
  it("3.1: Calling abort() on signal stops execution and throws CancellationError", async () => {
    const def = createTestDefinition();
    const controller = new AbortController();

    const engine = createTestEngine({
      process: async (_input, context) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ data: "done", durationMs: 100 }), 100);
          context.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new CancellationError());
          });
        });
      },
    });

    const promise = executeTool(def, engine, {}, { signal: controller.signal });
    setTimeout(() => controller.abort(), 15);

    await expect(promise).rejects.toThrow(CancellationError);
  });

  it("3.2: Linked signal aborts internal controller and calls engine.cancel?.()", async () => {
    const def = createTestDefinition();
    const controller = new AbortController();
    let cancelCalled = false;

    const engine = createTestEngine({
      cancel: () => {
        cancelCalled = true;
      },
      process: async (_input, context) => {
        return new Promise((_, reject) => {
          context.signal.addEventListener("abort", () => reject(new CancellationError()));
        });
      },
    });

    const promise = executeTool(def, engine, {}, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toThrow(CancellationError);
    expect(cancelCalled).toBe(true);
  });

  it("3.3: Pre-aborted signal passed in options throws CancellationError immediately", async () => {
    const def = createTestDefinition();
    const controller = new AbortController();
    controller.abort();

    let validateCalled = false;
    const engine = createTestEngine({
      validate: () => {
        validateCalled = true;
        return createValidationSuccess();
      },
    });

    await expect(
      executeTool(def, engine, {}, { signal: controller.signal })
    ).rejects.toThrow(CancellationError);
    expect(validateCalled).toBe(false);
  });
});

// ============================================================================
// Suite 4: Timeout Handling
// ============================================================================

describe("Suite 4: Timeout Handling", () => {
  it("4.1: Exceeding timeoutMs aborts signal and throws TimeoutError", async () => {
    const def = createTestDefinition();
    let cancelCalled = false;

    const engine = createTestEngine({
      cancel: () => {
        cancelCalled = true;
      },
      process: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return { data: "done", durationMs: 200 };
      },
    });

    await expect(
      executeTool(def, engine, {}, { timeoutMs: 30 })
    ).rejects.toThrow(TimeoutError);
    expect(cancelCalled).toBe(true);
  });

  it("4.2: Fast execution completing before timeout clears timer safely", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { data: "fast", durationMs: 10 };
      },
    });

    const result = await executeTool(def, engine, {}, { timeoutMs: 500 });
    expect(result.data).toBe("fast");
  });
});

// ============================================================================
// Suite 5: BlobUrlRegistry URL Lifecycle & Memory Management
// ============================================================================

describe("Suite 5: BlobUrlRegistry URL Lifecycle & Memory Management", () => {
  beforeEach(() => {
    MockURLTracker.install();
    MockURLTracker.reset();
  });

  afterEach(() => {
    MockURLTracker.restore();
  });

  it("5.1: create(blob) generates tracked URL and registers in Set", () => {
    const registry = new BlobUrlRegistry();
    const blob = new Blob(["hello"], { type: "text/plain" });

    const url = registry.create(blob);
    expect(url).toContain("blob:");
    expect(registry.has(url)).toBe(true);
    expect(registry.size).toBe(1);
    expect(registry.getActiveCount()).toBe(1);
    expect(registry.getUrls()).toContain(url);
  });

  it("5.2: register(url) tracks externally generated Object URL", () => {
    const registry = new BlobUrlRegistry();
    const externalUrl = URL.createObjectURL(new Blob(["data"]));

    registry.register(externalUrl);
    expect(registry.has(externalUrl)).toBe(true);
    expect(registry.size).toBe(1);
  });

  it("5.3: revoke(url) revokes URL and removes from tracking", () => {
    const registry = new BlobUrlRegistry();
    const url = registry.create(new Blob(["test"]));

    expect(registry.size).toBe(1);
    registry.revoke(url);
    expect(registry.size).toBe(0);
    expect(registry.has(url)).toBe(false);
    expect(MockURLTracker.revokedUrls.has(url)).toBe(true);
  });

  it("5.4: revokeAll() revokes 100% of tracked URLs and resets size to 0", () => {
    const registry = new BlobUrlRegistry();
    const u1 = registry.create(new Blob(["1"]));
    const u2 = registry.create(new Blob(["2"]));
    const u3 = registry.create(new Blob(["3"]));

    expect(registry.size).toBe(3);
    registry.revokeAll();
    expect(registry.size).toBe(0);
    expect(MockURLTracker.revokedUrls.has(u1)).toBe(true);
    expect(MockURLTracker.revokedUrls.has(u2)).toBe(true);
    expect(MockURLTracker.revokedUrls.has(u3)).toBe(true);
  });

  it("5.5: revoking untracked or duplicate URL is a safe no-op", () => {
    const registry = new BlobUrlRegistry();
    expect(() => registry.revoke("blob:untracked")).not.toThrow();
  });

  it("5.6: scheduleRevocation(url, delayMs) delays revocation for safe download dialogs", async () => {
    const registry = new BlobUrlRegistry();
    const url = registry.create(new Blob(["download data"]));

    registry.scheduleRevocation(url, 20);
    expect(registry.has(url)).toBe(true);
    expect(registry.scheduledCount).toBe(1);

    await new Promise((r) => setTimeout(r, 40));
    expect(registry.has(url)).toBe(false);
    expect(registry.scheduledCount).toBe(0);
  });

  it("5.7: Fallback when URL.createObjectURL is undefined creates synthetic mock URL", () => {
    const orig = URL.createObjectURL;
    // @ts-expect-error test intentional removal
    URL.createObjectURL = undefined;

    try {
      const registry = new BlobUrlRegistry();
      const fallbackUrl = registry.create(new Blob(["mock-content"]));
      expect(fallbackUrl).toContain("blob:mock-");
      expect(registry.has(fallbackUrl)).toBe(true);
      expect(registry.size).toBe(1);
    } finally {
      URL.createObjectURL = orig;
    }
  });
});

// ============================================================================
// Suite 6: Worker Offloading Runner (executeInWorker)
// ============================================================================

describe("Suite 6: Worker Offloading Runner (executeInWorker)", () => {
  beforeEach(() => {
    MockWorker.reset();
    vi.stubGlobal("Worker", MockWorker);
  });

  afterEach(() => {
    MockWorker.reset();
    vi.unstubAllGlobals();
  });

  it("6.1: Instantiates worker and sends payload", async () => {
    const promise = executeInWorker("worker.js", { action: "format" });
    const worker = MockWorker.instances[0];

    expect(worker).toBeDefined();
    expect(worker.url).toBe("worker.js");
    expect(worker.messagesPosted).toEqual([{ action: "format" }]);

    worker.emitMessage({ result: "success payload" });
    const result = await promise;
    expect(result).toBe("success payload");
  });

  it("6.2: Standardized progress messages ({ type: 'progress' }) forwarded to onProgress", async () => {
    const progressList: ToolProgress[] = [];
    const promise = executeInWorker("worker.js", {}, {
      onProgress: (p) => progressList.push(p),
    });

    const worker = MockWorker.instances[0];
    worker.emitMessage({ type: "progress", percent: 50, label: "Halfway" });
    worker.emitMessage({ type: "progress", percent: 100, label: "Complete" });
    worker.emitMessage({ result: "done" });

    await promise;
    expect(progressList).toEqual([
      { percent: 50, label: "Halfway", stage: undefined },
      { percent: 100, label: "Complete", stage: undefined },
    ]);
  });

  it("6.3: Handles structured error payload ({ error }) and rejects", async () => {
    const promise = executeInWorker("worker.js", {});
    const worker = MockWorker.instances[0];

    worker.emitMessage({ error: "Syntax error in SQL DDL" });
    await expect(promise).rejects.toThrow("Syntax error in SQL DDL");
    expect(worker.terminated).toBe(true);
  });

  it("6.4: worker.onerror event terminates worker and rejects", async () => {
    const promise = executeInWorker("worker.js", {});
    const worker = MockWorker.instances[0];

    worker.emitError("Script evaluation failed");
    await expect(promise).rejects.toThrow("Worker execution error: Script evaluation failed");
    expect(worker.terminated).toBe(true);
  });

  it("6.5: AbortSignal terminates worker immediately via worker.terminate()", async () => {
    const controller = new AbortController();
    const promise = executeInWorker("worker.js", {}, { signal: controller.signal });
    const worker = MockWorker.instances[0];

    controller.abort();
    await expect(promise).rejects.toThrow(CancellationError);
    expect(worker.terminated).toBe(true);
  });

  it("6.6: Timeout terminates worker via worker.terminate() and throws TimeoutError", async () => {
    const promise = executeInWorker("worker.js", {}, { timeoutMs: 20 });
    const worker = MockWorker.instances[0];

    await expect(promise).rejects.toThrow(TimeoutError);
    expect(worker.terminated).toBe(true);
  });

  it("6.7: Missing Worker in environment rejects with WorkerNotSupportedError when no fallback", async () => {
    vi.unstubAllGlobals();
    const origWorker = globalThis.Worker;
    // @ts-expect-error test intentional removal
    delete globalThis.Worker;

    try {
      await expect(executeInWorker("worker.js", {})).rejects.toThrow(
        WorkerNotSupportedError
      );
    } finally {
      globalThis.Worker = origWorker;
    }
  });

  it("6.8: Missing Worker invokes custom fallback handler when provided", async () => {
    vi.unstubAllGlobals();
    const origWorker = globalThis.Worker;
    // @ts-expect-error test intentional removal
    delete globalThis.Worker;

    try {
      const fallback = vi.fn(async (payload: unknown) => `fallback-${payload}`);
      const res = await executeInWorker("worker.js", "data", { fallback });
      expect(res).toBe("fallback-data");
      expect(fallback).toHaveBeenCalledWith("data", expect.any(Object));
    } finally {
      globalThis.Worker = origWorker;
    }
  });

  it("6.9: createToolContext helper constructs ToolContext with linked runInWorker", async () => {
    const controller = new AbortController();
    const progressLog: ToolProgress[] = [];
    const context = createToolContext({
      signal: controller.signal,
      reportProgress: (p) => progressLog.push(p),
    });

    expect(context.signal).toBe(controller.signal);
    expect(typeof context.reportProgress).toBe("function");
    expect(typeof context.runInWorker).toBe("function");
    expect(context.runWorker).toBe(context.runInWorker);
  });
});

// ============================================================================
// Suite 7: useToolEngine React Lifecycle Hook
// ============================================================================

describe("Suite 7: useToolEngine React Lifecycle Hook", () => {
  beforeEach(() => {
    MockURLTracker.install();
    MockURLTracker.reset();
  });

  afterEach(() => {
    MockURLTracker.restore();
  });

  it("7.1: Initializes in idle state with computed defaults from definition.input + initialInput", () => {
    const def = createTestDefinition();
    const engine = createTestEngine();

    const { result } = renderHook(() =>
      useToolEngine(def, engine, { text: "custom initial" })
    );

    expect(result.current.state).toBe("idle");
    expect(result.current.status).toBe("idle");
    expect(result.current.isBusy).toBe(false);
    expect(result.current.input.text).toBe("custom initial");
    expect(result.current.input.count).toBe(5);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toEqual({});
  });

  it("7.2: run() executes valid tool, transitions states, and sets success", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async (input: unknown) => ({
        data: `Echo: ${(input as { text: string }).text}`,
        durationMs: 10,
      }),
    });

    const { result } = renderHook(() => useToolEngine(def, engine));

    let runPromise: Promise<ToolResult | null>;
    act(() => {
      runPromise = result.current.run();
    });

    await act(async () => {
      await runPromise;
    });

    expect(result.current.state).toBe("success");
    expect(result.current.result?.data).toBe("Echo: initial text");
    expect(result.current.isBusy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("7.3: run() on invalid input sets status to error and sets validation diagnostics", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      validate: () => createValidationError("Text cannot be empty", [
        { field: "text", message: "Text cannot be empty", severity: "error" },
      ]),
    });

    const { result } = renderHook(() => useToolEngine(def, engine));

    await act(async () => {
      const res = await result.current.run();
      expect(res).toBeNull();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.validation?.valid).toBe(false);
    expect(result.current.error).toBeInstanceOf(ValidationError);
  });

  it("7.4: run(overrideInput) updates hook input state and executes with override", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async (input: unknown) => ({
        data: `Result: ${(input as { text: string }).text}`,
        durationMs: 5,
      }),
    });

    const { result } = renderHook(() => useToolEngine(def, engine));

    await act(async () => {
      await result.current.run({ text: "overridden sample" });
    });

    expect(result.current.input.text).toBe("overridden sample");
    expect(result.current.result?.data).toBe("Result: overridden sample");
  });

  it("7.5: setFieldValue() mutates single field and clears field validation diagnostic", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      validate: () => createValidationError("Invalid text", [
        { field: "text", message: "Invalid text", severity: "error" },
      ]),
    });

    const { result } = renderHook(() => useToolEngine(def, engine));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.validation?.diagnostics?.length).toBe(1);

    act(() => {
      result.current.setFieldValue("text", "new valid text");
    });

    expect(result.current.input.text).toBe("new valid text");
    expect(result.current.validation?.diagnostics?.length).toBe(0);
    expect(result.current.validation?.valid).toBe(true);
  });

  it("7.6: cancel() aborts in-flight execution and sets status to cancelled", async () => {
    const def = createTestDefinition();
    let cancelCalled = false;
    const engine = createTestEngine({
      cancel: () => {
        cancelCalled = true;
      },
      process: async (_input, context) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ data: "done", durationMs: 100 }), 100);
          context.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new CancellationError());
          });
        });
      },
    });

    const { result } = renderHook(() => useToolEngine(def, engine));

    act(() => {
      result.current.run();
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.state).toBe("cancelled");
    expect(cancelCalled).toBe(true);
  });

  it("7.7: reset() cancels execution, clears results/errors, revokes blob URLs, and restores defaults", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async () => ({
        data: new Blob(["sample content"]),
        durationMs: 5,
      }),
    });

    const { result } = renderHook(() => useToolEngine(def, engine));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state).toBe("success");
    expect(result.current.blobUrls.size).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.blobUrls.size).toBe(0);
    expect(result.current.input.text).toBe("initial text");
  });

  it("7.8: Unmounting component aborts in-flight run, disposes engine, and revokes all blob URLs", async () => {
    const def = createTestDefinition();
    let disposeCalled = false;
    const engine = createTestEngine({
      dispose: () => {
        disposeCalled = true;
      },
      process: async () => ({
        data: new Blob(["unmount test"]),
        durationMs: 5,
      }),
    });

    const { result, unmount } = renderHook(() => useToolEngine(def, engine));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.blobUrls.size).toBe(1);

    act(() => {
      unmount();
    });

    expect(disposeCalled).toBe(true);
  });

  it("7.9: Changing definition.id aborts run, disposes prior engine, revokes URLs, and resets state", async () => {
    const def1 = createTestDefinition({ id: "tool-1" });
    const def2 = createTestDefinition({
      id: "tool-2",
      input: [{ name: "newField", label: "New Field", control: "text", defaultValue: "tool-2-default" }],
    });

    const disposedTools: string[] = [];
    const engine1 = createTestEngine({
      dispose: () => disposedTools.push("tool-1"),
    });
    const engine2 = createTestEngine({
      dispose: () => disposedTools.push("tool-2"),
    });

    let currentDef = def1;
    let currentEngine = engine1;

    const { result, rerender } = renderHook(() => useToolEngine(currentDef, currentEngine));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.state).toBe("success");

    // Switch tool definition
    currentDef = def2;
    currentEngine = engine2;
    rerender();

    expect(disposedTools).toContain("tool-1");
    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.input.newField).toBe("tool-2-default");
  });

  it("7.10: Engine with throwing dispose() method does not crash unmount or tool-switching", () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      dispose: () => {
        throw new Error("Disposal explosion");
      },
    });

    const { unmount } = renderHook(() => useToolEngine(def, engine));

    expect(() => {
      act(() => {
        unmount();
      });
    }).not.toThrow();
  });

  it("7.11: Rapid consecutive run() calls handle race conditions cleanly", async () => {
    const def = createTestDefinition();
    const engine = createTestEngine({
      process: async (input: unknown) => {
        await new Promise((r) => setTimeout(r, 20));
        return { data: `Echo: ${(input as { text: string }).text}`, durationMs: 20 };
      },
    });

    const { result } = renderHook(() => useToolEngine(def, engine));

    await act(async () => {
      const p1 = result.current.run({ text: "first" });
      const p2 = result.current.run({ text: "second" });
      await Promise.all([p1, p2]);
    });

    expect(result.current.state).toBe("success");
    expect(result.current.result?.data).toBe("Echo: second");
  });
});

// ============================================================================
// Suite 8: ExecutionRuntimeController Stateful Controller Class
// ============================================================================

describe("Suite 8: ExecutionRuntimeController Stateful Controller Class", () => {
  beforeEach(() => {
    MockURLTracker.install();
    MockURLTracker.reset();
  });

  afterEach(() => {
    MockURLTracker.restore();
  });

  it("8.1: Transitions through deterministic states on run()", async () => {
    const statesObserved: ToolExecutionState[] = [];
    const engine = createTestEngine({
      process: async (input) => ({ data: `Controller: ${input}`, durationMs: 5 }),
    });

    const controller = new ExecutionRuntimeController(engine, {
      onStateChange: (s) => statesObserved.push(s),
    });

    expect(controller.state).toBe("idle");
    expect(controller.isBusy).toBe(false);

    const result = await controller.run("hello");
    expect(result?.data).toBe("Controller: hello");
    expect(statesObserved).toEqual(["validating", "processing", "success"]);
    expect(controller.state).toBe("success");
    expect(controller.isBusy).toBe(false);
  });

  it("8.2: Validation gate blocks process() when input is invalid", async () => {
    let processInvoked = false;
    const engine = createTestEngine({
      validate: (input) => {
        if (!input) return createValidationError("Input required");
        return createValidationSuccess();
      },
      process: async () => {
        processInvoked = true;
        return { data: "never", durationMs: 0 };
      },
    });

    const controller = new ExecutionRuntimeController(engine);
    const result = await controller.run("");

    expect(result).toBeNull();
    expect(processInvoked).toBe(false);
    expect(controller.state).toBe("error");
    expect(controller.validation?.valid).toBe(false);
  });

  it("8.3: cancel() aborts in-flight execution", async () => {
    let cancelInvoked = false;
    const engine = createTestEngine({
      cancel: () => {
        cancelInvoked = true;
      },
      process: async (_input, context) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ data: "ok", durationMs: 50 }), 50);
          context.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new CancellationError());
          });
        });
      },
    });

    const controller = new ExecutionRuntimeController(engine);
    const runPromise = controller.run("task");

    setTimeout(() => controller.cancel(), 10);
    const result = await runPromise;

    expect(result).toBeNull();
    expect(controller.state).toBe("cancelled");
    expect(cancelInvoked).toBe(true);
  });

  it("8.4: reset() returns controller to idle state", async () => {
    const engine = createTestEngine({
      process: async () => ({ data: "result", durationMs: 5 }),
    });

    const controller = new ExecutionRuntimeController(engine);
    await controller.run("test");
    expect(controller.state).toBe("success");

    controller.reset();
    expect(controller.state).toBe("idle");
    expect(controller.result).toBeNull();
    expect(controller.error).toBeNull();
    expect(controller.validation).toBeNull();
  });

  it("8.5: dispose() disposes engine and clears blobs", () => {
    let disposeCalled = false;
    const engine = createTestEngine({
      dispose: () => {
        disposeCalled = true;
      },
    });

    const controller = new ExecutionRuntimeController(engine);
    controller.dispose();
    expect(disposeCalled).toBe(true);
  });
});

// ============================================================================
// Suite 9: Error Hierarchy & Type Guards & Safe Teardown
// ============================================================================

describe("Suite 9: Error Hierarchy & Type Guards & Safe Teardown", () => {
  it("9.1: Type guards identify ToolEngineError subclasses accurately", () => {
    const valErr = new ValidationError(createValidationError("Field error"));
    const cancelErr = new CancellationError("Aborted");
    const timeoutErr = new TimeoutError(5000);
    const genericErr = new Error("Generic");

    expect(isToolEngineError(valErr)).toBe(true);
    expect(isToolEngineError(cancelErr)).toBe(true);
    expect(isToolEngineError(timeoutErr)).toBe(true);
    expect(isToolEngineError(genericErr)).toBe(false);

    expect(isValidationError(valErr)).toBe(true);
    expect(isValidationError(cancelErr)).toBe(false);

    expect(isCancellationError(cancelErr)).toBe(true);
    expect(isCancellationError(valErr)).toBe(false);

    expect(isTimeoutError(timeoutErr)).toBe(true);
    expect(isTimeoutError(genericErr)).toBe(false);
  });

  it("9.2: safeDispose catches thrown error without re-throwing", () => {
    expect(() => {
      safeDispose({
        dispose: () => {
          throw new Error("Disposal explosion");
        },
      });
    }).not.toThrow();

    expect(() => safeDispose(null)).not.toThrow();
    expect(() => safeDispose(undefined)).not.toThrow();
  });

  it("9.3: safeCancel catches thrown error without re-throwing", () => {
    expect(() => {
      safeCancel({
        cancel: () => {
          throw new Error("Cancel explosion");
        },
      });
    }).not.toThrow();

    expect(() => safeCancel(null)).not.toThrow();
    expect(() => safeCancel(undefined)).not.toThrow();
  });
});
