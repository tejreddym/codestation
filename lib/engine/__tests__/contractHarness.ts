/**
 * Code Station — Universal Tool Contract Testing Harness
 *
 * Provides describeToolContract() to enforce strict contract compliance across
 * all 300+ tools in the registry.
 */

import { describe, it, expect } from "vitest";
import type {
  ToolDefinition,
  ToolEngine,
  ToolContext,
} from "../types";
import { executeTool } from "../runtime";

export interface ToolContractTestCase<TInput = unknown, TOutput = unknown> {
  name: string;
  input: TInput;
  expectedValid?: boolean;
  expectedOutput?: TOutput;
  assertResult?: (result: TOutput) => void;
}

export interface ToolContractOptions<TInput = unknown, TOutput = unknown> {
  testCases?: ToolContractTestCase<TInput, TOutput>[];
  skipCancelTest?: boolean;
  skipDisposeTest?: boolean;
}

/**
 * Executes a standardized contract validation suite for any ToolDefinition and ToolEngine pair.
 */
export function describeToolContract<TInput = unknown, TOutput = unknown>(
  definition: ToolDefinition,
  engine: ToolEngine<TInput, TOutput>,
  options: ToolContractOptions<TInput, TOutput> = {}
) {
  describe(`Contract Suite: ${definition.name} (${definition.id})`, () => {
    describe("Metadata & Schema Compliance", () => {
      it("defines canonical identity fields (id, name, category, description)", () => {
        expect(definition.id).toBeTruthy();
        expect(typeof definition.id).toBe("string");
        expect(definition.name).toBeTruthy();
        expect(typeof definition.name).toBe("string");
        expect(definition.category).toBeTruthy();
        expect(typeof definition.category).toBe("string");
        expect(typeof definition.description).toBe("string");
      });

      it("declares valid processing model and offline readiness", () => {
        expect(["local", "network-opt-in"]).toContain(definition.processing);
        expect(typeof definition.offlineSupported).toBe("boolean");
      });

      it("provides strongly typed input and output arrays", () => {
        expect(Array.isArray(definition.input)).toBe(true);
        expect(Array.isArray(definition.output)).toBe(true);
      });
    });

    describe("Engine Lifecycle Compliance", () => {
      it("implements synchronous or asynchronous validate() returning ValidationResult", async () => {
        expect(typeof engine.validate).toBe("function");
        const dummyInput = definition.input[0]?.control === "text" ? "" : {};
        const validation = await Promise.resolve(engine.validate(dummyInput));
        expect(typeof validation.valid).toBe("boolean");
      });

      it("implements process() returning ToolResult with durationMs", async () => {
        expect(typeof engine.process).toBe("function");
        const sampleInput =
          options.testCases?.[0]?.input !== undefined
            ? options.testCases[0].input
            : definition.input[0]?.control === "text"
            ? "test-input"
            : {};

        const result = await executeTool(definition, engine, sampleInput as TInput);
        expect(result).toBeDefined();
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      if (engine.cancel && !options.skipCancelTest) {
        it("supports safe cancellation when cancel() is defined", () => {
          expect(() => engine.cancel?.()).not.toThrow();
        });
      }

      if (engine.dispose && !options.skipDisposeTest) {
        it("supports safe teardown when dispose() is defined", () => {
          expect(() => engine.dispose?.()).not.toThrow();
        });
      }
    });

    if (options.testCases && options.testCases.length > 0) {
      const cases = options.testCases;
      describe("Functional Test Cases", () => {
        for (const tc of cases) {
          it(`passes test case: ${tc.name}`, async () => {
            const validation = await Promise.resolve(engine.validate(tc.input));
            if (tc.expectedValid !== undefined) {
              expect(validation.valid).toBe(tc.expectedValid);
            }

            if (validation.valid) {
              const res = await executeTool(definition, engine, tc.input);
              if (tc.expectedOutput !== undefined) {
                expect(res.data).toEqual(tc.expectedOutput);
              }
              if (tc.assertResult) {
                tc.assertResult(res.data as TOutput);
              }
            }
          });
        }
      });
    }
  });
}
