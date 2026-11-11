/**
 * Code Station — Agent Readiness Bridge (WebMCP & MCP Serializers)
 *
 * Converts canonical ToolDefinition instances into standard WebMCP (document.modelContext)
 * schemas and Local stdio MCP tool definitions.
 */

import type { ToolDefinition } from "./types";

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
