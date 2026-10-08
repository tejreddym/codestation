import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAVICON_MAX_BYTES, FAVICON_MAX_PIXELS, FAVICON_SIZES, generateFavicon } from "./favicon";

// Native decode/canvas methods are mocked. These tests verify local orchestration,
// headers, geometry and cleanup; they are not proof of real browser image decoding.
const realPng = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNN8AAAAASUVORK5CYII=", "base64"));
function png(width = 200, height = 100): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
const imageFile = (bytes = png(), type = "image/png") => new File([bytes as BlobPart], "local-image", { type });

let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
let context: { clearRect: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn>; imageSmoothingEnabled: boolean; imageSmoothingQuality: string };
let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toBlob: ReturnType<typeof vi.fn> };
let decode: ReturnType<typeof vi.fn>;
let pngBlob: Blob;

beforeEach(() => {
  bitmap = { width: 200, height: 100, close: vi.fn() };
  context = { clearRect: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: "low" };
  pngBlob = new Blob([realPng as BlobPart], { type: "image/png" });
  canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(pngBlob)) };
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  decode = vi.fn(async () => bitmap);
  vi.stubGlobal("createImageBitmap", decode);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("local favicon PNG generation with native mocks", () => {
  it("fits a landscape image, centers transparent padding and returns actual PNG Blob bytes", async () => {
    const file = imageFile();
    const result = await generateFavicon(file, 64);
    expect(decode).toHaveBeenCalledWith(file);
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 64, 64);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 16, 64, 32);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe("high");
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect(result).toEqual({ blob: pngBlob, width: 64, height: 64 });
    expect(Array.from(new Uint8Array(await result.blob.arrayBuffer()).slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("fits portrait and fractional aspect ratios without stretching", async () => {
    bitmap.width = 100;
    bitmap.height = 300;
    await generateFavicon(imageFile(png(100, 300)), 32);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, (32 - 100 * (32 / 300)) / 2, 0, 100 * (32 / 300), 32);
  });
  it.each(FAVICON_SIZES)("supports the exact output size %s", async (size) => {
    expect(await generateFavicon(imageFile(), size)).toMatchObject({ width: size, height: size });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it.each([0, 24, 128, 1024, 16.5, NaN, Infinity])( "rejects unsupported size %s before decode", async (size) => {
    await expect(generateFavicon(imageFile(), size)).rejects.toMatchObject({ field: "size" });
    expect(decode).not.toHaveBeenCalled();
  });
  it("rejects empty files and byte overflow before read/decode", async () => {
    await expect(generateFavicon(new File([], "empty.png", { type: "image/png" }), 32)).rejects.toMatchObject({ field: "file" });
    const read = vi.fn();
    await expect(generateFavicon({ size: FAVICON_MAX_BYTES + 1, arrayBuffer: read } as unknown as File, 32)).rejects.toMatchObject({ field: "file" });
    expect(read).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });
  it("bounds actual bytes even when reported size is inconsistent", async () => {
    const file = { size: 1, arrayBuffer: async () => new ArrayBuffer(FAVICON_MAX_BYTES + 1) } as unknown as File;
    await expect(generateFavicon(file, 32)).rejects.toMatchObject({ field: "file" });
    expect(decode).not.toHaveBeenCalled();
  });
  it.each([[0, 1], [8193, 1], [4001, 4000], [1, 8193]])("rejects header dimensions %s × %s before native decode", async (width, height) => {
    await expect(generateFavicon(imageFile(png(width, height)), 32)).rejects.toMatchObject({ field: "file" });
    expect(decode).not.toHaveBeenCalled();
  });
  it("accepts the exact pixel limit", async () => {
    expect(FAVICON_MAX_PIXELS).toBe(16_000_000);
    bitmap.width = 4000;
    bitmap.height = 4000;
    await generateFavicon(imageFile(png(4000, 4000)), 16);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 16, 16);
  });
  it.each(["<svg xmlns='http://www.w3.org/2000/svg'><image href='https://remote.invalid/x'/></svg>", "random text", "<html>HTML</html>"])("rejects non-raster bytes without decoding", async (source) => {
    await expect(generateFavicon(new File([source], "image.svg", { type: "image/svg+xml" }), 32)).rejects.toMatchObject({ field: "file" });
    expect(decode).not.toHaveBeenCalled();
  });
  it("rejects mismatched MIME and never decodes SVG MIME", async () => {
    await expect(generateFavicon(imageFile(png(), "image/svg+xml"), 32)).rejects.toMatchObject({ field: "file" });
    await expect(generateFavicon(imageFile(png(), "image/jpeg"), 32)).rejects.toMatchObject({ field: "file" });
    expect(decode).not.toHaveBeenCalled();
  });
  it.each(["", "application/octet-stream"])("allows sniffed raster bytes with MIME %s", async (type) => {
    expect(await generateFavicon(imageFile(png(), type), 32)).toMatchObject({ width: 32 });
  });
  it("reports local File read errors", async () => {
    const file = { size: 1, arrayBuffer: async () => { throw new Error("read error"); } } as unknown as File;
    await expect(generateFavicon(file, 32)).rejects.toThrow("could not be read");
    expect(decode).not.toHaveBeenCalled();
  });
  it("reports native decode errors without returning an output", async () => {
    decode.mockRejectedValue(new Error("bad format"));
    await expect(generateFavicon(imageFile(), 32)).rejects.toMatchObject({ field: "file" });
    expect(bitmap.close).not.toHaveBeenCalled();
    expect(canvas.toBlob).not.toHaveBeenCalled();
  });
  it("closes the bitmap for decoded dimension violations", async () => {
    bitmap.width = 9000;
    await expect(generateFavicon(imageFile(), 32)).rejects.toMatchObject({ field: "file" });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("closes the bitmap when canvas is unavailable", async () => {
    canvas.getContext.mockReturnValue(null);
    await expect(generateFavicon(imageFile(), 32)).rejects.toThrow("unavailable");
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("closes the bitmap when drawing throws", async () => {
    context.drawImage.mockImplementation(() => { throw new Error("drawing failed"); });
    await expect(generateFavicon(imageFile(), 32)).rejects.toMatchObject({ field: "file" });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it.each([null, new Blob([], { type: "image/png" }), new Blob(["x"], { type: "image/jpeg" })])("rejects failed/wrong PNG encoding and closes the bitmap", async (blob) => {
    canvas.toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(blob));
    await expect(generateFavicon(imageFile(), 32)).rejects.toThrow("encode a PNG");
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("closes the bitmap when PNG encoding throws", async () => {
    canvas.toBlob.mockImplementation(() => { throw new Error("encoding failure"); });
    await expect(generateFavicon(imageFile(), 32)).rejects.toMatchObject({ field: "file" });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("never fetches or persists the input", async () => {
    const fetch = vi.fn();
    const localStorage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", localStorage);
    await generateFavicon(imageFile(), 32);
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});

describe("supported raster header fixtures (decoder mocked)", () => {
  it("reads GIF dimensions", async () => {
    const bytes = new Uint8Array(13);
    bytes.set(Buffer.from("GIF89a"));
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 200, true); view.setUint16(8, 100, true);
    await generateFavicon(imageFile(bytes, "image/gif"), 16);
    expect(decode).toHaveBeenCalledOnce();
  });
  it("reads baseline/progressive JPEG dimensions past metadata", async () => {
    const bytes = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 194, 0, 17, 8, 0, 100, 0, 200, 3, 1, 0, 0, 2, 0, 0, 3, 0, 0, 255, 217]);
    await generateFavicon(imageFile(bytes, "image/jpeg"), 16);
    expect(decode).toHaveBeenCalledOnce();
  });
  it("rejects malformed/truncated JPEG marker segments", async () => {
    await expect(generateFavicon(imageFile(new Uint8Array([255, 216, 255, 224, 255, 255, 0]), "image/jpeg"), 16)).rejects.toMatchObject({ field: "file" });
    expect(decode).not.toHaveBeenCalled();
  });
  it("reads top-down BMP dimensions", async () => {
    const bytes = new Uint8Array(54);
    bytes.set([66, 77]);
    const view = new DataView(bytes.buffer);
    view.setUint32(14, 40, true); view.setInt32(18, 200, true); view.setInt32(22, -100, true);
    await generateFavicon(imageFile(bytes, "image/bmp"), 16);
    expect(decode).toHaveBeenCalledOnce();
  });
  it("reads compact BMP dimensions", async () => {
    const bytes = new Uint8Array(26);
    bytes.set([66, 77]);
    const view = new DataView(bytes.buffer);
    view.setUint32(14, 12, true); view.setUint16(18, 200, true); view.setUint16(20, 100, true);
    await generateFavicon(imageFile(bytes, "image/x-ms-bmp"), 16);
    expect(decode).toHaveBeenCalledOnce();
  });
  it.each(["VP8X", "VP8 ", "VP8L"])("reads WebP %s dimensions", async (format) => {
    const bytes = new Uint8Array(30);
    bytes.set(Buffer.from("RIFF"), 0); bytes.set(Buffer.from("WEBP"), 8); bytes.set(Buffer.from(format), 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 10, true);
    if (format === "VP8X") { bytes[24] = 199; bytes[27] = 99; }
    if (format === "VP8 ") { bytes.set([157, 1, 42], 23); view.setUint16(26, 200, true); view.setUint16(28, 100, true); }
    if (format === "VP8L") { bytes[20] = 47; view.setUint32(21, 199 | (99 << 14), true); }
    await generateFavicon(imageFile(bytes, "image/webp"), 16);
    expect(decode).toHaveBeenCalledOnce();
  });
});

describe("Image/object URL fallback cleanup (native mocks)", () => {
  function fallback(error = false, width = 200, height = 100) {
    vi.stubGlobal("createImageBitmap", undefined);
    const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-raster");
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let instance: MockImage;
    class MockImage {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      removeAttribute = vi.fn();
      constructor() { instance = this; }
      set src(value: string) {
        if (value) queueMicrotask(() => error ? this.onerror?.() : this.onload?.());
      }
    }
    vi.stubGlobal("Image", MockImage);
    return { created, revoked, get instance() { return instance!; } };
  }
  it("uses only a local object URL and revokes it after successful encoding", async () => {
    const mocks = fallback();
    const file = imageFile();
    const result = await generateFavicon(file, 32);
    expect(result.blob.type).toBe("image/png");
    expect(mocks.created).toHaveBeenCalledWith(file);
    expect(mocks.revoked).toHaveBeenCalledExactlyOnceWith("blob:local-raster");
    expect(mocks.instance.onload).toBeNull();
    expect(mocks.instance.onerror).toBeNull();
    expect(mocks.instance.removeAttribute).toHaveBeenCalledWith("src");
    expect(context.drawImage).toHaveBeenCalledWith(mocks.instance, 0, 8, 32, 16);
  });
  it("revokes URLs on decode errors", async () => {
    const mocks = fallback(true);
    await expect(generateFavicon(imageFile(), 32)).rejects.toThrow("decode this image");
    expect(mocks.revoked).toHaveBeenCalledOnce();
    expect(mocks.instance.onload).toBeNull();
    expect(mocks.instance.onerror).toBeNull();
  });
  it("revokes URLs on canvas encode errors", async () => {
    const mocks = fallback();
    canvas.toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(null));
    await expect(generateFavicon(imageFile(), 32)).rejects.toThrow("encode a PNG");
    expect(mocks.revoked).toHaveBeenCalledOnce();
  });
  it("revokes URLs when decoded dimensions exceed limits", async () => {
    const mocks = fallback(false, 9000, 9000);
    await expect(generateFavicon(imageFile(), 32)).rejects.toMatchObject({ field: "file" });
    expect(mocks.revoked).toHaveBeenCalledOnce();
  });
  it("revokes the URL even when constructing Image fails", async () => {
    const mocks = fallback();
    vi.stubGlobal("Image", class { constructor() { throw new Error("unavailable"); } });
    await expect(generateFavicon(imageFile(), 32)).rejects.toMatchObject({ field: "file" });
    expect(mocks.revoked).toHaveBeenCalledOnce();
  });
});
