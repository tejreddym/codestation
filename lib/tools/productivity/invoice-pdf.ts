import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { type InvoiceData, calculateInvoiceTotals, formatCurrency } from "./invoice";

export async function generateInvoicePdf(invoice: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points (72 DPI)
  const { height, width } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Embed logo if valid base64 PNG or JPEG
  if (invoice.logoUrl && invoice.logoUrl.startsWith("data:image/")) {
    try {
      const parts = invoice.logoUrl.split(",");
      if (parts[1]) {
        const mime = invoice.logoUrl.substring(invoice.logoUrl.indexOf(":") + 1, invoice.logoUrl.indexOf(";"));
        const binaryString = atob(parts[1]);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        let embeddedImage;
        if (mime.includes("png")) {
          embeddedImage = await pdfDoc.embedPng(bytes);
        } else if (mime.includes("jpeg") || mime.includes("jpg")) {
          embeddedImage = await pdfDoc.embedJpg(bytes);
        }

        if (embeddedImage) {
          const scaled = embeddedImage.scaleToFit(120, 50);
          page.drawImage(embeddedImage, {
            x: 50,
            y: height - 50 - scaled.height,
            width: scaled.width,
            height: scaled.height,
          });
        }
      }
    } catch {
      // If logo fails to embed, continue without logo rather than breaking PDF generation
    }
  }

  // Header Title
  page.drawText("INVOICE", {
    x: width - 180,
    y: height - 60,
    size: 26,
    font: fontBold,
    color: rgb(0.12, 0.14, 0.16),
  });

  page.drawText(`# ${invoice.invoiceNumber}`, {
    x: width - 180,
    y: height - 80,
    size: 12,
    font: fontBold,
    color: rgb(0.35, 0.4, 0.45),
  });

  page.drawText(`Date: ${invoice.issueDate}`, {
    x: width - 180,
    y: height - 98,
    size: 10,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawText(`Due: ${invoice.dueDate}`, {
    x: width - 180,
    y: height - 114,
    size: 10,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Parties (From / To)
  let y = height - 145;

  page.drawText("FROM:", { x: 50, y, size: 9, font: fontBold, color: rgb(0.5, 0.55, 0.6) });
  page.drawText("BILL TO:", { x: 300, y, size: 9, font: fontBold, color: rgb(0.5, 0.55, 0.6) });

  y -= 16;
  page.drawText(invoice.fromName || "Your Company", { x: 50, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(invoice.toName || "Client Name", { x: 300, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  y -= 14;
  if (invoice.fromEmail) {
    page.drawText(invoice.fromEmail, { x: 50, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  }
  if (invoice.toEmail) {
    page.drawText(invoice.toEmail, { x: 300, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  }

  y -= 12;
  const fromLines = (invoice.fromAddress || "").split("\n").filter(Boolean);
  const toLines = (invoice.toAddress || "").split("\n").filter(Boolean);
  const maxAddrLines = Math.max(fromLines.length, toLines.length);

  for (let i = 0; i < maxAddrLines; i++) {
    if (fromLines[i]) page.drawText(fromLines[i], { x: 50, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    if (toLines[i]) page.drawText(toLines[i], { x: 300, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    y -= 12;
  }

  // Items Table Header
  y -= 20;
  page.drawRectangle({
    x: 50,
    y: y - 6,
    width: width - 100,
    height: 24,
    color: rgb(0.94, 0.96, 0.97),
  });

  page.drawText("Description", { x: 60, y: y + 2, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.3) });
  page.drawText("Qty", { x: 340, y: y + 2, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.3) });
  page.drawText("Unit Price", { x: 395, y: y + 2, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.3) });
  page.drawText("Amount", { x: 480, y: y + 2, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.3) });

  y -= 22;

  // Items
  for (const item of invoice.items) {
    const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);

    page.drawText(item.description || "Item", { x: 60, y, size: 9, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(String(item.quantity || 0), { x: 340, y, size: 9, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(formatCurrency(Number(item.unitPrice || 0), invoice.currencySymbol), { x: 395, y, size: 9, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(formatCurrency(lineTotal, invoice.currencySymbol), { x: 480, y, size: 9, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });

    // Light divider rule
    page.drawLine({
      start: { x: 50, y: y - 8 },
      end: { x: width - 50, y: y - 8 },
      thickness: 0.5,
      color: rgb(0.9, 0.92, 0.94),
    });

    y -= 20;
    if (y < 120) break; // Keep within single-page bounds for standard invoice
  }

  // Summary Totals
  const totals = calculateInvoiceTotals(invoice);
  y -= 15;

  const summaryXLabel = 360;
  const summaryXValue = 480;

  page.drawText("Subtotal:", { x: summaryXLabel, y, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(formatCurrency(totals.subtotal, invoice.currencySymbol), { x: summaryXValue, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;

  if (totals.discountAmount > 0) {
    page.drawText("Discount:", { x: summaryXLabel, y, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.5) });
    page.drawText(`-${formatCurrency(totals.discountAmount, invoice.currencySymbol)}`, { x: summaryXValue, y, size: 9, font: fontRegular, color: rgb(0.8, 0.2, 0.2) });
    y -= 14;
  }

  if (totals.taxAmount > 0) {
    page.drawText(`${invoice.taxLabel || "Tax"} (${invoice.taxRate}%):`, { x: summaryXLabel, y, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.5) });
    page.drawText(formatCurrency(totals.taxAmount, invoice.currencySymbol), { x: summaryXValue, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  }

  if (totals.shippingAmount > 0) {
    page.drawText("Shipping:", { x: summaryXLabel, y, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.5) });
    page.drawText(formatCurrency(totals.shippingAmount, invoice.currencySymbol), { x: summaryXValue, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  }

  // Total Bar
  y -= 4;
  page.drawRectangle({
    x: summaryXLabel - 10,
    y: y - 8,
    width: width - summaryXLabel - 40,
    height: 24,
    color: rgb(0.12, 0.14, 0.18),
  });

  page.drawText("TOTAL DUE:", { x: summaryXLabel, y: y, size: 10, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(formatCurrency(totals.total, invoice.currencySymbol), { x: summaryXValue, y: y, size: 11, font: fontBold, color: rgb(0.85, 0.98, 0.46) });

  // Payment Details & Notes (Left column below items)
  let notesY = y + 40;
  if (invoice.paymentTerms || invoice.bankDetails || invoice.notes) {
    page.drawText("PAYMENT INSTRUCTIONS & NOTES", { x: 50, y: notesY, size: 8, font: fontBold, color: rgb(0.5, 0.55, 0.6) });
    notesY -= 12;

    if (invoice.paymentTerms) {
      page.drawText(`Terms: ${invoice.paymentTerms}`, { x: 50, y: notesY, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.4) });
      notesY -= 11;
    }

    if (invoice.bankDetails) {
      for (const line of invoice.bankDetails.split("\n")) {
        page.drawText(line, { x: 50, y: notesY, size: 8, font: fontRegular, color: rgb(0.35, 0.4, 0.45) });
        notesY -= 10;
      }
    }

    if (invoice.notes) {
      page.drawText(invoice.notes, { x: 50, y: notesY, size: 8, font: fontRegular, color: rgb(0.45, 0.5, 0.55) });
    }
  }

  // Footer privacy assurance
  page.drawText("Generated 100% in-browser with Code Station. Zero server uploads.", {
    x: 50,
    y: 35,
    size: 7,
    font: fontRegular,
    color: rgb(0.65, 0.7, 0.75),
  });

  return await pdfDoc.save();
}
