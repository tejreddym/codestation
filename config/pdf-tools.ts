import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const pdfToolIds = [
  "pdf-merge",
  "pdf-split",
  "pdf-rotate",
  "images-to-pdf",
  "pdf-text-extractor",
  "pdf-page-deleter",
  "signature-pad",
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
];

export const getPdfDefinition = (id: string) => pdfTools.find((tool) => tool.id === id);
export const isPdfToolId = (id: string): id is PdfToolId => (pdfToolIds as readonly string[]).includes(id);
