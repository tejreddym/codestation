import { describe, expect, it } from "vitest";
import {
  policyTools,
  policyToolIds,
  getPolicyDefinition,
  isPolicyToolId,
  type PolicyToolId,
} from "./policy-tools";

describe("Policy Generators Tools Registry", () => {
  it("defines exactly 5 Policy Generators tool ids", () => {
    expect(policyToolIds).toEqual([
      "privacy-policy-generator",
      "terms-and-conditions-generator",
      "cookie-policy-generator",
      "disclaimer-generator",
      "refund-policy-generator",
    ]);
    expect(policyTools).toHaveLength(5);
    expect(policyTools.map((t) => t.id)).toEqual(policyToolIds);
  });

  it("assigns category 'Policy Generators' and valid local contracts to all tools", () => {
    for (const tool of policyTools) {
      expect(tool.category).toBe("Policy Generators");
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
      expect(tool.localContract.action).toBe("Generate");
      expect(tool.localContract.purpose).toBeTruthy();
      expect(tool.localContract.usage).toBeTruthy();
    }
  });

  it("validates type guard isPolicyToolId", () => {
    for (const id of policyToolIds) {
      expect(isPolicyToolId(id)).toBe(true);
    }
    expect(isPolicyToolId("non-existent-tool")).toBe(false);
    expect(isPolicyToolId("")).toBe(false);
  });

  it("finds tool definitions via getPolicyDefinition", () => {
    for (const id of policyToolIds) {
      const def = getPolicyDefinition(id);
      expect(def).toBeDefined();
      expect(def?.id).toBe(id);
    }
    expect(getPolicyDefinition("unknown-id" as PolicyToolId)).toBeUndefined();
  });
});
