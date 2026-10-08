// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webTools } from "@/config/web-tools";
import * as inspect from "@/lib/tools/web/inspect";
import { generateWeb } from "@/lib/tools/web/generate";
import * as faviconEngine from "@/lib/tools/web/favicon";
import type { WebResult, WebValues } from "@/lib/tools/web/types";
import WebStation from "./WebStation";

const generators = new Set(["meta-tag-generator", "open-graph-generator", "open-graph-preview", "twitter-card-generator", "canonical-url-generator", "robots-txt-generator", "sitemap-generator", "web-app-manifest-generator"]);
const raster = () => new File([new Uint8Array([137, 80, 78, 71])], "local.png", { type: "image/png" });
const favicon = () => ({ blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), width: 32, height: 32 });
const run = (id: string, values: WebValues) => generators.has(id) ? generateWeb(id, values) : inspect.inspectWeb(id, values);
const labeled = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: \\(optional\\))?$`));
const set = (label: string, value: string) => fireEvent.change(labeled(label), { target: { value } });
const urlSource = () => screen.getByLabelText(webTools.find(tool => tool.id === "url-parser")!.webContract.fields.find(field => field.name === "url")!.label);
const setUrl = (value: string) => fireEvent.change(urlSource(), { target: { value } });
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsText(blob); });
}

beforeEach(() => {
  let sequence = 0;
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => `blob:local-${++sequence}`) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
  vi.spyOn(faviconEngine, "generateFavicon").mockResolvedValue(favicon());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });

describe.each(["light", "dark"])("Web %s theme DOM (not visual acceptance)", theme => {
  it.each(webTools)("$id exact controls, keyboard submit/Copy/Clear and browser-local processing", async tool => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send"); const storage = vi.spyOn(Storage.prototype, "setItem"); const log = vi.spyOn(console, "log");
    const { container } = render(<WebStation toolId={tool.id} />);
    const contract = tool.webContract;
    expect(contract.copy).toBe(!["http-status-code-lookup", "mime-type-lookup", "user-agent-parser", "open-graph-preview", "favicon-generator"].includes(tool.id));
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("form input,form textarea,form select"), node => node.name)).toEqual(contract.fields.filter(field => !["parameters", "groups", "sitemaps", "entries", "icons"].includes(field.control)).map(field => field.name));
    for (const field of contract.fields) {
      if (["parameters", "groups", "sitemaps", "entries", "icons"].includes(field.control)) expect(screen.getByRole("group", { name: field.label })).toBeTruthy();
      else {
        const control = labeled(field.label);
        if (field.control === "password" || tool.id === "url-parser") expect(control.getAttribute("type")).toBe("password");
        expect(control.getAttribute("id")).toBe(`web-${tool.id}-${field.name}`);
      }
    }
    const load = screen.getByRole("button", { name: "Load example" }); load.focus(); await user.keyboard("{Enter}");
    if (tool.id === "favicon-generator") await user.upload(screen.getByLabelText(contract.fields.find(field => field.control === "file")!.label), raster());
    const action = screen.getByRole("button", { name: contract.action }); action.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready."));
    if (contract.copy) {
      const next = await run(tool.id, { ...contract.defaults, ...contract.example });
      const button = screen.getByRole("button", { name: `Copy ${contract.outputs.join(" · ")}` }); button.focus(); await user.keyboard("{Enter}");
      expect(copy).toHaveBeenLastCalledWith(next.copyText ?? next.text);
    } else expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Download/ })).toHaveLength(contract.downloadExtension ? 1 : 0);
    const clear = screen.getByRole("button", { name: "Clear" }); clear.focus(); await user.keyboard("{Enter}");
    for (const field of contract.fields) {
      if (["parameters", "groups", "sitemaps", "entries", "icons"].includes(field.control)) expect(within(screen.getByRole("group", { name: field.label })).queryAllByRole("textbox")).toHaveLength(0);
      else expect((labeled(field.label) as HTMLInputElement).value).toBe(field.control === "file" ? "" : contract.defaults[field.name] ?? "");
    }
    expect(container.querySelector("pre,img,article")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull(); expect(screen.getByRole("status").textContent).toBe("");
    expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
});

describe("Web exact structured editors", () => {
  it.each([
    ["query-string-generator", "Parameters", "parameter", ["Parameter 1 key", "Parameter 1 value"]],
    ["robots-txt-generator", "Groups", "group", ["Group 1 user agent"]],
    ["robots-txt-generator", "Sitemaps", "sitemap", ["Sitemap 1 URL"]],
    ["sitemap-generator", "Entries", "entry", ["Entry 1 URL", "Entry 1 last modified", "Entry 1 change frequency", "Entry 1 priority"]],
    ["web-app-manifest-generator", "Icons", "icon", ["Icon 1 source", "Icon 1 sizes", "Icon 1 type", "Icon 1 purpose"]],
  ] as const)("%s %s supports keyboard add/remove and exact child labels", async (id, label, noun, fields) => {
    const user = userEvent.setup(); render(<WebStation toolId={id} />);
    // Contract wording is authoritative; only nested labels are defined by this editor.
    const definition = webTools.find(tool => tool.id === id)!;
    const field = definition.webContract.fields.find(item => item.control === (noun === "entry" ? "entries" : `${noun}s`))!;
    const group = screen.getByRole("group", { name: field.label });
    const add = within(group).getByRole("button", { name: `Add ${noun}` }); add.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(fields[0])));
    for (const fieldLabel of fields) expect(screen.getByLabelText(fieldLabel)).toBeTruthy();
    expect(within(group).queryAllByRole("textbox").length + within(group).queryAllByRole("combobox").length).toBe(fields.length);
    const remove = screen.getByRole("button", { name: `Remove ${noun} 1` }); remove.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(add));
    for (const fieldLabel of fields) expect(screen.queryByLabelText(fieldLabel)).toBeNull();
  });
  it("preserves ordered repeated parameter keys and empty values", async () => {
    const user = userEvent.setup(); render(<WebStation toolId="query-string-generator" />);
    for (let index = 1; index <= 3; index++) {
      await user.click(screen.getByRole("button", { name: "Add parameter" })); set(`Parameter ${index} key`, "same"); set(`Parameter ${index} value`, index === 2 ? "" : `value ${index}`);
    }
    const tool = webTools.find(tool => tool.id === "query-string-generator")!; await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    expect((await screen.findByLabelText(`${tool.webContract.outputs.join(" · ")} value`)).textContent).toContain("?same=value+1&same=&same=value+3");
  });
  it("supports nested keyboard allow/disallow paths and removes all references on Clear", async () => {
    const user = userEvent.setup(); render(<WebStation toolId="robots-txt-generator" />);
    await user.click(screen.getByRole("button", { name: "Add group" })); set("Group 1 user agent", "*");
    for (const directive of ["allow", "disallow"]) {
      const add = screen.getByRole("button", { name: `Add group 1 ${directive} path` }); add.focus(); await user.keyboard("{Enter}");
      const input = screen.getByLabelText(`Group 1 ${directive} path 1`); await waitFor(() => expect(document.activeElement).toBe(input));
      fireEvent.change(input, { target: { value: directive === "allow" ? "/public" : "/private" } });
    }
    const tool = webTools.find(tool => tool.id === "robots-txt-generator")!; await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    const output = await screen.findByLabelText(`${tool.webContract.outputs.join(" · ")} value`); expect(output.textContent).toContain("Allow: /public"); expect(output.textContent).toContain("Disallow: /private");
    const remove = screen.getByRole("button", { name: "Remove group 1 allow path 1" }); remove.focus(); await user.keyboard("{Enter}"); expect(screen.queryByLabelText("Group 1 allow path 1")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear" })); expect(screen.queryByLabelText("Group 1 user agent")).toBeNull(); expect(screen.queryByLabelText("Group 1 disallow path 1")).toBeNull();
  });
});

describe("Web errors, privacy and output", () => {
  it.each(webTools)("$id puts every initial contracted control/action in keyboard tab order", async tool => {
    const user = userEvent.setup(); const { container } = render(<WebStation toolId={tool.id} />);
    const controls = Array.from(container.querySelectorAll<HTMLElement>("form button,form input,form textarea,form select"));
    for (const control of controls) { await user.tab(); expect(document.activeElement).toBe(control); }
  });
  it("copies an intentionally empty generated robots file as exactly zero characters", async () => {
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(); render(<WebStation toolId="robots-txt-generator" />);
    const tool = webTools.find(tool => tool.id === "robots-txt-generator")!; await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    const output = await screen.findByLabelText(`${tool.webContract.outputs.join(" · ")} value`); expect(output.textContent).toBe("");
    await user.click(screen.getByRole("button", { name: `Copy ${tool.webContract.outputs.join(" · ")}` })); expect(copy).toHaveBeenCalledWith("");
    expect(screen.getByRole("alert").textContent).toContain("not an access-control");
  });
  it("clipboard failure preserves the selectable local result", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied")); render(<WebStation toolId="query-string-generator" />);
    const tool = webTools.find(tool => tool.id === "query-string-generator")!; await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    await user.click(await screen.findByRole("button", { name: `Copy ${tool.webContract.outputs.join(" · ")}` })); expect(screen.getByRole("status").textContent).toContain("Could not copy"); expect(screen.getByLabelText(`${tool.webContract.outputs.join(" · ")} value`).textContent).toContain("?");
  });
  it("associates and focuses the exact invalid scalar input", async () => {
    render(<WebStation toolId="url-parser" />); setUrl("not a URL");
    const tool = webTools.find(tool => tool.id === "url-parser")!; fireEvent.click(screen.getByRole("button", { name: tool.webContract.action }));
    const alert = await screen.findByRole("alert"); const control = urlSource();
     expect(control.getAttribute("aria-invalid")).toBe("true"); expect(control.getAttribute("aria-describedby")).toContain(alert.id); await waitFor(() => expect(document.activeElement).toBe(control));
  });
  it("associates and focuses an exact nested validation error", async () => {
    const user = userEvent.setup(); render(<WebStation toolId="sitemap-generator" />); await user.click(screen.getByRole("button", { name: "Add entry" }));
    set("Entry 1 URL", "https://example.com/"); set("Entry 1 priority", "2");
    const tool = webTools.find(tool => tool.id === "sitemap-generator")!; await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    const alert = await screen.findByRole("alert"); const control = screen.getByLabelText("Entry 1 priority");
    expect(control.getAttribute("aria-invalid")).toBe("true"); expect(control.getAttribute("aria-describedby")).toContain(alert.id); expect(document.activeElement).toBe(control);
  });
  it("preserves oversized input and reports an associated bound rather than truncating", async () => {
    render(<WebStation toolId="url-parser" />); setUrl("x".repeat(200001));
    const tool = webTools.find(tool => tool.id === "url-parser")!; fireEvent.click(screen.getByRole("button", { name: tool.webContract.action }));
    expect((await screen.findByRole("alert")).textContent).toContain("limit"); expect((urlSource() as HTMLInputElement).value).toHaveLength(200001); expect(document.activeElement).toBe(urlSource());
  });
  it("masks URL source credentials and renders only password presence", async () => {
    render(<WebStation toolId="url-parser" />); setUrl("https://alice:s3cret@example.com/path");
    const tool = webTools.find(tool => tool.id === "url-parser")!; fireEvent.click(screen.getByRole("button", { name: tool.webContract.action }));
     const output = await screen.findByLabelText(`${tool.webContract.outputs.join(" · ")} value`); expect(output.textContent).not.toContain("s3cret"); expect(output.textContent).toContain("passwordPresentPresent");
    expect(urlSource().getAttribute("type")).toBe("password"); expect(urlSource().getAttribute("autocomplete")).toBe("off");
  });
  it("renders markup and remote OG image URLs as inert local text", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { container } = render(<WebStation toolId="open-graph-preview" />); fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    const tool = webTools.find(tool => tool.id === "open-graph-preview")!;
    const title = tool.webContract.fields.find(field => field.name === "title")!.label; set(title, "<img src=x onerror=bad()>");
    const image = tool.webContract.fields.find(field => field.name === "imageUrl")!.label; set(image, "https://example.com/private.png");
    fireEvent.click(screen.getByRole("button", { name: tool.webContract.action }));
    const preview = await screen.findByRole("article", { name: "Local Open Graph preview" }); expect(preview.textContent).toContain("<img src=x onerror=bad()>"); expect(preview.textContent).toContain("https://example.com/private.png"); expect(preview.textContent).toContain("blocked by local privacy");
    expect(container.querySelector("img,iframe,script")).toBeNull(); expect(fetch).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
  });
  it.each(webTools.filter(tool => tool.pairedTool))("$id pair uses a real route with no input payload", tool => {
    render(<WebStation toolId={tool.id} />); fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    expect(screen.getByRole("link").getAttribute("href")).toBe(`/tools/${tool.pairedTool}`);
  });
  it("editing/Clear/tool changes reject stale async results", async () => {
    let resolve!: (value: WebResult) => void;
    const pending = new Promise<WebResult>(done => { resolve = done; }); vi.spyOn(inspect, "inspectWeb").mockReturnValueOnce(pending);
    const { rerender } = render(<WebStation toolId="url-parser" />); fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    const tool = webTools.find(tool => tool.id === "url-parser")!; fireEvent.click(screen.getByRole("button", { name: tool.webContract.action })); await waitFor(() => expect(inspect.inspectWeb).toHaveBeenCalled());
    setUrl("https://new.example/"); expect(screen.getByRole("status").textContent).toBe(""); fireEvent.click(screen.getByRole("button", { name: "Clear" })); rerender(<WebStation toolId="query-string-parser" />);
    await act(async () => resolve({ text: "stale output" })); expect(screen.queryByText("stale output")).toBeNull();
  });
  it("does not echo unexpected engine errors containing credentials", async () => {
    vi.spyOn(inspect, "inspectWeb").mockRejectedValueOnce(new Error("https://user:secret@example.com")); render(<WebStation toolId="url-parser" />); fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    const tool = webTools.find(tool => tool.id === "url-parser")!; fireEvent.click(screen.getByRole("button", { name: tool.webContract.action })); expect((await screen.findByRole("alert")).textContent).not.toContain("secret");
  });
  it("bounds structured output and keeps unsafe markup inert", async () => {
    vi.spyOn(inspect, "inspectWeb").mockResolvedValueOnce({ text: "raw", data: { payload: "<script>bad()</script>" } });
    const { container } = render(<WebStation toolId="url-parser" />); const tool = webTools.find(tool => tool.id === "url-parser")!;
    fireEvent.click(screen.getByRole("button", { name: tool.webContract.action })); expect((await screen.findByLabelText(`${tool.webContract.outputs.join(" · ")} value`)).textContent).toContain("<script>bad()</script>"); expect(container.querySelector("script")).toBeNull();
    vi.mocked(inspect.inspectWeb).mockResolvedValueOnce({ text: "x".repeat(4000001) }); fireEvent.click(screen.getByRole("button", { name: tool.webContract.action })); expect((await screen.findByRole("alert")).textContent).toContain("limit"); expect(container.querySelector("pre")).toBeNull();
  });
});

describe("Web exact Blob downloads and favicon lifetime", () => {
  it("integrates the real favicon engine with local raster bytes and mocked native canvas/bitmap adapters", async () => {
    vi.mocked(faviconEngine.generateFavicon).mockRestore();
    const user = userEvent.setup();
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="), character => character.charCodeAt(0));
    const buffer = bytes.buffer as ArrayBuffer;
    const file = new File([buffer], "pixel.png", { type: "image/png" }); Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
    const bitmap = { width: 1, height: 1, close: vi.fn() }; vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const drawImage = vi.fn(); const context = { clearRect: vi.fn(), drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: "low" };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const png = new Blob([buffer], { type: "image/png" }); vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(png));
    const { unmount } = render(<WebStation toolId="favicon-generator" />); const tool = webTools.find(tool => tool.id === "favicon-generator")!;
    await user.upload(screen.getByLabelText(tool.webContract.fields.find(field => field.control === "file")!.label), file);
    const sizeField = tool.webContract.fields.find(field => field.name === "size")!; await user.selectOptions(screen.getByLabelText(sizeField.label), "32");
    await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    expect((await screen.findByRole("img")).getAttribute("width")).toBe("32"); expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 32, 32); expect(bitmap.close).toHaveBeenCalledOnce(); expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toBe(png);
    unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-1");
  });
  it.each(webTools.filter(tool => tool.webContract.downloadExtension && tool.webContract.downloadExtension !== "png"))("$id downloads exact output in the advertised format", async tool => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<WebStation toolId={tool.id} />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: tool.webContract.action }));
    const next = await run(tool.id, { ...tool.webContract.defaults, ...tool.webContract.example });
    fireEvent.click(await screen.findByRole("button", { name: `Download ${tool.webContract.downloadExtension!.toUpperCase()}` }));
    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)![0] as Blob; expect(await readBlob(blob)).toBe(next.text); expect(click).toHaveBeenCalledOnce();
    const link = click.mock.instances[0] as unknown as HTMLAnchorElement; expect(link.download).toBe(`${tool.id}.${tool.webContract.downloadExtension}`); expect(document.body.contains(link)).toBe(false);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-1"));
  });
  it("downloads the actual PNG Blob and revokes stale preview/download URLs", async () => {
    const user = userEvent.setup(); const actual = favicon(); vi.mocked(faviconEngine.generateFavicon).mockResolvedValue(actual);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { unmount } = render(<WebStation toolId="favicon-generator" />); const tool = webTools.find(tool => tool.id === "favicon-generator")!;
    const input = screen.getByLabelText(tool.webContract.fields.find(field => field.control === "file")!.label) as HTMLInputElement;
    await user.upload(input, raster()); await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    const image = await screen.findByRole("img"); expect(image.getAttribute("src")).toBe("blob:local-1"); expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toBe(actual.blob);
    await user.click(screen.getByRole("button", { name: "Download PNG" })); expect(vi.mocked(URL.createObjectURL).mock.calls[1][0]).toBe(actual.blob);
    await user.click(screen.getByRole("button", { name: "Clear" })); expect(input.value).toBe(""); expect(input.files).toHaveLength(0); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-1"); expect(screen.queryByRole("img")).toBeNull();
    await user.upload(input, raster()); await user.click(screen.getByRole("button", { name: tool.webContract.action })); await screen.findByRole("img");
    const owned = (screen.getByRole("img") as HTMLImageElement).src; unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith(owned);
  });
  it.each(["Clear", "replace", "unmount"])("%s during favicon conversion cannot recreate a URL or stale result", async operation => {
    const user = userEvent.setup(); let resolve!: (value: ReturnType<typeof favicon>) => void;
    vi.mocked(faviconEngine.generateFavicon).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { unmount } = render(<WebStation toolId="favicon-generator" />); const tool = webTools.find(tool => tool.id === "favicon-generator")!;
    const input = screen.getByLabelText(tool.webContract.fields.find(field => field.control === "file")!.label); await user.upload(input, raster()); await user.click(screen.getByRole("button", { name: tool.webContract.action }));
    await waitFor(() => expect(faviconEngine.generateFavicon).toHaveBeenCalledOnce());
    if (operation === "Clear") await user.click(screen.getByRole("button", { name: "Clear" })); else if (operation === "replace") await user.upload(input, raster()); else unmount();
    await act(async () => resolve(favicon())); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.queryByRole("img")).toBeNull();
  });
  it("missing file errors focus the labelled local file chooser", async () => {
    render(<WebStation toolId="favicon-generator" />); const tool = webTools.find(tool => tool.id === "favicon-generator")!; fireEvent.click(screen.getByRole("button", { name: tool.webContract.action }));
    const alert = await screen.findByRole("alert"); const input = screen.getByLabelText(tool.webContract.fields.find(field => field.control === "file")!.label);
    expect(input.getAttribute("aria-describedby")).toContain(alert.id); expect(document.activeElement).toBe(input); expect(faviconEngine.generateFavicon).not.toHaveBeenCalled();
  });
});

describe("Web SSR hydration", () => {
  it.each(webTools)("$id stable IDs and preserved controls without hydration warnings", async tool => {
    const container = document.createElement("div"); const ui = <WebStation toolId={tool.id} />;
    container.innerHTML = renderToString(ui, { identifierPrefix: "server" }); document.body.append(container);
    const nodes = [...container.querySelectorAll("[id]")]; const errors = vi.spyOn(console, "error"); const recoverable = vi.fn();
    const root = hydrateRoot(container, ui, { identifierPrefix: "client", onRecoverableError: recoverable }); await act(async () => {});
    expect([...container.querySelectorAll("[id]")]).toEqual(nodes); expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length); expect(errors).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
});
