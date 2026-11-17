import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type HeadingLevel = 2 | 3 | 4;

type PanelHeaderProps = {
  id?: string;
  level?: HeadingLevel;
  title: ReactNode;
  actions?: ReactNode;
};

/** Header row for a tool panel. The heading id is explicit so callers own it. */
export function PanelHeader({ id, level = 2, title, actions }: PanelHeaderProps) {
  const Heading = level === 3 ? "h3" : level === 4 ? "h4" : "h2";
  return (
    <div className={styles.panelHeader}>
      <Heading id={id} className={styles.panelTitle}>{title}</Heading>
      {actions ? <div className={styles.panelActions}>{actions}</div> : null}
    </div>
  );
}

type PanelProps = {
  title?: ReactNode;
  headingId?: string;
  level?: HeadingLevel;
  actions?: ReactNode;
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "title">;

export function Panel({
  title,
  headingId,
  level = 2,
  actions,
  padded = false,
  className,
  bodyClassName,
  children,
  ...rest
}: PanelProps) {
  const labelledBy = headingId ?? rest["aria-labelledby"];
  return (
    <section
      {...rest}
      aria-labelledby={labelledBy}
      className={cx(styles.panel, className)}
    >
      {title !== undefined ? <PanelHeader id={headingId} level={level} title={title} actions={actions} /> : null}
      <PanelBody className={cx(padded && styles.panelBodyPadded, bodyClassName)}>{children}</PanelBody>
    </section>
  );
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx(styles.panelBody, className)}>{children}</div>;
}
