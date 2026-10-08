"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getCronDefinition, type CronToolDefinition, type CronToolId } from "@/config/cron-tools";
import type { CronResult, CronValues } from "@/lib/tools/cron/types";
import DateTimePicker from "./DateTimePicker";
import styles from "./CronStation.module.css";

const COMMON_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"];

function Station({ definition }: { definition: CronToolDefinition }) {
  const { cronContract: contract } = definition;
  const id = `cron-${definition.id}`;
  const [values, setValues] = useState<CronValues>(() => ({ ...contract.defaults }));
  const [result, setResult] = useState<CronResult | null>(null);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [zones, setZones] = useState(COMMON_ZONES);
  const [pickerReset, setPickerReset] = useState(0);
  const revision = useRef(0);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const validatorStatus = result && definition.id === "cron-validator"
    ? result.rows.find(row => row.label === "Valid/Invalid status")?.value
    : undefined;
  const validatorInvalid = validatorStatus?.trim().toLowerCase() === "invalid";
  const validatorErrorIndex = validatorInvalid ? result?.rows.findIndex(row => row.label === "Error message") ?? -1 : -1;

  useEffect(() => {
    mounted.current = true;
    try {
      const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf?.("timeZone") ?? [];
      setZones([...new Set([...COMMON_ZONES, ...supported])].sort());
    } catch { /* Retain common suggestions when timezone enumeration is unavailable. */ }
    return () => {
      mounted.current = false;
      revision.current += 1;
      controller.current?.abort();
    };
  }, []);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function invalidate() {
    revision.current += 1;
    controller.current?.abort();
    controller.current = null;
    setResult(null);
    setError("");
    setErrorField(null);
    setNotice("");
    setBusy(false);
  }

  function change(name: string, value: string) {
    invalidate();
    setValues(current => ({ ...current, [name]: value }));
  }

  function load(next: Readonly<CronValues>) {
    invalidate();
    setPickerReset(current => current + 1);
    setValues({ ...contract.defaults, ...next });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    const currentRevision = revision.current;
    const snapshot = { ...values };
    if (definition.id === "cron-generator" && snapshot.second !== "" && !snapshot.second.trim()) {
      setErrorField("second");
      setError("Enter a second field, or clear Second completely for five-field Unix.");
      return;
    }
    // Validator passes every expression, including an empty one, to its status-row contract.
    const missing = definition.id === "cron-validator" ? undefined : contract.fields.find(field => !field.optional && !snapshot[field.name]?.trim());
    if (missing) {
      setErrorField(missing.name);
      setError(`${missing.label} is required.`);
      return;
    }
    const activeController = new AbortController();
    controller.current = activeController;
    setBusy(true);
    setNotice("Processing schedule…");
    try {
      const { runCronTool } = await import("@/lib/tools/cron/client");
      if (!mounted.current || revision.current !== currentRevision || activeController.signal.aborted) return;
      const next: CronResult = await runCronTool(definition.id, snapshot, activeController.signal);
      if (!mounted.current || revision.current !== currentRevision || activeController.signal.aborted) return;
      setResult(next);
      if (definition.id === "cron-validator") {
        const status = next.rows.find(row => row.label === "Valid/Invalid status")?.value ?? "Validation complete";
        const validationError = next.rows.find(row => row.label === "Error message")?.value;
        setNotice(`${status}.${status.trim().toLowerCase() === "invalid" && validationError ? ` ${validationError}` : ""}`);
      } else setNotice("Result ready.");
    } catch (cause) {
      if (mounted.current && revision.current === currentRevision && !activeController.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Could not process this schedule. Check your inputs.");
        setNotice("");
      }
    } finally {
      if (mounted.current && revision.current === currentRevision) {
        setBusy(false);
        if (controller.current === activeController) controller.current = null;
      }
    }
  }

  async function copy(value: string, label: string) {
    const currentRevision = revision.current;
    setNotice("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      if (mounted.current && revision.current === currentRevision) setNotice(`${label} copied${value === "" ? " (empty value)" : ""}.`);
    } catch {
      if (mounted.current && revision.current === currentRevision) setNotice("Could not copy. Select the result and copy it manually.");
    }
  }

  return <div className={styles.station}>
    <div className={styles.layout}>
      <form className={styles.panel} onSubmit={event => void submit(event)} noValidate aria-labelledby={`${id}-input`} aria-describedby={error ? `${id}-error` : undefined}>
        <div className={styles.panelHead}>
          <h2 id={`${id}-input`}>{definition.name} input</h2>
          <button type="button" className="button" onClick={() => load(contract.example)}>Load example</button>
        </div>
        <div className={styles.fields}>
          {definition.id === "cron-generator" && <p className={styles.mode} role="status" aria-atomic="true">
            {values.second !== "" ? "Mode: six-field seconds-first extension" : "Mode: five-field Unix cron"}
          </p>}
          <div className={definition.id === "cron-generator" ? styles.generatorFields : styles.inputFields}>
            {contract.fields.map(field => {
              const fieldId = `${id}-${field.name}`;
              const associatedError = error && (errorField === null || errorField === field.name);
              const invalidExpression = validatorInvalid && field.name === "expression";
              const describedBy = [
                field.hint ? `${fieldId}-hint` : "",
                associatedError ? `${id}-error` : "",
                invalidExpression && validatorErrorIndex >= 0 ? `${id}-row-${validatorErrorIndex}` : "",
              ].filter(Boolean).join(" ") || undefined;
              if (field.name === "reference") return <div className={styles.field} key={field.name}>
                <DateTimePicker
                  key={pickerReset}
                  id={fieldId} name={field.name} mode="utc" label={field.label}
                  value={values[field.name] ?? ""} required={!field.optional}
                  hint={field.hint} placeholder={field.placeholder}
                  ariaDescribedBy={describedBy} invalid={Boolean(associatedError)}
                  onChange={value => change(field.name, value)}
                />
                <button type="button" className="button" onClick={() => change("reference", new Date().toISOString())}>Current date and time</button>
              </div>;
              return <div className={styles.field} key={field.name}>
                <label htmlFor={fieldId}>{field.label}{field.optional && <span className={styles.optional}> (optional)</span>}</label>
                <input
                  id={fieldId} name={field.name} type="text" className={styles.input}
                  value={values[field.name] ?? ""} required={!field.optional}
                  placeholder={field.placeholder} list={field.control === "timezone" ? `${fieldId}-zones` : undefined}
                  aria-describedby={describedBy} aria-invalid={associatedError || invalidExpression ? true : undefined}
                  autoComplete="off" autoCapitalize="off" spellCheck={false}
                  onChange={event => change(field.name, event.target.value)}
                />
                {field.control === "timezone" && <datalist id={`${fieldId}-zones`}>{zones.map(timezone => <option value={timezone} key={timezone} />)}</datalist>}
                {field.hint && <p className={styles.hint} id={`${fieldId}-hint`}>{field.hint}</p>}
              </div>;
            })}
          </div>
          {contract.notices.map(text => <p className={styles.note} key={text}>{text}</p>)}
        </div>
        <div className={styles.actions}>
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Processing…" : contract.action}</button>
          <button type="button" className="button" onClick={() => load(contract.defaults)}>Clear</button>
        </div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-result`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-result`}>{contract.outputLabel}</h2></div>
        {result ? <div className={styles.result}>
          <dl className={styles.resultList}>{result.rows.map((row, index) => <div key={`${row.label}-${index}`}>
            <dt className={styles.rowHead}>
              <span>{row.label}</span>
              <button type="button" className="button" aria-label={`Copy ${row.label}`} onClick={() => void copy(row.value, row.label)}>Copy</button>
            </dt>
            <dd>
              <pre id={`${id}-row-${index}`} className={styles.output} tabIndex={0} aria-label={`${row.label} value`}>{row.value}</pre>
              {row.value === "" && <p className={styles.hint}>Empty value — Copy copies exactly zero characters.</p>}
            </dd>
          </div>)}</dl>
          {Boolean(result.fields?.length) && <section className={styles.interpretations} aria-labelledby={`${id}-interpretations`}>
            <h3 id={`${id}-interpretations`}>Field interpretations</h3>
            <dl className={styles.fieldCards}>{result.fields?.map((field, index) => <div className={styles.fieldCard} key={`${field.label}-${index}`}>
              <dt>{field.label}</dt>
              <dd>
                <div className={styles.rowHead}>
                  <span className={styles.hint}>Expression</span>
                  <button type="button" className="button" aria-label={`Copy ${field.label} expression`} onClick={() => void copy(field.expression, `${field.label} expression`)}>Copy</button>
                </div>
                <pre className={styles.output} tabIndex={0} aria-label={`${field.label} expression`}>{field.expression}</pre>
                <div className={styles.rowHead}>
                  <span className={styles.hint}>Interpretation</span>
                  <button type="button" className="button" aria-label={`Copy ${field.label} interpretation`} onClick={() => void copy(field.interpretation, `${field.label} interpretation`)}>Copy</button>
                </div>
                <p className={styles.interpretation}>{field.interpretation}</p>
              </dd>
            </div>)}</dl>
          </section>}
        </div> : <p className={styles.empty}>Your result will appear here after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
    <p className={styles.status} role="status" aria-live="polite" aria-atomic="true">{notice}</p>
    <p className={styles.privacy}>{contract.privacyMessage}</p>
  </div>;
}

export default function CronStation({ toolId }: { toolId: CronToolId }) {
  const definition = getCronDefinition(toolId);
  if (!definition) return null;
  return <Station key={definition.id} definition={definition} />;
}
