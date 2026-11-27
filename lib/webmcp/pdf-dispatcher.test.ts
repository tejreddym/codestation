import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { dispatchToolExecution } from "./dispatcher";

describe("PDF WebMCP dispatcher", () => {
  it.each(["pdf-to-text", "pdf-to-images", "pdf-reorder-pages", "pdf-compressor"])(
    "returns an honest manual-file notice for %s",
    async (toolId) => {
      const payload = JSON.parse(await dispatchToolExecution(toolId, "", { range: "1-2" })) as {
        status: string;
        category: string;
        canonicalUrl: string;
        notice: string;
      };
      expect(payload).toMatchObject({
        status: "manual-file-required",
        category: "PDF",
        canonicalUrl: `https://codestation.in/tools/${toolId}`,
      });
      expect(payload.notice).toMatch(/file picker/);
      expect(payload.notice).toMatch(/WebMCP cannot read a file/);
      expect(payload.notice).toMatch(/no document is processed by this call/);
    },
  );

  it("compresses base64 PDF input when provided to pdf-compressor", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 400]);
    page.drawText("WebMCP test content for compression");
    const rawBytes = await doc.save();
    const base64Input = Buffer.from(rawBytes).toString("base64");

    const payload = JSON.parse(
      await dispatchToolExecution("pdf-compressor", base64Input),
    ) as {
      success: boolean;
      originalSize: number;
      compressedSize: number;
      savingsBytes: number;
      savingsPercentage: number;
      pdfBase64: string;
    };

    expect(payload.success).toBe(true);
    expect(payload.originalSize).toBe(rawBytes.byteLength);
    expect(payload.compressedSize).toBeGreaterThan(0);
    expect(typeof payload.savingsPercentage).toBe("number");
    expect(payload.pdfBase64.length).toBeGreaterThan(0);

    const reloaded = await PDFDocument.load(Buffer.from(payload.pdfBase64, "base64"));
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("keeps the generic fallback for other registered PDF tools", async () => {
    const payload = JSON.parse(await dispatchToolExecution("pdf-merge", "local-test")) as {
      status: string;
      echo?: string;
    };
    expect(payload.status).toBe("ready");
    expect(payload.echo).toBe("local-test");
  });
});
