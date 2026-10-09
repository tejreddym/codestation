import { metadataForPage } from "@/config/site";
import { InformationalPage } from "@/components/InformationalPage";
import Link from "next/link";

export const metadata = metadataForPage(
  "/docs",
  "Documentation — Code Station MCP, Web Pro Tools & Licensing",
  "Complete guide to Code Station Local MCP server on npm, Web Pro Tools, Claude Desktop and Cursor integration, anti-key-sharing policy, and developer APIs."
);

export default function DocsPage() {
  return (
    <InformationalPage
      title="Code Station Documentation"
      intro="Complete guide to the Local Model Context Protocol (MCP) server, Web Pro tools, AI coding assistant integrations, and device-bound licensing."
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
          </li>
          <li>
            <strong>Local MCP Server (npm):</strong> An offline Model Context Protocol server (<code>codestation-mcp</code>) that connects
            directly to AI assistants like Claude Desktop, Cursor, and Windsurf via standard I/O (<code>stdio</code>).
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
        <h2>2. npm Quick Start</h2>
        <p>
          The Code Station MCP server is published on the official npm registry as <code>codestation-mcp</code>.
          You can run it instantly using <code>npx</code>:
        </p>
        <pre style={{ padding: "14px", background: "var(--code)", color: "var(--code-ink)", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
          <code>npx -y codestation-mcp</code>
        </pre>
        <p>
          To unlock all Pro utilities (JWT decoding, SQL formatting &amp; execution, ER diagram generation, HMAC signatures, etc.), pass your license key:
        </p>
        <pre style={{ padding: "14px", background: "var(--code)", color: "var(--code-ink)", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
          <code>npx -y codestation-mcp --key CS-PRO-YOUR-KEY</code>
        </pre>
      </section>

      <section>
        <h2>3. AI Assistant Integration Guides</h2>

        <h3>Claude Desktop</h3>
        <p>
          Edit your Claude Desktop configuration file:
        </p>
        <ul>
          <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
          <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
        </ul>
        <pre style={{ padding: "14px", background: "var(--code)", color: "var(--code-ink)", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
{`{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`}
        </pre>

        <h3>Cursor IDE</h3>
        <p>
          Open <strong>Settings → Features → MCP</strong>, or add to your repository&apos;s <code>.cursor/mcp.json</code>:
        </p>
        <pre style={{ padding: "14px", background: "var(--code)", color: "var(--code-ink)", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
{`{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`}
        </pre>

        <h3>CLI &amp; Environment Options</h3>
        <p>You can provide your Pro license key through any of the following methods:</p>
        <ol>
          <li>Command line flag: <code>--key CS-PRO-YOUR-KEY</code></li>
          <li>Environment variable: <code>export CODESTATION_KEY="CS-PRO-YOUR-KEY"</code></li>
          <li>Local config file: Save <code>{`{ "licenseKey": "CS-PRO-YOUR-KEY" }`}</code> in <code>~/.codestation/license.json</code></li>
        </ol>
      </section>

      <section>
        <h2>4. Web App Pro Tools &amp; In-Browser Unlocking</h2>
        <p>
          On the Code Station web application, power tools are tagged with a <code>[PRO]</code> badge:
        </p>
        <ul>
          <li><strong>JWT Decoder:</strong> In-browser inspection of JSON Web Tokens, verification headers, claims, and expiry dates.</li>
          <li><strong>SQL Formatter:</strong> Multi-dialect SQL query formatter supporting PostgreSQL, MySQL, SQLite, and SQL Server.</li>
          <li><strong>ER Diagram Generator:</strong> Interactive entity-relationship diagram visualization from DDL schemas.</li>
          <li><strong>HMAC Generator:</strong> Keyed-hash message authentication with SHA-256 and SHA-512.</li>
          <li><strong>Cron Next Run Calculator:</strong> Forward projection of Unix cron schedules with timezone awareness.</li>
          <li><strong>Business Days Calculator:</strong> Working day calculations excluding weekends and custom holiday lists.</li>
          <li><strong>Regex Match Inspector:</strong> Regular expression debugger with match group captures.</li>
          <li><strong>JSON Schema Generator:</strong> Draft 7 / 2020-12 schema generation from sample JSON.</li>
        </ul>

        <h3>How Unlocking Works on the Web</h3>
        <ol>
          <li>When you open a Pro tool, a lock gate is presented.</li>
          <li>If you do not have a key, click <strong>Get Code Station Pro (₹199)</strong> to purchase via Razorpay (UPI, Cards, NetBanking).</li>
          <li>If you have a key, paste your <code>CS-PRO-...</code> key into the input field and click <strong>Unlock Tool</strong>.</li>
          <li>
            The web app verifies the key with device binding and securely saves the unlocked state in your browser&apos;s <code>localStorage</code>.
            All Pro tools across the site unlock instantly.
          </li>
          <li>You can re-lock the tool at any time with the &ldquo;Lock&rdquo; button.</li>
        </ol>
      </section>

      <section>
        <h2>5. Anti-Key-Sharing Protection (Device Binding)</h2>
        <p>
          To prevent public sharing and resale of license keys while remaining flexible for developers, Code Station enforces
          an automated, privacy-respecting <strong>device binding policy</strong>:
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
            <strong>Excess Device Blocking:</strong> If a 4th device attempts to activate with the key, verification returns <code>HTTP 403 Forbidden</code>:
            <em>&ldquo;Device limit exceeded (maximum 3 active devices).&rdquo;</em>
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
        <h2>6. Tool Catalog &amp; Capability Matrix</h2>
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
        <h2>7. Pricing &amp; Plans</h2>
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
    </InformationalPage>
  );
}
