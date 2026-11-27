#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server";
import { PRICING } from "./config";
import { runAutoSetup } from "./setup";
import { handleCliSubcommand } from "./cli-tools";
import { checkForCliUpdate } from "./update-check";

const CLI_VERSION = "1.3.0";

const PRO_ASCII_BADGE = `
  ┌──────────────────────────────────────────────────────────┐
  │  CODE STATION [PRO]  •  LOCAL MCP & DEVELOPER TOOLBOX    │
  │  Zero-Latency Engine  •  Device Memory  •  Edge Crypto   │
  └──────────────────────────────────────────────────────────┘
`;

function printHelp(): void {
  process.stderr.write(`
Code Station MCP Server & Developer CLI
Local-first developer toolbox for AI assistants (Cursor, Claude Desktop, Windsurf) and terminal workflows.

Usage:
  npx codestation-mcp [command|options]

1-Click AI Assistant Setup:
  npx codestation-mcp setup [--key <license_key>]
    Automatically configures Claude Desktop, Cursor IDE, and Windsurf.

Terminal Subcommands:
  jwt <token>                   Decode & inspect JWT header, payload, and expiry
  sql "<query>" [--dialect]     Format SQL query (postgresql, mysql, sqlite, sqlserver)
  cron "<expression>"           Explain cron schedule & project next 5 runtimes
  hash "<text>" [--alg]         Compute digest (sha256, sha512, md5, sha1, crc32)
  ts "<json_string|file>"       Generate clean TypeScript interfaces from JSON
  zod "<json_string|file>"      Generate production-ready Zod schema from JSON
  curl "<curl_cmd>" [--target]  Convert cURL to fetch, axios, python, or go
  env [path/.env] [--example]   Audit .env for leaked secrets & diff with .env.example
  mock [template] [--count]     Generate realistic mock data (users, products, orders)
  conflict <file> [--strategy]  Parse & resolve Git merge conflicts (ours, theirs, both)
  uuid [count]                  Generate random RFC 4122 v4 UUIDs
  ulid [count]                  Generate sortable ULIDs
  nanoid [count] [--length N]   Generate URL-safe NanoIDs
  json "<raw_json>"             Validate & pretty-print JSON
  json-diff '<a.json>' '<b.json>' Compute structural JSON diff
  jsonpath "<json>" "<expr>"    Query JSON using JSONPath (e.g. $.users[*].name)
  base64 "<text>" [--decode]    Encode or decode Base64 (--url-safe supported)

Stdio Server Options (for AI Assistants):
  --key <license_key>           Activate Code Station Pro features
  --no-update-check             Disable npm update check (or set CODESTATION_NO_UPDATE_CHECK=1)
  --help, -h                    Show this help message
  --version, -v                 Show version information

Pricing:
  • Free Tier:                  Unlimited Base64, JSON, YAML, UUID, Text Diff, Case conversion
  • Pro Tier (India):           ${PRICING.inr} (or ${PRICING.lifetimeInr})
  • Pro Tier (Global):          ${PRICING.usd} (or ${PRICING.lifetimeUsd})
  • Upgrade / Account:          ${PRICING.upgradeUrl}
\n`);
}

async function runCliUpdateCheck(args: string[]): Promise<void> {
  await Promise.race([
    checkForCliUpdate({
      currentVersion: CLI_VERSION,
      argv: args,
      timeoutMs: 800,
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 250)),
  ]);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cleanArgs = args.filter((a) => a !== "--no-update-check");

  if (cleanArgs.includes("--version") || cleanArgs.includes("-v")) {
    process.stderr.write(`codestation-mcp v${CLI_VERSION}\n`);
    await runCliUpdateCheck(args);
    process.exit(0);
  }

  // 1. Auto-Setup command: npx codestation-mcp setup [--key <KEY>]
  if (cleanArgs[0] === "setup") {
    const updatePromise = runCliUpdateCheck(args);
    let key: string | undefined;
    const keyIdx = cleanArgs.indexOf("--key");
    if (keyIdx !== -1 && cleanArgs[keyIdx + 1]) {
      key = cleanArgs[keyIdx + 1];
    }

    process.stdout.write("\n=== Code Station 1-Click AI Setup ===\n");
    if (key) {
      process.stdout.write(`Activating with Pro Key: ${key.slice(0, 8)}...\n`);
    } else {
      process.stdout.write("Configuring in Free Tier mode (run with --key anytime to activate Pro).\n");
    }

    const results = await runAutoSetup(key);
    for (const r of results) {
      if (r.status === "configured") {
        process.stdout.write(`  ✔ ${r.target.padEnd(26)} Configured (${r.path})\n`);
      } else {
        process.stdout.write(`  ✖ ${r.target.padEnd(26)} Error: ${r.message}\n`);
      }
    }

    process.stdout.write("\n✨ Setup complete! Restart your editor(s) to start using Code Station tools.\n\n");
    await updatePromise;
    process.exit(0);
  }

  // 2. Terminal subcommands (status, curl-to-any-language, env-audit, mock-data, conflict-parse, etc.)
  if (cleanArgs.length > 0 && !cleanArgs[0].startsWith("-")) {
    const updatePromise = runCliUpdateCheck(args);
    const res = await handleCliSubcommand(cleanArgs[0], cleanArgs.slice(1));
    if (res.handled) {
      await updatePromise;
      process.exit(res.exitCode);
    }
  }

  if (cleanArgs.includes("--help") || cleanArgs.includes("-h")) {
    printHelp();
    await runCliUpdateCheck(args);
    process.exit(0);
  }

  // 3. Stdio MCP Server mode (never run update checks here so stdio JSON-RPC stays clean)
  let cliKey: string | undefined;
  const keyIndex = cleanArgs.indexOf("--key");
  if (keyIndex !== -1 && cleanArgs[keyIndex + 1]) {
    cliKey = cleanArgs[keyIndex + 1];
  }

  const { server, license } = createMcpServer(cliKey);

  if (license.isPro) {
    process.stderr.write(PRO_ASCII_BADGE);
    process.stderr.write(`[Code Station MCP] Pro Tier Active (License: ${license.licenseKey?.slice(0, 8)}...). All tools unlocked.\n`);
  } else {
    process.stderr.write(
      `[Code Station MCP] Running in Free Tier. Pro tools available at ${PRICING.inr} / ${PRICING.usd} (${PRICING.upgradeUrl})\n`
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[Code Station MCP] Connected to stdio. Ready for tool requests.\n");
}

main().catch((err) => {
  process.stderr.write(`[Code Station MCP Error] ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
