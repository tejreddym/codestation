import { MAX_BYTES, rasterHeader } from "./headers";
import { ImageError } from "./types";

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let p = 0; p < bytes.length; p += 8192) binary += String.fromCharCode(...bytes.subarray(p, p + 8192));
  return btoa(binary);
}

export function fromBase64(source: string, dataUri: boolean): File {
  if (typeof source !== "string" || source.length > Math.ceil(MAX_BYTES / 3) * 4 + 100) throw new ImageError("Encoded image exceeds the 16 MiB byte limit.", "source");
  let encoded = source.trim(), declared: string | undefined;
  if (dataUri) {
    const match = /^data:(image\/(?:png|jpeg|webp|gif|bmp|avif));base64,([\s\S]*)$/i.exec(encoded);
    if (!match) throw new ImageError("Use a base64 raster Data URI with an explicit supported image MIME; SVG is rejected.", "source");
    declared = match[1].toLowerCase(); encoded = match[2];
  }
  if (!encoded || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new ImageError("Enter canonical standard base64 with correct padding and no internal whitespace.", "source");
  let binary: string;
  try { binary = atob(encoded); } catch { throw new ImageError("Invalid base64 encoding.", "source"); }
  if (!binary.length || binary.length > MAX_BYTES || btoa(binary) !== encoded) throw new ImageError("Noncanonical base64 or oversized image.", "source");
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const header = rasterHeader(bytes);
  if (declared && declared !== header.mime) throw new ImageError("Data URI MIME does not match the actual raster signature.", "source");
  return new File([bytes], "decoded-image", { type: header.mime });
}
