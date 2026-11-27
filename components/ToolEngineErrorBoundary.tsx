"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import {
  formatDiagnosticsBugReport,
  recordEngineDiagnostic,
  type EngineDiagnosticEvent,
} from "@/lib/engine/diagnostics";
import styles from "./FallbackPages.module.css";

interface ToolEngineErrorBoundaryProps {
  toolSlug: string;
  children: ReactNode;
}

interface ToolEngineErrorBoundaryState {
  hasError: boolean;
  diagnostic: EngineDiagnosticEvent | null;
  copied: boolean;
  copyStatus: string;
}

/**
 * Privacy-first React error boundary for tool workspaces.
 * Records sanitized crash metadata (tool slug, stage, sanitized error name/message,
 * app version) without ever capturing tool inputs or outputs.
 */
export default class ToolEngineErrorBoundary extends Component<
  ToolEngineErrorBoundaryProps,
  ToolEngineErrorBoundaryState
> {
  constructor(props: ToolEngineErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      diagnostic: null,
      copied: false,
      copyStatus: "",
    };
  }

  static getDerivedStateFromError(): Partial<ToolEngineErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    const entry = recordEngineDiagnostic({
      toolSlug: this.props.toolSlug,
      stage: "render",
      error,
    });
    if (entry) {
      this.setState({ diagnostic: entry });
    }
  }

  componentDidUpdate(prevProps: ToolEngineErrorBoundaryProps) {
    if (prevProps.toolSlug !== this.props.toolSlug && this.state.hasError) {
      this.setState({
        hasError: false,
        diagnostic: null,
        copied: false,
        copyStatus: "",
      });
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      diagnostic: null,
      copied: false,
      copyStatus: "",
    });
  };

  private handleCopyReport = async () => {
    const events = this.state.diagnostic ? [this.state.diagnostic] : [];
    const report = formatDiagnosticsBugReport(events);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
        this.setState({
          copied: true,
          copyStatus: "Sanitized bug report copied to clipboard.",
        });
        return;
      }
      this.setState({
        copied: false,
        copyStatus: "Clipboard unavailable. Expand Inspect bug report to copy manually.",
      });
    } catch {
      this.setState({
        copied: false,
        copyStatus: "Could not copy automatically. Expand Inspect bug report to copy manually.",
      });
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { diagnostic, copied, copyStatus } = this.state;
    const report = formatDiagnosticsBugReport(diagnostic ? [diagnostic] : []);

    return (
      <section
        className="workbench-panel"
        role="alert"
        aria-labelledby={`tool-error-${this.props.toolSlug}`}
        data-testid="tool-error-fallback"
      >
        <span className={styles.codeBadge}>Workspace Recovery</span>
        <h2 id={`tool-error-${this.props.toolSlug}`}>
          This tool encountered an unexpected error.
        </h2>
        <p className={styles.description}>
          Your data stayed inside your browser. No tool inputs, outputs, or
          background telemetry were uploaded.
        </p>

        {diagnostic && (
          <p className={styles.digestNote}>
            Tool: <code>{diagnostic.toolSlug}</code> · Stage:{" "}
            <code>{diagnostic.stage}</code> · Error:{" "}
            <code>
              {diagnostic.errorName}: {diagnostic.errorMessage}
            </code>
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={this.handleReset}
            className={styles.retryButton}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => void this.handleCopyReport()}
            className={styles.secondaryLink}
          >
            {copied ? "Bug report copied" : "Copy bug report"}
          </button>
          <Link href="/settings#diagnostics" className={styles.secondaryLink}>
            Diagnostics in Settings
          </Link>
        </div>

        <p role="status" aria-live="polite" className="muted">
          {copyStatus}
        </p>

        <details>
          <summary>Inspect sanitized bug report</summary>
          <pre aria-label="Sanitized bug report preview">{report}</pre>
        </details>
      </section>
    );
  }
}
