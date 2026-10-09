#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server";
import { PRICING } from "./config";
import { runAutoSetup } from "./setup";
import { handleCliSubcommand } from "./cli-tools";

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
  json "<raw_json>"             Validate & pretty-print JSON

Stdio Server Options (for AI Assistants):
  --key <license_key>           Activate Code Station Pro features
  --help, -h                    Show this help message
  --version, -v                 Show version information

Pricing:
  • Free Tier:                  Unlimited Base64, JSON, YAML, UUID, Text Diff, Case conversion
  • Pro Tier (India):           ${PRICING.inr} (or ${PRICING.lifetimeInr})
  • Pro Tier (Global):          ${PRICING.usd} (or ${PRICING.lifetimeUsd})
  • Upgrade / Account:          ${PRICING.upgradeUrl}
\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    process.stderr.write("codestation-mcp v1.2.1\n");
    process.exit(0);
  }

  // 1. Auto-Setup command: npx codestation-mcp setup [--key <KEY>]
  if (args[0] === "setup") {
    let key: string | undefined;
    const keyIdx = args.indexOf("--key");
    if (keyIdx !== -1 && args[keyIdx + 1]) {
      key = args[keyIdx + 1];
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
    process.exit(0);
  }

  // 2. Terminal subcommands (status, curl-to-any-language, env-audit, mock-data, conflict-parse, etc.)
  if (args.length > 0 && !args[0].startsWith("-")) {
    const res = await handleCliSubcommand(args[0], args.slice(1));
    if (res.handled) {
      process.exit(res.exitCode);
    }
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  // 3. Stdio MCP Server mode
  let cliKey: string | undefined;
  const keyIndex = args.indexOf("--key");
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    cliKey = args[keyIndex + 1];
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
