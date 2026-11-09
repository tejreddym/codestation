import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

export interface PdfMetadataInfo {
  pageCount: number;
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creationDate: string | null;
  modificationDate: string | null;
  producer: string;
}

export type WatermarkPosition =
  | "center"
  | "tile"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface WatermarkOptions {
  type?: "text" | "image";
  text?: string;
  fontSize?: number;
  color?: string; // hex #rrggbb or rgb(r, g, b)
  opacity?: number; // 0.05 to 1.0 (default 0.3)
  rotation?: number; // in degrees, default 45
  position?: WatermarkPosition; // default "center"
  imageBytes?: Uint8Array | ArrayBuffer;
  imageType?: "image/png" | "image/jpeg" | "image/jpg" | string;
  scale?: number; // scale multiplier, default 1
  pageRange?: string; // e.g. "1-3, 5"
}

export type PageNumberFormat =
  | "page-x-of-y"
  | "x-of-y"
  | "x"
  | "roman-lower"
  | "roman-upper"
  | "custom";

export type PageNumberFont = "Helvetica" | "Times Roman" | "Courier";
export type PageNumberPosition = "left" | "center" | "right";
export type PageNumberVertical = "header" | "footer";

export interface PageNumberOptions {
  format?: PageNumberFormat;
  verticalPosition?: PageNumberVertical;
  alignment?: PageNumberPosition;
  fontFamily?: PageNumberFont;
  fontSize?: number;
  color?: string;
  margin?: number;
  startNumber?: number;
  pageRange?: string;
  skipFirstPage?: boolean;
  customPrefix?: string;
  customSuffix?: string;
}

/**
 * Parses color strings (hex or rgb) into pdf-lib RGB color objects.
 */
export function parseColor(colorStr?: string) {
  if (!colorStr) return rgb(0.4, 0.4, 0.4);
  const trimmed = colorStr.trim().toLowerCase();
  if (trimmed === "black") return rgb(0, 0, 0);
  if (trimmed === "white") return rgb(1, 1, 1);
  if (trimmed === "red") return rgb(0.9, 0.1, 0.1);
  if (trimmed === "blue") return rgb(0.1, 0.3, 0.9);
  if (trimmed === "gray" || trimmed === "grey") return rgb(0.5, 0.5, 0.5);

  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    const num = parseInt(hex, 16);
    if (!Number.isNaN(num) && hex.length === 6) {
      const r = ((num >> 16) & 255) / 255;
      const g = ((num >> 8) & 255) / 255;
      const b = (num & 255) / 255;
      return rgb(r, g, b);
    }
  }

  const rgbMatch = trimmed.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))) / 255;
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))) / 255;
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))) / 255;
    return rgb(r, g, b);
  }

  return rgb(0.4, 0.4, 0.4);
}

/**
 * Converts positive integers to Roman numerals.
 */
export function toRoman(num: number, upper = true): string {
  if (num < 1 || num > 3999) return String(num);
  const lookup: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let res = "";
  let n = num;
  for (const [val, roman] of lookup) {
    while (n >= val) {
      res += roman;
      n -= val;
    }
  }
  return upper ? res : res.toLowerCase();
}

/**
 * Safely loads a PDF document with descriptive error handling for encrypted or corrupt documents.
 */
export async function loadPdfDoc(buffer: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  if (!buffer || (buffer instanceof ArrayBuffer && buffer.byteLength === 0) || (buffer instanceof Uint8Array && buffer.length === 0)) {
    throw new Error("PDF file is empty. Please provide a valid PDF document.");
  }
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
    return doc;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    if (
      name === "EncryptedPDFError" ||
      message.toLowerCase().includes("encrypt") ||
      message.toLowerCase().includes("password")
    ) {
      throw new Error("This PDF is password-protected or encrypted. Please provide an unencrypted PDF.");
    }
    throw new Error(`Failed to load PDF. The document may be corrupted or invalid: ${message}`);
  }
}

/**
 * Parses a page range string like "1, 3-5, 8" into an array of 0-based page indices.
 */
export function parsePageRange(rangeStr: string, maxPages: number): number[] {
  if (!rangeStr || !rangeStr.trim()) {
    return Array.from({ length: maxPages }, (_, i) => i);
  }

  const pages = new Set<number>();
  const parts = rangeStr.split(",").map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (!Number.isNaN(startStr) && !Number.isNaN(endStr)) {
        const start = Math.max(1, Math.min(startStr, endStr));
        const end = Math.min(maxPages, Math.max(startStr, endStr));
        for (let i = start; i <= end; i++) {
          pages.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
        pages.add(pageNum - 1);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Merges multiple PDF ArrayBuffers into a single PDF document.
 */
export async function mergePdfs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  if (pdfBuffers.length === 0) {
    throw new Error("At least one PDF file is required to merge.");
  }

  const mergedDoc = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const doc = await loadPdfDoc(buffer);
    const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }

  return await mergedDoc.save();
}

/**
 * Extracts specified 0-based page indices from a source PDF into a new PDF.
 */
export async function splitPdf(pdfBuffer: ArrayBuffer, pageIndices: number[]): Promise<Uint8Array> {
  if (pageIndices.length === 0) {
    throw new Error("No pages selected for extraction.");
  }

  const sourceDoc = await loadPdfDoc(pdfBuffer);
  const maxPages = sourceDoc.getPageCount();
  const validIndices = pageIndices.filter((idx) => idx >= 0 && idx < maxPages);

  if (validIndices.length === 0) {
    throw new Error("Selected page indices are out of bounds.");
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(sourceDoc, validIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return await newDoc.save();
}

/**
 * Rotates designated pages of a PDF by 90, 180, or 270 degrees clockwise.
 */
export async function rotatePdf(
  pdfBuffer: ArrayBuffer,
  rotationDegrees: 90 | 180 | 270,
  pageIndices?: number[]
): Promise<Uint8Array> {
  const doc = await loadPdfDoc(pdfBuffer);
  const total = doc.getPageCount();
  const targetIndices =
    pageIndices && pageIndices.length > 0 ? pageIndices : Array.from({ length: total }, (_, i) => i);

  for (const idx of targetIndices) {
    if (idx >= 0 && idx < total) {
      const page = doc.getPage(idx);
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + rotationDegrees) % 360));
    }
  }

  return await doc.save();
}

/**
 * Deletes specified 0-based page indices from a PDF.
 */
export async function deletePdfPages(pdfBuffer: ArrayBuffer, pageIndicesToDelete: number[]): Promise<Uint8Array> {
  const doc = await loadPdfDoc(pdfBuffer);
  const total = doc.getPageCount();
  const deleteSet = new Set(pageIndicesToDelete);

  const keepIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !deleteSet.has(i));
  if (keepIndices.length === 0) {
    throw new Error("Cannot delete all pages of a PDF document.");
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(doc, keepIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return await newDoc.save();
}

/**
 * Embeds image bytes (PNG / JPEG) into a new PDF document.
 */
export async function imagesToPdf(
  images: Array<{ data: Uint8Array; type: "image/jpeg" | "image/png" | "image/webp" | string }>,
  pageSize: "A4" | "Letter" | "FitImage" = "A4"
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error("No images provided for PDF creation.");
  }

  const doc = await PDFDocument.create();
  const PAGE_SIZES: Record<string, [number, number]> = {
    A4: [595.28, 841.89],
    Letter: [612, 792],
  };

  for (const img of images) {
    let embeddedImg;
    if (img.type === "image/png") {
      embeddedImg = await doc.embedPng(img.data);
    } else {
      embeddedImg = await doc.embedJpg(img.data);
    }

    const { width: imgWidth, height: imgHeight } = embeddedImg;

    if (pageSize === "FitImage") {
      const page = doc.addPage([imgWidth, imgHeight]);
      page.drawImage(embeddedImg, { x: 0, y: 0, width: imgWidth, height: imgHeight });
    } else {
      const [pageWidth, pageHeight] = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
      const page = doc.addPage([pageWidth, pageHeight]);
      const padding = 24;
      const maxWidth = pageWidth - padding * 2;
      const maxHeight = pageHeight - padding * 2;
      const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;
      page.drawImage(embeddedImg, { x, y, width: scaledWidth, height: scaledHeight });
    }
  }

  return await doc.save();
}

/**
 * Reads document properties and metadata from a PDF.
 */
export async function extractPdfInfo(pdfBuffer: ArrayBuffer): Promise<PdfMetadataInfo> {
  const doc = await loadPdfDoc(pdfBuffer);
  return {
    pageCount: doc.getPageCount(),
    title: doc.getTitle() || "Untitled",
    author: doc.getAuthor() || "Unknown",
    subject: doc.getSubject() || "",
    keywords: doc.getKeywords() || "",
    creationDate: doc.getCreationDate() ? doc.getCreationDate()!.toISOString() : null,
    modificationDate: doc.getModificationDate() ? doc.getModificationDate()!.toISOString() : null,
    producer: doc.getProducer() || "",
  };
}

/**
 * Applies text or image watermarks to a PDF document with full positioning, rotation, opacity, and page controls.
 */
export async function applyWatermark(
  pdfBuffer: ArrayBuffer | Uint8Array,
  options: WatermarkOptions = {}
): Promise<Uint8Array> {
  const doc = await loadPdfDoc(pdfBuffer);
  const totalPages = doc.getPageCount();
  const targetIndices = parsePageRange(options.pageRange ?? "", totalPages);

  if (targetIndices.length === 0) {
    throw new Error("No pages matched the specified page range.");
  }

  const isImageWatermark = options.type === "image";
  const rotDeg = options.rotation ?? 45;
  const rotRad = (rotDeg * Math.PI) / 180;
  const cosA = Math.cos(rotRad);
  const sinA = Math.sin(rotRad);
  const opacity = Math.min(1, Math.max(0.01, options.opacity ?? 0.3));
  const position = options.position ?? "center";

  let embeddedImage: any = null;
  let font: any = null;
  const text = options.text?.trim() || "CONFIDENTIAL";
  const fontSize = options.fontSize ?? 48;
  const textColor = parseColor(options.color ?? "#666666");

  if (isImageWatermark) {
    if (!options.imageBytes) {
      throw new Error("Please provide an image file for the image watermark.");
    }
    const bytes =
      options.imageBytes instanceof Uint8Array
        ? options.imageBytes
        : new Uint8Array(options.imageBytes);

    const isPng =
      options.imageType === "image/png" ||
      (bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47);

    try {
      embeddedImage = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch (e: unknown) {
      throw new Error(
        `Failed to embed watermark image: ${e instanceof Error ? e.message : "Unsupported image format"}. Please use a valid PNG or JPG file.`
      );
    }
  } else {
    font = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  for (const pageIdx of targetIndices) {
    const page = doc.getPage(pageIdx);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    let elemWidth = 0;
    let elemHeight = 0;

    if (isImageWatermark) {
      const scaleMultiplier = (options.scale ?? 50) / 100;
      elemWidth = embeddedImage.width * scaleMultiplier;
      elemHeight = embeddedImage.height * scaleMultiplier;
    } else {
      elemWidth = font.widthOfTextAtSize(text, fontSize);
      elemHeight = font.heightAtSize(fontSize);
    }

    const drawAtCenter = (cx: number, cy: number) => {
      const x = cx - (elemWidth / 2) * cosA + (elemHeight / 2) * sinA;
      const y = cy - (elemWidth / 2) * sinA - (elemHeight / 2) * cosA;

      if (isImageWatermark) {
        page.drawImage(embeddedImage, {
          x,
          y,
          width: elemWidth,
          height: elemHeight,
          opacity,
          rotate: degrees(rotDeg),
        });
      } else {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: textColor,
          opacity,
          rotate: degrees(rotDeg),
        });
      }
    };

    const margin = 40;

    if (position === "center") {
      drawAtCenter(pageWidth / 2, pageHeight / 2);
    } else if (position === "top-left") {
      drawAtCenter(margin + elemWidth / 2, pageHeight - margin - elemHeight / 2);
    } else if (position === "top-right") {
      drawAtCenter(pageWidth - margin - elemWidth / 2, pageHeight - margin - elemHeight / 2);
    } else if (position === "bottom-left") {
      drawAtCenter(margin + elemWidth / 2, margin + elemHeight / 2);
    } else if (position === "bottom-right") {
      drawAtCenter(pageWidth - margin - elemWidth / 2, margin + elemHeight / 2);
    } else if (position === "tile") {
      const stepX = Math.max(elemWidth * 1.5, 180);
      const stepY = Math.max(elemHeight * 2.5, 140);
      for (let cx = stepX / 2; cx < pageWidth; cx += stepX) {
        for (let cy = stepY / 2; cy < pageHeight; cy += stepY) {
          drawAtCenter(cx, cy);
        }
      }
    }
  }

  return await doc.save();
}

/**
 * Adds customizable page numbers to PDF headers or footers with support for standard, Roman, and custom formats.
 */
export async function applyPageNumbers(
  pdfBuffer: ArrayBuffer | Uint8Array,
  options: PageNumberOptions = {}
): Promise<Uint8Array> {
  const doc = await loadPdfDoc(pdfBuffer);
  const totalPages = doc.getPageCount();

  let targetIndices = options.pageRange?.trim()
    ? parsePageRange(options.pageRange, totalPages)
    : Array.from({ length: totalPages }, (_, i) => i);

  if (options.skipFirstPage) {
    targetIndices = targetIndices.filter((idx) => idx !== 0);
  }

  if (targetIndices.length === 0) {
    throw new Error("No pages matched the specified page range.");
  }

  const fontMap: Record<PageNumberFont, StandardFonts> = {
    Helvetica: StandardFonts.Helvetica,
    "Times Roman": StandardFonts.TimesRoman,
    Courier: StandardFonts.Courier,
  };

  const font = await doc.embedFont(fontMap[options.fontFamily ?? "Helvetica"]);
  const fontSize = options.fontSize ?? 10;
  const color = parseColor(options.color ?? "#333333");
  const margin = options.margin ?? 24;
  const startNumber = options.startNumber ?? 1;
  const vertical = options.verticalPosition ?? "footer";
  const alignment = options.alignment ?? "center";
  const format = options.format ?? "page-x-of-y";

  for (let i = 0; i < targetIndices.length; i++) {
    const pageIdx = targetIndices[i];
    const page = doc.getPage(pageIdx);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    const pageNum = startNumber + i;
    const totalCount = totalPages;

    let text = "";
    switch (format) {
      case "page-x-of-y":
        text = `Page ${pageNum} of ${totalCount}`;
        break;
      case "x-of-y":
        text = `${pageNum} / ${totalCount}`;
        break;
      case "x":
        text = `${pageNum}`;
        break;
      case "roman-lower":
        text = toRoman(pageNum, false);
        break;
      case "roman-upper":
        text = toRoman(pageNum, true);
        break;
      case "custom":
        text = `${options.customPrefix ?? ""}${pageNum}${options.customSuffix ?? ""}`;
        break;
      default:
        text = `Page ${pageNum} of ${totalCount}`;
    }

    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x = margin;
    if (alignment === "center") {
      x = (pageWidth - textWidth) / 2;
    } else if (alignment === "right") {
      x = pageWidth - margin - textWidth;
    } else {
      x = margin;
    }

    let y = margin;
    if (vertical === "header") {
      y = pageHeight - margin - textHeight;
    } else {
      y = margin;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color,
    });
  }

  return await doc.save();
}
