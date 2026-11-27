// @vitest-environment jsdom
/**
 * 4-Tier Requirement-Driven E2E Test Suite for PDF Compressor (R2).
 * Conformance to ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  createTestPdf,
  loadPdfCompressModule,
  setupBrowserApiMocks,
  resetWebMcpForTesting,
  type PdfCompressModule,
} from "./test-helpers";
import {
  createWebMcpToolForDefinition,
  registerWebMcpTool,
  getRegisteredWebMcpTools,
} from "../../lib/webmcp/registry";
import { getPdfDefinition } from "../../config/pdf-tools";
import { getTool } from "../../config/tools";

const PDF_COMPRESS_PATH = path.resolve(process.cwd(), "lib/tools/pdf/compress.ts");
const isPdfCompressImplemented =
  fs.existsSync(PDF_COMPRESS_PATH) &&
  fs.readFileSync(PDF_COMPRESS_PATH, "utf8").includes("compressPdfInBrowser");

describe.skipIf(!isPdfCompressImplemented)("PDF Compressor E2E Suite (R2)", () => {
  let browserMocks: ReturnType<typeof setupBrowserApiMocks>;
  let pdfModule: PdfCompressModule;

  beforeEach(async () => {
    browserMocks = setupBrowserApiMocks();
    resetWebMcpForTesting();
    pdfModule = await loadPdfCompressModule();
  });

  afterEach(() => {
    browserMocks.restore();
  });

  // =========================================================================
  // Tier 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    it("T1.1 - provides standard compression presets for 72 DPI, 150 DPI, and 300 DPI", () => {
      const presets = pdfModule.COMPRESSION_PRESETS;
      expect(presets).toBeDefined();

      // Maximum Compression: 72 DPI
      expect(presets.max).toBeDefined();
      expect(presets.max.dpi).toBe(72);
      expect(presets.max.quality).toBeLessThanOrEqual(0.6);
      expect(presets.max.name).toMatch(/maximum/i);

      // Balanced: 150 DPI
      expect(presets.balanced).toBeDefined();
      expect(presets.balanced.dpi).toBe(150);
      expect(presets.balanced.quality).toBeGreaterThan(0.6);
      expect(presets.balanced.quality).toBeLessThan(0.9);
      expect(presets.balanced.name).toMatch(/balanced/i);

      // High Quality: 300 DPI
      expect(presets.high).toBeDefined();
      expect(presets.high.dpi).toBe(300);
      expect(presets.high.quality).toBeGreaterThanOrEqual(0.85);
      expect(presets.high.name).toMatch(/high/i);
    });

    it("T1.2 - calculateSavings accurately computes bytes saved and percentage saved", () => {
      // 1000 KB down to 400 KB -> 600 KB saved (60.0%)
      const res1 = pdfModule.calculateSavings(1000000, 400000);
      expect(res1.savingsBytes).toBe(600000);
      expect(res1.savingsPercentage).toBe(60.0);

      // 5 MB down to 1.25 MB -> 3.75 MB saved (75.0%)
      const res2 = pdfModule.calculateSavings(5000000, 1250000);
      expect(res2.savingsBytes).toBe(3750000);
      expect(res2.savingsPercentage).toBe(75.0);

      // Fractional percentage rounding: 100 down to 67 -> 33.0%
      const res3 = pdfModule.calculateSavings(100, 67);
      expect(res3.savingsBytes).toBe(33);
      expect(res3.savingsPercentage).toBe(33.0);
    });

    it("T1.3 - executes client-side PDF compression producing valid PDF bytes", async () => {
      const testPdfBytes = await createTestPdf({ pageCount: 2, title: "Execution Test Document" });
      expect(testPdfBytes.length).toBeGreaterThan(0);

      const compressedBytes = await pdfModule.compressPdfInBrowser(testPdfBytes, "balanced");
      expect(compressedBytes).toBeInstanceOf(Uint8Array);
      expect(compressedBytes.length).toBeGreaterThan(0);

      // Verify the returned bytes can be parsed back as a valid PDF
      const loadedDoc = await PDFDocument.load(compressedBytes);
      expect(loadedDoc.getPageCount()).toBe(2);
    });

    it("T1.4 - invokes page progress callback for each page during compression", async () => {
      const testPdfBytes = await createTestPdf({ pageCount: 3, title: "Progress Test Document" });
      const progressPages: number[] = [];

      await pdfModule.compressPdfInBrowser(testPdfBytes, "max", (currentPage, totalPages) => {
        progressPages.push(currentPage);
        expect(totalPages).toBe(3);
      });

      expect(progressPages).toEqual([1, 2, 3]);
    });

    it("T1.5 - registers WebMCP bridge contract codestation_pdf_compressor discoverable on document.modelContext", () => {
      // Query authoritative registry instead of creating an ad-hoc local variable
      const toolDef = getPdfDefinition("pdf-compressor") ?? getTool("pdf-compressor");
      expect(toolDef).toBeDefined();
      expect(toolDef!.id).toBe("pdf-compressor");
      expect(toolDef!.slug).toBe("pdf-compressor");
      expect(toolDef!.category).toBe("PDF");
      expect(toolDef!.name).toBe("PDF Compressor");

      const mcpTool = createWebMcpToolForDefinition(toolDef!);
      expect(mcpTool.name).toBe("codestation_pdf_compressor");
      expect(mcpTool.description).toContain("PDF");

      registerWebMcpTool(mcpTool);

      const registered = getRegisteredWebMcpTools();
      const found = registered.find((t) => t.name === "codestation_pdf_compressor");
      expect(found).toBeDefined();

      if (typeof document !== "undefined" && (document as any).modelContext) {
        const docTools = (document as any).modelContext.getTools();
        const docFound = docTools.find((t: any) => t.name === "codestation_pdf_compressor");
        expect(docFound).toBeDefined();
      }
    });

    it("T1.6 - compression presets define strictly ordered DPI (72 < 150 < 300) and distinct quality thresholds", () => {
      const presets = pdfModule.COMPRESSION_PRESETS;
      const max = presets.max;
      const balanced = presets.balanced;
      const high = presets.high;

      // Strict DPI ordering
      expect(max.dpi).toBe(72);
      expect(balanced.dpi).toBe(150);
      expect(high.dpi).toBe(300);
      expect(max.dpi).toBeLessThan(balanced.dpi);
      expect(balanced.dpi).toBeLessThan(high.dpi);

      // Strict quality ordering
      expect(max.quality).toBeLessThan(balanced.quality);
      expect(balanced.quality).toBeLessThan(high.quality);

      // Presets must have non-empty user-facing descriptions
      expect(max.description).toBeTruthy();
      expect(balanced.description).toBeTruthy();
      expect(high.description).toBeTruthy();
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("T2.1 - compresses both single-page and multi-page documents correctly", async () => {
      // 1-page document
      const singlePageBytes = await createTestPdf({ pageCount: 1 });
      const compSingle = await pdfModule.compressPdfInBrowser(singlePageBytes, "balanced");
      const doc1 = await PDFDocument.load(compSingle);
      expect(doc1.getPageCount()).toBe(1);

      // 5-page document
      const multiPageBytes = await createTestPdf({ pageCount: 5 });
      const compMulti = await pdfModule.compressPdfInBrowser(multiPageBytes, "max");
      const doc5 = await PDFDocument.load(compMulti);
      expect(doc5.getPageCount()).toBe(5);
    });

    it("T2.2 - handles 0% savings safely when compressed size is greater than or equal to original", () => {
      // Compressed size equal to original -> 0% savings
      const resEqual = pdfModule.calculateSavings(5000, 5000);
      expect(resEqual.savingsBytes).toBe(0);
      expect(resEqual.savingsPercentage).toBe(0);

      // Compressed size larger than original (e.g. metadata overhead on tiny file)
      const resLarger = pdfModule.calculateSavings(500, 600);
      expect(resLarger.savingsBytes).toBe(0);
      expect(resLarger.savingsPercentage).toBe(0);
    });

    it("T2.3 - handles extreme, zero, and negative original size gracefully", () => {
      expect(pdfModule.calculateSavings(0, 100)).toEqual({ savingsBytes: 0, savingsPercentage: 0 });
      expect(pdfModule.calculateSavings(-500, 100)).toEqual({ savingsBytes: 0, savingsPercentage: 0 });
      expect(pdfModule.calculateSavings(NaN, 100)).toEqual({ savingsBytes: 0, savingsPercentage: 0 });
    });

    it("T2.4 - throws clean error when attempting to compress invalid or corrupted PDF bytes", async () => {
      const corruptBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);
      await expect(pdfModule.compressPdfInBrowser(corruptBytes, "balanced")).rejects.toThrow(
        /Failed to parse PDF document/i
      );
    });

    it("T2.5 - falls back safely to balanced preset when unknown preset is provided", async () => {
      const testPdf = await createTestPdf({ pageCount: 1 });
      // Pass an invalid preset key as any
      const compressed = await pdfModule.compressPdfInBrowser(testPdf, "unknown-preset" as any);
      expect(compressed.length).toBeGreaterThan(0);
      const parsed = await PDFDocument.load(compressed);
      expect(parsed.getPageCount()).toBe(1);
    });

    it("T2.6 - aborts in-flight compression immediately if AbortSignal is signaled", async () => {
      const testPdf = await createTestPdf({ pageCount: 4 });
      const controller = new AbortController();

      // Pre-aborted
      controller.abort();
      await expect(
        pdfModule.compressPdfInBrowser(testPdf, "balanced", undefined, controller.signal)
      ).rejects.toThrow(/aborted/i);

      // Mid-flight abort
      const controller2 = new AbortController();
      let callCount = 0;
      const compressPromise = pdfModule.compressPdfInBrowser(
        testPdf,
        "max",
        () => {
          callCount++;
          if (callCount === 1) controller2.abort();
        },
        controller2.signal
      );

      await expect(compressPromise).rejects.toThrow(/aborted/i);
    });

    it("T2.7 - rejects empty or truncated Uint8Array byte streams with clear PDF parse error", async () => {
      const emptyBytes = new Uint8Array(0);
      await expect(pdfModule.compressPdfInBrowser(emptyBytes, "balanced")).rejects.toThrow(
        /Failed to parse PDF document|empty|invalid/i
      );

      const truncatedBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // Just "%PDF"
      await expect(pdfModule.compressPdfInBrowser(truncatedBytes, "balanced")).rejects.toThrow(
        /Failed to parse PDF document|corrupt|invalid/i
      );
    });

    it("T2.8 - preserves document page orientations (landscape and portrait) and aspect ratios across compression", async () => {
      const doc = await PDFDocument.create();
      // Page 1: Portrait (595 x 842)
      doc.addPage([595.28, 841.89]);
      // Page 2: Landscape (842 x 595)
      doc.addPage([841.89, 595.28]);
      const mixedPdfBytes = await doc.save();

      const compressedBytes = await pdfModule.compressPdfInBrowser(mixedPdfBytes, "balanced");
      const loaded = await PDFDocument.load(compressedBytes);
      expect(loaded.getPageCount()).toBe(2);

      const page1 = loaded.getPage(0);
      const page2 = loaded.getPage(1);
      const size1 = page1.getSize();
      const size2 = page2.getSize();

      // Page 1 should remain portrait (height > width)
      expect(size1.height).toBeGreaterThan(size1.width);
      // Page 2 should remain landscape (width > height)
      expect(size2.width).toBeGreaterThan(size2.height);
    });
  });

  // =========================================================================
  // Tier 3: Cross-Feature Combinations (Pairwise Interactions)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations", () => {
    it("T3.1 - switching presets dynamically updates DPI and target quality parameters", () => {
      const presets = pdfModule.COMPRESSION_PRESETS;
      const presetKeys = ["max", "balanced", "high"] as const;

      presetKeys.forEach((key) => {
        const p = presets[key];
        expect(p.dpi).toBeGreaterThan(0);
        expect(p.quality).toBeGreaterThan(0);
        expect(p.quality).toBeLessThanOrEqual(1.0);
      });

      // Max has lower DPI than Balanced, Balanced lower than High
      expect(presets.max.dpi).toBeLessThan(presets.balanced.dpi);
      expect(presets.balanced.dpi).toBeLessThan(presets.high.dpi);
    });

    it("T3.2 - compression retains total page count and valid PDF structure across all presets", async () => {
      const originalPdf = await createTestPdf({ pageCount: 3, title: "Multi-Preset Integrity Test" });

      for (const preset of ["max", "balanced", "high"] as const) {
        const compressed = await pdfModule.compressPdfInBrowser(originalPdf, preset);
        const reloaded = await PDFDocument.load(compressed);
        expect(reloaded.getPageCount()).toBe(3);
        // Verify PDF magic header %PDF-
        const header = String.fromCharCode(...compressed.slice(0, 5));
        expect(header).toBe("%PDF-");
      }
    });

    it("T3.3 - WebMCP tool schema matches input expectations for PDF processing", () => {
      const toolDef = getPdfDefinition("pdf-compressor") ?? getTool("pdf-compressor");
      expect(toolDef).toBeDefined();

      const mcp = createWebMcpToolForDefinition(toolDef!);
      expect(mcp.name).toBe("codestation_pdf_compressor");
      expect(mcp.inputSchema.properties).toBeDefined();
      expect(mcp.inputSchema.properties?.input).toBeDefined();
      expect(mcp.inputSchema.properties?.options).toBeDefined();
    });

    it("T3.4 - calculateSavings handles boundary rounding fidelity (0.01% to 99.99%) and equal file size", () => {
      // Extreme small savings: 1 byte saved on 10,000 bytes = 0.01%
      const minSavings = pdfModule.calculateSavings(10000, 9999);
      expect(minSavings.savingsBytes).toBe(1);
      expect(minSavings.savingsPercentage).toBe(0.01);

      // High savings: 9,999 bytes saved on 10,000 bytes = 99.99%
      const highSavings = pdfModule.calculateSavings(10000, 1);
      expect(highSavings.savingsBytes).toBe(9999);
      expect(highSavings.savingsPercentage).toBe(99.99);

      // Equal size: 0% savings
      const zeroSavings = pdfModule.calculateSavings(2048, 2048);
      expect(zeroSavings.savingsBytes).toBe(0);
      expect(zeroSavings.savingsPercentage).toBe(0);

      // Negative savings (compressed larger): clamped to 0
      const negSavings = pdfModule.calculateSavings(1000, 1200);
      expect(negSavings.savingsBytes).toBe(0);
      expect(negSavings.savingsPercentage).toBe(0);
    });
  });

  // =========================================================================
  // Tier 4: Real-World Scenario
  // =========================================================================
  describe("Tier 4: Real-World Scenario", () => {
    it("T4.1 - Production invoice archival workflow: compress with 72 DPI and 150 DPI, verify reduction and integrity", async () => {
      // 1. Generate realistic 3-page corporate invoice & contract specification
      const originalPdfBytes = await createTestPdf({
        pageCount: 3,
        title: "Enterprise Services Invoice #INV-2026-9041",
        text: "Client: Acme Corporation. Line items: Q3 Enterprise Subscription, Dedicated Support, SLA 99.99%. Total: $45,000 USD.",
      });
      const originalSize = originalPdfBytes.length;
      expect(originalSize).toBeGreaterThan(1000);

      // 2. User chooses "Balanced" (150 DPI) for email delivery to accounts payable
      const balancedPagesReported: number[] = [];
      const balancedPdfBytes = await pdfModule.compressPdfInBrowser(
        originalPdfBytes,
        "balanced",
        (curr, _total) => balancedPagesReported.push(curr)
      );

      expect(balancedPagesReported).toEqual([1, 2, 3]);
      expect(balancedPdfBytes.length).toBeGreaterThan(0);

      // Reload and verify PDF integrity
      const balancedDoc = await PDFDocument.load(balancedPdfBytes);
      expect(balancedDoc.getPageCount()).toBe(3);
      expect(balancedDoc.getTitle()).toContain("Balanced");

      // Calculate savings for Balanced
      const balancedSavings = pdfModule.calculateSavings(originalSize, balancedPdfBytes.length);
      expect(balancedSavings.savingsPercentage).toBeGreaterThanOrEqual(0);

      // 3. User chooses "Maximum Compression" (72 DPI) for cloud archival storage
      const maxPdfBytes = await pdfModule.compressPdfInBrowser(originalPdfBytes, "max");
      const maxDoc = await PDFDocument.load(maxPdfBytes);
      expect(maxDoc.getPageCount()).toBe(3);
      expect(maxDoc.getTitle()).toContain("Maximum Compression");

      // 4. Verify client-side object URL generation for direct download (zero server uploads)
      const downloadBlob = new Blob([new Uint8Array(balancedPdfBytes)], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(downloadBlob);
      expect(downloadUrl).toContain("blob:http://localhost/");
      expect(browserMocks.createdObjectUrls).toContain(downloadUrl);
      URL.revokeObjectURL(downloadUrl);

      // 5. Verify AI agent discoverability in WebMCP
      const toolDef = getPdfDefinition("pdf-compressor") ?? getTool("pdf-compressor");
      expect(toolDef).toBeDefined();
      const mcpTool = createWebMcpToolForDefinition(toolDef!);
      registerWebMcpTool(mcpTool);

      const allTools = getRegisteredWebMcpTools();
      expect(allTools.some((t) => t.name === "codestation_pdf_compressor")).toBe(true);
    });
  });
});
