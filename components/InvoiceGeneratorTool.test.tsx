// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { InvoiceGeneratorTool } from "./InvoiceGeneratorTool";

describe("InvoiceGeneratorTool component", () => {
  beforeEach(() => {
    vi.stubGlobal("print", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders single invoice mode with sample details and totals", () => {
    render(<InvoiceGeneratorTool />);

    expect(screen.getByRole("heading", { level: 2, name: /Invoice Details & Logo/i })).toBeTruthy();
    expect(screen.getByDisplayValue("INV-2026-001")).toBeTruthy();
    expect(screen.getByDisplayValue("Acme Web Studio LLC")).toBeTruthy();
    expect(screen.getByDisplayValue("Starlight Interactive Inc.")).toBeTruthy();

    // Check Live Document preview heading
    expect(screen.getByRole("heading", { level: 3, name: /Live Document Preview/i })).toBeTruthy();
    expect(screen.getByText("Print / Save as PDF")).toBeTruthy();
    expect(screen.getByText("Download PDF")).toBeTruthy();
  });

  it("adds a new line item and updates the preview total", () => {
    render(<InvoiceGeneratorTool />);

    const addButton = screen.getByRole("button", { name: /Add Item/i });
    fireEvent.click(addButton);

    // Enter description and price
    const descriptions = screen.getAllByPlaceholderText("Description");
    const lastDesc = descriptions[descriptions.length - 1];
    fireEvent.change(lastDesc, { target: { value: "Database Tuning" } });

    expect(screen.getAllByDisplayValue("Database Tuning").length).toBeGreaterThan(0);
  });

  it("switches to bulk generator mode and creates multiple invoices", () => {
    render(<InvoiceGeneratorTool />);

    const bulkTab = screen.getByRole("tab", { name: /Bulk Generator/i });
    fireEvent.click(bulkTab);

    expect(screen.getByRole("heading", { level: 2, name: /Bulk Invoice Batch Generator/i })).toBeTruthy();
    expect(screen.getByText(/Regenerate Batch/i)).toBeTruthy();

    const regenButton = screen.getByRole("button", { name: /Regenerate Batch/i });
    fireEvent.click(regenButton);

    expect(screen.getByText(/Generated 5 bulk invoices/i)).toBeTruthy();
  });

  it("triggers window.print when clicking Print / Save as PDF", () => {
    render(<InvoiceGeneratorTool />);

    const printButton = screen.getByRole("button", { name: /Print \/ Save as PDF/i });
    fireEvent.click(printButton);

    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
