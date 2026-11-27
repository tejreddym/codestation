import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPdfPageToCanvas } from "./pdfjs";

export type CompressionPresetKey = "max" | "balanced" | "high";

export interface CompressionPreset {
  key: CompressionPresetKey;
  name: string;
  dpi: number;
  quality: number;
  description: string;
}

export const COMPRESSION_PRESETS: Record<CompressionPresetKey, CompressionPreset> = {
  max: {
    key: "max",
    name: "Maximum Compression",
    dpi: 72,
    quality: 0.6,
    description: "Maximum compression (72 DPI), smallest file size",
  },
  balanced: {
    key: "balanced",
    name: "Balanced",
    dpi: 150,
    quality: 0.75,
    description: "Balanced quality & size (150 DPI), best for general sharing",
  },
  high: {
    key: "high",
    name: "High Quality",
    dpi: 300,
    quality: 0.85,
    description: "High print quality (300 DPI) with moderate compression",
  },
};

export type CompressStage = "rendering" | "encoding" | "saving" | "complete";

export interface CompressProgress {
  current: number;
  total: number;
  stage: CompressStage;
}

export interface CompressionOptions {
  preset?: CompressionPresetKey | Partial<CompressionPreset>;
  dpi?: number;
  quality?: number;
  originalSize?: number;
  onProgress?: (progress: CompressProgress) => void;
  signal?: AbortSignal;
}

export interface CompressionResult {
  compressedBytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  savingsBytes: number;
  savingsPercentage: number;
  pageCount: number;
  durationMs: number;
}

/**
 * Calculates byte and percentage savings between original and compressed sizes.
 * If compressed size is larger than original (e.g. rasterizing vector graphics),
 * savingsBytes and savingsPercentage will be negative.
 */
export function calculateSavings(
  originalSize: number,
  compressedSize: number,
): { savingsBytes: number; savingsPercentage: number } {
  if (!Number.isFinite(originalSize) || originalSize <= 0) {
    return { savingsBytes: 0, savingsPercentage: 0 };
  }
  const savingsBytes = originalSize - compressedSize;
  const savingsPercentage = Number(((savingsBytes / originalSize) * 100).toFixed(1));
  return { savingsBytes, savingsPercentage };
}

/**
 * Human-readable byte formatting supporting positive and negative amounts.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  const sign = bytes < 0 ? "-" : "";
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${sign}${abs} B`;
  if (abs < 1048576) return `${sign}${(abs / 1024).toFixed(1)} KB`;
  return `${sign}${(abs / 1048576).toFixed(2)} MB`;
}

/**
 * Converts a canvas element to a JPEG Blob at the given quality setting.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = "image/jpeg",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode this page. Try a lower resolution."));
      },
      type,
      quality,
    );
  });
}

/**
 * Optimizes an existing PDF using pdf-lib object stream compression without rasterization.
 */
export async function optimizePdfStreams(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  return await doc.save({ useObjectStreams: true });
}

/**
 * In-browser compression engine using pdf-lib and canvas downsampling.
 * Renders each page of a PDFDocumentProxy, downsamples to JPEG at the specified DPI/quality,
 * creates a clean PDF container with useObjectStreams: true, and returns detailed metrics.
 */
export async function compressPdfDocument(
  sourceDoc: PDFDocumentProxy,
  options?: CompressionPresetKey | CompressionOptions,
  onProgressCallback?: (progress: CompressProgress) => void,
  abortSignal?: AbortSignal,
  passedOriginalSize?: number,
): Promise<CompressionResult> {
  const startTime = Date.now();

  let presetKey: CompressionPresetKey = "balanced";
  let customDpi: number | undefined;
  let customQuality: number | undefined;
  let originalSize = passedOriginalSize ?? 0;
  let onProgress = onProgressCallback;
  let signal = abortSignal;

  if (typeof options === "string") {
    if (options in COMPRESSION_PRESETS) {
      presetKey = options;
    }
  } else if (options && typeof options === "object") {
    if (typeof options.preset === "string" && options.preset in COMPRESSION_PRESETS) {
      presetKey = options.preset;
    } else if (options.preset && typeof options.preset === "object") {
      customDpi = options.preset.dpi;
      customQuality = options.preset.quality;
    }
    if (options.dpi !== undefined) customDpi = options.dpi;
    if (options.quality !== undefined) customQuality = options.quality;
    if (options.originalSize !== undefined) originalSize = options.originalSize;
    if (options.onProgress) onProgress = options.onProgress;
    if (options.signal) signal = options.signal;
  }

  const basePreset = COMPRESSION_PRESETS[presetKey] ?? COMPRESSION_PRESETS.balanced;
  const dpi = customDpi ?? basePreset.dpi;
  const quality = customQuality ?? basePreset.quality;
  const scale = dpi / 72;

  if (signal?.aborted) {
    throw new DOMException("PDF compression was cancelled.", "AbortError");
  }

  const pageCount = sourceDoc.numPages;
  const targetDoc = await PDFDocument.create();

  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (signal?.aborted) {
      throw new DOMException("PDF compression was cancelled.", "AbortError");
    }

    onProgress?.({
      current: pageNum,
      total: pageCount,
      stage: "rendering",
    });

    const page = await sourceDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    try {
      if (!canvas) {
        throw new Error("Canvas rendering requires a browser or canvas-enabled environment.");
      }

      await renderPdfPageToCanvas(page, scale, canvas, signal);

      if (signal?.aborted) {
        throw new DOMException("PDF compression was cancelled.", "AbortError");
      }

      onProgress?.({
        current: pageNum,
        total: pageCount,
        stage: "encoding",
      });

      const blob = await canvasToBlob(canvas, "image/jpeg", quality);

      if (signal?.aborted) {
        throw new DOMException("PDF compression was cancelled.", "AbortError");
      }

      const buffer = await blob.arrayBuffer();
      const jpegBytes = new Uint8Array(buffer);

      const embeddedImage = await targetDoc.embedJpg(jpegBytes);
      const newPage = targetDoc.addPage([viewport.width, viewport.height]);
      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    } finally {
      page.cleanup();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }

  if (signal?.aborted) {
    throw new DOMException("PDF compression was cancelled.", "AbortError");
  }

  onProgress?.({
    current: pageCount,
    total: pageCount,
    stage: "saving",
  });

  const compressedBytes = await targetDoc.save({ useObjectStreams: true });
  const compressedSize = compressedBytes.byteLength;
  const durationMs = Date.now() - startTime;

  const effectiveOriginalSize = originalSize > 0 ? originalSize : compressedSize;
  const { savingsBytes, savingsPercentage } = calculateSavings(
    effectiveOriginalSize,
    compressedSize,
  );

  onProgress?.({
    current: pageCount,
    total: pageCount,
    stage: "complete",
  });

  return {
    compressedBytes,
    originalSize: effectiveOriginalSize,
    compressedSize,
    savingsBytes,
    savingsPercentage,
    pageCount,
    durationMs,
  };
}
