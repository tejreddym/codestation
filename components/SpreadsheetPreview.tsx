"use client";

import type { SpreadsheetResult } from "@/lib/tools/spreadsheet/types";
import styles from "./SpreadsheetStation.module.css";

export function SpreadsheetData({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <ol className={styles.dataArray}>{value.map((entry, index) => <li key={index}><SpreadsheetData value={entry} /></li>)}</ol>;
  if (value && typeof value === "object") return <dl className={styles.dataList}>{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd><SpreadsheetData value={entry} /></dd></div>)}</dl>;
  return <span className={styles.dataValue}>{value === null ? "null" : value === undefined ? "" : String(value)}</span>;
}

export default function SpreadsheetPreview({ id, preview, onSheet, switching = false }: { id: string; preview: NonNullable<SpreadsheetResult["preview"]>; onSheet?: (sheet: string) => void; switching?: boolean }) {
  const rows = preview.rows.slice(0, 100);
  return <div className={styles.preview}>
    {onSheet && preview.sheetNames.length > 0 && <div className={styles.field}><label htmlFor={`${id}-preview-sheet`}>Preview sheet</label><select className={styles.input} id={`${id}-preview-sheet`} value={preview.name} disabled={switching} onChange={event => onSheet(event.target.value)}>{preview.sheetNames.map(name => <option key={name}>{name}</option>)}</select></div>}
    <p className={styles.hint}>Sheet: {preview.name}. Preview shows at most 100 rows, including the header. Downloads contain the full generated result.</p>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`${preview.name} spreadsheet preview`}><table><caption className={styles.srOnly}>{preview.name} — first {rows.length} preview rows</caption><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => index === 0 ? <th scope="col" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <p className={styles.hint}>This sheet has no preview rows.</p>}</div>
  </div>;
}
