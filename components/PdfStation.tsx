"use client";

import { useState, useRef, useEffect } from "react";
import { getPdfDefinition, type PdfToolId } from "@/config/pdf-tools";
import {
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePdfPages,
  imagesToPdf,
  extractPdfInfo,
  parsePageRange,
  applyWatermark,
  applyPageNumbers,
  type PdfMetadataInfo,
  type WatermarkPosition,
  type PageNumberFormat,
  type PageNumberFont,
  type PageNumberPosition,
  type PageNumberVertical,
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
  // Single-file state for split, rotate, delete, info, watermark, page-numberer
  const [singleFile, setSingleFile] = useState<File | null>(null);

  // Tool specific inputs for existing tools
  const [rangeInput, setRangeInput] = useState("1-2");
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [pageSize, setPageSize] = useState<"A4" | "Letter" | "FitImage">("A4");
  const [deleteInput, setDeleteInput] = useState("1");

  // Watermark specific inputs
  const [wmType, setWmType] = useState<"text" | "image">("text");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [wmFontSize, setWmFontSize] = useState(48);
  const [wmColor, setWmColor] = useState("#666666");
  const [wmOpacity, setWmOpacity] = useState(30);
  const [wmRotation, setWmRotation] = useState(45);
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>("center");
  const [wmImageFile, setWmImageFile] = useState<File | null>(null);
  const [wmScale, setWmScale] = useState(50);
  const [wmPageRange, setWmPageRange] = useState("");

  // Page numberer specific inputs
  const [pnFormat, setPnFormat] = useState<PageNumberFormat>("page-x-of-y");
  const [pnVertical, setPnVertical] = useState<PageNumberVertical>("footer");
  const [pnAlignment, setPnAlignment] = useState<PageNumberPosition>("center");
  const [pnFont, setPnFont] = useState<PageNumberFont>("Helvetica");
  const [pnFontSize, setPnFontSize] = useState(10);
  const [pnColor, setPnColor] = useState("#333333");
  const [pnMargin, setPnMargin] = useState(24);
  const [pnStartNum, setPnStartNum] = useState(1);
  const [pnSkipFirst, setPnSkipFirst] = useState(false);
  const [pnPageRange, setPnPageRange] = useState("");
  const [pnPrefix, setPnPrefix] = useState("");
  const [pnSuffix, setPnSuffix] = useState("");

  // Preview & generated binary state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedBytes, setProcessedBytes] = useState<Uint8Array | null>(null);

  // Signature pad state
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#151713");
  const [penWidth, setPenWidth] = useState(3);
  const [hasSignature, setHasSignature] = useState(false);

  // Output / Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [metaInfo, setMetaInfo] = useState<PdfMetadataInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wmImageInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount or URL replacement
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileSelect(files: FileList | null, isMultiple: boolean) {
    if (!files || files.length === 0) return;
    setError(null);
    setSuccessNotice(null);
    setMetaInfo(null);
    setProcessedBytes(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

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
      } else if (toolId === "pdf-watermark") {
        if (!singleFile) throw new Error("Please select a PDF file.");
        const buffer = await singleFile.arrayBuffer();
        let imageBytes: Uint8Array | undefined;
        if (wmType === "image") {
          if (!wmImageFile) throw new Error("Please select an image file for the image watermark.");
          imageBytes = new Uint8Array(await wmImageFile.arrayBuffer());
        }
        const watermarkedBytes = await applyWatermark(buffer, {
          type: wmType,
          text: wmText,
          fontSize: wmFontSize,
          color: wmColor,
          opacity: wmOpacity / 100,
          rotation: wmRotation,
          position: wmPosition,
          imageBytes,
          imageType: wmImageFile?.type,
          scale: wmScale,
          pageRange: wmPageRange,
        });
        setProcessedBytes(watermarkedBytes);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const blob = new Blob([watermarkedBytes as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setSuccessNotice(`Watermark applied successfully! (${formatBytes(watermarkedBytes.byteLength)})`);
      } else if (toolId === "pdf-page-numberer") {
        if (!singleFile) throw new Error("Please select a PDF file.");
        const buffer = await singleFile.arrayBuffer();
        const numberedBytes = await applyPageNumbers(buffer, {
          format: pnFormat,
          verticalPosition: pnVertical,
          alignment: pnAlignment,
          fontFamily: pnFont,
          fontSize: pnFontSize,
          color: pnColor,
          margin: pnMargin,
          startNumber: pnStartNum,
          skipFirstPage: pnSkipFirst,
          pageRange: pnPageRange,
          customPrefix: pnPrefix,
          customSuffix: pnSuffix,
        });
        setProcessedBytes(numberedBytes);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const blob = new Blob([numberedBytes as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setSuccessNotice(`Page numbers added successfully! (${formatBytes(numberedBytes.byteLength)})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during PDF processing.");
    } finally {
      setBusy(false);
    }
  }

  // Signature pad drawing handlers
  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);

    setIsDrawing(true);
    setHasSignature(true);
    canvas.setPointerCapture(e.pointerId);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = sigCanvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);
  }

  function clearSignature() {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function downloadSignature(transparent = true) {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;

    if (transparent) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "digital_signature.png";
      a.click();
    } else {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas, 0, 0);
        const url = exportCanvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = "digital_signature_white.png";
        a.click();
      }
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
          {toolId === "signature-pad" ? (
            <div className={styles.formGrid}>
              <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="sig-pen-color" className={styles.label}>Ink Color</label>
                  <input
                    id="sig-pen-color"
                    type="color"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                  />
                </div>
                <div className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                  <label htmlFor="pen-width-range" className={styles.label}>Stroke Width</label>
                  <input
                    id="pen-width-range"
                    type="range"
                    min="1"
                    max="8"
                    value={penWidth}
                    onChange={(e) => setPenWidth(Number(e.target.value))}
                  />
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{penWidth}px</span>
                </div>
              </div>

              <div className={styles.canvasWrap}>
                <canvas
                  ref={sigCanvasRef}
                  width={600}
                  height={220}
                  className={styles.signatureCanvas}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => downloadSignature(true)}
                  disabled={!hasSignature}
                >
                  Download Transparent PNG
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => downloadSignature(false)}
                  disabled={!hasSignature}
                >
                  Download White Background PNG
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={clearSignature}
                  style={{ color: "var(--red)" }}
                >
                  Clear Canvas
                </button>
              </div>
            </div>
          ) : (
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

              {/* Watermark Controls */}
              {toolId === "pdf-watermark" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className={styles.field}>
                    <label htmlFor="wm-type" className={styles.label}>
                      Watermark Type
                    </label>
                    <select
                      id="wm-type"
                      value={wmType}
                      onChange={(e) => setWmType(e.target.value as "text" | "image")}
                      className={styles.select}
                    >
                      <option value="text">Text Watermark</option>
                      <option value="image">Image Watermark (PNG / JPG)</option>
                    </select>
                  </div>

                  {wmType === "text" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                      <div className={styles.field}>
                        <label htmlFor="wm-text" className={styles.label}>Watermark Text</label>
                        <input
                          id="wm-text"
                          type="text"
                          value={wmText}
                          onChange={(e) => setWmText(e.target.value)}
                          placeholder="e.g. CONFIDENTIAL, DRAFT"
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="wm-font-size" className={styles.label}>Font Size (pt)</label>
                        <input
                          id="wm-font-size"
                          type="number"
                          min="10"
                          max="150"
                          value={wmFontSize}
                          onChange={(e) => setWmFontSize(Number(e.target.value))}
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="wm-color" className={styles.label}>Color</label>
                        <input
                          id="wm-color"
                          type="color"
                          value={wmColor}
                          onChange={(e) => setWmColor(e.target.value)}
                          style={{ height: "42px", padding: "2px", width: "100%", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                      <div className={styles.field}>
                        <label htmlFor="wm-image-file" className={styles.label}>Select Watermark Image</label>
                        <input
                          ref={wmImageInputRef}
                          id="wm-image-file"
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setWmImageFile(e.target.files[0]);
                            }
                          }}
                          className={styles.input}
                        />
                        {wmImageFile && (
                          <span className={styles.hint}>Selected: {wmImageFile.name} ({formatBytes(wmImageFile.size)})</span>
                        )}
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="wm-scale" className={styles.label}>Scale (%)</label>
                        <input
                          id="wm-scale"
                          type="number"
                          min="10"
                          max="300"
                          value={wmScale}
                          onChange={(e) => setWmScale(Number(e.target.value))}
                          className={styles.input}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                    <div className={styles.field}>
                      <label htmlFor="wm-position" className={styles.label}>Placement Position</label>
                      <select
                        id="wm-position"
                        value={wmPosition}
                        onChange={(e) => setWmPosition(e.target.value as WatermarkPosition)}
                        className={styles.select}
                      >
                        <option value="center">Center</option>
                        <option value="tile">Tile / Repeating Grid</option>
                        <option value="top-left">Top-Left</option>
                        <option value="top-right">Top-Right</option>
                        <option value="bottom-left">Bottom-Left</option>
                        <option value="bottom-right">Bottom-Right</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="wm-rotation" className={styles.label}>Rotation Angle (°)</label>
                      <select
                        id="wm-rotation"
                        value={wmRotation}
                        onChange={(e) => setWmRotation(Number(e.target.value))}
                        className={styles.select}
                      >
                        <option value={45}>45° Diagonal</option>
                        <option value={0}>0° Horizontal</option>
                        <option value={90}>90° Vertical</option>
                        <option value={315}>315° Reverse Diagonal</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <label htmlFor="wm-opacity" className={styles.label}>Opacity</label>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>{wmOpacity}%</span>
                      </div>
                      <input
                        id="wm-opacity"
                        type="range"
                        min="5"
                        max="100"
                        value={wmOpacity}
                        onChange={(e) => setWmOpacity(Number(e.target.value))}
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="wm-range" className={styles.label}>Page Range (Optional)</label>
                      <input
                        id="wm-range"
                        type="text"
                        value={wmPageRange}
                        onChange={(e) => setWmPageRange(e.target.value)}
                        placeholder="Leave blank for all pages (e.g. 1-5, 8)"
                        className={styles.input}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Page Numberer Controls */}
              {toolId === "pdf-page-numberer" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                    <div className={styles.field}>
                      <label htmlFor="pn-format" className={styles.label}>Numbering Format</label>
                      <select
                        id="pn-format"
                        value={pnFormat}
                        onChange={(e) => setPnFormat(e.target.value as PageNumberFormat)}
                        className={styles.select}
                      >
                        <option value="page-x-of-y">Page X of Y (e.g. Page 1 of 10)</option>
                        <option value="x-of-y">X / Y (e.g. 1 / 10)</option>
                        <option value="x">X (e.g. 1)</option>
                        <option value="roman-lower">Roman Lower (i, ii, iii...)</option>
                        <option value="roman-upper">Roman Upper (I, II, III...)</option>
                        <option value="custom">Custom Prefix / Suffix</option>
                      </select>
                    </div>

                    {pnFormat === "custom" && (
                      <>
                        <div className={styles.field}>
                          <label htmlFor="pn-prefix" className={styles.label}>Prefix</label>
                          <input
                            id="pn-prefix"
                            type="text"
                            value={pnPrefix}
                            onChange={(e) => setPnPrefix(e.target.value)}
                            placeholder="e.g. - "
                            className={styles.input}
                          />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="pn-suffix" className={styles.label}>Suffix</label>
                          <input
                            id="pn-suffix"
                            type="text"
                            value={pnSuffix}
                            onChange={(e) => setPnSuffix(e.target.value)}
                            placeholder="e.g.  -"
                            className={styles.input}
                          />
                        </div>
                      </>
                    )}

                    <div className={styles.field}>
                      <label htmlFor="pn-vertical" className={styles.label}>Vertical Position</label>
                      <select
                        id="pn-vertical"
                        value={pnVertical}
                        onChange={(e) => setPnVertical(e.target.value as PageNumberVertical)}
                        className={styles.select}
                      >
                        <option value="footer">Footer (Bottom)</option>
                        <option value="header">Header (Top)</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="pn-alignment" className={styles.label}>Alignment</label>
                      <select
                        id="pn-alignment"
                        value={pnAlignment}
                        onChange={(e) => setPnAlignment(e.target.value as PageNumberPosition)}
                        className={styles.select}
                      >
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="pn-font" className={styles.label}>Font</label>
                      <select
                        id="pn-font"
                        value={pnFont}
                        onChange={(e) => setPnFont(e.target.value as PageNumberFont)}
                        className={styles.select}
                      >
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times Roman">Times Roman</option>
                        <option value="Courier">Courier</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="pn-font-size" className={styles.label}>Font Size (pt)</label>
                      <input
                        id="pn-font-size"
                        type="number"
                        min="6"
                        max="36"
                        value={pnFontSize}
                        onChange={(e) => setPnFontSize(Number(e.target.value))}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="pn-color" className={styles.label}>Color</label>
                      <input
                        id="pn-color"
                        type="color"
                        value={pnColor}
                        onChange={(e) => setPnColor(e.target.value)}
                        style={{ height: "42px", padding: "2px", width: "100%", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)" }}
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="pn-margin" className={styles.label}>Margin (pt)</label>
                      <input
                        id="pn-margin"
                        type="number"
                        min="10"
                        max="100"
                        value={pnMargin}
                        onChange={(e) => setPnMargin(Number(e.target.value))}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="pn-start-num" className={styles.label}>Start Numbering From</label>
                      <input
                        id="pn-start-num"
                        type="number"
                        min="1"
                        value={pnStartNum}
                        onChange={(e) => setPnStartNum(Number(e.target.value))}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="pn-range" className={styles.label}>Page Range (Optional)</label>
                      <input
                        id="pn-range"
                        type="text"
                        value={pnPageRange}
                        onChange={(e) => setPnPageRange(e.target.value)}
                        placeholder="Leave blank for all (e.g. 2-10)"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <input
                      id="pn-skip-first"
                      type="checkbox"
                      checked={pnSkipFirst}
                      onChange={(e) => setPnSkipFirst(e.target.checked)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <label htmlFor="pn-skip-first" className={styles.label} style={{ cursor: "pointer", marginBottom: 0 }}>
                      Skip first page (Cover / Title Page)
                    </label>
                  </div>
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
                              : toolId === "pdf-watermark"
                                ? "Apply Watermark & Preview"
                                : toolId === "pdf-page-numberer"
                                  ? "Add Page Numbers & Preview"
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

              {/* In-Memory Preview & Download for Watermark & Page Numberer */}
              {previewUrl && (
                <div style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                    <span className={styles.label} style={{ fontSize: "14px" }}>Document Live Preview</span>
                    {processedBytes && singleFile && (
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => {
                          const prefix = toolId === "pdf-watermark" ? "watermarked_" : "numbered_";
                          downloadBlob(processedBytes, `${prefix}${singleFile.name}`);
                        }}
                      >
                        Download Modified PDF ({formatBytes(processedBytes.byteLength)})
                      </button>
                    )}
                  </div>
                  <iframe
                    src={`${previewUrl}#toolbar=0`}
                    style={{
                      width: "100%",
                      height: "540px",
                      border: "1px solid var(--line-strong)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--surface-alt)",
                    }}
                    title="In-Memory PDF Preview"
                  />
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
          )}
        </div>
      </section>
    </div>
  );
}
