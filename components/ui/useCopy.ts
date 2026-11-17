"use client";

import { useCallback, useState } from "react";

type CopyMessages = {
  success?: string;
  failure?: string;
};

/**
 * Clipboard helper with the same visible messages as the existing tools.
 * The hook stores the message so callers can render it in a status line.
 */
export function useCopy(messages: CopyMessages = {}) {
  const [message, setMessage] = useState("");
  const success = messages.success ?? "Copied to clipboard";
  const failure = messages.failure ?? "Copy failed — select and copy manually";

  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setMessage(success);
      return true;
    } catch {
      setMessage(failure);
      return false;
    }
  }, [success, failure]);

  return { copy, message, setMessage };
}
