// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import {
  checkStepCompatibility,
  validateStepCompatibility,
  outputFormat,
  validatePipeline,
  parseRecipe,
  executeWorkflowStep,
  executePipeline,
  workflowSteps,
  studioPresets,
  recipePresets,
  loadSavedRecipes,
  saveRecipeToStorage,
  deleteSavedRecipe,
  exportRecipeAsJson,
  importRecipeFromJson,
  type Recipe,
} from './workflows';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import { WorkbenchProvider } from '@/components/WorkbenchProvider';

describe('Workflow Step Compatibility', () => {
  it('identifies exact format matches as compatible', () => {
    expect(checkStepCompatibility('json', 'json').compatible).toBe(true);
    expect(checkStepCompatibility('csv', 'csv').compatible).toBe(true);
    expect(checkStepCompatibility('markdown', 'markdown').compatible).toBe(true);
    expect(checkStepCompatibility('text', 'text').compatible).toBe(true);
  });

  it('accepts json-array where json is expected (subtype)', () => {
    const result = checkStepCompatibility('json-array', 'json');
    expect(result.compatible).toBe(true);
    expect(result.notes).toContain('valid JSON');

    const csvResult = checkStepCompatibility('json-array', 'csv');
    expect(csvResult.compatible).toBe(true);
  });

  it('allows json where json-array is expected with caveat', () => {
    const result = checkStepCompatibility('json', 'json-array');
    expect(result.compatible).toBe(true);
    expect(result.notes).toContain('top-level JSON array');
  });

  it('allows text to accept any formatted string output', () => {
    expect(checkStepCompatibility('json', 'text').compatible).toBe(true);
    expect(checkStepCompatibility('csv', 'text').compatible).toBe(true);
    expect(checkStepCompatibility('yaml', 'text').compatible).toBe(true);
    expect(checkStepCompatibility('base64', 'text').compatible).toBe(true);
    expect(checkStepCompatibility('html', 'text').compatible).toBe(true);
  });

  it('allows cross-compatibility between markdown and text', () => {
    expect(checkStepCompatibility('text', 'markdown').compatible).toBe(true);
    expect(checkStepCompatibility('markdown', 'text').compatible).toBe(true);
  });

  it('flags incompatible transitions', () => {
    const res1 = checkStepCompatibility('csv', 'yaml');
    expect(res1.compatible).toBe(false);
    expect(res1.reason).toContain('Incompatible transition');

    const res2 = checkStepCompatibility('base64', 'json');
    expect(res2.compatible).toBe(false);
  });

  it('alias validateStepCompatibility works identically', () => {
    expect(validateStepCompatibility('json', 'json')).toEqual(checkStepCompatibility('json', 'json'));
  });

  it('validates a complete pipeline for compatibility issues', () => {
    const validRecipe: Recipe = {
      version: 2,
      source: 'csv',
      steps: ['csv-to-json', 'json-key-sorter', 'json-formatter'],
    };
    const validCheck = validatePipeline(validRecipe);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.errors).toHaveLength(0);

    const invalidRecipe: Recipe = {
      version: 2,
      source: 'csv',
      steps: ['csv-to-json', 'yaml-to-json'],
    };
    const invalidCheck = validatePipeline(invalidRecipe);
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.errors.length).toBeGreaterThan(0);
    expect(invalidCheck.errors[0].message).toContain('Incompatible');
  });
});

describe('Recipe Parsing and Validation', () => {
  it('parses valid version 1 recipe', () => {
    const raw = JSON.stringify({
      version: 1,
      source: 'csv',
      steps: ['csv-to-json', 'json-formatter'],
    });
    const recipe = parseRecipe(raw);
    expect(recipe.version).toBe(1);
    expect(recipe.source).toBe('csv');
    expect(recipe.steps).toEqual(['csv-to-json', 'json-formatter']);
  });

  it('parses valid version 2 recipe with custom name and description', () => {
    const raw = JSON.stringify({
      version: 2,
      name: 'Custom Pipeline',
      source: 'markdown',
      steps: ['markdown-formatter', 'markdown-to-html'],
      description: 'Formats and converts to HTML',
    });
    const recipe = parseRecipe(raw);
    expect(recipe.version).toBe(2);
    expect(recipe.name).toBe('Custom Pipeline');
    expect(recipe.steps).toEqual(['markdown-formatter', 'markdown-to-html']);
    expect(outputFormat(recipe)).toBe('html');
  });

  it('rejects recipes containing input payload data to protect privacy', () => {
    const rawWithInput = JSON.stringify({
      version: 1,
      source: 'json',
      steps: ['json-formatter'],
      input: '{"secret": "do not share"}',
    });
    expect(() => parseRecipe(rawWithInput)).toThrow();
  });

  it('rejects recipes exceeding character or step limits', () => {
    const tooManyV1Steps = JSON.stringify({
      version: 1,
      source: 'json',
      steps: ['json-formatter', 'json-minifier', 'json-formatter', 'json-minifier', 'json-formatter', 'json-minifier', 'json-formatter'],
    });
    expect(() => parseRecipe(tooManyV1Steps)).toThrow();

    const hugeRaw = JSON.stringify({
      version: 2,
      source: 'json',
      steps: ['json-formatter'],
      name: 'x'.repeat(9000),
    });
    expect(() => parseRecipe(hugeRaw)).toThrow('Recipe is too large');
  });

  it('rejects unknown tools in recipe steps', () => {
    const unknown = JSON.stringify({
      version: 2,
      source: 'json',
      steps: ['non-existent-tool'],
    });
    expect(() => parseRecipe(unknown)).toThrow('These steps do not form a supported conversion');
  });
});

describe('Step Execution Across Stations', () => {
  it('executes JSON/Data tools correctly', async () => {
    const csvInput = 'id,name\n1,Alice\n2,Bob';
    const jsonOutput = await executeWorkflowStep('csv-to-json', csvInput);
    const parsed = JSON.parse(jsonOutput);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe('Alice');

    const formatted = await executeWorkflowStep('json-formatter', jsonOutput);
    expect(formatted).toContain('\n');

    const minified = await executeWorkflowStep('json-minifier', formatted);
    expect(minified).not.toContain('\n');
  });

  it('executes Text station tools correctly', async () => {
    const unordered = 'charlie\nalice\nbob\nalice';
    const sorted = await executeWorkflowStep('sort-lines', unordered);
    expect(sorted.split('\n')[0]).toBe('alice');

    const deduped = await executeWorkflowStep('line-deduplicator', sorted);
    const lines = deduped.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines).toEqual(['alice', 'bob', 'charlie']);

    const reversed = await executeWorkflowStep('reverse-text', 'abc');
    expect(reversed).toBe('cba');

    const slug = await executeWorkflowStep('slug-generator', 'Hello World & Universe');
    expect(slug).toBe('hello-world-universe');
  });

  it('executes Encoding station tools correctly', async () => {
    const text = 'Hello Code Station!';
    const encoded = await executeWorkflowStep('base64-encoder', text);
    expect(encoded).toBe('SGVsbG8gQ29kZSBTdGF0aW9uIQ==');

    const decoded = await executeWorkflowStep('base64-decoder', encoded);
    expect(decoded).toBe(text);

    const htmlEntities = await executeWorkflowStep('html-entity-encoder', '<div>"Test" & \'Demo\'</div>');
    expect(htmlEntities).toContain('&lt;div&gt;');
  });

  it('executes Markdown station tools correctly', async () => {
    const md = '# Header\n\nParagraph with **bold** text.';
    const html = await executeWorkflowStep('markdown-to-html', md);
    expect(html).toContain('<h1>Header</h1>');
    expect(html).toContain('<strong>bold</strong>');

    const plainText = await executeWorkflowStep('markdown-to-text', md);
    expect(plainText).not.toContain('#');
    expect(plainText).toContain('Header');

    const csvData = 'col1,col2\nval1,val2';
    const table = await executeWorkflowStep('csv-to-markdown-table', csvData);
    expect(table).toContain('| col1 | col2 |');
  });

  it('executes Code Generation tools correctly', async () => {
    const json = '{"id": 1, "username": "ada", "roles": ["admin"]}';
    const ts = await executeWorkflowStep('json-to-typescript', json);
    expect(ts).toContain('export interface');
    expect(ts).toContain('username: string;');
  });
});

describe('Pipeline Studio Execution Engine', () => {
  it('executes a multi-step JSON pipeline end-to-end with intermediate results', async () => {
    const recipe: Recipe = {
      version: 2,
      source: 'csv',
      steps: ['csv-to-json', 'json-key-sorter', 'json-formatter'],
    };
    const input = 'b,a\n2,1';
    const progressSteps: string[] = [];

    const result = await executePipeline(recipe, input, undefined, step => {
      progressSteps.push(step.slug);
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(progressSteps).toEqual(['csv-to-json', 'json-key-sorter', 'json-formatter']);
    expect(result.steps[0].status).toBe('success');
    expect(result.steps[1].status).toBe('success');
    expect(result.steps[2].status).toBe('success');

    expect(JSON.parse(result.steps[0].output)).toEqual([{ b: '2', a: '1' }]);
    expect(result.steps[1].output).toContain('"a"');
    expect(result.finalOutput).toContain('  "a": "1"');
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('executes a multi-station Markdown-to-HTML-to-Base64 pipeline', async () => {
    const recipe: Recipe = {
      version: 2,
      source: 'markdown',
      steps: ['markdown-formatter', 'markdown-to-html', 'base64-encoder'],
    };
    const input = '## Live Station\n\nRuns **client-side**.';
    const result = await executePipeline(recipe, input);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].output).toContain('<h2>Live Station</h2>');
    expect(atob(result.finalOutput)).toContain('<h2>Live Station</h2>');
  });

  it('halts gracefully on step error and preserves preceding step outputs', async () => {
    const recipe: Recipe = {
      version: 2,
      source: 'json',
      steps: ['json-key-sorter', 'json-to-csv'],
    };
    const singleObjectJson = '{"b": 2, "a": 1}';
    const result = await executePipeline(recipe, singleObjectJson);

    expect(result.success).toBe(false);
    expect(result.stoppedAtStep).toBe(1);
    expect(result.steps[0].status).toBe('success');
    expect(result.steps[0].output).toContain('"a": 1');
    expect(result.steps[1].status).toBe('error');
    expect(result.finalOutput).toBe(result.steps[0].output);
    expect(result.error).toContain('failed');
  });

  it('aborts pipeline when AbortSignal is cancelled', async () => {
    const recipe: Recipe = {
      version: 2,
      source: 'csv',
      steps: ['csv-to-json', 'json-formatter'],
    };
    const controller = new AbortController();
    controller.abort();

    await expect(executePipeline(recipe, 'a,b\n1,2', controller.signal)).rejects.toThrow('cancelled');
  });
});

describe('Recipe Portability & LocalStorage Management', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('exports and imports recipes via JSON cleanly', () => {
    const original: Recipe = {
      version: 2,
      name: 'Sample Pipeline',
      source: 'text',
      steps: ['sort-lines', 'line-deduplicator'],
    };
    const exportedJson = exportRecipeAsJson(original);
    expect(typeof exportedJson).toBe('string');
    expect(exportedJson).toContain('Sample Pipeline');

    const imported = importRecipeFromJson(exportedJson);
    expect(imported).toEqual(original);
  });

  it('saves, lists, and deletes recipes from localStorage', () => {
    const recipe: Recipe = {
      version: 2,
      name: 'Saved Test Recipe',
      source: 'csv',
      steps: ['csv-to-json'],
    };

    const saved = saveRecipeToStorage('Saved Test Recipe', recipe);
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Saved Test Recipe');

    const list = loadSavedRecipes();
    expect(list).toHaveLength(1);
    expect(list[0].recipe.steps).toEqual(['csv-to-json']);

    deleteSavedRecipe(saved.id);
    expect(loadSavedRecipes()).toHaveLength(0);
  });

  it('verifies presets and tool catalog integrity', () => {
    expect(recipePresets.length).toBe(3);
    expect(studioPresets.length).toBeGreaterThan(3);
    expect(workflowSteps.length).toBeGreaterThan(30);

    for (const step of workflowSteps) {
      expect(step.slug).toBeTruthy();
      expect(step.category).toBeTruthy();
      expect(step.source).toBeTruthy();
      expect(step.target).toBeTruthy();
    }
  });
});

describe('WorkflowBuilder Component UI', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.location.hash = '';
      if (!window.navigator.clipboard) {
        Object.assign(window.navigator, {
          clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
      } else {
        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      }
    }
  });

  afterEach(() => {
    cleanup();
  });

  function renderStudio() {
    return render(
      React.createElement(
        WorkbenchProvider,
        null,
        React.createElement(WorkflowBuilder, null)
      )
    );
  }

  it('renders initial studio panels, headings, presets, and step cards', () => {
    renderStudio();
    expect(screen.getByRole('heading', { name: /1 \/ Studio Pipeline Architecture/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /2 \/ Supply Input and Run Pipeline/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /3 \/ Recipe Management/i })).toBeDefined();

    // Verify presets are rendered
    expect(screen.getByText('CSV → readable JSON')).toBeDefined();
    expect(screen.getByText('JSON → YAML → JSON')).toBeDefined();
    expect(screen.getByText('Sort and compact JSON')).toBeDefined();
  });

  it('supports accessible step reordering via Move Up and Move Down buttons', () => {
    renderStudio();

    // Initial preset has 2 steps: csv-to-json (#1), json-formatter (#2)
    const moveDownButtons = screen.getAllByTitle('Move down');
    expect(moveDownButtons[0]).toBeDefined();

    // Click Move Down on step 1
    act(() => {
      fireEvent.click(moveDownButtons[0]);
    });

    // Steps should now be swapped: json-formatter is now #1, csv-to-json is #2
    const stepCards = screen.getAllByRole('listitem');
    expect(stepCards[0].textContent).toContain('JSON Formatter');
    expect(stepCards[1].textContent).toContain('CSV to JSON');
  });

  it('supports step removal and adding new steps', () => {
    renderStudio();

    const removeButtons = screen.getAllByTitle('Remove step');
    const initialCount = removeButtons.length;

    // Remove first step
    act(() => {
      fireEvent.click(removeButtons[0]);
    });

    const remainingRemoveButtons = screen.getAllByTitle('Remove step');
    expect(remainingRemoveButtons.length).toBe(initialCount - 1);

    // Add a step using the select dropdown
    const select = screen.getByLabelText('Select tool to add');
    act(() => {
      fireEvent.change(select, { target: { value: 'json-minifier' } });
    });

    const addButton = screen.getByRole('button', { name: /\+ Add Step/i });
    act(() => {
      fireEvent.click(addButton);
    });

    expect(screen.getAllByText(/JSON Minifier/i).length).toBeGreaterThanOrEqual(2);
  });

  it('executes pipeline and displays live intermediate previews', async () => {
    renderStudio();

    // Click "Run All Steps" button
    const runButton = screen.getByRole('button', { name: /▶ Run All Steps/i });
    expect(runButton).toBeDefined();

    await act(async () => {
      fireEvent.click(runButton);
    });

    // Verify intermediate preview panel appeared
    const copyOutputButtons = await screen.findAllByRole('button', { name: /Copy Output/i });
    expect(copyOutputButtons.length).toBeGreaterThan(0);

    // Verify final result is displayed
    const finalResultHeading = await screen.findByText(/Pipeline Final Result/i);
    expect(finalResultHeading).toBeDefined();
  });

  it('saves recipe to localStorage and displays in saved list', () => {
    renderStudio();

    const saveButton = screen.getByRole('button', { name: /💾 Save to Local Storage/i });
    act(() => {
      fireEvent.click(saveButton);
    });

    // Verify saved recipe appears in saved list
    expect(screen.getByText(/Saved Recipes \(1\)/i)).toBeDefined();
  });

  it('supports drag-and-drop step reordering event handlers', () => {
    renderStudio();

    const stepItems = screen.getAllByRole('listitem');
    expect(stepItems.length).toBeGreaterThanOrEqual(2);

    // Fire drag events
    act(() => {
      fireEvent.dragStart(stepItems[0], {
        dataTransfer: { setData: vi.fn(), effectAllowed: 'move' },
      });
      fireEvent.dragOver(stepItems[1], {
        dataTransfer: { dropEffect: 'move' },
      });
      fireEvent.drop(stepItems[1], {
        dataTransfer: { getData: vi.fn(() => '0') },
      });
      fireEvent.dragEnd(stepItems[0]);
    });

    // Successfully executed drag events without error
    expect(screen.getAllByRole('listitem')).toHaveLength(stepItems.length);
  });
});
