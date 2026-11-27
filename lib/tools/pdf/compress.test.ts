// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import {
  COMPRESSION_PRESETS,
  calculateSavings,
  formatBytes,
  optimizePdfStreams,
  compressPdfDocument,
  canvasToBlob,
  type CompressionPresetKey,
  type CompressProgress,
} from "./compress";

// Minimal valid 1x1 JPEG bytes for mock blob/canvas encoding
const SAMPLE_JPEG_HEX =
  "ffd8ffe000104a46494600010101004800480000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333430ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9";

function createSampleJpegBlob(): Blob {
  const binary = atob(
    btoa(
      SAMPLE_JPEG_HEX.match(/\w{2}/g)!
        .map((byte) => String.fromCharCode(parseInt(byte, 16)))
        .join(""),
    ),
  );
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/jpeg" });
}

describe("PDF Compression Presets", () => {
  it("defines standard presets with required properties", () => {
    const keys: CompressionPresetKey[] = ["max", "balanced", "high"];
    for (const key of keys) {
      const preset = COMPRESSION_PRESETS[key];
      expect(preset).toBeDefined();
      expect(preset.key).toBe(key);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.dpi).toBeGreaterThan(0);
      expect(preset.quality).toBeGreaterThan(0);
      expect(preset.quality).toBeLessThanOrEqual(1);
    }
  });

  it("assigns expected DPI and quality tiers across presets", () => {
    expect(COMPRESSION_PRESETS.max.dpi).toBe(72);
    expect(COMPRESSION_PRESETS.max.quality).toBe(0.6);

    expect(COMPRESSION_PRESETS.balanced.dpi).toBe(150);
    expect(COMPRESSION_PRESETS.balanced.quality).toBe(0.75);

    expect(COMPRESSION_PRESETS.high.dpi).toBe(300);
    expect(COMPRESSION_PRESETS.high.quality).toBe(0.85);
  });
});

describe("calculateSavings", () => {
  it("calculates positive savings and percentage accurately", () => {
    const result = calculateSavings(1000, 400);
    expect(result.savingsBytes).toBe(600);
    expect(result.savingsPercentage).toBe(60);
  });

  it("handles exact equality as 0% savings", () => {
    const result = calculateSavings(500, 500);
    expect(result.savingsBytes).toBe(0);
    expect(result.savingsPercentage).toBe(0);
  });

  it("handles negative savings when compressed file is larger", () => {
    const result = calculateSavings(200, 300);
    expect(result.savingsBytes).toBe(-100);
    expect(result.savingsPercentage).toBe(-50);
  });

  it("handles zero or non-finite original size gracefully", () => {
    expect(calculateSavings(0, 500)).toEqual({ savingsBytes: 0, savingsPercentage: 0 });
    expect(calculateSavings(-100, 500)).toEqual({ savingsBytes: 0, savingsPercentage: 0 });
    expect(calculateSavings(NaN, 500)).toEqual({ savingsBytes: 0, savingsPercentage: 0 });
  });

  it("rounds savings percentage to 1 decimal place", () => {
    const result = calculateSavings(3000, 1000);
    expect(result.savingsPercentage).toBe(66.7);
  });
});

describe("formatBytes", () => {
  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
  });

  it("formats positive bytes across unit scales", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(2621440)).toBe("2.50 MB");
  });

  it("formats negative bytes with minus sign", () => {
    expect(formatBytes(-512)).toBe("-512 B");
    expect(formatBytes(-1024)).toBe("-1.0 KB");
    expect(formatBytes(-2621440)).toBe("-2.50 MB");
  });
});

describe("optimizePdfStreams", () => {
  it("creates and optimizes a synthetic PDF using pdf-lib object streams", async () => {
    const doc = await PDFDocument.create();
    const page1 = doc.addPage([400, 600]);
    page1.drawText("Test stream optimization page 1");
    const page2 = doc.addPage([400, 600]);
    page2.drawText("Test stream optimization page 2");

    const uncompressedBytes = await doc.save();
    expect(uncompressedBytes.byteLength).toBeGreaterThan(0);

    const optimizedBytes = await optimizePdfStreams(uncompressedBytes);
    expect(optimizedBytes).toBeInstanceOf(Uint8Array);
    expect(optimizedBytes.byteLength).toBeGreaterThan(0);

    // Verify optimized bytes can be parsed back into a valid PDF
    const reloaded = await PDFDocument.load(optimizedBytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});

describe("canvasToBlob", () => {
  it("resolves encoded blob when canvas.toBlob succeeds", async () => {
    const sampleBlob = createSampleJpegBlob();
    const mockCanvas = {
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => cb(sampleBlob)),
    } as unknown as HTMLCanvasElement;

    const blob = await canvasToBlob(mockCanvas, "image/jpeg", 0.75);
    expect(blob).toBe(sampleBlob);
  });

  it("rejects with an error when canvas.toBlob yields null", async () => {
    const mockCanvas = {
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => cb(null)),
    } as unknown as HTMLCanvasElement;

    await expect(canvasToBlob(mockCanvas, "image/jpeg", 0.75)).rejects.toThrow(
      "The browser could not encode this page",
    );
  });
});

describe("compressPdfDocument", () => {
  let sampleBlob: Blob;
  let mockContext: Record<string, unknown>;

  beforeEach(() => {
    sampleBlob = createSampleJpegBlob();
    mockContext = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
    };

    // Mock HTMLCanvasElement.prototype methods for jsdom
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => mockContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback: (b: Blob | null) => void) => callback(sampleBlob),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockDocProxy(numPages: number): PDFDocumentProxy {
    const pages = Array.from({ length: numPages }, (_, i) => ({
      pageNumber: i + 1,
      getViewport: vi.fn(() => ({ width: 612, height: 792 })),
      render: vi.fn(() => ({
        promise: Promise.resolve(),
        cancel: vi.fn(),
      })),
      cleanup: vi.fn(),
    }));

    return {
      numPages,
      getPage: vi.fn((n: number) => Promise.resolve(pages[n - 1] as unknown as PDFPageProxy)),
      destroy: vi.fn(),
    } as unknown as PDFDocumentProxy;
  }

  it("compresses all pages and reports progress stages", async () => {
    const mockDoc = createMockDocProxy(2);
    const progressReports: CompressProgress[] = [];

    const result = await compressPdfDocument(
      mockDoc,
      {
        preset: "max",
        originalSize: 50000,
        onProgress: (p) => progressReports.push({ ...p }),
      },
    );

    expect(result.pageCount).toBe(2);
    expect(result.originalSize).toBe(50000);
    expect(result.compressedSize).toBeGreaterThan(0);
    expect(result.savingsBytes).toBe(50000 - result.compressedSize);
    expect(result.savingsPercentage).toBe(
      Number((((50000 - result.compressedSize) / 50000) * 100).toFixed(1)),
    );
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify valid output PDF
    const outputPdf = await PDFDocument.load(result.compressedBytes);
    expect(outputPdf.getPageCount()).toBe(2);

    // Verify progress callbacks fired
    const stages = progressReports.map((p) => p.stage);
    expect(stages).toContain("rendering");
    expect(stages).toContain("encoding");
    expect(stages).toContain("saving");
    expect(stages).toContain("complete");
  });

  it("supports preset string key and custom DPI/quality overrides", async () => {
    const mockDoc = createMockDocProxy(1);

    const resultHigh = await compressPdfDocument(mockDoc, "high");
    expect(resultHigh.pageCount).toBe(1);

    const resultCustom = await compressPdfDocument(mockDoc, {
      dpi: 120,
      quality: 0.7,
      originalSize: 20000,
    });
    expect(resultCustom.pageCount).toBe(1);
    expect(resultCustom.originalSize).toBe(20000);
  });

  it("aborts promptly when AbortSignal is cancelled before running", async () => {
    const mockDoc = createMockDocProxy(3);
    const controller = new AbortController();
    controller.abort();

    await expect(
      compressPdfDocument(mockDoc, { signal: controller.signal }),
    ).rejects.toThrow("PDF compression was cancelled");
  });

  it("aborts promptly when AbortSignal is cancelled during page processing", async () => {
    const mockDoc = createMockDocProxy(5);
    const controller = new AbortController();

    const compressionPromise = compressPdfDocument(mockDoc, {
      signal: controller.signal,
      onProgress: (p) => {
        if (p.current === 2 && p.stage === "encoding") {
          controller.abort();
        }
      },
    });

    await expect(compressionPromise).rejects.toThrow("PDF compression was cancelled");
  });
});
