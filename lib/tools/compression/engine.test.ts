import { describe, expect, it } from "vitest";
import {
  inspectZip,
  createZip,
  compressGzip,
  decompressGzip,
  parseTar,
  tarEntriesToZip,
  formatBytes,
  uint8ArrayToBase64,
  base64ToUint8Array,
  isTextBuffer,
  isImageExtension,
  isTextExtension,
} from "./engine";
import * as fflate from "fflate";

describe("Compression Engine", () => {
  describe("Utility Helpers", () => {
    it("formats bytes accurately", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(2048)).toBe("2.0 KB");
      expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
    });

    it("encodes and decodes base64 correctly", () => {
      const orig = new TextEncoder().encode("Hello World, Code Station!");
      const b64 = uint8ArrayToBase64(orig);
      expect(typeof b64).toBe("string");
      const decoded = base64ToUint8Array(b64);
      expect(decoded).toEqual(orig);
    });

    it("detects text vs binary buffers", () => {
      const textBytes = new TextEncoder().encode("Plain text payload with \n and \t");
      expect(isTextBuffer(textBytes)).toBe(true);

      const binaryBytes = new Uint8Array([0x00, 0xff, 0x12, 0x01, 0x02]);
      expect(isTextBuffer(binaryBytes)).toBe(false);
    });

    it("identifies image and text file extensions", () => {
      expect(isImageExtension("photo.PNG")).toBe(true);
      expect(isImageExtension("icon.svg")).toBe(true);
      expect(isImageExtension("document.pdf")).toBe(false);

      expect(isTextExtension("README.md")).toBe(true);
      expect(isTextExtension("config.json")).toBe(true);
      expect(isTextExtension("archive.zip")).toBe(false);
    });
  });

  describe("ZIP Archive Operations", () => {
    it("creates and inspects ZIP archives with hierarchical directories", () => {
      const files = [
        { path: "readme.txt", data: new TextEncoder().encode("Hello ZIP!") },
        { path: "src/index.js", data: new TextEncoder().encode("console.log('hi');") },
        { path: "src/utils/math.js", data: new TextEncoder().encode("export const add = (a, b) => a + b;") },
      ];

      const zipBytes = createZip(files, 6);
      expect(zipBytes.length).toBeGreaterThan(0);

      const inspection = inspectZip(zipBytes);
      expect(inspection.fileCount).toBe(3);
      expect(inspection.totalUncompressedSize).toBe(
        files.reduce((acc, f) => acc + f.data.length, 0)
      );

      // Verify tree structure
      expect(inspection.tree.length).toBeGreaterThanOrEqual(1);
      const readmeNode = inspection.tree.find((n) => n.name === "readme.txt");
      expect(readmeNode).toBeDefined();
      expect(readmeNode?.isDirectory).toBe(false);
      expect(readmeNode?.entry?.name).toBe("readme.txt");

      const srcNode = inspection.tree.find((n) => n.name === "src");
      expect(srcNode).toBeDefined();
      expect(srcNode?.isDirectory).toBe(true);
      expect(srcNode?.children.some((c) => c.name === "index.js")).toBe(true);
    });

    it("supports level 0 (store) and level 9 (max compression)", () => {
      const largeText = "A".repeat(10000);
      const files = [{ path: "repeated.txt", data: new TextEncoder().encode(largeText) }];

      const storeZip = createZip(files, 0);
      const maxZip = createZip(files, 9);

      expect(maxZip.length).toBeLessThan(storeZip.length);
    });
  });

  describe("Gzip & Deflate Compression / Decompression", () => {
    it("compresses and decompresses text with Gzip", async () => {
      const text = "Compress me with Gzip stream in browser memory!";
      const result = await compressGzip(text, { format: "gzip", level: 6 });

      expect(result.format).toBe("gzip");
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.originalSize).toBe(new TextEncoder().encode(text).length);
      expect(result.base64).toBeTruthy();

      const decomp = await decompressGzip(result.data, { format: "gzip" });
      expect(decomp.isText).toBe(true);
      expect(decomp.text).toBe(text);
      expect(decomp.decompressedSize).toBe(result.originalSize);
    });

    it("compresses and decompresses with Deflate", async () => {
      const text = "Deflate stream test payload.";
      const result = await compressGzip(text, { format: "deflate" });

      expect(result.format).toBe("deflate");
      const decomp = await decompressGzip(result.data, { format: "deflate" });
      expect(decomp.text).toBe(text);
    });

    it("auto-detects gzip vs deflate format", async () => {
      const payload = "Auto-detect compression test.";
      const gz = await compressGzip(payload, { format: "gzip" });
      const decompGz = await decompressGzip(gz.data, { format: "auto" });
      expect(decompGz.format).toBe("gzip");
      expect(decompGz.text).toBe(payload);

      const def = await compressGzip(payload, { format: "deflate" });
      const decompDef = await decompressGzip(def.data, { format: "auto" });
      expect(decompDef.format).toBe("deflate");
      expect(decompDef.text).toBe(payload);
    });

    it("handles base64 inputs directly", async () => {
      const text = "Base64 input decompression test";
      const compressed = await compressGzip(text);
      const decomp = await decompressGzip(compressed.base64, { isBase64: true });
      expect(decomp.text).toBe(text);
    });

    it("throws clear error on invalid corrupted input", async () => {
      const corrupted = new Uint8Array([1, 2, 3, 4, 5, 6]);
      await expect(decompressGzip(corrupted, { format: "gzip" })).rejects.toThrow();
    });
  });

  describe("TAR / TAR.GZ Inspector", () => {
    function makeSimpleTar(files: Array<{ name: string; data: Uint8Array; mode?: string }>): Uint8Array {
      const chunks: Uint8Array[] = [];
      const encoder = new TextEncoder();

      for (const f of files) {
        const header = new Uint8Array(512);
        const nameBytes = encoder.encode(f.name);
        header.set(nameBytes.slice(0, 100), 0);

        const modeStr = (f.mode || "0000644").padStart(7, "0") + " ";
        header.set(encoder.encode(modeStr), 100);

        const sizeStr = f.data.length.toString(8).padStart(11, "0") + " ";
        header.set(encoder.encode(sizeStr), 124);

        const mtimeStr = Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + " ";
        header.set(encoder.encode(mtimeStr), 136);

        header[156] = 48; // '0' for normal file
        header.set(encoder.encode("ustar\0"), 257);

        for (let i = 148; i < 156; i++) header[i] = 32;
        let sum = 0;
        for (let i = 0; i < 512; i++) sum += header[i];
        const chkStr = sum.toString(8).padStart(6, "0") + "\0 ";
        header.set(encoder.encode(chkStr), 148);

        chunks.push(header);
        chunks.push(f.data);
        const pad = (512 - (f.data.length % 512)) % 512;
        if (pad > 0) chunks.push(new Uint8Array(pad));
      }

      // End of archive marker
      chunks.push(new Uint8Array(1024));

      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const res = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        res.set(c, off);
        off += c.length;
      }
      return res;
    }

    it("parses uncompressed TAR archives and extracts metadata", () => {
      const tarData = makeSimpleTar([
        { name: "test.txt", data: new TextEncoder().encode("Hello Tar!"), mode: "0000644" },
        { name: "app.json", data: new TextEncoder().encode('{"version":"1.0.0"}'), mode: "0000755" },
      ]);

      const inspection = parseTar(tarData);
      expect(inspection.isGzipped).toBe(false);
      expect(inspection.fileCount).toBe(2);
      expect(inspection.entries.length).toBe(2);

      const testEntry = inspection.entries.find((e) => e.name === "test.txt");
      expect(testEntry).toBeDefined();
      expect(testEntry?.formattedMode).toBe("-rw-r--r--");
      expect(new TextDecoder().decode(testEntry?.data)).toBe("Hello Tar!");

      const appEntry = inspection.entries.find((e) => e.name === "app.json");
      expect(appEntry?.formattedMode).toBe("-rwxr-xr-x");
    });

    it("parses gzip-compressed .tar.gz archives", () => {
      const tarData = makeSimpleTar([
        { name: "archive.log", data: new TextEncoder().encode("Server log entry 123") },
      ]);

      const gzippedTar = fflate.gzipSync(tarData);
      const inspection = parseTar(gzippedTar);

      expect(inspection.isGzipped).toBe(true);
      expect(inspection.fileCount).toBe(1);
      expect(inspection.entries[0].name).toBe("archive.log");
      expect(new TextDecoder().decode(inspection.entries[0].data)).toBe("Server log entry 123");
    });

    it("converts TAR entries to a downloadable ZIP archive", () => {
      const tarData = makeSimpleTar([
        { name: "file1.txt", data: new TextEncoder().encode("F1") },
        { name: "file2.txt", data: new TextEncoder().encode("F2") },
      ]);

      const inspection = parseTar(tarData);
      const zipBytes = tarEntriesToZip(inspection.entries);
      expect(zipBytes.length).toBeGreaterThan(0);

      const zipInspection = inspectZip(zipBytes);
      expect(zipInspection.fileCount).toBe(2);
      expect(zipInspection.entries.some((e) => e.name === "file1.txt")).toBe(true);
    });
  });
});
