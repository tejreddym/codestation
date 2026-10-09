import { metadataForPage } from "@/config/site";
import { InformationalPage } from "@/components/InformationalPage";
import { ProSubscriptionManager } from "@/components/ProSubscriptionManager";

export const metadata = metadataForPage(
  "/pro",
  "Code Station Pro — Local MCP Server & Power Tools",
  "Login-free Pro tier for AI assistants and developers. Unlocks local Model Context Protocol (MCP) server for Cursor and Claude Desktop."
);

export default function ProPage() {
  return (
    <InformationalPage
      title="Code Station Pro"
      intro="Zero-latency developer tools for AI coding assistants and power users. Login-free with cryptographic license keys."
    >
      <section>
        <h2>Why Code Station Pro?</h2>
        <p>
          AI models often hallucinate with date/time mathematics, timezone edge cases, complex regex
          parsing, or cryptographic hashes. Code Station Pro gives Cursor, Claude Desktop, Antigravity,
          and your CLI tools direct access to deterministically verified utilities through the open
          <strong> Model Context Protocol (MCP)</strong>.
        </p>

        <h3>Core Benefits</h3>
        <ul>
          <li>
            <strong>100% Login-Free:</strong> No passwords, email verification, or tracking accounts.
            Your license key is generated immediately upon payment.
          </li>
          <li>
            <strong>Cryptographic One-Way Hashing:</strong> Plaintext keys are never stored on our
            servers. Cloudflare edge nodes only verify one-way SHA-256 hashes.
          </li>
          <li>
            <strong>30-Day Offline Caching:</strong> Validated licenses are cached locally on your device
            (<code>~/.codestation/license.json</code>) so you can work completely offline.
          </li>
          <li>
            <strong>Sub-Millisecond Execution:</strong> Runs over local <code>stdio</code> with zero
            network latency and zero data leakage.
          </li>
        </ul>
      </section>

      <ProSubscriptionManager />

      <section style={{ marginTop: "40px" }}>
        <h2>Available Pro Tools</h2>
        <p>Your license unlocks these 9 specialized tools in addition to all 11 Free Tier tools:</p>
        <ul>
          <li><code>codestation_hash</code> — SHA-256, SHA-512, MD5, SHA-1, and CRC-32 checksums</li>
          <li><code>codestation_hmac</code> — HMAC authentication signatures with Web Crypto</li>
          <li><code>codestation_jwt_decode</code> — Inspect claims, headers, and signatures in device memory</li>
          <li><code>codestation_format_sql</code> — Multi-dialect SQL formatter (PostgreSQL, MySQL, SQLite, etc.)</li>
          <li><code>codestation_cron_explain</code> — Plain-English explanation for complex Unix crons</li>
          <li><code>codestation_timezone_convert</code> — High-precision IANA timezone conversions with DST accuracy</li>
          <li><code>codestation_business_days</code> — Working day calculations excluding weekends & holidays</li>
          <li><code>codestation_regex_test</code> — Regular expression tester with structured match groups</li>
          <li><code>codestation_json_schema</code> — Draft 2020-12 JSON Schema generation from raw JSON</li>
        </ul>
      </section>
    </InformationalPage>
  );
}
