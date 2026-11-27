import { metadataForRoute } from "@/config/site";
import { CompareVersusPage } from "@/components/ComparePage";

export const metadata = metadataForRoute(
  "/compare/cyberchef",
  "Code Station vs CyberChef — Honest Comparison",
  "Objective comparison of Code Station vs GCHQ CyberChef: deep binary/forensics recipe chains vs 30 developer workflow stations, WebMCP & local MCP CLI, embeds, and modern codegen."
);

export default function CompareCyberChefPage() {
  return (
    <CompareVersusPage
      competitorName="CyberChef"
      title="Code Station vs CyberChef"
      intro="CyberChef ('The Cyber Swiss Army Knife') is legendary for forensics and multi-stage byte pipelines. Here is how the two tools compare."
      summary="CyberChef excels when you need to chain arbitrary binary operations—XORing raw bytes, unpacking malware payloads, carving hex dumps, or running nested Gunzip/Base85/ROT13 pipelines. Code Station is built for everyday full-stack development tasks—clean UI per tool, schema/type generation, SQL/Cron/Git helpers, PDF & media manipulation, and AI assistant integration."
      rows={[
        {
          criterion: "Core strength",
          codeStation: "Dedicated task-specific tools across 30 full-stack stations (code, SQL, API, PDF, UI, Cron)",
          competitor: "Composable multi-step 'recipe' chains for binary forensics, encoding, and data carving",
        },
        {
          criterion: "Binary & forensics ops",
          codeStation: "Focused encoding/crypto/WebPKI/hex/checksum tools",
          competitor: "300+ low-level byte, bitwise, decompression, disassembly, and crypto primitives",
        },
        {
          criterion: "Developer codegen & Git",
          codeStation: "JSON-to-TypeScript, Zod, Go, Rust, SQL formatting, .env leak audit, Git conflict resolution",
          competitor: "Not built for application code generation, SQL dialects, or repository configs",
        },
        {
          criterion: "AI / MCP workflow",
          codeStation: "WebMCP (document.modelContext) + codestation-mcp for Claude Desktop, Cursor & Windsurf",
          competitor: "Browser UI and Node library; no native MCP server",
        },
        {
          criterion: "Sharing & embeds",
          codeStation: "Shareable #state= links + chromeless /embed/[slug] iframes for docs & blogs",
          competitor: "URL hash recipe + input state; general app UI only",
        },
      ]}
      whereCompetitorShines={[
        "Chaining dozens of arbitrary byte-level operations in a single visual 'recipe' with live stepping and Magic auto-detection.",
        "Deep incident-response, CTF, and malware-analysis primitives (fork, conditional registers, esoteric encodings, pcap/YARA helpers).",
        "Single standalone downloadable HTML bundle for strictly offline security labs.",
      ]}
      whereCodeStationStandsOut={[
        "Accessible, form-validated UI tailored to each workflow (date/timezones, DST checks, cron explanations, visual CSS/image tools).",
        "Everyday engineering tasks CyberChef doesn't cover: TypeScript/Zod codegen, PDF split/compress, video trimming, SQL dialect formatting, and .env audits.",
        "Built-in WebMCP browser agents and the codestation-mcp CLI + MCP server.",
      ]}
      relatedLinks={[
        { label: "Encoding Station", href: "/stations/encoding", note: "Base64, Base64URL, Base32, Base58, Hex, JWT decode, and Data URIs." },
        { label: "WebPKI & Cryptography", href: "/stations/crypto-pki", note: "X.509/CSR inspection, CSP builder, HSTS, and SAML decoding." },
        { label: "Code Generation Station", href: "/stations/code-generation", note: "Infer TypeScript, Zod, Go, Python Pydantic, and Rust structs from JSON." },
        { label: "Base64 Encoder", href: "/tools/base64-encoder", note: "Standard and URL-safe Base64 encoding directly in the browser." },
      ]}
      faqs={[
        {
          question: "Should I replace CyberChef completely?",
          answer:
            "Not necessarily. Keep CyberChef bookmarked for multi-step CTF or binary forensics pipelines, and use Code Station for everyday web, API, data, PDF, Cron, SQL, and AI MCP workflows.",
        },
        {
          question: "Does Code Station keep data local like CyberChef?",
          answer:
            "Yes. Tool computations execute locally in JavaScript/WebCrypto/WASM in your browser without sending payloads to a server.",
        },
      ]}
    />
  );
}
