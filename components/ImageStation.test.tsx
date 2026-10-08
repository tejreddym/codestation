// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imageTools, type ImageToolId } from "@/config/image-tools";
import { ImageError, type ImageResult } from "@/lib/tools/image/types";
import * as engine from "@/lib/tools/image/engine";
import ImageStation from "./ImageStation";

vi.mock("@/lib/tools/image/engine", () => ({ inspectImage: vi.fn(), runImage: vi.fn() }));
const raster = () => new File([new Uint8Array([137, 80, 78, 71])], "local.png", { type: "image/png" });
const blobResult = (mime = "image/png"): ImageResult => ({ blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: mime }), extension: mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png", data: {} });
const tool = (id: ImageToolId) => imageTools.find(entry => entry.id === id)!;
const field = (id: ImageToolId, name: string) => screen.getByLabelText(tool(id).localContract.fields.find(entry => entry.name === name)!.label);
const submit = (id: ImageToolId) => fireEvent.click(screen.getByRole("button", { name: tool(id).localContract.action }));
async function upload(id: ImageToolId, file = raster()) {
  fireEvent.change(field(id, "file"), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Local image ready"));
}
function mockResult(id: ImageToolId): ImageResult {
  if (id === "image-to-base64") return { text: "iVBORw==", data: { base64: "iVBORw==" } };
  if (id === "image-to-data-uri") return { text: "data:image/png;base64,iVBORw==", data: { dataUri: "data:image/png;base64,iVBORw==" } };
  if (id === "svg-formatter" || id === "svg-minifier") {
    const text = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    return { text, data: { [id === "svg-formatter" ? "formattedSvg" : "minifiedSvg"]: text } };
  }
  if (/dimension|metadata|inspector/.test(id)) {
    const metadata = { width: 80, height: 40, mime: "image/png", fileSize: 4, fileName: "local.png" };
    return { data: /metadata/.test(id) ? { metadata } : metadata };
  }
  if (/color|palette/.test(id)) return { data: { [id.endsWith("extractor") ? "colors" : "palette"]: [{ hex: "#3978E8", rgb: { r: 57, g: 120, b: 232 }, ...(id.endsWith("extractor") ? { percentage: 100 } : {}) }] } };
  return blobResult(id.endsWith("-jpg") || id === "image-compressor" || id === "image-quality-adjuster" ? "image/jpeg" : id.endsWith("-webp") ? "image/webp" : "image/png");
}

beforeEach(() => {
  let sequence = 0;
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => `blob:local-${++sequence}`) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.mocked(engine.inspectImage).mockResolvedValue({ width: 80, height: 40, mime: "image/png" });
  vi.mocked(engine.runImage).mockImplementation(async id => mockResult(id as ImageToolId));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });

describe.each(["light", "dark"])("Image %s theme DOM, not visual acceptance", theme => {
  it.each(imageTools)("$id exact controls, explicit local action, Copy/download and Clear", async definition => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const xhr = vi.spyOn(XMLHttpRequest.prototype, "send");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const beacon = vi.fn(); Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    const log = vi.spyOn(console, "log");
    const { container } = render(<ImageStation toolId={definition.id} />);
    const contract = definition.localContract;
    for (const entry of contract.fields.filter(entry => entry.name !== "crop" && !(definition.id === "image-cropper" && ["x", "y", "width", "height"].includes(entry.name)))) {
      const control = screen.getByLabelText(entry.label);
      expect(control.id).toBe(`image-${definition.id}-${entry.name}`);
      expect(control.getAttribute("name")).toBe(entry.name);
      if (entry.control === "file") await upload(definition.id);
      else if (entry.control === "textarea" && !contract.fields.some(item => item.name === "file")) fireEvent.change(control, { target: { value: "local source" } });
    }
    expect(engine.runImage).not.toHaveBeenCalled();
    const action = screen.getByRole("button", { name: contract.action }); action.focus(); await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Result ready."));
    expect(engine.runImage).toHaveBeenCalledOnce();
    const actual = mockResult(definition.id);
    for (const [key] of Object.entries(actual.data)) expect(within(screen.getByLabelText(`${contract.outputs.join(" · ")} values`)).getAllByText(key).length).toBeGreaterThan(0);
    for (const button of screen.queryAllByRole("button", { name: /^Copy/ })) { button.focus(); await user.keyboard("{Enter}"); }
    if (actual.text !== undefined) expect(clipboard).toHaveBeenCalled(); else expect(clipboard).not.toHaveBeenCalled();
    if (actual.blob) {
      const button = screen.getByRole("button", { name: `Download ${actual.extension!.toUpperCase()}` }); button.focus(); await user.keyboard("{Enter}");
      expect(download).toHaveBeenCalledOnce();
      const processed = await vi.mocked(engine.runImage).mock.results[0].value as ImageResult;
      expect(vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0]).toBe(processed.blob);
      const link = download.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(link.download).toBe(`${definition.id}.${actual.extension}`); expect(document.body.contains(link)).toBe(false);
    } else expect(screen.queryByRole("button", { name: /^Download/ })).toBeNull();
    const clear = screen.getByRole("button", { name: "Clear" }); clear.focus(); await user.keyboard("{Enter}");
    expect(container.querySelector("img,pre")).toBeNull(); expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    for (const input of Array.from(container.querySelectorAll<HTMLInputElement>("input[type=file]"))) expect(input.value).toBe("");
    expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(beacon).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
    expect(container.querySelector("iframe,script")).toBeNull();
  });
});

describe("Image input and accessible processing", () => {
  it("Clear resets the real file element so the same file can be selected again", async () => {
    const user = userEvent.setup(); render(<ImageStation toolId="image-resizer" />);
    const input = field("image-resizer", "file") as HTMLInputElement;
    const selected = raster(); await user.upload(input, selected);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Local image ready"));
    expect(input.files).toHaveLength(1); await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(input.value).toBe(""); expect(input.files).toHaveLength(0);
    await user.upload(input, selected); await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Local image ready"));
    expect(engine.inspectImage).toHaveBeenCalledTimes(2);
  });
  it("reports missing files with associated error and focus", async () => {
    render(<ImageStation toolId="image-resizer" />); submit("image-resizer");
    const error = await screen.findByRole("alert"); const input = field("image-resizer", "file");
    expect(error.textContent).toContain("Choose a local image file"); expect(input.getAttribute("aria-invalid")).toBe("true"); expect(input.getAttribute("aria-describedby")).toContain(error.id); expect(document.activeElement).toBe(input);
    expect(engine.runImage).not.toHaveBeenCalled();
  });
  it("reports native decoding errors and clears busy/error state", async () => {
    vi.mocked(engine.inspectImage).mockRejectedValueOnce(new ImageError("Native image decoding is unavailable.", "file"));
    render(<ImageStation toolId="image-resizer" />); fireEvent.change(field("image-resizer", "file"), { target: { files: [raster()] } });
    expect((await screen.findByRole("alert")).textContent).toContain("decoding");
    fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(screen.queryByRole("alert")).toBeNull(); expect(document.querySelector("form")?.getAttribute("aria-busy")).toBe("false");
  });
  it("copies exact distinct Base64 and Data URI values", async () => {
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const { rerender } = render(<ImageStation toolId="image-to-base64" />); await upload("image-to-base64"); submit("image-to-base64");
    await user.click(await screen.findByRole("button", { name: "Copy Base64" })); expect(copy).toHaveBeenLastCalledWith("iVBORw==");
    expect(screen.queryByRole("button", { name: "Copy Data URI" })).toBeNull();
    rerender(<ImageStation toolId="image-to-data-uri" />); await upload("image-to-data-uri"); submit("image-to-data-uri");
    await user.click(await screen.findByRole("button", { name: "Copy Data URI" })); expect(copy).toHaveBeenLastCalledWith("data:image/png;base64,iVBORw==");
    expect(screen.queryByRole("button", { name: "Copy Base64" })).toBeNull();
    copy.mockRejectedValueOnce(new Error("denied")); await user.click(screen.getByRole("button", { name: "Copy Data URI" }));
    expect(screen.getByRole("status").textContent).toContain("Could not copy"); expect(screen.getByLabelText("dataUri value").textContent).toBe("data:image/png;base64,iVBORw==");
  });
  it("populates intrinsic dimensions without upscale, and supports keyboard-linked sizing both ways", async () => {
    const user = userEvent.setup(); render(<ImageStation toolId="image-resizer" />); await upload("image-resizer");
    const width = field("image-resizer", "width") as HTMLInputElement; const height = field("image-resizer", "height") as HTMLInputElement;
    expect(width.value).toBe("80"); expect(height.value).toBe("40");
    const lock = field("image-resizer", "lockAspect") as HTMLInputElement; if (!lock.checked) await user.click(lock);
    width.focus(); await user.clear(width); await user.type(width, "40"); expect(height.value).toBe("20");
    height.focus(); await user.clear(height); await user.type(height, "10"); expect(width.value).toBe("20");
    await user.click(lock); fireEvent.change(width, { target: { value: "15" } }); expect(height.value).toBe("10");
    submit("image-resizer"); await waitFor(() => expect(engine.runImage).toHaveBeenCalled());
    expect(vi.mocked(engine.runImage).mock.calls[0][1]).toMatchObject({ width: "15", height: "10", lockAspect: false });
  });
  it("SVG file/source alternatives reset the other source and never embed SVG", async () => {
    const definition = imageTools.find(item => item.localContract.fields.some(entry => entry.name === "file") && item.localContract.fields.some(entry => entry.name === "source"))!;
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "local.svg", { type: "image/svg+xml" });
    vi.mocked(engine.inspectImage).mockResolvedValue({ width: 80, height: 40, mime: "image/svg+xml" });
    const { container } = render(<ImageStation toolId={definition.id} />);
    fireEvent.change(field(definition.id, "source"), { target: { value: "<svg/>" } });
    await upload(definition.id, svg); expect((field(definition.id, "source") as HTMLTextAreaElement).value).toBe(""); expect(container.querySelector("img")).toBeNull();
    fireEvent.change(field(definition.id, "source"), { target: { value: "<svg/>" } });
    expect((field(definition.id, "file") as HTMLInputElement).value).toBe(""); submit(definition.id);
    await waitFor(() => expect(engine.runImage).toHaveBeenCalled()); expect(vi.mocked(engine.runImage).mock.calls[0][1]).toMatchObject({ source: "<svg/>", file: null });
  });
  it("palette preview has readable hexadecimal and RGB values", async () => {
    const definition = imageTools.find(item => /color|palette/.test(item.id))!;
    render(<ImageStation toolId={definition.id} />); await upload(definition.id); submit(definition.id);
    const preview = await screen.findByRole("img", { name: "Color preview #3978E8" }); expect(preview).toBeTruthy(); expect(screen.getByText("#3978E8")).toBeTruthy();
    expect(screen.getByText("57")).toBeTruthy(); expect(screen.getByText("120")).toBeTruthy(); expect(screen.getByText("232")).toBeTruthy();
  });
  it("cropper keyboard moves and Shift-resizes the visual region with no required coordinate fields", async () => {
    const user = userEvent.setup(); render(<ImageStation toolId="image-cropper" />); await upload("image-cropper");
    await user.click(screen.getByRole("button", { name: "Select center" }));
    const selection = screen.getByRole("group", { name: "Move crop selection" }); selection.focus(); await user.keyboard("{ArrowRight}{ArrowDown}{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
    expect(screen.getByText("Selection: 41 × 21 pixels at 21, 11.")).toBeTruthy();
    submit("image-cropper"); await waitFor(() => expect(engine.runImage).toHaveBeenCalled()); expect(vi.mocked(engine.runImage).mock.calls[0][1]).toMatchObject({ crop: { x: 21, y: 11, width: 41, height: 21 } });
    expect(document.querySelector("input[name=x],input[name=y]")).toBeNull();
  });
});

describe("Image stale guards and Blob ownership", () => {
  it("ignores a clipboard completion after clearing its source", async () => {
    const user = userEvent.setup(); let resolve!: () => void;
    vi.spyOn(navigator.clipboard, "writeText").mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
    render(<ImageStation toolId="image-to-base64" />); await upload("image-to-base64"); submit("image-to-base64");
    await user.click(await screen.findByRole("button", { name: "Copy Base64" }));
    await user.click(screen.getByRole("button", { name: "Clear" })); await act(async () => resolve());
    expect(screen.getByRole("status").textContent).toBe("");
  });
  it("releases preview/result/download URLs on edits, Clear and unmount", async () => {
    const actual = blobResult(); vi.mocked(engine.runImage).mockResolvedValue(actual);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { unmount } = render(<ImageStation toolId="image-resizer" />); await upload("image-resizer");
    const source = screen.getByRole("img", { name: "Selected local image preview" }).getAttribute("src")!;
    submit("image-resizer"); const preview = await screen.findByRole("img", { name: "Image Resizer result preview" }); const result = preview.getAttribute("src")!;
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    expect(vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0]).toBe(actual.blob);
    fireEvent.change(field("image-resizer", "width"), { target: { value: "40" } });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(source); expect(URL.revokeObjectURL).toHaveBeenCalledWith(result); expect(screen.queryByRole("button", { name: "Download PNG" })).toBeNull();
    const refreshed = screen.getByRole("img").getAttribute("src")!;
    fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(URL.revokeObjectURL).toHaveBeenCalledWith(refreshed);
    await upload("image-resizer"); const final = screen.getByRole("img").getAttribute("src")!; unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith(final);
    await waitFor(() => expect(vi.mocked(URL.revokeObjectURL).mock.calls.length).toBe(vi.mocked(URL.createObjectURL).mock.calls.length));
  });
  it.each(["edit", "Clear", "unmount", "tool change"])("ignores late Blob results after %s", async action => {
    let resolve!: (result: ImageResult) => void;
    vi.mocked(engine.runImage).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const view = render(<ImageStation toolId="image-resizer" />); await upload("image-resizer"); submit("image-resizer");
    await waitFor(() => expect(engine.runImage).toHaveBeenCalled());
    if (action === "edit") fireEvent.change(field("image-resizer", "width"), { target: { value: "20" } });
    if (action === "Clear") fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    if (action === "unmount") view.unmount();
    if (action === "tool change") view.rerender(<ImageStation toolId="svg-formatter" />);
    const before = vi.mocked(URL.createObjectURL).mock.calls.length;
    await act(async () => resolve(blobResult()));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(before); expect(screen.queryByRole("button", { name: "Download PNG" })).toBeNull();
  });
  it("ignores outdated inspection after replacing or clearing files", async () => {
    let resolve!: (info: { width: number; height: number; mime: string }) => void;
    vi.mocked(engine.inspectImage).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    render(<ImageStation toolId="image-resizer" />); fireEvent.change(field("image-resizer", "file"), { target: { files: [raster()] } });
    await waitFor(() => expect(engine.inspectImage).toHaveBeenCalled());
    await upload("image-resizer", new File(["new"], "new.png", { type: "image/png" }));
    await act(async () => resolve({ width: 900, height: 700, mime: "image/png" }));
    expect((field("image-resizer", "width") as HTMLInputElement).value).toBe("80");
    fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("Image SSR stable controls", () => {
  it.each(imageTools)("$id hydrates across different React identifier namespaces", async definition => {
    const html = renderToString(<ImageStation toolId={definition.id} />, { identifierPrefix: "server-" });
    const container = document.createElement("div"); container.innerHTML = html; document.body.appendChild(container);
    const nodes = Array.from(container.querySelectorAll("input,textarea,select"));
    const errors: unknown[] = []; let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, <ImageStation toolId={definition.id} />, { identifierPrefix: "client-", onRecoverableError: error => errors.push(error) }); });
    expect(errors).toEqual([]); expect(Array.from(container.querySelectorAll("input,textarea,select"))).toEqual(nodes);
    for (const label of Array.from(container.querySelectorAll<HTMLLabelElement>("label[for]"))) expect(container.querySelector(`[id="${label.htmlFor}"]`)).not.toBeNull();
    await act(async () => root.unmount()); container.remove();
  });
});
