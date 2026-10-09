"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./ProGate.module.css";
import { isProTool } from "@/config/pro-tools";

function getSafeStorageItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
      return window.localStorage.getItem(key);
    }
  } catch {}
  return null;
}

function setSafeStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

function removeSafeStorageItem(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.removeItem === "function") {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

export function ProGate({
  toolId,
  toolName,
  children,
}: {
  toolId: string;
  toolName: string;
  children: React.ReactNode;
}) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isProTool(toolId)) {
      setIsUnlocked(true);
      return;
    }
    const saved = getSafeStorageItem("codestation_license_key");
    if (saved) {
      setIsUnlocked(true);
    }
  }, [toolId]);

  if (!isProTool(toolId)) {
    return <>{children}</>;
  }

  if (!mounted) {
    return <div style={{ minHeight: "340px" }} />;
  }

  if (isUnlocked) {
    return (
      <div>
        <div className={styles.unlockedBadge}>
          <span>✓ Unlocked with Code Station Pro</span>
          <button
            type="button"
            className={styles.relockBtn}
            onClick={() => {
              removeSafeStorageItem("codestation_license_key");
              setIsUnlocked(false);
            }}
          >
            Lock
          </button>
        </div>
        {children}
      </div>
    );
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let deviceId = getSafeStorageItem("codestation_device_id");
      if (!deviceId) {
        deviceId = "web_" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
        setSafeStorageItem("codestation_device_id", deviceId);
      }

      const res = await fetch("/api/v1/license/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: keyInput.trim(),
          deviceId,
          deviceName: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 48) : "web-browser",
        }),
      });

      const data = (await res.json()) as Record<string, any>;
      if (res.ok && data.valid) {
        setSafeStorageItem("codestation_license_key", keyInput.trim());
        setIsUnlocked(true);
      } else {
        setError(data.message || "Invalid or expired license key.");
      }
    } catch {
      setError("Network error while verifying license key.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.gateContainer}>
      <div className={styles.lockHeader}>
        <span className={styles.lockIcon} aria-hidden="true">🔒</span>
        <span className={styles.proTag}>CODE STATION PRO TOOL</span>
        <h2>{toolName} is a Pro Feature</h2>
        <p className={styles.lockDesc}>
          This power tool requires Code Station Pro. Upgrade for ₹199/month (or ₹999 lifetime)
          to unlock all power tools and the local MCP server for Cursor and Claude Desktop.
        </p>
      </div>

      <div className={styles.actionsGrid}>
        <div className={styles.buyCard}>
          <h3>Don&apos;t have a license?</h3>
          <p>Instant, login-free activation via Razorpay (UPI, Cards, NetBanking).</p>
          <Link href="/pro" className={styles.buyBtn}>
            Get Code Station Pro (₹199) →
          </Link>
        </div>

        <div className={styles.unlockCard}>
          <h3>Already have a Pro key?</h3>
          <p>Paste your <code>CS-PRO-XXXX...</code> key below to unlock immediately.</p>
          <form onSubmit={handleUnlock} className={styles.unlockForm}>
            <input
              type="text"
              placeholder="CS-PRO-XXXX-XXXX-XXXX"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className={styles.keyInput}
              required
            />
            <button type="submit" className={styles.unlockSubmitBtn} disabled={loading}>
              {loading ? "Verifying..." : "Unlock Tool"}
            </button>
          </form>
          {error && <div className={styles.errorText}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
