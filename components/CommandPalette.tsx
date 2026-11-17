"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import styles from "./CommandPalette.module.css";

const CommandPaletteDialog = dynamic(() => import("./CommandPaletteDialog"), {
  loading: () => null,
});

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const openRef = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const show = useCallback(() => {
    if (openRef.current) return;
    previousFocus.current =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    setLoaded(true);
    setOpen(true);
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (openRef.current) hide();
        else show();
        return;
      }
      if (event.key === "Escape" && openRef.current) {
        event.preventDefault();
        hide();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, hide]);

  // Restore focus to the previously active element after closing.
  useEffect(() => {
    if (open || !loaded) return;
    const target = previousFocus.current;
    previousFocus.current = null;
    target?.focus?.();
  }, [open, loaded]);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={show}
        aria-label="Open command palette"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-command-palette-shell
      >
        <Search size={17} aria-hidden="true" />
        <span className={styles.triggerLabel}>Search</span>
        <kbd className={styles.kbd} aria-hidden="true">
          ⌘K
        </kbd>
      </button>
      {loaded && <CommandPaletteDialog open={open} onClose={hide} />}
    </>
  );
}
