// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommandPalette from "./CommandPalette";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("./useSafeNavigation", () => ({
  useSafePathname: () => "/",
  useSafeRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
  localStorage.clear();
});

afterEach(cleanup);

async function openWithKeyboard(init: KeyboardEventInit = { metaKey: true }) {
  fireEvent.keyDown(window, { key: "k", ...init });
  return screen.findByRole("dialog");
}

describe("CommandPalette", () => {
  it("mounts only the trigger and lazily loads the dialog on first open", async () => {
    const { container } = render(<CommandPalette />);

    const trigger = screen.getByRole("button", { name: "Open command palette" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-command-palette-shell]")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();

    trigger.focus();
    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens globally with Meta+K and Ctrl+K, focusing the combobox with listbox semantics", async () => {
    render(<CommandPalette />);

    const dialog = await openWithKeyboard({ metaKey: true });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("command-palette-title");

    const combobox = screen.getByRole("combobox");
    expect(document.activeElement).toBe(combobox);
    expect(combobox.getAttribute("aria-expanded")).toBe("true");
    expect(combobox.getAttribute("aria-controls")).toBe("command-palette-listbox");
    expect(combobox.getAttribute("aria-autocomplete")).toBe("list");
    expect(combobox.getAttribute("aria-activedescendant")).toBe("cp-option-0");

    expect(screen.getByRole("listbox", { name: "Command palette results" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toContain("results");

    fireEvent.keyDown(combobox, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "K", ctrlKey: true });
    expect(await screen.findByRole("dialog")).toBeDefined();
  });

  it("shows featured tools and actions before a query", async () => {
    render(<CommandPalette />);
    await openWithKeyboard();

    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    expect(screen.getByText("JSON Formatter")).toBeDefined();
    expect(screen.getByText("Tools directory")).toBeDefined();
    expect(screen.getByText("Workbench")).toBeDefined();
  });

  it("filters tools, stations, and actions by query and reports the count", async () => {
    render(<CommandPalette />);
    await openWithKeyboard();

    const combobox = screen.getByRole("combobox");
    fireEvent.change(combobox, { target: { value: "git" } });

    expect(screen.getByRole("group", { name: "Tools" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Stations" })).toBeDefined();
    expect(screen.getAllByText("Git & Version Control").length).toBeGreaterThan(1);
    expect(screen.getByRole("status").textContent).not.toContain("0 results");

    fireEvent.change(combobox, { target: { value: "workbench" } });
    expect(screen.getByText("Workbench")).toBeDefined();
    expect(screen.getByText("Collect favorites, recents, and queued input.")).toBeDefined();
  });

  it("shows a documented empty state for unmatched queries", async () => {
    render(<CommandPalette />);
    await openWithKeyboard();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzz-no-match" } });

    expect(screen.getByText(/No tools, stations, or actions match/)).toBeDefined();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain("0 results");
  });

  it("moves the active option with Arrow, Home, and End while focus stays in the input", async () => {
    render(<CommandPalette />);
    await openWithKeyboard();

    const combobox = screen.getByRole("combobox");
    const lastIndex = screen.getAllByRole("option").length - 1;

    fireEvent.keyDown(combobox, { key: "End" });
    expect(combobox.getAttribute("aria-activedescendant")).toBe(`cp-option-${lastIndex}`);
    expect(document.activeElement).toBe(combobox);

    fireEvent.keyDown(combobox, { key: "Home" });
    expect(combobox.getAttribute("aria-activedescendant")).toBe("cp-option-0");

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(combobox.getAttribute("aria-activedescendant")).toBe("cp-option-1");

    fireEvent.keyDown(combobox, { key: "ArrowUp" });
    expect(combobox.getAttribute("aria-activedescendant")).toBe("cp-option-0");

    fireEvent.keyDown(combobox, { key: "ArrowUp" });
    expect(combobox.getAttribute("aria-activedescendant")).toBe("cp-option-0");
  });

  it("opens the highlighted result on Enter, closing before navigating", async () => {
    render(<CommandPalette />);
    await openWithKeyboard();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/tools/json-formatter");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a hovered result with a click and navigates", async () => {
    render(<CommandPalette />);
    await openWithKeyboard();

    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[1]);
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.click(options[1]);

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0][0]).toMatch(/^\/(tools|workbench|workflows|settings|offline|pro|docs)/);
  });

  it("closes on Escape and restores focus to the opener", async () => {
    render(<CommandPalette />);
    const trigger = screen.getByRole("button", { name: "Open command palette" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(dialog.isConnected).toBe(false);
  });

  it("closes on backdrop press and on the close button", async () => {
    render(<CommandPalette />);
    let dialog = await openWithKeyboard();
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close command palette" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("toggles closed with the global shortcut and ignores repeat or composing keys", async () => {
    render(<CommandPalette />);

    fireEvent.keyDown(window, { key: "k", metaKey: true, repeat: true });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "k", metaKey: true, isComposing: true });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("dialog")).toBeDefined();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not make network requests or persist the query", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled"));
    const setItemSpy = vi.spyOn(localStorage, "setItem");

    render(<CommandPalette />);
    await openWithKeyboard();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "json" } });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
