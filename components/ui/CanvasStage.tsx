import type { CSSProperties, ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

export type CanvasKind = "bitmap" | "svg" | "html";
export type CanvasBackground = "grid" | "plain" | "checker";

type CanvasStageProps = {
  kind?: CanvasKind;
  label: string;
  ratio?: string;
  minHeight?: number;
  background?: CanvasBackground;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  viewportClassName?: string;
  children: ReactNode;
};

/** Shared frame for every visual tool. Geometry stays owned by the caller. */
export function CanvasStage({
  kind = "bitmap",
  label,
  ratio,
  minHeight,
  background = "grid",
  toolbar,
  footer,
  className,
  viewportClassName,
  children,
}: CanvasStageProps) {
  const style: CSSProperties = { minHeight, aspectRatio: ratio };
  return (
    <section className={cx(styles.canvasStage, className)} data-kind={kind} aria-label={label}>
      {toolbar ? <div className={styles.canvasToolbarRow}>{toolbar}</div> : null}
      <div className={cx(styles.canvasViewport, viewportClassName)} data-background={background} style={style}>
        {children}
      </div>
      {footer ? <div className={styles.canvasFooter}>{footer}</div> : null}
    </section>
  );
}
