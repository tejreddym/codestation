/**
 * Code Station — Tool Engine E2E UI Shell Fixtures & Components
 *
 * Implements the canonical reference components for the UniversalToolShell suite
 * conforming strictly to ORIGINAL_REQUEST.md R3 and PROJECT.md Features 10-16, 19.
 */

import React, { useState, useEffect, useRef, useCallback, Component } from "react";
import type {
  ToolDefinition,
  ToolEngine,
  ToolInput,
  ToolOutput,
  ToolResult,
  ValidationResult,
  ToolProgress,
  ToolExecutionState,
  ToolProcessingType,
  TextInputConfig,
  FileInputConfig,
  SelectInputConfig,
  BooleanInputConfig,
  NumberInputConfig,
  ToolInputWhen,
} from "../../types";
import { resolveToolKey } from "./testHelpers";
import { useToolEngine } from "../../useToolEngine";
import { BlobUrlRegistry } from "../../blobRegistry";

// ============================================================================
// 1. ToolPrivacyBadge Component (Feature 11)
// ============================================================================

export interface ToolPrivacyBadgeProps {
  processing: ToolProcessingType;
  offlineSupported: boolean;
}

export function ToolPrivacyBadge({ processing, offlineSupported }: ToolPrivacyBadgeProps) {
  const isNetwork = processing === "network-opt-in";

  return (
    <div className="privacy-badge-group flex items-center gap-2" data-testid="privacy-badge-group">
      {isNetwork ? (
        <span
          className="badge tactile-badge badge-warning text-amber-700 bg-amber-50 border border-amber-300"
          data-testid="badge-network-opt-in"
          role="status"
        >
          Network Opt-In
        </span>
      ) : (
        <span
          className="badge tactile-badge badge-local text-emerald-800 bg-emerald-50 border border-emerald-300"
          data-testid="badge-local"
          role="status"
        >
          100% Local • Browser-Only
        </span>
      )}

      {offlineSupported && (
        <span
          className="badge tactile-badge badge-offline text-stone-700 bg-stone-100 border border-stone-300"
          data-testid="badge-offline"
          role="status"
        >
          Offline Ready
        </span>
      )}

      {isNetwork && (
        <span
          className="network-warning text-xs text-amber-600"
          data-testid="network-warning-notice"
        >
          Requires Network / Sends Direct Browser Requests
        </span>
      )}
    </div>
  );
}

// ============================================================================
// 2. ToolHeader Component (Feature 11)
// ============================================================================

export interface ToolHeaderProps {
  definition: ToolDefinition;
}

export function ToolHeader({ definition }: ToolHeaderProps) {
  return (
    <header
      className="tool-header border-b border-stone-200 pb-4 mb-6"
      data-testid="tool-header"
      data-webmcp-tool={definition.id}
      data-webmcp-category={definition.category}
      data-webmcp-slug={definition.slug || definition.id}
    >
      <div className="eyebrow mb-1">
        <span className="bracket-label text-xs uppercase font-bold tracking-wider text-stone-500">
          [{definition.category}]
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="tool-title text-2xl font-bold tracking-tight text-stone-900" data-testid="tool-title">
          {definition.name}
        </h1>
        <ToolPrivacyBadge
          processing={definition.processing}
          offlineSupported={definition.offlineSupported}
        />
      </div>

      <p className="lead text-sm text-stone-600 mt-2" data-testid="tool-description">
        {definition.description}
      </p>

      {/* SEO / AEO Semantic Content Hierarchy */}
      <section className="aeo-overview sr-only" aria-hidden="true">
        <h2>What does this tool do?</h2>
        <p>{definition.description}</p>
        <h2>How to use it?</h2>
        <p>
          1. Provide input or drop a file. 2. Configure parameters. 3. Review instant client-side output.
        </p>
      </section>
    </header>
  );
}

// ============================================================================
// 3. ToolDropzone & ToolEditor Components (Feature 12)
// ============================================================================

export interface ToolDropzoneProps {
  accept?: string;
  maxBytes?: number;
  maxFiles?: number;
  onFileLoaded: (content: string, file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function ToolDropzone({
  accept,
  maxBytes = 5 * 1024 * 1024,
  maxFiles = 1,
  onFileLoaded,
  onError,
  disabled = false,
}: ToolDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndReadFile = useCallback(
    async (file: File) => {
      // 1. Max size check
      if (file.size > maxBytes) {
        onError(`File exceeds size limit of ${maxBytes} bytes (received ${file.size} bytes).`);
        return;
      }

      // 2. MIME type check
      if (accept && accept.trim() !== "" && accept !== "*/*") {
        const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
        const fileType = (file.type || "").toLowerCase();
        const fileName = (file.name || "").toLowerCase();

        const matches = acceptedTypes.some((pattern) => {
          if (pattern.startsWith(".")) {
            return fileName.endsWith(pattern);
          }
          if (pattern.endsWith("/*")) {
            const prefix = pattern.slice(0, -2);
            return fileType.startsWith(prefix);
          }
          return fileType === pattern;
        });

        if (!matches) {
          onError(`MIME type not accepted. Expected: ${accept}, got: ${file.type || "unknown"}.`);
          return;
        }
      }

      try {
        const text = await file.text();
        onFileLoaded(text, file);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Failed to read file.");
      }
    },
    [accept, maxBytes, onError, onFileLoaded]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (maxFiles === 1 && files.length > 1) {
      onError("Multiple files rejected. Only a single file is accepted.");
      return;
    }

    validateAndReadFile(files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (maxFiles === 1 && files.length > 1) {
      onError("Multiple files rejected. Only a single file is accepted.");
      return;
    }

    validateAndReadFile(files[0]);
    // Reset file input value so re-selecting same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      role="region"
      aria-label="File Upload Dropzone"
      data-testid="tool-dropzone"
      className={`tool-dropzone border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        isDragOver ? "border-blue-500 bg-blue-50" : "border-stone-300 hover:border-stone-400"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => {
        if (!disabled && fileInputRef.current) {
          fileInputRef.current.click();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        data-testid="dropzone-file-input"
        className="hidden sr-only"
        accept={accept}
        multiple={maxFiles > 1}
        disabled={disabled}
        onChange={handleFileChange}
      />
      <p className="text-xs text-stone-600">
        Drag & drop file here or <span className="text-blue-600 underline font-semibold">browse</span>
        {accept && <span className="block text-stone-400 mt-1">Accepted: {accept}</span>}
      </p>
    </div>
  );
}

export interface ToolEditorProps {
  value: string;
  onChange: (value: string) => void;
  sampleValue?: string;
  disabled?: boolean;
  onRun?: () => void;
  placeholder?: string;
}

export function ToolEditor({
  value,
  onChange,
  sampleValue,
  disabled = false,
  onRun,
  placeholder = "Enter input...",
}: ToolEditorProps) {
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  const handlePaste = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        onChange(text);
        setClipboardNotice(null);
      } else {
        setClipboardNotice("Clipboard API unavailable. Please paste manually using Cmd+V / Ctrl+V.");
      }
    } catch {
      setClipboardNotice("Clipboard access denied. Please paste manually using Cmd+V / Ctrl+V.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRun?.();
    }
  };

  return (
    <div className="tool-editor-container space-y-2" data-testid="tool-editor">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-stone-700">Input Data</span>
        <div className="flex items-center gap-2">
          {sampleValue !== undefined && (
            <button
              type="button"
              data-testid="btn-load-sample"
              className="btn btn-sm text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300"
              disabled={disabled}
              onClick={() => onChange(sampleValue)}
            >
              Load Sample
            </button>
          )}
          <button
            type="button"
            data-testid="btn-paste-clipboard"
            className="btn btn-sm text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300"
            disabled={disabled}
            onClick={handlePaste}
          >
            Paste from Clipboard
          </button>
          <button
            type="button"
            data-testid="btn-clear"
            className="btn btn-sm text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300"
            disabled={disabled || !value}
            onClick={() => onChange("")}
          >
            Clear
          </button>
        </div>
      </div>

      {clipboardNotice && (
        <p className="text-xs text-amber-600" data-testid="clipboard-notice">
          {clipboardNotice}
        </p>
      )}

      <textarea
        role="textbox"
        aria-label="Input Editor"
        data-testid="tool-editor-textarea"
        className="w-full h-48 font-mono text-sm p-3 border border-stone-300 rounded bg-stone-50 focus:bg-white focus:outline-blue-500 overflow-auto resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}

// ============================================================================
// 4. ToolControls Component (Feature 13)
// ============================================================================

export interface ToolControlsProps {
  inputs: ToolInput[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}

function evaluateWhen(
  when: ToolInputWhen | undefined,
  values: Record<string, unknown>
): boolean {
  if (!when) return true;
  if (typeof when === "function") return when(values);
  const currentVal = values[when.field];
  if (when.equals !== undefined && currentVal !== when.equals) return false;
  if (when.value !== undefined && currentVal !== when.value) return false;
  if (when.notEquals !== undefined && currentVal === when.notEquals) return false;
  if (when.in !== undefined && !when.in.includes(currentVal)) return false;
  return true;
}

export function ToolControls({ inputs, values, onChange, disabled = false }: ToolControlsProps) {
  // Filter inputs that are parameter controls (select, toggle/checkbox, number)
  const controlInputs = inputs.filter(
    (inp) =>
      inp.control === "select" ||
      inp.control === "toggle" ||
      inp.control === "checkbox" ||
      inp.control === "number" ||
      inp.control === "range"
  );

  if (controlInputs.length === 0) {
    return null;
  }

  return (
    <div className="tool-controls grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-stone-50 border border-stone-200 rounded-lg" data-testid="tool-controls">
      {controlInputs.map((inp) => {
        // Dynamic 'when' conditional visibility
        if (inp.when && !evaluateWhen(inp.when, values)) {
          return null;
        }

        const defaultValue = "defaultValue" in inp ? (inp as { defaultValue?: unknown }).defaultValue : undefined;
        const value = values[inp.name] !== undefined ? values[inp.name] : defaultValue;

        if (inp.control === "select") {
          const selectInp = inp as SelectInputConfig;
          return (
            <div key={inp.name} className="control-group flex flex-col gap-1" data-testid={`group-${inp.name}`}>
              <label htmlFor={`ctrl-${inp.name}`} className="text-xs font-semibold text-stone-700">
                {inp.label}
              </label>
              <select
                id={`ctrl-${inp.name}`}
                data-testid={`control-${inp.name}`}
                className="text-xs border border-stone-300 rounded p-1 bg-white"
                value={String(value ?? "")}
                disabled={disabled}
                onChange={(e) => onChange(inp.name, e.target.value)}
              >
                {selectInp.options.map((opt) => {
                  const val = typeof opt === "object" && opt !== null ? opt.value : opt;
                  const label = typeof opt === "object" && opt !== null ? opt.label : opt;
                  return (
                    <option key={String(val)} value={String(val)}>
                      {String(label)}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        }

        if (inp.control === "toggle" || inp.control === "checkbox") {
          return (
            <div key={inp.name} className="control-group flex items-center gap-2 pt-4" data-testid={`group-${inp.name}`}>
              <input
                type="checkbox"
                id={`ctrl-${inp.name}`}
                role="switch"
                data-testid={`control-${inp.name}`}
                checked={Boolean(value)}
                disabled={disabled}
                onChange={(e) => onChange(inp.name, e.target.checked)}
              />
              <label htmlFor={`ctrl-${inp.name}`} className="text-xs font-semibold text-stone-700 cursor-pointer">
                {inp.label}
              </label>
            </div>
          );
        }

        if (inp.control === "number" || inp.control === "range") {
          const numInp = inp as NumberInputConfig;
          return (
            <div key={inp.name} className="control-group flex flex-col gap-1" data-testid={`group-${inp.name}`}>
              <label htmlFor={`ctrl-${inp.name}`} className="text-xs font-semibold text-stone-700">
                {inp.label}
              </label>
              <input
                type="number"
                id={`ctrl-${inp.name}`}
                data-testid={`control-${inp.name}`}
                className="text-xs border border-stone-300 rounded p-1 bg-white"
                value={value !== undefined ? Number(value) : ""}
                min={numInp.min}
                max={numInp.max}
                step={numInp.step ?? 1}
                disabled={disabled}
                onChange={(e) => {
                  const val = e.target.value === "" ? 0 : Number(e.target.value);
                  onChange(inp.name, val);
                }}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

// ============================================================================
// 5. ToolProgressBar & ToolErrorBanner Components (Feature 14)
// ============================================================================

export interface ToolProgressBarProps {
  isProcessing: boolean;
  progress: ToolProgress;
  onCancel?: () => void;
  canCancel?: boolean;
  elapsedMs?: number;
}

export function ToolProgressBar({
  isProcessing,
  progress,
  onCancel,
  canCancel = true,
  elapsedMs = 0,
}: ToolProgressBarProps) {
  if (!isProcessing) {
    return null;
  }

  const percent = progress.percent ?? 0;
  const label = progress.label || "Processing...";

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid="tool-progress-bar"
      className="progress-container p-3 border border-blue-200 bg-blue-50 rounded-lg space-y-2"
    >
      <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
        <span data-testid="progress-label">{label}</span>
        <div className="flex items-center gap-3">
          <span data-testid="progress-timer">{elapsedMs}ms</span>
          <span data-testid="progress-percent">{percent}%</span>
          {canCancel && onCancel && (
            <button
              type="button"
              data-testid="btn-progress-cancel"
              className="px-2 py-0.5 text-xs text-red-600 bg-white border border-red-300 rounded hover:bg-red-50"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
        <div
          data-testid="progress-fill"
          className="bg-blue-600 h-2 rounded-full transition-all duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export interface ToolErrorBannerProps {
  error: Error | string | null;
  validation?: ValidationResult | null;
  onDismiss?: () => void;
}

export function ToolErrorBanner({ error, validation, onDismiss }: ToolErrorBannerProps) {
  if (!error && (!validation || validation.valid)) {
    return null;
  }

  const errorMessage =
    typeof error === "string"
      ? error
      : error?.message ||
        validation?.errors?.[0] ||
        validation?.diagnostics?.[0]?.message ||
        "An unexpected error occurred.";

  const diagnostics = validation?.diagnostics || [];

  return (
    <div
      role="alert"
      data-testid="tool-error-banner"
      className="error-banner tactile-error p-3 border border-red-300 bg-red-50 text-red-900 rounded-lg space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-semibold text-sm" data-testid="error-message">
            {errorMessage}
          </p>
          {diagnostics.length > 0 && (
            <ul className="text-xs list-disc list-inside space-y-0.5 text-red-800" data-testid="diagnostics-list">
              {diagnostics.map((diag, idx) => (
                <li key={idx} data-testid="diagnostic-item">
                  {diag.line !== undefined && diag.column !== undefined ? (
                    <span className="diagnostic-coords font-mono font-semibold">
                      Line {diag.line}, Column {diag.column}:{" "}
                    </span>
                  ) : null}
                  <span>{diag.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            data-testid="btn-dismiss-error"
            aria-label="Dismiss error"
            className="text-xs text-red-700 hover:text-red-900 font-bold px-1"
            onClick={onDismiss}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 6. ToolActionBar & ToolOutputPreview Components (Feature 15)
// ============================================================================

export interface ToolActionBarProps {
  result: ToolResult | null;
  onWorkflowChain?: (output: unknown) => void;
  disabled?: boolean;
  suggestedFilename?: string;
  mimeType?: string;
}

export function ToolActionBar({
  result,
  onWorkflowChain,
  disabled = false,
  suggestedFilename = "output.txt",
  mimeType = "text/plain",
}: ToolActionBarProps) {
  const [copied, setCopied] = useState(false);

  const hasResult = result !== null && result.data !== undefined && result.data !== null;

  const handleCopy = async () => {
    if (!hasResult) return;
    try {
      const textToCopy =
        typeof result.data === "object" ? JSON.stringify(result.data, null, 2) : String(result.data);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Copy error fallback
    }
  };

  const handleDownload = () => {
    if (!hasResult) return;

    const rawFilename = result.suggestedFilename || suggestedFilename;
    // Filename sanitization (illegal characters replaced with underscore)
    const sanitizedFilename = rawFilename.replace(/[/\\:*?"<>|]/g, "_");

    const blobUrl =
      (typeof result.metadata?.blobUrl === "string" ? result.metadata.blobUrl : null) ||
      (result.data instanceof Blob ? URL.createObjectURL(result.data) : null);

    const anchor = document.createElement("a");
    anchor.download = sanitizedFilename;

    if (blobUrl) {
      anchor.href = blobUrl;
    } else {
      const blob = new Blob([String(result.data)], {
        type: result.mimeType || mimeType,
      });
      anchor.href = URL.createObjectURL(blob);
    }

    anchor.click();

    // Revoke temp anchor url if created inline
    if ((!result.metadata || typeof result.metadata.blobUrl !== "string") && anchor.href.startsWith("blob:")) {
      URL.revokeObjectURL(anchor.href);
    }
  };

  return (
    <div className="tool-action-bar flex items-center justify-between gap-3 pt-4 border-t border-stone-200" data-testid="tool-action-bar">
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="btn-action-copy"
          className="btn btn-sm px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={disabled || !hasResult}
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>

        <button
          type="button"
          data-testid="btn-action-download"
          className="btn btn-sm px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={disabled || !hasResult}
          onClick={handleDownload}
        >
          Download
        </button>

        {onWorkflowChain && (
          <button
            type="button"
            data-testid="btn-action-chain"
            className="btn btn-sm px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-800 hover:bg-blue-100 rounded border border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={disabled || !hasResult}
            onClick={() => onWorkflowChain(result?.data)}
          >
            Chain to Workflow
          </button>
        )}
      </div>

      {hasResult && result.durationMs !== undefined && (
        <span className="text-xs text-stone-500" data-testid="result-duration">
          {result.durationMs}ms
        </span>
      )}
    </div>
  );
}

export interface ToolOutputPreviewProps {
  result: ToolResult | null;
  outputConfig?: ToolOutput;
}

export function ToolOutputPreview({ result, outputConfig }: ToolOutputPreviewProps) {
  if (!result || result.data === undefined || result.data === null) {
    return (
      <div className="output-empty p-6 text-center text-xs text-stone-400 border border-stone-200 rounded bg-stone-50" data-testid="output-empty">
        Run the tool to see output here.
      </div>
    );
  }

  const isImage =
    outputConfig?.type === "image" ||
    (result.mimeType && result.mimeType.startsWith("image/"));

  const isTable =
    outputConfig?.type === "table" ||
    (Array.isArray(result.data) && result.data.length > 0 && typeof result.data[0] === "object");

  if (isImage) {
    const src =
      (typeof result.metadata?.blobUrl === "string" ? result.metadata.blobUrl : null) ||
      String(result.data);
    return (
      <div className="output-preview image-preview p-4 border border-stone-200 rounded bg-stone-50 flex justify-center" data-testid="tool-output-preview">
        <img
          data-testid="preview-image"
          src={src}
          alt="Tool output preview"
          className="max-h-80 rounded shadow-sm object-contain"
        />
      </div>
    );
  }

  if (isTable && Array.isArray(result.data)) {
    const headers = Object.keys(result.data[0] || {});
    return (
      <div className="output-preview table-preview overflow-auto max-h-80 border border-stone-200 rounded" data-testid="tool-output-preview">
        <table className="w-full text-xs text-left border-collapse" data-testid="preview-table">
          <thead className="bg-stone-100 border-b border-stone-300 sticky top-0">
            <tr>
              {headers.map((h) => (
                <th key={h} className="p-2 font-semibold text-stone-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.map((row: Record<string, unknown>, rowIdx: number) => (
              <tr key={rowIdx} className="border-b border-stone-100 hover:bg-stone-50">
                {headers.map((h) => (
                  <td key={h} className="p-2 font-mono">
                    {String(row[h] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Default: Monospace text/code preview
  const textContent =
    typeof result.data === "object" ? JSON.stringify(result.data, null, 2) : String(result.data);

  return (
    <div className="output-preview text-preview" data-testid="tool-output-preview">
      <pre
        data-testid="preview-text"
        className="font-mono text-sm p-3 border border-stone-300 rounded bg-stone-900 text-stone-100 overflow-auto max-h-80"
      >
        <code>{textContent}</code>
      </pre>
    </div>
  );
}

// ============================================================================
// 7. CustomCanvasSlot Protocol (Feature 16)
// ============================================================================

export interface CustomCanvasSlotProps {
  definition: ToolDefinition;
  engine: ToolEngine;
  input: unknown;
  setInput: (input: unknown) => void;
  result: ToolResult | null;
  isProcessing: boolean;
  run: () => Promise<void>;
}

export class ToolErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ToolErrorBanner
          error={this.state.error || new Error("Custom canvas crashed")}
          onDismiss={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}

export function CustomCanvasSlot({
  definition,
  engine,
  input,
  setInput,
  result,
  isProcessing,
  run,
  customCanvas,
}: CustomCanvasSlotProps & {
  customCanvas?: (props: CustomCanvasSlotProps) => React.ReactNode;
}) {
  if (!customCanvas) {
    return null;
  }

  return (
    <div className="custom-canvas-slot border border-stone-300 rounded-lg p-4 bg-white" data-testid="custom-canvas-slot">
      <ToolErrorBoundary>
        {customCanvas({
          definition,
          engine,
          input,
          setInput,
          result,
          isProcessing,
          run,
        })}
      </ToolErrorBoundary>
    </div>
  );
}

// ============================================================================
// 8. UniversalToolShell Main Component (Feature 10)
// ============================================================================

export interface UniversalToolShellProps {
  definition: ToolDefinition;
  engine: ToolEngine;
  customCanvas?: (props: CustomCanvasSlotProps) => React.ReactNode;
  initialInput?: unknown;
  onWorkflowChain?: (output: unknown) => void;
}

export function UniversalToolShell({
  definition,
  engine,
  customCanvas,
  initialInput,
  onWorkflowChain,
}: UniversalToolShellProps) {
  const { state, result, validation, error, progress, run, cancel, reset, blobUrls } = useToolEngine(
    definition,
    engine
  );

  // Manage primary text input and controls state
  const isZeroInput = definition.input.length === 0;

  const primaryInputConfig = definition.input.find((i) => i.control === "text" || i.control === "textarea" || i.control === "code");
  const fileInputConfig = definition.input.find((i) => i.control === "file" || i.control === "files") as FileInputConfig | undefined;

  const [textInput, setTextInput] = useState<string>(() => {
    if (typeof initialInput === "string") return initialInput;
    if (initialInput && typeof initialInput === "object") {
      const obj = initialInput as Record<string, unknown>;
      if ("input" in obj) return String(obj.input ?? "");
      if (primaryInputConfig && primaryInputConfig.name in obj) {
        return String(obj[primaryInputConfig.name] ?? "");
      }
    }
    if (primaryInputConfig && "defaultValue" in primaryInputConfig) {
      return String((primaryInputConfig as { defaultValue?: unknown }).defaultValue ?? "");
    }
    return "";
  });

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

  const [dismissedError, setDismissedError] = useState(false);

  // Reset dismissed error flag when a new run begins
  useEffect(() => {
    if (state === "processing" || state === "validating") {
      setDismissedError(false);
    }
  }, [state]);

  const handleControlChange = (name: string, value: unknown) => {
    setControlValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleExecute = useCallback(async () => {
    blobUrls.revokeAll();
    if (isZeroInput) {
      await run({});
      return;
    }

    // Build payload: if tool has controls, combine text input and control values
    const hasMultipleInputs = definition.input.length > 1;
    if (hasMultipleInputs) {
      const payload: Record<string, unknown> = { ...controlValues };
      if (primaryInputConfig) {
        payload[primaryInputConfig.name] = textInput;
      } else {
        payload.input = textInput;
      }
      await run(payload);
    } else {
      await run(textInput);
    }
  }, [isZeroInput, definition.input, controlValues, primaryInputConfig, textInput, run]);

  // Keyboard shortcut: Cmd+Enter / Ctrl+Enter at shell container
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  const isProcessing = state === "processing" || state === "validating";

  return (
    <div
      role="region"
      aria-label={definition.name}
      data-testid="universal-tool-shell"
      className="shell universal-tool-shell tactile-technical bg-white border border-stone-200 rounded-xl p-6 shadow-sm max-w-4xl mx-auto space-y-6"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <ToolHeader definition={definition} />

      {/* Custom Visual Slot Protocol */}
      {customCanvas ? (
        <CustomCanvasSlot
          definition={definition}
          engine={engine}
          input={textInput}
          setInput={(val) => {
            if (typeof val === "string") setTextInput(val);
          }}
          result={result}
          isProcessing={isProcessing}
          run={handleExecute}
          customCanvas={customCanvas}
        />
      ) : isZeroInput ? (
        /* Zero-Input Tool Shell (e.g. UUID, timestamp generator) */
        <div className="zero-input-zone text-center p-8 bg-stone-50 border border-stone-200 rounded-lg space-y-4" data-testid="zero-input-shell">
          <p className="text-sm text-stone-600">This tool requires zero input parameters. Click Generate to produce output.</p>
          <button
            type="button"
            data-testid="btn-generate-zero-input"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-sm text-sm"
            disabled={isProcessing}
            onClick={handleExecute}
          >
            {isProcessing ? "Generating..." : "Generate Output"}
          </button>
        </div>
      ) : (
        /* Standard Input Controls */
        <div className="input-zone space-y-4" data-testid="standard-input-zone">
          {fileInputConfig && (
            <ToolDropzone
              accept={fileInputConfig.accept}
              maxBytes={fileInputConfig.maxBytes}
              maxFiles={fileInputConfig.control === "files" ? 10 : 1}
              onFileLoaded={(content) => setTextInput(content)}
              onError={(err) => alert(err)}
              disabled={isProcessing}
            />
          )}

          <ToolEditor
            value={textInput}
            onChange={(val) => setTextInput(val)}
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

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="btn-run"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-sm disabled:opacity-50"
              disabled={isProcessing}
              onClick={handleExecute}
            >
              {isProcessing ? "Processing..." : "Run"}
            </button>
          </div>
        </div>
      )}

      {/* Progress & Cancel Bar */}
      <ToolProgressBar
        isProcessing={isProcessing}
        progress={progress}
        onCancel={cancel}
        canCancel={Boolean(engine.cancel)}
      />

      {/* Diagnostic Error Banner */}
      {!dismissedError && (
        <ToolErrorBanner
          error={error}
          validation={validation}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      {/* Output Preview */}
      <div className="output-zone space-y-2" data-testid="output-zone">
        <ToolOutputPreview result={result} outputConfig={definition.output[0]} />
        <ToolActionBar
          result={result}
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
    </div>
  );
}

// ============================================================================
// 9. Dynamic Route Component (Feature 19)
// ============================================================================

export interface DynamicToolRouteProps {
  slug: string;
  getToolFn: (slugOrId: string) => ToolDefinition | null;
  getEngineFn: (slugOrId: string) => ToolEngine | null;
  onWorkflowChain?: (output: unknown) => void;
}

export function DynamicToolRoute({
  slug,
  getToolFn,
  getEngineFn,
  onWorkflowChain,
}: DynamicToolRouteProps) {
  // Dual-key resolution for the 6 mismatched slug/id tools
  const resolvedKey = resolveToolKey(slug);
  const definition = getToolFn(resolvedKey) || getToolFn(slug);

  if (!definition) {
    return (
      <main className="shell not-found-page p-12 text-center" data-testid="not-found-page">
        <h1 className="text-3xl font-bold text-stone-800">404</h1>
        <p className="text-stone-600 mt-2">Tool Not Found: {slug}</p>
      </main>
    );
  }

  const engine = getEngineFn(resolvedKey) || getEngineFn(slug);
  if (!engine) {
    return (
      <main className="shell not-found-page p-12 text-center" data-testid="not-found-page">
        <h1 className="text-3xl font-bold text-stone-800">404</h1>
        <p className="text-stone-600 mt-2">Engine Not Found: {slug}</p>
      </main>
    );
  }

  // Generate SEO / AEO / GEO Metadata JSON-LD schemas
  const canonicalUrl = `https://codestation.in/tools/${definition.slug || definition.id}`;

  const geoSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: definition.name,
    description: definition.description,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: definition.category,
    operatingSystem: "All (Web Browser)",
    browserRequirements: "Requires JavaScript. 100% In-Browser. Zero Server Uploads.",
    url: canonicalUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const aeoFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What does ${definition.name} do?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${definition.description} 100% private in-browser computation.`,
        },
      },
      {
        "@type": "Question",
        name: `Is my data private when using ${definition.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. All computations run in the browser without server uploads or external telemetry.",
        },
      },
    ],
  };

  return (
    <main className="shell dynamic-tool-page py-6" data-testid="dynamic-tool-page">
      {/* SEO Canonical Link */}
      <link rel="canonical" href={canonicalUrl} data-testid="seo-canonical" />

      {/* GEO Structured Data */}
      <script
        type="application/ld+json"
        data-testid="geo-schema"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(geoSchema) }}
      />

      {/* AEO Structured Data */}
      <script
        type="application/ld+json"
        data-testid="aeo-schema"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aeoFaqSchema) }}
      />

      <UniversalToolShell
        definition={definition}
        engine={engine}
        onWorkflowChain={onWorkflowChain}
      />
    </main>
  );
}
