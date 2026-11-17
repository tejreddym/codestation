// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GitStation from "./GitStation";

afterEach(cleanup);

describe("GitStation", () => {
  it("renders the conventional commit builder with defaults and generates a message", () => {
    render(<GitStation toolId="conventional-commit-builder" />);

    expect(screen.getByRole("heading", { level: 2, name: "Conventional Commit Builder" })).toBeDefined();
    expect((screen.getByLabelText(/Short description/i) as HTMLInputElement).value).toBe("add a concise summary");
    expect(screen.getByRole("link", { name: "Conventional Commit Validator" }).getAttribute("href")).toBe(
      "/tools/conventional-commit-validator"
    );

    fireEvent.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByText(/feat: add a concise summary/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Copy Conventional commit message/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Download conventional-commit-builder.txt/ })).toBeDefined();
  });

  it("adds a breaking footer when the breaking flag is enabled", () => {
    render(<GitStation toolId="conventional-commit-builder" />);
    fireEvent.click(screen.getByLabelText("Breaking change"));
    fireEvent.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByText(/feat!: add a concise summary/)).toBeDefined();
    expect(screen.getByText(/BREAKING CHANGE: add a concise summary/)).toBeDefined();
  });

  it("validates a conventional commit and shows parsed fields", () => {
    render(<GitStation toolId="conventional-commit-validator" />);
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    const output = screen.getByText(/"valid": true/);
    expect(output.textContent).toContain('"type": "feat"');
    expect(output.textContent).toContain('"scope": "api"');
    expect(output.textContent).toContain('"breaking": true');
  });

  it("explains destructive Git commands without implying execution", () => {
    render(<GitStation toolId="git-command-explainer" />);
    fireEvent.click(screen.getByRole("button", { name: "Explain" }));
    expect(screen.getByText(/Subcommand: reset/)).toBeDefined();
    expect(screen.getByText(/discards uncommitted changes/)).toBeDefined();
    expect(screen.getByText(/never executes Git commands/)).toBeDefined();
  });

  it("generates a grouped Markdown changelog", () => {
    render(<GitStation toolId="changelog-generator" />);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const output = screen.getByText(/# Changelog/);
    expect(output.textContent).toContain("## Features");
    expect(output.textContent).toContain("## Breaking Changes");
    expect(screen.getByRole("button", { name: /Download changelog-generator.md/ })).toBeDefined();
  });

  it("generates .gitattributes content", () => {
    render(<GitStation toolId="gitattributes-generator" />);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const output = screen.getByText(/\* text=auto/);
    expect(output.textContent).toContain("*.png binary");
    expect(output.textContent).toContain("dist/** linguist-generated=true");
    expect(output.textContent).toContain("docs/** export-ignore");
  });

  it("generates a shell hook and install instructions", () => {
    render(<GitStation toolId="git-hooks-generator" />);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const output = screen.getByText(/#!/, { selector: "pre" });
    expect(output.textContent).toContain("set -e");
    expect(output.textContent).toContain("npm run lint");
    expect(screen.getByText(/chmod \+x \.git\/hooks\/pre-commit/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Download git-hooks-generator.sh/ })).toBeDefined();
  });

  it("reports accessible errors for invalid input", () => {
    render(<GitStation toolId="conventional-commit-builder" />);
    fireEvent.change(screen.getByLabelText(/Short description/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByRole("alert").textContent).toContain("Add a short commit description.");
  });

  it("copies generated output with feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<GitStation toolId="conventional-commit-builder" />);
    fireEvent.click(screen.getByRole("button", { name: "Build" }));
    fireEvent.click(screen.getByRole("button", { name: /Copy Conventional commit message/ }));
    expect(writeText).toHaveBeenCalledWith("feat: add a concise summary");
    expect(await screen.findByRole("button", { name: /Copy Conventional commit message/ })).toBeDefined();
    expect(screen.getByText("Copied")).toBeDefined();
  });

  it("clears inputs and output", () => {
    render(<GitStation toolId="conventional-commit-builder" />);
    fireEvent.change(screen.getByLabelText(/Short description/i), { target: { value: "custom change" } });
    fireEvent.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByText(/custom change/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect((screen.getByLabelText(/Short description/i) as HTMLInputElement).value).toBe("add a concise summary");
    expect(screen.queryByText(/custom change/)).toBeNull();
  });
});
