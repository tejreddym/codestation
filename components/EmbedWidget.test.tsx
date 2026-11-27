// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildEmbedIframeSnippet, buildEmbedUrl } from "@/lib/embed/snippet";
import { EmbedModal } from "./EmbedModal";
import {
  UniversalToolShell,
  createMockToolDefinition,
  createMockToolEngine,
  setupTestEnvironment,
  cleanupTestEnvironment,
  MockClipboardManager,
} from "@/lib/engine/__tests__/e2e/testHelpers";

describe("Embed widget helpers & UI", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
    vi.restoreAllMocks();
  });

  it("builds embed URLs and iframe snippets cleanly with escaped attributes", () => {
    expect(buildEmbedUrl({ slug: "json-formatter", theme: "auto" })).toBe(
      "https://codestation.in/embed/json-formatter"
    );
    expect(
      buildEmbedUrl({
        slug: "json-formatter",
        theme: "dark",
        hash: "#state=p.eyJ2IjoxfQ",
      })
    ).toBe("https://codestation.in/embed/json-formatter?theme=dark#state=p.eyJ2IjoxfQ");

    const snippet = buildEmbedIframeSnippet({
      slug: "json-formatter",
      title: 'JSON "Formatter"',
      theme: "light",
      height: 640,
    });
    expect(snippet).toContain('src="https://codestation.in/embed/json-formatter?theme=light"');
    expect(snippet).toContain('title="JSON &quot;Formatter&quot; — Code Station"');
    expect(snippet).toContain('height="640"');
    expect(snippet).toContain('allow="clipboard-write"');
  });

  it("updates iframe snippet in EmbedModal for theme and height and copies to clipboard", async () => {
    render(
      <EmbedModal
        open={true}
        onClose={() => {}}
        slug="json-formatter"
        toolName="JSON Formatter"
      />
    );

    const textarea = screen.getByTestId("embed-snippet-textarea") as HTMLTextAreaElement;
    expect(textarea.value).toContain("https://codestation.in/embed/json-formatter");
    expect(screen.getByTestId("embed-preview-note").textContent).toContain("100% locally");

    fireEvent.change(screen.getByTestId("embed-theme-select"), { target: { value: "dark" } });
    fireEvent.change(screen.getByTestId("embed-height-select"), { target: { value: "760" } });

    expect(textarea.value).toContain("https://codestation.in/embed/json-formatter?theme=dark");
    expect(textarea.value).toContain('height="760"');

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-copy-embed-code"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("btn-copy-embed-code").textContent).toBe("Embed Code Copied!");
    });
    expect(MockClipboardManager.getLastWritten()).toBe(textarea.value);
  });

  it("supports Embed button modal and compact chromeless embedMode in UniversalToolShell", async () => {
    const def = createMockToolDefinition({
      id: "json-formatter",
      slug: "json-formatter",
      name: "JSON Formatter",
    });
    const eng = createMockToolEngine();

    const { rerender } = render(
      React.createElement(UniversalToolShell, { definition: def, engine: eng })
    );

    fireEvent.click(screen.getByTestId("btn-action-embed"));
    expect(screen.getByTestId("embed-modal")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Close embed dialog" }));
    expect(screen.queryByTestId("embed-modal")).toBeNull();

    rerender(
      React.createElement(UniversalToolShell, {
        definition: def,
        engine: eng,
        embedMode: true,
      })
    );

    const shell = screen.getByTestId("universal-tool-shell");
    expect(shell.getAttribute("data-embed-mode")).toBe("true");
    expect(screen.queryByTestId("btn-action-embed")).toBeNull();

    const footer = screen.getByTestId("universal-embed-footer");
    expect(footer.textContent).toContain("JSON Formatter");
    const link = footer.querySelector("a");
    expect(link?.textContent).toContain("Powered by Code Station");
    expect(link?.getAttribute("href")).toBe("https://codestation.in/tools/json-formatter");
  });
});
