import { metadataForPage } from "@/config/site";
import { InformationalPage } from "@/components/InformationalPage";
import { ProSubscriptionManager } from "@/components/ProSubscriptionManager";
import styles from "./pro.module.css";

export const metadata = metadataForPage(
  "/pro",
  "Code Station Pro — Local MCP Server & Power Tools",
  "Zero-latency Model Context Protocol (MCP) server & developer CLI for Cursor, Claude Desktop, and terminal workflows. Login-free with cryptographic license keys."
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
    purpose: "Instantly convert cURL to TypeScript fetch/axios, Python requests, or Go net/http.",
  },
  {
    id: "codestation_env_audit",
    cliCmd: "npx codestation-mcp env",
    name: "Secret & .env Leak Scanner",
    purpose: "Detect leaked Stripe, AWS, OpenAI, GitHub PAT keys and diff against .env.example.",
  },
  {
    id: "codestation_mock_data",
    cliCmd: "npx codestation-mcp mock",
    name: "Mock Data & SQL Seeder",
    purpose: "Generate realistic mock records & SQL INSERT statements for users, products, orders.",
  },
  {
    id: "codestation_git_conflict",
    cliCmd: "npx codestation-mcp conflict",
    name: "Git Merge Conflict Resolver",
    purpose: "Parse Git merge markers (<<<<<<< HEAD) and resolve with ours, theirs, or both.",
  },
  {
    id: "codestation_json_to_typescript",
    cliCmd: "npx codestation-mcp ts",
    name: "JSON to TypeScript Interfaces",
    purpose: "Generate clean, type-safe TypeScript interfaces from raw JSON payloads or files.",
  },
  {
    id: "codestation_json_to_zod",
    cliCmd: "npx codestation-mcp zod",
    name: "JSON to Zod Validation Schema",
    purpose: "Produce production-ready Zod schemas with inferred TypeScript types from JSON.",
  },
  {
    id: "codestation_jwt_decode",
    cliCmd: "npx codestation-mcp jwt",
    name: "JWT Decoder & Inspector",
    purpose: "Inspect claims, headers, expiration, and signatures in device memory without network leaks.",
  },
  {
    id: "codestation_format_sql",
    cliCmd: "npx codestation-mcp sql",
    name: "Multi-Dialect SQL Formatter",
    purpose: "Format and indent complex queries across PostgreSQL, MySQL, SQLite, and SQL Server.",
  },
  {
    id: "codestation_cron_explain",
    cliCmd: "npx codestation-mcp cron",
    name: "Unix Cron Parser & Projector",
    purpose: "Plain-English schedules and projected next 5 runtimes for 5-field cron strings.",
  },
  {
    id: "codestation_hash",
    cliCmd: "npx codestation-mcp hash",
    name: "Cryptographic Digest Engine",
    purpose: "Deterministic SHA-256, SHA-512, MD5, SHA-1, and CRC-32 checksums.",
  },
  {
    id: "codestation_hmac",
    name: "HMAC Signature Engine",
    purpose: "Generate HMAC authentication signatures using Web Crypto standards.",
  },
  {
    id: "codestation_timezone_convert",
    name: "IANA Timezone Converter",
    purpose: "DST-accurate timezone conversions using runtime IANA database rules.",
  },
  {
    id: "codestation_business_days",
    name: "Business Days Calculator",
    purpose: "Accurate working-day counts excluding weekends and optional holiday calendars.",
  },
  {
    id: "codestation_regex_test",
    name: "Regex Match Inspector",
    purpose: "Evaluate regular expressions against target text with structured match captures.",
  },
  {
    id: "codestation_json_schema",
    name: "JSON Schema Generator",
    purpose: "Infer Draft 2020-12 compliant JSON Schema documents from raw sample data.",
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
              Local MCP Server
            </span>
            <span className={styles.pillBadge}>
              <span className={styles.pillDot} />
              10 Terminal CLIs
            </span>
            <span className={styles.pillBadge}>Zero Latency • Zero Tracking</span>
          </div>

          <h2 className={styles.heroTitle}>Supercharge Cursor, Claude & Your Terminal</h2>

          <p className={styles.heroLead}>
            AI assistants frequently hallucinate when dealing with date mathematics, timezone edge cases,
            cryptographic digests, and regex parsing. Code Station Pro equips <strong>Cursor, Claude Desktop, Windsurf, and Claude Code</strong> with
            15 deterministic local tools over the open <strong>Model Context Protocol (MCP)</strong>, alongside 10 lightning-fast terminal subcommands.
          </p>

          <div className={styles.terminalBox}>
            <div className={styles.terminalHeader}>
              <span className={`${styles.termDot} ${styles.termDotRed}`} />
              <span className={`${styles.termDot} ${styles.termDotYellow}`} />
              <span className={`${styles.termDot} ${styles.termDotGreen}`} />
              <span className={styles.termTitle}>bash — 1-click setup</span>
            </div>
            <div>
              <span className={styles.termPrompt}>$</span>
              <span>npx codestation-mcp setup --key CS-PRO-••••-••••</span>
            </div>
            <div className={styles.termSuccess}>
              ✔ Cursor IDE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Configured (~/Library/Application Support/Cursor/...)
            </div>
            <div className={styles.termSuccess}>
              ✔ Claude Desktop&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Configured (~/Library/Application Support/Claude/...)
            </div>
            <div className={styles.termSuccess}>
              ✔ Windsurf&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Configured (~/.codeium/windsurf/mcp_config.json)
            </div>
            <div className={styles.termAccent}>
              ✨ Setup complete! 15 local tools ready for your AI assistant.
            </div>
          </div>
        </section>

        {/* --- Core Pro Perks Grid --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Pro Architecture</span>
            <h3 className={styles.sectionTitle}>Why Developers & AI Teams Choose Pro</h3>
            <p className={styles.sectionSubtitle}>
              Engineered from the ground up for maximum privacy, zero friction, and sub-millisecond execution.
            </p>
          </div>

          <div className={styles.perksGrid}>
            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap}>🤖</div>
              <h4 className={styles.perkTitle}>Native AI Assistant Tools</h4>
              <p className={styles.perkDesc}>
                Connect Cursor, Claude Desktop, Windsurf, and Claude Code via Model Context Protocol. Eliminates model hallucinations in timezone math, cryptographic hashing, and regex evaluation.
              </p>
              <span className={styles.perkTag}>MCP Protocol</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap}>⚡</div>
              <h4 className={styles.perkTitle}>10+ Terminal Subcommands</h4>
              <p className={styles.perkDesc}>
                Run <code>jwt</code>, <code>sql</code>, <code>cron</code>, <code>hash</code>, <code>curl</code>, <code>env</code>, <code>mock</code>, <code>conflict</code>, <code>ts</code>, <code>zod</code> directly in your terminal without opening a browser.
              </p>
              <span className={styles.perkTag}>CLI Workflows</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap}>🔑</div>
              <h4 className={styles.perkTitle}>100% Login-Free Privacy</h4>
              <p className={styles.perkDesc}>
                No passwords, no spam emails, and no tracking databases. Your cryptographic license key is delivered instantly and verified at edge using one-way SHA-256 hashes.
              </p>
              <span className={styles.perkTag}>Edge Crypto</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap}>💻</div>
              <h4 className={styles.perkTitle}>3-Device Seat Allocation</h4>
              <p className={styles.perkDesc}>
                Use your single Pro key concurrently across up to 3 machines (e.g. MacBook, Linux workstation, home desktop) with intelligent machine-fingerprint management.
              </p>
              <span className={styles.perkTag}>Multi-Device</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap}>✈️</div>
              <h4 className={styles.perkTitle}>30-Day Air-Gapped Offline</h4>
              <p className={styles.perkDesc}>
                Validated licenses are cached locally on your device (<code>~/.codestation/license.json</code>). Work completely offline on flights or remote without internet pings.
              </p>
              <span className={styles.perkTag}>Offline First</span>
            </div>

            <div className={styles.perkCard}>
              <div className={styles.perkIconWrap}>🛡️</div>
              <h4 className={styles.perkTitle}>Secret & Leak Scanner</h4>
              <p className={styles.perkDesc}>
                Audit your local <code>.env</code> files before git commits. Flags exposed live Stripe keys, AWS IAM tokens, OpenAI keys, GitHub PATs, and private keys.
              </p>
              <span className={styles.perkTag}>Security Station</span>
            </div>
          </div>
        </section>

        {/* --- Interactive Subscription Manager --- */}
        <section id="pricing">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Instant Access</span>
            <h3 className={styles.sectionTitle}>Get Code Station Pro</h3>
            <p className={styles.sectionSubtitle}>
              Select monthly flexibility or save with lifetime access. Instant activation key generated upon payment.
            </p>
          </div>

          <ProSubscriptionManager />
        </section>

        {/* --- Available Pro Tools Catalog --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Capabilities Catalog</span>
            <h3 className={styles.sectionTitle}>15 Dedicated Pro MCP & CLI Tools</h3>
            <p className={styles.sectionSubtitle}>
              Available to your AI agents via stdio and callable directly from your command line.
            </p>
          </div>

          <div className={styles.toolsGrid}>
            {PRO_TOOLS_LIST.map((tool) => (
              <div key={tool.id} className={styles.toolItem}>
                <div className={styles.toolNameRow}>
                  <span className={styles.toolCodeName}>{tool.id}</span>
                  {tool.cliCmd && <span className={styles.toolCliBadge}>CLI Ready</span>}
                </div>
                <p className={styles.toolPurpose}>{tool.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- Comparison Matrix --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Feature Matrix</span>
            <h3 className={styles.sectionTitle}>Free Web Toolbox vs Pro MCP & CLI</h3>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th className={styles.featureCol}>Capability</th>
                  <th className={styles.freeCol}>Free Web App</th>
                  <th className={styles.proCol}>Pro Tier</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.featureCol}>Web App (codestation.in)</td>
                  <td className={styles.freeCol}><span className={styles.check}>✔</span> 250+ Free Tools</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> 250+ Free Tools</td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Model Context Protocol (MCP) Server</td>
                  <td className={styles.freeCol}><span className={styles.cross}>✖</span> Not included</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> 15 Native Tools</td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Cursor, Claude Desktop & Windsurf Setup</td>
                  <td className={styles.freeCol}><span className={styles.cross}>✖</span> Not included</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> 1-Click Auto-Setup</td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Terminal Subcommands (npx codestation-mcp)</td>
                  <td className={styles.freeCol}><span className={styles.cross}>✖</span> Limited</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> 10+ Subcommands</td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Secret Leak & .env Scanner</td>
                  <td className={styles.freeCol}><span className={styles.cross}>✖</span> Web only</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> Terminal & MCP</td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Concurrent Device Seats</td>
                  <td className={styles.freeCol}>Browser session</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> Up to 3 Devices</td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Air-Gapped Offline Caching</td>
                  <td className={styles.freeCol}>Online required</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> 30-Day Cache</td>
                </tr>
                <tr>
                  <td className={styles.featureCol}>Data Privacy</td>
                  <td className={styles.freeCol}>Client-side in browser</td>
                  <td className={styles.proCol}><span className={styles.check}>✔</span> Local stdio memory</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* --- Frequently Asked Questions --- */}
        <section>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionKicker}>Questions & Answers</span>
            <h3 className={styles.sectionTitle}>Frequently Asked Questions</h3>
          </div>

          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <h4 className={styles.faqQuestion}>Do I need an account or password?</h4>
              <p className={styles.faqAnswer}>
                No! Code Station has no user accounts, passwords, or tracking cookies. Upon checkout, you receive a cryptographic license key (e.g. <code>CS-PRO-XXXX-XXXX</code>) that activates your tools instantly.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h4 className={styles.faqQuestion}>How do I activate Cursor or Claude Desktop?</h4>
              <p className={styles.faqAnswer}>
                Simply open your terminal and run <code>npx codestation-mcp setup --key YOUR_KEY</code>. The CLI detects your installed editors, safely merges the configuration, and activates the tools automatically.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h4 className={styles.faqQuestion}>How does 3-device binding work?</h4>
              <p className={styles.faqAnswer}>
                Your license allows up to 3 active machines concurrently (e.g., your work laptop, home PC, and a secondary machine). If you switch computers, you can deactivate older machines effortlessly.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h4 className={styles.faqQuestion}>Are all the tools on the website free?</h4>
              <p className={styles.faqAnswer}>
                Yes! All 250+ tools on codestation.in are 100% free with no paywalls or signups. The Pro subscription is strictly for local MCP AI Assistant integration and command-line terminal power tools.
              </p>
            </div>
          </div>
        </section>
      </div>
    </InformationalPage>
  );
}
