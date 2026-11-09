// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  initWebMcp,
  resetWebMcpForTesting,
  getRegisteredWebMcpTools,
  executeWebMcpTool,
  registerActiveWebMcpTool,
  createWebMcpToolForDefinition,
} from "./registry";
import { getTool } from "../../config/tools";

describe("WebMCP Registry and Dispatcher", () => {
  beforeEach(() => {
    resetWebMcpForTesting();
  });

  it("initializes document.modelContext and default global tools", () => {
    expect(document.modelContext).toBeDefined();
    expect(typeof document.modelContext?.registerTool).toBe("function");

    const tools = getRegisteredWebMcpTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("codestation_list_tools");
    expect(names).toContain("codestation_execute_tool");
  });

  it("lists tools and filters by category and query", async () => {
    const result = await executeWebMcpTool("codestation_list_tools", {
      category: "JSON & Data",
      limit: 5,
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.totalMatches).toBeGreaterThan(0);
    expect(parsed.tools.length).toBeLessThanOrEqual(5);
    expect(parsed.tools[0].category).toBe("JSON & Data");
  });

  it("executes JSON Formatter via codestation_execute_tool", async () => {
    const result = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "json-formatter",
      input: '{"hello":"world","count":42}',
      options: { indent: 2 },
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe('{\n  "hello": "world",\n  "count": 42\n}');
  });

  it("executes Base64 encode and decode", async () => {
    const encoded = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "base64",
      input: "Antigravity WebMCP",
      options: { action: "encode" },
    });
    expect(encoded.isError).toBeFalsy();
    expect(encoded.content[0].text).toBe("QW50aWdyYXZpdHkgV2ViTUNQ");

    const decoded = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "base64",
      input: "QW50aWdyYXZpdHkgV2ViTUNQ",
      options: { action: "decode" },
    });
    expect(decoded.isError).toBeFalsy();
    expect(decoded.content[0].text).toBe("Antigravity WebMCP");
  });

  it("executes Text Case Converter", async () => {
    const result = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "case-converter",
      input: "hello world developer tools",
      options: { targetCase: "pascal" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe("HelloWorldDeveloperTools");
  });

  it("executes CIDR Subnet Calculator", async () => {
    const result = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "cidr-calculator",
      input: "192.168.1.0/24",
    });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.netmask).toBe("255.255.255.0");
    expect(parsed.broadcastAddress).toBe("192.168.1.255");
    expect(parsed.usableHosts).toBe(254);
  });

  it("executes Cron Explainer", async () => {
    const result = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "cron-explainer",
      input: "0 0 * * *",
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("00:00");
  });

  it("executes Developer Math Bitwise Calculator", async () => {
    const result = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "bitwise-calculator",
      input: "12",
      options: { b: 5, bitWidth: 32 },
    });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.and.dec).toBe(12 & 5);
    expect(parsed.or.dec).toBe(12 | 5);
    expect(parsed.xor.dec).toBe(12 ^ 5);
  });

  it("executes Compression tools via WebMCP", async () => {
    const compResult = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "gzip-compressor",
      input: "WebMCP compression testing text",
      options: { format: "gzip" },
    });
    expect(compResult.isError).toBeFalsy();
    const parsedComp = JSON.parse(compResult.content[0].text);
    expect(parsedComp.base64).toBeTruthy();
    expect(parsedComp.format).toBe("gzip");

    const decompResult = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "gzip-decompressor",
      input: parsedComp.base64,
      options: { format: "gzip" },
    });
    expect(decompResult.isError).toBeFalsy();
    expect(decompResult.content[0].text).toBe("WebMCP compression testing text");
  });

  it("registers an active tool dynamically and unregisters on cleanup", async () => {
    const tool = getTool("json-formatter")!;
    expect(tool).toBeDefined();

    const cleanup = registerActiveWebMcpTool(tool);
    const registered = getRegisteredWebMcpTools();
    const toolName = `codestation_${tool.slug.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    expect(registered.some((t) => t.name === toolName)).toBe(true);

    // Execute via direct dedicated tool name
    const execResult = await executeWebMcpTool(toolName, {
      input: '{"active":true}',
    });
    expect(execResult.isError).toBeFalsy();
    expect(execResult.content[0].text).toContain('"active": true');

    // Cleanup
    cleanup();
    const afterCleanup = getRegisteredWebMcpTools();
    expect(afterCleanup.some((t) => t.name === toolName)).toBe(false);
  });

  it("handles execution errors gracefully with error report", async () => {
    const result = await executeWebMcpTool("codestation_execute_tool", {
      toolId: "json-formatter",
      input: "invalid json string {",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Execution failed");
  });
});
