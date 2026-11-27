// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import PdfCompressorTool from "./PdfCompressorTool";
import { getPdfDefinition } from "@/config/pdf-tools";
import type { PDFDocumentProxy } from "pdfjs-dist";

let mockSource: {
  file: File;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
  pageCount: number;
} | null = null;

const mockOpen = vi.fn();
const mockClear = vi.fn();
const mockSetError = vi.fn();

vi.mock("@/lib/tools/pdf/usePdfDocument", () => ({
  usePdfDocument: () => ({
    source: mockSource,
    loading: false,
    error: null,
    open: mockOpen,
    clear: mockClear,
    setError: mockSetError,
  }),
  formatFileSize: (b: number) => `${b} B`,
}));

vi.mock("@/lib/tools/pdf/pdfjs", () => ({
  renderPdfPageToCanvas: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tools/pdf/compress", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tools/pdf/compress")>(
    "@/lib/tools/pdf/compress",
  );
  return {
    ...actual,
    compressPdfDocument: vi.fn().mockResolvedValue({
      compressedBytes: new Uint8Array([1, 2, 3]),
      originalSize: 50000,
      compressedSize: 20000,
      savingsBytes: 30000,
      savingsPercentage: 60.0,
      pageCount: 2,
      durationMs: 150,
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PdfCompressorTool Component", () => {
  const definition = getPdfDefinition("pdf-compressor")!;

  beforeEach(() => {
    mockSource = null;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback: (b: Blob | null) => void) =>
        callback(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })),
    );
  });

  it("renders drop zone and privacy notice in initial empty state", () => {
    const { container } = render(<PdfCompressorTool definition={definition} />);

    expect(screen.getByRole("heading", { name: definition.name })).toBeTruthy();
    expect(screen.getByText("Choose a PDF file to compress")).toBeTruthy();
    expect(screen.getByText(/100% in-browser PDF size reduction/)).toBeTruthy();

    const root = container.firstElementChild;
    expect(root?.getAttribute("data-webmcp-tool")).toBe("codestation_pdf_compressor");
    expect(root?.getAttribute("data-webmcp-category")).toBe("PDF");
    expect(root?.getAttribute("data-webmcp-slug")).toBe("pdf-compressor");
  });

  it("renders document metadata and preset choices when PDF is loaded", () => {
    mockSource = {
      file: new File(["dummy pdf content"], "sample.pdf", { type: "application/pdf" }),
      bytes: new Uint8Array([1, 2, 3]),
      doc: {
        numPages: 3,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({ width: 612, height: 792 }),
          cleanup: vi.fn(),
        }),
      } as unknown as PDFDocumentProxy,
      pageCount: 3,
    };

    render(<PdfCompressorTool definition={definition} />);

    expect(screen.getByText("sample.pdf")).toBeTruthy();
    expect(screen.getByText(/3 pages/)).toBeTruthy();
    expect(screen.getByText("Maximum Compression")).toBeTruthy();
    expect(screen.getByText("Balanced")).toBeTruthy();
    expect(screen.getByText("High Quality")).toBeTruthy();
  });

  it("allows selecting different presets and triggers compression on click", async () => {
    mockSource = {
      file: new File([new ArrayBuffer(50000)], "sample.pdf", { type: "application/pdf" }),
      bytes: new Uint8Array(50000),
      doc: {
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({ width: 612, height: 792 }),
          cleanup: vi.fn(),
        }),
      } as unknown as PDFDocumentProxy,
      pageCount: 2,
    };

    render(<PdfCompressorTool definition={definition} />);

    // Click Maximum Compression preset
    const maxPreset = screen.getByText("Maximum Compression");
    fireEvent.click(maxPreset);

    // Click Compress PDF button
    const compressButton = screen.getByRole("button", { name: "Compress PDF" });
    fireEvent.click(compressButton);

    // Wait for results to show
    await waitFor(() => {
      expect(screen.getByText("Compression Results")).toBeTruthy();
      expect(screen.getByText("Original Size")).toBeTruthy();
      expect(screen.getByText("Compressed Size")).toBeTruthy();
      expect(screen.getByText("-60%")).toBeTruthy();
      expect(screen.getByRole("button", { name: /Download Compressed PDF/ })).toBeTruthy();
    });
  });
});
