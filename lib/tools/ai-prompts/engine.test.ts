import { describe, expect, it } from "vitest";
import {
  countTokens,
  tokenizeText,
  repairJson,
  extractTemplateVariables,
  interpolateString,
  interpolatePrompt,
  parseVectorInput,
  computeVectorSimilarity,
  buildSystemPrompt,
  MODEL_PRESETS,
  SYSTEM_PROMPT_PRESETS,
  type AiModelId,
} from "./engine";

describe("AI Token Counter & Estimator", () => {
  it("handles empty text gracefully", () => {
    const result = countTokens("");
    expect(result.tokenCount).toBe(0);
    expect(result.charCount).toBe(0);
    expect(result.wordCount).toBe(0);
    expect(result.lineCount).toBe(0);
    expect(result.fragments).toEqual([]);
    expect(result.estimatedInputCost).toBe(0);
  });

  it("preserves exact text verbatim across all token fragments", () => {
    const text = "Hello world! This is a test of Next.js 15 App Router & React 19.\n\nLet's test contractions: don't, it's, they'll, I'm, we've.\nSpecial characters: @#$%^&*()_+ and emojis: 🚀🌟💻";
    const models: AiModelId[] = ["gpt-4o", "claude-3-5", "gemini-1-5", "llama-3", "generic-bpe"];

    for (const model of models) {
      const fragments = tokenizeText(text, model);
      expect(fragments.length).toBeGreaterThan(10);
      const reconstructed = fragments.map((f) => f.text).join("");
      expect(reconstructed).toBe(text);

      // Verify offsets are contiguous
      for (let i = 0; i < fragments.length; i++) {
        expect(fragments[i].index).toBe(i);
        if (i > 0) {
          expect(fragments[i].charStart).toBe(fragments[i - 1].charEnd);
        }
      }
    }
  });

  it("calculates realistic token counts for standard English sentences", () => {
    const sentence = "The quick brown fox jumps over the lazy dog.";
    const result = countTokens(sentence, "gpt-4o");
    // Standard English sentence of 9 words should be approximately 9-11 tokens
    expect(result.tokenCount).toBeGreaterThanOrEqual(9);
    expect(result.tokenCount).toBeLessThanOrEqual(14);
    expect(result.wordCount).toBe(9);
    expect(result.charCount).toBe(sentence.length);
    expect(result.charsPerToken).toBeGreaterThan(2.5);
  });

  it("handles code snippets with multi-line indentation and punctuation", () => {
    const code = `function calculateSum(a: number, b: number): number {\n  const result = a + b;\n  return result;\n}`;
    const result = countTokens(code, "llama-3");
    expect(result.tokenCount).toBeGreaterThan(15);
    expect(result.lineCount).toBe(4);
    const joined = result.fragments.map((f) => f.text).join("");
    expect(joined).toBe(code);
  });

  it("computes cost estimates accurately based on model pricing per 1M tokens", () => {
    // 10,000 characters text ~ 2,500 tokens
    const sample = "OpenAI GPT-4o token cost test. ".repeat(100);
    const result = countTokens(sample, "gpt-4o");
    const preset = MODEL_PRESETS.find((p) => p.id === "gpt-4o")!;

    const expectedInputCost = parseFloat(((result.tokenCount / 1_000_000) * preset.defaultInputPer1M).toFixed(6));
    const expectedOutputCost = parseFloat(((result.tokenCount / 1_000_000) * preset.defaultOutputPer1M).toFixed(6));

    expect(result.estimatedInputCost).toBe(expectedInputCost);
    expect(result.estimatedOutputCost).toBe(expectedOutputCost);

    // Custom pricing override
    const custom = countTokens(sample, "gpt-4o", { inputPricePer1M: 5.0, outputPricePer1M: 20.0 });
    const expectedCustomInput = parseFloat(((result.tokenCount / 1_000_000) * 5.0).toFixed(6));
    expect(custom.estimatedInputCost).toBe(expectedCustomInput);
  });
});

describe("LLM JSON Repair Engine", () => {
  it("returns already valid JSON with clean formatting", () => {
    const valid = '{"name": "Alice", "role": "engineer", "active": true}';
    const result = repairJson(valid);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ name: "Alice", role: "engineer", active: true });
    expect(result.repairsApplied).toContain("Valid JSON (formatted cleanly)");
  });

  it("handles empty input", () => {
    const result = repairJson("");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("strips markdown code fences (```json ... ```)", () => {
    const fenced = "```json\n{\n  \"model\": \"gpt-4o\",\n  \"status\": \"ready\"\n}\n```";
    const result = repairJson(fenced);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ model: "gpt-4o", status: "ready" });
    expect(result.repairsApplied.some((r) => r.includes("code fences"))).toBe(true);
  });

  it("strips conversational preamble before JSON", () => {
    const conversational = "Here is the requested user profile data in JSON format:\n{\n  \"userId\": 1024,\n  \"username\": \"octocat\"\n}";
    const result = repairJson(conversational);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ userId: 1024, username: "octocat" });
    expect(result.repairsApplied.some((r) => r.includes("preamble"))).toBe(true);
  });

  it("removes single-line and multi-line comments", () => {
    const commented = `{\n  // User ID comment\n  "id": 1,\n  /* Multi-line\n     role description */\n  "role": "admin"\n}`;
    const result = repairJson(commented);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ id: 1, role: "admin" });
    expect(result.repairsApplied.some((r) => r.includes("comments"))).toBe(true);
  });

  it("converts Python literals (True, False, None)", () => {
    const pythonJson = '{"isAdmin": True, "isArchived": False, "metadata": None}';
    const result = repairJson(pythonJson);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ isAdmin: true, isArchived: false, metadata: null });
    expect(result.repairsApplied.some((r) => r.includes("Python/JS literals"))).toBe(true);
  });

  it("converts single quotes to valid double quotes", () => {
    const singleQuoted = "{'name': 'Bob', 'city': 'San Francisco'}";
    const result = repairJson(singleQuoted);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ name: "Bob", city: "San Francisco" });
  });

  it("quotes unquoted object keys", () => {
    const unquoted = '{ name: "Charlie", age: 30, department: "Dev" }';
    const result = repairJson(unquoted);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ name: "Charlie", age: 30, department: "Dev" });
    expect(result.repairsApplied.some((r) => r.includes("unquoted"))).toBe(true);
  });

  it("removes trailing commas in objects and arrays", () => {
    const trailing = '{"items": [1, 2, 3,], "active": true,}';
    const result = repairJson(trailing);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ items: [1, 2, 3], active: true });
    expect(result.repairsApplied.some((r) => r.includes("trailing commas"))).toBe(true);
  });

  it("balances truncated braces and brackets caused by LLM token limit cutoff", () => {
    const truncated = '{"company": "Acme", "employees": [{"name": "David", "title": "Lead"';
    const result = repairJson(truncated);
    expect(result.success).toBe(true);
    expect(result.parsed).toEqual({ company: "Acme", employees: [{ name: "David", title: "Lead" }] });
    expect(result.repairsApplied.some((r) => r.includes("Balanced truncated"))).toBe(true);
  });

  it("repairs complex compound malformed LLM outputs", () => {
    const complexMalformed = `\`\`\`json
Here is the result:
{
  // Configuration settings
  app_name: 'CodeStation',
  debug_mode: True,
  timeout: None,
  features: [
    'tokens',
    'json-repair',
    'vector-math',
  ],
`;
    const result = repairJson(complexMalformed);
    expect(result.success).toBe(true);
    expect(result.parsed).toMatchObject({
      app_name: "CodeStation",
      debug_mode: true,
      timeout: null,
      features: ["tokens", "json-repair", "vector-math"],
    });
  });
});

describe("Prompt Template Interpolator", () => {
  it("extracts unique variables from {{var}} and {var} syntaxes", () => {
    const template = "Hello {{userName}}, welcome to {platform}! Your balance is {{ balance }} {currency}.";
    const vars = extractTemplateVariables(template);
    expect(vars.sort()).toEqual(["balance", "currency", "platform", "userName"].sort());
  });

  it("interpolates a string with record dictionary", () => {
    const template = "Write a {{tone}} blog post about {topic}.";
    const record = { tone: "enthusiastic", topic: "Next.js 15" };
    const { result, missing } = interpolateString(template, record);
    expect(result).toBe("Write a enthusiastic blog post about Next.js 15.");
    expect(missing).toHaveLength(0);
  });

  it("reports missing variables when record is incomplete", () => {
    const template = "Hello {{firstName}} {{lastName}}, your code is {code}.";
    const record = { firstName: "Ada" };
    const { result, missing } = interpolateString(template, record);
    expect(result).toBe("Hello Ada {{lastName}}, your code is {code}.");
    expect(missing).toEqual(["lastName", "code"]);
  });

  it("processes multiple test records with System, User, and Assistant roles", () => {
    const systemTemplate = "You are a {{persona}} AI assistant.";
    const userTemplate = "Explain {concept} in {{length}} words.";
    const assistantTemplate = "Here is an explanation of {concept}:";

    const records = [
      { persona: "Senior Engineer", concept: "memoization", length: "50" },
      { persona: "Math Teacher", concept: "prime numbers", length: "100" },
    ];

    const result = interpolatePrompt({
      template: userTemplate,
      records,
      systemTemplate,
      assistantTemplate,
    });

    expect(result.variables.sort()).toEqual(["concept", "length", "persona"].sort());
    expect(result.results).toHaveLength(2);

    // Record 1
    const r1 = result.results[0];
    expect(r1.messages).toEqual([
      { role: "system", content: "You are a Senior Engineer AI assistant." },
      { role: "user", content: "Explain memoization in 50 words." },
      { role: "assistant", content: "Here is an explanation of memoization:" },
    ]);

    // Record 2
    const r2 = result.results[1];
    expect(r2.messages[0].content).toBe("You are a Math Teacher AI assistant.");
    expect(r2.messages[1].content).toBe("Explain prime numbers in 100 words.");

    // OpenAI format export parses as valid JSON array
    const parsedOpenAi = JSON.parse(result.openAiExport);
    expect(parsedOpenAi).toHaveLength(2);
    expect(parsedOpenAi[0][0].role).toBe("system");

    // Anthropic format export parses as valid JSON array
    const parsedAnthropic = JSON.parse(result.anthropicExport);
    expect(parsedAnthropic).toHaveLength(2);
    expect(parsedAnthropic[0].system).toBe("You are a Senior Engineer AI assistant.");
    expect(parsedAnthropic[0].messages).toHaveLength(2);

    // Markdown export contains headers
    expect(result.markdownExport).toContain("## Test Record 1");
    expect(result.markdownExport).toContain("## Test Record 2");
  });
});

describe("Vector Similarity & Distance Engine", () => {
  it("parses JSON array, comma-separated, and space-separated strings", () => {
    expect(parseVectorInput("[0.1, 0.2, 0.3]")).toEqual([0.1, 0.2, 0.3]);
    expect(parseVectorInput("0.1, 0.2, 0.3")).toEqual([0.1, 0.2, 0.3]);
    expect(parseVectorInput("1 2 3 4")).toEqual([1, 2, 3, 4]);
    expect(parseVectorInput("")).toEqual([]);
  });

  it("calculates exact metrics for identical vectors", () => {
    const vec = [1, 2, 3, 4, 5];
    const metrics = computeVectorSimilarity(vec, vec);
    expect(metrics.cosineSimilarity).toBe(1.0);
    expect(metrics.similarityPercentage).toBe(100.0);
    expect(metrics.euclideanDistance).toBe(0.0);
    expect(metrics.manhattanDistance).toBe(0.0);
    expect(metrics.chebyshevDistance).toBe(0.0);
    expect(metrics.angleDegrees).toBe(0.0);
    expect(metrics.dotProduct).toBe(55); // 1 + 4 + 9 + 16 + 25 = 55
  });

  it("calculates exact metrics for orthogonal vectors", () => {
    const vecA = [1, 0, 0];
    const vecB = [0, 1, 0];
    const metrics = computeVectorSimilarity(vecA, vecB);
    expect(metrics.dotProduct).toBe(0.0);
    expect(metrics.cosineSimilarity).toBe(0.0);
    expect(metrics.similarityPercentage).toBe(50.0);
    expect(metrics.angleDegrees).toBe(90.0);
    expect(metrics.euclideanDistance).toBeCloseTo(Math.SQRT2, 5);
  });

  it("calculates exact metrics for opposite vectors", () => {
    const vecA = [1, 2, 3];
    const vecB = [-1, -2, -3];
    const metrics = computeVectorSimilarity(vecA, vecB);
    expect(metrics.cosineSimilarity).toBe(-1.0);
    expect(metrics.similarityPercentage).toBe(0.0);
    expect(metrics.angleDegrees).toBe(180.0);
  });

  it("throws descriptive error on dimension mismatch", () => {
    expect(() => computeVectorSimilarity([1, 2, 3], [1, 2])).toThrowError(
      /Dimension mismatch: Vector A has 3 dimensions, but Vector B has 2 dimensions/
    );
  });

  it("throws error on empty vectors", () => {
    expect(() => computeVectorSimilarity([], [])).toThrowError(/Vectors cannot be empty/);
  });

  it("computes dimensional contribution breakdown and top dimensions", () => {
    const vecA = [10, -5, 2, 0];
    const vecB = [5, 4, 2, 0];
    const metrics = computeVectorSimilarity(vecA, vecB);

    expect(metrics.dimensions).toBe(4);
    expect(metrics.dimensionBreakdown).toHaveLength(4);

    // Dimension 0: 10 * 5 = 50 (positive)
    // Dimension 1: -5 * 4 = -20 (negative)
    // Dimension 2: 2 * 2 = 4 (positive)
    // Dimension 3: 0 * 0 = 0 (zero)
    expect(metrics.topPositiveDimensions[0].index).toBe(0);
    expect(metrics.topPositiveDimensions[0].product).toBe(50);
    expect(metrics.topNegativeDimensions[0].index).toBe(1);
    expect(metrics.topNegativeDimensions[0].product).toBe(-20);

    expect(metrics.sparsityA).toBe(25.0); // 1 zero out of 4
    expect(metrics.sparsityB).toBe(25.0);
  });
});

describe("System Prompt Pattern Builder", () => {
  it("assembles structured prompt with Anthropic XML tags", () => {
    const result = buildSystemPrompt({
      roleName: "Code Reviewer",
      roleTone: "Strict & Analytical",
      background: "Expert in security and performance.",
      coreTask: "Review incoming PRs for security vulnerabilities.",
      xmlWrapping: true,
      chainOfThought: true,
      guardrails: ["Never approve code with SQL injection."],
      customConstraints: ["Flag any unvalidated user input."],
      examples: [
        {
          id: "ex1",
          input: "SELECT * FROM users WHERE id = " + "1",
          reasoning: "Dynamic query parameter concatenation.",
          output: "Vulnerable to SQL injection. Use parameterized query.",
        },
      ],
      outputFormat: "json",
      customFormatSchema: '{"status": "APPROVED" | "CHANGES_REQUESTED"}',
    });

    expect(result.assembledPrompt).toContain("<role>");
    expect(result.assembledPrompt).toContain("You are Code Reviewer.");
    expect(result.assembledPrompt).toContain("<instructions>");
    expect(result.assembledPrompt).toContain("<scratchpad_instructions>");
    expect(result.assembledPrompt).toContain("<guardrails>");
    expect(result.assembledPrompt).toContain("- Never approve code with SQL injection.");
    expect(result.assembledPrompt).toContain("- Flag any unvalidated user input.");
    expect(result.assembledPrompt).toContain("<examples>");
    expect(result.assembledPrompt).toContain("<output_format>");
    expect(result.tokenCount).toBeGreaterThan(50);
    expect(result.sectionsCount).toBe(6);
  });

  it("assembles structured prompt with Markdown headers when XML wrapping is disabled", () => {
    const result = buildSystemPrompt({
      roleName: "Technical Educator",
      roleTone: "Warm & Socratic",
      coreTask: "Teach binary search algorithms.",
      xmlWrapping: false,
      chainOfThought: false,
      guardrails: ["Do not give the full solution immediately."],
      outputFormat: "markdown",
    });

    expect(result.assembledPrompt).toContain("# Role & Persona");
    expect(result.assembledPrompt).toContain("# Core Mission");
    expect(result.assembledPrompt).toContain("# Guardrails & Constraints");
    expect(result.assembledPrompt).toContain("# Output Format");
    expect(result.assembledPrompt).not.toContain("<role>");
    expect(result.tokenCount).toBeGreaterThan(20);
  });

  it("loads and validates built-in system prompt presets", () => {
    expect(SYSTEM_PROMPT_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of SYSTEM_PROMPT_PRESETS) {
      const result = buildSystemPrompt(preset.config);
      expect(result.assembledPrompt.length).toBeGreaterThan(100);
      expect(result.tokenCount).toBeGreaterThan(30);
    }
  });
});
