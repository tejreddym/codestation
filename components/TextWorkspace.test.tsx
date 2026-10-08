// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { textTools } from "@/config/text-tools";
import { runText } from "@/lib/tools/text/engine";
import type { TextValues } from "@/lib/tools/text/types";
import TextWorkspace from "./TextWorkspace";

// Real engine over a synthetic transport: not evidence of browser worker behavior.
class LocalWorker {
  static hold = false;
  static last: LocalWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { LocalWorker.last = this; }
  postMessage({ slug, values }: { slug: string; values: TextValues }) {
    if (LocalWorker.hold) return;
    void runText(slug, values).then(result => this.onmessage?.({ data: { result } }), cause => this.onmessage?.({ data: { error: (cause as Error).message } }));
  }
}
beforeEach(() => { LocalWorker.hold = false; vi.stubGlobal("Worker", LocalWorker); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe.each(["light", "dark"])("Text %s DOM theme (not visual proof)", theme => {
  it.each(textTools)("$slug exact fields, keyboard actions, exact visible Copy, full Clear and privacy", async tool => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const xhr = vi.spyOn(XMLHttpRequest.prototype, "send");
    const storage = vi.spyOn(Storage.prototype, "setItem"); const log = vi.spyOn(console, "log"); const errors = vi.spyOn(console, "error");
    const { container } = render(<TextWorkspace toolId={tool.id} />);
    for (const field of tool.textContract.fields) expect(field.control === "checkbox-group" ? screen.getByRole("group", { name: field.label }) : screen.getByLabelText(field.label)).toBeTruthy();
    const names = [...new Set(Array.from(container.querySelectorAll<HTMLInputElement>("form input,form textarea,form select"), node => node.name))];
    expect(names).toEqual(tool.textContract.fields.map(field => field.name));
    if (["lorem-ipsum-generator", "random-text-generator"].includes(tool.id)) expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull(); expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Use output as input" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Load example" }));
    screen.getByRole("button", { name: tool.textContract.action }).focus(); await user.keyboard("{Enter}");
    const copies = await screen.findAllByRole("button", { name: /^Copy / });
    for (const button of copies) {
      const label = button.getAttribute("aria-label")!.slice(5); const visible = screen.getByLabelText(`${label} value`);
      button.focus(); await user.keyboard("{Enter}"); expect(copy).toHaveBeenLastCalledWith(visible.textContent);
    }
    expect(screen.queryByRole("alert")).toBeNull(); screen.getByRole("button", { name: "Clear" }).focus(); await user.keyboard("{Enter}");
    for (const field of tool.textContract.fields) {
      if (field.control === "checkbox-group") expect(screen.getAllByRole("checkbox").every(node => !(node as HTMLInputElement).checked)).toBe(true);
      else if (field.control === "checkbox") expect((screen.getByLabelText(field.label) as HTMLInputElement).checked).toBe(tool.textContract.defaults[field.name]);
      else expect((screen.getByLabelText(field.label) as HTMLInputElement).value).toBe(tool.textContract.defaults[field.name]);
    }
    expect(container.querySelector("pre")).toBeNull(); expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
  });
});

describe("Text failure and result states", () => {
  it.each(textTools)("$slug rejects oversized input/invalid amount with associated errors", async tool => {
    render(<TextWorkspace toolId={tool.id} />);
    const input = tool.textContract.fields.find(field => field.control === "textarea");
    if (input) set(input.label, "x".repeat(1_000_001)); else set(tool.id === "lorem-ipsum-generator" ? "Amount" : "Length", "0");
    fireEvent.click(screen.getByRole("button", { name: tool.textContract.action })); const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBeTruthy();
    for (const field of tool.textContract.fields.filter(field => field.control !== "checkbox-group")) expect(screen.getByLabelText(field.label).getAttribute("aria-describedby")).toContain(alert.id);
    expect(screen.queryByRole("button", { name: /^Copy / })).toBeNull();
  });
  it.each(textTools.filter(tool => !["lorem-ipsum-generator", "random-text-generator", "find-replace"].includes(tool.id)))("$slug permits empty text and copies empty results where applicable", async tool => {
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(); render(<TextWorkspace toolId={tool.id} />);
    await user.click(screen.getByRole("button", { name: tool.textContract.action })); const buttons = await screen.findAllByRole("button", { name: /^Copy / });
    expect(screen.queryByRole("alert")).toBeNull(); for (const button of buttons) { const label = button.getAttribute("aria-label")!.slice(5); await user.click(button); expect(copy).toHaveBeenLastCalledWith(screen.getByLabelText(`${label} value`).textContent); }
  });
  it("public Regex Line Extractor has Text contract, not legacy Regex Station", async () => {
    const user = userEvent.setup(); render(<TextWorkspace toolId="regex-line-extractor" />);
    expect(screen.queryByLabelText("Test text")).toBeNull(); expect(screen.getByLabelText("Text")).toBeTruthy();
    for (const box of screen.getAllByRole("checkbox")) { box.focus(); await user.keyboard(" "); expect((box as HTMLInputElement).checked).toBe(true); }
    set("Regex pattern", "["); set("Text", "PRIVATE-TEXT"); await user.click(screen.getByRole("button", { name: "Extract matching lines" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/invalid/); expect(screen.getByRole("alert").textContent).not.toContain("PRIVATE");
    expect((screen.getByLabelText("Text") as HTMLInputElement).value).toBe("PRIVATE-TEXT");
  });
  it.each(["tabs-to-spaces", "spaces-to-tabs", "lf-to-crlf", "crlf-to-lf"] as const)("%s uses real paired routes and clears state on reversal", async id => {
    const tool = textTools.find(tool => tool.id === id)!; const paired = textTools.find(candidate => candidate.id === tool.pairedTool)!;
    const { rerender, container } = render(<TextWorkspace toolId={tool.id} />);
    expect(screen.getByRole("link", { name: `Switch to ${paired.name} →` }).getAttribute("href")).toBe(`/tools/${paired.slug}`);
    fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: tool.textContract.action })); await screen.findByRole("button", { name: /^Copy / });
    rerender(<TextWorkspace toolId={paired.id} />); expect(container.querySelector("pre")).toBeNull(); expect((screen.getByLabelText("Text") as HTMLInputElement).value).toBe(""); expect(screen.getByRole("button", { name: paired.textContract.action })).toBeTruthy();
  });
  it("shows labeled diff rows and all pages without HTML interpretation", async () => {
    const { container } = render(<TextWorkspace toolId="text-diff" />);
    set("Text A", "<img src=x>\n" + Array.from({ length: 120 }, (_, i) => `line${i}\n`).join("")); set("Text B", "<script>bad()</script>\n");
    fireEvent.click(screen.getByRole("button", { name: "Compare text" })); await screen.findByText(/Showing 1–50/);
    expect(container.querySelector("script,img")).toBeNull(); expect(screen.getByText("− Removed · row 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); expect(screen.getByText(/Showing 51–100/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); expect(screen.getByText(/Showing 101–122/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps CRLF in exact clipboard output", async () => {
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(); render(<TextWorkspace toolId="lf-to-crlf" />);
    set("Text", "a\nb\n"); await user.click(screen.getByRole("button", { name: "Convert to CRLF" })); await user.click(await screen.findByRole("button", { name: "Copy Text with CRLF line endings" })); expect(copy).toHaveBeenCalledWith("a\r\nb\r\n");
  });
  it("literal Find & Replace exposes no regex toggle and no accidental dollar syntax", async () => {
    render(<TextWorkspace toolId="find-replace" />); expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    set("Text", "a.a"); set("Find text", "."); set("Replace text", "$&"); fireEvent.click(screen.getByRole("button", { name: "Replace text" })); expect((await screen.findByLabelText("Updated text value")).textContent).toBe("a$&a");
  });
  it("Clear terminates pending work and late replies do not reappear", async () => {
    LocalWorker.hold = true; render(<TextWorkspace toolId="regex-line-extractor" />); set("Text", "a"); set("Regex pattern", "a");
    fireEvent.click(screen.getByRole("button", { name: "Extract matching lines" })); await waitFor(() => expect(LocalWorker.last).toBeTruthy()); await act(async () => {});
    const worker = LocalWorker.last; fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(worker.terminate).toHaveBeenCalled();
    await act(async () => worker.onmessage?.({ data: { result: { rows: [{ label: "Matching lines", value: "late" }] } } })); expect(screen.queryByText("late")).toBeNull();
  });
  it("shows clipboard denial without discarding results", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied")); render(<TextWorkspace toolId="reverse-text" />);
    set("Text", "abc"); await user.click(screen.getByRole("button", { name: "Reverse text" })); await user.click(await screen.findByRole("button", { name: "Copy Reversed text" })); expect(screen.getByRole("status").textContent).toContain("Could not copy"); expect(screen.getByLabelText("Reversed text value").textContent).toBe("cba");
  });
});

describe("Text SSR hydration", () => {
  it.each(textTools)("$slug retains stable IDs, server nodes and empty outputs", async tool => {
    const container = document.createElement("div"); const ui = <TextWorkspace toolId={tool.id} />;
    container.innerHTML = renderToString(ui, { identifierPrefix: "server-" }); document.body.append(container);
    const nodes = Array.from(container.querySelectorAll("[id]")); const errors = vi.spyOn(console, "error"); const recoverable = vi.fn();
    const root = hydrateRoot(container, ui, { identifierPrefix: "client-", onRecoverableError: recoverable }); await act(async () => {});
    expect(Array.from(container.querySelectorAll("[id]"))).toEqual(nodes); expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length); expect(container.querySelector("pre")).toBeNull();
    expect(errors).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled(); await act(async () => root.unmount()); container.remove();
  });
});
