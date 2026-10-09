"use client";

import { useState } from "react";
import { getExtendedDefinition, type ExtendedToolId } from "@/config/extended-tools";
import { curlToCode, type CurlTargetLanguage } from "@/lib/tools/curl-to-code";
import { auditEnv, formatEnvAuditReport, type EnvAuditResult } from "@/lib/tools/env-audit";
import { generateMockDataset, type MockDataOptions, type MockDatasetResult } from "@/lib/tools/mock-data";
import { parseAndResolveGitConflicts, formatConflictReport, type ConflictStrategy, type ConflictResolutionResult } from "@/lib/tools/git-conflict";
import styles from "./ExtendedStation.module.css";

function downloadFile(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExtendedStation({ toolId }: { toolId: ExtendedToolId }) {
  const definition = getExtendedDefinition(toolId)!;
  const defaults = definition.localContract.defaults;

  // cURL state
  const [curlInput, setCurlInput] = useState(String(defaults.curl ?? ""));
  const [curlTarget, setCurlTarget] = useState<CurlTargetLanguage>("fetch");
  const [curlOutput, setCurlOutput] = useState<{ code: string; warnings: string[] } | null>(null);

  // env-audit state
  const [envInput, setEnvInput] = useState(String(defaults.env ?? ""));
  const [exampleInput, setExampleInput] = useState(String(defaults.example ?? ""));
  const [envResult, setEnvResult] = useState<EnvAuditResult | null>(null);

  // mock-data state
  const [mockTemplate, setMockTemplate] = useState<"users" | "products" | "orders" | "custom">("users");
  const [mockCount, setMockCount] = useState(10);
  const [mockFormat, setMockFormat] = useState<"json" | "sql" | "csv">("json");
  const [mockSeed, setMockSeed] = useState("");
  const [mockResult, setMockResult] = useState<MockDatasetResult | null>(null);

  // conflict-parse state
  const [conflictInput, setConflictInput] = useState(String(defaults.content ?? ""));
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("analyze");
  const [conflictResult, setConflictResult] = useState<ConflictResolutionResult | null>(null);

  // Common UI state
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCopy(text: string, label = "Result") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setNotice(`${label} copied to clipboard.`);
      } else {
        setNotice("Clipboard API unavailable.");
      }
    } catch {
      setNotice("Failed to copy. Please select and copy manually.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      if (toolId === "curl-to-any-language") {
        const res = await curlToCode(curlInput, curlTarget);
        setCurlOutput(res);
        setNotice("Code generated successfully.");
      } else if (toolId === "env-audit") {
        const res = auditEnv(envInput, exampleInput.trim() ? exampleInput : undefined);
        setEnvResult(res);
        setNotice(res.isSecure ? "Environment audit passed (Secure)." : `Found ${res.stats.critical + res.stats.high} issues requiring attention.`);
      } else if (toolId === "mock-data") {
        const seedVal = mockSeed.trim() ? parseInt(mockSeed, 10) : undefined;
        const res = generateMockDataset({
          template: mockTemplate,
          count: mockCount,
          format: mockFormat,
          seed: seedVal,
        });
        setMockResult(res);
        setNotice(`Generated ${res.count} realistic ${mockTemplate} records.`);
      } else if (toolId === "conflict-parse") {
        const res = parseAndResolveGitConflicts(conflictInput, conflictStrategy);
        setConflictResult(res);
        setNotice(res.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`workbench-panel ${styles.station}`}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* cURL TO ANY LANGUAGE */}
        {toolId === "curl-to-any-language" && (
          <>
            <div className={styles.field}>
              <label htmlFor="curl-input">cURL Command</label>
              <textarea
                id="curl-input"
                value={curlInput}
                onChange={(e) => setCurlInput(e.target.value)}
                placeholder="curl -X POST https://api.example.com -d '{...}'"
                rows={5}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="curl-target">Target Language</label>
              <select
                id="curl-target"
                value={curlTarget}
                onChange={(e) => setCurlTarget(e.target.value as CurlTargetLanguage)}
              >
                <option value="fetch">TypeScript (Fetch API)</option>
                <option value="axios">TypeScript / JS (Axios)</option>
                <option value="python">Python (Requests)</option>
                <option value="go">Go (net/http)</option>
              </select>
            </div>
          </>
        )}

        {/* ENV AUDIT */}
        {toolId === "env-audit" && (
          <>
            <div className={styles.field}>
              <label htmlFor="env-input">.env / Config Content</label>
              <textarea
                id="env-input"
                value={envInput}
                onChange={(e) => setEnvInput(e.target.value)}
                placeholder="PORT=3000&#10;DATABASE_URL=postgres://...&#10;SECRET_KEY=..."
                rows={6}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="example-input">.env.example Content (Optional for discrepancy diff)</label>
              <textarea
                id="example-input"
                value={exampleInput}
                onChange={(e) => setExampleInput(e.target.value)}
                placeholder="PORT=&#10;DATABASE_URL=&#10;REQUIRED_API_KEY="
                rows={4}
              />
            </div>
          </>
        )}

        {/* MOCK DATA */}
        {toolId === "mock-data" && (
          <>
            <div className={styles.field}>
              <label htmlFor="mock-template">Dataset Template</label>
              <select
                id="mock-template"
                value={mockTemplate}
                onChange={(e) => setMockTemplate(e.target.value as any)}
              >
                <option value="users">Users (ID, Name, Email, Role, Status)</option>
                <option value="products">Products (SKU, Title, Category, Price, Stock)</option>
                <option value="orders">Orders (Order #, Customer, Total, Status)</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="mock-count">Record Count (1 to 1000)</label>
              <input
                id="mock-count"
                type="number"
                min={1}
                max={1000}
                value={mockCount}
                onChange={(e) => setMockCount(parseInt(e.target.value, 10) || 10)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="mock-format">Output Format</label>
              <select
                id="mock-format"
                value={mockFormat}
                onChange={(e) => setMockFormat(e.target.value as any)}
              >
                <option value="json">JSON Array</option>
                <option value="sql">SQL INSERT Statements</option>
                <option value="csv">CSV (Comma-Separated)</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="mock-seed">Deterministic Random Seed (Optional)</label>
              <input
                id="mock-seed"
                type="number"
                placeholder="e.g. 42 for repeatable test data"
                value={mockSeed}
                onChange={(e) => setMockSeed(e.target.value)}
              />
            </div>
          </>
        )}

        {/* GIT CONFLICT RESOLVER */}
        {toolId === "conflict-parse" && (
          <>
            <div className={styles.field}>
              <label htmlFor="conflict-input">Conflict File Content</label>
              <textarea
                id="conflict-input"
                value={conflictInput}
                onChange={(e) => setConflictInput(e.target.value)}
                placeholder="Paste code containing <<<<<<< HEAD ... ======= ... >>>>>>> markers"
                rows={7}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="conflict-strategy">Resolution Strategy</label>
              <select
                id="conflict-strategy"
                value={conflictStrategy}
                onChange={(e) => setConflictStrategy(e.target.value as ConflictStrategy)}
              >
                <option value="analyze">Analyze Only (Keep markers and inspect branches)</option>
                <option value="ours">Keep Ours (HEAD branch)</option>
                <option value="theirs">Keep Theirs (Incoming branch)</option>
                <option value="both">Keep Both (Ours followed by Theirs)</option>
              </select>
            </div>
          </>
        )}

        <div className={styles.actions}>
          <button type="submit" className="button" disabled={busy}>
            {definition.localContract.action}
          </button>
        </div>

        {notice && <p className={styles.noticeBar} role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      {/* RESULT DISPLAYS */}

      {/* cURL Results */}
      {toolId === "curl-to-any-language" && curlOutput && (
        <section className={styles.output}>
          <h2 className={styles.outputHeading}>Generated Code</h2>
          <pre><code>{curlOutput.code}</code></pre>
          {curlOutput.warnings.length > 0 && (
            <div>
              <h3>Notices &amp; Warnings:</h3>
              <ul>
                {curlOutput.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className="button secondary"
              onClick={() => handleCopy(curlOutput.code, "Generated code")}
            >
              Copy Code
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const ext = curlTarget === "python" ? "py" : curlTarget === "go" ? "go" : "ts";
                downloadFile(curlOutput.code, `api-request.${ext}`);
              }}
            >
              Download Code
            </button>
          </div>
        </section>
      )}

      {/* env-audit Results */}
      {toolId === "env-audit" && envResult && (
        <section className={styles.output}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <h2 className={styles.outputHeading}>Audit Results</h2>
            <span className={envResult.isSecure ? styles.badgeSecure : styles.badgeAlert}>
              {envResult.isSecure ? "PASS (Secure)" : "FAIL (Action Required)"}
            </span>
          </div>
          <p>{envResult.summary}</p>

          <div style={{ display: "grid", gap: "10px" }}>
            {envResult.findings.map((finding, idx) => (
              <div key={idx} className={styles.findingCard}>
                <div className={styles.findingHeader}>
                  <strong>{finding.key}{finding.line ? ` (Line ${finding.line})` : ""}</strong>
                  <span
                    className={`${styles.findingSeverity} ${
                      finding.severity === "CRITICAL"
                        ? styles.severityCritical
                        : finding.severity === "HIGH"
                        ? styles.severityHigh
                        : finding.severity === "MEDIUM"
                        ? styles.severityMedium
                        : styles.severityLow
                    }`}
                  >
                    {finding.severity}
                  </span>
                </div>
                <div>{finding.message}</div>
                {finding.maskedValue && <div><em>Value Preview:</em> <code>{finding.maskedValue}</code></div>}
                <div><small><strong>Remediation:</strong> {finding.recommendation}</small></div>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className="button secondary"
              onClick={() => handleCopy(formatEnvAuditReport(envResult), "Audit report")}
            >
              Copy Audit Report
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => downloadFile(formatEnvAuditReport(envResult), "env-audit-report.txt")}
            >
              Download Report
            </button>
          </div>
        </section>
      )}

      {/* mock-data Results */}
      {toolId === "mock-data" && mockResult && (
        <section className={styles.output}>
          <h2 className={styles.outputHeading}>Generated Records ({mockResult.count})</h2>
          <pre>
            <code>
              {mockFormat === "sql" && mockResult.sql
                ? mockResult.sql
                : mockFormat === "csv" && mockResult.csv
                ? mockResult.csv
                : mockResult.json}
            </code>
          </pre>
          <div className={styles.actions}>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const text = mockFormat === "sql" && mockResult.sql ? mockResult.sql : mockFormat === "csv" && mockResult.csv ? mockResult.csv : mockResult.json;
                handleCopy(text, "Dataset");
              }}
            >
              Copy Output
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const text = mockFormat === "sql" && mockResult.sql ? mockResult.sql : mockFormat === "csv" && mockResult.csv ? mockResult.csv : mockResult.json;
                const ext = mockFormat === "sql" ? "sql" : mockFormat === "csv" ? "csv" : "json";
                downloadFile(text, `mock-${mockTemplate}.${ext}`, ext === "json" ? "application/json" : "text/plain");
              }}
            >
              Download Output
            </button>
          </div>
        </section>
      )}

      {/* conflict-parse Results */}
      {toolId === "conflict-parse" && conflictResult && (
        <section className={styles.output}>
          <h2 className={styles.outputHeading}>
            {conflictResult.hasConflicts ? `Conflict Analysis (${conflictResult.conflictCount} Hunk${conflictResult.conflictCount === 1 ? "" : "s"})` : "No Conflicts Detected"}
          </h2>
          <p>{conflictResult.summary}</p>
          <pre>
            <code>
              {conflictStrategy === "analyze"
                ? formatConflictReport(conflictResult)
                : conflictResult.resolvedContent}
            </code>
          </pre>
          <div className={styles.actions}>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const text = conflictStrategy === "analyze" ? formatConflictReport(conflictResult) : (conflictResult.resolvedContent || "");
                handleCopy(text, "Conflict content");
              }}
            >
              Copy Output
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const text = conflictStrategy === "analyze" ? formatConflictReport(conflictResult) : (conflictResult.resolvedContent || "");
                downloadFile(text, conflictStrategy === "analyze" ? "conflict-report.txt" : "resolved-file.txt");
              }}
            >
              Download Output
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
