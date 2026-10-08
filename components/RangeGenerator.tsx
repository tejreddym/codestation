"use client";

import { useState } from "react";

const MAX_INTEGER_SPAN = 1_000_000_000;

function randomInteger(min: number, max: number) {
  const span = max - min + 1;
  const limit = Math.floor(0x1_0000_0000 / span) * span;
  const bytes = new Uint32Array(1);
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random generation is unavailable in this browser.");
  do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return min + (bytes[0] % span);
}

export default function RangeGenerator() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [integer, setInteger] = useState(true);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const generate = () => {
    setError("");
    try {
      const min = start.trim() === "" ? 0 : Number(start);
      const max = Number(end);
      if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error("Enter finite numeric bounds; an end value is required.");
      if (max < min) throw new Error("End must be greater than or equal to start.");
      if (integer) {
        if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("Integer mode requires whole-number bounds.");
        if (max - min + 1 > MAX_INTEGER_SPAN) throw new Error("Integer range is limited to one billion possible values.");
        setOutput(String(randomInteger(min, max)));
      } else {
        setOutput(String(min + (globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000) * (max - min)));
      }
    } catch (cause) { setOutput(""); setError(cause instanceof Error ? cause.message : "Could not generate a number."); }
  };
  const clear = () => { setStart(""); setEnd(""); setInteger(true); setOutput(""); setError(""); };
  return <div className="generator-layout"><div className="panel generator-options"><div className="panel-head"><span>Range settings</span><button className="button" onClick={clear}>Reset</button></div>
    <div className="option-grid"><label>Start (optional)<input type="number" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0" /></label><label>End (required)<input type="number" value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
    <label><input type="checkbox" checked={integer} onChange={(e) => setInteger(e.target.checked)} /> Integer mode (inclusive)</label>
    <p className="muted">Integer mode includes both bounds and uses unbiased rejection sampling. Decimal mode returns a value from start (inclusive) to end (exclusive).</p>
    <button className="button primary" onClick={generate}>Generate number</button></div>
    <div className="panel"><div className="panel-head"><span>Generated output</span><button className="button" onClick={() => navigator.clipboard?.writeText(output)} disabled={!output}>Copy</button></div><div className="output" aria-live="polite">{output || "Configure the range and generate a result."}</div></div>{error && <div className="error" role="alert">{error}</div>}<p className="privacy">↳ Runs locally in your browser. Nothing is sent to Code Station.</p></div>;
}
