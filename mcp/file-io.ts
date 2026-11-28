/**
 * Safe Local File I/O Helpers for Code Station MCP `node-file` tools.
 * Never transmits data over the network; enforces strict file size limits
 * and directory traversal (Zip Slip) protections.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const MAX_NODE_FILE_BYTES = 50 * 1024 * 1024; // 50 MiB per file
export const MAX_NODE_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MiB combined multi-file limit

export interface LoadedLocalFile {
  bytes: Uint8Array;
  name: string;
  path?: string;
  byteLength: number;
}

export interface WrittenLocalFile {
  outputPath: string;
  bytes: number;
  format: string;
  base64?: string;
}

function toArrayBufferSlice(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/**
 * Normalizes a filesystem-safe basename without directory traversal.
 */
export function sanitizeFilename(name: string, fallback = "output.bin"): string {
  const base = path.basename(name).replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, "_").trim();
  return base || fallback;
}

/**
 * Prevents Zip Slip / path traversal when resolving entry paths under `targetDir`.
 */
export function safeResolveWithinDir(targetDir: string, entryPath: string): string {
  if (!entryPath || entryPath.includes("\0")) {
    throw new Error(`Unsafe archive entry path: "${entryPath}".`);
  }
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => segment === "..")) {
    throw new Error(`Archive entry attempts directory traversal: "${entryPath}".`);
  }
  const resolvedRoot = path.resolve(targetDir);
  const resolvedTarget = path.resolve(resolvedRoot, normalized);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Archive entry escapes target directory: "${entryPath}".`);
  }
  return resolvedTarget;
}

/**
 * Validates and reads a single local file from `inputPath` or decodes `inputBase64`.
 */
export function readLocalFileInput(
  source: {
    inputPath?: unknown;
    inputBase64?: unknown;
    base64?: unknown;
    fallbackName?: string;
  },
  maxBytes = MAX_NODE_FILE_BYTES
): LoadedLocalFile {
  const rawPath = typeof source.inputPath === "string" ? source.inputPath.trim() : "";
  if (rawPath) {
    const resolved = path.resolve(rawPath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") throw new Error(`File not found: ${rawPath}`);
      if (code === "EACCES") throw new Error(`Permission denied reading file: ${rawPath}`);
      throw new Error(`Unable to access file "${rawPath}": ${err instanceof Error ? err.message : String(err)}`);
    }
    if (stat.isDirectory()) {
      throw new Error(`Expected a file path, but got a directory: ${rawPath}`);
    }
    if (!stat.isFile()) {
      throw new Error(`Path is not a regular file: ${rawPath}`);
    }
    if (stat.size === 0) {
      throw new Error(`Input file is empty (0 bytes): ${rawPath}`);
    }
    if (stat.size > maxBytes) {
      throw new Error(
        `File "${rawPath}" exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MiB size limit.`
      );
    }
    let buf: Buffer;
    try {
      buf = fs.readFileSync(resolved);
    } catch (err) {
      throw new Error(`Failed to read file "${rawPath}": ${err instanceof Error ? err.message : String(err)}`);
    }
    return {
      bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      name: path.basename(resolved),
      path: resolved,
      byteLength: buf.byteLength,
    };
  }

  const rawBase64 =
    typeof source.inputBase64 === "string"
      ? source.inputBase64
      : typeof source.base64 === "string"
        ? source.base64
        : "";
  if (rawBase64.trim()) {
    const cleaned = rawBase64.replace(/^data:[^;,]+;base64,/i, "").replace(/\s+/g, "");
    const buf = Buffer.from(cleaned, "base64");
    if (buf.byteLength === 0) {
      throw new Error("Base64 file payload is empty or invalid.");
    }
    if (buf.byteLength > maxBytes) {
      throw new Error(
        `Decoded payload exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MiB size limit.`
      );
    }
    return {
      bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      name: source.fallbackName || "input.bin",
      byteLength: buf.byteLength,
    };
  }

  throw new Error("Provide a local file via `inputPath` (or `inputBase64`).");
}

/**
 * Reads multiple local files from `inputPaths` while enforcing combined byte budgets.
 */
export function readMultipleLocalFiles(
  rawPaths: unknown,
  minCount = 1,
  maxTotalBytes = MAX_NODE_TOTAL_BYTES
): LoadedLocalFile[] {
  const pathList = Array.isArray(rawPaths)
    ? rawPaths.map((p) => String(p).trim()).filter(Boolean)
    : typeof rawPaths === "string"
      ? rawPaths.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

  if (pathList.length < minCount) {
    throw new Error(`Provide at least ${minCount} file path${minCount === 1 ? "" : "s"} in \`inputPaths\`.`);
  }

  const loaded: LoadedLocalFile[] = [];
  let total = 0;
  for (const filePath of pathList) {
    const file = readLocalFileInput({ inputPath: filePath });
    total += file.byteLength;
    if (total > maxTotalBytes) {
      throw new Error(
        `Combined input files exceed the ${(maxTotalBytes / (1024 * 1024)).toFixed(0)} MiB limit.`
      );
    }
    loaded.push(file);
  }
  return loaded;
}

/**
 * Writes binary bytes cleanly to `outputPath` or an isolated temp file inside `os.tmpdir()`.
 * Returns metadata rather than dumping raw binary into MCP text output.
 */
export function writeLocalOutputFile(
  bytes: Uint8Array,
  options: {
    outputPath?: unknown;
    defaultFilename: string;
    format: string;
    returnBase64?: boolean;
  }
): WrittenLocalFile {
  const rawOut = typeof options.outputPath === "string" ? options.outputPath.trim() : "";
  const targetPath = rawOut
    ? path.resolve(rawOut)
    : path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), "codestation-mcp-out-")),
        sanitizeFilename(options.defaultFilename, "output.bin")
      );

  const parentDir = path.dirname(targetPath);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(targetPath, bytes);

  return {
    outputPath: targetPath,
    bytes: bytes.byteLength,
    format: options.format,
    ...(options.returnBase64 ? { base64: Buffer.from(bytes).toString("base64") } : {}),
  };
}

/**
 * Creates a structural Web `File`-compatible wrapper around in-memory bytes so pure
 * browser/lib engines (such as Spreadsheet or Security hashers) run identically in Node.
 */
export function createNodeFileLike(
  bytes: Uint8Array,
  name: string,
  type = "application/octet-stream"
): File {
  const arrayBuf = toArrayBufferSlice(bytes);
  return {
    name,
    size: bytes.byteLength,
    type,
    lastModified: Date.now(),
    arrayBuffer: async () => arrayBuf.slice(0),
    text: async () => new TextDecoder("utf-8").decode(bytes),
    slice: (start?: number, end?: number) => new Blob([arrayBuf.slice(start, end)]),
    stream: () => new ReadableStream(),
  } as unknown as File;
}
