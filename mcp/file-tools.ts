/**
 * Node-Native Handlers for Code Station `node-file` MCP Tools.
 * Zero C++ native addons: reuses existing repo libraries (`pdf-lib`, `exceljs`,
 * `fflate`, Node `zlib` / `crypto`, and pure-JS image/SVG parsers).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as fflate from "fflate";
import {
  extractPdfInfo,
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePdfPages,
  applyWatermark,
  applyPageNumbers,
  parsePageRange,
  loadPdfDoc,
  type WatermarkOptions,
  type PageNumberOptions,
} from "../lib/tools/pdf/engine";
import { optimizePdfStreams, calculateSavings } from "../lib/tools/pdf/compress";
import { inspectSpreadsheet, runSpreadsheet } from "../lib/tools/spreadsheet/engine";
import { csvToJson, jsonToCsv } from "../lib/tools/data-station";
import { inspectZip, createZip, isTextBuffer } from "../lib/tools/compression/engine";
import { rasterHeader } from "../lib/tools/image/headers";
import { jpegExif } from "../lib/tools/image/metadata";
import { svgRasterSource } from "../lib/tools/image/svg";
import { hashBytes } from "../lib/tools/security/hashes";
import {
  createNodeFileLike,
  readLocalFileInput,
  readMultipleLocalFiles,
  safeResolveWithinDir,
  sanitizeFilename,
  writeLocalOutputFile,
  MAX_NODE_TOTAL_BYTES,
} from "./file-io";

export interface NodeFileToolDescriptor {
  slug: string;
  name: string;
  category: string;
  stationId: string;
  stationName: string;
  description: string;
  tier: "free" | "pro";
  inputSchema: Record<string, unknown>;
  sampleArgs: { input?: string; options?: Record<string, unknown> };
}

/**
 * Extra Node-file tool IDs & aliases exposed alongside config/tools.ts `node-file` slugs.
 */
export const VIRTUAL_NODE_FILE_DESCRIPTORS: readonly NodeFileToolDescriptor[] = [
  {
    slug: "pdf-inspect",
    name: "PDF Inspector",
    category: "PDF",
    stationId: "pdf",
    stationName: "PDF",
    description: "Inspect a local PDF file for page count, title, author, producer, and creation/modification dates using pdf-lib.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Optional base64 PDF payload if inputPath is omitted" },
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Absolute or relative path to the local PDF file" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/document.pdf" } },
  },
  {
    slug: "xlsx-inspect",
    name: "XLSX Workbook Inspector",
    category: "Spreadsheet",
    stationId: "spreadsheet",
    stationName: "Spreadsheet",
    description: "Inspect an Excel (.xlsx) workbook file for sheet names, row/column dimensions, headers, and formula counts.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to local .xlsx workbook" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/workbook.xlsx" } },
  },
  {
    slug: "xlsx-to-json",
    name: "XLSX to JSON Converter",
    category: "Spreadsheet",
    stationId: "spreadsheet",
    stationName: "Spreadsheet",
    description: "Extract rows from an Excel (.xlsx) worksheet into structured JSON records or write to an output JSON file.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to local .xlsx file" },
            sheet: { type: "string", description: "Optional worksheet name (defaults to first sheet)" },
            outputPath: { type: "string", description: "Optional path to write JSON output" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/workbook.xlsx", outputPath: "/path/to/output.json" } },
  },
  {
    slug: "json-to-xlsx",
    name: "JSON to XLSX Converter",
    category: "Spreadsheet",
    stationId: "spreadsheet",
    stationName: "Spreadsheet",
    description: "Convert a JSON array of objects (inline or from inputPath) into a real .xlsx workbook via ExcelJS.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Optional inline JSON array of objects" },
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Optional path to input .json file" },
            outputPath: { type: "string", description: "Path for output .xlsx file" },
            sheetName: { type: "string", description: "Worksheet name (default: 'Sheet1')" },
          },
        },
      },
    },
    sampleArgs: { input: '[{"name":"Ada","role":"Engineer"}]', options: { outputPath: "/path/to/output.xlsx" } },
  },
  {
    slug: "gzip-compress",
    name: "Gzip File Compressor",
    category: "Compression",
    stationId: "compression",
    stationName: "Compression",
    description: "Compress a local file with Node zlib gzip and write a .gz file cleanly without loading base64 blobs into context.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to source file to compress" },
            outputPath: { type: "string", description: "Optional output .gz path" },
            level: { type: "integer", description: "Compression level 1-9 (default: 6)" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/file.txt", outputPath: "/path/to/file.txt.gz" } },
  },
  {
    slug: "gzip-decompress",
    name: "Gzip File Decompressor",
    category: "Compression",
    stationId: "compression",
    stationName: "Compression",
    description: "Decompress a local .gz file via Node zlib and write the restored bytes to disk.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to .gz archive" },
            outputPath: { type: "string", description: "Optional output path for decompressed file" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/file.txt.gz", outputPath: "/path/to/file.txt" } },
  },
  {
    slug: "zip-list",
    name: "ZIP Archive Inspector",
    category: "Compression",
    stationId: "compression",
    stationName: "Compression",
    description: "List entries, directories, and uncompressed sizes inside a local .zip file.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to local .zip file" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/archive.zip" } },
  },
  {
    slug: "zip-create",
    name: "ZIP Archive Creator",
    category: "Compression",
    stationId: "compression",
    stationName: "Compression",
    description: "Bundle one or more local files (`inputPaths`) into a standard ZIP archive using pure-JS fflate.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPaths: { type: "array", description: "List of file paths to include in the archive" },
            outputPath: { type: "string", description: "Destination .zip path" },
            level: { type: "integer", description: "Compression level 0-9 (default: 6)" },
          },
          required: ["inputPaths"],
        },
      },
    },
    sampleArgs: { options: { inputPaths: ["/path/to/a.txt", "/path/to/b.json"], outputPath: "/path/to/archive.zip" } },
  },
  {
    slug: "zip-extract",
    name: "ZIP Archive Extractor",
    category: "Compression",
    stationId: "compression",
    stationName: "Compression",
    description: "Extract files from a local .zip archive into a safe directory with path-traversal protection.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to local .zip file" },
            outputDir: { type: "string", description: "Destination directory for extracted files" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/archive.zip", outputDir: "/path/to/extracted" } },
  },
  {
    slug: "image-inspect",
    name: "Image Inspector & EXIF",
    category: "Image",
    stationId: "image",
    stationName: "Image",
    description: "Inspect PNG, JPEG, WebP, GIF, BMP, AVIF, or SVG image files for dimensions, MIME format, and JPEG EXIF metadata in pure JS.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to local image file" },
          },
          required: ["inputPath"],
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/photo.png" } },
  },
  {
    slug: "svg-resize",
    name: "SVG Dimension Resizer",
    category: "Image",
    stationId: "image",
    stationName: "Image",
    description: "Safely resize width/height attributes of a static SVG file in pure JS (via saxes) with zero native addons.",
    tier: "free",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Optional inline SVG markup" },
        options: {
          type: "object",
          properties: {
            inputPath: { type: "string", description: "Path to local .svg file" },
            outputPath: { type: "string", description: "Optional destination .svg file" },
            width: { type: "integer", description: "Target SVG width in pixels" },
            height: { type: "integer", description: "Target SVG height in pixels" },
          },
        },
      },
    },
    sampleArgs: { options: { inputPath: "/path/to/icon.svg", outputPath: "/path/to/resized.svg", width: 256, height: 256 } },
  },
];

export const VIRTUAL_NODE_FILE_MAP = new Map<string, NodeFileToolDescriptor>(
  VIRTUAL_NODE_FILE_DESCRIPTORS.map((d) => [d.slug, d])
);

/** All wired Node-native file tool slugs (virtual + config/tools.ts slugs). */
export const WIRED_NODE_FILE_SLUGS: ReadonlySet<string> = new Set([
  // PDF
  "pdf-inspect",
  "pdf-merge",
  "pdf-split",
  "pdf-rotate",
  "pdf-watermark",
  "pdf-page-deleter",
  "pdf-page-numberer",
  "pdf-compressor",
  // Spreadsheet
  "csv-to-json",
  "json-to-csv",
  "xlsx-inspect",
  "workbook-inspector",
  "xlsx-to-json",
  "excel-to-json",
  "json-to-xlsx",
  "json-to-excel",
  "csv-to-excel",
  "excel-to-csv",
  // Compression / Archive
  "gzip-compress",
  "gzip-decompress",
  "zip-list",
  "zip-create",
  "zip-creator",
  "zip-extract",
  "zip-extractor",
  // Image (pure JS)
  "image-inspect",
  "image-dimension-inspector",
  "image-metadata-viewer",
  "svg-resize",
  // Security binary hashing
  "file-hash-generator",
]);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function defaultStem(name: string): string {
  return path.basename(name, path.extname(name)) || "output";
}

function inspectSvgHeader(text: string): { width: number; height: number; mimeType: "image/svg+xml" } | null {
  if (!/<svg[\s>]/i.test(text)) return null;
  const parsed = svgRasterSource(text);
  return { width: parsed.width, height: parsed.height, mimeType: "image/svg+xml" };
}

/**
 * Executes any wired Node-native `node-file` tool (or file-path invocation of
 * `csv-to-json` / `json-to-csv` / `gzip-compressor` / `gzip-decompressor`).
 */
export async function executeNodeFileTool(
  slug: string,
  rawInput = "",
  rawOptions: Record<string, unknown> = {}
): Promise<string> {
  const opts = rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions) ? rawOptions : {};
  const returnBase64 = Boolean(opts.returnBase64);

  switch (slug) {
    // ---------------------------------------------------------
    // PDF TOOLS (pdf-lib via lib/tools/pdf/)
    // ---------------------------------------------------------
    case "pdf-inspect": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "document.pdf",
      });
      const info = await extractPdfInfo(toArrayBuffer(file.bytes));
      return JSON.stringify(
        {
          tool: "pdf-inspect",
          fileName: file.name,
          ...(file.path ? { inputPath: file.path } : {}),
          bytes: file.byteLength,
          format: "pdf",
          ...info,
        },
        null,
        2
      );
    }

    case "pdf-merge": {
      const files = readMultipleLocalFiles(opts.inputPaths, 2);
      const mergedBytes = await mergePdfs(files.map((f) => toArrayBuffer(f.bytes)));
      const mergedDoc = await loadPdfDoc(mergedBytes);
      const written = writeLocalOutputFile(mergedBytes, {
        outputPath: opts.outputPath,
        defaultFilename: "merged.pdf",
        format: "pdf",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: "pdf-merge",
          ...written,
          mergedFileCount: files.length,
          pageCount: mergedDoc.getPageCount(),
          inputs: files.map((f) => ({ name: f.name, bytes: f.byteLength })),
        },
        null,
        2
      );
    }

    case "pdf-split": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "source.pdf",
      });
      const sourceDoc = await loadPdfDoc(file.bytes);
      const totalPages = sourceDoc.getPageCount();
      const rangeStr = typeof opts.pages === "string"
        ? opts.pages
        : typeof opts.pageRange === "string"
          ? opts.pageRange
          : "1";
      const pageIndices = parsePageRange(rangeStr, totalPages);
      const splitBytes = await splitPdf(toArrayBuffer(file.bytes), pageIndices);
      const written = writeLocalOutputFile(splitBytes, {
        outputPath: opts.outputPath,
        defaultFilename: `${defaultStem(file.name)}-split.pdf`,
        format: "pdf",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: "pdf-split",
          ...written,
          sourcePages: totalPages,
          extractedPages: pageIndices.map((i) => i + 1),
          pageCount: pageIndices.length,
        },
        null,
        2
      );
    }

    case "pdf-rotate": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "source.pdf",
      });
      const rawDeg = Number(opts.degrees ?? opts.angle ?? opts.rotation ?? 90);
      if (rawDeg !== 90 && rawDeg !== 180 && rawDeg !== 270) {
        throw new Error("`degrees` must be 90, 180, or 270 clockwise.");
      }
      const doc = await loadPdfDoc(file.bytes);
      const totalPages = doc.getPageCount();
      const rangeStr = typeof opts.pageRange === "string" ? opts.pageRange : typeof opts.pages === "string" ? opts.pages : "";
      const pageIndices = rangeStr ? parsePageRange(rangeStr, totalPages) : undefined;
      const rotatedBytes = await rotatePdf(toArrayBuffer(file.bytes), rawDeg, pageIndices);
      const written = writeLocalOutputFile(rotatedBytes, {
        outputPath: opts.outputPath,
        defaultFilename: `${defaultStem(file.name)}-rotated.pdf`,
        format: "pdf",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: "pdf-rotate",
          ...written,
          rotationDegrees: rawDeg,
          pageCount: totalPages,
        },
        null,
        2
      );
    }

    case "pdf-watermark": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "source.pdf",
      });
      const watermarkOpts: WatermarkOptions = {
        type: "text",
        text: typeof opts.text === "string" && opts.text.trim() ? opts.text : "CONFIDENTIAL",
        fontSize: opts.fontSize !== undefined ? Number(opts.fontSize) : 48,
        color: typeof opts.color === "string" ? opts.color : "#666666",
        opacity: opts.opacity !== undefined ? Number(opts.opacity) : 0.3,
        rotation: opts.rotation !== undefined ? Number(opts.rotation) : 45,
        position: (opts.position ? String(opts.position) : "center") as WatermarkOptions["position"],
        pageRange: typeof opts.pageRange === "string" ? opts.pageRange : undefined,
      };
      const outBytes = await applyWatermark(file.bytes, watermarkOpts);
      const doc = await loadPdfDoc(outBytes);
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: `${defaultStem(file.name)}-watermarked.pdf`,
        format: "pdf",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: "pdf-watermark",
          ...written,
          watermarkText: watermarkOpts.text,
          pageCount: doc.getPageCount(),
        },
        null,
        2
      );
    }

    case "pdf-page-deleter": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "source.pdf",
      });
      const doc = await loadPdfDoc(file.bytes);
      const indices = parsePageRange(String(opts.pages ?? opts.pageRange ?? "1"), doc.getPageCount());
      const outBytes = await deletePdfPages(toArrayBuffer(file.bytes), indices);
      const updated = await loadPdfDoc(outBytes);
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: `${defaultStem(file.name)}-trimmed.pdf`,
        format: "pdf",
        returnBase64,
      });
      return JSON.stringify({ tool: "pdf-page-deleter", ...written, pageCount: updated.getPageCount() }, null, 2);
    }

    case "pdf-page-numberer": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "source.pdf",
      });
      const pageOpts: PageNumberOptions = {
        format: (opts.format ?? "page-x-of-y") as PageNumberOptions["format"],
        verticalPosition: (opts.verticalPosition ?? "footer") as PageNumberOptions["verticalPosition"],
        alignment: (opts.alignment ?? "center") as PageNumberOptions["alignment"],
        fontSize: opts.fontSize ? Number(opts.fontSize) : 10,
      };
      const outBytes = await applyPageNumbers(file.bytes, pageOpts);
      const doc = await loadPdfDoc(outBytes);
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: `${defaultStem(file.name)}-numbered.pdf`,
        format: "pdf",
        returnBase64,
      });
      return JSON.stringify({ tool: "pdf-page-numberer", ...written, pageCount: doc.getPageCount() }, null, 2);
    }

    case "pdf-compressor": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "source.pdf",
      });
      const outBytes = await optimizePdfStreams(file.bytes);
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: `${defaultStem(file.name)}-optimized.pdf`,
        format: "pdf",
        returnBase64,
      });
      const savings = calculateSavings(file.byteLength, outBytes.byteLength);
      return JSON.stringify({ tool: "pdf-compressor", ...written, originalBytes: file.byteLength, ...savings }, null, 2);
    }

    // ---------------------------------------------------------
    // SPREADSHEET / CSV / XLSX (exceljs via lib/tools/spreadsheet/)
    // ---------------------------------------------------------
    case "csv-to-json": {
      const file = typeof opts.inputPath === "string" && opts.inputPath.trim()
        ? readLocalFileInput({ inputPath: opts.inputPath })
        : undefined;
      const csvText = file ? new TextDecoder("utf-8", { fatal: true }).decode(file.bytes) : rawInput;
      const jsonOut = csvToJson(csvText);
      const parsed = JSON.parse(jsonOut) as unknown[];
      if (typeof opts.outputPath === "string" && opts.outputPath.trim()) {
        const written = writeLocalOutputFile(new TextEncoder().encode(jsonOut), {
          outputPath: opts.outputPath,
          defaultFilename: `${file ? defaultStem(file.name) : "data"}.json`,
          format: "json",
          returnBase64,
        });
        return JSON.stringify({ tool: "csv-to-json", ...written, rowCount: parsed.length }, null, 2);
      }
      return jsonOut;
    }

    case "json-to-csv": {
      const file = typeof opts.inputPath === "string" && opts.inputPath.trim()
        ? readLocalFileInput({ inputPath: opts.inputPath })
        : undefined;
      const jsonText = file ? new TextDecoder("utf-8", { fatal: true }).decode(file.bytes) : rawInput;
      const csvOut = jsonToCsv(jsonText);
      if (typeof opts.outputPath === "string" && opts.outputPath.trim()) {
        const written = writeLocalOutputFile(new TextEncoder().encode(csvOut), {
          outputPath: opts.outputPath,
          defaultFilename: `${file ? defaultStem(file.name) : "data"}.csv`,
          format: "csv",
          returnBase64,
        });
        return JSON.stringify(
          {
            tool: "json-to-csv",
            ...written,
            lineCount: csvOut.split(/\r?\n/).filter(Boolean).length,
          },
          null,
          2
        );
      }
      return csvOut;
    }

    case "xlsx-inspect":
    case "workbook-inspector": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "workbook.xlsx",
      });
      const nodeFile = createNodeFileLike(file.bytes, file.name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const info = await inspectSpreadsheet(nodeFile);
      return JSON.stringify(
        {
          tool: slug,
          fileName: file.name,
          ...(file.path ? { inputPath: file.path } : {}),
          bytes: file.byteLength,
          format: "xlsx",
          sheetCount: info.sheetNames.length,
          sheetNames: info.sheetNames,
          sheets: info.sheets,
        },
        null,
        2
      );
    }

    case "xlsx-to-json":
    case "excel-to-json": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "workbook.xlsx",
      });
      const nodeFile = createNodeFileLike(file.bytes, file.name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const res = await runSpreadsheet("excel-to-json", {
        file: nodeFile,
        ...(typeof opts.sheet === "string" ? { sheet: opts.sheet } : {}),
      });
      const jsonText = res.text ?? "[]";
      if (typeof opts.outputPath === "string" && opts.outputPath.trim()) {
        const written = writeLocalOutputFile(new TextEncoder().encode(jsonText), {
          outputPath: opts.outputPath,
          defaultFilename: `${defaultStem(file.name)}.json`,
          format: "json",
          returnBase64,
        });
        return JSON.stringify({ tool: slug, ...written, ...(res.data ?? {}) }, null, 2);
      }
      return jsonText;
    }

    case "json-to-xlsx":
    case "json-to-excel": {
      const file = typeof opts.inputPath === "string" && opts.inputPath.trim()
        ? readLocalFileInput({ inputPath: opts.inputPath })
        : undefined;
      const source = file
        ? new TextDecoder("utf-8", { fatal: true }).decode(file.bytes)
        : rawInput || (typeof opts.json === "string" ? opts.json : "");
      if (!source.trim()) {
        throw new Error("Provide a JSON array of objects via `input` or `options.inputPath`.");
      }
      const res = await runSpreadsheet("json-to-excel", {
        source,
        ...(typeof opts.sheetName === "string" ? { sheetName: opts.sheetName } : {}),
      });
      const outFile = res.files?.[0];
      if (!outFile) throw new Error("Failed to generate XLSX workbook.");
      const outBytes = new Uint8Array(await outFile.blob.arrayBuffer());
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: outFile.name,
        format: "xlsx",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: slug,
          ...written,
          sheetName: typeof opts.sheetName === "string" ? opts.sheetName : "Sheet1",
          ...(res.data ?? {}),
        },
        null,
        2
      );
    }

    case "csv-to-excel": {
      const file = typeof opts.inputPath === "string" && opts.inputPath.trim()
        ? readLocalFileInput({ inputPath: opts.inputPath })
        : undefined;
      const source = file ? new TextDecoder("utf-8", { fatal: true }).decode(file.bytes) : rawInput;
      if (!source.trim()) {
        throw new Error("Provide CSV content via `input` or `options.inputPath`.");
      }
      const res = await runSpreadsheet("csv-to-excel", {
        source,
        ...(typeof opts.sheetName === "string" ? { sheetName: opts.sheetName } : {}),
      });
      const outFile = res.files?.[0];
      if (!outFile) throw new Error("Failed to generate XLSX workbook from CSV.");
      const outBytes = new Uint8Array(await outFile.blob.arrayBuffer());
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: outFile.name,
        format: "xlsx",
        returnBase64,
      });
      return JSON.stringify({ tool: "csv-to-excel", ...written, ...(res.data ?? {}) }, null, 2);
    }

    case "excel-to-csv": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "workbook.xlsx",
      });
      const nodeFile = createNodeFileLike(file.bytes, file.name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const res = await runSpreadsheet("excel-to-csv", {
        file: nodeFile,
        ...(typeof opts.sheet === "string" ? { sheet: opts.sheet } : {}),
      });
      const csvText = res.text ?? "";
      if (typeof opts.outputPath === "string" && opts.outputPath.trim()) {
        const written = writeLocalOutputFile(new TextEncoder().encode(csvText), {
          outputPath: opts.outputPath,
          defaultFilename: `${defaultStem(file.name)}.csv`,
          format: "csv",
          returnBase64,
        });
        return JSON.stringify({ tool: "excel-to-csv", ...written, ...(res.data ?? {}) }, null, 2);
      }
      return csvText;
    }

    // ---------------------------------------------------------
    // COMPRESSION / ARCHIVE (Node zlib + pure-JS fflate)
    // ---------------------------------------------------------
    case "gzip-compress":
    case "gzip-compressor": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64,
        fallbackName: "input.bin",
      });
      const level = Math.min(9, Math.max(1, Number(opts.level ?? 6)));
      const gzBuf = zlib.gzipSync(file.bytes, { level });
      const outBytes = new Uint8Array(gzBuf.buffer, gzBuf.byteOffset, gzBuf.byteLength);
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: `${file.name}.gz`,
        format: "gzip",
        returnBase64,
      });
      const ratioPercent = Number((((file.byteLength - outBytes.byteLength) / file.byteLength) * 100).toFixed(1));
      return JSON.stringify(
        {
          tool: slug,
          ...written,
          originalBytes: file.byteLength,
          ratioPercent,
        },
        null,
        2
      );
    }

    case "gzip-decompress":
    case "gzip-decompressor": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64,
        fallbackName: "archive.gz",
      });
      const restoredBuf = zlib.gunzipSync(file.bytes);
      const outBytes = new Uint8Array(restoredBuf.buffer, restoredBuf.byteOffset, restoredBuf.byteLength);
      if (outBytes.byteLength > MAX_NODE_TOTAL_BYTES) {
        throw new Error("Decompressed output exceeds safety size limit.");
      }
      const restoredName = file.name.endsWith(".gz") ? file.name.slice(0, -3) || "decompressed.bin" : `${file.name}.out`;
      const written = writeLocalOutputFile(outBytes, {
        outputPath: opts.outputPath,
        defaultFilename: restoredName,
        format: isTextBuffer(outBytes) ? "text" : "binary",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: slug,
          ...written,
          compressedBytes: file.byteLength,
          isText: isTextBuffer(outBytes),
        },
        null,
        2
      );
    }

    case "zip-list": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "archive.zip",
      });
      const inspected = inspectZip(file.bytes);
      return JSON.stringify(
        {
          tool: "zip-list",
          fileName: file.name,
          ...(file.path ? { inputPath: file.path } : {}),
          bytes: file.byteLength,
          format: "zip",
          fileCount: inspected.fileCount,
          dirCount: inspected.dirCount,
          totalUncompressedSize: inspected.totalUncompressedSize,
          entries: inspected.entries.map((entry) => ({
            path: entry.path,
            size: entry.size,
            isDirectory: entry.isDirectory,
          })),
        },
        null,
        2
      );
    }

    case "zip-create":
    case "zip-creator": {
      const archiveEntries: Array<{ path: string; data: Uint8Array }> = [];
      if (opts.inputPaths) {
        const files = readMultipleLocalFiles(opts.inputPaths, 1);
        const usedNames = new Set<string>();
        for (const f of files) {
          let name = sanitizeFilename(f.name);
          if (usedNames.has(name)) {
            const ext = path.extname(name);
            const stem = path.basename(name, ext);
            let n = 2;
            while (usedNames.has(`${stem}_${n}${ext}`)) n += 1;
            name = `${stem}_${n}${ext}`;
          }
          usedNames.add(name);
          archiveEntries.push({ path: name, data: f.bytes });
        }
      } else if (Array.isArray(opts.files)) {
        for (const item of opts.files) {
          const entry = item as Record<string, unknown>;
          if (typeof entry.inputPath === "string") {
            const loaded = readLocalFileInput({ inputPath: entry.inputPath });
            archiveEntries.push({
              path: sanitizeFilename(typeof entry.path === "string" ? entry.path : loaded.name),
              data: loaded.bytes,
            });
          } else {
            archiveEntries.push({
              path: sanitizeFilename(typeof entry.path === "string" ? entry.path : "file.txt"),
              data: new TextEncoder().encode(typeof entry.content === "string" ? entry.content : ""),
            });
          }
        }
      } else if (rawInput) {
        archiveEntries.push({
          path: sanitizeFilename(typeof opts.filename === "string" ? opts.filename : "file.txt"),
          data: new TextEncoder().encode(rawInput),
        });
      }

      if (archiveEntries.length === 0) {
        throw new Error("Provide `options.inputPaths` or `options.files` to build a ZIP archive.");
      }

      const zipBytes = createZip(archiveEntries, Number(opts.level ?? 6));
      const written = writeLocalOutputFile(zipBytes, {
        outputPath: opts.outputPath,
        defaultFilename: "archive.zip",
        format: "zip",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: slug,
          ...written,
          fileCount: archiveEntries.length,
          entries: archiveEntries.map((e) => ({ path: e.path, uncompressedBytes: e.data.byteLength })),
        },
        null,
        2
      );
    }

    case "zip-extract":
    case "zip-extractor": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "archive.zip",
      });
      const unzipped = fflate.unzipSync(file.bytes);
      const outputDirRaw = typeof opts.outputDir === "string"
        ? opts.outputDir.trim()
        : typeof opts.outputPath === "string"
          ? opts.outputPath.trim()
          : "";

      if (opts.listOnly === true || (!outputDirRaw && typeof opts.inputBase64 !== "string" && typeof opts.inputPath !== "string")) {
        const inspected = inspectZip(file.bytes);
        return JSON.stringify(
          {
            tool: slug,
            fileCount: inspected.fileCount,
            dirCount: inspected.dirCount,
            totalUncompressedSize: inspected.totalUncompressedSize,
            entries: inspected.entries.map((e) => ({ path: e.path, size: e.size, isDirectory: e.isDirectory })),
          },
          null,
          2
        );
      }

      const targetDir = outputDirRaw
        ? path.resolve(outputDirRaw)
        : fs.mkdtempSync(path.join(os.tmpdir(), "codestation-mcp-unzip-"));
      fs.mkdirSync(targetDir, { recursive: true });

      const extractedFiles: Array<{ path: string; outputPath: string; bytes: number }> = [];
      let totalBytes = 0;

      for (const [rawEntryPath, data] of Object.entries(unzipped)) {
        if (rawEntryPath.endsWith("/")) {
          const dirTarget = safeResolveWithinDir(targetDir, rawEntryPath);
          fs.mkdirSync(dirTarget, { recursive: true });
          continue;
        }
        totalBytes += data.byteLength;
        if (totalBytes > MAX_NODE_TOTAL_BYTES) {
          throw new Error("Extracted ZIP payload exceeds combined 100 MiB safety limit.");
        }
        const fileTarget = safeResolveWithinDir(targetDir, rawEntryPath);
        fs.mkdirSync(path.dirname(fileTarget), { recursive: true });
        fs.writeFileSync(fileTarget, data);
        extractedFiles.push({ path: rawEntryPath, outputPath: fileTarget, bytes: data.byteLength });
      }

      return JSON.stringify(
        {
          tool: slug,
          outputDir: targetDir,
          extractedCount: extractedFiles.length,
          totalBytes,
          format: "zip-extracted",
          files: extractedFiles,
        },
        null,
        2
      );
    }

    // ---------------------------------------------------------
    // IMAGE (Pure JS/SVG — zero native addons)
    // ---------------------------------------------------------
    case "image-inspect":
    case "image-dimension-inspector":
    case "image-metadata-viewer": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "image.bin",
      });
      const textCandidate = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes.subarray(0, 4096));
      if (/<svg[\s>]/i.test(textCandidate)) {
        const fullSvg = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
        const svgInfo = inspectSvgHeader(fullSvg);
        if (svgInfo) {
          return JSON.stringify(
            {
              tool: slug,
              fileName: file.name,
              ...(file.path ? { inputPath: file.path } : {}),
              bytes: file.byteLength,
              format: "svg",
              mimeType: svgInfo.mimeType,
              width: svgInfo.width,
              height: svgInfo.height,
            },
            null,
            2
          );
        }
      }

      const header = rasterHeader(file.bytes);
      const exif = header.mime === "image/jpeg" ? jpegExif(file.bytes) : {};
      const format = header.mime.replace("image/", "");
      return JSON.stringify(
        {
          tool: slug,
          fileName: file.name,
          ...(file.path ? { inputPath: file.path } : {}),
          bytes: file.byteLength,
          format,
          mimeType: header.mime,
          width: header.width,
          height: header.height,
          exif,
        },
        null,
        2
      );
    }

    case "svg-resize": {
      const file = typeof opts.inputPath === "string" && opts.inputPath.trim()
        ? readLocalFileInput({ inputPath: opts.inputPath })
        : undefined;
      const source = file ? new TextDecoder("utf-8", { fatal: true }).decode(file.bytes) : rawInput;
      if (!source.trim()) {
        throw new Error("Provide SVG source via `input` or `options.inputPath`.");
      }
      const rawW = opts.width !== undefined ? Number(opts.width) : undefined;
      const rawH = opts.height !== undefined ? Number(opts.height) : undefined;
      const base = svgRasterSource(source);
      const width = rawW !== undefined ? rawW : rawH !== undefined ? Math.max(1, Math.round((rawH * base.width) / base.height)) : undefined;
      const height = rawH !== undefined ? rawH : rawW !== undefined ? Math.max(1, Math.round((rawW * base.height) / base.width)) : undefined;
      const resized = svgRasterSource(source, width, height);
      const written = writeLocalOutputFile(new TextEncoder().encode(resized.text), {
        outputPath: opts.outputPath,
        defaultFilename: `${file ? defaultStem(file.name) : "resized"}-${resized.width}x${resized.height}.svg`,
        format: "svg",
        returnBase64,
      });
      return JSON.stringify(
        {
          tool: "svg-resize",
          ...written,
          width: resized.width,
          height: resized.height,
        },
        null,
        2
      );
    }

    // ---------------------------------------------------------
    // SECURITY BINARY HASH
    // ---------------------------------------------------------
    case "file-hash-generator": {
      const file = readLocalFileInput({
        inputPath: opts.inputPath,
        inputBase64: opts.inputBase64 ?? (rawInput || undefined),
        fallbackName: "file.bin",
      });
      const algorithm = String(opts.algorithm ?? "SHA-256").toUpperCase();
      const buffer = new Uint8Array(new ArrayBuffer(file.byteLength));
      buffer.set(file.bytes);
      const digest = await hashBytes(buffer, algorithm);
      return JSON.stringify(
        {
          tool: "file-hash-generator",
          fileName: file.name,
          ...(file.path ? { inputPath: file.path } : {}),
          bytes: file.byteLength,
          algorithm,
          digest,
        },
        null,
        2
      );
    }

    default:
      throw new Error(
        `Tool "${slug}" is marked node-file and does not yet have a Node-native handler (available in browser at https://codestation.in/tools/${slug}).`
      );
  }
}
