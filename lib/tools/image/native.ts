import { dimensions, rasterHeader } from "./headers";
import { ImageError } from "./types";

export type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };
/** Native EXIF orientation is applied once; do not manually rotate the decoded pixels. */
export async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" }); }
    catch { throw new ImageError("This browser could not decode the image. AVIF requires genuine native decoder support.", "file"); }
    try { dimensions(bitmap.width, bitmap.height); }
    catch (error) { bitmap.close(); throw error; }
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") throw new ImageError("Native image decoding is unavailable.", "file");
  const url = URL.createObjectURL(blob), image = new Image();
  const release = () => { image.onload = null; image.onerror = null; image.removeAttribute("src"); URL.revokeObjectURL(url); };
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new ImageError("This browser could not decode the image, including unsupported AVIF.", "file")); image.src = url;
    });
    dimensions(image.naturalWidth, image.naturalHeight);
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release };
  } catch (error) { release(); throw error; }
}

export function canvasFor(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; release: () => void } {
  dimensions(width, height);
  if (typeof document === "undefined") throw new ImageError("Canvas processing requires a browser.", "file");
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const release = () => { canvas.width = 0; canvas.height = 0; };
  let context: CanvasRenderingContext2D | null;
  try { context = canvas.getContext("2d", { willReadFrequently: true }); }
  catch { release(); throw new ImageError("Canvas processing is unavailable.", "file"); }
  if (!context) { release(); throw new ImageError("Canvas processing is unavailable.", "file"); }
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  return { canvas, context, release };
}

export async function verifyOutput(blob: Blob, mime: string, width: number, height: number): Promise<void> {
  if (!blob || blob.type !== mime || blob.size < 1) throw new ImageError(`This browser cannot encode ${mime}; no fallback format was returned.`, "format");
  const actual = rasterHeader(new Uint8Array(await blob.arrayBuffer()));
  if (actual.mime !== mime || actual.width !== width || actual.height !== height) throw new ImageError("The native encoder returned a different signature or dimensions; download rejected.", "format");
}

export async function encode(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  let blob: Blob;
  try { blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new ImageError("Native encoding failed.", "format")), mime, quality)); }
  catch (error) { if (error instanceof ImageError) throw error; throw new ImageError("Native encoding failed.", "format"); }
  await verifyOutput(blob, mime, canvas.width, canvas.height);
  return blob;
}
