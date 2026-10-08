// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { securityTools } from "@/config/security-tools";
import SecurityStation from "./SecurityStation";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });

function publicFile() {
  const file = new File(["public fixture"], "public-test.txt", { type: "text/plain" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("public fixture").buffer });
  return file;
}

describe.each(["dark", "light"])("Security %s DOM theme (not visual proof)", theme => {
  it.each(securityTools)("$slug has only contracted controls, keyboard actions, exact copies and no transmission", async tool => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const fetch = vi.fn(() => { throw new Error("No input requests allowed"); }); vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => { throw new Error("No input requests allowed"); });
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const log = vi.spyOn(console, "log"); const errors = vi.spyOn(console, "error");
    const { container } = render(<SecurityStation toolId={tool.id} />);
    const fields = Array.from(container.querySelectorAll<HTMLInputElement>("form input,form textarea,form select"));
    expect(fields.map(field => field.name)).toEqual(tool.securityContract.fields.map(field => field.name));
    for (const field of fields) expect(container.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    expect(container.querySelectorAll('input[type="file"]').length).toBe(tool.slug === "file-hash-generator" ? 1 : 0);
    if (tool.slug === "ulid-generator") expect(fields).toHaveLength(0);
    await user.tab();
    expect(document.activeElement).toBe(fields[0] ?? screen.getByRole("button", { name: tool.securityContract.action }));
    if (tool.securityContract.example) await user.click(screen.getByRole("button", { name: "Load example" }));
    if (tool.slug === "file-hash-generator") await user.upload(screen.getByLabelText("File"), publicFile());
    screen.getByRole("button", { name: tool.securityContract.action }).focus(); await user.keyboard("{Enter}");
    await screen.findAllByRole("button", { name: /^Copy/ });
    const outputs = Array.from(container.querySelectorAll("pre"));
    expect(outputs.length).toBe(tool.securityContract.outputs.length);
    const copies = screen.getAllByRole("button", { name: /^Copy/ });
    for (let index = 0; index < copies.length; index++) {
      copies[index].focus(); await user.keyboard("{Enter}");
      expect(clipboard).toHaveBeenLastCalledWith(outputs[index].textContent);
    }
    if (tool.slug === "file-hash-generator") expect((screen.getByLabelText("File") as HTMLInputElement).files?.length).toBe(0);
    expect(screen.queryByRole("alert")).toBeNull(); expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    screen.getByRole("button", { name: "Clear" }).focus(); await user.keyboard("{Enter}");
    for (const field of fields) {
      if (field.type === "checkbox") expect(field.checked).toBe(tool.securityContract.defaults[field.name]);
      else expect(field.value).toBe(tool.securityContract.defaults[field.name] ?? "");
    }
    expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
    expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
  });
});

describe("Security SSR and user-visible safeguards", () => {
  it.each(securityTools)("$slug exposes an accessible error for invalid input or unavailable crypto", async tool => {
    const { container } = render(<SecurityStation toolId={tool.id} />);
    const set = (name: string, value: string) => fireEvent.change(container.querySelector(`[name="${name}"]`)!, { target: { value } });
    if (tool.securityContract.example) fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    switch (tool.slug) {
      case "uuid-generator": case "ulid-generator": case "secret-key-generator": vi.stubGlobal("crypto", undefined); break;
      case "uuid-parser": set("input", "not-a-uuid"); break;
      case "password-generator": set("length", "3"); break;
      case "hmac-generator": set("secret", ""); break;
      case "hash-compare": set("hashA", ""); break;
      case "file-hash-generator": break;
      case "entropy-calculator": case "password-strength-checker": set("input", "x".repeat(1_000_001)); break;
      case "nanoid-generator": set("length", "3"); break;
      case "random-number-generator": set("count", "0"); break;
      case "random-string-generator": set("length", "0"); break;
      case "secure-token-generator": set("bytes", "7"); break;
      case "hex-random-generator": set("bytes", "0"); break;
      default: set("input", "\uD800");
    }
    fireEvent.submit(screen.getByRole("button", { name: tool.securityContract.action }).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent?.length).toBeGreaterThan(0);
    for (const field of container.querySelectorAll("form input,form textarea,form select")) {
      expect(field.getAttribute("aria-invalid")).toBe("true"); expect(field.getAttribute("aria-describedby")).toContain(alert.id);
    }
    expect(container.querySelector("pre")).toBeNull();
  });
  it.each(securityTools)("$slug hydrates without random/time output or ID mismatch", async tool => {
    const random = vi.spyOn(webcrypto, "getRandomValues");
    const ui = <SecurityStation toolId={tool.id} />;
    const container = document.createElement("div"); container.innerHTML = renderToString(ui, { identifierPrefix: "server-" }); document.body.append(container);
    const nodes = Array.from(container.querySelectorAll("[id]"));
    const errors = vi.spyOn(console, "error"); const recoverable = vi.fn();
    const root = hydrateRoot(container, ui, { identifierPrefix: "client-", onRecoverableError: recoverable });
    await act(async () => {});
    expect(Array.from(container.querySelectorAll("[id]"))).toEqual(nodes);
    expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length);
    expect(container.querySelector("pre")).toBeNull(); expect(random).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
  it("shows specific errors with associated input fields, not secret content", async () => {
    render(<SecurityStation toolId="hmac-generator" />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "PRIVATE-TEST-MARKER" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate HMAC" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/empty/); expect(alert.textContent).not.toContain("PRIVATE-TEST-MARKER");
    expect(screen.getByLabelText("Secret key").getAttribute("aria-describedby")).toContain(alert.id);
    expect(screen.getByLabelText("Secret key").getAttribute("aria-invalid")).toBe("true");
  });
  it("updates checksum warnings and invalidates stale algorithm results", async () => {
    render(<SecurityStation toolId="checksum-generator" />);
    fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate checksum" }));
    await screen.findByRole("button", { name: "Copy" });
    fireEvent.change(screen.getByLabelText("Algorithm"), { target: { value: "CRC32" } });
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(screen.getByText(/CRC32 is a non-cryptographic/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Algorithm"), { target: { value: "SHA-1" } });
    expect(screen.getByText(/legacy algorithms/)).toBeTruthy();
    expect(screen.queryByText(/CRC32 is a non-cryptographic/)).toBeNull();
  });
  it("releases a selected file even after read failure and requires reselecting", async () => {
    const user = userEvent.setup(); render(<SecurityStation toolId="file-hash-generator" />);
    const file = new File(["x"], "PRIVATE-NAME-MARKER.txt");
    Object.defineProperty(file, "arrayBuffer", { value: async () => { throw new Error("PRIVATE-NAME-MARKER read failed"); } });
    await user.upload(screen.getByLabelText("File"), file);
    await user.click(screen.getByRole("button", { name: "Hash file" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Unable to read"); expect(alert.textContent).not.toContain("PRIVATE-NAME-MARKER");
    expect((screen.getByLabelText("File") as HTMLInputElement).files?.length).toBe(0);
    await user.click(screen.getByRole("button", { name: "Hash file" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Select a file"));
  });
  it("clear prevents a late file-hash result from reappearing", async () => {
    const user = userEvent.setup(); render(<SecurityStation toolId="file-hash-generator" />);
    let release!: (buffer: ArrayBuffer) => void;
    const file = new File(["x"], "public-test.txt");
    Object.defineProperty(file, "arrayBuffer", { value: () => new Promise<ArrayBuffer>(resolve => { release = resolve; }) });
    await user.upload(screen.getByLabelText("File"), file); await user.click(screen.getByRole("button", { name: "Hash file" }));
    await waitFor(() => expect(typeof release).toBe("function"));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => { release(new Uint8Array([120]).buffer); await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull(); expect((screen.getByLabelText("File") as HTMLInputElement).files?.length).toBe(0);
  });
  it("reports clipboard denial without changing the result", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
    render(<SecurityStation toolId="sha-256-generator" />);
    await user.click(screen.getByRole("button", { name: "Generate SHA-256" }));
    const copy = await screen.findByRole("button", { name: "Copy" });
    const before = screen.getByLabelText("SHA-256 hash", { selector: "pre" }).textContent;
    await user.click(copy); expect((await screen.findByRole("alert")).textContent).toContain("Could not copy");
    expect(screen.getByLabelText("SHA-256 hash", { selector: "pre" }).textContent).toBe(before);
  });
});
