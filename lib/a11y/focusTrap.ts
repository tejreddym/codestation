import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Returns keyboard-focusable descendants inside a modal dialog in DOM order.
 * Avoids layout-only checks so focus trapping behaves consistently in jsdom tests.
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.tabIndex >= 0 &&
      !el.closest("[aria-hidden='true']") &&
      !el.closest("[inert]")
  );
}

/**
 * Traps Tab and Shift+Tab focus within `container` for accessible modal dialogs.
 */
export function trapModalTabFocus(
  event: Pick<ReactKeyboardEvent<HTMLElement>, "key" | "shiftKey" | "preventDefault"> | KeyboardEvent,
  container: HTMLElement | null
): void {
  if (event.key !== "Tab" || !container) return;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = typeof document !== "undefined" ? document.activeElement : null;

  if (!active || !(active instanceof HTMLElement) || !container.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
