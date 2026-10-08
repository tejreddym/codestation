/** Synthetic headers for adapter unit tests; these are NOT real native-decodable image fixtures. */
export function rasterBytes(mime = "image/png", width = 4, height = 2): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(mime === "image/webp" ? 30 : mime === "image/jpeg" ? 14 : 33);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => bytes.set(Array.from(text, c => c.charCodeAt(0)), offset);
  if (mime === "image/png") {
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); view.setUint32(8, 13); ascii(12, "IHDR"); view.setUint32(16, width); view.setUint32(20, height);
  } else if (mime === "image/jpeg") {
    bytes.set([255, 216, 255, 192, 0, 8, 8]); view.setUint16(7, height); view.setUint16(9, width); bytes.set([255, 217], 12);
  } else if (mime === "image/webp") {
    ascii(0, "RIFF"); view.setUint32(4, 22, true); ascii(8, "WEBP"); ascii(12, "VP8X"); view.setUint32(16, 10, true);
    for (let i = 0; i < 3; i++) { bytes[24 + i] = (width - 1) >>> (i * 8) & 255; bytes[27 + i] = (height - 1) >>> (i * 8) & 255; }
  }
  return bytes;
}
export function avifBytes(width = 4, height = 2): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(72), view = new DataView(bytes.buffer);
  const box = (offset: number, length: number, kind: string) => { view.setUint32(offset, length); bytes.set(Array.from(kind, c => c.charCodeAt(0)), offset + 4); };
  box(0, 24, "ftyp"); bytes.set([97, 118, 105, 102], 8); bytes.set([97, 118, 105, 102], 16); bytes.set([109, 105, 102, 49], 20);
  box(24, 48, "meta"); box(36, 36, "iprp"); box(44, 28, "ipco"); box(52, 20, "ispe"); view.setUint32(64, width); view.setUint32(68, height);
  return bytes;
}
export function imageFile(mime = "image/png", width = 4, height = 2): File {
  return new File([mime === "image/avif" ? avifBytes(width, height) : rasterBytes(mime, width, height)], "雪🌈.image", { type: mime });
}
