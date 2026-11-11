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
    expect(links.some(link => link.getAttribute("href")?.includes("hardware"))).toBe(false);
    expect(links.some(link => link.getAttribute("href")?.includes("developer-math"))).toBe(true);
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

  it("integrates format detection into search bar, shows extra text, and handles Cmd+Shift+V shortcut", async () => {
    sessionStorage.clear();
    render(<HomePage />);

    // 1. Verify extra text is present below search bar
    expect(screen.getByText("Paste anything to detect format")).toBeDefined();

    // 2. Verify separate ClipboardOmniTriage textarea is NOT in hero
    expect(screen.queryByPlaceholderText("📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)")).toBeNull();

    const input = screen.getByRole("textbox", { name: "Search all tools" }) as HTMLInputElement;

    // 3. Test shortcut Cmd/Ctrl + Shift + V focuses the search bar
    input.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "v", code: "KeyV", metaKey: true, shiftKey: true });
    expect(document.activeElement).toBe(input);

    // 4. Test format detection on paste/change of JSON
    fireEvent.change(input, { target: { value: '{"name": "Code Station", "active": true}' } });

    expect(screen.getByText(/Detected: JSON/i)).toBeDefined();
    expect(screen.getByText(/98% confidence/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Open in JSON Formatter/i })).toBeDefined();

    // 5. Test clicking open in tool persists pending input
    fireEvent.click(screen.getByRole("button", { name: /Open in JSON Formatter/i }));
    const pending = sessionStorage.getItem("codestation_pending_input");
    expect(pending).toBeTruthy();
    expect(JSON.parse(pending!).slug).toBe("json-formatter");
  });

  it("ensures copy consistency with 300+ browser developer tools and validates station card layout structure", () => {
    render(<HomePage />);

    // 1. Pro section copy asserts 300+ browser developer tools
    const proSection = screen.getByRole("region", { name: /Code Station Pro/i });
    expect(proSection.textContent).toContain("All 300+ browser developer tools are 100% free, private, and unlimited.");
    expect(proSection.textContent).not.toContain("250+");

    // 2. Pro CTA links to /pro and /docs
    const proLinks = within(proSection).getAllByRole("link");
    expect(proLinks.map(l => l.getAttribute("href"))).toEqual(["/pro", "/docs"]);

    // 3. Station cards in directory render station name, description, and count badge
    const directory = screen.getByRole("region", { name: "Choose a station" });
    const stationCards = within(directory).getAllByRole("link");
    expect(stationCards).toHaveLength(stations.length);
    for (const card of stationCards) {
      expect(card.querySelector("h3")).toBeTruthy();
      expect(card.querySelector("p")).toBeTruthy();
      expect(card.querySelector("span")).toBeTruthy();
      expect(card.textContent).toMatch(/\d+ available tools/);
    }
  });
});
