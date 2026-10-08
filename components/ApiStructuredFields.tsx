"use client";

import { useRef, type ChangeEvent } from "react";
import styles from "./ApiStructuredFields.module.css";

export type ApiStructuredKind = "entries" | "headers" | "parameters" | "fields" | "arguments" | "selectedFields";
type Row = Record<string, unknown>;
const LIMIT = 1000;
const templates: Record<Exclude<ApiStructuredKind, "selectedFields">, Row> = {
  entries: { name: "", value: "" }, headers: { name: "", value: "" }, parameters: { key: "", value: "" },
  fields: { key: "", valueType: "String", value: "" }, arguments: { name: "", valueType: "String", value: "" },
};
const nouns: Record<ApiStructuredKind, string> = { entries: "header", headers: "header", parameters: "parameter", fields: "field", arguments: "argument", selectedFields: "selected field" };
const valueTypes = ["String", "Number", "Boolean", "Null", "JSON object", "JSON array"];
const argumentTypes = ["String", "Int", "Float", "Boolean", "Null", "Enum"];

export function apiFieldMatches(errorField: string | undefined, field: string) {
  if (!errorField) return false;
  const normalized = errorField.replace(/\[(\d+)\]/g, ".$1");
  return normalized === field || normalized.startsWith(`${field}.`) || field.startsWith(`${normalized}.`);
}

export default function ApiStructuredFields({ kind, name, id, label, value, onChange, describedBy, errorField }: {
  kind: ApiStructuredKind; name: string; id: string; label: string; value: unknown;
  onChange: (value: unknown[]) => void; describedBy?: string; errorField?: string;
}) {
  const root = useRef<HTMLFieldSetElement>(null);
  const records = Array.isArray(value) ? value : [];
  const noun = nouns[kind];
  const title = noun[0].toUpperCase() + noun.slice(1);

  function focusAfterChange(source: HTMLElement, focus: () => void) {
    requestAnimationFrame(() => {
      if (document.activeElement === source || !source.isConnected && document.activeElement === document.body) focus();
    });
  }

  function update(index: number, key: string, next: string) {
    onChange(records.map((record, position) => position === index ? { ...record, [key]: next } : record));
  }

  function input(path: string, fieldLabel: string, current: unknown, change: (next: string) => void, options?: readonly string[], disabled = false, secret = false) {
    const fieldId = `${id}-${path.replace(/\./g, "-")}`;
    const props = {
      id: fieldId, name: path, "data-api-field": path, className: styles.input, disabled,
      value: typeof current === "string" ? current : "", onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => change(event.target.value),
      "aria-describedby": describedBy, "aria-invalid": apiFieldMatches(errorField, path) || undefined,
    };
    return <div className={styles.field} key={path}><label htmlFor={fieldId}>{fieldLabel}</label>
      {options ? <select {...props}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select>
        : <input {...props} type={secret ? "password" : "text"} autoComplete="off" autoCapitalize="off" spellCheck={false} />}
    </div>;
  }

  return <fieldset ref={root} className={styles.editor} aria-describedby={describedBy} aria-invalid={apiFieldMatches(errorField, name) || undefined}>
    <legend>{label}</legend>
    {records.length === 0 && <p className={styles.hint}>No {noun}s added.</p>}
    <div className={styles.records}>{records.map((raw, index) => {
      const row: Row = raw && typeof raw === "object" ? raw : {};
      const prefix = `${title} ${index + 1}`;
      return <div className={styles.record} key={index}>
        <div className={styles.recordHead}><strong>{prefix}</strong><button type="button" className={styles.button} data-remove={name} aria-label={`Remove ${noun} ${index + 1}`} onClick={event => {
          const source = event.currentTarget;
          onChange(records.filter((_, position) => position !== index));
          focusAfterChange(source, () => {
            const buttons = root.current?.querySelectorAll<HTMLButtonElement>(`button[data-remove="${name}"]`);
            if (buttons?.length) buttons[Math.min(index, buttons.length - 1)].focus();
            else root.current?.querySelector<HTMLButtonElement>(`button[data-add="${name}"]`)?.focus();
          });
        }}>Remove</button></div>
        <div className={styles.cells}>{kind === "selectedFields"
          ? input(`${name}.${index}`, prefix, typeof raw === "object" ? row.name : raw, next => onChange(records.map((item, position) => position === index ? typeof item === "object" ? { ...item, name: next } : next : item)))
          : Object.keys(templates[kind]).map(key => input(
            `${name}.${index}.${key}`, `${prefix} ${key === "valueType" ? "value type" : key}`, row[key], next => update(index, key, next),
            key === "valueType" ? kind === "fields" ? valueTypes : argumentTypes : undefined,
            key === "value" && row.valueType === "Null",
            key === "value" && ["headers", "entries"].includes(kind) && /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i.test(String(row.name)),
          ))}</div>
      </div>;
    })}</div>
    <button type="button" className={styles.button} data-add={name} data-api-field={name} aria-describedby={describedBy} disabled={records.length >= LIMIT} onClick={event => {
      const source = event.currentTarget;
      onChange([...records, kind === "selectedFields" ? "" : { ...templates[kind] }]);
      const path = `${name}.${records.length}${kind === "selectedFields" ? "" : `.${Object.keys(templates[kind])[0]}`}`;
      focusAfterChange(source, () => root.current?.querySelector<HTMLElement>(`[data-api-field="${path}"]`)?.focus());
    }}>Add {noun}</button>
  </fieldset>;
}
