"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSafePathname, useSafeRouter } from "./useSafeNavigation";
import { getImageDefinition, type ImageToolId } from "@/config/image-tools";
import { capabilitiesFor, capabilityForRoute } from "@/config/conversion-capabilities";
import { useConverterSession } from "./ConverterSession";
import { ImageError, type ImageResult, type ImageValues } from "@/lib/tools/image/types";
import ImageCropper, { type Crop } from "./ImageCropper";
import styles from "./ImageStation.module.css";

type Definition = NonNullable<ReturnType<typeof getImageDefinition>>;
type Dimensions = { width: number; height: number; mime: string };
const rasterMime = /^(?:image\/(?:png|jpeg|webp|gif|bmp|avif|x-icon|vnd\.microsoft\.icon))$/;
const imageFormat = (mime: string) => mime === "image/jpeg" ? "jpg" : mime === "image/svg+xml" ? "svg" : mime.replace("image/", "").toLowerCase();
const imageFamily = (definition: Definition) => definition.id.startsWith("svg-") ? "image-svg" : "image-raster";

function ResultValue({ value, label }: { value: unknown; label: string }) {
  if (Array.isArray(value)) return <ol className={styles.palette} aria-label={label}>{value.map((entry, index) => <li key={index}><ResultValue value={entry} label={`${label} ${index + 1}`} /></li>)}</ol>;
  if (value && typeof value === "object") return <dl className={styles.dataList}>{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd><ResultValue value={entry} label={`${label} ${key}`} /></dd></div>)}</dl>;
  const text = value === null ? "null" : value === undefined ? "" : String(value);
  return <>{/^#[\da-f]{6}$/i.test(text) && <span className={styles.swatch} style={{ backgroundColor: text }} role="img" aria-label={`Color preview ${text}`} />}<span className={styles.dataValue}>{text}</span></>;
}

function Station({ definition }: { definition: Definition }) {
  const contract = definition.localContract;
  const id = `image-${definition.id}`;
  const [values, setValues] = useState<ImageValues>(() => ({ ...contract.defaults }));
  const [result, setResult] = useState<ImageResult | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const converterSession = useConverterSession();
  const selectedFile = useRef<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const ownedSource = useRef("");
  const ownedResult = useRef("");
  const downloadUrls = useRef(new Set<string>());
  const revision = useRef(0);
  const fileRevision = useRef(0);
  const mounted = useRef(false);
  const isCropper = definition.id === "image-cropper";
  const isResizer = definition.id === "image-resizer";
  const svgAlternative = contract.fields.some(field => field.name === "file") && contract.fields.some(field => field.name === "source");
  const capability = capabilityForRoute(pathname);
  const converterFamily = imageFamily(definition);
  const converter = capability?.family === converterFamily ? capability : undefined;
  const currentTarget = converter?.target ?? "";
  const sourceSession = converterSession.get(converterFamily);
  const targetOptions = sourceSession ? capabilitiesFor(converterFamily, sourceSession.format).map(item => item.target) : capabilitiesFor(converterFamily, converter?.source).map(item => item.target);

  function revokeSource() { if (ownedSource.current) URL.revokeObjectURL(ownedSource.current); ownedSource.current = ""; }
  function revokeResult() { if (ownedResult.current) URL.revokeObjectURL(ownedResult.current); ownedResult.current = ""; }
  function revokeDownloads() { for (const url of downloadUrls.current) URL.revokeObjectURL(url); downloadUrls.current.clear(); }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current++; fileRevision.current++; selectedFile.current = null; revokeSource(); revokeResult(); revokeDownloads(); };
  }, []);

  useEffect(() => {
    const saved = converterSession.get(converterFamily);
    if (saved?.value instanceof File && !selectedFile.current) void chooseFile(saved.value);
  // The provider is intentionally memory-only and stable; a route change remounts this station.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id]);

  useEffect(() => {
    if (!error) return;
    const control = Array.from(form.current?.querySelectorAll<HTMLElement>("[data-image-field]") ?? []).find(node => node.dataset.imageField === error.field);
    if (control) control.focus(); else errorRef.current?.focus();
  }, [error]);

  function refreshSource() {
    revokeSource();
    const file = selectedFile.current;
    // Never embed user SVG: a Blob SVG can contain external resource references.
    const next = file && dimensions && rasterMime.test(dimensions.mime) ? URL.createObjectURL(file) : "";
    ownedSource.current = next; setSourceUrl(next);
  }

  function invalidate(refresh = true) {
    revision.current++;
    revokeResult(); revokeDownloads();
    setResult(null); setResultUrl(""); setError(null); setNotice(""); setBusy(false);
    if (refresh) refreshSource();
  }

  function change(name: string, value: unknown) {
    invalidate();
    if (name === "source" && svgAlternative) {
      fileRevision.current++; selectedFile.current = null; setDimensions(null); setCrop(null); setInspecting(false); revokeSource(); setSourceUrl("");
      if (fileInput.current) fileInput.current.value = "";
      if (converter) converterSession.set({ family: converterFamily, format: "svg", value });
    }
    setValues(current => {
      const next = { ...current, [name]: value };
      const locked = current.lockAspect === true || current.lockAspect === "true";
      if (isResizer && dimensions && locked && (name === "width" || name === "height")) {
        const numeric = Number(value);
        if (Number.isInteger(numeric) && numeric > 0) next[name === "width" ? "height" : "width"] = String(Math.max(1, Math.round(numeric * (name === "width" ? dimensions.height / dimensions.width : dimensions.width / dimensions.height))));
      }
      if (isResizer && dimensions && name === "lockAspect" && value === true && Number(current.width) > 0) next.height = String(Math.max(1, Math.round(Number(current.width) * dimensions.height / dimensions.width)));
      return next;
    });
  }

  async function chooseFile(file: File | null) {
    invalidate(false); revokeSource(); setSourceUrl(""); setDimensions(null); setCrop(null);
    selectedFile.current = file;
    const current = ++fileRevision.current;
    if (svgAlternative) setValues(previous => ({ ...previous, source: "" }));
    if (!file) { setInspecting(false); return; }
    // Inspection is local decoding only; processing always waits for the action button.
    setInspecting(true); setNotice("Reading local image dimensions…");
    const active = () => mounted.current && fileRevision.current === current;
    try {
      const { inspectImage } = await import("@/lib/tools/image/engine");
      if (!active()) return;
      const info = await inspectImage(file);
      if (!active()) return;
      setDimensions(info);
      setCrop({ x: 0, y: 0, width: info.width, height: info.height });
      if (isResizer) setValues(previous => ({ ...previous, width: String(info.width), height: String(info.height) }));
      if (rasterMime.test(info.mime)) { const url = URL.createObjectURL(file); ownedSource.current = url; setSourceUrl(url); }
      if (converter) {
        const sourceFormat = imageFormat(info.mime);
        converterSession.set({ family: converterFamily, format: sourceFormat, value: file, metadata: { width: info.width, height: info.height, mime: info.mime } });
        const available = capabilitiesFor(converterFamily, sourceFormat);
        const selected = available.some(item => item.target === converter.target) ? converter.target : available[0]?.target;
        if (selected && (sourceFormat !== converter.source || selected !== converter.target)) {
          const next = available.find(item => item.target === selected);
          if (next && next.route !== pathname) router.replace(next.route);
        }
      }
      setNotice("Local image ready. Choose the action to process it.");
    } catch (cause) {
      if (active()) { setError({ message: cause instanceof ImageError ? cause.message : "Could not read this local image. Choose a supported image file.", field: "file" }); setNotice(""); }
    } finally { if (active()) setInspecting(false); }
  }

  function clear() {
    invalidate(false); fileRevision.current++; selectedFile.current = null;
    revokeSource(); setSourceUrl(""); setDimensions(null); setCrop(null); setInspecting(false);
    if (fileInput.current) fileInput.current.value = "";
    setValues({ ...contract.defaults });
    if (converter) converterSession.clear(converterFamily);
  }

  function selectTarget(target: string) {
    const source = sourceSession?.format ?? converter?.source;
    const next = source && capabilitiesFor(converterFamily, source).find(item => item.target === target);
    if (!next || next.route === pathname) return;
    setNotice(`Output format changed to ${target.toUpperCase()}; source retained.`);
    router.push(next.route);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); invalidate(false);
    const current = revision.current;
    const snapshot: ImageValues = { ...values, file: selectedFile.current, ...(isCropper && crop ? { crop: { ...crop } } : {}) };
    const active = () => mounted.current && revision.current === current;
    setBusy(true); setNotice("Processing locally…");
    try {
      if (contract.fields.some(field => field.control === "file") && !snapshot.file && !(svgAlternative && typeof snapshot.source === "string" && snapshot.source.trim())) throw new ImageError(svgAlternative ? "Choose a local SVG file or enter SVG source." : "Choose a local image file.", "file");
      for (const field of contract.fields) {
        if (field.optional || field.control === "file" || field.control === "checkbox" || svgAlternative && field.name === "source" && snapshot.file) continue;
        if (snapshot[field.name] === undefined || snapshot[field.name] === null || String(snapshot[field.name]).trim() === "") throw new ImageError(`${field.label} is required.`, field.name);
      }
      const { runImage } = await import("@/lib/tools/image/engine");
      if (!active()) return;
      const next = await runImage(definition.id, snapshot);
      if (!active()) return;
      if (next.blob && rasterMime.test(next.blob.type)) { const url = URL.createObjectURL(next.blob); ownedResult.current = url; setResultUrl(url); }
      setResult(next); setNotice("Result ready.");
    } catch (cause) {
      if (active()) { setError(cause instanceof ImageError ? { message: cause.message, field: cause.field } : { message: "Could not process this image. Check the supported format and inputs." }); setNotice("Check the input error."); }
    } finally { if (active()) setBusy(false); }
  }

  async function copy(text: string, label: string) {
    const current = revision.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (mounted.current && revision.current === current) setNotice(`${label} copied.`);
    } catch { if (mounted.current && revision.current === current) setNotice("Could not copy. Select the text result and copy it manually."); }
  }

  function download() {
    if (!result?.blob || !result.extension) return;
    let url = "";
    try {
      url = URL.createObjectURL(result.blob); downloadUrls.current.add(url);
      const link = document.createElement("a"); link.href = url; link.download = `${definition.id}.${result.extension}`;
      document.body.appendChild(link); try { link.click(); } finally { link.remove(); }
      setNotice("Download requested.");
    } catch { setNotice("Could not download the result. Try again."); }
    finally { if (url) { const owned = url; setTimeout(() => { if (downloadUrls.current.delete(owned)) URL.revokeObjectURL(owned); }, 0); } }
  }

  const base64 = typeof result?.data.base64 === "string" ? result.data.base64 : undefined;
  const dataUri = typeof result?.data.dataUri === "string" ? result.data.dataUri : undefined;
  const textLabel = contract.outputs[0] ?? "Result";
  const outputLabel = contract.outputs.join(" · ");
  return <div className={styles.station}>
    <div className={styles.layout}>
      <form ref={form} className={styles.panel} onSubmit={event => void submit(event)} noValidate autoComplete="off" aria-labelledby={`${id}-input`} aria-describedby={`${id}-status${error ? ` ${id}-error` : ""}`} aria-busy={busy || inspecting}>
        <div className={styles.panelHead}><h2 id={`${id}-input`}>{definition.name} input</h2></div>
        <div className={styles.fields}>{converter && <div className={styles.field}><label htmlFor={`${id}-output-format`}>Output Format</label><select id={`${id}-output-format`} className={styles.input} value={currentTarget} onChange={event => selectTarget(event.target.value)} aria-describedby={`${id}-status`}><option value="" disabled>Select an output format</option>{targetOptions.map(target => <option key={target} value={target}>{target.toUpperCase()}</option>)}</select><p className={styles.hint}>Source: {sourceSession?.format?.toUpperCase() ?? converter.source.toUpperCase()} ({sourceSession ? "detected" : "route default"}). Changing this target keeps the original file in memory.</p></div>}{contract.fields.filter(field => field.name !== "crop" && !(isCropper && ["x", "y", "width", "height"].includes(field.name))).map(field => {
          const fieldId = `${id}-${field.name}`;
          const invalid = !!error && (!error.field || error.field === field.name);
          const shared = { id: fieldId, name: field.name, "data-image-field": field.name, "aria-describedby": `${id}-status${invalid ? ` ${id}-error` : ""}`, "aria-invalid": invalid || undefined, required: !field.optional && !(svgAlternative && ["source", "file"].includes(field.name)) };
          const value = values[field.name] ?? "";
          if (field.control === "checkbox") return <label className={styles.checkbox} key={field.name} htmlFor={fieldId}><input {...shared} type="checkbox" checked={value === true || value === "true"} onChange={event => change(field.name, event.target.checked)} />{field.label}</label>;
          return <div className={styles.field} key={field.name}><label htmlFor={fieldId}>{field.label}</label>
            {field.control === "file" ? <input {...shared} ref={fileInput} className={styles.input} type="file" accept={field.accept} onChange={event => void chooseFile(event.target.files?.[0] ?? null)} />
              : field.control === "select" ? <select {...shared} className={styles.input} value={String(value)} onChange={event => change(field.name, event.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option === "image/jpeg" ? "JPEG" : option === "image/webp" ? "WebP" : option}</option>)}</select>
                : field.control === "textarea" ? <textarea {...shared} className={`${styles.input} ${styles.textarea}`} value={String(value)} rows={7} autoCapitalize="off" spellCheck={false} onChange={event => change(field.name, event.target.value)} />
                  : <input {...shared} className={styles.input} type={field.control === "number" ? "number" : "text"} value={String(value)} min={field.min} max={field.max} step={field.control === "number" ? "1" : undefined} onChange={event => change(field.name, event.target.value)} />}
          </div>;
        })}
          {svgAlternative && <p className={styles.hint}>Choose one SVG source: selecting a file clears source text; editing source text clears the file.</p>}
           {dimensions && (isResizer || isCropper) && <p className={styles.hint}>Original image: {dimensions.width} × {dimensions.height} pixels</p>}
          {sourceUrl && dimensions && (isCropper && crop ? <ImageCropper id={`${id}-crop`} src={sourceUrl} width={dimensions.width} height={dimensions.height} value={crop} describedBy={error ? `${id}-error` : undefined} onChange={next => { invalidate(); setCrop(next); }} /> : <figure className={styles.preview}><img src={sourceUrl} alt="Selected local image preview" /><figcaption>Selected local image</figcaption></figure>)}
          {contract.notices.map((text, index) => <p className={styles.note} key={index}>{text}</p>)}
        </div>
        <div className={`${styles.actions} ${styles.formActions}`}><button type="submit" className="button primary" disabled={busy || inspecting}>{busy ? "Processing…" : contract.action}</button><button type="button" className="button" onClick={clear}>Clear</button></div>
      </form>
      <section className={styles.panel} aria-labelledby={`${id}-output`} aria-busy={busy}>
        <div className={styles.panelHead}><h2 id={`${id}-output`}>{outputLabel}</h2>{result && <div className={styles.actions}>
          {base64 !== undefined && <button type="button" className="button" onClick={() => void copy(base64, "Base64")}>Copy Base64</button>}
          {dataUri !== undefined && <button type="button" className="button" onClick={() => void copy(dataUri, "Data URI")}>Copy Data URI</button>}
          {result.text !== undefined && base64 === undefined && dataUri === undefined && <button type="button" className="button" aria-label={`Copy ${textLabel}`} onClick={() => void copy(result.text!, textLabel)}>Copy</button>}
          {result.blob && result.extension && <button type="button" className="button" onClick={download}>Download {result.extension.toUpperCase()}</button>}
        </div>}</div>
        {result ? <div className={styles.result}>
          {!!result.warnings?.length && <div className={styles.warning} role="alert">{result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
           {resultUrl && <figure className={styles.preview}><img src={resultUrl} alt={`${definition.name} result preview`} /><figcaption>Processed local image</figcaption></figure>}
          {result.text !== undefined && !Object.values(result.data).includes(result.text) && <pre className={styles.output} tabIndex={0} aria-label={`${textLabel} value`}>{result.text}</pre>}
          <dl className={styles.dataList} aria-label={`${outputLabel} values`}>{Object.entries(result.data).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "string" && (key === "base64" || key === "dataUri" || value === result.text) ? <pre className={styles.output} tabIndex={0} aria-label={`${key} value`}>{value}</pre> : <ResultValue value={value} label={key} />}</dd></div>)}</dl>
        </div> : <p className={styles.empty}>Your result will appear after you {contract.action.toLowerCase()}. Editing an input clears the previous result.</p>}
      </section>
    </div>
    {error && <p ref={errorRef} id={`${id}-error`} className={styles.error} role="alert" tabIndex={-1}>{error.message}</p>}
    <p id={`${id}-status`} className={styles.status} role="status" aria-atomic="true">{notice}</p>
    {definition.pairedTool && <a className={styles.pairLink} href={`/tools/${definition.pairedTool}`}>Open {getImageDefinition(definition.pairedTool)?.name ?? "paired tool"}</a>}
    <p className={styles.privacy}>All processing stays in this browser. Inputs are not transmitted or saved.</p>
  </div>;
}

export default function ImageStation({ toolId }: { toolId: ImageToolId }) {
  const definition = getImageDefinition(toolId);
  return definition ? <Station key={definition.id} definition={definition} /> : null;
}
