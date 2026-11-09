/**
 * WebMCP Registry: Central manager for browser-native tool registration.
 * Compatible with Chromium's experimental document.modelContext standard and AI browser extensions.
 */

import type { ToolDefinition } from "../../config/tools";
import { tools } from "../../config/tools";
import { dispatchToolExecution } from "./dispatcher";
import type { WebMcpTool, WebMcpToolResult, WebMcpContext } from "./types";

/** In-memory store of registered tools */
const toolStore = new Map<string, WebMcpTool>();
let initialized = false;

/** Universal tool discovery tool */
export const LIST_TOOLS_MCP: WebMcpTool = {
  name: "codestation_list_tools",
  description:
    "Discover and search available Code Station utilities (385+ tools across 23 developer stations) executable in-browser.",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Filter tools by station category (e.g. 'JSON & Data', 'Security', 'Encoding', 'Compression', 'Network & DevOps', 'Developer Math')",
      },
      query: {
        type: "string",
        description: "Search keyword matching tool name, description, or slug",
      },
      limit: {
        type: "number",
        description: "Maximum number of tools to return (default: 25, max: 100)",
      },
    },
  },
  execute: async (args: Record<string, any>) => {
    const category = args?.category ? String(args.category).toLowerCase().trim() : undefined;
    const query = args?.query ? String(args.query).toLowerCase().trim() : undefined;
    const limit = Math.min(Math.max(Number(args?.limit ?? 25), 1), 100);

    let filtered = tools;
    if (category) {
      filtered = filtered.filter((t) => t.category.toLowerCase().includes(category));
    }
    if (query) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.id.toLowerCase().includes(query) ||
          t.slug.toLowerCase().includes(query)
      );
    }

    const results = filtered.slice(0, limit).map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      category: t.category,
      description: t.description,
      canonicalUrl: `https://codestation.in/tools/${t.slug}`,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              totalMatches: filtered.length,
              returned: results.length,
              tools: results,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};

/** Universal tool execution tool */
export const EXECUTE_TOOL_MCP: WebMcpTool = {
  name: "codestation_execute_tool",
  description:
    "Execute any Code Station developer utility (JSON format, JWT decode, Base64, SHA-256, CIDR calculate, CSS, Math) directly in the browser.",
  inputSchema: {
    type: "object",
    properties: {
      toolId: {
        type: "string",
        description: "The identifier or slug of the tool, e.g. 'json-formatter', 'base64', 'sha-256', 'cidr-calculator'",
      },
      input: {
        type: "string",
        description: "Primary text, JSON, or code input to be processed",
      },
      options: {
        type: "object",
        description: "Optional tool-specific configuration arguments",
      },
    },
    required: ["toolId"],
  },
  execute: async (args: Record<string, any>) => {
    if (!args || !args.toolId) {
      return {
        content: [{ type: "text", text: "Error: Missing required argument 'toolId'." }],
        isError: true,
      };
    }
    try {
      const output = await dispatchToolExecution(
        String(args.toolId),
        String(args.input ?? ""),
        args.options ?? args
      );
      return {
        content: [{ type: "text", text: output }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Execution failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
};

/**
 * Register a single WebMcpTool into both the local store and document.modelContext.
 */
export function registerWebMcpTool(tool: WebMcpTool): () => void {
  toolStore.set(tool.name, tool);

  if (typeof document !== "undefined") {
    const ctx = (document.modelContext ?? (navigator as any)?.modelContext) as WebMcpContext | undefined;
    if (ctx && typeof ctx.registerTool === "function") {
      try {
        ctx.registerTool(tool);
      } catch {
        // Safe ignore for duplicate registrations
      }
    }
  }

  return () => {
    unregisterWebMcpTool(tool.name);
  };
}

/**
 * Unregister a tool by name.
 */
export function unregisterWebMcpTool(name: string): void {
  toolStore.delete(name);

  if (typeof document !== "undefined") {
    const ctx = (document.modelContext ?? (navigator as any)?.modelContext) as WebMcpContext | undefined;
    if (ctx && typeof ctx.unregisterTool === "function") {
      try {
        ctx.unregisterTool(name);
      } catch {
        // Safe ignore
      }
    }
  }
}

/**
 * Returns all currently registered WebMCP tools.
 */
export function getRegisteredWebMcpTools(): WebMcpTool[] {
  return Array.from(toolStore.values());
}

/**
 * Directly execute a registered WebMCP tool by name.
 */
export async function executeWebMcpTool(
  name: string,
  args: Record<string, any> = {}
): Promise<WebMcpToolResult> {
  const tool = toolStore.get(name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Tool '${name}' not found in WebMCP registry.` }],
      isError: true,
    };
  }

  try {
    const result = await tool.execute(args);
    if (typeof result === "string") {
      return { content: [{ type: "text", text: result }] };
    }
    return result;
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing '${name}': ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Create a dedicated WebMcpTool contract for any Code Station ToolDefinition.
 */
export function createWebMcpToolForDefinition(tool: ToolDefinition): WebMcpTool {
  const sanitizedName = `codestation_${tool.slug.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const isGenerator = [
    "uuid-generator",
    "ulid-generator",
    "nanoid-generator",
    "password-generator",
    "secure-token-generator",
    "random-string",
    "mock-data",
  ].includes(tool.id);

  return {
    name: sanitizedName,
    description: `[Code Station - ${tool.category}] ${tool.description} (100% In-Browser, zero server uploads).`,
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: `Primary input for ${tool.name}.`,
        },
        options: {
          type: "object",
          description: "Optional tool execution parameters.",
        },
      },
      required: isGenerator ? [] : ["input"],
    },
    execute: async (args: Record<string, any>) => {
      try {
        const output = await dispatchToolExecution(tool.id, args.input ?? "", args.options ?? args);
        return { content: [{ type: "text", text: output }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Tool '${tool.name}' failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}

/**
 * Helper to register an active tool definition when navigating to its page.
 */
export function registerActiveWebMcpTool(tool: ToolDefinition): () => void {
  const mcpTool = createWebMcpToolForDefinition(tool);
  return registerWebMcpTool(mcpTool);
}

/**
 * Initialize WebMCP bridge on document.modelContext and window.__CODESTATION_WEBMCP__.
 * Safe for server-side rendering (SSR) and testing.
 */
export function initWebMcp(): void {
  // Always ensure baseline tools exist in memory
  if (!toolStore.has(LIST_TOOLS_MCP.name)) {
    toolStore.set(LIST_TOOLS_MCP.name, LIST_TOOLS_MCP);
  }
  if (!toolStore.has(EXECUTE_TOOL_MCP.name)) {
    toolStore.set(EXECUTE_TOOL_MCP.name, EXECUTE_TOOL_MCP);
  }

  if (typeof document === "undefined") return;
  if (initialized && document.modelContext) return;
  initialized = true;

  // Create polyfill / bridge if document.modelContext does not exist natively
  if (!document.modelContext) {
    const polyfillContext: WebMcpContext = {
      registerTool: (tool: WebMcpTool) => {
        toolStore.set(tool.name, tool);
      },
      unregisterTool: (name: string) => {
        toolStore.delete(name);
      },
      getTools: () => Array.from(toolStore.values()),
      executeTool: executeWebMcpTool,
    };

    try {
      Object.defineProperty(document, "modelContext", {
        value: polyfillContext,
        writable: true,
        configurable: true,
      });
    } catch {
      (document as any).modelContext = polyfillContext;
    }
  }

  // Also expose on window.__CODESTATION_WEBMCP__ for AI browser extensions & inspection
  if (typeof window !== "undefined") {
    window.__CODESTATION_WEBMCP__ = {
      version: "1.0.0",
      tools: toolStore,
      executeTool: executeWebMcpTool,
    };
  }
}

/**
 * Reset helper for testing environments.
 */
export function resetWebMcpForTesting(): void {
  toolStore.clear();
  initialized = false;
  initWebMcp();
}
