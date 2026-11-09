/**
 * WebMCP: Web Model Context Protocol
 * Browser-native W3C & Chromium standard for exposing in-page client-side tools to AI agents.
 */

export interface WebMcpToolContent {
  type: "text";
  text: string;
}

export interface WebMcpToolResult {
  content: WebMcpToolContent[];
  isError?: boolean;
}

export interface WebMcpInputSchema {
  type: "object";
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: readonly (string | number)[];
    minimum?: number;
    maximum?: number;
    default?: any;
    items?: any;
  }>;
  required?: readonly string[];
  additionalProperties?: boolean;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: WebMcpInputSchema;
  execute: (args: Record<string, any>) => Promise<WebMcpToolResult | string> | WebMcpToolResult | string;
}

export interface WebMcpContext {
  registerTool: (tool: WebMcpTool) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
  getTools?: () => WebMcpTool[];
  executeTool?: (name: string, args?: Record<string, any>) => Promise<WebMcpToolResult>;
}

declare global {
  interface Document {
    modelContext?: WebMcpContext;
  }
  interface Navigator {
    modelContext?: WebMcpContext;
  }
  interface Window {
    modelContext?: WebMcpContext;
    __CODESTATION_WEBMCP__?: {
      version: string;
      tools: Map<string, WebMcpTool>;
      executeTool: (name: string, args?: Record<string, any>) => Promise<WebMcpToolResult>;
    };
  }
}
