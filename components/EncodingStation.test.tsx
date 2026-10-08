// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodingTools, getEncodingDefinition } from "@/config/encoding-tools";
import { runEncoding } from "@/lib/tools/encoding";
import EncodingStation from "./EncodingStation";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });

describe.each(["dark", "light"])("Encoding under %s DOM theme (not visual layout)", theme => {
  it.each(encodingTools)("$slug has exact inputs, keyboard conversion, exact copy and clear without network", async tool => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const network = vi.fn(() => { throw new Error("Input must stay local"); });
    vi.stubGlobal("fetch", network);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => { throw new Error("Input must stay local"); });
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const errors = vi.spyOn(console, "error");
    const { container } = render(<EncodingStation toolId={tool.id} />);
    const fields = Array.from(container.querySelectorAll<HTMLInputElement>("form textarea,form input,form select"));
    expect(fields.map(field => field.name)).toEqual(tool.encodingContract.fields.map(field => field.name));
    for (const field of fields) expect(container.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    expect(fields.filter(field => field.tagName === "TEXTAREA")).toHaveLength(1);
    expect(container.querySelector('input[type="file"],select')).toBeNull();
    const paired = tool.pairedTool ? getEncodingDefinition(tool.pairedTool) : undefined;
    if (paired) expect(screen.getByRole("link", { name: `Switch to ${paired.name}` }).getAttribute("href")).toBe(`/tools/${paired.slug}`);
    await user.tab();
    expect(document.activeElement).toBe(paired ? screen.getByRole("link", { name: `Switch to ${paired.name}` }) : fields[0]);
    await user.click(screen.getByRole("button", { name: "Load example" }));
    const expected = await runEncoding(tool.slug, tool.encodingContract.example);
    screen.getByRole("button", { name: tool.encodingContract.action }).focus(); await user.keyboard("{Enter}");
    if (expected.parts) {
      for (const part of expected.parts) {
        const copy = await screen.findByRole("button", { name: `Copy ${part.label}` });
        expect(screen.getByLabelText(part.label, { selector: "pre" }).textContent).toBe(part.value);
        copy.focus(); await user.keyboard("{Enter}");
        expect(clipboard).toHaveBeenLastCalledWith(part.value);
      }
    } else {
      const copy = await screen.findByRole("button", { name: "Copy" });
      expect(screen.getByLabelText(tool.encodingContract.outputLabel, { selector: "pre" }).textContent).toBe(expected.text);
      copy.focus(); await user.keyboard("{Enter}"); expect(clipboard).toHaveBeenCalledWith(expected.text);
    }
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    screen.getByRole("button", { name: "Clear" }).focus(); await user.keyboard("{Enter}");
    for (const field of fields) expect(field.value).toBe("");
    expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
    expect(network).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
  });
});

describe("Encoding hydration, errors and direction changes", () => {
  it.each(encodingTools)("$slug hydrates real server markup with stable IDs and labels", async tool => {
    const ui = <EncodingStation toolId={tool.id} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui, { identifierPrefix: "server-" }); document.body.append(container);
    const serverNodes = Array.from(container.querySelectorAll("[id]"));
    const errors = vi.spyOn(console, "error"); const recoverable = vi.fn();
    const root = hydrateRoot(container, ui, { identifierPrefix: "client-", onRecoverableError: recoverable });
    await act(async () => {});
    expect(Array.from(container.querySelectorAll("[id]"))).toEqual(serverNodes);
    expect(new Set(serverNodes.map(node => node.id)).size).toBe(serverNodes.length);
    expect(errors).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
  it.each(encodingTools)("$slug associates errors and never displays a failed conversion as output", async tool => {
    render(<EncodingStation toolId={tool.id} />);
    const field = tool.encodingContract.fields.find(field => field.name === "input")!;
    // Ill-formed Unicode is invalid in every text path; byte decoders reject its alphabet.
    fireEvent.change(screen.getByLabelText(field.label), { target: { value: "\uD800" } });
    fireEvent.submit(screen.getByRole("button", { name: tool.encodingContract.action }).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/\n\s+at /);
    expect(screen.getByLabelText(field.label).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText(field.label).getAttribute("aria-describedby")).toContain(alert.id);
    expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
  });
  it.each(encodingTools.filter(tool => tool.pairedTool))("$slug fully resets fields and labels when its route changes", async tool => {
    const paired = getEncodingDefinition(tool.pairedTool!)!;
    const { rerender } = render(<EncodingStation toolId={tool.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    fireEvent.click(screen.getByRole("button", { name: tool.encodingContract.action }));
    await screen.findAllByRole("button", { name: /^Copy/ });
    rerender(<EncodingStation toolId={paired.id} />);
    for (const field of paired.encodingContract.fields) {
      const control = screen.getByLabelText(field.label) as HTMLInputElement;
      expect(control.value).toBe("");
      expect(control.placeholder).toBe(field.placeholder);
    }
    expect(screen.getByRole("button", { name: paired.encodingContract.action })).toBeTruthy();
    expect(screen.getByRole("heading", { name: paired.encodingContract.outputLabel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
  });
  it("copies empty text exactly and reports unavailable clipboard", async () => {
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<EncodingStation toolId="base64-encoder" />);
    await user.click(screen.getByRole("button", { name: "Encode Base64" }));
    await user.click(await screen.findByRole("button", { name: "Copy" }));
    expect(clipboard).toHaveBeenCalledWith("");
    clipboard.mockRejectedValue(new Error("Blocked"));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not copy");
  });
  it("keeps decoded HTML/Data URI markup inert and labels JWT as not verified", async () => {
    const { container, rerender } = render(<EncodingStation toolId="html-decoder" />);
    fireEvent.change(screen.getByLabelText("Escaped HTML input"), { target: { value: "&lt;img src=x onerror=alert(1)&gt;" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode HTML" }));
    await screen.findByRole("button", { name: "Copy" });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("pre")?.textContent).toBe("<img src=x onerror=alert(1)>");
    rerender(<EncodingStation toolId="jwt-decoder" />);
    expect(screen.getByText(/Decoding is not verification/)).toBeTruthy();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });
});
