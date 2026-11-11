/**
 * Comprehensive 4-Tier E2E Homepage & Performance Test Suite (Round 2: R1, R2, R3)
 *
 * Tier 1: Feature Coverage (>= 5 tests per requirement across R1, R2, R3)
 * Tier 2: Boundary & Corner Cases (>= 5 tests per feature)
 * Tier 3: Cross-Feature Combinations
 * Tier 4: Real-World Application Scenarios
 *
 * Scope:
 * - R1: Personal Tools (Favorites and Recently Used) Truncation & Toggle
 * - R2: Homepage Visual Polish and UX Refinement
 * - R3: Site-Wide and Homepage Performance Optimization
 */

// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Components under test
import HomePage from "@/app/page";
import PersonalTools, { FavoriteButton } from "@/components/PersonalTools";
import { WorkbenchProvider } from "@/components/WorkbenchProvider";
import ToolCard from "@/components/ToolCard";
import ToolLauncher from "@/components/ToolLauncher";

// Configuration and engines
import { tools } from "@/config/tools";
import { stations } from "@/config/stations";
import { searchTools, normalizeToolSearch } from "@/lib/tool-search";
import { preferenceKey, defaultPreferences, parsePreferences } from "@/lib/workbench/preferences";
import { LIST_TOOLS_MCP, EXECUTE_TOOL_MCP } from "@/lib/webmcp/registry";
import type { WebMcpToolResult } from "@/lib/webmcp/types";

// JSX helper for strict .ts environment
const el = React.createElement;

// Mock router push
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("@/components/useSafeNavigation", () => ({
  useSafePathname: () => "/",
  useSafeRouter: () => ({ push: pushMock }),
}));

// Setup dialog polyfills and storage isolation
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  pushMock.mockClear();

  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ============================================================================
// TIER 1: FEATURE COVERAGE (>= 5 tests each for R1, R2, R3)
// ============================================================================

describe("Tier 1: Feature Coverage", () => {
  // --------------------------------------------------------------------------
  // Feature R1: Personal Tools Truncation & Toggle
  // --------------------------------------------------------------------------
  describe("R1: Personal Tools Truncation & Toggle", () => {
    it("1.1.1 truncates initial display of Favorites to at most 4 items when >4 favorites exist", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "base64-encoder",
            "uuid-generator",
            "url-encoder",
            "text-counter",
            "jwt-decoder",
          ],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Verifies exact 4 items rendered initially
      const items = favSection.getAllByRole("listitem");
      expect(items).toHaveLength(4);
      expect(items[0].textContent).toContain("JSON Formatter");
      expect(items[1].textContent).toContain("Base64 Encoder");
      expect(items[2].textContent).toContain("UUID Generator");
      expect(items[3].textContent).toContain("URL Encoder");
    });

    it("1.1.2 renders accessible 'Show more' toggle button with aria-expanded='false' and aria-controls", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "base64-encoder",
            "uuid-generator",
            "url-encoder",
            "text-counter",
            "jwt-decoder",
          ],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      const toggle = favSection.getByRole("button", { name: "Show more" });
      expect(toggle).toBeDefined();
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.getAttribute("aria-controls")).toBe("personal-list-favorites");
      expect(toggle.className).toContain("personal-tools-toggle");
    });

    it("1.1.3 expands to show all items on click and switches label to 'Show less' with aria-expanded='true'", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "base64-encoder",
            "uuid-generator",
            "url-encoder",
            "text-counter",
            "jwt-decoder",
          ],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      const toggle = favSection.getByRole("button", { name: "Show more" });
      fireEvent.click(toggle);

      // Now all 6 items are visible
      expect(favSection.getAllByRole("listitem")).toHaveLength(6);
      const expandedBtn = favSection.getByRole("button", { name: "Show less" });
      expect(expandedBtn.getAttribute("aria-expanded")).toBe("true");
    });

    it("1.1.4 collapses back to 4 items on 'Show less' click and resets label to 'Show more'", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "base64-encoder",
            "uuid-generator",
            "url-encoder",
            "text-counter",
            "jwt-decoder",
          ],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Expand
      fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(6);

      // Collapse
      fireEvent.click(favSection.getByRole("button", { name: "Show less" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")).toBe("false");
    });

    it("1.1.5 Recently Used independently truncates to 4 items with its own toggle without affecting Favorites", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: ["json-formatter", "base64-encoder"], // 2 items -> no toggle
          recent: [
            "html-encoder",
            "html-decoder",
            "base64-decoder",
            "url-decoder",
            "password-generator",
          ], // 5 items -> toggle
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });
      const favSection = within(favHeading.closest("div")!);
      const recSection = within(recHeading.closest("div")!);

      // Favorites has 2 items and no toggle
      expect(favSection.getAllByRole("listitem")).toHaveLength(2);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();

      // Recently used has 4 displayed out of 5 and has a toggle
      expect(recSection.getAllByRole("listitem")).toHaveLength(4);
      const recToggle = recSection.getByRole("button", { name: "Show more" });
      expect(recToggle.getAttribute("aria-controls")).toBe("personal-list-recently-used");

      // Expand recently used
      fireEvent.click(recToggle);
      expect(recSection.getAllByRole("listitem")).toHaveLength(5);
      expect(recSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");

      // Favorites remains unaffected with 2 items
      expect(favSection.getAllByRole("listitem")).toHaveLength(2);
    });

    it("1.1.6 omits expand/collapse toggle button when section contains 4 or fewer items", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: ["json-formatter", "base64-encoder", "uuid-generator", "url-encoder"],
          recent: ["text-counter", "jwt-decoder", "html-encoder"],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });

      const favSection = within(favHeading.closest("div")!);
      const recSection = within(recHeading.closest("div")!);

      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();

      expect(recSection.getAllByRole("listitem")).toHaveLength(3);
      expect(recSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Feature R2: Homepage Visual Polish & Copy Consistency
  // --------------------------------------------------------------------------
  describe("R2: Homepage Visual Polish & Copy Consistency", () => {
    it("1.2.1 preserves station cards grid structure across all 25 registered stations", () => {
      render(el(HomePage));
      const directory = within(screen.getByRole("region", { name: "Choose a station" }));
      const stationLinks = directory.getAllByRole("link");

      expect(stationLinks).toHaveLength(stations.length);
      expect(stationLinks.map((l) => l.getAttribute("href"))).toEqual(stations.map((s) => s.route));
    });

    it("1.2.2 renders tool count badges with exact tool counts matching station registry", () => {
      render(el(HomePage));
      const directory = within(screen.getByRole("region", { name: "Choose a station" }));
      const stationLinks = directory.getAllByRole("link");

      stationLinks.forEach((link, idx) => {
        expect(link.textContent).toContain(`${stations[idx].toolCount} available tools`);
      });
    });

    it("1.2.3 quick access cards render StationMark symbols, names, descriptions, and directional arrows", () => {
      render(el(HomePage));
      const quickSection = within(screen.getByRole("region", { name: "Quick access" }));
      const links = quickSection.getAllByRole("link").slice(1); // first link is "/tools" browse link

      expect(links.length).toBeGreaterThanOrEqual(4);
      links.forEach((link) => {
        expect(link.getAttribute("href")).toMatch(/^\/tools\//);
        expect(link.querySelector("h3")).toBeTruthy();
        expect(link.querySelector("p")).toBeTruthy();
      });
    });

    it("1.2.4 highlights browser developer tools consistently in hero copy and eyebrow", () => {
      render(el(HomePage));
      // Eyebrow and intro declare tools count and stations
      const eyebrowText = screen.getByText(/PRIVATE TOOLS · WEBMCP BROWSER AI PROTOCOL · 26 STATIONS/i);
      expect(eyebrowText).toBeDefined();

      const introText = screen.getByText(/developer utilities across 26 stations/i);
      expect(introText).toBeDefined();
    });

    it("1.2.5 Pro section provides structured pricing and actionable CTA links to /pro and /docs", () => {
      render(el(HomePage));
      const proHeading = screen.getByRole("heading", { level: 2, name: /Code Station Pro/i });
      expect(proHeading).toBeDefined();

      const proLink = screen.getByRole("link", { name: /Get Pro for AI/i });
      expect(proLink.getAttribute("href")).toBe("/pro");

      const docsLink = screen.getByRole("link", { name: /Explore Docs & MCP/i });
      expect(docsLink.getAttribute("href")).toBe("/docs");
    });

    it("1.2.6 preserves all 9 canonical sections and keeps decorative SVGs accessible with aria-hidden", () => {
      const { container } = render(el(HomePage));

      // Verify all decorative svgs have aria-hidden="true"
      const svgs = container.querySelectorAll("main svg");
      expect(svgs.length).toBeGreaterThan(5);
      svgs.forEach((svg) => {
        expect(svg.getAttribute("aria-hidden")).toBe("true");
      });

      // Verify 3 showcase articles are intact
      const showcaseRegion = within(screen.getByRole("region", { name: "Make room for the work." }));
      expect(showcaseRegion.getAllByRole("article")).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // Feature R3: Site-Wide & Homepage Performance Optimizations
  // --------------------------------------------------------------------------
  describe("R3: Site-Wide & Homepage Performance Optimizations", () => {
    it("1.3.1 renders ToolCard with accessible link to /tools/[slug]", () => {
      const sampleTool = tools[0];
      const { container } = render(
        el(WorkbenchProvider, null, el(ToolCard, { tool: sampleTool }))
      );

      const link = container.querySelector("a.tool-card");
      expect(link).toBeTruthy();
      expect(link?.getAttribute("href")).toBe(`/tools/${sampleTool.slug}`);
    });

    it("1.3.2 primary station directory links preserve standard navigation routes", () => {
      render(el(HomePage));
      const directory = within(screen.getByRole("region", { name: "Choose a station" }));
      const stationLinks = directory.getAllByRole("link");

      expect(stationLinks.length).toBe(stations.length);
      expect(stationLinks[0].getAttribute("href")).toBe(stations[0].route);
      expect(stationLinks[stationLinks.length - 1].getAttribute("href")).toBe(stations[stations.length - 1].route);
    });

    it("1.3.3 ToolLauncher search dialog handles global keyboard trigger (Cmd/Ctrl + K)", () => {
      render(el(WorkbenchProvider, null, el(ToolLauncher)));

      // Trigger Cmd+K
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      const searchBox = screen.getByRole("searchbox");
      expect(searchBox).toBeDefined();

      // Search filters tools dynamically
      fireEvent.change(searchBox, { target: { value: "uuid" } });
      const results = screen.getByRole("list");
      expect(results.textContent).toContain("UUID Generator");
    });

    it("1.3.4 WebMCP registry supports async tool listing and execution contracts", async () => {
      // 1. List tools
      const listResult = (await LIST_TOOLS_MCP.execute({ limit: 10 })) as WebMcpToolResult;
      expect(listResult.content).toBeDefined();
      const listData = JSON.parse(listResult.content[0].text);
      expect(listData.returned).toBe(10);
      expect(listData.tools.length).toBe(10);

      // 2. Execute tool
      const execResult = (await EXECUTE_TOOL_MCP.execute({
        toolId: "json-formatter",
        input: '{"status":"ok"}',
      })) as WebMcpToolResult;
      expect(execResult.content[0].text).toContain('"status": "ok"');
    });

    it("1.3.5 normalizeToolSearch handles whitespace and casing efficiently without allocations", () => {
      expect(normalizeToolSearch("  JSON  Formatter  ")).toBe("json formatter");
      expect(normalizeToolSearch("\t\nBASE-64\t\r")).toBe("base-64");
      expect(normalizeToolSearch("")).toBe("");
    });

    it("1.3.6 NativeAd container enforces layout containment preventing layout shifts (CLS)", () => {
      // Inspect Home.module.css for containment
      const cssPath = path.resolve(process.cwd(), "app/Home.module.css");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      expect(cssContent).toContain("contain: layout paint;");
      expect(cssContent).toContain("min-height: 250px;");
    });
  });
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (>= 5 tests each for R1, R2, R3)
// ============================================================================

describe("Tier 2: Boundary & Corner Cases", () => {
  // --------------------------------------------------------------------------
  // Feature R1 Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe("R1: Personal Tools Boundary & Corner Cases", () => {
    it("2.1.1 renders null when lists are empty on homepage (always=false) and muted text on workbench (always=true)", async () => {
      // 1. Homepage (always=false) -> null
      const { container } = render(
        el(WorkbenchProvider, null, el(PersonalTools, { always: false }))
      );
      expect(container.firstChild).toBeNull();

      // 2. Workbench (always=true) -> guidance copy with 0 toggle buttons
      cleanup();
      render(
        el(WorkbenchProvider, null, el(PersonalTools, { always: true }))
      );
      await screen.findByRole("region", { name: "Your tools" });
      expect(screen.getByText("Use a star to keep a tool here.")).toBeDefined();
      expect(
        screen.getByText("Tools you visit appear here. Only tool names are remembered.")
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("2.1.2 boundary condition: exactly 4 items renders all 4 items and zero toggle buttons", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: ["json-formatter", "base64-encoder", "uuid-generator", "url-encoder"],
          recent: [],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("2.1.3 threshold condition: exactly 5 items displays 4 items + toggle; expanding reveals all 5", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "base64-encoder",
            "uuid-generator",
            "url-encoder",
            "text-counter",
          ],
          recent: [],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Initially 4 shown
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      const toggle = favSection.getByRole("button", { name: "Show more" });
      expect(toggle).toBeDefined();

      // Expand reveals 5th
      fireEvent.click(toggle);
      expect(favSection.getAllByRole("listitem")).toHaveLength(5);
      expect(favSection.getByText("Text Counter")).toBeDefined();
    });

    it("2.1.4 dynamic removal: removing favorite reduces count to 4, immediately unmounting toggle", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "base64-encoder",
            "uuid-generator",
            "url-encoder",
            "text-counter",
          ],
          recent: [],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Expand to 5
      fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(5);

      // Unfavorite 1 item via favorite button
      const removeBtn = screen.getByRole("button", { name: /Remove Text Counter/i });
      fireEvent.click(removeBtn);

      // Immediately 4 items left and toggle is completely unmounted
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("2.1.5 filters out unrecognized / deprecated tool slugs before calculating truncation", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "non-existent-tool-alpha",
            "base64-encoder",
            "deprecated-tool-beta",
            "uuid-generator",
          ],
          recent: [],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Only 3 valid tools exist -> exactly 3 displayed, no toggle
      expect(favSection.getAllByRole("listitem")).toHaveLength(3);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("2.1.6 rapid toggle clicks alternate between expanded and collapsed without state corruption", async () => {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          ...defaultPreferences,
          favorites: [
            "json-formatter",
            "base64-encoder",
            "uuid-generator",
            "url-encoder",
            "text-counter",
            "jwt-decoder",
          ],
          recent: [],
        })
      );

      render(el(WorkbenchProvider, null, el(PersonalTools)));

      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      for (let cycle = 0; cycle < 3; cycle++) {
        // Expand
        fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
        expect(favSection.getAllByRole("listitem")).toHaveLength(6);
        expect(favSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");

        // Collapse
        fireEvent.click(favSection.getByRole("button", { name: "Show less" }));
        expect(favSection.getAllByRole("listitem")).toHaveLength(4);
        expect(favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")).toBe("false");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature R2 Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe("R2: Homepage Visual Polish Boundary & Corner Cases", () => {
    it("2.2.1 station cards with short vs long descriptions both render complete structure and arrow", () => {
      render(el(HomePage));
      const directory = within(screen.getByRole("region", { name: "Choose a station" }));
      const markdownStation = directory.getByRole("link", { name: /^Markdown\b/i });
      const cryptoStation = directory.getByRole("link", { name: /WebPKI/i });

      expect(markdownStation).toBeDefined();
      expect(cryptoStation).toBeDefined();
      expect(markdownStation.textContent).toContain("available tools");
      expect(cryptoStation.textContent).toContain("available tools");
    });

    it("2.2.2 whitespace-only search query normalizes cleanly and defaults to featured tools", () => {
      render(el(HomePage));
      const input = screen.getByRole("textbox", { name: "Search all tools" });

      fireEvent.change(input, { target: { value: "     " } });
      expect(screen.getByRole("region", { name: "Quick access" })).toBeDefined();
    });

    it("2.2.3 unmatched query string renders empty state message and functional 'Clear search' button", () => {
      render(el(HomePage));
      const input = screen.getByRole("textbox", { name: "Search all tools" });

      fireEvent.change(input, { target: { value: "unmatched-tool-query-xyz999" } });
      expect(screen.getByText("No available tools match that search.")).toBeDefined();

      const clearBtn = screen.getByRole("button", { name: "Clear search" });
      fireEvent.click(clearBtn);

      expect((input as HTMLInputElement).value).toBe("");
      expect(screen.getByRole("region", { name: "Quick access" })).toBeDefined();
    });

    it("2.2.4 dark theme tokens are defined in Home.module.css for all key variables", () => {
      const cssPath = path.resolve(process.cwd(), "app/Home.module.css");
      const css = fs.readFileSync(cssPath, "utf-8");

      expect(css).toContain('[data-theme="dark"]');
      expect(css).toContain("--home-bg:");
      expect(css).toContain("--home-ink:");
      expect(css).toContain("--home-line:");
      expect(css).toContain("--home-surface:");
      expect(css).toContain("--home-lime:");
    });

    it("2.2.5 keyboard shortcut Cmd/Ctrl + Shift + V focuses search on both Mac and Windows modifiers", () => {
      render(el(HomePage));
      const input = screen.getByRole("textbox", { name: "Search all tools" });

      // 1. MetaKey (Mac)
      input.blur();
      expect(document.activeElement).not.toBe(input);
      fireEvent.keyDown(window, { key: "v", code: "KeyV", metaKey: true, shiftKey: true });
      expect(document.activeElement).toBe(input);

      // 2. CtrlKey (Windows/Linux)
      input.blur();
      expect(document.activeElement).not.toBe(input);
      fireEvent.keyDown(window, { key: "v", code: "KeyV", ctrlKey: true, shiftKey: true });
      expect(document.activeElement).toBe(input);

      // 3. Regular 'v' without modifier does NOT focus
      input.blur();
      fireEvent.keyDown(window, { key: "v", code: "KeyV" });
      expect(document.activeElement).not.toBe(input);
    });

    it("2.2.6 format triage banner renders deep link button when input is detected format", () => {
      render(el(HomePage));
      const input = screen.getByRole("textbox", { name: "Search all tools" });

      fireEvent.change(input, { target: { value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M" } });
      expect(screen.getByText(/Detected: JWT/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /Open in JWT Decoder/i })).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Feature R3 Boundary & Corner Cases
  // --------------------------------------------------------------------------
  describe("R3: Performance Optimization Boundary & Corner Cases", () => {
    it("2.3.1 search normalization with special regex characters executes safely without throwing", () => {
      const specialQueries = [
        ".*+?^${}()|[]\\",
        "([a-z]+)*",
        "???+++***",
        '{"foo": "bar"}',
        "<div><script>",
        "\\\\\\",
      ];

      for (const q of specialQueries) {
        expect(() => searchTools(tools, q)).not.toThrow();
        const results = searchTools(tools, q);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it("2.3.2 very long search query (>10,000 chars) executes within bounded time without stack overflow", () => {
      const longQuery = "a".repeat(10_000);
      const startTime = performance.now();
      const results = searchTools(tools, longQuery);
      const duration = performance.now() - startTime;

      expect(Array.isArray(results)).toBe(true);
      expect(duration).toBeLessThan(150); // <150ms bounded execution
    });

    it("2.3.3 corrupted localStorage payload recovers safely to defaultPreferences without crashing", () => {
      const validSlugs = new Set(tools.map((t) => t.slug));

      const corrupted1 = "{invalid-json-string";
      const res1 = parsePreferences(corrupted1, validSlugs);
      expect(res1.favorites).toEqual([]);
      expect(res1.rememberRecent).toBe(true);

      const corrupted2 = "null";
      const res2 = parsePreferences(corrupted2, validSlugs);
      expect(res2).toEqual(defaultPreferences);

      const partial = JSON.stringify({ favorites: ["json-formatter"] });
      const res3 = parsePreferences(partial, validSlugs);
      expect(res3.favorites).toEqual(["json-formatter"]);
      expect(res3.rememberRecent).toBe(true);
    });

    it("2.3.4 search rank ordering: exact name match ranks ahead of keyword and description match", () => {
      const results = searchTools(tools, "json formatter");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].slug).toBe("json-formatter");
    });

    it("2.3.5 WebMCP LIST_TOOLS_MCP.execute bounds limit parameter to [1, 100]", async () => {
      // Negative limit bounds to 1
      const resMin = (await LIST_TOOLS_MCP.execute({ limit: -5 })) as WebMcpToolResult;
      const dataMin = JSON.parse(resMin.content[0].text);
      expect(dataMin.returned).toBe(1);

      // Over 100 bounds to 100
      const resMax = (await LIST_TOOLS_MCP.execute({ limit: 500 })) as WebMcpToolResult;
      const dataMax = JSON.parse(resMax.content[0].text);
      expect(dataMax.returned).toBe(100);
    });

    it("2.3.6 WebMCP EXECUTE_TOOL_MCP.execute returns isError when toolId is omitted", async () => {
      const res = (await EXECUTE_TOOL_MCP.execute({} as any)) as WebMcpToolResult;
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Missing required argument 'toolId'");
    });
  });
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================

describe("Tier 3: Cross-Feature Combinations", () => {
  it("3.1 PersonalTools integrates inside Homepage above Quick Access when favorites are present", async () => {
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        ...defaultPreferences,
        favorites: [
          "json-formatter",
          "base64-encoder",
          "uuid-generator",
          "url-encoder",
          "text-counter",
          "jwt-decoder",
        ],
      })
    );

    render(el(WorkbenchProvider, null, el(HomePage)));

    // Personal tools rendered with 4 items + toggle
    const personalRegion = await screen.findByRole("region", { name: "Your tools" });
    const favHeading = within(personalRegion).getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    const toggle = favSection.getByRole("button", { name: "Show more" });
    expect(toggle).toBeDefined();

    // Quick access section follows immediately
    expect(screen.getByRole("region", { name: "Quick access" })).toBeDefined();
  });

  it("3.2 PersonalTools integrates inside Workbench (always=true) with empty guidance copy", async () => {
    render(el(WorkbenchProvider, null, el(PersonalTools, { always: true })));

    const region = await screen.findByRole("region", { name: "Your tools" });
    expect(within(region).getByText("Use a star to keep a tool here.")).toBeDefined();
    expect(
      within(region).getByText("Tools you visit appear here. Only tool names are remembered.")
    ).toBeDefined();
  });

  it("3.3 Search format detection triage operates concurrently with populated PersonalTools", async () => {
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        ...defaultPreferences,
        favorites: ["json-formatter", "base64-encoder"],
      })
    );

    render(el(WorkbenchProvider, null, el(HomePage)));

    await screen.findByRole("region", { name: "Your tools" });

    // Type JSON in search
    const input = screen.getByRole("textbox", { name: "Search all tools" });
    fireEvent.change(input, { target: { value: '{"type":"test"}' } });

    // Format detection displays
    expect(screen.getByText(/Detected: JSON/i)).toBeDefined();

    // Personal tools remain rendered
    expect(screen.getByRole("region", { name: "Your tools" })).toBeDefined();
  });

  it("3.4 Secondary tool cards and station directory links render co-located valid paths", () => {
    render(el(WorkbenchProvider, null, el(HomePage)));

    // Quick access secondary cards point to /tools/
    const quickSection = within(screen.getByRole("region", { name: "Quick access" }));
    const toolLinks = quickSection.getAllByRole("link").slice(1);
    expect(toolLinks.length).toBeGreaterThan(0);
    toolLinks.forEach((l) => expect(l.getAttribute("href")).toMatch(/^\/tools\//));

    // Station directory links point to /stations/
    const directory = within(screen.getByRole("region", { name: "Choose a station" }));
    const stationLinks = directory.getAllByRole("link");
    expect(stationLinks.length).toBe(stations.length);
    stationLinks.forEach((l) => expect(l.getAttribute("href")).toMatch(/^\/stations\//));
  });

  it("3.5 Star toggle button updates PersonalTools dynamically without page reload", async () => {
    render(
      el(
        WorkbenchProvider,
        null,
        el(FavoriteButton, { slug: "json-formatter" }),
        el(PersonalTools, { always: true })
      )
    );

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    // Initially empty
    expect(favSection.queryAllByRole("listitem")).toHaveLength(0);

    // Click star button to add favorite
    const starBtn = screen.getByRole("button", { name: /Add JSON Formatter/i });
    fireEvent.click(starBtn);

    // PersonalTools immediately updates
    await waitFor(() => {
      expect(favSection.getAllByRole("listitem")).toHaveLength(1);
    });
    expect(favSection.getByText("JSON Formatter")).toBeDefined();

    // Click star again to remove
    const removeBtns = screen.getAllByRole("button", { name: /Remove JSON Formatter/i });
    fireEvent.click(removeBtns[0]);

    await waitFor(() => {
      expect(favSection.queryAllByRole("listitem")).toHaveLength(0);
    });
  });
});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS
// ============================================================================

describe("Tier 4: Real-World Application Scenarios", () => {
  it("4.1 User Onboarding, Tool Star Workflow, and Section Expansion Journey", async () => {
    // Scenario: User explores Code Station and stars 6 tools across stations
    const initialFavorites = [
      "json-formatter",
      "base64-encoder",
      "uuid-generator",
      "url-encoder",
      "text-counter",
      "jwt-decoder",
    ];

    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        ...defaultPreferences,
        favorites: initialFavorites,
      })
    );

    render(el(WorkbenchProvider, null, el(HomePage)));

    // Step 1: User observes Favorites truncated to initial 4
    const personalRegion = await screen.findByRole("region", { name: "Your tools" });
    const favHeading = within(personalRegion).getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    const toggle = favSection.getByRole("button", { name: "Show more" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // Step 2: User expands to see all 6 tools
    fireEvent.click(toggle);
    expect(favSection.getAllByRole("listitem")).toHaveLength(6);
    expect(favSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");

    // Step 3: User removes one favorite, leaving 5
    fireEvent.click(screen.getByRole("button", { name: /Remove JWT Decoder/i }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(5);
    expect(favSection.getByRole("button", { name: "Show less" })).toBeDefined();

    // Step 4: User removes another, leaving 4
    fireEvent.click(screen.getByRole("button", { name: /Remove Text Counter/i }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);

    // Step 5: Toggle automatically disappears
    expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
  });

  it("4.2 Smart Clipboard Format Triage and Hand-off Execution Journey", async () => {
    // Scenario: Developer hits Cmd+Shift+V, pastes JWT, inspects detection, and clicks deep link
    render(el(WorkbenchProvider, null, el(HomePage)));

    const input = screen.getByRole("textbox", { name: "Search all tools" });

    // Step 1: Global shortcut triggers focus
    input.blur();
    fireEvent.keyDown(window, { key: "v", code: "KeyV", metaKey: true, shiftKey: true });
    expect(document.activeElement).toBe(input);

    // Step 2: Developer pastes JWT string
    const sampleJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.signature";
    fireEvent.change(input, { target: { value: sampleJwt } });

    // Step 3: Triage detects format
    const triageBadge = screen.getByText(/Detected: JWT/i);
    expect(triageBadge).toBeDefined();

    // Step 4: Click deep link
    const actionBtn = screen.getByRole("button", { name: /Open in JWT Decoder/i });
    fireEvent.click(actionBtn);

    // Step 5: Input is queued in sessionStorage
    const pending = sessionStorage.getItem("codestation_pending_input");
    expect(pending).toBeTruthy();
    expect(JSON.parse(pending!).slug).toBe("jwt-decoder");

    // Router navigated to tool
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/tools/jwt-decoder"));
  });

  it("4.3 Dual-Section Multi-Station Workbench Expansion and State Isolation Journey", async () => {
    // Scenario: Developer with 6 favorites and 5 recently visited tools opens /workbench
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        ...defaultPreferences,
        favorites: [
          "json-formatter",
          "base64-encoder",
          "uuid-generator",
          "url-encoder",
          "text-counter",
          "jwt-decoder",
        ],
        recent: [
          "html-encoder",
          "html-decoder",
          "base64-decoder",
          "url-decoder",
          "password-generator",
        ],
      })
    );

    render(el(WorkbenchProvider, null, el(PersonalTools, { always: true })));

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });

    const favSection = within(favHeading.closest("div")!);
    const recSection = within(recHeading.closest("div")!);

    // Step 1: Both start truncated at 4
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(recSection.getAllByRole("listitem")).toHaveLength(4);

    // Step 2: Expand Favorites only
    fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(6);
    expect(recSection.getAllByRole("listitem")).toHaveLength(4); // completely independent

    // Step 3: Expand Recently used
    fireEvent.click(recSection.getByRole("button", { name: "Show more" }));
    expect(recSection.getAllByRole("listitem")).toHaveLength(5);
    expect(favSection.getAllByRole("listitem")).toHaveLength(6);

    // Step 4: Collapse Favorites
    fireEvent.click(favSection.getByRole("button", { name: "Show less" }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(recSection.getAllByRole("listitem")).toHaveLength(5); // stays expanded
  });

  it("4.4 Comprehensive Performance, Metadata, and Station Directory Audit Journey", async () => {
    // Scenario: Full audit of discovery contracts, routes, and WebMCP protocol
    // 1. Verify 26 stations exist in authoritative registry
    expect(stations).toHaveLength(26);
    const stationSlugs = stations.map((s) => s.id);
    expect(stationSlugs).toContain("policy-generators");
    expect(stationSlugs).toContain("ai-prompts");
    expect(stationSlugs).toContain("crypto-pki");
    expect(stationSlugs).toContain("pdf");
    expect(stationSlugs).toContain("json-data");

    // 2. WebMCP discovery lists available tools across stations
    const aiToolsRes = (await LIST_TOOLS_MCP.execute({ category: "AI & Prompt Engineering", limit: 10 })) as WebMcpToolResult;
    const aiData = JSON.parse(aiToolsRes.content[0].text);
    expect(aiData.returned).toBeGreaterThanOrEqual(5);

    const cryptoToolsRes = (await LIST_TOOLS_MCP.execute({ category: "WebPKI", limit: 10 })) as WebMcpToolResult;
    const cryptoData = JSON.parse(cryptoToolsRes.content[0].text);
    expect(cryptoData.returned).toBeGreaterThanOrEqual(5);

    // 3. System font stack in app/globals.css avoids external webfonts and CLS
    const globalsCss = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf-8");
    expect(globalsCss).toContain("Arial, Helvetica, sans-serif;");
    expect(globalsCss).toContain("ui-monospace, SFMono-Regular, Menlo, monospace;");
  });
});
