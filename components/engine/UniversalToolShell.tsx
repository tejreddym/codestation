"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Play } from "lucide-react";
import type {
  ToolDefinition,
  ToolEngine,
  FileInputConfig,
  CustomCanvasSlotProps,
} from "@/lib/engine/types";
import { useToolEngine } from "@/lib/engine/useToolEngine";
import { ToolHeader } from "./ToolHeader";
import { ToolDropzone } from "./ToolDropzone";
import { ToolEditor } from "./ToolEditor";
import { ToolControls } from "./ToolControls";
import { ToolProgressBar } from "./ToolProgressBar";
import { ToolErrorBanner } from "./ToolErrorBanner";
import { ToolActionBar } from "./ToolActionBar";
import { ToolOutputPreview } from "./ToolOutputPreview";
import { CustomCanvasSlot } from "./CustomCanvasSlot";
import styles from "./UniversalToolShell.module.css";

export interface UniversalToolShellProps {
  definition: ToolDefinition;
  engine: ToolEngine;
  customCanvas?: (props: CustomCanvasSlotProps) => React.ReactNode;
  initialInput?: unknown;
  onWorkflowChain?: (output: unknown) => void;
  className?: string;
}

export function UniversalToolShell({
  definition,
  engine,
  customCanvas,
  initialInput,
  onWorkflowChain,
  className,
}: UniversalToolShellProps) {
  const isZeroInput = definition.input.length === 0;

  const primaryInputConfig = useMemo(
    () =>
      definition.input.find(
        (i) => i.control === "text" || i.control === "textarea" || i.control === "code"
      ),
    [definition.input]
  );
  const primaryInputName = primaryInputConfig ? primaryInputConfig.name : (definition.input[0]?.name || "input");

  const fileInputConfig = useMemo(
    () =>
      definition.input.find(
        (i) => i.control === "file" || i.control === "files"
      ) as FileInputConfig | undefined,
    [definition.input]
  );

  // Normalize initialInput for useToolEngine hook
  const initialInputObj = useMemo(() => {
    if (typeof initialInput === "string") {
      return { [primaryInputName]: initialInput };
    }
    if (initialInput && typeof initialInput === "object") {
      return initialInput as Record<string, unknown>;
    }
    return undefined;
  }, [initialInput, primaryInputName]);

  const {
    state,
    result,
    validation,
    error,
    progress,
    run,
    cancel,
    blobUrls,
    input,
    setFieldValue,
    durationMs,
  } = useToolEngine(definition, engine, initialInputObj);

  // Synchronized text input state
  const [textInput, setTextInput] = useState<string>(() => {
    if (typeof initialInput === "string") return initialInput;
    if (initialInput && typeof initialInput === "object") {
      const obj = initialInput as Record<string, unknown>;
      if ("input" in obj && obj.input !== undefined) return String(obj.input);
      if (primaryInputName in obj && obj[primaryInputName] !== undefined) {
        return String(obj[primaryInputName]);
      }
    }
    if (primaryInputConfig && "defaultValue" in primaryInputConfig && primaryInputConfig.defaultValue !== undefined) {
      return String(primaryInputConfig.defaultValue);
    }
    const first = definition.input[0];
    if (first && "defaultValue" in first && first.defaultValue !== undefined) {
      return String(first.defaultValue);
    }
    return "";
  });

  // Synchronized control values
  const [controlValues, setControlValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const inp of definition.input) {
      if ("defaultValue" in inp && (inp as { defaultValue?: unknown }).defaultValue !== undefined) {
        initial[inp.name] = (inp as { defaultValue?: unknown }).defaultValue;
      }
    }
    if (initialInput && typeof initialInput === "object") {
      Object.assign(initial, initialInput);
    }
    return initial;
  });

  const [dropzoneError, setDropzoneError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState(false);

  useEffect(() => {
    if (state === "processing" || state === "validating") {
      setDismissedError(false);
      setDropzoneError(null);
    }
  }, [state]);

  const handleTextChange = useCallback(
    (newText: string) => {
      setTextInput(newText);
      setFieldValue(primaryInputName as never, newText as never);
      setDropzoneError(null);
    },
    [primaryInputName, setFieldValue]
  );

  const handleControlChange = useCallback(
    (name: string, value: unknown) => {
      setControlValues((prev) => ({ ...prev, [name]: value }));
      setFieldValue(name as never, value as never);
    },
    [setFieldValue]
  );

  const handleExecute = useCallback(async () => {
    blobUrls.revokeAll();
    setDropzoneError(null);

    if (isZeroInput) {
      await run({});
      return;
    }

    const hasMultipleInputs = definition.input.length > 1;
    if (hasMultipleInputs) {
      const payload: Record<string, unknown> = {
        ...input,
        ...controlValues,
      };
      if (primaryInputConfig) {
        payload[primaryInputConfig.name] = textInput;
      } else {
        payload.input = textInput;
      }
      await run(payload);
    } else {
      await run(textInput);
    }
  }, [
    blobUrls,
    isZeroInput,
    definition.input.length,
    input,
    controlValues,
    primaryInputConfig,
    textInput,
    run,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  const isProcessing = state === "processing" || state === "validating";
  const activeError = error || (dropzoneError ? new Error(dropzoneError) : null);

  return (
    <div
      role="region"
      aria-label={definition.name}
      data-testid="universal-tool-shell"
      className={`${styles.shellContainer} ${className || ""}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <ToolHeader definition={definition} />

      {!dismissedError && (
        <ToolErrorBanner
          error={activeError}
          validation={validation}
          onDismiss={() => {
            setDismissedError(true);
            setDropzoneError(null);
          }}
        />
      )}

      {customCanvas ? (
        <CustomCanvasSlot
          definition={definition}
          engine={engine}
          input={textInput}
          setInput={(val) => {
            if (typeof val === "string") handleTextChange(val);
          }}
          result={result}
          isProcessing={isProcessing}
          run={handleExecute}
          customCanvas={customCanvas}
        />
      ) : isZeroInput ? (
        <div className={styles.zeroInputBox} data-testid="zero-input-shell">
          <p style={{ margin: 0, fontSize: "14px", color: "var(--secondary)" }}>
            This tool operates without input parameters. Click Generate to compute output.
          </p>
          <button
            type="button"
            data-testid="btn-generate-zero-input"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={isProcessing}
            onClick={handleExecute}
          >
            <Play size={14} aria-hidden="true" />
            {isProcessing ? "Generating..." : "Generate Output"}
          </button>
        </div>
      ) : (
        <div className={styles.workspaceLayout}>
          {/* Left Column: Input Zone */}
          <div className={styles.inputZone} data-testid="standard-input-zone">
            {fileInputConfig && (
              <ToolDropzone
                accept={fileInputConfig.accept}
                maxBytes={fileInputConfig.maxBytes}
                maxFiles={fileInputConfig.control === "files" ? 10 : 1}
                readAs={fileInputConfig.readAs}
                onFileLoaded={(content) => handleTextChange(content)}
                onError={(err) => {
                  setDropzoneError(err);
                  setDismissedError(false);
                }}
                disabled={isProcessing}
              />
            )}

            <ToolEditor
              value={textInput}
              onChange={handleTextChange}
              sampleValue={
                (primaryInputConfig && "sample" in primaryInputConfig
                  ? (primaryInputConfig as { sample?: string }).sample
                  : (primaryInputConfig as { defaultValue?: string } | undefined)?.defaultValue) ||
                ((definition.input[0] as unknown as { sample?: string })?.sample ??
                  (definition.input[0] as unknown as { defaultValue?: string })?.defaultValue)
              }
              disabled={isProcessing}
              onRun={handleExecute}
            />

            <ToolControls
              inputs={definition.input}
              values={controlValues}
              onChange={handleControlChange}
              disabled={isProcessing}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                data-testid="btn-run"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={isProcessing}
                onClick={handleExecute}
              >
                <Play size={14} aria-hidden="true" />
                {isProcessing ? "Processing..." : "Run"}
              </button>
            </div>
          </div>

          {/* Right Column: Output Zone */}
          <div className={styles.outputZone} data-testid="output-zone">
            <ToolProgressBar
              isProcessing={isProcessing}
              progress={progress}
              onCancel={cancel}
              canCancel={Boolean(engine.cancel)}
              elapsedMs={durationMs ?? 0}
            />

            <ToolOutputPreview result={result} outputConfig={definition.output[0]} />

            <ToolActionBar
              result={result}
              blobRegistry={blobUrls}
              onWorkflowChain={(output) => {
                if (onWorkflowChain) {
                  onWorkflowChain(output);
                } else if (typeof window !== "undefined") {
                  const payload =
                    typeof output === "object"
                      ? JSON.stringify(output, null, 2)
                      : String(output ?? "");
                  try {
                    sessionStorage.setItem("codestation_workflow_input", payload);
                    window.location.href = "/workbench";
                  } catch {
                    // Ignore storage error
                  }
                }
              }}
              disabled={isProcessing}
              suggestedFilename={
                definition.output[0] && "suggestedFilename" in definition.output[0]
                  ? (definition.output[0] as { suggestedFilename?: string }).suggestedFilename
                  : undefined
              }
              mimeType={
                definition.output[0] && "mimeType" in definition.output[0]
                  ? (definition.output[0] as { mimeType?: string }).mimeType
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* For Zero Input mode, render output zone below zeroInputBox */}
      {isZeroInput && (
        <div className={styles.outputZone} data-testid="output-zone">
          <ToolProgressBar
            isProcessing={isProcessing}
            progress={progress}
            onCancel={cancel}
            canCancel={Boolean(engine.cancel)}
            elapsedMs={durationMs ?? 0}
          />

          <ToolOutputPreview result={result} outputConfig={definition.output[0]} />

          <ToolActionBar
            result={result}
            blobRegistry={blobUrls}
            onWorkflowChain={onWorkflowChain}
            disabled={isProcessing}
            suggestedFilename={
              definition.output[0] && "suggestedFilename" in definition.output[0]
                ? (definition.output[0] as { suggestedFilename?: string }).suggestedFilename
                : undefined
            }
            mimeType={
              definition.output[0] && "mimeType" in definition.output[0]
                ? (definition.output[0] as { mimeType?: string }).mimeType
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

export default UniversalToolShell;
