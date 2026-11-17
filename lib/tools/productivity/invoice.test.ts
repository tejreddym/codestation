import { describe, it, expect } from "vitest";
import {
  calculateInvoiceTotals,
  generateBulkInvoices,
  getSampleInvoice,
  invoiceToCsv,
  formatCurrency,
} from "./invoice";

describe("Invoice Calculations Engine", () => {
  it("calculates basic subtotal and total without tax or discount", () => {
    const totals = calculateInvoiceTotals({
      items: [
        { id: "1", description: "Design", quantity: 2, unitPrice: 100 },
        { id: "2", description: "Development", quantity: 5, unitPrice: 50 },
      ],
      taxRate: 0,
      discount: 0,
      discountType: "percentage",
      shipping: 0,
    });

    expect(totals.subtotal).toBe(450);
    expect(totals.discountAmount).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(450);
  });

  it("calculates percentage discount accurately", () => {
    const totals = calculateInvoiceTotals({
      items: [{ id: "1", description: "Audit", quantity: 1, unitPrice: 1000 }],
      taxRate: 10,
      discount: 20, // 20%
      discountType: "percentage",
      shipping: 15,
    });

    // Subtotal: 1000
    // Discount: 200 (20%)
    // Taxable: 800
    // Tax (10% of 800): 80
    // Shipping: 15
    // Total: 800 + 80 + 15 = 895
    expect(totals.subtotal).toBe(1000);
    expect(totals.discountAmount).toBe(200);
    expect(totals.taxableAmount).toBe(800);
    expect(totals.taxAmount).toBe(80);
    expect(totals.shippingAmount).toBe(15);
    expect(totals.total).toBe(895);
  });

  it("calculates fixed amount discount without exceeding subtotal", () => {
    const totals = calculateInvoiceTotals({
      items: [{ id: "1", description: "Hosting", quantity: 1, unitPrice: 50 }],
      taxRate: 10,
      discount: 100, // Fixed discount exceeds subtotal
      discountType: "fixed",
      shipping: 0,
    });

    expect(totals.subtotal).toBe(50);
    expect(totals.discountAmount).toBe(50); // capped at subtotal
    expect(totals.taxableAmount).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("formats currency correctly", () => {
    expect(formatCurrency(1234.56, "$")).toBe("$1,234.56");
    expect(formatCurrency(500, "€")).toBe("€500.00");
  });

  it("exports valid CSV structure with item and total details", () => {
    const sample = getSampleInvoice();
    const csv = invoiceToCsv(sample);
    expect(csv).toContain("Invoice Number,INV-2026-001");
    expect(csv).toContain("Acme Web Studio LLC");
    expect(csv).toContain("Starlight Interactive Inc.");
    expect(csv).toContain("Subtotal");
    expect(csv).toContain("Total");
  });

  it("generates a series of bulk invoices with sequential numbering", () => {
    const sample = getSampleInvoice();
    const batch = generateBulkInvoices({
      baseInvoice: sample,
      prefix: "BATCH-",
      startNumber: 101,
      count: 3,
      recipientsText: "Alpha Corp, alpha@example.com\nBeta LLC, beta@example.com",
    });

    expect(batch).toHaveLength(3);
    expect(batch[0].invoiceNumber).toBe("BATCH-0101");
    expect(batch[0].toName).toBe("Alpha Corp");
    expect(batch[1].invoiceNumber).toBe("BATCH-0102");
    expect(batch[1].toName).toBe("Beta LLC");
    expect(batch[2].invoiceNumber).toBe("BATCH-0103");
    expect(batch[2].toName).toContain("#3");
  });
});
