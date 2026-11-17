// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import { tools, getTool } from "./tools";
import { extendedTools } from "./extended-tools";
import { jsonDataTools, getJsonDataDefinition } from "./json-data-tools";
import nextConfig from "../next.config";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const publicSlugs = `json-formatter json-validator json-minifier json-to-yaml yaml-to-json json-to-csv csv-to-json json-diff json-tree-viewer json-schema-validator json-schema-generator jsonpath-tester json-escape json-unescape json-key-sorter json-array-to-object json-object-to-array json-lines-formatter json-lines-validator json-lines-to-json json-to-json-lines json-structure-inspector json-statistics-analyzer csv-formatter csv-validator csv-column-analyzer csv-delimiter-detector csv-to-tsv tsv-to-csv csv-to-markdown csv-to-html-table csv-cleaner csv-column-reorderer csv-row-filter csv-data-deduplicator csv-transposer json-to-xml xml-to-json json-to-toml toml-to-json yaml-diff yaml-formatter yaml-validator xml-formatter xml-validator xml-minifier`.split(" ");
describe("JSON & Data registry/routes", () => {
  it("has exactly the specified 46 station URLs plus one extended tool in the central registry", () => {
    expect(jsonDataTools.map(tool => tool.slug).sort()).toEqual(publicSlugs.sort());
    const extendedJson = extendedTools.filter(tool => tool.category === "JSON & Data");
    expect(extendedJson.map(tool => tool.id)).toEqual(["mock-data"]);
    expect(tools.filter(tool => tool.category === "JSON & Data").map(tool => tool.id)).toEqual([...jsonDataTools.map(tool => tool.id), "mock-data"]);
    expect(new Set(tools.map(tool => tool.slug)).size).toBe(tools.length);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length);
    expect(new Set(jsonDataTools.map(tool => tool.description)).size).toBe(46);
  });
  it.each(jsonDataTools)("$slug has correct canonical metadata, H1, content, related and breadcrumb links", async (tool) => {
    const params = Promise.resolve({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({ title: tool.name, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug });
    render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How to use it" })).toBeTruthy();
    const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumb" })).getAllByRole("link");
    expect(crumbs.at(-1)?.getAttribute("href")).toBe(`/tools/${tool.slug}`);
    const related = within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link");
    for (const link of related) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))).toBeTruthy();
    if (tool.pairedTool) {
      const paired = getJsonDataDefinition(tool.pairedTool)!;
      expect(paired.pairedTool).toBe(tool.id);
      expect(paired.slug).not.toBe(tool.slug);
      expect(paired.description).not.toBe(tool.description);
      expect(paired.dataContract.fields[0].label).not.toBe(tool.dataContract.fields[0].label);
      expect(related.some(link => link.getAttribute("href") === `/tools/${paired.slug}`)).toBe(true);
    }
  });
  it.each(jsonDataTools.filter(tool => tool.slug !== tool.id))("redirects old $id links to the canonical route", async (tool) => {
    expect(await nextConfig.redirects!()).toContainEqual({ source: `/tools/${tool.id}`, destination: `/tools/${tool.slug}`, permanent: true });
  });
  it("keeps theme-aware responsive CSS and focus/touch rules without global theme edits", () => {
    const layout = readFileSync("components/JsonDataStation.module.css", "utf8");
    for (const rule of ["@media", "var(--space-6)", "min-width: 0", "overflow: auto"]) expect(layout).toContain(rule);
    // Visual, theme, focus and touch rules come from the shared UI layer, not from global theme edits.
    const shared = readFileSync("components/ui/ui.module.css", "utf8") + readFileSync("app/styles/tokens.css", "utf8");
    for (const rule of ["var(--surface)", "var(--ink)", "44px", ":focus-visible", "@media", "minmax(0, 1fr)", "overflow-wrap: anywhere"]) expect(shared).toContain(rule);
    // Static contract check only; real responsive/theme visual review is separate.
  });
});
