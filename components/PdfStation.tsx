"use client";

import { useState, useRef } from "react";
import { getPdfDefinition, type PdfToolId } from "@/config/pdf-tools";
import {
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePdfPages,
  imagesToPdf,
  extractPdfInfo,
  parsePageRange,
  type PdfMetadataInfo,
} from "@/lib/tools/pdf/engine";
import styles from "./PdfStation.module.css";

function downloadBlob(data: Uint8Array, filename: string, mime = "application/pdf") {
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function PdfStation({ toolId }: { toolId: PdfToolId }) {
  const definition = getPdfDefinition(toolId)!;

  // Multi-file state for merge and images-to-pdf
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Single-file state for split, rotate, delete, info
  const [singleFile, setSingleFile] = useState<File | null>(null);

  // Tool specific inputs
  const [rangeInput, setRangeInput] = useState("1-2");
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [pageSize, setPageSize] = useState<"A4" | "Letter" | "FitImage">("A4");
  const [deleteInput, setDeleteInput] = useState("1");

  // Output / Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [metaInfo, setMetaInfo] = useState<PdfMetadataInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(files: FileList | null, isMultiple: boolean) {
    if (!files || files.length === 0) return;
    setError(null);
    setSuccessNotice(null);
    setMetaInfo(null);

    if (isMultiple) {
      setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
    } else {
      setSingleFile(files[0]);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleProcess() {
    setError(null);
    setSuccessNotice(null);
    setMetaInfo(null);
    setBusy(true);

    try {
      if (toolId === "pdf-merge") {
        if (selectedFiles.length < 2) {
          throw new Error("Please select at least 2 PDF files to merge.");
        }
        const buffers = await Promise.all(selectedFiles.map((f) => f.arrayBuffer()));
        const mergedBytes = await mergePdfs(buffers);
        downloadBlob(mergedBytes, "merged_document.pdf");
        setSuccessNotice(`Successfully merged ${selectedFiles.length} PDFs (${formatBytes(mergedBytes.byteLength)})!`);
      } else if (toolId === "pdf-split") {
        if (!singleFile) throw new Error("Please select a PDF file.");
        const buffer = await singleFile.arrayBuffer();
        const info = await extractPdfInfo(buffer);
        const indices = parsePageRange(rangeInput, info.pageCount);
        if (indices.length === 0) {
          throw new Error(`Invalid page range. File contains ${info.pageCount} page(s).`);
        }
        const splitBytes = await splitPdf(buffer, indices);
        downloadBlob(splitBytes, `extracted_pages_${singleFile.name}`);
        setSuccessNotice(`Extracted ${indices.length} page(s) into a new PDF!`);
      } else if (toolId === "pdf-rotate") {
        if (!singleFile) throw new Error("Please select a PDF file.");
        const buffer = await singleFile.arrayBuffer();
        const info = await extractPdfInfo(buffer);
        const indices = rangeInput.trim() ? parsePageRange(rangeInput, info.pageCount) : undefined;
        const rotatedBytes = await rotatePdf(buffer, rotateAngle, indices);
        downloadBlob(rotatedBytes, `rotated_${singleFile.name}`);
        setSuccessNotice(`Rotated PDF pages by ${rotateAngle}°!`);
      } else if (toolId === "images-to-pdf") {
        if (selectedFiles.length === 0) throw new Error("Please select at least one image file.");
        const imagesPayload = await Promise.all(
          selectedFiles.map(async (file) => ({
            data: new Uint8Array(await file.arrayBuffer()),
            type: file.type,
          }))
        );
        const pdfBytes = await imagesToPdf(imagesPayload, pageSize);
        downloadBlob(pdfBytes, "converted_images.pdf");
        setSuccessNotice(`Converted ${selectedFiles.length} image(s) to PDF (${formatBytes(pdfBytes.byteLength)})!`);
      } else if (toolId === "pdf-text-extractor") {
        if (!singleFile) throw new Error("Please select a PDF file.");
        const buffer = await singleFile.arrayBuffer();
        const info = await extractPdfInfo(buffer);
        setMetaInfo(info);
        setSuccessNotice(`Inspected metadata for "${singleFile.name}".`);
      } else if (toolId === "pdf-page-deleter") {
        if (!singleFile) throw new Error("Please select a PDF file.");
        const buffer = await singleFile.arrayBuffer();
        const info = await extractPdfInfo(buffer);
        const deleteIndices = parsePageRange(deleteInput, info.pageCount);
        if (deleteIndices.length === 0) {
          throw new Error("No valid pages specified to delete.");
        }
        const cleanedBytes = await deletePdfPages(buffer, deleteIndices);
        downloadBlob(cleanedBytes, `cleaned_${singleFile.name}`);
        setSuccessNotice(`Removed ${deleteIndices.length} page(s) successfully!`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during PDF processing.");
    } finally {
      setBusy(false);
    }
  }

  const isMultiFile = toolId === "pdf-merge" || toolId === "images-to-pdf";
  const fileAccept = toolId === "images-to-pdf" ? "image/png,image/jpeg,image/webp,image/*" : ".pdf,application/pdf";

  return (
    <div className={styles.container}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h2>{definition.name}</h2>
          <p>{definition.description}</p>
        </div>

        <div className={styles.body}>
          <div className={styles.formGrid}>
            {/* File dropzone */}
            <div className={styles.field}>
              <span className={styles.label}>
                {isMultiFile ? "Upload Documents / Images" : "Upload Document"}
              </span>
              <div
                className={styles.dropzone}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
              >
                <div className={styles.dropzoneText}>
                  {isMultiFile
                    ? "Click or drag files here"
                    : singleFile
                      ? `Selected: ${singleFile.name}`
                      : "Click or drag a PDF file here"}
                </div>
                <div className={styles.dropzoneSub}>
                  {isMultiFile
                    ? "Supported: PDF or Images. 100% processed locally in memory."
                    : "Files never leave your browser."}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={isMultiFile}
                  accept={fileAccept}
                  className={styles.fileInput}
                  onChange={(e) => handleFileSelect(e.target.files, isMultiFile)}
                />
              </div>

              {/* Multi file list display */}
              {isMultiFile && selectedFiles.length > 0 && (
                <div className={styles.fileList}>
                  {selectedFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} className={styles.fileItem}>
                      <div>
                        <span className={styles.fileName}>{file.name}</span>
                        <span className={styles.fileSize}>({formatBytes(file.size)})</span>
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeFile(i)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Split Page Range */}
            {toolId === "pdf-split" && (
              <div className={styles.field}>
                <label htmlFor="range-input" className={styles.label}>
                  Page Range
                </label>
                <input
                  id="range-input"
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8"
                  className={styles.input}
                />
                <span className={styles.hint}>Enter comma-separated page numbers or hyphenated ranges.</span>
              </div>
            )}

            {/* Rotate Angle */}
            {toolId === "pdf-rotate" && (
              <>
                <div className={styles.field}>
                  <label htmlFor="rotate-angle" className={styles.label}>
                    Rotation Direction
                  </label>
                  <select
                    id="rotate-angle"
                    value={rotateAngle}
                    onChange={(e) => setRotateAngle(Number(e.target.value) as 90 | 180 | 270)}
                    className={styles.select}
                  >
                    <option value={90}>90° Clockwise</option>
                    <option value={180}>180° Flip Upside-Down</option>
                    <option value={270}>270° Counter-Clockwise</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="rotate-range" className={styles.label}>
                    Pages to Rotate (Optional)
                  </label>
                  <input
                    id="rotate-range"
                    type="text"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    placeholder="Leave empty for all pages, or e.g. 1, 3-5"
                    className={styles.input}
                  />
                </div>
              </>
            )}

            {/* Images to PDF Page Size */}
            {toolId === "images-to-pdf" && (
              <div className={styles.field}>
                <label htmlFor="page-size" className={styles.label}>
                  Target PDF Page Size
                </label>
                <select
                  id="page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as "A4" | "Letter" | "FitImage")}
                  className={styles.select}
                >
                  <option value="A4">A4 (Standard Document)</option>
                  <option value="Letter">US Letter</option>
                  <option value="FitImage">Fit Exactly to Image Dimensions</option>
                </select>
              </div>
            )}

            {/* Delete Pages */}
            {toolId === "pdf-page-deleter" && (
              <div className={styles.field}>
                <label htmlFor="delete-pages" className={styles.label}>
                  Page numbers to delete
                </label>
                <input
                  id="delete-pages"
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="e.g. 1, 3, 5-7"
                  className={styles.input}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleProcess}
                disabled={busy || (isMultiFile ? selectedFiles.length === 0 : !singleFile)}
              >
                {busy
                  ? "Processing..."
                  : toolId === "pdf-merge"
                    ? "Merge & Download PDF"
                    : toolId === "pdf-split"
                      ? "Extract & Download PDF"
                      : toolId === "pdf-rotate"
                        ? "Rotate & Download PDF"
                        : toolId === "images-to-pdf"
                          ? "Convert to PDF"
                          : toolId === "pdf-page-deleter"
                            ? "Delete Pages & Download"
                            : "Inspect Metadata"}
              </button>
            </div>

            {/* Error & Feedback */}
            {error && <div className={styles.errorBanner}>{error}</div>}

            {successNotice && (
              <div className={styles.resultBox}>
                <div className={styles.successTitle}>✓ Success</div>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink)" }}>{successNotice}</p>
              </div>
            )}

            {/* Metadata Display */}
            {metaInfo && (
              <div className={styles.resultBox}>
                <div className={styles.successTitle}>Document Information</div>
                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Total Pages</div>
                    <div className={styles.metaValue}>{metaInfo.pageCount}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Title</div>
                    <div className={styles.metaValue}>{metaInfo.title}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Author</div>
                    <div className={styles.metaValue}>{metaInfo.author}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Producer</div>
                    <div className={styles.metaValue}>{metaInfo.producer || "N/A"}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Created</div>
                    <div className={styles.metaValue}>
                      {metaInfo.creationDate ? new Date(metaInfo.creationDate).toLocaleString() : "N/A"}
                    </div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.metaLabel}>Modified</div>
                    <div className={styles.metaValue}>
                      {metaInfo.modificationDate ? new Date(metaInfo.modificationDate).toLocaleString() : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
