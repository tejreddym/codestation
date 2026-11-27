"use client";

import { useEffect, useRef } from "react";
import { Keyboard, X } from "lucide-react";
import { trapModalTabFocus } from "@/lib/a11y/focusTrap";
import styles from "./CommandPalette.module.css";

export const OPEN_SHORTCUTS_EVENT = "codestation-open-shortcuts";

interface ShortcutItem {
  keys: readonly string[];
  description: string;
}

const SHORTCUT_GROUPS: readonly { title: string; items: readonly ShortcutItem[] }[] = [
  {
    title: "Global navigation",
    items: [
      { keys: ["⌘ / Ctrl", "K"], description: "Open or close the command palette" },
      { keys: ["?"], description: "Open this keyboard shortcuts cheat sheet" },
      { keys: ["Esc"], description: "Close open dialogs and restore focus" },
    ],
  },
  {
    title: "Command palette",
    items: [
      { keys: ["↑", "↓"], description: "Move between matching tools and quick actions" },
      { keys: ["Home", "End"], description: "Jump to the first or last result" },
      { keys: ["Enter"], description: "Open the selected tool or run quick action" },
    ],
  },
  {
    title: "Tool workspaces",
    items: [
      { keys: ["⌘ / Ctrl", "Enter"], description: "Run tool execution in supporting workspaces" },
      { keys: ["Copy Link"], description: "Create a local #state= permalink (up to 8 KB)" },
    ],
  },
];

export default function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtnRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      trapModalTabFocus(event, dialogRef.current);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const opener = previousFocusRef.current;
      if (opener && opener.isConnected) {
        opener.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
      >
        <div className={styles.dialogHeader}>
          <h2 id="keyboard-shortcuts-title" className={styles.shortcutsHeading}>
            <Keyboard size={14} strokeWidth={2} aria-hidden="true" />
            Keyboard shortcuts
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeButton}
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div
          className={styles.shortcutsBody}
          tabIndex={0}
          role="region"
          aria-label="Keyboard shortcut list"
        >
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className={styles.shortcutGroup}>
              <h3 className={styles.groupLabel}>{group.title}</h3>
              <ul className={styles.shortcutList}>
                {group.items.map((item) => (
                  <li key={item.description} className={styles.shortcutRow}>
                    <span className={styles.shortcutDesc}>{item.description}</span>
                    <span className={styles.shortcutKeys}>
                      {item.keys.map((keyLabel) => (
                        <kbd key={keyLabel} className={styles.kbd}>
                          {keyLabel}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className={styles.footer}>
          <span>Press <kbd className={styles.kbd}>Esc</kbd> to close</span>
          <span className={styles.footerNote}>100% client-side shortcuts</span>
        </div>
      </div>
    </div>
  );
}
