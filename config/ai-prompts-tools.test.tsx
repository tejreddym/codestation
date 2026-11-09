import { describe, expect, it } from "vitest";
import {
  aiPromptsTools,
  aiPromptsToolIds,
  getAiPromptsDefinition,
  isAiPromptsToolId,
  type AiPromptsToolId,
} from "./ai-prompts-tools";

describe("AI & Prompt Engineering Tools Registry", () => {
  it("defines exactly 5 AI & Prompt Engineering tool ids", () => {
    expect(aiPromptsToolIds).toEqual([
      "ai-token-counter",
      "json-repair",
      "prompt-interpolator",
      "vector-similarity",
      "system-prompt-builder",
    ]);
    expect(aiPromptsTools).toHaveLength(5);
    expect(aiPromptsTools.map((t) => t.id)).toEqual(aiPromptsToolIds);
  });

  it("assigns category 'AI & Prompt Engineering' and valid local contracts to all tools", () => {
    for (const tool of aiPromptsTools) {
      expect(tool.category).toBe("AI & Prompt Engineering");
      expect(tool.slug).toBe(tool.id);
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.keywords.length).toBeGreaterThan(0);
      expect(tool.inputType).toBeTruthy();
      expect(tool.outputType).toBeTruthy();
      expect(tool.seo.title).toContain(tool.name);
      expect(tool.seo.description).toBeTruthy();

      // Local contract validation
      expect(tool.localContract).toBeDefined();
      expect(tool.localContract.fields.length).toBeGreaterThan(0);
      expect(tool.localContract.outputs.length).toBeGreaterThan(0);
      expect(tool.localContract.notices.length).toBeGreaterThan(0);
      expect(tool.localContract.action).toBe("Execute");
      expect(tool.localContract.purpose).toBeTruthy();
      expect(tool.localContract.usage).toBeTruthy();
    }
  });

  it("validates type guard isAiPromptsToolId", () => {
    for (const id of aiPromptsToolIds) {
      expect(isAiPromptsToolId(id)).toBe(true);
    }
    expect(isAiPromptsToolId("non-existent-tool")).toBe(false);
    expect(isAiPromptsToolId("")).toBe(false);
  });

  it("finds tool definitions via getAiPromptsDefinition", () => {
    for (const id of aiPromptsToolIds) {
      const def = getAiPromptsDefinition(id);
      expect(def).toBeDefined();
      expect(def?.id).toBe(id);
    }
    expect(getAiPromptsDefinition("unknown-id" as AiPromptsToolId)).toBeUndefined();
  });

  it("verifies paired tools exist in the tool registry if defined", () => {
    for (const tool of aiPromptsTools) {
      if (tool.pairedTool) {
        expect(isAiPromptsToolId(tool.pairedTool)).toBe(true);
      }
    }
  });
});
