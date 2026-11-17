import { describe, it, expect } from "vitest";
import { generateInvoicePdf } from "./invoice-pdf";
import { getSampleInvoice } from "./invoice";

describe("Invoice PDF Generation", () => {
  it("generates a valid PDF binary buffer from invoice data", async () => {
    const sample = getSampleInvoice();
    const pdfBytes = await generateInvoicePdf(sample);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header magic bytes %PDF-
    const header = String.fromCharCode(...pdfBytes.subarray(0, 5));
    expect(header).toBe("%PDF-");
  });
});
