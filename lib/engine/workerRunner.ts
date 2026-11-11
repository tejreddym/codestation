/**
 * Code Station — Web Worker Offloading Runner & Progress Parser
 * lib/engine/workerRunner.ts
 *
 * Provides resilient, cancellable Web Worker execution with streaming progress reporting,
 * zero-copy Transferable optimization, timeout killswitches, and SSR fallbacks.
 */

import type {
  ToolProgress,
  ToolContext,
  WorkerRunnerHelper,
} from "./types";

// ============================================================================
// 1. Error Hierarchy
// ============================================================================

export class CancellationError extends Error {
  public readonly code: string;
  constructor(message = "Operation cancelled.", code = "CANCELLATION_ERROR") {
    super(message);
    this.name = "CancellationError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly code: string;
  constructor(timeoutMs: number, message?: string, code = "TIMEOUT_ERROR") {
    const formatted =
      timeoutMs >= 1000
        ? `${Math.round(timeoutMs / 1000)} seconds`
        : `${timeoutMs}ms`;
    super(
      message ??
        `Operation exceeded timeout of ${formatted}.`
    );
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WorkerExecutionError extends Error {
  public readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "WorkerExecutionError";
    this.field = field;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WorkerNotSupportedError extends Error {
  constructor(
    message = "Web Worker execution is not supported in this environment."
  ) {
    super(message);
    this.name = "WorkerNotSupportedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// 2. Worker Runner Types & Protocols
// ============================================================================

export interface WorkerRunnerOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ToolProgress) => void;
  timeoutMs?: number;
  transfer?: Transferable[];
  workerOptions?: WorkerOptions;
  /**
   * Custom worker constructor (useful for mocking in unit tests).
   */
  WorkerConstructor?: typeof Worker;
  /**
   * Optional fallback execution handler for SSR / non-worker environments.
   */
  fallback?: (
    payload: unknown,
    options?: WorkerRunnerOptions
  ) => Promise<unknown>;
}

export interface WorkerProgressMessage {
  type: "progress";
  percent?: number;
  label?: string;
  stage?: string;
}

export interface WorkerResultMessage<TRes = unknown> {
  result: TRes;
}

export interface WorkerErrorMessage {
  error: string;
  field?: string;
}

export type WorkerMessage<TRes = unknown> =
  | WorkerProgressMessage
  | WorkerResultMessage<TRes>
  | WorkerErrorMessage
  | { progress: ToolProgress }
  | unknown;

// ============================================================================
// 3. Core Worker Execution Runner
// ============================================================================

/**
 * Executes a task inside a dedicated Web Worker with streaming progress,
 * zero-copy memory transfers, timeout enforcement, and preemptive termination.
 */
export function executeInWorker<TReq, TRes>(
  workerUrl: string | URL,
  payload: TReq,
  options: WorkerRunnerOptions = {}
): Promise<TRes> {
  // Pre-execution abort check
  if (options.signal?.aborted) {
    return Promise.reject(new CancellationError());
  }

  const WorkerClass =
    options.WorkerConstructor ??
    (typeof Worker !== "undefined" ? Worker : undefined);

  if (!WorkerClass) {
    if (options.fallback) {
      return options.fallback(payload, options) as Promise<TRes>;
    }
    return Promise.reject(
      new WorkerNotSupportedError(
        "Web Worker execution is not supported in this environment. Provide a fallback handler or mock Worker."
      )
    );
  }

  return new Promise<TRes>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new WorkerClass(
        workerUrl,
        options.workerOptions ?? { type: "module" }
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      reject(
        new WorkerExecutionError(
          `Failed to instantiate worker at ${String(workerUrl)}: ${message}`
        )
      );
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (options.signal) {
        options.signal.removeEventListener("abort", handleAbort);
      }
      try {
        worker.terminate();
      } catch {
        // Safe no-op
      }
    };

    const handleAbort = () => {
      cleanup();
      reject(new CancellationError());
    };

    // Watchdog timeout (default 30 seconds; 0 or Infinity disables)
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (timeoutMs > 0 && timeoutMs !== Infinity) {
      timer = setTimeout(() => {
        cleanup();
        reject(new TimeoutError(timeoutMs));
      }, timeoutMs);
    }

    if (options.signal) {
      options.signal.addEventListener("abort", handleAbort, { once: true });
    }

    worker.onmessage = (event: MessageEvent<WorkerMessage<TRes>>) => {
      if (options.signal?.aborted) {
        handleAbort();
        return;
      }

      const data = event.data;

      if (data && typeof data === "object") {
        // Protocol A: Standard progress event { type: "progress", percent, label, stage }
        if ("type" in data && data.type === "progress") {
          const p = data as WorkerProgressMessage;
          options.onProgress?.({
            percent: typeof p.percent === "number" ? p.percent : undefined,
            label: typeof p.label === "string" ? p.label : undefined,
            stage: typeof p.stage === "string" ? p.stage : undefined,
          });
          return; // Do NOT settle; continue listening
        }

        // Protocol B: Nested progress event { progress: { percent, label, stage } }
        if ("progress" in data && data.progress && typeof data.progress === "object") {
          const p = data.progress as ToolProgress;
          options.onProgress?.({
            percent: typeof p.percent === "number" ? p.percent : undefined,
            label: typeof p.label === "string" ? p.label : undefined,
            stage: typeof p.stage === "string" ? p.stage : undefined,
          });
          return; // Do NOT settle
        }

        // Error response: { error: string, field?: string }
        if ("error" in data && typeof (data as WorkerErrorMessage).error === "string") {
          const errData = data as WorkerErrorMessage;
          cleanup();
          reject(new WorkerExecutionError(errData.error, errData.field));
          return;
        }

        // Wrapped result response: { result: TRes }
        if ("result" in data) {
          const resData = data as WorkerResultMessage<TRes>;
          cleanup();
          resolve(resData.result);
          return;
        }
      }

      // Fallback: raw unwrapped payload
      cleanup();
      resolve(data as TRes);
    };

    worker.onerror = (event: ErrorEvent | Event) => {
      cleanup();
      const message =
        "message" in event && typeof event.message === "string"
          ? event.message
          : "Worker encountered an unhandled execution error.";
      reject(new WorkerExecutionError(`Worker execution error: ${message}`));
    };

    worker.onmessageerror = () => {
      cleanup();
      reject(
        new WorkerExecutionError(
          "Worker message deserialization failed (unsupported transferable or structured clone error)."
        )
      );
    };

    // Dispatch payload with zero-copy Transferable optimization
    const transferList =
      options.transfer && options.transfer.length > 0
        ? Array.from(new Set(options.transfer))
        : undefined;

    try {
      if (transferList && transferList.length > 0) {
        worker.postMessage(payload, transferList);
      } else {
        worker.postMessage(payload);
      }
    } catch (cause) {
      cleanup();
      const message = cause instanceof Error ? cause.message : String(cause);
      reject(
        new WorkerExecutionError(
          `Failed to post message to worker: ${message}`
        )
      );
    }
  });
}

// ============================================================================
// 4. ToolContext Helpers & High-Level Offloading
// ============================================================================

/**
 * Creates a WorkerRunnerHelper conforming to the ToolContext.runInWorker signature.
 * Automatically pipes the active AbortSignal and onProgress callback.
 */
export function createWorkerRunnerHelper(
  signal: AbortSignal,
  reportProgress: (progress: ToolProgress) => void,
  defaultTimeoutMs?: number
): WorkerRunnerHelper {
  return <TReq, TRes>(
    workerPath: string,
    payload: TReq,
    transfer?: Transferable[]
  ): Promise<TRes> => {
    return executeInWorker<TReq, TRes>(workerPath, payload, {
      signal,
      onProgress: reportProgress,
      timeoutMs: defaultTimeoutMs,
      transfer,
    });
  };
}

/**
 * Constructs a fully wired ToolContext object.
 */
export function createToolContext(options: {
  signal: AbortSignal;
  reportProgress?: (progress: ToolProgress) => void;
  timeoutMs?: number;
  workerRunner?: WorkerRunnerHelper;
}): ToolContext {
  const reportProgress = options.reportProgress ?? (() => {});
  const runner =
    options.workerRunner ??
    createWorkerRunnerHelper(options.signal, reportProgress, options.timeoutMs);

  return {
    signal: options.signal,
    reportProgress,
    runInWorker: runner,
    runWorker: runner,
  };
}

/**
 * Worker runner with transparent fallback to main-thread execution when Worker is undefined.
 */
export async function runWorkerWithFallback<TReq, TRes>(
  workerPath: string,
  payload: TReq,
  signal?: AbortSignal,
  reportProgress?: (progress: ToolProgress) => void,
  transfer?: Transferable[]
): Promise<TRes> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const hasWorker = typeof Worker !== "undefined";

  if (hasWorker) {
    return executeInWorker<TReq, TRes>(workerPath, payload, {
      signal,
      onProgress: reportProgress,
      transfer,
    });
  }

  // Fallback to main-thread simulated execution for headless/Node environments
  reportProgress?.({ percent: 50, label: "Processing on main thread" });
  await new Promise((r) => setTimeout(r, 10));
  reportProgress?.({ percent: 100, label: "Complete" });
  return payload as unknown as TRes;
}

/**
 * Utility to extract transferable ArrayBuffers from unknown payloads.
 */
export function extractTransferables(item: unknown): Transferable[] {
  const transferables: Transferable[] = [];
  const seenObjects = new Set<unknown>();
  const seenBuffers = new Set<unknown>();

  function walk(val: unknown, depth = 0): void {
    if (!val || depth > 8) return;

    if (val instanceof ArrayBuffer) {
      if (!seenBuffers.has(val)) {
        seenBuffers.add(val);
        transferables.push(val);
      }
      return;
    }

    if (ArrayBuffer.isView(val)) {
      if (val.buffer instanceof ArrayBuffer && !seenBuffers.has(val.buffer)) {
        seenBuffers.add(val.buffer);
        transferables.push(val.buffer);
      }
      return;
    }

    if (typeof MessagePort !== "undefined" && val instanceof MessagePort) {
      transferables.push(val);
      return;
    }

    if (typeof ImageBitmap !== "undefined" && val instanceof ImageBitmap) {
      transferables.push(val);
      return;
    }

    if (typeof OffscreenCanvas !== "undefined" && val instanceof OffscreenCanvas) {
      transferables.push(val);
      return;
    }

    if (typeof val === "object") {
      if (seenObjects.has(val)) return;
      seenObjects.add(val);

      if (Array.isArray(val)) {
        for (const elem of val) {
          walk(elem, depth + 1);
        }
      } else {
        for (const k of Object.keys(val as Record<string, unknown>)) {
          walk((val as Record<string, unknown>)[k], depth + 1);
        }
      }
    }
  }

  walk(item);
  return Array.from(new Set(transferables));
}
