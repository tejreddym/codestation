# Code Station Local MCP Server

`codestation-mcp` is a local-first Model Context Protocol (MCP) server that exposes Code Station's deterministic developer utilities directly to AI coding assistants (such as Cursor, Claude Desktop, Antigravity, and Windsurf).

## Why Local MCP?

- **Zero Latency**: Direct `stdio` execution with sub-millisecond local processing.
- **100% Privacy**: Code and payloads remain in local device memory and never hit external servers.
- **Zero Hallucinations**: Gives AI models access to exact timestamp conversions, business day arithmetic, JWT payload inspections, SQL formatting, and cryptographic hashes without hallucinating mathematical or date edge cases.

## Architecture & Security (Login-Free + One-Way Hashing)

- **Login-Free:** Users do not need an account, password, or OAuth sign-in. A cryptographically random license key (`CS-PRO-XXXX-XXXX-XXXX`) is generated directly upon payment.
- **One-Way Hashing in Cloudflare KV:** The server never stores the raw plaintext key. Only a one-way **SHA-256** hash (`lic_${sha256(key)}`) is stored in Cloudflare KV alongside validity metadata (`status`, `plan`, `expiresAt`).
- **Edge Verification:** Verification (`POST /api/v1/license/verify`) computes the SHA-256 digest of the presented key and does an exact O(1) hash lookup in Cloudflare KV.
- **Offline Caching:** Validated keys are cached in `~/.codestation/license.json` for up to 30 days, permitting full offline usage.

## Usage

### 1-Click Auto Setup (Claude Desktop, Cursor & Windsurf)
```bash
npx codestation-mcp setup --key CS-PRO-YOURKEY
```

### Quick Run (MCP Server Mode)
```bash
npx codestation-mcp
```

### Terminal CLI Subcommands
```bash
# Convert cURL to TypeScript fetch / axios / Python / Go
npx codestation-mcp curl "curl -X POST https://api.example.com -d '{\"k\":\"v\"}'" --target fetch

# Audit .env for secret leaks (Stripe, AWS, OpenAI, GitHub PAT) & diff with .env.example
npx codestation-mcp env .env --example .env.example

# Generate realistic mock dataset (JSON or SQL INSERT for DB seeding)
npx codestation-mcp mock users --count 10 --sql --table users

# Parse and resolve Git merge conflicts (ours, theirs, or both)
npx codestation-mcp conflict ./src/index.ts --strategy ours

# Decode JWT token
npx codestation-mcp jwt <token>

# Format SQL query
npx codestation-mcp sql "SELECT * FROM users"

# Explain Cron expression & next 5 runtimes
npx codestation-mcp cron "0 9 * * 1-5"

# Generate TypeScript interfaces from JSON
npx codestation-mcp ts '{"id":1,"name":"Ada"}' User

# Generate Zod validation schema from JSON
npx codestation-mcp zod '{"id":1,"name":"Ada"}'

# Hash string with SHA-256
npx codestation-mcp hash "text" --alg sha256
```

---

## AI Assistant Configuration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "YOUR_KEY"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "YOUR_KEY"]
    }
  }
}
```

Published on npm: [`codestation-mcp`](https://www.npmjs.com/package/codestation-mcp)

---

## Tool Catalog & Tiers

### Free Tier (Unlimited)
- `codestation_uuid`: Cryptographically secure v4 UUID generator.
- `codestation_base64`: Encode/decode standard and URL-safe Base64.
- `codestation_url_codec`: Encode and decode URL components.
- `codestation_hex_codec`: Hexadecimal byte formatting and decoding.
- `codestation_format_json`: Validate and format JSON with indentation.
- `codestation_minify_json`: Compact JSON to a single line.
- `codestation_json_to_yaml`: Convert JSON to YAML.
- `codestation_yaml_to_json`: Convert YAML to JSON.
- `codestation_case_convert`: Convert identifiers across camelCase, snake_case, kebab-case, PascalCase, etc.
- `codestation_text_diff`: Line-by-line unified diff between text files.
- `codestation_slugify`: Generate clean, URL-friendly slugs.

### Pro Tier (₹199 / month in India • $2.99 / month Global • ₹999 Lifetime)
- `codestation_curl_to_code`: Convert cURL commands to TypeScript fetch/axios, Python requests, or Go net/http.
- `codestation_env_audit`: Scan `.env` files for secret leaks (Stripe, AWS, OpenAI, GitHub PAT, private keys) and validate against `.env.example`.
- `codestation_mock_data`: Realistic mock dataset and SQL INSERT generator for users, products, orders, and custom schemas.
- `codestation_git_conflict`: Parse and resolve Git merge conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`).
- `codestation_json_to_typescript`: Generate TypeScript interfaces and nested types from sample JSON data.
- `codestation_json_to_zod`: Generate production-ready Zod validation schemas and inferred types from JSON.
- `codestation_hash`: SHA-256, SHA-512, MD5, SHA-1, CRC-32 checksums.
- `codestation_hmac`: HMAC message authentication codes.
- `codestation_jwt_decode`: In-memory inspection of JWT headers, claims, and signatures.
- `codestation_format_sql`: Multi-dialect SQL formatter (PostgreSQL, MySQL, SQLite, etc.).
- `codestation_cron_explain`: Explains Unix cron expressions in plain English.
- `codestation_timezone_convert`: IANA timezone converter with DST accuracy.
- `codestation_business_days`: Working day calculator excluding weekends.
- `codestation_regex_test`: Regular expression tester returning match groups.
- `codestation_json_schema`: Draft 2020-12 JSON Schema generator from data samples.

---

## Building
```bash
npm run build:mcp
```
Runs `esbuild` to produce `./bin/codestation-mcp.mjs`.
