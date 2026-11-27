"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildToolPermalinkUrl,
  decodePermalinkHash,
  type ToolPermalinkState,
} from "@/lib/engine/permalink";
import { registerActiveToolBridge } from "@/lib/engine/tool-actions-bridge";
import { useCopy } from "./ui/useCopy";

export interface UseToolPermalinkOptions {
  /** Return text + serializable control options for the current tool state. */
  getState: () => { input?: unknown; controls?: Record<string, unknown> };
  /** Return the current output text (if any) for Command Palette "Copy current output". */
  getOutputText?: () => string | null;
  /** Invoked once on mount when a valid `#state=` / `#s=` hash is decoded. */
  onHydrate?: (state: ToolPermalinkState) => void;
}

export function useToolPermalink({
  getState,
  getOutputText,
  onHydrate,
}: UseToolPermalinkOptions) {
  const { copy } = useCopy();
  const [linkNotice, setLinkNotice] = useState("");
  const [linkError, setLinkError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const getStateRef = useRef(getState);
  const getOutputRef = useRef(getOutputText);
  const onHydrateRef = useRef(onHydrate);
  const hydratedRef = useRef(false);

  useEffect(() => {
    getStateRef.current = getState;
    getOutputRef.current = getOutputText;
    onHydrateRef.current = onHydrate;
  });

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash || (!hash.includes("state=") && !hash.includes("s="))) return;

    let cancelled = false;
    void decodePermalinkHash(hash).then((decoded) => {
      if (cancelled || !decoded) return;
      onHydrateRef.current?.(decoded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return registerActiveToolBridge({
      getOutputText: () => getOutputRef.current?.() ?? null,
      getShareUrl: async () => {
        const href = typeof window !== "undefined" ? window.location.href : "/";
        return buildToolPermalinkUrl(href, getStateRef.current());
      },
    });
  }, []);

  const copyLink = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    setLinkNotice("");
    setLinkError("");
    const href = typeof window !== "undefined" ? window.location.href : "/";
    const built = await buildToolPermalinkUrl(href, getStateRef.current());
    if (!built.ok) {
      setLinkError(built.message);
      return { ok: false, message: built.message };
    }
    const ok = await copy(built.url);
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
      setLinkNotice("Share link copied.");
      return { ok: true, message: "Share link copied." };
    }
    const errMsg = "Could not copy share link automatically.";
    setLinkError(errMsg);
    return { ok: false, message: errMsg };
  }, [copy]);

  const clearLinkFeedback = useCallback(() => {
    setLinkNotice("");
    setLinkError("");
    setCopiedLink(false);
  }, []);

  return {
    copyLink,
    copiedLink,
    linkNotice,
    linkError,
    clearLinkFeedback,
  };
}
