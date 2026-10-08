"use client";

import type { LocalField } from "@/config/local-contract";
import type { SpreadsheetInfo, SpreadsheetValues } from "@/lib/tools/spreadsheet/types";
import styles from "./SpreadsheetStation.module.css";

type Props = {
  id: string; fields: readonly LocalField[]; values: SpreadsheetValues; info: SpreadsheetInfo | null;
  error?: { message: string; field?: string } | null;
  onChange: (name: string, value: unknown) => void;
  onFiles: (name: string, files: File[]) => void;
};
const columnLabel = (header: string, index: number) => `${index + 1}: ${header || "(empty header)"}`;

function ColumnOrder({ field, headers, order, shared, onChange }: { field: LocalField; headers: string[]; order: string[]; shared: { id: string; "aria-describedby": string; "aria-invalid": true | undefined }; onChange: (value: string[]) => void }) {
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order]; [next[index], next[target]] = [next[target], next[index]]; onChange(next);
  }
  return <fieldset {...shared} tabIndex={-1} data-spreadsheet-field={field.name} className={styles.editor}>
    <legend>{field.label}</legend>
    <p className={styles.hint}>Use Move up/Move down or the ↑/↓ keys on a column to change its position.</p>
    <ol className={styles.order}>{order.map((raw, index) => { const column = Number(raw); return <li key={raw}>
      <span tabIndex={0} className={styles.orderColumn} role="button" aria-label={`Reorder ${columnLabel(headers[column], column)}`} onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); move(index, event.key === "ArrowUp" ? -1 : 1); } }}>{columnLabel(headers[column], column)}</span>
      <div className={styles.actions}><button type="button" className="button" disabled={index === 0} aria-label={`Move ${columnLabel(headers[column], column)} up`} onClick={() => move(index, -1)}>↑ Up</button><button type="button" className="button" disabled={index === order.length - 1} aria-label={`Move ${columnLabel(headers[column], column)} down`} onClick={() => move(index, 1)}>↓ Down</button></div>
    </li>; })}</ol>
  </fieldset>;
}

export default function SpreadsheetControls({ id, fields, values, info, error, onChange, onFiles }: Props) {
  const sheet = info?.sheets.find(entry => entry.name === values.sheet) ?? info?.sheets[0];
  const headers = sheet?.headers ?? [];
  return <div className={styles.fields}>{fields.map(field => {
    if (["sheet", "column", "order", "keys"].includes(field.name) && !info) return null;
    const invalid = !!error && (!error.field || error.field === field.name);
    const shared = { id: `${id}-${field.name}`, "aria-describedby": `${id}-status${invalid ? ` ${id}-error` : ""}`, "aria-invalid": invalid ? true as const : undefined };
    const inputProps = { ...shared, name: field.name, "data-spreadsheet-field": field.name };
    const value = values[field.name] ?? "";
    if (field.name === "order") return <ColumnOrder key={field.name} field={field} headers={headers} order={Array.isArray(value) ? value.map(String) : headers.map((_, index) => String(index))} shared={shared} onChange={next => onChange(field.name, next)} />;
    if (field.name === "keys") {
      const keys = Array.isArray(value) ? value.map(String) : [];
      return <fieldset {...shared} tabIndex={-1} data-spreadsheet-field={field.name} key={field.name} className={styles.editor}><legend>{field.label}</legend><p className={styles.hint}>No selected keys compares the whole row.</p>{headers.map((header, index) => <label className={styles.checkbox} key={index} htmlFor={`${shared.id}-${index}`}><input id={`${shared.id}-${index}`} name="keys" type="checkbox" checked={keys.includes(String(index))} aria-describedby={shared["aria-describedby"]} onChange={event => onChange("keys", event.target.checked ? [...keys, String(index)].sort((a, b) => Number(a) - Number(b)) : keys.filter(key => key !== String(index)))} />{columnLabel(header, index)}</label>)}</fieldset>;
    }
    return <div key={field.name} className={styles.field}><label htmlFor={shared.id}>{field.label}</label>
      {["file", "files", "textFile"].includes(field.name) || field.control === "file" ? <input {...inputProps} className={styles.input} type="file" accept={field.accept} multiple={field.name === "files"} onChange={event => onFiles(field.name, Array.from(event.target.files ?? []))} />
        : field.name === "sheet" ? <select {...inputProps} className={styles.input} value={String(value)} onChange={event => onChange("sheet", event.target.value)}>{info?.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
          : field.name === "column" ? <select {...inputProps} className={styles.input} value={String(value)} onChange={event => onChange("column", event.target.value)}><option value="">Choose a column</option>{headers.map((header, index) => <option key={index} value={index}>{columnLabel(header, index)}</option>)}</select>
            : field.control === "select" ? <select {...inputProps} className={styles.input} value={String(value)} onChange={event => onChange(field.name, event.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
              : field.control === "textarea" ? <textarea {...inputProps} className={`${styles.input} ${styles.textarea}`} rows={7} value={String(value)} spellCheck={false} autoCapitalize="off" onChange={event => onChange(field.name, event.target.value)} />
                : <input {...inputProps} className={styles.input} type={field.control === "number" ? "number" : "text"} value={String(value)} min={field.min} max={field.max} onChange={event => onChange(field.name, event.target.value)} />}
    </div>;
  })}</div>;
}
