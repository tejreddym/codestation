"use client";

import { useEffect, useState } from "react";
import {
  clearEngineDiagnostics,
  ENGINE_DIAGNOSTICS_UPDATED_EVENT,
  formatDiagnosticsBugReport,
  MAX_ENGINE_DIAGNOSTICS,
  readEngineDiagnostics,
  type EngineDiagnosticEvent,
} from "@/lib/engine/diagnostics";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";

export default function DiagnosticsSettings() {
  const [events, setEvents] = useState<EngineDiagnosticEvent[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const { copy } = useCopy();

  useEffect(() => {
    const sync = () => setEvents(readEngineDiagnostics());
    sync();
    window.addEventListener(ENGINE_DIAGNOSTICS_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ENGINE_DIAGNOSTICS_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const report = formatDiagnosticsBugReport(events);

  async function handleCopy() {
    if (await copy(report)) {
      setStatusMessage("Copied sanitized bug report to clipboard.");
    } else {
      setStatusMessage("Clipboard unavailable. Expand Inspect buffered events below to copy.");
    }
  }

  function handleClear() {
    clearEngineDiagnostics();
    setEvents([]);
    setStatusMessage("Cleared local engine diagnostics buffer.");
  }

  return (
    <section id="diagnostics" className="workbench-panel">
      <h2>Local Engine Diagnostics</h2>
      <p>
        If a tool engine encounters an unexpected runtime crash, Code Station stores anonymized
        metadata locally in your browser (capped at the last {MAX_ENGINE_DIAGNOSTICS} events).
        Records contain only tool slug, engine stage, sanitized error name/message, timestamp,
        and app version — never your inputs, outputs, files, or network payloads. Nothing is
        ever transmitted automatically.
      </p>
      <p>
        <strong>Buffered events:</strong> {events.length} / {MAX_ENGINE_DIAGNOSTICS}
      </p>
      <div className="actions">
        <button
          type="button"
          className={ui.button}
          onClick={() => void handleCopy()}
        >
          Copy bug report
        </button>
        <button
          type="button"
          className={ui.button}
          disabled={events.length === 0}
          onClick={handleClear}
        >
          Clear diagnostics
        </button>
      </div>
      <details>
        <summary>Inspect sanitized bug report</summary>
        <pre aria-label="Local engine diagnostics report">{report}</pre>
      </details>
      <p role="status" aria-live="polite">
        {statusMessage}
      </p>
    </section>
  );
}
