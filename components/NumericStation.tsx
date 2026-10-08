"use client";

import { useMemo, useState } from "react";
import { getNumericDefinition, type NumericToolId } from "@/config/numeric-contracts";
import { formatUnitValue, convertUnit } from "@/lib/tools/unit";
import { getUnitDefinition, unitCatalog, type UnitCategory } from "@/config/unit-tools";
import { formatTemperature, convertTemperature } from "@/lib/tools/temperature";
import { getTemperatureScale, temperatureScales } from "@/config/temperature-tools";
import { numberBaseCatalog } from "@/config/number-base-tools";
import { convertNumberBase, formatNumberBase } from "@/lib/tools/number-base";
import styles from "./NumericStation.module.css";

type Values = Record<string, string | boolean>;
type NumericResult = { text: string; sourceText: string; value: number | bigint };

export default function NumericStation({ toolId }: { toolId: NumericToolId }) {
  const definition = getNumericDefinition(toolId)!;
  const [values, setValues] = useState<Values>(() => Object.fromEntries(Object.entries(definition.localContract.defaults).map(([key, value]) => [key, typeof value === "boolean" ? value : String(value)])));
  const [result, setResult] = useState<NumericResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const unitOptions = useMemo(() => toolId === "unit-converter" ? unitCatalog[values.category as UnitCategory] ?? [] : [], [toolId, values.category]);
  const optionsFor = (name: string) => name === "from" || name === "to"
    ? toolId === "unit-converter" ? unitOptions.map(unit => unit.id) : temperatureScales.map(scale => scale.id)
    : name === "fromBase" || name === "toBase" ? numberBaseCatalog.map(base => String(base.base)) : [];

  function change(name: string, value: string | boolean) {
    if (toolId === "unit-converter" && name === "category" && typeof value === "string") {
      const units = unitCatalog[value as UnitCategory] ?? [];
      setValues(current => ({ ...current, category: value, from: units[0]?.id ?? "", to: units[1]?.id ?? "" }));
    } else setValues(current => ({ ...current, [name]: value }));
    setResult(null);
    setError("");
    setNotice("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      let text: string;
      let sourceText: string;
      let value: number | bigint;
      if (toolId === "unit-converter") {
        const converted = convertUnit({ category: values.category as UnitCategory, from: values.from as never, to: values.to as never, value: values.value as string });
        value = converted.value;
        sourceText = formatUnitValue(converted.value);
        text = `${converted.text} ${getUnitDefinition(converted.to)?.symbol ?? converted.to}`;
      } else if (toolId === "temperature-converter") {
        const converted = convertTemperature({ from: values.from as never, to: values.to as never, value: values.value as string });
        value = converted.value;
        sourceText = formatTemperature(converted.value);
        text = `${converted.text} ${getTemperatureScale(converted.to)?.symbol ?? converted.to}`;
      } else {
        const converted = convertNumberBase({ fromBase: Number(values.fromBase), toBase: Number(values.toBase), value: values.value as string, outputPrefix: values.outputPrefix === true });
        value = converted.value;
        sourceText = formatNumberBase(converted.value, Number(values.toBase));
        text = converted.text;
      }
      setResult({ text, sourceText, value });
      setNotice("Result ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not convert this value.");
      setNotice("Check the input error.");
    }
  }

  function clear() {
    setValues(Object.fromEntries(Object.entries(definition.localContract.defaults).map(([key, value]) => [key, typeof value === "boolean" ? value : String(value)])));
    setResult(null);
    setError("");
    setNotice("");
  }

  function swap() {
    if (!result) return;
    setValues(current => toolId === "number-base-converter"
      ? { ...current, value: result.sourceText, fromBase: current.toBase, toBase: current.fromBase }
      : { ...current, value: result.sourceText, from: current.to, to: current.from });
    setResult(null);
    setError("");
    setNotice("Source and target swapped. Convert to calculate the new result.");
  }

  function optionLabel(fieldName: string, option: string): string {
    if (fieldName === "category") return option[0].toUpperCase() + option.slice(1);
    if (toolId === "unit-converter") return getUnitDefinition(option)?.name ?? option;
    if (toolId === "temperature-converter") { const scale = getTemperatureScale(option); return scale ? `${scale.name} (${scale.symbol})` : option; }
    const base = numberBaseCatalog.find(entry => String(entry.base) === option);
    return base ? `${base.label} — base ${option}` : option;
  }

  return <div className={`tool-layout ${styles.station}`}>
    <div className="panel"><form className={styles.form} onSubmit={submit} noValidate aria-describedby="numeric-status">
      <h2>{definition.name} input</h2>
      {definition.localContract.fields.map(field => {
        const id = `numeric-${toolId}-${field.name}`;
        const options = optionsFor(field.name);
        const choices = options.length ? options : field.options ?? [];
        return <div className={styles.field} key={field.name}><label htmlFor={id}>{field.label}</label>{field.control === "checkbox" ? <input id={id} type="checkbox" checked={values[field.name] === true} onChange={event => change(field.name, event.target.checked)} /> : field.control === "select" ? <select id={id} value={String(values[field.name] ?? "")} onChange={event => change(field.name, event.target.value)}>{choices.map(option => <option key={option} value={option}>{optionLabel(field.name, option)}</option>)}</select> : <input id={id} type="text" inputMode="decimal" value={String(values[field.name] ?? "")} onChange={event => change(field.name, event.target.value)} />}</div>;
      })}
        <div className={`actions ${styles.actions}`}><button className="button primary" type="submit">Convert</button><button className="button" type="button" onClick={swap} disabled={!result}>Swap</button><button className="button" type="button" onClick={clear}>Clear</button></div>
      {definition.localContract.notices.map(text => <p className="muted" key={text}>{text}</p>)}
    </form></div>
    <section className="panel" aria-labelledby="numeric-output"><h2 id="numeric-output" className={styles.outputHeading}>{definition.localContract.outputs.join(" · ")}</h2>{result ? <div className={styles.output}><pre tabIndex={0}>{result.text}</pre><button className="button" type="button" onClick={() => { if (!navigator.clipboard) { setNotice("Could not copy."); return; } void navigator.clipboard.writeText(result.text).then(() => setNotice("Copied."), () => setNotice("Could not copy.")); }}>Copy</button></div> : <p className="muted">Convert a valid source value to see the result.</p>}</section>
    <p id="numeric-status" role="status" aria-live="polite">{notice}</p>{error && <p role="alert">{error}</p>}
  </div>;
}
