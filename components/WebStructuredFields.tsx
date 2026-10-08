"use client";

import { useRef, type ChangeEvent } from "react";
import styles from "./WebStructuredFields.module.css";

export type WebStructuredKind = "parameters" | "groups" | "sitemaps" | "entries" | "icons";
type RecordValue = Record<string, unknown>;
const LIMIT = 1000;
const templates: Record<Exclude<WebStructuredKind, "sitemaps">, RecordValue> = {
  parameters: { key: "", value: "" },
  groups: { userAgent: "", allow: [], disallow: [] },
  entries: { url: "", lastmod: "", changefreq: "", priority: "" },
  icons: { src: "", sizes: "", type: "", purpose: "" },
};
const nouns: Record<WebStructuredKind, string> = { parameters: "parameter", groups: "group", sitemaps: "sitemap", entries: "entry", icons: "icon" };
const labels: Record<string, string> = { key: "key", value: "value", userAgent: "user agent", url: "URL", lastmod: "last modified", changefreq: "change frequency", priority: "priority", src: "source", sizes: "sizes", type: "type", purpose: "purpose" };
const choices: Record<string, readonly string[]> = {
  changefreq: ["", "always", "hourly", "daily", "weekly", "monthly", "yearly", "never"],
};

export function webFieldMatches(errorField: string | undefined, field: string): boolean {
  if (!errorField) return false;
  const normalized = errorField.replace(/\[(\d+)\]/g, ".$1");
  return normalized === field || normalized.startsWith(`${field}.`) || field.startsWith(`${normalized}.`);
}

export default function WebStructuredFields({ kind, name, id, label, value, onChange, describedBy, errorField }: {
  kind: WebStructuredKind; name: string; id: string; label: string; value: unknown;
  onChange: (value: unknown[]) => void; describedBy?: string; errorField?: string;
}) {
  const root = useRef<HTMLFieldSetElement>(null);
  const records = Array.isArray(value) ? value : [];
  const noun = nouns[kind];
  const title = noun[0].toUpperCase() + noun.slice(1);

  function update(index: number, key: string, next: unknown) {
    onChange(records.map((record, position) => position === index ? { ...record, [key]: next } : record));
  }

  function focusAfterChange(source: HTMLElement, focus: () => void) {
    requestAnimationFrame(() => {
      if (document.activeElement === source || !source.isConnected && document.activeElement === document.body) focus();
    });
  }

  function add(source: HTMLButtonElement) {
    const next = kind === "sitemaps" ? "" : { ...templates[kind], ...(kind === "groups" ? { allow: [], disallow: [] } : {}) };
    onChange([...records, next]);
    focusAfterChange(source, () => root.current?.querySelector<HTMLElement>(`[data-web-field="${name}.${records.length}${kind === "sitemaps" ? "" : kind === "parameters" ? ".key" : kind === "groups" ? ".userAgent" : kind === "entries" ? ".url" : ".src"}"]`)?.focus());
  }

  function remove(index: number, source: HTMLButtonElement) {
    onChange(records.filter((_, position) => position !== index));
    focusAfterChange(source, () => {
      const controls = root.current?.querySelectorAll<HTMLButtonElement>(`button[data-remove="${name}"]`);
      if (controls?.length) controls[Math.min(index, controls.length - 1)].focus();
      else root.current?.querySelector<HTMLButtonElement>(`button[data-add="${name}"]`)?.focus();
    });
  }

  function input(path: string, fieldLabel: string, current: unknown, change: (next: string) => void, options?: readonly string[]) {
    const fieldId = `${id}-${path.replace(/\./g, "-")}`;
    const props = {
      id: fieldId, name: path, "data-web-field": path, className: styles.input,
      value: typeof current === "string" ? current : "", onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => change(event.target.value),
      "aria-describedby": describedBy, "aria-invalid": webFieldMatches(errorField, path) || errorField === name ? true as const : undefined,
    };
    return <div className={styles.field} key={path}><label htmlFor={fieldId}>{fieldLabel}</label>
      {options ? <select {...props}>{options.map(option => <option key={option} value={option}>{option || "Not specified"}</option>)}</select>
        : <input {...props} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} />}
    </div>;
  }

  return <fieldset ref={root} className={styles.editor} aria-describedby={describedBy} aria-invalid={webFieldMatches(errorField, name) || undefined}>
    <legend>{label}</legend>
    {records.length === 0 && <p className={styles.hint}>No {kind} added.</p>}
    <div className={styles.records}>{records.map((raw, index) => {
      const record: RecordValue = raw && typeof raw === "object" ? raw : {};
      const prefix = `${title} ${index + 1}`;
      return <div className={styles.record} key={index}>
        <div className={styles.recordHead}><strong>{prefix}</strong><button type="button" className={styles.button} data-remove={name} aria-label={`Remove ${noun} ${index + 1}`} onClick={event => remove(index, event.currentTarget)}>Remove</button></div>
        {kind === "sitemaps" ? input(`${name}.${index}`, `${prefix} URL`, raw, next => onChange(records.map((item, position) => position === index ? next : item)))
          : <div className={styles.cells}>{Object.keys(templates[kind]).filter(key => key !== "allow" && key !== "disallow").map(key => input(`${name}.${index}.${key}`, `${prefix} ${labels[key]}`, record[key], next => update(index, key, next), choices[key]))}</div>}
        {kind === "groups" && (["allow", "disallow"] as const).map(directive => {
          const paths = Array.isArray(record[directive]) ? record[directive] as unknown[] : [];
          return <fieldset key={directive} className={styles.editor}><legend>{prefix} {directive} paths</legend>
            {paths.map((path, pathIndex) => <div key={pathIndex} className={styles.path}>
              {input(`${name}.${index}.${directive}.${pathIndex}`, `${prefix} ${directive} path ${pathIndex + 1}`, path, next => update(index, directive, paths.map((item, position) => position === pathIndex ? next : item)))}
              <button type="button" className={styles.button} aria-label={`Remove ${prefix.toLowerCase()} ${directive} path ${pathIndex + 1}`} onClick={event => {
                const source = event.currentTarget;
                const container = source.closest("fieldset");
                update(index, directive, paths.filter((_, position) => position !== pathIndex));
                focusAfterChange(source, () => container?.querySelector<HTMLButtonElement>(`button[data-add-path]`)?.focus());
              }}>Remove</button>
            </div>)}
            <button type="button" className={styles.button} data-add-path disabled={paths.length >= LIMIT} onClick={event => {
              const source = event.currentTarget;
              const container = source.closest("fieldset");
              update(index, directive, [...paths, ""]);
              focusAfterChange(source, () => container?.querySelector<HTMLInputElement>(`[data-web-field="${name}.${index}.${directive}.${paths.length}"]`)?.focus());
            }}>Add {prefix.toLowerCase()} {directive} path</button>
          </fieldset>;
        })}
      </div>;
    })}</div>
    <button type="button" className={styles.button} data-add={name} data-web-field={name} aria-describedby={describedBy} disabled={records.length >= LIMIT} onClick={event => add(event.currentTarget)}>Add {noun}</button>
  </fieldset>;
}
