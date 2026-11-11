// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PersonalTools, { FavoriteButton } from "./PersonalTools";
import { WorkbenchProvider, useWorkbench } from "./WorkbenchProvider";

// 20 valid tool slugs verified from config/tools.ts
const TWENTY_VALID_SLUGS = [
  "json-formatter",
  "json-validator",
  "json-minifier",
  "json-to-yaml",
  "yaml-to-json",
  "base64-encoder",
  "base64-decoder",
  "url-encoder",
  "url-decoder",
  "jwt-decoder",
  "html-encoder",
  "html-decoder",
  "uuid-generator",
  "password-generator",
  "sha-256-generator",
  "sha-512-generator",
  "text-counter",
  "case-converter",
  "duplicate-line-remover",
  "sort-lines",
] as const;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function seedWorkbenchPreferences(prefs: {
  favorites?: string[];
  recent?: string[];
  rememberRecent?: boolean;
  autoDetect?: boolean;
  autoOpenSingle?: boolean;
}) {
  localStorage.setItem(
    "code-station-workbench-v1",
    JSON.stringify({
      favorites: prefs.favorites ?? [],
      recent: prefs.recent ?? [],
      rememberRecent: prefs.rememberRecent ?? true,
      autoDetect: prefs.autoDetect ?? false,
      autoOpenSingle: prefs.autoOpenSingle ?? true,
    })
  );
}

describe("Adversarial Stress Suite — PersonalTools Truncation & Toggle (Milestone R2-M1)", () => {
  // =========================================================================
  // Dimension 1: Exact Boundary Testing (0, 1, 2, 3, 4, 5, 20 tools)
  // =========================================================================
  describe("1. Boundary Testing (0 to 20 tools)", () => {
    it("Boundary 0 items: returns null when always=false and empty preferences", () => {
      seedWorkbenchPreferences({ favorites: [], recent: [] });
      const { container } = render(
        <WorkbenchProvider>
          <PersonalTools always={false} />
        </WorkbenchProvider>
      );
      expect(container.firstChild).toBeNull();
    });

    it("Boundary 0 items: renders fallback guidance paragraphs and zero toggles when always=true", async () => {
      seedWorkbenchPreferences({ favorites: [], recent: [] });
      render(
        <WorkbenchProvider>
          <PersonalTools always={true} />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });

      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });
      const favSection = within(favHeading.closest("div")!);
      const recSection = within(recHeading.closest("div")!);

      expect(favSection.queryAllByRole("listitem")).toHaveLength(0);
      expect(recSection.queryAllByRole("listitem")).toHaveLength(0);
      expect(favSection.getByText("Use a star to keep a tool here.")).toBeDefined();
      expect(
        recSection.getByText("Tools you visit appear here. Only tool names are remembered.")
      ).toBeDefined();
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
      expect(recSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("Boundary 1 item: renders exactly 1 tool without toggle", async () => {
      seedWorkbenchPreferences({ favorites: [TWENTY_VALID_SLUGS[0]], recent: [] });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      expect(favSection.getAllByRole("listitem")).toHaveLength(1);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("Boundary 2 items: renders exactly 2 tools without toggle", async () => {
      seedWorkbenchPreferences({
        favorites: [TWENTY_VALID_SLUGS[0], TWENTY_VALID_SLUGS[1]],
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      expect(favSection.getAllByRole("listitem")).toHaveLength(2);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("Boundary 3 items: renders exactly 3 tools without toggle", async () => {
      seedWorkbenchPreferences({
        favorites: [TWENTY_VALID_SLUGS[0], TWENTY_VALID_SLUGS[1], TWENTY_VALID_SLUGS[2]],
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      expect(favSection.getAllByRole("listitem")).toHaveLength(3);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("Boundary 4 items: exactly at threshold, renders 4 tools and strictly omits toggle in both sections", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 4),
        recent: TWENTY_VALID_SLUGS.slice(4, 8),
      });
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

    it("Boundary 5 items: threshold + 1, renders 4 tools initially and provides accessible toggle", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 5),
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Initially truncated to 4
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);

      const toggle = favSection.getByRole("button", { name: "Show more" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.getAttribute("aria-controls")).toBe("personal-list-favorites");

      // Expand to 5
      fireEvent.click(toggle);
      expect(favSection.getAllByRole("listitem")).toHaveLength(5);
      const collapseToggle = favSection.getByRole("button", { name: "Show less" });
      expect(collapseToggle.getAttribute("aria-expanded")).toBe("true");

      // Collapse back to 4
      fireEvent.click(collapseToggle);
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(
        favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")
      ).toBe("false");
    });

    it("Boundary 20 items: large scale, renders 4 tools initially and all 20 on expansion", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 20),
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Initial truncated state
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);

      // Expand
      const toggle = favSection.getByRole("button", { name: "Show more" });
      fireEvent.click(toggle);

      // All 20 rendered
      expect(favSection.getAllByRole("listitem")).toHaveLength(20);
      expect(
        favSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")
      ).toBe("true");

      // Collapse
      fireEvent.click(favSection.getByRole("button", { name: "Show less" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(
        favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")
      ).toBe("false");
    });
  });

  // =========================================================================
  // Dimension 2: Repeated Rapid Toggle Transitions
  // =========================================================================
  describe("2. Repeated Rapid Toggle Transitions", () => {
    it("preserves strict state synchronization across 20 rapid consecutive toggles", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 10),
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      for (let i = 1; i <= 20; i++) {
        if (i % 2 === 1) {
          // Odd iteration: click "Show more" -> expands to 10
          const showMoreBtn = favSection.getByRole("button", { name: "Show more" });
          expect(showMoreBtn.getAttribute("aria-expanded")).toBe("false");
          fireEvent.click(showMoreBtn);
          expect(favSection.getAllByRole("listitem")).toHaveLength(10);
          expect(
            favSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")
          ).toBe("true");
        } else {
          // Even iteration: click "Show less" -> collapses to 4
          const showLessBtn = favSection.getByRole("button", { name: "Show less" });
          expect(showLessBtn.getAttribute("aria-expanded")).toBe("true");
          fireEvent.click(showLessBtn);
          expect(favSection.getAllByRole("listitem")).toHaveLength(4);
          expect(
            favSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")
          ).toBe("false");
        }
      }
    });
  });

  // =========================================================================
  // Dimension 3: Cross-Section State Isolation
  // =========================================================================
  describe("3. Cross-Section State Isolation", () => {
    it("strictly isolates expand/collapse states between Favorites and Recently used through complete toggle lifecycle", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 8),
        recent: TWENTY_VALID_SLUGS.slice(8, 15),
      });
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

      // Step 0: Initial state - both 4 items, both collapsed
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(recSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.getByRole("button", { name: "Show more" })).toBeDefined();
      expect(recSection.getByRole("button", { name: "Show more" })).toBeDefined();

      // Step 1: Expand Favorites only
      fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(8);
      expect(favSection.getByRole("button", { name: "Show less" })).toBeDefined();

      // Recently used MUST remain collapsed at 4
      expect(recSection.getAllByRole("listitem")).toHaveLength(4);
      expect(
        recSection.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")
      ).toBe("false");

      // Step 2: Expand Recently used as well
      fireEvent.click(recSection.getByRole("button", { name: "Show more" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(8);
      expect(favSection.getByRole("button", { name: "Show less" })).toBeDefined();
      expect(recSection.getAllByRole("listitem")).toHaveLength(7);
      expect(recSection.getByRole("button", { name: "Show less" })).toBeDefined();

      // Step 3: Collapse Favorites only
      fireEvent.click(favSection.getByRole("button", { name: "Show less" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.getByRole("button", { name: "Show more" })).toBeDefined();

      // Recently used MUST stay expanded at 7
      expect(recSection.getAllByRole("listitem")).toHaveLength(7);
      expect(
        recSection.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")
      ).toBe("true");

      // Step 4: Collapse Recently used
      fireEvent.click(recSection.getByRole("button", { name: "Show less" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(recSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.getByRole("button", { name: "Show more" })).toBeDefined();
      expect(recSection.getByRole("button", { name: "Show more" })).toBeDefined();
    });
  });

  // =========================================================================
  // Dimension 4: Dynamic Item Removal & DOM Reactivity
  // =========================================================================
  describe("4. Dynamic Item Removal", () => {
    it("removing a tool in collapsed state (5 items -> 4 items) immediately removes toggle button", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 5),
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Shows initial 4 items + "Show more" toggle
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.getByRole("button", { name: "Show more" })).toBeDefined();

      // Remove the 1st favorite tool ("JSON Formatter")
      const removeBtn = favSection.getAllByRole("button", { name: /Remove .* from favorites/i })[0];
      fireEvent.click(removeBtn);

      // Now exactly 4 favorites remain -> toggle MUST be removed immediately
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("removing a tool in expanded state (5 items -> 4 items) immediately hides toggle button", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 5),
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Expand to 5 items
      fireEvent.click(favSection.getByRole("button", { name: "Show more" }));
      expect(favSection.getAllByRole("listitem")).toHaveLength(5);
      expect(favSection.getByRole("button", { name: "Show less" })).toBeDefined();

      // Remove 5th item
      const removeBtns = favSection.getAllByRole("button", { name: /Remove .* from favorites/i });
      fireEvent.click(removeBtns[4]);

      // Count drops to 4 -> toggle disappears immediately
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("removing all items down to 0 correctly reveals muted guidance text", async () => {
      seedWorkbenchPreferences({
        favorites: [TWENTY_VALID_SLUGS[0]],
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools always={true} />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      expect(favSection.getAllByRole("listitem")).toHaveLength(1);

      // Remove the only tool
      const removeBtn = favSection.getByRole("button", { name: /Remove .* from favorites/i });
      fireEvent.click(removeBtn);

      // Should transition to guidance message
      expect(favSection.queryAllByRole("listitem")).toHaveLength(0);
      expect(favSection.getByText("Use a star to keep a tool here.")).toBeDefined();
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });
  });

  // =========================================================================
  // Dimension 5: Invalid Tool Slugs & Robustness
  // =========================================================================
  describe("5. Invalid Tool Slugs & Robustness", () => {
    it("safely filters out invalid slugs mixed with valid slugs and computes truncation only against valid tools", async () => {
      // 5 invalid slugs mixed with 4 valid tools = 4 valid tools total -> no toggle
      seedWorkbenchPreferences({
        favorites: [
          "completely-fake-tool-1",
          TWENTY_VALID_SLUGS[0],
          "non-existent-tool-2",
          TWENTY_VALID_SLUGS[1],
          "deprecated-slug-3",
          TWENTY_VALID_SLUGS[2],
          "null-tool-4",
          TWENTY_VALID_SLUGS[3],
          "undefined-tool-5",
        ],
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Exactly 4 valid tools rendered, 0 fake tools
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      expect(favSection.queryByRole("button", { name: /Show/i })).toBeNull();
    });

    it("handles 5 valid tools mixed with invalid slugs, rendering 4 initially and 5 on expand", async () => {
      seedWorkbenchPreferences({
        favorites: [
          "fake-1",
          TWENTY_VALID_SLUGS[0],
          "fake-2",
          TWENTY_VALID_SLUGS[1],
          "fake-3",
          TWENTY_VALID_SLUGS[2],
          "fake-4",
          TWENTY_VALID_SLUGS[3],
          "fake-5",
          TWENTY_VALID_SLUGS[4],
        ],
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      // Initially truncated to 4 valid tools
      expect(favSection.getAllByRole("listitem")).toHaveLength(4);
      const toggle = favSection.getByRole("button", { name: "Show more" });
      expect(toggle).toBeDefined();

      // Expand to 5 valid tools
      fireEvent.click(toggle);
      expect(favSection.getAllByRole("listitem")).toHaveLength(5);
    });

    it("survives empty string, whitespace, and object prototype keys without runtime crash", async () => {
      seedWorkbenchPreferences({
        favorites: ["", "   ", "__proto__", "constructor", "toString", "valueOf"],
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools always={true} />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      expect(favSection.queryAllByRole("listitem")).toHaveLength(0);
      expect(favSection.getByText("Use a star to keep a tool here.")).toBeDefined();
    });
  });

  // =========================================================================
  // Dimension 6: DOM Semantics & WAI-ARIA Verification
  // =========================================================================
  describe("6. DOM Semantics & WAI-ARIA Verification", () => {
    it("strictly verifies aria-expanded, aria-controls, and element IDs for both sections", async () => {
      seedWorkbenchPreferences({
        favorites: TWENTY_VALID_SLUGS.slice(0, 6),
        recent: TWENTY_VALID_SLUGS.slice(6, 12),
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const recHeading = screen.getByRole("heading", { level: 2, name: "Recently used" });
      const favDiv = favHeading.closest("div")!;
      const recDiv = recHeading.closest("div")!;

      expect(favDiv.getAttribute("data-section")).toBe("favorites");
      expect(recDiv.getAttribute("data-section")).toBe("recently-used");

      const favUl = favDiv.querySelector("ul")!;
      const recUl = recDiv.querySelector("ul")!;
      expect(favUl.id).toBe("personal-list-favorites");
      expect(recUl.id).toBe("personal-list-recently-used");

      const favToggle = within(favDiv).getByRole("button", { name: "Show more" });
      const recToggle = within(recDiv).getByRole("button", { name: "Show more" });

      expect(favToggle.getAttribute("type")).toBe("button");
      expect(recToggle.getAttribute("type")).toBe("button");
      expect(favToggle.className).toBe("personal-tools-toggle");
      expect(recToggle.className).toBe("personal-tools-toggle");

      expect(favToggle.getAttribute("aria-controls")).toBe("personal-list-favorites");
      expect(recToggle.getAttribute("aria-controls")).toBe("personal-list-recently-used");
      expect(favToggle.getAttribute("aria-expanded")).toBe("false");
      expect(recToggle.getAttribute("aria-expanded")).toBe("false");

      // Expand favorites
      fireEvent.click(favToggle);
      expect(within(favDiv).getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe(
        "true"
      );

      // Expand recently used
      fireEvent.click(recToggle);
      expect(within(recDiv).getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe(
        "true"
      );
    });

    it("verifies FavoriteButton accessible labels, aria-pressed, and SVG hidden state", async () => {
      seedWorkbenchPreferences({
        favorites: [TWENTY_VALID_SLUGS[0]],
        recent: [],
      });
      render(
        <WorkbenchProvider>
          <PersonalTools />
        </WorkbenchProvider>
      );
      await screen.findByRole("region", { name: "Your tools" });
      const favHeading = screen.getByRole("heading", { level: 2, name: "Favorites" });
      const favSection = within(favHeading.closest("div")!);

      const favBtn = favSection.getByRole("button", { name: "Remove JSON Formatter from favorites" });
      expect(favBtn.getAttribute("aria-pressed")).toBe("true");
      expect(favBtn.getAttribute("type")).toBe("button");

      const starSvg = favBtn.querySelector("svg")!;
      expect(starSvg.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
