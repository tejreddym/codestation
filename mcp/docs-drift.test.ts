// @vitest-environment node
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  README_BEGIN_MARKER,
  README_END_MARKER,
  runGenerator,
} from "../scripts/generate-mcp-docs.mjs";

describe("MCP & CLI Documentation Catalog Drift Check", () => {
  it("matches live mcp/registry-bridge.ts exports across catalog JSON and package README", () => {
    const rootDir = process.cwd();
    const res = runGenerator({ rootDir, checkOnly: true });

    expect(
      res.catalogDrifted,
      "config/mcp-docs-catalog.json is out of sync with mcp/registry-bridge.ts. Run: npm run generate:mcp-docs"
    ).toBe(false);
    expect(
      res.readmeDrifted,
      "packages/codestation-mcp/README.md catalog block is out of sync with mcp/registry-bridge.ts. Run: npm run generate:mcp-docs"
    ).toBe(false);
    expect(res.ok).toBe(true);

    const { catalog } = res;
    expect(catalog.counts.executableTotal).toBeGreaterThanOrEqual(320);
    expect(catalog.counts.freeExecutable).toBe(15);
    expect(catalog.counts.nodePure).toBe(304);
    expect(catalog.counts.nodeFileWired).toBeGreaterThanOrEqual(25);
    expect(catalog.counts.directTotal).toBe(28);

    const slugs = new Set<string>();
    for (const tool of catalog.tools) {
      expect(slugs.has(tool.slug), `Duplicate catalog slug: ${tool.slug}`).toBe(false);
      slugs.add(tool.slug);
      expect(tool.cliExample).toContain(`codestation run ${tool.slug}`);
    }

    const readme = fs.readFileSync(
      path.join(rootDir, "packages/codestation-mcp/README.md"),
      "utf-8"
    );
    expect(readme).toContain(README_BEGIN_MARKER);
    expect(readme).toContain(README_END_MARKER);
  });
});
