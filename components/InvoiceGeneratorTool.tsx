"use client";

import { useState, useCallback, useId, useRef } from "react";
import {
  type InvoiceData,
  type InvoiceItem,
  type InvoiceTemplate,
  type DiscountType,
  calculateInvoiceTotals,
  formatCurrency,
  getSampleInvoice,
  generateBulkInvoices,
  invoiceToCsv,
  CURRENCIES,
} from "@/lib/tools/productivity/invoice";
import { generateInvoicePdf } from "@/lib/tools/productivity/invoice-pdf";
import { downloadBlob } from "./ui/useDownload";
import { Button } from "./ui/Button";
import { Panel, PanelHeader, PanelBody } from "./ui/Panel";
import { Field, Hint } from "./ui/Field";
import { TextInput, Select } from "./ui/controls";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { Printer, Download, Plus, Trash2, RefreshCw, FileSpreadsheet, Layers } from "lucide-react";
import styles from "./InvoiceGeneratorTool.module.css";

export function InvoiceGeneratorTool() {
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [invoice, setInvoice] = useState<InvoiceData>(() => getSampleInvoice());
  const [statusMsg, setStatusMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Bulk Generator State
  const [bulkPrefix, setBulkPrefix] = useState("INV-2026-");
  const [bulkStartNum, setBulkStartNum] = useState(101);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkRecipients, setBulkRecipients] = useState(
    "Alpha Corp, accounts@alpha.example, 123 Tech Blvd Suite 100, 1.0\nBeta Labs, billing@beta.example, 456 Research Way, 1.25\nGamma Design, pay@gamma.example, 789 Creative Park, 0.8\nDelta Systems, ops@delta.example, 321 Cloud St, 1.5\nEpsilon Cloud, finance@epsilon.example, 654 Server Ave, 1.1"
  );
  const [bulkInvoices, setBulkInvoices] = useState<InvoiceData[]>([]);
  const [selectedBulkIdx, setSelectedBulkIdx] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputId = useId();

  // Logo upload handler (reads file purely in local browser memory)
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatusMsg("Please select an image file (PNG, JPEG, WebP, or SVG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setInvoice(prev => ({ ...prev, logoUrl: reader.result as string }));
        setStatusMsg("Logo loaded successfully (stored locally in memory).");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveLogo = useCallback(() => {
    setInvoice(prev => ({ ...prev, logoUrl: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatusMsg("Logo removed.");
  }, []);

  // Line Items Handlers
  const handleAddItem = useCallback(() => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      description: "New Service / Item",
      quantity: 1,
      unitPrice: 100,
    };
    setInvoice(prev => ({ ...prev, items: [...prev.items, newItem] }));
  }, []);

  const handleUpdateItem = useCallback((id: string, field: keyof InvoiceItem, value: any) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice") {
            const num = Number(value);
            (updated as any)[field] = isNaN(num) ? 0 : num;
          }
          return updated;
        }
        return item;
      }),
    }));
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setInvoice(prev => {
      if (prev.items.length <= 1) {
        return {
          ...prev,
          items: [{ id: `item-${Date.now()}`, description: "", quantity: 1, unitPrice: 0 }],
        };
      }
      return { ...prev, items: prev.items.filter(item => item.id !== id) };
    });
  }, []);

  // Export handlers
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    try {
      setIsProcessing(true);
      setStatusMsg("Generating vector PDF in browser…");
      const targetInvoice = activeTab === "bulk" && bulkInvoices.length > 0 ? bulkInvoices[selectedBulkIdx] : invoice;
      const pdfBytes = await generateInvoicePdf(targetInvoice);
      const filename = `${targetInvoice.invoiceNumber || "invoice"}.pdf`;
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      downloadBlob(blob, filename, "application/pdf");
      setStatusMsg(`Downloaded ${filename} successfully.`);
    } catch (err: any) {
      setStatusMsg(`PDF generation failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  }, [activeTab, bulkInvoices, selectedBulkIdx, invoice]);

  const handleDownloadCsv = useCallback(() => {
    const targetInvoice = activeTab === "bulk" && bulkInvoices.length > 0 ? bulkInvoices[selectedBulkIdx] : invoice;
    const csvContent = invoiceToCsv(targetInvoice);
    const filename = `${targetInvoice.invoiceNumber || "invoice"}.csv`;
    downloadBlob(csvContent, filename, "text/csv;charset=utf-8");
    setStatusMsg(`Downloaded ${filename} successfully.`);
  }, [activeTab, bulkInvoices, selectedBulkIdx, invoice]);

  const handleDownloadJson = useCallback(() => {
    const targetInvoice = activeTab === "bulk" && bulkInvoices.length > 0 ? bulkInvoices[selectedBulkIdx] : invoice;
    const jsonContent = JSON.stringify(targetInvoice, null, 2);
    const filename = `${targetInvoice.invoiceNumber || "invoice"}.json`;
    downloadBlob(jsonContent, filename, "application/json");
    setStatusMsg(`Downloaded ${filename} successfully.`);
  }, [activeTab, bulkInvoices, selectedBulkIdx, invoice]);

  const handleLoadSample = useCallback(() => {
    setInvoice(getSampleInvoice());
    setStatusMsg("Loaded sample invoice data.");
  }, []);

  // Bulk Generator Handlers
  const handleGenerateBulk = useCallback(() => {
    const generated = generateBulkInvoices({
      baseInvoice: invoice,
      prefix: bulkPrefix,
      startNumber: bulkStartNum,
      count: bulkCount,
      recipientsText: bulkRecipients,
    });
    setBulkInvoices(generated);
    setSelectedBulkIdx(0);
    setStatusMsg(`Generated ${generated.length} bulk invoices ready for export or review.`);
  }, [invoice, bulkPrefix, bulkStartNum, bulkCount, bulkRecipients]);

  const handleDownloadBulkZip = useCallback(async () => {
    if (bulkInvoices.length === 0) {
      setStatusMsg("Please generate bulk invoices first.");
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMsg(`Generating ${bulkInvoices.length} PDFs and bundling into ZIP…`);

      const { zipSync } = await import("fflate");
      const zipEntries: Record<string, Uint8Array> = {};

      for (const inv of bulkInvoices) {
        const pdfBytes = await generateInvoicePdf(inv);
        zipEntries[`${inv.invoiceNumber}.pdf`] = new Uint8Array(pdfBytes);
        const csvText = invoiceToCsv(inv);
        zipEntries[`${inv.invoiceNumber}.csv`] = new TextEncoder().encode(csvText);
      }

      const zipBytes = zipSync(zipEntries, { level: 0 }); // store mode for maximum speed
      const zipBlob = new Blob([new Uint8Array(zipBytes)], { type: "application/zip" });
      const filename = `invoices-batch-${bulkPrefix.replace(/[^a-zA-Z0-9_-]/g, "") || "export"}.zip`;
      downloadBlob(zipBlob, filename, "application/zip");
      setStatusMsg(`Downloaded ZIP containing ${bulkInvoices.length} invoices successfully.`);
    } catch (err: any) {
      setStatusMsg(`Bulk ZIP generation failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  }, [bulkInvoices, bulkPrefix]);

  const activeInvoice = activeTab === "bulk" && bulkInvoices.length > 0 ? bulkInvoices[selectedBulkIdx] : invoice;
  const totals = calculateInvoiceTotals(activeInvoice);

  return (
    <div className={styles.container}>
      <PrivacyNote>100% in-browser generation. Logos, client details, payment terms, and invoice data never leave your device.</PrivacyNote>

      <div className={styles.topBar}>
        <div className={styles.modeTabs} role="tablist" aria-label="Invoice Generator Modes">
          <Button
            variant={activeTab === "single" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("single")}
            role="tab"
            aria-selected={activeTab === "single"}
          >
            Single Invoice
          </Button>
          <Button
            variant={activeTab === "bulk" ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setActiveTab("bulk");
              if (bulkInvoices.length === 0) handleGenerateBulk();
            }}
            role="tab"
            aria-selected={activeTab === "bulk"}
          >
            <Layers size={14} style={{ marginRight: 6 }} />
            Bulk Generator
          </Button>
        </div>

        <div className={styles.actions}>
          <Button variant="primary" size="sm" onClick={handlePrint}>
            <Printer size={14} style={{ marginRight: 6 }} />
            Print / Save as PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf} disabled={isProcessing}>
            <Download size={14} style={{ marginRight: 6 }} />
            Download PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownloadCsv}>
            <FileSpreadsheet size={14} style={{ marginRight: 6 }} />
            CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownloadJson}>
            JSON
          </Button>
          {activeTab === "single" && (
            <Button variant="ghost" size="sm" onClick={handleLoadSample}>
              <RefreshCw size={14} style={{ marginRight: 6 }} />
              Sample
            </Button>
          )}
        </div>
      </div>

      {statusMsg && <StatusLine>{statusMsg}</StatusLine>}

      {activeTab === "bulk" && (
        <Panel title="Bulk Invoice Batch Generator" padded>
          <div className={styles.formSection}>
            <div className={styles.row}>
              <Field label="Invoice Prefix" id="bulk-prefix">
                <TextInput id="bulk-prefix" value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} />
              </Field>
              <Field label="Start Number" id="bulk-start">
                <TextInput id="bulk-start" type="number" value={String(bulkStartNum)} onChange={e => setBulkStartNum(Number(e.target.value) || 1)} />
              </Field>
              <Field label="Number of Invoices" id="bulk-count">
                <TextInput id="bulk-count" type="number" min={1} max={50} value={String(bulkCount)} onChange={e => setBulkCount(Number(e.target.value) || 1)} />
              </Field>
            </div>

            <Field label="Recipients & Rates (one client per line: Name, Email, Address, RateMultiplier)" id="bulk-recipients">
              <textarea
                id="bulk-recipients"
                rows={4}
                value={bulkRecipients}
                onChange={e => setBulkRecipients(e.target.value)}
                style={{ width: "100%", padding: 8, fontFamily: "monospace", fontSize: 13 }}
              />
              <Hint id="bulk-recipients-hint">Example: &quot;Acme Corp, billing@acme.example, 100 Main St, 1.0&quot;</Hint>
            </Field>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="md" onClick={handleGenerateBulk}>
                Regenerate Batch ({bulkCount} Invoices)
              </Button>
              {bulkInvoices.length > 0 && (
                <Button variant="secondary" size="md" onClick={handleDownloadBulkZip} disabled={isProcessing}>
                  <Download size={14} style={{ marginRight: 6 }} />
                  Download All as ZIP (.zip with all PDFs &amp; CSVs)
                </Button>
              )}
            </div>

            {bulkInvoices.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  Generated Invoices in Batch ({bulkInvoices.length}) — Click to Inspect:
                </h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {bulkInvoices.map((inv, idx) => (
                    <Button
                      key={inv.invoiceNumber}
                      variant={selectedBulkIdx === idx ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedBulkIdx(idx)}
                    >
                      {inv.invoiceNumber} ({inv.toName.split(" ")[0]})
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}

      <div className={styles.grid}>
        {/* Left Column: Form Editor */}
        <div className={styles.formSection}>
          {/* Header & Logo Panel */}
          <Panel title="Invoice Details & Logo" padded>
            <div className={styles.formSection}>
              <div className={styles.logoUploadBox}>
                <Field label="Company Logo (Local Upload)" id={logoInputId}>
                  <input
                    ref={fileInputRef}
                    id={logoInputId}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ fontSize: 13 }}
                  />
                  <Hint id={`${logoInputId}-hint`}>PNG, JPG, SVG, or WebP. Processed locally in browser memory.</Hint>
                </Field>

                {invoice.logoUrl && (
                  <div className={styles.logoPreviewArea}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={invoice.logoUrl} alt="Company Logo Preview" className={styles.logoImg} />
                    <Button variant="ghost" size="sm" onClick={handleRemoveLogo}>
                      <Trash2 size={13} style={{ marginRight: 4 }} /> Remove
                    </Button>
                  </div>
                )}
              </div>

              <div className={styles.row}>
                <Field label="Invoice Number" id="inv-num">
                  <TextInput id="inv-num" value={invoice.invoiceNumber} onChange={e => setInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))} />
                </Field>
                <Field label="Currency" id="inv-currency">
                  <Select
                    id="inv-currency"
                    value={invoice.currency}
                    onChange={e => {
                      const selected = CURRENCIES.find(c => c.code === e.target.value) || CURRENCIES[0];
                      setInvoice(prev => ({ ...prev, currency: selected.code, currencySymbol: selected.symbol }));
                    }}
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className={styles.row}>
                <Field label="Issue Date" id="inv-date">
                  <TextInput id="inv-date" type="date" value={invoice.issueDate} onChange={e => setInvoice(prev => ({ ...prev, issueDate: e.target.value }))} />
                </Field>
                <Field label="Due Date" id="inv-due">
                  <TextInput id="inv-due" type="date" value={invoice.dueDate} onChange={e => setInvoice(prev => ({ ...prev, dueDate: e.target.value }))} />
                </Field>
              </div>

              <Field label="Template Style" id="inv-template">
                <Select
                  id="inv-template"
                  value={invoice.template}
                  onChange={e => setInvoice(prev => ({ ...prev, template: e.target.value as InvoiceTemplate }))}
                >
                  <option value="modern">Modern (Crisp, Accent Rule, Balanced)</option>
                  <option value="classic">Classic (Corporate, High Structure)</option>
                  <option value="minimal">Minimalist (Clean Typography, Editorial)</option>
                </Select>
              </Field>
            </div>
          </Panel>

          {/* Parties Panel */}
          <Panel title="Parties (Sender & Client)" padded>
            <div className={styles.formSection}>
              <h4 style={{ margin: 0, fontSize: 13, textTransform: "uppercase", color: "var(--secondary)" }}>From (Your Business)</h4>
              <div className={styles.row}>
                <Field label="Business Name" id="from-name">
                  <TextInput id="from-name" value={invoice.fromName} onChange={e => setInvoice(prev => ({ ...prev, fromName: e.target.value }))} />
                </Field>
                <Field label="Email" id="from-email">
                  <TextInput id="from-email" type="email" value={invoice.fromEmail} onChange={e => setInvoice(prev => ({ ...prev, fromEmail: e.target.value }))} />
                </Field>
              </div>
              <Field label="Address / Details" id="from-address">
                <textarea
                  id="from-address"
                  rows={2}
                  value={invoice.fromAddress}
                  onChange={e => setInvoice(prev => ({ ...prev, fromAddress: e.target.value }))}
                  style={{ width: "100%", padding: 8, fontSize: 13 }}
                />
              </Field>

              <h4 style={{ margin: "12px 0 0", fontSize: 13, textTransform: "uppercase", color: "var(--secondary)" }}>Bill To (Client Details)</h4>
              <div className={styles.row}>
                <Field label="Client Name" id="to-name">
                  <TextInput id="to-name" value={invoice.toName} onChange={e => setInvoice(prev => ({ ...prev, toName: e.target.value }))} />
                </Field>
                <Field label="Client Email" id="to-email">
                  <TextInput id="to-email" type="email" value={invoice.toEmail} onChange={e => setInvoice(prev => ({ ...prev, toEmail: e.target.value }))} />
                </Field>
              </div>
              <Field label="Client Address" id="to-address">
                <textarea
                  id="to-address"
                  rows={2}
                  value={invoice.toAddress}
                  onChange={e => setInvoice(prev => ({ ...prev, toAddress: e.target.value }))}
                  style={{ width: "100%", padding: 8, fontSize: 13 }}
                />
              </Field>
            </div>
          </Panel>

          {/* Line Items Panel */}
          <Panel
            title="Line Items"
            actions={
              <Button variant="secondary" size="sm" onClick={handleAddItem}>
                <Plus size={13} style={{ marginRight: 4 }} /> Add Item
              </Button>
            }
            padded
          >
            <div style={{ overflowX: "auto" }}>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th style={{ width: "45%" }}>Description</th>
                    <th style={{ width: "18%" }}>Qty</th>
                    <th style={{ width: "22%" }}>Price ({invoice.currencySymbol})</th>
                    <th style={{ width: "15%", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <TextInput
                          value={item.description}
                          onChange={e => handleUpdateItem(item.id, "description", e.target.value)}
                          placeholder="Description"
                        />
                      </td>
                      <td>
                        <TextInput
                          type="number"
                          min={0}
                          step="any"
                          value={String(item.quantity)}
                          onChange={e => handleUpdateItem(item.id, "quantity", e.target.value)}
                        />
                      </td>
                      <td>
                        <TextInput
                          type="number"
                          min={0}
                          step="any"
                          value={String(item.unitPrice)}
                          onChange={e => handleUpdateItem(item.id, "unitPrice", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)} aria-label="Delete item">
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tax, Discount, Shipping Controls */}
            <div className={styles.formSection} style={{ marginTop: 16 }}>
              <div className={styles.row}>
                <Field label="Discount Value" id="inv-discount">
                  <TextInput
                    id="inv-discount"
                    type="number"
                    min={0}
                    value={String(invoice.discount)}
                    onChange={e => setInvoice(prev => ({ ...prev, discount: Number(e.target.value) || 0 }))}
                  />
                </Field>
                <Field label="Discount Type" id="inv-discount-type">
                  <Select
                    id="inv-discount-type"
                    value={invoice.discountType}
                    onChange={e => setInvoice(prev => ({ ...prev, discountType: e.target.value as DiscountType }))}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ({invoice.currencySymbol})</option>
                  </Select>
                </Field>
              </div>

              <div className={styles.row}>
                <Field label="Tax Label" id="inv-tax-label">
                  <TextInput id="inv-tax-label" value={invoice.taxLabel} onChange={e => setInvoice(prev => ({ ...prev, taxLabel: e.target.value }))} />
                </Field>
                <Field label="Tax Rate (%)" id="inv-tax-rate">
                  <TextInput
                    id="inv-tax-rate"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={String(invoice.taxRate)}
                    onChange={e => setInvoice(prev => ({ ...prev, taxRate: Number(e.target.value) || 0 }))}
                  />
                </Field>
                <Field label="Shipping / Extra" id="inv-shipping">
                  <TextInput
                    id="inv-shipping"
                    type="number"
                    min={0}
                    step="any"
                    value={String(invoice.shipping)}
                    onChange={e => setInvoice(prev => ({ ...prev, shipping: Number(e.target.value) || 0 }))}
                  />
                </Field>
              </div>
            </div>
          </Panel>

          {/* Notes & Payment Terms */}
          <Panel title="Payment Instructions & Notes" padded>
            <div className={styles.formSection}>
              <Field label="Payment Terms" id="inv-terms">
                <TextInput id="inv-terms" value={invoice.paymentTerms} onChange={e => setInvoice(prev => ({ ...prev, paymentTerms: e.target.value }))} />
              </Field>
              <Field label="Bank / Wire / UPI Instructions" id="inv-bank">
                <textarea
                  id="inv-bank"
                  rows={3}
                  value={invoice.bankDetails}
                  onChange={e => setInvoice(prev => ({ ...prev, bankDetails: e.target.value }))}
                  style={{ width: "100%", padding: 8, fontSize: 13 }}
                />
              </Field>
              <Field label="Notes to Client" id="inv-notes">
                <textarea
                  id="inv-notes"
                  rows={2}
                  value={invoice.notes}
                  onChange={e => setInvoice(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: "100%", padding: 8, fontSize: 13 }}
                />
              </Field>
            </div>
          </Panel>
        </div>

        {/* Right Column: Live Printable Document Preview */}
        <div className={styles.previewWrapper}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Live Document Preview {activeTab === "bulk" && `(#${selectedBulkIdx + 1} of ${bulkInvoices.length})`}
            </h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Click Print to Export PDF</span>
          </div>

          <div className={styles.previewScroll}>
            {/* The Document Sheet rendered with high visual fidelity */}
            <article className={styles.documentSheet} aria-label="Invoice Document Preview">
              <header className={styles.docHeader}>
                <div>
                  {activeInvoice.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeInvoice.logoUrl} alt="Logo" style={{ maxHeight: 54, maxWidth: 160, objectFit: "contain", marginBottom: 8 }} />
                  ) : (
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>
                      {activeInvoice.fromName || "YOUR COMPANY"}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--secondary)", whiteSpace: "pre-line" }}>
                    {activeInvoice.fromEmail && <div>{activeInvoice.fromEmail}</div>}
                    {activeInvoice.fromAddress && <div>{activeInvoice.fromAddress}</div>}
                  </div>
                </div>

                <div className={styles.docHeaderRight}>
                  <h1 className={styles.docTitle}>INVOICE</h1>
                  <div className={styles.docInvoiceNum}>#{activeInvoice.invoiceNumber}</div>
                  <div className={styles.docDate}>Date: {activeInvoice.issueDate}</div>
                  <div className={styles.docDate}>Due: {activeInvoice.dueDate}</div>
                </div>
              </header>

              <section className={styles.docParties}>
                <div className={styles.partyCol}>
                  <div className={styles.partyLabel}>Billed To</div>
                  <div className={styles.partyName}>{activeInvoice.toName || "Client Name"}</div>
                  {activeInvoice.toEmail && <div>{activeInvoice.toEmail}</div>}
                  {activeInvoice.toAddress && <div style={{ whiteSpace: "pre-line" }}>{activeInvoice.toAddress}</div>}
                </div>

                <div className={styles.partyCol}>
                  <div className={styles.partyLabel}>Invoice Details</div>
                  <div><strong>Currency:</strong> {activeInvoice.currency}</div>
                  {activeInvoice.paymentTerms && <div><strong>Terms:</strong> {activeInvoice.paymentTerms}</div>}
                </div>
              </section>

              <table className={styles.docTable}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: "center", width: 60 }}>Qty</th>
                    <th style={{ textAlign: "right", width: 100 }}>Unit Price</th>
                    <th style={{ textAlign: "right", width: 110 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items.map(item => {
                    const amount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                    return (
                      <tr key={item.id}>
                        <td>{item.description || "Item"}</td>
                        <td style={{ textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(Number(item.unitPrice || 0), activeInvoice.currencySymbol)}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(amount, activeInvoice.currencySymbol)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className={styles.docTotals}>
                <div className={styles.docTotalRow}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal, activeInvoice.currencySymbol)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className={styles.docTotalRow}>
                    <span>Discount:</span>
                    <span>-{formatCurrency(totals.discountAmount, activeInvoice.currencySymbol)}</span>
                  </div>
                )}
                {totals.taxAmount > 0 && (
                  <div className={styles.docTotalRow}>
                    <span>{activeInvoice.taxLabel || "Tax"} ({activeInvoice.taxRate}%):</span>
                    <span>{formatCurrency(totals.taxAmount, activeInvoice.currencySymbol)}</span>
                  </div>
                )}
                {totals.shippingAmount > 0 && (
                  <div className={styles.docTotalRow}>
                    <span>Shipping:</span>
                    <span>{formatCurrency(totals.shippingAmount, activeInvoice.currencySymbol)}</span>
                  </div>
                )}
                <div className={styles.docTotalRowGrand}>
                  <span>Total Due:</span>
                  <span>{formatCurrency(totals.total, activeInvoice.currencySymbol)}</span>
                </div>
              </div>

              {(activeInvoice.bankDetails || activeInvoice.notes) && (
                <footer className={styles.docFooter}>
                  {activeInvoice.bankDetails && (
                    <div>
                      <strong style={{ display: "block", marginBottom: 2 }}>Payment Instructions:</strong>
                      <div style={{ whiteSpace: "pre-line" }}>{activeInvoice.bankDetails}</div>
                    </div>
                  )}
                  {activeInvoice.notes && (
                    <div>
                      <strong style={{ display: "block", marginBottom: 2 }}>Notes:</strong>
                      <div>{activeInvoice.notes}</div>
                    </div>
                  )}
                </footer>
              )}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
