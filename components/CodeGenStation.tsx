"use client";

import { useState, useTransition, useEffect } from "react";
import { getCodeDefinition, type CodeToolId } from "@/config/code-tools";
import {
  jsonToTypescript,
  jsonToZod,
  jsonToGo,
  jsonToPydantic,
  jsonToRust,
  sqlToTypescript,
  htmlToJsx,
  svgToJsx,
} from "@/lib/tools/code-gen/engine";
import styles from "./CodeGenStation.module.css";

interface CodeGenStationProps {
  toolId: CodeToolId;
}

export default function CodeGenStation({ toolId }: CodeGenStationProps) {
  const definition = getCodeDefinition(toolId)!;
  const initialInput = (definition.localContract.defaults.input as string) || "";
  const initialName =
    (definition.localContract.defaults.rootName as string) ||
    (definition.localContract.defaults.componentName as string) ||
    "Root";

  const [input, setInput] = useState(initialInput);
  const [customName, setCustomName] = useState(initialName);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generateCode(source: string, name: string) {
    if (!source.trim()) {
      setOutput("");
      setError(null);
      return;
    }

    try {
      setError(null);
      let result = "";
      switch (toolId) {
        case "json-to-typescript":
          result = jsonToTypescript(source, name || "Root");
          break;
        case "json-to-zod":
          result = jsonToZod(source, name || "rootSchema");
          break;
        case "json-to-go":
          result = jsonToGo(source, name || "Root");
          break;
        case "json-to-pydantic":
          result = jsonToPydantic(source, name || "RootModel");
          break;
        case "json-to-rust":
          result = jsonToRust(source, name || "Root");
          break;
        case "sql-to-typescript":
          result = sqlToTypescript(source);
          break;
        case "html-to-jsx":
          result = htmlToJsx(source);
          break;
        case "svg-to-jsx":
          result = svgToJsx(source, name || "Icon");
          break;
        default:
          result = "";
      }
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setOutput("");
    }
  }

  useEffect(() => {
    generateCode(input, customName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  function handleInputChange(val: string) {
    setInput(val);
    startTransition(() => {
      generateCode(val, customName);
    });
  }

  function handleNameChange(val: string) {
    setCustomName(val);
    startTransition(() => {
      generateCode(input, val);
    });
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!output) return;
    const extensions: Record<CodeToolId, string> = {
      "json-to-typescript": "types.ts",
      "json-to-zod": "schema.ts",
      "json-to-go": "models.go",
      "json-to-pydantic": "models.py",
      "json-to-rust": "models.rs",
      "sql-to-typescript": "schema.ts",
      "html-to-jsx": "Component.jsx",
      "svg-to-jsx": `${customName || "Icon"}.tsx`,
    };

    const filename = extensions[toolId] || "code.txt";
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setInput(initialInput);
    setCustomName(initialName);
    generateCode(initialInput, initialName);
  }

  const lineCount = output ? output.split("\n").length : 0;
  const charCount = output.length;

  return (
    <div className={styles.container}>
      <div className={styles.editorGrid}>
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneTitle}>Source Input</span>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleReset}
              title="Reset to default example"
            >
              Reset Example
            </button>
          </div>

          {(toolId.startsWith("json-") || toolId === "svg-to-jsx") && (
            <div className={styles.inputField}>
              <label htmlFor="identifier-name">
                {toolId === "svg-to-jsx" ? "React Component Name" : "Root Type / Schema Name"}
              </label>
              <input
                id="identifier-name"
                type="text"
                className={styles.textInput}
                value={customName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={toolId === "svg-to-jsx" ? "e.g. CheckIcon" : "e.g. UserPayload"}
              />
            </div>
          )}

          <textarea
            className={styles.codeTextarea}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Paste code or JSON here..."
            spellCheck={false}
            aria-label="Source code input"
          />

          <div className={styles.buttonBar}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => generateCode(input, customName)}
            >
              Generate Code
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => {
                setInput("");
                setOutput("");
                setError(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneTitle}>Generated Output</span>
            <div className={styles.metaRow}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleCopy}
                disabled={!output}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleDownload}
                disabled={!output}
              >
                Download
              </button>
            </div>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <pre className={styles.outputArea} aria-label="Generated output">
            <code>{output || (error ? "// Error occurred during generation" : "// Output will appear here")}</code>
          </pre>

          {output && (
            <div className={styles.statsBar}>
              <span>{lineCount} lines</span>
              <span>{charCount} characters</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
