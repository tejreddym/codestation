import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./ui.module.css";

type CanvasToolbarProps = {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onReset: () => void;
  actions?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
};

/** Fixed toolbar order: zoom out, value, zoom in, reset, then tool actions. */
export function CanvasToolbar({
  zoom,
  onZoomChange,
  onReset,
  actions,
  min = 50,
  max = 200,
  step = 10,
  label = "Canvas zoom",
}: CanvasToolbarProps) {
  const clamp = (value: number) => Math.min(max, Math.max(min, value));
  return (
    <div className={styles.canvasToolbar} role="toolbar" aria-label={label}>
      <Button size="sm" onClick={() => onZoomChange(clamp(zoom - step))} disabled={zoom <= min} aria-label="Zoom out">−</Button>
      <span className={styles.zoomValue} aria-live="polite">{zoom}%</span>
      <Button size="sm" onClick={() => onZoomChange(clamp(zoom + step))} disabled={zoom >= max} aria-label="Zoom in">+</Button>
      <Button size="sm" onClick={onReset}>Reset</Button>
      {actions ? <div className={styles.toolbarSpacer}>{actions}</div> : null}
    </div>
  );
}
