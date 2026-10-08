import { FAVICON_SIZES } from "../web/favicon";
import { fromBase64, toBase64 } from "./base64";
import { dimensions, MAX_BYTES, readRaster } from "./headers";
import { canvasFor, decode, encode, type Decoded } from "./native";
import { extractPalette } from "./palette";
import { jpegExif } from "./metadata";
import { svgRasterSource, svgText } from "./svg";
import { ImageError, type ImageResult, type ImageValues } from "./types";

const extension = (mime: string) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/bmp": "bmp", "image/avif": "avif" })[mime];
const metadataWarning = "Native EXIF orientation is applied to decoded pixels. Re-encoding removes source EXIF, GPS and other metadata; animation is flattened to a native-decoded frame. Color management follows the browser.";
function string(values: ImageValues, key: string, fallback = ""): string {
  const value = values[key];
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new ImageError(`Enter a valid ${key}.`, key);
  return value;
}
function integer(value: string, key: string, min: number, max: number): number {
  if (!/^\d+$/.test(value.trim())) throw new ImageError(`${key} must be a whole number from ${min} to ${max}.`, key);
  const n = Number(value); if (!Number.isSafeInteger(n) || n < min || n > max) throw new ImageError(`${key} must be from ${min} to ${max}.`, key);
  return n;
}
function quality(values: ImageValues): number { return integer(string(values, "quality", "85"), "quality", 1, 100) / 100; }
function background(values: ImageValues, mime: string): string {
  const value = string(values, "background", mime === "image/jpeg" ? "#FFFFFF" : "transparent");
  if (value !== "transparent" && !/^#[\da-f]{6}$/i.test(value)) throw new ImageError("Background must be transparent or a six-digit hex color.", "background");
  if (mime === "image/jpeg" && value === "transparent") throw new ImageError("JPEG cannot preserve transparency. Choose a hex background color.", "background");
  return value;
}
function format(values: ImageValues): string {
  const mime = string(values, "format", "image/jpeg");
  if (!["image/jpeg", "image/webp"].includes(mime)) throw new ImageError("Choose JPEG or WebP; PNG quality and AVIF encoding are not supported.", "format");
  return mime;
}
async function open(file: File): Promise<{ decoded: Decoded; bytes: Uint8Array; mime: string }> {
  const { bytes, header } = await readRaster(file);
  return { decoded: await decode(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: header.mime })), bytes, mime: header.mime };
}

async function svgInput(values: ImageValues): Promise<string> {
  const source = string(values, "source");
  if (!values.file) return source;
  if (source.trim()) throw new ImageError("Choose either SVG source text or one local SVG file.", "source");
  const file = values.file as File;
  if (!file || typeof file.arrayBuffer !== "function" || !file.size || file.size > MAX_BYTES) throw new ImageError("Choose a nonempty local SVG no larger than 16 MiB.", "file");
  if (file.type && !["image/svg+xml", "application/octet-stream"].includes(file.type.toLowerCase())) throw new ImageError("Choose an SVG source file.", "file");
  try {
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength !== file.size || bytes.byteLength > MAX_BYTES) throw new Error("Invalid file size");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch { throw new ImageError("The SVG file must be readable UTF-8 text within the file bound.", "file"); }
}

export async function inspectImage(file: File): Promise<{ width: number; height: number; mime: string }> {
  if (file && (file.type.toLowerCase() === "image/svg+xml" || /\.svg$/i.test(file.name))) {
    const svg = svgRasterSource(await svgInput({ file }));
    const decoded = await decode(new Blob([svg.text], { type: "image/svg+xml" }));
    try {
      if (decoded.width !== svg.width || decoded.height !== svg.height) throw new ImageError("Native SVG dimensions differ from sanitized bounds.", "file");
      return { width: svg.width, height: svg.height, mime: "image/svg+xml" };
    } finally { decoded.release(); }
  }
  const { decoded, mime } = await open(file);
  try { return { width: decoded.width, height: decoded.height, mime }; }
  finally { decoded.release(); }
}

/** All processing is local. Result data is inert; preview/download lifecycle belongs to the caller. */
export async function runImage(id: string, values: ImageValues): Promise<ImageResult> {
  if (id === "svg-formatter" || id === "svg-minifier") {
    const text = svgText(await svgInput(values), id === "svg-formatter");
    return { text, data: { [id === "svg-formatter" ? "formattedSvg" : "minifiedSvg"]: text } };
  }
  // There is deliberately no AVIF encoder branch or generic output format allowing AVIF.
  const conversion = /^(png|jpg|jpeg|webp|avif|svg)-to-(png|jpg|jpeg|webp)$/.exec(id);
  const mimeFor = (name: string) => `image/${name === "jpg" ? "jpeg" : name}`;
  const supported = new Set(["image-compressor", "image-quality-adjuster", "image-resizer", "image-cropper", "image-rotator", "image-flipper", "image-inspector", "image-dimension-inspector", "image-metadata-viewer", "image-metadata", "image-to-base64", "base64-to-image", "image-to-data-uri", "data-uri-to-image", "favicon-generator", "image-color-extractor", "color-extractor", "image-palette-generator", "color-palette-generator"]);
  if (!conversion && !supported.has(id)) throw new ImageError("Unsupported Image tool or unverified encoder.");
  if (conversion && (conversion[1] === conversion[2] || conversion[1] === "avif" && conversion[2] === "webp")) throw new ImageError("Unsupported directional image conversion.");
  let decoded: Decoded | undefined;
  let bytes: Uint8Array | undefined;
  let inputMime = "image/svg+xml";
  let file: File;
  try {
    if (conversion?.[1] === "svg") {
      const widthString = string(values, "width"), heightString = string(values, "height");
      const svg = svgRasterSource(await svgInput(values), widthString ? integer(widthString, "width", 1, 8192) : undefined, heightString ? integer(heightString, "height", 1, 8192) : undefined);
      decoded = await decode(new Blob([svg.text], { type: "image/svg+xml" }));
      if (decoded.width !== svg.width || decoded.height !== svg.height) throw new ImageError("Native SVG decoder returned unexpected dimensions.", "source");
    } else {
      file = id === "base64-to-image" || id === "data-uri-to-image" ? fromBase64(string(values, "source"), id === "data-uri-to-image") : values.file as File;
      const opened = await open(file); decoded = opened.decoded; bytes = opened.bytes; inputMime = opened.mime;
      if (conversion && inputMime !== mimeFor(conversion[1])) throw new ImageError(`Choose a genuine ${conversion[1].toUpperCase()} image for this directional converter.`, "file");
      if (id === "base64-to-image" || id === "data-uri-to-image") return { blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: inputMime }), extension: extension(inputMime), data: { mimeType: inputMime, dimensions: { width: decoded.width, height: decoded.height } } };
      if (id === "image-to-base64" || id === "image-to-data-uri") {
        const encoded = toBase64(bytes), text = id === "image-to-base64" ? encoded : `data:${inputMime};base64,${encoded}`;
        return { text, data: { ...(id === "image-to-base64" ? { base64: encoded } : {}), dataUri: `data:${inputMime};base64,${encoded}`, mimeType: inputMime, fileSize: bytes.length } };
      }
      if (["image-inspector", "image-dimension-inspector", "image-metadata-viewer", "image-metadata"].includes(id)) {
        const data = { width: decoded.width, height: decoded.height, mime: inputMime, fileSize: bytes.length, fileName: file.name };
        if (id === "image-dimension-inspector") {
          const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
          const divisor = gcd(decoded.width, decoded.height);
          return { data: { width: decoded.width, height: decoded.height, aspectRatio: `${decoded.width / divisor}:${decoded.height / divisor}`, megapixels: decoded.width * decoded.height / 1_000_000 } };
        }
        return id === "image-inspector" ? { data } : { data: { fileName: file.name, mimeType: inputMime, fileSize: bytes.length, width: decoded.width, height: decoded.height, metadata: jpegExif(bytes) }, warnings: ["Only actual file properties, signature, native-decoded dimensions and supported JPEG EXIF fields are reported. Empty EXIF means no supported fields were found; GPS, thumbnails, maker notes and other formats' metadata are not parsed or inferred."] };
      }
      if (id === "favicon-generator") {
        const size = integer(string(values, "size", "32"), "size", 16, 512);
        if (!(FAVICON_SIZES as readonly number[]).includes(size)) throw new ImageError("Choose 16, 32, 48, 64, 180, 192 or 512 for the PNG favicon.", "size");
        if (inputMime === "image/avif") throw new ImageError("The shared favicon processor supports PNG, JPEG, WebP, GIF and BMP only.", "file");
      }
    }
    if (!decoded) throw new ImageError("Image decode failed.", "file");
    const isPalette = ["image-color-extractor", "color-extractor", "image-palette-generator", "color-palette-generator"].includes(id);
    if (isPalette) {
      const count = integer(string(values, "colors", "6"), "colors", 2, 12);
      const scale = Math.min(1, 128 / Math.max(decoded.width, decoded.height));
      const { canvas, context, release } = canvasFor(Math.max(1, Math.round(decoded.width * scale)), Math.max(1, Math.round(decoded.height * scale)));
      try {
        context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
        const swatches = extractPalette(context.getImageData(0, 0, canvas.width, canvas.height).data, count);
        const extractor = id.endsWith("extractor");
        return { data: { [extractor ? "colors" : "palette"]: extractor ? swatches : swatches.map(({ hex, rgb }) => ({ hex, rgb })) }, warnings: ["Deterministic sampled alpha-weighted RGB clusters; colors and percentages are approximate, and fewer colors may exist than requested."] };
      } finally { release(); }
    }
    let mime = conversion ? mimeFor(conversion[2]) : ["image-compressor", "image-quality-adjuster"].includes(id) ? format(values) : "image/png";
    const q = quality(values), bg = background(values, mime);
    const sourceWidth = decoded.width, sourceHeight = decoded.height;
    let width = sourceWidth, height = sourceHeight;
    if (id === "favicon-generator") width = height = Number(values.size ?? "32");
    let crop = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
    if (id === "image-resizer") {
      const ws = string(values, "width"), hs = string(values, "height");
      if (typeof values.lockAspect !== "boolean") throw new ImageError("Choose whether to lock the aspect ratio.", "lockAspect");
      if (!ws && !hs) throw new ImageError("Enter a target width or height.", "width");
      if (values.lockAspect) {
        if (ws) { width = integer(ws, "width", 1, 8192); height = Math.max(1, Math.round(width * sourceHeight / sourceWidth)); }
        else { height = integer(hs, "height", 1, 8192); width = Math.max(1, Math.round(height * sourceWidth / sourceHeight)); }
        if (ws && hs && integer(hs, "height", 1, 8192) !== height) throw new ImageError("Width and height disagree with the locked aspect ratio.", "height");
      } else { width = integer(ws, "width", 1, 8192); height = integer(hs, "height", 1, 8192); }
    }
    if (id === "image-cropper") {
      const raw = values.crop;
      if (!raw || typeof raw !== "object") throw new ImageError("Provide a crop rectangle.", "crop");
      const c = raw as Record<string, unknown>;
      for (const key of ["x", "y", "width", "height"]) if (typeof c[key] !== "number" || !Number.isInteger(c[key]) || Number(c[key]) < (key === "x" || key === "y" ? 0 : 1)) throw new ImageError("Crop values must be integer pixels with positive width/height.", "crop");
      crop = { x: c.x as number, y: c.y as number, width: c.width as number, height: c.height as number };
      if (crop.x + crop.width > sourceWidth || crop.y + crop.height > sourceHeight) throw new ImageError("Crop rectangle must fit the oriented source image.", "crop");
      width = crop.width; height = crop.height;
    }
    let angle = 0;
    if (id === "image-rotator") {
      const rotation = string(values, "rotation");
      if (!["clockwise", "counter-clockwise", "180"].includes(rotation)) throw new ImageError("Choose clockwise, counter-clockwise or 180.", "rotation");
      angle = rotation === "clockwise" ? Math.PI / 2 : rotation === "counter-clockwise" ? -Math.PI / 2 : Math.PI;
      if (rotation !== "180") { width = sourceHeight; height = sourceWidth; }
    }
    const flip = id === "image-flipper" ? string(values, "flip") : "";
    if (id === "image-flipper" && !["Horizontal", "Vertical"].includes(flip)) throw new ImageError("Choose Horizontal or Vertical.", "flip");
    dimensions(width, height);
    const { canvas, context, release } = canvasFor(width, height);
    try {
      context.clearRect(0, 0, width, height);
      if (bg !== "transparent") { context.fillStyle = bg; context.fillRect(0, 0, width, height); }
      if (id === "favicon-generator") {
        // Reuse the Web favicon size contract and fit behavior. Its encoder cannot
        // be reused here because it doesn't release the canvas backing allocation.
        const scale = Math.min(width / sourceWidth, height / sourceHeight);
        const fitWidth = sourceWidth * scale, fitHeight = sourceHeight * scale;
        context.drawImage(decoded.source, (width - fitWidth) / 2, (height - fitHeight) / 2, fitWidth, fitHeight);
      } else if (angle) {
        context.translate(width / 2, height / 2); context.rotate(angle); context.drawImage(decoded.source, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
      } else if (flip) {
        context.translate(flip === "Horizontal" ? width : 0, flip === "Vertical" ? height : 0); context.scale(flip === "Horizontal" ? -1 : 1, flip === "Vertical" ? -1 : 1); context.drawImage(decoded.source, 0, 0, width, height);
      } else context.drawImage(decoded.source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      const blob = await encode(canvas, mime, q);
      const warnings = [metadataWarning];
      if (id === "favicon-generator") warnings.push("PNG favicon only; no ICO encoding.");
      if (id === "image-compressor" && bytes && blob.size >= bytes.length) warnings.push("The actual encoded result is not smaller than the input; no size reduction is claimed.");
      const outputDimensions = { width, height };
      let data: Record<string, unknown> = {};
      if (conversion) data = conversion[1] === "svg" ? { outputDimensions } : { originalSize: bytes!.length, outputSize: blob.size };
      if (id === "image-compressor") data = { originalSize: bytes!.length, outputSize: blob.size, sizeReduction: `${((1 - blob.size / bytes!.length) * 100).toFixed(2)}%` };
      if (id === "image-quality-adjuster") data = { outputSize: blob.size };
      if (id === "image-resizer") data = { originalDimensions: { width: sourceWidth, height: sourceHeight }, outputDimensions, outputSize: blob.size };
      if (id === "image-cropper" || id === "favicon-generator") data = { outputDimensions, outputSize: blob.size };
      if (id === "image-rotator") data = { outputDimensions };
      return { blob, extension: extension(mime), data, warnings };
    } finally { release(); }
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError(error instanceof Error ? `Local image processing failed: ${error.message}` : "Local image processing failed.", "file");
  } finally { decoded?.release(); }
}
