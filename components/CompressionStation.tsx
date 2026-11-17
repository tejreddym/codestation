"use client";

import { useState } from "react";
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
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { CodeArea, Select, TextInput, Textarea } from "./ui/controls";
import { cx } from "./ui/cx";
import { DropZone } from "./ui/DropZone";
import { EmptyState } from "./ui/EmptyState";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { StatusLine } from "./ui/StatusLine";
import { Tabs } from "./ui/Tabs";
import { ToolLayout } from "./ui/ToolLayout";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
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

function StatsGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <dl className={styles.statsGrid}>
      {items.map(item => (
        <div key={item.label} className={styles.statItem}>
          <dt className={styles.statLabel}>{item.label}</dt>
          <dd className={styles.statValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function CompressionStation({ toolId }: { toolId: CompressionToolId }) {
  const definition = getCompressionDefinition(toolId)!;

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { copy: copyText } = useCopy();

  // 1. ZIP Extractor State
  const [zipInspection, setZipInspection] = useState<ZipArchiveInspection | null>(null);
  const [selectedZipEntry, setSelectedZipEntry] = useState<ZipFileEntry | null>(null);
  const [zipFilter, setZipFilter] = useState("");
  const [zipPreviewText, setZipPreviewText] = useState<string | null>(null);
  const [zipPreviewImageUrl, setZipPreviewImageUrl] = useState<string | null>(null);

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

  // 3. Gzip / Deflate Compressor State
  const [compressMode, setCompressMode] = useState<"text" | "file">("text");
  const [compressTextInput, setCompressTextInput] = useState("");
  const [compressFile, setCompressFile] = useState<File | null>(null);
  const [compressFormat, setCompressFormat] = useState<"gzip" | "deflate">("gzip");
  const [compressLevel, setCompressLevel] = useState<number>(6);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);

  // 4. Gzip / Deflate Decompressor State
  const [decompressMode, setDecompressMode] = useState<"file" | "base64">("file");
  const [decompressBase64Input, setDecompressBase64Input] = useState("");
  const [decompressFile, setDecompressFile] = useState<File | null>(null);
  const [decompressFormat, setDecompressFormat] = useState<"auto" | "gzip" | "deflate">("auto");
  const [decompressionResult, setDecompressionResult] = useState<DecompressionResult | null>(null);

  // 5. TAR / TAR.GZ Inspector State
  const [tarInspection, setTarInspection] = useState<TarArchiveInspection | null>(null);
  const [selectedTarEntry, setSelectedTarEntry] = useState<TarEntry | null>(null);
  const [tarFilter, setTarFilter] = useState("");
  const [tarPreviewText, setTarPreviewText] = useState<string | null>(null);
  const [tarPreviewImageUrl, setTarPreviewImageUrl] = useState<string | null>(null);
  const [tarOriginalFilename, setTarOriginalFilename] = useState("archive.tar");

  // Copy helper
  async function copyToClipboard(text: string) {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
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
      .filter(e => !e.isDirectory)
      .map(e => ({ path: e.path, data: e.data }));
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
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      newFiles.push({ path: relPath, file: f });
    }
    setQueuedFiles(prev => [...prev, ...newFiles]);
  }

  function handleRemoveQueuedFile(index: number) {
    setQueuedFiles(prev => prev.filter((_, i) => i !== index));
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

  const errorBanner = error ? <Callout kind="error">{error}</Callout> : null;

  return (
    <ToolLayout kind="file" className={styles.container}>
      {toolId === "zip-extractor" && (
        <>
          <Panel title={definition.name} headingId="zip-extractor-heading" padded>
            <div className={styles.stack}>
              <Hint>{definition.description}</Hint>
              <DropZone
                id="zip-extractor-input"
                label="Upload a ZIP archive"
                accept=".zip,application/zip,application/x-zip-compressed"
                disabled={busy}
                onFiles={files => {
                  if (files[0]) handleZipFileUpload(files[0]);
                }}
              >
                <span className={styles.dropzoneText}>
                  {zipInspection
                    ? "✓ Archive loaded — Click or drag to replace"
                    : "Drop a .zip file here, or click to browse"}
                </span>
                <span className={styles.dropzoneSub}>
                  Zero uploads. Analyzed 100% in-browser memory.
                </span>
              </DropZone>
              {errorBanner}
            </div>
          </Panel>

          <Panel
            level={3}
            title="Archive contents"
            headingId="zip-extractor-contents"
            actions={
              zipInspection ? (
                <Button size="sm" onClick={handleDownloadAllZip}>📦 Download All as ZIP</Button>
              ) : undefined
            }
            padded
          >
            {zipInspection ? (
              <div className={styles.stack}>
                <StatsGrid
                  items={[
                    { label: "Files", value: zipInspection.fileCount },
                    { label: "Folders", value: zipInspection.dirCount },
                    { label: "Unpacked Size", value: formatBytes(zipInspection.totalUncompressedSize) },
                    { label: "Archive Size", value: formatBytes(zipInspection.totalCompressedSize) },
                  ]}
                />

                <div className={styles.row}>
                  <Field id="zip-filter" label="Filter files in archive" className={styles.grow}>
                    <TextInput
                      id="zip-filter"
                      type="text"
                      placeholder="Filter files in archive..."
                      value={zipFilter}
                      onChange={e => setZipFilter(e.target.value)}
                    />
                  </Field>
                </div>

                <div className={styles.tree}>
                  {zipInspection.entries
                    .filter(e => (zipFilter ? e.path.toLowerCase().includes(zipFilter.toLowerCase()) : true))
                    .map(entry => {
                      const isSelected = selectedZipEntry?.path === entry.path;
                      return (
                        <Button
                          key={entry.path}
                          variant="ghost"
                          size="sm"
                          className={cx(styles.treeItem, isSelected && styles.treeItemSelected)}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectZipEntry(entry)}
                        >
                          <span className={styles.treeLabel}>
                            <span aria-hidden="true">{entry.isDirectory ? "📁" : "📄"}</span>
                            <span>{entry.path}</span>
                          </span>
                          <span className={styles.treeSize}>
                            {entry.isDirectory ? "folder" : formatBytes(entry.size)}
                          </span>
                        </Button>
                      );
                    })}
                </div>

                {selectedZipEntry && !selectedZipEntry.isDirectory && (
                  <div className={styles.preview}>
                    <div className={styles.previewHeader}>
                      <span className={styles.previewTitle}>
                        {selectedZipEntry.name} ({formatBytes(selectedZipEntry.size)})
                      </span>
                      <div className={ui.actions}>
                        {zipPreviewText !== null && (
                          <Button size="sm" onClick={() => copyToClipboard(zipPreviewText)}>
                            {copied ? "✓ Copied" : "Copy Content"}
                          </Button>
                        )}
                        <Button variant="primary" size="sm" onClick={() => handleDownloadZipEntry(selectedZipEntry)}>
                          Download File
                        </Button>
                      </div>
                    </div>

                    <div className={styles.previewBody}>
                      {zipPreviewImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={zipPreviewImageUrl} alt={selectedZipEntry.name} className={styles.imagePreview} />
                      ) : zipPreviewText !== null ? (
                        <pre
                          className={cx(ui.output, styles.previewOutput)}
                          tabIndex={0}
                          aria-label={`${selectedZipEntry.name} preview`}
                        >
                          {zipPreviewText}
                        </pre>
                      ) : (
                        <Hint>Binary file. Choose “Download File” to extract it to your device.</Hint>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState>{busy ? "Reading archive locally…" : "Choose a ZIP archive to inspect its contents here."}</EmptyState>
            )}
          </Panel>
        </>
      )}

      {toolId === "zip-creator" && (
        <>
          <Panel title={definition.name} headingId="zip-creator-heading" padded>
            <div className={styles.stack}>
              <Hint>{definition.description}</Hint>
              <DropZone
                id="zip-creator-input"
                label="Add files to compress"
                multiple
                disabled={busy}
                onFiles={handleQueueFiles}
              >
                <span className={styles.dropzoneText}>Drop files to compress, or click to choose</span>
                <span className={styles.dropzoneSub}>
                  Add one or more files to assemble into a compressed .zip archive.
                </span>
              </DropZone>

              {queuedFiles.length > 0 && (
                <>
                  <div className={styles.row}>
                    <Field id="archive-name" label="Archive Name" className={styles.grow}>
                      <TextInput
                        id="archive-name"
                        type="text"
                        value={archiveFilename}
                        onChange={e => setArchiveFilename(e.target.value)}
                        placeholder="archive.zip"
                      />
                    </Field>
                    <Field id="zip-level" label="Compression Level (0-9)" className={styles.fixed220}>
                      <Select id="zip-level" value={zipLevel} onChange={e => setZipLevel(Number(e.target.value))}>
                        <option value={0}>0 - Store (Fastest / No compression)</option>
                        <option value={1}>1 - Fast Compression</option>
                        <option value={6}>6 - Balanced (Standard)</option>
                        <option value={9}>9 - Maximum Compression</option>
                      </Select>
                    </Field>
                  </div>

                  <div className={styles.stack}>
                    <div className={styles.previewHeader}>
                      <span className={styles.previewTitle}>
                        Queued Files ({queuedFiles.length} files,{" "}
                        {formatBytes(queuedFiles.reduce((acc, f) => acc + f.file.size, 0))})
                      </span>
                      <Button variant="danger" size="sm" onClick={() => setQueuedFiles([])}>
                        Clear All
                      </Button>
                    </div>
                    <div className={styles.queueList}>
                      {queuedFiles.map((item, index) => (
                        <div key={index} className={styles.queueItem}>
                          <span className={styles.queueName}>
                            {item.path} ({formatBytes(item.file.size)})
                          </span>
                          <Button variant="danger" size="sm" onClick={() => handleRemoveQueuedFile(index)}>
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={ui.actions}>
                    <Button variant="primary" onClick={handleCreateZip} disabled={busy} aria-busy={busy}>
                      {busy ? "Packing..." : "📦 Create & Download ZIP"}
                    </Button>
                  </div>
                </>
              )}

              {errorBanner}
            </div>
          </Panel>

          <Panel level={3} title="Archive result" headingId="zip-creator-result" padded>
            {creatorResult ? (
              <div className={styles.stack}>
                <Callout kind="success">Archive generated successfully.</Callout>
                <StatsGrid
                  items={[
                    { label: "Raw Size", value: formatBytes(creatorResult.originalSize) },
                    { label: "ZIP Size", value: formatBytes(creatorResult.compressedSize) },
                    { label: "Space Saved", value: `${creatorResult.ratio}%` },
                    { label: "Duration", value: `${creatorResult.timeMs} ms` },
                  ]}
                />
                <Hint>The archive was downloaded to your device.</Hint>
              </div>
            ) : (
              <EmptyState>Choose files and create a ZIP archive to see its statistics here.</EmptyState>
            )}
          </Panel>
        </>
      )}

      {toolId === "gzip-compressor" && (
        <>
          <Panel title={definition.name} headingId="gzip-compressor-heading" padded>
            <div className={styles.stack}>
              <Hint>{definition.description}</Hint>
              <Tabs
                idBase="gzip-compressor-mode"
                ariaLabel="Compression input mode"
                value={compressMode}
                onChange={value => setCompressMode(value as "text" | "file")}
                items={[
                  {
                    id: "text",
                    label: "Raw Text Input",
                    panel: (
                      <Field id="compress-text" label="Text to compress">
                        <Textarea
                          id="compress-text"
                          placeholder="Enter or paste text to compress..."
                          value={compressTextInput}
                          onChange={e => setCompressTextInput(e.target.value)}
                        />
                      </Field>
                    ),
                  },
                  {
                    id: "file",
                    label: "Binary File Upload",
                    panel: (
                      <DropZone
                        id="compress-file"
                        label="Choose or drop a file to compress"
                        onFiles={files => {
                          if (files[0]) setCompressFile(files[0]);
                        }}
                      >
                        <span className={styles.dropzoneText}>
                          {compressFile
                            ? `✓ ${compressFile.name} (${formatBytes(compressFile.size)})`
                            : "Choose or drop a file to compress"}
                        </span>
                      </DropZone>
                    ),
                  },
                ]}
              />

              <div className={styles.row}>
                <Field id="compress-format" label="Format" className={styles.fixed200}>
                  <Select
                    id="compress-format"
                    value={compressFormat}
                    onChange={e => setCompressFormat(e.target.value as "gzip" | "deflate")}
                  >
                    <option value="gzip">Gzip (.gz)</option>
                    <option value="deflate">Deflate / zlib (.zz)</option>
                  </Select>
                </Field>
                <Field id="compress-level" label="Compression Level" className={styles.fixed200}>
                  <Select
                    id="compress-level"
                    value={compressLevel}
                    onChange={e => setCompressLevel(Number(e.target.value))}
                  >
                    <option value={1}>1 - Fast</option>
                    <option value={6}>6 - Balanced</option>
                    <option value={9}>9 - Maximum</option>
                  </Select>
                </Field>
              </div>

              <div className={ui.actions}>
                <Button
                  variant="primary"
                  onClick={handleCompress}
                  disabled={busy || (compressMode === "text" ? !compressTextInput : !compressFile)}
                  aria-busy={busy}
                >
                  {busy ? "Compressing..." : `Compress with ${compressFormat.toUpperCase()}`}
                </Button>
              </div>

              {errorBanner}
            </div>
          </Panel>

          <Panel level={3} title="Compression result" headingId="gzip-compressor-result" padded>
            {compressionResult ? (
              <div className={styles.stack}>
                <Callout kind="success">Compression complete · Engine: {compressionResult.engine}</Callout>
                <StatsGrid
                  items={[
                    { label: "Original", value: formatBytes(compressionResult.originalSize) },
                    { label: "Compressed", value: formatBytes(compressionResult.compressedSize) },
                    { label: "Ratio Saved", value: `${compressionResult.ratioPercent}%` },
                  ]}
                />

                <Field
                  id="compressed-base64"
                  label="Base64 Compressed String"
                  className={styles.stack}
                >
                  <CodeArea
                    id="compressed-base64"
                    readOnly
                    aria-label="Base64 compressed string"
                    value={compressionResult.base64}
                    className={styles.base64Area}
                  />
                </Field>

                <div className={ui.actions}>
                  <Button size="sm" onClick={() => copyToClipboard(compressionResult.base64)}>
                    {copied ? "✓ Copied" : "Copy Base64"}
                  </Button>
                  <Button variant="primary" onClick={handleDownloadCompressed}>
                    Download Compressed File (.{compressionResult.format === "gzip" ? "gz" : "zz"})
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState>Compress text or a file to see size statistics and Base64 output here.</EmptyState>
            )}
          </Panel>
        </>
      )}

      {toolId === "gzip-decompressor" && (
        <>
          <Panel title={definition.name} headingId="gzip-decompressor-heading" padded>
            <div className={styles.stack}>
              <Hint>{definition.description}</Hint>
              <Tabs
                idBase="gzip-decompressor-mode"
                ariaLabel="Decompression input mode"
                value={decompressMode}
                onChange={value => setDecompressMode(value as "file" | "base64")}
                items={[
                  {
                    id: "file",
                    label: "Compressed File (.gz / .zz)",
                    panel: (
                      <DropZone
                        id="decompress-file"
                        label="Drop a compressed file here"
                        onFiles={files => {
                          if (files[0]) setDecompressFile(files[0]);
                        }}
                      >
                        <span className={styles.dropzoneText}>
                          {decompressFile
                            ? `✓ ${decompressFile.name} (${formatBytes(decompressFile.size)})`
                            : "Drop a .gz, .zz, or compressed file here"}
                        </span>
                      </DropZone>
                    ),
                  },
                  {
                    id: "base64",
                    label: "Base64 String Input",
                    panel: (
                      <Field id="decompress-base64" label="Paste Base64 encoded compressed data">
                        <Textarea
                          id="decompress-base64"
                          placeholder="e.g. H4sICAAAAAAA/..."
                          value={decompressBase64Input}
                          onChange={e => setDecompressBase64Input(e.target.value)}
                        />
                      </Field>
                    ),
                  },
                ]}
              />

              <div className={styles.row}>
                <Field id="decompress-format" label="Decompression Algorithm" className={styles.fixed220}>
                  <Select
                    id="decompress-format"
                    value={decompressFormat}
                    onChange={e => setDecompressFormat(e.target.value as "auto" | "gzip" | "deflate")}
                  >
                    <option value="auto">Auto-Detect Format</option>
                    <option value="gzip">Force Gzip</option>
                    <option value="deflate">Force Deflate</option>
                  </Select>
                </Field>
              </div>

              <div className={ui.actions}>
                <Button
                  variant="primary"
                  onClick={handleDecompress}
                  disabled={busy || (decompressMode === "file" ? !decompressFile : !decompressBase64Input.trim())}
                  aria-busy={busy}
                >
                  {busy ? "Decompressing..." : "Decompress Archive"}
                </Button>
              </div>

              {errorBanner}
            </div>
          </Panel>

          <Panel level={3} title="Decompression result" headingId="gzip-decompressor-result" padded>
            {decompressionResult ? (
              <div className={styles.stack}>
                <Callout kind="success">
                  Decompressed successfully · {decompressionResult.format.toUpperCase()} · {decompressionResult.engine}
                </Callout>
                <StatsGrid
                  items={[
                    { label: "Compressed", value: formatBytes(decompressionResult.originalSize) },
                    { label: "Unpacked", value: formatBytes(decompressionResult.decompressedSize) },
                    { label: "Type", value: decompressionResult.isText ? "UTF-8 Text" : "Binary" },
                  ]}
                />

                {decompressionResult.isText && decompressionResult.text ? (
                  <Field id="decompressed-text" label="Decompressed Text Content" className={styles.stack}>
                    <CodeArea
                      id="decompressed-text"
                      readOnly
                      aria-label="Decompressed text content"
                      value={decompressionResult.text}
                    />
                  </Field>
                ) : (
                  <Hint>
                    Decompressed binary data ({formatBytes(decompressionResult.decompressedSize)}). Choose
                    “Download Decompressed File” to save it.
                  </Hint>
                )}

                <div className={ui.actions}>
                  {decompressionResult.isText && decompressionResult.text && (
                    <Button size="sm" onClick={() => copyToClipboard(decompressionResult.text || "")}>
                      {copied ? "✓ Copied" : "Copy Text"}
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleDownloadDecompressed}>
                    Download Decompressed File
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState>Decompress an archive to inspect its contents and download the result here.</EmptyState>
            )}
          </Panel>
        </>
      )}

      {toolId === "tar-inspector" && (
        <>
          <Panel title={definition.name} headingId="tar-inspector-heading" padded>
            <div className={styles.stack}>
              <Hint>{definition.description}</Hint>
              <DropZone
                id="tar-inspector-input"
                label="Upload a TAR archive"
                accept=".tar,.tar.gz,.tgz,application/x-tar,application/gzip"
                disabled={busy}
                onFiles={files => {
                  if (files[0]) handleTarFileUpload(files[0]);
                }}
              >
                <span className={styles.dropzoneText}>
                  {tarInspection
                    ? "✓ TAR Archive Loaded — Click or drop to replace"
                    : "Drop a .tar, .tar.gz, or .tgz archive here"}
                </span>
                <span className={styles.dropzoneSub}>
                  Pure browser-memory extraction. Supports standard POSIX and GNU TAR headers.
                </span>
              </DropZone>
              {errorBanner}
            </div>
          </Panel>

          <Panel
            level={3}
            title="Archive contents"
            headingId="tar-inspector-contents"
            actions={
              tarInspection ? (
                <Button size="sm" onClick={handleExportTarAsZip}>📦 Export All as ZIP</Button>
              ) : undefined
            }
            padded
          >
            {tarInspection ? (
              <div className={styles.stack}>
                <StatsGrid
                  items={[
                    { label: "Format", value: tarInspection.isGzipped ? "TAR.GZ / TGZ" : "POSIX TAR" },
                    { label: "Total Files", value: tarInspection.fileCount },
                    { label: "Folders", value: tarInspection.dirCount },
                    { label: "Unpacked Total", value: formatBytes(tarInspection.totalSize) },
                  ]}
                />

                <Field id="tar-filter" label="Filter files in TAR">
                  <TextInput
                    id="tar-filter"
                    type="text"
                    placeholder="Filter files in TAR..."
                    value={tarFilter}
                    onChange={e => setTarFilter(e.target.value)}
                  />
                </Field>

                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <caption>Files in the TAR archive</caption>
                    <thead>
                      <tr>
                        <th scope="col">File Path</th>
                        <th scope="col">Permissions</th>
                        <th scope="col">Size</th>
                        <th scope="col">Type</th>
                        <th scope="col">Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarInspection.entries
                        .filter(e => (tarFilter ? e.name.toLowerCase().includes(tarFilter.toLowerCase()) : true))
                        .map(entry => {
                          const isSelected = selectedTarEntry?.name === entry.name;
                          return (
                            <tr key={entry.name} className={isSelected ? styles.tableRowSelected : undefined}>
                              <td>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={styles.fileSelect}
                                  aria-pressed={isSelected}
                                  onClick={() => handleSelectTarEntry(entry)}
                                >
                                  <span aria-hidden="true">{entry.typeflag === "5" ? "📁" : "📄"}</span>{" "}
                                  {entry.name}
                                </Button>
                              </td>
                              <td><code>{entry.formattedMode}</code></td>
                              <td>{formatBytes(entry.size)}</td>
                              <td>{entry.typeName}</td>
                              <td>{entry.mtime.toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {selectedTarEntry && selectedTarEntry.typeflag !== "5" && (
                  <div className={styles.preview}>
                    <div className={styles.previewHeader}>
                      <span className={styles.previewTitle}>
                        {selectedTarEntry.name} ({formatBytes(selectedTarEntry.size)})
                      </span>
                      <div className={ui.actions}>
                        {tarPreviewText !== null && (
                          <Button size="sm" onClick={() => copyToClipboard(tarPreviewText)}>
                            {copied ? "✓ Copied" : "Copy Content"}
                          </Button>
                        )}
                        <Button variant="primary" size="sm" onClick={() => handleDownloadTarEntry(selectedTarEntry)}>
                          Download File
                        </Button>
                      </div>
                    </div>

                    <div className={styles.previewBody}>
                      {tarPreviewImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={tarPreviewImageUrl} alt={selectedTarEntry.name} className={styles.imagePreview} />
                      ) : tarPreviewText !== null ? (
                        <pre
                          className={cx(ui.output, styles.previewOutput)}
                          tabIndex={0}
                          aria-label={`${selectedTarEntry.name} preview`}
                        >
                          {tarPreviewText}
                        </pre>
                      ) : (
                        <Hint>
                          Binary file ({formatBytes(selectedTarEntry.size)}). Choose “Download File” to extract it.
                        </Hint>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState>{busy ? "Reading archive locally…" : "Choose a TAR archive to inspect its contents here."}</EmptyState>
            )}
          </Panel>
        </>
      )}

      <StatusLine className={styles.status}>{copied ? "Copied to clipboard." : ""}</StatusLine>
    </ToolLayout>
  );
}
