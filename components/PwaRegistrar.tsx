"use client";

import { useEffect } from "react";

/**
 * Registers the Code Station service worker in production/secure browser contexts
 * without blocking page interactivity or rendering UI noise.
 */
export default function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    navigator.serviceWorker.register("/code-station-sw.js", { scope: "/" }).catch(() => {
      // Registration failures must stay silent so offline-incapable contexts still run tools cleanly.
    });
  }, []);

  return null;
}
