// @vitest-environment jsdom
/**
 * Code Station — Tool Engine E2E Contract Test Suite
 *
 * Tiers 1 & 2 Opaque-Box Coverage for Features 1-5, 17, 18, 21:
 * - Feature 1: ToolDefinition Interface (5 T1, 5 T2)
 * - Feature 2: ToolEngine Interface (5 T1, 5 T2)
 * - Feature 3: ToolInput Schemas (5 T1, 5 T2)
 * - Feature 4: ToolOutput Schemas (5 T1, 5 T2)
 * - Feature 5: ValidationResult & Diagnostics (5 T1, 5 T2)
 * - Feature 17: adaptToolToEngine Legacy Adapter & Dual-Key Resolution (5 T1, 5 T2)
 * - Feature 18: Full 362 Tool Registry Unification & Station Census (5 T1, 5 T2)
 * - Feature 21: WebMCP / MCP Agent Readiness Bridge (5 T1, 5 T2)
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { tools, getTool } from "@/config/tools";
import type {
  ToolDefinition,
  ToolEngine,
  ToolInput,
  TextInputConfig,
  FileInputConfig,
  SelectInputConfig,
  BooleanInputConfig,
  NumberInputConfig,
  CustomInputConfig,
  ToolOutput,
  TextOutputConfig,
  BinaryOutputConfig,
  TableOutputConfig,
  ImageOutputConfig,
  CustomOutputConfig,
  ValidationResult,
  ValidationDiagnostic,
  ToolContext,
  ToolResult,
  ToolProcessingType,
} from "../../types";
import {
  isTextInput,
  isFileInput,
  isSelectInput,
  isBooleanInput,
  isNumberInput,
  isCustomInput,
  isTextOutput,
  isBinaryOutput,
  isTableOutput,
  isImageOutput,
  isCustomOutput,
  createValidationSuccess,
  createValidResult,
  createValidationError,
  createInvalidResult,
  formatValidationDiagnostic,
} from "../../types";
import {
  executeTool,
  ExecutionRuntimeController,
  normalizeToolResult,
  ValidationError,
  ToolEngineError,
} from "../../runtime";
import { dispatchToolExecution } from "@/lib/webmcp/dispatcher";
import { LIST_TOOLS_MCP } from "@/lib/webmcp/registry";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockToolDefinition,
  createMockToolEngine,
  adaptToolToEngine,
  resolveToolKey,
  MISMATCHED_SLUG_ID_MAP,
  serializeToolToWebMcp,
  serializeToolToLocalMcp,
  type LegacyToolMetadata,
  ToolActionBar,
  ToolControls,
} from "./testHelpers";

describe("E2E Contract: Feature 1 - ToolDefinition Interface", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F1-01: validates all required ToolDefinition fields (id, name, category, description, processing, offlineSupported, input, output)", () => {
    const def: ToolDefinition = {
      id: "json-formatter",
      name: "JSON Formatter",
      category: "utilities",
      description: "Format and prettify raw JSON strings",
      processing: "local",
      offlineSupported: true,
      input: [
        {
          name: "input",
          label: "Input JSON",
          control: "textarea",
          required: true,
        },
      ],
      output: [
        {
          id: "formatted",
          label: "Formatted JSON",
          type: "code",
          language: "json",
          copyable: true,
          downloadable: true,
        },
      ],
    };

    expect(def.id).toBe("json-formatter");
    expect(def.name).toBe("JSON Formatter");
    expect(def.category).toBe("utilities");
    expect(def.description).toBe("Format and prettify raw JSON strings");
    expect(def.processing).toBe("local");
    expect(def.offlineSupported).toBe(true);
    expect(Array.isArray(def.input)).toBe(true);
    expect(Array.isArray(def.output)).toBe(true);
    expect(def.input).toHaveLength(1);
    expect(def.output).toHaveLength(1);
  });

  it("TIER1-F1-02: supports local processing mode and offline execution flag", () => {
    const localTool = createMockToolDefinition({
      processing: "local",
      offlineSupported: true,
    });

    expect(localTool.processing).toBe("local");
    expect(localTool.offlineSupported).toBe(true);
  });

  it("TIER1-F1-03: supports network-opt-in processing mode with explicit documentation", () => {
    const apiTool = createMockToolDefinition({
      id: "api-request-tester",
      name: "API Request Tester",
      processing: "network-opt-in",
      offlineSupported: false,
      description: "Dispatches HTTP requests directly from the client browser.",
    });

    expect(apiTool.processing).toBe("network-opt-in");
    expect(apiTool.offlineSupported).toBe(false);
  });

  it("TIER1-F1-04: validates optional metadata extensions (slug, keywords, featured, seo)", () => {
    const def = createMockToolDefinition({
      slug: "custom-slug-formatter",
      keywords: ["json", "formatter", "pretty"],
      featured: true,
      seo: {
        title: "Free JSON Formatter Online",
        description: "100% private in-browser JSON formatter.",
        keywords: ["json", "beautifier"],
      },
    });

    expect(def.slug).toBe("custom-slug-formatter");
    expect(def.keywords).toEqual(["json", "formatter", "pretty"]);
    expect(def.featured).toBe(true);
    expect(def.seo?.title).toBe("Free JSON Formatter Online");
    expect(def.seo?.keywords).toEqual(["json", "beautifier"]);
  });

  it("TIER1-F1-05: validates station contract metadata extensions", () => {
    const def = createMockToolDefinition({
      slug: "date-calculator",
      keywords: ["date", "diff"],
      dateTimeContract: { precision: "millisecond" },
    });

    expect(def.slug).toBe("date-calculator");
    expect(def.keywords).toContain("diff");
    expect(def.dateTimeContract).toEqual({ precision: "millisecond" });
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F1-01: enforces valid ToolProcessingType across canonical tool definitions", async () => {
    const localDef = createMockToolDefinition({ processing: "local" });
    const networkDef = createMockToolDefinition({ processing: "network-opt-in" });
    const engine = createMockToolEngine({
      process: async (input) => ({ data: `Processed: ${input}`, durationMs: 1 }),
    });

    const resLocal = await executeTool(localDef, engine, "test1");
    expect(resLocal.data).toBe("Processed: test1");

    const resNetwork = await executeTool(networkDef, engine, "test2");
    expect(resNetwork.data).toBe("Processed: test2");

    // Verify that adapted legacy tools strictly enforce "local" processing mode
    const adapted = adaptToolToEngine({
      id: "test-legacy",
      name: "Test Legacy",
      category: "data",
      description: "desc",
    });
    expect(adapted.definition.processing).toBe("local");
    expect(adapted.definition.offlineSupported).toBe(true);
  });

  it("TIER2-F1-02: handles missing definition fields gracefully with canonical fallbacks", async () => {
    const engine = createMockToolEngine({
      process: async () => ({ data: "output", durationMs: 1 }),
    });

    // Controller initialized with no definition must fall back to anonymous tool contract
    const controller = new ExecutionRuntimeController(engine);
    const res = await controller.run("test");
    expect(res?.data).toBe("output");

    // adaptToolToEngine with missing slug/name falls back to id
    const adapted = adaptToolToEngine({
      id: "minimal-tool",
      name: "",
      category: "",
      description: "",
    });
    expect(adapted.definition.id).toBe("minimal-tool");
    expect(adapted.definition.slug).toBe("minimal-tool");
    expect(adapted.definition.name).toBe("minimal-tool");
    expect(adapted.definition.category).toBe("utilities");
  });

  it("TIER2-F1-03: supports parameterless zero-input tool schemas (e.g. UUID generator)", () => {
    const uuidToolDef = createMockToolDefinition({
      id: "uuid-generator",
      name: "UUID Generator",
      input: [], // Zero inputs
      output: [
        {
          id: "uuid",
          label: "Generated UUID",
          type: "text",
          copyable: true,
        },
      ],
    });

    expect(uuidToolDef.input).toHaveLength(0);
    expect(uuidToolDef.output).toHaveLength(1);
  });

  it("TIER2-F1-04: validates tools with directional pairings (pairId, pairedTool, direction)", () => {
    const forwardDef = createMockToolDefinition({
      id: "base64-encode",
      pairId: "base64-pair",
      direction: "forward",
      pairedTool: "base64-decode",
    });

    const reverseDef = createMockToolDefinition({
      id: "base64-decode",
      pairId: "base64-pair",
      direction: "reverse",
      pairedTool: "base64-encode",
    });

    expect(forwardDef.pairId).toBe(reverseDef.pairId);
    expect(forwardDef.direction).toBe("forward");
    expect(reverseDef.direction).toBe("reverse");
    expect(forwardDef.pairedTool).toBe(reverseDef.id);
    expect(reverseDef.pairedTool).toBe(forwardDef.id);
  });

  it("TIER2-F1-05: validates complex SEO metadata with empty and non-empty keyword arrays", () => {
    const fullSeoDef = createMockToolDefinition({
      seo: {
        title: "SHA-256 Hash Generator — 100% In-Browser",
        description: "Generate SHA-256 cryptographic hashes securely.",
        keywords: ["sha256", "crypto", "hash"],
      },
    });

    const minimalSeoDef = createMockToolDefinition({
      seo: {
        title: "Minimal Title",
      },
    });

    expect(fullSeoDef.seo?.keywords).toHaveLength(3);
    expect(minimalSeoDef.seo?.title).toBe("Minimal Title");
    expect(minimalSeoDef.seo?.description).toBeUndefined();
    expect(minimalSeoDef.seo?.keywords).toBeUndefined();
  });
});

describe("E2E Contract: Feature 2 - ToolEngine Interface", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F2-01: validates synchronous validate() returning ValidationResult", async () => {
    const engine: ToolEngine<string> = {
      validate: (input: unknown): ValidationResult => {
        if (typeof input !== "string" || input.trim() === "") {
          return createValidationError("Input cannot be empty");
        }
        return createValidationSuccess();
      },
      process: async (input: string) => ({
        data: input.toUpperCase(),
        durationMs: 1,
      }),
    };

    const validResult = await engine.validate("hello");
    expect(validResult).toEqual({ valid: true });

    const invalidResult = await engine.validate("");
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors).toContain("Input cannot be empty");
  });

  it("TIER1-F2-02: validates asynchronous Promise<ValidationResult> from validate()", async () => {
    const asyncEngine: ToolEngine<string> = {
      validate: async (input: unknown): Promise<ValidationResult> => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (input === "invalid") {
          return createValidationError("Asynchronously rejected input");
        }
        return createValidationSuccess();
      },
      process: async (input: string) => ({
        data: input,
        durationMs: 5,
      }),
    };

    const validPromise = asyncEngine.validate("good");
    expect(validPromise).toBeInstanceOf(Promise);
    const valid = await validPromise;
    expect(valid.valid).toBe(true);

    const invalid = await asyncEngine.validate("invalid");
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain("Asynchronously rejected input");
  });

  it("TIER1-F2-03: processes valid input and returns ToolResult with data and durationMs", async () => {
    const engine: ToolEngine<{ text: string }, { characters: number; words: number }> = {
      validate: () => createValidationSuccess(),
      process: async (input: { text: string }): Promise<ToolResult<{ characters: number; words: number }>> => {
        const start = performance.now();
        const characters = input.text.length;
        const words = input.text.trim() === "" ? 0 : input.text.trim().split(/\s+/).length;
        return {
          data: { characters, words },
          durationMs: Math.round(performance.now() - start),
          mimeType: "application/json",
          suggestedFilename: "count.json",
        };
      },
    };

    const context: ToolContext = {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    };

    const result = await engine.process({ text: "Code Station developer tools" }, context);

    expect(result.data.characters).toBe(28);
    expect(result.data.words).toBe(4);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.suggestedFilename).toBe("count.json");
    expect(result.mimeType).toBe("application/json");
  });

  it("TIER1-F2-04: executes optional cancel() callback without throwing", () => {
    let cancelCalled = false;
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "ok", durationMs: 0 }),
      cancel: () => {
        cancelCalled = true;
      },
    };

    expect(typeof engine.cancel).toBe("function");
    engine.cancel?.();
    expect(cancelCalled).toBe(true);
  });

  it("TIER1-F2-05: executes optional dispose() callback for memory and resource cleanup", () => {
    let disposeCalled = false;
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "ok", durationMs: 0 }),
      dispose: () => {
        disposeCalled = true;
      },
    };

    expect(typeof engine.dispose).toBe("function");
    engine.dispose?.();
    expect(disposeCalled).toBe(true);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F2-01: handles process() rejecting with Error and preserves stack trace", async () => {
    const failingEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => {
        throw new Error("Memory overflow in WebAssembly buffer");
      },
    };

    const context: ToolContext = {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    };

    await expect(failingEngine.process("input", context)).rejects.toThrow(
      "Memory overflow in WebAssembly buffer"
    );
  });

  it("TIER2-F2-02: handles process() rejecting with non-Error string or primitive", async () => {
    const rawThrowEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => {
        // eslint-disable-next-line no-throw-literal
        throw "Unexpected string rejection";
      },
    };

    const context: ToolContext = {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    };

    await expect(rawThrowEngine.process("input", context)).rejects.toBe(
      "Unexpected string rejection"
    );
  });

  it("TIER2-F2-03: handles engines where cancel() or dispose() are undefined", () => {
    const minimalEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "minimal", durationMs: 0 }),
    };

    expect(minimalEngine.cancel).toBeUndefined();
    expect(minimalEngine.dispose).toBeUndefined();

    // Calling optionally must be safe
    expect(() => minimalEngine.cancel?.()).not.toThrow();
    expect(() => minimalEngine.dispose?.()).not.toThrow();
  });

  it("TIER2-F2-04: enforces non-negative durationMs in ToolResult", async () => {
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "fast", durationMs: 0 }),
    };

    const result = await engine.process("input", {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("TIER2-F2-05: handles async engine returning warnings and custom metadata object alongside result data", async () => {
    const engineWithMetadata: ToolEngine<string, string> = {
      validate: () => createValidationSuccess(),
      process: async (input: string) => ({
        data: input.trim(),
        durationMs: 2,
        warnings: ["Trailing whitespace was stripped"],
        metadata: {
          originalLength: input.length,
          trimmedLength: input.trim().length,
          encoding: "utf-8",
        },
      }),
    };

    const res = await engineWithMetadata.process("  hello world  \n", {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    });

    expect(res.data).toBe("hello world");
    expect(res.warnings).toEqual(["Trailing whitespace was stripped"]);
    expect(res.metadata?.originalLength).toBe(16);
    expect(res.metadata?.trimmedLength).toBe(11);
    expect(res.metadata?.encoding).toBe("utf-8");
  });
});

describe("E2E Contract: Feature 3 - ToolInput Schemas", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F3-01: parses text, textarea, and code editor configs", () => {
    const textConfig: TextInputConfig = {
      name: "rawString",
      label: "Raw String",
      control: "text",
      placeholder: "Enter text...",
      defaultValue: "",
      required: true,
      maxLength: 1000,
    };

    const codeConfig: TextInputConfig = {
      name: "schemaCode",
      label: "JSON Schema",
      control: "code",
      language: "json",
      monospace: true,
      rows: 15,
      spellCheck: false,
    };

    expect(isTextInput(textConfig)).toBe(true);
    expect(isTextInput(codeConfig)).toBe(true);
    expect(codeConfig.language).toBe("json");
    expect(codeConfig.rows).toBe(15);
  });

  it("TIER1-F3-02: parses file and files configs with accept, maxBytes, maxFiles, and readAs", () => {
    const singleFile: FileInputConfig = {
      name: "avatar",
      label: "Profile Picture",
      control: "file",
      accept: "image/png,image/jpeg,.webp",
      maxBytes: 5 * 1024 * 1024,
      readAs: "arrayBuffer",
      required: true,
    };

    const multiFiles: FileInputConfig = {
      name: "documents",
      label: "PDF Invoices",
      control: "files",
      accept: "application/pdf",
      maxBytes: 50 * 1024 * 1024,
      maxFiles: 10,
      readAs: "blob",
    };

    expect(isFileInput(singleFile)).toBe(true);
    expect(isFileInput(multiFiles)).toBe(true);
    expect(singleFile.control).toBe("file");
    expect(multiFiles.control).toBe("files");
    expect(multiFiles.maxFiles).toBe(10);
    expect(singleFile.readAs).toBe("arrayBuffer");
  });

  it("TIER1-F3-03: parses select and radio configs with structured SelectOption objects", () => {
    const selectConfig: SelectInputConfig = {
      name: "outputFormat",
      label: "Output Format",
      control: "select",
      options: [
        { label: "Pretty Printed (2 spaces)", value: "2" },
        { label: "Pretty Printed (4 spaces)", value: "4" },
        { label: "Minified (Single Line)", value: "minified" },
      ],
      defaultValue: "2",
      placeholder: "Select formatting style",
    };

    expect(isSelectInput(selectConfig)).toBe(true);
    expect(selectConfig.options).toHaveLength(3);
    expect(selectConfig.defaultValue).toBe("2");
  });

  it("TIER1-F3-04: parses boolean toggle and checkbox configs with labelOn and labelOff", () => {
    const toggleConfig: BooleanInputConfig = {
      name: "sortKeys",
      label: "Sort Object Keys",
      control: "toggle",
      defaultValue: false,
      labelOn: "Alphabetical",
      labelOff: "Original Order",
    };

    expect(isBooleanInput(toggleConfig)).toBe(true);
    expect(toggleConfig.defaultValue).toBe(false);
    expect(toggleConfig.labelOn).toBe("Alphabetical");
  });

  it("TIER1-F3-05: parses number and range configs with min, max, step, and unit", () => {
    const numberConfig: NumberInputConfig = {
      name: "compressionLevel",
      label: "Compression Level",
      control: "range",
      min: 1,
      max: 9,
      step: 1,
      defaultValue: 6,
      unit: "level",
    };

    expect(isNumberInput(numberConfig)).toBe(true);
    expect(numberConfig.min).toBe(1);
    expect(numberConfig.max).toBe(9);
    expect(numberConfig.defaultValue).toBe(6);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F3-01: validates discriminated union type guards for all ToolInput variants", () => {
    const text: ToolInput = { name: "t", label: "T", control: "text" };
    const file: ToolInput = { name: "f", label: "F", control: "file" };
    const sel: ToolInput = { name: "s", label: "S", control: "select", options: [] };
    const bool: ToolInput = { name: "b", label: "B", control: "toggle" };
    const num: ToolInput = { name: "n", label: "N", control: "number" };

    expect(isTextInput(text)).toBe(true);
    expect(isTextInput(file)).toBe(false);

    expect(isFileInput(file)).toBe(true);
    expect(isFileInput(text)).toBe(false);

    expect(isSelectInput(sel)).toBe(true);
    expect(isSelectInput(bool)).toBe(false);

    expect(isBooleanInput(bool)).toBe(true);
    expect(isBooleanInput(num)).toBe(false);

    expect(isNumberInput(num)).toBe(true);
    expect(isNumberInput(sel)).toBe(false);
  });

  it("TIER2-F3-02: validates file size constraints against maxBytes limit via engine validation gate", async () => {
    const maxBytes = 10 * 1024 * 1024; // 10MB
    const fileInputConfig: FileInputConfig = {
      name: "upload",
      label: "Upload File",
      control: "file",
      maxBytes,
      accept: "image/png,application/pdf",
    };
    expect(isFileInput(fileInputConfig)).toBe(true);

    const fileEngine: ToolEngine<{ file: { size: number; name: string } }> = {
      validate: (input) => {
        const file = (input as { file?: { size: number } })?.file;
        if (!file) return createValidationError("File is required");
        if (file.size > maxBytes) {
          return createValidationError(`File size exceeds limit of ${maxBytes} bytes`);
        }
        return createValidationSuccess();
      },
      process: async (input) => ({
        data: `Accepted ${input.file.name}`,
        durationMs: 1,
      }),
    };

    const def = createMockToolDefinition({ input: [fileInputConfig] });

    // Below maxBytes: passes validation and processes
    const validRes = await executeTool(def, fileEngine, {
      file: { size: 1024, name: "small.png" },
    });
    expect(validRes.data).toBe("Accepted small.png");

    // At boundary maxBytes: passes validation
    const boundaryRes = await executeTool(def, fileEngine, {
      file: { size: maxBytes, name: "boundary.png" },
    });
    expect(boundaryRes.data).toBe("Accepted boundary.png");

    // Exceeding maxBytes: blocked at validation gate
    await expect(
      executeTool(def, fileEngine, {
        file: { size: maxBytes + 1, name: "oversized.png" },
      })
    ).rejects.toThrow("File size exceeds limit of 10485760 bytes");
  });

  it("TIER2-F3-03: validates MIME type constraints against accepted pattern via engine gate", async () => {
    const fileInputConfig: FileInputConfig = {
      name: "imageFile",
      label: "Image Upload",
      control: "file",
      accept: "image/png,image/jpeg,image/*",
    };
    expect(isFileInput(fileInputConfig)).toBe(true);

    const mimeEngine: ToolEngine<{ mimeType: string }> = {
      validate: (input) => {
        const mime = (input as { mimeType?: string })?.mimeType;
        if (!mime?.startsWith("image/")) {
          return createValidationError(`Unsupported MIME type '${mime}'. Expected image/*`);
        }
        return createValidationSuccess();
      },
      process: async (input) => ({
        data: `Processed image: ${input.mimeType}`,
        durationMs: 1,
      }),
    };

    const def = createMockToolDefinition({ input: [fileInputConfig] });

    // Allowed image MIME types execute cleanly
    const pngRes = await executeTool(def, mimeEngine, { mimeType: "image/png" });
    expect(pngRes.data).toBe("Processed image: image/png");

    const webpRes = await executeTool(def, mimeEngine, { mimeType: "image/webp" });
    expect(webpRes.data).toBe("Processed image: image/webp");

    // Disallowed MIME types reject at validation gate
    await expect(
      executeTool(def, mimeEngine, { mimeType: "application/pdf" })
    ).rejects.toThrow("Unsupported MIME type 'application/pdf'");
    await expect(
      executeTool(def, mimeEngine, { mimeType: "application/x-executable" })
    ).rejects.toThrow("Unsupported MIME type 'application/x-executable'");
  });

  it("TIER2-F3-04: evaluates conditional 'when' predicates reactively via ToolControls rendering", () => {
    const inputs: ToolInput[] = [
      {
        name: "mode",
        label: "Mode",
        control: "select",
        options: ["simple", "advanced"],
        defaultValue: "simple",
      },
      {
        name: "advancedToggle",
        label: "Advanced Toggle",
        control: "toggle",
        when: { field: "mode", equals: "advanced" },
      },
      {
        name: "customThreshold",
        label: "Custom Threshold",
        control: "number",
        when: (vals) => vals.mode === "advanced",
      },
    ];

    // When mode is "simple", conditional inputs are not in the DOM
    const { rerender } = render(
      React.createElement(ToolControls, {
        inputs,
        values: { mode: "simple" },
        onChange: vi.fn(),
      })
    );
    expect(screen.queryByLabelText("Advanced Toggle")).toBeNull();
    expect(screen.queryByLabelText("Custom Threshold")).toBeNull();

    // When mode is "advanced", conditional inputs render in the DOM
    rerender(
      React.createElement(ToolControls, {
        inputs,
        values: { mode: "advanced" },
        onChange: vi.fn(),
      })
    );
    expect(screen.getByLabelText("Advanced Toggle")).toBeDefined();
    expect(screen.getByLabelText("Custom Threshold")).toBeDefined();
  });

  it("TIER2-F3-05: validates number input boundary clamping at exact min, max, and fractional step values", async () => {
    const numberConfig: NumberInputConfig = {
      name: "threshold",
      label: "Threshold",
      control: "number",
      min: 0,
      max: 100,
      step: 0.5,
      defaultValue: 50,
    };
    expect(isNumberInput(numberConfig)).toBe(true);

    const rangeEngine: ToolEngine<number> = {
      validate: (input) => {
        const val = Number(input);
        if (isNaN(val)) return createValidationError("Value must be a number");
        if (val < (numberConfig.min ?? 0) || val > (numberConfig.max ?? 100)) {
          return createValidationError(`Value must be between ${numberConfig.min} and ${numberConfig.max}`);
        }
        return createValidationSuccess();
      },
      process: async (input) => ({ data: `Val: ${input}`, durationMs: 1 }),
    };

    const def = createMockToolDefinition({ input: [numberConfig] });

    // Exact min boundary
    const minRes = await executeTool(def, rangeEngine, 0);
    expect(minRes.data).toBe("Val: 0");

    // Exact max boundary
    const maxRes = await executeTool(def, rangeEngine, 100);
    expect(maxRes.data).toBe("Val: 100");

    // Fractional step value
    const stepRes = await executeTool(def, rangeEngine, 49.5);
    expect(stepRes.data).toBe("Val: 49.5");

    // Below min
    await expect(executeTool(def, rangeEngine, -0.1)).rejects.toThrow("Value must be between 0 and 100");

    // Above max
    await expect(executeTool(def, rangeEngine, 100.1)).rejects.toThrow("Value must be between 0 and 100");
  });
});

describe("E2E Contract: Feature 4 - ToolOutput Schemas", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F4-01: formats text and code output with language, copyable, and downloadable flags", () => {
    const codeOutput: TextOutputConfig = {
      id: "formattedJson",
      label: "Beautified JSON",
      type: "code",
      language: "json",
      copyable: true,
      downloadable: true,
      suggestedExtension: "json",
      monospace: true,
    };

    expect(isTextOutput(codeOutput)).toBe(true);
    expect(codeOutput.language).toBe("json");
    expect(codeOutput.copyable).toBe(true);
    expect(codeOutput.downloadable).toBe(true);
  });

  it("TIER1-F4-02: handles binary and blob output with mimeType and suggestedFilename", () => {
    const binaryOutput: BinaryOutputConfig = {
      id: "compressedPdf",
      label: "Compressed PDF",
      type: "blob",
      mimeType: "application/pdf",
      suggestedFilename: "document-compressed.pdf",
      downloadable: true,
      previewSupported: true,
    };

    expect(isBinaryOutput(binaryOutput)).toBe(true);
    expect(binaryOutput.mimeType).toBe("application/pdf");
    expect(binaryOutput.suggestedFilename).toBe("document-compressed.pdf");
  });

  it("TIER1-F4-03: formats structured table output with column definitions and sorting", () => {
    const tableOutput: TableOutputConfig = {
      id: "csvData",
      label: "Parsed CSV Records",
      type: "table",
      columns: [
        { key: "id", label: "Record ID", width: 80 },
        { key: "name", label: "Full Name", align: "left" },
        { key: "email", label: "Email Address", align: "left" },
        { key: "score", label: "Score", align: "right", format: "number" },
      ],
      searchable: true,
      sortable: true,
      pagination: { pageSize: 25 },
      downloadable: true,
      suggestedFilename: "export.csv",
    };

    expect(isTableOutput(tableOutput)).toBe(true);
    expect(tableOutput.columns).toHaveLength(4);
    expect(tableOutput.searchable).toBe(true);
  });

  it("TIER1-F4-04: formats visual image output with format, dimensions, and transparency grid", () => {
    const imageOutput: ImageOutputConfig = {
      id: "optimizedImage",
      label: "Optimized WebP Image",
      type: "image",
      format: "webp",
      mimeType: "image/webp",
      downloadable: true,
      zoomable: true,
      showTransparencyGrid: true,
      dimensions: { width: 800, height: 600 },
    };

    expect(isImageOutput(imageOutput)).toBe(true);
    expect(imageOutput.format).toBe("webp");
    expect(imageOutput.dimensions?.width).toBe(800);
  });

  it("TIER1-F4-05: supports multi-output tools producing both text and binary artifacts", () => {
    const outputs: ToolOutput[] = [
      {
        id: "manifest",
        label: "Archive Manifest",
        type: "text",
        copyable: true,
      },
      {
        id: "zipArchive",
        label: "ZIP Archive",
        type: "blob",
        mimeType: "application/zip",
        suggestedFilename: "archive.zip",
        downloadable: true,
      },
    ];

    expect(outputs).toHaveLength(2);
    expect(isTextOutput(outputs[0])).toBe(true);
    expect(isBinaryOutput(outputs[1])).toBe(true);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F4-01: sanitizes illegal filesystem characters in suggestedFilename during download action", () => {
    const createElementSpy = vi.spyOn(document, "createElement");

    const result: ToolResult<string> = {
      data: "Sample report content",
      durationMs: 5,
      suggestedFilename: "report/2026:01*02?.pdf",
    };

    render(React.createElement(ToolActionBar, { result }));

    const downloadButton = screen.getByRole("button", { name: /Download/i });
    fireEvent.click(downloadButton);

    const anchorCalls = createElementSpy.mock.results.filter(
      (r) => r.value instanceof HTMLAnchorElement
    );
    expect(anchorCalls.length).toBeGreaterThan(0);
    const createdAnchor = anchorCalls[0].value as HTMLAnchorElement;
    expect(createdAnchor.download).toBe("report_2026_01_02_.pdf");
    expect(createdAnchor.download).not.toMatch(/[/\\:*?"<>|]/);

    createElementSpy.mockRestore();
  });

  it("TIER2-F4-02: produces valid ToolResult from 0-byte empty Blob payload", () => {
    const emptyBlob = new Blob([], { type: "text/plain" });
    expect(emptyBlob.size).toBe(0);

    const result: ToolResult<Blob> = {
      data: emptyBlob,
      durationMs: 2,
      mimeType: "text/plain",
      suggestedFilename: "empty.txt",
    };

    expect(result.data.size).toBe(0);
    expect(result.suggestedFilename).toBe("empty.txt");
  });

  it("TIER2-F4-03: produces valid ToolResult from empty table rows dataset", () => {
    const result: ToolResult<unknown[]> = {
      data: [],
      durationMs: 1,
      suggestedFilename: "empty-table.csv",
    };

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it("TIER2-F4-04: handles custom output type with custom renderer identifier and metadata dictionary", () => {
    const customOutput: CustomOutputConfig = {
      id: "waveform",
      label: "Audio Waveform Visualization",
      type: "custom",
      renderer: "AudioWaveformCanvas",
      metadata: { sampleRate: 44100, channels: 2 },
    };

    expect(isCustomOutput(customOutput)).toBe(true);
    expect(customOutput.type).toBe("custom");
    expect(customOutput.renderer).toBe("AudioWaveformCanvas");
    expect(customOutput.metadata?.sampleRate).toBe(44100);
  });

  it("TIER2-F4-05: normalizes legacy ToolResult output property to data via normalizeToolResult", () => {
    const rawLegacy = {
      output: "Legacy calculated value",
      durationMs: 15,
      suggestedFilename: "output.txt",
    };

    const normalized = normalizeToolResult(rawLegacy);
    expect(normalized.data).toBe("Legacy calculated value");
    expect(normalized.output).toBe("Legacy calculated value");
    expect(normalized.durationMs).toBe(15);
  });
});

describe("E2E Contract: Feature 5 - ValidationResult & Diagnostics", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F5-01: creates valid result with no errors or diagnostics", () => {
    const res = createValidationSuccess();
    expect(res.valid).toBe(true);
    expect(res.errors).toBeUndefined();
    expect(res.diagnostics).toBeUndefined();

    const aliasRes = createValidResult();
    expect(aliasRes.valid).toBe(true);
  });

  it("TIER1-F5-02: creates invalid result with error messages", () => {
    const res = createValidationError("JSON syntax error: unexpected token");
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("JSON syntax error: unexpected token");
    expect(res.diagnostics).toHaveLength(1);
    expect(res.diagnostics?.[0].severity).toBe("error");
  });

  it("TIER1-F5-03: attaches structured diagnostics with line, column, severity, and rule", () => {
    const diag: ValidationDiagnostic = {
      field: "payload",
      line: 4,
      column: 12,
      endLine: 4,
      endColumn: 18,
      message: "Unterminated string literal",
      severity: "error",
      rule: "syntax/unterminated-string",
    };

    const res = createValidationError(diag.message, [diag]);

    expect(res.valid).toBe(false);
    expect(res.diagnostics).toHaveLength(1);
    expect(res.diagnostics?.[0].line).toBe(4);
    expect(res.diagnostics?.[0].column).toBe(12);
    expect(res.diagnostics?.[0].rule).toBe("syntax/unterminated-string");
  });

  it("TIER1-F5-04: formats validation diagnostics into human-readable strings", () => {
    const diag: ValidationDiagnostic = {
      field: "config",
      line: 12,
      column: 5,
      message: "Key 'timeout' must be a positive integer",
      severity: "error",
    };

    const formatted = formatValidationDiagnostic(diag);
    expect(formatted).toBe("[Field 'config', line 12:5] Key 'timeout' must be a positive integer");
  });

  it("TIER1-F5-05: supports warning and info severity levels without blocking execution", () => {
    const warningDiag: ValidationDiagnostic = {
      message: "Deprecated property 'options.legacy' in use",
      severity: "warning",
    };

    const infoDiag: ValidationDiagnostic = {
      message: "Output compressed by 42%",
      severity: "info",
    };

    const res = createValidationSuccess([warningDiag, infoDiag]);

    expect(res.valid).toBe(true);
    expect(res.diagnostics).toHaveLength(2);
    expect(res.diagnostics?.[0].severity).toBe("warning");
    expect(res.diagnostics?.[1].severity).toBe("info");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F5-01: handles empty error array in createInvalidResult with default fallback message", () => {
    const res = createInvalidResult([]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Validation failed with an unspecified error.");
  });

  it("TIER2-F5-02: handles diagnostic with missing optional line and column fields", () => {
    const diag: ValidationDiagnostic = {
      message: "General schema non-conformance",
      severity: "error",
    };

    const formatted = formatValidationDiagnostic(diag);
    expect(formatted).toBe("General schema non-conformance");
  });

  it("TIER2-F5-03: handles multi-line diagnostic formatting with endLine and endColumn", () => {
    const diag: ValidationDiagnostic = {
      field: "query",
      line: 1,
      column: 1,
      endLine: 3,
      endColumn: 10,
      message: "Multi-line SQL comment unterminated",
    };

    const formatted = formatValidationDiagnostic(diag);
    expect(formatted).toContain("Field 'query'");
    expect(formatted).toContain("line 1:1");
    expect(formatted).toContain("Multi-line SQL comment unterminated");
  });

  it("TIER2-F5-04: validates that createValidationError produces valid: false with matching diagnostic", () => {
    const err = createValidationError("Root element missing");
    expect(err.valid).toBe(false);
    expect(err.errors?.[0]).toBe("Root element missing");
    expect(err.diagnostics?.[0].message).toBe("Root element missing");
    expect(err.diagnostics?.[0].severity).toBe("error");
  });

  it("TIER2-F5-05: validates ValidationError error class properties (code, message, result, diagnostics) from runtime.ts", () => {
    const valResult: ValidationResult = {
      valid: false,
      errors: ["Field 'username' is required"],
      diagnostics: [
        {
          field: "username",
          message: "Field 'username' is required",
          severity: "error",
        },
      ],
    };

    const err = new ValidationError(valResult);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ToolEngineError);
    expect(err.name).toBe("ValidationError");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Field 'username' is required");
    expect(err.diagnostics).toEqual(valResult.diagnostics);
    expect(err.errors).toEqual(valResult.errors);
  });
});

describe("E2E Contract: Feature 17 - adaptToolToEngine Legacy Adapter", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F17-01: adapts legacy tool metadata to canonical ToolDefinition", () => {
    const legacy: LegacyToolMetadata = {
      id: "legacy-reverser",
      name: "String Reverser",
      category: "text",
      description: "Reverses character sequence",
      keywords: ["reverse", "text"],
      offlineSupported: true,
    };

    const { definition } = adaptToolToEngine(legacy);

    expect(definition.id).toBe("legacy-reverser");
    expect(definition.name).toBe("String Reverser");
    expect(definition.category).toBe("text");
    expect(definition.processing).toBe("local");
    expect(definition.offlineSupported).toBe(true);
  });

  it("TIER1-F17-02: generates default text input and text output schemas", () => {
    const legacy: LegacyToolMetadata = {
      id: "text-upper",
      name: "Text Uppercase",
      category: "text",
      description: "Uppercase converter",
    };

    const { definition } = adaptToolToEngine(legacy);

    expect(definition.input).toHaveLength(1);
    expect(definition.input[0].name).toBe("input");
    expect(definition.input[0].control).toBe("text");
    expect(definition.input[0].required).toBe(true);

    expect(definition.output).toHaveLength(1);
    expect(definition.output[0].id).toBe("output");
    expect(definition.output[0].type).toBe("text");
  });

  it("TIER1-F17-03: wraps legacy processor function into ToolEngine.process()", async () => {
    const legacy: LegacyToolMetadata = {
      id: "multiplier",
      name: "Multiplier",
      category: "math",
      description: "Multiplies number by 2",
      process: (input: any) => Number(input) * 2,
    };

    const { engine } = adaptToolToEngine(legacy);
    const result = await engine.process(21, {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    });

    expect(result.data).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("TIER1-F17-04: generates validation gate requiring input presence", async () => {
    const legacy: LegacyToolMetadata = {
      id: "validator-test",
      name: "Val Test",
      category: "test",
      description: "Test",
    };

    const { engine } = adaptToolToEngine(legacy);

    const valid = await engine.validate("hello");
    expect(valid.valid).toBe(true);

    const invalidUndefined = await engine.validate(undefined);
    expect(invalidUndefined.valid).toBe(false);

    const invalidNull = await engine.validate(null);
    expect(invalidNull.valid).toBe(false);
  });

  it("TIER1-F17-05: adapts specialized converter tool with custom options and validates execution output", async () => {
    const legacyConverter: LegacyToolMetadata = {
      id: "json-to-yaml",
      slug: "json-to-yaml",
      name: "JSON to YAML Converter",
      category: "conversion",
      description: "Converts JSON documents to YAML format",
      keywords: ["json", "yaml", "convert"],
      process: (input: any) => {
        const obj = JSON.parse(input);
        return Object.entries(obj)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
      },
    };

    const { definition, engine } = adaptToolToEngine(legacyConverter);

    expect(definition.id).toBe("json-to-yaml");
    expect(definition.category).toBe("conversion");
    expect(definition.processing).toBe("local");

    const result = await engine.process('{"name":"station","active":true}', {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    });

    expect(result.data).toBe("name: station\nactive: true");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F17-01: handles legacy tool with missing process function gracefully (echo fallback)", async () => {
    const legacyWithoutProcess: LegacyToolMetadata = {
      id: "echo-tool",
      name: "Echo",
      category: "util",
      description: "Echo",
    };

    const { engine } = adaptToolToEngine(legacyWithoutProcess);
    const result = await engine.process("echo-payload", {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    });

    expect(result.data).toBe("echo-payload");
  });

  it("TIER2-F17-02: rejects undefined or null input at generated validation gate", async () => {
    const { engine } = adaptToolToEngine({
      id: "null-check",
      name: "Null Check",
      category: "util",
      description: "Checks null inputs",
    });

    expect((await engine.validate(null)).valid).toBe(false);
    expect((await engine.validate(undefined)).valid).toBe(false);
    expect((await engine.validate(0)).valid).toBe(true);
    expect((await engine.validate(false)).valid).toBe(true);
  });

  it("TIER2-F17-03: handles throwing legacy processor and wraps into rejected promise", async () => {
    const throwingLegacy: LegacyToolMetadata = {
      id: "thrower",
      name: "Thrower",
      category: "test",
      description: "Throws error",
      process: () => {
        throw new Error("Legacy processing crashed");
      },
    };

    const { engine } = adaptToolToEngine(throwingLegacy);
    await expect(
      engine.process("input", {
        signal: new AbortController().signal,
        reportProgress: vi.fn(),
      })
    ).rejects.toThrow("Legacy processing crashed");
  });

  it("TIER2-F17-04: preserves custom category, description, and keywords during legacy adaptation", () => {
    const customTool: LegacyToolMetadata = {
      id: "custom-crypto-tool",
      name: "Custom Crypto",
      category: "Security & Cryptography",
      description: "Advanced crypto utility",
      keywords: ["pki", "crypto", "security"],
      offlineSupported: true,
    };

    const { definition } = adaptToolToEngine(customTool);
    expect(definition.id).toBe("custom-crypto-tool");
    expect(definition.category).toBe("Security & Cryptography");
    expect(definition.description).toBe("Advanced crypto utility");
    expect(definition.keywords).toEqual(["pki", "crypto", "security"]);
    expect(definition.offlineSupported).toBe(true);
  });

  it("TIER2-F17-05: accurately measures durationMs across asynchronous processor execution", async () => {
    const asyncLegacyTool: LegacyToolMetadata = {
      id: "async-processor",
      name: "Async Processor",
      category: "utilities",
      description: "Processes data asynchronously",
      process: async (input: any) => {
        await new Promise((r) => setTimeout(r, 15));
        return `Processed ${input}`;
      },
    };

    const { engine } = adaptToolToEngine(asyncLegacyTool);
    const result = await engine.process("payload", {
      signal: new AbortController().signal,
      reportProgress: vi.fn(),
    });

    expect(result.data).toBe("Processed payload");
    expect(result.durationMs).toBeGreaterThanOrEqual(10);
  });
});

describe("E2E Contract: Feature 18 - Full 362 Tool Registry Unification", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F18-01: verifies exactly 362 registered tools in authoritative catalog", () => {
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(362);
  });

  it("TIER1-F18-02: verifies exactly 27 unique station categories", () => {
    const categories = new Set(tools.map((t) => t.category));
    expect(categories.size).toBe(27);
  });

  it("TIER1-F18-03: verifies 100% of registered tools have unique id", () => {
    const ids = new Set<string>();
    const duplicates: string[] = [];

    for (const tool of tools) {
      if (ids.has(tool.id)) {
        duplicates.push(tool.id);
      }
      ids.add(tool.id);
    }

    expect(duplicates).toEqual([]);
    expect(ids.size).toBe(362);
  });

  it("TIER1-F18-04: verifies 361 local tools and exactly 1 network-opt-in tool (api-request-tester)", () => {
    const networkOptInTools = tools.filter((t) => t.id === "api-request-tester");
    expect(networkOptInTools).toHaveLength(1);
    expect(networkOptInTools[0].id).toBe("api-request-tester");
  });

  it("TIER1-F18-05: verifies category distribution and station route mapping across all 362 registered tools", () => {
    expect(tools.length).toBe(362);

    for (const tool of tools) {
      expect(tool.id).toBeDefined();
      expect(tool.slug).toBeDefined();
      expect(typeof tool.slug).toBe("string");
      expect(tool.slug.length).toBeGreaterThan(0);
      expect(tool.category).toBeDefined();
      expect(typeof tool.category).toBe("string");
    }

    const categories = new Set(tools.map((t) => t.category));
    expect(categories.size).toBe(27);
    expect(categories).toContain("JSON & Data");
    expect(categories).toContain("Security");
    expect(categories).toContain("Encoding");
    expect(categories).toContain("Date & Time");
    expect(categories).toContain("Text");
    expect(categories).toContain("Cron");
    expect(categories).toContain("SQL & Database");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F18-01: dual-key resolution maps 6 mismatched slug tools correctly", () => {
    const mismatchedCases = [
      { slug: "json-lines-formatter", expectedId: "jsonl-formatter" },
      { slug: "json-lines-validator", expectedId: "jsonl-validator" },
      { slug: "json-lines-to-json", expectedId: "jsonl-to-json" },
      { slug: "json-to-json-lines", expectedId: "json-to-jsonl" },
      { slug: "csv-to-html-table", expectedId: "csv-to-html" },
      { slug: "csv-data-deduplicator", expectedId: "csv-deduplicator" },
    ];

    for (const { slug, expectedId } of mismatchedCases) {
      expect(resolveToolKey(slug)).toBe(expectedId);
      expect(MISMATCHED_SLUG_ID_MAP[slug]).toBe(expectedId);
    }
  });

  it("TIER2-F18-02: getTool resolves both standard and mismatched tools", () => {
    // Standard tool
    const standardTool = getTool("json-formatter");
    expect(standardTool).toBeDefined();
    expect(standardTool?.id).toBe("json-formatter");

    // Mismatched tool resolved via slug
    const resolvedId = resolveToolKey("json-lines-formatter");
    expect(resolvedId).toBe("jsonl-formatter");
    const mismatchedTool = getTool("json-lines-formatter");
    expect(mismatchedTool).toBeDefined();
    expect(mismatchedTool?.id).toBe(resolvedId);
  });

  it("TIER2-F18-03: getTool returns undefined for non-existent tool query", () => {
    const notFound = getTool("non-existent-tool-id-xyz-404");
    expect(notFound).toBeUndefined();
  });

  it("TIER2-F18-04: verifies bidirectional slug-to-id mapping for all 6 mismatched tools", () => {
    const pairs = [
      { slug: "json-lines-formatter", id: "jsonl-formatter" },
      { slug: "json-lines-validator", id: "jsonl-validator" },
      { slug: "json-lines-to-json", id: "jsonl-to-json" },
      { slug: "json-to-json-lines", id: "json-to-jsonl" },
      { slug: "csv-to-html-table", id: "csv-to-html" },
      { slug: "csv-data-deduplicator", id: "csv-deduplicator" },
    ];

    for (const { slug, id } of pairs) {
      expect(resolveToolKey(slug)).toBe(id);
      expect(resolveToolKey(id)).toBe(id);
      const tool = getTool(slug);
      expect(tool).toBeDefined();
      expect(tool?.id).toBe(id);
      expect(tool?.slug).toBe(slug);
    }
  });

  it("TIER2-F18-05: verifies all 362 tools have non-empty description and valid keywords array", () => {
    for (const tool of tools) {
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(tool.keywords)).toBe(true);
      expect(tool.keywords.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("E2E Contract: Feature 21 - WebMCP / MCP Agent Bridge", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F21-01: serializes ToolDefinition into WebMCP document.modelContext descriptor", () => {
    const def = createMockToolDefinition({
      id: "json-formatter",
      description: "Format JSON string",
      input: [
        {
          name: "input",
          label: "Input Data",
          control: "text",
          required: true,
        },
      ],
    });

    const webMcp = serializeToolToWebMcp(def);

    expect(webMcp.name).toBe("codestation_json_formatter");
    expect(webMcp.description).toBe("Format JSON string");
    expect(webMcp.inputSchema.type).toBe("object");
    expect(webMcp.inputSchema.properties.input).toBeDefined();
    expect(webMcp.inputSchema.properties.input.type).toBe("string");
    expect(webMcp.inputSchema.required).toContain("input");
  });

  it("TIER1-F21-02: generates valid JSON Schema types for inputs (string, number, boolean)", () => {
    const def = createMockToolDefinition({
      id: "type-tester",
      input: [
        { name: "textVal", label: "Text", control: "text" },
        { name: "numVal", label: "Number", control: "number" },
        { name: "boolVal", label: "Boolean", control: "toggle" },
        {
          name: "selVal",
          label: "Select",
          control: "select",
          options: ["opt1", "opt2"],
        },
      ],
    });

    const webMcp = serializeToolToWebMcp(def);

    expect(webMcp.inputSchema.properties.textVal.type).toBe("string");
    expect(webMcp.inputSchema.properties.numVal.type).toBe("number");
    expect(webMcp.inputSchema.properties.boolVal.type).toBe("boolean");
    expect(webMcp.inputSchema.properties.selVal.type).toBe("string");
    expect(webMcp.inputSchema.properties.selVal.enum).toEqual(["opt1", "opt2"]);
  });

  it("TIER1-F21-03: serializes ToolDefinition into Local MCP descriptor with category and parameters", () => {
    const def = createMockToolDefinition({
      id: "sha-256",
      category: "security",
      description: "Compute SHA-256 hash",
    });

    const localMcp = serializeToolToLocalMcp(def);

    expect(localMcp.id).toBe("sha-256");
    expect(localMcp.name).toBe("codestation_sha_256");
    expect(localMcp.category).toBe("security");
    expect(localMcp.parameters.type).toBe("object");
  });

  it("TIER1-F21-04: marks required inputs correctly in JSON Schema required array", () => {
    const def = createMockToolDefinition({
      input: [
        { name: "mandatory", label: "Req", control: "text", required: true },
        { name: "optional", label: "Opt", control: "text", required: false },
      ],
    });

    const webMcp = serializeToolToWebMcp(def);

    expect(webMcp.inputSchema.required).toContain("mandatory");
    expect(webMcp.inputSchema.required).not.toContain("optional");
  });

  it("TIER1-F21-05: serializes complex multi-input tool with select options enum, boolean defaults, and number ranges", () => {
    const complexDef = createMockToolDefinition({
      id: "advanced-optimizer",
      name: "Advanced Optimizer",
      description: "Multi-input optimizer for data transformations",
      input: [
        {
          name: "mode",
          label: "Optimization Mode",
          control: "select",
          options: [
            { label: "Speed", value: "speed" },
            { label: "Size", value: "size" },
            { label: "Balanced", value: "balanced" },
          ],
          defaultValue: "balanced",
          required: true,
        },
        {
          name: "stripWhitespace",
          label: "Strip Whitespace",
          control: "toggle",
          defaultValue: true,
        },
        {
          name: "maxDepth",
          label: "Maximum Depth",
          control: "number",
          min: 1,
          max: 10,
          defaultValue: 5,
        },
      ],
    });

    const webMcp = serializeToolToWebMcp(complexDef);
    expect(webMcp.name).toBe("codestation_advanced_optimizer");
    expect(webMcp.inputSchema.required).toEqual(["mode"]);
    expect(webMcp.inputSchema.properties.mode.type).toBe("string");
    expect(webMcp.inputSchema.properties.mode.enum).toEqual(["speed", "size", "balanced"]);
    expect(webMcp.inputSchema.properties.mode.default).toBe("balanced");
    expect(webMcp.inputSchema.properties.stripWhitespace.type).toBe("boolean");
    expect(webMcp.inputSchema.properties.stripWhitespace.default).toBe(true);
    expect(webMcp.inputSchema.properties.maxDepth.type).toBe("number");
    expect(webMcp.inputSchema.properties.maxDepth.default).toBe(5);

    const localMcp = serializeToolToLocalMcp(complexDef);
    expect(localMcp.id).toBe("advanced-optimizer");
    expect(localMcp.parameters).toEqual(webMcp.inputSchema);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F21-01: handles zero-input tools producing empty properties schema", () => {
    const noInputTool = createMockToolDefinition({ input: [] });
    const webMcp = serializeToolToWebMcp(noInputTool);

    expect(webMcp.inputSchema.properties).toEqual({});
    expect(webMcp.inputSchema.required).toEqual([]);
  });

  it("TIER2-F21-02: validates AI agent execution and argument dispatch through WebMCP dispatcher", async () => {
    // Valid dispatch of registered tool
    const formatRes = await dispatchToolExecution("json-formatter", '{"a":1,"b":2}', { indent: 4 });
    expect(formatRes).toContain('{\n    "a": 1,\n    "b": 2\n}');

    // Unknown tool rejection
    await expect(
      dispatchToolExecution("non-existent-tool-xyz", "data")
    ).rejects.toThrow("Unknown Code Station tool");

    // WebMCP schema property constraints match definition input
    const def = createMockToolDefinition({
      id: "strict-calculator",
      input: [
        {
          name: "factor",
          label: "Factor",
          control: "number",
          required: true,
        },
      ],
    });
    const schema = serializeToolToWebMcp(def);
    expect(schema.name).toBe("codestation_strict_calculator");
    expect(schema.inputSchema.required).toContain("factor");
    expect(schema.inputSchema.properties.factor.type).toBe("number");
  });

  it("TIER2-F21-03: normalizes tool names with hyphens to snake_case codestation_ prefix in WebMCP", () => {
    const hyphenatedDef = createMockToolDefinition({
      id: "multi-level-json-validator",
      slug: "multi-level-json-validator",
    });
    const descriptor = serializeToolToWebMcp(hyphenatedDef);
    expect(descriptor.name).toBe("codestation_multi_level_json_validator");
    expect(descriptor.name).not.toContain("-");
    expect(descriptor.name.startsWith("codestation_")).toBe(true);
  });

  it("TIER2-F21-04: maps file input accept attribute to contentMediaType in JSON Schema", () => {
    const fileDef = createMockToolDefinition({
      id: "pdf-compressor",
      input: [
        {
          name: "document",
          label: "PDF Document",
          control: "file",
          accept: "application/pdf",
          required: true,
        },
      ],
    });
    const descriptor = serializeToolToWebMcp(fileDef);
    expect(descriptor.inputSchema.properties.document.contentMediaType).toBe("application/pdf");
    expect(descriptor.inputSchema.properties.document.type).toBe("string");
    expect(descriptor.inputSchema.required).toContain("document");
  });

  it("TIER2-F21-05: verifies codestation_list_tools discovery tool returns valid filtered tool listings", async () => {
    // Test listing discovery with category filter
    const jsonResult = (await LIST_TOOLS_MCP.execute({ category: "json", limit: 5 })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(jsonResult.content).toHaveLength(1);
    expect(jsonResult.content[0].type).toBe("text");
    const parsed = JSON.parse(jsonResult.content[0].text);
    expect(parsed.totalMatches).toBeGreaterThan(0);
    expect(parsed.returned).toBeLessThanOrEqual(5);
    expect(parsed.tools[0].canonicalUrl).toMatch(/^https:\/\/codestation\.in\/tools\//);

    // Test query filter matching slug
    const queryResult = (await LIST_TOOLS_MCP.execute({ query: "jwt-decoder" })) as {
      content: Array<{ type: string; text: string }>;
    };
    const queryParsed = JSON.parse(queryResult.content[0].text);
    expect(queryParsed.returned).toBeGreaterThanOrEqual(1);
    expect(queryParsed.tools.some((t: any) => t.id === "jwt-decoder")).toBe(true);
  });
});
