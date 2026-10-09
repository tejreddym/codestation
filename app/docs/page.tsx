import { metadataForPage } from "@/config/site";
import { InformationalPage } from "@/components/InformationalPage";
import { CopySnippet } from "@/components/CopySnippet";
import Link from "next/link";

export const metadata = metadataForPage(
  "/docs",
  "Documentation — Code Station MCP, CLI Subcommands & AI Integration",
  "Complete guide to Code Station Local MCP server on npm, 1-click auto setup for Claude & Cursor, dual-purpose terminal CLI, and TypeScript/Zod generators."
);

const AUTO_SETUP_CMD = `npx -y codestation-mcp setup --key CS-PRO-YOUR-KEY`;
const AUTO_SETUP_FREE_CMD = `npx -y codestation-mcp setup`;

const NPX_FREE_CMD = `npx -y codestation-mcp`;
const NPX_PRO_CMD = `npx -y codestation-mcp --key CS-PRO-YOUR-KEY`;

const CLI_EXAMPLES = `# Convert cURL to TypeScript fetch / axios / Python / Go
npx codestation-mcp curl 'curl -X POST https://api.example.com -d "{\\"k\\":\\"v\\"}"' --target fetch

# Audit .env for secret leaks (Stripe, AWS, OpenAI, GitHub PAT) & diff with .env.example
npx codestation-mcp env .env --example .env.example

# Generate realistic mock dataset (JSON or SQL INSERT for DB seeding)
npx codestation-mcp mock users --count 10 --sql --table users

# Parse and resolve Git merge conflicts (ours, theirs, or both)
npx codestation-mcp conflict ./src/index.ts --strategy ours

# Decode & inspect a JWT token
npx codestation-mcp jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Format SQL query
npx codestation-mcp sql "SELECT id, name FROM users WHERE active = true ORDER BY name;"

# Explain Cron expression and calculate next 5 runtimes
npx codestation-mcp cron "0 9 * * 1-5"

# Generate TypeScript interfaces from JSON (pipe or pass argument)
npx codestation-mcp ts '{"id":1,"name":"Ada","address":{"city":"London"}}' User

# Generate production-ready Zod schema from JSON
npx codestation-mcp zod '{"id":1,"name":"Ada","address":{"city":"London"}}' userSchema

# Hash string with SHA-256 / SHA-512 / MD5
npx codestation-mcp hash "secret-token" --alg sha256

# Generate random UUIDs
npx codestation-mcp uuid 3`;

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`;

const CURSOR_CONFIG = `{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`;

const WINDSURF_CONFIG = `{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`;

const CLAUDE_CODE_CLI = `claude mcp add codestation npx -y codestation-mcp --key CS-PRO-YOUR-KEY`;

const AI_SYSTEM_PROMPT = `# Code Station MCP Assistant Guidelines

You have access to the Code Station MCP developer server (codestation-mcp).
Always prioritize calling these local, deterministic tools instead of calculating, parsing, or formatting in your internal reasoning:

1. cURL to Code: Call codestation_curl_to_code to convert cURL commands into clean TypeScript fetch/axios, Python requests, or Go net/http.
2. Environment Security: Call codestation_env_audit to scan .env files for live secret leaks (Stripe, AWS, OpenAI, GitHub PAT, private keys) and synchronize with .env.example.
3. Realistic Mock Data: Call codestation_mock_data to generate realistic test data and SQL INSERT seed statements.
4. Git Conflict Resolution: Call codestation_git_conflict to parse merge conflict markers and resolve cleanly with ours, theirs, or both.
5. JSON to TypeScript & Zod: Call codestation_json_to_typescript and codestation_json_to_zod to generate production-ready types and Zod schemas from API payloads or sample data.
6. SQL Formatting & Execution: Call codestation_format_sql to format queries across PostgreSQL, MySQL, SQLite, and SQL Server. Use codestation_run_sql for in-memory execution.
7. JWT Decoding: When inspecting JSON Web Tokens, call codestation_jwt_decode to inspect headers, claims, and expiry dates without guessing.
8. Cron Schedules: Call codestation_cron_explain to understand complex cron patterns and project future executions.
9. Timezones & Business Days: Always call codestation_timezone_convert and codestation_business_days for date arithmetic rather than calculating manually.
10. Hashes & Signatures: Call codestation_hash and codestation_hmac for cryptographic digests (SHA-256, SHA-512, MD5).
11. Regex Testing: Call codestation_regex_test to verify regular expressions and return match groups.
12. Text Transformations: Use codestation_case_convert, codestation_text_diff, and codestation_uuid for RFC 4122 v4 UUIDs.`;

export default function DocsPage() {
  return (
    <InformationalPage
      title="Code Station Documentation"
      intro="Complete guide to the Local Model Context Protocol (MCP) server, 1-click auto setup, terminal developer CLI, and AI assistant configurations."
    >
      <section>
        <h2>1. Overview &amp; Philosophy</h2>
        <p>
          Code Station provides deterministic developer utilities for both human developers and AI coding agents.
          Tools are available through two complementary interfaces:
        </p>
        <ul>
          <li>
            <strong>Web Application:</strong> Over 250 browser-first developer tools running client-side with zero backend data persistence.
            100% free and unlimited for all developers.
          </li>
          <li>
            <strong>Local MCP Server &amp; Developer CLI (npm):</strong> An offline Model Context Protocol server and terminal Swiss-Army knife
            (<code>codestation-mcp</code>) that connects directly to AI assistants like Claude Desktop, Cursor, and Windsurf, while also serving
            as an everyday terminal utility.
          </li>
        </ul>
        <p>
          <strong>Why Local MCP?</strong> Large Language Models frequently make calculation errors with timestamp arithmetic,
          regex capture groups, timezone conversions across DST boundaries, and cryptographic hashing. By delegating these
          tasks to Code Station&apos;s verified engines locally on your machine, AI agents produce 100% accurate code without
          hallucinations and without transmitting sensitive data to third-party APIs.
        </p>
      </section>

      <section>
        <h2>2. 1-Click Auto Setup (Claude, Cursor &amp; Windsurf)</h2>
        <p>
          No manual JSON editing required. Run this command in your terminal to automatically detect and configure
          <strong> Claude Desktop</strong>, <strong>Cursor IDE</strong>, and <strong>Windsurf</strong> in one click:
        </p>
        <CopySnippet code={AUTO_SETUP_CMD} title="Terminal (1-Click Pro Setup)" language="bash" />
        <p>
          Or run without a key to configure the Free Tier:
        </p>
        <CopySnippet code={AUTO_SETUP_FREE_CMD} title="Terminal (1-Click Free Setup)" language="bash" />
      </section>

      <section>
        <h2>3. Terminal Developer CLI Subcommands</h2>
        <p>
          In addition to acting as an MCP server for AI models, <code>codestation-mcp</code> functions as a standalone
          terminal tool for your everyday workflow:
        </p>
        <CopySnippet code={CLI_EXAMPLES} title="Terminal One-Liners" language="bash" />
      </section>

      <section>
        <h2>4. Manual AI Assistant Configurations</h2>
        <p>
          If you prefer to configure your assistants manually, click <strong>Copy</strong> on any of the configuration blocks below:
        </p>

        <h3>Claude Desktop</h3>
        <p>
          Edit your Claude Desktop configuration file:
        </p>
        <ul>
          <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
          <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
        </ul>
        <CopySnippet code={CLAUDE_DESKTOP_CONFIG} title="claude_desktop_config.json" language="json" />

        <h3>Cursor IDE</h3>
        <p>
          Add to your repository&apos;s <code>.cursor/mcp.json</code> or paste into Cursor Settings (<strong>Settings → Features → MCP</strong>):
        </p>
        <CopySnippet code={CURSOR_CONFIG} title=".cursor/mcp.json" language="json" />

        <h3>Windsurf / Codeium</h3>
        <p>
          Add to your Windsurf configuration file located at <code>~/.codeium/windsurf/mcp_config.json</code>:
        </p>
        <CopySnippet code={WINDSURF_CONFIG} title="mcp_config.json (Windsurf)" language="json" />

        <h3>Claude Code CLI / Terminal</h3>
        <p>
          Add directly using the Claude Code command-line tool:
        </p>
        <CopySnippet code={CLAUDE_CODE_CLI} title="Claude Code CLI" language="bash" />
      </section>

      <section>
        <h2>5. Copy-Pastable AI System Prompt &amp; Rules</h2>
        <p>
          Paste this prompt into your assistant&apos;s Custom Instructions, <code>.cursorrules</code>, or <code>CLAUDE.md</code>.
          It instructs your AI model to automatically use Code Station tools instead of guessing math, hashes, or syntax:
        </p>
        <CopySnippet code={AI_SYSTEM_PROMPT} title=".cursorrules / CLAUDE.md / Custom Prompt" language="markdown" />
      </section>

      <section>
        <h2>6. 100% Free &amp; Private Web Application</h2>
        <p>
          Every single one of the <strong>250+ developer tools</strong> on the Code Station web application
          is completely <strong>free, unrestricted, and unlimited</strong>.
        </p>
        <ul>
          <li><strong>Zero Paywalls on the Web:</strong> Format JSON, beautify SQL, inspect JWT tokens, generate ER diagrams, test regex, and calculate business days with zero restrictions directly in your browser.</li>
          <li><strong>Zero Tracking or Storage:</strong> All computation occurs purely inside your browser&apos;s client memory. Code, tokens, and data never touch a remote server.</li>
          <li><strong>No Login Required:</strong> Bookmark any tool and start building immediately without an account.</li>
        </ul>
      </section>

      <section>
        <h2>7. Anti-Key-Sharing Protection (Device Binding)</h2>
        <p>
          To prevent public sharing and resale of license keys while remaining flexible for developers, Code Station enforces
          an automated, privacy-respecting <strong>device binding policy</strong> for Pro MCP users:
        </p>
        <ul>
          <li>
            <strong>3-Device Limit:</strong> Each Pro license key can be registered on up to <strong>3 active devices</strong> simultaneously
            (e.g., your office MacBook, personal desktop, and Linux workstation).
          </li>
          <li>
            <strong>Hardware Fingerprint:</strong> Each device generates a persistent local identifier and passes its client agent to verify ownership.
          </li>
          <li>
            <strong>Automatic 30-Day Pruning:</strong> Devices inactive for over 30 days are automatically removed, freeing up slots for new machines without manual intervention.
          </li>
          <li>
            <strong>Self-Service Device Reset:</strong> If you upgrade laptops or wipe a hard drive, you can instantly unbind your existing devices
            using the <strong>Reset Active Devices</strong> button on the <Link href="/pro">Pro page</Link>.
          </li>
          <li>
            <strong>Zero-Knowledge Security:</strong> Your raw plaintext key is never stored in Cloudflare KV. Only a one-way SHA-256 hash
            is stored and matched at the edge.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Tool Catalog &amp; Capability Matrix</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>MCP Tool Name</th>
              <th style={{ padding: "8px 12px" }}>Tier</th>
              <th style={{ padding: "8px 12px" }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_json_to_typescript</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Generate clean, nested TypeScript interfaces and types from sample JSON</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_json_to_zod</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Generate production-ready Zod schema declarations and inferred types from JSON</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_format_json</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Format, indent, and validate JSON payloads</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_minify_json</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Compact JSON strings into single-line representations</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_json_to_yaml</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Convert JSON data to clean YAML syntax</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_yaml_to_json</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Parse YAML documents into standard JSON format</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_base64</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Standard and URL-safe Base64 encode and decode</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_hex_codec</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Encode strings to hexadecimal representation and vice versa</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_url_codec</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>RFC 3986 URL and URI component encode and decode</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_case_convert</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Transform identifier casing (camelCase, snake_case, PascalCase, kebab-case)</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_text_diff</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Unified line-by-line semantic diff between two texts</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_uuid</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Generate cryptographically random RFC 4122 v4 UUIDs</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_hash</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Cryptographic hashing (SHA-256, SHA-512, MD5, SHA-1, CRC-32)</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_hmac</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Keyed HMAC message authentication (SHA-256, SHA-512)</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_jwt_decode</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Parse and validate JWT header, payload, expiry date, and signature format</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_format_sql</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Format queries across PostgreSQL, MySQL, SQLite, and SQL Server</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_run_sql</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Execute in-memory SQL queries against schemas and sample datasets</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_cron_explain</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Translate Unix cron expressions into human-readable English descriptions</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_business_days</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Calculate business working days between two dates excluding holidays</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_regex_test</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Test regular expressions with capture groups and match positions</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_json_schema</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Infer Draft 7 or 2020-12 JSON Schema structures from sample objects</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>9. Pricing &amp; Plans</h2>
        <p>
          Code Station Pro is priced accessibly for developers:
        </p>
        <ul>
          <li><strong>India:</strong> ₹199 / month or ₹999 one-time lifetime license.</li>
          <li><strong>Global:</strong> $2.99 / month or $19.00 one-time lifetime license.</li>
        </ul>
        <p>
          Purchases are 100% login-free. Payment is processed securely via <strong>Razorpay</strong>, supporting
          UPI (Google Pay, PhonePe, Paytm), credit/debit cards, and NetBanking.
        </p>
        <p>
          <Link href="/pro" className="button primary">
            Upgrade to Code Station Pro →
          </Link>
        </p>
      </section>

      <section>
        <h2>10. Lost Key Recovery Policy</h2>
        <p>
          Because Code Station is 100% login-free, plaintext license keys are never stored on our servers.
          Edge nodes only verify one-way SHA-256 hashes.
        </p>
        <p>
          If you accidentally misplace or lose your license key:
        </p>
        <ul>
          <li>Email <strong><a href="mailto:twnspace2@gmail.com">twnspace2@gmail.com</a></strong> with your proof of purchase (Razorpay Payment ID <code>pay_...</code> or receipt screenshot).</li>
          <li>We revoke the old key hash in Cloudflare KV and generate a brand-new replacement key.</li>
          <li>
            <strong>Regeneration Fee Schedule:</strong> ₹25 for the 1st recovery, doubling every subsequent time
            (₹50 for 2nd, ₹100 for 3rd, ₹200 for 4th, etc.) to discourage unauthorized key sharing while providing a reliable recovery mechanism.
          </li>
        </ul>
      </section>
    </InformationalPage>
  );
}
