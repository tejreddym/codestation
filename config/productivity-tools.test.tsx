// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { getProductivityDefinition, isProductivityToolId, productivityTools } from "./productivity-tools";
import { getTool, tools } from "./tools";
import { getStation, stations } from "./stations";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import StationPage, { generateMetadata as generateStationMetadata } from "@/app/stations/[station]/page";
import StationLanding from "@/components/StationLanding";
import { POMODORO_DEFAULT_SETTINGS } from "@/lib/tools/productivity/pomodoro";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => <p>Productivity workspace</p> }));
afterEach(cleanup);

describe("Productivity station registry, routes and metadata", () => {
  it("adds local Pomodoro and Invoice Generator tools to the implemented station", () => {
    expect(productivityTools).toHaveLength(2);
    expect(productivityTools[0].id).toBe("pomodoro-timer");
    expect(productivityTools[1].id).toBe("invoice-generator");
    expect(getProductivityDefinition("pomodoro-timer")).toBe(productivityTools[0]);
    expect(getProductivityDefinition("invoice-generator")).toBe(productivityTools[1]);
    expect(isProductivityToolId("pomodoro-timer")).toBe(true);
    expect(isProductivityToolId("invoice-generator")).toBe(true);
    expect(isProductivityToolId("text-counter")).toBe(false);
    expect(tools.filter(tool => tool.category === "Productivity")).toEqual(productivityTools);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length);
    expect(POMODORO_DEFAULT_SETTINGS.sessionsBeforeLongBreak).toBe(4);
    expect(POMODORO_DEFAULT_SETTINGS.beep).toBe(false);
  });

  it("publishes direct tool metadata without repeating the layout title suffix", async () => {
    const tool = productivityTools[0];
    expect(tool.seo.title).toBe("Pomodoro Timer — Focus and Break Cycles");
    expect(tool.seo.title).not.toContain("| Code Station");
    expect(tool.localContract.fields.map(field => field.name)).toEqual([
      "focus", "shortBreak", "longBreak", "sessions", "autoStart", "beep",
    ]);
    for (const notice of tool.localContract.notices) expect(notice).not.toMatch(/localStorage|IndexedDB/i);
    expect(tool.localContract.notices.join(" ")).toMatch(/No timer state is saved/);
    expect(generateStaticParams()).toContainEqual({ slug: "pomodoro-timer" });
    expect(generateStaticParams()).toContainEqual({ slug: "invoice-generator" });
    const params = Promise.resolve({ slug: "pomodoro-timer" });
    expect(await generateMetadata({ params })).toMatchObject({
      title: "Pomodoro Timer — Focus and Break Cycles",
      alternates: { canonical: "/tools/pomodoro-timer" },
    });
    render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pomodoro Timer");
    expect(screen.getByText("Productivity workspace")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse the Productivity station →" }).getAttribute("href")).toBe("/stations/productivity");
    const related = within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link");
    expect(related.length).toBeGreaterThan(0);
    for (const link of related) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))).toBeTruthy();
  });

  it("publishes Invoice Generator metadata, route and fields", async () => {
    const tool = productivityTools[1];
    expect(tool.id).toBe("invoice-generator");
    expect(tool.seo.title).toBe("Invoice Generator — Free In-Browser Invoices with PDF & Bulk Export");
    const params = Promise.resolve({ slug: "invoice-generator" });
    expect(await generateMetadata({ params })).toMatchObject({
      title: "Invoice Generator — Free In-Browser Invoices with PDF & Bulk Export",
      alternates: { canonical: "/tools/invoice-generator" },
    });
    render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Invoice Generator");
  });

  it("owns the productivity station route, derived count and related stations", async () => {
    const station = getStation("productivity")!;
    expect(station).toMatchObject({
      id: "productivity",
      name: "Productivity",
      route: "/stations/productivity",
      icon: "station-mark",
      toolCount: 2,
    });
    expect(station.toolList).toEqual(["pomodoro-timer", "invoice-generator"]);
    expect(station.relatedStations).toEqual(["date-time", "text", "finance-calculators"]);
    for (const existing of stations) expect(existing.route).toBe(`/stations/${existing.id}`);
    const params = Promise.resolve({ station: "productivity" });
    expect((await generateStationMetadata({ params })).alternates?.canonical).toBe("/stations/productivity");
    render(await StationPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Productivity Station");
    expect(screen.getByRole("status").textContent).toBe("2 of 2 tools");
    expect(screen.getByRole("link", { name: /Pomodoro Timer/ }).getAttribute("href")).toBe("/tools/pomodoro-timer");
    expect(screen.getByRole("link", { name: /Invoice Generator/ }).getAttribute("href")).toBe("/tools/invoice-generator");
  });

  it("renders the privacy notice for the station landing", () => {
    render(<StationLanding stationId="productivity" />);
    expect(screen.getByText(/No timer state is saved, no notification permission is requested/)).toBeTruthy();
  });
});
