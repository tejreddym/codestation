import type { ReactNode } from "react";
import { Button, ButtonLink } from "./ui/Button";
import { CodeArea } from "./ui/controls";
import { Callout } from "./ui/Callout";
import { OutputPanel } from "./ui/OutputPanel";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import styles from "./ui/ui.module.css";

type ToolWorkbenchShellProps = {
  pair?: { slug: string; name: string };
  direction?: ReactNode;
  options?: ReactNode;
  input: string;
  onInputChange: (value: string) => void;
  onLoadExample: () => void;
  output: string;
  outputEmpty: string;
  onCopy: () => void;
  onDownload: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  busy: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClear: () => void;
  metadata?: string;
  error?: string;
  notice?: string;
  privacy: string;
};

/** Canonical form layout shared by every legacy ToolWorkbench tool. */
export function ToolWorkbenchShell({
  pair,
  direction,
  options,
  input,
  onInputChange,
  onLoadExample,
  output,
  outputEmpty,
  onCopy,
  onDownload,
  primaryLabel,
  onPrimary,
  busy,
  secondaryLabel,
  onSecondary,
  onClear,
  metadata,
  error,
  notice,
  privacy,
}: ToolWorkbenchShellProps) {
  return (
    <div>
      {pair ? (
        <div className={styles.pair}>
          <span className={styles.pairLabel}>{direction}</span>
          <ButtonLink size="sm" href={`/tools/${pair.slug}`}>⇄ Switch to {pair.name}</ButtonLink>
        </div>
      ) : null}
      {options ? <div className={styles.options}>{options}</div> : null}
      <ToolLayout kind="form">
        <Panel
          title="Input"
          actions={<Button size="sm" onClick={onLoadExample}>Example</Button>}
        >
          <CodeArea
            value={input}
            onChange={event => onInputChange(event.target.value)}
            placeholder="Paste input here to begin."
            aria-label="Tool input"
          />
        </Panel>
        <OutputPanel
          label="Output"
          value={output}
          empty={outputEmpty}
          onCopy={onCopy}
          onDownload={onDownload}
        />
      </ToolLayout>
      {metadata ? <p className={styles.metadata} aria-live="polite">{metadata}</p> : null}
      <div className={styles.actions}>
        <Button variant="primary" onClick={onPrimary} disabled={busy}>{busy ? "Processing…" : primaryLabel}</Button>
        {secondaryLabel && onSecondary ? <Button onClick={onSecondary} disabled={busy}>{secondaryLabel}</Button> : null}
        <Button onClick={onClear}>Clear</Button>
      </div>
      {error ? <Callout kind="error">{error}</Callout> : null}
      {notice ? <StatusLine>{notice}</StatusLine> : null}
      <PrivacyNote>{privacy}</PrivacyNote>
    </div>
  );
}

type GeneratorShellProps = {
  title: string;
  outputLabel?: string;
  output: string;
  empty?: string;
  error: string;
  metadata?: string;
  onCopy: () => void;
  onDownload: () => void;
  onClear: () => void;
  children: ReactNode;
};

/** Two-column settings/output layout for the local generator tools. */
export function GeneratorShell({
  title,
  outputLabel = "Generated output",
  output,
  empty = "Configure the options and generate a result.",
  error,
  metadata,
  onCopy,
  onDownload,
  onClear,
  children,
}: GeneratorShellProps) {
  return (
    <div>
      <ToolLayout kind="form" className={styles.narrow}>
        <Panel
          title={title}
          padded
          actions={<Button size="sm" onClick={onClear}>Reset</Button>}
        >
          {children}
        </Panel>
        <OutputPanel
          title={outputLabel}
          label={outputLabel}
          value={output}
          empty={empty}
          onCopy={onCopy}
          onDownload={onDownload}
        />
      </ToolLayout>
      {metadata ? <p className={styles.metadata} aria-live="polite">{metadata}</p> : null}
      {error ? <Callout kind="error">{error}</Callout> : null}
      <PrivacyNote>↳ Generated locally with secure browser randomness. Nothing is sent to Code Station.</PrivacyNote>
    </div>
  );
}
