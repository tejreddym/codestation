/**
 * Client-Side Compression & Archive Processing Engine
 * Zero server uploads: operates 100% in browser memory using native
 * CompressionStream / DecompressionStream where available with fflate fallback.
 */

import * as fflate from "fflate";

export interface ZipFileEntry {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  data: Uint8Array;
  mtime?: Date;
}

export interface ZipTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  children: ZipTreeNode[];
  entry?: ZipFileEntry;
}

export interface ZipArchiveInspection {
  entries: ZipFileEntry[];
  tree: ZipTreeNode[];
  totalUncompressedSize: number;
  totalCompressedSize: number;
  fileCount: number;
  dirCount: number;
}

export interface TarEntry {
  name: string;
  mode: string;
  formattedMode: string;
  uid: number;
  gid: number;
  size: number;
  mtime: Date;
  typeflag: string;
  typeName: string;
  uname: string;
  gname: string;
  data: Uint8Array;
}

export interface TarArchiveInspection {
  isGzipped: boolean;
  entries: TarEntry[];
  totalSize: number;
  fileCount: number;
  dirCount: number;
}

export interface CompressionResult {
  data: Uint8Array;
  base64: string;
  originalSize: number;
  compressedSize: number;
  ratioPercent: number;
  engine: "CompressionStream" | "fflate";
  format: "gzip" | "deflate";
}

export interface DecompressionResult {
  data: Uint8Array;
  text?: string;
  isText: boolean;
  originalSize: number;
  decompressedSize: number;
  format: "gzip" | "deflate";
  engine: "DecompressionStream" | "fflate";
}

// ----------------- Utility Helpers -----------------

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isTextBuffer(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  // Inspect first 8KB
  const inspectLen = Math.min(bytes.length, 8192);
  let nullCount = 0;
  for (let i = 0; i < inspectLen; i++) {
    const b = bytes[i];
    if (b === 0) nullCount++;
    // Binary control chars outside standard whitespace
    if (b < 7 || (b > 13 && b < 27)) return false;
  }
  if (nullCount > 0) return false;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(bytes.subarray(0, inspectLen));
    return true;
  } catch {
    return false;
  }
}

export function isImageExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext || "");
}

export function isTextExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return [
    "txt", "json", "csv", "tsv", "md", "markdown", "js", "ts", "jsx", "tsx",
    "html", "htm", "css", "scss", "sass", "xml", "yaml", "yml", "sql", "sh",
    "bash", "py", "rs", "go", "java", "c", "cpp", "h", "hpp", "env", "toml",
    "ini", "conf", "log", "graphql", "dockerfile", "svg"
  ].includes(ext || "");
}

// ----------------- ZIP Inspection & Extraction -----------------

export function inspectZip(buffer: ArrayBuffer | Uint8Array): ZipArchiveInspection {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const unzipped = fflate.unzipSync(u8);
  const entries: ZipFileEntry[] = [];

  let totalUncompressedSize = 0;
  let fileCount = 0;
  let dirCount = 0;

  for (const [rawPath, data] of Object.entries(unzipped)) {
    const normalizedPath = rawPath.replace(/\\/g, "/");
    const isDir = normalizedPath.endsWith("/");
    const pathParts = normalizedPath.replace(/\/$/, "").split("/");
    const name = pathParts[pathParts.length - 1] || normalizedPath;
    const size = data.length;

    totalUncompressedSize += size;
    if (isDir) {
      dirCount++;
    } else {
      fileCount++;
    }

    entries.push({
      path: normalizedPath,
      name,
      size,
      isDirectory: isDir,
      data,
    });
  }

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.path.localeCompare(b.path);
  });

  const tree = buildZipTree(entries);

  return {
    entries,
    tree,
    totalUncompressedSize,
    totalCompressedSize: u8.length,
    fileCount,
    dirCount,
  };
}

export function buildZipTree(entries: ZipFileEntry[]): ZipTreeNode[] {
  const rootNodes: ZipTreeNode[] = [];
  const nodeMap = new Map<string, ZipTreeNode>();

  for (const entry of entries) {
    const parts = entry.path.replace(/\/$/, "").split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const partPath = currentPath ? `${currentPath}/${part}` : part;
      const isDir = !isLast || entry.isDirectory;

      if (!nodeMap.has(partPath)) {
        const newNode: ZipTreeNode = {
          name: part,
          path: partPath,
          isDirectory: isDir,
          size: isLast && !entry.isDirectory ? entry.size : 0,
          children: [],
          entry: isLast ? entry : undefined,
        };
        nodeMap.set(partPath, newNode);

        if (currentPath && nodeMap.has(currentPath)) {
          nodeMap.get(currentPath)!.children.push(newNode);
        } else {
          rootNodes.push(newNode);
        }
      } else if (isLast) {
        const existing = nodeMap.get(partPath)!;
        existing.entry = entry;
        existing.size = entry.size;
      }

      currentPath = partPath;
    }
  }

  // Sort children recursively
  function sortChildren(nodes: ZipTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
  }
  sortChildren(rootNodes);

  return rootNodes;
}

// ----------------- ZIP Archive Creator -----------------

export function createZip(
  files: Array<{ path: string; data: Uint8Array }>,
  compressionLevel = 6
): Uint8Array {
  const level = Math.min(Math.max(compressionLevel, 0), 9);
  const zipObj: fflate.AsyncZippable = {};

  for (const file of files) {
    const cleanPath = file.path.replace(/^\/+/, "");
    zipObj[cleanPath] = [file.data, { level: level as any }];
  }

  return fflate.zipSync(zipObj);
}

// ----------------- Gzip / Deflate Compressor -----------------

export async function compressGzip(
  input: Uint8Array | string,
  options: { level?: number; format?: "gzip" | "deflate" } = {}
): Promise<CompressionResult> {
  const format = options.format ?? "gzip";
  const level = options.level ?? 6;
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const originalSize = bytes.length;

  let compressedData: Uint8Array | null = null;
  let engine: "CompressionStream" | "fflate" = "fflate";

  // Attempt native CompressionStream if available
  if (typeof CompressionStream !== "undefined") {
    try {
      const cs = new CompressionStream(format);
      const writer = cs.writable.getWriter();
      writer.closed.catch(() => {});
      const writePromise = writer.write(bytes as any);
      writePromise.catch(() => {});
      await writePromise;
      const closePromise = writer.close();
      closePromise.catch(() => {});
      await closePromise;

      const reader = cs.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const out = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      compressedData = out;
      engine = "CompressionStream";
    } catch {
      // Fallback to fflate below
    }
  }

  // Fallback if CompressionStream failed or is not available
  if (!compressedData) {
    compressedData =
      format === "gzip"
        ? fflate.gzipSync(bytes, { level: level as any })
        : fflate.deflateSync(bytes, { level: level as any });
    engine = "fflate";
  }

  const compressedSize = compressedData.length;
  const ratioPercent = originalSize > 0
    ? Math.max(0, Number(((1 - compressedSize / originalSize) * 100).toFixed(1)))
    : 0;

  const base64 = uint8ArrayToBase64(compressedData);

  return {
    data: compressedData,
    base64,
    originalSize,
    compressedSize,
    ratioPercent,
    engine,
    format,
  };
}

// ----------------- Gzip / Deflate Decompressor -----------------

export async function decompressGzip(
  input: Uint8Array | string,
  options: { format?: "auto" | "gzip" | "deflate"; isBase64?: boolean } = {}
): Promise<DecompressionResult> {
  let bytes: Uint8Array;
  if (typeof input === "string" || options.isBase64) {
    bytes = base64ToUint8Array(typeof input === "string" ? input : "");
  } else {
    bytes = input;
  }

  const originalSize = bytes.length;
  let resolvedFormat: "gzip" | "deflate" = "gzip";

  if (options.format === "deflate") {
    resolvedFormat = "deflate";
  } else if (options.format === "gzip") {
    resolvedFormat = "gzip";
  } else {
    // Auto-detect format by checking magic bytes: GZIP starts with 0x1F, 0x8B
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      resolvedFormat = "gzip";
    } else {
      resolvedFormat = "deflate";
    }
  }

  let decompressedData: Uint8Array | null = null;
  let engine: "DecompressionStream" | "fflate" = "fflate";

  // Attempt native DecompressionStream if available
  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream(resolvedFormat);
      const writer = ds.writable.getWriter();
      writer.closed.catch(() => {});
      const writePromise = writer.write(bytes as any);
      writePromise.catch(() => {});
      await writePromise;
      const closePromise = writer.close();
      closePromise.catch(() => {});
      await closePromise;

      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const out = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      decompressedData = out;
      engine = "DecompressionStream";
    } catch {
      // Fallback to fflate
    }
  }

  // Fallback to fflate
  if (!decompressedData) {
    try {
      decompressedData =
        resolvedFormat === "gzip" ? fflate.gunzipSync(bytes) : fflate.inflateSync(bytes);
      engine = "fflate";
    } catch (err) {
      // If auto-detection or format failed, attempt the other format before throwing
      if (options.format === "auto" || !options.format) {
        try {
          const alternate = resolvedFormat === "gzip" ? "deflate" : "gzip";
          decompressedData =
            alternate === "gzip" ? fflate.gunzipSync(bytes) : fflate.inflateSync(bytes);
          resolvedFormat = alternate;
          engine = "fflate";
        } catch {
          throw new Error(
            "Failed to decompress archive. The input data is neither valid Gzip nor Deflate."
          );
        }
      } else {
        throw new Error(
          `Failed to decompress as ${resolvedFormat}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  const isText = isTextBuffer(decompressedData);
  let text: string | undefined;
  if (isText) {
    try {
      text = new TextDecoder("utf-8").decode(decompressedData);
    } catch {
      // Ignore if text decoding fails
    }
  }

  return {
    data: decompressedData,
    text,
    isText,
    originalSize,
    decompressedSize: decompressedData.length,
    format: resolvedFormat,
    engine,
  };
}

// ----------------- TAR / TAR.GZ Inspector -----------------

function formatTarMode(modeOctal: number, isDir: boolean): string {
  const m = modeOctal & 0o777;
  const chars = [
    isDir ? "d" : "-",
    m & 0o400 ? "r" : "-",
    m & 0o200 ? "w" : "-",
    m & 0o100 ? "x" : "-",
    m & 0o040 ? "r" : "-",
    m & 0o020 ? "w" : "-",
    m & 0o010 ? "x" : "-",
    m & 0o004 ? "r" : "-",
    m & 0o002 ? "w" : "-",
    m & 0o001 ? "x" : "-",
  ];
  return chars.join("");
}

function getTarTypeName(typeflag: string): string {
  switch (typeflag) {
    case "0":
    case "\0":
      return "Normal File";
    case "1":
      return "Hard Link";
    case "2":
      return "Symbolic Link";
    case "3":
      return "Character Device";
    case "4":
      return "Block Device";
    case "5":
      return "Directory";
    case "6":
      return "FIFO (Named Pipe)";
    case "7":
      return "Contiguous File";
    default:
      return "Special Entry";
  }
}

export function parseTar(buffer: ArrayBuffer | Uint8Array): TarArchiveInspection {
  let bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let isGzipped = false;

  // Check if gzip-compressed (.tar.gz or .tgz)
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    isGzipped = true;
    try {
      bytes = fflate.gunzipSync(bytes);
    } catch (err) {
      throw new Error(`Failed to decompress .tar.gz archive: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const entries: TarEntry[] = [];
  let offset = 0;
  const decoder = new TextDecoder("utf-8");

  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;
  let nextLongName: string | null = null;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);

    // End of archive marker: 512 zero bytes
    let isZero = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        isZero = false;
        break;
      }
    }
    if (isZero) break;

    // Read name (0..99)
    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    let name = decoder.decode(header.subarray(0, nameEnd)).trim();

    // Mode (100..107)
    let modeEnd = 100;
    while (modeEnd < 108 && header[modeEnd] !== 0) modeEnd++;
    const modeStr = decoder.decode(header.subarray(100, modeEnd)).trim();
    const modeOctal = parseInt(modeStr, 8) || 0o644;

    // UID (108..115) & GID (116..123)
    const uidStr = decoder.decode(header.subarray(108, 116)).replace(/\0.*$/, "").trim();
    const gidStr = decoder.decode(header.subarray(116, 124)).replace(/\0.*$/, "").trim();
    const uid = parseInt(uidStr, 8) || 0;
    const gid = parseInt(gidStr, 8) || 0;

    // Size (124..135)
    let sizeEnd = 124;
    while (sizeEnd < 136 && header[sizeEnd] !== 0) sizeEnd++;
    const sizeStr = decoder.decode(header.subarray(124, sizeEnd)).trim();
    const size = parseInt(sizeStr, 8) || 0;

    // Mtime (136..147)
    let mtimeEnd = 136;
    while (mtimeEnd < 148 && header[mtimeEnd] !== 0) mtimeEnd++;
    const mtimeStr = decoder.decode(header.subarray(136, mtimeEnd)).trim();
    const mtimeSec = parseInt(mtimeStr, 8) || 0;
    const mtime = new Date(mtimeSec * 1000);

    // Typeflag (156)
    const typeflag = String.fromCharCode(header[156] || 48);

    // UStar prefix check (bytes 345..499)
    const magic = decoder.decode(header.subarray(257, 263)).trim();
    let uname = "";
    let gname = "";
    if (magic.startsWith("ustar")) {
      uname = decoder.decode(header.subarray(265, 297)).replace(/\0.*$/, "").trim();
      gname = decoder.decode(header.subarray(297, 329)).replace(/\0.*$/, "").trim();
      let prefixEnd = 345;
      while (prefixEnd < 500 && header[prefixEnd] !== 0) prefixEnd++;
      const prefix = decoder.decode(header.subarray(345, prefixEnd)).trim();
      if (prefix && !nextLongName) {
        name = `${prefix}/${name}`;
      }
    }

    offset += 512;
    const data = bytes.subarray(offset, offset + size);
    const pad = (512 - (size % 512)) % 512;
    offset += size + pad;

    // Handle GNU LongLink / LongName (typeflag 'L')
    if (typeflag === "L") {
      nextLongName = decoder.decode(data).replace(/\0.*$/, "").trim();
      continue;
    }

    if (nextLongName) {
      name = nextLongName;
      nextLongName = null;
    }

    const isDir = typeflag === "5" || name.endsWith("/");
    const formattedMode = formatTarMode(modeOctal, isDir);
    const typeName = getTarTypeName(typeflag);

    if (isDir) {
      dirCount++;
    } else {
      fileCount++;
      totalSize += size;
    }

    entries.push({
      name,
      mode: `0${modeOctal.toString(8)}`,
      formattedMode,
      uid,
      gid,
      size,
      mtime,
      typeflag,
      typeName,
      uname,
      gname,
      data,
    });
  }

  return {
    isGzipped,
    entries,
    totalSize,
    fileCount,
    dirCount,
  };
}

export function tarEntriesToZip(entries: TarEntry[]): Uint8Array {
  const zipObj: fflate.AsyncZippable = {};
  for (const entry of entries) {
    if (entry.typeflag !== "5" && !entry.name.endsWith("/")) {
      zipObj[entry.name] = [entry.data, { level: 6 }];
    }
  }
  return fflate.zipSync(zipObj);
}
