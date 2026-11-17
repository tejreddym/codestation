import { useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type TabItem = {
  id: string;
  label: ReactNode;
  panel: ReactNode;
};

type TabsProps = {
  idBase: string;
  items: TabItem[];
  ariaLabel: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
};

/** ARIA tabs where every panel stays mounted; only visibility changes. */
export function Tabs({ idBase, items, ariaLabel, value, defaultValue, onChange, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id ?? "");
  const active = value ?? internal;

  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    const next = items[nextIndex]?.id;
    if (!next) return;
    select(next);
    document.getElementById(`${idBase}-tab-${next}`)?.focus();
  };

  return (
    <div className={className}>
      <div className={styles.tabList} role="tablist" aria-label={ariaLabel}>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.id}`}
            aria-selected={active === item.id}
            aria-controls={`${idBase}-panel-${item.id}`}
            tabIndex={active === item.id ? 0 : -1}
            className={cx(styles.tab)}
            onClick={() => select(item.id)}
            onKeyDown={event => onKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map(item => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${idBase}-panel-${item.id}`}
          aria-labelledby={`${idBase}-tab-${item.id}`}
          hidden={active !== item.id}
          className={styles.tabPanel}
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
