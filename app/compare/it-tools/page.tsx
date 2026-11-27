import { metadataForRoute } from "@/config/site";
import { CompareVersusPage } from "@/components/ComparePage";

export const metadata = metadataForRoute(
  "/compare/it-tools",
  "Code Station vs IT-Tools — Honest Comparison",
  "Compare Code Station and IT-Tools objectively: Docker self-hosting vs 383 browser-local utilities, WebMCP & codestation-mcp AI integration, #state= permalinks, and embeddable widgets."
);

export default function CompareItToolsPage() {
  return (
    <CompareVersusPage
      competitorName="IT-Tools"
      title="Code Station vs IT-Tools"
      intro="IT-Tools is a popular open-source web toolbox loved for 1-container Docker self-hosting. Here is how it compares fairly with Code Station."
      summary="Both Code Station and IT-Tools keep developer utilities fast and browser-based. If you need an air-gapped Docker container behind a corporate VPN, IT-Tools is straightforward to deploy. If you want broader full-stack tool depth, shareable #state= links, embeddable widgets, offline PWA caching, and native AI agent integration via WebMCP and codestation-mcp, Code Station covers more ground."
      rows={[
        {
          criterion: "Tool catalog",
          codeStation: "383 tools across 30 stations (JSON, SQL, Cron, PDF, Video/Audio, WebPKI, Git, AI Prompts, Finance)",
          competitor: "~75–85 focused web utilities (tokens, converters, hash, networking basics)",
        },
        {
          criterion: "Deployment model",
          codeStation: "Instant hosted CDN + offline PWA starter toolkit; browser-local computation",
          competitor: "Hosted web app + official Docker image for easy self-hosting",
        },
        {
          criterion: "AI agent / terminal support",
          codeStation: "Built-in browser WebMCP + codestation-mcp stdio server & 1-click CLI utilities",
          competitor: "Web UI only (no MCP server or CLI tool runner)",
        },
        {
          criterion: "State sharing & embeds",
          codeStation: "Compressed #state= hash permalinks (8 KB cap) + chromeless /embed/[slug] iframes",
          competitor: "No dedicated chromeless iframe widget mode or unified compressed state hash",
        },
        {
          criterion: "Media & PDF processing",
          codeStation: "Local browser canvas/WebAssembly PDF merge/split/compress, image, audio & video trimming",
          competitor: "Primarily text, encoding, network, and snippet utilities",
        },
      ]}
      whereCompetitorShines={[
        "Simple single-container Docker self-hosting on private company intranets.",
        "Mature, minimal Vue UI well-known across DevOps and homelab setups.",
        "Clean open-source repository focused purely on lightweight browser snippets.",
      ]}
      whereCodeStationStandsOut={[
        "383 specialized tools spanning WebPKI/x509, PDF, Audio/Video, TypeScript/Zod codegen, Git conflict parsing, and Cron.",
        "Native WebMCP (document.modelContext) plus the codestation-mcp npm package for Cursor, Claude Desktop, and Windsurf.",
        "Compressed #state= URL permalinks, embeddable /embed/[slug] widgets, and offline PWA support.",
      ]}
      relatedLinks={[
        { label: "JSON & Data Station", href: "/stations/json-data", note: "Formatters, diffs, YAML/TOML/XML/CSV converters, and JSONPath." },
        { label: "Security & Crypto Station", href: "/stations/security", note: "Hashes, HMAC, UUID/ULID/NanoID, and password entropy." },
        { label: "Network & DevOps Station", href: "/stations/network-devops", note: "CIDR subnetting, IPv4/IPv6, SSL inspect, and Dockerfile helpers." },
        { label: "Docs & MCP Setup", href: "/docs", note: "Browse architecture, CLI subcommands, and WebMCP documentation." },
      ]}
      faqs={[
        {
          question: "Does Code Station require an account like some SaaS toolkits?",
          answer:
            "No. Every web tool on Code Station runs in your browser without accounts or uploads. Only optional Pro desktop MCP features use a license key.",
        },
        {
          question: "Can I use Code Station offline instead of self-hosting Docker?",
          answer:
            "Yes, Code Station registers an offline PWA service worker and provides an optional Offline Starter Pack in Settings for running cached utilities without connectivity.",
        },
      ]}
    />
  );
}
