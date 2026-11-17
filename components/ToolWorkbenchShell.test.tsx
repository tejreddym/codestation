// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolWorkbenchShell } from "./ToolWorkbenchShell";

afterEach(cleanup);

function shell(overrides: Partial<Parameters<typeof ToolWorkbenchShell>[0]> = {}) {
  return <ToolWorkbenchShell
    pair={{ slug: "base64-decoder", name: "Base64 Decoder" }}
    direction="Base64 → Text"
    input="aGk="
    onInputChange={() => {}}
    onLoadExample={() => {}}
    output="hi"
    outputEmpty="Your result will appear here."
    onCopy={() => {}}
    onDownload={() => {}}
    primaryLabel="Decode"
    onPrimary={() => {}}
    busy={false}
    onClear={() => {}}
    metadata="2 characters"
    error=""
    notice="Copied to clipboard"
    privacy="Runs locally."
    {...overrides}
  />;
}

describe("ToolWorkbenchShell", () => {
  it("keeps the input label, example action and paired navigation", () => {
    render(shell());
    expect((screen.getByLabelText("Tool input") as HTMLTextAreaElement).value).toBe("aGk=");
    fireEvent.change(screen.getByLabelText("Tool input"), { target: { value: "next" } });
    expect(screen.getByRole("button", { name: "Example" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Switch to Base64 Decoder/ }).getAttribute("href")).toBe("/tools/base64-decoder");
  });

  it("renders output with the accessible pre contract and header copy/download", () => {
    render(shell());
    const pre = screen.getByLabelText("Output value");
    expect(pre.textContent).toBe("hi");
    expect(pre.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
  });

  it("shows metadata, alert and status in the documented order", () => {
    render(shell({ error: "Invalid input", notice: "Nothing copied" }));
    const metadata = screen.getByText("2 characters");
    const alert = screen.getByRole("alert");
    const status = screen.getByRole("status");
    expect(metadata.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alert.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Runs locally.")).toBeTruthy();
  });

  it("renders a decode secondary action only when provided", () => {
    const onSecondary = vi.fn();
    const { rerender } = render(shell({ primaryLabel: "Encode", secondaryLabel: "Decode", onSecondary }));
    fireEvent.click(screen.getByRole("button", { name: "Decode" }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
    rerender(shell({ primaryLabel: "Encode" }));
    expect(screen.queryByRole("button", { name: "Decode" })).toBeNull();
  });
});
