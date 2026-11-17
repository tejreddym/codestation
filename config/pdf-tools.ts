import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const pdfToolIds = [
  "pdf-merge",
  "pdf-split",
  "pdf-rotate",
  "images-to-pdf",
  "pdf-text-extractor",
  "pdf-page-deleter",
  "signature-pad",
  "pdf-watermark",
  "pdf-page-numberer",
  "pdf-to-text",
  "pdf-to-images",
  "pdf-reorder-pages",
] as const;

export type PdfToolId = (typeof pdfToolIds)[number];

const pdfFile: LocalField = {
  name: "file",
  label: "PDF file",
  control: "file",
  accept: ".pdf,application/pdf",
};

const pdfFiles: LocalField = {
  name: "files",
  label: "PDF files to merge",
  control: "files",
  accept: ".pdf,application/pdf",
};

const images: LocalField = {
  name: "images",
  label: "Image files",
  control: "files",
  accept: "image/png,image/jpeg,image/webp,image/*",
};

const range: LocalField = {
  name: "range",
  label: "Page range",
  control: "text",
  optional: true,
};

const notice =
  "100% in-browser PDF processing. Files are read in memory via client WebAssembly/JavaScript; no documents, content, or telemetry are uploaded to any server.";

type DefineOptions = {
  description?: string;
  keywords?: readonly string[];
  relatedTools?: readonly string[];
  seoTitle?: string;
  seoDescription?: string;
  action?: string;
};

const define = (
  id: PdfToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = [],
  options: DefineOptions = {}
): LocalDefinition<PdfToolId> => {
  const base = localDefinition(id, title, "PDF", fields, outputs, defaults, [notice, ...extra], options.action ?? "Process");
  return {
    ...base,
    description: options.description ?? base.description,
    keywords: options.keywords ? [...options.keywords] : base.keywords,
    relatedTools: options.relatedTools ?? base.relatedTools,
    seo: {
      title: options.seoTitle ?? base.seo.title,
      description: options.seoDescription ?? base.seo.description,
    },
  };
};

export const pdfTools: readonly LocalDefinition<PdfToolId>[] = [
  define(
    "pdf-merge",
    "PDF Merge",
    [pdfFiles],
    ["Merged PDF file", "Total pages", "File size"],
    {},
    ["Drag and drop multiple PDF documents to merge them into a single file in selected order."]
  ),
  define(
    "pdf-split",
    "PDF Split & Page Extractor",
    [pdfFile, range],
    ["Extracted PDF file", "Page count"],
    { range: "1-2" },
    ["Enter page numbers and ranges (e.g. 1-3, 5, 8). Pages are extracted without watermarks or quality loss."]
  ),
  define(
    "pdf-rotate",
    "PDF Rotator",
    [
      pdfFile,
      {
        name: "angle",
        label: "Rotation angle",
        control: "select",
        options: ["90° Clockwise", "180° Upside-Down", "270° Counter-Clockwise"],
      },
      range,
    ],
    ["Rotated PDF file"],
    { angle: "90° Clockwise", range: "" },
    ["Rotate all pages or only specified page ranges."]
  ),
  define(
    "images-to-pdf",
    "Images to PDF",
    [
      images,
      {
        name: "pageSize",
        label: "Page size",
        control: "select",
        options: ["A4", "Letter", "FitImage"],
      },
    ],
    ["Generated PDF file", "Page count"],
    { pageSize: "A4" },
    ["Combines JPG, PNG, or WebP images into a cleanly sized PDF document."]
  ),
  define(
    "pdf-text-extractor",
    "PDF Metadata & Info",
    [pdfFile],
    ["Page count", "Title", "Author", "Subject", "Keywords", "Creation date", "Producer"],
    {},
    ["Inspects embedded PDF document information and structural metadata without uploading."]
  ),
  define(
    "pdf-page-deleter",
    "PDF Page Deleter",
    [pdfFile, { name: "pagesToDelete", label: "Pages to delete (e.g. 2, 4)", control: "text" }],
    ["Cleaned PDF file", "Remaining page count"],
    { pagesToDelete: "1" },
    ["Removes unwanted pages from a PDF document instantly."]
  ),
  define(
    "signature-pad",
    "Digital Signature Pad",
    [],
    ["Signature canvas", "Transparent PNG Download"],
    {},
    ["Draw your signature with mouse, stylus, or touch and export a clean transparent PNG. This tool does not open, sign, or modify a PDF; use the PNG in your own document workflow."]
  ),
  define(
    "pdf-watermark",
    "PDF Watermark",
    [
      pdfFile,
      {
        name: "watermarkType",
        label: "Watermark type",
        control: "select",
        options: ["Text Watermark", "Image Watermark"],
      },
      {
        name: "text",
        label: "Watermark text",
        control: "text",
        optional: true,
      },
      {
        name: "fontSize",
        label: "Font size",
        control: "number",
        min: 10,
        max: 120,
        optional: true,
      },
      {
        name: "opacity",
        label: "Opacity (%)",
        control: "range",
        min: 5,
        max: 100,
        optional: true,
      },
      {
        name: "rotation",
        label: "Rotation angle",
        control: "select",
        options: ["45° Diagonal", "0° Horizontal", "90° Vertical", "315° Reverse Diagonal"],
      },
      {
        name: "position",
        label: "Position",
        control: "select",
        options: [
          "Center",
          "Tile / Repeating Grid",
          "Top Left",
          "Top Right",
          "Bottom Left",
          "Bottom Right",
        ],
      },
    ],
    ["Watermarked PDF file", "Live Preview", "Download PDF"],
    {
      watermarkType: "Text Watermark",
      text: "CONFIDENTIAL",
      fontSize: 48,
      opacity: 30,
      rotation: "45° Diagonal",
      position: "Center",
    },
    [
      "Add custom text or image watermarks across PDF documents with full control over opacity, rotation, scale, and placement.",
      "Supports center placement, repeating grid tiles, and corner positioning. Previews directly in-browser with zero uploads.",
    ]
  ),
  define(
    "pdf-page-numberer",
    "PDF Page Numberer",
    [
      pdfFile,
      {
        name: "format",
        label: "Numbering format",
        control: "select",
        options: [
          "Page X of Y",
          "X / Y",
          "X (Number only)",
          "Roman Lower (i, ii...)",
          "Roman Upper (I, II...)",
          "Custom Prefix/Suffix",
        ],
      },
      {
        name: "vertical",
        label: "Vertical position",
        control: "select",
        options: ["Footer (Bottom)", "Header (Top)"],
      },
      {
        name: "alignment",
        label: "Alignment",
        control: "select",
        options: ["Center", "Right", "Left"],
      },
      {
        name: "fontFamily",
        label: "Font family",
        control: "select",
        options: ["Helvetica", "Times Roman", "Courier"],
      },
      {
        name: "fontSize",
        label: "Font size (pt)",
        control: "number",
        min: 6,
        max: 36,
      },
      {
        name: "margin",
        label: "Margin from edge (pt)",
        control: "number",
        min: 10,
        max: 100,
      },
      {
        name: "startNumber",
        label: "Start numbering from",
        control: "number",
        min: 1,
      },
      range,
    ],
    ["Numbered PDF file", "Live Preview", "Download PDF"],
    {
      format: "Page X of Y",
      vertical: "Footer (Bottom)",
      alignment: "Center",
      fontFamily: "Helvetica",
      fontSize: 10,
      margin: 24,
      startNumber: 1,
      range: "",
    },
    [
      "Add clean, customizable page numbers to PDF headers or footers with support for standard, Roman, or custom numbering formats.",
      "Filter page ranges or skip title pages. Generated and previewed 100% locally in your browser.",
    ]
  ),
  define(
    "pdf-to-text",
    "PDF to Text",
    [
      pdfFile,
      { ...range, label: "Pages to show" },
      {
        name: "search",
        label: "Search extracted text",
        control: "search",
        optional: true,
      },
    ],
    ["Page-by-page text", "Search match counts", "TXT download"],
    { range: "all", search: "" },
    [
      "Reads the PDF's embedded text layer only. Pages with little or no text are flagged as possible scans; OCR is not performed.",
      "Search is case-insensitive and counts matches on the selected pages. Copy and TXT downloads use the current page selection.",
    ],
    {
      description:
        "Extract selectable text from PDF pages, search it with match counts, copy it, and download a plain-text file. Pages that look scanned are flagged; this tool does not run OCR.",
      keywords: [
        "extract text from pdf",
        "pdf to text",
        "pdf text extractor",
        "search pdf text",
        "copy pdf text",
        "pdf to txt",
      ],
      relatedTools: ["pdf-text-extractor", "pdf-to-images", "pdf-reorder-pages"],
      seoTitle: "PDF to Text — Extract PDF Text Locally",
      seoDescription:
        "Extract text from PDF pages in your browser. Search with match counts, copy text, download TXT, and spot scanned pages without uploading the file.",
      action: "Extract Text",
    }
  ),
  define(
    "pdf-to-images",
    "PDF to Images",
    [
      pdfFile,
      range,
      {
        name: "dpi",
        label: "Resolution",
        control: "select",
        options: ["72 DPI", "150 DPI", "300 DPI"],
      },
      {
        name: "format",
        label: "Image format",
        control: "select",
        options: ["PNG", "JPEG"],
      },
      {
        name: "quality",
        label: "JPEG quality (%)",
        control: "range",
        min: 50,
        max: 100,
        optional: true,
      },
    ],
    ["PNG or JPEG page images", "Per-page downloads", "ZIP archive", "Image dimensions"],
    { range: "all", dpi: "150 DPI", format: "PNG", quality: 90 },
    [
      "Pages render sequentially at the chosen scale (DPI ÷ 72). A run is capped at 100 pages and warns above 50 pages at 300 DPI.",
      "Cancel stops the render loop, aborts the current page and destroys the PDF document. Object URLs for previews are revoked on clear and unmount.",
    ],
    {
      description:
        "Render PDF pages as PNG or JPEG images at 72, 150 or 300 DPI, show each image's pixel dimensions, and download pages individually or as a ZIP archive.",
      keywords: [
        "pdf to png",
        "pdf to jpg",
        "pdf to images",
        "convert pdf to image",
        "pdf page to image",
        "pdf to jpeg",
      ],
      relatedTools: ["pdf-to-text", "images-to-pdf", "pdf-reorder-pages"],
      seoTitle: "PDF to Images — Convert PDF Pages to PNG or JPEG",
      seoDescription:
        "Convert PDF pages to PNG or JPEG at 72, 150, or 300 DPI. Preview dimensions, download each page, or export everything as a ZIP—entirely in your browser.",
      action: "Render Images",
    }
  ),
  define(
    "pdf-reorder-pages",
    "PDF Page Reorderer",
    [pdfFile],
    ["Reordered PDF file", "Page order mapping", "Page count"],
    {},
    [
      "Drag a page card or use Move up / Move down. Focus stays on the moved page for keyboard users.",
      "Remove pages without changing the source file, then export a new PDF. The mapping summary shows where each original page went.",
    ],
    {
      description:
        "Reorder PDF pages with drag-and-drop or keyboard controls, remove pages, review a page mapping summary, and export a new PDF without changing the original.",
      keywords: [
        "reorder pdf pages",
        "organize pdf",
        "rearrange pdf",
        "move pdf pages",
        "delete pdf pages",
        "sort pdf pages",
      ],
      relatedTools: ["pdf-merge", "pdf-split", "pdf-page-deleter", "pdf-to-images"],
      seoTitle: "PDF Page Reorderer — Rearrange PDF Pages",
      seoDescription:
        "Reorder or remove PDF pages with drag-and-drop or keyboard controls. Export a clean PDF with a page mapping summary—no upload or account required.",
      action: "Export PDF",
    }
  ),
];

export const getPdfDefinition = (id: string) => pdfTools.find((tool) => tool.id === id);
export const isPdfToolId = (id: string): id is PdfToolId => (pdfToolIds as readonly string[]).includes(id);
