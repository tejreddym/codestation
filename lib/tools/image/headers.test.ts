import { describe, expect, it, vi } from "vitest";
import { dimensions, MAX_BYTES, rasterHeader, readRaster } from "./headers";
import { avifBytes, imageFile, rasterBytes } from "./test-fixtures";

describe("image allocation/signature preflight (synthetic headers, not native decoder proof)", () => {
  it.each(["image/png", "image/jpeg", "image/webp", "image/avif"])("reads genuine %s signature independent of a filename", async mime => {
    expect((await readRaster(imageFile(mime))).header).toEqual({ mime, width: 4, height: 2 });
  });
  it.each([[0, 1], [1, 0], [-1, 2], [1.1, 1], [8193, 1], [4001, 4000], [Infinity, 1], [NaN, 1]])("rejects dimensions %s×%s", (w, h) => expect(() => dimensions(w, h)).toThrow());
  it.each([[8192, 1], [4000, 4000], [1, 1]])("accepts bounds %s×%s", (w, h) => expect(() => dimensions(w, h)).not.toThrow());
  it.each(["image/png", "image/jpeg", "image/webp", "image/avif"])("bounds %s before native allocation", mime => {
    expect(() => rasterHeader(mime === "image/avif" ? avifBytes(8193, 1) : rasterBytes(mime, 8193, 1))).toThrow(/Dimensions/);
  });
  it("rejects MIME mismatches and a spoofed filename", async () => {
    await expect(readRaster(new File([rasterBytes()], "jpg.jpg", { type: "image/jpeg" }))).rejects.toThrow(/MIME/);
    await expect(readRaster(new File(["<svg/>"], "safe.png", { type: "image/png" }))).rejects.toThrow(/supported/);
  });
  it("rejects empty, oversized and broken file reads", async () => {
    await expect(readRaster(new File([], "empty"))).rejects.toThrow(/nonempty/);
    const arrayBuffer = vi.fn();
    await expect(readRaster({ size: MAX_BYTES + 1, arrayBuffer } as unknown as File)).rejects.toThrow(/16 MiB/); expect(arrayBuffer).not.toHaveBeenCalled();
    await expect(readRaster({ size: 1, arrayBuffer: () => Promise.reject(new Error("failed")) } as unknown as File)).rejects.toThrow(/read/);
  });
  it("rejects truncated WebP boxes and misleading RIFF size", () => {
    const bytes = rasterBytes("image/webp"); new DataView(bytes.buffer).setUint32(16, 1000, true);
    expect(() => rasterHeader(bytes)).toThrow(/Truncated/);
    expect(() => rasterHeader(rasterBytes("image/webp").slice(0, 29))).toThrow();
  });
  it("supports WebP lossless and lossy dimension encodings", () => {
    const lossless = new Uint8Array(26), v = new DataView(lossless.buffer); lossless.set([..."RIFF"].map(c => c.charCodeAt(0))); v.setUint32(4, 18, true); lossless.set([..."WEBPVP8L"].map(c => c.charCodeAt(0)), 8); v.setUint32(16, 5, true); lossless[20] = 47; v.setUint32(21, 3 | 1 << 14, true);
    expect(rasterHeader(lossless)).toEqual({ mime: "image/webp", width: 4, height: 2 });
    const lossy = rasterBytes("image/webp"); lossy.set([..."VP8 "].map(c => c.charCodeAt(0)), 12); lossy.set([157, 1, 42], 23); new DataView(lossy.buffer).setUint16(26, 4, true); new DataView(lossy.buffer).setUint16(28, 2, true);
    expect(rasterHeader(lossy).width).toBe(4);
  });
  it("reads GIF and BMP headers and rejects missing/truncated JPEG SOF", () => {
    const gif = new Uint8Array(13); gif.set([..."GIF89a"].map(c => c.charCodeAt(0))); new DataView(gif.buffer).setUint16(6, 4, true); new DataView(gif.buffer).setUint16(8, 2, true); expect(rasterHeader(gif).mime).toBe("image/gif");
    const bmp = new Uint8Array(54); bmp.set([66, 77]); const v = new DataView(bmp.buffer); v.setUint32(14, 40, true); v.setInt32(18, 4, true); v.setInt32(22, -2, true); expect(rasterHeader(bmp).height).toBe(2);
    expect(() => rasterHeader(rasterBytes("image/jpeg").slice(0, 8))).toThrow();
  });
  it("requires bounded AVIF dimensions and validated box boundaries/brands", () => {
    const malformed = avifBytes(); new DataView(malformed.buffer).setUint32(52, 1000); expect(() => rasterHeader(malformed)).toThrow(/truncated/);
    const unknown = avifBytes(); unknown[11] = 120; unknown[19] = 120; expect(() => rasterHeader(unknown)).toThrow(/signature/);
    const noDimensions = avifBytes(); noDimensions[56] = 120; expect(() => rasterHeader(noDimensions)).toThrow(/supported/);
  });
});
