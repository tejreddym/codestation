/**
 * Code Station — Tool Engine E2E Test Helpers & Stubs
 * Provides reusable browser API stubs (MockURL, MockWorker, MockClipboard, canvas),
 * lifecycle test environments, standard synthetic fixtures, and reference architecture
 * runners for opaque-box contract and lifecycle verification.
 */

import { vi } from "vitest";
import type {
  ToolDefinition,
  ToolEngine,
  ToolInput,
  ToolOutput,
  ToolContext,
  ToolResult,
  ValidationResult,
  ValidationDiagnostic,
  ToolProgress,
  ToolExecutionState,
  ToolProcessingType,
} from "../../types";
import {
  createValidationSuccess,
  createValidationError,
} from "../../types";

// ============================================================================
// 1. Browser API Mocks (URL, Worker, Clipboard, Canvas)
// ============================================================================

export class MockURLManager {
  private static activeUrls: Set<string> = new Set();
  private static originalCreateObjectURL: typeof URL.createObjectURL | undefined;
  private static originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;
  private static idCounter = 0;

  static install(): void {
    this.originalCreateObjectURL = URL.createObjectURL;
    this.originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn((_blob: Blob | File): string => {
      this.idCounter += 1;
      const url = `blob:http://localhost:3000/mock-blob-${Date.now()}-${this.idCounter}`;
      this.activeUrls.add(url);
      return url;
    });

    URL.revokeObjectURL = vi.fn((url: string): void => {
      this.activeUrls.delete(url);
    });
  }

  static getActiveUrls(): string[] {
    return Array.from(this.activeUrls);
  }

  static hasActiveUrl(url: string): boolean {
    return this.activeUrls.has(url);
  }

  static getActiveCount(): number {
    return this.activeUrls.size;
  }

  static reset(): void {
    this.activeUrls.clear();
    this.idCounter = 0;
  }

  static restore(): void {
    this.reset();
    if (this.originalCreateObjectURL) {
      URL.createObjectURL = this.originalCreateObjectURL;
    }
    if (this.originalRevokeObjectURL) {
      URL.revokeObjectURL = this.originalRevokeObjectURL;
    }
  }
}

export type WorkerMessageListener = EventListenerOrEventListenerObject;
export type WorkerErrorListener = EventListenerOrEventListenerObject;

export class MockWorker implements EventTarget {
  static instances: MockWorker[] = [];
  static messageHandler?: (worker: MockWorker, message: unknown) => void;

  public url: string;
  public terminated = false;
  public messagesPosted: unknown[] = [];
  public onmessage: ((this: Worker, ev: MessageEvent) => void) | null = null;
  public onerror: ((this: AbstractWorker, ev: ErrorEvent) => void) | null = null;

  private messageListeners: Set<EventListenerOrEventListenerObject> = new Set();
  private errorListeners: Set<EventListenerOrEventListenerObject> = new Set();

  constructor(url: string) {
    this.url = url;
    MockWorker.instances.push(this);
  }

  postMessage(message: unknown, _transfer?: Transferable[]): void {
    if (this.terminated) {
      throw new Error("Cannot postMessage on a terminated worker");
    }
    this.messagesPosted.push(message);

    if (MockWorker.messageHandler) {
      MockWorker.messageHandler(this, message);
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === "message") {
      this.messageListeners.add(listener);
    } else if (type === "error") {
      this.errorListeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === "message") {
      this.messageListeners.delete(listener);
    } else if (type === "error") {
      this.errorListeners.delete(listener);
    }
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  /**
   * Helper to simulate a message sent from the worker thread to the main thread.
   */
  emitMessage(data: unknown): void {
    if (this.terminated) return;
    const event = { data, type: "message" } as MessageEvent;
    if (this.onmessage) {
      this.onmessage.call(this as unknown as Worker, event);
    }
    this.messageListeners.forEach((listener) => {
      if (typeof listener === "function") {
        listener(event);
      } else if (listener && typeof (listener as EventListenerObject).handleEvent === "function") {
        (listener as EventListenerObject).handleEvent(event);
      }
    });
  }

  /**
   * Helper to simulate an unhandled error inside the worker.
   */
  emitError(error: Error | string): void {
    if (this.terminated) return;
    const message = typeof error === "string" ? error : error.message;
    const event = { message, type: "error" } as ErrorEvent;
    if (this.onerror) {
      this.onerror.call(this as unknown as AbstractWorker, event);
    }
    this.errorListeners.forEach((listener) => {
      if (typeof listener === "function") {
        listener(event);
      } else if (listener && typeof (listener as EventListenerObject).handleEvent === "function") {
        (listener as EventListenerObject).handleEvent(event);
      }
    });
  }

  static getActiveInstances(): MockWorker[] {
    return this.instances.filter((w) => !w.terminated);
  }

  static reset(): void {
    this.instances.forEach((w) => w.terminate());
    this.instances = [];
    this.messageHandler = undefined;
  }
}

export class MockClipboardManager {
  private static clipboardText = "";
  private static writeHistory: string[] = [];

  static install(): void {
    const clipboardMock = {
      writeText: vi.fn(async (text: string): Promise<void> => {
        this.clipboardText = text;
        this.writeHistory.push(text);
      }),
      readText: vi.fn(async (): Promise<string> => {
        return this.clipboardText;
      }),
    };

    try {
      Object.defineProperty(navigator, "clipboard", {
        value: clipboardMock,
        writable: true,
        configurable: true,
      });
    } catch {
      // If already defined, stub methods
      (navigator as unknown as { clipboard: typeof clipboardMock }).clipboard = clipboardMock;
    }
  }

  static getLastWritten(): string | null {
    return this.writeHistory.length > 0 ? this.writeHistory[this.writeHistory.length - 1] : null;
  }

  static getHistory(): string[] {
    return [...this.writeHistory];
  }

  static reset(): void {
    this.clipboardText = "";
    this.writeHistory = [];
  }
}

export function mockCanvas2DContext(): void {
  if (typeof HTMLCanvasElement !== "undefined") {
    HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
      if (contextId === "2d") {
        return {
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
          putImageData: vi.fn(),
          createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
          setTransform: vi.fn(),
          drawImage: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          closePath: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          canvas: document.createElement("canvas"),
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  }
}

/**
 * Initializes all mock browser APIs for JSDOM testing.
 */
export function setupTestEnvironment(): {
  url: typeof MockURLManager;
  worker: typeof MockWorker;
  clipboard: typeof MockClipboardManager;
} {
  MockURLManager.install();
  MockURLManager.reset();

  MockWorker.reset();
  vi.stubGlobal("Worker", MockWorker);

  MockClipboardManager.install();
  MockClipboardManager.reset();

  mockCanvas2DContext();

  return {
    url: MockURLManager,
    worker: MockWorker,
    clipboard: MockClipboardManager,
  };
}

/**
 * Restores all mock browser APIs and clears tracked state.
 */
export function cleanupTestEnvironment(): void {
  MockURLManager.restore();
  MockWorker.reset();
  MockClipboardManager.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

// ============================================================================
// 2. Synthetic Test Fixtures
// ============================================================================

export function createMockToolDefinition(
  overrides?: Partial<ToolDefinition>
): ToolDefinition {
  return {
    id: "mock-tool",
    name: "Mock Tool",
    category: "data",
    description: "A standard mock tool for testing",
    processing: "local",
    offlineSupported: true,
    input: [
      {
        name: "input",
        label: "Input Data",
        control: "text",
        required: true,
      },
    ],
    output: [
      {
        id: "output",
        label: "Output Result",
        type: "text",
        copyable: true,
        downloadable: true,
      },
    ],
    worker: undefined,
    dependencies: [],
    capabilities: ["transform"],
    ...overrides,
  };
}

export function createMockToolEngine<TInput = unknown, TOutput = unknown>(
  overrides?: Partial<ToolEngine<TInput, TOutput>>
): ToolEngine<TInput, TOutput> {
  return {
    validate: vi.fn((_input: unknown): ValidationResult => {
      return createValidationSuccess();
    }),
    process: vi.fn(
      async (input: TInput, _context: ToolContext): Promise<ToolResult<TOutput>> => {
        return {
          data: input as unknown as TOutput,
          durationMs: 4,
          suggestedFilename: "mock-result.txt",
          mimeType: "text/plain",
        };
      }
    ),
    cancel: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  };
}

export function createAsyncMockEngine(
  delayMs = 50,
  progressSteps: Array<{ percent: number; label: string }> = [
    { percent: 25, label: "Step 1" },
    { percent: 50, label: "Step 2" },
    { percent: 75, label: "Step 3" },
    { percent: 100, label: "Done" },
  ]
): ToolEngine<string, string> {
  let isCancelled = false;

  return {
    validate: (input: unknown) => {
      if (typeof input !== "string" || input.trim() === "") {
        return createValidationError("Input cannot be empty");
      }
      return createValidationSuccess();
    },
    process: async (input: string, context: ToolContext): Promise<ToolResult<string>> => {
      isCancelled = false;

      const abortHandler = () => {
        isCancelled = true;
      };
      context.signal.addEventListener("abort", abortHandler);

      const stepDelay = Math.max(1, Math.floor(delayMs / progressSteps.length));

      for (const step of progressSteps) {
        if (context.signal.aborted || isCancelled) {
          throw new DOMException("Operation aborted by user", "AbortError");
        }
        await new Promise((resolve) => setTimeout(resolve, stepDelay));
        if (context.signal.aborted || isCancelled) {
          throw new DOMException("Operation aborted by user", "AbortError");
        }
        context.reportProgress(step);
      }

      context.signal.removeEventListener("abort", abortHandler);

      return {
        data: `Processed: ${input.toUpperCase()}`,
        durationMs: delayMs,
        suggestedFilename: "result.txt",
        mimeType: "text/plain",
      };
    },
    cancel: () => {
      isCancelled = true;
    },
    dispose: () => {
      isCancelled = true;
    },
  };
}

// ============================================================================
// 3. Zero-Regression adaptToolToEngine Legacy Adapter
// ============================================================================

export interface LegacyToolMetadata {
  id: string;
  slug?: string;
  name: string;
  category: string;
  description: string;
  keywords?: string[];
  offlineSupported?: boolean;
  process?: (input: any) => Promise<any> | any;
}

/**
 * Maps legacy tool definitions from config/tools.ts into canonical ToolDefinition & ToolEngine.
 * Implements dual-key resolution for the 6 mismatched slug/id tools.
 */
export function adaptToolToEngine(
  legacyTool: LegacyToolMetadata,
  processor?: (input: unknown) => Promise<unknown> | unknown
): {
  definition: ToolDefinition;
  engine: ToolEngine;
} {
  const canonicalId = legacyTool.id;
  const canonicalSlug = legacyTool.slug || legacyTool.id;

  const definition: ToolDefinition = {
    id: canonicalId,
    slug: canonicalSlug,
    name: legacyTool.name || canonicalId,
    category: legacyTool.category || "utilities",
    description: legacyTool.description || "",
    processing: "local",
    offlineSupported: legacyTool.offlineSupported ?? true,
    input: [
      {
        name: "input",
        label: "Input",
        control: "text",
        required: true,
      },
    ],
    output: [
      {
        id: "output",
        label: "Output",
        type: "text",
        copyable: true,
        downloadable: true,
      },
    ],
    keywords: legacyTool.keywords,
  };

  const processFn = processor || legacyTool.process || ((inp: unknown) => inp);

  const engine: ToolEngine = {
    validate: (input: unknown): ValidationResult => {
      if (input === undefined || input === null) {
        return createValidationError("Input is required");
      }
      return createValidationSuccess();
    },
    process: async (input: unknown, _context: ToolContext): Promise<ToolResult> => {
      const start = performance.now();
      const output = await Promise.resolve(processFn(input));
      return {
        data: output,
        durationMs: Math.round(performance.now() - start),
      };
    },
  };

  return { definition, engine };
}

// Dual-key lookup table for the 6 legacy mismatched tools
export const MISMATCHED_SLUG_ID_MAP: Record<string, string> = {
  "json-lines-formatter": "jsonl-formatter",
  "jsonl-formatter": "jsonl-formatter",
  "json-lines-validator": "jsonl-validator",
  "jsonl-validator": "jsonl-validator",
  "json-lines-to-json": "jsonl-to-json",
  "jsonl-to-json": "jsonl-to-json",
  "json-to-json-lines": "json-to-jsonl",
  "json-to-jsonl": "json-to-jsonl",
  "csv-to-html-table": "csv-to-html",
  "csv-to-html": "csv-to-html",
  "csv-data-deduplicator": "csv-deduplicator",
  "csv-deduplicator": "csv-deduplicator",
};

export function resolveToolKey(query: string): string {
  return MISMATCHED_SLUG_ID_MAP[query] || query;
}

// ============================================================================
// 5. Agent Readiness Bridge (WebMCP & MCP Serializers)
// ============================================================================

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: readonly (string | number)[];
  default?: unknown;
  contentMediaType?: string;
}

export interface WebMcpToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
  };
}

export interface LocalMcpToolDescriptor {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
  };
}

/**
 * Serializes a canonical ToolDefinition into WebMCP document.modelContext descriptor.
 */
export function serializeToolToWebMcp(def: ToolDefinition): WebMcpToolDescriptor {
  const toolName = `codestation_${(def.slug || def.id).replace(/-/g, "_")}`;
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const inp of def.input) {
    let type = "string";
    const prop: JsonSchemaProperty = {
      type: "string",
      description: inp.description || inp.label,
    };

    if (inp.control === "number" || inp.control === "range") {
      type = "number";
    } else if (inp.control === "toggle" || inp.control === "checkbox") {
      type = "boolean";
    } else if (inp.control === "select" || inp.control === "radio") {
      type = "string";
      if ("options" in inp && Array.isArray(inp.options)) {
        prop.enum = inp.options.map((opt) =>
          typeof opt === "object" && opt !== null ? opt.value : opt
        );
      }
    } else if (inp.control === "file" || inp.control === "files") {
      type = "string";
      prop.contentMediaType = inp.accept || "application/octet-stream";
    }

    prop.type = type;
    if ("defaultValue" in inp && inp.defaultValue !== undefined) {
      prop.default = inp.defaultValue;
    }
    properties[inp.name] = prop;

    if (inp.required) {
      required.push(inp.name);
    }
  }

  return {
    name: toolName,
    description: def.description,
    inputSchema: {
      type: "object",
      properties,
      required,
    },
  };
}

/**
 * Serializes a canonical ToolDefinition into Local MCP descriptor.
 */
export function serializeToolToLocalMcp(def: ToolDefinition): LocalMcpToolDescriptor {
  const webMcp = serializeToolToWebMcp(def);
  return {
    id: def.id,
    name: webMcp.name,
    description: def.description,
    category: def.category,
    parameters: webMcp.inputSchema,
  };
}

// ============================================================================
// 6. UI Shell & Subcomponent Fixtures Re-Export
// ============================================================================

export * from "./uiFixtures";

