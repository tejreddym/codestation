"use client";

import { useState, useRef } from "react";
import {
  getCompressionDefinition,
  type CompressionToolId,
} from "@/config/compression-tools";
import {
  inspectZip,
  createZip,
  compressGzip,
  decompressGzip,
  parseTar,
  tarEntriesToZip,
  formatBytes,
  uint8ArrayToBase64,
  isTextBuffer,
  isImageExtension,
  isTextExtension,
  type ZipFileEntry,
  type ZipArchiveInspection,
  type TarEntry,
  type TarArchiveInspection,
  type CompressionResult,
  type DecompressionResult,
} from "@/lib/tools/compression/engine";
import styles from "./CompressionStation.module.css";

function downloadBlob(data: Uint8Array, filename: string, mime = "application/octet-stream") {
  const blob = new Blob([data as unknown as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CompressionStation({ toolId }: { toolId: CompressionToolId }) {
  const definition = getCompressionDefinition(toolId)!;

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1. ZIP Extractor State
  const [zipInspection, setZipInspection] = useState<ZipArchiveInspection | null>(null);
  const [selectedZipEntry, setSelectedZipEntry] = useState<ZipFileEntry | null>(null);
  const [zipFilter, setZipFilter] = useState("");
  const [zipPreviewText, setZipPreviewText] = useState<string | null>(null);
  const [zipPreviewImageUrl, setZipPreviewImageUrl] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // 2. ZIP Creator State
  const [queuedFiles, setQueuedFiles] = useState<Array<{ path: string; file: File }>>([]);
  const [zipLevel, setZipLevel] = useState<number>(6);
  const [archiveFilename, setArchiveFilename] = useState("archive.zip");
  const [creatorResult, setCreatorResult] = useState<{
    fileCount: number;
    originalSize: number;
    compressedSize: number;
    ratio: number;
    timeMs: number;
  } | null>(null);
  const creatorInputRef = useRef<HTMLInputElement>(null);

  // 3. Gzip / Deflate Compressor State
  const [compressMode, setCompressMode] = useState<"text" | "file">("text");
  const [compressTextInput, setCompressTextInput] = useState("");
  const [compressFile, setCompressFile] = useState<File | null>(null);
  const [compressFormat, setCompressFormat] = useState<"gzip" | "deflate">("gzip");
  const [compressLevel, setCompressLevel] = useState<number>(6);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const compressFileInputRef = useRef<HTMLInputElement>(null);

  // 4. Gzip / Deflate Decompressor State
  const [decompressMode, setDecompressMode] = useState<"file" | "base64">("file");
  const [decompressBase64Input, setDecompressBase64Input] = useState("");
  const [decompressFile, setDecompressFile] = useState<File | null>(null);
  const [decompressFormat, setDecompressFormat] = useState<"auto" | "gzip" | "deflate">("auto");
  const [decompressionResult, setDecompressionResult] = useState<DecompressionResult | null>(null);
  const decompressFileInputRef = useRef<HTMLInputElement>(null);

  // 5. TAR / TAR.GZ Inspector State
  const [tarInspection, setTarInspection] = useState<TarArchiveInspection | null>(null);
  const [selectedTarEntry, setSelectedTarEntry] = useState<TarEntry | null>(null);
  const [tarFilter, setTarFilter] = useState("");
  const [tarPreviewText, setTarPreviewText] = useState<string | null>(null);
  const [tarPreviewImageUrl, setTarPreviewImageUrl] = useState<string | null>(null);
  const [tarOriginalFilename, setTarOriginalFilename] = useState("archive.tar");
  const tarInputRef = useRef<HTMLInputElement>(null);

  // Copy helper
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // --- Handlers for ZIP Extractor ---
  async function handleZipFileUpload(file: File) {
    setError(null);
    setSelectedZipEntry(null);
    setZipPreviewText(null);
    setZipPreviewImageUrl(null);
    setBusy(true);

    try {
      const buffer = await file.arrayBuffer();
      const inspection = inspectZip(buffer);
      setZipInspection(inspection);
      if (inspection.entries.length > 0) {
        handleSelectZipEntry(inspection.entries[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open ZIP archive.");
      setZipInspection(null);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectZipEntry(entry: ZipFileEntry) {
    setSelectedZipEntry(entry);
    setZipPreviewText(null);
    setZipPreviewImageUrl(null);

    if (entry.isDirectory || entry.size === 0) return;

    if (isImageExtension(entry.name)) {
      const blob = new Blob([entry.data as unknown as BlobPart]);
      const url = URL.createObjectURL(blob);
      setZipPreviewImageUrl(url);
    } else if (isTextExtension(entry.name) || isTextBuffer(entry.data)) {
      try {
        const text = new TextDecoder("utf-8").decode(entry.data);
        setZipPreviewText(text);
      } catch {
        setZipPreviewText(null);
      }
    }
  }

  function handleDownloadZipEntry(entry: ZipFileEntry) {
    downloadBlob(entry.data, entry.name);
  }

  function handleDownloadAllZip() {
    if (!zipInspection) return;
    const files = zipInspection.entries
      .filter((e) => !e.isDirectory)
      .map((e) => ({ path: e.path, data: e.data }));
    const cleanZip = createZip(files, 6);
    downloadBlob(cleanZip, "extracted_archive.zip", "application/zip");
  }

  // --- Handlers for ZIP Creator ---
  function handleQueueFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setCreatorResult(null);

    const newFiles: Array<{ path: string; file: File }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const relPath = (f as any).webkitRelativePath || f.name;
      newFiles.push({ path: relPath, file: f });
    }
    setQueuedFiles((prev) => [...prev, ...newFiles]);
  }

  function handleRemoveQueuedFile(index: number) {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateZip() {
    if (queuedFiles.length === 0) return;
    setError(null);
    setCreatorResult(null);
    setBusy(true);

    const start = performance.now();
    try {
      const preparedFiles: Array<{ path: string; data: Uint8Array }> = [];
      let totalRaw = 0;

      for (const item of queuedFiles) {
        const buf = await item.file.arrayBuffer();
        const data = new Uint8Array(buf);
        preparedFiles.push({ path: item.path, data });
        totalRaw += data.length;
      }

      const zipBytes = createZip(preparedFiles, zipLevel);
      const elapsed = Math.round(performance.now() - start);

      const ratio = totalRaw > 0
        ? Math.max(0, Number(((1 - zipBytes.length / totalRaw) * 100).toFixed(1)))
        : 0;

      setCreatorResult({
        fileCount: queuedFiles.length,
        originalSize: totalRaw,
        compressedSize: zipBytes.length,
        ratio,
        timeMs: elapsed,
      });

      downloadBlob(zipBytes, archiveFilename || "archive.zip", "application/zip");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ZIP archive.");
    } finally {
      setBusy(false);
    }
  }

  // --- Handlers for Gzip / Deflate Compressor ---
  async function handleCompress() {
    setError(null);
    setCompressionResult(null);
    setBusy(true);

    try {
      let inputData: Uint8Array | string;
      if (compressMode === "text") {
        if (!compressTextInput) throw new Error("Please enter text to compress.");
        inputData = compressTextInput;
      } else {
        if (!compressFile) throw new Error("Please select a file to compress.");
        const buf = await compressFile.arrayBuffer();
        inputData = new Uint8Array(buf);
      }

      const res = await compressGzip(inputData, {
        format: compressFormat,
        level: compressLevel,
      });
      setCompressionResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compression failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadCompressed() {
    if (!compressionResult) return;
    const ext = compressionResult.format === "gzip" ? "gz" : "zz";
    const filename = compressFile
      ? `${compressFile.name}.${ext}`
      : `compressed.${ext}`;
    downloadBlob(compressionResult.data, filename, "application/gzip");
  }

  // --- Handlers for Gzip / Deflate Decompressor ---
  async function handleDecompress() {
    setError(null);
    setDecompressionResult(null);
    setBusy(true);

    try {
      let inputData: Uint8Array | string;
      let isBase64 = false;

      if (decompressMode === "base64") {
        if (!decompressBase64Input.trim()) {
          throw new Error("Please enter Base64 compressed data.");
        }
        inputData = decompressBase64Input.trim();
        isBase64 = true;
      } else {
        if (!decompressFile) throw new Error("Please select a compressed file.");
        const buf = await decompressFile.arrayBuffer();
        inputData = new Uint8Array(buf);
      }

      const res = await decompressGzip(inputData, {
        format: decompressFormat,
        isBase64,
      });
      setDecompressionResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decompression failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadDecompressed() {
    if (!decompressionResult) return;
    let filename = "decompressed.bin";
    if (decompressFile) {
      filename = decompressFile.name.replace(/\.(gz|zz|tgz|tar\.gz)$/i, "") || "decompressed";
    }
    if (decompressionResult.isText && !filename.includes(".")) {
      filename += ".txt";
    }
    downloadBlob(
      decompressionResult.data,
      filename,
      decompressionResult.isText ? "text/plain;charset=utf-8" : "application/octet-stream"
    );
  }

  // --- Handlers for TAR Inspector ---
  async function handleTarFileUpload(file: File) {
    setError(null);
    setSelectedTarEntry(null);
    setTarPreviewText(null);
    setTarPreviewImageUrl(null);
    setTarOriginalFilename(file.name);
    setBusy(true);

    try {
      const buffer = await file.arrayBuffer();
      const inspection = parseTar(buffer);
      setTarInspection(inspection);
      if (inspection.entries.length > 0) {
        handleSelectTarEntry(inspection.entries[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open TAR archive.");
      setTarInspection(null);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectTarEntry(entry: TarEntry) {
    setSelectedTarEntry(entry);
    setTarPreviewText(null);
    setTarPreviewImageUrl(null);

    if (entry.typeflag === "5" || entry.size === 0) return;

    if (isImageExtension(entry.name)) {
      const blob = new Blob([entry.data as unknown as BlobPart]);
      const url = URL.createObjectURL(blob);
      setTarPreviewImageUrl(url);
    } else if (isTextExtension(entry.name) || isTextBuffer(entry.data)) {
      try {
        const text = new TextDecoder("utf-8").decode(entry.data);
        setTarPreviewText(text);
      } catch {
        setTarPreviewText(null);
      }
    }
  }

  function handleDownloadTarEntry(entry: TarEntry) {
    const filename = entry.name.split("/").pop() || "extracted_file";
    downloadBlob(entry.data, filename);
  }

  function handleExportTarAsZip() {
    if (!tarInspection) return;
    const zipBytes = tarEntriesToZip(tarInspection.entries);
    const zipName = tarOriginalFilename.replace(/\.(tar|tar\.gz|tgz)$/i, "") + ".zip";
    downloadBlob(zipBytes, zipName || "archive.zip", "application/zip");
  }

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h2>{definition.name}</h2>
          <p>{definition.description}</p>
        </div>

        <div className={styles.body}>
          {/* ============================================================== */}
          {/* TOOL 1: ZIP EXTRACTOR & VIEWER */}
          {/* ============================================================== */}
          {toolId === "zip-extractor" && (
            <div className={styles.formGrid}>
              <div
                className={styles.dropzone}
                onClick={() => zipInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleZipFileUpload(e.dataTransfer.files[0]);
                }}
              >
                <div className={styles.dropzoneText}>
                  {zipInspection
                    ? "✓ Archive loaded — Click or drag to replace"
                    : "Drop a .zip file here, or click to browse"}
                </div>
                <div className={styles.dropzoneSub}>
                  Zero uploads. Analyzed 100% in-browser memory.
                </div>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className={styles.fileInput}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleZipFileUpload(e.target.files[0]);
                  }}
                />
              </div>

              {zipInspection && (
                <>
                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Files</div>
                      <div className={styles.statValue}>{zipInspection.fileCount}</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Folders</div>
                      <div className={styles.statValue}>{zipInspection.dirCount}</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Unpacked Size</div>
                      <div className={styles.statValue}>
                        {formatBytes(zipInspection.totalUncompressedSize)}
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Archive Size</div>
                      <div className={styles.statValue}>
                        {formatBytes(zipInspection.totalCompressedSize)}
                      </div>
                    </div>
                  </div>

                  <div className={styles.row}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Filter files in archive..."
                      value={zipFilter}
                      onChange={(e) => setZipFilter(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={handleDownloadAllZip}
                    >
                      📦 Download All as ZIP
                    </button>
                  </div>

                  {/* File List */}
                  <div className={styles.treeContainer}>
                    {zipInspection.entries
                      .filter((e) =>
                        zipFilter ? e.path.toLowerCase().includes(zipFilter.toLowerCase()) : true
                      )
                      .map((entry) => {
                        const isSelected = selectedZipEntry?.path === entry.path;
                        return (
                          <div
                            key={entry.path}
                            className={`${styles.treeItem} ${isSelected ? styles.treeItemSelected : ""}`}
                            onClick={() => handleSelectZipEntry(entry)}
                          >
                            <div className={styles.treeLabel}>
                              <span>{entry.isDirectory ? "📁" : "📄"}</span>
                              <span>{entry.path}</span>
                            </div>
                            <div className={styles.treeSize}>
                              {entry.isDirectory ? "folder" : formatBytes(entry.size)}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Selected File Preview */}
                  {selectedZipEntry && !selectedZipEntry.isDirectory && (
                    <div className={styles.previewCard}>
                      <div className={styles.previewHeader}>
                        <span className={styles.previewTitle}>
                          {selectedZipEntry.name} ({formatBytes(selectedZipEntry.size)})
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {zipPreviewText !== null && (
                            <button
                              type="button"
                              className={styles.secondaryBtn}
                              onClick={() => copyToClipboard(zipPreviewText)}
                            >
                              {copied ? "✓ Copied" : "Copy Content"}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={() => handleDownloadZipEntry(selectedZipEntry)}
                          >
                            Download File
                          </button>
                        </div>
                      </div>

                      <div className={styles.previewBody}>
                        {zipPreviewImageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={zipPreviewImageUrl}
                            alt={selectedZipEntry.name}
                            className={styles.imagePreview}
                          />
                        )}
                        {zipPreviewText !== null && (
                          <pre className={styles.codePreview}>{zipPreviewText}</pre>
                        )}
                        {!zipPreviewImageUrl && zipPreviewText === null && (
                          <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                            Binary file. Click &quot;Download File&quot; to extract to your device.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TOOL 2: ZIP ARCHIVE CREATOR */}
          {/* ============================================================== */}
          {toolId === "zip-creator" && (
            <div className={styles.formGrid}>
              <div
                className={styles.dropzone}
                onClick={() => creatorInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) handleQueueFiles(e.dataTransfer.files);
                }}
              >
                <div className={styles.dropzoneText}>
                  Drop files to compress, or click to choose
                </div>
                <div className={styles.dropzoneSub}>
                  Add one or more files to assemble into a compressed .zip archive.
                </div>
                <input
                  ref={creatorInputRef}
                  type="file"
                  multiple
                  className={styles.fileInput}
                  onChange={(e) => handleQueueFiles(e.target.files)}
                />
              </div>

              {queuedFiles.length > 0 && (
                <>
                  <div className={styles.row}>
                    <div className={styles.field} style={{ flex: 1 }}>
                      <label className={styles.label}>Archive Name</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={archiveFilename}
                        onChange={(e) => setArchiveFilename(e.target.value)}
                        placeholder="archive.zip"
                      />
                    </div>
                    <div className={styles.field} style={{ width: "220px" }}>
                      <label className={styles.label}>Compression Level (0-9)</label>
                      <select
                        className={styles.select}
                        value={zipLevel}
                        onChange={(e) => setZipLevel(Number(e.target.value))}
                      >
                        <option value={0}>0 - Store (Fastest / No compression)</option>
                        <option value={1}>1 - Fast Compression</option>
                        <option value={6}>6 - Balanced (Standard)</option>
                        <option value={9}>9 - Maximum Compression</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <label className={styles.label}>
                        Queued Files ({queuedFiles.length} files,{" "}
                        {formatBytes(queuedFiles.reduce((acc, f) => acc + f.file.size, 0))})
                      </label>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={() => setQueuedFiles([])}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className={styles.queueList}>
                      {queuedFiles.map((item, index) => (
                        <div key={index} className={styles.queueItem}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            📄 {item.path} ({formatBytes(item.file.size)})
                          </span>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => handleRemoveQueuedFile(index)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleCreateZip}
                      disabled={busy}
                    >
                      {busy ? "Packing..." : "📦 Create & Download ZIP"}
                    </button>
                  </div>

                  {creatorResult && (
                    <div className={styles.resultBox}>
                      <div className={styles.successTitle}>✓ Archive Generated Successfully!</div>
                      <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                          <div className={styles.statLabel}>Raw Size</div>
                          <div className={styles.statValue}>
                            {formatBytes(creatorResult.originalSize)}
                          </div>
                        </div>
                        <div className={styles.statItem}>
                          <div className={styles.statLabel}>ZIP Size</div>
                          <div className={styles.statValue}>
                            {formatBytes(creatorResult.compressedSize)}
                          </div>
                        </div>
                        <div className={styles.statItem}>
                          <div className={styles.statLabel}>Space Saved</div>
                          <div className={styles.statValue}>{creatorResult.ratio}%</div>
                        </div>
                        <div className={styles.statItem}>
                          <div className={styles.statLabel}>Duration</div>
                          <div className={styles.statValue}>{creatorResult.timeMs} ms</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TOOL 3: GZIP / DEFLATE COMPRESSOR */}
          {/* ============================================================== */}
          {toolId === "gzip-compressor" && (
            <div className={styles.formGrid}>
              <div className={styles.tabGroup}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${compressMode === "text" ? styles.tabBtnActive : ""}`}
                  onClick={() => setCompressMode("text")}
                >
                  Raw Text Input
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${compressMode === "file" ? styles.tabBtnActive : ""}`}
                  onClick={() => setCompressMode("file")}
                >
                  Binary File Upload
                </button>
              </div>

              {compressMode === "text" ? (
                <div className={styles.field}>
                  <label className={styles.label}>Text to compress</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Enter or paste text to compress..."
                    value={compressTextInput}
                    onChange={(e) => setCompressTextInput(e.target.value)}
                  />
                </div>
              ) : (
                <div
                  className={styles.dropzone}
                  onClick={() => compressFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) setCompressFile(e.dataTransfer.files[0]);
                  }}
                >
                  <div className={styles.dropzoneText}>
                    {compressFile
                      ? `✓ ${compressFile.name} (${formatBytes(compressFile.size)})`
                      : "Choose or drop a file to compress"}
                  </div>
                  <input
                    ref={compressFileInputRef}
                    type="file"
                    className={styles.fileInput}
                    onChange={(e) => {
                      if (e.target.files?.[0]) setCompressFile(e.target.files[0]);
                    }}
                  />
                </div>
              )}

              <div className={styles.row}>
                <div className={styles.field} style={{ width: "200px" }}>
                  <label className={styles.label}>Format</label>
                  <select
                    className={styles.select}
                    value={compressFormat}
                    onChange={(e) => setCompressFormat(e.target.value as "gzip" | "deflate")}
                  >
                    <option value="gzip">Gzip (.gz)</option>
                    <option value="deflate">Deflate / zlib (.zz)</option>
                  </select>
                </div>
                <div className={styles.field} style={{ width: "200px" }}>
                  <label className={styles.label}>Compression Level</label>
                  <select
                    className={styles.select}
                    value={compressLevel}
                    onChange={(e) => setCompressLevel(Number(e.target.value))}
                  >
                    <option value={1}>1 - Fast</option>
                    <option value={6}>6 - Balanced</option>
                    <option value={9}>9 - Maximum</option>
                  </select>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleCompress}
                  disabled={busy || (compressMode === "text" ? !compressTextInput : !compressFile)}
                >
                  {busy ? "Compressing..." : `Compress with ${compressFormat.toUpperCase()}`}
                </button>
              </div>

              {compressionResult && (
                <div className={styles.resultBox}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div className={styles.successTitle}>✓ Compression Complete</div>
                    <span className={`${styles.badge} ${styles.badgeAccent}`}>
                      Engine: {compressionResult.engine}
                    </span>
                  </div>

                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Original</div>
                      <div className={styles.statValue}>
                        {formatBytes(compressionResult.originalSize)}
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Compressed</div>
                      <div className={styles.statValue}>
                        {formatBytes(compressionResult.compressedSize)}
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Ratio Saved</div>
                      <div className={styles.statValue}>{compressionResult.ratioPercent}%</div>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <label className={styles.label}>Base64 Compressed String</label>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => copyToClipboard(compressionResult.base64)}
                      >
                        {copied ? "✓ Copied" : "Copy Base64"}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      className={styles.textarea}
                      style={{ height: "90px" }}
                      value={compressionResult.base64}
                    />
                  </div>

                  <div className={styles.actions} style={{ marginTop: "16px" }}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleDownloadCompressed}
                    >
                      Download Compressed File (.{compressionResult.format === "gzip" ? "gz" : "zz"})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TOOL 4: GZIP / DEFLATE DECOMPRESSOR */}
          {/* ============================================================== */}
          {toolId === "gzip-decompressor" && (
            <div className={styles.formGrid}>
              <div className={styles.tabGroup}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${decompressMode === "file" ? styles.tabBtnActive : ""}`}
                  onClick={() => setDecompressMode("file")}
                >
                  Compressed File (.gz / .zz)
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${decompressMode === "base64" ? styles.tabBtnActive : ""}`}
                  onClick={() => setDecompressMode("base64")}
                >
                  Base64 String Input
                </button>
              </div>

              {decompressMode === "file" ? (
                <div
                  className={styles.dropzone}
                  onClick={() => decompressFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) setDecompressFile(e.dataTransfer.files[0]);
                  }}
                >
                  <div className={styles.dropzoneText}>
                    {decompressFile
                      ? `✓ ${decompressFile.name} (${formatBytes(decompressFile.size)})`
                      : "Drop a .gz, .zz, or compressed file here"}
                  </div>
                  <input
                    ref={decompressFileInputRef}
                    type="file"
                    className={styles.fileInput}
                    onChange={(e) => {
                      if (e.target.files?.[0]) setDecompressFile(e.target.files[0]);
                    }}
                  />
                </div>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label}>Paste Base64 encoded compressed data</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="e.g. H4sICAAAAAAA/..."
                    value={decompressBase64Input}
                    onChange={(e) => setDecompressBase64Input(e.target.value)}
                  />
                </div>
              )}

              <div className={styles.row}>
                <div className={styles.field} style={{ width: "220px" }}>
                  <label className={styles.label}>Decompression Algorithm</label>
                  <select
                    className={styles.select}
                    value={decompressFormat}
                    onChange={(e) =>
                      setDecompressFormat(e.target.value as "auto" | "gzip" | "deflate")
                    }
                  >
                    <option value="auto">Auto-Detect Format</option>
                    <option value="gzip">Force Gzip</option>
                    <option value="deflate">Force Deflate</option>
                  </select>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleDecompress}
                  disabled={
                    busy ||
                    (decompressMode === "file" ? !decompressFile : !decompressBase64Input.trim())
                  }
                >
                  {busy ? "Decompressing..." : "Decompress Archive"}
                </button>
              </div>

              {decompressionResult && (
                <div className={styles.resultBox}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div className={styles.successTitle}>✓ Decompressed Successfully</div>
                    <span className={`${styles.badge} ${styles.badgeAccent}`}>
                      {decompressionResult.format.toUpperCase()} · {decompressionResult.engine}
                    </span>
                  </div>

                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Compressed</div>
                      <div className={styles.statValue}>
                        {formatBytes(decompressionResult.originalSize)}
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Unpacked</div>
                      <div className={styles.statValue}>
                        {formatBytes(decompressionResult.decompressedSize)}
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Type</div>
                      <div className={styles.statValue}>
                        {decompressionResult.isText ? "UTF-8 Text" : "Binary"}
                      </div>
                    </div>
                  </div>

                  {decompressionResult.isText && decompressionResult.text ? (
                    <div className={styles.field}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <label className={styles.label}>Decompressed Text Content</label>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => copyToClipboard(decompressionResult.text || "")}
                        >
                          {copied ? "✓ Copied" : "Copy Text"}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        className={styles.textarea}
                        value={decompressionResult.text}
                      />
                    </div>
                  ) : (
                    <p style={{ margin: "12px 0", color: "var(--secondary)", fontSize: "13.5px" }}>
                      Decompressed binary data ({formatBytes(decompressionResult.decompressedSize)}).
                      Click below to download.
                    </p>
                  )}

                  <div className={styles.actions} style={{ marginTop: "16px" }}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleDownloadDecompressed}
                    >
                      Download Decompressed File
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TOOL 5: TAR / TAR.GZ INSPECTOR */}
          {/* ============================================================== */}
          {toolId === "tar-inspector" && (
            <div className={styles.formGrid}>
              <div
                className={styles.dropzone}
                onClick={() => tarInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleTarFileUpload(e.dataTransfer.files[0]);
                }}
              >
                <div className={styles.dropzoneText}>
                  {tarInspection
                    ? "✓ TAR Archive Loaded — Click or drop to replace"
                    : "Drop a .tar, .tar.gz, or .tgz archive here"}
                </div>
                <div className={styles.dropzoneSub}>
                  Pure browser-memory extraction. Supports standard POSIX and GNU TAR headers.
                </div>
                <input
                  ref={tarInputRef}
                  type="file"
                  accept=".tar,.tar.gz,.tgz,application/x-tar,application/gzip"
                  className={styles.fileInput}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleTarFileUpload(e.target.files[0]);
                  }}
                />
              </div>

              {tarInspection && (
                <>
                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Format</div>
                      <div className={styles.statValue}>
                        {tarInspection.isGzipped ? "TAR.GZ / TGZ" : "POSIX TAR"}
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Total Files</div>
                      <div className={styles.statValue}>{tarInspection.fileCount}</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Folders</div>
                      <div className={styles.statValue}>{tarInspection.dirCount}</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statLabel}>Unpacked Total</div>
                      <div className={styles.statValue}>{formatBytes(tarInspection.totalSize)}</div>
                    </div>
                  </div>

                  <div className={styles.row}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Filter files in TAR..."
                      value={tarFilter}
                      onChange={(e) => setTarFilter(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={handleExportTarAsZip}
                    >
                      📦 Export All as ZIP
                    </button>
                  </div>

                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>File Path</th>
                          <th>Permissions</th>
                          <th>Size</th>
                          <th>Type</th>
                          <th>Modified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tarInspection.entries
                          .filter((e) =>
                            tarFilter
                              ? e.name.toLowerCase().includes(tarFilter.toLowerCase())
                              : true
                          )
                          .map((entry) => {
                            const isSelected = selectedTarEntry?.name === entry.name;
                            return (
                              <tr
                                key={entry.name}
                                className={isSelected ? styles.tableRowSelected : ""}
                                onClick={() => handleSelectTarEntry(entry)}
                                style={{ cursor: "pointer" }}
                              >
                                <td>
                                  {entry.typeflag === "5" ? "📁" : "📄"} {entry.name}
                                </td>
                                <td>
                                  <code>{entry.formattedMode}</code>
                                </td>
                                <td>{formatBytes(entry.size)}</td>
                                <td>{entry.typeName}</td>
                                <td>{entry.mtime.toLocaleDateString()}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Selected TAR Entry Preview */}
                  {selectedTarEntry && selectedTarEntry.typeflag !== "5" && (
                    <div className={styles.previewCard}>
                      <div className={styles.previewHeader}>
                        <span className={styles.previewTitle}>
                          {selectedTarEntry.name} ({formatBytes(selectedTarEntry.size)})
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {tarPreviewText !== null && (
                            <button
                              type="button"
                              className={styles.secondaryBtn}
                              onClick={() => copyToClipboard(tarPreviewText)}
                            >
                              {copied ? "✓ Copied" : "Copy Content"}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={() => handleDownloadTarEntry(selectedTarEntry)}
                          >
                            Download File
                          </button>
                        </div>
                      </div>

                      <div className={styles.previewBody}>
                        {tarPreviewImageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={tarPreviewImageUrl}
                            alt={selectedTarEntry.name}
                            className={styles.imagePreview}
                          />
                        )}
                        {tarPreviewText !== null && (
                          <pre className={styles.codePreview}>{tarPreviewText}</pre>
                        )}
                        {!tarPreviewImageUrl && tarPreviewText === null && (
                          <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                            Binary file ({formatBytes(selectedTarEntry.size)}). Click &quot;Download
                            File&quot; to extract.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Feedback & Error Banner */}
          {error && <div className={styles.errorBanner}>{error}</div>}
        </div>
      </section>
    </div>
  );
}
