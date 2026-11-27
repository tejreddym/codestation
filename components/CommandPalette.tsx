"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import styles from "./CommandPalette.module.css";
import { OPEN_SHORTCUTS_EVENT } from "./KeyboardShortcutsModal";

const CommandPaletteDialog = dynamic(() => import("./CommandPaletteDialog"), {
  loading: () => null,
});

const KeyboardShortcutsModal = dynamic(() => import("./KeyboardShortcutsModal"), {
  loading: () => null,
});

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true'], [role='textbox'], [role='combobox']")) {
    return true;
  }
  return false;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [actionToast, setActionToast] = useState("");
  const openRef = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const showToast = useCallback((message: string) => {
    setActionToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setActionToast("");
      toastTimerRef.current = null;
    }, 2600);
  }, []);

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
        return;
      }
      if (
        event.key === "?" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !openRef.current &&
        !isEditableElement(event.target)
      ) {
        event.preventDefault();
        setShortcutsLoaded(true);
        setShortcutsOpen((prev) => !prev);
      }
    };
    const onOpenShortcuts = () => {
      setShortcutsLoaded(true);
      setShortcutsOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpenShortcuts);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpenShortcuts);
    };
  }, [show, hide]);

  // Restore focus to the previously active element after closing.
  useEffect(() => {
    if (open || !loaded) return;
    const target = previousFocus.current;
    previousFocus.current = null;
    target?.focus?.();
  }, [open, loaded]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-command-palette-shell
      >
        <Search size={17} aria-hidden="true" />
        <span className={styles.triggerLabel}>Search</span>
        <span className={styles.srOnly}> — open command palette</span>
        <kbd className={styles.kbd} aria-hidden="true">
          ⌘K
        </kbd>
      </button>
      {loaded && <CommandPaletteDialog open={open} onClose={hide} onNotify={showToast} />}
      {shortcutsLoaded && (
        <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      )}
      {actionToast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {actionToast}
        </div>
      )}
    </>
  );
}
