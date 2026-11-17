import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  hintId?: string;
  errorId?: string;
  className?: string;
  labelClassName?: string;
  children: ReactNode;
};

/** Sibling label + control structure. The control keeps its own id and name. */
export function Field({
  id,
  label,
  hint,
  error,
  hintId = `${id}-hint`,
  errorId = `${id}-error`,
  className,
  labelClassName,
  children,
}: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      <label className={cx(styles.fieldLabel, labelClassName)} htmlFor={id}>{label}</label>
      {children}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
      {error ? <p className={styles.fieldError} id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

export function Hint({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return <p className={cx(styles.hint, className)} id={id}>{children}</p>;
}
