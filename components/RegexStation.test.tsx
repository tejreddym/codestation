// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { regexTools } from "@/config/regex-tools";
import { runRegex } from "@/lib/tools/regex/engine";
import type { RegexValues } from "@/lib/tools/regex/types";
import RegexStation from "./RegexWorkspace";

// Runs the real engine behind a fake transport: NOT a real browser-worker test.
class LocalTestWorker {
  static pending = false;
  static last: LocalTestWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { LocalTestWorker.last = this; }
  postMessage({ slug, values }: { slug: string; values: RegexValues }) {
    if (LocalTestWorker.pending) return;
    queueMicrotask(() => {
      try { this.onmessage?.({ data: { result: runRegex(slug, values) } }); }
      catch (cause) { this.onmessage?.({ data: { error: (cause as Error).message } }); }
    });
  }
}
beforeEach(() => { LocalTestWorker.pending = false; vi.stubGlobal("Worker", LocalTestWorker); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe.each(["dark", "light"])("Regex %s DOM theme, not visual proof", theme => {
  it.each(regexTools)("$slug has exact controls, keyboard processing, exact Copy and complete Clear", async tool => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup(); const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const xhr = vi.spyOn(XMLHttpRequest.prototype, "send");
    const storage = vi.spyOn(Storage.prototype, "setItem"); const log = vi.spyOn(console, "log"); const errors = vi.spyOn(console, "error");
    const { container } = render(<RegexStation toolId={tool.id} />);
    const fields = tool.regexContract.fields;
    expect(container.querySelectorAll("form textarea,form select,form fieldset").length).toBe(fields.length);
    for (const field of fields) expect(field.control === "checkbox-group" ? screen.getByRole("group", { name: field.label }) : screen.getByLabelText(field.label)).toBeTruthy();
    const flagField = fields.find(field => field.name === "flags");
    expect(screen.queryAllByRole("checkbox").length).toBe(flagField ? 7 : 0);
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    await user.tab(); expect(document.activeElement).toBe(screen.getByLabelText(fields[0].label));
    await user.click(screen.getByRole("button", { name: "Load example" }));
    screen.getByRole("button", { name: tool.regexContract.action }).focus(); await user.keyboard("{Enter}");
    await screen.findAllByRole("button", { name: /^Copy / });
    const before = Array.from(container.querySelectorAll<HTMLTextAreaElement>("textarea")).map(node => node.value);
    const outputs = Array.from(container.querySelectorAll("pre"));
    const copies = screen.getAllByRole("button", { name: /^Copy / }); expect(copies.length).toBe(outputs.length);
    for (let index = 0; index < copies.length; index++) {
      copies[index].focus(); await user.keyboard("{Enter}"); expect(clipboard).toHaveBeenLastCalledWith(outputs[index].textContent);
    }
    expect(Array.from(container.querySelectorAll<HTMLTextAreaElement>("textarea")).map(node => node.value)).toEqual(before);
    screen.getByRole("button", { name: "Clear" }).focus(); await user.keyboard("{Enter}");
    for (const field of fields) {
      if (field.control === "checkbox-group") expect(screen.getAllByRole("checkbox").every(node => !(node as HTMLInputElement).checked)).toBe(true);
      else expect((screen.getByLabelText(field.label) as HTMLInputElement).value).toBe(tool.regexContract.defaults[field.name]);
    }
    expect(container.querySelector("pre")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
    expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
  });
});

describe("Regex errors, structured output and reset", () => {
  it.each(regexTools)("$slug handles invalid or oversized input without losing it", async tool => {
    render(<RegexStation toolId={tool.id} />);
    const literal = tool.id === "regex-escape" || tool.id === "regex-pattern-builder";
    const field = literal ? tool.regexContract.fields[0].label : "Regex Pattern";
    const value = literal ? "x".repeat(200_001) : "PRIVATE-MARKER["; set(field, value);
    fireEvent.click(screen.getByRole("button", { name: tool.regexContract.action }));
    if (tool.id === "regex-flag-tester") {
      await screen.findByLabelText("No flags · Validity value"); expect(screen.getAllByText("Invalid")).toHaveLength(8);
    } else {
      const alert = await screen.findByRole("alert"); expect(alert.textContent).not.toContain("PRIVATE-MARKER");
      expect(screen.getByLabelText(field).getAttribute("aria-describedby")).toContain(alert.id);
      expect(screen.getByLabelText(field).getAttribute("aria-invalid")).toBe("true");
    }
    expect((screen.getByLabelText(field) as HTMLInputElement).value).toBe(value);
  });
  it("toggles every flag by keyboard, then Clear resets them", async () => {
    const user = userEvent.setup(); render(<RegexStation toolId="regex-tester" />);
    for (const checkbox of screen.getAllByRole("checkbox")) { checkbox.focus(); await user.keyboard(" "); expect((checkbox as HTMLInputElement).checked).toBe(true); }
    await user.click(screen.getByRole("button", { name: "Clear" })); expect(screen.getAllByRole("checkbox").every(node => !(node as HTMLInputElement).checked)).toBe(true);
  });
  it("shows definitions, full matches and nullable capture values as separate text", async () => {
    render(<RegexStation toolId="regex-capture-group-tester" />);
    set("Regex Pattern", "(?<name>a)(b)?(?:c)"); set("Test text", "ac"); fireEvent.click(screen.getByRole("checkbox", { name: /d · Match indices/ }));
    fireEvent.click(screen.getByRole("button", { name: "Test capture groups" }));
    await screen.findByLabelText("Match 1 · Full match value");
    expect(screen.getByLabelText("Match 1 · Full match value").textContent).toBe("ac");
    expect(screen.getByLabelText("Match 1 · Group 1 (name) value").textContent).toBe("a");
    expect(screen.getByLabelText("Match 1 · Group 2 value").textContent).toBe("null");
    expect(screen.getByLabelText("Non-capturing groups 1 value").textContent).toBe("(?:c)");
    expect(screen.getByText("Capture indices (d): unmatched")).toBeTruthy();
  });
  it("renders HTML-looking matches only as text", async () => {
    const { container } = render(<RegexStation toolId="regex-match-inspector" />);
    set("Regex Pattern", ".+"); set("Test text", '<img src=x onerror="alert(1)"><script>bad()</script>');
    fireEvent.click(screen.getByRole("button", { name: "Inspect matches" })); await screen.findByLabelText("Match 1 · Full match value");
    expect(container.querySelectorAll("img,script")).toHaveLength(0);
  });
  it("shows all parts through accessible pagination without silently losing results", async () => {
    render(<RegexStation toolId="regex-split-tester" />); set("Regex Pattern", ","); set("Test text", Array.from({ length: 121 }, (_, i) => String(i)).join(","));
    fireEvent.click(screen.getByRole("button", { name: "Split text" })); await screen.findByText("121 parts total · Showing 1–50");
    expect(screen.queryByLabelText("Part 51 value")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Next parts" }));
    expect(screen.getByLabelText("Part 51 value").textContent).toBe("50"); fireEvent.click(screen.getByRole("button", { name: "Next parts" }));
    expect(screen.getByLabelText("Part 121 value").textContent).toBe("120"); expect((screen.getByRole("button", { name: "Next parts" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("builder sensitivity changes guidance, not pattern or added inputs", async () => {
    render(<RegexStation toolId="regex-pattern-builder" />); set("Literal text", "ab"); set("Quantifier", "One or more"); set("Case sensitivity", "Case insensitive");
    expect(screen.getByText("Use the i flag with this generated pattern for case-insensitive matching.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Build pattern" })); expect((await screen.findByLabelText("Generated pattern value")).textContent).toBe("(?:ab)+");
    expect(screen.queryByRole("group", { name: "Flags" })).toBeNull();
  });
  it("copies empty text exactly and explains clipboard denial", async () => {
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(); render(<RegexStation toolId="regex-escape" />);
    await user.click(screen.getByRole("button", { name: "Escape text" })); await user.click(await screen.findByRole("button", { name: "Copy Escaped text" })); expect(copy).toHaveBeenCalledWith("");
    copy.mockRejectedValue(new Error("denied")); await user.click(screen.getByRole("button", { name: "Copy Escaped text" }));
    await screen.findByText(/Could not copy/);
  });
  it("editing and Clear abort pending workers and suppress late results", async () => {
    LocalTestWorker.pending = true; render(<RegexStation toolId="regex-tester" />);
    fireEvent.click(screen.getByRole("button", { name: "Test regex" })); await waitFor(() => expect(screen.getByText("Running…")).toBeTruthy());
    await act(async () => {}); const worker = LocalTestWorker.last;
    fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(worker.terminate).toHaveBeenCalled();
    await act(async () => { worker.onmessage?.({ data: { result: { kind: "test", count: 999, matches: [] } } }); });
    expect(screen.queryByLabelText("Match count value")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Regex hydration", () => {
  it.each(regexTools)("$slug retains IDs and server nodes without processing user data", async tool => {
    const container = document.createElement("div"); const ui = <RegexStation toolId={tool.id} />;
    container.innerHTML = renderToString(ui, { identifierPrefix: "server" }); document.body.append(container);
    const nodes = Array.from(container.querySelectorAll("[id]")); const errors = vi.spyOn(console, "error"); const recoverable = vi.fn();
    const root = hydrateRoot(container, ui, { identifierPrefix: "client", onRecoverableError: recoverable });
    await act(async () => {}); expect(Array.from(container.querySelectorAll("[id]"))).toEqual(nodes); expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length);
    expect(container.querySelector("pre")).toBeNull(); expect(errors).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
});
