# codestation-mcp

> Local-first Model Context Protocol (MCP) server and CLI for [Code Station](https://codestation.in) developer tools.

`codestation-mcp` exposes **33** offline-capable developer utilities directly to AI coding assistants like **Claude Desktop**, **Cursor**, **Windsurf**, and **Antigravity**. All processing runs locally in memory with zero input uploads.

---

## 1-Click Auto Setup

Automatically configure **Claude Desktop**, **Cursor IDE**, and **Windsurf**:

```bash
# With Pro license
npx -y codestation-mcp setup --key CS-PRO-YOUR-KEY

# Or Free Tier
npx -y codestation-mcp setup
```

---

## Terminal Developer CLI Subcommands

`codestation-mcp` doubles as a standalone terminal utility. In CLI mode it runs a cached (once per 24h) update check written only to `stderr` — disable anytime with `--no-update-check` or `CODESTATION_NO_UPDATE_CHECK=1`. Stdio MCP mode never runs update checks so JSON-RPC streams remain untouched.

```bash
# Generate v4 UUIDs, sortable ULIDs, or NanoIDs
npx codestation-mcp uuid 3
npx codestation-mcp ulid 3
npx codestation-mcp nanoid 2 --length 16

# Encode / decode Base64 (standard or --url-safe)
npx codestation-mcp base64 "Code Station"
npx codestation-mcp base64 "Q29kZSBTdGF0aW9u" --decode

# Query JSON with JSONPath or compute structural JSON diffs
npx codestation-mcp jsonpath '{"users":[{"name":"Ada"},{"name":"Lin"}]}' "$.users[*].name"
npx codestation-mcp json-diff '{"a":1,"b":2}' '{"a":1,"b":3,"c":4}'

# Convert cURL to TypeScript fetch / axios / Python / Go
npx codestation-mcp curl "curl -X POST https://api.example.com -d '{\"k\":\"v\"}'" --target fetch

# Audit .env for secret leaks (Stripe, AWS, OpenAI, GitHub PAT) & diff with .env.example
npx codestation-mcp env .env --example .env.example

# Generate realistic mock dataset (JSON, SQL INSERT, or CSV)
npx codestation-mcp mock users --count 10 --sql --table users

# Parse and resolve Git merge conflicts (analyze, ours, theirs, or both)
npx codestation-mcp conflict ./src/index.ts --strategy ours

# Decode & inspect JWT tokens, format SQL, explain Cron, infer TS/Zod, hash strings
npx codestation-mcp jwt <token>
npx codestation-mcp sql "SELECT * FROM users" --dialect postgresql
npx codestation-mcp cron "0 9 * * 1-5"
npx codestation-mcp ts '{"id":1,"name":"Ada"}' User
npx codestation-mcp zod '{"id":1,"name":"Ada"}'
npx codestation-mcp hash "secret" --alg sha256
```

---

## Quick Start (Stdio MCP Server)

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

Edit `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR_KEY"]
    }
  }
}
```

### Cursor IDE

Add to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR_KEY"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR_KEY"]
    }
  }
}
```

---

## Registered MCP Tools

### Free Tier (Unlimited, No Key Required — 17 Tools)
- `codestation_uuid` — Generate cryptographically secure RFC 4122 v4 UUIDs
- `codestation_ulid` — Generate lexicographically sortable Crockford Base32 ULIDs
- `codestation_nanoid` — Generate compact URL-safe cryptographic NanoIDs with custom length
- `codestation_base64` — Encode or decode standard and URL-safe Base64 strings
- `codestation_url_codec` — Percent-encode or decode URI string components
- `codestation_hex_codec` — Encode UTF-8 text to hexadecimal byte pairs or decode hex to text
- `codestation_html_codec` — Encode or decode HTML character entities safely
- `codestation_format_json` — Prettify, format, and validate JSON
- `codestation_minify_json` — Compact JSON by stripping whitespace
- `codestation_json_diff` — Structural key-by-key diff between two JSON documents
- `codestation_json_path` — Query and extract values from JSON with JSONPath (`$.field`, `$[0]`, `$[*]`)
- `codestation_json_to_yaml` — Convert JSON to YAML
- `codestation_yaml_to_json` — Convert YAML to JSON
- `codestation_csv_json` — Convert CSV tables to JSON or JSON arrays of objects to CSV
- `codestation_case_convert` — Convert text across naming conventions (`camel`, `pascal`, `snake`, `kebab`, `constant`, `title`, `sentence`, `upper`, `lower`)
- `codestation_text_diff` — Unified line-by-line text diff
- `codestation_slugify` — Generate clean URL-friendly slugs

### Pro Tier (Requires License Key — 16 Tools)
- `codestation_hash` — SHA-256, SHA-384, SHA-512, MD5, SHA-1, and CRC32 digests
- `codestation_hmac` — HMAC-SHA256 and HMAC-SHA512 message authentication codes
- `codestation_jwt_decode` — Decode JWT header, payload claims, and signature locally without verification
- `codestation_format_sql` — Format SQL queries across PostgreSQL, MySQL, SQLite, and SQL Server
- `codestation_cron_explain` — Explain 5-field Unix cron expressions in plain English
- `codestation_cron_next_runs` — Compute upcoming cron execution timestamps in any IANA timezone
- `codestation_timezone_convert` — Convert timestamps across IANA timezones with runtime rules
- `codestation_business_days` — Count working days between dates excluding weekends
- `codestation_regex_test` — Test regular expressions with match groups and capture indices
- `codestation_json_schema` — Infer Draft 2020-12 JSON Schema from sample JSON
- `codestation_json_to_typescript` — Generate TypeScript interfaces and types from JSON
- `codestation_json_to_zod` — Generate Zod validation schemas and inferred types from JSON
- `codestation_curl_to_code` — Convert cURL commands to TypeScript `fetch`/`axios`, Python `requests`, or Go `net/http`
- `codestation_env_audit` — Scan `.env` for leaked secrets and diff against `.env.example`
- `codestation_mock_data` — Generate mock datasets and SQL seeders (`users`, `products`, `orders`, `custom`)
- `codestation_git_conflict` — Parse and resolve Git merge conflict markers (`analyze`, `ours`, `theirs`, `both`)

---

## License & Activation

Get a Pro license key at [codestation.in/pro](https://codestation.in/pro):
- **India:** ₹199 / month or ₹999 one-time
- **Global:** $2.99 / month or $19.00 one-time

Ways to provide your key:
1. CLI flag: `npx codestation-mcp --key CS-PRO-YOUR-KEY`
2. Environment variable: `export CODESTATION_LICENSE_KEY="CS-PRO-YOUR-KEY"`
3. Cached config file: `~/.codestation/license.json`

---

## License

MIT © [Code Station](https://codestation.in)
