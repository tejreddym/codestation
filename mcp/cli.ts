#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server";
import { PRICING } from "./config";

function printHelp(): void {
  process.stderr.write(`
Code Station MCP Server
Local-first developer toolbox for AI assistants (Cursor, Claude Desktop, Antigravity)

Usage:
  npx codestation-mcp [options]

Options:
  --key <license_key>     Activate Code Station Pro features
  --help, -h              Show this help message
  --version, -v           Show version information

Pricing:
  • Free Tier:            Unlimited Base64, JSON, YAML, UUID, Text Diff, Case conversion
  • Pro Tier (India):     ${PRICING.inr} (or ${PRICING.lifetimeInr})
  • Pro Tier (Global):    ${PRICING.usd} (or ${PRICING.lifetimeUsd})
  • Upgrade / Account:    ${PRICING.upgradeUrl}

Configuration for Claude Desktop (claude_desktop_config.json):
  {
    "mcpServers": {
      "codestation": {
        "command": "npx",
        "args": ["-y", "codestation-mcp", "--key", "YOUR_PRO_KEY"]
      }
    }
  }
\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    process.stderr.write("codestation-mcp v1.0.0\n");
    process.exit(0);
  }

  let cliKey: string | undefined;
  const keyIndex = args.indexOf("--key");
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    cliKey = args[keyIndex + 1];
  }

  const { server, license } = createMcpServer(cliKey);

  if (license.isPro) {
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
