// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { stations } from "@/config/stations";
import { tools } from "@/config/tools";
import { searchTools } from "@/lib/tool-search";

afterEach(cleanup);
describe("homepage discovery contracts", () => {
  it("preserves the native input and authoritative search results, including clear", () => {
    render(<HomePage />);
    const input = screen.getByRole("textbox", { name: "Search all tools" }) as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("type")).toBeNull();
    fireEvent.change(input, { target: { value: "  JSON  " } });
    const results = within(screen.getByRole("region", { name: "Matching tools" }));
    const destinations = results.getAllByRole("link").map(link => link.getAttribute("href")).filter(href => href !== "/tools");
    expect(destinations).toEqual(searchTools(tools, "  JSON  ").map(tool => `/tools/${tool.slug}`));
    fireEvent.change(input, { target: { value: "unregistered-tool-zzzz" } });
    expect(screen.getByText("No available tools match that search.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input.value).toBe("");
    expect(within(screen.getByRole("region", { name: "Quick access" })).getAllByRole("link").slice(1).map(link => link.getAttribute("href"))).toEqual(tools.filter(tool => tool.featured).slice(0, 6).map(tool => `/tools/${tool.slug}`));
  });
  it("preserves every station in order with registry counts and pending disclosure", () => {
    render(<HomePage />);
    const directory = within(screen.getByRole("region", { name: "Choose a station" }));
    const links = directory.getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(stations.map(station => station.route));
    links.forEach((link, i) => expect(link.textContent).toContain(`${stations[i].toolCount} available tools`));
    expect(directory.getByText("Pending — not yet available or included in counts.")).toBeTruthy();
    expect(links.some(link => link.getAttribute("href")?.includes("math"))).toBe(false);
  });
  it("links all three illustrative previews to existing canonical tools", () => {
    render(<HomePage />);
    const previews = within(screen.getByRole("region", { name: "Make room for the work." }));
    expect(previews.getAllByRole("article")).toHaveLength(3);
    for (const link of previews.getAllByRole("link")) expect(tools.some(tool => `/tools/${tool.slug}` === link.getAttribute("href"))).toBe(true);
    expect(previews.queryAllByRole("textbox")).toHaveLength(0);
    expect(previews.queryAllByRole("button")).toHaveLength(0);
  });
  it("keeps decorative vectors out of keyboard and screen-reader navigation", () => {
    const { container } = render(<HomePage />);
    for (const svg of container.querySelectorAll("main svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll('svg[tabindex="0"]')).toHaveLength(0);
  });
});
