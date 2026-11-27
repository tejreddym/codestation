import { metadataForRoute } from "@/config/site";
import { CompareVersusPage } from "@/components/ComparePage";

export const metadata = metadataForRoute(
  "/compare/devtoys",
  "Code Station vs DevToys — Honest Comparison",
  "Compare Code Station vs DevToys objectively: native Windows/macOS/Linux desktop integration vs zero-install 383-tool browser toolbox, offline PWA, URL permalinks, embeds, and MCP."
);

export default function CompareDevToysPage() {
  return (
    <CompareVersusPage
      competitorName="DevToys"
      title="Code Station vs DevToys"
      intro="DevToys is an acclaimed native desktop Swiss-Army knife for developers. Here is when a native desktop app wins—and where browser-first Code Station fits better."
      summary="DevToys delivers crisp native desktop performance and OS-level clipboard detection out of the box on Windows, macOS, and Linux. Code Station brings 383 utilities straight into any browser with zero installer, works on locked-down work laptops, tablets, and Chromebooks, supports offline PWA mode, and adds shareable #state= permalinks, embeddable widgets, and AI MCP support."
      rows={[
        {
          criterion: "Installation & portability",
          codeStation: "Zero install in any modern browser; optional PWA install + offline starter pack",
          competitor: "Native desktop installer required per OS (Windows, macOS, Linux)",
        },
        {
          criterion: "Tool count & breadth",
          codeStation: "383 tools across 30 stations (including PDF, Audio, Video, Finance, WebPKI, Policy & Cron)",
          competitor: "~35–45 core developer utilities plus community C#/NuGet extensions",
        },
        {
          criterion: "Collaboration & sharing",
          codeStation: "Copy Link (#state= hash) restores exact inputs & output for teammates; /embed/[slug] for docs",
          competitor: "Local desktop window only; no shareable URL links or iframe embeds",
        },
        {
          criterion: "AI assistant integration",
          codeStation: "WebMCP (document.modelContext) + codestation-mcp npm package (33 CLI/MCP tools)",
          competitor: "Desktop GUI + CLI support in DevToys CLI without MCP protocol",
        },
        {
          criterion: "OS integration",
          codeStation: "Browser Smart Detection on paste/focus + keyboard palette (⌘K / ?)",
          competitor: "Deep OS smart clipboard detection, native file dialogs & dark/light OS theme",
        },
      ]}
      whereCompetitorShines={[
        "Fast, native desktop UI that feels built right into Windows, macOS, and Linux without browser tabs.",
        "Seamless system-wide clipboard Smart Detection and offline desktop execution with zero browser memory limits.",
        "Extensible via DevToys 2.0 plugin architecture for custom .NET extensions.",
      ]}
      whereCodeStationStandsOut={[
        "Works instantly on locked-down machines, Chromebooks, iPads, or fresh environments where you cannot install desktop binaries.",
        "10x larger out-of-the-box library (383 tools) including PDF, video/audio, TypeScript/Zod codegen, Git conflict resolver, and SQL formatters.",
        "Shareable #state= permalinks, embeddable tool iframes for documentation, and native MCP server integration for AI coding agents.",
      ]}
      relatedLinks={[
        { label: "JSON Formatter", href: "/tools/json-formatter", note: "Validate, format, and share JSON snapshots via URL hash permalinks." },
        { label: "JWT Decoder", href: "/tools/jwt-decoder", note: "Inspect JWT headers and claims offline in browser memory." },
        { label: "Converters Station", href: "/stations/converters", note: "Unified converter catalog across JSON, YAML, CSV, TOML, XML, and Images." },
        { label: "Code Station Pro (MCP)", href: "/pro", note: "Connect 33 local developer tools to Cursor, Claude Desktop, and Windsurf." },
      ]}
      faqs={[
        {
          question: "Can Code Station work offline like a desktop app?",
          answer:
            "Yes. Code Station supports PWA installation and an offline service worker starter pack in Settings so cached core tools continue working without network access.",
        },
        {
          question: "Does Code Station have Smart Detection like DevToys?",
          answer:
            "Yes. Code Station includes browser Smart Detection via the header lightbulb control (and optional focus check in Settings) that routes pasted JSON, JWTs, Base64, URLs, timestamps, and hashes to matching tools locally.",
        },
      ]}
    />
  );
}
