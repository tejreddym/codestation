"use client";

import { useCallback } from "react";

/** Triggers a local download through an object URL. Same path as before. */
export function downloadBlob(content: string | Blob, filename: string, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function useDownload() {
  return useCallback(downloadBlob, []);
}
