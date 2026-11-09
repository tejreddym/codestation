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

const define = (
  id: PdfToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<PdfToolId> =>
  localDefinition(id, title, "PDF", fields, outputs, defaults, [notice, ...extra], "Process");

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
    ["Draw your signature with mouse, stylus, or touch, and export a clean, transparent PNG for signing PDF documents and forms."]
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
];

export const getPdfDefinition = (id: string) => pdfTools.find((tool) => tool.id === id);
export const isPdfToolId = (id: string): id is PdfToolId => (pdfToolIds as readonly string[]).includes(id);
