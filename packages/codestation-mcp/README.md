# codestation-mcp

> Local-first Model Context Protocol (MCP) server for [Code Station](https://codestation.in) developer tools.

`codestation-mcp` exposes 20+ offline-capable developer utilities directly to AI coding assistants like **Claude Desktop**, **Cursor**, **Windsurf**, and **Antigravity**. All tools process data locally on your machine with zero server roundtrips.

---

## 1-Click Auto Setup

Automatically configure **Claude Desktop**, **Cursor IDE**, and **Windsurf** in 1 click:

```bash
# With Pro license
npx -y codestation-mcp setup --key CS-PRO-YOUR-KEY

# Or Free Tier
npx -y codestation-mcp setup
```

---

## Terminal Developer CLI Subcommands

`codestation-mcp` is also a dual-purpose terminal Swiss-Army knife:

```bash
# Convert cURL to TypeScript fetch / axios / Python / Go
npx codestation-mcp curl "curl -X POST https://api.example.com -d '{\"k\":\"v\"}'" --target fetch

# Audit .env for secret leaks (Stripe, AWS, OpenAI, GitHub PAT) & diff with .env.example
npx codestation-mcp env .env --example .env.example

# Generate realistic mock dataset (JSON or SQL INSERT for DB seeding)
npx codestation-mcp mock users --count 10 --sql --table users

# Parse and resolve Git merge conflicts (ours, theirs, or both)
npx codestation-mcp conflict ./src/index.ts --strategy ours

# Decode & inspect JWT tokens
npx codestation-mcp jwt <token>

# Format SQL queries (Postgres, MySQL, SQLite, SQL Server)
npx codestation-mcp sql "SELECT * FROM users"

# Explain Cron expression & next 5 runtimes
npx codestation-mcp cron "0 9 * * 1-5"

# Generate TypeScript interfaces from JSON
npx codestation-mcp ts '{"id":1,"name":"Ada"}' User

# Generate Zod validation schema from JSON
npx codestation-mcp zod '{"id":1,"name":"Ada"}'

# Hash string with SHA-256 / SHA-512 / MD5 / CRC32
npx codestation-mcp hash "secret" --alg sha256
```

---

## Quick Start (Stdio MCP Server)

You can run `codestation-mcp` as an MCP server using `npx`:

```bash
npx -y codestation-mcp
```

Or with your Pro license key:

```bash
npx -y codestation-mcp --key CS-PRO-YOUR-KEY
```

---

## AI Assistant Configuration

### Claude Desktop

Edit your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "cs_pro_YOUR_KEY"]
    }
  }
}
```

### Cursor IDE

Add to your project's `.cursor/mcp.json` or Cursor Global Settings:

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "cs_pro_YOUR_KEY"]
    }
  }
}
```

---

## Available Tools

### Free Tier (Unlimited, No Key Required)
- `format_json` & `minify_json` — Beautify or compact JSON
- `json_to_yaml` & `yaml_to_json` — Two-way JSON ↔ YAML conversions
- `base64_encode` & `base64_decode` — Base64 and URL-safe conversions
- `hex_encode` & `hex_decode` — Hexadecimal formatting
- `url_encode` & `url_decode` — RFC 3986 URI encoding
- `convert_case` & `slugify` — CamelCase, snake_case, kebab-case, PascalCase, title case
- `diff_text` — Line-by-line unified text diffing
- `generate_uuid` — v4 UUID generator

### Pro Tier (Requires License Key)
- `codestation_curl_to_code` — Convert cURL to TypeScript fetch/axios, Python requests, or Go net/http
- `codestation_env_audit` — Scan .env for leaked secrets (Stripe, AWS, OpenAI, GitHub PAT) & diff with .env.example
- `codestation_mock_data` — Realistic mock dataset & SQL INSERT generator for DB seeding
- `codestation_git_conflict` — Parse and resolve Git merge conflict markers (ours, theirs, both)
- `codestation_json_to_typescript` — Generate TypeScript interfaces and nested types from sample JSON
- `codestation_json_to_zod` — Generate production-ready Zod validation schemas and inferred types
- `decode_jwt` — Parse and decode JWT headers, claims, and expiry dates
- `generate_json_schema` — Infer JSON Schema Draft 7/2020-12 from sample JSON
- `test_regex` — Test regex with match groups and capture explanations
- `hash_data` & `generate_hmac` — MD5, SHA-1, SHA-256, SHA-512, HMAC-SHA256, HMAC-SHA512, CRC32
- `calculate_business_days` — Compute working days excluding weekends and custom holidays
- `compute_next_cron_runs` — Parse cron expressions and calculate next execution timestamps
- `format_sql` & `run_sql` — Format SQL queries across PostgreSQL, MySQL, SQLite, and SQL Server

---

## License & Activation

To activate Pro features, get a license key at [codestation.in/pro](https://codestation.in/pro):
- **India:** ₹199 / month or ₹999 lifetime
- **Global:** $2.99 / month or $19.00 lifetime

### Ways to provide your key:
1. CLI flag: `npx codestation-mcp --key cs_pro_YOUR_KEY`
2. Environment variable: `export CODESTATION_KEY="cs_pro_YOUR_KEY"`
3. Config file: Save `{"licenseKey": "cs_pro_YOUR_KEY"}` in `~/.codestation/license.json`

Each license allows up to **3 concurrent active devices** with 30-day automatic pruning and instant device resets.

---

## License

MIT © [Code Station](https://codestation.in)
