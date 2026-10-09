import { metadataForPage } from "@/config/site";
import { DocsRepo } from "@/components/DocsRepo";

export const metadata = metadataForPage(
  "/docs",
  "Documentation Repository — Code Station CLI, MCP & Web Developer Manual",
  "Complete documentation repository for Code Station. Interactive command manual for terminal CLI subcommands, Local Model Context Protocol (MCP) server, 338+ client-side web tools, AI coding agent integrations, Pro licensing, and lost-key recovery policies."
);

export default function DocsPage() {
  return (
    <main className="shell">
      <DocsRepo />
    </main>
  );
}
