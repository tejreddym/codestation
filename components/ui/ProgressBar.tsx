import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type ProgressBarProps = {
  /** Visible label and accessible name, e.g. "Rendering pages". */
  label: string;
  /** Completed units, usually pages. */
  value: number;
  /** Total units. Defaults to 100. */
  max?: number;
  detail?: ReactNode;
  className?: string;
};

/**
 * Determinate progress with a visible label and native progressbar semantics.
 * All visual rules live in new ProgressBar classes in ui.module.css.
 */
export function ProgressBar({ label, value, max = 100, detail, className }: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? Math.floor(max) : 1;
  const safeValue = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, Math.floor(value))) : 0;
  const percent = (safeValue / safeMax) * 100;

  return (
    <div className={cx(styles.progress, className)}>
      <div className={styles.progressMeta}>
        <span className={styles.progressLabel}>{label}</span>
        <span className={styles.progressValue}>
          {safeValue} / {safeMax}
        </span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-valuetext={`${safeValue} of ${safeMax}`}
      >
        <span className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      {detail ? <div className={styles.progressDetail}>{detail}</div> : null}
    </div>
  );
}
