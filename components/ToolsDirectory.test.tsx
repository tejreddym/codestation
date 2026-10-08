// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ToolsPage from "@/app/tools/page";
import { tools } from "@/config/tools";

afterEach(cleanup);
describe("grouped tool directory", () => {
  it("keeps every canonical tool discoverable exactly once after grouping", async () => {
    const { container } = render(await ToolsPage({ searchParams: Promise.resolve({}) }));
    const links = [...container.querySelectorAll<HTMLAnchorElement>("a.tool-card")];
    expect(links.map(link => link.getAttribute("href")).sort()).toEqual(tools.map(tool => `/tools/${tool.slug}`).sort());
    const index = screen.getByRole("navigation", { name: "Tool categories" });
    for (const link of within(index).getAllByRole("link")) {
      const target = container.querySelector(link.getAttribute("href")!);
      expect(target?.tagName).toBe("SECTION");
    }
  });
  it("retains the existing category query filter and canonical destinations", async () => {
    const { container } = render(await ToolsPage({ searchParams: Promise.resolve({ category: "Image" }) }));
    expect([...container.querySelectorAll("a.tool-card")].map(link => link.getAttribute("href"))).toEqual(tools.filter(tool => tool.category === "Image").map(tool => `/tools/${tool.slug}`));
    expect(screen.getByRole("link", { name: "All developer tools ↗" }).getAttribute("href")).toBe("/tools");
  });
  it("does not expose tools for an unknown category", async () => {
    const { container } = render(await ToolsPage({ searchParams: Promise.resolve({ category: "Unavailable" }) }));
    expect(container.querySelectorAll("a.tool-card").length).toBe(0);
    expect(screen.getByText("That station does not have any tools yet.")).toBeTruthy();
  });
});
