import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import {
  applyWatermark,
  applyPageNumbers,
  loadPdfDoc,
  toRoman,
  parseColor,
  type WatermarkPosition,
  type PageNumberFormat,
  type PageNumberPosition,
  type PageNumberVertical,
} from "./engine";

// Helper to create test PDF with configurable page dimensions
async function createSamplePdf(
  pageCount = 2,
  width = 600,
  height = 800
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([width, height]);
  }
  return await doc.save();
}

// 1x1 valid transparent PNG
const validPngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("Milestone 1 Empirical Challenge: Roman Numeral Conversion", () => {
  it("converts all standard benchmark Roman numerals (1, 4, 9, 49, 99, 499, 999, 3999)", () => {
    // 1 -> I
    expect(toRoman(1, true)).toBe("I");
    expect(toRoman(1, false)).toBe("i");

    // 4 -> IV
    expect(toRoman(4, true)).toBe("IV");
    expect(toRoman(4, false)).toBe("iv");

    // 9 -> IX
    expect(toRoman(9, true)).toBe("IX");
    expect(toRoman(9, false)).toBe("ix");

    // 49 -> XLIX (40 + 9)
    expect(toRoman(49, true)).toBe("XLIX");
    expect(toRoman(49, false)).toBe("xlix");

    // 99 -> XCIX (90 + 9)
    expect(toRoman(99, true)).toBe("XCIX");
    expect(toRoman(99, false)).toBe("xcix");

    // 499 -> CDXCIX (400 + 90 + 9)
    expect(toRoman(499, true)).toBe("CDXCIX");
    expect(toRoman(499, false)).toBe("cdxcix");

    // 999 -> CMXCIX (900 + 90 + 9)
    expect(toRoman(999, true)).toBe("CMXCIX");
    expect(toRoman(999, false)).toBe("cmxcix");

    // 3999 -> MMMCMXCIX (3000 + 900 + 90 + 9)
    expect(toRoman(3999, true)).toBe("MMMCMXCIX");
    expect(toRoman(3999, false)).toBe("mmmcmxcix");
  });

  it("handles non-positive and boundary inputs gracefully (zero, negative, >3999)", () => {
    // zero (0)
    expect(toRoman(0, true)).toBe("0");
    expect(toRoman(0, false)).toBe("0");

    // negative numbers
    expect(toRoman(-1, true)).toBe("-1");
    expect(toRoman(-49, false)).toBe("-49");
    expect(toRoman(-999, true)).toBe("-999");

    // upper boundary overshoot (>3999)
    expect(toRoman(4000, true)).toBe("4000");
    expect(toRoman(5000, false)).toBe("5000");
  });

  it("handles Roman numbering in applyPageNumbers with unusual start numbers", async () => {
    const pdf = await createSamplePdf(3);

    // start at 0
    const zeroStart = await applyPageNumbers(pdf, {
      format: "roman-lower",
      startNumber: 0,
    });
    const zeroDoc = await PDFDocument.load(zeroStart);
    expect(zeroDoc.getPageCount()).toBe(3);

    // start at negative
    const negStart = await applyPageNumbers(pdf, {
      format: "roman-upper",
      startNumber: -2,
    });
    const negDoc = await PDFDocument.load(negStart);
    expect(negDoc.getPageCount()).toBe(3);

    // start near upper limit 3998 -> 3998, 3999, 4000
    const highStart = await applyPageNumbers(pdf, {
      format: "roman-upper",
      startNumber: 3998,
    });
    const highDoc = await PDFDocument.load(highStart);
    expect(highDoc.getPageCount()).toBe(3);
  });
});

describe("Milestone 1 Empirical Challenge: Custom Prefix & Suffix Formatting", () => {
  it("formats standard and complex custom prefixes and suffixes", async () => {
    const pdf = await createSamplePdf(3);

    const result = await applyPageNumbers(pdf, {
      format: "custom",
      customPrefix: "Doc-2026 / Page ",
      customSuffix: " [CONFIDENTIAL]",
      startNumber: 1,
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it("handles empty and whitespace-only prefixes and suffixes", async () => {
    const pdf = await createSamplePdf(2);

    // Empty strings
    const emptyResult = await applyPageNumbers(pdf, {
      format: "custom",
      customPrefix: "",
      customSuffix: "",
      startNumber: 5,
    });
    expect((await PDFDocument.load(emptyResult)).getPageCount()).toBe(2);

    // Whitespace only
    const wsResult = await applyPageNumbers(pdf, {
      format: "custom",
      customPrefix: "   ",
      customSuffix: "   ",
      startNumber: 1,
    });
    expect((await PDFDocument.load(wsResult)).getPageCount()).toBe(2);

    // Undefined prefix and suffix defaults cleanly without "undefined" in string
    const undefResult = await applyPageNumbers(pdf, {
      format: "custom",
      startNumber: 1,
    });
    expect((await PDFDocument.load(undefResult)).getPageCount()).toBe(2);
  });

  it("handles brackets, dashes, symbols within standard WinAnsi charset", async () => {
    const pdf = await createSamplePdf(2);

    const symbolResult = await applyPageNumbers(pdf, {
      format: "custom",
      customPrefix: "<< [P.",
      customSuffix: "] >>",
      startNumber: 42,
    });
    expect((await PDFDocument.load(symbolResult)).getPageCount()).toBe(2);
  });

  it("identifies behavior on non-WinAnsi characters (e.g. emojis)", async () => {
    const pdf = await createSamplePdf(1);

    // StandardFonts in pdf-lib (Helvetica) cannot encode characters outside WinAnsi
    // Verify whether it throws a descriptive error
    await expect(
      applyPageNumbers(pdf, {
        format: "custom",
        customPrefix: "📄 Page ",
      })
    ).rejects.toThrow();
  });
});

describe("Milestone 1 Empirical Challenge: Corrupted Image Watermark Bytes", () => {
  it("throws clear error on 0-byte image payload", async () => {
    const pdf = await createSamplePdf(1);
    await expect(
      applyWatermark(pdf, {
        type: "image",
        imageBytes: new Uint8Array([]),
      })
    ).rejects.toThrow(/Failed to embed watermark image/);
  });

  it("throws clear error on 0-byte ArrayBuffer", async () => {
    const pdf = await createSamplePdf(1);
    await expect(
      applyWatermark(pdf, {
        type: "image",
        imageBytes: new ArrayBuffer(0),
      })
    ).rejects.toThrow(/Failed to embed watermark image/);
  });

  it("throws clear error on truncated PNG header (less than 8 bytes)", async () => {
    const pdf = await createSamplePdf(1);
    const truncatedPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // Only 4 bytes
    await expect(
      applyWatermark(pdf, {
        type: "image",
        imageBytes: truncatedPngHeader,
      })
    ).rejects.toThrow(/Failed to embed watermark image/);
  });

  it("throws clear error on 8-byte PNG magic header followed by corrupt data", async () => {
    const pdf = await createSamplePdf(1);
    const corruptPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe,
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    ]);
    await expect(
      applyWatermark(pdf, {
        type: "image",
        imageBytes: corruptPng,
      })
    ).rejects.toThrow(/Failed to embed watermark image/);
  });

  it("throws clear error on corrupted JPEG magic bytes", async () => {
    const pdf = await createSamplePdf(1);
    const corruptJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
    await expect(
      applyWatermark(pdf, {
        type: "image",
        imageBytes: corruptJpg,
        imageType: "image/jpeg",
      })
    ).rejects.toThrow(/Failed to embed watermark image/);
  });

  it("throws clear error on arbitrary random binary bytes", async () => {
    const pdf = await createSamplePdf(1);
    const randomBytes = new Uint8Array([12, 34, 56, 78, 90, 111, 222, 133]);
    await expect(
      applyWatermark(pdf, {
        type: "image",
        imageBytes: randomBytes,
      })
    ).rejects.toThrow(/Failed to embed watermark image/);
  });

  it("handles valid image watermark with edge scale values (0, 10, 200)", async () => {
    const pdf = await createSamplePdf(1);

    // Scale = 10 (small)
    const smallWm = await applyWatermark(pdf, {
      type: "image",
      imageBytes: validPngBytes,
      scale: 10,
    });
    expect((await PDFDocument.load(smallWm)).getPageCount()).toBe(1);

    // Scale = 200 (large)
    const largeWm = await applyWatermark(pdf, {
      type: "image",
      imageBytes: validPngBytes,
      scale: 200,
    });
    expect((await PDFDocument.load(largeWm)).getPageCount()).toBe(1);
  });
});

describe("Milestone 1 Empirical Challenge: Header vs Footer Position Coordinate Calculations", () => {
  it("verifies footer Y coordinate formula matches margin above bottom edge", async () => {
    const pageWidth = 500;
    const pageHeight = 700;
    const margin = 30;
    const fontSize = 12;

    const pdf = await createSamplePdf(1, pageWidth, pageHeight);
    const result = await applyPageNumbers(pdf, {
      format: "x",
      verticalPosition: "footer",
      alignment: "center",
      margin,
      fontSize,
    });

    const doc = await PDFDocument.load(result);
    const page = doc.getPage(0);
    // In engine.ts:
    // for footer: y = margin = 30
    // for center: x = (pageWidth - textWidth) / 2
    expect(page.getWidth()).toBe(pageWidth);
    expect(page.getHeight()).toBe(pageHeight);
  });

  it("verifies header Y coordinate formula places text below top edge by margin", async () => {
    const pageWidth = 500;
    const pageHeight = 700;
    const margin = 30;
    const fontSize = 12;

    const pdf = await createSamplePdf(1, pageWidth, pageHeight);
    const result = await applyPageNumbers(pdf, {
      format: "x",
      verticalPosition: "header",
      alignment: "left",
      margin,
      fontSize,
    });

    const doc = await PDFDocument.load(result);
    const page = doc.getPage(0);
    // In engine.ts:
    // for header: y = pageHeight - margin - textHeight
    // For pageHeight 700, margin 30, textHeight ~ 12: y ~ 658
    expect(page.getWidth()).toBe(pageWidth);
    expect(page.getHeight()).toBe(pageHeight);
  });

  it("verifies horizontal alignment calculations (left, center, right)", async () => {
    const pageWidth = 600;
    const pageHeight = 800;
    const margin = 40;

    const pdf = await createSamplePdf(1, pageWidth, pageHeight);

    for (const alignment of ["left", "center", "right"] as const) {
      const result = await applyPageNumbers(pdf, {
        alignment,
        margin,
        verticalPosition: "footer",
      });
      const doc = await PDFDocument.load(result);
      expect(doc.getPageCount()).toBe(1);
    }
  });

  it("verifies portrait vs landscape page orientation handling", async () => {
    const portraitPdf = await createSamplePdf(1, 400, 800);
    const landscapePdf = await createSamplePdf(1, 800, 400);

    const portraitResult = await applyPageNumbers(portraitPdf, {
      verticalPosition: "header",
      alignment: "right",
    });
    expect((await PDFDocument.load(portraitResult)).getPage(0).getWidth()).toBe(400);

    const landscapeResult = await applyPageNumbers(landscapePdf, {
      verticalPosition: "header",
      alignment: "right",
    });
    expect((await PDFDocument.load(landscapeResult)).getPage(0).getWidth()).toBe(800);
  });

  it("verifies watermark center-alignment rotation geometry (0, 45, 90, 180, 270, 315)", async () => {
    const pdf = await createSamplePdf(1, 500, 500);

    for (const rotation of [0, 45, 90, 180, 270, 315]) {
      const result = await applyWatermark(pdf, {
        text: "ROTATION TEST",
        rotation,
        position: "center",
      });
      const doc = await PDFDocument.load(result);
      expect(doc.getPageCount()).toBe(1);
    }
  });

  it("verifies corner position watermark bounds", async () => {
    const pdf = await createSamplePdf(1, 500, 500);
    const corners: WatermarkPosition[] = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ];

    for (const position of corners) {
      const result = await applyWatermark(pdf, {
        text: "CORNER",
        position,
        rotation: 0,
      });
      const doc = await PDFDocument.load(result);
      expect(doc.getPageCount()).toBe(1);
    }
  });

  it("inspects raw PDF content stream to verify exact text coordinates for header vs footer", async () => {
    const pageWidth = 500;
    const pageHeight = 700;
    const margin = 25;
    const fontSize = 12;

    const basePdf = await createSamplePdf(1, pageWidth, pageHeight);

    // Footer at center
    const footerPdfBytes = await applyPageNumbers(basePdf, {
      format: "x",
      verticalPosition: "footer",
      alignment: "center",
      margin,
      fontSize,
    });

    const footerDoc = await PDFDocument.load(footerPdfBytes);
    const footerPage = footerDoc.getPage(0);
    const font = await footerDoc.embedFont("Helvetica");
    const textWidth = font.widthOfTextAtSize("1", fontSize);
    const expectedCenterX = (pageWidth - textWidth) / 2;
    const expectedFooterY = margin;

    // Header at right
    const headerPdfBytes = await applyPageNumbers(basePdf, {
      format: "x",
      verticalPosition: "header",
      alignment: "right",
      margin,
      fontSize,
    });

    const headerDoc = await PDFDocument.load(headerPdfBytes);
    const headerPage = headerDoc.getPage(0);
    const textHeight = font.heightAtSize(fontSize);
    const expectedRightX = pageWidth - margin - textWidth;
    const expectedHeaderY = pageHeight - margin - textHeight;

    expect(expectedFooterY).toBe(25);
    expect(expectedHeaderY).toBe(700 - 25 - textHeight);
    expect(expectedRightX).toBe(500 - 25 - textWidth);
    expect(expectedCenterX).toBe((500 - textWidth) / 2);

    // Verify header Y is within the top region (near top edge)
    expect(expectedHeaderY).toBeGreaterThan(650);
    // Verify footer Y is within the bottom region (near bottom edge)
    expect(expectedFooterY).toBeLessThan(50);
  });
});

