// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PersonalTools from "./PersonalTools";
import { WorkbenchProvider } from "./WorkbenchProvider";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("PersonalTools component", () => {
  it("renders nothing when both lists are empty and always=false", () => {
    const { container } = render(
      <WorkbenchProvider>
        <PersonalTools />
      </WorkbenchProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders muted guidance messages and omits toggle when always=true on empty preferences", async () => {
    render(
      <WorkbenchProvider>
        <PersonalTools always />
      </WorkbenchProvider>
    );
    await screen.findByRole("region", { name: "Your tools" });
    expect(screen.getByText("Use a star to keep a tool here.")).toBeDefined();
    expect(
      screen.getByText("Tools you visit appear here. Only tool names are remembered.")
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /Show/i })).toBeNull();
  });

  it("omits toggle button when section contains 4 or fewer items", async () => {
    localStorage.setItem(
      "code-station-workbench-v1",
      JSON.stringify({
        favorites: ["json-formatter", "base64-encoder", "uuid-generator", "url-encoder"],
        recent: ["text-counter", "jwt-decoder"],
        rememberRecent: true,
        autoDetect: false,
        autoOpenSingle: true,
      })
    );

    render(
      <WorkbenchProvider>
        <PersonalTools />
      </WorkbenchProvider>
    );

    await screen.findByRole("region", { name: "Your tools" });

    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();

    const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });
    const recSection = within(recHeading.closest("div")!);
    expect(recSection.getAllByRole("listitem")).toHaveLength(2);
    expect(recSection.queryByRole("button", { name: /Show/i })).toBeNull();
  });

  it("truncates to 4 items and provides accessible expand/collapse toggle when items exceed 4", async () => {
    localStorage.setItem(
      "code-station-workbench-v1",
      JSON.stringify({
        favorites: [
          "json-formatter",
          "base64-encoder",
          "uuid-generator",
          "url-encoder",
          "text-counter",
          "jwt-decoder",
        ],
        recent: [],
        rememberRecent: true,
        autoDetect: false,
        autoOpenSingle: true,
      })
    );

    render(
      <WorkbenchProvider>
        <PersonalTools />
      </WorkbenchProvider>
    );

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    // Initial 4 items displayed
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);

    // Toggle button initial state
    const toggle = favSection.getByRole("button", { name: "Show more" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("personal-list-favorites");

    // Click to expand
    fireEvent.click(toggle);
    expect(favSection.getAllByRole("listitem")).toHaveLength(6);
    expect(
      favSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")
    ).toBe("true");

    // Click to collapse back
    fireEvent.click(favSection.getByRole("button", { name: "Show less" }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(
      favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("maintains independent expand/collapse states for Favorites and Recently used", async () => {
    localStorage.setItem(
      "code-station-workbench-v1",
      JSON.stringify({
        favorites: [
          "json-formatter",
          "base64-encoder",
          "uuid-generator",
          "url-encoder",
          "text-counter",
          "jwt-decoder",
        ],
        recent: [
          "html-encoder",
          "html-decoder",
          "base64-decoder",
          "url-decoder",
          "password-generator",
        ],
        rememberRecent: true,
        autoDetect: false,
        autoOpenSingle: true,
      })
    );

    render(
      <WorkbenchProvider>
        <PersonalTools />
      </WorkbenchProvider>
    );

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });
    const favSection = within(favHeading.closest("div")!);
    const recSection = within(recHeading.closest("div")!);

    // Both start truncated at 4
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(recSection.getAllByRole("listitem")).toHaveLength(4);

    // Expand Favorites only
    fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(6);
    expect(
      favSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")
    ).toBe("true");

    // Recently used must remain collapsed at 4
    expect(recSection.getAllByRole("listitem")).toHaveLength(4);
    expect(
      recSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")
    ).toBe("false");

    // Expand Recently used
    fireEvent.click(recSection.getByRole("button", { name: "Show more" }));
    expect(recSection.getAllByRole("listitem")).toHaveLength(5);
    expect(
      recSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")
    ).toBe("true");

    // Collapse Favorites
    fireEvent.click(favSection.getByRole("button", { name: "Show less" }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(
      favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")
    ).toBe("false");

    // Recently used remains expanded
    expect(recSection.getAllByRole("listitem")).toHaveLength(5);
    expect(
      recSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("automatically hides the toggle when removing a favorite reduces count to 4", async () => {
    localStorage.setItem(
      "code-station-workbench-v1",
      JSON.stringify({
        favorites: [
          "json-formatter",
          "base64-encoder",
          "uuid-generator",
          "url-encoder",
          "text-counter",
        ],
        recent: [],
        rememberRecent: true,
        autoDetect: false,
        autoOpenSingle: true,
      })
    );

    render(
      <WorkbenchProvider>
        <PersonalTools />
      </WorkbenchProvider>
    );

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    // Initially 4 shown out of 5
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);

    // Expand
    fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
    expect(favSection.getAllByRole("listitem")).toHaveLength(5);

    // Remove one favorite
    const removeBtn = screen.getByRole("button", { name: /Remove Text Counter/i });
    fireEvent.click(removeBtn);

    // Toggle must disappear because count is now 4
    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
  });

  it("filters out unrecognized tool slugs before calculating truncation", async () => {
    localStorage.setItem(
      "code-station-workbench-v1",
      JSON.stringify({
        favorites: ["json-formatter", "unknown-slug-abc", "base64-encoder", "invalid-xyz"],
        recent: [],
        rememberRecent: true,
        autoDetect: false,
        autoOpenSingle: true,
      })
    );

    render(
      <WorkbenchProvider>
        <PersonalTools />
      </WorkbenchProvider>
    );

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const favSection = within(favHeading.closest("div")!);

    // Only 2 valid tools exist
    expect(favSection.getAllByRole("listitem")).toHaveLength(2);
    expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
  });

  it("handles exactly 4 items without rendering a toggle button in either section", async () => {
    localStorage.setItem(
      "code-station-workbench-v1",
      JSON.stringify({
        favorites: ["json-formatter", "base64-encoder", "uuid-generator", "url-encoder"],
        recent: ["text-counter", "jwt-decoder", "html-encoder", "html-decoder"],
        rememberRecent: true,
        autoDetect: false,
        autoOpenSingle: true,
      })
    );

    render(
      <WorkbenchProvider>
        <PersonalTools />
      </WorkbenchProvider>
    );

    await screen.findByRole("region", { name: "Your tools" });
    const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
    const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });
    const favSection = within(favHeading.closest("div")!);
    const recSection = within(recHeading.closest("div")!);

    expect(favSection.getAllByRole("listitem")).toHaveLength(4);
    expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();

    expect(recSection.getAllByRole("listitem")).toHaveLength(4);
    expect(recSection.queryByRole("button", { name: /Show/i })).toBeNull();
  });
});
