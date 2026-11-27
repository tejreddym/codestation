/**
 * Client-only bridge allowing global UI surfaces (like the Command Palette) to
 * invoke actions on the currently mounted tool without introducing shared state coupling.
 */
import type { BuildPermalinkResult } from "./permalink";

export interface ActiveToolBridgeHandlers {
  getOutputText?: () => string | null;
  getShareUrl?: () => Promise<BuildPermalinkResult>;
}

let activeHandlers: ActiveToolBridgeHandlers | null = null;

export function registerActiveToolBridge(handlers: ActiveToolBridgeHandlers): () => void {
  activeHandlers = handlers;
  return () => {
    if (activeHandlers === handlers) {
      activeHandlers = null;
    }
  };
}

export function getActiveToolOutputText(): string | null {
  const fromHandler = activeHandlers?.getOutputText?.();
  if (typeof fromHandler === "string" && fromHandler.length > 0) {
    return fromHandler;
  }
  if (typeof document === "undefined") return null;

  const toolRoot =
    document.querySelector<HTMLElement>("[data-webmcp-tool], [data-testid='universal-tool-shell']") ??
    document.querySelector<HTMLElement>("main");
  if (!toolRoot) return null;

  const preview =
    toolRoot.querySelector<HTMLElement>("[data-testid='preview-text']") ??
    toolRoot.querySelector<HTMLElement>("pre[aria-label]") ??
    toolRoot.querySelector<HTMLTextAreaElement>("textarea[readonly]");
  if (!preview) return null;

  const text =
    preview instanceof HTMLTextAreaElement ? preview.value : (preview.textContent ?? "");
  return text.length > 0 ? text : null;
}

export async function buildActiveToolShareUrl(): Promise<BuildPermalinkResult | null> {
  if (!activeHandlers?.getShareUrl) return null;
  return await activeHandlers.getShareUrl();
}
