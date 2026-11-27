"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { RegisteredToolId } from "@/config/tools";
import ToolWorkspace from "./ToolWorkspace";
import styles from "./Embed.module.css";

export interface EmbedToolViewProps {
  slug: string;
  toolId: RegisteredToolId;
  name: string;
  category: string;
}

export default function EmbedToolView({
  slug,
  toolId,
  name,
  category,
}: EmbedToolViewProps) {
  const searchParams = useSearchParams();
  const themeParam = searchParams.get("theme");

  useEffect(() => {
    if (themeParam === "light" || themeParam === "dark") {
      document.documentElement.dataset.theme = themeParam;
    }
  }, [themeParam]);

  return (
    <main
      className={styles.embedShell}
      data-embed-mode="true"
      data-webmcp-tool={toolId}
      data-webmcp-category={category}
      data-webmcp-slug={slug}
    >
      <header className={styles.embedTop}>
        <h1 className={styles.embedHeading}>{name}</h1>
        <span className={styles.embedCategory}>{category}</span>
      </header>

      <div className={styles.embedMain}>
        <ToolWorkspace toolId={toolId} />
      </div>

      <footer className={styles.embedFooter} data-testid="embed-footer">
        <span>{name}</span>
        <a
          className={styles.embedFooterLink}
          href={`https://codestation.in/tools/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Code Station ↗
        </a>
      </footer>
    </main>
  );
}
