"use client";

import React from "react";
import { ShieldCheck, CloudOff, Globe2 } from "lucide-react";
import type { ToolProcessingType } from "@/lib/engine/types";
import styles from "./UniversalToolShell.module.css";

export interface ToolPrivacyBadgeProps {
  processing: ToolProcessingType;
  offlineSupported: boolean;
}

export function ToolPrivacyBadge({ processing, offlineSupported }: ToolPrivacyBadgeProps) {
  const isNetwork = processing === "network-opt-in";

  return (
    <div
      className={styles.badgeGroup}
      data-testid="privacy-badge-group"
      aria-label="Tool execution capabilities"
    >
      {isNetwork ? (
        <span
          className={`${styles.badge} ${styles.badgeNetwork}`}
          data-testid="badge-network-opt-in"
          role="status"
        >
          <Globe2 size={13} aria-hidden="true" />
          Network Opt-In
        </span>
      ) : (
        <span
          className={`${styles.badge} ${styles.badgeLocal}`}
          data-testid="badge-local"
          role="status"
        >
          <ShieldCheck size={13} aria-hidden="true" />
          100% Local • Browser-Only
        </span>
      )}

      {!isNetwork && offlineSupported && (
        <span
          className={`${styles.badge} ${styles.badgeOffline}`}
          data-testid="badge-offline"
          role="status"
        >
          <CloudOff size={13} aria-hidden="true" />
          Offline Ready
        </span>
      )}

      {isNetwork && (
        <span
          className={styles.networkNotice}
          data-testid="network-warning-notice"
        >
          Requires Network / Sends Direct Browser Requests
        </span>
      )}
    </div>
  );
}
