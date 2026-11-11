/**
 * Code Station — Universal Tool Engine React Hook
 * lib/engine/useToolEngine.ts
 *
 * Coordinates reactive state, input initialization, pre-execution validation gates,
 * cooperative & preemptive cancellation, Web Worker offloading, and deterministic
 * Blob URL memory lifecycle.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  ToolDefinition,
  ToolEngine,
  ToolResult,
  ToolProgress,
  ValidationResult,
  ToolExecutionState,
} from "./types";
import {
  executeTool,
  ValidationError,
  CancellationError,
  safeCancel,
  safeDispose,
} from "./runtime";
import { BlobUrlRegistry } from "./blobRegistry";

export type ToolStatus = ToolExecutionState;

export interface UseToolEngineReturn<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown
> {
  // Reactive Execution State
  state: ToolExecutionState;
  /** Backward-compatible alias matching state */
  status: ToolExecutionState;
  isBusy: boolean;
  input: TInput;
  result: ToolResult<TOutput> | null;
  validation: ValidationResult | null;
  error: Error | null;
  progress: ToolProgress;
  durationMs: number | null;

  // Actions
  setInput: (updater: TInput | ((prev: TInput) => TInput)) => void;
  setFieldValue: <K extends keyof TInput>(field: K, value: TInput[K]) => void;
  run: (overrideInput?: unknown) => Promise<ToolResult<TOutput> | null>;
  cancel: () => void;
  reset: () => void;

  // Memory & Blob URL registry
  blobUrls: BlobUrlRegistry;
}

/**
 * Computes default input values from declarative ToolDefinition.input schema.
 */
function computeDefaultInput<TInput extends Record<string, unknown>>(
  definition: ToolDefinition,
  initialInput?: Partial<TInput>
): TInput {
  const defaults: Record<string, unknown> = {};

  if (Array.isArray(definition.input)) {
    for (const inp of definition.input) {
      if ("defaultValue" in inp && inp.defaultValue !== undefined) {
        defaults[inp.name] = inp.defaultValue;
      } else if (inp.control === "toggle" || inp.control === "checkbox") {
        defaults[inp.name] = false;
      } else if (inp.control === "number" || inp.control === "range") {
        defaults[inp.name] = inp.min ?? 0;
      } else if (inp.control === "files") {
        defaults[inp.name] = [];
      } else if (inp.control === "file") {
        defaults[inp.name] = null;
      } else {
        defaults[inp.name] = "";
      }
    }
  }

  if (initialInput && typeof initialInput === "object") {
    return { ...defaults, ...initialInput } as TInput;
  }
  return defaults as TInput;
}

export function useToolEngine<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown
>(
  definition: ToolDefinition,
  engine: ToolEngine<TInput, TOutput>,
  initialInput?: Partial<TInput>
): UseToolEngineReturn<TInput, TOutput> {
  // 1. Reactive state initialization
  const [input, setInputState] = useState<TInput>(() =>
    computeDefaultInput<TInput>(definition, initialInput)
  );
  const [state, setState] = useState<ToolExecutionState>("idle");
  const [result, setResult] = useState<ToolResult<TOutput> | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ToolProgress>({});
  const [durationMs, setDurationMs] = useState<number | null>(null);

  // 2. Persistent lifecycle refs
  const activeAbortController = useRef<AbortController | null>(null);
  const executionIdRef = useRef<number>(0);
  const blobRegistryRef = useRef<BlobUrlRegistry>(new BlobUrlRegistry());
  const isMountedRef = useRef<boolean>(true);
  const previousToolIdRef = useRef<string>(definition.id);
  const prevEngineRef = useRef<ToolEngine<TInput, TOutput>>(engine);
  const engineRef = useRef<ToolEngine<TInput, TOutput>>(engine);
  const inputRef = useRef<TInput>(input);
  const definitionRef = useRef<ToolDefinition>(definition);
  const initialInputRef = useRef<Partial<TInput> | undefined>(initialInput);

  // Keep mutable refs synchronized on each render
  engineRef.current = engine;
  inputRef.current = input;
  definitionRef.current = definition;
  initialInputRef.current = initialInput;

  // 1. Unmount-only teardown effect: runs solely when component unmounts from DOM
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      executionIdRef.current += 1;

      if (activeAbortController.current) {
        activeAbortController.current.abort();
        activeAbortController.current = null;
      }

      safeCancel(engineRef.current);
      safeDispose(engineRef.current);
      blobRegistryRef.current.revokeAll();
    };
  }, []);

  // 2. Tool-switching effect: executes solely when definition.id changes
  useEffect(() => {
    if (previousToolIdRef.current !== definition.id) {
      previousToolIdRef.current = definition.id;
      executionIdRef.current += 1;

      if (activeAbortController.current) {
        activeAbortController.current.abort();
        activeAbortController.current = null;
      }
      safeCancel(prevEngineRef.current);
      safeDispose(prevEngineRef.current);
      blobRegistryRef.current.revokeAll();

      const newDefaults = computeDefaultInput<TInput>(
        definitionRef.current,
        initialInputRef.current
      );
      setInputState(newDefaults);
      inputRef.current = newDefaults;
      setState("idle");
      setResult(null);
      setValidation(null);
      setError(null);
      setProgress({});
      setDurationMs(null);
    }

    prevEngineRef.current = engineRef.current;
  }, [definition.id]);

  // 3. Action: cancel
  const cancel = useCallback(() => {
    executionIdRef.current += 1;
    if (activeAbortController.current) {
      activeAbortController.current.abort();
      activeAbortController.current = null;
    }
    safeCancel(engineRef.current);
    setState("cancelled");
    setProgress({});
  }, []);

  // 5. Action: reset
  const reset = useCallback(() => {
    cancel();
    blobRegistryRef.current.revokeAll();
    const defaults = computeDefaultInput<TInput>(definition, initialInput);
    setInputState(defaults);
    inputRef.current = defaults;
    setState("idle");
    setResult(null);
    setValidation(null);
    setError(null);
    setProgress({});
    setDurationMs(null);
  }, [cancel, definition, initialInput]);

  // 6. Action: setInput
  const setInput = useCallback((updater: TInput | ((prev: TInput) => TInput)) => {
    setInputState((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (prev: TInput) => TInput)(prev)
          : updater;
      inputRef.current = next;
      return next;
    });
  }, []);

  // 7. Action: setFieldValue
  const setFieldValue = useCallback(
    <K extends keyof TInput>(field: K, value: TInput[K]) => {
      setInputState((prev) => {
        const next = { ...prev, [field]: value };
        inputRef.current = next;
        return next;
      });

      // Clear validation error for the edited field
      setValidation((prev) => {
        if (!prev || !prev.diagnostics) return prev;
        const filtered = prev.diagnostics.filter(
          (d) => d.field !== undefined && d.field !== String(field)
        );
        const remainingErrors = filtered.filter(
          (d) => d.severity === "error" || d.severity === undefined
        );
        return {
          valid: remainingErrors.length === 0,
          diagnostics: filtered,
          errors:
            remainingErrors.length > 0
              ? remainingErrors.map((d) => d.message)
              : undefined,
        };
      });
    },
    []
  );

  // 8. Action: run
  const run = useCallback(
    async (overrideInput?: unknown): Promise<ToolResult<TOutput> | null> => {
      // Step A: Abort prior active execution
      if (activeAbortController.current) {
        activeAbortController.current.abort();
        safeCancel(engineRef.current);
        activeAbortController.current = null;
      }

      // Feature 9: Revoke previous execution Blob URLs on re-run
      blobRegistryRef.current.revokeAll();

      const runId = ++executionIdRef.current;
      const controller = new AbortController();
      activeAbortController.current = controller;

      // Determine effective input
      let effectiveInput: unknown = inputRef.current;
      if (overrideInput !== undefined && overrideInput !== null) {
        if (
          typeof overrideInput === "object" &&
          !Array.isArray(overrideInput) &&
          typeof inputRef.current === "object" &&
          inputRef.current !== null &&
          !Array.isArray(inputRef.current)
        ) {
          const merged = { ...inputRef.current, ...overrideInput } as TInput;
          effectiveInput = merged;
          setInputState(merged);
          inputRef.current = merged;
        } else if (
          typeof overrideInput === "string" &&
          typeof inputRef.current === "object" &&
          inputRef.current !== null &&
          !Array.isArray(inputRef.current) &&
          Array.isArray(definition.input) &&
          definition.input.length === 1
        ) {
          const fieldName = definition.input[0].name;
          const updated = {
            ...inputRef.current,
            [fieldName]: overrideInput,
          } as TInput;
          try {
            Object.defineProperty(updated, "toString", {
              value: () => String(overrideInput),
              enumerable: false,
              configurable: true,
            });
            Object.defineProperty(updated, Symbol.toPrimitive, {
              value: () => String(overrideInput),
              enumerable: false,
              configurable: true,
            });
          } catch {
            // safe fallback
          }
          setInputState(updated);
          inputRef.current = updated;
          effectiveInput = updated;
        } else {
          effectiveInput = overrideInput;
          if (
            typeof overrideInput === "object" &&
            overrideInput !== null &&
            !Array.isArray(overrideInput)
          ) {
            setInputState(overrideInput as TInput);
            inputRef.current = overrideInput as TInput;
          }
        }
      }

      // Prepare state for validation
      setError(null);
      setValidation(null);
      setProgress({ percent: 0, label: "Validating input..." });
      setState("validating");

      try {
        // Step B: Pre-Execution Validation Gate
        let valResult = await Promise.resolve(
          engineRef.current.validate(effectiveInput)
        );

        // Fallback: If structured object validation failed for an override, check if engine directly accepts the raw overrideInput
        if (
          !valResult.valid &&
          overrideInput !== undefined &&
          overrideInput !== null &&
          effectiveInput !== overrideInput
        ) {
          try {
            const rawValResult = await Promise.resolve(
              engineRef.current.validate(overrideInput)
            );
            if (rawValResult.valid) {
              valResult = rawValResult;
              effectiveInput = overrideInput;
            }
          } catch {
            // Keep original validation failure
          }
        }

        // Stale & abort guards
        if (
          !isMountedRef.current ||
          executionIdRef.current !== runId ||
          controller.signal.aborted
        ) {
          return null;
        }

        setValidation(valResult);

        if (!valResult.valid) {
          const err = new ValidationError(valResult);
          setError(err);
          setState("error");
          setProgress({});
          return null;
        }

        // Step C: Processing Gate
        setState("processing");
        setProgress({ percent: 10, label: "Processing..." });

        const res = await executeTool(
          definition,
          engineRef.current,
          effectiveInput as TInput,
          {
            signal: controller.signal,
            blobRegistry: blobRegistryRef.current,
            onProgress: (p) => {
              if (
                isMountedRef.current &&
                executionIdRef.current === runId &&
                !controller.signal.aborted
              ) {
                setProgress(p);
              }
            },
          }
        );

        // Stale & abort guards
        if (
          !isMountedRef.current ||
          executionIdRef.current !== runId ||
          controller.signal.aborted
        ) {
          return null;
        }

        setResult(res);
        setDurationMs(res.durationMs);
        setState("success");
        setProgress({});
        return res;
      } catch (cause) {
        if (!isMountedRef.current || executionIdRef.current !== runId) {
          return null;
        }

        const isCancelled =
          controller.signal.aborted ||
          cause instanceof CancellationError ||
          (cause instanceof DOMException && cause.name === "AbortError") ||
          (cause instanceof Error &&
            cause.message.toLowerCase().includes("cancelled"));

        if (isCancelled) {
          setState("cancelled");
          setProgress({});
          return null;
        }

        if (cause instanceof ValidationError) {
          setValidation(cause.result);
          setError(cause);
          setState("error");
          setProgress({});
          return null;
        }

        const finalErr =
          cause instanceof Error ? cause : new Error(String(cause));
        setError(finalErr);
        setState("error");
        setProgress({});
        return null;
      } finally {
        if (activeAbortController.current === controller) {
          activeAbortController.current = null;
        }
      }
    },
    [definition]
  );

  return {
    state,
    status: state,
    isBusy: state === "validating" || state === "processing",
    input,
    result,
    validation,
    error,
    progress,
    durationMs,
    setInput,
    setFieldValue,
    run,
    cancel,
    reset,
    blobUrls: blobRegistryRef.current,
  };
}
