"use client";

import { CONDITION_OPERATORS, VALUE_TYPES, type SqlAssignment, type SqlCondition, type SqlLiteral, type SqlOrder } from "@/lib/tools/sql/types";
import styles from "./SqlStructuredFields.module.css";

export interface SqlStructuredFieldsProps {
  kind: "columns" | "rows" | "assignments" | "conditions" | "order";
  id: string;
  label: string;
  value: unknown;
  onChange: (value: unknown, action?: { removedIndex?: number }) => void;
  columns?: string[];
  describedBy?: string;
  invalid?: boolean;
}

const emptyLiteral = (): SqlLiteral => ({ type: "String", value: "" });
const nullOperator = (operator: string) => operator === "IS NULL" || operator === "IS NOT NULL";
const listOperator = (operator: string) => operator === "IN" || operator === "NOT IN";

export default function SqlStructuredFields({ kind, id, label, value, onChange, columns = [], describedBy, invalid }: SqlStructuredFieldsProps) {
  const items = Array.isArray(value) ? value : [];
  const limit = kind === "rows" ? 1000 : 100;
  const association = { "aria-describedby": describedBy, "aria-invalid": invalid || undefined };
  const replace = (index: number, next: unknown) => onChange(items.map((item, position) => position === index ? next : item));
  const remove = (index: number) => onChange(items.filter((_, position) => position !== index), kind === "columns" ? { removedIndex: index } : undefined);
  const singular = { columns: "column", rows: "row", assignments: "assignment", conditions: "condition", order: "sort column" }[kind];

  function literalEditor(literal: SqlLiteral, scope: string, caption: string, change: (next: SqlLiteral) => void) {
    return <div className={styles.literal}>
      <div className={styles.field}>
        <label htmlFor={`${scope}-type`}>{caption} type</label>
        <select id={`${scope}-type`} className={styles.input} value={literal.type} {...association} onChange={event => {
          const type = event.target.value as SqlLiteral["type"];
          change({ type, value: type === "NULL" ? "" : type === "Boolean" ? "true" : literal.type === "NULL" || literal.type === "Boolean" ? "" : literal.value });
        }}>
          {VALUE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      {literal.type !== "NULL" && <div className={styles.field}>
        <label htmlFor={`${scope}-value`}>{caption} value</label>
        {literal.type === "Boolean"
          ? <select id={`${scope}-value`} className={styles.input} value={literal.value} required {...association} onChange={event => change({ ...literal, value: event.target.value })}>
            <option value="true">true</option><option value="false">false</option>
          </select>
          : <input id={`${scope}-value`} className={styles.input} type="text" inputMode={literal.type === "Number" ? "decimal" : undefined} required={literal.type === "Number"} value={literal.value} {...association} onChange={event => change({ ...literal, value: event.target.value })} />}
      </div>}
    </div>;
  }

  function columnEditor(column: string, scope: string, caption: string, change: (next: string) => void) {
    return <div className={styles.field}>
      <label htmlFor={scope}>{caption}</label>
      <input id={scope} className={styles.input} type="text" value={column} required {...association} onChange={event => change(event.target.value)} />
    </div>;
  }

  function add() {
    if (items.length >= limit) return;
    const next = kind === "columns" ? "" : kind === "rows" ? columns.map(emptyLiteral)
      : kind === "assignments" ? { column: "", value: emptyLiteral() }
      : kind === "conditions" ? { column: "", operator: "=", values: [emptyLiteral()] }
      : { column: "", direction: "ASC" };
    onChange([...items, next]);
  }

  return <fieldset id={id} className={styles.editor} {...association}>
    <legend>{label}</legend>
    <div className={styles.records}>
      {items.map((item, index) => {
        const scope = `${id}-${index + 1}`;
        const number = index + 1;
        return <div className={styles.record} key={scope}>
          <div className={styles.recordHead}>
            <strong>{singular[0].toUpperCase() + singular.slice(1)} {number}</strong>
            <button type="button" className={styles.button} aria-label={`Remove ${singular} ${number}`} onClick={() => remove(index)}>Remove</button>
          </div>
          {kind === "columns" && columnEditor(item as string, `${scope}-column`, `Column ${number}`, next => replace(index, next))}
          {kind === "rows" && (() => {
            const row = item as SqlLiteral[];
            const width = Math.max(row.length, columns.length);
            return <>
              {row.length !== columns.length && <p className={styles.hint}>This row has {row.length} values for {columns.length} columns. All existing values are shown; each row must match the columns before generating SQL.</p>}
              <div className={styles.cells}>
                {Array.from({ length: width }, (_, cell) => <div className={styles.cell} key={`${scope}-cell-${cell + 1}`}>
                  <strong>{columns[cell] || `Column ${cell + 1}${cell >= columns.length ? " (unassigned)" : ""}`}</strong>
                  {literalEditor(row[cell] ?? emptyLiteral(), `${scope}-cell-${cell + 1}`, `Row ${number}, ${columns[cell] || `column ${cell + 1}`}`, next => {
                    const updated = [...row];
                    while (updated.length <= cell) updated.push(emptyLiteral());
                    updated[cell] = next;
                    replace(index, updated);
                  })}
                </div>)}
              </div>
            </>;
          })()}
          {kind === "assignments" && (() => {
            const assignment = item as SqlAssignment;
            return <>
              {columnEditor(assignment.column, `${scope}-column`, `Assignment ${number} column`, column => replace(index, { ...assignment, column }))}
              {literalEditor(assignment.value, `${scope}-literal`, `Assignment ${number}`, next => replace(index, { ...assignment, value: next }))}
            </>;
          })()}
          {kind === "conditions" && (() => {
            const condition = item as SqlCondition;
            return <>
              <div className={styles.pair}>
                {columnEditor(condition.column, `${scope}-column`, `Condition ${number} column`, column => replace(index, { ...condition, column }))}
                <div className={styles.field}>
                  <label htmlFor={`${scope}-operator`}>Condition {number} operator</label>
                  <select id={`${scope}-operator`} className={styles.input} value={condition.operator} {...association} onChange={event => {
                    const operator = event.target.value as SqlCondition["operator"];
                    replace(index, { ...condition, operator, values: nullOperator(operator) ? [] : [emptyLiteral()] });
                  }}>
                    {CONDITION_OPERATORS.map(operator => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </div>
              </div>
              {!nullOperator(condition.operator) && <div className={styles.values}>
                {condition.values.map((literal, valueIndex) => <div className={styles.conditionValue} key={`${scope}-literal-${valueIndex + 1}`}>
                  {literalEditor(literal, `${scope}-literal-${valueIndex + 1}`, `Condition ${number}, value ${valueIndex + 1}`, next => replace(index, { ...condition, values: condition.values.map((current, position) => position === valueIndex ? next : current) }))}
                  {listOperator(condition.operator) && <button type="button" className={styles.button} aria-label={`Remove condition ${number} value ${valueIndex + 1}`} onClick={() => replace(index, { ...condition, values: condition.values.filter((_, position) => position !== valueIndex) })}>Remove value</button>}
                </div>)}
                {listOperator(condition.operator) && <>
                  <button type="button" className={styles.button} disabled={condition.values.length >= 100} aria-label={`Add value to condition ${number}`} onClick={() => replace(index, { ...condition, values: [...condition.values, emptyLiteral()] })}>Add value</button>
                  {condition.values.length >= 100 && <p className={styles.hint}>Limit: 100 values per condition.</p>}
                </>}
                {!listOperator(condition.operator) && condition.values.length === 0 && <button type="button" className={styles.button} aria-label={`Add value to condition ${number}`} onClick={() => replace(index, { ...condition, values: [emptyLiteral()] })}>Add value</button>}
              </div>}
            </>;
          })()}
          {kind === "order" && (() => {
            const order = item as SqlOrder;
            return <div className={styles.pair}>
              {columnEditor(order.column, `${scope}-column`, `Sort column ${number}`, column => replace(index, { ...order, column }))}
              <div className={styles.field}>
                <label htmlFor={`${scope}-direction`}>Sort direction {number}</label>
                <select id={`${scope}-direction`} className={styles.input} value={order.direction} {...association} onChange={event => replace(index, { ...order, direction: event.target.value as SqlOrder["direction"] })}>
                  <option value="ASC">ASC</option><option value="DESC">DESC</option>
                </select>
              </div>
            </div>;
          })()}
        </div>;
      })}
    </div>
    <button type="button" className={styles.button} disabled={items.length >= limit || kind === "rows" && columns.length === 0} onClick={add}>Add {singular}</button>
    {kind === "rows" && columns.length === 0 && <p className={styles.hint}>Add columns before adding a row.</p>}
    {items.length >= limit && <p className={styles.hint}>Limit: {limit} {kind === "order" ? "sort columns" : kind}.</p>}
  </fieldset>;
}
