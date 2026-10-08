import { ImageError } from "./types";

/** Actual JPEG EXIF fields only. Deliberately bounded TIFF subset, not a camera/database inference. */
export function jpegExif(bytes: Uint8Array): Record<string, unknown> {
  if (bytes[0] !== 255 || bytes[1] !== 216) return {};
  const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 2;
  while (position + 4 <= bytes.length) {
    if (bytes[position++] !== 255) break;
    while (bytes[position] === 255) position++;
    const marker = bytes[position++];
    if (marker === 218 || marker === 217) break;
    if (marker === 1 || marker >= 208 && marker <= 215) continue;
    if (position + 2 > bytes.length) break;
    const length = source.getUint16(position);
    if (length < 2 || position + length > bytes.length) break;
    const start = position + 2;
    if (marker === 225 && length >= 16 && [69, 120, 105, 102, 0, 0].every((b, i) => bytes[start + i] === b)) {
      return tiff(bytes.subarray(start + 6, position + length));
    }
    position += length;
  }
  return {};
}

function tiff(bytes: Uint8Array): Record<string, unknown> {
  const fail = (): never => { throw new ImageError("JPEG EXIF contains malformed or unsupported bounded TIFF metadata.", "file"); };
  if (bytes.length < 8 || !((bytes[0] === 73 && bytes[1] === 73) || (bytes[0] === 77 && bytes[1] === 77))) fail();
  const little = bytes[0] === 73, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bound = (offset: number, size: number) => { if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > bytes.length) fail(); };
  const u16 = (offset: number) => { bound(offset, 2); return view.getUint16(offset, little); };
  const u32 = (offset: number) => { bound(offset, 4); return view.getUint32(offset, little); };
  if (u16(2) !== 42) fail();
  const tags: Record<number, string> = { 0x010f: "make", 0x0110: "model", 0x0112: "orientation", 0x011a: "xResolution", 0x011b: "yResolution", 0x0128: "resolutionUnit", 0x0131: "software", 0x0132: "dateTime", 0x013b: "artist", 0x8298: "copyright", 0x829a: "exposureTime", 0x829d: "fNumber", 0x8827: "iso", 0x9003: "dateTimeOriginal", 0x9004: "dateTimeDigitized", 0x920a: "focalLength", 0xa002: "pixelXDimension", 0xa003: "pixelYDimension" };
  const result: Record<string, unknown> = {}, visited = new Set<number>();
  let entries = 0;
  const directory = (offset: number, depth: number) => {
    if (depth > 2 || visited.has(offset) || offset < 8) fail();
    visited.add(offset);
    const count = u16(offset);
    entries += count;
    if (entries > 512) fail();
    bound(offset + 2, count * 12 + 4);
    for (let i = 0; i < count; i++) {
      const entry = offset + 2 + i * 12, tag = u16(entry), type = u16(entry + 2), count = u32(entry + 4);
      if (tag === 0x8769) {
        if (type !== 4 || count !== 1) fail();
        directory(u32(entry + 8), depth + 1); continue;
      }
      if (!tags[tag]) continue;
      const size = ({ 2: 1, 3: 2, 4: 4, 5: 8 } as Record<number, number>)[type];
      if (!size || count < 1 || count > 4096 || size * count > 4096) fail();
      const data = size * count <= 4 ? entry + 8 : u32(entry + 8);
      bound(data, size * count);
      let value: unknown;
      if (type === 2) {
        const text = bytes.subarray(data, data + count);
        if (text[text.length - 1] !== 0 || text.some(b => b > 127)) fail();
        value = String.fromCharCode(...text.subarray(0, text.length - 1));
      } else if (count !== 1) fail();
      else if (type === 3) value = u16(data);
      else if (type === 4) value = u32(data);
      else {
        const numerator = u32(data), denominator = u32(data + 4);
        if (!denominator) fail();
        value = { numerator, denominator };
      }
      if (Object.hasOwn(result, tags[tag])) fail();
      result[tags[tag]] = value;
    }
    // Only the primary directory and its explicit EXIF subdirectory are read;
    // thumbnail and GPS directories are not interpreted or reported as absent.
  };
  directory(u32(4), 0);
  return result;
}
