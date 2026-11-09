import { conversionCapabilities } from '@/config/conversion-capabilities';
import { getTool } from '@/config/tools';

export type DataType =
  | 'json'
  | 'json-array'
  | 'csv'
  | 'tsv'
  | 'yaml'
  | 'xml'
  | 'toml'
  | 'markdown'
  | 'html'
  | 'text'
  | 'base64'
  | 'hex'
  | 'binary'
  | 'url-encoded'
  | 'typescript'
  | 'sql'
  | 'any';

export type RecipeSource =
  | 'json'
  | 'json-array'
  | 'csv'
  | 'tsv'
  | 'yaml'
  | 'xml'
  | 'toml'
  | 'markdown'
  | 'html'
  | 'text';

export type Recipe = {
  version: 1 | 2;
  source: RecipeSource;
  steps: string[];
  name?: string;
  id?: string;
  description?: string;
  createdAt?: string;
};

export type CompatibilityResult = {
  compatible: boolean;
  score?: number;
  reason?: string;
  notes?: string;
};

export type WorkflowStepDefinition = {
  slug: string;
  name: string;
  source: DataType | string;
  target: DataType | string;
  category: 'JSON & Data' | 'Text' | 'Encoding' | 'Markdown' | 'Code';
  description?: string;
};

const registeredConverters = new Set([
  'csv-to-json',
  'json-to-csv',
  'json-to-yaml',
  'yaml-to-json',
  'json-to-xml',
  'xml-to-json',
  'json-to-toml',
  'toml-to-json',
]);

export const workflowSteps: WorkflowStepDefinition[] = [
  // 1. JSON & Data conversion steps from conversionCapabilities
  ...conversionCapabilities
    .filter(c => c.family === 'json-data' && registeredConverters.has(c.route.replace('/tools/', '')))
    .map(c => {
      const slug = c.route.replace('/tools/', '');
      const tool = getTool(slug);
      return {
        slug,
        name: tool?.name ?? slug,
        source: c.source as DataType,
        target: c.target as DataType,
        category: 'JSON & Data' as const,
        description: tool?.description,
      };
    }),

  // 2. JSON In-place and formatting tools
  { slug: 'json-formatter', name: 'JSON Formatter', source: 'json', target: 'same', category: 'JSON & Data' },
  { slug: 'json-minifier', name: 'JSON Minifier', source: 'json', target: 'same', category: 'JSON & Data' },
  { slug: 'json-key-sorter', name: 'JSON Key Sorter', source: 'json', target: 'same', category: 'JSON & Data' },
  { slug: 'json-validator', name: 'JSON Validator', source: 'json', target: 'text', category: 'JSON & Data' },

  // 3. Code generation tools
  { slug: 'json-to-typescript', name: 'JSON to TypeScript', source: 'json', target: 'typescript', category: 'Code' },
  { slug: 'json-to-zod', name: 'JSON to Zod Schema', source: 'json', target: 'typescript', category: 'Code' },

  // 4. Text manipulation tools
  { slug: 'case-converter', name: 'Case Converter', source: 'text', target: 'same', category: 'Text' },
  { slug: 'slug-generator', name: 'Slug Generator', source: 'text', target: 'same', category: 'Text' },
  { slug: 'line-deduplicator', name: 'Line Deduplicator', source: 'text', target: 'same', category: 'Text' },
  { slug: 'duplicate-line-remover', name: 'Duplicate Line Remover', source: 'text', target: 'same', category: 'Text' },
  { slug: 'sort-lines', name: 'Sort Lines', source: 'text', target: 'same', category: 'Text' },
  { slug: 'reverse-lines', name: 'Reverse Lines', source: 'text', target: 'same', category: 'Text' },
  { slug: 'reverse-text', name: 'Reverse Text', source: 'text', target: 'same', category: 'Text' },
  { slug: 'whitespace-cleaner', name: 'Whitespace Cleaner', source: 'text', target: 'same', category: 'Text' },
  { slug: 'empty-line-remover', name: 'Empty Line Remover', source: 'text', target: 'same', category: 'Text' },
  { slug: 'tabs-to-spaces', name: 'Tabs to Spaces', source: 'text', target: 'same', category: 'Text' },
  { slug: 'spaces-to-tabs', name: 'Spaces to Tabs', source: 'text', target: 'same', category: 'Text' },
  { slug: 'text-counter', name: 'Text Counter', source: 'text', target: 'json', category: 'Text' },

  // 5. Encoding tools
  { slug: 'base64-encoder', name: 'Base64 Encoder', source: 'text', target: 'base64', category: 'Encoding' },
  { slug: 'base64-decoder', name: 'Base64 Decoder', source: 'base64', target: 'text', category: 'Encoding' },
  { slug: 'url-encoder', name: 'URL Encoder', source: 'text', target: 'url-encoded', category: 'Encoding' },
  { slug: 'url-decoder', name: 'URL Decoder', source: 'url-encoded', target: 'text', category: 'Encoding' },
  { slug: 'url-component-encoder', name: 'URL Component Encoder', source: 'text', target: 'url-encoded', category: 'Encoding' },
  { slug: 'url-component-decoder', name: 'URL Component Decoder', source: 'url-encoded', target: 'text', category: 'Encoding' },
  { slug: 'html-entity-encoder', name: 'HTML Entity Encoder', source: 'text', target: 'html', category: 'Encoding' },
  { slug: 'html-entity-decoder', name: 'HTML Entity Decoder', source: 'html', target: 'text', category: 'Encoding' },
  { slug: 'hexadecimal-encoder', name: 'Hexadecimal Encoder', source: 'text', target: 'hex', category: 'Encoding' },
  { slug: 'hexadecimal-decoder', name: 'Hexadecimal Decoder', source: 'hex', target: 'text', category: 'Encoding' },
  { slug: 'text-to-hex', name: 'Text to Hex', source: 'text', target: 'hex', category: 'Encoding' },
  { slug: 'hex-to-text', name: 'Hex to Text', source: 'hex', target: 'text', category: 'Encoding' },
  { slug: 'binary-encoder', name: 'Binary Encoder', source: 'text', target: 'binary', category: 'Encoding' },
  { slug: 'binary-decoder', name: 'Binary Decoder', source: 'binary', target: 'text', category: 'Encoding' },

  // 6. Markdown tools
  { slug: 'markdown-to-html', name: 'Markdown to HTML', source: 'markdown', target: 'html', category: 'Markdown' },
  { slug: 'html-to-markdown', name: 'HTML to Markdown', source: 'html', target: 'markdown', category: 'Markdown' },
  { slug: 'markdown-formatter', name: 'Markdown Formatter', source: 'markdown', target: 'same', category: 'Markdown' },
  { slug: 'markdown-to-text', name: 'Markdown to Plain Text', source: 'markdown', target: 'text', category: 'Markdown' },
  { slug: 'csv-to-markdown-table', name: 'CSV to Markdown Table', source: 'csv', target: 'markdown', category: 'Markdown' },
  { slug: 'markdown-escape', name: 'Markdown Escaper', source: 'text', target: 'markdown', category: 'Markdown' },
];

/**
 * Checks compatibility between the output type of a previous step and the expected input type of the next step.
 */
export function checkStepCompatibility(
  prevOutput: DataType | string,
  nextInput: DataType | string
): CompatibilityResult {
  if (prevOutput === nextInput || nextInput === 'any' || nextInput === 'text') {
    return { compatible: true, score: 100 };
  }

  // JSON subtype rules: json-array is a valid json
  if (prevOutput === 'json-array' && nextInput === 'json') {
    return { compatible: true, score: 100, notes: 'JSON array is valid JSON' };
  }

  // json-array is compatible with csv input (e.g. for tabular conversion)
  if (prevOutput === 'json-array' && nextInput === 'csv') {
    return { compatible: true, score: 95, notes: 'JSON array can be formatted to CSV' };
  }

  // A generic JSON input might contain an array, so it is conditionally compatible with json-array
  if (prevOutput === 'json' && nextInput === 'json-array') {
    return { compatible: true, score: 85, notes: 'Requires top-level JSON array' };
  }

  // Markdown and text are cross-compatible
  if ((prevOutput === 'markdown' || prevOutput === 'text') && (nextInput === 'markdown' || nextInput === 'text')) {
    return { compatible: true, score: 95 };
  }

  // Base64, hex, binary, url-encoded, and html are string types that can be accepted where string text is expected
  const stringRepresentations = new Set(['base64', 'hex', 'binary', 'url-encoded', 'html', 'sql', 'typescript']);
  if (stringRepresentations.has(prevOutput) && nextInput === 'text') {
    return { compatible: true, score: 100 };
  }

  return {
    compatible: false,
    score: 0,
    reason: `Incompatible transition: cannot pass ${prevOutput} output into a step expecting ${nextInput}.`,
  };
}

export const validateStepCompatibility = checkStepCompatibility;

/**
 * Calculates the final output format of a recipe, throwing an Error if any step is incompatible or unknown.
 */
export function outputFormat(recipe: Recipe): string {
  let format: string = recipe.source;
  for (const slug of recipe.steps) {
    const step = workflowSteps.find(s => s.slug === slug);
    if (!step || !getTool(slug)) {
      throw new Error('These steps do not form a supported conversion. Choose a compatible next step.');
    }
    const compat = checkStepCompatibility(format, step.source);
    if (!compat.compatible) {
      throw new Error('These steps do not form a supported conversion. Choose a compatible next step.');
    }
    if (step.target !== 'same') {
      format = step.target;
    }
  }
  return format;
}

/**
 * Validates consecutive steps and returns details of any incompatible step transitions.
 */
export function validatePipeline(recipe: Recipe): {
  valid: boolean;
  errors: { stepIndex: number; fromSlug: string; toSlug: string; prevOutput: string; nextInput: string; message: string }[];
  outputFormat: string;
} {
  const errors: { stepIndex: number; fromSlug: string; toSlug: string; prevOutput: string; nextInput: string; message: string }[] = [];
  let format: string = recipe.source;

  for (let i = 0; i < recipe.steps.length; i++) {
    const slug = recipe.steps[i];
    const step = workflowSteps.find(s => s.slug === slug);
    if (!step || !getTool(slug)) {
      errors.push({
        stepIndex: i,
        fromSlug: i > 0 ? recipe.steps[i - 1] : 'source',
        toSlug: slug,
        prevOutput: format,
        nextInput: 'unknown',
        message: `Step "${slug}" is not a recognized workflow tool.`,
      });
      continue;
    }

    const compat = checkStepCompatibility(format, step.source);
    if (!compat.compatible) {
      errors.push({
        stepIndex: i,
        fromSlug: i > 0 ? recipe.steps[i - 1] : 'source',
        toSlug: slug,
        prevOutput: format,
        nextInput: String(step.source),
        message: compat.reason ?? `Incompatible step transition from ${format} to ${step.source}.`,
      });
    }

    if (step.target !== 'same') {
      format = step.target;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    outputFormat: format,
  };
}

/**
 * Parses and strictly validates a recipe JSON string. Preserves 100% backward compatibility with version 1 recipes.
 */
export function parseRecipe(raw: string): Recipe {
  if (raw.length > 8000) throw new Error('Recipe is too large.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Invalid recipe.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid recipe.');
  }

  const r = value as Record<string, unknown>;
  const allowedKeys = ['version', 'source', 'steps', 'name', 'id', 'description', 'createdAt'];
  if (Object.keys(r).some(k => !allowedKeys.includes(k))) {
    throw new Error('Use a version 1 recipe with a supported source and 1–6 tool steps. Input data is not accepted in recipes.');
  }

  if (r.version !== 1 && r.version !== 2) {
    throw new Error('Use a version 1 recipe with a supported source and 1–6 tool steps. Input data is not accepted in recipes.');
  }

  const v1Sources = ['json', 'json-array', 'csv', 'yaml'];
  const allSources = ['json', 'json-array', 'csv', 'tsv', 'yaml', 'xml', 'toml', 'markdown', 'html', 'text'];

  if (r.version === 1) {
    if (!v1Sources.includes(String(r.source))) {
      throw new Error('Use a version 1 recipe with a supported source and 1–6 tool steps. Input data is not accepted in recipes.');
    }
    if (!Array.isArray(r.steps) || !r.steps.length || r.steps.length > 6 || r.steps.some(s => typeof s !== 'string')) {
      throw new Error('Use a version 1 recipe with a supported source and 1–6 tool steps. Input data is not accepted in recipes.');
    }
  } else {
    if (!allSources.includes(String(r.source))) {
      throw new Error('Use a recipe with a supported source format.');
    }
    if (!Array.isArray(r.steps) || !r.steps.length || r.steps.length > 12 || r.steps.some(s => typeof s !== 'string')) {
      throw new Error('Use a recipe with 1–12 tool steps.');
    }
  }

  const recipe = r as Recipe;
  outputFormat(recipe);
  return recipe;
}

export const recipePresets: { name: string; recipe: Recipe; sample: string }[] = [
  {
    name: 'CSV → readable JSON',
    recipe: { version: 1, source: 'csv', steps: ['csv-to-json', 'json-formatter'] },
    sample: 'name,score\nAda,9\nLin,7',
  },
  {
    name: 'JSON → YAML → JSON',
    recipe: { version: 1, source: 'json', steps: ['json-to-yaml', 'yaml-to-json', 'json-formatter'] },
    sample: '{"name":"Ada","active":true}',
  },
  {
    name: 'Sort and compact JSON',
    recipe: { version: 1, source: 'json', steps: ['json-key-sorter', 'json-minifier'] },
    sample: '{"z":3,"a":1}',
  },
];

export const studioPresets: { name: string; recipe: Recipe; sample: string; description?: string }[] = [
  ...recipePresets,
  {
    name: 'CSV → Markdown Table → HTML',
    recipe: { version: 2, name: 'CSV to HTML table', source: 'csv', steps: ['csv-to-markdown-table', 'markdown-to-html'] },
    sample: 'name,role,status\nAda,Architect,Active\nLin,Developer,Active',
    description: 'Transform tabular CSV records into a formatted Markdown table and render sanitized HTML.',
  },
  {
    name: 'Markdown → Formatted Text → Base64',
    recipe: { version: 2, name: 'Markdown to Base64', source: 'markdown', steps: ['markdown-formatter', 'markdown-to-text', 'base64-encoder'] },
    sample: '# Architecture Overview\n\nCode Station runs **entirely in the browser**.',
    description: 'Format Markdown, strip syntax markers to plain text, and encode into Base64.',
  },
  {
    name: 'Text lines → Sort → Dedupe',
    recipe: { version: 2, name: 'Sort and dedupe lines', source: 'text', steps: ['sort-lines', 'line-deduplicator', 'case-converter'] },
    sample: 'gamma\nalpha\nbeta\nalpha\ngamma',
    description: 'Sort lines alphabetically, eliminate duplicate records, and normalize case.',
  },
  {
    name: 'JSON → TypeScript Interface',
    recipe: { version: 2, name: 'JSON to TypeScript', source: 'json', steps: ['json-key-sorter', 'json-to-typescript'] },
    sample: '{"id": 42, "user": {"name": "Ada", "role": "admin"}, "tags": ["rust", "typescript"]}',
    description: 'Sort JSON object keys and compile typed TypeScript interface definitions.',
  },
];

export type StepExecutionResult = {
  stepIndex: number;
  slug: string;
  toolName: string;
  sourceFormat: string;
  targetFormat: string;
  input: string;
  output: string;
  status: 'idle' | 'running' | 'success' | 'error';
  durationMs: number;
  error?: string;
};

export type PipelineExecutionResult = {
  success: boolean;
  finalOutput: string;
  totalDurationMs: number;
  steps: StepExecutionResult[];
  error?: string;
  stoppedAtStep?: number;
};

/**
 * Executes a single tool step using its genuine client-side processing module.
 */
export async function executeWorkflowStep(
  slug: string,
  input: string,
  options: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) throw new Error('Processing cancelled.');

  // 1. Markdown station tools
  const markdownSlugs = new Set([
    'markdown-formatter',
    'markdown-to-html',
    'html-to-markdown',
    'csv-to-markdown-table',
    'markdown-to-text',
    'markdown-escape',
  ]);
  if (markdownSlugs.has(slug)) {
    const { runMarkdown } = await import('@/lib/tools/markdown/engine');
    if (signal?.aborted) throw new Error('Processing cancelled.');
    const result = await runMarkdown(slug, {
      source: input,
      csv: input,
      html: input,
      markdown: input,
      text: input,
      ...options,
    });
    return result.text;
  }

  // 2. Encoding station tools
  const encodingSlugs = new Set([
    'base64-encoder',
    'base64-decoder',
    'url-encoder',
    'url-decoder',
    'url-component-encoder',
    'url-component-decoder',
    'html-entity-encoder',
    'html-entity-decoder',
    'hexadecimal-encoder',
    'hexadecimal-decoder',
    'text-to-hex',
    'hex-to-text',
    'binary-encoder',
    'binary-decoder',
  ]);
  if (encodingSlugs.has(slug)) {
    const { runEncoding } = await import('@/lib/tools/encoding/index');
    if (signal?.aborted) throw new Error('Processing cancelled.');
    const result = await runEncoding(slug, { input, ...options });
    return result.text;
  }

  // 3. Text station tools
  const textSlugs = new Set([
    'case-converter',
    'slug-generator',
    'line-deduplicator',
    'duplicate-line-remover',
    'sort-lines',
    'reverse-lines',
    'reverse-text',
    'whitespace-cleaner',
    'empty-line-remover',
    'tabs-to-spaces',
    'spaces-to-tabs',
    'text-counter',
  ]);
  if (textSlugs.has(slug)) {
    const { runText } = await import('@/lib/tools/text/engine');
    if (signal?.aborted) throw new Error('Processing cancelled.');
    const tool = getTool(slug);
    const defaults = Object.fromEntries(
      (tool?.textContract?.fields ?? []).map(f => [
        f.name,
        (tool?.textContract?.defaults as Record<string, unknown>)?.[f.name] ?? '',
      ])
    );
    const result = await runText(slug, { ...defaults, text: input, ...options });
    if (slug === 'text-counter') {
      return JSON.stringify(Object.fromEntries(result.rows.map(r => [r.label, r.value])), null, 2);
    }
    return result.rows[0]?.value ?? '';
  }

  // 4. Code Generation station tools
  if (slug === 'json-to-typescript') {
    const { jsonToTypescript } = await import('@/lib/tools/code-gen/engine');
    return jsonToTypescript(input, String(options.rootName ?? 'Root'));
  }
  if (slug === 'json-to-zod') {
    const { jsonToZod } = await import('@/lib/tools/code-gen/engine');
    return jsonToZod(input, String(options.rootName ?? 'rootSchema'));
  }

  // 5. JSON / Data station tools (fallthrough for all data conversion & formatting)
  const { runDataTool } = await import('@/lib/tools/json-data');
  if (signal?.aborted) throw new Error('Processing cancelled.');
  const tool = getTool(slug);
  const defaults = Object.fromEntries((tool?.dataContract?.fields ?? []).map(f => [f.name, f.defaultValue ?? '']));
  const result = await runDataTool(slug, { ...defaults, input, ...options } as Record<string, string>);
  return result.text;
}

/**
 * Sequentially executes all steps in a recipe pipeline, passing intermediate results forward
 * and recording intermediate execution logs at each step.
 */
export async function executePipeline(
  recipe: Recipe,
  initialInput: string,
  signal?: AbortSignal,
  onStepProgress?: (step: StepExecutionResult) => void
): Promise<PipelineExecutionResult> {
  const parsed = parseRecipe(JSON.stringify(recipe));
  const startTime = Date.now();
  let currentInput = initialInput;
  const stepResults: StepExecutionResult[] = [];
  let currentFormat: string = parsed.source;

  for (let index = 0; index < parsed.steps.length; index++) {
    if (signal?.aborted) {
      throw new Error('Pipeline execution cancelled.');
    }
    const slug = parsed.steps[index];
    const def = workflowSteps.find(s => s.slug === slug);
    const tool = getTool(slug);
    const stepTarget = def?.target === 'same' ? currentFormat : (def?.target ?? currentFormat);

    const stepStart = Date.now();
    try {
      const output = await executeWorkflowStep(slug, currentInput, {}, signal);
      const durationMs = Date.now() - stepStart;
      const stepRes: StepExecutionResult = {
        stepIndex: index,
        slug,
        toolName: tool?.name ?? slug,
        sourceFormat: currentFormat,
        targetFormat: stepTarget,
        input: currentInput,
        output,
        status: 'success',
        durationMs,
      };
      stepResults.push(stepRes);
      onStepProgress?.(stepRes);

      currentInput = output;
      currentFormat = stepTarget;
    } catch (err: unknown) {
      const durationMs = Date.now() - stepStart;
      const errorMessage = err instanceof Error ? err.message : 'Step failed.';
      const stepRes: StepExecutionResult = {
        stepIndex: index,
        slug,
        toolName: tool?.name ?? slug,
        sourceFormat: currentFormat,
        targetFormat: stepTarget,
        input: currentInput,
        output: '',
        status: 'error',
        durationMs,
        error: errorMessage,
      };
      stepResults.push(stepRes);
      onStepProgress?.(stepRes);

      return {
        success: false,
        finalOutput: index > 0 ? stepResults[index - 1].output : '',
        totalDurationMs: Date.now() - startTime,
        steps: stepResults,
        error: `Step ${index + 1} (${tool?.name ?? slug}) failed: ${errorMessage}`,
        stoppedAtStep: index,
      };
    }
  }

  return {
    success: true,
    finalOutput: currentInput,
    totalDurationMs: Date.now() - startTime,
    steps: stepResults,
  };
}

// ---------------------------------------------------------------------------
// Recipe Storage & Portability (localStorage, JSON Export/Import)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'codestation_saved_recipes';

export type SavedRecipe = {
  id: string;
  name: string;
  recipe: Recipe;
  updatedAt: string;
};

const inMemoryStorage = new Map<string, string>();

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (key: string): string | null => inMemoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { inMemoryStorage.set(key, value); },
    removeItem: (key: string) => { inMemoryStorage.delete(key); },
  };
}

export function loadSavedRecipes(): SavedRecipe[] {
  try {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && item.id && item.name && item.recipe);
  } catch {
    return [];
  }
}

export function saveRecipeToStorage(name: string, recipe: Recipe): SavedRecipe {
  const cleanRecipe = parseRecipe(JSON.stringify(recipe));
  const saved = loadSavedRecipes();
  const id = `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item: SavedRecipe = {
    id,
    name: name.trim() || `Recipe ${saved.length + 1}`,
    recipe: { ...cleanRecipe, name: name.trim() || undefined },
    updatedAt: new Date().toISOString(),
  };
  const updated = [item, ...saved.filter(s => s.name !== item.name)].slice(0, 50);
  const storage = getStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return item;
}

export function deleteSavedRecipe(id: string): void {
  const saved = loadSavedRecipes();
  const updated = saved.filter(s => s.id !== id);
  const storage = getStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function exportRecipeAsJson(recipe: Recipe): string {
  const clean = parseRecipe(JSON.stringify(recipe));
  return JSON.stringify(clean, null, 2);
}

export function importRecipeFromJson(jsonString: string): Recipe {
  return parseRecipe(jsonString);
}
