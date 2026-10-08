// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import ToolsPage from "@/app/tools/page";
import ToolPage from "@/app/tools/[slug]/page";
import { tools } from "@/config/tools";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);

function checkBreadcrumbs(expected: [string, string][]) {
  const nav = within(document.body).getByRole("navigation", { name: "Breadcrumb" });
  const links = within(nav).getAllByRole("link");
  expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(expected);
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(links.at(-1)?.getAttribute("aria-current")).toBe("page");
  expect(Array.from(nav.querySelectorAll("span")).every((span) => span.getAttribute("aria-hidden") === "true")).toBe(true);
}

describe("clickable breadcrumbs", () => {
  it("links Home and the current unfiltered Tools page", async () => {
    render(await ToolsPage({ searchParams: Promise.resolve({}) }));
    checkBreadcrumbs([["Home", "/"], ["Tools", "/tools"]]);
  });

  it.each([...new Set(tools.map((tool) => tool.category))])("links the %s station with an encoded query", async (category) => {
    render(await ToolsPage({ searchParams: Promise.resolve({ category }) }));
    checkBreadcrumbs([["Home", "/"], ["Tools", "/tools"], [category, `/tools?category=${encodeURIComponent(category)}`]]);
  });

  it.each(tools.map((tool) => [tool.slug, tool] as const))("links every segment on %s", async (slug, tool) => {
    render(await ToolPage({ params: Promise.resolve({ slug }) }));
    const categoryRoute = tool.category === "API" ? "/stations/api" : tool.category === "Web" ? "/stations/web" : ["Image", "Spreadsheet", "Markdown"].includes(tool.category) ? `/stations/${tool.category.toLowerCase()}` : ["Color & CSS", "Converters"].includes(tool.category) ? `/stations/${tool.category.toLowerCase().replace(/ & /g, "-")}` : `/tools?category=${encodeURIComponent(tool.category)}`;
    checkBreadcrumbs([["Home", "/"], ["Tools", "/tools"], [tool.category, categoryRoute], [tool.name, `/tools/${slug}`]]);
  });
});
