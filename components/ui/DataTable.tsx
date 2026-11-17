import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type DataTableProps = {
  caption: string;
  columns: ReactNode[];
  rows: ReactNode[][];
  empty?: string;
  className?: string;
};

/** Semantic table with a caption and an inert empty state. */
export function DataTable({ caption, columns, rows, empty = "No rows to display.", className }: DataTableProps) {
  return (
    <div className={cx(styles.tableWrap, className)}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>{columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length > 0
            ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)
            : <tr><td className={styles.tableEmpty} colSpan={Math.max(1, columns.length)}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
