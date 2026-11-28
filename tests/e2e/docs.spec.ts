import { test, expect } from "@playwright/test";
import mcpCatalog from "../../config/mcp-docs-catalog.json";
import {
  DESKTOP_VIEWPORT,
  expectNoMobileOverflow,
  expectNoSeriousA11yViolations,
  trackRuntimeErrors,
} from "./helpers";

test.describe("Documentation Repository (/docs) & MCP Catalog Explorer", () => {
  test("renders quickstart IDE tabs, searchable 330+ tool catalog, 0 axe violations, and 0 mobile overflow", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    const res = await page.goto("/docs");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Documentation Repository");

    // Verify Quickstart IDE tabs (Cursor, Claude Desktop, Windsurf, Claude Code, VS Code)
    const quickstart = page.getByTestId("mcp-quickstart-tabs");
    await expect(quickstart).toBeVisible();

    await quickstart.getByRole("tab", { name: "VS Code" }).click();
    const vsPanel = quickstart.getByRole("tabpanel", { name: "VS Code" });
    await expect(vsPanel).toContainText('"servers"');
    await expect(vsPanel).toContainText('"type": "stdio"');

    await quickstart.getByRole("tab", { name: "Claude Code" }).click();
    const claudeCodePanel = quickstart.getByRole("tabpanel", { name: "Claude Code" });
    await expect(claudeCodePanel).toContainText("claude mcp add codestation");

    await quickstart.getByRole("tab", { name: "Cursor" }).click();
    await expect(quickstart.getByRole("tabpanel", { name: "Cursor" })).toContainText("CODESTATION_LICENSE_KEY");

    // Free Tier toggle updates snippet cleanly
    await quickstart.getByRole("button", { name: "Free Tier (No Key Required)" }).click();
    await expect(quickstart.getByRole("tabpanel", { name: "Cursor" })).not.toContainText("CODESTATION_LICENSE_KEY");

    // Verify Searchable MCP & CLI Tool Catalog
    const explorer = page.getByTestId("mcp-catalog-explorer");
    await expect(explorer).toBeVisible();
    await expect(explorer.getByTestId("catalog-match-count")).toContainText(
      `of ${mcpCatalog.counts.executableTotal} matching tools`
    );

    // Filter by Tier = Free -> exact 15 tools
    await explorer.getByRole("button", { name: `Free (${mcpCatalog.counts.freeExecutable})` }).click();
    await expect(explorer.getByTestId("catalog-match-count")).toContainText(
      `Showing 15 of 15 matching tools`
    );

    // Reset tier to All Tiers, filter by Runtime = Local File -> node-file tools
    await explorer.getByRole("button", { name: "All Tiers" }).click();
    await explorer.getByRole("button", { name: `Local File (${mcpCatalog.counts.nodeFileWired})` }).click();
    await expect(explorer.getByTestId("catalog-match-count")).toContainText(
      `of ${mcpCatalog.counts.nodeFileWired} matching tools`
    );
    await expect(explorer).toContainText("pdf-merge");

    // Filter by Station + search query and copy CLI command
    await explorer.getByRole("button", { name: "All Runtimes" }).click();
    await explorer.getByLabel("Search MCP and CLI tool catalog").fill("json-to-yaml");
    await expect(explorer.getByTestId("catalog-match-count")).toContainText("1 matching tools");
    const copyBtn = explorer.getByRole("button", { name: "Copy CLI command for json-to-yaml" });
    await copyBtn.click();
    await expect(copyBtn).toContainText("Copied");

    // Reset search so full page audit runs cleanly
    await explorer.getByLabel("Search MCP and CLI tool catalog").fill("");

    // Accessibility + 390px Mobile responsiveness
    await expectNoSeriousA11yViolations(page, "/docs");
    await expectNoMobileOverflow(page, "/docs");

    expect(errors).toEqual([]);
  });
});
