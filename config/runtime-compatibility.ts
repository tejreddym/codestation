/**
 * Runtime compatibility classification for all tools in Code Station's central registry.
 * - "node-pure": Pure computation in Node.js (zero DOM, Canvas, WebAudio, WebCodecs, or local file upload)
 * - "node-file": Local file / binary tools queued for Sprint 2 file-path adapters (PDF, Spreadsheet, Archive, Image)
 * - "browser-only": Requires browser DOM, Canvas, WebAudio, Video/MediaRecorder, live timers, or visualizers
 */

export type ToolRuntimeCompatibility = "node-pure" | "node-file" | "browser-only";

export const NODE_FILE_TOOL_IDS: ReadonlySet<string> = new Set([
  // PDF Station (12 file/document tools)
  "pdf-merge",
  "pdf-split",
  "pdf-rotate",
  "images-to-pdf",
  "pdf-text-extractor",
  "pdf-page-deleter",
  "pdf-watermark",
  "pdf-page-numberer",
  "pdf-to-text",
  "pdf-to-images",
  "pdf-reorder-pages",
  "pdf-compressor",

  // Spreadsheet Station (21 workbook/tabular file tools)
  "csv-to-excel",
  "excel-to-csv",
  "json-to-excel",
  "excel-to-json",
  "tsv-to-excel",
  "excel-to-tsv",
  "xlsx-to-html",
  "spreadsheet-viewer",
  "sheet-extractor",
  "workbook-inspector",
  "spreadsheet-transposer",
  "spreadsheet-column-reorderer",
  "spreadsheet-row-filter",
  "spreadsheet-deduplicator",
  "spreadsheet-column-analyzer",
  "spreadsheet-empty-row-cleaner",
  "spreadsheet-empty-column-cleaner",
  "workbook-merger",
  "workbook-splitter",
  "spreadsheet-split-by-column",
  "spreadsheet-sql-query",

  // Archive & Binary Hashing Tools (4 tools)
  "zip-extractor",
  "zip-creator",
  "tar-inspector",
  "file-hash-generator",

  // Image Station (25 raster / binary image tools; svg-formatter & svg-minifier remain node-pure)
  "png-to-jpg",
  "jpg-to-png",
  "png-to-webp",
  "webp-to-png",
  "jpg-to-webp",
  "webp-to-jpg",
  "avif-to-png",
  "avif-to-jpg",
  "svg-to-png",
  "svg-to-jpg",
  "svg-to-webp",
  "image-compressor",
  "image-resizer",
  "image-cropper",
  "image-rotator",
  "image-flipper",
  "image-quality-adjuster",
  "image-dimension-inspector",
  "image-metadata-viewer",
  "image-to-base64",
  "base64-to-image",
  "image-to-data-uri",
  "data-uri-to-image",
  "image-color-extractor",
  "image-palette-generator",
]);

export const BROWSER_ONLY_TOOL_IDS: ReadonlySet<string> = new Set([
  // Audio Station (4 WebAudio / MediaRecorder tools)
  "audio-trimmer",
  "audio-compressor",
  "audio-merger",
  "audio-converter",

  // Video Station (2 HTMLVideo / Canvas / MediaRecorder tools)
  "video-thumbnail-generator",
  "video-trimmer",

  // DOM / Canvas / Browser Interactive Tools
  "signature-pad",
  "favicon-generator",
  "qr-code-reader",
  "barcode-generator",
  "pomodoro-timer",
  "api-request-tester",

  // Interactive CSS / Color Visualizers
  "color-picker",
  "flexbox-playground",
  "css-animation-builder",
  "clip-path-maker",
  "scrollbar-generator",
]);

/**
 * Classifies a registered Code Station tool slug/id by Node vs Browser runtime compatibility.
 */
export function classifyToolRuntime(id: string): ToolRuntimeCompatibility {
  if (NODE_FILE_TOOL_IDS.has(id)) return "node-file";
  if (BROWSER_ONLY_TOOL_IDS.has(id)) return "browser-only";
  return "node-pure";
}
