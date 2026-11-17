export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type InvoiceTemplate = "modern" | "classic" | "minimal";
export type DiscountType = "percentage" | "fixed";

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  fromName: string;
  fromEmail: string;
  fromAddress: string;
  fromPhone: string;
  toName: string;
  toEmail: string;
  toAddress: string;
  toPhone: string;
  items: InvoiceItem[];
  taxRate: number; // percentage, e.g. 10 for 10%
  taxLabel: string; // e.g. "Tax", "VAT", "GST"
  discount: number;
  discountType: DiscountType;
  shipping: number;
  notes: string;
  paymentTerms: string;
  bankDetails: string;
  logoUrl?: string; // base64 or object URL
  template: InvoiceTemplate;
}

export interface InvoiceCalculations {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
}

export const CURRENCIES: Array<{ code: string; symbol: string; label: string }> = [
  { code: "USD", symbol: "$", label: "USD ($) - US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR (€) - Euro" },
  { code: "GBP", symbol: "£", label: "GBP (£) - British Pound" },
  { code: "INR", symbol: "₹", label: "INR (₹) - Indian Rupee" },
  { code: "CAD", symbol: "CA$", label: "CAD (CA$) - Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "AUD (A$) - Australian Dollar" },
  { code: "JPY", symbol: "¥", label: "JPY (¥) - Japanese Yen" },
  { code: "SGD", symbol: "S$", label: "SGD (S$) - Singapore Dollar" },
  { code: "CHF", symbol: "CHF", label: "CHF - Swiss Franc" },
];

export function calculateInvoiceTotals(data: Pick<InvoiceData, "items" | "taxRate" | "discount" | "discountType" | "shipping">): InvoiceCalculations {
  const subtotal = data.items.reduce((acc, item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return acc + qty * price;
  }, 0);

  let discountAmount = 0;
  const rawDiscount = Math.max(0, Number(data.discount) || 0);
  if (data.discountType === "percentage") {
    const pct = Math.min(100, rawDiscount);
    discountAmount = (subtotal * pct) / 100;
  } else {
    discountAmount = Math.min(subtotal, rawDiscount);
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRate = Math.max(0, Number(data.taxRate) || 0);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const shippingAmount = Math.max(0, Number(data.shipping) || 0);
  const total = taxableAmount + taxAmount + shippingAmount;

  return {
    subtotal: roundToTwo(subtotal),
    discountAmount: roundToTwo(discountAmount),
    taxableAmount: roundToTwo(taxableAmount),
    taxAmount: roundToTwo(taxAmount),
    shippingAmount: roundToTwo(shippingAmount),
    total: roundToTwo(total),
  };
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, symbol: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function getSampleInvoice(): InvoiceData {
  const today = new Date().toISOString().split("T")[0];
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return {
    invoiceNumber: "INV-2026-001",
    issueDate: today,
    dueDate: due,
    currency: "USD",
    currencySymbol: "$",
    fromName: "Acme Web Studio LLC",
    fromEmail: "billing@acmestudio.example",
    fromAddress: "100 Innovation Way, Suite 400\nSan Francisco, CA 94105",
    fromPhone: "+1 (555) 234-5678",
    toName: "Starlight Interactive Inc.",
    toEmail: "accounts@starlight.example",
    toAddress: "742 Evergreen Terrace\nAustin, TX 78701",
    toPhone: "+1 (555) 876-5432",
    items: [
      { id: "item-1", description: "Design System Architecture & Tactile Tokens", quantity: 1, unitPrice: 3200 },
      { id: "item-2", description: "Frontend Next.js App Router Implementation", quantity: 40, unitPrice: 125 },
      { id: "item-3", description: "WebMCP Agent Protocol Integration & Verification", quantity: 15, unitPrice: 150 },
    ],
    taxRate: 8.5,
    taxLabel: "State Sales Tax",
    discount: 5,
    discountType: "percentage",
    shipping: 0,
    notes: "Thank you for your business! Please include the invoice number in the payment memo.",
    paymentTerms: "Payment due within 30 days of issue date (Net 30).",
    bankDetails: "Bank: Silicon Valley Trust\nRouting: 121000358\nAccount: 9876543210\nSWIFT: SVTRUS33",
    template: "modern",
  };
}

export interface BulkInvoiceBatchConfig {
  baseInvoice: InvoiceData;
  prefix: string;
  startNumber: number;
  count: number;
  recipientsText: string; // CSV or line-separated "Client Name, Email, Address, AmountMultiplier"
}

export function generateBulkInvoices(config: BulkInvoiceBatchConfig): InvoiceData[] {
  const count = Math.max(1, Math.min(100, Number(config.count) || 1));
  const lines = (config.recipientsText || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const results: InvoiceData[] = [];
  const baseNum = Number(config.startNumber) || 1;

  for (let i = 0; i < count; i++) {
    const currentNum = baseNum + i;
    const invNumber = `${config.prefix || "INV-"}${String(currentNum).padStart(4, "0")}`;

    let toName = config.baseInvoice.toName;
    let toEmail = config.baseInvoice.toEmail;
    let toAddress = config.baseInvoice.toAddress;
    let multiplier = 1;

    if (lines[i]) {
      const parts = lines[i].split(",").map(p => p.trim());
      if (parts[0]) toName = parts[0];
      if (parts[1]) toEmail = parts[1];
      if (parts[2]) toAddress = parts[2];
      if (parts[3] && !isNaN(Number(parts[3]))) multiplier = Math.max(0.1, Number(parts[3]));
    } else if (i > 0) {
      toName = `${config.baseInvoice.toName} #${i + 1}`;
    }

    const items = config.baseInvoice.items.map(item => ({
      ...item,
      id: `${item.id}-${i + 1}`,
      unitPrice: roundToTwo(item.unitPrice * multiplier),
    }));

    results.push({
      ...config.baseInvoice,
      invoiceNumber: invNumber,
      toName,
      toEmail,
      toAddress,
      items,
    });
  }

  return results;
}

export function invoiceToCsv(invoice: InvoiceData): string {
  const totals = calculateInvoiceTotals(invoice);
  const rows = [
    ["Invoice Number", invoice.invoiceNumber],
    ["Issue Date", invoice.issueDate],
    ["Due Date", invoice.dueDate],
    ["Currency", invoice.currency],
    ["From", invoice.fromName.replace(/\n/g, " ")],
    ["To", invoice.toName.replace(/\n/g, " ")],
    [],
    ["Item Description", "Quantity", "Unit Price", "Line Total"],
    ...invoice.items.map(item => [
      `"${item.description.replace(/"/g, '""')}"`,
      String(item.quantity),
      String(item.unitPrice),
      String(roundToTwo(item.quantity * item.unitPrice)),
    ]),
    [],
    ["Subtotal", String(totals.subtotal)],
    ["Discount", String(totals.discountAmount)],
    ["Taxable Amount", String(totals.taxableAmount)],
    [`${invoice.taxLabel} (${invoice.taxRate}%)`, String(totals.taxAmount)],
    ["Shipping", String(totals.shippingAmount)],
    ["Total", String(totals.total)],
  ];

  return rows.map(r => r.join(",")).join("\n");
}
