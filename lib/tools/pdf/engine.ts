import { PDFDocument, degrees } from "pdf-lib";

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
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
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

  const sourceDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
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
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
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
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
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
      // JPEG or converted JPEG fallback
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
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
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
