// @vitest-environment node
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as fflate from "fflate";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeNodeFileTool } from "./file-tools";
import { executeMcpTool } from "./server";
import { resolveLicense } from "./config";

const MINIMAL_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function createSamplePdf(pages: number, title = "Sample PDF"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor("Code Station Test");
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([600, 800]);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 18 });
  }
  return doc.save();
}

describe("MCP Node-Native File Tools (Sprint 2)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codestation-mcp-files-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("PDF tools via pdf-lib", () => {
    it("inspects, merges, splits, rotates, watermarks, deletes, numbers, and optimizes PDFs", async () => {
      const pdfA = path.join(tmpDir, "a.pdf");
      const pdfB = path.join(tmpDir, "b.pdf");
      fs.writeFileSync(pdfA, await createSamplePdf(2, "First Doc"));
      fs.writeFileSync(pdfB, await createSamplePdf(1, "Second Doc"));

      const inspectRes = JSON.parse(await executeNodeFileTool("pdf-inspect", "", { inputPath: pdfA }));
      expect(inspectRes.pageCount).toBe(2);
      expect(inspectRes.title).toBe("First Doc");
      expect(inspectRes.format).toBe("pdf");

      const mergedPath = path.join(tmpDir, "merged.pdf");
      const mergeRes = JSON.parse(
        await executeNodeFileTool("pdf-merge", "", { inputPaths: [pdfA, pdfB], outputPath: mergedPath })
      );
      expect(mergeRes.pageCount).toBe(3);
      expect(mergeRes.mergedFileCount).toBe(2);
      expect(fs.readFileSync(mergedPath).subarray(0, 5).toString("ascii")).toBe("%PDF-");

      const splitPath = path.join(tmpDir, "split.pdf");
      const splitRes = JSON.parse(
        await executeNodeFileTool("pdf-split", "", { inputPath: mergedPath, pages: "1,3", outputPath: splitPath })
      );
      expect(splitRes.pageCount).toBe(2);
      expect(splitRes.extractedPages).toEqual([1, 3]);
      expect(fs.readFileSync(splitPath).subarray(0, 5).toString("ascii")).toBe("%PDF-");

      const rotatedPath = path.join(tmpDir, "rotated.pdf");
      const rotateRes = JSON.parse(
        await executeNodeFileTool("pdf-rotate", "", { inputPath: splitPath, degrees: 90, outputPath: rotatedPath })
      );
      expect(rotateRes.rotationDegrees).toBe(90);
      expect(fs.readFileSync(rotatedPath).subarray(0, 5).toString("ascii")).toBe("%PDF-");

      const watermarkedPath = path.join(tmpDir, "watermarked.pdf");
      const watermarkRes = JSON.parse(
        await executeNodeFileTool("pdf-watermark", "", {
          inputPath: rotatedPath,
          text: "DRAFT",
          outputPath: watermarkedPath,
        })
      );
      expect(watermarkRes.watermarkText).toBe("DRAFT");
      expect(fs.readFileSync(watermarkedPath).subarray(0, 5).toString("ascii")).toBe("%PDF-");

      const deletedPath = path.join(tmpDir, "deleted.pdf");
      const deleteRes = JSON.parse(
        await executeNodeFileTool("pdf-page-deleter", "", { inputPath: mergedPath, pages: "2", outputPath: deletedPath })
      );
      expect(deleteRes.pageCount).toBe(2);

      const numberedPath = path.join(tmpDir, "numbered.pdf");
      const numberRes = JSON.parse(
        await executeNodeFileTool("pdf-page-numberer", "", { inputPath: deletedPath, outputPath: numberedPath })
      );
      expect(numberRes.pageCount).toBe(2);

      const compressedPath = path.join(tmpDir, "compressed.pdf");
      const compressRes = JSON.parse(
        await executeNodeFileTool("pdf-compressor", "", { inputPath: watermarkedPath, outputPath: compressedPath })
      );
      expect(compressRes.bytes).toBeGreaterThan(0);
      expect(fs.readFileSync(compressedPath).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });
  });

  describe("Spreadsheet & CSV tools via ExcelJS", () => {
    it("round-trips CSV <-> JSON and JSON/CSV <-> XLSX workbooks", async () => {
      const csvPath = path.join(tmpDir, "users.csv");
      fs.writeFileSync(csvPath, "name,role,score\nAda,Engineer,98\nLinus,Maintainer,99\n");

      const jsonOutPath = path.join(tmpDir, "users.json");
      const csvToJsonRes = JSON.parse(
        await executeNodeFileTool("csv-to-json", "", { inputPath: csvPath, outputPath: jsonOutPath })
      );
      expect(csvToJsonRes.outputPath).toBe(jsonOutPath);
      const parsedRecords = JSON.parse(fs.readFileSync(jsonOutPath, "utf-8"));
      expect(parsedRecords).toHaveLength(2);
      expect(parsedRecords[0].name).toBe("Ada");

      const xlsxPath = path.join(tmpDir, "users.xlsx");
      const jsonToXlsxRes = JSON.parse(
        await executeNodeFileTool("json-to-xlsx", "", {
          inputPath: jsonOutPath,
          outputPath: xlsxPath,
          sheetName: "Team",
        })
      );
      expect(jsonToXlsxRes.outputPath).toBe(xlsxPath);
      // XLSX files are standard ZIP containers starting with PK\x03\x04
      expect(fs.readFileSync(xlsxPath).subarray(0, 2).toString("ascii")).toBe("PK");

      const inspectXlsx = JSON.parse(await executeNodeFileTool("xlsx-inspect", "", { inputPath: xlsxPath }));
      expect(inspectXlsx.sheetNames).toContain("Team");
      expect(inspectXlsx.sheets[0].rowCount).toBe(2);

      const xlsxToJsonText = await executeNodeFileTool("xlsx-to-json", "", { inputPath: xlsxPath, sheet: "Team" });
      const rowsFromXlsx = JSON.parse(xlsxToJsonText);
      expect(rowsFromXlsx).toHaveLength(2);
      expect(rowsFromXlsx[1].name).toBe("Linus");

      const roundTripCsvPath = path.join(tmpDir, "roundtrip.csv");
      await executeNodeFileTool("excel-to-csv", "", { inputPath: xlsxPath, outputPath: roundTripCsvPath });
      expect(fs.readFileSync(roundTripCsvPath, "utf-8")).toContain("Ada,Engineer,98");

      const csvOutFromJson = await executeNodeFileTool("json-to-csv", "", { inputPath: jsonOutPath });
      expect(csvOutFromJson).toContain("Ada,Engineer,98");
    });
  });

  describe("Compression & Archive tools via Node zlib and fflate", () => {
    it("compresses and decompresses Gzip files and builds/lists/extracts ZIP archives", async () => {
      const srcTxt = path.join(tmpDir, "hello.txt");
      fs.writeFileSync(srcTxt, "Code Station Local File Processing " + "repeat ".repeat(20));

      const gzPath = path.join(tmpDir, "hello.txt.gz");
      const gzComp = JSON.parse(
        await executeNodeFileTool("gzip-compress", "", { inputPath: srcTxt, outputPath: gzPath })
      );
      expect(gzComp.outputPath).toBe(gzPath);
      const gzBytes = fs.readFileSync(gzPath);
      expect(gzBytes[0]).toBe(0x1f);
      expect(gzBytes[1]).toBe(0x8b);

      const restoredPath = path.join(tmpDir, "restored.txt");
      const gzDecomp = JSON.parse(
        await executeNodeFileTool("gzip-decompress", "", { inputPath: gzPath, outputPath: restoredPath })
      );
      expect(gzDecomp.isText).toBe(true);
      expect(fs.readFileSync(restoredPath, "utf-8")).toBe(fs.readFileSync(srcTxt, "utf-8"));

      const jsonFile = path.join(tmpDir, "meta.json");
      fs.writeFileSync(jsonFile, '{"station":"compression"}');

      const zipPath = path.join(tmpDir, "bundle.zip");
      const zipCreated = JSON.parse(
        await executeNodeFileTool("zip-create", "", { inputPaths: [srcTxt, jsonFile], outputPath: zipPath })
      );
      expect(zipCreated.fileCount).toBe(2);
      expect(fs.readFileSync(zipPath).subarray(0, 2).toString("ascii")).toBe("PK");

      const zipList = JSON.parse(await executeNodeFileTool("zip-list", "", { inputPath: zipPath }));
      expect(zipList.fileCount).toBe(2);
      expect(zipList.entries.map((e: { path: string }) => e.path)).toEqual(["hello.txt", "meta.json"]);

      const extractDir = path.join(tmpDir, "unpacked");
      const zipExtracted = JSON.parse(
        await executeNodeFileTool("zip-extract", "", { inputPath: zipPath, outputDir: extractDir })
      );
      expect(zipExtracted.extractedCount).toBe(2);
      expect(fs.readFileSync(path.join(extractDir, "meta.json"), "utf-8")).toBe('{"station":"compression"}');
    });

    it("blocks Zip Slip path traversal entries during zip-extract", async () => {
      const maliciousZip = fflate.zipSync({
        "../../escape.txt": new TextEncoder().encode("pwn"),
      });
      const badZipPath = path.join(tmpDir, "bad.zip");
      fs.writeFileSync(badZipPath, maliciousZip);

      await expect(
        executeNodeFileTool("zip-extract", "", { inputPath: badZipPath, outputDir: path.join(tmpDir, "out") })
      ).rejects.toThrow(/directory traversal/i);
    });
  });

  describe("Pure-JS Image / SVG & Hash tools (zero native addons)", () => {
    it("inspects PNG and SVG dimensions, resizes SVGs, and hashes local files", async () => {
      const pngPath = path.join(tmpDir, "pixel.png");
      fs.writeFileSync(pngPath, MINIMAL_1X1_PNG);

      const pngInfo = JSON.parse(await executeNodeFileTool("image-inspect", "", { inputPath: pngPath }));
      expect(pngInfo.format).toBe("png");
      expect(pngInfo.width).toBe(1);
      expect(pngInfo.height).toBe(1);

      const svgPath = path.join(tmpDir, "icon.svg");
      fs.writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>');

      const svgInfo = JSON.parse(await executeNodeFileTool("image-inspect", "", { inputPath: svgPath }));
      expect(svgInfo.format).toBe("svg");
      expect(svgInfo.width).toBe(24);
      expect(svgInfo.height).toBe(24);

      const resizedSvgPath = path.join(tmpDir, "icon-128.svg");
      const resized = JSON.parse(
        await executeNodeFileTool("svg-resize", "", { inputPath: svgPath, width: 128, outputPath: resizedSvgPath })
      );
      expect(resized.width).toBe(128);
      expect(resized.height).toBe(128);
      expect(fs.readFileSync(resizedSvgPath, "utf-8")).toContain('width="128"');

      const hashed = JSON.parse(
        await executeNodeFileTool("file-hash-generator", "", { inputPath: pngPath, algorithm: "SHA-256" })
      );
      expect(hashed.algorithm).toBe("SHA-256");
      expect(hashed.digest).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("Error handling & Hybrid MCP integration", () => {
    it("returns clean errors for missing, directory, empty, or corrupt files", async () => {
      await expect(
        executeNodeFileTool("pdf-inspect", "", { inputPath: path.join(tmpDir, "missing.pdf") })
      ).rejects.toThrow(/File not found/i);

      await expect(
        executeNodeFileTool("pdf-inspect", "", { inputPath: tmpDir })
      ).rejects.toThrow(/got a directory/i);

      const emptyFile = path.join(tmpDir, "empty.pdf");
      fs.writeFileSync(emptyFile, Buffer.alloc(0));
      await expect(
        executeNodeFileTool("pdf-inspect", "", { inputPath: emptyFile })
      ).rejects.toThrow(/empty \(0 bytes\)/i);

      const corruptPdf = path.join(tmpDir, "corrupt.pdf");
      fs.writeFileSync(corruptPdf, "not really a pdf document");
      await expect(
        executeNodeFileTool("pdf-inspect", "", { inputPath: corruptPdf })
      ).rejects.toThrow();
    });

    it("discovers and executes node-file tools end-to-end through codestation_list_tools and codestation_run_tool", async () => {
      const freeLicense = resolveLicense();
      const proLicense = resolveLicense("CS-PRO-TEST-KEY");

      const listRes = await executeMcpTool(
        "codestation_list_tools",
        { runtime: "node-file", limit: 50 },
        freeLicense
      );
      expect(listRes.isError).toBeUndefined();
      const listed = JSON.parse(listRes.content[0].text);
      expect(listed.tools.some((t: { slug: string; nodeFileSupported: boolean }) => t.slug === "pdf-inspect" && t.nodeFileSupported)).toBe(true);
      expect(listed.tools.some((t: { slug: string; nodeFileSupported: boolean }) => t.slug === "zip-create" && t.nodeFileSupported)).toBe(true);

      const descRes = await executeMcpTool("codestation_describe_tool", { slug: "pdf-inspect" }, freeLicense);
      expect(descRes.isError).toBeUndefined();
      const described = JSON.parse(descRes.content[0].text);
      expect(described.runtimeCompatibility).toBe("node-file");
      expect(described.nodeFileSupported).toBe(true);
      expect(described.tier).toBe("pro");

      const pdfPath = path.join(tmpDir, "mcp-sample.pdf");
      fs.writeFileSync(pdfPath, await createSamplePdf(3, "MCP Bridge PDF"));
      const blockedRes = await executeMcpTool(
        "codestation_run_tool",
        { slug: "pdf-inspect", options: { inputPath: pdfPath } },
        freeLicense
      );
      expect(blockedRes.isError).toBe(true);
      expect(blockedRes.content[0].text).toContain("Code Station Pro");
      expect(blockedRes.content[0].text).toContain("https://codestation.in/pro");

      const runRes = await executeMcpTool(
        "codestation_run_tool",
        { slug: "pdf-inspect", options: { inputPath: pdfPath } },
        proLicense
      );
      expect(runRes.isError).toBeUndefined();
      const output = JSON.parse(runRes.content[0].text);
      expect(output.pageCount).toBe(3);
      expect(output.title).toBe("MCP Bridge PDF");

      const csvFile = path.join(tmpDir, "data.csv");
      fs.writeFileSync(csvFile, "id,name\n1,Alpha\n");
      const dualModeCsv = await executeMcpTool(
        "codestation_run_tool",
        { slug: "csv-to-json", options: { inputPath: csvFile } },
        proLicense
      );
      expect(dualModeCsv.isError).toBeUndefined();
      expect(JSON.parse(dualModeCsv.content[0].text)).toEqual([{ id: "1", name: "Alpha" }]);
    });
  });
});
