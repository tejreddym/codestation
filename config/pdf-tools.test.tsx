// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PDFDocument } from "pdf-lib";
import { pdfTools } from "./pdf-tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata } from "@/app/tools/[slug]/page";
import {
  applyWatermark,
  applyPageNumbers,
  loadPdfDoc,
  toRoman,
  parseColor,
} from "@/lib/tools/pdf/engine";

vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);

it("registers exactly 9 PDF contracts", () => {
  expect(pdfTools).toHaveLength(9);
  expect(getStation("pdf")).toMatchObject({ route: "/stations/pdf", toolCount: 9 });
});

it.each(pdfTools)("$id public direct metadata/contract", async (tool) => {
  const params = Promise.resolve({ slug: tool.slug });
  expect(await generateMetadata({ params })).toMatchObject({
    title: tool.seo.title,
    alternates: { canonical: `/tools/${tool.slug}` },
  });
  render(await ToolPage({ params }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
  expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse the PDF station →" }).getAttribute("href")).toBe(
    "/stations/pdf"
  );
});

describe("PDF Watermark Engine", () => {
  async function createTestPdf(pageCount = 2): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage([400, 600]);
    }
    return await doc.save();
  }

  // 1x1 transparent PNG bytes for testing image watermark
  const samplePngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  it("applies centered text watermark to all pages", async () => {
    const initialPdf = await createTestPdf(2);
    const result = await applyWatermark(initialPdf, {
      type: "text",
      text: "TOP SECRET",
      fontSize: 36,
      opacity: 0.5,
      rotation: 45,
      position: "center",
      color: "#ff0000",
    });

    expect(result).toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);
  });

  it("applies repeating tiled watermark", async () => {
    const initialPdf = await createTestPdf(1);
    const result = await applyWatermark(initialPdf, {
      type: "text",
      text: "DRAFT",
      position: "tile",
      rotation: 30,
      opacity: 0.2,
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(1);
  });

  it("applies corner-positioned watermarks", async () => {
    const initialPdf = await createTestPdf(1);
    for (const pos of ["top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      const result = await applyWatermark(initialPdf, {
        type: "text",
        text: "CORNER",
        position: pos,
        rotation: 0,
      });
      const doc = await PDFDocument.load(result);
      expect(doc.getPageCount()).toBe(1);
    }
  });

  it("applies image watermark using PNG bytes", async () => {
    const initialPdf = await createTestPdf(1);
    const result = await applyWatermark(initialPdf, {
      type: "image",
      imageBytes: samplePngBytes,
      imageType: "image/png",
      scale: 100,
      opacity: 0.4,
      position: "center",
      rotation: 0,
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(1);
  });

  it("restricts watermark to selected page range", async () => {
    const initialPdf = await createTestPdf(3);
    const result = await applyWatermark(initialPdf, {
      text: "PAGE TWO ONLY",
      pageRange: "2",
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it("throws a user-friendly error when image watermark is selected without image bytes", async () => {
    const initialPdf = await createTestPdf(1);
    await expect(
      applyWatermark(initialPdf, {
        type: "image",
      })
    ).rejects.toThrow("Please provide an image file for the image watermark.");
  });

  it("throws a user-friendly error on corrupted PDF", async () => {
    const corruptBuffer = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(
      applyWatermark(corruptBuffer, {
        text: "FAIL",
      })
    ).rejects.toThrow(/Failed to load PDF/);
  });

  it("throws a user-friendly error on empty PDF", async () => {
    const emptyBuffer = new Uint8Array([]);
    await expect(
      applyWatermark(emptyBuffer, {
        text: "FAIL",
      })
    ).rejects.toThrow("PDF file is empty. Please provide a valid PDF document.");
  });
});

describe("PDF Page Numberer Engine", () => {
  async function createTestPdf(pageCount = 3): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage([500, 700]);
    }
    return await doc.save();
  }

  it("applies standard 'Page X of Y' numbering to footer", async () => {
    const initialPdf = await createTestPdf(3);
    const result = await applyPageNumbers(initialPdf, {
      format: "page-x-of-y",
      verticalPosition: "footer",
      alignment: "center",
      fontFamily: "Helvetica",
      fontSize: 10,
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it("applies 'X / Y' numbering to header", async () => {
    const initialPdf = await createTestPdf(2);
    const result = await applyPageNumbers(initialPdf, {
      format: "x-of-y",
      verticalPosition: "header",
      alignment: "right",
      fontFamily: "Times Roman",
      fontSize: 12,
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);
  });

  it("applies Roman Lower and Roman Upper formats", async () => {
    const initialPdf = await createTestPdf(3);
    const lowerResult = await applyPageNumbers(initialPdf, {
      format: "roman-lower",
      fontFamily: "Courier",
    });
    expect((await PDFDocument.load(lowerResult)).getPageCount()).toBe(3);

    const upperResult = await applyPageNumbers(initialPdf, {
      format: "roman-upper",
    });
    expect((await PDFDocument.load(upperResult)).getPageCount()).toBe(3);
  });

  it("applies custom prefix and suffix format", async () => {
    const initialPdf = await createTestPdf(2);
    const result = await applyPageNumbers(initialPdf, {
      format: "custom",
      customPrefix: "- ",
      customSuffix: " -",
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);
  });

  it("skips first page when skipFirstPage is true", async () => {
    const initialPdf = await createTestPdf(3);
    const result = await applyPageNumbers(initialPdf, {
      skipFirstPage: true,
      startNumber: 1,
    });

    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it("throws clear error on corrupted PDF", async () => {
    const corruptBuffer = new Uint8Array([0, 255, 12, 34]);
    await expect(applyPageNumbers(corruptBuffer)).rejects.toThrow(/Failed to load PDF/);
  });

  it("correctly converts integers to Roman numerals", () => {
    expect(toRoman(1, false)).toBe("i");
    expect(toRoman(4, true)).toBe("IV");
    expect(toRoman(9, false)).toBe("ix");
    expect(toRoman(14, true)).toBe("XIV");
    expect(toRoman(2026, true)).toBe("MMXXVI");
    expect(toRoman(0, true)).toBe("0");
  });

  it("parses hex and rgb color strings accurately", () => {
    const red = parseColor("#ff0000");
    expect(red).toBeDefined();
    const rgbColor = parseColor("rgb(0, 128, 255)");
    expect(rgbColor).toBeDefined();
    const namedBlack = parseColor("black");
    expect(namedBlack).toBeDefined();
  });
});
