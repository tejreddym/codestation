// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { financeTools, financeToolIds, getFinanceDefinition, isFinanceToolId } from "./finance-tools";
import { tools, getTool } from "./tools";
import { getStation, stations } from "./stations";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import StationPage, { generateMetadata as generateStationMetadata } from "@/app/stations/[station]/page";
import HomePage from "@/app/page";
import sitemap from "@/app/sitemap";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);

const fields = {
  "emi-calculator": ["principal", "annualRate", "tenure", "tenureUnit", "processingFee"],
  "loan-prepayment-calculator": [
    "principal",
    "annualRate",
    "months",
    "emi",
    "oneTime",
    "extraMonthly",
    "chargePercent",
    "strategy",
  ],
  "gst-calculator": ["amount", "rate", "mode", "supply"],
  "sip-calculator": [
    "monthly",
    "years",
    "annualReturn",
    "stepUpPercent",
    "inflationPercent",
    "compareRates",
  ],
} as const;

describe("Finance & Calculators registry, public routes and metadata", () => {
  it("adds precisely four unique tools in one category", () => {
    expect(financeTools).toHaveLength(4);
    expect(financeToolIds).toEqual(Object.keys(fields));
    expect(tools.filter(tool => tool.category === "Finance & Calculators")).toEqual(financeTools);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length);
    expect(new Set(financeTools.map(tool => tool.description)).size).toBe(4);
    expect(new Set(financeTools.map(tool => tool.seo.title)).size).toBe(4);
    for (const id of financeToolIds) {
      expect(getFinanceDefinition(id)?.id).toBe(id);
      expect(isFinanceToolId(id)).toBe(true);
    }
    expect(isFinanceToolId("business-days-calculator")).toBe(false);
  });

  it.each(financeTools)("$id exact fields, metadata, H1, factual sections and related links", async tool => {
    expect(tool.localContract.fields.map(field => field.name)).toEqual(fields[tool.id]);
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug });
    expect(tool.name.length).toBeGreaterThan(0);
    expect(tool.description.length).toBeGreaterThan(40);
    expect(tool.keywords.length).toBeGreaterThanOrEqual(8);
    expect(tool.localContract.notices.length).toBeGreaterThanOrEqual(2);
    expect(tool.seo.title).toMatch(/India|INR|GST|Code Station/);
    expect(tool.seo.description).not.toMatch(/20\d\d/);

    const params = Promise.resolve({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({
      title: tool.seo.title,
      description: tool.description,
      alternates: { canonical: `/tools/${tool.slug}` },
      robots: { index: false, follow: false },
    });
    render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Browse the Finance & Calculators station →" }).getAttribute("href")
    ).toBe("/stations/finance-calculators");
    const related = within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link");
    expect(related.length).toBeGreaterThan(0);
    for (const link of related) {
      expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))).toBeTruthy();
    }
  });

  it("station registry owns its route, icon, derived count and live related stations", async () => {
    const station = getStation("finance-calculators")!;
    expect(station).toMatchObject({
      id: "finance-calculators",
      name: "Finance & Calculators",
      route: "/stations/finance-calculators",
      icon: "station-mark",
      toolCount: 4,
    });
    expect(station.description).toBeTruthy();
    expect(station.relatedStations.map(id => getStation(id)?.name)).toEqual([
      "Developer Math",
      "Text",
      "Spreadsheet",
    ]);
    for (const existing of stations) expect(existing.route).toBe(`/stations/${existing.id}`);
    const params = Promise.resolve({ station: "finance-calculators" });
    expect((await generateStationMetadata({ params })).alternates?.canonical).toBe(station.route);
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      expect(sitemap().some(entry => entry.url.endsWith(station.route))).toBe(true);
    }
  });

  it("station landing provides all tool cards, keyboard search and related existing routes", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(await StationPage({ params: Promise.resolve({ station: "finance-calculators" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Finance & Calculators Station");
    expect(screen.getByRole("status").textContent).toBe("4 of 4 tools");
    for (const tool of financeTools) {
      const name = new RegExp(tool.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      expect(
        screen.getAllByRole("link", { name }).some(link => link.getAttribute("href") === `/tools/${tool.slug}`)
      ).toBe(true);
    }
    const input = screen.getByRole("textbox", { name: "Search Finance & Calculators tools" });
    input.focus();
    await user.keyboard("SIP");
    expect(screen.getByRole("status").textContent).toBe("1 of 4 tools");
    await user.clear(input);
    await user.type(input, "no-match-PRIVATE");
    expect(screen.getByText("No Finance & Calculators tools match that search.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("homepage links the Finance station to its landing route", () => {
    render(<HomePage />);
    const section = screen.getByRole("heading", { name: "Choose a station" }).closest("section")!;
    expect(
      within(section).getByRole("link", { name: /^Finance & Calculators\b/ }).getAttribute("href")
    ).toBe("/stations/finance-calculators");
  });

  it("Finance station CSS stays layout-only with tokens and mobile stacking", () => {
    const css = readFileSync("components/FinanceStation.module.css", "utf8");
    for (const token of [
      "var(--space-4)",
      "var(--line)",
      "var(--surface-alt)",
      "var(--ink)",
      "minmax(0, 1fr)",
      "@media",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
