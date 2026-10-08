import { WebError } from "./types";

export const FAVICON_SIZES = [16, 32, 48, 64, 180, 192, 512] as const;
export const FAVICON_MAX_BYTES = 16 * 1024 * 1024;
export const FAVICON_MAX_PIXELS = 16_000_000;
const MAX_DIMENSION = 8_192;

function dimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > FAVICON_MAX_PIXELS) {
    throw new WebError("Image dimensions must be positive, at most 8,192 per side and 16 million pixels total.", "file");
  }
}

/** Check a raster header before decoding to bound the native decoder allocation. */
function rasterHeader(bytes: Uint8Array): { width: number; height: number; mime: string } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 33 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]) && view.getUint32(8) === 13 && ascii(12, 4) === "IHDR") {
    return { width: view.getUint32(16), height: view.getUint32(20), mime: "image/png" };
  }
  if (bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) return { width: view.getUint16(6, true), height: view.getUint16(8, true), mime: "image/gif" };
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const format = ascii(12, 4);
    const uint24 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    if (format === "VP8X" && view.getUint32(16, true) >= 10) return { width: uint24(24) + 1, height: uint24(27) + 1, mime: "image/webp" };
    if (format === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff, mime: "image/webp" };
    if (format === "VP8L" && bytes[20] === 47) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, mime: "image/webp" };
    }
  }
  if (bytes.length >= 26 && ascii(0, 2) === "BM") {
    const headerSize = view.getUint32(14, true);
    if (headerSize === 12) return { width: view.getUint16(18, true), height: view.getUint16(20, true), mime: "image/bmp" };
    if (headerSize >= 40 && bytes.length >= 54) return { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)), mime: "image/bmp" };
  }
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (offset < bytes.length && bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), mime: "image/jpeg" };
      }
      offset += length;
    }
  }
  throw new WebError("Choose a PNG, JPEG, GIF, WebP or BMP raster image. SVG and other formats are not supported.", "file");
}

async function fallbackImage(file: File): Promise<{ image: HTMLImageElement; release: () => void }> {
  const objectUrl = URL.createObjectURL(file);
  let image: HTMLImageElement | undefined;
  try {
    image = new Image();
    const decoded = image;
    await new Promise<void>((resolve, reject) => {
      decoded.onload = () => resolve();
      decoded.onerror = () => reject(new WebError("The browser could not decode this image.", "file"));
      decoded.src = objectUrl;
    });
    return { image: decoded, release: () => { decoded.onload = null; decoded.onerror = null; decoded.removeAttribute("src"); URL.revokeObjectURL(objectUrl); } };
  } catch (error) {
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
    }
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/** Browser-only raster-to-PNG conversion. No uploads, remote resources or ICO claims. */
export async function generateFavicon(file: File, size: number): Promise<{ blob: Blob; width: number; height: number }> {
  if (!(FAVICON_SIZES as readonly number[]).includes(size)) throw new WebError("Choose a supported PNG size: 16, 32, 48, 64, 180, 192 or 512.", "size");
  if (!file || typeof file.arrayBuffer !== "function" || file.size < 1 || file.size > FAVICON_MAX_BYTES) throw new WebError("Choose a nonempty raster file no larger than 16 MiB.", "file");
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { throw new WebError("The local image file could not be read.", "file"); }
  if (bytes.length < 1 || bytes.length > FAVICON_MAX_BYTES) throw new WebError("Choose a nonempty raster file no larger than 16 MiB.", "file");
  const header = rasterHeader(bytes);
  dimensions(header.width, header.height);
  if (file.type && file.type !== "application/octet-stream" && file.type.toLowerCase() !== header.mime && !(file.type === "image/x-ms-bmp" && header.mime === "image/bmp")) throw new WebError("The image MIME type does not match its raster bytes.", "file");
  let source: CanvasImageSource;
  let width: number, height: number;
  let release = () => {};
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
      release = () => bitmap.close();
    } else {
      const decoded = await fallbackImage(file);
      source = decoded.image;
      width = decoded.image.naturalWidth;
      height = decoded.image.naturalHeight;
      release = decoded.release;
    }
    dimensions(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new WebError("Canvas image processing is unavailable in this browser.", "file");
    context.clearRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const scale = Math.min(size / width, size / height);
    const fittedWidth = width * scale, fittedHeight = height * scale;
    context.drawImage(source, (size - fittedWidth) / 2, (size - fittedHeight) / 2, fittedWidth, fittedHeight);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob && blob.size > 0 && blob.type === "image/png" ? resolve(blob) : reject(new WebError("The browser could not encode a PNG image.", "file")), "image/png"));
    return { blob, width: size, height: size };
  } catch (error) {
    if (error instanceof WebError) throw error;
    throw new WebError("The browser could not decode or process this raster image.", "file");
  } finally { release(); }
}
