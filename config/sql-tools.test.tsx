// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { sqlTools, sqlToolIds } from "./sql-tools";
import { tools, getTool } from "./tools";
import { stations, getStation } from "./stations";
import { SQL_DIALECTS } from "@/lib/tools/sql/types";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import StationPage, { metadata } from "@/app/stations/sql-database/page";
import HomePage from "@/app/page";
import sitemap from "@/app/sitemap";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const fields = {
  "sql-formatter": ["sql", "dialect"], "sql-minifier": ["sql", "dialect"], "sql-validator": ["sql", "dialect"],
  "json-to-sql": ["json", "table", "dialect"], "sql-to-json": ["sql", "dialect"], "csv-to-sql": ["csv", "table", "dialect"], "sql-to-csv": ["sql", "dialect"], "sql-to-markdown": ["sql", "dialect"],
  "sql-insert-generator": ["table", "columns", "rows", "dialect"], "sql-update-generator": ["table", "assignments", "conditions", "dialect"], "sql-delete-generator": ["table", "conditions", "dialect"],
  "sql-select-builder": ["table", "columns", "conditions", "orderBy", "limit", "dialect"], "sql-where-builder": ["conditions", "logicalOperator", "dialect"],
  "database-connection-string-builder": ["databaseType", "host", "port", "database", "username", "password", "parameters"], "database-connection-string-parser": ["connectionString"],
  "er-diagram-generator": ["sql", "dialect"], "sql-escape-helper": ["value", "valueType", "dialect"],
};
describe("SQL contracts, registry and public discovery", () => {
  it("registers exactly 17 unique non-directional contracts and no excluded stations", () => {
    expect(sqlToolIds).toEqual(Object.keys(fields)); expect(sqlTools).toHaveLength(17); expect(tools.filter(tool => tool.category === "SQL & Database")).toEqual(sqlTools);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length); expect(new Set(sqlTools.map(tool => tool.description)).size).toBe(17); expect(new Set(sqlTools.map(tool => tool.seo.title)).size).toBe(17);
    for (const tool of sqlTools) expect(tool).not.toHaveProperty("pairedTool");
     expect(stations.map(station => station.name)).toEqual(["JSON & Data", "Encoding", "Security", "Regex", "Date & Time", "Text", "Cron", "SQL & Database", "Web", "API", "Image", "Spreadsheet", "Markdown", "Color & CSS", "Converters"]);
  });
  it.each(sqlTools)("$id exact fields, dialect options, direct route and factual metadata", async tool => {
    expect(tool.sqlContract.fields.map(field => field.name)).toEqual(fields[tool.id]);
    expect(tool.route).toBe(`/tools/${tool.slug}`); expect(tool.inputType).toBeTruthy(); expect(tool.outputType).toBeTruthy();
    const dialect = tool.sqlContract.fields.find(field => field.name === "dialect"); if (dialect) { expect(dialect.options).toEqual(SQL_DIALECTS); expect(tool.dialects).toEqual(SQL_DIALECTS); }
     const params = Promise.resolve({ slug: tool.slug }); expect(generateStaticParams()).toContainEqual({ slug: tool.slug }); expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    render(await ToolPage({ params })); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name); expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy(); expect(screen.getByRole("heading", { name: "How to use it" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse the SQL & Database station →" }).getAttribute("href")).toBe("/stations/sql-database");
    for (const link of within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link")) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))?.category).toBe("SQL & Database");
  });
  it("keeps connection fields solely on their two tools and download solely on CSV", () => {
    for (const tool of sqlTools) {
      if (!tool.id.startsWith("database-connection")) expect(tool.sqlContract.fields.some(field => ["host", "password", "username", "connectionString"].includes(field.name))).toBe(false);
      expect(tool.sqlContract.downloadExtension).toBe(tool.id === "sql-to-csv" ? "csv" : undefined);
    }
    expect(sqlTools.find(tool => tool.id === "database-connection-string-parser")?.sqlContract.copy).toBe(false); expect(sqlTools.find(tool => tool.id === "sql-validator")?.sqlContract.copy).toBe(false);
    expect(sqlTools.find(tool => tool.id === "database-connection-string-builder")?.sqlContract.fields.find(field => field.name === "password")?.control).toBe("password");
  });
  it("station registry owns the exact description, tool list/count, icon, route and related existing stations", () => {
    const station = getStation("sql-database")!; expect(station).toMatchObject({ id: "sql-database", name: "SQL & Database", icon: "station-mark", route: "/stations/sql-database", toolCount: 17, description: "Format, validate, generate, inspect, and convert SQL and database structures locally without connecting to your database." });
     expect(station.toolList).toEqual(sqlToolIds); expect(station.relatedStations.every(id => getStation(id))).toBe(true); expect(metadata.alternates?.canonical).toBe(station.route); if (process.env.NEXT_PUBLIC_SITE_URL) expect(sitemap().some(entry => entry.url.endsWith(station.route))).toBe(true);
  });
  it("landing search is local, searchable by keyboard, with cards and no-result feedback", async () => {
    const user = userEvent.setup(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const storage = vi.spyOn(Storage.prototype, "setItem"); render(<StationPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("SQL & Database Station"); expect(screen.getByRole("status").textContent).toBe("17 of 17 tools");
    const input = screen.getByRole("textbox", { name: "Search SQL & Database tools" }); input.focus(); await user.keyboard("Formatter"); expect(screen.getByRole("status").textContent).toBe("1 of 17 tools");
    await user.clear(input); await user.type(input, "no-match-private-fixture"); expect(screen.getByText("No SQL & Database tools match that search.")).toBeTruthy(); expect(fetch).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
  });
  it("homepage reaches the new landing and keeps other station links unchanged", () => {
    render(<HomePage />); const section = screen.getByRole("heading", { name: "Choose a station" }).closest("section")!;
     for (const station of stations) expect(within(section).getByRole("link", { name: new RegExp(station.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).getAttribute("href")).toBe(station.route);
  });
  it("SQL workspace/editor/diagram CSS uses theme tokens, mobile bounds and keyboard focus", () => {
    const css = ["SqlDatabaseStation", "SqlStructuredFields", "SqlErDiagram"].map(name => readFileSync(`components/${name}.module.css`, "utf8")).join("\n");
    for (const token of ["var(--surface)", "var(--ink)", "var(--focus)", ":focus-visible", "44px", "@media", "minmax(0, 1fr)", "overflow", "monospace"]) expect(css).toContain(token);
  });
});
