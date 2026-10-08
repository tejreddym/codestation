import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectImage, runImage } from "./engine";
import { rasterHeader } from "./headers";
import { imageFile, rasterBytes } from "./test-fixtures";
import { toBase64 } from "./base64";

/** Explicit mocked native adapters: verifies contracts/transforms/cleanup, NOT real browser codecs. */
describe("local image tools using explicit native decoder/canvas mocks", () => {
  let context: Record<string, unknown>, canvases: HTMLCanvasElement[], close: ReturnType<typeof vi.fn>;
  let encoderFallback: string | undefined, encoderSignature: string | undefined, encoderNull: boolean;
  let orientationSwap: boolean, decoderReject: boolean;
  let pixels: Uint8ClampedArray;
  beforeEach(() => {
    close = vi.fn(); canvases = []; encoderFallback = undefined; encoderSignature = undefined; encoderNull = false; orientationSwap = false; decoderReject = false;
    pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0, 255, 0, 0, 128]);
    context = { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) };
    vi.stubGlobal("document", { createElement: vi.fn(() => {
      const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn((callback: (b: Blob | null) => void, mime: string) => {
        callback(encoderNull ? null : new Blob([rasterBytes(encoderSignature ?? encoderFallback ?? mime, canvas.width, canvas.height)], { type: encoderFallback ?? mime }));
      }) } as unknown as HTMLCanvasElement;
      canvases.push(canvas); return canvas;
    }) });
    vi.stubGlobal("createImageBitmap", vi.fn(async (blob: Blob) => {
      if (decoderReject) throw new Error("unsupported decoder");
      let width: number, height: number;
      if (blob.type === "image/svg+xml") {
        const text = await blob.text(); width = Number(/\bwidth="(\d+)"/.exec(text)?.[1]); height = Number(/\bheight="(\d+)"/.exec(text)?.[1]);
      } else ({ width, height } = rasterHeader(new Uint8Array(await blob.arrayBuffer())));
      return { width: orientationSwap ? height : width, height: orientationSwap ? width : height, close };
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const values = (mime = "image/png") => ({ file: imageFile(mime), quality: "85" });
  it.each([
    ["png-to-jpg", "image/png", "image/jpeg"], ["jpg-to-png", "image/jpeg", "image/png"],
    ["png-to-webp", "image/png", "image/webp"], ["webp-to-png", "image/webp", "image/png"],
    ["jpg-to-webp", "image/jpeg", "image/webp"], ["webp-to-jpg", "image/webp", "image/jpeg"],
    ["avif-to-png", "image/avif", "image/png"], ["avif-to-jpg", "image/avif", "image/jpeg"],
  ])("implements directional %s with actual output signatures", async (id, input, output) => {
    const result = await runImage(id, values(input)); expect(result.blob?.type).toBe(output);
    expect(rasterHeader(new Uint8Array(await result.blob!.arrayBuffer())).mime).toBe(output); expect(result.data).toEqual({ originalSize: (values(input).file).size, outputSize: result.blob!.size });
    expect(close).toHaveBeenCalledOnce(); expect(canvases[0].width).toBe(0); expect(result.warnings?.join()).toMatch(/EXIF.*metadata/);
    await expect(runImage(id, values(input === "image/png" ? "image/jpeg" : "image/png"))).rejects.toThrow(/genuine/);
  });
  it.each(["png-to-avif", "jpg-to-avif", "jpeg-to-avif", "avif-to-webp", "png-to-png", "unknown"])("does not offer an unverified encoder or unsupported direction %s", async id => {
    await expect(runImage(id, values())).rejects.toThrow(/Unsupported/); expect(createImageBitmap).not.toHaveBeenCalled();
  });
  it("fails truthfully when AVIF native decode is missing", async () => {
    decoderReject = true; await expect(runImage("avif-to-png", values("image/avif"))).rejects.toThrow(/genuine native decoder support/); expect(canvases).toHaveLength(0);
  });
  it("bounds raster headers before invoking any native decoder", async () => {
    await expect(inspectImage(imageFile("image/png", 8193, 1))).rejects.toThrow(/Dimensions/); expect(createImageBitmap).not.toHaveBeenCalled();
  });
  it("applies native EXIF orientation once and uses oriented dimensions for crop/rotation", async () => {
    orientationSwap = true;
    expect(await inspectImage(imageFile("image/jpeg"))).toEqual({ width: 2, height: 4, mime: "image/jpeg" });
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), { imageOrientation: "from-image" });
    await runImage("image-cropper", { ...values("image/jpeg"), crop: { x: 0, y: 2, width: 2, height: 2 } });
    expect(context.rotate).not.toHaveBeenCalled(); expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 2, 2, 2, 0, 0, 2, 2);
  });
  it.each(["svg-to-png", "svg-to-jpg", "svg-to-webp"])("rasterizes strictly sanitized bounded %s", async id => {
    const result = await runImage(id, { source: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"><text>雪🌈</text></svg>' });
    expect(result.blob).toBeInstanceOf(Blob); expect(close).toHaveBeenCalledOnce();
    await expect(runImage(id, { source: '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>' })).rejects.toThrow(/unsafe/);
  });
  it("reads safe UTF-8 SVG files locally and never rasterizes unsafe source", async () => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"><text>雪</text></svg>'], "雪.svg", { type: "image/svg+xml" });
    expect(await inspectImage(file)).toEqual({ width: 4, height: 2, mime: "image/svg+xml" });
    expect((await runImage("svg-to-png", { file })).blob?.type).toBe("image/png");
    await expect(runImage("svg-to-png", { file, source: "x" })).rejects.toThrow(/either/);
    await expect(runImage("svg-to-png", { file: new File([new Uint8Array([255])], "x.svg", { type: "image/svg+xml" }) })).rejects.toThrow(/UTF-8/);
  });
  it.each(["svg-formatter", "svg-minifier"])("%s returns source-only inert accessible Unicode", async id => {
    const result = await runImage(id, { source: '<svg xmlns="http://www.w3.org/2000/svg"><title> 雪🌈 </title><text>A <tspan> B </tspan> C</text></svg>' });
    expect(result.text).toContain(" 雪🌈 "); expect(result.text).toContain("A <tspan> B </tspan> C"); expect(result.blob).toBeUndefined(); expect(createImageBitmap).not.toHaveBeenCalled();
    await expect(runImage(id, { source: "<not-svg/>" })).rejects.toThrow();
  });
  it.each(["image-compressor", "image-quality-adjuster"])("%s adjusts genuine JPEG/WebP quality", async id => {
    expect((await runImage(id, { ...values("image/jpeg"), quality: "25", format: "image/webp" })).blob?.type).toBe("image/webp");
    expect(canvases[0].toBlob).toHaveBeenCalledWith(expect.any(Function), expect.any(String), .25);
    await expect(runImage(id, { ...values("image/jpeg"), quality: "0" })).rejects.toThrow(/quality/);
    await expect(runImage(id, { ...values("image/jpeg"), quality: "1.2" })).rejects.toThrow(/whole/);
    await expect(runImage(id, { ...values("image/jpeg"), format: "image/avif" })).rejects.toThrow(/AVIF/);
  });
  it("adjusts PNG through a real lossy output codec and never claims guaranteed compression", async () => {
    expect((await runImage("image-quality-adjuster", values())).blob?.type).toBe("image/jpeg");
    // Synthetic PNG and WebP lengths make this branch predictable without pretending to measure a real codec.
    const result = await runImage("image-compressor", { ...values("image/jpeg"), format: "image/webp" });
    expect(result.warnings?.join()).toMatch(/not smaller/);
  });
  it("preserves transparency for PNG/WebP and explicitly flattens JPEG on the supplied color", async () => {
    await runImage("png-to-webp", { ...values(), background: "transparent" }); expect(context.clearRect).toHaveBeenCalled(); expect(context.fillRect).not.toHaveBeenCalled();
    await runImage("png-to-jpg", { ...values(), background: "#12abEF" }); expect(context.fillStyle).toBe("#12abEF"); expect(context.fillRect).toHaveBeenCalledWith(0, 0, 4, 2);
    await expect(runImage("png-to-jpg", { ...values(), background: "transparent" })).rejects.toThrow(/cannot preserve/);
    await expect(runImage("png-to-jpg", { ...values(), background: "url(evil)" })).rejects.toThrow(/hex/);
  });
  it("rejects unsupported native fallback MIME, spoofed output bytes and null output", async () => {
    encoderFallback = "image/png"; await expect(runImage("png-to-webp", values())).rejects.toThrow(/cannot encode/);
    encoderFallback = undefined; encoderSignature = "image/png"; await expect(runImage("png-to-webp", values())).rejects.toThrow(/signature/);
    encoderSignature = undefined; encoderNull = true; await expect(runImage("png-to-jpg", values())).rejects.toThrow(/encoding/);
    expect(close).toHaveBeenCalledTimes(3); expect(canvases.every(c => c.width === 0 && c.height === 0)).toBe(true);
  });
  it("resizes with aspect locking, explicit unconstrained size and allocation limits", async () => {
    const result = await runImage("image-resizer", { ...values(), width: "8", height: "4", lockAspect: true });
    expect(rasterHeader(new Uint8Array(await result.blob!.arrayBuffer()))).toMatchObject({ width: 8, height: 4 });
    await expect(runImage("image-resizer", { ...values(), width: "8", height: "8", lockAspect: true })).rejects.toThrow(/disagree/);
    await expect(runImage("image-resizer", { ...values(), width: "4001", height: "4000", lockAspect: false })).rejects.toThrow(/million/);
    await expect(runImage("image-resizer", { ...values(), width: "0", height: "2", lockAspect: false })).rejects.toThrow();
    const heightOnly = await runImage("image-resizer", { ...values(), height: "4", lockAspect: true }); expect(rasterHeader(new Uint8Array(await heightOnly.blob!.arrayBuffer())).width).toBe(8);
  });
  it("crops exact oriented pixel coordinates and rejects outside/empty/fractional crops", async () => {
    await runImage("image-cropper", { ...values(), crop: { x: 1, y: 0, width: 3, height: 2 } }); expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 1, 0, 3, 2, 0, 0, 3, 2);
    for (const crop of [{ x: 1, y: 0, width: 4, height: 2 }, { x: 0, y: 0, width: 0, height: 2 }, { x: .5, y: 0, width: 2, height: 2 }]) await expect(runImage("image-cropper", { ...values(), crop })).rejects.toThrow();
  });
  it.each([["clockwise", Math.PI / 2, 2, 4], ["counter-clockwise", -Math.PI / 2, 2, 4], ["180", Math.PI, 4, 2]])("rotates %s around canvas center", async (rotation, angle, width, height) => {
    const result = await runImage("image-rotator", { ...values(), rotation }); expect(context.translate).toHaveBeenCalledWith(Number(width) / 2, Number(height) / 2); expect(context.rotate).toHaveBeenCalledWith(angle);
    expect(rasterHeader(new Uint8Array(await result.blob!.arrayBuffer()))).toMatchObject({ width, height }); await expect(runImage("image-rotator", { ...values(), rotation: "90" })).rejects.toThrow(/Choose/);
  });
  it.each([["Horizontal", -1, 1, 4, 0], ["Vertical", 1, -1, 0, 2]])("flips %s with exact canvas transform", async (flip, x, y, tx, ty) => {
    await runImage("image-flipper", { ...values(), flip }); expect(context.scale).toHaveBeenCalledWith(x, y); expect(context.translate).toHaveBeenCalledWith(tx, ty);
    await expect(runImage("image-flipper", { ...values(), flip: "diagonal" })).rejects.toThrow(/Choose/);
  });
  it("inspects actual dimensions/MIME/bytes/Unicode filename only and reports bounded metadata", async () => {
    expect((await runImage("image-inspector", values())).data).toEqual({ width: 4, height: 2, mime: "image/png", fileSize: 33, fileName: "雪🌈.image" });
    const result = await runImage("image-metadata-viewer", values()); expect(result.data).toHaveProperty("metadata"); expect(JSON.stringify(result.data)).not.toMatch(/GPS|camera|EXIF/);
    await expect(runImage("image-inspector", { file: new File(["bad"], "bad") })).rejects.toThrow();
  });
  it.each(["image-to-base64", "image-to-data-uri"])("%s preserves exact original validated raster bytes", async id => {
    const result = await runImage(id, values()); expect(result.text).toBe((id.endsWith("data-uri") ? "data:image/png;base64," : "") + toBase64(rasterBytes())); expect(result.blob).toBeUndefined();
    await expect(runImage(id, { file: new File(["<svg/>"], "x", { type: "image/svg+xml" }) })).rejects.toThrow();
  });
  it.each(["base64-to-image", "data-uri-to-image"])("%s validates bytes, MIME and actual native decode before returning original image", async id => {
    const prefix = id === "data-uri-to-image" ? "data:image/png;base64," : "", source = prefix + toBase64(rasterBytes());
    const result = await runImage(id, { source }); expect(new Uint8Array(await result.blob!.arrayBuffer())).toEqual(rasterBytes());
    decoderReject = true; await expect(runImage(id, { source })).rejects.toThrow(/decode/);
    await expect(runImage(id, { source: prefix + btoa("<svg/>") })).rejects.toThrow();
  });
  it.each(["!!!!", "Zg", "Zh==", "Zg==\nZg==", "雪", "data:image/svg+xml;base64,PHN2Zy8+"])("rejects malformed/unsafe encoded input %s", async source => {
    await expect(runImage("base64-to-image", { source })).rejects.toThrow();
  });
  it("rejects a false Data URI MIME", async () => {
    await expect(runImage("data-uri-to-image", { source: "data:image/jpeg;base64," + toBase64(rasterBytes()) })).rejects.toThrow(/MIME/);
  });
  it("reuses the shared PNG favicon fit/size contract, releases canvas and verifies signatures", async () => {
    const result = await runImage("favicon-generator", { ...values(), size: "32" }); expect(result.extension).toBe("png"); expect(rasterHeader(new Uint8Array(await result.blob!.arrayBuffer()))).toMatchObject({ width: 32, height: 32 });
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 8, 32, 16);
    expect(canvases[0].width).toBe(0);
    await expect(runImage("favicon-generator", { ...values(), size: "33" })).rejects.toThrow(/Choose/);
    await expect(runImage("favicon-generator", { ...values("image/avif"), size: "32" })).rejects.toThrow(/shared/);
  });
  it.each(["image-color-extractor", "color-palette-generator"])("%s returns deterministic alpha-aware visible clusters", async id => {
    const first = await runImage(id, { ...values(), colors: "2" }), second = await runImage(id, { ...values(), colors: "2" }); expect(first.data).toEqual(second.data);
    const output = (first.data.colors ?? first.data.palette) as { hex: string; percentage?: number }[];
    expect(output.map(color => color.hex)).toEqual(["#FF0000", "#0000FF"]); expect(output[0].percentage).toBe(id.endsWith("extractor") ? 60 : undefined);
    await expect(runImage(id, { ...values(), colors: "13" })).rejects.toThrow(/colors/); pixels = new Uint8ClampedArray([0, 0, 0, 0]); await expect(runImage(id, { ...values(), colors: "2" })).rejects.toThrow(/visible/);
  });
  it("cleans decoded bitmaps on errors before canvas creation", async () => {
    await expect(runImage("image-flipper", { ...values(), flip: "wrong" })).rejects.toThrow(); expect(close).toHaveBeenCalledOnce(); expect(canvases).toHaveLength(0);
  });
});
