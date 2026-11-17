import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

export type ToolLayoutKind = "form" | "file" | "data" | "canvas";

type ToolLayoutProps = {
  kind?: ToolLayoutKind;
  className?: string;
  children: ReactNode;
};

/** One layout model per tool class. Never renders a heading or description. */
export function ToolLayout({ kind = "form", className, children }: ToolLayoutProps) {
  return (
    <div
      data-kind={kind}
      className={cx(styles.layout, kind === "form" ? styles.form : styles.stack, className)}
    >
      {children}
    </div>
  );
}
