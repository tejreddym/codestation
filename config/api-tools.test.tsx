// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { apiTools, apiToolIds } from "./api-tools";
import { getTool, tools } from "./tools";
import { getStation } from "./stations";
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
    expect(tools.filter(tool => tool.category === "API")).toEqual(apiTools);
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
    expect(getStation("api")).toMatchObject({ name: "API", route: "/stations/api", toolCount: 16 });
    expect(screen.getByRole("status").textContent).toBe("16 of 16 tools");
    for (const tool of apiTools) expect(screen.getByRole("link", { name: new RegExp(tool.name) }).getAttribute("href")).toBe(tool.route);
    const input = screen.getByRole("textbox", { name: "Search API tools" }); input.focus(); await user.keyboard("GraphQL");
    expect(screen.getByRole("status").textContent).toBe("3 of 16 tools");
    await user.clear(input); await user.type(input, "unmatched"); expect(screen.getByText("No API tools match that search.")).toBeTruthy();
  });
  it("preserves theme, focus, mobile layout and no new sink in local code", () => {
    for (const file of ["components/ApiStation.module.css", "components/ApiStructuredFields.module.css"]) {
      const css = readFileSync(file, "utf8"); expect(css).toContain("var(--ink)"); expect(css).toContain("focus-visible"); expect(css).toContain("@media");
    }
    for (const file of ["lib/tools/api/curl.ts", "lib/tools/api/graphql.ts", "lib/tools/api/local.ts", "components/ApiStation.tsx"]) {
      const source = readFileSync(file, "utf8"); expect(source).not.toMatch(/\beval\s*\(|\bnew Function\s*\(|console\.log|localStorage|sessionStorage|dangerouslySetInnerHTML/);
    }
  });
});
