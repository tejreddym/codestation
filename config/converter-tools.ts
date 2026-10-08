import { conversionCapabilities, type ConversionCapability } from "./conversion-capabilities";
import { getTool, type RegisteredToolId, type ToolDefinition } from "./tools";

/** Discovery labels are intentionally separate from tool ownership. A converter card
 * always points at the canonical tool definition and never creates a second identity. */
export type ConverterCategory = {
  id: string;
  name: string;
  description: string;
  family: string;
};

export type ConverterEntry = {
  tool: ToolDefinition;
  category: ConverterCategory;
  capabilities: readonly ConversionCapability[];
};

const categoryInfo: Record<string, Omit<ConverterCategory, "id" | "family">> = {
  "json-data": { name: "Structured Data", description: "Move structured data between compatible local formats." },
  encoding: { name: "Encoding", description: "Encode and decode text and byte representations locally." },
  "image-raster": { name: "Images", description: "Convert supported image formats in your browser." },
  "image-svg": { name: "Images", description: "Convert supported static SVG images locally." },
  spreadsheet: { name: "Spreadsheets", description: "Convert tabular data and workbooks without uploads." },
  markdown: { name: "Markdown & HTML", description: "Move between Markdown and supported document representations." },
  text: { name: "Other Supported Conversions", description: "Convert selected text whitespace and line-ending representations." },
  sql: { name: "Other Supported Conversions", description: "Convert supported SQL literals to portable local data formats." },
  "api-code": { name: "Other Supported Conversions", description: "Translate supported request snippets between cURL and Fetch." },
  color: { name: "Colors", description: "Convert supported sRGB color representations." },
  "numeric-unit": { name: "Units & Temperature", description: "Convert bounded measurement and absolute-temperature values locally." },
  "numeric-temperature": { name: "Units & Temperature", description: "Convert bounded measurement and absolute-temperature values locally." },
  "numeric-base": { name: "Numbers", description: "Convert exact integer representations between bases 2–36." },
};

function categoryFor(family: string): ConverterCategory {
  const info = categoryInfo[family] ?? { name: family, description: `Convert supported ${family} representations locally.` };
  const id = info.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { id, family, ...info };
}

function categoryForCapability(capability: ConversionCapability): ConverterCategory {
  if (capability.discoveryCategory === "units-temperature") return { id: "units-temperature", family: capability.family, name: "Units & Temperature", description: "Convert bounded measurement and absolute-temperature values locally." };
  if (capability.discoveryCategory === "numbers") return { id: "numbers", family: capability.family, name: "Numbers", description: "Convert exact integer representations between bases 2–36." };
  return categoryFor(capability.family);
}

function slugFromRoute(route: string): string | undefined {
  const match = /^\/tools\/([^/?#]+)$/.exec(route);
  return match?.[1];
}

const grouped = new Map<RegisteredToolId, { tool: ToolDefinition; capabilities: ConversionCapability[] }>();
for (const capability of conversionCapabilities) {
  const slug = slugFromRoute(capability.route);
  const tool = slug ? getTool(slug) : undefined;
  if (!tool) continue;
  const current = grouped.get(tool.id);
  if (current) current.capabilities.push(capability);
  else grouped.set(tool.id, { tool, capabilities: [capability] });
}

/** Canonical converter cards, deduplicated by registered tool id. */
export const converterEntries: readonly ConverterEntry[] = [...grouped.values()].map(({ tool, capabilities }) => ({
  tool,
  category: categoryForCapability(capabilities[0]),
  capabilities,
}));

export const converterCategories: readonly ConverterCategory[] = [...new Map(
  converterEntries.map(entry => [entry.category.id, entry.category]),
).values()];

export const converterToolIds: readonly RegisteredToolId[] = converterEntries.map(entry => entry.tool.id);

export function getConverterEntry(id: string): ConverterEntry | undefined {
  return converterEntries.find(entry => entry.tool.id === id || entry.tool.slug === id);
}

export function getConverterCategory(id: string): ConverterCategory | undefined {
  return converterCategories.find(category => category.id === id || category.name === id);
}
