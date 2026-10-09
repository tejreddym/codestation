# Code Station Local MCP Server

`codestation-mcp` is a local-first Model Context Protocol (MCP) server that exposes Code Station's deterministic developer utilities directly to AI coding assistants (such as Cursor, Claude Desktop, Antigravity, and Windsurf).

## Why Local MCP?

- **Zero Latency**: Direct `stdio` execution with sub-millisecond local processing.
- **100% Privacy**: Code and payloads remain in local device memory and never hit external servers.
- **Zero Hallucinations**: Gives AI models access to exact timestamp conversions, business day arithmetic, JWT payload inspections, SQL formatting, and cryptographic hashes without hallucinating mathematical or date edge cases.

## Usage

### Quick Run
```bash
npx codestation-mcp
```

### With Pro License
```bash
npx codestation-mcp --key CS-PRO-YOURKEY
```
Or via environment variable:
```bash
export CODESTATION_LICENSE_KEY=CS-PRO-YOURKEY
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
      "command": "node",
      "args": ["./bin/codestation-mcp.mjs", "--key", "YOUR_KEY"]
    }
  }
}
```

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

### Pro Tier (₹199 / month in India • $2.99 / month Global)
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
