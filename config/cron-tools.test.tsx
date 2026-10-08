// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { cronTools, cronToolIds } from "./cron-tools";
import { tools, getTool } from "./tools";
import { getStation, stations } from "./stations";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import CronPage, { metadata } from "@/app/stations/cron/page";
import HomePage from "@/app/page";
import sitemap from "@/app/sitemap";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const fields = {
  "cron-generator": ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"],
  "cron-explainer": ["expression"], "cron-validator": ["expression"],
  "cron-next-run": ["expression", "reference", "timezone"], "human-to-cron": ["description"], "cron-to-human": ["expression"],
};
describe("Cron registry, public routes and metadata", () => {
  it("adds precisely six unique tools without introducing excluded stations", () => {
    expect(cronTools).toHaveLength(6); expect(cronToolIds).toEqual(Object.keys(fields)); expect(tools.filter(tool => tool.category === "Cron")).toEqual(cronTools);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length); expect(new Set(cronTools.map(tool => tool.description)).size).toBe(6); expect(new Set(cronTools.map(tool => tool.seo.title)).size).toBe(6);
      expect(stations.map(station => station.name)).toEqual(["JSON & Data", "Encoding", "Security", "Regex", "Date & Time", "Text", "Cron", "SQL & Database", "Web", "API", "Image", "Spreadsheet", "Markdown", "Color & CSS", "Converters"]);
  });
  it.each(cronTools)("$id exact fields, canonical, H1, factual sections and related links", async tool => {
    expect(tool.cronContract.fields.map(field => field.name)).toEqual(fields[tool.id]); expect(generateStaticParams()).toContainEqual({ slug: tool.slug });
     const params = Promise.resolve({ slug: tool.slug }); expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    render(await ToolPage({ params })); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name); expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy(); expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse the Cron station →" }).getAttribute("href")).toBe("/stations/cron");
    for (const link of within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link")) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))?.category).toBe("Cron");
  });
  it("station registry owns its route, icon, derived count and live related stations", () => {
    const station = getStation("cron")!; expect(station).toMatchObject({ id: "cron", name: "Cron", route: "/stations/cron", icon: "station-mark", toolCount: 6 }); expect(station.description).toBeTruthy();
    expect(station.relatedStations.map(id => getStation(id)?.name)).toEqual(["Date & Time", "Text", "Regex"]);
     for (const existing of stations) expect(existing.route).toBe(`/stations/${existing.id}`);
     expect(metadata.alternates?.canonical).toBe(station.route); if (process.env.NEXT_PUBLIC_SITE_URL) expect(sitemap().some(entry => entry.url.endsWith(station.route))).toBe(true);
  });
  it("station landing provides all tool cards, keyboard search and related existing routes", async () => {
    const user = userEvent.setup(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<CronPage />); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Cron Station");
    expect(screen.getByRole("status").textContent).toBe("6 of 6 tools");
    for (const tool of cronTools) expect(screen.getByRole("link", { name: new RegExp(tool.name) }).getAttribute("href")).toBe(`/tools/${tool.slug}`);
    const input = screen.getByRole("textbox", { name: "Search Cron tools" }); input.focus(); await user.keyboard("Validator"); expect(screen.getByRole("status").textContent).toBe("1 of 6 tools");
    await user.clear(input); await user.type(input, "no-match-PRIVATE"); expect(screen.getByText("No Cron tools match that search.")).toBeTruthy(); expect(fetch).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });
  it("homepage links Cron to its landing and leaves all other category routes intact", () => {
    render(<HomePage />); const section = screen.getByRole("heading", { name: "Choose a station" }).closest("section")!;
     for (const station of stations) expect(within(section).getByRole("link", { name: new RegExp(station.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).getAttribute("href")).toBe(station.route);
  });
  it("Cron CSS retains tokens, monospace, focus/touch and mobile stacking safeguards", () => {
    const css = readFileSync("components/CronStation.module.css", "utf8"); for (const token of ["var(--surface)", "var(--ink)", "var(--focus)", ":focus-visible", "44px", "@media", "minmax(0, 1fr)", "overflow: auto", "monospace"]) expect(css).toContain(token);
  });
});
