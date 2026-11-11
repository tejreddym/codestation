"use client";

import React, { useEffect, useRef, useState } from 'react';
import { getTool } from '@/config/tools';
import {
  checkStepCompatibility,
  outputFormat,
  parseRecipe,
  recipePresets,
  studioPresets,
  workflowSteps,
  executeWorkflowStep,
  loadSavedRecipes,
  saveRecipeToStorage,
  deleteSavedRecipe,
  exportRecipeAsJson,
  type Recipe,
  type RecipeSource,
  type SavedRecipe,
  type WorkflowStepDefinition,
} from '@/lib/workbench/workflows';
import { useWorkbench } from './WorkbenchProvider';
import { useSafeRouter } from './useSafeNavigation';
import BannerAd from './BannerAd';
import styles from './WorkflowBuilder.module.css';

type StepExecutionState = {
  output: string;
  durationMs: number;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
};

const ALL_SOURCES: RecipeSource[] = [
  'json',
  'json-array',
  'csv',
  'tsv',
  'yaml',
  'xml',
  'toml',
  'markdown',
  'html',
  'text',
];

const CATEGORIES = ['All', 'JSON & Data', 'Text', 'Encoding', 'Markdown', 'Code'] as const;

export default function WorkflowBuilder() {
  const [recipe, setRecipe] = useState<Recipe>(studioPresets[0].recipe);
  const [recipeName, setRecipeName] = useState<string>('My Custom Pipeline');
  const [input, setInput] = useState<string>(studioPresets[0].sample);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedNextTool, setSelectedNextTool] = useState<string>('');
  const [importText, setImportText] = useState<string>('');
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [stepResults, setStepResults] = useState<StepExecutionState[]>([]);
  const [finalOutput, setFinalOutput] = useState<string>('');
  const [totalDuration, setTotalDuration] = useState<number | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const runController = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { queueInput } = useWorkbench();
  const router = useSafeRouter();

  // Load recipe from URL hash on mount and initialize saved recipes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && location.hash.startsWith('#recipe=')) {
        const decoded = decodeURIComponent(location.hash.slice(8));
        const parsed = parseRecipe(decoded);
        setRecipe(parsed);
        if (parsed.name) setRecipeName(parsed.name);
      }
      if (typeof window !== 'undefined') {
        const piped = sessionStorage.getItem('codestation_workflow_input');
        if (piped) {
          setInput(piped);
          sessionStorage.removeItem('codestation_workflow_input');
        }
      }
    } catch {
      setMessage('This recipe link is invalid. No input was loaded.');
    }
    setSavedRecipes(loadSavedRecipes());
    return () => runController.current?.abort();
  }, []);

  function invalidateExecution() {
    runController.current?.abort();
    runController.current = null;
    setBusy(false);
    setStepResults([]);
    setFinalOutput('');
    setTotalDuration(null);
  }

  function changeRecipe(next: Recipe) {
    invalidateExecution();
    setRecipe(next);
    if (next.name) setRecipeName(next.name);
  }

  // Calculate the intermediate and final output format
  let currentOutputFormat = recipe.source as string;
  try {
    currentOutputFormat = outputFormat(recipe);
  } catch {
    // If outputFormat throws because of temporary incompatibility, fallback
  }

  // Calculate format transitions for each step
  const stepFormats: { inputFormat: string; outputFormat: string; compatible: boolean; reason?: string }[] = [];
  let trackingFormat = recipe.source as string;

  for (let i = 0; i < recipe.steps.length; i++) {
    const slug = recipe.steps[i];
    const def = workflowSteps.find(s => s.slug === slug);
    const expectedInput = def?.source ?? 'text';
    const compat = checkStepCompatibility(trackingFormat, expectedInput);
    const stepTarget = def?.target === 'same' ? trackingFormat : (def?.target ?? trackingFormat);

    stepFormats.push({
      inputFormat: trackingFormat,
      outputFormat: stepTarget,
      compatible: compat.compatible,
      reason: compat.reason,
    });

    trackingFormat = stepTarget;
  }

  // Filter available next tools
  const availableTools = workflowSteps.filter(step => {
    if (selectedCategory !== 'All' && step.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  // Reordering helpers
  function moveStep(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= recipe.steps.length) return;
    const nextSteps = [...recipe.steps];
    const temp = nextSteps[index];
    nextSteps[index] = nextSteps[target];
    nextSteps[target] = temp;
    changeRecipe({ ...recipe, steps: nextSteps });
  }

  function removeStep(index: number) {
    const nextSteps = recipe.steps.filter((_, i) => i !== index);
    changeRecipe({ ...recipe, steps: nextSteps });
  }

  function handleDragStart(index: number, e: React.DragEvent) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleDragOver(index: number, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(targetIndex: number, e: React.DragEvent) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const nextSteps = [...recipe.steps];
    const [removed] = nextSteps.splice(draggedIndex, 1);
    nextSteps.splice(targetIndex, 0, removed);
    changeRecipe({ ...recipe, steps: nextSteps });
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  // Pipeline Execution ("Run all")
  async function runPipeline() {
    if (!input.trim() || !recipe.steps.length) return;
    invalidateExecution();

    const controller = new AbortController();
    runController.current = controller;
    setBusy(true);

    const initialResults: StepExecutionState[] = recipe.steps.map(() => ({
      output: '',
      durationMs: 0,
      status: 'idle',
    }));
    setStepResults(initialResults);

    const pipelineStart = Date.now();
    let currentData = input;

    try {
      // Validate recipe schema before execution
      parseRecipe(JSON.stringify(recipe));

      for (let i = 0; i < recipe.steps.length; i++) {
        if (controller.signal.aborted) return;
        const slug = recipe.steps[i];
        const tool = getTool(slug);
        const toolName = tool?.name ?? slug;

        setMessage(`Running step ${i + 1} of ${recipe.steps.length}: ${toolName}…`);

        // Update step status to running
        setStepResults(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'running' };
          return next;
        });

        const stepStart = Date.now();
        const output = await executeWorkflowStep(slug, currentData, {}, controller.signal);
        const stepDuration = Date.now() - stepStart;

        if (controller.signal.aborted) return;

        // Update step result
        setStepResults(prev => {
          const next = [...prev];
          next[i] = {
            output,
            durationMs: stepDuration,
            status: 'success',
          };
          return next;
        });

        currentData = output;
      }

      const totalMs = Date.now() - pipelineStart;
      setFinalOutput(currentData);
      setTotalDuration(totalMs);
      setMessage(`Pipeline complete in ${totalMs}ms. Original input is preserved.`);
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        const errorText = error instanceof Error ? error.message : 'Processing failed.';
        setMessage(`Pipeline stopped: ${errorText}`);
      }
    } finally {
      if (runController.current === controller) {
        setBusy(false);
        runController.current = null;
      }
    }
  }

  // LocalStorage Recipe Management
  function handleSaveRecipe() {
    try {
      const saved = saveRecipeToStorage(recipeName, { ...recipe, name: recipeName });
      setSavedRecipes(loadSavedRecipes());
      setMessage(`Recipe "${saved.name}" saved to local storage.`);
    } catch (err) {
      setMessage(`Could not save recipe: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function handleLoadRecipe(saved: SavedRecipe) {
    changeRecipe(saved.recipe);
    setRecipeName(saved.name);
    setMessage(`Recipe "${saved.name}" loaded.`);
  }

  function handleDeleteRecipe(id: string) {
    deleteSavedRecipe(id);
    setSavedRecipes(loadSavedRecipes());
    setMessage('Saved recipe deleted.');
  }

  // JSON File Export
  function handleExportJson() {
    try {
      const jsonStr = exportRecipeAsJson({ ...recipe, name: recipeName });
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeFilename = (recipeName || 'recipe').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      link.download = `${safeFilename}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Recipe exported as JSON file.');
    } catch (err) {
      setMessage(`Export failed: ${err instanceof Error ? err.message : 'Invalid recipe.'}`);
    }
  }

  // JSON File Import
  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = String(reader.result ?? '');
        const imported = parseRecipe(content);
        changeRecipe(imported);
        setMessage(`Recipe "${imported.name || 'Imported'}" successfully loaded from file.`);
      } catch (err) {
        setMessage(`Import failed: ${err instanceof Error ? err.message : 'Malformed recipe JSON.'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePasteImport() {
    try {
      const imported = parseRecipe(importText);
      changeRecipe(imported);
      setImportText('');
      setMessage(`Recipe "${imported.name || 'Imported'}" loaded from text.`);
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : 'Invalid recipe JSON.'}`);
    }
  }

  // Share URL link
  async function handleCopyShareLink() {
    try {
      const cleanRecipe = parseRecipe(JSON.stringify({ ...recipe, name: recipeName }));
      const encoded = encodeURIComponent(JSON.stringify(cleanRecipe));
      const url = `${window.location.origin}/workflows#recipe=${encoded}`;
      await navigator.clipboard.writeText(url);
      setMessage('Privacy-safe recipe link copied. Input data is never included.');
    } catch {
      setMessage('Could not copy automatically. You can copy the recipe JSON below.');
    }
  }

  return (
    <div className={styles.studio}>
      {/* ---------------- 1. Pipeline Definition Panel ---------------- */}
      <section className={styles.panel} aria-labelledby="pipeline-builder-heading">
        <div className={styles.panelHeader}>
          <h2 id="pipeline-builder-heading" className={styles.panelTitle}>
            1 / Studio Pipeline Architecture
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={styles.badge}>Steps: {recipe.steps.length} / 12</span>
            <span className={`${styles.badge} ${styles.badgeAccent}`}>Output: {currentOutputFormat}</span>
          </div>
        </div>

        <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--secondary)' }}>
          Chain compatible Code Station tools across JSON/Data, Text, Encoding, and Markdown. Drag to reorder steps or use the arrows.
        </p>

        {/* Presets Bar */}
        <label className="field-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Explore Pipeline Presets
        </label>
        <div className={styles.presetsBar}>
          {studioPresets.map(preset => (
            <button
              key={preset.name}
              type="button"
              className={styles.presetChip}
              onClick={() => {
                changeRecipe(preset.recipe);
                setInput(preset.sample);
                setMessage(`Loaded preset "${preset.name}".`);
              }}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Source format & Pipeline Name */}
        <div className={styles.controlsRow}>
          <div className={styles.fieldGroup}>
            <label htmlFor="workflow-source">Starting Format</label>
            <select
              id="workflow-source"
              className={styles.selectInput}
              value={recipe.source}
              onChange={e => {
                changeRecipe({
                  version: 2,
                  name: recipeName,
                  source: e.target.value as RecipeSource,
                  steps: [],
                });
              }}
            >
              {ALL_SOURCES.map(format => (
                <option key={format} value={format}>
                  {format.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldGroup} style={{ flex: 1 }}>
            <label htmlFor="pipeline-name">Pipeline Name</label>
            <input
              id="pipeline-name"
              type="text"
              className={styles.selectInput}
              style={{ width: '100%' }}
              value={recipeName}
              onChange={e => setRecipeName(e.target.value)}
              placeholder="e.g. Clean and Export Dataset"
            />
          </div>
        </div>

        {/* Step List with Drag and Drop & Live Previews */}
        <ol className={styles.stepList} aria-label="Pipeline steps">
          {recipe.steps.map((slug, index) => {
            const stepDef = workflowSteps.find(s => s.slug === slug);
            const tool = getTool(slug);
            const formatMeta = stepFormats[index];
            const executionState = stepResults[index];
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <li
                key={`${index}-${slug}`}
                draggable
                onDragStart={e => handleDragStart(index, e)}
                onDragOver={e => handleDragOver(index, e)}
                onDrop={e => handleDrop(index, e)}
                onDragEnd={handleDragEnd}
                className={`${styles.stepCard} ${isDragging ? styles.stepCardDragging : ''} ${
                  isDragOver ? styles.stepCardDragOver : ''
                }`}
                aria-label={`Step ${index + 1}: ${tool?.name ?? slug}`}
              >
                <div className={styles.stepHeader}>
                  <div className={styles.stepHeaderLeft}>
                    <span className={styles.dragHandle} title="Drag to reorder" aria-hidden="true">
                      ⋮⋮
                    </span>
                    <span className={styles.stepNumber}>#{index + 1}</span>
                    <strong className={styles.stepTitle}>{tool?.name ?? slug}</strong>
                    <span className={styles.badge}>{stepDef?.category ?? 'Utility'}</span>
                  </div>

                  <div className={styles.stepControls}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={index === 0}
                      onClick={() => moveStep(index, 'up')}
                      aria-label={`Move step ${index + 1} up`}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={index === recipe.steps.length - 1}
                      onClick={() => moveStep(index, 'down')}
                      aria-label={`Move step ${index + 1} down`}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.btnDanger}`}
                      onClick={() => removeStep(index)}
                      aria-label={`Remove step ${index + 1}`}
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Compatibility and Format Transition */}
                <div className={styles.stepMetaRow}>
                  <span className={styles.badge}>
                    {formatMeta?.inputFormat} → {formatMeta?.outputFormat}
                  </span>
                  {formatMeta && (
                    <span
                      className={`${styles.badge} ${
                        formatMeta.compatible ? styles.badgeSuccess : styles.badgeWarning
                      }`}
                    >
                      {formatMeta.compatible ? '✓ Compatible' : `⚠️ ${formatMeta.reason ?? 'Format mismatch'}`}
                    </span>
                  )}
                </div>

                {/* Live Intermediate Step Preview */}
                {executionState && executionState.status !== 'idle' && (
                  <div className={styles.previewPanel}>
                    <div className={styles.previewHeader}>
                      <div className={styles.previewStatus}>
                        <span
                          className={`${styles.statusDot} ${
                            executionState.status === 'success'
                              ? styles.statusDotSuccess
                              : executionState.status === 'running'
                              ? styles.statusDotRunning
                              : styles.statusDotError
                          }`}
                        />
                        <span>
                          {executionState.status === 'running'
                            ? 'Executing…'
                            : executionState.status === 'success'
                            ? `Output (${executionState.durationMs}ms, ${executionState.output.length} chars)`
                            : 'Step execution failed'}
                        </span>
                      </div>
                      {executionState.status === 'success' && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSmall}`}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(executionState.output);
                              setMessage(`Step #${index + 1} output copied.`);
                            } catch {
                              setMessage('Could not copy to clipboard.');
                            }
                          }}
                        >
                          Copy Output
                        </button>
                      )}
                    </div>
                    {executionState.status === 'error' ? (
                      <div style={{ padding: '10px 14px', color: 'var(--red)', fontSize: '12px' }}>
                        {executionState.error ?? 'Execution error.'}
                      </div>
                    ) : (
                      <pre className={styles.previewCode}>
                        {executionState.output || '(No output text returned)'}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {recipe.steps.length === 0 && (
          <div className={styles.emptyNotice}>
            No steps in this pipeline yet. Select a compatible tool below to add your first step.
          </div>
        )}

        {/* Add Step Controls */}
        {recipe.steps.length < 12 && (
          <div className={styles.addStepRow}>
            <div style={{ width: '100%' }}>
              <div className={styles.tabGroup} role="tablist" aria-label="Tool station filter">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === cat}
                    className={`${styles.tabButton} ${selectedCategory === cat ? styles.tabButtonActive : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="sr-only" htmlFor="add-step-tool-select">
                  Select tool to add
                </label>
                <select
                  id="add-step-tool-select"
                  className={styles.selectInput}
                  style={{ flex: 1, minWidth: '220px' }}
                  value={selectedNextTool}
                  onChange={e => setSelectedNextTool(e.target.value)}
                >
                  <option value="">Choose next pipeline tool…</option>
                  {availableTools.map(toolDef => {
                    const compat = checkStepCompatibility(currentOutputFormat, toolDef.source);
                    return (
                      <option key={toolDef.slug} value={toolDef.slug}>
                        {compat.compatible ? '● ' : '○ '}
                        {toolDef.name} ({toolDef.source} → {toolDef.target}) [{toolDef.category}]
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={!selectedNextTool}
                  onClick={() => {
                    if (selectedNextTool) {
                      changeRecipe({
                        ...recipe,
                        version: 2,
                        name: recipeName,
                        steps: [...recipe.steps, selectedNextTool],
                      });
                      setSelectedNextTool('');
                    }
                  }}
                >
                  + Add Step
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- 2. Pipeline Execution Panel ---------------- */}
      <section className={styles.panel} aria-labelledby="pipeline-execution-heading">
        <div className={styles.panelHeader}>
          <h2 id="pipeline-execution-heading" className={styles.panelTitle}>
            2 / Supply Input and Run Pipeline
          </h2>
          <span className={styles.badge}>
            {input.length.toLocaleString()} characters · {input ? input.split('\n').length : 0} lines
          </span>
        </div>

        <label htmlFor="pipeline-input" className="field-label">
          {recipe.source.toUpperCase()} Input Data
        </label>
        <textarea
          id="pipeline-input"
          className={styles.textarea}
          value={input}
          maxLength={1000000}
          onChange={e => {
            invalidateExecution();
            setInput(e.target.value);
          }}
          placeholder={`Enter or paste ${recipe.source.toUpperCase()} payload here…`}
        />

        <div className={styles.runToolbar}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy || !recipe.steps.length || !input.trim()}
            onClick={() => void runPipeline()}
          >
            {busy ? 'Running Pipeline…' : '▶ Run All Steps'}
          </button>

          {busy && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => {
                invalidateExecution();
                setMessage('Pipeline run was cancelled.');
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              const preset = studioPresets.find(p => p.recipe.source === recipe.source);
              if (preset) {
                invalidateExecution();
                setInput(preset.sample);
                setMessage('Sample input loaded.');
              }
            }}
          >
            Load Sample
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              invalidateExecution();
              setInput('');
            }}
          >
            Clear Input
          </button>
        </div>

        {message && (
          <p className={styles.statusMessage} role="status">
            {message}
          </p>
        )}

        {/* Final Pipeline Output */}
        {finalOutput && !busy && (
          <div style={{ marginTop: '20px' }}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle} style={{ fontSize: '15px' }}>
                Pipeline Final Result ({currentOutputFormat})
              </h3>
              {totalDuration !== null && (
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                  Executed {recipe.steps.length} steps in {totalDuration}ms
                </span>
              )}
            </div>

            <textarea
              className={styles.textarea}
              readOnly
              value={finalOutput}
              style={{ minHeight: '180px' }}
              aria-label="Final pipeline result"
            />

            <div className={styles.runToolbar}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(finalOutput);
                    setMessage('Final result copied to clipboard.');
                  } catch {
                    setMessage('Could not copy result.');
                  }
                }}
              >
                Copy Final Result
              </button>

              {currentOutputFormat.startsWith('json') && (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    queueInput('json-formatter', finalOutput);
                    router.push('/tools/json-formatter');
                  }}
                >
                  Continue in JSON Formatter →
                </button>
              )}

              {currentOutputFormat === 'markdown' && (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    queueInput('markdown-formatter', finalOutput);
                    router.push('/tools/markdown-formatter');
                  }}
                >
                  Continue in Markdown Formatter →
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '36px 0 16px', width: '100%' }}>
        <BannerAd size="leaderboard" />
      </div>

      {/* ---------------- 3. Recipe Management & Portability Panel ---------------- */}
      <section className={styles.panel} aria-labelledby="recipe-mgmt-heading">
        <div className={styles.panelHeader}>
          <h2 id="recipe-mgmt-heading" className={styles.panelTitle}>
            3 / Recipe Management & Portability
          </h2>
          <span className={styles.badge}>Zero-Input Privacy Guaranteed</span>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--secondary)' }}>
          Save recipes locally in browser storage, export as reusable JSON files, or share privacy-safe URL links.
          No input data or results are ever stored or transmitted.
        </p>

        {/* Action Buttons: Save, Export, Import File, Copy Link */}
        <div className={styles.runToolbar} style={{ marginTop: '0', marginBottom: '18px' }}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSaveRecipe}>
            💾 Save to Local Storage
          </button>

          <button
            type="button"
            className={styles.btn}
            disabled={!recipe.steps.length}
            onClick={handleExportJson}
          >
            ⬇ Export JSON File
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => fileInputRef.current?.click()}
          >
            ⬆ Import JSON File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileImport}
            aria-label="Upload recipe JSON file"
          />

          <button
            type="button"
            className={styles.btn}
            disabled={!recipe.steps.length}
            onClick={() => void handleCopyShareLink()}
          >
            🔗 Copy Share Link
          </button>
        </div>

        {/* Saved Recipes in Local Storage */}
        {savedRecipes.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <label className="field-label" style={{ fontSize: '12px' }}>
              Saved Recipes ({savedRecipes.length})
            </label>
            <div className={styles.savedList}>
              {savedRecipes.map(saved => (
                <div key={saved.id} className={styles.savedItem}>
                  <div className={styles.savedItemInfo}>
                    <span className={styles.savedItemName}>{saved.name}</span>
                    <span className={styles.savedItemMeta}>
                      {saved.recipe.steps.length} steps · Source: {saved.recipe.source} · Updated{' '}
                      {new Date(saved.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSmall}`}
                      onClick={() => handleLoadRecipe(saved)}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                      onClick={() => handleDeleteRecipe(saved.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual JSON Import Area */}
        <details style={{ marginTop: '14px', fontSize: '13px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, padding: '4px 0' }}>
            View Recipe JSON Schema / Paste Recipe
          </summary>
          <div style={{ marginTop: '10px' }}>
            <label htmlFor="recipe-import-text" className="field-label">
              Paste Recipe JSON
            </label>
            <textarea
              id="recipe-import-text"
              className={styles.textarea}
              style={{ minHeight: '120px' }}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="Paste recipe JSON object here…"
            />
            <div className={styles.runToolbar}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!importText.trim()}
                onClick={handlePasteImport}
              >
                Import Recipe JSON
              </button>
            </div>

            <label className="field-label" style={{ marginTop: '16px' }}>
              Current Pipeline Definition
            </label>
            <pre
              style={{
                background: 'var(--code)',
                color: 'var(--code-ink)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify({ ...recipe, name: recipeName }, null, 2)}
            </pre>
          </div>
        </details>
      </section>
    </div>
  );
}
