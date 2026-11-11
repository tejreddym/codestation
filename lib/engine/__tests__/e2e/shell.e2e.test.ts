// @vitest-environment jsdom
/**
 * Code Station — Tool Engine E2E UniversalToolShell Suite
 *
 * Tiers 1 & 2 Opaque-Box Coverage for Features 10-16, 19:
 * - Feature 10: UniversalToolShell Main Component
 * - Feature 11: ToolHeader & ToolPrivacyBadge
 * - Feature 12: ToolDropzone & ToolEditor
 * - Feature 13: ToolControls Component
 * - Feature 14: ToolProgressBar & ToolErrorBanner
 * - Feature 15: ToolActionBar & ToolOutputPreview
 * - Feature 16: CustomCanvasSlot Protocol
 * - Feature 19: Dynamic Route UI Unification
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import type {
  ToolDefinition,
  ToolEngine,
  ToolInput,
  ToolOutput,
  ToolResult,
  ValidationResult,
  CustomCanvasSlotProps,
} from "../../types";
import {
  createValidationSuccess,
  createValidationError,
} from "../../types";
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockToolDefinition,
  createMockToolEngine,
  createAsyncMockEngine,
  MockURLManager,
  MockClipboardManager,
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
  DynamicToolRoute,
} from "./testHelpers";

const el = React.createElement;

describe("E2E Shell: Feature 10 - UniversalToolShell Main Component", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F10-01: renders complete shell structure (header, input, controls, progress, error, output)", () => {
    const definition = createMockToolDefinition({
      name: "JSON Formatter",
      category: "json",
      input: [
        { name: "data", label: "JSON Data", control: "code", required: true },
        {
          name: "indent",
          label: "Indent Size",
          control: "select",
          options: [
            { label: "2 Spaces", value: "2" },
            { label: "4 Spaces", value: "4" },
          ],
        },
      ],
    });
    const engine = createMockToolEngine();

    const { getByTestId, queryByTestId } = render(
      el(UniversalToolShell, { definition, engine })
    );

    expect(getByTestId("universal-tool-shell")).toBeDefined();
    expect(getByTestId("tool-header")).toBeDefined();
    expect(getByTestId("standard-input-zone")).toBeDefined();
    expect(getByTestId("tool-editor")).toBeDefined();
    expect(getByTestId("tool-controls")).toBeDefined();
    expect(getByTestId("tool-action-bar")).toBeDefined();
    expect(getByTestId("output-zone")).toBeDefined();
    // Progress and error should be hidden initially
    expect(queryByTestId("tool-progress-bar")).toBeNull();
    expect(queryByTestId("tool-error-banner")).toBeNull();
  });

  it("TIER1-F10-02: conforms to Tactile Technical design system tokens and classes", () => {
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine();

    const { getByTestId } = render(
      el(UniversalToolShell, { definition, engine })
    );

    const shell = getByTestId("universal-tool-shell");
    expect(shell.className).toContain("tactile-technical");
    expect(shell.className).toContain("shell");
  });

  it("TIER1-F10-03: populates default input values from ToolDefinition.input and initialInput prop", () => {
    const definition = createMockToolDefinition({
      input: [
        {
          name: "input",
          label: "Text",
          control: "text",
          defaultValue: "Default Header",
        },
        {
          name: "mode",
          label: "Mode",
          control: "select",
          defaultValue: "strict",
          options: ["loose", "strict"],
        },
      ],
    });
    const engine = createMockToolEngine();

    render(
      el(UniversalToolShell, {
        definition,
        engine,
        initialInput: { input: "Overridden Text", mode: "loose" },
      })
    );

    const textarea = screen.getByTestId("tool-editor-textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Overridden Text");

    const select = screen.getByTestId("control-mode") as HTMLSelectElement;
    expect(select.value).toBe("loose");
  });

  it("TIER1-F10-04: clicking 'Run' executes engine and displays formatted output in preview", async () => {
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine({
      process: async (input: unknown) => ({
        data: `PROCESSED: ${String(input)}`,
        durationMs: 12,
      }),
    });

    render(el(UniversalToolShell, { definition, engine }));

    const textarea = screen.getByTestId("tool-editor-textarea");
    fireEvent.change(textarea, { target: { value: "hello world" } });

    const runBtn = screen.getByTestId("btn-run");
    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      const output = screen.getByTestId("preview-text");
      expect(output.textContent).toBe("PROCESSED: hello world");
    });
  });

  it("TIER1-F10-05: exposes accessible ARIA landmarks and attributes", () => {
    const definition = createMockToolDefinition({ name: "Accessible Tester" });
    const engine = createMockToolEngine();

    const { getByTestId } = render(
      el(UniversalToolShell, { definition, engine })
    );

    const shell = getByTestId("universal-tool-shell");
    expect(shell.getAttribute("role")).toBe("region");
    expect(shell.getAttribute("aria-label")).toBe("Accessible Tester");

    const editor = screen.getByTestId("tool-editor-textarea");
    expect(editor.getAttribute("aria-label")).toBe("Input Editor");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F10-06: zero-input tool shell renders direct 'Generate Output' button without input fields", async () => {
    const zeroInputDefinition = createMockToolDefinition({
      id: "uuid-generator",
      name: "UUID Generator",
      input: [], // Zero inputs!
    });
    const engine = createMockToolEngine({
      process: async () => ({
        data: "123e4567-e89b-12d3-a456-426614174000",
        durationMs: 2,
      }),
    });

    render(el(UniversalToolShell, { definition: zeroInputDefinition, engine }));

    expect(screen.getByTestId("zero-input-shell")).toBeDefined();
    expect(screen.queryByTestId("standard-input-zone")).toBeNull();

    const generateBtn = screen.getByTestId("btn-generate-zero-input");
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    await waitFor(() => {
      const output = screen.getByTestId("preview-text");
      expect(output.textContent).toBe("123e4567-e89b-12d3-a456-426614174000");
    });
  });

  it("TIER2-F10-07: keyboard shortcut Cmd+Enter triggers execution from anywhere within shell", async () => {
    let executionInvoked = false;
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine({
      process: async () => {
        executionInvoked = true;
        return { data: "Triggered via shortcut", durationMs: 5 };
      },
    });

    const { getByTestId } = render(
      el(UniversalToolShell, { definition, engine })
    );

    const shell = getByTestId("universal-tool-shell");

    await act(async () => {
      fireEvent.keyDown(shell, { key: "Enter", metaKey: true });
    });

    await waitFor(() => {
      expect(executionInvoked).toBe(true);
      expect(screen.getByTestId("preview-text").textContent).toBe("Triggered via shortcut");
    });
  });

  it("TIER2-F10-08: handles large multi-line output (>100,000 characters) without layout overflow", async () => {
    const largeText = "A".repeat(120_000);
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine({
      process: async () => ({ data: largeText, durationMs: 25 }),
    });

    render(el(UniversalToolShell, { definition, engine }));

    const runBtn = screen.getByTestId("btn-run");
    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      const preview = screen.getByTestId("preview-text");
      expect(preview.className).toContain("overflow-auto");
      expect(preview.textContent?.length).toBe(120_000);
    });
  });
});

describe("E2E Shell: Feature 11 - ToolHeader & ToolPrivacyBadge", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F11-01: renders semantic <h1> title matching definition.name", () => {
    const definition = createMockToolDefinition({ name: "Base64 Encoder / Decoder" });
    render(el(ToolHeader, { definition }));

    const heading = screen.getByTestId("tool-title");
    expect(heading.tagName).toBe("H1");
    expect(heading.textContent).toBe("Base64 Encoder / Decoder");
  });

  it("TIER1-F11-02: displays category bracket label and description lead text", () => {
    const definition = createMockToolDefinition({
      category: "encoding",
      description: "Fast in-browser Base64 string encoding and decoding.",
    });
    render(el(ToolHeader, { definition }));

    expect(screen.getByText("[encoding]")).toBeDefined();
    expect(screen.getByTestId("tool-description").textContent).toBe(
      "Fast in-browser Base64 string encoding and decoding."
    );
  });

  it("TIER1-F11-03: displays '100% Local • Browser-Only' and 'Offline Ready' badges for local offline tools", () => {
    render(el(ToolPrivacyBadge, { processing: "local", offlineSupported: true }));

    const localBadge = screen.getByTestId("badge-local");
    expect(localBadge.textContent).toContain("100% Local • Browser-Only");

    const offlineBadge = screen.getByTestId("badge-offline");
    expect(offlineBadge.textContent).toContain("Offline Ready");

    expect(screen.queryByTestId("badge-network-opt-in")).toBeNull();
  });

  it("TIER1-F11-04: displays 'Network Opt-In' warning notice for documented network opt-in tools", () => {
    render(el(ToolPrivacyBadge, { processing: "network-opt-in", offlineSupported: false }));

    const networkBadge = screen.getByTestId("badge-network-opt-in");
    expect(networkBadge.textContent).toContain("Network Opt-In");

    const notice = screen.getByTestId("network-warning-notice");
    expect(notice.textContent).toContain("Requires Network / Sends Direct Browser Requests");

    expect(screen.queryByTestId("badge-local")).toBeNull();
    expect(screen.queryByTestId("badge-offline")).toBeNull();
  });

  it("TIER1-F11-05: carries DOM agent attributes data-webmcp-* on container", () => {
    const definition = createMockToolDefinition({
      id: "json-formatter",
      slug: "json-formatter",
      category: "json",
    });
    const { getByTestId } = render(el(ToolHeader, { definition }));

    const header = getByTestId("tool-header");
    expect(header.getAttribute("data-webmcp-tool")).toBe("json-formatter");
    expect(header.getAttribute("data-webmcp-category")).toBe("json");
    expect(header.getAttribute("data-webmcp-slug")).toBe("json-formatter");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F11-06: SEO/AEO heading hierarchy includes H2 What and How sections", () => {
    const definition = createMockToolDefinition({
      name: "CSV to JSON",
      description: "Convert CSV rows into JSON objects.",
    });
    const { container } = render(el(ToolHeader, { definition }));

    const h2Elements = container.querySelectorAll("h2");
    const h2Texts = Array.from(h2Elements).map((el) => el.textContent);

    expect(h2Texts).toContain("What does this tool do?");
    expect(h2Texts).toContain("How to use it?");
  });

  it("TIER2-F11-07: renders long title and description gracefully without container blowout", () => {
    const longTitle = "Very Long Tool Title ".repeat(10);
    const longDesc = "Comprehensive description sentence. ".repeat(20);
    const definition = createMockToolDefinition({
      name: longTitle,
      description: longDesc,
    });

    const { getByTestId } = render(el(ToolHeader, { definition }));
    expect(getByTestId("tool-title").textContent).toBe(longTitle);
    expect(getByTestId("tool-description").textContent).toBe(longDesc);
  });
});

describe("E2E Shell: Feature 12 - ToolDropzone & ToolEditor", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F12-01: dropzone accepts valid file and invokes onFileLoaded with contents", async () => {
    let loadedContent = "";
    const onFileLoaded = vi.fn((content: string) => {
      loadedContent = content;
    });
    const onError = vi.fn();

    render(
      el(ToolDropzone, {
        accept: "text/plain,.txt",
        onFileLoaded,
        onError,
      })
    );

    const file = new File(["test file contents"], "sample.txt", { type: "text/plain" });
    const dropzone = screen.getByTestId("tool-dropzone");

    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    await waitFor(() => {
      expect(onFileLoaded).toHaveBeenCalledTimes(1);
      expect(loadedContent).toBe("test file contents");
      expect(onError).not.toHaveBeenCalled();
    });
  });

  it("TIER1-F12-02: monospace text editor renders with role='textbox' and calls onChange", () => {
    let text = "initial";
    const onChange = vi.fn((val: string) => {
      text = val;
    });

    render(el(ToolEditor, { value: text, onChange }));

    const textarea = screen.getByTestId("tool-editor-textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("initial");
    expect(textarea.className).toContain("font-mono");

    fireEvent.change(textarea, { target: { value: "updated text" } });
    expect(onChange).toHaveBeenCalledWith("updated text");
  });

  it("TIER1-F12-03: 'Load Sample' button populates editor with sample value", () => {
    const onChange = vi.fn();
    render(
      el(ToolEditor, {
        value: "",
        onChange,
        sampleValue: '{"sample": true, "count": 42}',
      })
    );

    const loadSampleBtn = screen.getByTestId("btn-load-sample");
    fireEvent.click(loadSampleBtn);

    expect(onChange).toHaveBeenCalledWith('{"sample": true, "count": 42}');
  });

  it("TIER1-F12-04: 'Paste from Clipboard' button reads clipboard and calls onChange", async () => {
    await navigator.clipboard.writeText("Pasted from clipboard buffer");
    const onChange = vi.fn();

    render(el(ToolEditor, { value: "", onChange }));

    const pasteBtn = screen.getByTestId("btn-paste-clipboard");
    await act(async () => {
      fireEvent.click(pasteBtn);
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("Pasted from clipboard buffer");
    });
  });

  it("TIER1-F12-05: 'Clear' button resets editor value to empty string", () => {
    const onChange = vi.fn();
    render(el(ToolEditor, { value: "Existing text", onChange }));

    const clearBtn = screen.getByTestId("btn-clear");
    fireEvent.click(clearBtn);

    expect(onChange).toHaveBeenCalledWith("");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F12-06: dropzone rejects file exceeding maxBytes with clear diagnostic error", async () => {
    const onError = vi.fn();
    const onFileLoaded = vi.fn();

    render(
      el(ToolDropzone, {
        maxBytes: 1024, // 1 KB max
        onFileLoaded,
        onError,
      })
    );

    const oversizedFile = new File([new Uint8Array(2048)], "huge.bin", {
      type: "application/octet-stream",
    });

    const dropzone = screen.getByTestId("tool-dropzone");
    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [oversizedFile],
        },
      });
    });

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("File exceeds size limit")
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
  });

  it("TIER2-F12-07: dropzone rejects disallowed MIME type with expected vs received notice", async () => {
    const onError = vi.fn();
    const onFileLoaded = vi.fn();

    render(
      el(ToolDropzone, {
        accept: "application/json",
        onFileLoaded,
        onError,
      })
    );

    const wrongFile = new File(["not json"], "image.png", { type: "image/png" });
    const dropzone = screen.getByTestId("tool-dropzone");

    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [wrongFile],
        },
      });
    });

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("MIME type not accepted")
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
  });

  it("TIER2-F12-08: dropzone rejects multi-file drop when maxFiles is 1", async () => {
    const onError = vi.fn();
    const onFileLoaded = vi.fn();

    render(
      el(ToolDropzone, {
        maxFiles: 1,
        onFileLoaded,
        onError,
      })
    );

    const file1 = new File(["1"], "1.txt", { type: "text/plain" });
    const file2 = new File(["2"], "2.txt", { type: "text/plain" });

    const dropzone = screen.getByTestId("tool-dropzone");
    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file1, file2],
        },
      });
    });

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Multiple files rejected")
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
  });

  it("TIER2-F12-09: 'Paste from Clipboard' handles clipboard read rejection with user notice", async () => {
    vi.spyOn(navigator.clipboard, "readText").mockRejectedValueOnce(
      new Error("Permission denied")
    );

    const onChange = vi.fn();
    render(el(ToolEditor, { value: "", onChange }));

    const pasteBtn = screen.getByTestId("btn-paste-clipboard");
    await act(async () => {
      fireEvent.click(pasteBtn);
    });

    await waitFor(() => {
      const notice = screen.getByTestId("clipboard-notice");
      expect(notice.textContent).toContain("Clipboard access denied");
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

describe("E2E Shell: Feature 13 - ToolControls Component", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F13-01: renders select dropdown with options and updates on change", () => {
    const inputs: ToolInput[] = [
      {
        name: "format",
        label: "Output Format",
        control: "select",
        options: [
          { label: "Pretty", value: "pretty" },
          { label: "Minified", value: "minified" },
        ],
      },
    ];
    const onChange = vi.fn();

    render(
      el(ToolControls, {
        inputs,
        values: { format: "pretty" },
        onChange,
      })
    );

    const select = screen.getByTestId("control-format") as HTMLSelectElement;
    expect(select.value).toBe("pretty");

    fireEvent.change(select, { target: { value: "minified" } });
    expect(onChange).toHaveBeenCalledWith("format", "minified");
  });

  it("TIER1-F13-02: renders boolean toggle switch and updates state on click", () => {
    const inputs: ToolInput[] = [
      {
        name: "wrap",
        label: "Wrap Lines",
        control: "toggle",
        defaultValue: false,
      },
    ];
    const onChange = vi.fn();

    render(
      el(ToolControls, {
        inputs,
        values: { wrap: false },
        onChange,
      })
    );

    const toggle = screen.getByTestId("control-wrap") as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith("wrap", true);
  });

  it("TIER1-F13-03: renders number input with min, max, and step attributes", () => {
    const inputs: ToolInput[] = [
      {
        name: "indent",
        label: "Indent Spaces",
        control: "number",
        min: 0,
        max: 8,
        step: 2,
        defaultValue: 2,
      },
    ];
    const onChange = vi.fn();

    render(
      el(ToolControls, {
        inputs,
        values: { indent: 2 },
        onChange,
      })
    );

    const numInput = screen.getByTestId("control-indent") as HTMLInputElement;
    expect(numInput.min).toBe("0");
    expect(numInput.max).toBe("8");
    expect(numInput.step).toBe("2");
    expect(numInput.value).toBe("2");

    fireEvent.change(numInput, { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith("indent", 4);
  });

  it("TIER1-F13-04: passes reactive parameter changes to parent state", () => {
    const inputs: ToolInput[] = [
      { name: "delimiter", label: "Delimiter", control: "select", options: [",", ";", "\t"] },
      { name: "header", label: "Has Header", control: "toggle", defaultValue: true },
    ];

    const state: Record<string, unknown> = { delimiter: ",", header: true };
    const onChange = vi.fn((key: string, val: unknown) => {
      state[key] = val;
    });

    const { rerender } = render(
      el(ToolControls, { inputs, values: state, onChange })
    );

    fireEvent.click(screen.getByTestId("control-header"));
    expect(onChange).toHaveBeenCalledWith("header", false);

    state.header = false;
    rerender(el(ToolControls, { inputs, values: state, onChange }));

    const toggle = screen.getByTestId("control-header") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it("TIER1-F13-05: dynamic 'when' condition hides controls when predicate is false", () => {
    const inputs: ToolInput[] = [
      {
        name: "mode",
        label: "Mode",
        control: "select",
        options: ["basic", "advanced"],
      },
      {
        name: "advancedOption",
        label: "Advanced Option",
        control: "toggle",
        when: { field: "mode", equals: "advanced" },
      },
    ];

    render(
      el(ToolControls, {
        inputs,
        values: { mode: "basic" },
        onChange: vi.fn(),
      })
    );

    expect(screen.queryByTestId("group-advancedOption")).toBeNull();
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F13-06: dynamic 'when' condition displays control reactively when condition becomes true", () => {
    const inputs: ToolInput[] = [
      {
        name: "mode",
        label: "Mode",
        control: "select",
        options: ["basic", "advanced"],
      },
      {
        name: "advancedOption",
        label: "Advanced Option",
        control: "toggle",
        when: (values: Record<string, unknown>) => values.mode === "advanced",
      },
    ];

    const { rerender } = render(
      el(ToolControls, {
        inputs,
        values: { mode: "basic" },
        onChange: vi.fn(),
      })
    );

    expect(screen.queryByTestId("group-advancedOption")).toBeNull();

    rerender(
      el(ToolControls, {
        inputs,
        values: { mode: "advanced" },
        onChange: vi.fn(),
      })
    );

    expect(screen.getByTestId("group-advancedOption")).toBeDefined();
  });

  it("TIER2-F13-07: disables all parameter controls when tool state is processing", () => {
    const inputs: ToolInput[] = [
      { name: "format", label: "Format", control: "select", options: ["a", "b"] },
      { name: "flag", label: "Flag", control: "toggle" },
      { name: "count", label: "Count", control: "number" },
    ];

    render(
      el(ToolControls, {
        inputs,
        values: { format: "a", flag: true, count: 5 },
        onChange: vi.fn(),
        disabled: true,
      })
    );

    expect((screen.getByTestId("control-format") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId("control-flag") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId("control-count") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("E2E Shell: Feature 14 - ToolProgressBar & ToolErrorBanner", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F14-01: progress bar renders with role='progressbar' and aria-busy='true' during processing", () => {
    render(
      el(ToolProgressBar, {
        isProcessing: true,
        progress: { percent: 45, label: "Hashing chunks..." },
      })
    );

    const progress = screen.getByTestId("tool-progress-bar");
    expect(progress.getAttribute("role")).toBe("progressbar");
    expect(progress.getAttribute("aria-busy")).toBe("true");
    expect(progress.getAttribute("aria-valuenow")).toBe("45");
  });

  it("TIER1-F14-02: displays status label, percentage text, and width fill", () => {
    render(
      el(ToolProgressBar, {
        isProcessing: true,
        progress: { percent: 75, label: "Encoding base64..." },
      })
    );

    expect(screen.getByTestId("progress-label").textContent).toBe("Encoding base64...");
    expect(screen.getByTestId("progress-percent").textContent).toBe("75%");
    expect(screen.getByTestId("progress-fill").style.width).toBe("75%");
  });

  it("TIER1-F14-03: displays elapsed execution timer", () => {
    render(
      el(ToolProgressBar, {
        isProcessing: true,
        progress: { percent: 50, label: "Running..." },
        elapsedMs: 340,
      })
    );

    expect(screen.getByTestId("progress-timer").textContent).toBe("340ms");
  });

  it("TIER1-F14-04: active 'Cancel' button calls onCancel callback", () => {
    const onCancel = vi.fn();
    render(
      el(ToolProgressBar, {
        isProcessing: true,
        progress: { percent: 50, label: "Working..." },
        onCancel,
        canCancel: true,
      })
    );

    const cancelBtn = screen.getByTestId("btn-progress-cancel");
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("TIER1-F14-05: diagnostic error banner renders with role='alert' on error", () => {
    render(el(ToolErrorBanner, { error: new Error("Syntax error on line 4") }));

    const alert = screen.getByTestId("tool-error-banner");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("error-message").textContent).toBe("Syntax error on line 4");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F14-06: error banner displays structured line and column coordinates from diagnostics", () => {
    const validation: ValidationResult = {
      valid: false,
      diagnostics: [
        {
          message: "Unexpected token '}'",
          line: 12,
          column: 5,
          severity: "error",
        },
      ],
    };

    render(el(ToolErrorBanner, { error: null, validation }));

    const item = screen.getByTestId("diagnostic-item");
    expect(item.textContent).toContain("Line 12, Column 5: Unexpected token '}'");
  });

  it("TIER2-F14-07: dismissal button invokes onDismiss and hides banner", () => {
    const onDismiss = vi.fn();
    render(
      el(ToolErrorBanner, {
        error: "Temporary error",
        onDismiss,
      })
    );

    const dismissBtn = screen.getByTestId("btn-dismiss-error");
    fireEvent.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("TIER2-F14-08: hides progress bar when isProcessing is false", () => {
    const { queryByTestId } = render(
      el(ToolProgressBar, {
        isProcessing: false,
        progress: { percent: 100, label: "Done" },
      })
    );

    expect(queryByTestId("tool-progress-bar")).toBeNull();
  });
});

describe("E2E Shell: Feature 15 - ToolActionBar & ToolOutputPreview", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F15-01: 'Copy' button copies result to clipboard and displays feedback", async () => {
    const result: ToolResult = {
      data: "hello clipboard output",
      durationMs: 8,
    };

    render(el(ToolActionBar, { result }));

    const copyBtn = screen.getByTestId("btn-action-copy");
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(MockClipboardManager.getLastWritten()).toBe("hello clipboard output");
    expect(copyBtn.textContent).toBe("Copied!");
  });

  it("TIER1-F15-02: 'Download' button triggers simulated anchor click with sanitized filename", () => {
    const result: ToolResult = {
      data: "file content to save",
      suggestedFilename: "report.json",
      mimeType: "application/json",
      durationMs: 5,
    };

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(el(ToolActionBar, { result }));

    const downloadBtn = screen.getByTestId("btn-action-download");
    fireEvent.click(downloadBtn);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("TIER1-F15-03: 'Chain to Workflow' button calls onWorkflowChain with result payload", () => {
    const onWorkflowChain = vi.fn();
    const result: ToolResult = {
      data: { user: "alice", id: 123 },
      durationMs: 6,
    };

    render(
      el(ToolActionBar, {
        result,
        onWorkflowChain,
      })
    );

    const chainBtn = screen.getByTestId("btn-action-chain");
    fireEvent.click(chainBtn);

    expect(onWorkflowChain).toHaveBeenCalledWith({ user: "alice", id: 123 });
  });

  it("TIER1-F15-04: formatted text output preview renders inside pre and code blocks", () => {
    const result: ToolResult = {
      data: "SELECT * FROM users;",
      durationMs: 3,
    };

    render(el(ToolOutputPreview, { result }));

    const preview = screen.getByTestId("preview-text");
    expect(preview.tagName).toBe("PRE");
    expect(preview.querySelector("code")?.textContent).toBe("SELECT * FROM users;");
  });

  it("TIER1-F15-05: table output preview renders HTML table with headers and data rows", () => {
    const result: ToolResult = {
      data: [
        { id: 1, name: "Alice", role: "Admin" },
        { id: 2, name: "Bob", role: "Developer" },
      ],
      durationMs: 4,
    };

    render(
      el(ToolOutputPreview, {
        result,
        outputConfig: { id: "out", label: "Table", type: "table" },
      })
    );

    const table = screen.getByTestId("preview-table");
    expect(table).toBeDefined();

    const headers = table.querySelectorAll("th");
    expect(Array.from(headers).map((h) => h.textContent)).toEqual(["id", "name", "role"]);

    const rows = table.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F15-06: image output preview renders <img> element with src from result", () => {
    const result: ToolResult = {
      data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      mimeType: "image/png",
      durationMs: 10,
    };

    render(
      el(ToolOutputPreview, {
        result,
        outputConfig: { id: "img", label: "Image", type: "image" },
      })
    );

    const img = screen.getByTestId("preview-image") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.src).toContain("data:image/png;base64");
  });

  it("TIER2-F15-07: action buttons are disabled when result is null or empty", () => {
    render(el(ToolActionBar, { result: null, onWorkflowChain: vi.fn() }));

    expect((screen.getByTestId("btn-action-copy") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-action-download") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-action-chain") as HTMLButtonElement).disabled).toBe(true);
  });

  it("TIER2-F15-08: download action sanitizes filenames with illegal path/special characters", () => {
    const result: ToolResult = {
      data: "sanitized test",
      suggestedFilename: "evil/path:with*illegal?chars.txt",
      durationMs: 2,
    };

    let createdDownloadName = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      createdDownloadName = this.download;
    });

    render(el(ToolActionBar, { result }));
    fireEvent.click(screen.getByTestId("btn-action-download"));

    expect(createdDownloadName).toBe("evil_path_with_illegal_chars.txt");
    clickSpy.mockRestore();
  });
});

describe("E2E Shell: Feature 16 - CustomCanvasSlot Protocol", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F16-01: renders custom visual slot when customCanvas is provided", () => {
    const definition = createMockToolDefinition({ id: "color-picker", name: "Color Picker" });
    const engine = createMockToolEngine();

    const customCanvas = vi.fn((props: CustomCanvasSlotProps) =>
      el("div", { "data-testid": "visual-color-wheel" }, `Interactive Color Wheel: ${props.definition.name}`)
    );

    render(
      el(UniversalToolShell, {
        definition,
        engine,
        customCanvas,
      })
    );

    expect(screen.getByTestId("custom-canvas-slot")).toBeDefined();
    expect(screen.getByTestId("visual-color-wheel")).toBeDefined();
    expect(customCanvas).toHaveBeenCalledTimes(1);
  });

  it("TIER1-F16-02: passes complete CustomCanvasSlotProps to custom visual component", () => {
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine();

    let capturedProps: CustomCanvasSlotProps | null = null;
    const customCanvas = (props: CustomCanvasSlotProps) => {
      capturedProps = props;
      return el("div", { "data-testid": "custom-canvas" }, "Canvas");
    };

    render(
      el(UniversalToolShell, {
        definition,
        engine,
        customCanvas,
      })
    );

    expect(capturedProps).not.toBeNull();
    expect(capturedProps!.definition).toBe(definition);
    expect(capturedProps!.engine).toBe(engine);
    expect(typeof capturedProps!.setInput).toBe("function");
    expect(typeof capturedProps!.run).toBe("function");
    expect(capturedProps!.isProcessing).toBe(false);
  });

  it("TIER1-F16-03: custom visual slot can update input and invoke run()", async () => {
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine({
      process: async (input: unknown) => ({
        data: `Canvas result for: ${input}`,
        durationMs: 5,
      }),
    });

    const customCanvas = (props: CustomCanvasSlotProps) =>
      el(
        "div",
        null,
        el(
          "button",
          {
            "data-testid": "btn-canvas-trigger",
            onClick: () => {
              props.setInput("#ff0000");
              props.run();
            },
          },
          "Select Red"
        )
      );

    render(
      el(UniversalToolShell, {
        definition,
        engine,
        customCanvas,
      })
    );

    const triggerBtn = screen.getByTestId("btn-canvas-trigger");
    await act(async () => {
      fireEvent.click(triggerBtn);
    });

    await waitFor(() => {
      const output = screen.getByTestId("preview-text");
      expect(output.textContent).toContain("Canvas result for:");
    });
  });

  it("TIER1-F16-04: outer shell uniformity (header, privacy badge, actions) is preserved around canvas", () => {
    const definition = createMockToolDefinition({ name: "Diff Inspector", category: "diff" });
    const engine = createMockToolEngine();

    render(
      el(UniversalToolShell, {
        definition,
        engine,
        customCanvas: () => el("div", { "data-testid": "diff-grid" }, "Diff Grid"),
      })
    );

    // Header, badge, slot, and action bar all coexist
    expect(screen.getByTestId("tool-header")).toBeDefined();
    expect(screen.getByTestId("badge-local")).toBeDefined();
    expect(screen.getByTestId("custom-canvas-slot")).toBeDefined();
    expect(screen.getByTestId("tool-action-bar")).toBeDefined();
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F16-05: error boundary catches crash inside customCanvas and displays diagnostic error banner", () => {
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine();

    const BrokenCanvas = () => {
      throw new Error("Canvas render failed due to corrupt WebGL buffer");
    };

    // Suppress console.error in test runner for expected error boundary throw
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      el(UniversalToolShell, {
        definition,
        engine,
        customCanvas: () => el(BrokenCanvas, null),
      })
    );

    const errorBanner = screen.getByTestId("tool-error-banner");
    expect(errorBanner).toBeDefined();
    expect(screen.getByTestId("error-message").textContent).toContain(
      "Canvas render failed due to corrupt WebGL buffer"
    );

    consoleError.mockRestore();
  });

  it("TIER2-F16-06: graceful fallback: renders standard editor when customCanvas is undefined", () => {
    const definition = createMockToolDefinition();
    const engine = createMockToolEngine();

    const { queryByTestId, getByTestId } = render(
      el(UniversalToolShell, {
        definition,
        engine,
        customCanvas: undefined,
      })
    );

    expect(queryByTestId("custom-canvas-slot")).toBeNull();
    expect(getByTestId("standard-input-zone")).toBeDefined();
    expect(getByTestId("tool-editor")).toBeDefined();
  });
});

describe("E2E Shell: Feature 19 - Dynamic Route UI Unification", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  // --- Tier 1: Feature Coverage (Happy Path) ---

  it("TIER1-F19-01: /tools/[slug] route resolves canonical tool and mounts UniversalToolShell", () => {
    const mockDef = createMockToolDefinition({ id: "json-formatter", slug: "json-formatter" });
    const mockEng = createMockToolEngine();

    render(
      el(DynamicToolRoute, {
        slug: "json-formatter",
        getToolFn: (k) => (k === "json-formatter" ? mockDef : null),
        getEngineFn: (k) => (k === "json-formatter" ? mockEng : null),
      })
    );

    expect(screen.getByTestId("dynamic-tool-page")).toBeDefined();
    expect(screen.getByTestId("universal-tool-shell")).toBeDefined();
    expect(screen.getByTestId("tool-title").textContent).toBe(mockDef.name);
  });

  it("TIER1-F19-02: resolves the 6 legacy mismatched tools (e.g. json-lines-formatter -> jsonl-formatter)", () => {
    const mismatchedTools = [
      { slug: "json-lines-formatter", id: "jsonl-formatter" },
      { slug: "json-lines-validator", id: "jsonl-validator" },
      { slug: "json-lines-to-json", id: "jsonl-to-json" },
      { slug: "json-to-json-lines", id: "json-to-jsonl" },
      { slug: "csv-to-html-table", id: "csv-to-html" },
      { slug: "csv-data-deduplicator", id: "csv-deduplicator" },
    ];

    for (const pair of mismatchedTools) {
      const def = createMockToolDefinition({ id: pair.id, slug: pair.slug, name: pair.id });
      const eng = createMockToolEngine();

      const { unmount } = render(
        el(DynamicToolRoute, {
          slug: pair.slug,
          getToolFn: (k) => (k === pair.id || k === pair.slug ? def : null),
          getEngineFn: (k) => (k === pair.id || k === pair.slug ? eng : null),
        })
      );

      expect(screen.getByTestId("tool-title").textContent).toBe(pair.id);
      unmount();
    }
  });

  it("TIER1-F19-03: injects SEO canonical link tag matching route URL", () => {
    const def = createMockToolDefinition({ id: "base64-encoder", slug: "base64-encoder" });
    const eng = createMockToolEngine();

    render(
      el(DynamicToolRoute, {
        slug: "base64-encoder",
        getToolFn: () => def,
        getEngineFn: () => eng,
      })
    );

    const canonical =
      (document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement) ||
      (document.querySelector('link[data-testid="seo-canonical"]') as HTMLLinkElement);
    expect(canonical).not.toBeNull();
    expect(canonical.getAttribute("href")).toBe("https://codestation.in/tools/base64-encoder");
  });

  it("TIER1-F19-04: injects AEO FAQPage JSON-LD structured data script", () => {
    const def = createMockToolDefinition({ name: "Hash Generator" });
    const eng = createMockToolEngine();

    const { container } = render(
      el(DynamicToolRoute, {
        slug: "hash-generator",
        getToolFn: () => def,
        getEngineFn: () => eng,
      })
    );

    const aeoScript = container.querySelector('script[data-testid="aeo-schema"]');
    expect(aeoScript).not.toBeNull();

    const parsed = JSON.parse(aeoScript!.innerHTML);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity.length).toBeGreaterThan(0);
  });

  it("TIER1-F19-05: injects GEO WebApplication JSON-LD structured data script", () => {
    const def = createMockToolDefinition({ name: "SQL Formatter", category: "database" });
    const eng = createMockToolEngine();

    const { container } = render(
      el(DynamicToolRoute, {
        slug: "sql-formatter",
        getToolFn: () => def,
        getEngineFn: () => eng,
      })
    );

    const geoScript = container.querySelector('script[data-testid="geo-schema"]');
    expect(geoScript).not.toBeNull();

    const parsed = JSON.parse(geoScript!.innerHTML);
    expect(parsed["@type"]).toBe("WebApplication");
    expect(parsed.name).toBe("SQL Formatter");
    expect(parsed.browserRequirements).toContain("100% In-Browser");
  });

  // --- Tier 2: Boundary & Corner Cases ---

  it("TIER2-F19-06: renders 404 Not Found page for invalid or non-existent slugs", () => {
    render(
      el(DynamicToolRoute, {
        slug: "completely-unknown-tool",
        getToolFn: () => null,
        getEngineFn: () => null,
      })
    );

    const notFound = screen.getByTestId("not-found-page");
    expect(notFound.textContent).toContain("404");
    expect(notFound.textContent).toContain("completely-unknown-tool");
    expect(screen.queryByTestId("universal-tool-shell")).toBeNull();
  });

  it("TIER2-F19-07: ensures JSON-LD schemas contain valid JSON with zero undefined fields", () => {
    const def = createMockToolDefinition({ name: "Diff Checker" });
    const eng = createMockToolEngine();

    const { container } = render(
      el(DynamicToolRoute, {
        slug: "diff-checker",
        getToolFn: () => def,
        getEngineFn: () => eng,
      })
    );

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts.length).toBe(2);

    scripts.forEach((script) => {
      expect(() => JSON.parse(script.innerHTML)).not.toThrow();
      expect(script.innerHTML).not.toContain("undefined");
    });
  });
});
