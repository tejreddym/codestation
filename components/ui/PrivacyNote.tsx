import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

export function PrivacyNote({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cx(styles.privacy, className)}>{children}</p>;
}
