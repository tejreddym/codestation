import { describe, it, expect } from "vitest";
import { tools } from "@/config/tools";
import {
  adaptToolToEngine,
  getAllCanonicalTools,
  getCanonicalTool,
  resolveToolKey,
  MISMATCHED_SLUG_ID_MAP,
} from "@/lib/engine/adapters/registryAdapter";
import { serializeToolToWebMcp, serializeToolToLocalMcp } from "@/lib/engine/mcpBridge";
import { describeToolContract } from "@/lib/engine/__tests__/contractHarness";

describe("Registry Contract & Engine Unification (All 300+ Tools)", () => {
  it("contains 300+ registered tools in the central registry", () => {
    expect(tools.length).toBeGreaterThanOrEqual(300);
  });

  it("adapts every registered tool into a valid canonical ToolDefinition and ToolEngine", () => {
    const allTools = getAllCanonicalTools();
    expect(allTools.length).toBe(tools.length);

    for (const { definition, engine } of allTools) {
      expect(definition.id).toBeTruthy();
      expect(definition.name).toBeTruthy();
      expect(definition.category).toBeTruthy();
      expect(typeof definition.description).toBe("string");
      expect(["local", "network-opt-in"]).toContain(definition.processing);
      expect(typeof definition.offlineSupported).toBe("boolean");
      expect(Array.isArray(definition.input)).toBe(true);
      expect(Array.isArray(definition.output)).toBe(true);

      expect(typeof engine.validate).toBe("function");
      expect(typeof engine.process).toBe("function");
    }
  });

  it("resolves all legacy mismatched tools using dual-key mapping", () => {
    for (const [key, resolved] of Object.entries(MISMATCHED_SLUG_ID_MAP)) {
      expect(resolveToolKey(key)).toBe(resolved);
      const adapted = getCanonicalTool(key);
      expect(adapted).not.toBeNull();
      expect(adapted?.definition.id).toBe(resolved);
    }
  });

  it("serializes any canonical ToolDefinition into WebMCP and MCP descriptors", () => {
    const sample = tools[0];
    const { definition } = adaptToolToEngine(sample);
    const webMcp = serializeToolToWebMcp(definition);
    expect(webMcp.name.startsWith("codestation_")).toBe(true);
    expect(webMcp.inputSchema.type).toBe("object");

    const localMcp = serializeToolToLocalMcp(definition);
    expect(localMcp.id).toBe(definition.id);
    expect(localMcp.parameters.type).toBe("object");
  });
});

// Run contract suite against a representative sample of tools
const representativeTool = adaptToolToEngine(tools[0], (input) => String(input).toUpperCase());
describeToolContract(representativeTool.definition, representativeTool.engine, {
  testCases: [
    {
      name: "validates and uppercase transforms input",
      input: "hello world",
      expectedValid: true,
      expectedOutput: "HELLO WORLD",
    },
  ],
});
