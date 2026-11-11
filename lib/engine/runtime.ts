/**
 * Code Station — Tool Engine Runtime Controller & State Machine
 * lib/engine/runtime.ts
 *
 * Enforces a deterministic execution lifecycle:
 * idle -> validating -> processing -> success | error | cancelled
 *
 * Zero `any` leaks. Strict TypeScript.
 */

import type {
  ToolDefinition,
  ToolEngine,
  ToolExecutionState,
  ToolContext,
  ToolProgress,
  ToolResult,
  ValidationResult,
  ValidationDiagnostic,
  WorkerRunnerHelper,
} from "./types";
import { BlobUrlRegistry } from "./blobRegistry";
import {
  createWorkerRunnerHelper,
  CancellationError,
  TimeoutError,
  WorkerExecutionError,
  WorkerNotSupportedError,
} from "./workerRunner";

export {
  CancellationError,
  TimeoutError,
  WorkerExecutionError,
  WorkerNotSupportedError,
};

// ============================================================================
// 1. Error Hierarchy
// ============================================================================

export class ToolEngineError extends Error {
  public readonly code: string;

  constructor(message: string, code = "TOOL_ENGINE_ERROR") {
    super(message);
    this.name = "ToolEngineError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ToolEngineError {
  public readonly result: ValidationResult;

  constructor(result: ValidationResult) {
    const message =
      result.errors?.[0] ||
      result.diagnostics?.[0]?.message ||
      "Validation failed.";
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.result = result;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get diagnostics(): readonly ValidationDiagnostic[] | undefined {
    return this.result.diagnostics;
  }

  get errors(): readonly string[] | undefined {
    return this.result.errors;
  }
}

// ============================================================================
// 2. Error Type Guards
// ============================================================================

export function isToolEngineError(error: unknown): error is ToolEngineError {
  return (
    error instanceof ToolEngineError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      "code" in error)
  );
}

export function isValidationError(error: unknown): error is ValidationError {
  return (
    error instanceof ValidationError ||
    (isToolEngineError(error) && error.name === "ValidationError")
  );
}

export function isCancellationError(
  error: unknown
): error is CancellationError {
  return (
    error instanceof CancellationError ||
    (isToolEngineError(error) && error.name === "CancellationError")
  );
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return (
    error instanceof TimeoutError ||
    (isToolEngineError(error) && error.name === "TimeoutError")
  );
}

// ============================================================================
// 3. Supporting Interfaces
// ============================================================================

export interface BlobUrlRegistryLike {
  register(blobOrUrl: Blob | File | string): string;
  create?(blob: Blob | File): string;
  revoke(url: string): void;
  revokeAll(): void;
  size?: number;
  getActiveCount?(): number;
  getActiveUrls?(): string[];
}

export interface ExecuteToolOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onStateChange?: (state: ToolExecutionState) => void;
  onProgress?: (progress: ToolProgress) => void;
  runInWorker?: WorkerRunnerHelper;
  blobRegistry?: BlobUrlRegistryLike;
}

export interface ExecutionRuntimeEvents<TOutput = unknown> {
  onStateChange?: (state: ToolExecutionState) => void;
  onProgress?: (progress: ToolProgress) => void;
  onSuccess?: (result: ToolResult<TOutput>) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// 4. Safe Teardown Helpers
// ============================================================================

export function safeDispose(
  engine: { dispose?: () => void } | null | undefined
): void {
  if (engine && typeof engine.dispose === "function") {
    try {
      engine.dispose();
    } catch {
      // Intentionally suppressed: safe disposal must never crash caller
    }
  }
}

export function safeCancel(
  engine: { cancel?: () => void } | null | undefined
): void {
  if (engine && typeof engine.cancel === "function") {
    try {
      engine.cancel();
    } catch {
      // Intentionally suppressed: safe cancel must never crash caller
    }
  }
}

// ============================================================================
// 5. Result Normalizer
// ============================================================================

export function normalizeToolResult<TOutput>(
  rawResult: Partial<ToolResult<TOutput>> & { data?: TOutput; output?: TOutput },
  fallbackDurationMs = 0
): ToolResult<TOutput> {
  const data = (
    rawResult.data !== undefined ? rawResult.data : rawResult.output
  ) as TOutput;

  const durationMs =
    typeof rawResult.durationMs === "number" && rawResult.durationMs >= 0
      ? rawResult.durationMs
      : Math.max(0, fallbackDurationMs);

  return {
    ...rawResult,
    data,
    output: rawResult.output !== undefined ? rawResult.output : data,
    durationMs,
  };
}

// ============================================================================
// 6. Core Function: executeTool
// ============================================================================

export async function executeTool<TInput, TOutput>(
  _definition: ToolDefinition,
  engine: ToolEngine<TInput, TOutput>,
  input: TInput,
  options: ExecuteToolOptions = {}
): Promise<ToolResult<TOutput>> {
  // Check 1: Pre-execution cancellation check
  if (options.signal?.aborted) {
    options.onStateChange?.("cancelled");
    safeCancel(engine);
    throw new CancellationError(
      options.signal.reason
        ? String(options.signal.reason)
        : "Execution was aborted prior to start."
    );
  }

  const internalController = new AbortController();

  const onExternalAbort = () => {
    internalController.abort(options.signal?.reason);
    safeCancel(engine);
  };

  if (options.signal) {
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  // Phase 1: Validation Gate
  options.onStateChange?.("validating");
  let validationResult: ValidationResult;

  try {
    validationResult = await Promise.resolve(engine.validate(input));
  } catch (valErr) {
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }

    const isAbort =
      options.signal?.aborted ||
      internalController.signal.aborted ||
      isCancellationError(valErr) ||
      (valErr instanceof DOMException && valErr.name === "AbortError") ||
      (valErr instanceof Error && valErr.name === "CancellationError");

    if (isAbort) {
      options.onStateChange?.("cancelled");
      safeCancel(engine);
      if (valErr instanceof CancellationError) {
        throw valErr;
      }
      throw new CancellationError(
        valErr instanceof Error ? valErr.message : "Tool validation was aborted."
      );
    }

    const message =
      valErr instanceof Error ? valErr.message : String(valErr);
    const errorResult: ValidationResult = {
      valid: false,
      errors: [message],
      diagnostics: [{ message, severity: "error" }],
    };
    options.onStateChange?.("error");
    throw new ValidationError(errorResult);
  }

  // Check 2: Cancellation during async validation
  if (options.signal?.aborted || internalController.signal.aborted) {
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
    options.onStateChange?.("cancelled");
    safeCancel(engine);
    throw new CancellationError();
  }

  // Gate Check: Block process() if invalid
  if (!validationResult.valid) {
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
    options.onStateChange?.("error");
    throw new ValidationError(validationResult);
  }

  // Phase 2: Processing Gate Setup
  options.onStateChange?.("processing");

  let timer: ReturnType<typeof setTimeout> | undefined;
  let isTimedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    if (options.timeoutMs && options.timeoutMs > 0 && options.timeoutMs !== Infinity) {
      timer = setTimeout(() => {
        isTimedOut = true;
        internalController.abort(new TimeoutError(options.timeoutMs!));
        safeCancel(engine);
        reject(new TimeoutError(options.timeoutMs!));
      }, options.timeoutMs);
    }
  });

  const workerRunner =
    options.runInWorker ??
    createWorkerRunnerHelper(
      internalController.signal,
      (p: ToolProgress) => {
        if (!internalController.signal.aborted) {
          options.onProgress?.(p);
        }
      },
      options.timeoutMs
    );

  const context: ToolContext = {
    signal: internalController.signal,
    reportProgress: (progress: ToolProgress) => {
      if (!internalController.signal.aborted) {
        options.onProgress?.(progress);
      }
    },
    runInWorker: workerRunner,
    runWorker: workerRunner,
  };

  const startTime = performance.now();

  try {
    if (internalController.signal.aborted) {
      throw new CancellationError();
    }

    const rawResult = await Promise.race([
      engine.process(input, context),
      timeoutPromise,
    ]);

    if (internalController.signal.aborted) {
      throw new CancellationError();
    }

    const elapsedMs = Math.round(performance.now() - startTime);
    const normalizedResult = normalizeToolResult<TOutput>(rawResult, elapsedMs);

    // Auto-register Blob if registry provided
    if (
      options.blobRegistry &&
      (normalizedResult.data instanceof Blob ||
        (typeof File !== "undefined" && normalizedResult.data instanceof File))
    ) {
      const url = options.blobRegistry.register(
        normalizedResult.data as Blob
      );
      normalizedResult.metadata = {
        ...normalizedResult.metadata,
        blobUrl: url,
      };
    }

    options.onStateChange?.("success");
    return normalizedResult;
  } catch (cause) {
    if (isTimedOut || cause instanceof TimeoutError) {
      options.onStateChange?.("error");
      throw cause instanceof TimeoutError
        ? cause
        : new TimeoutError(options.timeoutMs ?? 0);
    }

    const isAbort =
      internalController.signal.aborted ||
      options.signal?.aborted ||
      (cause instanceof DOMException && cause.name === "AbortError") ||
      (cause instanceof Error && cause.name === "CancellationError") ||
      (typeof cause === "object" &&
        cause !== null &&
        "name" in cause &&
        (cause as { name: string }).name === "CancellationError");

    if (isAbort) {
      options.onStateChange?.("cancelled");
      throw cause instanceof CancellationError
        ? cause
        : new CancellationError();
    }

    options.onStateChange?.("error");
    if (cause instanceof Error) {
      throw cause;
    }
    throw new Error(String(cause));
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

// ============================================================================
// 7. Stateful Controller Class: ExecutionRuntimeController
// ============================================================================

export class ExecutionRuntimeController<
  TInput = unknown,
  TOutput = unknown,
> {
  public state: ToolExecutionState = "idle";
  public result: ToolResult<TOutput> | null = null;
  public validation: ValidationResult | null = null;
  public error: Error | null = null;
  public progress: ToolProgress = {};
  public durationMs: number | null = null;

  private currentAbortController: AbortController | null = null;
  private executionCounter = 0;
  private blobRegistry: BlobUrlRegistryLike;
  private engine: ToolEngine<TInput, TOutput>;
  private definition: ToolDefinition;
  private events: ExecutionRuntimeEvents<TOutput>;

  constructor(
    engine: ToolEngine<TInput, TOutput>,
    events: ExecutionRuntimeEvents<TOutput> = {},
    blobRegistry?: BlobUrlRegistryLike,
    definition?: ToolDefinition
  ) {
    this.engine = engine;
    this.events = events;
    this.blobRegistry = blobRegistry ?? new BlobUrlRegistry();
    this.definition = definition ?? {
      id: "anonymous-tool",
      name: "Anonymous Tool",
      category: "utility",
      description: "Anonymous Tool Execution",
      processing: "local",
      offlineSupported: true,
      input: [],
      output: [],
    };
  }

  public get isBusy(): boolean {
    return this.state === "validating" || this.state === "processing";
  }

  private setState(newState: ToolExecutionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.events.onStateChange?.(newState);
  }

  public async run(input: TInput): Promise<ToolResult<TOutput> | null> {
    const runId = ++this.executionCounter;

    // Abort prior in-flight execution cleanly
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      safeCancel(this.engine);
      this.currentAbortController = null;
    }

    const controller = new AbortController();
    this.currentAbortController = controller;

    // Revoke previous run's blob URLs
    this.blobRegistry.revokeAll();

    this.error = null;
    this.result = null;
    this.validation = null;
    this.progress = {};
    this.durationMs = null;
    this.setState("validating");

    try {
      const res = await executeTool<TInput, TOutput>(
        this.definition,
        this.engine,
        input,
        {
          signal: controller.signal,
          onStateChange: (newState) => {
            if (this.executionCounter === runId) {
              this.setState(newState);
            }
          },
          onProgress: (p) => {
            if (this.executionCounter === runId) {
              this.progress = p;
              this.events.onProgress?.(p);
            }
          },
          blobRegistry: this.blobRegistry,
        }
      );

      if (this.executionCounter !== runId || controller.signal.aborted) {
        return null;
      }

      this.result = res;
      this.durationMs = res.durationMs;
      this.currentAbortController = null;
      this.setState("success");
      this.events.onSuccess?.(res);
      return res;
    } catch (err) {
      if (this.executionCounter !== runId) {
        return null;
      }

      if (this.currentAbortController === controller) {
        this.currentAbortController = null;
      }

      const isAbort =
        isCancellationError(err) ||
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "CancellationError");

      if (isAbort) {
        this.setState("cancelled");
        this.error = null;
        this.validation = null;
        return null;
      }

      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.error = errorObj;

      if (isValidationError(err)) {
        this.validation = err.result;
      } else {
        this.validation = {
          valid: false,
          errors: [errorObj.message],
          diagnostics: [{ message: errorObj.message, severity: "error" }],
        };
      }

      this.setState("error");
      this.events.onError?.(errorObj);
      return null;
    }
  }

  public cancel(): void {
    this.executionCounter += 1;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    safeCancel(this.engine);
    this.setState("cancelled");
    this.error = null;
    this.validation = null;
    this.progress = {};
  }

  public reset(): void {
    this.cancel();
    this.blobRegistry.revokeAll();
    this.state = "idle";
    this.result = null;
    this.validation = null;
    this.error = null;
    this.progress = {};
    this.durationMs = null;
    this.events.onStateChange?.("idle");
  }

  public dispose(): void {
    this.cancel();
    this.blobRegistry.revokeAll();
    safeDispose(this.engine);
  }
}
