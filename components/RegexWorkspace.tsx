"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { getRegexDefinition, type RegexToolDefinition } from "@/config/regex-tools";
import type { RegexDefinition, RegexGroup, RegexMatch, RegexResult, RegexValues } from "@/lib/tools/regex/types";
import styles from "./RegexStation.module.css";

type CopyValue = (value: string, label: string) => Promise<void>;
const PAGE_SIZE = 50;
const flagNames: Record<string, string> = { g: "Global", i: "Case-insensitive", m: "Multiline", s: "Dot all", u: "Unicode", y: "Sticky", d: "Match indices" };

/** The text node and clipboard payload are identical, including empty strings. */
function Value({ label, value, copy }: { label: string; value: string | null; copy: CopyValue }) {
  const visible = value === null ? "null" : value;
  return <div className={styles.value}>
    <div className={styles.valueHead}><span>{label}</span><button type="button" className={styles.button} aria-label={`Copy ${label}`} onClick={() => void copy(visible, label)}>Copy</button></div>
    <pre className={styles.output} tabIndex={0} aria-label={`${label} value`}>{visible}</pre>
    {value === "" && <p className={styles.hint}>Empty string — Copy copies exactly zero characters.</p>}
    {value === null && <p className={styles.hint}>Unmatched capture (null), not an empty string.</p>}
  </div>;
}

function Pages<T>({ items, label, render }: { items: readonly T[]; label: string; render: (item: T, index: number) => ReactNode }) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1);
  const current = Math.min(page, lastPage);
  const start = current * PAGE_SIZE;
  return <div className={styles.list}>
    {items.length > PAGE_SIZE && <div className={styles.pagination}>
      <p role="status">{items.length} {label} total · Showing {start + 1}–{Math.min(start + PAGE_SIZE, items.length)}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} aria-label={`Previous ${label}`} disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        <button type="button" className={styles.button} aria-label={`Next ${label}`} disabled={current === lastPage} onClick={() => setPage(current + 1)}>Next</button>
      </div>
    </div>}
    {items.slice(start, start + PAGE_SIZE).map((item, index) => render(item, start + index))}
  </div>;
}

function Groups({ groups, matchNumber, copy }: { groups: readonly RegexGroup[]; matchNumber: number; copy: CopyValue }) {
  return <div className={styles.list}>
    {groups.length === 0 ? <p className={styles.hint}>No capture groups.</p> : <Pages items={groups} label={`groups for match ${matchNumber}`} render={group => <div key={group.number}>
      <Value label={`Match ${matchNumber} · Group ${group.number}${group.name !== undefined ? ` (${group.name})` : ""}`} value={group.value} copy={copy} />
      {group.indices !== undefined && <p className={styles.hint}>Capture indices (d): {group.indices === null ? "unmatched" : `[${group.indices[0]}, ${group.indices[1]})`}</p>}
    </div>} />}
  </div>;
}

function MatchCard({ match, kind, copy }: { match: RegexMatch; kind: RegexResult["kind"]; copy: CopyValue }) {
  return <article className={styles.card} aria-label={`Match ${match.number}`}>
    <h3>Match {match.number}</h3>
    {kind !== "groups" && <Value label={`Match ${match.number} · Full match`} value={match.value} copy={copy} />}
    {(kind === "test" || kind === "inspect") && <div className={styles.metrics}>
      <Value label={`Match ${match.number} · Start`} value={String(match.start)} copy={copy} />
      <Value label={`Match ${match.number} · End`} value={String(match.end)} copy={copy} />
      {kind === "inspect" && <Value label={`Match ${match.number} · Length`} value={String(match.length)} copy={copy} />}
    </div>}
    <Groups groups={match.groups} matchNumber={match.number} copy={copy} />
  </article>;
}

const definitionKinds: ReadonlyArray<{ kind: RegexDefinition["kind"]; label: string }> = [
  { kind: "capturing", label: "Numbered capturing groups" },
  { kind: "named", label: "Named capturing groups" },
  { kind: "non-capturing", label: "Non-capturing groups" },
  { kind: "lookahead", label: "Lookahead assertions" },
  { kind: "lookbehind", label: "Lookbehind assertions" },
];

function Definitions({ definitions, copy }: { definitions: readonly RegexDefinition[]; copy: CopyValue }) {
  return <section className={styles.list} aria-label="Group definitions">
    <h3>Group definitions</h3>
    {definitionKinds.map(({ kind, label }) => {
      const entries = definitions.filter(definition => definition.kind === kind);
      return <section className={styles.card} key={kind} aria-label={label}>
        <h4>{label}</h4>
        {entries.length === 0 ? <p className={styles.hint}>None.</p> : <Pages items={entries} label={label.toLowerCase()} render={(definition, index) => <Value key={`${definition.start}-${index}`} label={definition.number !== undefined ? `Group ${definition.number}${definition.name !== undefined ? ` (${definition.name})` : ""} definition` : `${label} ${index + 1}`} value={definition.source} copy={copy} />} />}
      </section>;
    })}
  </section>;
}

function Result({ result, copy }: { result: RegexResult; copy: CopyValue }) {
  if (result.kind === "escape" || result.kind === "builder") return <Value label={result.kind === "escape" ? "Escaped text" : "Generated pattern"} value={result.text ?? ""} copy={copy} />;
  if (result.kind === "replace") return <div className={styles.list}>
    <Value label="Replaced text" value={result.text ?? ""} copy={copy} />
    <Value label="Replacement count" value={String(result.count ?? 0)} copy={copy} />
  </div>;
  if (result.kind === "split") return <div className={styles.list}>
    <Value label="Part count" value={String(result.count ?? result.parts?.length ?? 0)} copy={copy} />
    <Pages items={result.parts ?? []} label="parts" render={(part, index) => <Value key={index} label={`Part ${index + 1}`} value={part} copy={copy} />} />
  </div>;
  if (result.kind === "flags") return <div className={styles.list}>
    {(result.rows ?? []).map(row => {
      const label = row.flags || "No flags";
      return <article className={styles.card} key={label} aria-label={label}>
        <h3>{label}</h3>
        <div className={styles.metrics}>
          <Value label={`${label} · Validity`} value={row.valid ? "Valid" : "Invalid"} copy={copy} />
          <Value label={`${label} · Match status`} value={row.matched === null ? "Not evaluated" : row.matched ? "Matched" : "No match"} copy={copy} />
          <Value label={`${label} · Match count`} value={row.count === null ? "Not evaluated" : String(row.count)} copy={copy} />
        </div>
        {row.first === null ? <p className={styles.hint}>{row.valid ? "No first match." : "First match not evaluated."}</p> : <Value label={`${label} · First match`} value={row.first} copy={copy} />}
        {row.error !== undefined && <Value label={`${label} · Error`} value={row.error} copy={copy} />}
      </article>;
    })}
  </div>;
  return <div className={styles.list}>
    {result.kind === "test" && <div className={styles.metrics}>
      <Value label="Match count" value={String(result.count ?? 0)} copy={copy} />
      <Value label="Match status" value={result.matched ? "Matched" : "No match"} copy={copy} />
    </div>}
    {result.kind === "capture" && <Definitions definitions={result.definitions ?? []} copy={copy} />}
    {result.matches?.length ? <Pages items={result.matches} label="matches" render={match => <MatchCard key={match.number} match={match} kind={result.kind} copy={copy} />} /> : <p className={styles.hint}>No matches.</p>}
  </div>;
}

function Workspace({ definition }: { definition: RegexToolDefinition }) {
  const contract = definition.regexContract;
  const prefix = definition.slug;
  const [values, setValues] = useState<RegexValues>(() => ({ ...contract.defaults }));
  const [result, setResult] = useState<RegexResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current++; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (error) document.getElementById(`${prefix}-${contract.fields[0].name}`)?.focus();
  }, [error, prefix, contract.fields]);

  function invalidate() {
    revision.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setResult(null);
    setError("");
    setNotice("");
  }

  function edit(name: string, value: string) {
    invalidate();
    setValues(previous => ({ ...previous, [name]: value }));
  }

  function reset(example = false) {
    invalidate();
    setValues({ ...contract.defaults, ...(example ? contract.example : {}) });
  }

  async function execute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    const ownRevision = revision.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const { runRegexTool } = await import("@/lib/tools/regex/client");
      if (abort.signal.aborted || revision.current !== ownRevision || !mounted.current) return;
      const next = await runRegexTool(definition.slug, { ...values }, abort.signal);
      if (!abort.signal.aborted && revision.current === ownRevision && mounted.current) setResult(next);
    } catch (cause) {
      if (!abort.signal.aborted && revision.current === ownRevision && mounted.current) setError(cause instanceof Error ? cause.message : "Could not process this regular expression.");
    } finally {
      if (revision.current === ownRevision && mounted.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }

  const copy: CopyValue = async (value, label) => {
    const ownRevision = revision.current;
    setNotice("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      if (mounted.current && ownRevision === revision.current) setNotice(`Copied ${label}.`);
    } catch {
      if (mounted.current && ownRevision === revision.current) setNotice("Could not copy. Allow clipboard access or select and copy the result manually.");
    }
  };

  return <div className={styles.station}>
    <form onSubmit={execute} className={styles.form} aria-label={`${definition.name} inputs`}>
      <div className={styles.fields}>
        {contract.fields.map(field => {
          const id = `${prefix}-${field.name}`;
          const describedBy = [field.hint ? `${id}-hint` : "", error ? `${prefix}-error` : ""].filter(Boolean).join(" ") || undefined;
          if (field.control === "checkbox-group") return <fieldset key={field.name} id={id} className={styles.flagField} aria-describedby={describedBy} aria-invalid={!!error}>
            <legend>{field.label}</legend>
            <div className={styles.flags}>{field.options?.map(flag => <label key={flag} htmlFor={`${id}-${flag}`} className={styles.flag}>
              <input id={`${id}-${flag}`} type="checkbox" checked={(values[field.name] ?? "").includes(flag)} aria-describedby={describedBy} aria-invalid={!!error} onChange={event => {
                const selected = values[field.name] ?? "";
                edit(field.name, (field.options ?? []).filter(option => option === flag ? event.target.checked : selected.includes(option)).join(""));
              }} />
              <span><strong>{flag}</strong> · {flagNames[flag]}</span>
            </label>)}</div>
            {field.hint && <p className={styles.hint} id={`${id}-hint`}>{field.hint}</p>}
          </fieldset>;
          return <div className={styles.field} key={field.name}>
            <label htmlFor={id}>{field.label}</label>
            {field.control === "select" ? <select id={id} value={values[field.name] ?? ""} onChange={event => edit(field.name, event.target.value)} aria-describedby={describedBy} aria-invalid={!!error}>
              {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
            </select> : <textarea id={id} value={values[field.name] ?? ""} onChange={event => edit(field.name, event.target.value)} rows={field.name === "text" || field.name === "literal" ? 7 : 3} spellCheck={false} autoComplete="off" autoCapitalize="off" aria-describedby={describedBy} aria-invalid={!!error} />}
            {field.hint && <p className={styles.hint} id={`${id}-hint`}>{field.hint}</p>}
          </div>;
        })}
      </div>
      {definition.id === "regex-pattern-builder" && values.caseSensitivity === "Case insensitive" && <p className={styles.hint}>Use the i flag with this generated pattern for case-insensitive matching.</p>}
      <div className={styles.actions}>
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? "Running…" : contract.action}</button>
        <button type="button" className={styles.button} onClick={() => reset(true)}>Load example</button>
        <button type="button" className={styles.button} onClick={() => reset()}>Clear</button>
      </div>
      {error && <p id={`${prefix}-error`} className={styles.error} role="alert">{error}</p>}
    </form>
    <p className={styles.hint} role="status" aria-live="polite">{busy ? "Processing locally…" : notice || (result ? "Result ready." : "")}</p>
    <section className={styles.results} aria-labelledby={`${prefix}-result-heading`} aria-busy={busy}>
      <h2 id={`${prefix}-result-heading`}>{contract.outputLabel}</h2>
      {result ? <Result result={result} copy={copy} /> : <p className={styles.hint}>Your result will appear here.</p>}
    </section>
    <div className={styles.notes}>{contract.notices.map(note => <p key={note}>{note}</p>)}<p>{contract.privacyMessage}</p></div>
  </div>;
}

export default function RegexWorkspace({ toolId }: { toolId: string }) {
  const definition = getRegexDefinition(toolId);
  return definition ? <Workspace key={definition.slug} definition={definition} /> : null;
}
