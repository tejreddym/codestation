import { Inflate } from "fflate";
import { SaxesParser } from "saxes";
import { SpreadsheetError } from "./types";

export const LIMITS = Object.freeze({
  fileBytes: 16 * 1024 * 1024, archiveBytes: 64 * 1024 * 1024,
  entryBytes: 24 * 1024 * 1024, entries: 1024,
  rows: 20_000, columns: 512, cells: 250_000, sheets: 64,
  textCharacters: 2_000_000, cellCharacters: 32_767, outputs: 64,
});

export function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new SpreadsheetError("Spreadsheet processing cancelled.");
}

export function dimensions(rows: number, columns: number): void {
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 0 || columns < 0
    || rows > LIMITS.rows || columns > LIMITS.columns || rows * columns > LIMITS.cells) {
    throw new SpreadsheetError(`Workbook ranges are limited to ${LIMITS.rows.toLocaleString()} rows, ${LIMITS.columns} columns and ${LIMITS.cells.toLocaleString()} cells, including sparse ranges.`, "file");
  }
}

type Entry = { name: string; start: number; size: number; compressed: number; method: number; crc: number };
const fail = (message: string): never => { throw new SpreadsheetError(message, "file"); };
const decoder = new TextDecoder("utf-8", { fatal: true });

/** Check declared sizes and local/central agreement before allocating any inflated content. */
function directory(bytes: Uint8Array): Entry[] {
  if (bytes.byteLength > LIMITS.fileBytes) fail("Each file is limited to 16 MiB.");
  if (bytes.byteLength < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) fail("Choose an unencrypted XLSX workbook; legacy XLS, encrypted Office files and other formats are unsupported.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65_557); p--) {
    if (view.getUint32(p, true) === 0x06054b50 && p + 22 + view.getUint16(p + 20, true) === bytes.length) { end = p; break; }
  }
  if (end < 0) fail("Malformed XLSX ZIP directory.");
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail("Multipart ZIP workbooks are unsupported.");
  const count = view.getUint16(end + 10, true), length = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (count !== view.getUint16(end + 8, true) || count === 0xffff || offset === 0xffffffff || length === 0xffffffff) fail("ZIP64 workbooks are unsupported.");
  if (count < 1 || count > LIMITS.entries || offset + length !== end) fail("Invalid ZIP directory or more than 1,024 archive entries.");
  const names = new Set<string>();
  const result: Entry[] = [];
  let p = offset, total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || view.getUint32(p, true) !== 0x02014b50) fail("Malformed ZIP entry.");
    const flags = view.getUint16(p + 8, true), method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true), compressed = view.getUint32(p + 20, true), size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true), extra = view.getUint16(p + 30, true), comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    if (p + 46 + nameLength + extra + comment > end || !nameLength || nameLength > 1024) fail("Invalid ZIP entry name.");
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (flags & 0x2041) fail("Encrypted XLSX archives are unsupported.");
    if (method !== 0 && method !== 8) fail("Unsupported ZIP compression method.");
    if (view.getUint16(p + 34, true)) fail("Multipart ZIP workbooks are unsupported.");
    if (size === 0xffffffff || compressed === 0xffffffff || local === 0xffffffff) fail("ZIP64 workbooks are unsupported.");
    if (/^[\/\\]|\\|\x00|[\x01-\x1f]|(?:^|\/)\.\.?($|\/)/.test(name) || names.has(name.toLowerCase())) fail("Unsafe or duplicate ZIP entry names.");
    names.add(name.toLowerCase());
    if (/vba|macro|activeX|embeddings|externalLinks/i.test(name)) fail("Macro, embedded-object and external workbook-link archives are unsupported.");
    total += size;
    if (size > LIMITS.entryBytes || total > LIMITS.archiveBytes) fail("ZIP content exceeds the 24 MiB entry or 64 MiB total decompressed limit.");
    if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50) fail("Malformed ZIP local header.");
    const localName = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + localExtra;
    if (start + compressed > offset || start > offset || localName !== nameLength
      || decoder.decode(bytes.subarray(local + 30, local + 30 + localName)) !== name
      || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) fail("ZIP local and central headers disagree.");
    if (!(flags & 8) && (view.getUint32(local + 18, true) !== compressed || view.getUint32(local + 22, true) !== size || view.getUint32(local + 14, true) !== crc)) fail("ZIP declared sizes disagree.");
    if (method === 0 && compressed !== size) fail("Invalid stored ZIP entry size.");
    result.push({ name, start, size, compressed, method, crc });
    p += 46 + nameLength + extra + comment;
  }
  if (p !== end) fail("Malformed ZIP directory length.");
  const ordered = [...result].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) if (ordered[i].start < ordered[i - 1].start + ordered[i - 1].compressed) fail("Overlapping ZIP entries.");
  if (!names.has("[content_types].xml") || !names.has("xl/workbook.xml")) fail("The archive is not an XLSX workbook.");
  return result;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c; }

function address(value: string): [number, number] {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/i.exec(value);
  if (!match) return fail("Invalid spreadsheet cell reference.");
  let column = 0;
  for (const letter of match[1].toUpperCase()) column = column * 26 + letter.charCodeAt(0) - 64;
  const row = Number(match[2]);
  dimensions(row, column);
  return [row, column];
}

/** Streaming inflation has bounded chunks; XML ranges are checked before ExcelJS sees bytes. */
export function validateXlsx(bytes: Uint8Array, signal?: AbortSignal): void {
  cancelled(signal);
  const entries = directory(bytes);
  let actualTotal = 0, cells = 0, sheetCount = 0, xmlNodes = 0, sharedStrings = 0, totalArea = 0;
  for (const entry of entries) {
    cancelled(signal);
    let actual = 0, crc = 0xffffffff;
    let parser: SaxesParser | undefined;
    const textDecoder = new TextDecoder("utf-8", { fatal: true });
    if (/\.xml$|\.rels$/i.test(entry.name)) {
      parser = new SaxesParser();
      const worksheet = /^xl\/worksheets\/[^/]+\.xml$/i.test(entry.name);
      let rowCount = 0, cellText = 0, inText = false, maxRow = 0, maxColumn = 0, depth = 0;
      const checkRange = (r: number, c: number) => {
        totalArea -= maxRow * maxColumn;
        maxRow = Math.max(maxRow, r); maxColumn = Math.max(maxColumn, c);
        dimensions(maxRow, maxColumn);
        totalArea += maxRow * maxColumn;
        if (totalArea > LIMITS.cells) fail("Combined worksheet ranges exceed 250,000 cells.");
      };
      const checkAddress = (ref: string) => { const [r, c] = address(ref); checkRange(r, c); };
      parser.on("doctype", () => fail("XML document types and entities are unsupported in workbooks."));
      parser.on("error", () => fail("Malformed workbook XML."));
      parser.on("opentag", tag => {
        if (++depth > 128) fail("Workbook XML exceeds the 128-level nesting limit.");
        if (++xmlNodes > 2_000_000) fail("Workbook XML is too complex.");
        const name = tag.name.split(":").at(-1), attr = tag.attributes as Record<string, string>;
        if (name === "Relationship" && /externalLink|vbaProject|activeX|oleObject/i.test(attr.Type ?? "")) fail("Macro, embedded-object and external workbook links are unsupported.");
        if (name === "Override" && /macroEnabled|vbaProject/i.test(attr.ContentType ?? "")) fail("Macro-enabled workbooks are unsupported.");
        if (entry.name === "xl/workbook.xml" && name === "sheet" && ++sheetCount > LIMITS.sheets) fail("Workbooks are limited to 64 sheets.");
        if (name === "si" && ++sharedStrings > LIMITS.cells) fail("Too many shared strings in workbook.");
        if (worksheet) {
          if (name === "row") { rowCount++; checkRange(Number(attr.r ?? rowCount), maxColumn); if (rowCount > LIMITS.rows) fail("Too many workbook rows."); }
          if (name === "c") { if (++cells > LIMITS.cells) fail("Workbooks are limited to 250,000 cells in total."); if (attr.r) checkAddress(attr.r); cellText = 0; }
          if ((name === "dimension" || name === "mergeCell" || name === "autoFilter") && attr.ref) for (const ref of attr.ref.split(":")) checkAddress(ref);
          if (name === "col") checkRange(maxRow, Number(attr.max ?? attr.min));
        }
        if (name === "t" || name === "f") { inText = true; cellText = 0; }
      });
      parser.on("text", text => { if (inText && (cellText += text.length) > LIMITS.cellCharacters) fail("Cell text is limited to 32,767 characters."); });
      parser.on("closetag", tag => { depth--; if (["t", "f"].includes(tag.name.split(":").at(-1) ?? "")) inText = false; });
    }
    const consume = (chunk: Uint8Array, final: boolean) => {
      cancelled(signal);
      actual += chunk.byteLength; actualTotal += chunk.byteLength;
      if (actual > entry.size || actual > LIMITS.entryBytes || actualTotal > LIMITS.archiveBytes) fail("Actual decompressed ZIP size exceeds its declared or allowed limit.");
      for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      if (parser) parser.write(textDecoder.decode(chunk, { stream: !final }));
      if (final) {
        parser?.close();
        if (actual !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) fail("Corrupt ZIP entry: size or checksum does not match.");
      }
    };
    if (entry.method === 8) {
      const stream = new Inflate(consume);
      for (let p = 0; p < entry.compressed; p += 1024) stream.push(bytes.subarray(entry.start + p, entry.start + Math.min(p + 1024, entry.compressed)), p + 1024 >= entry.compressed);
      if (entry.compressed === 0) fail("Malformed deflated ZIP entry.");
    } else {
      for (let p = 0; p < entry.size; p += 1024) consume(bytes.subarray(entry.start + p, entry.start + Math.min(p + 1024, entry.size)), p + 1024 >= entry.size);
      if (!entry.size) consume(new Uint8Array(), true);
    }
  }
  if (!sheetCount) fail("Workbook has no worksheets.");
  cancelled(signal);
}
