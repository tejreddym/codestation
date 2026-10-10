import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  parsePageRange,
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePdfPages,
  imagesToPdf,
  extractPdfInfo,
} from "./engine";

describe("PDF Engine", () => {
  it("correctly parses human-friendly page ranges", () => {
    expect(parsePageRange("1, 3-5, 8", 10)).toEqual([0, 2, 3, 4, 7]);
    expect(parsePageRange("4-2", 10)).toEqual([1, 2, 3]);
    expect(parsePageRange("", 3)).toEqual([0, 1, 2]);
    expect(parsePageRange("100", 5)).toEqual([]);
  });

  it("merges multiple PDFs", async () => {
    const doc1 = await PDFDocument.create();
    doc1.addPage([100, 100]);
    doc1.addPage([100, 100]);
    const bytes1 = await doc1.save();

    const doc2 = await PDFDocument.create();
    doc2.addPage([100, 100]);
    const bytes2 = await doc2.save();

    const mergedBytes = await mergePdfs([bytes1.buffer as ArrayBuffer, bytes2.buffer as ArrayBuffer]);
    const mergedDoc = await PDFDocument.load(mergedBytes);
    expect(mergedDoc.getPageCount()).toBe(3);
  });

  it("splits a PDF by selected page indices", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    doc.addPage([200, 200]);
    doc.addPage([300, 300]);
    const sourceBytes = await doc.save();

    const splitBytes = await splitPdf(sourceBytes.buffer as ArrayBuffer, [1]);
    const splitDoc = await PDFDocument.load(splitBytes);
    expect(splitDoc.getPageCount()).toBe(1);
    expect(splitDoc.getPage(0).getWidth()).toBe(200);
  });

  it("rotates pages by 90 degrees", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const sourceBytes = await doc.save();

    const rotatedBytes = await rotatePdf(sourceBytes.buffer as ArrayBuffer, 90);
    const rotatedDoc = await PDFDocument.load(rotatedBytes);
    expect(rotatedDoc.getPage(0).getRotation().angle).toBe(90);
  });

  it("deletes specified pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    doc.addPage([200, 200]);
    doc.addPage([300, 300]);
    const sourceBytes = await doc.save();

    const resultBytes = await deletePdfPages(sourceBytes.buffer as ArrayBuffer, [0, 2]);
    const resultDoc = await PDFDocument.load(resultBytes);
    expect(resultDoc.getPageCount()).toBe(1);
    expect(resultDoc.getPage(0).getWidth()).toBe(200);
  });

  it("extracts document info and metadata", async () => {
    const doc = await PDFDocument.create();
    doc.setTitle("Test Doc");
    doc.setAuthor("Antigravity");
    doc.addPage();
    const sourceBytes = await doc.save();

    const info = await extractPdfInfo(sourceBytes.buffer as ArrayBuffer);
    expect(info.pageCount).toBe(1);
    expect(info.title).toBe("Test Doc");
    expect(info.author).toBe("Antigravity");
  });
});
