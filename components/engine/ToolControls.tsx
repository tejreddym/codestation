"use client";

import React from "react";
import type {
  ToolInput,
  SelectInputConfig,
  NumberInputConfig,
  TextInputConfig,
  ToolInputWhen,
} from "@/lib/engine/types";
import styles from "./UniversalToolShell.module.css";

export interface ToolControlsProps {
  inputs: ToolInput[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}

export function evaluateWhen(
  when: ToolInputWhen | undefined,
  values: Record<string, unknown>
): boolean {
  if (!when) return true;
  if (typeof when === "function") {
    try {
      return when(values);
    } catch {
      return false;
    }
  }
  const currentVal = values[when.field];
  if (when.equals !== undefined && currentVal !== when.equals) return false;
  if (when.value !== undefined && currentVal !== when.value) return false;
  if (when.notEquals !== undefined && currentVal === when.notEquals) return false;
  if (when.in !== undefined && Array.isArray(when.in) && !when.in.includes(currentVal)) return false;
  return true;
}

export function ToolControls({ inputs, values, onChange, disabled = false }: ToolControlsProps) {
  // Primary code/text input is handled by ToolEditor; all other parameters or secondary inputs are rendered here
  const controlInputs = inputs.filter(
    (inp) =>
      inp.control === "select" ||
      inp.control === "radio" ||
      inp.control === "toggle" ||
      inp.control === "checkbox" ||
      inp.control === "number" ||
      inp.control === "range" ||
      inp.control === "password" ||
      inp.control === "date" ||
      inp.control === "time" ||
      inp.control === "timezone"
  );

  if (controlInputs.length === 0) {
    return null;
  }

  // Check if any control is visible under current when predicates
  const visibleInputs = controlInputs.filter(
    (inp) => !inp.when || evaluateWhen(inp.when, values)
  );

  if (visibleInputs.length === 0) {
    return null;
  }

  return (
    <div className={styles.controlsGrid} data-testid="tool-controls">
      {controlInputs.map((inp) => {
        if (inp.when && !evaluateWhen(inp.when, values)) {
          return null;
        }

        const defaultValue =
          "defaultValue" in inp
            ? (inp as { defaultValue?: unknown }).defaultValue
            : undefined;
        const value = values[inp.name] !== undefined ? values[inp.name] : defaultValue;

        if (inp.control === "select" || inp.control === "radio") {
          const selectInp = inp as SelectInputConfig;
          return (
            <div key={inp.name} className={styles.controlField} data-testid={`group-${inp.name}`}>
              <label htmlFor={`ctrl-${inp.name}`} className={styles.controlLabel}>
                {inp.label}
              </label>
              <select
                id={`ctrl-${inp.name}`}
                data-testid={`control-${inp.name}`}
                className={styles.controlSelect}
                value={String(value ?? "")}
                disabled={disabled}
                onChange={(e) => onChange(inp.name, e.target.value)}
              >
                {selectInp.options.map((opt) => {
                  const val = typeof opt === "object" && opt !== null ? opt.value : opt;
                  const label = typeof opt === "object" && opt !== null ? opt.label : opt;
                  return (
                    <option key={String(val)} value={String(val)}>
                      {String(label)}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        }

        if (inp.control === "toggle" || inp.control === "checkbox") {
          return (
            <div key={inp.name} className={styles.controlCheckbox} data-testid={`group-${inp.name}`}>
              <input
                type="checkbox"
                id={`ctrl-${inp.name}`}
                role="switch"
                data-testid={`control-${inp.name}`}
                checked={Boolean(value)}
                disabled={disabled}
                onChange={(e) => onChange(inp.name, e.target.checked)}
              />
              <label htmlFor={`ctrl-${inp.name}`} className={styles.controlLabel} style={{ cursor: "pointer" }}>
                {inp.label}
              </label>
            </div>
          );
        }

        if (inp.control === "number" || inp.control === "range") {
          const numInp = inp as NumberInputConfig;
          return (
            <div key={inp.name} className={styles.controlField} data-testid={`group-${inp.name}`}>
              <label htmlFor={`ctrl-${inp.name}`} className={styles.controlLabel}>
                {inp.label}
                {numInp.unit ? ` (${numInp.unit})` : ""}
              </label>
              <input
                type="number"
                id={`ctrl-${inp.name}`}
                data-testid={`control-${inp.name}`}
                className={styles.controlInput}
                value={value !== undefined ? Number(value) : ""}
                min={numInp.min}
                max={numInp.max}
                step={numInp.step ?? 1}
                disabled={disabled}
                onChange={(e) => {
                  const val = e.target.value === "" ? 0 : Number(e.target.value);
                  onChange(inp.name, val);
                }}
              />
            </div>
          );
        }

        if (inp.control === "password" || inp.control === "date" || inp.control === "time" || inp.control === "timezone") {
          const textInp = inp as TextInputConfig;
          return (
            <div key={inp.name} className={styles.controlField} data-testid={`group-${inp.name}`}>
              <label htmlFor={`ctrl-${inp.name}`} className={styles.controlLabel}>
                {inp.label}
              </label>
              <input
                type={inp.control === "password" ? "password" : "text"}
                id={`ctrl-${inp.name}`}
                data-testid={`control-${inp.name}`}
                className={styles.controlInput}
                value={String(value ?? "")}
                placeholder={textInp.placeholder}
                disabled={disabled}
                onChange={(e) => onChange(inp.name, e.target.value)}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
