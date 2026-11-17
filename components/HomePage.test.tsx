// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { WorkbenchProvider } from "@/components/WorkbenchProvider";
import { preferenceKey } from "@/lib/workbench/preferences";
import { stations } from "@/config/stations";
import { tools } from "@/config/tools";
import { searchTools } from "@/lib/tool-search";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("@/components/useSafeNavigation", () => ({
  useSafePathname: () => "/",
  useSafeRouter: () => ({ push: pushMock }),
}));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  pushMock.mockClear();
});

function renderWithWorkbench(children: ReactNode = <HomePage />) {
  return render(<WorkbenchProvider>{children}</WorkbenchProvider>);
}

describe("homepage discovery contracts", () => {
  it("preserves the native input and authoritative search results, including clear", () => {
    render(<HomePage />);
    const input = screen.getByRole("combobox", { name: "Search all tools" }) as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("type")).toBeNull();
    fireEvent.change(input, { target: { value: "  JSON  " } });
    const results = within(screen.getByRole("listbox", { name: "Matching tools" }));
    const destinations = results.getAllByRole("option").map(option => option.getAttribute("href"));
    expect(destinations).toEqual(searchTools(tools, "  JSON  ").map(tool => `/tools/${tool.slug}`));
    fireEvent.change(input, { target: { value: "unregistered-tool-zzzz" } });
    expect(screen.getByText("No available tools match that search.")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("listbox", { name: "Matching tools" })).getByRole("button", { name: "Clear search" }));
    expect(input.value).toBe("");
    expect(within(screen.getByRole("region", { name: "Quick access" })).getAllByRole("link").slice(1).map(link => link.getAttribute("href"))).toEqual(tools.filter(tool => tool.featured).slice(0, 6).map(tool => `/tools/${tool.slug}`));
  });

  it("renders the result panel after the input and exposes combobox semantics", () => {
    render(<HomePage />);
    const input = screen.getByRole("combobox", { name: "Search all tools" });
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.getAttribute("aria-controls")).toBeNull();
    expect(input.getAttribute("aria-autocomplete")).toBe("list");

    fireEvent.change(input, { target: { value: "json" } });
    const listbox = screen.getByRole("listbox", { name: "Matching tools" });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(input.compareDocumentPosition(listbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(listbox).getByRole("status").textContent).toMatch(/\d+ matching tools?/);
    expect(within(listbox).getAllByRole("option").every(option => option.getAttribute("tabindex") === "-1")).toBe(true);
    expect(within(listbox).getAllByRole("option").some(option => option.getAttribute("aria-selected") === "true")).toBe(false);
  });

  it("supports wrap-around arrow navigation, Enter opening, and Escape clearing with focus retained", () => {
    render(<HomePage />);
    const input = screen.getByRole("combobox", { name: "Search all tools" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "json" } });
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[options.length - 1].getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[options.length - 1].id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(pushMock).toHaveBeenCalledWith(options[1].getAttribute("href"));

    pushMock.mockClear();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(pushMock).toHaveBeenCalledWith(options[2].getAttribute("href"));

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox", { name: "Matching tools" })).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it("opens the first result on Enter when none is active", () => {
    render(<HomePage />);
    const input = screen.getByRole("combobox", { name: "Search all tools" });
    fireEvent.change(input, { target: { value: "json" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(pushMock).toHaveBeenCalledWith(screen.getAllByRole("option")[0].getAttribute("href"));
  });

  it("hides personal tools and quick access while searching and restores them after clearing", async () => {
    localStorage.setItem(preferenceKey, JSON.stringify({ favorites: ["json-formatter"], recent: ["json-formatter"], rememberRecent: true, autoDetect: false, autoOpenSingle: true }));
    renderWithWorkbench();
    const input = screen.getByRole("combobox", { name: "Search all tools" });
    await waitFor(() => expect(screen.getByRole("region", { name: "Your tools" })).toBeTruthy());
    const personalTools = screen.getByRole("region", { name: "Your tools" });
    const quickAccess = screen.getByRole("region", { name: "Quick access" });
    expect(personalTools.compareDocumentPosition(quickAccess) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(input, { target: { value: "json" } });
    expect(screen.queryByRole("region", { name: "Your tools" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Quick access" })).toBeNull();
    expect(screen.getByRole("listbox", { name: "Matching tools" })).toBeTruthy();
    expect(screen.getByText("Paste anything to detect format")).toBeTruthy();
    const triage = document.querySelector("[class*='searchTriage']");
    if (triage) expect(triage.compareDocumentPosition(screen.getByRole("listbox", { name: "Matching tools" })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("region", { name: "Your tools" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Quick access" })).toBeTruthy();
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

    expect(screen.getByText("Paste anything to detect format")).toBeDefined();
    expect(screen.queryByPlaceholderText("📋 Paste anything here to auto-detect format… (Cmd/Ctrl + V)")).toBeNull();

    const input = screen.getByRole("combobox", { name: "Search all tools" }) as HTMLInputElement;

    input.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "v", code: "KeyV", metaKey: true, shiftKey: true });
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: '{"name": "Code Station", "active": true}' } });

    expect(screen.getByText(/Detected: JSON/i)).toBeDefined();
    expect(screen.getByText(/98% confidence/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Open in JSON Formatter/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Open in JSON Formatter/i }));
    const pending = sessionStorage.getItem("codestation_pending_input");
    expect(pending).toBeTruthy();
    expect(JSON.parse(pending!).slug).toBe("json-formatter");
  });

  it("keeps the 370+ marketing copy and validates station card layout structure", () => {
    render(<HomePage />);

    const proSection = screen.getByRole("region", { name: /Code Station Pro/i });
    expect(proSection.textContent).toContain("All 370+ browser developer tools are 100% free, private, and unlimited.");
    expect(proSection.textContent).not.toContain("300+");
    expect(document.querySelector("[class*='eyebrow']")?.textContent).toContain("370+ PRIVATE TOOLS");
    expect(document.querySelector("[class*='eyebrow']")?.textContent).toContain("30 STATIONS");

    const proLinks = within(proSection).getAllByRole("link");
    expect(proLinks.map(l => l.getAttribute("href"))).toEqual(["/pro", "/docs"]);

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

  it("renders the common questions and FAQ copy that matches structured data", () => {
    render(<HomePage />);
    const faq = within(screen.getByRole("region", { name: /Common questions/i }));
    expect(faq.getAllByRole("definition").length).toBeGreaterThanOrEqual(3);
    expect(faq.getByText("Is Code Station free?")).toBeTruthy();
    expect(faq.getByText("Are my files uploaded?")).toBeTruthy();
    expect(faq.getByText("How does local processing work?")).toBeTruthy();
    expect(faq.getByText("Can AI agents use these tools?")).toBeTruthy();
  });
});
