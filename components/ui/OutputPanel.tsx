import type { ReactNode } from "react";
import { Button } from "./Button";
import { Panel } from "./Panel";
import styles from "./ui.module.css";
import { cx } from "./cx";

type OutputTextProps = {
  label: string;
  value: string;
  className?: string;
};

/** The shared text output surface. Keeps the accessible pre contract. */
export function OutputText({ label, value, className }: OutputTextProps) {
  return (
    <pre tabIndex={0} aria-label={`${label} value`} className={cx(styles.output, className)}>
      {value}
    </pre>
  );
}

type OutputPanelProps = {
  title?: ReactNode;
  headingId?: string;
  label: string;
  value?: string;
  empty?: ReactNode;
  filename?: string;
  mimeType?: string;
  onCopy?: () => void;
  onDownload?: () => void;
  copyDisabled?: boolean;
  downloadDisabled?: boolean;
  extraActions?: ReactNode;
  busy?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Panel with output + header-only copy/download actions. */
export function OutputPanel({
  title = "Output",
  headingId,
  label,
  value,
  empty = "Your result will appear here.",
  filename,
  mimeType,
  onCopy,
  onDownload,
  copyDisabled,
  downloadDisabled,
  extraActions,
  busy,
  className,
  children,
}: OutputPanelProps) {
  const hasValue = typeof value === "string" && value.length > 0;
  const hasActions = Boolean(extraActions || onCopy || onDownload);
  const downloadTitle = filename
    ? `Download ${filename}${mimeType ? ` (${mimeType})` : ""}`
    : undefined;

  return (
    <Panel
      title={title}
      headingId={headingId}
      aria-busy={busy || undefined}
      className={className}
      actions={hasActions ? (
        <>
          {extraActions}
          {onCopy ? <Button size="sm" onClick={onCopy} disabled={copyDisabled ?? !hasValue}>Copy</Button> : null}
          {onDownload ? <Button size="sm" onClick={onDownload} disabled={downloadDisabled ?? !hasValue} title={downloadTitle}>Download</Button> : null}
        </>
      ) : undefined}
    >
      {children ?? (hasValue ? <OutputText label={label} value={value} /> : <p className={styles.empty}>{empty}</p>)}
    </Panel>
  );
}
