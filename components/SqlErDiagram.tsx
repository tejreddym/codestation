"use client";

import { useState } from "react";
import type { SqlSchema, SqlTable } from "@/lib/tools/sql/types";
import styles from "./SqlErDiagram.module.css";

export interface SqlErDiagramProps { schema: SqlSchema }
interface DiagramNode { name: string; table?: SqlTable; x: number; y: number; height: number }
const NODE_WIDTH = 260;
const COLUMN_GAP = 90;
const MAX_VISUAL_COLUMNS = 12;
const shortText = (text: string, length = 31) => text.length > length ? `${text.slice(0, length - 1)}…` : text;

export default function SqlErDiagram({ schema }: SqlErDiagramProps) {
  const [zoom, setZoom] = useState(100);
  if (schema.tables.length === 0) return <p className={styles.note}>No tables were declared in this schema.</p>;

  const sourceNodes: { name: string; table?: SqlTable }[] = schema.tables.map(table => ({ name: table.name, table }));
  const names = new Set(sourceNodes.map(node => node.name));
  for (const relationship of schema.relationships) {
    for (const name of [relationship.fromTable, relationship.toTable]) {
      if (!names.has(name)) { names.add(name); sourceNodes.push({ name }); }
    }
  }
  // At most twenty rows keeps the supported schema canvas below 8,000px tall.
  const columnCount = Math.max(1, Math.min(3, sourceNodes.length), Math.ceil(sourceNodes.length / 20));
  const nodes: DiagramNode[] = [];
  let nextY = 28;
  for (let start = 0; start < sourceNodes.length; start += columnCount) {
    const group = sourceNodes.slice(start, start + columnCount);
    let height = 0;
    group.forEach((source, column) => {
      const nodeHeight = source.table ? 76 + Math.min(MAX_VISUAL_COLUMNS, source.table.columns.length) * 20 + (source.table.columns.length > MAX_VISUAL_COLUMNS ? 20 : 0) : 92;
      height = Math.max(height, nodeHeight);
      nodes.push({ ...source, x: 28 + column * (NODE_WIDTH + COLUMN_GAP), y: nextY, height: nodeHeight });
    });
    nextY += height + 56;
  }
  const width = 56 + columnCount * NODE_WIDTH + (columnCount - 1) * COLUMN_GAP;
  const height = nextY;
  const lookup = new Map(nodes.map(node => [node.name, node]));

  return <figure className={styles.figure}>
    <div className={styles.toolbar}>
      <label className={styles.zoom}>Diagram zoom
        <input type="range" min="50" max="150" step="10" value={zoom} onChange={event => setZoom(Number(event.target.value))} />
        <output>{zoom}%</output>
      </label>
      <span className={styles.note}>{schema.tables.length} tables · {schema.relationships.length} declared relationships</span>
    </div>
    <div className={styles.viewport} tabIndex={0} role="region" aria-label="Scrollable entity relationship diagram">
      <svg className={styles.diagram} width={width * zoom / 100} height={height * zoom / 100} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Entity relationship diagram showing declared foreign keys">
        <title>Entity relationship diagram</title>
        <desc>Tables, columns and declared foreign key relationships. Arrows point to referenced tables. External nodes represent tables whose definitions were not supplied. The complete structure is available below.</desc>
        {schema.relationships.map((relationship, index) => {
          const from = lookup.get(relationship.fromTable);
          const to = lookup.get(relationship.toTable);
          if (!from || !to) return null;
          const self = from === to;
          const right = self || to.x >= from.x;
          const x1 = from.x + (right ? NODE_WIDTH : 0);
          const y1 = from.y + 28 + index % 4 * 8;
          const x2 = to.x + (right && !self ? 0 : NODE_WIDTH);
          const y2 = to.y + (self ? 66 : 28 + index % 4 * 8);
          const bend = self ? x1 + 48 : x1 + (right ? 45 : -45);
          const endBend = self ? bend : x2 + (right ? -45 : 45);
          return <g key={`relationship-${index}`} className={styles.edge}>
            <title>{relationship.fromTable} ({relationship.fromColumns.join(", ")}) → {relationship.toTable} ({relationship.toColumns.join(", ")})</title>
            <path d={`M ${x1} ${y1} C ${bend} ${y1}, ${endBend} ${y2}, ${x2} ${y2}`} />
            <polygon points={right && !self ? `${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}` : `${x2},${y2} ${x2 + 8},${y2 - 4} ${x2 + 8},${y2 + 4}`} />
          </g>;
        })}
        {nodes.map((node, index) => <g key={`table-${index}`} className={node.table ? styles.node : styles.external} transform={`translate(${node.x}, ${node.y})`}>
          <title>{node.name}{node.table ? "" : " (external table; definition not supplied)"}</title>
          <rect width={NODE_WIDTH} height={node.height} rx="6" />
          <text x="12" y="25" className={styles.tableName}>{shortText(node.name)}</text>
          <line x1="0" y1="38" x2={NODE_WIDTH} y2="38" />
          {node.table ? <>
            {node.table.columns.slice(0, MAX_VISUAL_COLUMNS).map((column, columnIndex) => <text x="12" y={60 + columnIndex * 20} key={`column-${columnIndex}`}>
              <title>{column.name} · {column.dataType}{column.primaryKey || node.table?.primaryKeys.includes(column.name) ? " · primary key" : ""}{column.nullable === false ? " · not null" : ""}</title>
              {shortText(`${column.primaryKey || node.table?.primaryKeys.includes(column.name) ? "PK " : ""}${column.name}: ${column.dataType}`)}
            </text>)}
            {node.table.columns.length > MAX_VISUAL_COLUMNS && <text x="12" y={60 + MAX_VISUAL_COLUMNS * 20} className={styles.more}>+ {node.table.columns.length - MAX_VISUAL_COLUMNS} columns in full structure</text>}
          </> : <>
            <text x="12" y="60">External referenced table</text>
            <text x="12" y="80" className={styles.more}>Definition not supplied</text>
          </>}
        </g>)}
      </svg>
    </div>
    <figcaption className={styles.caption}>PK = primary key. Arrows show only declared foreign keys, pointing to the referenced table. No cardinality is inferred. Long labels and tables with more than {MAX_VISUAL_COLUMNS} columns are abbreviated visually; the full structure follows.</figcaption>
    <details className={styles.structure}>
      <summary>Complete schema structure</summary>
      <div className={styles.entities}>
        {schema.tables.map((table, index) => <section className={styles.entity} key={`entity-${index}`} aria-label={`Table ${table.name}`}>
          <h3>{table.name}</h3>
          <ul>{table.columns.map((column, columnIndex) => <li key={`column-${columnIndex}`}><strong>{column.name}</strong>: {column.dataType}{column.primaryKey || table.primaryKeys.includes(column.name) ? " · primary key" : ""}{column.nullable === false ? " · NOT NULL" : column.nullable === true ? " · nullable" : ""}</li>)}</ul>
          <p>Primary key: {table.primaryKeys.length ? table.primaryKeys.join(", ") : table.columns.filter(column => column.primaryKey).map(column => column.name).join(", ") || "none declared"}</p>
          {table.foreignKeys.length > 0 && <ul>{table.foreignKeys.map((key, keyIndex) => <li key={`fk-${keyIndex}`}>Foreign key ({key.columns.join(", ")}) → {key.referencedTable} ({key.referencedColumns.join(", ")})</li>)}</ul>}
        </section>)}
      </div>
      <h3 className={styles.relationshipHeading}>Declared relationships</h3>
      {schema.relationships.length === 0 ? <p className={styles.note}>No foreign key relationships declared.</p> : <ul className={styles.relationships}>{schema.relationships.map((relationship, index) => <li key={`relationship-${index}`}>{relationship.fromTable} ({relationship.fromColumns.join(", ")}) → {relationship.toTable} ({relationship.toColumns.join(", ")}){!schema.tables.some(table => table.name === relationship.toTable) ? " · external referenced table" : ""}</li>)}</ul>}
    </details>
  </figure>;
}
