
/** Normalize user-entered search text without changing the metadata itself. */
export function normalizeToolSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Search registered metadata without creating a second catalog identity.
 * Exact/name matches sort ahead of keyword and description matches. Duplicate
 * IDs are collapsed so discovery cards always represent real tools once.
 */
export type ToolSearchMetadata = { id: string; name: string; description: string; keywords: readonly string[] };

interface NormalizedToolCache {
  name: string;
  keywords: string[];
  description: string;
  combined: string;
}

const toolCache = new WeakMap<object, NormalizedToolCache>();

function getNormalizedTool<T extends ToolSearchMetadata>(tool: T): NormalizedToolCache {
  let entry = toolCache.get(tool);
  if (!entry) {
    const name = normalizeToolSearch(tool.name);
    const keywords = tool.keywords.map(normalizeToolSearch);
    const description = normalizeToolSearch(tool.description);
    const combined = `${name} ${keywords.join(" ")} ${description}`;
    entry = { name, keywords, description, combined };
    toolCache.set(tool, entry);
  }
  return entry;
}

export function searchTools<T extends ToolSearchMetadata>(tools: readonly T[], query: string): T[] {
  const normalized = normalizeToolSearch(query);
  const best = new Map<string, { tool: T; rank: number; index: number }>();
  const parts = normalized ? normalized.split(" ") : [];

  tools.forEach((tool, index) => {
    const { name, keywords, description, combined } = getNormalizedTool(tool);
    let rank = 4;
    if (!normalized) rank = 0;
    else if (name === normalized) rank = 0;
    else if (name.includes(normalized)) rank = 1;
    else if (keywords.some(keyword => keyword === normalized || keyword.includes(normalized))) rank = 2;
    else if (description.includes(normalized)) rank = 3;
    else if (parts.every(part => combined.includes(part))) rank = 4;
    else return;

    const prior = best.get(String(tool.id));
    if (!prior || rank < prior.rank) best.set(String(tool.id), { tool, rank, index });
  });

  return [...best.values()]
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(item => item.tool);
}
