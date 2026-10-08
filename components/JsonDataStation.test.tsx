// @vitest-environment jsdom
import { act, fireEvent, render, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { jsonDataTools, getJsonDataDefinition } from "@/config/json-data-tools";
import { runDataTool } from "@/lib/tools/json-data";
import JsonDataStation from "./JsonDataStation";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });

describe.each(["dark", "light"])("JSON & Data interactions in %s DOM theme (not visual layout)", (theme) => {
  it.each(jsonDataTools)("$slug has only contracted inputs, keyboard run/copy/clear, no input requests", async (tool) => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:local-output"); static revokeObjectURL = vi.fn(); });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
    const fetch = vi.fn(() => { throw new Error("Unexpected network request"); });
    vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => { throw new Error("Unexpected XHR"); });
    const consoleError = vi.spyOn(console, "error");
    const { container } = render(<JsonDataStation toolId={tool.id} />);
    const fields = container.querySelectorAll<HTMLInputElement>("form input, form textarea, form select");
    expect(Array.from(fields, field => field.name)).toEqual(tool.dataContract.fields.map(field => field.name));
    for (const field of fields) expect(container.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    expect(container.querySelector('[type="file"]')).toBeNull();
    const paired = tool.pairedTool ? getJsonDataDefinition(tool.pairedTool) : undefined;
    if (paired) expect(screen.getByRole("link", { name: `Switch to ${paired.name}` }).getAttribute("href")).toBe(`/tools/${paired.slug}`);
    await user.tab();
    expect(document.activeElement).toBe(paired ? screen.getByRole("link", { name: `Switch to ${paired.name}` }) : fields[0]);
    await user.click(screen.getByRole("button", { name: "Load example" }));
    const expected = await runDataTool(tool.slug, { ...tool.dataContract.examples[0].inputs });
    screen.getByRole("button", { name: tool.dataContract.action }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("button", { name: "Copy" });
    expect(screen.queryByRole("alert")).toBeNull();
    if (tool.dataContract.output.kind !== "tree") expect(screen.getByLabelText(tool.dataContract.output.label, { selector: "pre" }).textContent).toBe(expected.text);
    screen.getByRole("button", { name: "Copy" }).focus();
    await user.keyboard("{Enter}");
    expect(clipboard).toHaveBeenCalledWith(expected.text);
    if (tool.dataContract.output.extension) {
      screen.getByRole("button", { name: `Download .${tool.dataContract.output.extension}` }).focus();
      await user.keyboard("{Enter}");
      expect(downloads).toEqual([`${tool.slug}.${tool.dataContract.output.extension}`]);
    } else expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    screen.getByRole("button", { name: "Clear" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    for (const field of fields) expect(field.value).toBe(tool.dataContract.fields.find(item => item.name === field.name)?.defaultValue ?? "");
    expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("error, safety, hydration and actions", () => {
  it.each(jsonDataTools)("$slug hydrates real server markup without generated-ID drift", async (tool) => {
    const ui = <JsonDataStation toolId={tool.id} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui, { identifierPrefix: "server-" });
    document.body.append(container);
    const nodes = Array.from(container.querySelectorAll("[id]"));
    const error = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const root = hydrateRoot(container, ui, { identifierPrefix: "client-", onRecoverableError: recoverable });
    await act(async () => {});
    expect(Array.from(container.querySelectorAll("[id]"))).toEqual(nodes);
    expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length);
    expect(error).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
  it.each(jsonDataTools.filter(tool => tool.slug !== "json-escape"))("$slug associates empty-input errors with controls", async (tool) => {
    render(<JsonDataStation toolId={tool.id} />);
    fireEvent.submit(screen.getByRole("button", { name: tool.dataContract.action }).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Invalid/);
    const input = screen.getByLabelText(tool.dataContract.fields[0].label);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });
  it("renders tree values inertly and expands/collapses branches", async () => {
    const { container } = render(<JsonDataStation toolId="json-tree-viewer" />);
    fireEvent.change(screen.getByLabelText("JSON input"), { target: { value: '{"child":{"html":"<script>alert(1)</script>"}}' } });
    fireEvent.click(screen.getByRole("button", { name: "View tree" }));
    await screen.findByRole("button", { name: "Copy" });
    const child = Array.from(container.querySelectorAll("details")).find(node => node.querySelector("summary")?.textContent?.includes('"child"'))!;
    expect(child.open).toBe(false);
    fireEvent.click(child.querySelector("summary")!);
    await waitFor(() => expect(child.open).toBe(true));
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
  it("invalidates old output on edit and resets when direction route changes", async () => {
    const { rerender } = render(<JsonDataStation toolId="json-to-yaml" />);
    fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    fireEvent.click(screen.getByRole("button", { name: "Convert to YAML" }));
    await screen.findByRole("button", { name: "Copy" });
    fireEvent.change(screen.getByLabelText("JSON input"), { target: { value: "{" } });
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    rerender(<JsonDataStation toolId="yaml-to-json" />);
    expect((screen.getByLabelText("YAML input") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Convert to JSON" })).toBeTruthy();
    expect(screen.queryByLabelText("JSON input")).toBeNull();
  });
  it("downloads the destination extension and handles clipboard failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Blocked"));
    const create = vi.fn(() => "blob:local-output"); vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
    render(<JsonDataStation toolId="json-to-yaml" />);
    await user.click(screen.getByRole("button", { name: "Load example" }));
    await user.click(screen.getByRole("button", { name: "Convert to YAML" }));
    await user.click(await screen.findByRole("button", { name: "Download .yaml" }));
    expect(downloads).toEqual(["json-to-yaml.yaml"]);
    expect(create).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not copy");
  });
});
