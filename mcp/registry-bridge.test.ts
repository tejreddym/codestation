// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  tools,
  NODE_FILE_TOOL_IDS,
  BROWSER_ONLY_TOOL_IDS,
} from "../config/tools";
import {
  describeBridgeTool,
  executeBridgeTool,
  executeNodePureTool,
  getAllBridgeTools,
  getExposedStationTools,
  getNodePureToolCount,
  getNodePureTools,
  getRuntimeCompatibilityManifest,
  getToolSampleArgs,
  getWiredNodeFileTools,
  listBridgeTools,
} from "./registry-bridge";
import { VIRTUAL_NODE_FILE_DESCRIPTORS } from "./file-tools";
import { resolveLicense } from "./config";

describe("MCP Registry Bridge — Pure Node Execution & Runtime Classification", () => {
  it("runs inside a pure Node environment without browser DOM globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("classifies every single registered tool cleanly with zero overlap", () => {
    const toolIds = new Set<string>(tools.map((t) => t.id));
    for (const id of NODE_FILE_TOOL_IDS) {
      expect(toolIds.has(id), `NODE_FILE_TOOL_IDS contains unknown tool id: ${id}`).toBe(true);
      expect(BROWSER_ONLY_TOOL_IDS.has(id), `Tool ${id} cannot be in both node-file and browser-only`).toBe(false);
    }
    for (const id of BROWSER_ONLY_TOOL_IDS) {
      expect(toolIds.has(id), `BROWSER_ONLY_TOOL_IDS contains unknown tool id: ${id}`).toBe(true);
    }

    const summary = listBridgeTools({ limit: 150 });
    const { countsByRuntime, totalRegistered } = summary;
    console.info(
      `[MCP Bridge] Registered: ${totalRegistered} | node-pure: ${countsByRuntime["node-pure"]} | node-file: ${countsByRuntime["node-file"]} | browser-only: ${countsByRuntime["browser-only"]}`
    );

    const manifest = getRuntimeCompatibilityManifest();
    expect(Object.keys(manifest)).toHaveLength(totalRegistered);
    expect(totalRegistered).toBe(tools.length + VIRTUAL_NODE_FILE_DESCRIPTORS.length);
    expect(
      countsByRuntime["node-pure"] +
        countsByRuntime["node-file"] +
        countsByRuntime["browser-only"]
    ).toBe(totalRegistered);
    expect(countsByRuntime["node-pure"]).toBe(getNodePureToolCount());
    expect(countsByRuntime["node-pure"]).toBeGreaterThanOrEqual(250);
    expect(countsByRuntime["node-file"]).toBe(
      NODE_FILE_TOOL_IDS.size + VIRTUAL_NODE_FILE_DESCRIPTORS.length
    );
    expect(countsByRuntime["browser-only"]).toBe(BROWSER_ONLY_TOOL_IDS.size);
    expect(getWiredNodeFileTools().length).toBeGreaterThanOrEqual(25);
  });

  it("executes EVERY node-pure tool in Node without DOM/window reference errors", async () => {
    const pureTools = getNodePureTools();
    expect(pureTools.length).toBeGreaterThanOrEqual(250);

    const byId = new Map<string, (typeof tools)[number]>(tools.map((t) => [t.id, t]));
    const failures: Array<{ slug: string; category: string; error: string }> = [];

    for (const meta of pureTools) {
      const def = byId.get(meta.id)!;
      const sample = getToolSampleArgs(def);
      try {
        const output = await executeNodePureTool(def.slug, sample.input ?? "", sample.options ?? {});
        if (typeof output !== "string" || output.length === 0) {
          failures.push({
            slug: def.slug,
            category: def.category,
            error: `Expected non-empty string output, got ${typeof output}`,
          });
        }
      } catch (err) {
        failures.push({
          slug: def.slug,
          category: def.category,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    expect(failures, `Failed node-pure tools:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  }, 60_000);

  it("rejects unwired node-file and browser-only tools gracefully without throwing ReferenceError", async () => {
    const pro = resolveLicense("CS-PRO-TEST-KEY");
    const fileRes = await executeBridgeTool("pdf-to-images", {}, pro);
    expect(fileRes.isError).toBe(true);
    expect(fileRes.content[0].text).toContain("node-file");

    const browserRes = await executeBridgeTool("audio-trimmer", {}, pro);
    expect(browserRes.isError).toBe(true);
    expect(browserRes.content[0].text).toContain("browser-only");
  });

  it("exposes structured schemas and runnable examples for every registered tool", () => {
    const all = getAllBridgeTools();
    expect(all.length).toBe(tools.length + VIRTUAL_NODE_FILE_DESCRIPTORS.length);
    for (const slug of [
      "cidr-calculator",
      "json-to-go",
      "conventional-commit-builder",
      "emi-calculator",
      "ai-token-counter",
      "pdf-merge",
      "pdf-inspect",
      "xlsx-to-json",
      "zip-create",
      "image-inspect",
    ]) {
      const desc = describeBridgeTool(slug);
      expect(desc).not.toBeNull();
      expect(desc?.examples.length).toBeGreaterThan(0);
      expect(desc?.inputSchema).toHaveProperty("properties");
    }

    const sqlExposed = getExposedStationTools(["sql-database"]);
    expect(sqlExposed.some((t) => t.name === "codestation_sql_formatter")).toBe(true);
    expect(sqlExposed.some((t) => t.name === "codestation_er_diagram_generator")).toBe(true);
  });
});
