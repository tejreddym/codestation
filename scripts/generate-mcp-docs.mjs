#!/usr/bin/env node
/**
 * Deterministic MCP & CLI Documentation Generator
 *
 * Reads the live TypeScript registries (`mcp/registry-bridge.ts`, `mcp/server.ts`,
 * `mcp/config.ts`) via esbuild and generates:
 *   1. `config/mcp-docs-catalog.json` (consumed by `codestation.in/docs`)
 *   2. The auto-generated catalog section inside `packages/codestation-mcp/README.md`
 *      between `<!-- BEGIN_MCP_CATALOG -->` and `<!-- END_MCP_CATALOG -->`.
 *
 * Usage:
 *   node scripts/generate-mcp-docs.mjs          # write catalog + update README
 *   node scripts/generate-mcp-docs.mjs --check  # fail if files are out of sync
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

export const README_BEGIN_MARKER = "<!-- BEGIN_MCP_CATALOG -->";
export const README_END_MARKER = "<!-- END_MCP_CATALOG -->";

/**
 * Loads live exports from `mcp/registry-bridge.ts`, `mcp/server.ts`, and `mcp/config.ts`
 * directly inside Node without creating temporary files on disk.
 */
export function loadLiveMcpRegistry(rootDir = process.cwd()) {
  const pkgRequire = createRequire(path.join(rootDir, "package.json"));
  const virtualSource = `
    export { getAllBridgeTools, getRuntimeCompatibilityManifest } from "./mcp/registry-bridge";
    export { UNIVERSAL_META_TOOLS, TOP_25_MCP_TOOLS } from "./mcp/server";
    export { FREE_TIER_SLUGS, PRICING } from "./mcp/config";
  `;

  const result = esbuild.buildSync({
    stdin: {
      contents: virtualSource,
      resolveDir: rootDir,
      loader: "ts",
    },
    absWorkingDir: rootDir,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    packages: "external",
    write: false,
    logLevel: "silent",
  });

  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  const fn = new Function("exports", "require", "module", "__filename", "__dirname", code);
  fn(mod.exports, pkgRequire, mod, path.join(rootDir, "mcp-docs-virtual.cjs"), rootDir);

  const exportsObj = mod.exports;
  return {
    bridgeTools: exportsObj.getAllBridgeTools(),
    runtimeManifest: exportsObj.getRuntimeCompatibilityManifest(),
    universalMetaTools: exportsObj.UNIVERSAL_META_TOOLS,
    top25McpTools: exportsObj.TOP_25_MCP_TOOLS,
    freeTierSlugs: [...exportsObj.FREE_TIER_SLUGS].sort(),
    pricing: exportsObj.PRICING,
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeMdCell(text) {
  return String(text ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function shellQuote(value) {
  const str = String(value);
  if (/^[a-zA-Z0-9._:/-]+$/.test(str)) return str;
  return `'${str.replace(/'/g, `'\\''`)}'`;
}

function buildCliExample(tool) {
  const arg = tool.examples?.[0]?.arguments ?? { slug: tool.slug };
  const parts = ["codestation", "run", tool.slug];
  if (typeof arg.input === "string" && arg.input.length > 0 && arg.input.length <= 80 && !arg.input.includes("\n")) {
    parts.push("--input", shellQuote(arg.input));
  }
  const opts = arg.options && typeof arg.options === "object" ? { ...arg.options } : {};
  if (typeof opts.inputPath === "string") {
    parts.push("--in", shellQuote(opts.inputPath));
    delete opts.inputPath;
  } else if (Array.isArray(opts.inputPaths) && opts.inputPaths.length > 0) {
    for (const p of opts.inputPaths.slice(0, 2)) {
      parts.push("--in", shellQuote(p));
    }
    delete opts.inputPaths;
  }
  if (typeof opts.outputPath === "string") {
    parts.push("--out", shellQuote(opts.outputPath));
    delete opts.outputPath;
  } else if (typeof opts.outputDir === "string") {
    parts.push("--out", shellQuote(opts.outputDir));
    delete opts.outputDir;
  }
  if (Object.keys(opts).length > 0) {
    const optsJson = JSON.stringify(opts);
    if (optsJson.length <= 110) {
      parts.push("--options", shellQuote(optsJson));
    }
  }
  return parts.join(" ");
}

function buildPipeExample(tool) {
  if (tool.runtimeCompatibility !== "node-pure") return undefined;
  const rawInput = tool.examples?.[0]?.arguments?.input;
  if (typeof rawInput !== "string" || rawInput.length === 0 || rawInput.length > 70 || rawInput.includes("\n")) {
    return undefined;
  }
  return `printf %s ${shellQuote(rawInput)} | codestation run ${tool.slug}`;
}

export function buildMcpDocsCatalog(registry) {
  const { bridgeTools, universalMetaTools, top25McpTools, pricing } = registry;

  let totalNodePure = 0;
  let totalNodeFileAll = 0;
  let totalBrowserOnly = 0;
  for (const t of bridgeTools) {
    if (t.runtimeCompatibility === "node-pure") totalNodePure += 1;
    else if (t.runtimeCompatibility === "node-file") totalNodeFileAll += 1;
    else totalBrowserOnly += 1;
  }

  const executableBridge = bridgeTools
    .filter((t) => t.runtimeCompatibility === "node-pure" || t.nodeFileSupported)
    .sort((a, b) => a.stationName.localeCompare(b.stationName) || a.slug.localeCompare(b.slug));

  const stationMap = new Map();
  let freeExecutable = 0;
  let proExecutable = 0;
  let nodeFileWired = 0;

  const catalogTools = executableBridge.map((tool) => {
    if (tool.tier === "free") freeExecutable += 1;
    else proExecutable += 1;
    if (tool.runtimeCompatibility === "node-file") nodeFileWired += 1;

    let station = stationMap.get(tool.stationId);
    if (!station) {
      station = {
        id: tool.stationId,
        name: tool.stationName,
        total: 0,
        free: 0,
        pro: 0,
        nodePure: 0,
        nodeFile: 0,
        sampleSlugs: [],
      };
      stationMap.set(tool.stationId, station);
    }
    station.total += 1;
    if (tool.tier === "free") station.free += 1;
    else station.pro += 1;
    if (tool.runtimeCompatibility === "node-pure") station.nodePure += 1;
    else station.nodeFile += 1;
    if (station.sampleSlugs.length < 4) {
      station.sampleSlugs.push(tool.slug);
    }

    const optProps = tool.inputSchema?.properties?.options?.properties ?? {};
    const options = Object.keys(optProps)
      .sort()
      .map((optName) => ({
        name: optName,
        type: String(optProps[optName]?.type ?? "string"),
        description: String(optProps[optName]?.description ?? ""),
      }));

    const pipeExample = buildPipeExample(tool);
    return {
      slug: tool.slug,
      name: tool.name,
      mcpName: tool.mcpName,
      tier: tool.tier,
      runtime: tool.runtimeCompatibility,
      stationId: tool.stationId,
      stationName: tool.stationName,
      category: tool.category,
      description: tool.description,
      options,
      cliExample: buildCliExample(tool),
      ...(pipeExample ? { pipeExample } : {}),
    };
  });

  const stations = [...stationMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const directTools = [
    ...universalMetaTools.map((t) => ({
      name: t.name,
      kind: "universal",
      tier: "free",
      description: t.description ?? "",
    })),
    ...top25McpTools.map((t) => ({
      name: t.name,
      kind: "direct",
      tier: String(t.description ?? "").includes("[Pro Tier") && !String(t.description ?? "").includes("Free Tier")
        ? "pro"
        : String(t.description ?? "").includes("Free Tier for SHA-256")
          ? "freemium"
          : "free",
      description: t.description ?? "",
    })),
  ];

  return {
    version: "1.4.0",
    pricing: {
      inr: pricing.inr,
      usd: pricing.usd,
      lifetimeInr: pricing.lifetimeInr,
      lifetimeUsd: pricing.lifetimeUsd,
      upgradeUrl: pricing.upgradeUrl,
    },
    counts: {
      totalCatalogTools: bridgeTools.length,
      executableTotal: catalogTools.length,
      freeExecutable,
      proExecutable,
      nodePure: totalNodePure,
      nodeFileWired,
      nodeFileTotal: totalNodeFileAll,
      browserOnly: totalBrowserOnly,
      universalMetaTools: universalMetaTools.length,
      directTopTools: top25McpTools.length,
      directTotal: directTools.length,
      stationsCount: stations.length,
    },
    directTools,
    stations,
    tools: catalogTools,
  };
}

export function renderReadmeCatalogBlock(catalog) {
  const { counts, directTools, stations, tools } = catalog;
  const freeTools = tools.filter((t) => t.tier === "free");

  const lines = [
    README_BEGIN_MARKER,
    `<!-- Auto-generated from mcp/registry-bridge.ts via \`npm run generate:mcp-docs\`. Do not edit manually. -->`,
    "",
    `## Registered MCP & CLI Tool Surface (${counts.executableTotal} Local Tools)`,
    "",
    `- **Executable Local Tools:** **${counts.executableTotal}** (${counts.nodePure} \`node-pure\` in-memory + ${counts.nodeFileWired} local \`node-file\` handlers across ${counts.stationsCount} stations)`,
    `- **Full Registry Coverage:** ${counts.totalCatalogTools} catalog entries (${counts.browserOnly} browser-only UI/Canvas/WebAudio + ${counts.nodeFileTotal - counts.nodeFileWired} browser-only file tools fall back cleanly with direct links)`,
    `- **Default Context-Safe MCP Surface:** **${counts.universalMetaTools}** Universal Meta-Tools + **${counts.directTopTools}** Top Developer Tools = **${counts.directTotal}** compact schemas (plus optional \`--stations=\` expansion for Pro/Team)`,
    "",
    `### Universal Discovery & Direct Tools (${counts.directTotal})`,
    "",
    "| MCP Tool | Kind | Tier | Description |",
    "| --- | --- | --- | --- |",
    ...directTools.map((t) => {
      const tierBadge = t.tier === "pro" ? "Pro" : t.tier === "freemium" ? "Free (SHA-256) / Pro" : "Free";
      return `| \`${t.name}\` | ${t.kind === "universal" ? "Meta-Tool" : "Direct"} | ${tierBadge} | ${escapeMdCell(t.description)} |`;
    }),
    "",
    `### Free Tier Core Utilities (${freeTools.length} Utilities — No Key Required)`,
    "",
    "| Slug | Tool | Station | CLI Command |",
    "| --- | --- | --- | --- |",
    ...freeTools.map(
      (t) =>
        `| \`${t.slug}\` | ${escapeMdCell(t.name)} | ${escapeMdCell(t.stationName)} | \`${escapeMdCell(t.cliExample)}\` |`
    ),
    "",
    `### Station Coverage Matrix (${counts.stationsCount} Node-Executable Stations)`,
    "",
    "| Station | Tools | Free | Pro | Pure Node | Local File | Example Slugs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...stations.map(
      (s) =>
        `| ${escapeMdCell(s.name)} | ${s.total} | ${s.free} | ${s.pro} | ${s.nodePure} | ${s.nodeFile} | ${s.sampleSlugs.map((slug) => `\`${slug}\``).join(", ")} |`
    ),
    "",
    "<details>",
    `<summary>Complete Auto-Generated Catalog (${counts.executableTotal} MCP &amp; CLI Tools)</summary>`,
    "",
    "| Slug | MCP Name | Station | Tier | Runtime | Description |",
    "| --- | --- | --- | --- | --- | --- |",
    ...tools.map(
      (t) =>
        `| \`${t.slug}\` | \`${t.mcpName}\` | ${escapeMdCell(t.stationName)} | ${t.tier === "free" ? "Free" : "Pro"} | \`${t.runtime}\` | ${escapeMdCell(t.description)} |`
    ),
    "",
    "</details>",
    README_END_MARKER,
  ];

  return lines.join("\n");
}

export function updateReadmeWithCatalog(readmeContent, renderedBlock) {
  const pattern = new RegExp(
    `${escapeRegExp(README_BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(README_END_MARKER)}`,
    "m"
  );
  if (!pattern.test(readmeContent)) {
    throw new Error(
      `README is missing ${README_BEGIN_MARKER} / ${README_END_MARKER} markers.`
    );
  }
  return readmeContent.replace(pattern, renderedBlock);
}

export function runGenerator(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const checkOnly = Boolean(options.checkOnly);

  const registry = loadLiveMcpRegistry(rootDir);
  const catalog = buildMcpDocsCatalog(registry);
  const nextCatalogJson = JSON.stringify(catalog, null, 2) + "\n";

  const catalogPath = path.join(rootDir, "config/mcp-docs-catalog.json");
  const readmePath = path.join(rootDir, "packages/codestation-mcp/README.md");

  const currentCatalogJson = fs.existsSync(catalogPath)
    ? fs.readFileSync(catalogPath, "utf-8")
    : "";
  const currentReadme = fs.readFileSync(readmePath, "utf-8");
  const renderedBlock = renderReadmeCatalogBlock(catalog);
  const nextReadme = updateReadmeWithCatalog(currentReadme, renderedBlock);

  const catalogDrifted = currentCatalogJson !== nextCatalogJson;
  const readmeDrifted = currentReadme !== nextReadme;

  if (checkOnly) {
    return {
      ok: !catalogDrifted && !readmeDrifted,
      catalogDrifted,
      readmeDrifted,
      catalog,
    };
  }

  if (catalogDrifted) {
    fs.writeFileSync(catalogPath, nextCatalogJson, "utf-8");
  }
  if (readmeDrifted) {
    fs.writeFileSync(readmePath, nextReadme, "utf-8");
  }

  return {
    ok: true,
    catalogDrifted,
    readmeDrifted,
    catalog,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checkOnly = process.argv.includes("--check");
  const result = runGenerator({ checkOnly });
  if (checkOnly) {
    if (!result.ok) {
      console.error(
        `MCP docs drift detected! Run \`npm run generate:mcp-docs\` to regenerate.` +
          ` (catalogDrifted=${result.catalogDrifted}, readmeDrifted=${result.readmeDrifted})`
      );
      process.exit(1);
    }
    console.log(
      `MCP docs up to date (${result.catalog.counts.executableTotal} executable tools across ${result.catalog.counts.stationsCount} stations).`
    );
  } else {
    console.log(
      `Generated MCP docs catalog: ${result.catalog.counts.executableTotal} executable tools` +
        ` (${result.catalog.counts.nodePure} node-pure, ${result.catalog.counts.nodeFileWired} node-file,` +
        ` ${result.catalog.counts.freeExecutable} Free, ${result.catalog.counts.proExecutable} Pro).`
    );
  }
}
