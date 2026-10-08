"use client";
import { useToolHandoff } from "./WorkbenchProvider";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { capabilitiesFor, capabilityForRoute } from "@/config/conversion-capabilities";
import { getColorDefinition, type ColorToolId } from "@/config/color-tools";
import { parseColor, runColor, toHex, toHsl, toRgb } from "@/lib/tools/color/engine";
import { ColorError, type ColorResult } from "@/lib/tools/color/types";
import { useConverterSession } from "./ConverterSession";
import { useSafePathname, useSafeRouter } from "./useSafeNavigation";
import styles from "./ColorCssStation.module.css";

type Definition = NonNullable<ReturnType<typeof getColorDefinition>>;

function sourceFormat(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("#")) return "hex";
  if (normalized.startsWith("rgb")) return "rgb";
  if (normalized.startsWith("hsl")) return "hsl";
  return undefined;
}

function withPickerAlpha(value: string, alpha: unknown): string {
  const percent = Number(alpha);
  if (!Number.isFinite(percent) || percent >= 100) return value;
  const hex = value.replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return value;
  const expanded = hex.length === 3 ? hex.split("").map(part => part + part).join("") : hex;
  const byte = Math.round(Math.min(100, Math.max(0, percent)) * 2.55).toString(16).padStart(2, "0");
  return `#${expanded}${byte}`;
}

function nativeColorValue(value: string): string {
  try {
    return toHex({ ...parseColor(value), a: 1 }).slice(0, 7);
  } catch {
    return "#000000";
  }
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

type PaletteItem = { name: string; hex: string; rgb: string; hsl: string };
function paletteItems(value: unknown): PaletteItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PaletteItem => Boolean(item && typeof item === "object" && typeof (item as PaletteItem).name === "string" && typeof (item as PaletteItem).hex === "string"));
}

function Station({ definition }: { definition: Definition }) {
  const contract = definition.localContract;
  const id = `color-${definition.id}`;
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...contract.defaults }));
  const [result, setResult] = useState<ColorResult | null>(null);
  const [error, setError] = useState<ColorError | null>(null);
  const [notice, setNotice] = useState("");
  const [palette, setPalette] = useState<PaletteItem[]>([]);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pathname = useSafePathname();
  const router = useSafeRouter();
  const session = useConverterSession();
  const isConverter = definition.id === "color-converter";
  const routeCapability = capabilityForRoute(pathname);
  const saved = isConverter ? session.get("color") : undefined;
  const source = saved?.format ?? (routeCapability?.family === "color" ? routeCapability.source : "hex");
  const targetOptions = capabilitiesFor("color", source).map(capability => capability.target.toUpperCase());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isConverter && typeof saved?.value === "string") {
      setValues(current => ({ ...current, color: saved.value }));
    }
  }, [isConverter, saved?.value]); // The provider is stable and the route remounts this station.
  useToolHandoff(definition.slug, text => change("color", text));

  useEffect(() => {
    if (error) {
      const control = form.current?.querySelector<HTMLElement>(`[data-field="${error.field ?? ""}"]`);
      (control ?? errorRef.current)?.focus();
    }
  }, [error]);

  function change(name: string, value: unknown) {
    revision.current++;
    setResult(null);
    setPalette([]);
    setError(null);
    setNotice("");
    setBusy(false);
    setValues(current => ({ ...current, [name]: value }));
    if (isConverter && name === "color" && typeof value === "string") {
      session.set({ family: "color", format: sourceFormat(value) ?? source, value });
    }
  }

  function clear() {
    revision.current++;
    setResult(null);
    setPalette([]);
    setError(null);
    setNotice("");
    setBusy(false);
    setValues({ ...contract.defaults });
    if (isConverter) session.clear("color");
  }

  function selectTarget(target: string) {
    const next = capabilitiesFor("color", source).find(capability => capability.target === target);
    // Color conversions intentionally share one route. Keep this branch so the
    // station follows the same capability/session contract as other converters.
    if (next && next.route !== pathname) router.push(next.route);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = ++revision.current;
    setBusy(true);
    setError(null);
    setNotice("Processing locally…");
    try {
      const runValues = definition.id === "color-picker"
        ? { ...values, color: withPickerAlpha(String(values.color ?? ""), values.alpha) }
        : values;
      const next = await runColor(definition.id, runValues);
      if (!mounted.current || token !== revision.current) return;
      setResult(next);
      setPalette(paletteItems(next.data.palette));
      setNotice("Result ready.");
    } catch (cause) {
      if (mounted.current && token === revision.current) {
        setError(cause instanceof ColorError ? cause : new ColorError("Could not process these color values."));
        setNotice("Check the input error.");
      }
    } finally {
      if (mounted.current && token === revision.current) setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setNotice("Could not copy. Select the result and copy it manually.");
    }
  }

  function updatePalette(index: number, value: string) {
    try {
      const color = parseColor(value);
      const nextPalette = palette.map((item, itemIndex) => itemIndex === index ? { ...item, hex: toHex(color), rgb: toRgb(color), hsl: toHsl(color) } : item);
      setPalette(nextPalette);
      setResult(current => current ? { ...current, text: nextPalette.map(item => item.hex).join("\n"), data: { ...current.data, palette: nextPalette, css: nextPalette.map(item => `  ${item.name}: ${item.hex};`).join("\n"), json: JSON.stringify(nextPalette, null, 2) } } : current);
      setError(null);
      setNotice("Palette updated.");
    } catch (cause) {
      setError(cause instanceof ColorError ? cause : new ColorError("Enter a supported sRGB color.", "palette"));
    }
  }

  function download(text: string, filename: string, type = "text/plain") {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("Download started.");
    } catch {
      setNotice("Could not download. Copy the visible result instead.");
    }
  }

  const previewColor = typeof result?.data.effectiveBackground === "string"
    ? result.data.effectiveBackground
    : typeof result?.data.hex === "string"
      ? result.data.hex
      : typeof values.color === "string" ? values.color : "#FFFFFF";
  const css = typeof result?.data.css === "string" ? result.data.css : "";
  const previewStyle: CSSProperties = definition.id === "css-gradient-generator"
    ? { background: css }
    : definition.id === "box-shadow-generator"
      ? { boxShadow: css }
      : definition.id === "border-radius-generator"
        ? { borderRadius: css.replace(/^border-radius:\s*/, "").replace(/;$/, "") }
        : { backgroundColor: previewColor };
  const hasCssPreview = Boolean(result && css && ["css-gradient-generator", "box-shadow-generator", "border-radius-generator"].includes(definition.id));

  return (
    <div className={styles.station}>
      <div className={styles.layout}>
        <form
          ref={form}
          className={styles.panel}
          onSubmit={submit}
          noValidate
          aria-labelledby={`${id}-input`}
          aria-describedby={`${id}-status`}
          aria-busy={busy}
        >
          <div className={styles.head}>
            <h2 id={`${id}-input`}>{definition.name} input</h2>
          </div>
          <div className={styles.fields}>
            {contract.fields.map(field => {
              const fieldId = `${id}-${field.name}`;
              const fieldError = error?.field === field.name;
              const describedBy = fieldError ? `${fieldId}-error` : undefined;
              const options = isConverter && field.name === "outputFormat"
                ? targetOptions
                : field.options ?? [];
              return (
                <div className={styles.field} key={field.name}>
                  <label htmlFor={fieldId}>{field.label}</label>
                  {field.control === "select" ? (
                    <select
                      className={styles.input}
                      id={fieldId}
                      data-field={field.name}
                      value={String(values[field.name] ?? "")}
                      aria-invalid={fieldError}
                      aria-describedby={describedBy}
                      onChange={event => {
                        change(field.name, event.target.value);
                        if (isConverter && field.name === "outputFormat") selectTarget(event.target.value.toLowerCase());
                      }}
                    >
                      {options.map(option => <option key={option}>{option}</option>)}
                    </select>
                  ) : field.control === "number" ? (
                    <input
                      className={styles.input}
                      id={fieldId}
                      data-field={field.name}
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={String(values[field.name] ?? "")}
                      aria-invalid={fieldError}
                      aria-describedby={describedBy}
                      onChange={event => change(field.name, event.target.value)}
                    />
                   ) : field.control === "color" ? (
                    <>
                      <input className={`${styles.input} ${styles.colorInput}`} id={fieldId} data-field={field.name} type="color" value={nativeColorValue(String(values[field.name] ?? "#000000"))} aria-invalid={fieldError} aria-describedby={describedBy} onChange={event => change(field.name, event.target.value)} />
                      {definition.id === "color-picker" && <label htmlFor={`${fieldId}-text`}>Color value <input className={styles.input} id={`${fieldId}-text`} type="text" value={String(values[field.name] ?? "")} onChange={event => change(field.name, event.target.value)} placeholder="#RRGGBB or RGB/HSL" /></label>}
                    </>
                   ) : field.control === "textarea" ? (
                    <>
                    <textarea
                      className={`${styles.input} ${styles.textarea}`}
                      id={fieldId}
                      data-field={field.name}
                      value={String(values[field.name] ?? "")}
                      aria-invalid={fieldError}
                      aria-describedby={describedBy}
                      onChange={event => change(field.name, event.target.value)}
                    />
                    {definition.id === "css-gradient-generator" && <div className={styles.actions}><button className="button" type="button" onClick={() => change("stops", `${String(values.stops ?? "")}\n#FFFFFF 100%`)}>Add stop</button><button className="button" type="button" onClick={() => { const lines = String(values.stops ?? "").split(/\r?\n/).filter(Boolean); if (lines.length > 2) change("stops", lines.slice(0, -1).join("\n")); }}>Remove stop</button></div>}
                    {definition.id === "box-shadow-generator" && <div className={styles.actions}><button className="button" type="button" onClick={() => change("layers", `${String(values.layers ?? "")}\n0 0 4px 0 #000000`)}>Add layer</button><button className="button" type="button" onClick={() => { const lines = String(values.layers ?? "").split(/\r?\n/).filter(Boolean); if (lines.length > 1) change("layers", lines.slice(0, -1).join("\n")); }}>Remove layer</button></div>}
                    </>
                  ) : (
                    <input
                      className={styles.input}
                      id={fieldId}
                      data-field={field.name}
                      type="text"
                      value={String(values[field.name] ?? "")}
                      aria-invalid={fieldError}
                      aria-describedby={describedBy}
                      onChange={event => change(field.name, event.target.value)}
                    />
                  )}
                  {fieldError && <span className={styles.fieldError} id={describedBy}>{error.message}</span>}
                </div>
              );
            })}
            {contract.notices.map(noticeText => <p className={styles.note} key={noticeText}>{noticeText}</p>)}
          </div>
          <div className={`${styles.actions} ${styles.formActions}`}>
            <button className="button primary" type="submit" disabled={busy}>{busy ? "Processing…" : contract.action}</button>
            <button className="button" type="button" onClick={clear}>Clear</button>
          </div>
        </form>

        <section className={styles.panel} aria-labelledby={`${id}-output`}>
          <div className={styles.head}>
            <h2 id={`${id}-output`}>{contract.outputs.join(" · ")}</h2>
            {result && <div className={styles.actions}><button className="button" type="button" onClick={() => void copy(definition.id === "palette-generator" ? palette.map(item => item.hex).join("\n") : result.text ?? JSON.stringify(result.data, null, 2))}>Copy</button>{definition.id === "palette-generator" && <button className="button" type="button" onClick={() => download(JSON.stringify(palette, null, 2), "palette.json", "application/json")}>Download JSON</button>}</div>}
          </div>
          {result ? (
            <div className={styles.result}>
              {hasCssPreview ? (
                <div className={styles.preview} aria-label="Generated CSS preview">
                  <div className={styles.previewBox} style={previewStyle} />
                </div>
              ) : (
                <div className={styles.swatch}>
                  <i style={{ backgroundColor: previewColor }} role="img" aria-label={`Color preview ${previewColor}`} />
                </div>
              )}
              {definition.id === "palette-generator" && palette.length > 0 && <div className={styles.paletteGrid} aria-label="Editable palette">{palette.map((item, index) => <div className={styles.paletteItem} key={item.name}><div className={styles.paletteSwatch} style={{ backgroundColor: item.hex }} aria-label={`${item.name} ${item.hex}`} /><label htmlFor={`${id}-palette-${index}`}>{item.name}<input className={styles.input} id={`${id}-palette-${index}`} type="text" value={item.hex} onChange={event => updatePalette(index, event.target.value)} /><button className="button" type="button" onClick={() => void copy(item.hex)}>Copy color</button></label></div>)}</div>}
              <pre className={styles.output} tabIndex={0}>{result.text ?? JSON.stringify(result.data, null, 2)}</pre>
              {Object.keys(result.data).length > 0 && (
                <dl className={styles.dataList}>
                  {Object.entries(result.data).map(([key, value]) => {
                    if (definition.id === "palette-generator" && ["palette", "json"].includes(key)) return null;
                    const text = displayValue(value);
                    return <div key={key}><dt>{key}</dt><dd><button className="button" type="button" onClick={() => void copy(text)}>{text}</button></dd></div>;
                  })}
                </dl>
              )}
            </div>
          ) : <p className={styles.empty}>Your result will appear after you {contract.action.toLowerCase()}.</p>}
        </section>
      </div>
      {error && <p className={styles.error} ref={errorRef} role="alert" tabIndex={-1}>{error.message}</p>}
      <p className={styles.status} id={`${id}-status`} role="status">{notice}</p>
      <p className={styles.privacy}>All processing stays in this browser. Inputs are not transmitted or saved.</p>
    </div>
  );
}

export default function ColorCssStation({ toolId }: { toolId: ColorToolId }) {
  const definition = getColorDefinition(toolId);
  return definition ? <Station key={definition.id} definition={definition} /> : null;
}
