"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CopySnippet } from "@/components/CopySnippet";
import NativeAd from "@/components/NativeAd";
import BannerAd from "@/components/BannerAd";
import styles from "./DocsRepo.module.css";

interface DocTopic {
  id: string;
  category: "quickstart" | "cli" | "mcp" | "ai" | "catalog" | "web" | "licensing" | "lostkey" | "security" | "faq";
  title: string;
  keywords: string[];
}

const TOPICS: DocTopic[] = [
  { id: "quickstart", category: "quickstart", title: "1-Click Auto Setup & Prerequisites", keywords: ["install", "setup", "quickstart", "node", "npx", "start"] },
  { id: "cli-overview", category: "cli", title: "Terminal CLI Overview & Piping", keywords: ["cli", "terminal", "command", "pipe", "stdin", "subcommands"] },
  { id: "cli-curl", category: "cli", title: "cURL to Code (Fetch, Axios, Python, Go)", keywords: ["curl", "fetch", "axios", "python", "go", "http", "api", "request"] },
  { id: "cli-env", category: "cli", title: "Environment Secret Scanner (env-audit)", keywords: ["env", "secrets", "leak", "stripe", "aws", "openai", "github", "audit", "security"] },
  { id: "cli-mock", category: "cli", title: "Realistic Mock Data & SQL Seeder", keywords: ["mock", "data", "seed", "faker", "sql", "insert", "users", "products", "orders"] },
  { id: "cli-conflict", category: "cli", title: "Git Merge Conflict Resolver", keywords: ["git", "conflict", "merge", "ours", "theirs", "both", "head", "branch"] },
  { id: "cli-jwt", category: "cli", title: "JWT Token Inspector", keywords: ["jwt", "token", "decode", "claims", "header", "expiry", "ttl"] },
  { id: "cli-sql", category: "cli", title: "SQL Formatter & Dialects", keywords: ["sql", "format", "beautify", "postgres", "mysql", "sqlite", "sqlserver"] },
  { id: "cli-cron", category: "cli", title: "Cron Translator & Next Runtimes", keywords: ["cron", "schedule", "explain", "next", "projection"] },
  { id: "cli-hash", category: "cli", title: "Cryptographic Hashes & Digests", keywords: ["hash", "sha256", "sha512", "md5", "sha1", "crc32", "crypto"] },
  { id: "cli-types", category: "cli", title: "JSON to TypeScript & Zod Schema", keywords: ["typescript", "zod", "types", "interface", "schema", "json"] },
  { id: "cli-uuid-json", category: "cli", title: "UUID Generator & JSON Formatter", keywords: ["uuid", "v4", "json", "lint", "minify", "beautify"] },
  { id: "mcp-protocol", category: "mcp", title: "MCP Stdio Protocol & RPC Methods", keywords: ["mcp", "protocol", "rpc", "stdio", "tools.list", "tools/call", "json-rpc"] },
  { id: "ai-assistants", category: "ai", title: "AI Assistant Configurations (Claude, Cursor, Windsurf)", keywords: ["claude", "cursor", "windsurf", "cline", "ai", "mcp config", "assistant"] },
  { id: "ai-prompt", category: "ai", title: "Copy-Pastable AI System Prompt & Rules", keywords: ["prompt", "system", "rules", ".cursorrules", "claude.md", "guidelines"] },
  { id: "tool-catalog", category: "catalog", title: "MCP Tool Capability Matrix (20+ Tools)", keywords: ["catalog", "tools", "capabilities", "free", "pro", "matrix"] },
  { id: "web-stations", category: "web", title: "Web Application & 15 Stations Directory", keywords: ["web", "stations", "browser", "free", "sandbox", "wasm", "webcrypto"] },
  { id: "licensing", category: "licensing", title: "Pro Licensing & Device Binding", keywords: ["license", "pro", "pricing", "device", "razorpay", "upi", "activation"] },
  { id: "lost-key-recovery", category: "lostkey", title: "Lost Key Recovery Policy & Fee Schedule", keywords: ["lost", "key", "recovery", "email", "fee", "regeneration", "razorpay"] },
  { id: "security-privacy", category: "security", title: "Zero-Telemetry & Privacy Architecture", keywords: ["privacy", "security", "telemetry", "sha256", "cloudflare", "kv", "offline"] },
  { id: "troubleshooting", category: "faq", title: "Troubleshooting, Errors & FAQs", keywords: ["faq", "errors", "troubleshooting", "permission", "node", "proxy"] },
];

const CATEGORIES = [
  { id: "all", label: "All Docs" },
  { id: "quickstart", label: "⚡ Quickstart" },
  { id: "cli", label: "💻 Terminal CLI" },
  { id: "mcp", label: "📡 MCP Protocol" },
  { id: "ai", label: "🤖 AI Agents" },
  { id: "catalog", label: "🛠️ Tool Catalog" },
  { id: "web", label: "🌐 Web Stations" },
  { id: "licensing", label: "🔑 Pro Licensing" },
  { id: "lostkey", label: "🔄 Lost Key Recovery" },
  { id: "security", label: "🛡️ Security & Privacy" },
  { id: "faq", label: "❓ Troubleshooting" },
] as const;

export function DocsRepo() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOPICS.filter((t) => {
      const matchesCat = selectedCategory === "all" || t.category === selectedCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [query, selectedCategory]);

  const activeIds = useMemo(() => new Set(filteredTopics.map((t) => t.id)), [filteredTopics]);

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.topBar}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Documentation Repository</span>
        </nav>
        <div className={styles.titleArea}>
          <div>
            <span className="eyebrow bracket-label">CODE STATION / KNOWLEDGE REPO &amp; SPECIFICATION</span>
            <h1>Documentation Repository</h1>
            <p>
              Authoritative developer reference manual for the Code Station Local Model Context Protocol (MCP) server,
              dual-purpose terminal CLI, 338+ client-side web tools, AI coding agent workflows, and licensing policies.
            </p>
          </div>
          <div className={styles.repoBadge}>
            <span className={styles.badgePulse} aria-hidden="true" />
            <span>v1.2.0 • Node 22+ • 100% Offline-Ready</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className={styles.searchToolbar}>
        <div className={styles.searchInputWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, tools, flags, schemas, and policies (e.g., curl, env, jwt, mock, recovery, cursor)..."
            className={styles.searchInput}
            aria-label="Filter documentation topics"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="button"
              style={{ padding: "3px 8px", fontSize: "12px", border: "none" }}
            >
              Clear
            </button>
          ) : (
            <span className={styles.searchKbd}>Esc to reset</span>
          )}
        </div>

        <div className={styles.categoryPills}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`${styles.pillBtn} ${selectedCategory === cat.id ? styles.pillBtnActive : ""}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opt-in Adsterra Native Banner */}
      <NativeAd className={styles.adContainer} />

      {/* Main 2-Column Documentation Layout */}
      <div className={styles.docsLayout}>
        {/* Sticky Sidebar Navigation */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeading}>Table of Contents ({filteredTopics.length})</div>
            <ul className={styles.sidebarList}>
              {filteredTopics.map((topic) => (
                <li key={topic.id}>
                  <a href={`#${topic.id}`} className={styles.sidebarLink}>
                    <span>{topic.title}</span>
                  </a>
                </li>
              ))}
              {filteredTopics.length === 0 && (
                <li style={{ padding: "8px", color: "var(--muted)", fontSize: "13px" }}>
                  No matching documentation articles.
                </li>
              )}
            </ul>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeading}>Quick Resources</div>
            <ul className={styles.sidebarList}>
              <li>
                <Link href="/pro" className={styles.sidebarLink}>
                  <span>Pro Activation &amp; Keys</span>
                  <span className={styles.sidebarCount}>PRO</span>
                </Link>
              </li>
              <li>
                <Link href="/tools" className={styles.sidebarLink}>
                  <span>Web Tools Directory</span>
                  <span className={styles.sidebarCount}>338</span>
                </Link>
              </li>
              <li>
                <a href="https://www.npmjs.com/package/codestation-mcp" target="_blank" rel="noreferrer" className={styles.sidebarLink}>
                  <span>npm Package</span>
                  <span className={styles.sidebarCount}>↗</span>
                </a>
              </li>
              <li>
                <a href="mailto:twnspace2@gmail.com" className={styles.sidebarLink}>
                  <span>Key Support &amp; Recovery</span>
                  <span className={styles.sidebarCount}>Email</span>
                </a>
              </li>
            </ul>
          </div>
        </aside>

        {/* Core Content Area */}
        <main className={styles.docsContent}>
          {/* 1. Quickstart & Auto-Setup */}
          {activeIds.has("quickstart") && (
            <section id="quickstart" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>1. Quickstart &amp; 1-Click Auto Setup</h2>
                <span className={styles.sectionTag}>Getting Started</span>
              </div>
              <p className={styles.leadText}>
                Code Station gives you deterministic developer tools across three interfaces:
                a <strong>100% Free Web Application</strong> with 338+ client-side tools, a <strong>Local MCP Server</strong> for AI coding agents (Cursor, Claude Desktop, Windsurf),
                and a <strong>Dual-Purpose Terminal CLI</strong>.
              </p>

              <div className={styles.callout}>
                <strong>System Prerequisites:</strong> Requires <strong>Node.js &gt;= 22.13.0</strong> (with native WebCrypto and modern ESM support) and <code>npm &gt;= 10.9</code>.
                No global installation is strictly required; you can execute everything on-demand via <code>npx -y codestation-mcp</code>.
              </div>

              <div className={styles.subSection}>
                <h3>1-Click AI Assistant Auto-Setup</h3>
                <p>
                  Automatically detects your installed AI environments and registers the Code Station MCP server in Claude Desktop, Cursor IDE, and Windsurf in a single command:
                </p>
                <CopySnippet
                  title="Terminal (Pro 1-Click Setup)"
                  code="npx -y codestation-mcp setup --key CS-PRO-YOUR-KEY"
                  language="bash"
                />
                <p>Or configure with the Free tier (all standard tools enabled):</p>
                <CopySnippet
                  title="Terminal (Free 1-Click Setup)"
                  code="npx -y codestation-mcp setup"
                  language="bash"
                />
              </div>

              <div className={styles.subSection}>
                <h3>Global CLI Installation (Optional)</h3>
                <p>
                  To make the short command <code>codestation</code> or <code>codestation-mcp</code> globally accessible in your terminal without typing <code>npx</code>:
                </p>
                <CopySnippet
                  title="Terminal (Global Install)"
                  code="npm install -g codestation-mcp"
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 2. CLI Overview */}
          {activeIds.has("cli-overview") && (
            <section id="cli-overview" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>2. Terminal Developer CLI &amp; Unix Piping</h2>
                <span className={styles.sectionTag}>CLI Power Engine</span>
              </div>
              <p className={styles.leadText}>
                The <code>codestation-mcp</code> binary is engineered to be dual-purpose: when invoked with subcommands,
                it behaves as an ultra-fast terminal utility with exit codes, formatted colors, and Unix pipe support.
              </p>

              <div className={styles.callout + " " + styles.tip}>
                <strong>Unix Stdin Piping:</strong> All subcommands accept piped input via <code>stdin</code>.
                For instance, <code>cat request.curl | npx codestation-mcp curl --target go</code> or <code>cat data.json | npx codestation-mcp ts Profile</code>.
              </div>

              <CopySnippet
                title="Terminal CLI Subcommand Syntax"
                code={`# General Syntax
npx codestation-mcp <command> [input_or_file] [flags]

# Or with global install
codestation <command> [input_or_file] [flags]`}
                language="bash"
              />
            </section>
          )}

          {/* 3. CLI: cURL to Any Language */}
          {activeIds.has("cli-curl") && (
            <section id="cli-curl" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>3. cURL to Any Language (curl / curl-to-code)</h2>
                <span className={styles.sectionTag}>Terminal Subcommand</span>
              </div>
              <p className={styles.leadText}>
                Converts raw cURL commands into clean, idiomatic client code for TypeScript fetch, Axios, Python requests, and Go <code>net/http</code>.
                Handles query parameters, headers (<code>-H</code>), custom HTTP methods (<code>-X POST/PUT/PATCH/DELETE</code>), JSON payloads (<code>-d</code>, <code>--data-raw</code>), and basic authentication (<code>-u</code>).
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>curl &lt;command&gt; [--target &lt;lang&gt;]</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Example: cURL to TypeScript Fetch"
                  code={`npx codestation-mcp curl 'curl -X POST https://api.stripe.com/v1/charges -u sk_test_123: -d "amount=2000&currency=usd"' --target fetch`}
                  language="bash"
                />

                <CopySnippet
                  title="Example: cURL to Python Requests"
                  code={`npx codestation-mcp curl 'curl https://api.github.com/user -H "Authorization: Bearer ghp_token"' --target python`}
                  language="bash"
                />

                <CopySnippet
                  title="Example: cURL to Go net/http"
                  code={`npx codestation-mcp curl 'curl -X PUT https://api.example.com/items/42 -H "Content-Type: application/json" -d "{\\"active\\":true}"' --target go`}
                  language="bash"
                />

                <table className={styles.specTable}>
                  <thead>
                    <tr>
                      <th>Flag / Argument</th>
                      <th>Type</th>
                      <th>Default</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>&lt;curl_command&gt;</code></td>
                      <td>String / stdin</td>
                      <td>Required</td>
                      <td>The raw curl string to parse, or piped from stdin.</td>
                    </tr>
                    <tr>
                      <td><code>--target, -t</code></td>
                      <td>String</td>
                      <td><code>fetch</code></td>
                      <td>Target language/client: <code>fetch</code>, <code>axios</code>, <code>python</code>, <code>go</code>.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 4. CLI: Environment Secret Scanner */}
          {activeIds.has("cli-env") && (
            <section id="cli-env" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>4. Secret Leak Scanner &amp; Drift Auditor (env / env-audit)</h2>
                <span className={styles.sectionTag}>Security Subcommand</span>
              </div>
              <p className={styles.leadText}>
                Scans <code>.env</code> files or strings for accidental credential leaks and synchronizes with <code>.env.example</code>.
                Detects live Stripe keys, AWS access keys, OpenAI tokens, GitHub PATs, private keys, and high-entropy secrets.
                Outputs a clean security audit report with <strong>automatic credential redaction</strong> (e.g. <code>sk_l••••••••5678</code>).
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>env [path] [--example [path]]</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Example: Audit Local .env File"
                  code="npx codestation-mcp env .env --example .env.example"
                  language="bash"
                />

                <CopySnippet
                  title="Example: Scan Inline Secret String"
                  code={`npx codestation-mcp env-audit --input "STRIPE_SECRET=sk_live_51Mszabcdef1234567890"`}
                  language="bash"
                />

                <div className={styles.callout + " " + styles.security}>
                  <strong>Secret Redaction by Default:</strong> All detected credential values are masked before terminal display.
                  You can safely run <code>npx codestation-mcp env</code> in terminal recordings, CI/CD logs, or live demonstrations.
                </div>

                <table className={styles.specTable}>
                  <thead>
                    <tr>
                      <th>Secret Pattern</th>
                      <th>Severity</th>
                      <th>Prefix / Format Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Stripe Secret Key</strong></td>
                      <td>Critical</td>
                      <td><code>sk_live_...</code> (live billing credentials)</td>
                    </tr>
                    <tr>
                      <td><strong>AWS Access Key</strong></td>
                      <td>Critical</td>
                      <td><code>AKIA...</code> / <code>ASIA...</code> (20-character AWS credentials)</td>
                    </tr>
                    <tr>
                      <td><strong>OpenAI API Key</strong></td>
                      <td>Critical</td>
                      <td><code>sk-proj-...</code> / <code>sk-...</code> (OpenAI project &amp; user keys)</td>
                    </tr>
                    <tr>
                      <td><strong>GitHub Personal Token</strong></td>
                      <td>Critical</td>
                      <td><code>ghp_...</code>, <code>github_pat_...</code></td>
                    </tr>
                    <tr>
                      <td><strong>Private Key PEM</strong></td>
                      <td>Critical</td>
                      <td><code>-----BEGIN RSA/OPENSSH PRIVATE KEY-----</code></td>
                    </tr>
                    <tr>
                      <td><strong>Missing .env.example Key</strong></td>
                      <td>High</td>
                      <td>Keys required by .env.example missing from active .env</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. CLI: Realistic Mock Data */}
          {activeIds.has("cli-mock") && (
            <section id="cli-mock" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>5. Realistic Mock Data &amp; SQL Seeder (mock / mock-data)</h2>
                <span className={styles.sectionTag}>Data Generator</span>
              </div>
              <p className={styles.leadText}>
                Generates realistic, developer-friendly mock datasets and SQL <code>INSERT</code> statements for unit tests, seeding databases,
                or prototyping frontends. Includes prebuilt templates (<code>users</code>, <code>products</code>, <code>orders</code>) and supports custom JSON schemas.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>mock [template] [--count N] [--format json|sql]</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Generate 5 Mock Users (JSON)"
                  code="npx codestation-mcp mock users --count 5"
                  language="bash"
                />

                <CopySnippet
                  title="Generate SQL INSERT Seed Script"
                  code="npx codestation-mcp mock users --count 10 --format sql --table app_users"
                  language="bash"
                />

                <CopySnippet
                  title="Custom Schema Mock Generation"
                  code={`npx codestation-mcp mock-data --schema '{"id":"uuid","fullName":"name","workEmail":"email","cost":"price"}' --count 3`}
                  language="bash"
                />

                <table className={styles.specTable}>
                  <thead>
                    <tr>
                      <th>Flag</th>
                      <th>Options</th>
                      <th>Default</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>template</code></td>
                      <td><code>users</code>, <code>products</code>, <code>orders</code></td>
                      <td><code>users</code></td>
                      <td>Built-in domain template for quick realistic generation.</td>
                    </tr>
                    <tr>
                      <td><code>--count, -c</code></td>
                      <td>Integer (1-500)</td>
                      <td><code>5</code></td>
                      <td>Number of records to generate.</td>
                    </tr>
                    <tr>
                      <td><code>--format, -f</code></td>
                      <td><code>json</code>, <code>sql</code></td>
                      <td><code>json</code></td>
                      <td>Output serialization format.</td>
                    </tr>
                    <tr>
                      <td><code>--table, -t</code></td>
                      <td>String</td>
                      <td><code>template name</code></td>
                      <td>Target table name when formatting as SQL <code>INSERT</code>.</td>
                    </tr>
                    <tr>
                      <td><code>--schema, -s</code></td>
                      <td>JSON String</td>
                      <td>Optional</td>
                      <td>Custom schema mapping field names to data types.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 6. CLI: Git Merge Conflict */}
          {activeIds.has("cli-conflict") && (
            <section id="cli-conflict" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>6. Git Merge Conflict Resolver (conflict / conflict-parse)</h2>
                <span className={styles.sectionTag}>Git Subcommand</span>
              </div>
              <p className={styles.leadText}>
                Parses standard Git merge conflict markers (<code>&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</code>, <code>=======</code>, <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt; branch</code>)
                and executes clean resolution strategies without touching your Git index or leaving residual syntax errors.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>conflict &lt;file&gt; [--strategy ours|theirs|both]</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Resolve File Using 'Ours' (Current Branch)"
                  code="npx codestation-mcp conflict ./src/config.ts --strategy ours"
                  language="bash"
                />

                <CopySnippet
                  title="Resolve File Using 'Theirs' (Incoming Branch)"
                  code="npx codestation-mcp conflict ./src/config.ts --strategy theirs"
                  language="bash"
                />

                <CopySnippet
                  title="Pipe Raw Conflict Content &amp; Keep Both"
                  code={`cat << 'EOF' | npx codestation-mcp conflict-parse --strategy both
<<<<<<< HEAD
const API_URL = "https://api-v1.com";
=======
const API_URL = "https://api-v2.com";
>>>>>>> main
EOF`}
                  language="bash"
                />

                <table className={styles.specTable}>
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>ours</code></td>
                      <td>Keeps code from the top block (<code>HEAD</code>); strips conflict markers and incoming block.</td>
                    </tr>
                    <tr>
                      <td><code>theirs</code></td>
                      <td>Keeps code from the bottom block (incoming branch); strips conflict markers and current block.</td>
                    </tr>
                    <tr>
                      <td><code>both</code></td>
                      <td>Preserves both blocks sequentially in the resolved file; removes markers.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 7. CLI: JWT */}
          {activeIds.has("cli-jwt") && (
            <section id="cli-jwt" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>7. JWT Token Inspector (jwt)</h2>
                <span className={styles.sectionTag}>Terminal Subcommand</span>
              </div>
              <p className={styles.leadText}>
                Inspects JSON Web Tokens in your terminal instantly without sending tokens over the internet to unverified websites.
                Decodes Header and Payload claims, calculates exact expiration dates, and shows remaining time-to-live (TTL).
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>jwt &lt;token&gt;</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Inspect JWT Token"
                  code="npx codestation-mcp jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiZXhwIjoxNzY3MjI1NjAwfQ.test"
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 8. CLI: SQL Formatter */}
          {activeIds.has("cli-sql") && (
            <section id="cli-sql" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>8. SQL Formatter &amp; Dialects (sql)</h2>
                <span className={styles.sectionTag}>Database Subcommand</span>
              </div>
              <p className={styles.leadText}>
                Formats messy SQL queries with dialect-aware indentation, keyword capitalization, and clause alignment across
                PostgreSQL, MySQL, SQLite, and SQL Server.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>sql &quot;&lt;query&gt;&quot; [--dialect &lt;name&gt;]</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Format Query (PostgreSQL)"
                  code={`npx codestation-mcp sql "select id, name, created_at from users where status = 'active' order by created_at desc;" --dialect postgresql`}
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 9. CLI: Cron */}
          {activeIds.has("cli-cron") && (
            <section id="cli-cron" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>9. Cron Schedule Translator (cron)</h2>
                <span className={styles.sectionTag}>Date/Time Subcommand</span>
              </div>
              <p className={styles.leadText}>
                Translates 5-field Unix cron syntax into clear, unambiguous English and computes the next 5 execution timestamps.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>cron &quot;&lt;expression&gt;&quot;</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Explain Cron Expression"
                  code={`npx codestation-mcp cron "0 9 * * 1-5"`}
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 10. CLI: Hashes */}
          {activeIds.has("cli-hash") && (
            <section id="cli-hash" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>10. Cryptographic Hashes &amp; Digests (hash)</h2>
                <span className={styles.sectionTag}>Crypto Subcommand</span>
              </div>
              <p className={styles.leadText}>
                Computes cryptographic digests using native Node.js WebCrypto. Supports SHA-256, SHA-512, MD5, SHA-1, and CRC-32.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>hash &quot;&lt;text&gt;&quot; [--alg &lt;name&gt;]</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Compute SHA-256 Digest"
                  code={`npx codestation-mcp hash "developer-secret-token" --alg sha256`}
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 11. CLI: Types & Schemas */}
          {activeIds.has("cli-types") && (
            <section id="cli-types" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>11. JSON to TypeScript &amp; Zod Schema (ts / zod)</h2>
                <span className={styles.sectionTag}>Code Generation</span>
              </div>
              <p className={styles.leadText}>
                Infers production-ready TypeScript types and runtime Zod validation schemas directly from sample JSON payloads or API responses.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>ts &lt;json&gt; [RootName]</code> / <code>zod &lt;json&gt; [SchemaName]</code></span>
                  <span className={`${styles.commandBadge} ${styles.pro}`}>PRO TIER</span>
                </div>

                <CopySnippet
                  title="Generate TypeScript Interface"
                  code={`npx codestation-mcp ts '{"id":101,"name":"Alice","roles":["admin","editor"]}' User`}
                  language="bash"
                />

                <CopySnippet
                  title="Generate Zod Schema &amp; Inferred Type"
                  code={`npx codestation-mcp zod '{"id":101,"name":"Alice","roles":["admin","editor"]}' userSchema`}
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 12. CLI: UUID & JSON */}
          {activeIds.has("cli-uuid-json") && (
            <section id="cli-uuid-json" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>12. UUID Generator &amp; JSON Formatter (uuid / json)</h2>
                <span className={styles.sectionTag}>Free Core Utilities</span>
              </div>
              <p className={styles.leadText}>
                Everyday terminal essentials available completely free on both CLI and MCP.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}><code>uuid [count]</code> / <code>json &lt;raw&gt;</code></span>
                  <span className={`${styles.commandBadge} ${styles.free}`}>FREE TIER</span>
                </div>

                <CopySnippet
                  title="Generate 3 v4 UUIDs"
                  code="npx codestation-mcp uuid 3"
                  language="bash"
                />

                <CopySnippet
                  title="Format JSON String"
                  code={`npx codestation-mcp json '{"status":"ok","count":42}'`}
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 13. MCP Protocol */}
          {activeIds.has("mcp-protocol") && (
            <section id="mcp-protocol" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>13. Model Context Protocol (MCP) Stdio Architecture</h2>
                <span className={styles.sectionTag}>Protocol Specs</span>
              </div>
              <p className={styles.leadText}>
                The Code Station MCP server communicates with AI clients over standard input/output (<code>stdio</code>)
                using the JSON-RPC 2.0 protocol mandated by the Model Context Protocol specification.
              </p>

              <div className={styles.callout}>
                <strong>Supported RPC Endpoints:</strong>
                <ul>
                  <li><code>tools/list</code> (Standard MCP): Returns array of available tools and JSON Schema parameter descriptors.</li>
                  <li><code>tools/call</code> (Standard MCP): Executes a tool with provided arguments and returns content payloads.</li>
                  <li><code>tools.list</code> (Extended RPC): Lightweight array of tool identifiers.</li>
                  <li><code>tools.describe</code> (Extended RPC): Returns full documentation for a specific tool ID.</li>
                  <li><code>auth.status</code> (Extended RPC): Returns current license tier, key fingerprint, and device status.</li>
                  <li><code>entitlements.status</code> (Extended RPC): Detailed feature entitlement flags.</li>
                </ul>
              </div>

              <CopySnippet
                title="Manual stdio invocation (for debugging)"
                code="node ./bin/codestation-mcp.mjs --key CS-PRO-YOUR-KEY"
                language="bash"
              />
            </section>
          )}

          {/* 14. AI Assistant Configs */}
          {activeIds.has("ai-assistants") && (
            <section id="ai-assistants" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>14. AI Assistant Configuration Guides</h2>
                <span className={styles.sectionTag}>Integration Setup</span>
              </div>
              <p className={styles.leadText}>
                Connect Code Station to your favorite AI development environment in seconds.
              </p>

              <div className={styles.subSection}>
                <h3>Claude Desktop</h3>
                <p>Add to your Claude configuration file:</p>
                <ul>
                  <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
                  <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
                </ul>
                <CopySnippet
                  title="claude_desktop_config.json"
                  code={`{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`}
                  language="json"
                />
              </div>

              <div className={styles.subSection}>
                <h3>Cursor IDE</h3>
                <p>
                  Add to your project&apos;s <code>.cursor/mcp.json</code> or paste into Cursor Settings (<strong>Settings → Features → MCP</strong>):
                </p>
                <CopySnippet
                  title=".cursor/mcp.json"
                  code={`{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`}
                  language="json"
                />
              </div>

              <div className={styles.subSection}>
                <h3>Windsurf / Codeium</h3>
                <p>Add to <code>~/.codeium/windsurf/mcp_config.json</code>:</p>
                <CopySnippet
                  title="mcp_config.json"
                  code={`{
  "mcpServers": {
    "codestation": {
      "command": "npx",
      "args": ["-y", "codestation-mcp", "--key", "CS-PRO-YOUR-KEY"]
    }
  }
}`}
                  language="json"
                />
              </div>

              <div className={styles.subSection}>
                <h3>Claude Code CLI</h3>
                <p>Register directly using Claude Code&apos;s built-in MCP manager:</p>
                <CopySnippet
                  title="Claude Code CLI"
                  code="claude mcp add codestation npx -y codestation-mcp --key CS-PRO-YOUR-KEY"
                  language="bash"
                />
              </div>
            </section>
          )}

          {/* 15. AI Prompt */}
          {activeIds.has("ai-prompt") && (
            <section id="ai-prompt" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>15. Copy-Pastable AI System Prompt &amp; Rules</h2>
                <span className={styles.sectionTag}>Agent Prompting</span>
              </div>
              <p className={styles.leadText}>
                Add this block to your assistant&apos;s Custom Instructions, <code>.cursorrules</code>, or <code>CLAUDE.md</code>.
                It instructs the LLM to delegate calculations, conversions, and parsing directly to local Code Station tools:
              </p>

              <CopySnippet
                title=".cursorrules / CLAUDE.md"
                code={`# Code Station MCP Assistant Guidelines

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
12. Text Transformations: Use codestation_case_convert, codestation_text_diff, and codestation_uuid for RFC 4122 v4 UUIDs.`}
                language="markdown"
              />
            </section>
          )}

          {/* 16. Tool Catalog */}
          {activeIds.has("tool-catalog") && (
            <section id="tool-catalog" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>16. Complete MCP Tool Capability Matrix</h2>
                <span className={styles.sectionTag}>Tool Catalog</span>
              </div>
              <p className={styles.leadText}>
                Overview of all 20+ Model Context Protocol tools exposed by <code>codestation-mcp</code>:
              </p>

              <table className={styles.specTable}>
                <thead>
                  <tr>
                    <th>MCP Tool Name</th>
                    <th>Tier</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>codestation_curl_to_code</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Converts cURL commands into TypeScript fetch/axios, Python, or Go.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_env_audit</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Scans .env for secrets (Stripe, AWS, OpenAI, GitHub PAT) &amp; audits .env.example.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_mock_data</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Generates realistic mock datasets &amp; SQL INSERT statements.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_git_conflict</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Parses &amp; resolves Git merge conflicts with ours, theirs, or both.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_json_to_typescript</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Generates clean, nested TypeScript interfaces from sample JSON.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_json_to_zod</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Generates production-ready Zod schema declarations and inferred types.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_jwt_decode</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Decodes JWT headers, claims, and calculates expiry TTL.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_format_sql</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Beautifies SQL queries for PostgreSQL, MySQL, SQLite, and SQL Server.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_cron_explain</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Translates Unix cron expressions and projects next 5 runtimes.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_hash</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Cryptographic hashing (SHA-256, SHA-512, MD5, SHA-1, CRC-32).</td>
                  </tr>
                  <tr>
                    <td><code>codestation_hmac</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Keyed HMAC message authentication (SHA-256, SHA-512).</td>
                  </tr>
                  <tr>
                    <td><code>codestation_business_days</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Calculates business working days between two dates excluding weekends/holidays.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_regex_test</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Tests regular expressions and extracts capture groups.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_json_schema</code></td>
                    <td><strong style={{ color: "var(--accent)" }}>Pro</strong></td>
                    <td>Infers Draft 7 or 2020-12 JSON Schema structures from sample data.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_format_json</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Formats and pretty-prints JSON payloads.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_minify_json</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Compacts JSON into single-line representations.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_json_to_yaml</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Converts JSON data into YAML syntax.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_yaml_to_json</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Parses YAML into standard JSON.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_base64</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Standard and URL-safe Base64 encode and decode.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_case_convert</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Converts identifiers between camelCase, snake_case, kebab-case, PascalCase.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_text_diff</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Unified line-by-line semantic text comparison.</td>
                  </tr>
                  <tr>
                    <td><code>codestation_uuid</code></td>
                    <td><span style={{ color: "var(--green)" }}>Free</span></td>
                    <td>Generates cryptographically random RFC 4122 v4 UUIDs.</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {/* 17. Web Stations */}
          {activeIds.has("web-stations") && (
            <section id="web-stations" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>17. Web Application &amp; 15 Stations Directory</h2>
                <span className={styles.sectionTag}>Web Application</span>
              </div>
              <p className={styles.leadText}>
                Every single one of the <strong>338+ developer tools</strong> on the Code Station web application
                (<code>codestation.in</code>) is <strong>100% free, unlimited, and runs client-side</strong>.
              </p>

              <div className={styles.gridTwo}>
                <div className={styles.cardItem}>
                  <h4>1. JSON &amp; Data Station</h4>
                  <p>Formatting, validation, JSON-to-YAML, JSON-to-CSV, and schema validation.</p>
                  <Link href="/stations/json-data" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>2. Security &amp; Crypto Station</h4>
                  <p>Cryptographic hashes, HMACs, JWT decoders, key generators, and password entropy.</p>
                  <Link href="/stations/security" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>3. API &amp; Webhooks Station</h4>
                  <p>Mock payload generators, cURL generator, query parsers, and HTTP status codes.</p>
                  <Link href="/stations/api" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>4. SQL &amp; Database Station</h4>
                  <p>SQL formatters, mock data seeder, ER diagram generators, and dialect converters.</p>
                  <Link href="/stations/sql-database" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>5. Encoders &amp; Decoders</h4>
                  <p>Base64, Hex, URL encoding, HTML entities, and binary codecs.</p>
                  <Link href="/stations/encoding" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>6. Date &amp; Time Station</h4>
                  <p>Timezone conversions across IANA databases, business day calculators, and timestamps.</p>
                  <Link href="/stations/date-time" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>7. Text &amp; Strings Station</h4>
                  <p>Case conversion, semantic text diffing, line sorting, and deduplication.</p>
                  <Link href="/stations/text" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>8. Converters Station</h4>
                  <p>Two-way number base conversion, temperature, and unit converters.</p>
                  <Link href="/stations/converters" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>9. Image &amp; SVG Station</h4>
                  <p>PNG/JPEG compression, SVG optimizer, aspect ratio tools, and color palette extraction.</p>
                  <Link href="/stations/image" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>10. Regular Expressions Station</h4>
                  <p>Regex tester, regex explainer, and match capture group visualizer.</p>
                  <Link href="/stations/regex" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>11. Markdown Station</h4>
                  <p>Live Markdown to HTML rendering, tables formatter, and clean editor.</p>
                  <Link href="/stations/markdown" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>12. Spreadsheet &amp; CSV Station</h4>
                  <p>CSV to JSON, Excel XLSX viewer, delimiter converter, and table viewer.</p>
                  <Link href="/stations/spreadsheet" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>13. Cron &amp; Schedules Station</h4>
                  <p>Interactive cron editor, next run prediction, and plain English descriptions.</p>
                  <Link href="/stations/cron" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
                <div className={styles.cardItem}>
                  <h4>14. Color &amp; CSS Station</h4>
                  <p>HEX/RGB/HSL conversion, CSS shadow generator, and contrast checker.</p>
                  <Link href="/stations/color-css" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 700 }}>Open Station →</Link>
                </div>
              </div>
            </section>
          )}

          {/* 18. Licensing & Device Binding */}
          {activeIds.has("licensing") && (
            <section id="licensing" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>18. Pro Licensing &amp; Anti-Sharing Device Binding</h2>
                <span className={styles.sectionTag}>Licensing Architecture</span>
              </div>
              <p className={styles.leadText}>
                Code Station Pro is priced accessibly and operates with a <strong>login-free</strong> architecture.
                Users receive an instant cryptographic key (e.g., <code>CS-PRO-XXXX-XXXX-XXXX</code>) without passwords or accounts.
              </p>

              <div className={styles.gridTwo}>
                <div className={styles.cardItem}>
                  <h4>India Pricing (Razorpay)</h4>
                  <p><strong>₹199 / month</strong> or <strong>₹999 one-time</strong> lifetime license.</p>
                  <p style={{ marginTop: "6px" }}>Supports UPI (Google Pay, PhonePe, Paytm), Debit/Credit Cards, NetBanking.</p>
                </div>
                <div className={styles.cardItem}>
                  <h4>Global Pricing</h4>
                  <p><strong>$2.99 / month</strong> or <strong>$19.00 one-time</strong> lifetime license.</p>
                  <p style={{ marginTop: "6px" }}>International Cards, PayPal, and digital wallets.</p>
                </div>
              </div>

              <div className={styles.subSection}>
                <h3>Device Binding Rules (3-Device Limit)</h3>
                <ul>
                  <li><strong>3 Active Devices:</strong> Each Pro key can be bound to up to 3 developer machines (e.g., workstation, laptop, home PC).</li>
                  <li><strong>Hardware Fingerprinting:</strong> Machines register a unique local hardware fingerprint with the license service.</li>
                  <li><strong>Automatic 30-Day Pruning:</strong> Inactive machines are automatically purged after 30 days to free up slots.</li>
                  <li><strong>Self-Service Reset:</strong> Easily unbind your machines using the <strong>Reset Active Devices</strong> button on the <Link href="/pro">Pro page</Link>.</li>
                  <li><strong>Offline Caching:</strong> Validated license status is cached locally in <code>~/.codestation/license.json</code>, enabling seamless offline work.</li>
                </ul>
              </div>
            </section>
          )}

          {/* 19. Lost Key Recovery Policy */}
          {activeIds.has("lost-key-recovery") && (
            <section id="lost-key-recovery" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>19. Lost Key Recovery Policy &amp; Fee Schedule</h2>
                <span className={styles.sectionTag}>Policy &amp; Recovery</span>
              </div>
              <p className={styles.leadText}>
                Because Code Station is 100% login-free, <strong>plaintext keys are never stored on our servers</strong>.
                Cloudflare edge KV stores only one-way cryptographic SHA-256 hashes (`lic_...`). As a result,
                lost keys cannot be viewed or retrieved from a database.
              </p>

              <div className={styles.commandCard}>
                <div className={styles.commandHeader}>
                  <span className={styles.commandTitle}>How to Request a Key Replacement</span>
                  <span className={styles.commandBadge}>OPERATOR PROTOCOL</span>
                </div>
                <ol style={{ paddingLeft: "20px", margin: "12px 0 20px" }}>
                  <li style={{ marginBottom: "8px" }}>
                    Send an email to <strong><a href="mailto:twnspace2@gmail.com" style={{ color: "var(--accent)", textDecoration: "underline" }}>twnspace2@gmail.com</a></strong>.
                  </li>
                  <li style={{ marginBottom: "8px" }}>
                    Include your proof of purchase: your Razorpay Payment ID (<code>pay_...</code>) or a screenshot of your payment receipt.
                  </li>
                  <li style={{ marginBottom: "8px" }}>
                    Our team verifies the payment ID, immediately revokes the old SHA-256 hash in Cloudflare KV, generates a fresh replacement key, and emails it back to you.
                  </li>
                </ol>

                <div className={styles.callout + " " + styles.warning}>
                  <strong>Progressive Regeneration Fee Schedule:</strong><br />
                  To discourage public key leakages and unauthorized sharing while providing legitimate purchasers a guaranteed recovery path, a progressive fee applies to regenerated keys:
                  <ul style={{ margin: "8px 0 0", paddingLeft: "18px" }}>
                    <li><strong>1st Key Regeneration:</strong> ₹25</li>
                    <li><strong>2nd Key Regeneration:</strong> ₹50 (2×)</li>
                    <li><strong>3rd Key Regeneration:</strong> ₹100 (2×)</li>
                    <li><strong>4th Key Regeneration:</strong> ₹200 (2×)</li>
                    <li><strong>Subsequent Regenerations:</strong> Doubles each time (*2).</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* 20. Security & Privacy */}
          {activeIds.has("security-privacy") && (
            <section id="security-privacy" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>20. Zero-Telemetry &amp; Privacy Architecture</h2>
                <span className={styles.sectionTag}>Security Specs</span>
              </div>
              <p className={styles.leadText}>
                Code Station is designed from the ground up for strict privacy, corporate compliance, and confidentiality.
              </p>

              <div className={styles.gridTwo}>
                <div className={styles.cardItem}>
                  <h4>Zero Analytics &amp; Zero Tracking</h4>
                  <p>No tracking cookies, no Google Analytics, no session recorders, and no third-party CDN telemetry. Your workflow is completely private.</p>
                </div>
                <div className={styles.cardItem}>
                  <h4>Client-Side In-Memory Execution</h4>
                  <p>On the web, tools execute in WebAssembly and WebCrypto within your browser memory. Data never leaves your machine.</p>
                </div>
                <div className={styles.cardItem}>
                  <h4>Zero-Knowledge Licensing</h4>
                  <p>License keys are stored as one-way SHA-256 hashes (`lic_...`) at Cloudflare edge KV. Server compromises cannot expose plaintext user keys.</p>
                </div>
                <div className={styles.cardItem}>
                  <h4>Local Terminal &amp; Stdio Privacy</h4>
                  <p>The CLI and MCP server process everything locally in your Node.js runtime without external proxy requests.</p>
                </div>
              </div>
            </section>
          )}

          {/* 21. Troubleshooting & FAQs */}
          {activeIds.has("troubleshooting") && (
            <section id="troubleshooting" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <h2>21. Troubleshooting, Common Errors &amp; FAQs</h2>
                <span className={styles.sectionTag}>Help &amp; FAQs</span>
              </div>

              <div className={styles.subSection}>
                <h3>Q: Error &quot;Node.js version is not supported&quot;</h3>
                <p>
                  Code Station requires Node.js 22.13.0 or higher. Check your current version with <code>node -v</code>.
                  If you are using <code>nvm</code>, switch by running <code>nvm use 22</code> or install Node 22 via <code>nvm install 22</code>.
                </p>
              </div>

              <div className={styles.subSection}>
                <h3>Q: Claude Desktop or Cursor does not show Code Station tools</h3>
                <p>
                  1. Verify that your configuration file contains valid JSON.<br />
                  2. Ensure you ran <code>npx -y codestation-mcp setup</code>.<br />
                  3. Completely quit and restart Claude Desktop or Cursor (hot reload does not always pick up newly registered stdio MCP servers).<br />
                  4. Verify you have network access to download the package or run <code>npm install -g codestation-mcp</code> to keep it cached locally.
                </p>
              </div>

              <div className={styles.subSection}>
                <h3>Q: Can I use Code Station completely offline?</h3>
                <p>
                  Yes! Both the web application and CLI are built offline-first.
                  The web application includes a 151-asset Service Worker manifest cached locally.
                  The CLI caches your active license in <code>~/.codestation/license.json</code>, enabling uninterrupted usage on flights and off-grid environments.
                </p>
              </div>

              <div className={styles.subSection}>
                <h3>Q: Are web tools really 100% free forever?</h3>
                <p>
                  Yes. All 338+ developer tools accessible on <code>codestation.in</code> are completely free, unrestricted, and have zero paywalls.
                  Pro licensing is exclusively required for local AI agents via the MCP stdio protocol and advanced terminal subcommands.
                </p>
              </div>
            </section>
          )}

          {/* Opt-in Leaderboard Banner */}
          <BannerAd size="leaderboard" className={styles.adContainer} />
        </main>
      </div>
    </div>
  );
}
