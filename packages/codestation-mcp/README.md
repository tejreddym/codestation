# codestation-mcp

> Local-first Model Context Protocol (MCP) server and pipeable CLI for [Code Station](https://codestation.in) developer tools.

`codestation-mcp` brings **330+ offline-capable developer tools** directly to AI coding assistants (**Cursor**, **Claude Desktop**, **Windsurf**, **Claude Code**, **VS Code**) and your terminal using a context-safe Hybrid Registry (**3** universal discovery/router tools + **25** direct everyday tools + `--stations=` expansion). Every execution runs locally with zero telemetry or input uploads.

---

## 1-Click Auto Setup & License Login

Automatically configure **Claude Desktop**, **Cursor IDE**, and **Windsurf**:

```bash
# Pro / Team (all 330+ Node & local file tools + --stations expansion)
npx -y codestation-mcp setup --key CS-PRO-YOUR-KEY

# Or Free Tier (3 universal router tools + 15 core utilities)
npx -y codestation-mcp setup
```

Verify & cache a Pro/Team key locally with a **14-day offline grace window** (`~/.codestation/license.json`, `0600` permissions) and a deterministic machine fingerprint:

```bash
codestation login CS-PRO-YOUR-KEY
codestation status
codestation logout
```

---

## Pipeable Terminal Developer CLI

Every registered Node-compatible tool is runnable directly from your terminal with Unix stdin piping, file flags (`--in` / `--out`), and JSON options:

```bash
# Discover tools and inspect option schemas
codestation list --station json --tier free
codestation list --search xlsx --json
codestation info pdf-merge

# Execute tools directly or pipe stdin
echo '{"hello":"world"}' | codestation run json-formatter
cat data.json | codestation run json-to-yaml --key CS-PRO-YOUR-KEY
codestation run sql-formatter --in query.sql --out formatted.sql
codestation run pdf-merge --in a.pdf --in b.pdf --out merged.pdf
```

> Stdio MCP mode never runs update checks or prints status text to `stdout`, keeping JSON-RPC streams strictly clean. Disable update checks in CLI mode with `--no-update-check` or `CODESTATION_NO_UPDATE_CHECK=1`.

---

## Quick Start (Stdio MCP Server)

```bash
npx -y codestation-mcp
```

Or with Pro / Team key and optional station expansion:

```bash
npx -y codestation-mcp --key CS-PRO-YOUR-KEY --stations=json,security,sql,pdf
```

---

## AI Assistant Configuration

### Cursor IDE

Add to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp"],
      "env": {
        "CODESTATION_LICENSE_KEY": "CS-PRO-YOUR-KEY"
      }
    }
  }
}
```

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
      "args": ["-y", "codestation-mcp"],
      "env": {
        "CODESTATION_LICENSE_KEY": "CS-PRO-YOUR-KEY"
      }
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
      "args": ["-y", "codestation-mcp"],
      "env": {
        "CODESTATION_LICENSE_KEY": "CS-PRO-YOUR-KEY"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add codestation -e CODESTATION_LICENSE_KEY=CS-PRO-YOUR-KEY -- npx -y codestation-mcp --stations=json,security,sql
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "codestation": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "codestation-mcp"],
      "env": {
        "CODESTATION_LICENSE_KEY": "CS-PRO-YOUR-KEY"
      }
    }
  }
}
```

---

<!-- BEGIN_MCP_CATALOG -->
<!-- Auto-generated from mcp/registry-bridge.ts via `npm run generate:mcp-docs`. Do not edit manually. -->

## Registered MCP & CLI Tool Surface (332 Local Tools)

- **Executable Local Tools:** **332** (304 `node-pure` in-memory + 28 local `node-file` handlers across 28 stations)
- **Full Registry Coverage:** 394 catalog entries (17 browser-only UI/Canvas/WebAudio + 45 browser-only file tools fall back cleanly with direct links)
- **Default Context-Safe MCP Surface:** **3** Universal Meta-Tools + **25** Top Developer Tools = **28** compact schemas (plus optional `--stations=` expansion for Pro/Team)

### Universal Discovery & Direct Tools (28)

| MCP Tool | Kind | Tier | Description |
| --- | --- | --- | --- |
| `codestation_list_tools` | Meta-Tool | Free | Discover all 380+ Code Station tools across 29 developer stations (300+ Node-executable utilities), filterable by station, search query, tier, or runtime compatibility. |
| `codestation_describe_tool` | Meta-Tool | Free | Return the exact input/options JSON schema, runtime compatibility, tier, and runnable examples for any Code Station tool slug. |
| `codestation_run_tool` | Meta-Tool | Free | Execute any Node-compatible Code Station tool (300+ pure tools across JSON, Encoding, Security, Regex, SQL, Date/Time, Text, Markdown, Codegen, Network, Math, Crypto, AI, Finance, Git) by slug. |
| `codestation_format_json` | Direct | Free | Prettify, format, and validate a JSON string. [Free Tier] |
| `codestation_json_to_yaml` | Direct | Pro | Convert JSON to clean YAML format. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_json_path` | Direct | Pro | Query and extract matching nodes from JSON using JSONPath (e.g. $.users[*].name, $[0].id). [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_json_diff` | Direct | Pro | Compute a structural key-by-key diff between two JSON documents. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_csv_json` | Direct | Pro | Convert CSV tables (with header row) to JSON arrays or JSON arrays of objects to CSV. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_jwt_decode` | Direct | Free | Inspect & decode JSON Web Token (JWT) header, payload claims, and signature in local memory without transmitting secrets. [Free Tier] |
| `codestation_base64` | Direct | Free | Encode or decode Base64 and URL-safe Base64 strings. [Free Tier] |
| `codestation_url_codec` | Direct | Free | URL encode or decode string components. [Free Tier] |
| `codestation_uuid` | Direct | Free | Generate cryptographically secure v4 UUIDs. [Free Tier] |
| `codestation_hash` | Direct | Free | Generate cryptographic hashes (SHA-256 Free; SHA-384, SHA-512, MD5, SHA-1, CRC-32 require Pro Tier). |
| `codestation_text_diff` | Direct | Free | Generate a clean line-by-line unified diff between original and modified text. [Free Tier] |
| `codestation_case_convert` | Direct | Pro | Convert text into different naming conventions (camelCase, snake_case, kebab-case, PascalCase, CONSTANT_CASE, etc.). [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_regex_test` | Direct | Free | Test regular expressions against target text and return structured match groups and indices. [Free Tier] |
| `codestation_cron_explain` | Direct | Free | Parse and explain 5-field Unix cron expressions in clear plain English. [Free Tier] |
| `codestation_format_sql` | Direct | Pro | Format, beautify, and indent SQL queries across PostgreSQL, MySQL, SQLite, and standard SQL. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_markdown_to_html` | Direct | Free | Convert Markdown into sanitized HTML locally with headings, tables, lists, and code blocks. [Free Tier] |
| `codestation_timestamp_convert` | Direct | Free | Convert a Unix epoch timestamp (seconds or milliseconds) to ISO 8601 and UTC/local date representations. [Free Tier] |
| `codestation_cidr_calc` | Direct | Pro | Calculate CIDR subnet mask, network address, broadcast address, usable IP range, and host count. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_token_count` | Direct | Pro | Estimate LLM token count, character stats, and API cost across GPT-4o, Claude 3.5, Gemini 1.5, and Llama 3. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_json_to_typescript` | Direct | Pro | Generate clean TypeScript interfaces and types from sample JSON data. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_json_to_zod` | Direct | Pro | Generate production-ready Zod validation schema and inferred types from sample JSON data. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_curl_to_code` | Direct | Pro | Convert cURL commands to TypeScript fetch/axios, Python requests, or Go net/http. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_env_audit` | Direct | Pro | Scan environment variables for secret leaks (Stripe, AWS, OpenAI, GitHub PAT, private keys) and validate against .env.example. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_mock_data` | Direct | Pro | Generate realistic mock data and SQL seeders for users, products, orders, or custom schemas. [Pro Tier: ₹199/mo or $2.99/mo] |
| `codestation_git_conflict` | Direct | Pro | Parse and resolve Git merge conflict markers (<<<<<<< HEAD, =======, >>>>>>>). [Pro Tier: ₹199/mo or $2.99/mo] |

### Free Tier Core Utilities (15 Utilities — No Key Required)

| Slug | Tool | Station | CLI Command |
| --- | --- | --- | --- |
| `cron-explainer` | Cron Explainer | Cron | `codestation run cron-explainer --input '0 9 * * 1-5' --options '{"reference":"2026-10-01T00:00:00Z","timezone":"UTC"}'` |
| `unix-timestamp-converter` | Unix Timestamp Converter | Date & Time | `codestation run unix-timestamp-converter --input 1700000000 --options '{"unit":"Seconds"}'` |
| `base64-decoder` | Base64 Decoder | Encoding | `codestation run base64-decoder --input 'SGVsbG8gd29ybGQ='` |
| `base64-encoder` | Base64 Encoder | Encoding | `codestation run base64-encoder --input 'Hello Code Station'` |
| `jwt-decoder` | JWT Decoder | Encoding | `codestation run jwt-decoder` |
| `url-decoder` | URL Decoder | Encoding | `codestation run url-decoder --input 'hello%20world'` |
| `url-encoder` | URL Encoder | Encoding | `codestation run url-encoder --input 'Hello Code Station'` |
| `json-formatter` | JSON Formatter | JSON & Data | `codestation run json-formatter --input '{"b":2,"a":1,"tags":["mcp","node"]}'` |
| `json-minifier` | JSON Minifier | JSON & Data | `codestation run json-minifier --input '{"b":2,"a":1,"tags":["mcp","node"]}'` |
| `json-validator` | JSON Validator | JSON & Data | `codestation run json-validator --input '{"b":2,"a":1,"tags":["mcp","node"]}'` |
| `markdown-to-html` | Markdown to HTML | Markdown | `codestation run markdown-to-html` |
| `regex-tester` | Regex Tester | Regex | `codestation run regex-tester --input 'user=ada id=42' --options '{"pattern":"(\\w+)=(\\w+)","flags":"g"}'` |
| `sha-256-generator` | SHA-256 Generator | Security | `codestation run sha-256-generator --input 'Hello Code Station'` |
| `uuid-generator` | UUID Generator | Security | `codestation run uuid-generator --input 'Hello Code Station'` |
| `text-diff` | Text Diff | Text | `codestation run text-diff --options '{"textB":"line 1\nline 3"}'` |

### Station Coverage Matrix (28 Node-Executable Stations)

| Station | Tools | Free | Pro | Pure Node | Local File | Example Slugs |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| AI & Prompt Engineering | 5 | 0 | 5 | 5 | 0 | `ai-token-counter`, `json-repair`, `prompt-interpolator`, `system-prompt-builder` |
| API | 16 | 0 | 16 | 16 | 0 | `api-response-formatter`, `basic-auth-header-generator`, `bearer-token-header-generator`, `curl-to-any-language` |
| Code Generation | 8 | 0 | 8 | 8 | 0 | `html-to-jsx`, `json-to-go`, `json-to-pydantic`, `json-to-rust` |
| Color & CSS | 6 | 0 | 6 | 6 | 0 | `border-radius-generator`, `box-shadow-generator`, `color-converter`, `contrast-checker` |
| Compression | 9 | 0 | 9 | 2 | 7 | `gzip-compress`, `gzip-compressor`, `gzip-decompress`, `gzip-decompressor` |
| Converters | 3 | 0 | 3 | 3 | 0 | `number-base-converter`, `temperature-converter`, `unit-converter` |
| Cron | 6 | 1 | 5 | 6 | 0 | `cron-explainer`, `cron-generator`, `cron-next-run`, `cron-to-human` |
| Date & Time | 17 | 1 | 16 | 17 | 0 | `age-calculator`, `business-days-calculator`, `current-time-in-timezone`, `date-difference-calculator` |
| Developer Math | 7 | 0 | 7 | 7 | 0 | `bigint-calculator`, `bitwise-calculator`, `fraction-converter`, `gcd-lcm-calculator` |
| Encoding | 35 | 5 | 30 | 35 | 0 | `ascii-to-text`, `base32-decoder`, `base32-encoder`, `base58-decoder` |
| Finance & Calculators | 4 | 0 | 4 | 4 | 0 | `emi-calculator`, `gst-calculator`, `loan-prepayment-calculator`, `sip-calculator` |
| Frontend & CSS | 2 | 0 | 2 | 2 | 0 | `css-grid-generator`, `glassmorphism-generator` |
| Git & Version Control | 7 | 0 | 7 | 7 | 0 | `changelog-generator`, `conflict-parse`, `conventional-commit-builder`, `conventional-commit-validator` |
| Image | 6 | 0 | 6 | 2 | 4 | `image-dimension-inspector`, `image-inspect`, `image-metadata-viewer`, `svg-formatter` |
| JSON & Data | 47 | 3 | 44 | 47 | 0 | `csv-cleaner`, `csv-column-analyzer`, `csv-column-reorderer`, `csv-data-deduplicator` |
| Markdown | 18 | 1 | 17 | 18 | 0 | `csv-to-markdown-table`, `html-to-markdown`, `markdown-blockquote-generator`, `markdown-code-block-generator` |
| Network & DevOps | 8 | 0 | 8 | 8 | 0 | `cert-inspector`, `cidr-calculator`, `docker-run-to-compose`, `dockerfile-generator` |
| PDF | 8 | 0 | 8 | 0 | 8 | `pdf-compressor`, `pdf-inspect`, `pdf-merge`, `pdf-page-deleter` |
| Policy Generators | 5 | 0 | 5 | 5 | 0 | `cookie-policy-generator`, `disclaimer-generator`, `privacy-policy-generator`, `refund-policy-generator` |
| Productivity | 1 | 0 | 1 | 1 | 0 | `invoice-generator` |
| QR & Barcode | 1 | 0 | 1 | 1 | 0 | `qr-code-generator` |
| Regex | 9 | 1 | 8 | 9 | 0 | `regex-capture-group-tester`, `regex-escape`, `regex-flag-tester`, `regex-group-extractor` |
| Security | 23 | 2 | 21 | 22 | 1 | `checksum-generator`, `crc32-generator`, `entropy-calculator`, `env-audit` |
| Spreadsheet | 8 | 0 | 8 | 0 | 8 | `csv-to-excel`, `excel-to-csv`, `excel-to-json`, `json-to-excel` |
| SQL & Database | 17 | 0 | 17 | 17 | 0 | `csv-to-sql`, `database-connection-string-builder`, `database-connection-string-parser`, `er-diagram-generator` |
| Text | 31 | 1 | 30 | 31 | 0 | `bom-detector`, `bom-remover`, `case-converter`, `character-counter-without-spaces` |
| Web | 20 | 0 | 20 | 20 | 0 | `canonical-url-generator`, `html-entity-reference`, `http-header-reference`, `http-status-code-lookup` |
| WebPKI & Advanced Cryptography | 5 | 0 | 5 | 5 | 0 | `aes-crypto`, `csp-builder`, `csr-inspector`, `jwt-signer-verifier` |

<details>
<summary>Complete Auto-Generated Catalog (332 MCP &amp; CLI Tools)</summary>

| Slug | MCP Name | Station | Tier | Runtime | Description |
| --- | --- | --- | --- | --- | --- |
| `ai-token-counter` | `codestation_ai_token_counter` | AI & Prompt Engineering | Pro | `node-pure` | AI Token Counter & Visualizer: text or prompt to tokenize, target model family, input price ($/1m tokens), output price ($/1m tokens) → total token count, visual token boundaries, estimated api cost, character & word statistics. Process locally in your browser. |
| `json-repair` | `codestation_json_repair` | AI & Prompt Engineering | Pro | `node-pure` | LLM JSON Repair & Validator: malformed llm json text, output indentation → repaired valid json, side-by-side diff view, applied syntax repairs summary, rfc-8259 validation status. Process locally in your browser. |
| `prompt-interpolator` | `codestation_prompt_interpolator` | AI & Prompt Engineering | Pro | `node-pure` | Prompt Template Interpolator: prompt template with {{variable}} or {variable}, test records dataset (json array), export format → interpolated prompt, role-formatted messages (system, user, assistant), batch dataset preview, openai & anthropic json export. Process locally in your browser. |
| `system-prompt-builder` | `codestation_system_prompt_builder` | AI & Prompt Engineering | Pro | `node-pure` | System Prompt Pattern Builder: agent role & persona, core task & instructions, tone & style, xml tag wrapping → assembled system prompt, live token & character counters, role guardrails & constraints, copy & download export. Process locally in your browser. |
| `vector-similarity` | `codestation_vector_similarity` | AI & Prompt Engineering | Pro | `node-pure` | Vector Similarity & Distance Calculator: vector a (json array, comma or space-separated numbers), vector b (json array, comma or space-separated numbers), primary metric → cosine similarity & percentage match, euclidean distance (l2), dot product, manhattan distance (l1), dimensional contribution breakdown. Process locally in your browser. |
| `api-response-formatter` | `codestation_api_response_formatter` | API | Pro | `node-pure` | Format supplied JSON, XML, HTML source or text locally without fetching or executing response content. |
| `basic-auth-header-generator` | `codestation_basic_auth_header_generator` | API | Pro | `node-pure` | Generate a UTF-8 Base64 Basic Authorization header locally from explicit username and password. |
| `bearer-token-header-generator` | `codestation_bearer_token_header_generator` | API | Pro | `node-pure` | Generate a Bearer Authorization header locally without storing or remotely validating the token. |
| `curl-to-any-language` | `codestation_curl_to_any_language` | API | Pro | `node-pure` | cURL to Any Language Generator: curl command, target language → generated idiomatic code, warnings & notices. Process locally in your browser. |
| `curl-to-axios` | `codestation_curl_to_axios` | API | Pro | `node-pure` | Generate readable Axios JavaScript from a supported cURL command locally; no request is executed. |
| `curl-to-fetch` | `codestation_curl_to_fetch` | API | Pro | `node-pure` | Convert a literal cURL command into JavaScript Fetch code locally without executing a request. |
| `curl-to-python-requests` | `codestation_curl_to_python_requests` | API | Pro | `node-pure` | Generate Python Requests code from supported cURL text locally without executing Python or HTTP. |
| `fetch-to-curl` | `codestation_fetch_to_curl` | API | Pro | `node-pure` | Convert a supported static JavaScript Fetch call into a cURL command locally without evaluating JavaScript. |
| `graphql-formatter` | `codestation_graphql_formatter` | API | Pro | `node-pure` | Parse and format a supported executable GraphQL document locally without sending any operation. |
| `graphql-query-builder` | `codestation_graphql_query_builder` | API | Pro | `node-pure` | Build a local GraphQL query or mutation from its operation, typed arguments and selected fields without execution. |
| `graphql-variables-formatter` | `codestation_graphql_variables_formatter` | API | Pro | `node-pure` | Validate a GraphQL variables JSON object and pretty-print it locally without transmitting its values. |
| `http-header-builder` | `codestation_http_header_builder` | API | Pro | `node-pure` | Generate a raw HTTP header block and JavaScript headers object from ordered entries without transmitting them. |
| `http-header-parser` | `codestation_http_header_parser` | API | Pro | `node-pure` | Parse raw headers into ordered entries and a count, preserving duplicate headers and their original casing locally. |
| `http-request-builder` | `codestation_http_request_builder` | API | Pro | `node-pure` | Generate raw HTTP/1.0 or HTTP/1.1 request text with explicit headers and body without sending it. |
| `json-request-body-builder` | `codestation_json_request_body_builder` | API | Pro | `node-pure` | Build a formatted JSON object from ordered typed key/value fields locally, rejecting duplicate keys. |
| `rest-api-request-builder` | `codestation_rest_api_request_builder` | API | Pro | `node-pure` | Generate a request summary, cURL command and Fetch code from explicit REST request fields without sending them. |
| `html-to-jsx` | `codestation_html_to_jsx` | Code Generation | Pro | `node-pure` | HTML to JSX / TSX: html code input → react jsx with camelcase props and style objects. Process locally in your browser. |
| `json-to-go` | `codestation_json_to_go` | Code Generation | Pro | `node-pure` | JSON to Go Struct: json input, root name / interface → idiomatic go struct with json tags. Process locally in your browser. |
| `json-to-pydantic` | `codestation_json_to_pydantic` | Code Generation | Pro | `node-pure` | JSON to Python Pydantic: json input, root name / interface → python 3.10+ pydantic v2 basemodel classes. Process locally in your browser. |
| `json-to-rust` | `codestation_json_to_rust` | Code Generation | Pro | `node-pure` | JSON to Rust Serde: json input, root name / interface → rust struct with serde derive macros. Process locally in your browser. |
| `json-to-typescript` | `codestation_json_to_typescript` | Code Generation | Pro | `node-pure` | JSON to TypeScript: json input, root name / interface → typescript interface / type definitions. Process locally in your browser. |
| `json-to-zod` | `codestation_json_to_zod` | Code Generation | Pro | `node-pure` | JSON to Zod Schema: json input, root name / interface → zod schema with typescript type inference. Process locally in your browser. |
| `sql-to-typescript` | `codestation_sql_to_typescript` | Code Generation | Pro | `node-pure` | SQL DDL to TypeScript: sql ddl input (create table) → typescript interface corresponding to sql columns. Process locally in your browser. |
| `svg-to-jsx` | `codestation_svg_to_jsx` | Code Generation | Pro | `node-pure` | SVG to React Component: svg markup input, component name → clean typed react svg component. Process locally in your browser. |
| `border-radius-generator` | `codestation_border_radius_generator` | Color & CSS | Pro | `node-pure` | Border Radius Generator: mode, unit, radius values → css border-radius, live preview. Process locally in your browser. |
| `box-shadow-generator` | `codestation_box_shadow_generator` | Color & CSS | Pro | `node-pure` | Box Shadow Generator: shadow layers, preview background → css box-shadow, live preview. Process locally in your browser. |
| `color-converter` | `codestation_color_converter` | Color & CSS | Pro | `node-pure` | Color Converter: color, output format → detected source, converted color, preview. Process locally in your browser. |
| `contrast-checker` | `codestation_contrast_checker` | Color & CSS | Pro | `node-pure` | Contrast Checker: foreground color, background color, opaque backdrop → contrast ratio, normal text aa/aaa, large text aa/aaa, effective colors. Process locally in your browser. |
| `css-gradient-generator` | `codestation_css_gradient_generator` | Color & CSS | Pro | `node-pure` | CSS Gradient Generator: gradient type, linear angle, color stops → css gradient, live preview. Process locally in your browser. |
| `palette-generator` | `codestation_palette_generator` | Color & CSS | Pro | `node-pure` | Palette Generator: color, scheme → editable palette, css custom properties, json palette. Process locally in your browser. |
| `gzip-compress` | `codestation_gzip_compress` | Compression | Pro | `node-file` | Compress a local file with Node zlib gzip and write a .gz file cleanly without loading base64 blobs into context. |
| `gzip-compressor` | `codestation_gzip_compressor` | Compression | Pro | `node-pure` | Gzip / Deflate Compressor: text or binary input, compression algorithm, compression level → base64 compressed string, downloadable .gz file, compression ratio stats. Process locally in your browser. |
| `gzip-decompress` | `codestation_gzip_decompress` | Compression | Pro | `node-file` | Decompress a local .gz file via Node zlib and write the restored bytes to disk. |
| `gzip-decompressor` | `codestation_gzip_decompressor` | Compression | Pro | `node-pure` | Gzip / Deflate Decompressor: base64 string or compressed file, algorithm detection → decompressed text preview, decompressed binary download, size metrics. Process locally in your browser. |
| `zip-create` | `codestation_zip_create` | Compression | Pro | `node-file` | Bundle one or more local files (`inputPaths`) into a standard ZIP archive using pure-JS fflate. |
| `zip-creator` | `codestation_zip_creator` | Compression | Pro | `node-file` | ZIP Archive Creator: files to compress, compression level (0-9) → generated .zip archive, compression ratio stats, direct zip download. Process locally in your browser. |
| `zip-extract` | `codestation_zip_extract` | Compression | Pro | `node-file` | Extract files from a local .zip archive into a safe directory with path-traversal protection. |
| `zip-extractor` | `codestation_zip_extractor` | Compression | Pro | `node-file` | ZIP Extractor & Viewer: zip file → archive tree view, file preview, extracted files download. Process locally in your browser. |
| `zip-list` | `codestation_zip_list` | Compression | Pro | `node-file` | List entries, directories, and uncompressed sizes inside a local .zip file. |
| `number-base-converter` | `codestation_number_base_converter` | Converters | Pro | `node-pure` | Number Base Converter: number, from base, to base, use canonical output prefix → converted number. Process locally in your browser. |
| `temperature-converter` | `codestation_temperature_converter` | Converters | Pro | `node-pure` | Temperature Converter: temperature, from scale, to scale → converted temperature. Process locally in your browser. |
| `unit-converter` | `codestation_unit_converter` | Converters | Pro | `node-pure` | Unit Converter: category, value, from unit, to unit → converted value. Process locally in your browser. |
| `cron-explainer` | `codestation_cron_explainer` | Cron | Free | `node-pure` | Explain a cron expression with a field-by-field breakdown and a human-readable schedule in your browser. |
| `cron-generator` | `codestation_cron_generator` | Cron | Pro | `node-pure` | Build a cron expression from explicit second, minute, hour, day-of-month, month and weekday fields, with a readable schedule. |
| `cron-next-run` | `codestation_cron_next_run` | Cron | Pro | `node-pure` | Find the next cron occurrence after an explicit reference instant in a required IANA timezone and show the elapsed time until it. |
| `cron-to-human` | `codestation_cron_to_human` | Cron | Pro | `node-pure` | Translate a cron expression into a readable explanation with individual field interpretations, entirely in your browser. |
| `cron-validator` | `codestation_cron_validator` | Cron | Pro | `node-pure` | Validate cron field syntax and bounds locally and see a clear Valid or Invalid status with the error message. |
| `human-to-cron` | `codestation_human_to_cron` | Cron | Pro | `node-pure` | Convert supported human schedule descriptions to a five-field cron expression and inspect the parsed schedule locally. |
| `age-calculator` | `codestation_age_calculator` | Date & Time | Pro | `node-pure` | Calculate calendar age in years, months and days, plus total days, on an explicitly chosen target date. |
| `business-days-calculator` | `codestation_business_days_calculator` | Date & Time | Pro | `node-pure` | Count business days inclusively between two dates using your weekend definition and optional holiday list. |
| `current-time-in-timezone` | `codestation_current_time_in_timezone` | Date & Time | Pro | `node-pure` | Read a snapshot of your device’s current date, time and UTC offset in an IANA timezone. |
| `date-difference-calculator` | `codestation_date_difference_calculator` | Date & Time | Pro | `node-pure` | Compare two explicit local dates and times as a calendar difference and elapsed days, hours, minutes and seconds. |
| `date-format-converter` | `codestation_date_format_converter` | Date & Time | Pro | `node-pure` | Convert a calendar date between six explicit numeric formats without guessing its locale or timezone. |
| `date-to-timestamp` | `codestation_date_to_timestamp` | Date & Time | Pro | `node-pure` | Convert a calendar date and clock time in an explicit IANA timezone to Unix seconds and milliseconds. |
| `epoch-converter` | `codestation_epoch_converter` | Date & Time | Pro | `node-pure` | Convert a Unix epoch value in explicit seconds or milliseconds to readable UTC and browser-local dates. |
| `iso-8601-converter` | `codestation_iso_8601_converter` | Date & Time | Pro | `node-pure` | Normalize an offset-bearing ISO 8601 date/time and view its UTC and browser-local equivalents. |
| `leap-year-checker` | `codestation_leap_year_checker` | Date & Time | Pro | `node-pure` | Check whether a year is a Gregorian leap year and see the divisibility rule that explains the result. |
| `relative-time-generator` | `codestation_relative_time_generator` | Date & Time | Pro | `node-pure` | Describe a target date/time relative to a chosen reference and inspect the exact elapsed difference. |
| `time-difference-calculator` | `codestation_time_difference_calculator` | Date & Time | Pro | `node-pure` | Calculate the difference between two clock times, optionally anchored to a pair of local calendar dates. |
| `timestamp-to-date` | `codestation_timestamp_to_date` | Date & Time | Pro | `node-pure` | Convert a Unix timestamp with explicit units to a date/time in your chosen IANA timezone. |
| `timezone-converter` | `codestation_timezone_converter` | Date & Time | Pro | `node-pure` | Convert a chosen date and time between two IANA timezones, including their UTC offsets. |
| `unix-milliseconds-converter` | `codestation_unix_milliseconds_converter` | Date & Time | Pro | `node-pure` | Convert an explicitly millisecond Unix timestamp into readable UTC and browser-local dates. |
| `unix-timestamp-converter` | `codestation_unix_timestamp_converter` | Date & Time | Free | `node-pure` | Convert Unix seconds or milliseconds into readable dates, ISO 8601, UTC and browser-local time. |
| `unix-timestamp-generator` | `codestation_unix_timestamp_generator` | Date & Time | Pro | `node-pure` | Generate Unix seconds and milliseconds from a chosen date, time and IANA timezone. |
| `week-number-calculator` | `codestation_week_number_calculator` | Date & Time | Pro | `node-pure` | Find a calendar date’s week number, week year and weekday using ISO 8601 or Sunday-start weeks. |
| `bigint-calculator` | `codestation_bigint_calculator` | Developer Math | Pro | `node-pure` | BigInt Arithmetic Calculator: operand a, operation, operand b, modulus (for modexp) → exact integer result, bit length, decimal digit count. Process locally in your browser. |
| `bitwise-calculator` | `codestation_bitwise_calculator` | Developer Math | Pro | `node-pure` | Bitwise Operator Playground: operand a, operand b, bit width → and, or, xor, not a, left shift, right shift, unsigned shift, hex / bin / oct representation. Process locally in your browser. |
| `fraction-converter` | `codestation_fraction_converter` | Developer Math | Pro | `node-pure` | Fraction ⇄ Decimal Converter: decimal or fraction (e.g. 0.75 or 7/4) → irreducible fraction, mixed number, decimal expansion, reciprocal fraction. Process locally in your browser. |
| `gcd-lcm-calculator` | `codestation_gcd_lcm_calculator` | Developer Math | Pro | `node-pure` | Prime Factorization & GCD / LCM: first integer, second integer → gcd (greatest common divisor), lcm (least common multiple), prime factorization of a, prime factorization of b. Process locally in your browser. |
| `ieee754-converter` | `codestation_ieee754_converter` | Developer Math | Pro | `node-pure` | IEEE-754 Floating Point Inspector: decimal float value, precision → sign bit, exponent bits, mantissa / fraction bits, unbiased exponent, hexadecimal representation. Process locally in your browser. |
| `matrix-calculator` | `codestation_matrix_calculator` | Developer Math | Pro | `node-pure` | Matrix Operations Calculator: matrix operation, matrix a (csv / spaces), matrix b (csv / spaces) → resulting matrix, determinant value, dimension validation. Process locally in your browser. |
| `twos-complement` | `codestation_twos_complement` | Developer Math | Pro | `node-pure` | Two's Complement Calculator: integer value, bit width → signed value, unsigned value, binary bit pattern, hexadecimal, valid signed range. Process locally in your browser. |
| `ascii-to-text` | `codestation_ascii_to_text` | Encoding | Pro | `node-pure` | Convert decimal ASCII codes into text without accepting non-ASCII values. |
| `base32-decoder` | `codestation_base32_decoder` | Encoding | Pro | `node-pure` | Decode RFC 4648 Base32 data into UTF-8 text. |
| `base32-encoder` | `codestation_base32_encoder` | Encoding | Pro | `node-pure` | Encode UTF-8 text using the RFC 4648 Base32 alphabet. |
| `base58-decoder` | `codestation_base58_decoder` | Encoding | Pro | `node-pure` | Decode Bitcoin-alphabet Base58 into UTF-8 text. |
| `base58-encoder` | `codestation_base58_encoder` | Encoding | Pro | `node-pure` | Encode UTF-8 text with the Bitcoin Base58 alphabet. |
| `base64-decoder` | `codestation_base64_decoder` | Encoding | Free | `node-pure` | Decode standard Base64 into UTF-8 text with malformed-input checks. |
| `base64-encoder` | `codestation_base64_encoder` | Encoding | Free | `node-pure` | Encode UTF-8 text as standard RFC 4648 Base64 locally. |
| `base64-url-decoder` | `codestation_base64_url_decoder` | Encoding | Pro | `node-pure` | Decode URL-safe Base64 into UTF-8 text locally. |
| `base64-url-encoder` | `codestation_base64_url_encoder` | Encoding | Pro | `node-pure` | Encode UTF-8 text as URL-safe Base64 without padding. |
| `binary-decoder` | `codestation_binary_decoder` | Encoding | Pro | `node-pure` | Decode eight-bit binary byte groups into UTF-8 text. |
| `binary-encoder` | `codestation_binary_encoder` | Encoding | Pro | `node-pure` | Encode UTF-8 text as eight-bit binary byte groups. |
| `data-uri-decoder` | `codestation_data_uri_decoder` | Encoding | Pro | `node-pure` | Inspect a data URI’s MIME type, encoding mode, and decoded text. |
| `data-uri-encoder` | `codestation_data_uri_encoder` | Encoding | Pro | `node-pure` | Package text and its MIME type into a percent-encoded UTF-8 data URI. |
| `hex-to-text` | `codestation_hex_to_text` | Encoding | Pro | `node-pure` | Read hexadecimal byte values as UTF-8 text. |
| `hexadecimal-decoder` | `codestation_hexadecimal_decoder` | Encoding | Pro | `node-pure` | Decode a base-16 byte sequence into UTF-8 text. |
| `hexadecimal-encoder` | `codestation_hexadecimal_encoder` | Encoding | Pro | `node-pure` | Encode text in base 16 using its UTF-8 byte sequence. |
| `html-decoder` | `codestation_html_decoder` | Encoding | Pro | `node-pure` | Decode HTML character references into plain, selectable text. |
| `html-encoder` | `codestation_html_encoder` | Encoding | Pro | `node-pure` | Escape HTML-significant text characters into HTML character references. |
| `html-entity-decoder` | `codestation_html_entity_decoder` | Encoding | Pro | `node-pure` | Resolve HTML5 named and numeric entities into readable text. |
| `html-entity-encoder` | `codestation_html_entity_encoder` | Encoding | Pro | `node-pure` | Convert text into HTML entities for inspecting character-reference notation. |
| `jwt-decoder` | `codestation_jwt_decoder` | Encoding | Free | `node-pure` | Inspect a JWT header, payload, and signature segment locally without verifying the token. |
| `octal-to-text` | `codestation_octal_to_text` | Encoding | Pro | `node-pure` | Decode octal byte values into their UTF-8 text representation. |
| `punycode-decoder` | `codestation_punycode_decoder` | Encoding | Pro | `node-pure` | Decode ASCII IDNA domain labels into a Unicode domain name. |
| `punycode-encoder` | `codestation_punycode_encoder` | Encoding | Pro | `node-pure` | Convert an internationalized domain name to its ASCII IDNA form. |
| `text-to-ascii` | `codestation_text_to_ascii` | Encoding | Pro | `node-pure` | Convert ASCII characters into decimal codes from 0 to 127. |
| `text-to-hex` | `codestation_text_to_hex` | Encoding | Pro | `node-pure` | Convert text into hexadecimal representations of its UTF-8 bytes. |
| `text-to-octal` | `codestation_text_to_octal` | Encoding | Pro | `node-pure` | Represent each UTF-8 text byte as a three-digit octal value. |
| `text-to-unicode` | `codestation_text_to_unicode` | Encoding | Pro | `node-pure` | Represent text as Unicode scalar code points in U+ notation. |
| `unicode-escape-decoder` | `codestation_unicode_escape_decoder` | Encoding | Pro | `node-pure` | Decode Unicode escape notation without executing JavaScript. |
| `unicode-escape-encoder` | `codestation_unicode_escape_encoder` | Encoding | Pro | `node-pure` | Encode non-ASCII and control characters as UTF-16 Unicode escape sequences. |
| `unicode-to-text` | `codestation_unicode_to_text` | Encoding | Pro | `node-pure` | Convert U+ Unicode code points into their corresponding text characters. |
| `url-component-decoder` | `codestation_url_component_decoder` | Encoding | Pro | `node-pure` | Decode percent escapes in an individual URL component into text. |
| `url-component-encoder` | `codestation_url_component_encoder` | Encoding | Pro | `node-pure` | Percent-encode a single URL component, including reserved URL delimiters. |
| `url-decoder` | `codestation_url_decoder` | Encoding | Free | `node-pure` | Decode URL escapes while retaining escapes for reserved URI delimiters. |
| `url-encoder` | `codestation_url_encoder` | Encoding | Free | `node-pure` | Encode a complete URL while preserving its reserved URI delimiters. |
| `emi-calculator` | `codestation_emi_calculator` | Finance & Calculators | Pro | `node-pure` | Calculate the reducing-balance EMI for a loan from principal, annual rate, and tenure, with a month-by-month amortization schedule that never leaves your browser. |
| `gst-calculator` | `codestation_gst_calculator` | Finance & Calculators | Pro | `node-pure` | Split exclusive or inclusive GST into taxable value, CGST, SGST, or IGST for Indian invoices, calculated locally in your browser. |
| `loan-prepayment-calculator` | `codestation_loan_prepayment_calculator` | Finance & Calculators | Pro | `node-pure` | Compare a loan's remaining schedule with one-time and recurring extra payments, reducing either tenure or EMI entirely in your browser. |
| `sip-calculator` | `codestation_sip_calculator` | Finance & Calculators | Pro | `node-pure` | Project a monthly SIP with optional annual step-up and inflation adjustment, compounding entirely in your browser. |
| `css-grid-generator` | `codestation_css_grid_generator` | Frontend & CSS | Pro | `node-pure` | CSS Grid Visual Generator: grid columns (e.g. 1fr 2fr 1fr), grid rows (e.g. auto 1fr auto), grid gap (px) → css grid rules, html structure, interactive grid preview. Process locally in your browser. |
| `glassmorphism-generator` | `codestation_glassmorphism_generator` | Frontend & CSS | Pro | `node-pure` | Glassmorphism & Neumorphism Generator: backdrop blur (px), transparency (alpha), border radius (px) → css backdrop-filter, background rgba, specular border, live preview. Process locally in your browser. |
| `changelog-generator` | `codestation_changelog_generator` | Git & Version Control | Pro | `node-pure` | Git Changelog Generator: pasted git log output → grouped markdown changelog, breaking changes section, commit and breaking-change counts. Process locally in your browser. |
| `conflict-parse` | `codestation_conflict_parse` | Git & Version Control | Pro | `node-pure` | Git Merge Conflict Resolver: file with merge conflict markers, resolution strategy → conflict hunk analysis, resolved content, unresolved status. Process locally in your browser. |
| `conventional-commit-builder` | `codestation_conventional_commit_builder` | Git & Version Control | Pro | `node-pure` | Conventional Commit Builder: commit type, scope (optional), short description, body (optional), footer (optional), breaking change, breaking change note (optional) → formatted conventional commit message, review hints. Process locally in your browser. |
| `conventional-commit-validator` | `codestation_conventional_commit_validator` | Git & Version Control | Pro | `node-pure` | Conventional Commit Validator: commit message → parsed type, scope and description, breaking change state, footer, validation errors. Process locally in your browser. |
| `git-command-explainer` | `codestation_git_command_explainer` | Git & Version Control | Pro | `node-pure` | Git Command Explainer: git command → command summary, subcommand and flags, destructive-risk notes. Process locally in your browser. |
| `git-hooks-generator` | `codestation_git_hooks_generator` | Git & Version Control | Pro | `node-pure` | Git Hooks Generator: hook type, commands (one per line), stop on first failure → shell hook script, install instructions. Process locally in your browser. |
| `gitattributes-generator` | `codestation_gitattributes_generator` | Git & Version Control | Pro | `node-pure` | Git Attributes Generator: line-ending policy, binary globs, linguist globs, linguist flag, export-ignore patterns → .gitattributes content, binary and linguist rules, export-ignore rules. Process locally in your browser. |
| `image-dimension-inspector` | `codestation_image_dimension_inspector` | Image | Pro | `node-file` | Image Dimension Inspector: image file → width, height, aspect ratio, megapixels. Process locally in your browser. |
| `image-inspect` | `codestation_image_inspect` | Image | Pro | `node-file` | Inspect PNG, JPEG, WebP, GIF, BMP, AVIF, or SVG image files for dimensions, MIME format, and JPEG EXIF metadata in pure JS. |
| `image-metadata-viewer` | `codestation_image_metadata_viewer` | Image | Pro | `node-file` | Image Metadata Viewer: image file → file name, mime type, file size, width, height, available image metadata. Process locally in your browser. |
| `svg-formatter` | `codestation_svg_formatter` | Image | Pro | `node-pure` | SVG Formatter: svg text → formatted svg. Process locally in your browser. |
| `svg-minifier` | `codestation_svg_minifier` | Image | Pro | `node-pure` | SVG Minifier: svg text → minified svg. Process locally in your browser. |
| `svg-resize` | `codestation_svg_resize` | Image | Pro | `node-file` | Safely resize width/height attributes of a static SVG file in pure JS (via saxes) with zero native addons. |
| `csv-cleaner` | `codestation_csv_cleaner` | JSON & Data | Pro | `node-pure` | Trim cell edges and remove empty CSV rows while preserving meaningful content. |
| `csv-column-analyzer` | `codestation_csv_column_analyzer` | JSON & Data | Pro | `node-pure` | Inspect empty, unique, and inferred value types in one CSV column. |
| `csv-column-reorderer` | `codestation_csv_column_reorderer` | JSON & Data | Pro | `node-pure` | Reorder CSV columns using an explicit list of header names. |
| `csv-data-deduplicator` | `codestation_csv_data_deduplicator` | JSON & Data | Pro | `node-pure` | Remove duplicate CSV rows while preserving the first occurrence. |
| `csv-delimiter-detector` | `codestation_csv_delimiter_detector` | JSON & Data | Pro | `node-pure` | Compare comma, tab, semicolon, and pipe separators in tabular text. |
| `csv-formatter` | `codestation_csv_formatter` | JSON & Data | Pro | `node-pure` | Normalize CSV quoting and record separators. |
| `csv-row-filter` | `codestation_csv_row_filter` | JSON & Data | Pro | `node-pure` | Keep CSV rows matching a text or numeric column comparison. |
| `csv-to-html-table` | `codestation_csv_to_html_table` | JSON & Data | Pro | `node-pure` | Generate escaped HTML table source from CSV records. |
| `csv-to-json` | `codestation_csv_to_json` | JSON & Data | Pro | `node-pure` | Convert CSV headers and rows into a JSON array of records. |
| `csv-to-markdown` | `codestation_csv_to_markdown` | JSON & Data | Pro | `node-pure` | Convert CSV into a Markdown table with escaped cell content. |
| `csv-to-tsv` | `codestation_csv_to_tsv` | JSON & Data | Pro | `node-pure` | Convert comma-separated records into tab-separated values. |
| `csv-transposer` | `codestation_csv_transposer` | JSON & Data | Pro | `node-pure` | Swap CSV rows and columns, including the header row. |
| `csv-validator` | `codestation_csv_validator` | JSON & Data | Pro | `node-pure` | Check CSV quoting and consistent row widths. |
| `json-array-to-object` | `codestation_json_array_to_object` | JSON & Data | Pro | `node-pure` | Index JSON records by a chosen unique property. |
| `json-diff` | `codestation_json_diff` | JSON & Data | Pro | `node-pure` | Compare two JSON documents by structure and changed values. |
| `json-escape` | `codestation_json_escape` | JSON & Data | Pro | `node-pure` | Encode text as a quoted JSON string literal. |
| `json-formatter` | `codestation_json_formatter` | JSON & Data | Free | `node-pure` | Format JSON with readable two-space indentation in your browser. |
| `json-key-sorter` | `codestation_json_key_sorter` | JSON & Data | Pro | `node-pure` | Sort object keys recursively while retaining array order. |
| `json-lines-formatter` | `codestation_json_lines_formatter` | JSON & Data | Pro | `node-pure` | Normalize each JSON Lines record to one compact JSON value per line. |
| `json-lines-to-json` | `codestation_json_lines_to_json` | JSON & Data | Pro | `node-pure` | Collect JSON Lines records into a JSON array. |
| `json-lines-validator` | `codestation_json_lines_validator` | JSON & Data | Pro | `node-pure` | Validate newline-delimited JSON and identify invalid record lines. |
| `json-minifier` | `codestation_json_minifier` | JSON & Data | Free | `node-pure` | Remove insignificant JSON whitespace without changing its structure. |
| `json-object-to-array` | `codestation_json_object_to_array` | JSON & Data | Pro | `node-pure` | Convert object entries into an array of key/value records. |
| `json-schema-generator` | `codestation_json_schema_generator` | JSON & Data | Pro | `node-pure` | Infer a starting JSON Schema from a representative JSON sample. |
| `json-schema-validator` | `codestation_json_schema_validator` | JSON & Data | Pro | `node-pure` | Validate JSON data against a supplied local JSON Schema. |
| `json-statistics-analyzer` | `codestation_json_statistics_analyzer` | JSON & Data | Pro | `node-pure` | Count JSON nodes, types, keys, and nesting depth. |
| `json-structure-inspector` | `codestation_json_structure_inspector` | JSON & Data | Pro | `node-pure` | Inspect JSON paths and types without displaying scalar values. |
| `json-to-csv` | `codestation_json_to_csv` | JSON & Data | Pro | `node-pure` | Convert a JSON array of records into quoted CSV text. |
| `json-to-json-lines` | `codestation_json_to_json_lines` | JSON & Data | Pro | `node-pure` | Write a JSON array as one JSON value per line. |
| `json-to-toml` | `codestation_json_to_toml` | JSON & Data | Pro | `node-pure` | Serialize a compatible JSON configuration object as TOML. |
| `json-to-xml` | `codestation_json_to_xml` | JSON & Data | Pro | `node-pure` | Convert JSON into XML using a fixed root element. |
| `json-to-yaml` | `codestation_json_to_yaml` | JSON & Data | Pro | `node-pure` | Convert JSON into readable YAML locally. |
| `json-tree-viewer` | `codestation_json_tree_viewer` | JSON & Data | Pro | `node-pure` | Explore JSON keys, array indexes, types, and values in an expandable tree. |
| `json-unescape` | `codestation_json_unescape` | JSON & Data | Pro | `node-pure` | Decode a quoted JSON string literal into plain text. |
| `json-validator` | `codestation_json_validator` | JSON & Data | Free | `node-pure` | Check JSON syntax and locate invalid input locally. |
| `jsonpath-tester` | `codestation_jsonpath_tester` | JSON & Data | Pro | `node-pure` | Select matching JSON values with a local, non-executing JSONPath expression. |
| `mock-data` | `codestation_mock_data` | JSON & Data | Pro | `node-pure` | Realistic Mock Data & SQL Seeder: dataset template, record count, output format, deterministic seed → generated dataset, sql insert statements, csv export. Process locally in your browser. |
| `toml-to-json` | `codestation_toml_to_json` | JSON & Data | Pro | `node-pure` | Parse TOML configuration into structured JSON. |
| `tsv-to-csv` | `codestation_tsv_to_csv` | JSON & Data | Pro | `node-pure` | Convert tab-separated records into quoted CSV. |
| `xml-formatter` | `codestation_xml_formatter` | JSON & Data | Pro | `node-pure` | Format XML structure while preserving significant text content. |
| `xml-minifier` | `codestation_xml_minifier` | JSON & Data | Pro | `node-pure` | Remove formatting whitespace from XML while preserving significant text. |
| `xml-to-json` | `codestation_xml_to_json` | JSON & Data | Pro | `node-pure` | Parse XML elements and attributes into JSON locally. |
| `xml-validator` | `codestation_xml_validator` | JSON & Data | Pro | `node-pure` | Check XML well-formedness with a local XML parser. |
| `yaml-diff` | `codestation_yaml_diff` | JSON & Data | Pro | `node-pure` | Compare two YAML documents as structured data. |
| `yaml-formatter` | `codestation_yaml_formatter` | JSON & Data | Pro | `node-pure` | Parse and normalize a YAML document with readable indentation. |
| `yaml-to-json` | `codestation_yaml_to_json` | JSON & Data | Pro | `node-pure` | Convert a YAML document into JSON-compatible data. |
| `yaml-validator` | `codestation_yaml_validator` | JSON & Data | Pro | `node-pure` | Check YAML syntax locally and report parser errors. |
| `csv-to-markdown-table` | `codestation_csv_to_markdown_table` | Markdown | Pro | `node-pure` | CSV to Markdown Table: csv text → markdown table. Process locally in your browser. |
| `html-to-markdown` | `codestation_html_to_markdown` | Markdown | Pro | `node-pure` | HTML to Markdown: html text → markdown. Process locally in your browser. |
| `markdown-blockquote-generator` | `codestation_markdown_blockquote_generator` | Markdown | Pro | `node-pure` | Markdown Blockquote Generator: text → markdown blockquote. Process locally in your browser. |
| `markdown-code-block-generator` | `codestation_markdown_code_block_generator` | Markdown | Pro | `node-pure` | Markdown Code Block Generator: code, language → fenced markdown code block. Process locally in your browser. |
| `markdown-escape` | `codestation_markdown_escape` | Markdown | Pro | `node-pure` | Markdown Escaper: plain text → markdown-escaped text. Process locally in your browser. |
| `markdown-formatter` | `codestation_markdown_formatter` | Markdown | Pro | `node-pure` | Markdown Formatter: markdown text → formatted markdown. Process locally in your browser. |
| `markdown-frontmatter-parser` | `codestation_markdown_frontmatter_parser` | Markdown | Pro | `node-pure` | Markdown Frontmatter Parser: markdown text → parsed frontmatter, markdown body. Process locally in your browser. |
| `markdown-heading-analyzer` | `codestation_markdown_heading_analyzer` | Markdown | Pro | `node-pure` | Markdown Heading Analyzer: markdown text → heading hierarchy, heading count, heading-level warnings. Process locally in your browser. |
| `markdown-image-extractor` | `codestation_markdown_image_extractor` | Markdown | Pro | `node-pure` | Markdown Image Extractor: markdown text → alt text, image url, title, image count. Process locally in your browser. |
| `markdown-link-extractor` | `codestation_markdown_link_extractor` | Markdown | Pro | `node-pure` | Markdown Link Extractor: markdown text → link text, url, link count. Process locally in your browser. |
| `markdown-list-generator` | `codestation_markdown_list_generator` | Markdown | Pro | `node-pure` | Markdown List Generator: list items, list type → markdown list. Process locally in your browser. |
| `markdown-preview` | `codestation_markdown_preview` | Markdown | Pro | `node-pure` | Markdown Preview: markdown text → rendered preview. Process locally in your browser. |
| `markdown-statistics` | `codestation_markdown_statistics` | Markdown | Pro | `node-pure` | Markdown Statistics: markdown text → character count, word count, line count, heading count, link count, image count, code block count, list item count. Process locally in your browser. |
| `markdown-table-generator` | `codestation_markdown_table_generator` | Markdown | Pro | `node-pure` | Markdown Table Generator: column names, rows, alignment → markdown table. Process locally in your browser. |
| `markdown-task-list-generator` | `codestation_markdown_task_list_generator` | Markdown | Pro | `node-pure` | Markdown Task List Generator: task items → markdown checklist. Process locally in your browser. |
| `markdown-to-html` | `codestation_markdown_to_html` | Markdown | Free | `node-pure` | Markdown to HTML: markdown text → sanitized html source. Process locally in your browser. |
| `markdown-to-text` | `codestation_markdown_to_text` | Markdown | Pro | `node-pure` | Markdown to Plain Text: markdown text → plain text. Process locally in your browser. |
| `markdown-toc-generator` | `codestation_markdown_toc_generator` | Markdown | Pro | `node-pure` | Markdown TOC Generator: markdown text, minimum heading level, maximum heading level → markdown table of contents, heading hierarchy. Process locally in your browser. |
| `cert-inspector` | `codestation_cert_inspector` | Network & DevOps | Pro | `node-pure` | SSL / TLS Certificate Inspector: x.509 pem certificate → subject common name, issuer, validity period, days until expiry, subject alt names. Process locally in your browser. |
| `cidr-calculator` | `codestation_cidr_calculator` | Network & DevOps | Pro | `node-pure` | CIDR Subnet Calculator: ip & cidr (e.g. 192.168.1.0/24) → subnet mask, usable ip range, broadcast address, total hosts, binary representation. Process locally in your browser. |
| `docker-run-to-compose` | `codestation_docker_run_to_compose` | Network & DevOps | Pro | `node-pure` | Docker Run to Compose: docker run command → valid docker-compose.yml file. Process locally in your browser. |
| `dockerfile-generator` | `codestation_dockerfile_generator` | Network & DevOps | Pro | `node-pure` | Dockerfile Generator: runtime / framework, version tag, exposed port → production-hardened multi-stage dockerfile. Process locally in your browser. |
| `gitignore-generator` | `codestation_gitignore_generator` | Network & DevOps | Pro | `node-pure` | .gitignore Generator: select presets → consolidated .gitignore rules. Process locally in your browser. |
| `ipv4-to-ipv6` | `codestation_ipv4_to_ipv6` | Network & DevOps | Pro | `node-pure` | IPv4 ⇄ IPv6 Converter: ip address (ipv4 or ipv6) → ipv4-mapped address, 6to4 notation, expanded notation, compressed notation, reverse dns pointer. Process locally in your browser. |
| `port-reference` | `codestation_port_reference` | Network & DevOps | Pro | `node-pure` | Common Ports Reference Directory: port or service search → port number, protocol, service name, category, description. Process locally in your browser. |
| `semver-calculator` | `codestation_semver_calculator` | Network & DevOps | Pro | `node-pure` | SemVer Calculator & Comparator: semver version (e.g. 1.2.3), comparison version (optional) → parsed semver parts, next major, next minor, next patch, comparison result. Process locally in your browser. |
| `pdf-compressor` | `codestation_pdf_compressor` | PDF | Pro | `node-file` | Compress and reduce PDF file size directly in your browser with selectable DPI presets (72, 150, 300 DPI), real-time savings calculation, and zero server uploads. |
| `pdf-inspect` | `codestation_pdf_inspect` | PDF | Pro | `node-file` | Inspect a local PDF file for page count, title, author, producer, and creation/modification dates using pdf-lib. |
| `pdf-merge` | `codestation_pdf_merge` | PDF | Pro | `node-file` | PDF Merge: pdf files to merge → merged pdf file, total pages, file size. Process locally in your browser. |
| `pdf-page-deleter` | `codestation_pdf_page_deleter` | PDF | Pro | `node-file` | PDF Page Deleter: pdf file, pages to delete (e.g. 2, 4) → cleaned pdf file, remaining page count. Process locally in your browser. |
| `pdf-page-numberer` | `codestation_pdf_page_numberer` | PDF | Pro | `node-file` | PDF Page Numberer: pdf file, numbering format, vertical position, alignment, font family, font size (pt), margin from edge (pt), start numbering from, page range → numbered pdf file, live preview, download pdf. Process locally in your browser. |
| `pdf-rotate` | `codestation_pdf_rotate` | PDF | Pro | `node-file` | PDF Rotator: pdf file, rotation angle, page range → rotated pdf file. Process locally in your browser. |
| `pdf-split` | `codestation_pdf_split` | PDF | Pro | `node-file` | PDF Split & Page Extractor: pdf file, page range → extracted pdf file, page count. Process locally in your browser. |
| `pdf-watermark` | `codestation_pdf_watermark` | PDF | Pro | `node-file` | PDF Watermark: pdf file, watermark type, watermark text, font size, opacity (%), rotation angle, position → watermarked pdf file, live preview, download pdf. Process locally in your browser. |
| `cookie-policy-generator` | `codestation_cookie_policy_generator` | Policy Generators | Pro | `node-pure` | Cookie Policy Generator: company or entity name, website url, privacy email, effective date (yyyy-mm-dd), industry preset, default export format → formatted cookie policy, cookie inventory table, markdown (.md) export, html (.html) export, plain text (.txt) export. Process locally in your browser. |
| `disclaimer-generator` | `codestation_disclaimer_generator` | Policy Generators | Pro | `node-pure` | Legal & Professional Disclaimer Generator: company or entity name, website url, contact email, effective date (yyyy-mm-dd), industry preset, default export format → formatted disclaimer, markdown (.md) export, html (.html) export, plain text (.txt) export, structured json ast. Process locally in your browser. |
| `privacy-policy-generator` | `codestation_privacy_policy_generator` | Policy Generators | Pro | `node-pure` | Privacy Policy Generator: company or project name, website url, contact / privacy email, effective date (yyyy-mm-dd), governing country, state or province, industry preset, default export format → formatted privacy policy, markdown (.md) export, html (.html) export, plain text (.txt) export, structured json ast. Process locally in your browser. |
| `refund-policy-generator` | `codestation_refund_policy_generator` | Policy Generators | Pro | `node-pure` | Refund & Cancellation Policy Generator: company or merchant name, store or service url, returns / support email, effective date (yyyy-mm-dd), industry preset, default export format → formatted refund policy, markdown (.md) export, html (.html) export, plain text (.txt) export, structured json ast. Process locally in your browser. |
| `terms-and-conditions-generator` | `codestation_terms_and_conditions_generator` | Policy Generators | Pro | `node-pure` | Terms and Conditions Generator: company or entity name, website / service url, support / legal email, effective date (yyyy-mm-dd), governing jurisdiction (country), industry preset, default export format → formatted terms & conditions, markdown (.md) export, html (.html) export, plain text (.txt) export, structured json ast. Process locally in your browser. |
| `invoice-generator` | `codestation_invoice_generator` | Productivity | Pro | `node-pure` | Create professional single or bulk invoices in your browser with logo upload, line-item calculations, customizable taxes and discounts, and vector PDF or ZIP download. |
| `qr-code-generator` | `codestation_qr_code_generator` | QR & Barcode | Pro | `node-pure` | QR Code Generator: payload type, content / url, error correction → qr code preview, svg download, png download. Process locally in your browser. |
| `regex-capture-group-tester` | `codestation_regex_capture_group_tester` | Regex | Pro | `node-pure` | Inspect JavaScript regex capture definitions, non-capturing groups and lookarounds alongside per-match capture values. |
| `regex-escape` | `codestation_regex_escape` | Regex | Pro | `node-pure` | Escape plain text for literal matching in a JavaScript regular expression, entirely in your browser. |
| `regex-flag-tester` | `codestation_regex_flag_tester` | Regex | Pro | `node-pure` | Compare a JavaScript regex independently with no flags and each of g, i, m, s, u, y and d, including browser support errors. |
| `regex-group-extractor` | `codestation_regex_group_extractor` | Regex | Pro | `node-pure` | Extract numbered and named JavaScript regex capture values per match, keeping empty and unmatched groups distinct. |
| `regex-match-inspector` | `codestation_regex_match_inspector` | Regex | Pro | `node-pure` | Inspect each JavaScript regex match with numbered cards, exact text, start and end offsets, length and groups. |
| `regex-pattern-builder` | `codestation_regex_pattern_builder` | Regex | Pro | `node-pure` | Build JavaScript regex source from literal text or a character mode and quantifier, with clear case-insensitive usage guidance. |
| `regex-replace-tester` | `codestation_regex_replace_tester` | Regex | Pro | `node-pure` | Preview JavaScript regex replacements locally, including replacement tokens and the number of replacements. |
| `regex-split-tester` | `codestation_regex_split_tester` | Regex | Pro | `node-pure` | Split text with a JavaScript regex separator and inspect numbered parts, including captured separators, empty values and unmatched captures. |
| `regex-tester` | `codestation_regex_tester` | Regex | Free | `node-pure` | Test a JavaScript regular expression locally and see match status, counts, text, positions and capture groups. |
| `checksum-generator` | `codestation_checksum_generator` | Security | Pro | `node-pure` | Calculate a text checksum using MD5, SHA-1, SHA-256, SHA-384, SHA-512 or CRC32. |
| `crc32-generator` | `codestation_crc32_generator` | Security | Pro | `node-pure` | Compute the CRC32 hexadecimal checksum of UTF-8 text locally. |
| `entropy-calculator` | `codestation_entropy_calculator` | Security | Pro | `node-pure` | Estimate text entropy in bits using input length and a character-set model, entirely in your browser. |
| `env-audit` | `codestation_env_audit` | Security | Pro | `node-pure` | Environment & Secret Leak Scanner: .env content, .env.example content → security report, detected secret leaks, discrepancy diff. Process locally in your browser. |
| `file-hash-generator` | `codestation_file_hash_generator` | Security | Pro | `node-file` | Hash one browser-local file up to 64 MiB using SHA-1, SHA-256, SHA-384 or SHA-512. |
| `hash-compare` | `codestation_hash_compare` | Security | Pro | `node-pure` | Compare two hash strings locally after trimming leading and trailing whitespace, with case-sensitive equality. |
| `hex-random-generator` | `codestation_hex_random_generator` | Security | Pro | `node-pure` | Generate 1 to 256 secure random bytes as hexadecimal text. |
| `hmac-generator` | `codestation_hmac_generator` | Security | Pro | `node-pure` | Create a keyed HMAC-SHA-256, HMAC-SHA-384 or HMAC-SHA-512 authentication code from UTF-8 text locally. |
| `md5-generator` | `codestation_md5_generator` | Security | Pro | `node-pure` | Compute a MD5 hexadecimal digest of UTF-8 text locally for legacy compatibility. |
| `nanoid-generator` | `codestation_nanoid_generator` | Security | Pro | `node-pure` | Generate a compact random identifier using the URL-safe NanoID alphabet. |
| `password-generator` | `codestation_password_generator` | Security | Pro | `node-pure` | Generate a random password locally from the selected character groups. |
| `password-strength-checker` | `codestation_password_strength_checker` | Security | Pro | `node-pure` | Estimate password strength with a local heuristic and show a score, label and practical feedback. |
| `random-number-generator` | `codestation_random_number_generator` | Security | Pro | `node-pure` | Generate secure random integers within inclusive minimum and maximum bounds. |
| `random-string-generator` | `codestation_random_string_generator` | Security | Pro | `node-pure` | Generate a secure random string using one of five predefined character sets. |
| `secret-key-generator` | `codestation_secret_key_generator` | Security | Pro | `node-pure` | Generate a random 128-bit, 192-bit or 256-bit secret key and display its hexadecimal value and size. |
| `secure-token-generator` | `codestation_secure_token_generator` | Security | Pro | `node-pure` | Generate 8 to 256 secure random bytes encoded as hexadecimal or unpadded Base64URL. |
| `sha-1-generator` | `codestation_sha_1_generator` | Security | Pro | `node-pure` | Compute a SHA-1 hexadecimal digest of UTF-8 text locally for legacy compatibility. |
| `sha-256-generator` | `codestation_sha_256_generator` | Security | Free | `node-pure` | Compute a SHA-256 hexadecimal digest of UTF-8 text locally. |
| `sha-384-generator` | `codestation_sha_384_generator` | Security | Pro | `node-pure` | Compute a SHA-384 hexadecimal digest of UTF-8 text locally. |
| `sha-512-generator` | `codestation_sha_512_generator` | Security | Pro | `node-pure` | Compute a SHA-512 hexadecimal digest of UTF-8 text locally. |
| `ulid-generator` | `codestation_ulid_generator` | Security | Pro | `node-pure` | Generate one 26-character ULID using the device timestamp and cryptographically secure randomness. |
| `uuid-generator` | `codestation_uuid_generator` | Security | Free | `node-pure` | Generate one RFC 9562 UUID using version 4 randomness or version 7 time ordering. |
| `uuid-parser` | `codestation_uuid_parser` | Security | Pro | `node-pure` | Inspect a UUID's version, variant, normalized value and structural validity locally. |
| `csv-to-excel` | `codestation_csv_to_excel` | Spreadsheet | Pro | `node-file` | CSV to Excel: csv text, csv file, sheet name → xlsx file, row count, column count. Process locally in your browser. |
| `excel-to-csv` | `codestation_excel_to_csv` | Spreadsheet | Pro | `node-file` | Excel to CSV: xlsx file, sheet → csv file/text, row count, column count. Process locally in your browser. |
| `excel-to-json` | `codestation_excel_to_json` | Spreadsheet | Pro | `node-file` | Excel to JSON: xlsx file, sheet → json array of objects, row count, column count. Process locally in your browser. |
| `json-to-excel` | `codestation_json_to_excel` | Spreadsheet | Pro | `node-file` | JSON to Excel: json array of objects, sheet name → xlsx file, row count, column count. Process locally in your browser. |
| `json-to-xlsx` | `codestation_json_to_xlsx` | Spreadsheet | Pro | `node-file` | Convert a JSON array of objects (inline or from inputPath) into a real .xlsx workbook via ExcelJS. |
| `workbook-inspector` | `codestation_workbook_inspector` | Spreadsheet | Pro | `node-file` | Workbook Inspector: xlsx file → file name, file size, sheet count, sheet names, per-sheet dimensions, formula count. Process locally in your browser. |
| `xlsx-inspect` | `codestation_xlsx_inspect` | Spreadsheet | Pro | `node-file` | Inspect an Excel (.xlsx) workbook file for sheet names, row/column dimensions, headers, and formula counts. |
| `xlsx-to-json` | `codestation_xlsx_to_json` | Spreadsheet | Pro | `node-file` | Extract rows from an Excel (.xlsx) worksheet into structured JSON records or write to an output JSON file. |
| `csv-to-sql` | `codestation_csv_to_sql` | SQL & Database | Pro | `node-pure` | Convert a CSV header and data rows into dialect-aware SQL INSERT statements. |
| `database-connection-string-builder` | `codestation_database_connection_string_builder` | SQL & Database | Pro | `node-pure` | Build a PostgreSQL, MySQL or SQL Server connection string locally from explicit connection fields. |
| `database-connection-string-parser` | `codestation_database_connection_string_parser` | SQL & Database | Pro | `node-pure` | Inspect supported PostgreSQL, MySQL or SQL Server connection strings while keeping the password masked. |
| `er-diagram-generator` | `codestation_er_diagram_generator` | SQL & Database | Pro | `node-pure` | Generate a local entity relationship diagram from supported CREATE TABLE statements. |
| `json-to-sql` | `codestation_json_to_sql` | SQL & Database | Pro | `node-pure` | Convert a JSON array of objects into dialect-aware SQL INSERT statements. |
| `sql-delete-generator` | `codestation_sql_delete_generator` | SQL & Database | Pro | `node-pure` | Build a SQL DELETE statement with optional explicit WHERE conditions and an all-rows warning. |
| `sql-escape-helper` | `codestation_sql_escape_helper` | SQL & Database | Pro | `node-pure` | Escape a typed value as a SQL literal for an explicitly chosen dialect. |
| `sql-formatter` | `codestation_sql_formatter` | SQL & Database | Pro | `node-pure` | Format SQL with readable indentation for an explicitly selected SQL dialect. |
| `sql-insert-generator` | `codestation_sql_insert_generator` | SQL & Database | Pro | `node-pure` | Build a SQL INSERT statement from explicit columns and typed row values. |
| `sql-minifier` | `codestation_sql_minifier` | SQL & Database | Pro | `node-pure` | Reduce SQL layout whitespace while preserving string literals and token boundaries. |
| `sql-select-builder` | `codestation_sql_select_builder` | SQL & Database | Pro | `node-pure` | Build a SQL SELECT statement from columns, typed conditions, ordering and an optional limit. |
| `sql-to-csv` | `codestation_sql_to_csv` | SQL & Database | Pro | `node-pure` | Convert supported literal SQL INSERT statements to CSV text with a header row. |
| `sql-to-json` | `codestation_sql_to_json` | SQL & Database | Pro | `node-pure` | Convert supported literal SQL INSERT statements into a JSON array of objects. |
| `sql-to-markdown` | `codestation_sql_to_markdown` | SQL & Database | Pro | `node-pure` | Convert supported literal SQL INSERT statements into a readable Markdown table. |
| `sql-update-generator` | `codestation_sql_update_generator` | SQL & Database | Pro | `node-pure` | Build a SQL UPDATE statement with typed assignments and explicit WHERE conditions. |
| `sql-validator` | `codestation_sql_validator` | SQL & Database | Pro | `node-pure` | Check supported SQL syntax and view its validity, syntax error and error location locally. |
| `sql-where-builder` | `codestation_sql_where_builder` | SQL & Database | Pro | `node-pure` | Build a standalone SQL WHERE clause from typed conditions joined with AND or OR. |
| `bom-detector` | `codestation_bom_detector` | Text | Pro | `node-pure` | Detect a leading Unicode U+FEFF byte-order-mark character in decoded text without guessing its original encoding. |
| `bom-remover` | `codestation_bom_remover` | Text | Pro | `node-pure` | Remove a leading U+FEFF byte-order-mark character from decoded text while retaining other content. |
| `case-converter` | `codestation_case_converter` | Text | Pro | `node-pure` | Transform text into uppercase, lowercase, title, sentence, camel, Pascal, snake, kebab or constant case in your browser. |
| `character-counter-without-spaces` | `codestation_character_counter_without_spaces` | Text | Pro | `node-pure` | Count text characters after excluding all spaces and whitespace, using grapheme clusters where supported. |
| `crlf-to-lf` | `codestation_crlf_to_lf` | Text | Pro | `node-pure` | Convert text line endings to Unix-style LF with a dedicated fixed-direction tool. |
| `duplicate-line-remover` | `codestation_duplicate_line_remover` | Text | Pro | `node-pure` | Remove repeated lines locally while preserving the first occurrence and your chosen case sensitivity. |
| `email-extractor` | `codestation_email_extractor` | Text | Pro | `node-pure` | Extract email-address text and count occurrences locally, preserving repeated addresses in source order. |
| `empty-line-remover` | `codestation_empty_line_remover` | Text | Pro | `node-pure` | Remove empty and whitespace-only lines from text while preserving the remaining line content. |
| `find-replace` | `codestation_find_replace` | Text | Pro | `node-pure` | Replace literal text with explicit case sensitivity and a choice of first or all occurrences, without regex syntax. |
| `lf-to-crlf` | `codestation_lf_to_crlf` | Text | Pro | `node-pure` | Convert text line endings to Windows-style CRLF with a dedicated fixed-direction tool. |
| `line-deduplicator` | `codestation_line_deduplicator` | Text | Pro | `node-pure` | Deduplicate text lines while preserving first occurrences and report how many duplicates were removed. |
| `line-ending-converter` | `codestation_line_ending_converter` | Text | Pro | `node-pure` | Normalize mixed text line endings to your explicit choice of LF, CRLF or CR. |
| `line-shuffler` | `codestation_line_shuffler` | Text | Pro | `node-pure` | Shuffle text lines locally using browser randomness while retaining their original content. |
| `lorem-ipsum-generator` | `codestation_lorem_ipsum_generator` | Text | Pro | `node-pure` | Generate an exact requested number of Lorem Ipsum words, sentences or paragraphs locally. |
| `number-extractor` | `codestation_number_extractor` | Text | Pro | `node-pure` | Extract signed integer and decimal text and report the number of occurrences without uploading the source. |
| `paragraph-counter` | `codestation_paragraph_counter` | Text | Pro | `node-pure` | Count nonempty paragraphs separated by blank lines in browser-local text. |
| `prefix-suffix-adder` | `codestation_prefix_suffix_adder` | Text | Pro | `node-pure` | Apply a literal prefix and suffix to every text line with browser-local processing. |
| `random-text-generator` | `codestation_random_text_generator` | Text | Pro | `node-pure` | Generate random fixture text by characters, words, sentences or paragraphs using browser randomness. |
| `regex-line-extractor` | `codestation_regex_line_extractor` | Text | Pro | `node-pure` | Extract matching lines using a JavaScript regex and explicit flags in a time-limited local worker. |
| `reverse-lines` | `codestation_reverse_lines` | Text | Pro | `node-pure` | Reverse the order of text lines without reversing their content, entirely in your browser. |
| `reverse-text` | `codestation_reverse_text` | Text | Pro | `node-pure` | Reverse text by grapheme cluster where supported, keeping combined characters and emoji together. |
| `sentence-counter` | `codestation_sentence_counter` | Text | Pro | `node-pure` | Estimate the number of sentences in text locally using punctuation and text boundaries. |
| `slug-generator` | `codestation_slug_generator` | Text | Pro | `node-pure` | Create a URL-friendly lowercase slug from text with local normalization and hyphen-separated words. |
| `sort-lines` | `codestation_sort_lines` | Text | Pro | `node-pure` | Sort text lines A to Z or Z to A with explicit case-sensitive or case-insensitive comparison. |
| `spaces-to-tabs` | `codestation_spaces_to_tabs` | Text | Pro | `node-pure` | Convert groups of spaces to tabs with an explicit group width from 1 to 16 spaces per tab. |
| `tabs-to-spaces` | `codestation_tabs_to_spaces` | Text | Pro | `node-pure` | Replace tab characters with a chosen number of spaces using an explicit width from 1 to 16. |
| `text-counter` | `codestation_text_counter` | Text | Pro | `node-pure` | Count characters, characters without whitespace, words, lines, estimated sentences and paragraphs locally. |
| `text-diff` | `codestation_text_diff` | Text | Free | `node-pure` | Compare two text documents locally and inspect readable added, removed and unchanged line content. |
| `text-normalizer` | `codestation_text_normalizer` | Text | Pro | `node-pure` | Normalize Unicode text to NFC and all line endings to LF using one fixed, predictable transformation. |
| `url-extractor` | `codestation_url_extractor` | Text | Pro | `node-pure` | Extract URL text and count occurrences without navigating to or fetching any extracted address. |
| `whitespace-cleaner` | `codestation_whitespace_cleaner` | Text | Pro | `node-pure` | Clean unnecessary whitespace in text locally while retaining its line structure. |
| `canonical-url-generator` | `codestation_canonical_url_generator` | Web | Pro | `node-pure` | Normalize an HTTP/HTTPS URL, remove only its fragment and generate an escaped canonical link tag locally. |
| `html-entity-reference` | `codestation_html_entity_reference` | Web | Pro | `node-pure` | Look up an HTML entity, Unicode character or code point and return its character, named and numeric forms locally. |
| `http-header-reference` | `codestation_http_header_reference` | Web | Pro | `node-pure` | Look up a header's canonical name, category, purpose and typical example in a local curated reference. |
| `http-status-code-lookup` | `codestation_http_status_code_lookup` | Web | Pro | `node-pure` | Look up an HTTP status code's standard text, category and concise description from a local reference. |
| `meta-tag-generator` | `codestation_meta_tag_generator` | Web | Pro | `node-pure` | Generate safely escaped title and description, author, robots and theme-color markup as inert text. |
| `mime-type-lookup` | `codestation_mime_type_lookup` | Web | Pro | `node-pure` | Map a file extension or MIME type to its MIME type, common extensions and media category locally. |
| `open-graph-generator` | `codestation_open_graph_generator` | Web | Pro | `node-pure` | Generate escaped Open Graph tags from supplied metadata without fetching a page or image. |
| `open-graph-preview` | `codestation_open_graph_preview` | Web | Pro | `node-pure` | Preview only the social metadata you enter locally, without visiting its URL or promising exact platform rendering. |
| `query-string-generator` | `codestation_query_string_generator` | Web | Pro | `node-pure` | Encode structured query entries, preserving their order, repeated keys and empty values. |
| `query-string-parser` | `codestation_query_string_parser` | Web | Pro | `node-pure` | Decode a query string or URL into ordered key/value entries and a parameter count locally. |
| `robots-txt-generator` | `codestation_robots_txt_generator` | Web | Pro | `node-pure` | Generate robots.txt from explicit user-agent groups, allow/disallow paths and sitemap URLs without crawling. |
| `sitemap-generator` | `codestation_sitemap_generator` | Web | Pro | `node-pure` | Generate escaped sitemap XML from URL entries and only the optional dates, frequencies and priorities you supply. |
| `twitter-card-generator` | `codestation_twitter_card_generator` | Web | Pro | `node-pure` | Generate safely escaped Twitter/X card metadata as text from supplied content and optional handles. |
| `url-builder` | `codestation_url_builder` | Web | Pro | `node-pure` | Build an HTTP or HTTPS URL from explicit components and ordered query rows without visiting it. |
| `url-encoding-inspector` | `codestation_url_encoding_inspector` | Web | Pro | `node-pure` | Inspect percent-encoded runs, decoded values and their positions, and show a fully decoded preview locally. |
| `url-fragment-parser` | `codestation_url_fragment_parser` | Web | Pro | `node-pure` | Extract the raw and decoded fragment from a URL or #fragment without navigating to it. |
| `url-parser` | `codestation_url_parser` | Web | Pro | `node-pure` | Break a URL into its protocol, credentials presence, hostname, path, ordered query parameters and fragment without visiting it. |
| `url-path-analyzer` | `codestation_url_path_analyzer` | Web | Pro | `node-pure` | Inspect a URL or pathname's segments, count, final filename and extension locally without a request. |
| `user-agent-parser` | `codestation_user_agent_parser` | Web | Pro | `node-pure` | Heuristically parse a supplied User-Agent string into browser, OS, device type and engine without fingerprinting. |
| `web-app-manifest-generator` | `codestation_web_app_manifest_generator` | Web | Pro | `node-pure` | Generate formatted Web App Manifest JSON from explicit app settings and icon metadata without fetching icons. |
| `aes-crypto` | `codestation_aes_crypto` | WebPKI & Advanced Cryptography | Pro | `node-pure` | AES-GCM Encrypt & Decrypt: operation mode, key mode, key length, plaintext or encrypted payload, passphrase, raw secret key (hex or base64), initialization vector (12-byte hex, optional), additional authenticated data (aad, optional) → ciphertext (base64), ciphertext (hex), authentication tag (128-bit), initialization vector (iv / nonce), json bundle format, decrypted plaintext. Process locally in your browser. |
| `csp-builder` | `codestation_csp_builder` | WebPKI & Advanced Cryptography | Pro | `node-pure` | CSP (Content Security Policy) Builder: default-src, script-src, style-src, img-src, connect-src, font-src, object-src, frame-ancestors, base-uri → http header string, security audit score & grade, actionable risk warnings, html meta tag equivalent, nginx configuration directive, next.js headers configuration. Process locally in your browser. |
| `csr-inspector` | `codestation_csr_inspector` | WebPKI & Advanced Cryptography | Pro | `node-pure` | CSR (Certificate Signing Request) Inspector: pkcs#10 pem or base64 der → subject distinguished name (dn), subject alternative names (sans), public key algorithm & modulus, cryptographic self-signature validity, parsed asn.1 structure. Process locally in your browser. |
| `jwt-signer-verifier` | `codestation_jwt_signer_verifier` | WebPKI & Advanced Cryptography | Pro | `node-pure` | JWT Signer & Verifier: operation mode, algorithm, header (json), payload (json), compact jwt token, secret key (or rsa private key pem), rsa public key pem (for rs256 verification) → compact jwt token, cryptographic signature validity, decoded header json, decoded payload json, claims validation (exp, nbf, clock skew). Process locally in your browser. |
| `rsa-key-generator` | `codestation_rsa_key_generator` | WebPKI & Advanced Cryptography | Pro | `node-pure` | RSA Key Pair Generator: key size → pkcs#8 private key pem, spki public key pem, sha-256 public key fingerprint, key metadata (modulus & exponent). Process locally in your browser. |

</details>
<!-- END_MCP_CATALOG -->

---

## License & Activation

Get a Pro or Team license key at [codestation.in/pro](https://codestation.in/pro):
- **India:** ₹199 / month or ₹999 one-time
- **Global:** $2.99 / month or $19.00 one-time

Ways to activate:
1. CLI login cache (14-day offline grace): `codestation login CS-PRO-YOUR-KEY`
2. CLI flag: `npx codestation-mcp --key CS-PRO-YOUR-KEY`
3. Environment variable: `export CODESTATION_LICENSE_KEY="CS-PRO-YOUR-KEY"`

---

## Licensing

`codestation-mcp` (`mcp/` and `packages/codestation-mcp/`) and Code Station's **383 client-side browser utilities** are open source under the **[MIT License](LICENSE)** (see the root [`LICENSE`](https://github.com/tejreddym/codestation/blob/main/LICENSE)).

- Official managed Pro/Team license keys for hosted verification and support are available at [codestation.in/pro](https://codestation.in/pro); the hosted billing and license-issuance backend endpoints (`app/api/`) are governed separately by [`COMMERCIAL_LICENSE.md`](https://github.com/tejreddym/codestation/blob/main/COMMERCIAL_LICENSE.md).
