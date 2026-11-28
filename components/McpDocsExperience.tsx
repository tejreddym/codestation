"use client";

import { useMemo, useState } from "react";
import mcpCatalog from "@/config/mcp-docs-catalog.json";
import { CopySnippet } from "@/components/CopySnippet";
import { useCopy } from "@/components/ui/useCopy";
import styles from "./McpDocsExperience.module.css";

export interface CatalogToolOption {
  name: string;
  type: string;
  description: string;
}

export interface CatalogToolEntry {
  slug: string;
  name: string;
  mcpName: string;
  tier: "free" | "pro";
  runtime: "node-pure" | "node-file";
  stationId: string;
  stationName: string;
  category: string;
  description: string;
  options: CatalogToolOption[];
  cliExample: string;
  pipeExample?: string;
}

type IdeTabId = "cursor" | "claude-desktop" | "windsurf" | "claude-code" | "vscode";

interface IdeTabMeta {
  id: IdeTabId;
  label: string;
  configPath: string;
  language: "json" | "bash";
}

const IDE_TABS: readonly IdeTabMeta[] = [
  {
    id: "cursor",
    label: "Cursor",
    configPath: ".cursor/mcp.json or ~/.cursor/mcp.json",
    language: "json",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    configPath:
      "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json · Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
    language: "json",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    configPath: "~/.codeium/windsurf/mcp_config.json",
    language: "json",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    configPath: "Terminal command (claude mcp add) or project .mcp.json",
    language: "bash",
  },
  {
    id: "vscode",
    label: "VS Code",
    configPath: ".vscode/mcp.json (VS Code 1.99+ MCP native support)",
    language: "json",
  },
];

function buildQuickstartSnippet(
  tabId: IdeTabId,
  includeProEnv: boolean,
  stationsFlag: string
): string {
  const trimmedStations = stationsFlag.trim();
  const args = ["-y", "codestation-mcp"];
  if (includeProEnv && trimmedStations) {
    args.push(`--stations=${trimmedStations}`);
  }

  const envBlock = includeProEnv
    ? { CODESTATION_LICENSE_KEY: "CS-PRO-YOUR-KEY" }
    : undefined;

  if (tabId === "claude-code") {
    const baseCmd = includeProEnv
      ? `claude mcp add codestation -e CODESTATION_LICENSE_KEY=CS-PRO-YOUR-KEY -- npx -y codestation-mcp${trimmedStations ? ` --stations=${trimmedStations}` : ""}`
      : "claude mcp add codestation -- npx -y codestation-mcp";

    const mcpJson = JSON.stringify(
      {
        mcpServers: {
          codestation: {
            command: "npx",
            args,
            ...(envBlock ? { env: envBlock } : {}),
          },
        },
      },
      null,
      2
    );
    return `# Option 1: Register via Claude Code CLI\n${baseCmd}\n\n# Option 2: Commit to project .mcp.json\n${mcpJson}`;
  }

  if (tabId === "vscode") {
    return JSON.stringify(
      {
        servers: {
          codestation: {
            type: "stdio",
            command: "npx",
            args,
            ...(envBlock ? { env: envBlock } : {}),
          },
        },
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      mcpServers: {
        codestation: {
          command: "npx",
          args,
          ...(envBlock ? { env: envBlock } : {}),
        },
      },
    },
    null,
    2
  );
}

export function McpQuickstartTabs() {
  const [activeTab, setActiveTab] = useState<IdeTabId>("cursor");
  const [includeProEnv, setIncludeProEnv] = useState(true);
  const [stationsInput, setStationsInput] = useState("json,security,sql,pdf");

  const currentTab = IDE_TABS.find((t) => t.id === activeTab) ?? IDE_TABS[0];
  const snippet = useMemo(
    () => buildQuickstartSnippet(activeTab, includeProEnv, stationsInput),
    [activeTab, includeProEnv, stationsInput]
  );

  return (
    <div className={styles.wrapper} data-testid="mcp-quickstart-tabs">
      <div className={styles.tabBar} role="tablist" aria-label="AI client configuration tabs">
        {IDE_TABS.map((tab) => {
          const isSelected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`quickstart-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`quickstart-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.tabChip} ${isSelected ? styles.tabChipActive : ""}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.modeGroup} role="group" aria-label="License tier snippet mode">
          <button
            type="button"
            onClick={() => setIncludeProEnv(true)}
            aria-pressed={includeProEnv}
            className={`${styles.modePill} ${includeProEnv ? styles.modePillActive : ""}`}
          >
            Pro / Team (CODESTATION_LICENSE_KEY)
          </button>
          <button
            type="button"
            onClick={() => setIncludeProEnv(false)}
            aria-pressed={!includeProEnv}
            className={`${styles.modePill} ${!includeProEnv ? styles.modePillActive : ""}`}
          >
            Free Tier (No Key Required)
          </button>
        </div>

        {includeProEnv && (
          <label className={styles.modeGroup}>
            <span className={styles.resultMeta}>--stations=</span>
            <input
              type="text"
              value={stationsInput}
              onChange={(e) => setStationsInput(e.target.value)}
              placeholder="json,security,sql"
              aria-label="Optional stations expansion list"
              className={styles.stationFlagInput}
            />
          </label>
        )}
      </div>

      <div
        role="tabpanel"
        id={`quickstart-panel-${currentTab.id}`}
        aria-labelledby={`quickstart-tab-${currentTab.id}`}
      >
        <p className={styles.configPathNote}>
          <strong>Config location:</strong> <code>{currentTab.configPath}</code>
        </p>
        <CopySnippet
          title={`${currentTab.label} MCP Configuration`}
          code={snippet}
          language={currentTab.language}
        />
      </div>
    </div>
  );
}

const PAGE_SIZE = 30;

export function McpToolCatalogExplorer() {
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "pro">("all");
  const [runtimeFilter, setRuntimeFilter] = useState<"all" | "node-pure" | "node-file">("all");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const { copy } = useCopy();

  const allTools = mcpCatalog.tools as CatalogToolEntry[];

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTools.filter((tool) => {
      if (stationFilter !== "all" && tool.stationId !== stationFilter) return false;
      if (tierFilter !== "all" && tool.tier !== tierFilter) return false;
      if (runtimeFilter !== "all" && tool.runtime !== runtimeFilter) return false;
      if (!q) return true;
      return (
        tool.slug.toLowerCase().includes(q) ||
        tool.name.toLowerCase().includes(q) ||
        tool.mcpName.toLowerCase().includes(q) ||
        tool.stationName.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.options.some((opt) => opt.name.toLowerCase().includes(q))
      );
    });
  }, [allTools, search, stationFilter, tierFilter, runtimeFilter]);

  const displayedTools = useMemo(
    () => filteredTools.slice(0, visibleLimit),
    [filteredTools, visibleLimit]
  );

  async function handleCopyCli(slug: string, cmd: string) {
    if (!(await copy(cmd))) return;
    setCopiedSlug(slug);
    setTimeout(() => {
      setCopiedSlug((prev) => (prev === slug ? null : prev));
    }, 2000);
  }

  return (
    <div className={styles.wrapper} data-testid="mcp-catalog-explorer">
      {/* Live auto-generated registry metrics */}
      <div className={styles.summaryGrid}>
        <div className={styles.statTile}>
          <span className={styles.statValue}>{mcpCatalog.counts.executableTotal}</span>
          <span className={styles.statLabel}>Node &amp; CLI Tools</span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statValue}>{mcpCatalog.counts.nodePure}</span>
          <span className={styles.statLabel}>Pure Node (In-Memory)</span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statValue}>{mcpCatalog.counts.nodeFileWired}</span>
          <span className={styles.statLabel}>Local File Handlers</span>
        </div>
        <div className={styles.statTile}>
          <span className={styles.statValue}>
            {mcpCatalog.counts.freeExecutable} / {mcpCatalog.counts.proExecutable}
          </span>
          <span className={styles.statLabel}>Free Core / Pro Tools</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={styles.filterBox}>
        <div className={styles.filterTop}>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleLimit(PAGE_SIZE);
            }}
            placeholder={`Filter all ${mcpCatalog.counts.executableTotal} MCP & CLI tools by slug, option, or keyword...`}
            aria-label="Search MCP and CLI tool catalog"
            className={styles.searchField}
          />
          <select
            value={stationFilter}
            onChange={(e) => {
              setStationFilter(e.target.value);
              setVisibleLimit(PAGE_SIZE);
            }}
            aria-label="Filter catalog by station"
            className={styles.stationSelect}
          >
            <option value="all">
              All Stations ({mcpCatalog.counts.executableTotal})
            </option>
            {mcpCatalog.stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.total})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterBottom}>
          <div className={styles.modeGroup}>
            <div className={styles.modeGroup} role="group" aria-label="Filter by license tier">
              {(["all", "free", "pro"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    setTierFilter(tier);
                    setVisibleLimit(PAGE_SIZE);
                  }}
                  aria-pressed={tierFilter === tier}
                  className={`${styles.modePill} ${tierFilter === tier ? styles.modePillActive : ""}`}
                >
                  {tier === "all"
                    ? "All Tiers"
                    : tier === "free"
                      ? `Free (${mcpCatalog.counts.freeExecutable})`
                      : `Pro (${mcpCatalog.counts.proExecutable})`}
                </button>
              ))}
            </div>

            <div className={styles.modeGroup} role="group" aria-label="Filter by runtime">
              {(["all", "node-pure", "node-file"] as const).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => {
                    setRuntimeFilter(rt);
                    setVisibleLimit(PAGE_SIZE);
                  }}
                  aria-pressed={runtimeFilter === rt}
                  className={`${styles.modePill} ${runtimeFilter === rt ? styles.modePillActive : ""}`}
                >
                  {rt === "all"
                    ? "All Runtimes"
                    : rt === "node-pure"
                      ? `Pure Node (${mcpCatalog.counts.nodePure})`
                      : `Local File (${mcpCatalog.counts.nodeFileWired})`}
                </button>
              ))}
            </div>
          </div>

          <span className={styles.resultMeta} data-testid="catalog-match-count">
            Showing {displayedTools.length} of {filteredTools.length} matching tools
          </span>
        </div>
      </div>

      {/* Filtered Tool Cards */}
      <div className={styles.catalogList}>
        {displayedTools.map((tool) => (
          <article key={tool.slug} className={styles.toolCard}>
            <div className={styles.toolHeader}>
              <div className={styles.toolTitleGroup}>
                <h3 className={styles.toolTitle}>{tool.name}</h3>
                <code className={styles.toolSlug}>{tool.slug}</code>
              </div>
              <div className={styles.badgeRow}>
                <span className={tool.tier === "free" ? styles.tierFree : styles.tierPro}>
                  {tool.tier === "free" ? "Free" : "Pro"}
                </span>
                <span className={styles.runtimeBadge}>
                  {tool.runtime === "node-pure" ? "Pure Node" : "Local File"}
                </span>
                <span className={styles.stationBadge}>{tool.stationName}</span>
              </div>
            </div>

            <p className={styles.toolDescription}>{tool.description}</p>

            <div className={styles.toolMetaLine}>
              <span>MCP: {tool.mcpName}</span>
              {tool.options.length > 0 && (
                <span>
                  Options: {tool.options.map((o) => `${o.name} (${o.type})`).join(", ")}
                </span>
              )}
            </div>

            <div className={styles.cliCommandBar}>
              <code className={styles.cliCommandCode}>{tool.cliExample}</code>
              <button
                type="button"
                onClick={() => handleCopyCli(tool.slug, tool.cliExample)}
                aria-label={`Copy CLI command for ${tool.slug}`}
                className={styles.copyAction}
              >
                {copiedSlug === tool.slug ? "✓ Copied" : "Copy CLI"}
              </button>
            </div>
          </article>
        ))}

        {filteredTools.length === 0 && (
          <div className={styles.toolCard}>
            <p className={styles.toolDescription}>
              No MCP or CLI tools match the current filters. Reset search or station filters to view all {mcpCatalog.counts.executableTotal} executable tools.
            </p>
          </div>
        )}
      </div>

      {displayedTools.length < filteredTools.length && (
        <div className={styles.paginationRow}>
          <span className={styles.resultMeta}>
            {filteredTools.length - displayedTools.length} additional matching tools available
          </span>
          <div className={styles.modeGroup}>
            <button
              type="button"
              onClick={() => setVisibleLimit((n) => n + PAGE_SIZE)}
              className={styles.loadMoreAction}
            >
              Show {Math.min(PAGE_SIZE, filteredTools.length - displayedTools.length)} more
            </button>
            <button
              type="button"
              onClick={() => setVisibleLimit(filteredTools.length)}
              className={styles.loadMoreAction}
            >
              Show all ({filteredTools.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
