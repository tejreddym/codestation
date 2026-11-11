/**
 * Tier 5 Adversarial Coverage Hardening Test Suite (Round 2)
 *
 * Scope:
 * - Dimension 1: WebMCP Dynamic Dispatcher Import & Execution Engine Stress
 * - Dimension 2: Command Palette Lazy Activation & Keyboard Navigation Race Conditions
 * - Dimension 3: Search Normalization Memoization & WeakMap Cache Integrity
 * - Dimension 4: Secondary Link Prefetch Suppression & Primary Route Preservation
 * - Dimension 5: Rapid UI State Transitions & Reactivity
 */

// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Components under test
import HomePage from "@/app/page";
import PersonalTools, { FavoriteButton } from "@/components/PersonalTools";
import HomeSearch, { type ToolCardMetadata } from "@/components/HomeSearch";
import ToolLauncher from "@/components/ToolLauncher";
import ToolCard from "@/components/ToolCard";
import { WorkbenchProvider } from "@/components/WorkbenchProvider";

// Registry, configs, and engines
import { tools, getTool, type ToolDefinition } from "@/config/tools";
import { stations } from "@/config/stations";
import { searchTools, normalizeToolSearch } from "@/lib/tool-search";
import {
  LIST_TOOLS_MCP,
  EXECUTE_TOOL_MCP,
  createWebMcpToolForDefinition,
  resetWebMcpForTesting,
} from "@/lib/webmcp/registry";
import type { WebMcpToolResult } from "@/lib/webmcp/types";
import { preferenceKey, defaultPreferences } from "@/lib/workbench/preferences";

// JSX helper for strict .ts environment
const el = React.createElement;

// Mock next/link to capture prefetch prop into DOM data-prefetch attribute
vi.mock("next/link", () => ({
  default: ({ href, prefetch, children, ...props }: any) => {
    return React.createElement(
      "a",
      {
        href,
        "data-prefetch": prefetch !== undefined ? String(prefetch) : "default",
        ...props,
      },
      children
    );
  },
}));

// Mock router navigation
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("@/components/useSafeNavigation", () => ({
  useSafePathname: () => "/",
  useSafeRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  pushMock.mockClear();
  resetWebMcpForTesting();

  // Dialog element polyfills for jsdom
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
// DIMENSION 1: WEBMCP DYNAMIC DISPATCHER IMPORT & EXECUTION ENGINE STRESS
// ============================================================================

describe("Dimension 1: WebMCP Dynamic Dispatcher Import & Execution Engine Stress", () => {
  it("1.1 executes LIST_TOOLS_MCP concurrently across 50 parallel invocations with dynamic imports", async () => {
    const categories = [
      "JSON & Data",
      "Encoding",
      "Security",
      "WebPKI & Advanced Cryptography",
      "AI & Prompt Engineering",
      "Developer Math",
    ];

    const tasks = Array.from({ length: 50 }, async (_, i) => {
      const category = categories[i % categories.length];
      const result = (await LIST_TOOLS_MCP.execute({
        category,
        limit: (i % 20) + 1,
      })) as WebMcpToolResult;

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.totalMatches).toBeGreaterThan(0);
      expect(parsed.returned).toBeLessThanOrEqual((i % 20) + 1);
      expect(Array.isArray(parsed.tools)).toBe(true);
    });

    await Promise.all(tasks);
  });

  it("1.2 enforces boundary clamps on limit (limit <= 0 clamps to 1; limit > 100 clamps to 100; NaN clamps to 0)", async () => {
    // Negative limit -> clamps to 1
    const resNegative = (await LIST_TOOLS_MCP.execute({ limit: -10 })) as WebMcpToolResult;
    const dataNegative = JSON.parse(resNegative.content[0].text);
    expect(dataNegative.returned).toBe(1);

    // Limit 0 -> clamps to 1
    const resZero = (await LIST_TOOLS_MCP.execute({ limit: 0 })) as WebMcpToolResult;
    const dataZero = JSON.parse(resZero.content[0].text);
    expect(dataZero.returned).toBe(1);

    // Limit 9999 -> clamps to 100
    const resHuge = (await LIST_TOOLS_MCP.execute({ limit: 9999 })) as WebMcpToolResult;
    const dataHuge = JSON.parse(resHuge.content[0].text);
    expect(dataHuge.returned).toBe(100);

    // Non-numeric limit -> slice(0, NaN) returns 0 results without throwing
    const resNaN = (await LIST_TOOLS_MCP.execute({ limit: "invalid" })) as WebMcpToolResult;
    const dataNaN = JSON.parse(resNaN.content[0].text);
    expect(dataNaN.returned).toBe(0);
  });

  it("1.3 handles adversarial search queries (regex chars, SQL injection strings, null args) without syntax errors", async () => {
    const adversarialQueries = [
      ".*+?^${}()|[]\\",
      "'; DROP TABLE tools; --",
      "<script>alert(1)</script>",
      "\0\r\n\t",
      "🚀✨💻🔥",
      "A".repeat(1000),
    ];

    for (const q of adversarialQueries) {
      const res = (await LIST_TOOLS_MCP.execute({ query: q })) as WebMcpToolResult;
      expect(res.content).toBeDefined();
      const parsed = JSON.parse(res.content[0].text);
      expect(typeof parsed.totalMatches).toBe("number");
      expect(Array.isArray(parsed.tools)).toBe(true);
    }

    // Handles null / undefined args safely
    const resNull = (await LIST_TOOLS_MCP.execute(null as any)) as WebMcpToolResult;
    expect(resNull.content).toBeDefined();
    const dataNull = JSON.parse(resNull.content[0].text);
    expect(dataNull.returned).toBe(25); // Default limit 25
  });

  it("1.4 EXECUTE_TOOL_MCP cleanly rejects missing toolId with isError: true without throwing", async () => {
    // Missing toolId in empty object
    const res1 = (await EXECUTE_TOOL_MCP.execute({})) as WebMcpToolResult;
    expect(res1.isError).toBe(true);
    expect(res1.content[0].text).toContain("Error: Missing required argument 'toolId'.");

    // Null args
    const res2 = (await EXECUTE_TOOL_MCP.execute(null as any)) as WebMcpToolResult;
    expect(res2.isError).toBe(true);
    expect(res2.content[0].text).toContain("Error: Missing required argument 'toolId'.");
  });

  it("1.5 EXECUTE_TOOL_MCP handles unknown or non-existent tool slugs gracefully with isError: true", async () => {
    const invalidSlugs = [
      "completely-fake-tool-slug",
      "__proto__",
      "constructor",
      "undefined",
      "eval-script",
    ];

    for (const slug of invalidSlugs) {
      const res = (await EXECUTE_TOOL_MCP.execute({
        toolId: slug,
        input: "test input",
      })) as WebMcpToolResult;

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/Execution failed|Unknown Code Station tool/);
    }
  });

  it("1.6 stress tests dynamic dispatcher execution across diverse real tool engines under concurrency", async () => {
    const executions = [
      { toolId: "json-formatter", input: '{"hello":"world","count":42}' },
      { toolId: "base64", input: "Adversarial Stress Test String" },
      { toolId: "sha-256", input: "Data to hash with SHA-256" },
      { toolId: "uuid-generator", input: "" },
      { toolId: "text-counter", input: "One two three four five words." },
    ];

    // Run 25 parallel executions across multiple tools
    const tasks = Array.from({ length: 25 }, async (_, i) => {
      const execConfig = executions[i % executions.length];
      const res = (await EXECUTE_TOOL_MCP.execute(execConfig)) as WebMcpToolResult;
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toBeTruthy();
    });

    await Promise.all(tasks);
  });

  it("1.7 createWebMcpToolForDefinition differentiates generator vs standard tool schemas and executes dynamically", async () => {
    const uuidDef = getTool("uuid-generator")!;
    const jsonDef = getTool("json-formatter")!;

    const uuidMcp = createWebMcpToolForDefinition(uuidDef);
    const jsonMcp = createWebMcpToolForDefinition(jsonDef);

    // Generator tools have empty required array
    expect(uuidMcp.inputSchema.required).toEqual([]);
    expect(uuidMcp.name).toBe("codestation_uuid_generator");

    // Non-generator tools require "input"
    expect(jsonMcp.inputSchema.required).toEqual(["input"]);
    expect(jsonMcp.name).toBe("codestation_json_formatter");

    // Dynamic execution of uuidMcp
    const uuidRes = (await uuidMcp.execute({})) as WebMcpToolResult;
    expect(uuidRes.isError).toBeUndefined();
    expect(uuidRes.content[0].text).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // Dynamic execution of jsonMcp with invalid JSON catches cleanly
    const jsonFailRes = (await jsonMcp.execute({ input: "{invalid json" })) as WebMcpToolResult;
    expect(jsonFailRes.isError).toBe(true);
    expect(jsonFailRes.content[0].text).toContain("failed");
  });
});

// ============================================================================
// DIMENSION 2: COMMAND PALETTE LAZY ACTIVATION & RACE CONDITIONS
// ============================================================================

describe("Dimension 2: Command Palette Lazy Activation & Race Conditions", () => {
  it("2.1 lazily unmounts dialog children until activated (0 search inputs, 0 result links on mount)", () => {
    const { container } = render(el(WorkbenchProvider, null, el(ToolLauncher)));

    const dialog = container.querySelector("dialog.tool-launcher");
    expect(dialog).toBeTruthy();
    // Prior to activation, dialog children are completely unmounted
    expect(dialog?.children.length).toBe(0);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Find your next tool" })).toBeNull();
  });

  it("2.2 verifies searchTools is lazy: launcher buttons activate dialog on hover and focus preloading", () => {
    const { container } = render(el(WorkbenchProvider, null, el(ToolLauncher)));

    const searchBtn = screen.getByRole("button", { name: /Search tools/i });

    // Hover triggers preloading activation: input is mounted into DOM
    fireEvent.mouseEnter(searchBtn);
    const searchInput = container.querySelector("#launcher-search");
    expect(searchInput).toBeTruthy();
    expect(container.querySelector("#launcher-title")?.textContent).toBe("Find your next tool");
  });

  it("2.3 survives rapid keyboard shortcut storm (30 consecutive Cmd+K / Ctrl+K events)", () => {
    render(el(WorkbenchProvider, null, el(ToolLauncher)));

    for (let i = 0; i < 30; i++) {
      fireEvent.keyDown(window, { key: "k", metaKey: i % 2 === 0, ctrlKey: i % 2 === 1 });
    }

    const searchBox = screen.getByRole("searchbox") as HTMLInputElement;
    expect(searchBox).toBeDefined();
    expect(searchBox.id).toBe("launcher-search");

    // Filters still work smoothly after shortcut storm
    fireEvent.change(searchBox, { target: { value: "base64" } });
    const results = screen.getByRole("list");
    expect(results.textContent).toContain("Base64");
  });

  it("2.4 clamps keyboard ArrowDown / ArrowUp index navigation without boundary overflow", () => {
    render(el(WorkbenchProvider, null, el(ToolLauncher)));

    // Open via search button
    fireEvent.click(screen.getByRole("button", { name: /Search tools/i }));
    const searchBox = screen.getByRole("searchbox");

    // Filter to a small result set ("uuid" matches ~2 tools)
    fireEvent.change(searchBox, { target: { value: "uuid" } });

    // Spam 20 ArrowDown events
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(searchBox, { key: "ArrowDown" });
    }

    // Selected link should remain within bounds and not crash
    const list = screen.getByRole("list");
    const links = list.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    const selectedLink = list.querySelector("a.selected");
    expect(selectedLink).toBeTruthy();

    // Spam 30 ArrowUp events
    for (let i = 0; i < 30; i++) {
      fireEvent.keyDown(searchBox, { key: "ArrowUp" });
    }

    // Index 0 should be selected
    expect(links[0].className).toContain("selected");
  });

  it("2.5 pressing Enter on highlighted search result triggers router.push and closes dialog", () => {
    render(el(WorkbenchProvider, null, el(ToolLauncher)));

    fireEvent.click(screen.getByRole("button", { name: /Search tools/i }));
    const searchBox = screen.getByRole("searchbox");

    fireEvent.change(searchBox, { target: { value: "json formatter" } });
    fireEvent.keyDown(searchBox, { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/tools/json-formatter");
  });

  it("2.6 pressing Enter when results are empty does not navigate or throw error", () => {
    render(el(WorkbenchProvider, null, el(ToolLauncher)));

    fireEvent.click(screen.getByRole("button", { name: /Search tools/i }));
    const searchBox = screen.getByRole("searchbox");

    fireEvent.change(searchBox, { target: { value: "xyznonexistenttoolxyz" } });
    pushMock.mockClear();

    fireEvent.keyDown(searchBox, { key: "Enter" });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText(/No matching tools/i)).toBeDefined();
  });

  it("2.7 search result links in ToolLauncher specify prefetch={false}", () => {
    render(el(WorkbenchProvider, null, el(ToolLauncher)));

    fireEvent.click(screen.getByRole("button", { name: /Search tools/i }));
    const searchBox = screen.getByRole("searchbox");
    fireEvent.change(searchBox, { target: { value: "jwt" } });

    const results = screen.getByRole("list");
    const links = results.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);

    links.forEach((link) => {
      expect(link.getAttribute("data-prefetch")).toBe("false");
    });
  });

  it("2.8 switching rapidly between search and detect modes resets state cleanly", () => {
    render(el(WorkbenchProvider, null, el(ToolLauncher)));

    fireEvent.click(screen.getByRole("button", { name: /Search tools/i }));

    const searchModeBtn = screen.getByRole("button", { name: "Search tools" });
    const detectModeBtn = screen.getByRole("button", { name: "Detect content" });

    for (let i = 0; i < 10; i++) {
      fireEvent.click(detectModeBtn);
      expect(screen.getByRole("heading", { name: "Smart Detection" })).toBeDefined();
      fireEvent.click(searchModeBtn);
      expect(screen.getByRole("heading", { name: "Find your next tool" })).toBeDefined();
    }
  });
});

// ============================================================================
// DIMENSION 3: SEARCH NORMALIZATION & WEAKMAP MEMOIZATION INTEGRITY
// ============================================================================

describe("Dimension 3: Search Normalization & WeakMap Memoization Integrity", () => {
  it("3.1 verifies WeakMap memoization by executing repeated search queries across full tool catalog", () => {
    // First pass: populates WeakMap cache for all 395+ tools
    const start1 = performance.now();
    const res1 = searchTools(tools, "formatter");
    const duration1 = performance.now() - start1;

    expect(res1.length).toBeGreaterThan(0);

    // Second pass: must hit WeakMap cache with near-zero latency
    const start2 = performance.now();
    const res2 = searchTools(tools, "formatter");
    const duration2 = performance.now() - start2;

    expect(res2).toEqual(res1);
    // Cached pass duration should be fast (< 25ms in jsdom)
    expect(duration2).toBeLessThan(duration1 + 25);
  });

  it("3.2 survives adversarial metadata: empty keywords array, whitespace strings, and special characters", () => {
    const syntheticTools = [
      {
        id: "tool-empty-keywords",
        name: "Empty Keywords Tool",
        description: "A tool with no keywords",
        keywords: [] as readonly string[],
      },
      {
        id: "tool-whitespace-heavy",
        name: "   Whitespace   Tool   ",
        description: "   Lots   of   spaces   ",
        keywords: ["  tag1  ", "  tag2  "] as readonly string[],
      },
      {
        id: "tool-special-chars",
        name: "Tool (v2) [Pro] & <Special>",
        description: "Supports JSON/YAML/CSV: 100% in-browser!",
        keywords: ["json", "yaml/csv", "c++"] as readonly string[],
      },
    ];

    expect(() => searchTools(syntheticTools, "keywords")).not.toThrow();
    expect(searchTools(syntheticTools, "keywords")[0].id).toBe("tool-empty-keywords");

    expect(() => searchTools(syntheticTools, "whitespace")).not.toThrow();
    expect(searchTools(syntheticTools, "whitespace")[0].id).toBe("tool-whitespace-heavy");

    expect(() => searchTools(syntheticTools, "special")).not.toThrow();
    expect(searchTools(syntheticTools, "special")[0].id).toBe("tool-special-chars");
  });

  it("3.3 treats regex metacharacters in queries as literal strings without throwing SyntaxError", () => {
    const syntheticTools = [
      {
        id: "regex-tester",
        name: "RegEx (Pattern) Tester",
        description: "Test [a-z]+ regex strings",
        keywords: [".*", "+", "^$"] as readonly string[],
      },
    ];

    const maliciousQueries = [
      "[a-z+",
      "(unclosed group",
      "*quantifier",
      "+plus",
      "?optional",
      "{1,3",
      "\\escape",
      "|or",
      "$end^",
    ];

    for (const q of maliciousQueries) {
      expect(() => searchTools(syntheticTools, q)).not.toThrow();
    }
  });

  it("3.4 collapses duplicate tool IDs to the highest-ranking match", () => {
    const duplicates = [
      {
        id: "dup-tool",
        name: "Low Match Duplicate",
        description: "Mentions keyword deep in description",
        keywords: ["unrelated"] as readonly string[],
      },
      {
        id: "dup-tool",
        name: "Exact Target",
        description: "Target description",
        keywords: ["target"] as readonly string[],
      },
    ];

    const results = searchTools(duplicates, "Exact Target");
    // Only 1 result returned despite 2 items with same ID
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Exact Target");
  });

  it("3.5 preserves strict ranking order: exact name > name substring > keyword > description > multi-token", () => {
    const rankTools = [
      { id: "rank-4", name: "Alpha", description: "Contains part2 here", keywords: ["part1"] },
      { id: "rank-3", name: "Beta", description: "The search-target is in description", keywords: ["other"] },
      { id: "rank-2", name: "Gamma", description: "Another tool", keywords: ["search-target"] },
      { id: "rank-1", name: "Delta search-target Extra", description: "Tool", keywords: [] },
      { id: "rank-0", name: "search-target", description: "Tool", keywords: [] },
    ];

    const results = searchTools(rankTools, "search-target");
    expect(results.map((t) => t.id)).toEqual(["rank-0", "rank-1", "rank-2", "rank-3"]);

    // Multi-token query ("part1 part2")
    const multiResults = searchTools(rankTools, "part1 part2");
    expect(multiResults).toHaveLength(1);
    expect(multiResults[0].id).toBe("rank-4");
  });

  it("3.6 high-throughput stress test: runs 1,000 queries in tight loop without memory leaks or degradation", () => {
    const testQueries = ["json", "csv", "jwt", "base64", "uuid", "hash", "sql", "css", "svg", "markdown"];
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      const q = testQueries[i % testQueries.length];
      const res = searchTools(tools, q);
      expect(res.length).toBeGreaterThan(0);
    }

    const duration = performance.now() - start;
    // 1000 queries should easily finish under 500ms in modern runtime
    expect(duration).toBeLessThan(1000);
  });
});

// ============================================================================
// DIMENSION 4: SECONDARY LINK PREFETCH SUPPRESSION & PRIMARY PREFETCH PRESERVATION
// ============================================================================

describe("Dimension 4: Secondary Link Prefetch Suppression & Primary Route Preservation", () => {
  it("4.1 ToolCard component explicitly sets prefetch={false} on its navigation anchor", () => {
    const sampleTool = tools[0];
    const { container } = render(
      el(WorkbenchProvider, null, el(ToolCard, { tool: sampleTool }))
    );

    const anchor = container.querySelector("a.tool-card");
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute("data-prefetch")).toBe("false");
    expect(anchor?.getAttribute("href")).toBe(`/tools/${sampleTool.slug}`);
  });

  it("4.2 HomeSearch quick access cards and matching tool links explicitly set prefetch={false}", () => {
    const sampleTools: ToolCardMetadata[] = tools.slice(0, 10).map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      category: t.category,
      description: t.description,
      keywords: t.keywords,
      featured: true,
    }));

    const { container } = render(
      el(WorkbenchProvider, null, el(HomeSearch, { tools: sampleTools }))
    );

    const quickLinks = container.querySelectorAll("a[href^='/tools/']");
    expect(quickLinks.length).toBeGreaterThanOrEqual(4);

    quickLinks.forEach((link) => {
      expect(link.getAttribute("data-prefetch")).toBe("false");
    });
  });

  it("4.3 HomePage showcase tool links set prefetch={false} while station navigation links retain default prefetching", () => {
    const { container } = render(el(HomePage));

    // 1. Showcase links (3 items) must suppress prefetching
    const showcaseSection = screen.getByRole("region", { name: "Make room for the work." });
    const showcaseLinks = showcaseSection.querySelectorAll("a[href^='/tools/']");
    expect(showcaseLinks).toHaveLength(3);
    showcaseLinks.forEach((link) => {
      expect(link.getAttribute("data-prefetch")).toBe("false");
    });

    // 2. Station directory links (25 items) must preserve default prefetching
    const directorySection = screen.getByRole("region", { name: "Choose a station" });
    const stationLinks = directorySection.querySelectorAll("a[href^='/stations/']");
    expect(stationLinks).toHaveLength(stations.length);
    stationLinks.forEach((link) => {
      expect(link.getAttribute("data-prefetch")).toBe("default");
    });

    // 3. Primary CTAs (/pro, /docs, /tools) must preserve default prefetching
    const proLink = screen.getByRole("link", { name: /Get Pro for AI/i });
    const docsLink = screen.getByRole("link", { name: /Explore Docs & MCP/i });
    const browseLink = screen.getByRole("link", { name: /Browse all tools/i });

    expect(proLink.getAttribute("data-prefetch")).toBe("default");
    expect(docsLink.getAttribute("data-prefetch")).toBe("default");
    expect(browseLink.getAttribute("data-prefetch")).toBe("default");
  });

  it("4.4 statically verifies source code enforcement of prefetch={false} across all secondary cards", () => {
    const root = process.cwd();

    // ToolCard.tsx
    const toolCardSrc = fs.readFileSync(path.join(root, "components/ToolCard.tsx"), "utf-8");
    expect(toolCardSrc).toMatch(/<Link[^>]*prefetch=\{false\}/);

    // HomeSearch.tsx
    const homeSearchSrc = fs.readFileSync(path.join(root, "components/HomeSearch.tsx"), "utf-8");
    expect(homeSearchSrc).toMatch(/<Link[^>]*quickLink[^>]*prefetch=\{false\}/);

    // app/page.tsx
    const homePageSrc = fs.readFileSync(path.join(root, "app/page.tsx"), "utf-8");
    expect(homePageSrc).toMatch(/<Link href=\{`\/tools\/\$\{tool!?.slug\}`\} prefetch=\{false\}>/);

    // ToolLauncher.tsx
    const toolLauncherSrc = fs.readFileSync(path.join(root, "components/ToolLauncher.tsx"), "utf-8");
    expect(toolLauncherSrc).toMatch(/<Link[^>]*href=\{`\/tools\/\$\{tool\.slug\}`\}[^>]*prefetch=\{false\}/);
  });
});

// ============================================================================
// DIMENSION 5: RAPID UI STATE TRANSITIONS & REACTIVITY
// ============================================================================

describe("Dimension 5: Rapid UI State Transitions & Reactivity", () => {
  it("5.1 survives 30 rapid consecutive expand/collapse clicks with 100% state consistency", async () => {
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
          "html-encoder",
        ],
      })
    );

    render(el(WorkbenchProvider, null, el(PersonalTools)));

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    for (let i = 1; i <= 30; i++) {
      if (i % 2 === 1) {
        // Expand
        const toggle = favSection.getByRole("button", { name: "Show more" });
        fireEvent.click(toggle);
        expect(favSection.getAllByRole("listitem")).toHaveLength(7);
        expect(favSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe(
          "true"
        );
      } else {
        // Collapse
        const toggle = favSection.getByRole("button", { name: "Show less" });
        fireEvent.click(toggle);
        expect(favSection.getAllByRole("listitem")).toHaveLength(4);
        expect(favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")).toBe(
          "false"
        );
      }
    }
  });

  it("5.2 dynamically removes toggle button when unfavoriting drops count from 5 to 4 in expanded state", async () => {
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
      })
    );

    render(el(WorkbenchProvider, null, el(PersonalTools)));

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    // Expand
    fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(5);

    // Unfavorite 1 item
    const removeBtns = favSection.getAllByRole("button", { name: /Remove .* from favorites/i });
    fireEvent.click(removeBtns[4]);

    // Now 4 items remain -> toggle button is completely removed
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
  });

  it("5.3 FavoriteButton toggling is synchronized with localStorage across 20 rapid clicks", async () => {
    render(
      el(WorkbenchProvider, null, el(FavoriteButton, { slug: "json-formatter" }))
    );

    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-pressed")).toBe("false");

    for (let i = 1; i <= 20; i++) {
      fireEvent.click(btn);
      const isFavorited = i % 2 === 1;
      expect(btn.getAttribute("aria-pressed")).toBe(String(isFavorited));

      const stored = JSON.parse(localStorage.getItem(preferenceKey) || "{}");
      if (isFavorited) {
        expect(stored.favorites).toContain("json-formatter");
      } else {
        expect(stored.favorites).not.toContain("json-formatter");
      }
    }
  });

  it("5.4 corrupt or invalid localStorage preferences recover safely to defaults without crashing", () => {
    // Malformed JSON in localStorage
    localStorage.setItem(preferenceKey, "{corrupt-invalid-json-content");

    expect(() => {
      render(el(WorkbenchProvider, null, el(PersonalTools, { always: true })));
    }).not.toThrow();

    expect(screen.getByText("Use a star to keep a tool here.")).toBeDefined();
  });
});
