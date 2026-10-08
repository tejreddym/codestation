"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./ImageStation.module.css";

export type Crop = { x: number; y: number; width: number; height: number };
type Props = { id: string; src: string; width: number; height: number; value: Crop; onChange: (crop: Crop) => void; describedBy?: string };

export default function ImageCropper({ id, src, width, height, value, onChange, describedBy }: Props) {
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; crop: Crop; resize: boolean } | null>(null);

  function bound(next: Crop) {
    const x = Math.max(0, Math.min(width - 1, Math.round(next.x)));
    const y = Math.max(0, Math.min(height - 1, Math.round(next.y)));
    onChange({ x, y, width: Math.max(1, Math.min(width - x, Math.round(next.width))), height: Math.max(1, Math.min(height - y, Math.round(next.height))) });
  }

  function adjust(dx: number, dy: number, resize = false) {
    if (resize) bound({ ...value, width: value.width + dx, height: value.height + dy });
    else bound({ ...value, x: Math.max(0, Math.min(width - value.width, value.x + dx)), y: Math.max(0, Math.min(height - value.height, value.y + dy)) });
  }

  function keyboard(event: KeyboardEvent<HTMLElement>, resize = false) {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault();
    adjust(delta[0], delta[1], resize || event.shiftKey);
  }

  function start(event: PointerEvent<HTMLElement>, resize: boolean) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, crop: value, resize };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function move(event: PointerEvent<HTMLElement>) {
    const active = drag.current; const rect = board.current?.getBoundingClientRect();
    if (!active || active.pointer !== event.pointerId || !rect?.width || !rect.height) return;
    const dx = Math.round((event.clientX - active.x) * width / rect.width);
    const dy = Math.round((event.clientY - active.y) * height / rect.height);
    bound(active.resize ? { ...active.crop, width: active.crop.width + dx, height: active.crop.height + dy } : { ...active.crop, x: Math.max(0, Math.min(width - active.crop.width, active.crop.x + dx)), y: Math.max(0, Math.min(height - active.crop.height, active.crop.y + dy)) });
  }

  return <fieldset className={styles.cropper} aria-describedby={describedBy} aria-invalid={describedBy ? true : undefined}>
    <legend>Crop selection</legend>
    <p id={`${id}-help`} className={styles.hint}>Drag the selection to move it; drag its corner to resize. Arrow keys move one pixel; Shift + arrows resize.</p>
    <div ref={board} className={styles.cropBoard}>
      <img src={src} alt="Local image crop preview" draggable={false} width={width} height={height} />
      <div className={styles.cropSelection} role="group" tabIndex={0} aria-label="Move crop selection" aria-describedby={`${id}-help ${id}-dimensions`} style={{ left: `${value.x / width * 100}%`, top: `${value.y / height * 100}%`, width: `${value.width / width * 100}%`, height: `${value.height / height * 100}%` }} onKeyDown={event => keyboard(event)} onPointerDown={event => start(event, false)} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <button type="button" className={styles.cropHandle} aria-label="Resize crop selection" aria-describedby={`${id}-help ${id}-dimensions`} onKeyDown={event => { event.stopPropagation(); keyboard(event, true); }} onPointerDown={event => start(event, true)} onPointerMove={event => { event.stopPropagation(); move(event); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
      </div>
    </div>
    <p id={`${id}-dimensions`} className={styles.hint} aria-live="polite">Selection: {value.width} × {value.height} pixels at {value.x}, {value.y}.</p>
    <div className={styles.actions}>
      <button type="button" className="button" onClick={() => bound({ x: 0, y: 0, width, height })}>Select whole image</button>
      <button type="button" className="button" onClick={() => bound({ x: Math.floor(width / 4), y: Math.floor(height / 4), width: Math.max(1, Math.floor(width / 2)), height: Math.max(1, Math.floor(height / 2)) })}>Select center</button>
    </div>
  </fieldset>;
}
