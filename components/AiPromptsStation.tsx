"use client";

import React, { useState, useMemo } from "react";
import {
  aiPromptsToolIds,
  type AiPromptsToolId,
  getAiPromptsDefinition,
} from "@/config/ai-prompts-tools";
import {
  countTokens,
  repairJson,
  interpolatePrompt,
  computeVectorSimilarity,
  buildSystemPrompt,
  MODEL_PRESETS,
  GUARDRAIL_PRESETS,
  SYSTEM_PROMPT_PRESETS,
  type AiModelId,
  type SystemPromptConfig,
} from "@/lib/tools/ai-prompts/engine";
import styles from "./AiPromptsStation.module.css";

interface AiPromptsStationProps {
  toolId?: AiPromptsToolId;
}

export default function AiPromptsStation({ toolId }: AiPromptsStationProps) {
  const [activeTool, setActiveTool] = useState<AiPromptsToolId>(toolId ?? "ai-token-counter");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Helper to copy text to clipboard with feedback
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper to download text as file
  const handleDownload = (content: string, filename: string, type = "text/plain") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // STATE: Tool 1 - AI Token Counter
  // ==========================================
  const sampleTokenText = `You are a Senior TypeScript Architect at Code Station.
Please review the following Next.js 15 App Router component:

\`\`\`tsx
export default async function DashboardPage() {
  const data = await fetchUserData();
  return <UserMetrics data={data} />;
}
\`\`\`

Ensure it supports 100% in-browser WebMCP execution with zero telemetry.
What are the performance implications? Don't forget edge cases! 🚀`;

  const [tokenInput, setTokenInput] = useState(sampleTokenText);
  const [selectedModel, setSelectedModel] = useState<AiModelId>("gpt-4o");
  const activeModelPreset = MODEL_PRESETS.find((p) => p.id === selectedModel) || MODEL_PRESETS[0];
  const [inputPrice, setInputPrice] = useState<number>(activeModelPreset.defaultInputPer1M);
  const [outputPrice, setOutputPrice] = useState<number>(activeModelPreset.defaultOutputPer1M);
  const [tokenViewMode, setTokenViewMode] = useState<"visual" | "table">("visual");

  const tokenResults = useMemo(() => {
    return countTokens(tokenInput, selectedModel, {
      inputPricePer1M: inputPrice,
      outputPricePer1M: outputPrice,
    });
  }, [tokenInput, selectedModel, inputPrice, outputPrice]);

  // ==========================================
  // STATE: Tool 2 - LLM JSON Repair
  // ==========================================
  const sampleBrokenJson1 = `\`\`\`json
// Server configuration payload
{
  name: 'code-station-agent',
  active: True,
  retryCount: 3,
  debug: None,
  tags: [
    'nextjs',
    'typescript',
    'in-browser',
  ],
}
\`\`\``;

  const sampleBrokenJson2 = `Here is the user record:
{
  id: 1042,
  user: {
    first_name: "Alice",
    last_name: "Smith",
    roles: ["admin", "developer"`;

  const [jsonInput, setJsonInput] = useState(sampleBrokenJson1);
  const [jsonIndent, setJsonIndent] = useState<number | "compact">(2);

  const jsonRepairResult = useMemo(() => {
    return repairJson(jsonInput, { indent: jsonIndent });
  }, [jsonInput, jsonIndent]);

  // ==========================================
  // STATE: Tool 3 - Prompt Interpolator
  // ==========================================
  const defaultSysTemplate = "You are a {{role}} at {{company}}. Tone: {{tone}}.";
  const defaultUserTemplate = "Write a {{type}} explaining {topic} to a {audience} in {word_count} words.";
  const defaultRecords: Record<string, string>[] = [
    {
      role: "Lead Systems Architect",
      company: "Code Station",
      tone: "Concise & Technical",
      type: "technical brief",
      topic: "Web Crypto AES-GCM",
      audience: "senior engineers",
      word_count: "150",
    },
    {
      role: "Developer Advocate",
      company: "Next.js Labs",
      tone: "Friendly & Engaging",
      type: "tutorial intro",
      topic: "React 19 Server Actions",
      audience: "frontend developers",
      word_count: "200",
    },
    {
      role: "Security Researcher",
      company: "Zero Trust Org",
      tone: "Strict & Analytical",
      type: "advisory",
      topic: "Client-side JWT validation",
      audience: "DevOps leads",
      word_count: "100",
    },
  ];

  const [promptSysTemplate, setPromptSysTemplate] = useState(defaultSysTemplate);
  const [promptUserTemplate, setPromptUserTemplate] = useState(defaultUserTemplate);
  const [records, setRecords] = useState<Record<string, string>[]>(defaultRecords);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [exportFormat, setExportFormat] = useState<"preview" | "openai" | "anthropic" | "markdown">("preview");

  const interpolationResults = useMemo(() => {
    return interpolatePrompt({
      template: promptUserTemplate,
      systemTemplate: promptSysTemplate,
      records,
    });
  }, [promptUserTemplate, promptSysTemplate, records]);

  // ==========================================
  // STATE: Tool 4 - Vector Similarity
  // ==========================================
  const [vecAInput, setVecAInput] = useState("[0.35, 0.72, -0.41, 0.88, 0.12, -0.65]");
  const [vecBInput, setVecBInput] = useState("[0.31, 0.69, -0.45, 0.82, 0.19, -0.58]");

  const vectorResult = useMemo(() => {
    try {
      const res = computeVectorSimilarity(vecAInput, vecBInput);
      return { data: res, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [vecAInput, vecBInput]);

  // ==========================================
  // STATE: Tool 5 - System Prompt Builder
  // ==========================================
  const [systemConfig, setSystemConfig] = useState<SystemPromptConfig>(SYSTEM_PROMPT_PRESETS[0].config);

  const builtSystemPrompt = useMemo(() => {
    return buildSystemPrompt(systemConfig);
  }, [systemConfig]);

  const activeDef = getAiPromptsDefinition(activeTool);

  return (
    <div className={styles.container} data-webmcp-station="ai-prompts">
      {/* Station Navigation Header */}
      <header className={styles.stationHeader}>
        <div>
          <div className={styles.stationTitle}>
            <span className={styles.stationBadge}>Station 25</span>
            <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "-0.03em" }}>
              AI &amp; Prompt Engineering
            </h1>
          </div>
          <p className={styles.stationDescription}>
            In-browser token estimation, LLM JSON repair, prompt template interpolation, vector geometries, and pattern builder.
          </p>
        </div>
      </header>

      {/* Tool Selector Tabs */}
      <nav className={styles.toolTabs} aria-label="AI & Prompt Engineering Tools">
        {aiPromptsToolIds.map((id) => {
          const def = getAiPromptsDefinition(id);
          const isActive = activeTool === id;
          return (
            <button
              key={id}
              type="button"
              className={`${styles.toolTab} ${isActive ? styles.activeTab : ""}`}
              onClick={() => setActiveTool(id)}
              aria-selected={isActive}
            >
              {id === "ai-token-counter" && "🔢"}
              {id === "json-repair" && "🔧"}
              {id === "prompt-interpolator" && "📋"}
              {id === "vector-similarity" && "📐"}
              {id === "system-prompt-builder" && "✨"}
              <span>{def?.name.split("&")[0].trim() || id}</span>
            </button>
          );
        })}
      </nav>

      {/* ================================================================ */}
      {/* 1. AI TOKEN COUNTER WORKSPACE                                     */}
      {/* ================================================================ */}
      {activeTool === "ai-token-counter" && (
        <section
          className={styles.panel}
          data-webmcp-tool="ai-token-counter"
          data-webmcp-category="AI & Prompt Engineering"
          data-webmcp-slug="ai-token-counter"
        >
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>AI Token Counter &amp; Visual Boundaries</h2>
              <span className={styles.panelSubtitle}>
                Model-specific BPE estimation, alternating visual token boundaries, and API cost estimation.
              </span>
            </div>
            <div className={styles.controlsBar}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setTokenInput(sampleTokenText)}
              >
                Sample Prompt
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={() => setTokenInput("")}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Model & Pricing Configuration Row */}
          <div className={styles.formRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="token-model-select">
                Target Model Family
              </label>
              <select
                id="token-model-select"
                className={styles.select}
                value={selectedModel}
                onChange={(e) => {
                  const m = e.target.value as AiModelId;
                  setSelectedModel(m);
                  const p = MODEL_PRESETS.find((preset) => preset.id === m);
                  if (p) {
                    setInputPrice(p.defaultInputPer1M);
                    setOutputPrice(p.defaultOutputPer1M);
                  }
                }}
              >
                {MODEL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.family})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="token-input-price">
                Input Price ($/1M tokens)
              </label>
              <input
                id="token-input-price"
                type="number"
                step="0.01"
                min="0"
                className={styles.input}
                value={inputPrice}
                onChange={(e) => setInputPrice(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="token-output-price">
                Output Price ($/1M tokens)
              </label>
              <input
                id="token-output-price"
                type="number"
                step="0.01"
                min="0"
                className={styles.input}
                value={outputPrice}
                onChange={(e) => setOutputPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Prompt / Text Input */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="token-text-input">
              <span>Text / Prompt to Tokenize</span>
              <span>{tokenInput.length} characters</span>
            </label>
            <textarea
              id="token-text-input"
              className={styles.textarea}
              placeholder="Paste prompt, markdown, or code here to inspect tokens..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
          </div>

          {/* Metric Stats Cards */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Total Tokens</span>
              <span className={styles.metricValue}>{tokenResults.tokenCount.toLocaleString()}</span>
              <span className={styles.metricSubtext}>~{tokenResults.charsPerToken} chars/token</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Characters</span>
              <span className={styles.metricValue}>{tokenResults.charCount.toLocaleString()}</span>
              <span className={styles.metricSubtext}>{tokenResults.wordCount} words</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Lines</span>
              <span className={styles.metricValue}>{tokenResults.lineCount}</span>
              <span className={styles.metricSubtext}>paragraphs &amp; code</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Est. Input Cost</span>
              <span className={styles.metricValue}>${tokenResults.estimatedInputCost.toFixed(5)}</span>
              <span className={styles.metricSubtext}>at ${inputPrice}/1M</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Est. Output Cost</span>
              <span className={styles.metricValue}>${tokenResults.estimatedOutputCost.toFixed(5)}</span>
              <span className={styles.metricSubtext}>at ${outputPrice}/1M</span>
            </div>
          </div>

          {/* Visual Token Boundaries Viewer */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                Token Boundaries Breakdown ({tokenResults.fragments.length} fragments)
              </span>
              <div className={styles.controlsBar}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSmall} ${tokenViewMode === "visual" ? styles.buttonPrimary : ""}`}
                  onClick={() => setTokenViewMode("visual")}
                >
                  Visual Tints
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSmall} ${tokenViewMode === "table" ? styles.buttonPrimary : ""}`}
                  onClick={() => setTokenViewMode("table")}
                >
                  Token Table
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSmall}`}
                  onClick={() => handleCopy(tokenInput, "tokens-raw")}
                >
                  {copiedKey === "tokens-raw" ? "Copied!" : "Copy Text"}
                </button>
              </div>
            </div>

            {tokenViewMode === "visual" ? (
              <div className={styles.tokenViewerContainer} aria-label="Visual token fragments">
                {tokenResults.fragments.length === 0 ? (
                  <span style={{ color: "var(--muted)" }}>Enter text above to see visual token boundaries...</span>
                ) : (
                  tokenResults.fragments.map((fragment) => {
                    const tintClass = styles[`tokenTint${fragment.index % 5}` as keyof typeof styles];
                    return (
                      <span
                        key={fragment.index}
                        className={`${styles.tokenFragment} ${tintClass}`}
                        title={`Token #${fragment.index + 1}: "${fragment.text}" (Chars ${fragment.charStart}..${fragment.charEnd})`}
                      >
                        {fragment.text}
                      </span>
                    );
                  })
                )}
              </div>
            ) : (
              <div className={styles.recordsTableWrapper} style={{ maxHeight: 300 }}>
                <table className={styles.recordsTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th>Token Text</th>
                      <th style={{ width: 80 }}>Length</th>
                      <th style={{ width: 100 }}>Offset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenResults.fragments.slice(0, 200).map((f) => (
                      <tr key={f.index}>
                        <td>{f.index + 1}</td>
                        <td style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{JSON.stringify(f.text)}</td>
                        <td>{f.text.length}</td>
                        <td>{f.charStart}..{f.charEnd}</td>
                      </tr>
                    ))}
                    {tokenResults.fragments.length > 200 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                          Showing first 200 of {tokenResults.fragments.length} tokens.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* 2. LLM JSON REPAIR WORKSPACE                                      */}
      {/* ================================================================ */}
      {activeTool === "json-repair" && (
        <section
          className={styles.panel}
          data-webmcp-tool="json-repair"
          data-webmcp-category="AI & Prompt Engineering"
          data-webmcp-slug="json-repair"
        >
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>LLM JSON Repair &amp; Syntax Fixer</h2>
              <span className={styles.panelSubtitle}>
                Automatically strips markdown fences, fixes Python literals, repairs comments, quotes keys, and balances truncated braces.
              </span>
            </div>
            <div className={styles.controlsBar}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setJsonInput(sampleBrokenJson1)}
              >
                Sample: Fences &amp; Literals
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => setJsonInput(sampleBrokenJson2)}
              >
                Sample: Truncated Cutoff
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={() => setJsonInput("")}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Indentation Option */}
          <div className={styles.formRow}>
            <div className={styles.fieldGroup} style={{ maxWidth: 220 }}>
              <label className={styles.fieldLabel} htmlFor="json-indent-select">
                Output Indentation
              </label>
              <select
                id="json-indent-select"
                className={styles.select}
                value={String(jsonIndent)}
                onChange={(e) => {
                  const val = e.target.value;
                  setJsonIndent(val === "compact" ? "compact" : parseInt(val, 10));
                }}
              >
                <option value="2">2 spaces (Standard)</option>
                <option value="4">4 spaces</option>
                <option value="compact">Compact (Minified)</option>
              </select>
            </div>
          </div>

          {/* Status & Applied Repairs Summary */}
          {jsonRepairResult.success ? (
            <div className={styles.bannerSuccess}>
              <span>✓</span>
              <div>
                <strong>Valid RFC-8259 JSON Repaired Successfully</strong>
                <div className={styles.repairPills}>
                  {jsonRepairResult.repairsApplied.map((rep, idx) => (
                    <span key={idx} className={styles.repairPill}>
                      {rep}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.bannerError}>
              <span>⚠</span>
              <div>
                <strong>Could not completely parse JSON</strong>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.78rem" }}>{jsonRepairResult.error}</p>
              </div>
            </div>
          )}

          {/* Side-by-Side Original vs Repaired View */}
          <div className={styles.sideBySide}>
            <div className={styles.diffColumn}>
              <div className={styles.diffColumnHeader}>
                <span>Original Malformed Input ({jsonInput.length} chars)</span>
              </div>
              <textarea
                className={styles.textarea}
                style={{ height: 320 }}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste malformed LLM JSON output here..."
              />
            </div>

            <div className={styles.diffColumn}>
              <div className={styles.diffColumnHeader}>
                <span>Repaired Clean Output ({jsonRepairResult.repaired.length} chars)</span>
                <div className={styles.controlsBar}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSmall}`}
                    onClick={() => handleCopy(jsonRepairResult.repaired, "repaired-json")}
                  >
                    {copiedKey === "repaired-json" ? "Copied!" : "Copy JSON"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSmall}`}
                    onClick={() => handleDownload(jsonRepairResult.repaired, "repaired.json", "application/json")}
                  >
                    Download
                  </button>
                </div>
              </div>
              <textarea
                className={styles.textarea}
                style={{ height: 320 }}
                readOnly
                value={jsonRepairResult.repaired}
              />
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* 3. PROMPT INTERPOLATOR WORKSPACE                                  */}
      {/* ================================================================ */}
      {activeTool === "prompt-interpolator" && (
        <section
          className={styles.panel}
          data-webmcp-tool="prompt-interpolator"
          data-webmcp-category="AI & Prompt Engineering"
          data-webmcp-slug="prompt-interpolator"
        >
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Prompt Template Interpolator &amp; Test Matrix</h2>
              <span className={styles.panelSubtitle}>
                Interpolate Mustache <code>{"{{variable}}"}</code> and single-brace <code>{"{variable}"}</code> across test records. Formats OpenAI &amp; Anthropic API messages.
              </span>
            </div>
            <div className={styles.controlsBar}>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setPromptSysTemplate(defaultSysTemplate);
                  setPromptUserTemplate(defaultUserTemplate);
                  setRecords(defaultRecords);
                }}
              >
                Reset Defaults
              </button>
            </div>
          </div>

          {/* Detected Variables Pills */}
          <div>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, marginRight: "0.5rem" }}>
              Detected Variables ({interpolationResults.variables.length}):
            </span>
            <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {interpolationResults.variables.map((v) => (
                <span key={v} className={styles.varBadge}>
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>

          {/* Template Role Editors */}
          <div className={styles.sideBySide}>
            <div className={styles.diffColumn}>
              <label className={styles.fieldLabel} htmlFor="prompt-sys-input">
                System Message Template (Optional)
              </label>
              <textarea
                id="prompt-sys-input"
                className={styles.textarea}
                style={{ minHeight: 90 }}
                value={promptSysTemplate}
                onChange={(e) => setPromptSysTemplate(e.target.value)}
              />
            </div>

            <div className={styles.diffColumn}>
              <label className={styles.fieldLabel} htmlFor="prompt-user-input">
                User Message Template (Main)
              </label>
              <textarea
                id="prompt-user-input"
                className={styles.textarea}
                style={{ minHeight: 90 }}
                value={promptUserTemplate}
                onChange={(e) => setPromptUserTemplate(e.target.value)}
              />
            </div>
          </div>

          {/* Test Records Dataset Table */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                Test Records Matrix ({records.length} records)
              </span>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSmall} ${styles.buttonPrimary}`}
                onClick={() => {
                  const newRec: Record<string, string> = {};
                  interpolationResults.variables.forEach((v) => {
                    newRec[v] = `test_${v}`;
                  });
                  setRecords([...records, newRec]);
                  setSelectedRecordIndex(records.length);
                }}
              >
                + Add Record
              </button>
            </div>

            <div className={styles.recordsTableWrapper}>
              <table className={styles.recordsTable}>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>#</th>
                    {interpolationResults.variables.map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                    <th style={{ width: 70 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        background: rIdx === selectedRecordIndex ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined,
                      }}
                    >
                      <td>
                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontWeight: rIdx === selectedRecordIndex ? "800" : "500",
                          }}
                          onClick={() => setSelectedRecordIndex(rIdx)}
                        >
                          {rIdx + 1}
                        </button>
                      </td>
                      {interpolationResults.variables.map((v) => (
                        <td key={v}>
                          <input
                            type="text"
                            value={rec[v] || ""}
                            onChange={(e) => {
                              const updated = [...records];
                              updated[rIdx] = { ...updated[rIdx], [v]: e.target.value };
                              setRecords(updated);
                            }}
                          />
                        </td>
                      ))}
                      <td>
                        {records.length > 1 && (
                          <button
                            type="button"
                            className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}
                            onClick={() => {
                              const filtered = records.filter((_, i) => i !== rIdx);
                              setRecords(filtered);
                              if (selectedRecordIndex >= filtered.length) {
                                setSelectedRecordIndex(Math.max(0, filtered.length - 1));
                              }
                            }}
                          >
                            Del
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interpolated Preview & API Export Section */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Export &amp; Preview:</span>
                <select
                  className={styles.select}
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                >
                  <option value="preview">Live Bubble Preview</option>
                  <option value="openai">OpenAI Chat API JSON</option>
                  <option value="anthropic">Anthropic Messages API JSON</option>
                  <option value="markdown">Markdown Transcript</option>
                </select>
              </div>

              {exportFormat === "preview" && (
                <div className={styles.controlsBar}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSmall}`}
                    disabled={selectedRecordIndex <= 0}
                    onClick={() => setSelectedRecordIndex((i) => Math.max(0, i - 1))}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                    Record {selectedRecordIndex + 1} of {records.length}
                  </span>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSmall}`}
                    disabled={selectedRecordIndex >= records.length - 1}
                    onClick={() => setSelectedRecordIndex((i) => Math.min(records.length - 1, i + 1))}
                  >
                    Next →
                  </button>
                </div>
              )}

              <div className={styles.controlsBar}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSmall}`}
                  onClick={() => {
                    const text =
                      exportFormat === "openai"
                        ? interpolationResults.openAiExport
                        : exportFormat === "anthropic"
                        ? interpolationResults.anthropicExport
                        : exportFormat === "markdown"
                        ? interpolationResults.markdownExport
                        : JSON.stringify(interpolationResults.results[selectedRecordIndex]?.messages, null, 2);
                    handleCopy(text, "export-prompt");
                  }}
                >
                  {copiedKey === "export-prompt" ? "Copied!" : "Copy Output"}
                </button>
              </div>
            </div>

            {exportFormat === "preview" ? (
              <div className={styles.panel} style={{ background: "var(--surface-alt)" }}>
                {interpolationResults.results[selectedRecordIndex]?.messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                      {msg.role}
                    </div>
                    <div
                      style={{
                        padding: "0.6rem 0.85rem",
                        borderRadius: "6px",
                        background: msg.role === "system" ? "var(--canvas)" : "var(--surface)",
                        border: "1px solid var(--line)",
                        fontSize: "0.85rem",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                className={styles.textarea}
                style={{ height: 260 }}
                readOnly
                value={
                  exportFormat === "openai"
                    ? interpolationResults.openAiExport
                    : exportFormat === "anthropic"
                    ? interpolationResults.anthropicExport
                    : interpolationResults.markdownExport
                }
              />
            )}
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* 4. VECTOR SIMILARITY & DISTANCE WORKSPACE                         */}
      {/* ================================================================ */}
      {activeTool === "vector-similarity" && (
        <section
          className={styles.panel}
          data-webmcp-tool="vector-similarity"
          data-webmcp-category="AI & Prompt Engineering"
          data-webmcp-slug="vector-similarity"
        >
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Vector Similarity &amp; Geometry Calculator</h2>
              <span className={styles.panelSubtitle}>
                Compare embedding vectors using Cosine similarity, Euclidean distance (L2), Dot product, Manhattan distance (L1), angles, and dimensional breakdown.
              </span>
            </div>
            <div className={styles.controlsBar}>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setVecAInput("[0.92, 0.45, -0.15, 0.77, 0.33]");
                  setVecBInput("[0.88, 0.42, -0.12, 0.81, 0.30]");
                }}
              >
                High Match (~99%)
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setVecAInput("[1, 0, 0, 0]");
                  setVecBInput("[0, 1, 0, 0]");
                }}
              >
                Orthogonal (90°)
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setVecAInput("[0.5, 0.5, 0.5]");
                  setVecBInput("[-0.5, -0.5, -0.5]");
                }}
              >
                Opposite (180°)
              </button>
            </div>
          </div>

          {/* Vector Inputs Row */}
          <div className={styles.sideBySide}>
            <div className={styles.diffColumn}>
              <label className={styles.fieldLabel} htmlFor="vec-a-input">
                Vector A (JSON array, comma or space-separated)
              </label>
              <textarea
                id="vec-a-input"
                className={styles.textarea}
                style={{ height: 100 }}
                value={vecAInput}
                onChange={(e) => setVecAInput(e.target.value)}
              />
            </div>

            <div className={styles.diffColumn}>
              <label className={styles.fieldLabel} htmlFor="vec-b-input">
                Vector B (JSON array, comma or space-separated)
              </label>
              <textarea
                id="vec-b-input"
                className={styles.textarea}
                style={{ height: 100 }}
                value={vecBInput}
                onChange={(e) => setVecBInput(e.target.value)}
              />
            </div>
          </div>

          {/* Error Banner */}
          {vectorResult.error && (
            <div className={styles.bannerError}>
              <span>⚠</span>
              <span>{vectorResult.error}</span>
            </div>
          )}

          {/* Results Overview */}
          {vectorResult.data && (
            <>
              {/* Main Metric Highlight */}
              <div style={{ background: "var(--surface-alt)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      Cosine Similarity
                    </span>
                    <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--ink)", fontFamily: "monospace" }}>
                      {vectorResult.data.cosineSimilarity.toFixed(4)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--green)" }}>
                      {vectorResult.data.similarityPercentage}% Match
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Angle: {vectorResult.data.angleDegrees}° ({vectorResult.data.angleRadians.toFixed(3)} rad)
                    </div>
                  </div>
                </div>

                <div className={styles.similarityBarContainer}>
                  <div
                    className={styles.similarityBarFill}
                    style={{ width: `${Math.max(0, Math.min(100, vectorResult.data.similarityPercentage))}%` }}
                  />
                </div>
              </div>

              {/* Geometric Metrics Grid */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Dimensions</span>
                  <span className={styles.metricValue}>{vectorResult.data.dimensions}</span>
                  <span className={styles.metricSubtext}>Vector Length</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Euclidean (L2)</span>
                  <span className={styles.metricValue}>{vectorResult.data.euclideanDistance.toFixed(4)}</span>
                  <span className={styles.metricSubtext}>Straight-line distance</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Dot Product</span>
                  <span className={styles.metricValue}>{vectorResult.data.dotProduct.toFixed(4)}</span>
                  <span className={styles.metricSubtext}>A · B</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Manhattan (L1)</span>
                  <span className={styles.metricValue}>{vectorResult.data.manhattanDistance.toFixed(4)}</span>
                  <span className={styles.metricSubtext}>Sum of abs deltas</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Chebyshev</span>
                  <span className={styles.metricValue}>{vectorResult.data.chebyshevDistance.toFixed(4)}</span>
                  <span className={styles.metricSubtext}>Max single delta</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Norms (||A||, ||B||)</span>
                  <span className={styles.metricValue} style={{ fontSize: "1rem" }}>
                    {vectorResult.data.normA.toFixed(2)}, {vectorResult.data.normB.toFixed(2)}
                  </span>
                  <span className={styles.metricSubtext}>Magnitudes</span>
                </div>
              </div>

              {/* Dimensional Contribution Breakdown */}
              <div>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem", display: "block" }}>
                  Component Contribution Breakdown (Top Dimensions)
                </span>
                <div className={styles.recordsTableWrapper}>
                  <table className={styles.dimTable}>
                    <thead>
                      <tr>
                        <th>Dim #</th>
                        <th>A[i]</th>
                        <th>B[i]</th>
                        <th>Product (A[i] × B[i])</th>
                        <th>Delta |A[i] - B[i]|</th>
                        <th>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vectorResult.data.dimensionBreakdown.slice(0, 10).map((d) => (
                        <tr key={d.index} className={d.product > 0 ? styles.positiveRow : d.product < 0 ? styles.negativeRow : undefined}>
                          <td>Dim {d.index}</td>
                          <td>{d.valA.toFixed(4)}</td>
                          <td>{d.valB.toFixed(4)}</td>
                          <td>{d.product > 0 ? `+${d.product.toFixed(4)}` : d.product.toFixed(4)}</td>
                          <td>{d.delta.toFixed(4)}</td>
                          <td>{d.product > 0 ? "Positive (aligned)" : d.product < 0 ? "Negative (divergent)" : "Neutral"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ================================================================ */}
      {/* 5. SYSTEM PROMPT BUILDER WORKSPACE                                */}
      {/* ================================================================ */}
      {activeTool === "system-prompt-builder" && (
        <section
          className={styles.panel}
          data-webmcp-tool="system-prompt-builder"
          data-webmcp-category="AI & Prompt Engineering"
          data-webmcp-slug="system-prompt-builder"
        >
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>System Prompt Pattern Builder &amp; Optimizer</h2>
              <span className={styles.panelSubtitle}>
                Construct modular system prompts with Anthropic XML tags, negative guardrails, chain-of-thought scratchpad, and few-shot examples.
              </span>
            </div>
            <div className={styles.controlsBar}>
              <select
                className={styles.select}
                onChange={(e) => {
                  const preset = SYSTEM_PROMPT_PRESETS.find((p) => p.name === e.target.value);
                  if (preset) setSystemConfig(preset.config);
                }}
              >
                <option value="">Load Preset Template...</option>
                {SYSTEM_PROMPT_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Configuration Form */}
          <div className={styles.formRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="builder-role-name">
                Agent Role / Title
              </label>
              <input
                id="builder-role-name"
                type="text"
                className={styles.input}
                value={systemConfig.roleName}
                onChange={(e) => setSystemConfig({ ...systemConfig, roleName: e.target.value })}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="builder-role-tone">
                Tone &amp; Style
              </label>
              <select
                id="builder-role-tone"
                className={styles.select}
                value={systemConfig.roleTone}
                onChange={(e) => setSystemConfig({ ...systemConfig, roleTone: e.target.value })}
              >
                <option value="Senior Technical & Direct">Senior Technical &amp; Direct</option>
                <option value="Concise & Minimal">Concise &amp; Minimal</option>
                <option value="Socratic & Inquisitive">Socratic &amp; Inquisitive</option>
                <option value="Strict & Analytical">Strict &amp; Analytical</option>
                <option value="Warm & Encouraging">Warm &amp; Encouraging</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="builder-output-format">
                Output Format Specification
              </label>
              <select
                id="builder-output-format"
                className={styles.select}
                value={systemConfig.outputFormat}
                onChange={(e) => setSystemConfig({ ...systemConfig, outputFormat: e.target.value as any })}
              >
                <option value="json">JSON Object (RFC-8259)</option>
                <option value="markdown">Markdown Document</option>
                <option value="code">Code Only (No Explanations)</option>
                <option value="plain">Plain Text</option>
                <option value="custom">Custom Format / Schema</option>
              </select>
            </div>
          </div>

          {/* Background & Core Mission */}
          <div className={styles.formRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="builder-role-bg">
                Persona Background &amp; Expertise
              </label>
              <input
                id="builder-role-bg"
                type="text"
                className={styles.input}
                value={systemConfig.background || ""}
                onChange={(e) => setSystemConfig({ ...systemConfig, background: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="builder-core-task">
              Core Mission &amp; Instructions
            </label>
            <textarea
              id="builder-core-task"
              className={styles.textarea}
              style={{ minHeight: 90 }}
              value={systemConfig.coreTask}
              onChange={(e) => setSystemConfig({ ...systemConfig, coreTask: e.target.value })}
            />
          </div>

          {/* Pattern Toggles: XML Tag Wrapping & Chain of Thought */}
          <div className={styles.formRow}>
            <label className={styles.checkboxLabel} style={{ fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={systemConfig.xmlWrapping}
                onChange={(e) => setSystemConfig({ ...systemConfig, xmlWrapping: e.target.checked })}
              />
              <span>Wrap sections in Claude/Anthropic XML Tags (e.g. &lt;role&gt;, &lt;instructions&gt;)</span>
            </label>

            <label className={styles.checkboxLabel} style={{ fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={systemConfig.chainOfThought}
                onChange={(e) => setSystemConfig({ ...systemConfig, chainOfThought: e.target.checked })}
              />
              <span>Require step-by-step reasoning in &lt;thinking&gt; scratchpad</span>
            </label>
          </div>

          {/* Guardrails Checklist */}
          <div>
            <label className={styles.fieldLabel} style={{ marginBottom: "0.5rem" }}>
              Negative Constraints &amp; Guardrails Checklist
            </label>
            <div className={styles.checkboxGrid}>
              {GUARDRAIL_PRESETS.map((guardrail) => {
                const checked = systemConfig.guardrails.includes(guardrail);
                return (
                  <label key={guardrail} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...systemConfig.guardrails, guardrail]
                          : systemConfig.guardrails.filter((g) => g !== guardrail);
                        setSystemConfig({ ...systemConfig, guardrails: updated });
                      }}
                    />
                    <span>{guardrail}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Live Assembled Prompt Preview */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Assembled System Prompt</span>
                <span className={styles.stationBadge}>~{builtSystemPrompt.tokenCount} tokens</span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {builtSystemPrompt.charCount} chars · {builtSystemPrompt.wordCount} words
                </span>
              </div>
              <div className={styles.controlsBar}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSmall} ${styles.buttonPrimary}`}
                  onClick={() => handleCopy(builtSystemPrompt.assembledPrompt, "system-prompt")}
                >
                  {copiedKey === "system-prompt" ? "Copied!" : "Copy System Prompt"}
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSmall}`}
                  onClick={() => handleDownload(builtSystemPrompt.assembledPrompt, "system-prompt.txt")}
                >
                  Download .txt
                </button>
              </div>
            </div>

            <textarea
              className={styles.textarea}
              style={{ minHeight: 280 }}
              readOnly
              value={builtSystemPrompt.assembledPrompt}
            />
          </div>
        </section>
      )}
    </div>
  );
}
