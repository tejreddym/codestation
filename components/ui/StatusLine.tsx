import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type StatusLineProps = {
  id?: string;
  className?: string;
  children: ReactNode;
};

export function StatusLine({ id, className, children }: StatusLineProps) {
  return (
    <p id={id} role="status" aria-live="polite" aria-atomic="true" className={cx(styles.status, className)}>
      {children}
    </p>
  );
}
