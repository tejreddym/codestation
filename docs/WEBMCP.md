# Code Station WebMCP (Web Model Context Protocol) User Manual

**WebMCP** is an emerging browser-native W3C and Chromium specification that allows web applications to expose structured tools directly to in-browser AI agents, extensions, and web assistants via `document.modelContext` (with `navigator.modelContext` fallback).

Code Station provides first-class WebMCP integration across all 380+ developer tools and 22 stations. All executions run **100% inside your browser** using native Web APIs, Web Crypto, Canvas, and client-side AST parsers—with **zero server uploads, zero network roundtrips, and zero telemetry**.

---

## Why WebMCP?

| Capability | Traditional Scraping / Vision Agents | WebMCP in Code Station |
| :--- | :--- | :--- |
| **Accuracy** | Brittle; guesses UI clicks and CSS selectors | Rigid, typed programmatic JSON Schema |
| **Latency** | Multi-second image capture & analysis | Direct client-side function call in <5ms |
| **Privacy** | Sends full page screenshots to cloud LLMs | Executed locally inside the user's browser tab |
| **Token Cost** | Thousands of vision tokens per interaction | Minimal tokens: just input and output text payloads |

---

## Browser Support & Prerequisites

- **Chromium / Google Chrome (Version 146+)**:
  1. Navigate to `chrome://flags/#enable-webmcp-testing` in your address bar.
  2. Toggle the flag to **Enabled**.
  3. Relaunch your browser.
- **Other Browsers & Extensions**:
  Code Station injects a transparent polyfill on `document.modelContext` and exposes `window.__CODESTATION_WEBMCP__`. Any AI userscript, browser extension, or web agent can immediately detect and invoke Code Station tools without browser flag dependencies.

---

## Universal Built-in WebMCP Tools

When you open any page on `https://codestation.in`, Code Station automatically mounts two universal WebMCP tools:

### 1. `codestation_list_tools`
Enables an AI agent to search, inspect, and filter the catalog of 380+ browser utilities.

```json
{
  "category": "JSON & Data",
  "query": "formatter",
  "limit": 10
}
```

**Output**:
```json
{
  "totalMatches": 1,
  "returned": 1,
  "tools": [
    {
      "id": "json-formatter",
      "slug": "json-formatter",
      "name": "JSON Formatter",
      "category": "JSON & Data",
      "description": "Prettify, validate, or minify raw JSON string locally in your browser.",
      "canonicalUrl": "https://codestation.in/tools/json-formatter"
    }
  ]
}
```

### 2. `codestation_execute_tool`
Allows an AI agent to execute any tool across all 22 stations with structured inputs and options.

```json
{
  "toolId": "json-formatter",
  "input": "{\"name\":\"Code Station\",\"openSource\":true}",
  "options": { "indent": 2 }
}
```

**Output**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"name\": \"Code Station\",\n  \"openSource\": true\n}"
    }
  ]
}
```

---

## Dynamic Active Tool Registration

When a user or AI agent navigates to a specific tool route (e.g. `https://codestation.in/tools/cidr-calculator`), Code Station's client lifecycle bridge (`WebMcpBridge`) dynamically mounts a dedicated tool contract onto `document.modelContext`:

```javascript
// Example: Inspecting tools on /tools/cidr-calculator
const tools = document.modelContext.getTools();
console.log(tools.map(t => t.name));
// Output: ['codestation_list_tools', 'codestation_execute_tool', 'codestation_cidr_calculator']
```

The dedicated tool exposes a focused input schema tailored directly to that tool's inputs and options:

```javascript
// Calling the dedicated tool directly:
const result = await document.modelContext.executeTool('codestation_cidr_calculator', {
  input: '10.0.0.0/16'
});

console.log(result.content[0].text);
```

When navigating away from the tool page, the dedicated tool is automatically cleaned up and unregistered to conserve token budgets.

---

## Supported Tool Categories in WebMCP

1. **JSON & Structured Data**: Prettify, minify, validate, JSON to YAML, YAML to JSON, JSON to CSV, CSV to JSON, JSON Schema generation, JSONPath queries, JSON Lines, and JWT decoding.
2. **Encoding & Codecs**: Base64, Base64URL, URL-encoding, Hexadecimal, Binary, ASCII, Base32, Base58, Data URIs, HTML entities, and Unicode escapes.
3. **Security & Cryptography**: SHA-256, SHA-512, SHA-384, SHA-1, MD5, CRC-32, HMAC signatures, UUID v4, ULID, NanoID, entropy scoring, and hash comparison.
4. **Text Utilities**: Case conversion (camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE), URL slug generator, unified text diff, line sorting, deduplication, and character/word statistics.
5. **Cron Schedules**: Expression explanation in plain English, syntax validation, and upcoming runtime calculations.
6. **Code Generation**: JSON to TypeScript interfaces, JSON to Zod schema, JSON to Go Structs, JSON to Python Pydantic v2, JSON to Rust Serde, HTML to JSX, and SVG to React components.
7. **Network & Cloud Engineering**: CIDR subnet calculations, IPv4 ⇄ IPv6 mapping, SemVer comparison, and `docker run` to `docker-compose.yml` conversion.
8. **Developer Math**: Multi-radix bitwise arithmetic, IEEE-754 floating-point breakdown, Two's complement calculator, arbitrary-precision BigInt algebra, and fraction conversion.
9. **Frontend & Visual CSS**: Responsive CSS Grid generators, Flexbox layout generators, and Glassmorphism generators.
10. **Developer Power Utilities**: cURL command translation, `.env` secret leak auditing, Git merge conflict resolution, and deterministic mock data generation.

---

## JavaScript / Agent Integration Examples

### 1. In a Browser Extension or Userscript
```javascript
// Check for WebMCP support
const modelContext = document.modelContext ?? navigator.modelContext ?? window.__CODESTATION_WEBMCP__;

if (modelContext) {
  // Execute Base64 decoding
  const response = await modelContext.executeTool('codestation_execute_tool', {
    toolId: 'base64',
    input: 'Q29kZSBTdGF0aW9uIFdlYk1DUA==',
    options: { action: 'decode' }
  });

  console.log('Decoded output:', response.content[0].text);
  // Output: "Code Station WebMCP"
}
```

### 2. In an AI Agent with Chrome's Built-in AI
```javascript
// Enumerate available tools for prompt registration
const availableTools = document.modelContext.getTools().map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema
}));
```

---

## Dual MCP Strategy: Web vs. Desktop

- **For Browser Agents (Chrome AI, WebMCP Extensions, Web Browsing Agents)**: Use **WebMCP** directly inside the active web tab via `document.modelContext`.
- **For Desktop IDEs (Claude Desktop, Cursor, Windsurf, Antigravity CLI)**: Use the local **[`codestation-mcp`](/docs#mcp-protocol)** package via `stdio` (`npx codestation-mcp`).
