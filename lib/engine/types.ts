/**
 * Code Station — Canonical Tool Engine Contracts & Lifecycle Interfaces
 * Single source of truth for all tools across Code Station.
 *
 * Strict TypeScript: zero untyped leaks. All dynamic types use unknown or generics.
 */

import type { ReactNode } from "react";

// ============================================================================
// 1. Tool Input Schemas (Discriminated Union on `control`)
// ============================================================================

export type ToolInputTextControl =
  | "text"
  | "textarea"
  | "code"
  | "password"
  | "date"
  | "time"
  | "timezone";

export type ToolInputFileControl = "file" | "files";
export type ToolInputSelectControl = "select" | "radio";
export type ToolInputBooleanControl = "toggle" | "checkbox";
export type ToolInputNumberControl = "number" | "range";
export type ToolInputCustomControl = "custom";

export type ToolInputControl =
  | ToolInputTextControl
  | ToolInputFileControl
  | ToolInputSelectControl
  | ToolInputBooleanControl
  | ToolInputNumberControl
  | ToolInputCustomControl;

/**
 * Declarative conditional visibility predicate.
 * Evaluated against current form state to dynamically show/hide inputs.
 */
export interface ToolInputWhenObject {
  readonly field: string;
  readonly equals?: unknown;
  /** Backward-compatibility alias for equals */
  readonly value?: unknown;
  readonly notEquals?: unknown;
  readonly in?: readonly unknown[];
}

/** Alias for backward compatibility */
export type InputCondition = ToolInputWhenObject;

export type ToolInputWhenFn = (
  values: Readonly<Record<string, unknown>>
) => boolean;

export type ToolInputWhen = ToolInputWhenObject | ToolInputWhenFn;

/**
 * Common base properties shared by all ToolInput configurations.
 */
export interface ToolInputBase {
  name: string;
  label: string;
  description?: string;
  /** Backwards compatibility alias for description */
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  when?: ToolInputWhen;
}

/**
 * Text, textarea, and code editor input configuration.
 */
export interface TextInputConfig extends ToolInputBase {
  control: ToolInputTextControl;
  placeholder?: string;
  defaultValue?: string;
  /**
   * Code language mode for syntax highlighting (e.g., "json", "sql", "yaml", "xml", "markdown", "javascript", "css", "html", "plaintext").
   */
  language?: string;
  maxLength?: number;
  monospace?: boolean;
  rows?: number;
  autoFocus?: boolean;
  spellCheck?: boolean;
}

/**
 * In-memory read mode for uploaded files before execution.
 */
export type FileReadMode =
  | "text"
  | "arrayBuffer"
  | "dataUrl"
  | "binaryString"
  | "blob";

/**
 * Single and multiple file drag-and-drop upload configuration.
 */
export interface FileInputConfig extends ToolInputBase {
  control: ToolInputFileControl;
  /**
   * Comma-separated MIME types or file extensions (e.g. ".pdf,application/pdf", "image/*", ".xlsx,.csv").
   */
  accept?: string;
  /**
   * Maximum file size limit in bytes (e.g. 64 * 1024 * 1024 for 64 MB).
   */
  maxBytes?: number;
  /**
   * Maximum number of files permitted when control === "files". Defaults to 1 for "file".
   */
  maxFiles?: number;
  /**
   * Memory representation passed to engine.process(). Defaults to "arrayBuffer".
   */
  readAs?: FileReadMode;
}

/**
 * Option item for select and radio button controls.
 */
export interface SelectOption {
  label: string;
  value: string | number;
  description?: string;
  disabled?: boolean;
  group?: string;
}

/**
 * Single-select dropdown and radio button configuration.
 */
export interface SelectInputConfig extends ToolInputBase {
  control: ToolInputSelectControl;
  /**
   * List of selectable choices. Accepts option objects or shorthand strings/numbers.
   */
  options: ReadonlyArray<SelectOption | string | number>;
  defaultValue?: string | number;
  placeholder?: string;
}

/**
 * Boolean toggle switch and checkbox configuration.
 */
export interface BooleanInputConfig extends ToolInputBase {
  control: ToolInputBooleanControl;
  defaultValue?: boolean;
  labelOn?: string;
  labelOff?: string;
}

/**
 * Numeric input box and range slider configuration.
 */
export interface NumberInputConfig extends ToolInputBase {
  control: ToolInputNumberControl;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  placeholder?: string;
}

/**
 * Specialized station input controls (custom components, canvas params, complex schemas).
 */
export interface CustomInputConfig extends ToolInputBase {
  control: ToolInputCustomControl;
  customType?: string;
  defaultValue?: unknown;
  options?: ReadonlyArray<SelectOption | string | number>;
  params?: Record<string, unknown>;
}

/**
 * Discriminated union of all ToolInput variants, discriminated on `control`.
 */
export type ToolInput =
  | TextInputConfig
  | FileInputConfig
  | SelectInputConfig
  | BooleanInputConfig
  | NumberInputConfig
  | CustomInputConfig;

// ============================================================================
// 2. Tool Output Schemas (Discriminated Union on `type`)
// ============================================================================

export type ToolOutputTextType = "text" | "code";
export type ToolOutputBinaryType = "blob" | "binary" | "file";
export type ToolOutputTableType = "table";
export type ToolOutputImageType = "image";
export type ToolOutputCustomType = "custom";

export type ToolOutputType =
  | ToolOutputTextType
  | ToolOutputBinaryType
  | ToolOutputTableType
  | ToolOutputImageType
  | ToolOutputCustomType;

/**
 * Common base properties shared by all ToolOutput configurations.
 */
export interface ToolOutputBase {
  id: string;
  label: string;
  description?: string;
}

/**
 * Formatted text and code block output configuration.
 */
export interface TextOutputConfig extends ToolOutputBase {
  type: ToolOutputTextType;
  /**
   * Code language mode for syntax highlighting (e.g., "json", "sql", "yaml", "xml", "markdown", "diff", "plaintext").
   */
  language?: string;
  copyable?: boolean;
  downloadable?: boolean;
  suggestedExtension?: string;
  suggestedFilename?: string;
  mimeType?: string;
  monospace?: boolean;
  wrap?: boolean;
}

/**
 * Binary, Blob, and downloadable file output configuration.
 */
export interface BinaryOutputConfig extends ToolOutputBase {
  type: ToolOutputBinaryType;
  /**
   * Standard IANA MIME type (e.g. "application/pdf", "image/png", "application/zip", "audio/wav").
   */
  mimeType?: string;
  suggestedFilename?: string;
  downloadable?: boolean;
  previewSupported?: boolean;
}

/**
 * Column definition for structured table outputs.
 */
export interface TableColumnConfig {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string | number;
  format?: "text" | "number" | "date" | "code" | "badge";
}

/** Alias for backward compatibility */
export type TableColumn = TableColumnConfig;

/**
 * Structured tabular output configuration.
 */
export interface TableOutputConfig extends ToolOutputBase {
  type: ToolOutputTableType;
  /**
   * Columns to render in table view. Accepts structured column configs or string keys.
   */
  columns?: ReadonlyArray<TableColumnConfig | string>;
  searchable?: boolean;
  sortable?: boolean;
  pagination?: boolean | { pageSize: number };
  downloadable?: boolean;
  suggestedFilename?: string;
}

/**
 * Visual image preview and rendering output configuration.
 */
export interface ImageOutputConfig extends ToolOutputBase {
  type: ToolOutputImageType;
  format?: "png" | "jpeg" | "webp" | "svg" | "gif" | "bmp" | "ico" | string;
  mimeType?: string;
  downloadable?: boolean;
  suggestedFilename?: string;
  zoomable?: boolean;
  dimensions?: {
    width?: number;
    height?: number;
  };
  showTransparencyGrid?: boolean;
}

/**
 * Interactive custom canvas or visual preview outputs.
 */
export interface CustomOutputConfig extends ToolOutputBase {
  type: ToolOutputCustomType;
  renderer?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Discriminated union of all ToolOutput variants, discriminated on `type`.
 */
export type ToolOutput =
  | TextOutputConfig
  | BinaryOutputConfig
  | TableOutputConfig
  | ImageOutputConfig
  | CustomOutputConfig;

// ============================================================================
// 3. Validation & Diagnostic Schemas
// ============================================================================

export type ValidationSeverity = "error" | "warning" | "info";
export type DiagnosticSeverity = ValidationSeverity;

export interface ValidationDiagnostic {
  field?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity?: ValidationSeverity;
  rule?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: readonly string[];
  diagnostics?: readonly ValidationDiagnostic[];
}

// ============================================================================
// 4. Execution Context & Progress Reporting
// ============================================================================

export interface ToolProgress {
  percent?: number;
  label?: string;
  stage?: string;
}

export type WorkerRunnerHelper = <TReq, TRes>(
  workerPath: string,
  payload: TReq,
  transfer?: Transferable[]
) => Promise<TRes>;

export interface ToolContext {
  signal: AbortSignal;
  reportProgress: (progress: ToolProgress) => void;
  runInWorker?: WorkerRunnerHelper;
  /** Backwards compatibility alias for runInWorker */
  runWorker?: WorkerRunnerHelper;
}

// ============================================================================
// 5. Tool Result Schema
// ============================================================================

export interface ToolResult<TOutput = unknown> {
  data: TOutput;
  /** Backwards-compatibility alias for data */
  output?: TOutput;
  mimeType?: string;
  suggestedFilename?: string;
  durationMs: number;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 6. Tool Definition & Tool Engine Contracts
// ============================================================================

export type ToolProcessingType = "local" | "network-opt-in";

export interface ToolDefinitionSeo {
  title?: string;
  description?: string;
  keywords?: readonly string[];
}

export interface ToolDefinition {
  // Required core contract
  id: string;
  name: string;
  category: string;
  description: string;

  processing: ToolProcessingType;
  offlineSupported: boolean;

  input: ToolInput[];
  output: ToolOutput[];

  worker?: string;
  dependencies?: string[];
  capabilities?: string[];

  // Optional metadata extensions
  slug?: string;
  keywords?: readonly string[];
  featured?: boolean;
  pairId?: string;
  direction?: "forward" | "reverse";
  pairedTool?: string;
  relatedTools?: readonly string[];
  seo?: ToolDefinitionSeo;

  // Station migration compatibility fields
  inputFormat?: string;
  outputFormat?: string;
  inputType?: string;
  outputType?: string;
  route?: string;
  dataContract?: unknown;
  encodingContract?: unknown;
  securityContract?: unknown;
  regexContract?: unknown;
  dateTimeContract?: unknown;
  textContract?: unknown;
  cronContract?: unknown;
  sqlContract?: unknown;
  webContract?: unknown;
  apiContract?: unknown;
  localContract?: unknown;
  spreadsheetContract?: unknown;
  pdfContract?: unknown;
  imageContract?: unknown;
  compressionContract?: unknown;
}

export interface ToolEngine<TInput = unknown, TOutput = unknown> {
  validate(input: unknown): ValidationResult | Promise<ValidationResult>;
  process(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>;
  cancel?(): void;
  dispose?(): void;
}

// ============================================================================
// 7. Execution Runtime States & UI Shell Interoperability
// ============================================================================

export type ToolExecutionState =
  | "idle"
  | "validating"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

export interface CustomCanvasSlotProps {
  definition: ToolDefinition;
  engine: ToolEngine;
  input: unknown;
  setInput: (input: unknown) => void;
  result: ToolResult | null;
  isProcessing: boolean;
  run: () => Promise<void>;
}

export interface UniversalToolShellProps {
  definition: ToolDefinition;
  engine: ToolEngine;
  customCanvas?: (props: CustomCanvasSlotProps) => ReactNode;
  initialInput?: unknown;
}

// ============================================================================
// 8. Canonical Helpers & Type Guards
// ============================================================================

export function isTextInput(input: ToolInput): input is TextInputConfig {
  return (
    input.control === "text" ||
    input.control === "textarea" ||
    input.control === "code" ||
    input.control === "password" ||
    input.control === "date" ||
    input.control === "time" ||
    input.control === "timezone"
  );
}

export function isFileInput(input: ToolInput): input is FileInputConfig {
  return input.control === "file" || input.control === "files";
}

export function isSelectInput(input: ToolInput): input is SelectInputConfig {
  return input.control === "select" || input.control === "radio";
}

export function isBooleanInput(input: ToolInput): input is BooleanInputConfig {
  return input.control === "toggle" || input.control === "checkbox";
}

export function isNumberInput(input: ToolInput): input is NumberInputConfig {
  return input.control === "number" || input.control === "range";
}

export function isCustomInput(input: ToolInput): input is CustomInputConfig {
  return input.control === "custom";
}

export function isTextOutput(output: ToolOutput): output is TextOutputConfig {
  return output.type === "text" || output.type === "code";
}

export function isBinaryOutput(output: ToolOutput): output is BinaryOutputConfig {
  return (
    output.type === "blob" ||
    output.type === "binary" ||
    output.type === "file"
  );
}

export function isTableOutput(output: ToolOutput): output is TableOutputConfig {
  return output.type === "table";
}

export function isImageOutput(output: ToolOutput): output is ImageOutputConfig {
  return output.type === "image";
}

export function isCustomOutput(output: ToolOutput): output is CustomOutputConfig {
  return output.type === "custom";
}

export function createValidationSuccess(
  diagnostics?: readonly ValidationDiagnostic[]
): ValidationResult {
  return diagnostics ? { valid: true, diagnostics } : { valid: true };
}

export function createValidResult(
  diagnostics?: readonly ValidationDiagnostic[]
): ValidationResult {
  return createValidationSuccess(diagnostics);
}

export function createValidationError(
  message: string,
  diagnostics?: readonly ValidationDiagnostic[]
): ValidationResult {
  return {
    valid: false,
    errors: [message],
    diagnostics: diagnostics ?? [{ message, severity: "error" }],
  };
}

export function createInvalidResult(
  errors: readonly string[] | readonly ValidationDiagnostic[]
): ValidationResult {
  if (errors.length === 0) {
    return {
      valid: false,
      errors: ["Validation failed with an unspecified error."],
    };
  }
  if (typeof errors[0] === "string") {
    return { valid: false, errors: errors as readonly string[] };
  }
  const diags = errors as readonly ValidationDiagnostic[];
  return {
    valid: false,
    errors: diags.map((d) => d.message),
    diagnostics: diags,
  };
}

export function formatValidationDiagnostic(diag: ValidationDiagnostic): string {
  const parts: string[] = [];
  if (diag.field) {
    parts.push(`Field '${diag.field}'`);
  }
  if (diag.line !== undefined) {
    parts.push(
      `line ${diag.line}${diag.column !== undefined ? `:${diag.column}` : ""}`
    );
  }
  const prefix = parts.length > 0 ? `[${parts.join(", ")}] ` : "";
  return `${prefix}${diag.message}`;
}
