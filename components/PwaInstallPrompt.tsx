"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import styles from "./PwaInstallPrompt.module.css";

const DISMISSED_KEY = "code-station-install-dismissed-v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === "1") {
        setDismissed(true);
        return;
      }
      if (window.matchMedia?.("(display-mode: standalone)")?.matches) {
        setDismissed(true);
        return;
      }
    } catch {
      // Storage blocked; prompt can still work in memory.
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (dismissed || !deferredPrompt) {
    return null;
  }

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "dismissed") {
        try {
          window.localStorage.setItem(DISMISSED_KEY, "1");
        } catch {
          // Ignore storage unavailability.
        }
        setDismissed(true);
      }
    } catch {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ignore storage unavailability.
    }
    setDismissed(true);
  };

  return (
    <div className={styles.installWrap} data-testid="pwa-install-banner">
      <button
        type="button"
        className={styles.installBtn}
        onClick={() => void handleInstall()}
        aria-label="Install App"
      >
        <Download size={14} strokeWidth={2} aria-hidden="true" />
        <span className={styles.installLabel}>Install App</span>
      </button>
      <button
        type="button"
        className={styles.dismissBtn}
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
      >
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
