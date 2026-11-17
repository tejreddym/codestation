// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { apiTools, apiToolIds } from "./api-tools";
import { getTool, tools } from "./tools";
import { getStation } from "./stations";
import { extendedTools } from "./extended-tools";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import ApiPage from "@/app/stations/api/page";
import sitemap from "@/app/sitemap";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const fields = {
  "curl-to-fetch": ["command"], "fetch-to-curl": ["code"], "curl-to-axios": ["command"], "curl-to-python-requests": ["command"],
  "http-header-builder": ["entries"], "http-header-parser": ["raw"],
  "rest-api-request-builder": ["method", "url", "parameters", "headers", "bodyType", "body"],
  "json-request-body-builder": ["fields"], "api-response-formatter": ["body", "format"],
  "graphql-formatter": ["query"], "graphql-query-builder": ["operationType", "operationName", "rootField", "arguments", "selectedFields"],
  "graphql-variables-formatter": ["json"], "http-request-builder": ["method", "path", "httpVersion", "headers", "body"],
  "basic-auth-header-generator": ["username", "password"], "bearer-token-header-generator": ["token"],
  "api-request-tester": ["method", "url", "parameters", "headers", "bodyType", "body"],
};
describe("API exact contracts and discovery", () => {
  it("contributes exactly 16 unique contracts and one explicit network boundary", () => {
    expect(apiToolIds).toEqual(Object.keys(fields)); expect(apiTools).toHaveLength(16);
    const extendedApi = extendedTools.filter(tool => tool.category === "API");
    expect(extendedApi.map(tool => tool.id)).toEqual(["curl-to-any-language"]);
    expect(tools.filter(tool => tool.category === "API").map(tool => tool.id)).toEqual([...apiTools.map(tool => tool.id), "curl-to-any-language"]);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length);
    expect(apiTools.filter(tool => tool.apiContract.sendsRequest).map(tool => tool.id)).toEqual(["api-request-tester"]);
  });
  it.each(apiTools)("$id exact inputs, indexed unique metadata and factual route", async tool => {
    expect(tool.apiContract.fields.map(field => field.name)).toEqual(fields[tool.id]);
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug });
    const params = Promise.resolve({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, description: tool.description, alternates: { canonical: tool.route }, robots: { index: false, follow: false } });
    render(await ToolPage({ params })); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy(); expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse the API station →" }).getAttribute("href")).toBe("/stations/api");
    for (const id of tool.relatedTools) expect(getTool(id)?.category).toBe("API");
    if (tool.pairedTool) expect(getTool(tool.pairedTool)?.pairedTool).toBe(tool.id);
    if (process.env.NEXT_PUBLIC_SITE_URL) expect(sitemap().some(entry => entry.url.endsWith(tool.route))).toBe(true);
  });
  it("uses existing landing cards with keyboard local search", async () => {
    const user = userEvent.setup(); render(<ApiPage />);
    expect(getStation("api")).toMatchObject({ name: "API", route: "/stations/api", toolCount: 17 });
    expect(screen.getByRole("status").textContent).toBe("17 of 17 tools");
    for (const tool of apiTools) expect(screen.getByRole("link", { name: new RegExp(tool.name) }).getAttribute("href")).toBe(tool.route);
    expect(screen.getByRole("link", { name: /cURL to Any Language Generator/ }).getAttribute("href")).toBe("/tools/curl-to-any-language");
    const input = screen.getByRole("textbox", { name: "Search API tools" }); input.focus(); await user.keyboard("GraphQL");
    expect(screen.getByRole("status").textContent).toBe("3 of 17 tools");
    await user.clear(input); await user.type(input, "unmatched"); expect(screen.getByText("No API tools match that search.")).toBeTruthy();
  });
  it("keeps layout-only station CSS, shared theme/focus/mobile styles and no new sink in local code", () => {
    const layout = ["components/ApiStation.module.css", "components/ApiStructuredFields.module.css"].map(file => readFileSync(file, "utf8")).join("\n");
    for (const token of ["var(--space-4)", "var(--space-6)", "min-width: 0", "display: grid", "@media"]) expect(layout).toContain(token);
    const shared = ["components/ui/ui.module.css", "app/styles/tokens.css"].map(file => readFileSync(file, "utf8")).join("\n");
    for (const token of ["var(--surface)", "var(--ink)", "44px", ":focus-visible", "@media", "minmax(0, 1fr)", "overflow-wrap: anywhere"]) expect(shared).toContain(token);
    for (const file of ["lib/tools/api/curl.ts", "lib/tools/api/graphql.ts", "lib/tools/api/local.ts", "components/ApiStation.tsx"]) {
      const source = readFileSync(file, "utf8"); expect(source).not.toMatch(/\beval\s*\(|\bnew Function\s*\(|console\.log|localStorage|sessionStorage|dangerouslySetInnerHTML/);
    }
  });
});
