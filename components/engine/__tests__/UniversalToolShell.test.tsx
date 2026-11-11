// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import {
  UniversalToolShell,
  ToolHeader,
  ToolPrivacyBadge,
  ToolDropzone,
  ToolEditor,
  ToolControls,
  ToolProgressBar,
  ToolErrorBanner,
  ToolActionBar,
  ToolOutputPreview,
  CustomCanvasSlot,
  ToolErrorBoundary,
} from "../index";
import type {
  ToolDefinition,
  ToolEngine,
  ToolInput,
  ToolOutput,
  ToolContext,
  ToolResult,
  ValidationResult,
  CustomCanvasSlotProps,
} from "@/lib/engine/types";
import { createValidationSuccess, createValidationError } from "@/lib/engine/types";

// Helper to create mock ToolDefinition
function createTestDefinition(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: "test-formatter",
    slug: "test-formatter",
    name: "JSON Formatter",
    category: "JSON & Data",
    description: "Formats JSON",
    processing: "local",
    offlineSupported: true,
    input: [
      {
        name: "text",
        label: "Input JSON",
        control: "code",
        required: true,
        defaultValue: '{"hello":"world"}',
      },
      {
        name: "indent",
        label: "Indent Size",
        control: "number",
        defaultValue: 2,
      },
      {
        name: "minify",
        label: "Minify",
        control: "toggle",
        defaultValue: false,
      },
    ],
    output: [
      {
        id: "output",
        label: "Formatted Result",
        type: "text",
        copyable: true,
        downloadable: true,
        suggestedFilename: "formatted.json",
        mimeType: "application/json",
      },
    ],
    ...overrides,
  };
}

// Global Browser API Mock Trackers
let createdUrls: string[] = [];
let revokedUrls: string[] = [];
let clipboardText = "";
let clipboardReject = false;
let clickedAnchor: HTMLAnchorElement | null = null;

beforeEach(() => {
  createdUrls = [];
  revokedUrls = [];
  clipboardText = "";
  clipboardReject = false;
  clickedAnchor = null;

  URL.createObjectURL = vi.fn((_blob: Blob | File) => {
    const url = `blob:http://localhost:3000/mock-blob-${createdUrls.length + 1}`;
    createdUrls.push(url);
    return url;
  });

  URL.revokeObjectURL = vi.fn((url: string) => {
    revokedUrls.push(url);
  });

  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn(async (text: string) => {
        if (clipboardReject) throw new Error("Clipboard write denied");
        clipboardText = text;
      }),
      readText: vi.fn(async () => {
        if (clipboardReject) throw new Error("Clipboard read denied");
        return clipboardText;
      }),
    },
    writable: true,
    configurable: true,
  });

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clickedAnchor = this;
  });

  vi.stubGlobal("alert", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ============================================================================
// Suite 1: ToolHeader, Privacy Badges & WebMCP Metadata
// ============================================================================
describe("Suite 1: ToolHeader, Privacy Badges & WebMCP Metadata", () => {
  const engine: ToolEngine = {
    validate: () => createValidationSuccess(),
    process: async () => ({ data: "ok", durationMs: 1 }),
  };

  it("1.1: renders title, eyebrow category, and description lead text", () => {
    const def = createTestDefinition({
      name: "JSON Formatter",
      category: "JSON & Data",
      description: "Formats JSON",
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    expect(screen.getByTestId("tool-title").textContent).toBe("JSON Formatter");
    expect(screen.getByTestId("tool-header").textContent).toContain("[JSON & Data]");
    expect(screen.getByTestId("tool-description").textContent).toContain("Formats JSON");
  });

  it("1.2: renders local and offline badges for 100% client tools", () => {
    const def = createTestDefinition({
      processing: "local",
      offlineSupported: true,
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    expect(screen.getByTestId("badge-local").textContent).toContain("100% Local • Browser-Only");
    expect(screen.getByTestId("badge-offline").textContent).toContain("Offline Ready");
    expect(screen.queryByTestId("badge-network-opt-in")).toBeNull();
  });

  it("1.3: renders Network Opt-In badge and warning notice for network tools", () => {
    const def = createTestDefinition({
      processing: "network-opt-in",
      offlineSupported: false,
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    expect(screen.getByTestId("badge-network-opt-in").textContent).toContain("Network Opt-In");
    expect(screen.getByTestId("network-warning-notice").textContent).toContain(
      "Requires Network / Sends Direct Browser Requests"
    );
    expect(screen.queryByTestId("badge-local")).toBeNull();
    expect(screen.queryByTestId("badge-offline")).toBeNull();
  });

  it("1.4: populates DOM agent attributes data-webmcp-* and hidden AEO sections", () => {
    const def = createTestDefinition({
      id: "jwt-decoder",
      slug: "jwt-decoder",
      category: "Security",
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    const header = screen.getByTestId("tool-header");
    expect(header.getAttribute("data-webmcp-tool")).toBe("jwt-decoder");
    expect(header.getAttribute("data-webmcp-category")).toBe("Security");
    expect(header.getAttribute("data-webmcp-slug")).toBe("jwt-decoder");

    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain("What does this tool do?");
    expect(headingTexts).toContain("How to use it?");
  });
});

// ============================================================================
// Suite 2: ToolDropzone — File Upload, Drag & Drop, MIME & maxBytes
// ============================================================================
describe("Suite 2: ToolDropzone — File Upload, Drag & Drop, MIME & maxBytes", () => {
  it("2.1: accepts dropped file matching accept criteria and updates editor value", async () => {
    const def = createTestDefinition({
      input: [
        {
          name: "data",
          label: "Upload File",
          control: "file",
          accept: ".json,application/json",
          maxBytes: 1048576,
        },
      ],
    });
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async (input) => ({ data: `Read: ${input}`, durationMs: 5 }),
    };

    render(<UniversalToolShell definition={def} engine={engine} />);

    const file = new File(['{"test":123}'], "data.json", { type: "application/json" });
    fireEvent.drop(screen.getByTestId("tool-dropzone"), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(
        (screen.getByTestId("tool-editor-textarea") as HTMLTextAreaElement).value
      ).toBe('{"test":123}');
    });
  });

  it("2.2: rejects file exceeding maxBytes with descriptive error", () => {
    const onError = vi.fn();
    render(<ToolDropzone maxBytes={100} onFileLoaded={vi.fn()} onError={onError} />);

    const largeFile = new File([new Uint8Array(200)], "large.dat", { type: "text/plain" });
    fireEvent.drop(screen.getByTestId("tool-dropzone"), {
      dataTransfer: { files: [largeFile] },
    });

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("File exceeds size limit of 100 bytes")
    );
  });

  it("2.3: rejects file with mismatched MIME type / extension", () => {
    const onError = vi.fn();
    render(
      <ToolDropzone
        accept=".json,application/json"
        onFileLoaded={vi.fn()}
        onError={onError}
      />
    );

    const txtFile = new File(["hello"], "hello.txt", { type: "text/plain" });
    fireEvent.drop(screen.getByTestId("tool-dropzone"), {
      dataTransfer: { files: [txtFile] },
    });

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("MIME type not accepted. Expected: .json,application/json")
    );
  });

  it("2.4: rejects multi-file drop when maxFiles is 1", () => {
    const onError = vi.fn();
    render(<ToolDropzone maxFiles={1} onFileLoaded={vi.fn()} onError={onError} />);

    const f1 = new File(["a"], "a.txt", { type: "text/plain" });
    const f2 = new File(["b"], "b.txt", { type: "text/plain" });
    fireEvent.drop(screen.getByTestId("tool-dropzone"), {
      dataTransfer: { files: [f1, f2] },
    });

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Multiple files rejected")
    );
  });

  it("2.5: handles file browse via input[type=file] change event", async () => {
    const onLoaded = vi.fn();
    render(<ToolDropzone onFileLoaded={onLoaded} onError={vi.fn()} />);

    const file = new File(['{"test":123}'], "data.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("dropzone-file-input"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(onLoaded).toHaveBeenCalledWith('{"test":123}', file);
    });
  });
});

// ============================================================================
// Suite 3: ToolEditor — Samples, Clipboard Paste, Clear & Shortcuts
// ============================================================================
describe("Suite 3: ToolEditor — Samples, Clipboard Paste, Clear & Shortcuts", () => {
  const def = createTestDefinition({
    input: [
      {
        name: "text",
        label: "Text",
        control: "code",
        sample: '{"sample":true}',
      } as ToolInput,
    ],
  });

  it("3.1: clicking 'Load Sample' populates editor textarea", () => {
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "ok", durationMs: 1 }),
    };
    render(<UniversalToolShell definition={def} engine={engine} />);

    fireEvent.click(screen.getByTestId("btn-load-sample"));
    expect(
      (screen.getByTestId("tool-editor-textarea") as HTMLTextAreaElement).value
    ).toBe('{"sample":true}');
  });

  it("3.2: clicking 'Paste from Clipboard' reads text from navigator.clipboard", async () => {
    clipboardText = "pasted from clipboard";
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "ok", durationMs: 1 }),
    };
    render(<UniversalToolShell definition={def} engine={engine} />);

    fireEvent.click(screen.getByTestId("btn-paste-clipboard"));
    await waitFor(() => {
      expect(
        (screen.getByTestId("tool-editor-textarea") as HTMLTextAreaElement).value
      ).toBe("pasted from clipboard");
    });
  });

  it("3.3: displays inline notice when clipboard read fails or is denied", async () => {
    clipboardReject = true;
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "ok", durationMs: 1 }),
    };
    render(<UniversalToolShell definition={def} engine={engine} />);

    fireEvent.click(screen.getByTestId("btn-paste-clipboard"));
    await waitFor(() => {
      expect(screen.getByTestId("clipboard-notice")).toBeDefined();
      expect(screen.getByTestId("clipboard-notice").textContent).toContain(
        "Clipboard access denied"
      );
    });
  });

  it("3.4: 'Clear' button resets editor value and Cmd+Enter triggers run", async () => {
    const procEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: vi.fn().mockResolvedValue({ data: "ok", durationMs: 5 }),
    };
    render(<UniversalToolShell definition={def} engine={procEngine} />);

    const textarea = screen.getByTestId("tool-editor-textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "test value" } });
    expect(textarea.value).toBe("test value");

    fireEvent.click(screen.getByTestId("btn-clear"));
    expect(textarea.value).toBe("");

    fireEvent.change(textarea, { target: { value: "run this" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(procEngine.process).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Suite 4: ToolControls — Dynamic Inputs & 'when' Conditional Rules
// ============================================================================
describe("Suite 4: ToolControls — Dynamic Inputs & 'when' Conditional Rules", () => {
  const engine: ToolEngine = {
    validate: () => createValidationSuccess(),
    process: async () => ({ data: "ok", durationMs: 1 }),
  };

  it("4.1: renders select dropdown and updates value on selection change", () => {
    const def = createTestDefinition({
      input: [
        {
          name: "format",
          label: "Output Format",
          control: "select",
          options: [
            { label: "JSON", value: "json" },
            { label: "YAML", value: "yaml" },
          ],
          defaultValue: "json",
        },
      ],
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    const select = screen.getByTestId("control-format") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "yaml" } });
    expect(select.value).toBe("yaml");
  });

  it("4.2: renders boolean toggle switch and toggles checked state", () => {
    const def = createTestDefinition({
      input: [
        {
          name: "minify",
          label: "Minify",
          control: "toggle",
          defaultValue: false,
        },
      ],
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    const toggle = screen.getByTestId("control-minify") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
  });

  it("4.3: renders number input with min, max, and step validation", () => {
    const def = createTestDefinition({
      input: [
        {
          name: "indent",
          label: "Indent Size",
          control: "number",
          min: 1,
          max: 8,
          step: 2,
          defaultValue: 2,
        },
      ],
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    const numInput = screen.getByTestId("control-indent") as HTMLInputElement;
    expect(numInput.value).toBe("2");
    fireEvent.change(numInput, { target: { value: "4" } });
    expect(numInput.value).toBe("4");
  });

  it("4.4: hides dependent controls when declarative 'when' predicate evaluates to false", () => {
    const def = createTestDefinition({
      input: [
        {
          name: "mode",
          label: "Mode",
          control: "select",
          options: ["basic", "advanced"],
          defaultValue: "basic",
        },
        {
          name: "depth",
          label: "Depth",
          control: "number",
          when: { field: "mode", equals: "advanced" },
        },
      ],
    });
    render(<UniversalToolShell definition={def} engine={engine} />);

    expect(screen.queryByTestId("group-depth")).toBeNull();
  });

  it("4.5: reactively reveals dependent control when predicate becomes true and bundles into run payload", async () => {
    const def = createTestDefinition({
      input: [
        {
          name: "mode",
          label: "Mode",
          control: "select",
          options: ["basic", "advanced"],
          defaultValue: "basic",
        },
        {
          name: "depth",
          label: "Depth",
          control: "number",
          when: { field: "mode", equals: "advanced" },
        },
      ],
    });
    const procEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: vi.fn().mockResolvedValue({ data: "done", durationMs: 2 }),
    };

    render(<UniversalToolShell definition={def} engine={procEngine} />);

    fireEvent.change(screen.getByTestId("control-mode"), {
      target: { value: "advanced" },
    });
    expect(screen.getByTestId("group-depth")).toBeDefined();

    fireEvent.click(screen.getByTestId("btn-run"));

    await waitFor(() => {
      expect(procEngine.process).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "advanced" }),
        expect.anything()
      );
    });
  });
});

// ============================================================================
// Suite 5: ToolProgressBar — Progress States & Cooperative Cancellation
// ============================================================================
describe("Suite 5: ToolProgressBar — Progress States & Cooperative Cancellation", () => {
  it("5.1: hides progress bar when idle or finished", () => {
    const def = createTestDefinition();
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "ok", durationMs: 1 }),
    };
    render(<UniversalToolShell definition={def} engine={engine} />);

    expect(screen.queryByTestId("tool-progress-bar")).toBeNull();
  });

  it("5.2: displays progress bar with aria-busy, percentage, label, and fill track during execution", () => {
    render(
      <ToolProgressBar
        isProcessing={true}
        progress={{ percent: 65, label: "Analyzing..." }}
        elapsedMs={250}
      />
    );

    const bar = screen.getByTestId("tool-progress-bar");
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-busy")).toBe("true");
    expect(bar.getAttribute("aria-valuenow")).toBe("65");
    expect(screen.getByTestId("progress-label").textContent).toBe("Analyzing...");
    expect(screen.getByTestId("progress-percent").textContent).toBe("65%");
    expect(screen.getByTestId("progress-timer").textContent).toBe("250ms");
    expect(screen.getByTestId("progress-fill").style.width).toBe("65%");
  });

  it("5.3: renders Cancel button when canCancel is true and calls onCancel on click", () => {
    const onCancel = vi.fn();
    render(
      <ToolProgressBar
        isProcessing={true}
        progress={{ percent: 50 }}
        canCancel={true}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByTestId("btn-progress-cancel");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("5.4: clicking Cancel during live execution transitions state to cancelled and aborts signal", async () => {
    let aborted = false;
    const cancellableEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async (_input, ctx) => {
        ctx.signal.addEventListener("abort", () => {
          aborted = true;
        });
        ctx.reportProgress({ percent: 30, label: "Working..." });
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { data: "done", durationMs: 300 };
      },
      cancel: vi.fn(),
    };

    const def = createTestDefinition();
    render(<UniversalToolShell definition={def} engine={cancellableEngine} />);

    fireEvent.click(screen.getByTestId("btn-run"));

    await waitFor(() => {
      expect(screen.getByTestId("btn-progress-cancel")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("btn-progress-cancel"));

    await waitFor(() => {
      expect(cancellableEngine.cancel).toHaveBeenCalled();
    });
    expect(aborted).toBe(true);
  });
});

// ============================================================================
// Suite 6: ToolErrorBanner — Pre-Execution Gates & Diagnostics
// ============================================================================
describe("Suite 6: ToolErrorBanner — Pre-Execution Gates & Diagnostics", () => {
  const def = createTestDefinition();

  it("6.1: validation failure prevents process() execution and displays error banner", async () => {
    const invalidEngine: ToolEngine = {
      validate: vi.fn().mockReturnValue(createValidationError("Malformed JSON syntax")),
      process: vi.fn(),
    };

    render(<UniversalToolShell definition={def} engine={invalidEngine} />);

    fireEvent.click(screen.getByTestId("btn-run"));

    await waitFor(() => {
      expect(screen.getByTestId("tool-error-banner")).toBeDefined();
    });
    expect(invalidEngine.process).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-message").textContent).toBe("Malformed JSON syntax");
  });

  it("6.2: displays line and column coordinates from diagnostic items", () => {
    const validation: ValidationResult = {
      valid: false,
      errors: ["Syntax error"],
      diagnostics: [{ line: 4, column: 15, message: "Unexpected closing bracket" }],
    };

    render(<ToolErrorBanner error="Syntax error" validation={validation} />);

    const item = screen.getByTestId("diagnostic-item");
    expect(item.textContent).toContain("Line 4, Column 15: Unexpected closing bracket");
  });

  it("6.3: clicking dismiss button invokes onDismiss and hides banner", () => {
    const onDismiss = vi.fn();
    render(<ToolErrorBanner error="An error" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId("btn-dismiss-error"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("6.4: runtime exception during process() is caught and rendered in banner without crashing shell", async () => {
    const throwingEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: vi.fn().mockRejectedValue(new Error("Worker thread crashed")),
    };

    render(<UniversalToolShell definition={def} engine={throwingEngine} />);

    fireEvent.click(screen.getByTestId("btn-run"));

    await waitFor(() => {
      expect(screen.getByTestId("tool-error-banner")).toBeDefined();
    });
    expect(screen.getByTestId("error-message").textContent).toBe("Worker thread crashed");
  });
});

// ============================================================================
// Suite 7: ToolOutputPreview — Text, Code, Table & Image Modes
// ============================================================================
describe("Suite 7: ToolOutputPreview — Text, Code, Table & Image Modes", () => {
  const def = createTestDefinition();
  const engine: ToolEngine = {
    validate: () => createValidationSuccess(),
    process: async () => ({ data: "ok", durationMs: 1 }),
  };

  it("7.1: renders empty placeholder before tool execution", () => {
    render(<UniversalToolShell definition={def} engine={engine} />);

    expect(screen.getByTestId("output-empty").textContent).toContain(
      "Run the tool to see output here"
    );
  });

  it("7.2: renders formatted text/code output in pre/code container", () => {
    const result: ToolResult = {
      data: '{\n  "status": "ok"\n}',
      durationMs: 12,
    };
    render(
      <ToolOutputPreview
        result={result}
        outputConfig={{ id: "out", label: "Out", type: "text" }}
      />
    );

    expect(screen.getByTestId("preview-text").textContent).toContain('"status": "ok"');
  });

  it("7.3: renders structured table when output data is an array of objects", () => {
    const result: ToolResult = {
      data: [
        { col1: "Alpha", col2: 100 },
        { col1: "Beta", col2: 200 },
      ],
      durationMs: 10,
    };
    render(
      <ToolOutputPreview
        result={result}
        outputConfig={{ id: "out", label: "Out", type: "table" }}
      />
    );

    const table = screen.getByTestId("preview-table");
    expect(table.textContent).toContain("col1");
    expect(table.textContent).toContain("col2");
    expect(table.textContent).toContain("Alpha");
    expect(table.textContent).toContain("Beta");
  });

  it("7.4: renders image preview with img element when output type is image", () => {
    const result: ToolResult = {
      data: "data:image/png;base64,iVBORw0KGgo...",
      mimeType: "image/png",
      durationMs: 25,
    };
    render(
      <ToolOutputPreview
        result={result}
        outputConfig={{ id: "out", label: "Out", type: "image" }}
      />
    );

    const img = screen.getByTestId("preview-image") as HTMLImageElement;
    expect(img.src).toContain("data:image/png;base64");
  });
});

// ============================================================================
// Suite 8: ToolActionBar — Copy, Download Sanitization & Workflow Chaining
// ============================================================================
describe("Suite 8: ToolActionBar — Copy, Download Sanitization & Workflow Chaining", () => {
  it("8.1: 'Copy' button writes output to navigator.clipboard and displays 'Copied!' feedback", async () => {
    const result: ToolResult = { data: "result to copy", durationMs: 15 };
    render(<ToolActionBar result={result} />);

    const copyBtn = screen.getByTestId("btn-action-copy");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("result to copy");
      expect(screen.getByTestId("btn-action-copy").textContent).toContain("Copied!");
    });
  });

  it("8.2: 'Download' button triggers anchor click with sanitized filename and auto-revocation", () => {
    const result: ToolResult = {
      data: "file payload",
      suggestedFilename: "path/to/bad:file*.txt",
      durationMs: 20,
    };
    render(<ToolActionBar result={result} />);

    const downloadBtn = screen.getByTestId("btn-action-download");
    fireEvent.click(downloadBtn);

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickedAnchor?.download).toBe("path_to_bad_file_.txt");
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("8.3: 'Chain to Workflow' button calls onWorkflowChain with result data", () => {
    const onChain = vi.fn();
    const result: ToolResult = { data: { foo: "bar" }, durationMs: 10 };
    render(<ToolActionBar result={result} onWorkflowChain={onChain} />);

    const chainBtn = screen.getByTestId("btn-action-chain");
    fireEvent.click(chainBtn);

    expect(onChain).toHaveBeenCalledWith({ foo: "bar" });
  });

  it("8.4: action buttons are disabled when result is null or processing is active", () => {
    const { rerender } = render(<ToolActionBar result={null} disabled={false} />);
    expect((screen.getByTestId("btn-action-copy") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-action-download") as HTMLButtonElement).disabled).toBe(true);

    rerender(<ToolActionBar result={{ data: "ok", durationMs: 5 }} disabled={true} />);
    expect((screen.getByTestId("btn-action-copy") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-action-download") as HTMLButtonElement).disabled).toBe(true);
  });
});

// ============================================================================
// Suite 9: Zero-Input Generator Tools
// ============================================================================
describe("Suite 9: Zero-Input Generator Tools", () => {
  const zeroDef: ToolDefinition = {
    id: "uuid-generator",
    name: "UUID Generator",
    category: "Generators",
    description: "Generates v4 UUIDs",
    processing: "local",
    offlineSupported: true,
    input: [],
    output: [{ id: "out", label: "UUID", type: "text" }],
  };

  it("9.1: zero-input tool renders zero-input-shell and Generate Output button", () => {
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "UUID", durationMs: 1 }),
    };
    render(<UniversalToolShell definition={zeroDef} engine={engine} />);

    expect(screen.getByTestId("zero-input-shell")).toBeDefined();
    expect(screen.getByTestId("btn-generate-zero-input")).toBeDefined();
    expect(screen.queryByTestId("standard-input-zone")).toBeNull();
    expect(screen.queryByTestId("tool-editor")).toBeNull();
  });

  it("9.2: clicking Generate Output executes engine with empty input payload and renders result", async () => {
    const zeroEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: vi.fn().mockResolvedValue({ data: "UUID-1234-5678", durationMs: 3 }),
    };

    render(<UniversalToolShell definition={zeroDef} engine={zeroEngine} />);

    fireEvent.click(screen.getByTestId("btn-generate-zero-input"));

    await waitFor(() => {
      expect(screen.getByTestId("preview-text").textContent).toBe("UUID-1234-5678");
    });
    expect(zeroEngine.process).toHaveBeenCalledWith({}, expect.anything());
  });
});

// ============================================================================
// Suite 10: CustomCanvasSlot Protocol & Error Boundary
// ============================================================================
describe("Suite 10: CustomCanvasSlot Protocol & Error Boundary", () => {
  const def = createTestDefinition();

  it("10.1: renders custom visual slot and passes complete CustomCanvasSlotProps", async () => {
    let receivedProps: CustomCanvasSlotProps | null = null;
    const procEngine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: vi.fn().mockResolvedValue({ data: "red-applied", durationMs: 4 }),
    };

    const customCanvas = (props: CustomCanvasSlotProps) => {
      receivedProps = props;
      return (
        <div>
          <span data-testid="canvas-title">Color Palette Canvas</span>
          <button
            data-testid="btn-canvas-action"
            onClick={() => {
              props.setInput("#ff0000");
              props.run();
            }}
          >
            Select Red
          </button>
        </div>
      );
    };

    render(
      <UniversalToolShell
        definition={def}
        engine={procEngine}
        customCanvas={customCanvas}
      />
    );

    expect(screen.getByTestId("custom-canvas-slot")).toBeDefined();
    expect(screen.getByTestId("canvas-title").textContent).toBe("Color Palette Canvas");
    expect(receivedProps).not.toBeNull();
    const props = receivedProps as CustomCanvasSlotProps | null;
    expect(props?.definition).toBe(def);
    expect(props?.engine).toBe(procEngine);

    fireEvent.click(screen.getByTestId("btn-canvas-action"));

    await waitFor(() => {
      expect(procEngine.process).toHaveBeenCalled();
    });
  });

  it("10.2: ToolErrorBoundary catches crash in customCanvas and displays diagnostic error without shell collapse", () => {
    const engine: ToolEngine = {
      validate: () => createValidationSuccess(),
      process: async () => ({ data: "ok", durationMs: 1 }),
    };

    const crashingCanvas = () => {
      throw new Error("WebGL context lost in custom canvas");
    };

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <UniversalToolShell
        definition={def}
        engine={engine}
        customCanvas={crashingCanvas}
      />
    );

    expect(screen.getByTestId("universal-tool-shell")).toBeDefined();
    expect(screen.getByTestId("tool-error-banner")).toBeDefined();
    expect(screen.getByTestId("error-message").textContent).toBe(
      "WebGL context lost in custom canvas"
    );

    consoleSpy.mockRestore();
  });
});
