import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  applyWatermark,
  applyPageNumbers,
  loadPdfDoc,
  parsePageRange,
  toRoman,
  parseColor,
} from "./engine";

describe("Milestone 1 Empirical Stress Tests (PDF Station Upgrades)", () => {
  // Helper to create test PDF with configurable page count and dimensions
  async function createTestPdf(pageCount = 1, width = 600, height = 800): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage([width, height]);
    }
    return await doc.save();
  }

  // Helper to create a synthesized password-protected/encrypted PDF structure
  async function createEncryptedPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const encryptDict = doc.context.obj({ Filter: PDFName.of("Standard") });
    const encryptRef = doc.context.register(encryptDict);
    doc.context.trailerInfo.Encrypt = encryptRef;
    return await doc.save();
  }

  // 1x1 transparent PNG fixture
  const samplePngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  describe("1. Empty and Null Buffer Handling", () => {
    it("handles empty Uint8Array in applyWatermark gracefully", async () => {
      const empty = new Uint8Array(0);
      await expect(applyWatermark(empty, { text: "TEST" })).rejects.toThrow(
        "PDF file is empty. Please provide a valid PDF document."
      );
    });

    it("handles empty ArrayBuffer in applyWatermark gracefully", async () => {
      const empty = new ArrayBuffer(0);
      await expect(applyWatermark(empty, { text: "TEST" })).rejects.toThrow(
        "PDF file is empty. Please provide a valid PDF document."
      );
    });

    it("handles empty Uint8Array in applyPageNumbers gracefully", async () => {
      const empty = new Uint8Array(0);
      await expect(applyPageNumbers(empty)).rejects.toThrow(
        "PDF file is empty. Please provide a valid PDF document."
      );
    });

    it("handles empty ArrayBuffer in applyPageNumbers gracefully", async () => {
      const empty = new ArrayBuffer(0);
      await expect(applyPageNumbers(empty)).rejects.toThrow(
        "PDF file is empty. Please provide a valid PDF document."
      );
    });

    it("handles null / undefined buffer gracefully in loadPdfDoc", async () => {
      await expect(loadPdfDoc(null as unknown as Uint8Array)).rejects.toThrow(
        "PDF file is empty. Please provide a valid PDF document."
      );
      await expect(loadPdfDoc(undefined as unknown as Uint8Array)).rejects.toThrow(
        "PDF file is empty. Please provide a valid PDF document."
      );
    });
  });

  describe("2. Corrupted and Invalid Bytes Handling", () => {
    it("handles short invalid bytes without crashing", async () => {
      const corrupt = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      await expect(applyWatermark(corrupt, { text: "FAIL" })).rejects.toThrow(/Failed to load PDF/);
      await expect(applyPageNumbers(corrupt)).rejects.toThrow(/Failed to load PDF/);
    });

    it("handles large arbitrary non-PDF bytes without crashing", async () => {
      const largeCorrupt = new Uint8Array(4096).fill(0x55);
      await expect(applyWatermark(largeCorrupt, { text: "FAIL" })).rejects.toThrow(/Failed to load PDF/);
      await expect(applyPageNumbers(largeCorrupt)).rejects.toThrow(/Failed to load PDF/);
    });

    it("handles truncated PDF headers without crashing", async () => {
      const truncated = new TextEncoder().encode("%PDF-1.7\n%corrupt truncated data without xref");
      await expect(applyWatermark(truncated, { text: "FAIL" })).rejects.toThrow(/(Failed to load PDF|Cannot read properties)/);
      await expect(applyPageNumbers(truncated)).rejects.toThrow(/(Failed to load PDF|Cannot read properties)/);
    });

    it("handles syntactically malformed PDF xref structure gracefully", async () => {
      const malformed = new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\ngarbage\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
      );
      await expect(applyWatermark(malformed, { text: "FAIL" })).rejects.toThrow(/(Failed to load PDF|Expected instance of PDFDict)/);
      await expect(applyPageNumbers(malformed)).rejects.toThrow(/(Failed to load PDF|Expected instance of PDFDict)/);
    });
  });

  describe("3. Password-Protected and Encrypted PDF Handling", () => {
    it("detects encrypted PDF in applyWatermark and throws user-friendly error", async () => {
      const encryptedPdf = await createEncryptedPdf();
      await expect(
        applyWatermark(encryptedPdf, { text: "CLASSIFIED" })
      ).rejects.toThrow("This PDF is password-protected or encrypted. Please provide an unencrypted PDF.");
    });

    it("detects encrypted PDF in applyPageNumbers and throws user-friendly error", async () => {
      const encryptedPdf = await createEncryptedPdf();
      await expect(
        applyPageNumbers(encryptedPdf, { format: "page-x-of-y" })
      ).rejects.toThrow("This PDF is password-protected or encrypted. Please provide an unencrypted PDF.");
    });

    it("detects encrypted PDF directly in loadPdfDoc", async () => {
      const encryptedPdf = await createEncryptedPdf();
      await expect(loadPdfDoc(encryptedPdf)).rejects.toThrow(
        "This PDF is password-protected or encrypted. Please provide an unencrypted PDF."
      );
    });
  });

  describe("4. Zero, Extreme, and Boundary Opacity", () => {
    it("handles opacity: 0 (clamping to 0.01) without crashing", async () => {
      const pdf = await createTestPdf(1);
      const output = await applyWatermark(pdf, {
        text: "GHOST",
        opacity: 0,
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("handles negative opacity (clamping to 0.01) gracefully", async () => {
      const pdf = await createTestPdf(1);
      const output = await applyWatermark(pdf, {
        text: "NEGATIVE",
        opacity: -5,
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("handles maximum opacity (1.0) and over-limit opacity (clamping to 1.0)", async () => {
      const pdf = await createTestPdf(1);
      const outputMax = await applyWatermark(pdf, {
        text: "SOLID",
        opacity: 1.0,
      });
      expect(outputMax).toBeInstanceOf(Uint8Array);

      const outputOver = await applyWatermark(pdf, {
        text: "OVER_SOLID",
        opacity: 99.9,
      });
      expect(outputOver).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(outputOver);
      expect(reloaded.getPageCount()).toBe(1);
    });
  });

  describe("5. Rotation Angles (360°, Multi-Rotations, and Negatives)", () => {
    it("handles 360-degree rotation correctly", async () => {
      const pdf = await createTestPdf(1);
      const output = await applyWatermark(pdf, {
        text: "FULL CIRCLE",
        rotation: 360,
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("handles 0-degree, 90-degree, 180-degree, and 270-degree rotations", async () => {
      const pdf = await createTestPdf(1);
      for (const rot of [0, 90, 180, 270]) {
        const output = await applyWatermark(pdf, {
          text: `ROT_${rot}`,
          rotation: rot,
        });
        const reloaded = await PDFDocument.load(output);
        expect(reloaded.getPageCount()).toBe(1);
      }
    });

    it("handles negative and extreme multi-turn rotations", async () => {
      const pdf = await createTestPdf(1);
      for (const rot of [-90, -360, 720, -720, 45.5]) {
        const output = await applyWatermark(pdf, {
          text: `ROT_${rot}`,
          rotation: rot,
        });
        const reloaded = await PDFDocument.load(output);
        expect(reloaded.getPageCount()).toBe(1);
      }
    });
  });

  describe("6. Multi-Page Stress Testing (50 Pages)", () => {
    it("applies centered watermark to a 50-page document within reasonable time", async () => {
      const multiPdf = await createTestPdf(50);
      const start = performance.now();
      const output = await applyWatermark(multiPdf, {
        text: "50 PAGES CONFIDENTIAL",
        position: "center",
        fontSize: 32,
      });
      const elapsed = performance.now() - start;

      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(50);
      expect(elapsed).toBeLessThan(10000); // Must finish within 10 seconds
    });

    it("applies repeating tiled watermark to a 50-page document", async () => {
      const multiPdf = await createTestPdf(50);
      const output = await applyWatermark(multiPdf, {
        text: "TILED 50",
        position: "tile",
        fontSize: 24,
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(50);
    });

    it("applies image watermark to a 50-page document", async () => {
      const multiPdf = await createTestPdf(50);
      const output = await applyWatermark(multiPdf, {
        type: "image",
        imageBytes: samplePngBytes,
        imageType: "image/png",
        position: "center",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(50);
    });

    it("applies page numbers to a 50-page document end-to-end", async () => {
      const multiPdf = await createTestPdf(50);
      const output = await applyPageNumbers(multiPdf, {
        format: "page-x-of-y",
        verticalPosition: "footer",
        alignment: "center",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(50);
    });

    it("applies Roman Upper page numbering to a 50-page document", async () => {
      const multiPdf = await createTestPdf(50);
      const output = await applyPageNumbers(multiPdf, {
        format: "roman-upper",
        verticalPosition: "header",
        alignment: "right",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(50);
    });
  });

  describe("7. Out-of-Bounds and Malformed Page Ranges", () => {
    it("throws user-friendly error when page range is completely out-of-bounds", async () => {
      const pdf = await createTestPdf(3);
      await expect(
        applyWatermark(pdf, { text: "OOB", pageRange: "100-200" })
      ).rejects.toThrow("No pages matched the specified page range.");

      await expect(
        applyPageNumbers(pdf, { pageRange: "100-200" })
      ).rejects.toThrow("No pages matched the specified page range.");
    });

    it("throws user-friendly error when page range contains only 0 or negative numbers", async () => {
      const pdf = await createTestPdf(3);
      await expect(
        applyWatermark(pdf, { text: "ZERO", pageRange: "0" })
      ).rejects.toThrow("No pages matched the specified page range.");

      await expect(
        applyPageNumbers(pdf, { pageRange: "-5" })
      ).rejects.toThrow("No pages matched the specified page range.");
    });

    it("throws user-friendly error when page range contains only invalid text", async () => {
      const pdf = await createTestPdf(3);
      await expect(
        applyWatermark(pdf, { text: "TEXT_RANGE", pageRange: "foo, bar, baz" })
      ).rejects.toThrow("No pages matched the specified page range.");
    });

    it("throws user-friendly error when skipFirstPage is true on a 1-page document", async () => {
      const pdf = await createTestPdf(1);
      await expect(
        applyPageNumbers(pdf, { skipFirstPage: true })
      ).rejects.toThrow("No pages matched the specified page range.");
    });

    it("handles partial valid page ranges (e.g. '1, 999' on 3-page document)", async () => {
      const pdf = await createTestPdf(3);
      const output = await applyWatermark(pdf, {
        text: "PAGE 1 ONLY",
        pageRange: "1, 999",
      });
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(3);
    });

    it("handles reverse page ranges (e.g. '3-1' on 3-page document)", async () => {
      const pdf = await createTestPdf(3);
      const output = await applyWatermark(pdf, {
        text: "ALL THREE",
        pageRange: "3-1",
      });
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(3);
    });

    it("clamps large end range to document total pages (e.g. '2-500' on 3-page document)", async () => {
      const pdf = await createTestPdf(3);
      const output = await applyWatermark(pdf, {
        text: "PAGES 2 AND 3",
        pageRange: "2-500",
      });
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(3);
    });
  });

  describe("8. Font Size Extremes and Boundary Scaling", () => {
    it("handles large font size (500pt) in applyWatermark without crashing", async () => {
      const pdf = await createTestPdf(1);
      const output = await applyWatermark(pdf, {
        text: "BIG",
        fontSize: 500,
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("handles very large font size (2000pt) in applyWatermark without crashing", async () => {
      const pdf = await createTestPdf(1);
      const output = await applyWatermark(pdf, {
        text: "GIANT",
        fontSize: 2000,
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("handles large font size (200pt) in applyPageNumbers without crashing", async () => {
      const pdf = await createTestPdf(1);
      const output = await applyPageNumbers(pdf, {
        fontSize: 200,
        format: "page-x-of-y",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("handles tiny font sizes (0.5pt, 1pt) without crashing", async () => {
      const pdf = await createTestPdf(1);
      const outputWm = await applyWatermark(pdf, { fontSize: 0.5 });
      expect(outputWm).toBeInstanceOf(Uint8Array);

      const outputPn = await applyPageNumbers(pdf, { fontSize: 1 });
      expect(outputPn).toBeInstanceOf(Uint8Array);
    });
  });

  describe("9. Page Dimensions and Geometry Extremes", () => {
    it("handles tiny PDF dimensions (20x20 pt)", async () => {
      const tinyPdf = await createTestPdf(1, 20, 20);
      const output = await applyWatermark(tinyPdf, {
        text: "TINY",
        fontSize: 6,
        position: "center",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });

    it("handles huge PDF dimensions (5000x5000 pt)", async () => {
      const hugePdf = await createTestPdf(1, 5000, 5000);
      const output = await applyWatermark(hugePdf, {
        text: "HUGE",
        fontSize: 200,
        position: "tile",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });
  });

  describe("10. Image Watermark Failures & Edge Cases", () => {
    it("throws descriptive error on corrupted image bytes", async () => {
      const pdf = await createTestPdf(1);
      const corruptImage = new Uint8Array([1, 2, 3, 4, 5]);
      await expect(
        applyWatermark(pdf, {
          type: "image",
          imageBytes: corruptImage,
        })
      ).rejects.toThrow(/Failed to embed watermark image/);
    });

    it("throws descriptive error when image watermark is selected but imageBytes is missing", async () => {
      const pdf = await createTestPdf(1);
      await expect(
        applyWatermark(pdf, {
          type: "image",
          imageBytes: undefined,
        })
      ).rejects.toThrow("Please provide an image file for the image watermark.");
    });
  });

  describe("11. Page Number Formats, Roman Bounds, and Custom Prefixes", () => {
    it("handles Roman numbers up to 3999 and beyond (graceful fallback)", () => {
      expect(toRoman(1)).toBe("I");
      expect(toRoman(3999)).toBe("MMMCMXCIX");
      expect(toRoman(4000)).toBe("4000"); // fallback to integer string
      expect(toRoman(0)).toBe("0");
      expect(toRoman(-10)).toBe("-10");
    });

    it("handles large startNumber in applyPageNumbers", async () => {
      const pdf = await createTestPdf(2);
      const output = await applyPageNumbers(pdf, {
        startNumber: 50000,
        format: "page-x-of-y",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(2);
    });

    it("handles negative startNumber in applyPageNumbers", async () => {
      const pdf = await createTestPdf(2);
      const output = await applyPageNumbers(pdf, {
        startNumber: -5,
        format: "custom",
        customPrefix: "INDEX: ",
        customSuffix: " [DRAFT]",
      });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(2);
    });
  });

  describe("12. Unicode and Unhandled Exception Guardrails", () => {
    it("ensures non-WinAnsi characters throw a clean Error (catchable by UI) rather than unhandled crash", async () => {
      const pdf = await createTestPdf(1);
      // WinAnsi cannot encode emoji; verify it throws standard Error catchable by UI try/catch
      await expect(
        applyWatermark(pdf, { text: "WATERMARK 🚀" })
      ).rejects.toThrow(/WinAnsi cannot encode/);
    });

    it("empty watermark text falls back to default CONFIDENTIAL without crashing", async () => {
      const pdf = await createTestPdf(1);
      const output = await applyWatermark(pdf, { text: "   " });
      expect(output).toBeInstanceOf(Uint8Array);
      const reloaded = await PDFDocument.load(output);
      expect(reloaded.getPageCount()).toBe(1);
    });
  });
});
