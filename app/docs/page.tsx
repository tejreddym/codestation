import { metadataForPage } from "@/config/site";
import { InformationalPage } from "@/components/InformationalPage";
import Link from "next/link";

export const metadata = metadataForPage(
  "/docs",
  "Documentation — Code Station MCP & Developer Tools",
  "Complete guide to Code Station Local MCP server, Claude Desktop and Cursor integration, and developer tool APIs."
);

export default function DocsPage() {
  return (
    <InformationalPage
      title="Code Station Documentation"
      intro="Complete guide to the Local Model Context Protocol (MCP) server, AI assistant integrations, and Pro licensing."
    >
      <section>
        <h2>1. Overview</h2>
        <p>
          Code Station exposes its deterministic utilities (formatters, parsers, validators, cryptographic
          digests, timezone converters, and business day arithmetic) directly to AI coding assistants via
          the open <strong>Model Context Protocol (MCP)</strong>.
        </p>
        <p>
          Because tools execute locally in-memory over <code>stdio</code>, your code, tokens, and data never
          leave your computer. Execution completes in sub-milliseconds without network hops.
        </p>
      </section>

      <section>
        <h2>2. Quick Start</h2>
        <p>Run the local MCP server directly using Node or npx:</p>
        <pre style={{ padding: "14px", background: "var(--code)", color: "var(--code-ink)", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
          <code>npx -y codestation-mcp --key YOUR_PRO_KEY</code>
        </pre>
        <p>
          Without a key, the server runs in <strong>Free Tier</strong> mode with unlimited access to
          Base64, URL codec, Hex, JSON formatting, JSON-YAML conversion, UUID generation, Text Diff, and Case conversion.
        </p>
      </section>

      <section>
        <h2>3. Assistant Integration Guides</h2>

        <h3>Claude Desktop</h3>
        <p>
          Add Code Station to your <code>claude_desktop_config.json</code>:
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
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOURKEY"]
    }
  }
}`}
        </pre>

        <h3>Cursor</h3>
        <p>
          In Cursor, open <strong>Settings → Features → MCP</strong> (or create <code>.cursor/mcp.json</code> in your project):
        </p>
        <pre style={{ padding: "14px", background: "var(--code)", color: "var(--code-ink)", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
{`{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOURKEY"]
    }
  }
}`}
        </pre>
      </section>

      <section>
        <h2>4. Tool Inventory &amp; Capabilities</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Tool Name</th>
              <th style={{ padding: "8px 12px" }}>Tier</th>
              <th style={{ padding: "8px 12px" }}>Capability</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_uuid</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Generates random RFC 4122 v4 UUIDs</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_base64</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Standard &amp; URL-safe Base64 encode/decode</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_format_json</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Validate and pretty-print JSON structures</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_json_to_yaml</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Lossless JSON to YAML converter</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_case_convert</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>camelCase, snake_case, PascalCase, kebab-case</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_text_diff</code></td>
              <td style={{ padding: "8px 12px" }}>Free</td>
              <td style={{ padding: "8px 12px" }}>Line-by-line unified semantic text diff</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_hash</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>SHA-256, SHA-512, MD5, SHA-1, CRC-32 checksums</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_hmac</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>HMAC signatures with SHA-256 / SHA-512</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_jwt_decode</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>In-memory claims, header, and signature inspector</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_format_sql</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Multi-dialect SQL beautifier (PostgreSQL, MySQL, SQLite)</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_cron_explain</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Plain-English translation of 5-field Unix cron schedules</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_timezone_convert</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Runtime IANA rules with DST boundary accuracy</td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 12px" }}><code>codestation_business_days</code></td>
              <td style={{ padding: "8px 12px" }}><strong>Pro</strong></td>
              <td style={{ padding: "8px 12px" }}>Exact working days between dates excluding weekends</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>5. Licensing &amp; Anti-Abuse Policy</h2>
        <ul>
          <li>
            <strong>Login-Free Purchase:</strong> You receive your license key immediately upon checkout
            without creating an account or password.
          </li>
          <li>
            <strong>One-Way Hashing:</strong> Your plaintext key is never stored on our servers. Cloudflare
            edge databases only store a one-way SHA-256 hash.
          </li>
          <li>
            <strong>Device Binding (Anti-Key-Sharing):</strong> Each Pro license may be actively used on up to
            <strong> 3 devices</strong> simultaneously (e.g. work laptop, personal desktop, and home PC).
            Inactive devices are automatically pruned after 30 days. You can also self-reset your active devices
            anytime on the <Link href="/pro">Pro page</Link>.
          </li>
          <li>
            <strong>30-Day Offline Mode:</strong> Once validated, your license is cached locally in
            <code>~/.codestation/license.json</code> for 30 days so you can code without internet connectivity.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Upgrading to Pro</h2>
        <p>
          Upgrade your workflow for <strong>₹199 / month in India</strong> (or ₹999 lifetime) and
          <strong> $2.99 / month globally</strong> (or $19 lifetime).
        </p>
        <p>
          <Link href="/pro" className="button primary">
            Upgrade on the Pro Page →
          </Link>
        </p>
      </section>
    </InformationalPage>
  );
}
