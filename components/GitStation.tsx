"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Download, GitBranch, RotateCcw } from "lucide-react";
import { getGitDefinition, gitTools, type GitToolId } from "@/config/git-tools";
import type { LocalField } from "@/config/local-contract";
import {
  GIT_INPUT_LIMIT,
  buildConventionalCommit,
  explainGitCommand,
  formatCommitBuilderOutput,
  formatGitCommandExplanation,
  generateChangelog,
  generateGitAttributes,
  generateGitHook,
  parseConventionalCommit,
  type GitAttributesEol,
  type GitHookType,
  type GitLinguistFlag,
} from "@/lib/tools/git";
import styles from "./GitStation.module.css";

type Output = {
  label: string;
  text: string;
  extension: "txt" | "md" | "sh";
  hint?: string;
};

const INPUT_LIMIT = GIT_INPUT_LIMIT;

function stringValue(values: Record<string, unknown>, key: string): string {
  const value = values[key];
  return typeof value === "string" ? value : "";
}

function computeOutput(toolId: GitToolId, values: Record<string, unknown>): Output {
  switch (toolId) {
    case "conventional-commit-builder": {
      const result = buildConventionalCommit({
        type: stringValue(values, "type"),
        scope: stringValue(values, "scope") || undefined,
        description: stringValue(values, "description"),
        body: stringValue(values, "body") || undefined,
        footer: stringValue(values, "footer") || undefined,
        breaking: Boolean(values.breaking),
        breakingDescription: stringValue(values, "breakingDescription") || undefined,
      });
      return { label: "Conventional commit message", text: formatCommitBuilderOutput(result), extension: "txt" };
    }
    case "conventional-commit-validator": {
      const parsed = parseConventionalCommit(stringValue(values, "message"));
      return {
        label: "Validation result",
        text: JSON.stringify(parsed, null, 2),
        extension: "txt",
        hint: parsed.valid ? "The message matches the Conventional Commits structure." : "Fix the listed errors and validate again.",
      };
    }
    case "git-command-explainer": {
      const explanation = explainGitCommand(stringValue(values, "command"));
      return {
        label: "Command explanation",
        text: formatGitCommandExplanation(explanation),
        extension: "txt",
        hint: explanation.risks.length
          ? `${explanation.risks.length} destructive-risk note${explanation.risks.length === 1 ? "" : "s"} found.`
          : "No configured destructive pattern detected.",
      };
    }
    case "changelog-generator": {
      const result = generateChangelog(stringValue(values, "log"));
      return {
        label: "Markdown changelog",
        text: result.markdown,
        extension: "md",
        hint: `${result.commitCount} commit${result.commitCount === 1 ? "" : "s"} · ${result.breakingCount} breaking change${result.breakingCount === 1 ? "" : "s"}.`,
      };
    }
    case "gitattributes-generator": {
      const result = generateGitAttributes({
        eol: (stringValue(values, "eol") || "auto") as GitAttributesEol,
        binaryGlobs: stringValue(values, "binaryGlobs") || undefined,
        linguistGlobs: stringValue(values, "linguistGlobs") || undefined,
        linguistFlag: (stringValue(values, "linguistFlag") || "none") as GitLinguistFlag,
        exportIgnore: stringValue(values, "exportIgnore") || undefined,
      });
      return {
        label: ".gitattributes content",
        text: result.content,
        extension: "txt",
        hint: `${result.ruleCount} rule${result.ruleCount === 1 ? "" : "s"}. Save as .gitattributes at the repository root.`,
      };
    }
    case "git-hooks-generator": {
      const result = generateGitHook({
        hook: (stringValue(values, "hook") || "pre-commit") as GitHookType,
        commands: stringValue(values, "commands"),
        failFast: values.failFast !== false,
      });
      return {
        label: `Shell script · ${result.filename}`,
        text: result.script,
        extension: "sh",
        hint: result.installInstructions,
      };
    }
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function downloadText(text: string, extension: Output["extension"], name: string) {
  const mime =
    extension === "md"
      ? "text/markdown;charset=utf-8"
      : extension === "sh"
        ? "text/x-shellscript;charset=utf-8"
        : "text/plain;charset=utf-8";
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function fieldHint(field: LocalField): string | undefined {
  if (field.control === "textarea") return "Text stays in this page. Maximum 200 KB.";
  if (field.control === "checkbox") return undefined;
  if (field.name === "eol") return "Applied to all text files unless a later rule overrides it.";
  if (field.name === "linguistFlag") return "Requires at least one linguist glob.";
  if (field.control === "select") return undefined;
  return field.optional ? "Optional." : undefined;
}

export default function GitStation({ toolId }: { toolId: GitToolId }) {
  const definition = getGitDefinition(toolId) ?? gitTools[0];
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...definition.localContract.defaults }));
  const [output, setOutput] = useState<Output | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const update = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setCopied(false);
  };

  const run = () => {
    setError(null);
    setCopied(false);
    try {
      setOutput(computeOutput(toolId, values));
    } catch (err) {
      setOutput(null);
      setError(err instanceof Error ? err.message : "Could not process this input.");
    }
  };

  const clear = () => {
    setValues({ ...definition.localContract.defaults });
    setOutput(null);
    setError(null);
    setCopied(false);
  };

  const copy = async () => {
    if (!output) return;
    try {
      await copyText(output.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy was blocked by the browser. Select the output and copy it manually.");
    }
  };

  const download = () => {
    if (!output) return;
    downloadText(output.text, output.extension, toolId);
  };

  return (
    <div
      className={styles.container}
      data-webmcp-station="git"
      data-webmcp-tool={`codestation_${toolId.replace(/-/g, "_")}`}
    >
      <div className={styles.stationHeader}>
        <div>
          <div className={styles.stationTitle}>
            <GitBranch size={24} color="var(--accent)" aria-hidden="true" />
            <h2>{definition.name}</h2>
            <span className={styles.stationBadge}>Station 27 · In-Browser</span>
          </div>
          <p className={styles.stationDescription}>{definition.description}</p>
        </div>
      </div>

      <nav className={styles.toolTabs} aria-label="Git &amp; Version Control tools">
        {gitTools.map((tool) => {
          const active = tool.id === toolId;
          return (
            <Link
              key={tool.id}
              href={`/tools/${tool.slug}`}
              className={`${styles.toolTab} ${active ? styles.activeTab : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {tool.name}
            </Link>
          );
        })}
      </nav>

      <p className={styles.notice}>
        <strong>Local-only processing.</strong> {definition.localContract.notices[0]}
      </p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <div className={styles.fields}>
          {definition.localContract.fields.map((field) => {
            const id = `${toolId}-${field.name}`;
            const hintId = `${id}-hint`;
            const hint = fieldHint(field);
            const common = { id, "aria-describedby": hint ? hintId : undefined };

            if (field.control === "checkbox") {
              return (
                <div className={styles.checkboxField} key={field.name}>
                  <input
                    {...common}
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    onChange={(event) => update(field.name, event.target.checked)}
                  />
                  <label htmlFor={id}>{field.label}</label>
                </div>
              );
            }

            return (
              <div className={styles.field} key={field.name}>
                <label className={styles.label} htmlFor={id}>
                  {field.label}
                </label>
                {field.control === "select" ? (
                  <select
                    {...common}
                    value={stringValue(values, field.name)}
                    onChange={(event) => update(field.name, event.target.value)}
                  >
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.control === "textarea" ? (
                  <textarea
                    {...common}
                    rows={field.name === "log" || field.name === "message" ? 9 : 4}
                    maxLength={INPUT_LIMIT}
                    value={stringValue(values, field.name)}
                    onChange={(event) => update(field.name, event.target.value)}
                  />
                ) : (
                  <input
                    {...common}
                    type="text"
                    maxLength={INPUT_LIMIT}
                    value={stringValue(values, field.name)}
                    onChange={(event) => update(field.name, event.target.value)}
                  />
                )}
                {hint && (
                  <p className={styles.hint} id={hintId}>
                    {hint}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.formActions}>
          <button className={styles.primaryButton} type="submit">
            {definition.localContract.action}
          </button>
          <button className={styles.secondaryButton} type="button" onClick={clear}>
            <RotateCcw size={15} aria-hidden="true" />
            Clear
          </button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>

      {output ? (
        <section className={styles.result} aria-labelledby={`${toolId}-result-title`}>
          <div className={styles.resultHead}>
            <div>
              <h3 id={`${toolId}-result-title`}>{output.label}</h3>
              {output.hint && <p className={styles.resultHint}>{output.hint}</p>}
            </div>
            <div className={styles.resultActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => void copy()}
                aria-label={`Copy ${output.label}`}
              >
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={download}
                aria-label={`Download ${toolId}.${output.extension}`}
              >
                <Download size={15} aria-hidden="true" />
                Download .{output.extension}
              </button>
            </div>
          </div>
          <pre className={styles.output}>{output.text}</pre>
        </section>
      ) : (
        <p className={styles.emptyResult} role="status">
          Choose or edit the inputs, then select {definition.localContract.action.toLowerCase()} to generate output.
        </p>
      )}
    </div>
  );
}
