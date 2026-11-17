import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tools } from "@/config/tools";
import { getStation, getStationByName, stations } from "@/config/stations";
import {
  adaptToolToEngine,
  getAllCanonicalTools,
  getCanonicalTool,
  resolveToolKey,
  MISMATCHED_SLUG_ID_MAP,
} from "@/lib/engine/adapters/registryAdapter";
import { serializeToolToWebMcp, serializeToolToLocalMcp } from "@/lib/engine/mcpBridge";
import { describeToolContract } from "@/lib/engine/__tests__/contractHarness";

describe("Registry Contract & Engine Unification (All 380 Tools)", () => {
  it("contains the full 380-tool registry", () => {
    expect(tools).toHaveLength(380);
    expect(stations).toHaveLength(30);
  });

  it("keeps every registered slug unique", () => {
    const slugs = tools.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("exposes the Git & Version Control station with seven owned tools plus gitignore-generator", () => {
    const git = getStation("git");
    expect(git?.name).toBe("Git & Version Control");
    expect(git?.route).toBe("/stations/git");
    expect(git?.toolCount).toBe(8);
    expect(git?.relatedStations).toEqual(["code-generation", "network-devops", "api", "text"]);
    expect(git?.toolList).toEqual(
      expect.arrayContaining([
        "conventional-commit-builder",
        "conventional-commit-validator",
        "git-command-explainer",
        "changelog-generator",
        "gitattributes-generator",
        "git-hooks-generator",
        "conflict-parse",
        "gitignore-generator",
      ])
    );

    for (const id of git?.toolList ?? []) {
      expect(tools.some((tool) => tool.id === id)).toBe(true);
    }
  });

  it("resolves every tool category to an implemented station, so no tool page needs a fallback", () => {
    expect(stations).toHaveLength(30);
    for (const tool of tools) {
      const station = getStationByName(tool.category);
      expect(station, `${tool.id} (${tool.category})`).toBeTruthy();
      expect(station?.route).toBe(`/stations/${station?.id}`);
      expect(station?.toolList).toContain(tool.id);
    }
    for (const station of stations) expect(station.toolCount).toBe(station.toolList.length);
    expect(getStationByName("Developer Tools")).toBeUndefined();
    const routeSource = readFileSync("app/tools/[slug]/page.tsx", "utf8");
    expect(routeSource).not.toMatch(/\?\?\s*["']\/stations\/image/);
    expect(routeSource).toContain("getStationByName(tool.category)?.route");
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
