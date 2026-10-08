import { ImageError } from "./types";

export const MAX_BYTES = 16 * 1024 * 1024;
export type ImageHeader = { width: number; height: number; mime: string };
export function dimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16_000_000) {
    throw new ImageError("Dimensions must be positive integers, at most 8,192 per side and 16 million pixels total.", "file");
  }
}

/** Allocation preflight only; the native decoder must also accept the complete image. */
export function rasterHeader(bytes: Uint8Array): ImageHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  let result: ImageHeader | undefined;
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b) && view.getUint32(8) === 13 && ascii(12, 4) === "IHDR") {
    result = { width: view.getUint32(16), height: view.getUint32(20), mime: "image/png" };
  } else if (bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) {
    result = { width: view.getUint16(6, true), height: view.getUint16(8, true), mime: "image/gif" };
  } else if (bytes.length >= 26 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP" && view.getUint32(4, true) + 8 === bytes.length) {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const kind = ascii(offset, 4), length = view.getUint32(offset + 4, true), data = offset + 8;
      if (data + length > bytes.length) throw new ImageError("Truncated WebP chunk.", "file");
      const u24 = (p: number) => bytes[p] | bytes[p + 1] << 8 | bytes[p + 2] << 16;
      if (kind === "VP8X" && length >= 10) result = { width: u24(data + 4) + 1, height: u24(data + 7) + 1, mime: "image/webp" };
      if (!result && kind === "VP8 " && length >= 10 && bytes[data + 3] === 157 && bytes[data + 4] === 1 && bytes[data + 5] === 42) result = { width: view.getUint16(data + 6, true) & 0x3fff, height: view.getUint16(data + 8, true) & 0x3fff, mime: "image/webp" };
      if (!result && kind === "VP8L" && length >= 5 && bytes[data] === 47) {
        const bits = view.getUint32(data + 1, true);
        result = { width: (bits & 0x3fff) + 1, height: (bits >>> 14 & 0x3fff) + 1, mime: "image/webp" };
      }
      if (result) dimensions(result.width, result.height);
      offset = data + length + (length % 2);
    }
    if (offset !== bytes.length) throw new ImageError("Invalid WebP chunk boundary.", "file");
  } else if (bytes.length >= 26 && ascii(0, 2) === "BM") {
    const size = view.getUint32(14, true);
    if (size === 12) result = { width: view.getUint16(18, true), height: view.getUint16(20, true), mime: "image/bmp" };
    else if (size >= 40 && bytes.length >= 54) result = { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)), mime: "image/bmp" };
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
        result = { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), mime: "image/jpeg" };
        break;
      }
      offset += length;
    }
  } else if (bytes.length >= 24 && ascii(4, 4) === "ftyp") {
    const firstSize = view.getUint32(0);
    if (firstSize < 16 || firstSize > bytes.length || firstSize % 4 !== 0) throw new ImageError("Invalid AVIF file-type box.", "file");
    const brands = [ascii(8, 4)];
    for (let p = 16; p < firstSize; p += 4) brands.push(ascii(p, 4));
    if (!brands.some(b => b === "avif" || b === "avis")) throw new ImageError("Unsupported image signature.", "file");
    const found: ImageHeader[] = [];
    let boxCount = 0;
    const boxes = (start: number, end: number, depth: number) => {
      if (depth > 8) throw new ImageError("AVIF box nesting exceeds the supported bound.", "file");
      let p = start;
      while (p < end) {
        if (++boxCount > 4096 || p + 8 > end) throw new ImageError("Invalid or excessive AVIF boxes.", "file");
        const size = view.getUint32(p), kind = ascii(p + 4, 4);
        // Large/zero-size boxes are not needed by this bounded static-image subset.
        if (size < 8 || p + size > end) throw new ImageError("Unsupported or truncated AVIF box.", "file");
        if (kind === "ispe") {
          if (size !== 20) throw new ImageError("Invalid AVIF dimensions.", "file");
          const item = { width: view.getUint32(p + 12), height: view.getUint32(p + 16), mime: "image/avif" };
          dimensions(item.width, item.height); found.push(item);
        } else if (["meta", "iprp", "ipco"].includes(kind)) boxes(p + 8 + (kind === "meta" ? 4 : 0), p + size, depth + 1);
        p += size;
      }
    };
    boxes(0, bytes.length, 0);
    result = found.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  }
  if (!result) throw new ImageError("Choose a supported PNG, JPEG, WebP, GIF, BMP or bounded AVIF raster image; SVG is source-only.", "file");
  dimensions(result.width, result.height);
  return result;
}

export async function readRaster(file: File): Promise<{ bytes: Uint8Array; header: ImageHeader }> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size < 1 || file.size > MAX_BYTES) throw new ImageError("Choose a nonempty local image no larger than 16 MiB.", "file");
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { throw new ImageError("The local file could not be read.", "file"); }
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.length !== file.size) throw new ImageError("Invalid image file size.", "file");
  const header = rasterHeader(bytes), type = file.type.toLowerCase();
  if (type && type !== "application/octet-stream" && type !== header.mime && !(type === "image/x-ms-bmp" && header.mime === "image/bmp")) throw new ImageError("Declared MIME type does not match the actual image signature.", "file");
  return { bytes, header };
}
