import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const aiPromptsToolIds = [
  "ai-token-counter",
  "json-repair",
  "prompt-interpolator",
  "vector-similarity",
  "system-prompt-builder",
] as const;

export type AiPromptsToolId = (typeof aiPromptsToolIds)[number];

const notice =
  "100% in-browser AI & prompt processing. Token estimation, JSON repair, vector metrics, and prompt construction run entirely in client memory with zero server uploads or external LLM API calls.";

const define = (
  id: AiPromptsToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = [],
  pairedTool?: AiPromptsToolId
): LocalDefinition<AiPromptsToolId> =>
  localDefinition(
    id,
    title,
    "AI & Prompt Engineering",
    fields,
    outputs,
    defaults,
    [notice, ...extra],
    "Execute",
    pairedTool
  );

export const aiPromptsTools: readonly LocalDefinition<AiPromptsToolId>[] = [
  define(
    "ai-token-counter",
    "AI Token Counter & Visualizer",
    [
      {
        name: "text",
        label: "Text or prompt to tokenize",
        control: "textarea",
      },
      {
        name: "model",
        label: "Target Model Family",
        control: "select",
        options: [
          "GPT-4o (o200k)",
          "Claude 3.5 Sonnet / 4",
          "Gemini 1.5 / 2.0",
          "Llama 3 / 3.3",
          "Generic BPE",
        ],
      },
      {
        name: "inputPrice",
        label: "Input Price ($/1M tokens)",
        control: "number",
        min: 0,
        optional: true,
      },
      {
        name: "outputPrice",
        label: "Output Price ($/1M tokens)",
        control: "number",
        min: 0,
        optional: true,
      },
    ],
    [
      "Total token count",
      "Visual token boundaries",
      "Estimated API cost",
      "Character & word statistics",
    ],
    {
      model: "GPT-4o (o200k)",
      inputPrice: 2.5,
      outputPrice: 10.0,
    },
    [
      "Inspect multi-model token counts across GPT-4o, Claude 3.5, Gemini 1.5, Llama 3, and generic BPE with visual token boundaries and cost estimation per 1M tokens.",
    ],
    "system-prompt-builder"
  ),
  define(
    "json-repair",
    "LLM JSON Repair & Validator",
    [
      {
        name: "input",
        label: "Malformed LLM JSON text",
        control: "textarea",
      },
      {
        name: "indent",
        label: "Output Indentation",
        control: "select",
        options: ["2 spaces", "4 spaces", "compact"],
      },
    ],
    [
      "Repaired valid JSON",
      "Side-by-side diff view",
      "Applied syntax repairs summary",
      "RFC-8259 validation status",
    ],
    {
      indent: "2 spaces",
    },
    [
      "Repair malformed LLM outputs: strips markdown fences, fixes Python literals (True/False/None), strips comments, quotes unquoted keys, removes trailing commas, and balances truncated braces/brackets.",
    ],
    "prompt-interpolator"
  ),
  define(
    "prompt-interpolator",
    "Prompt Template Interpolator",
    [
      {
        name: "template",
        label: "Prompt template with {{variable}} or {variable}",
        control: "textarea",
      },
      {
        name: "records",
        label: "Test records dataset (JSON array)",
        control: "textarea",
      },
      {
        name: "format",
        label: "Export Format",
        control: "select",
        options: ["Preview", "OpenAI Chat API", "Anthropic Messages API", "Markdown Transcript"],
      },
    ],
    [
      "Interpolated prompt",
      "Role-formatted messages (System, User, Assistant)",
      "Batch dataset preview",
      "OpenAI & Anthropic JSON export",
    ],
    {
      format: "Preview",
    },
    [
      "Interpolate Mustache {{var}} and {var} templates across multiple test records. Formats System, User, and Assistant roles with OpenAI and Anthropic JSON export.",
    ],
    "system-prompt-builder"
  ),
  define(
    "vector-similarity",
    "Vector Similarity & Distance Calculator",
    [
      {
        name: "vectorA",
        label: "Vector A (JSON array, comma or space-separated numbers)",
        control: "textarea",
      },
      {
        name: "vectorB",
        label: "Vector B (JSON array, comma or space-separated numbers)",
        control: "textarea",
      },
      {
        name: "metric",
        label: "Primary Metric",
        control: "select",
        options: ["Cosine Similarity", "Euclidean Distance", "Dot Product", "Manhattan Distance"],
      },
    ],
    [
      "Cosine similarity & percentage match",
      "Euclidean distance (L2)",
      "Dot product",
      "Manhattan distance (L1)",
      "Dimensional contribution breakdown",
    ],
    {
      metric: "Cosine Similarity",
    },
    [
      "Compare embedding vectors using Cosine similarity, Euclidean distance, Dot product, Manhattan distance, angles, and dimensional contribution breakdown.",
    ]
  ),
  define(
    "system-prompt-builder",
    "System Prompt Pattern Builder",
    [
      {
        name: "role",
        label: "Agent Role & Persona",
        control: "text",
      },
      {
        name: "task",
        label: "Core Task & Instructions",
        control: "textarea",
      },
      {
        name: "tone",
        label: "Tone & Style",
        control: "select",
        options: [
          "Senior Technical & Direct",
          "Concise & Minimal",
          "Socratic & Inquisitive",
          "Strict & Analytical",
          "Warm & Encouraging",
        ],
      },
      {
        name: "xmlWrapping",
        label: "XML Tag Wrapping",
        control: "select",
        options: ["Enabled (<tag>...</tag>)", "Disabled (Markdown headers)"],
      },
    ],
    [
      "Assembled system prompt",
      "Live token & character counters",
      "Role guardrails & constraints",
      "Copy & download export",
    ],
    {
      tone: "Senior Technical & Direct",
      xmlWrapping: "Enabled (<tag>...</tag>)",
    },
    [
      "Build production-grade system prompts with Anthropic XML tags, negative constraint guardrails, chain-of-thought scratchpad instructions, few-shot examples, and live token estimation.",
    ],
    "ai-token-counter"
  ),
];

export const getAiPromptsDefinition = (id: string): LocalDefinition<AiPromptsToolId> | undefined =>
  aiPromptsTools.find((tool) => tool.id === id);

export const isAiPromptsToolId = (id: string): id is AiPromptsToolId =>
  (aiPromptsToolIds as readonly string[]).includes(id);
