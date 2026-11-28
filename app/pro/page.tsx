import Link from "next/link";
import { metadataForPage } from "@/config/site";
import mcpCatalog from "@/config/mcp-docs-catalog.json";
import { INDIVIDUAL_PRICING, TEAM_PRICING } from "@/lib/license/pricing";
import { InformationalPage } from "@/components/InformationalPage";
import { ProSubscriptionManager } from "@/components/ProSubscriptionManager";
import styles from "./pro.module.css";

export const metadata = metadataForPage(
  "/pro",
  "Code Station Pro — Local MCP Server & Power Tools",
  "Zero-latency Model Context Protocol (MCP) server & developer CLI for Cursor, Claude Desktop, and terminal workflows. Login-free with cryptographic license keys.",
);

interface ProToolItem {
  id: string;
  cliCmd?: string;
  name: string;
  purpose: string;
}

const PRO_TOOLS_LIST: ProToolItem[] = [
  {
    id: "codestation_curl_to_code",
    cliCmd: "npx codestation-mcp curl",
    name: "cURL to Code Generator",
    purpose:
      "Instantly convert cURL to TypeScript fetch/axios, Python requests, or Go net/http.",
  },
  {
    id: "codestation_env_audit",
    cliCmd: "npx codestation-mcp env",
    name: "Secret & .env Leak Scanner",
    purpose:
      "Detect leaked Stripe, AWS, OpenAI, GitHub PAT keys and diff against .env.example.",
  },
  {
    id: "codestation_mock_data",
    cliCmd: "npx codestation-mcp mock",
    name: "Mock Data & SQL Seeder",
    purpose:
      "Generate realistic mock records & SQL INSERT statements for users, products, orders.",
  },
  {
    id: "codestation_git_conflict",
    cliCmd: "npx codestation-mcp conflict",
    name: "Git Merge Conflict Resolver",
    purpose:
      "Parse Git merge markers (<<<<<<< HEAD) and resolve with ours, theirs, or both.",
  },
  {
    id: "codestation_json_to_typescript",
    cliCmd: "npx codestation-mcp ts",
    name: "JSON to TypeScript Interfaces",
    purpose:
      "Generate clean, type-safe TypeScript interfaces from raw JSON payloads or files.",
  },
  {
    id: "codestation_json_to_zod",
    cliCmd: "npx codestation-mcp zod",
    name: "JSON to Zod Validation Schema",
    purpose:
      "Produce production-ready Zod schemas with inferred TypeScript types from JSON.",
  },
  {
    id: "codestation_jwt_decode",
    cliCmd: "npx codestation-mcp jwt",
    name: "JWT Decoder & Inspector",
    purpose:
      "Inspect claims, headers, expiration, and signatures in device memory without network leaks.",
  },
  {
    id: "codestation_format_sql",
    cliCmd: "npx codestation-mcp sql",
    name: "Multi-Dialect SQL Formatter",
    purpose:
      "Format and indent complex queries across PostgreSQL, MySQL, SQLite, and SQL Server.",
  },
  {
    id: "codestation_cron_explain",
    cliCmd: "npx codestation-mcp cron",
    name: "Unix Cron Parser & Projector",
    purpose:
      "Plain-English schedules and projected next 5 runtimes for 5-field cron strings.",
  },
  {
    id: "codestation_hash",
    cliCmd: "npx codestation-mcp hash",
    name: "Cryptographic Digest Engine",
    purpose:
      "Deterministic SHA-256, SHA-512, MD5, SHA-1, and CRC-32 checksums.",
  },
  {
    id: "codestation_hmac",
    name: "HMAC Signature Engine",
    purpose:
      "Generate HMAC authentication signatures using Web Crypto standards.",
  },
  {
    id: "codestation_timezone_convert",
    name: "IANA Timezone Converter",
    purpose:
      "DST-accurate timezone conversions using runtime IANA database rules.",
  },
  {
    id: "codestation_business_days",
    name: "Business Days Calculator",
    purpose:
      "Accurate working-day counts excluding weekends and optional holiday calendars.",
  },
  {
    id: "codestation_regex_test",
    name: "Regex Match Inspector",
    purpose:
      "Evaluate regular expressions against target text with structured match captures.",
  },
  {
    id: "codestation_json_schema",
    name: "JSON Schema Generator",
    purpose:
      "Infer Draft 2020-12 compliant JSON Schema documents from raw sample data.",
  },
];

export default function ProPage() {
  return (
    <InformationalPage
      title="Code Station Pro"
      intro="Zero-latency developer tools for AI coding assistants and power terminal users. Login-free with cryptographic license keys."
    >
      <div className={styles.proContainer}>
        {/* --- Hero Banner & Terminal Preview --- */}
        <section className={styles.heroBanner}>
          <div className={styles.badgeRow}>
            <span className={styles.pillBadge}>
              <span className={styles.pillDot} />
              {mcpCatalog.counts.executableTotal} Local MCP &amp; CLI Tools
            </span>
            <span className={styles.pillBadge}>
              <span className={styles.pillDot} />
              {mcpCatalog.counts.nodePure} Pure Node + {mcpCatalog.counts.nodeFileWired} File Handlers
            </span>
            <span className={styles.pillBadge}>
              Zero Latency • 14-Day Offline Grace
            </span>
          </div>

          <h2 className={styles.heroTitle}>
            Supercharge Cursor, Claude Desktop, VS Code &amp; Your Terminal
          </h2>

          <p className={styles.heroLead}>
            Stop AI hallucinations on timezone arithmetic, cryptographic digests,
            SQL ASTs, PDFs, spreadsheets, and ZIP archives. Free tier unlocks{" "}
            <strong>3 universal discovery tools + {mcpCatalog.counts.freeExecutable} core utilities</strong>;
            Code Station Pro unlocks all{" "}
            <strong>{mcpCatalog.counts.executableTotal} local tools</strong>{" "}
            ({mcpCatalog.counts.nodePure} in-memory <code>node-pure</code> +{" "}
            {mcpCatalog.counts.nodeFileWired} local <code>node-file</code> handlers)
            over stdio MCP and a pipeable Unix CLI.
          </p>

          <div className={styles.terminalBox}>
            <div className={styles.terminalHeader}>
              <span className={`${styles.termDot} ${styles.termDotRed}`} />
              <span className={`${styles.termDot} ${styles.termDotYellow}`} />
              <span className={`${styles.termDot} ${styles.termDotGreen}`} />
              <span className={styles.termTitle}>bash — 1-click setup &amp; piping</span>
            </div>
            <div>
              <span className={styles.termPrompt}>$</span>
              <span>npx codestation-mcp setup --key CS-PRO-••••-••••</span>
            </div>
            <div>
              <span className={styles.termPrompt}>$</span>
              <span>cat schema.json | codestation run json-to-zod</span>
            </div>
            <div className={styles.termSuccess}>
              ✔ Cursor / Claude Desktop / Windsurf / VS Code configured
            </div>
            <div className={styles.termAccent}>
              ✨ {mcpCatalog.counts.executableTotal} local tools ready (0 telemetry · 14-day offline cache).
            </div>
          </div>
        </section>

        {/* --- Core Pro Perks Grid --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Pro Architecture</span>
            <h2 className={styles.sectionTitle}>
              Why Developers & AI Teams Choose Pro
            </h2>
            <p className={styles.sectionSubtitle}>
              Engineered from the ground up for maximum privacy, zero friction,
              and sub-millisecond execution.
            </p>
          </div>

          <div className={styles.perksGrid}>
            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap} aria-hidden="true">🤖</div>
              <h3 className={styles.perkTitle}>Native AI Assistant Tools</h3>
              <p className={styles.perkDesc}>
                Connect Cursor, Claude Desktop, Windsurf, and Claude Code via
                Model Context Protocol. Eliminates model hallucinations in
                timezone math, cryptographic hashing, and regex evaluation.
              </p>
              <span className={styles.perkTag}>MCP Protocol</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap} aria-hidden="true">⚡</div>
              <h3 className={styles.perkTitle}>Pipeable CLI &amp; Local Files</h3>
              <p className={styles.perkDesc}>
                Pipe data with <code>codestation run json-to-yaml</code> or process
                PDFs, Excel workbooks, ZIP archives, and SVGs directly on disk via{" "}
                <code>--in</code> / <code>--out</code> with zero native addons.
              </p>
              <span className={styles.perkTag}>CLI Workflows</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap} aria-hidden="true">🔑</div>
              <h3 className={styles.perkTitle}>100% Login-Free Privacy</h3>
              <p className={styles.perkDesc}>
                No passwords, no spam emails, and no tracking databases. Your
                cryptographic license key is delivered instantly and verified at
                edge using one-way SHA-256 hashes.
              </p>
              <span className={styles.perkTag}>Edge Crypto</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap} aria-hidden="true">💻</div>
              <h3 className={styles.perkTitle}>3-Device Seat Allocation</h3>
              <p className={styles.perkDesc}>
                Use your single Pro key concurrently across up to 3 machines
                (e.g. MacBook, Linux workstation, home desktop) with intelligent
                machine-fingerprint management.
              </p>
              <span className={styles.perkTag}>Multi-Device</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap} aria-hidden="true">✈️</div>
              <h3 className={styles.perkTitle}>14-Day Air-Gapped Offline Grace</h3>
              <p className={styles.perkDesc}>
                Validated licenses are cached locally in{" "}
                <code>~/.codestation/license.json</code> (<code>0600</code>) with a
                14-day offline grace window and silent background revalidation when
                back online.
              </p>
              <span className={styles.perkTag}>Offline First</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap} aria-hidden="true">🛡️</div>
              <h3 className={styles.perkTitle}>Secret & Leak Scanner</h3>
              <p className={styles.perkDesc}>
                Audit your local <code>.env</code> files before git commits.
                Flags exposed live Stripe keys, AWS IAM tokens, OpenAI keys,
                GitHub PATs, and private keys.
              </p>
              <span className={styles.perkTag}>Security Station</span>
            </div>
          </div>
        </section>

        {/* --- Interactive Subscription Manager --- */}
        <section id="pricing">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Instant Access</span>
            <h2 className={styles.sectionTitle}>Get Code Station Pro</h2>
            <p className={styles.sectionSubtitle}>
              Select monthly flexibility or save with lifetime access. Instant
              activation key generated upon payment.
            </p>
          </div>

          <ProSubscriptionManager />
        </section>

        {/* --- Available Pro Tools Catalog --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Capabilities Catalog</span>
            <h2 className={styles.sectionTitle}>
              {mcpCatalog.counts.executableTotal} Local MCP &amp; CLI Tools (Highlights)
            </h2>
            <p className={styles.sectionSubtitle}>
              High-demand tools callable over stdio MCP or directly in your terminal —{" "}
              <Link href="/docs#tool-catalog">browse all {mcpCatalog.counts.executableTotal} tools</Link>.
            </p>
          </div>

          <div className={styles.toolsGrid}>
            {PRO_TOOLS_LIST.map((tool) => (
              <div key={tool.id} className={styles.toolItem}>
                <div className={styles.toolNameRow}>
                  <span className={styles.toolCodeName}>{tool.id}</span>
                  {tool.cliCmd && (
                    <span className={styles.toolCliBadge}>CLI Ready</span>
                  )}
                </div>
                <p className={styles.toolPurpose}>{tool.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- Comparison Matrix --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Plan Comparison</span>
            <h2 className={styles.sectionTitle}>
              Free Browser &amp; Core vs. Pro Individual vs. Team Seats
            </h2>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th className={styles.featureCol}>Capability</th>
                  <th className={styles.freeCol}>Free Tier</th>
                  <th className={styles.proCol}>
                    Pro Individual (₹{INDIVIDUAL_PRICING.monthly.amountInr}/mo)
                  </th>
                  <th className={styles.proCol}>
                    Team Seats (₹{TEAM_PRICING[5].amountInr}–₹{TEAM_PRICING[25].amountInr}/mo)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.featureCol}>
                    Web App (<code>codestation.in</code>)
                  </td>
                  <td className={styles.freeCol}>
                    <span className={styles.check}>✔</span> 383 Browser Tools Free
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> 383 Browser Tools Free
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> 383 Browser Tools Free
                  </td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>
                    MCP Server &amp; Pipeable CLI Tools
                  </td>
                  <td className={styles.freeCol}>
                    {mcpCatalog.counts.universalMetaTools} Meta + {mcpCatalog.counts.freeExecutable} Core Free Tools
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> All {mcpCatalog.counts.executableTotal} Tools
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> All {mcpCatalog.counts.executableTotal} Tools
                  </td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>
                    Local File Processing (PDF, XLSX, ZIP, SVG)
                  </td>
                  <td className={styles.freeCol}>
                    <span className={styles.cross}>✖</span> Browser UI only
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> {mcpCatalog.counts.nodeFileWired} Node File Tools
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> {mcpCatalog.counts.nodeFileWired} Node File Tools
                  </td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>
                    <code>--stations=</code> Direct Tool Expansion
                  </td>
                  <td className={styles.freeCol}>
                    <span className={styles.cross}>✖</span> Not included
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> Full Station Expansion
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> Full Station Expansion
                  </td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Concurrent Device Seats</td>
                  <td className={styles.freeCol}>No key required</td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> {INDIVIDUAL_PRICING.monthly.seatLimit} Personal Devices
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> 5, 10, or 25 Team Seats
                  </td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Organization &amp; Seat Controls</td>
                  <td className={styles.freeCol}>
                    <span className={styles.cross}>✖</span> Not applicable
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> Self-Serve Seat Reset
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> Org Metadata &amp; Per-Seat Revoke
                  </td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>
                    Pricing Options (INR / Global USD)
                  </td>
                  <td className={styles.freeCol}>₹0 / $0 Forever</td>
                  <td className={styles.proCol}>
                    ₹{INDIVIDUAL_PRICING.monthly.amountInr}/mo ({INDIVIDUAL_PRICING.monthly.usdDisplay}) · ₹{INDIVIDUAL_PRICING.lifetime.amountInr} ({INDIVIDUAL_PRICING.lifetime.usdDisplay})
                  </td>
                  <td className={styles.proCol}>
                    From ₹{TEAM_PRICING[5].amountInr}/mo ({TEAM_PRICING[5].usdDisplay})
                  </td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>
                    Offline Grace &amp; Data Privacy
                  </td>
                  <td className={styles.freeCol}>Browser / Local memory</td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> 14-Day Cache · 0 Telemetry
                  </td>
                  <td className={styles.proCol}>
                    <span className={styles.check}>✔</span> 14-Day Cache · 0 Telemetry
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* --- Frequently Asked Questions --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Questions & Answers</span>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          </div>

          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <h3 className={styles.faqQuestion}>
                Do I need an account or password?
              </h3>
              <p className={styles.faqAnswer}>
                No! Code Station has no user accounts, passwords, or tracking
                cookies. Upon checkout, you receive a cryptographic license key
                (e.g. <code>CS-PRO-XXXX-XXXX</code>) that activates your tools
                instantly.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqQuestion}>
                How do I activate Cursor or Claude Desktop?
              </h3>
              <p className={styles.faqAnswer}>
                Simply open your terminal and run{" "}
                <code>npx codestation-mcp setup --key YOUR_KEY</code>. The CLI
                detects your installed editors, safely merges the configuration,
                and activates the tools automatically.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqQuestion}>
                How does 3-device binding work?
              </h3>
              <p className={styles.faqAnswer}>
                Your license allows up to 3 active machines concurrently (e.g.,
                your work laptop, home PC, and a secondary machine). If you
                switch computers, you can deactivate older machines
                effortlessly.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqQuestion}>
                What happens if I lose my license key?
              </h3>
              <p className={styles.faqAnswer}>
                For privacy, Code Station never stores plaintext keys on servers
                (only one-way SHA-256 hashes for edge verification). If you lose
                your key, email{" "}
                <strong>
                  <a href="mailto:hello@codestation.in">hello@codestation.in</a>
                </strong>{" "}
                with your <strong>Razorpay Payment ID</strong> (e.g.{" "}
                <code>pay_...</code>) or payment receipt screenshot. We will
                revoke the lost key hash in Cloudflare KV and issue a brand-new
                replacement key.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqQuestion}>
                What is the Key Regeneration Fee policy?
              </h3>
              <p className={styles.faqAnswer}>
                To discourage key sharing and unauthorized redistribution,
                license regeneration requires a progressive administrative fee:{" "}
                <strong>₹25 for the 1st recovery</strong>, doubling each
                subsequent time (<strong>₹50</strong> for 2nd,{" "}
                <strong>₹100</strong> for 3rd, <strong>₹200</strong> for 4th,
                etc.). We send a quick payment link before reissuing the
                replacement key.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqQuestion}>
                Are all the tools on the website free?
              </h3>
              <p className={styles.faqAnswer}>
                Yes! All 383 developer tools on codestation.in are 100% free with
                no paywalls or signups, plus 15 core CLI &amp; MCP utilities free
                without a key. Code Station Pro unlocks all{" "}
                {mcpCatalog.counts.executableTotal} local MCP &amp; CLI tools,
                local file processing, and multi-seat team licenses.
              </p>
            </div>
          </div>
        </section>
      </div>
    </InformationalPage>
  );
}
