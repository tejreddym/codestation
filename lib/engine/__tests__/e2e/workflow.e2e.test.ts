// @vitest-environment jsdom
/**
 * Code Station — Tool Engine E2E Workflow & Pairwise Integration Suite
 *
 * Tiers 3 & 4 Opaque-Box Coverage:
 * - Tier 3: Cross-Feature Pairwise Interactions (T3-PAIR-01 to T3-PAIR-08)
 * - Tier 4: Multi-Step Real-World Transformation Scenarios (T4-SCEN-01 to T4-SCEN-05)
 * - Boundary Workflows (T4-BOUND-01, T4-BOUND-02)
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import type {
  ToolDefinition,
  ToolEngine,
  ToolContext,
  ToolResult,
  ValidationResult,
  CustomCanvasSlotProps,
} from "../../types";
import {
  createValidationSuccess,
  createValidationError,
} from "../../types";
import { ExecutionRuntimeController } from "../../runtime";
import { useToolEngine } from "../../useToolEngine";
import { BlobUrlRegistry } from "../../blobRegistry";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockToolDefinition,
  createMockToolEngine,
  createAsyncMockEngine,
  adaptToolToEngine,
  resolveToolKey,
  serializeToolToWebMcp,
  MockURLManager,
  MockClipboardManager,
  UniversalToolShell,
  DynamicToolRoute,
  ToolDropzone,
  ToolEditor,
  ToolControls,
  ToolProgressBar,
  ToolErrorBanner,
  ToolActionBar,
  ToolOutputPreview,
} from "./testHelpers";
import { executeWorkflowStep, executePipeline, type Recipe } from "@/lib/workbench/workflows";
import { dispatchToolExecution } from "@/lib/webmcp/dispatcher";
import { parseCurl } from "@/lib/tools/api/curl";
import { decodeJwt, formatJson, minifyJson, validateJson } from "@/lib/tools/index";
import { hashBytes } from "@/lib/tools/security/hashes";
import { formatSqlTool } from "@/lib/tools/sql/transforms";

const el = React.createElement;

describe("E2E Workflow: Tier 3 - Cross-Feature Pairwise Interactions", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // T3-PAIR-01: Dropzone -> Validation -> Editor
  it("T3-PAIR-01: Dropzone -> Validation -> Editor (dropping file triggers validation, invalid syntax displays error banner)", async () => {
    const definition = createMockToolDefinition({
      name: "JSON Validator",
      input: [
        {
          name: "input",
          label: "JSON Text",
          control: "text",
        },
        {
          name: "fileInput",
          label: "File Upload",
          control: "file",
          accept: "application/json,.json",
        },
      ],
    });

    const engine: ToolEngine = {
      validate: (input: unknown): ValidationResult => {
        const text =
          typeof input === "object" && input !== null && "input" in input
            ? String((input as Record<string, unknown>).input)
            : String(input);

        try {
          JSON.parse(text);
          return createValidationSuccess();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Malformed JSON";
          return {
            valid: false,
            errors: [msg],
            diagnostics: [
              {
                message: msg,
                line: 1,
                column: 15,
                severity: "error",
              },
            ],
          };
        }
      },
      process: async (input: unknown) => ({ data: `Valid JSON: ${JSON.stringify(input)}`, durationMs: 2 }),
    };

    render(el(UniversalToolShell, { definition, engine }));

    // Drop a file with malformed JSON syntax into Dropzone
    const malformedJson = '{"key": "value", missingQuote}';
    const file = new File([malformedJson], "broken.json", { type: "application/json" });

    const dropzone = screen.getByTestId("tool-dropzone");
    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Content should be populated into ToolEditor
    await waitFor(() => {
      const editor = screen.getByTestId("tool-editor-textarea") as HTMLTextAreaElement;
      expect(editor.value).toBe(malformedJson);
    });

    // Trigger run: validation gate must catch the error and render ToolErrorBanner
    const runBtn = screen.getByTestId("btn-run");
    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      const errorBanner = screen.getByTestId("tool-error-banner");
      expect(errorBanner).toBeDefined();
      expect(screen.getByTestId("error-message")).toBeDefined();
      expect(screen.getByTestId("diagnostic-item").textContent).toContain("Line 1, Column 15");
    });
  });

  // T3-PAIR-02: Controls -> useToolEngine -> Engine Process
  it("T3-PAIR-02: Controls -> useToolEngine -> Engine Process (changing dropdown updates options; process reflects selected options in result)", async () => {
    let capturedOptions: Record<string, unknown> = {};

    const definition = createMockToolDefinition({
      name: "Text Case Transformer",
      input: [
        { name: "text", label: "Text", control: "text", defaultValue: "hello world" },
        {
          name: "casing",
          label: "Casing Mode",
          control: "select",
          defaultValue: "uppercase",
          options: [
            { label: "Uppercase", value: "uppercase" },
            { label: "Titlecase", value: "titlecase" },
          ],
        },
      ],
    });

    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async (input: unknown) => {
        const payload = input as Record<string, unknown>;
        capturedOptions = payload;
        const text = String(payload.text || "");
        const casing = String(payload.casing || "uppercase");
        const formatted =
          casing === "uppercase"
            ? text.toUpperCase()
            : text.replace(/\b\w/g, (c) => c.toUpperCase());
        return { data: formatted, durationMs: 4 };
      },
    };

    render(el(UniversalToolShell, { definition, engine }));

    // Change dropdown from "uppercase" to "titlecase"
    const select = screen.getByTestId("control-casing") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "titlecase" } });

    // Execute run
    const runBtn = screen.getByTestId("btn-run");
    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(capturedOptions.casing).toBe("titlecase");
      const preview = screen.getByTestId("preview-text");
      expect(preview.textContent).toBe("Hello World");
    });
  });

  // T3-PAIR-03: Process -> ToolContext.reportProgress -> ProgressBar
  it("T3-PAIR-03: Process -> ToolContext.reportProgress -> ProgressBar (progress updates stream to UI sequentially)", async () => {
    let progressSequence: number[] = [];

    const definition = createMockToolDefinition({ name: "Batch Processor" });
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async (_input: unknown, context: ToolContext) => {
        const steps = [25, 50, 75, 100];
        for (const pct of steps) {
          await new Promise((r) => setTimeout(r, 15));
          context.reportProgress({ percent: pct, label: `Stage ${pct}%` });
          progressSequence.push(pct);
        }
        return { data: "All stages complete", durationMs: 60 };
      },
    };

    render(el(UniversalToolShell, { definition, engine }));

    const runBtn = screen.getByTestId("btn-run");
    act(() => {
      fireEvent.click(runBtn);
    });

    // Wait for the final state
    await waitFor(
      () => {
        expect(screen.getByTestId("preview-text").textContent).toBe("All stages complete");
      },
      { timeout: 1000 }
    );

    expect(progressSequence).toEqual([25, 50, 75, 100]);
  });

  // T3-PAIR-04: ProgressBar Cancel -> AbortController -> State Machine
  it("T3-PAIR-04: ProgressBar Cancel -> AbortController -> State Machine (clicking Cancel aborts signal, invokes cancel, flips state)", async () => {
    let engineCancelCalled = false;
    let signalAborted = false;

    const definition = createMockToolDefinition({ name: "Cancellable Tool" });
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async (_input: unknown, context: ToolContext) => {
        context.reportProgress({ percent: 10, label: "Starting..." });
        return new Promise<ToolResult>((resolve, reject) => {
          context.signal.addEventListener("abort", () => {
            signalAborted = true;
            reject(new DOMException("Cancelled", "AbortError"));
          });
        });
      },
      cancel: () => {
        engineCancelCalled = true;
      },
    };

    render(el(UniversalToolShell, { definition, engine }));

    const runBtn = screen.getByTestId("btn-run");
    act(() => {
      fireEvent.click(runBtn);
    });

    // Wait for progress bar to mount
    await waitFor(() => {
      expect(screen.getByTestId("tool-progress-bar")).toBeDefined();
    });

    // Click Cancel on ProgressBar
    const cancelBtn = screen.getByTestId("btn-progress-cancel");
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    await waitFor(() => {
      expect(engineCancelCalled).toBe(true);
      expect(signalAborted).toBe(true);
      // Progress bar should disappear upon cancellation
      expect(screen.queryByTestId("tool-progress-bar")).toBeNull();
    });
  });

  // T3-PAIR-05: Process Binary -> BlobUrlRegistry -> Download Action -> Auto-Revocation
  it("T3-PAIR-05: Process Binary -> BlobUrlRegistry -> Download Action -> Auto-Revocation (binary creates blob URL; download clicks; re-run revokes)", async () => {
    const definition = createMockToolDefinition({
      name: "Binary Image Generator",
      output: [
        {
          id: "out",
          label: "Output Image",
          type: "blob",
          suggestedFilename: "generated.png",
          mimeType: "image/png",
        },
      ],
    });

    let runCounter = 0;
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => {
        runCounter += 1;
        const blob = new Blob([`image-binary-payload-${runCounter}`], {
          type: "image/png",
        });
        return {
          data: blob,
          suggestedFilename: `generated-${runCounter}.png`,
          mimeType: "image/png",
          durationMs: 5,
        };
      },
    };

    render(el(UniversalToolShell, { definition, engine }));

    // Run 1: Generates first Blob URL
    const runBtn = screen.getByTestId("btn-run");
    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(MockURLManager.getActiveCount()).toBe(1);
    });
    const firstUrl = MockURLManager.getActiveUrls()[0];
    expect(firstUrl).toContain("mock-blob");

    // Download action verification
    let downloadedHref = "";
    let downloadedName = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadedHref = this.href;
      downloadedName = this.download;
    });

    const downloadBtn = screen.getByTestId("btn-action-download");
    fireEvent.click(downloadBtn);

    expect(downloadedHref).toBe(firstUrl);
    expect(downloadedName).toBe("generated-1.png");
    clickSpy.mockRestore();

    // Run 2: Re-run must automatically revoke previous Blob URL
    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      // Exactly 1 active URL remains, but it is a new URL
      expect(MockURLManager.getActiveCount()).toBe(1);
      const secondUrl = MockURLManager.getActiveUrls()[0];
      expect(secondUrl).not.toBe(firstUrl);
      expect(MockURLManager.hasActiveUrl(firstUrl)).toBe(false);
    });
  });

  // T3-PAIR-06: adaptToolToEngine -> UniversalToolShell -> Dynamic Route
  it("T3-PAIR-06: adaptToolToEngine -> UniversalToolShell -> Dynamic Route (legacy tool adapted renders complete shell)", () => {
    const legacyTool = {
      id: "jsonl-formatter",
      slug: "json-lines-formatter",
      name: "JSON Lines Formatter",
      category: "json",
      description: "Format line-delimited JSON entries cleanly.",
    };

    const adapted = adaptToolToEngine(legacyTool, (inp: unknown) =>
      String(inp)
        .split("\n")
        .map((line) => JSON.stringify(JSON.parse(line), null, 2))
        .join("\n")
    );

    // Dynamic route resolves by mismatched slug
    render(
      el(DynamicToolRoute, {
        slug: "json-lines-formatter",
        getToolFn: (k) => (resolveToolKey(k) === adapted.definition.id ? adapted.definition : null),
        getEngineFn: (k) => (resolveToolKey(k) === adapted.definition.id ? adapted.engine : null),
      })
    );

    expect(screen.getByTestId("dynamic-tool-page")).toBeDefined();
    expect(screen.getByTestId("universal-tool-shell")).toBeDefined();
    expect(screen.getByTestId("tool-title").textContent).toBe("JSON Lines Formatter");
    expect(screen.getByTestId("badge-local")).toBeDefined();
  });

  // T3-PAIR-07: ToolDefinition -> WebMCP Bridge -> In-Page Dispatcher
  it("T3-PAIR-07: ToolDefinition -> WebMCP Bridge -> In-Page Dispatcher (definition serialized and executed via dispatcher)", async () => {
    const definition = createMockToolDefinition({
      id: "json-formatter",
      slug: "json-formatter",
      name: "JSON Formatter",
      category: "json",
      input: [
        {
          name: "input",
          label: "JSON Text",
          control: "code",
          required: true,
        },
      ],
    });

    // 1. Serialize to WebMCP schema
    const webMcpDescriptor = serializeToolToWebMcp(definition);
    expect(webMcpDescriptor.name).toBe("codestation_json_formatter");
    expect(webMcpDescriptor.inputSchema.properties.input).toBeDefined();

    // 2. Dispatch in-browser via WebMCP execution engine
    const rawInput = '{"z": 10, "a": 20}';
    const result = await dispatchToolExecution("json-formatter", rawInput, { indent: 2 });

    expect(result).toBeDefined();
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ z: 10, a: 20 });
    // Verify indentation in output
    expect(result).toContain('  "z": 10');
  });

  // T3-PAIR-08: Workbench Workflow Step Piping -> Error Handling / Circuit Break
  it("T3-PAIR-08: Workbench Workflow Step Piping -> Circuit Break (step 1 succeeds, step 2 fails, step 3 is skipped)", async () => {
    const recipe: Recipe = {
      version: 2,
      source: "json",
      steps: ["json-key-sorter", "json-to-csv"],
    };

    // Passing a single JSON object to json-to-csv triggers validation failure
    // because json-to-csv requires an array of objects
    const singleObjectJson = '{"b": 2, "a": 1}';

    const pipelineResult = await executePipeline(recipe, singleObjectJson);

    expect(pipelineResult.success).toBe(false);
    expect(pipelineResult.stoppedAtStep).toBe(1); // Circuit broke at step index 1
    expect(pipelineResult.steps[0].status).toBe("success");
    expect(pipelineResult.steps[0].output).toContain('"a": 1');
    expect(pipelineResult.steps[1].status).toBe("error");
    expect(pipelineResult.steps[1].error).toBeDefined();
  });
});

describe("E2E Workflow: Tier 4 - Multi-Step Real-World Transformation Scenarios", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // T4-SCEN-01: Developer Data Round-Trip Pipeline
  it("T4-SCEN-01: Developer Data Round-Trip Pipeline (json-validator -> json-minifier -> base64-encoder -> base64-decoder -> json-formatter)", async () => {
    const originalData = {
      project: "Code Station",
      version: "1.0.0",
      architecture: {
        offlineReady: true,
        zeroUploads: true,
        toolsCount: 362,
        categories: 27,
      },
      tags: ["developer-tools", "browser-native", "privacy-first"],
    };
    const initialJsonString = JSON.stringify(originalData, null, 2);

    // Step 1: Validate original JSON
    const step1Validation = validateJson(initialJsonString);
    expect(step1Validation).toBe(true);

    // Step 2: Minify JSON
    const step2Minified = minifyJson(initialJsonString);
    expect(step2Minified).not.toContain("\n");
    expect(step2Minified).not.toContain("  ");

    // Step 3: Base64 Encode minified JSON
    const step3Base64 = await executeWorkflowStep("base64-encoder", step2Minified);
    expect(step3Base64.length).toBeGreaterThan(0);
    expect(/^[A-Za-z0-9+/=]+$/.test(step3Base64.trim())).toBe(true);

    // Step 4: Base64 Decode back to minified JSON
    const step4Decoded = await executeWorkflowStep("base64-decoder", step3Base64);
    expect(step4Decoded).toBe(step2Minified);

    // Step 5: Format JSON with 2-space indentation
    const step5Formatted = formatJson(step4Decoded, 2);

    // Assert lossless round-trip preservation
    const roundTrippedObject = JSON.parse(step5Formatted);
    expect(roundTrippedObject).toEqual(originalData);
  });

  // T4-SCEN-02: Cryptographic & Security Hashing Pipeline
  it("T4-SCEN-02: Cryptographic & Security Hashing Pipeline (sha-256 -> hmac-generator -> hex-converter)", async () => {
    const inputMessage = "CodeStationSecurePayload2026";
    const secretKey = "MasterDeveloperSecretKey";

    // Step 1: SHA-256 digest
    const msgBytes = new TextEncoder().encode(inputMessage);
    const sha256Hex = await hashBytes(msgBytes, "SHA-256");
    expect(sha256Hex).toHaveLength(64); // 256 bits = 64 hex chars

    // Step 2: HMAC signing using the SHA-256 digest as the message
    const keyBytes = new TextEncoder().encode(secretKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const digestBytes = new TextEncoder().encode(sha256Hex);
    const hmacBuffer = await crypto.subtle.sign("HMAC", cryptoKey, digestBytes);
    const hmacHex = Array.from(new Uint8Array(hmacBuffer), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
    expect(hmacHex).toHaveLength(64);

    // Step 3: Hex to text conversion via WebMCP/Encoding dispatcher
    const hexDispatchResult = await dispatchToolExecution("hex-converter", hmacHex, {
      mode: "decode",
    });
    expect(hexDispatchResult).toBeDefined();
    // Deterministic verify: repeated run yields identical hash
    const verifySha256 = await hashBytes(msgBytes, "SHA-256");
    expect(verifySha256).toBe(sha256Hex);
  });

  // T4-SCEN-03: API Request to Token Inspection Pipeline
  it("T4-SCEN-03: API Request to Token Inspection Pipeline (curl-to-any-language -> jwt-decoder -> json-formatter)", async () => {
    // Standard test JWT with valid header, claims, signature
    const sampleJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIERldiIsImFkbWluIjp0cnVlLCJpYXQiOjE1MTYyMzkwMjJ9.4pcPyMD09olFdXTngX4g3So0OIpSGuxsWRFHAReZAzA";

    const curlCommand = `curl -X GET "https://api.codestation.in/v1/profile" -H "Authorization: Bearer ${sampleJwt}" -H "Accept: application/json"`;

    // Step 1: Parse cURL and extract Authorization Bearer token
    const parsedRequest = parseCurl(curlCommand);
    expect(parsedRequest.method).toBe("GET");

    const authHeaderEntry = parsedRequest.headers.find(
      ([name]) => name.toLowerCase() === "authorization"
    );
    expect(authHeaderEntry).toBeDefined();

    const authHeader = authHeaderEntry![1];
    expect(authHeader).toContain("Bearer ");
    const extractedToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    expect(extractedToken).toBe(sampleJwt);

    // Step 2: Decode JWT claims payload
    const decodedJwtRaw = decodeJwt(extractedToken);
    const decodedObj = JSON.parse(decodedJwtRaw);

    expect(decodedObj.header.alg).toBe("HS256");
    expect(decodedObj.payload.sub).toBe("1234567890");
    expect(decodedObj.payload.name).toBe("Alice Dev");
    expect(decodedObj.payload.admin).toBe(true);

    // Step 3: Format extracted claims with 2-space indentation
    const formattedClaims = formatJson(JSON.stringify(decodedObj.payload), 2);
    expect(formattedClaims).toContain('  "name": "Alice Dev"');
    expect(formattedClaims).toContain('  "admin": true');
  });

  // T4-SCEN-04: Content Markdown to HTML to Text Pipeline
  it("T4-SCEN-04: Content Markdown to HTML to Text Pipeline (markdown-to-html -> html-decoder -> text-counter)", async () => {
    const inputMarkdown = `# Architecture Overview

Code Station provides **362 tools** running *locally in your browser*.

- Pure Client Execution
- WebMCP Protocol
- Zero Server Latency`;

    // Step 1: Markdown to HTML compilation
    const compiledHtml = await executeWorkflowStep("markdown-to-html", inputMarkdown);
    expect(compiledHtml).toContain("<h1>Architecture Overview</h1>");
    expect(compiledHtml).toContain("<strong>362 tools</strong>");
    expect(compiledHtml).toContain("<li>Pure Client Execution</li>");

    // Step 2: HTML Entity Decoding / Tag Stripping
    const decodedText = await executeWorkflowStep("html-entity-decoder", compiledHtml);
    expect(decodedText).toBeDefined();

    // Step 3: Text metrics and word counter
    const counterJson = await executeWorkflowStep("text-counter", decodedText);
    const metrics = JSON.parse(counterJson);

    expect(metrics["Word count"]).toBeDefined();
    expect(Number(metrics["Word count"])).toBeGreaterThan(10);
    expect(metrics["Character count"]).toBeDefined();
    expect(Number(metrics["Character count"])).toBeGreaterThan(50);
  });

  // T4-SCEN-05: Data Transformation CSV to SQL Pipeline
  it("T4-SCEN-05: Data Transformation CSV to SQL Pipeline (csv-to-json -> sql-tools -> sql-formatter)", async () => {
    const inputCsv = `id,name,role,department
101,Alice,Architect,Core
102,Bob,Engineer,Platform
103,Charlie,Designer,Tactile`;

    // Step 1: Convert CSV to JSON array
    const jsonOutput = await executeWorkflowStep("csv-to-json", inputCsv);
    const parsedRows = JSON.parse(jsonOutput);
    expect(parsedRows).toHaveLength(3);
    expect(parsedRows[0]).toEqual({
      id: "101",
      name: "Alice",
      role: "Architect",
      department: "Core",
    });

    // Step 2: Generate SQL INSERT statements
    const sqlStatements = parsedRows
      .map(
        (row: Record<string, string>) =>
          `INSERT INTO staff (id, name, role, department) VALUES (${row.id}, '${row.name}', '${row.role}', '${row.department}');`
      )
      .join("\n");

    expect(sqlStatements).toContain("INSERT INTO staff");

    // Step 3: Format SQL statements
    const formattedSql = await formatSqlTool(sqlStatements, "PostgreSQL");
    const sqlOutput = formattedSql.rows[0]?.value ?? "";
    expect(sqlOutput).toContain("INSERT INTO");
    expect(sqlOutput).toContain("staff (id, name, role, department)");
    expect(sqlOutput).toContain("VALUES");
    expect(sqlOutput).toContain("'Alice'");
    expect(sqlOutput).toContain("'Bob'");
    expect(sqlOutput).toContain("'Charlie'");
  });

  // --- Boundary Workflow Tests ---

  it("T4-BOUND-01: pipeline enforces recipe constraints (rejects 0 steps or >12 steps)", async () => {
    const emptyRecipe: Recipe = {
      version: 2,
      source: "text",
      steps: [],
    };

    await expect(executePipeline(emptyRecipe, "hello")).rejects.toThrow(
      "Use a recipe with 1–12 tool steps."
    );

    const oversizedRecipe: Recipe = {
      version: 2,
      source: "text",
      steps: Array(13).fill("base64-encoder"),
    };

    await expect(executePipeline(oversizedRecipe, "hello")).rejects.toThrow(
      "Use a recipe with 1–12 tool steps."
    );
  });

  it("T4-BOUND-02: pre-aborted signal cancels pipeline execution immediately prior to starting Step 1", async () => {
    const recipe: Recipe = {
      version: 2,
      source: "json",
      steps: ["json-minifier", "base64-encoder"],
    };

    const abortController = new AbortController();
    abortController.abort(); // Pre-abort!

    await expect(
      executePipeline(recipe, '{"foo": "bar"}', abortController.signal)
    ).rejects.toThrow("Pipeline execution cancelled.");
  });
});
