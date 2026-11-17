"use client";
import { useEffect, useState } from "react";
import { getTool } from "@/config/tools";
import ui from "./ui/ui.module.css";
import { useCopy } from "./ui/useCopy";
import { downloadBlob } from "./ui/useDownload";
export default function FeedbackForm() {
  const [kind, setKind] = useState("Report a problem");
  const [tool, setTool] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const { copy } = useCopy();
  useEffect(() => {
    const slug = new URL(window.location.href).searchParams.get("tool");
    if (slug && getTool(slug)) setTool(slug);
  }, []);
  const report = `${kind}${tool ? ` — ${tool}` : ""}\n\n${body}`;
  return (
    <section className="workbench-panel">
      <label className="field-label" htmlFor="feedback-kind">
        What would you like to share?
      </label>
      <select
        id="feedback-kind"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option>Report a problem</option>
        <option>Request a feature</option>
      </select>
      {tool && <p>Tool: {tool}</p>}
      <label className="field-label" htmlFor="feedback-body">
        Details
      </label>
      <textarea
        id="feedback-body"
        maxLength={4000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What happened? What did you expect? Please remove secrets and personal data."
      />
      <p>
        No tool input or device details are attached automatically. Review the
        text before sharing.
      </p>
      <div className={ui.actions}>
        <a
          className={`${ui.button} ${ui.primary}`}
          href={`mailto:hello@codestation.in?subject=${encodeURIComponent(`Code Station: ${kind}${tool ? ` (${tool})` : ""}`)}&body=${encodeURIComponent(body)}`}
        >
          Open email draft
        </a>
        <button
          className={ui.button}
          onClick={async () => {
            const ok = await copy(report);
            setStatus(
              ok
                ? "Report copied. Paste it into your email when ready."
                : "Copy was unavailable. Select your text or download the report.",
            );
          }}
        >
          Copy report
        </button>
        <button
          className={ui.button}
          onClick={() => {
            downloadBlob(report, "code-station-feedback.txt");
            setStatus("Download requested. Nothing has been submitted.");
          }}
        >
          Download report
        </button>
      </div>
      <p>
        Destination: hello@codestation.in. Opening a draft does not send a
        report; send it from your email app.
      </p>
      <p role="status">{status}</p>
    </section>
  );
}
