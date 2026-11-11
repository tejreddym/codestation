"use client";

import React from "react";
import type { ToolDefinition } from "@/lib/engine/types";
import { ToolPrivacyBadge } from "./ToolPrivacyBadge";
import styles from "./UniversalToolShell.module.css";

export interface ToolHeaderProps {
  definition: ToolDefinition;
}

export function ToolHeader({ definition }: ToolHeaderProps) {
  return (
    <header
      className={styles.header}
      data-testid="tool-header"
      data-webmcp-tool={definition.id}
      data-webmcp-category={definition.category}
      data-webmcp-slug={definition.slug || definition.id}
    >
      <div className={styles.eyebrow}>
        <span>[{definition.category}]</span>
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.toolTitle} data-testid="tool-title">
          {definition.name}
        </h1>
        <ToolPrivacyBadge
          processing={definition.processing}
          offlineSupported={definition.offlineSupported}
        />
      </div>

      <p className={styles.toolDescription} data-testid="tool-description">
        {definition.description}
      </p>

      {/* Semantic AEO Structured Sections for Answer Engines */}
      <section className="sr-only">
        <h2>What does this tool do?</h2>
        <p>{definition.description}</p>
        <h2>How to use it?</h2>
        <p>
          1. Provide input or drag and drop a file. 2. Adjust parameter controls if available. 3. Review instant client-side output.
        </p>
      </section>
    </header>
  );
}
