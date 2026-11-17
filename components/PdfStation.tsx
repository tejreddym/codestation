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
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { CanvasStage } from "./ui/CanvasStage";
import { Checkbox, ColorInput, RangeInput, Select, TextInput } from "./ui/controls";
import { DropZone } from "./ui/DropZone";
import { EmptyState } from "./ui/EmptyState";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { PreviewFrame } from "./ui/PreviewFrame";
import { ToolLayout } from "./ui/ToolLayout";
import PdfTextTool from "./PdfTextTool";
import PdfImagesTool from "./PdfImagesTool";
import PdfReorderTool from "./PdfReorderTool";
import ui from "./ui/ui.module.css";
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

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
  const processLabel = toolId === "pdf-merge"
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
                : "Inspect Metadata";

  if (toolId === "pdf-to-text") {
    return <PdfTextTool definition={definition} />;
  }

  if (toolId === "pdf-to-images") {
    return <PdfImagesTool definition={definition} />;
  }

  if (toolId === "pdf-reorder-pages") {
    return <PdfReorderTool definition={definition} />;
  }

  if (toolId === "signature-pad") {
    return (
      <ToolLayout kind="data" className={styles.container}>
        <Panel title={definition.name} headingId="signature-pad-heading" padded>
          <Hint>{definition.description}</Hint>
          <div className={styles.controlsRow}>
            <Field id="sig-pen-color" label="Ink Color">
              <ColorInput id="sig-pen-color" value={penColor} onChange={e => setPenColor(e.target.value)} />
            </Field>
            <Field id="pen-width-range" label={`Stroke Width (${penWidth}px)`}>
              <RangeInput id="pen-width-range" min="1" max="8" value={penWidth} onChange={e => setPenWidth(Number(e.target.value))} />
            </Field>
          </div>
          <CanvasStage
            kind="bitmap"
            label="Signature drawing area"
            background="checker"
            footer={<div className={ui.actions}>
              <Button variant="primary" onClick={() => downloadSignature(true)} disabled={!hasSignature}>Download Transparent PNG</Button>
              <Button onClick={() => downloadSignature(false)} disabled={!hasSignature}>Download White Background PNG</Button>
              <Button variant="danger" onClick={clearSignature}>Clear Canvas</Button>
            </div>}
          >
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
          </CanvasStage>
        </Panel>
      </ToolLayout>
    );
  }

  return (
    <ToolLayout kind="form" className={styles.container}>
      <Panel title={definition.name} headingId={`${toolId}-heading`} padded>
        <Hint>{definition.description}</Hint>

        <DropZone
          label={isMultiFile ? "Upload Documents / Images" : "Upload Document"}
          accept={fileAccept}
          multiple={isMultiFile}
          onFiles={files => handleFileSelect(files, isMultiFile)}
        >
          <span className={styles.dropzoneText}>
            {isMultiFile
              ? "Click or drag files here"
              : singleFile
                ? `Selected: ${singleFile.name}`
                : "Click or drag a PDF file here"}
          </span>
          <span className={styles.dropzoneSub}>
            {isMultiFile
              ? "Supported: PDF or Images. 100% processed locally in memory."
              : "Files never leave your browser."}
          </span>
        </DropZone>

        {isMultiFile && selectedFiles.length > 0 && (
          <div className={styles.fileList}>
            {selectedFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className={styles.fileItem}>
                <div>
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>({formatBytes(file.size)})</span>
                </div>
                <Button size="sm" variant="danger" onClick={() => removeFile(i)}>Remove</Button>
              </div>
            ))}
          </div>
        )}

        {toolId === "pdf-split" && (
          <Field id="range-input" label="Page Range" hint="Enter comma-separated page numbers or hyphenated ranges.">
            <TextInput id="range-input" type="text" value={rangeInput} onChange={e => setRangeInput(e.target.value)} placeholder="e.g. 1-3, 5, 8" />
          </Field>
        )}

        {toolId === "pdf-rotate" && (
          <>
            <Field id="rotate-angle" label="Rotation Direction">
              <Select id="rotate-angle" value={rotateAngle} onChange={e => setRotateAngle(Number(e.target.value) as 90 | 180 | 270)}>
                <option value={90}>90° Clockwise</option>
                <option value={180}>180° Flip Upside-Down</option>
                <option value={270}>270° Counter-Clockwise</option>
              </Select>
            </Field>
            <Field id="rotate-range" label="Pages to Rotate (Optional)">
              <TextInput id="rotate-range" type="text" value={rangeInput} onChange={e => setRangeInput(e.target.value)} placeholder="Leave empty for all pages, or e.g. 1, 3-5" />
            </Field>
          </>
        )}

        {toolId === "images-to-pdf" && (
          <Field id="page-size" label="Target PDF Page Size">
            <Select id="page-size" value={pageSize} onChange={e => setPageSize(e.target.value as "A4" | "Letter" | "FitImage")}>
              <option value="A4">A4 (Standard Document)</option>
              <option value="Letter">US Letter</option>
              <option value="FitImage">Fit Exactly to Image Dimensions</option>
            </Select>
          </Field>
        )}

        {toolId === "pdf-page-deleter" && (
          <Field id="delete-pages" label="Page numbers to delete">
            <TextInput id="delete-pages" type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="e.g. 1, 3, 5-7" />
          </Field>
        )}

        {toolId === "pdf-watermark" && (
          <>
            <Field id="wm-type" label="Watermark Type">
              <Select id="wm-type" value={wmType} onChange={e => setWmType(e.target.value as "text" | "image")}>
                <option value="text">Text Watermark</option>
                <option value="image">Image Watermark (PNG / JPG)</option>
              </Select>
            </Field>

            {wmType === "text" ? (
              <div className={styles.grid}>
                <Field id="wm-text" label="Watermark Text">
                  <TextInput id="wm-text" type="text" value={wmText} onChange={e => setWmText(e.target.value)} placeholder="e.g. CONFIDENTIAL, DRAFT" />
                </Field>
                <Field id="wm-font-size" label="Font Size (pt)">
                  <TextInput id="wm-font-size" type="number" min="10" max="150" value={wmFontSize} onChange={e => setWmFontSize(Number(e.target.value))} />
                </Field>
                <Field id="wm-color" label="Color">
                  <ColorInput id="wm-color" value={wmColor} onChange={e => setWmColor(e.target.value)} />
                </Field>
              </div>
            ) : (
              <div className={styles.grid}>
                <Field id="wm-image-file" label="Select Watermark Image">
                  <TextInput id="wm-image-file" type="file" accept="image/png,image/jpeg,image/jpg" onChange={e => {
                    if (e.target.files && e.target.files[0]) setWmImageFile(e.target.files[0]);
                  }} />
                  {wmImageFile && <Hint>Selected: {wmImageFile.name} ({formatBytes(wmImageFile.size)})</Hint>}
                </Field>
                <Field id="wm-scale" label="Scale (%)">
                  <TextInput id="wm-scale" type="number" min="10" max="300" value={wmScale} onChange={e => setWmScale(Number(e.target.value))} />
                </Field>
              </div>
            )}

            <div className={styles.grid}>
              <Field id="wm-position" label="Placement Position">
                <Select id="wm-position" value={wmPosition} onChange={e => setWmPosition(e.target.value as WatermarkPosition)}>
                  <option value="center">Center</option>
                  <option value="tile">Tile / Repeating Grid</option>
                  <option value="top-left">Top-Left</option>
                  <option value="top-right">Top-Right</option>
                  <option value="bottom-left">Bottom-Left</option>
                  <option value="bottom-right">Bottom-Right</option>
                </Select>
              </Field>
              <Field id="wm-rotation" label="Rotation Angle (°)">
                <Select id="wm-rotation" value={wmRotation} onChange={e => setWmRotation(Number(e.target.value))}>
                  <option value={45}>45° Diagonal</option>
                  <option value={0}>0° Horizontal</option>
                  <option value={90}>90° Vertical</option>
                  <option value={315}>315° Reverse Diagonal</option>
                </Select>
              </Field>
              <Field id="wm-opacity" label={`Opacity (${wmOpacity}%)`}>
                <RangeInput id="wm-opacity" min="5" max="100" value={wmOpacity} onChange={e => setWmOpacity(Number(e.target.value))} />
              </Field>
              <Field id="wm-range" label="Page Range (Optional)">
                <TextInput id="wm-range" type="text" value={wmPageRange} onChange={e => setWmPageRange(e.target.value)} placeholder="Leave blank for all pages (e.g. 1-5, 8)" />
              </Field>
            </div>
          </>
        )}

        {toolId === "pdf-page-numberer" && (
          <>
            <div className={styles.grid}>
              <Field id="pn-format" label="Numbering Format">
                <Select id="pn-format" value={pnFormat} onChange={e => setPnFormat(e.target.value as PageNumberFormat)}>
                  <option value="page-x-of-y">Page X of Y (e.g. Page 1 of 10)</option>
                  <option value="x-of-y">X / Y (e.g. 1 / 10)</option>
                  <option value="x">X (e.g. 1)</option>
                  <option value="roman-lower">Roman Lower (i, ii, iii...)</option>
                  <option value="roman-upper">Roman Upper (I, II, III...)</option>
                  <option value="custom">Custom Prefix / Suffix</option>
                </Select>
              </Field>

              {pnFormat === "custom" && (
                <>
                  <Field id="pn-prefix" label="Prefix">
                    <TextInput id="pn-prefix" type="text" value={pnPrefix} onChange={e => setPnPrefix(e.target.value)} placeholder="e.g. - " />
                  </Field>
                  <Field id="pn-suffix" label="Suffix">
                    <TextInput id="pn-suffix" type="text" value={pnSuffix} onChange={e => setPnSuffix(e.target.value)} placeholder="e.g.  -" />
                  </Field>
                </>
              )}

              <Field id="pn-vertical" label="Vertical Position">
                <Select id="pn-vertical" value={pnVertical} onChange={e => setPnVertical(e.target.value as PageNumberVertical)}>
                  <option value="footer">Footer (Bottom)</option>
                  <option value="header">Header (Top)</option>
                </Select>
              </Field>
              <Field id="pn-alignment" label="Alignment">
                <Select id="pn-alignment" value={pnAlignment} onChange={e => setPnAlignment(e.target.value as PageNumberPosition)}>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </Select>
              </Field>
              <Field id="pn-font" label="Font">
                <Select id="pn-font" value={pnFont} onChange={e => setPnFont(e.target.value as PageNumberFont)}>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times Roman">Times Roman</option>
                  <option value="Courier">Courier</option>
                </Select>
              </Field>
              <Field id="pn-font-size" label="Font Size (pt)">
                <TextInput id="pn-font-size" type="number" min="6" max="36" value={pnFontSize} onChange={e => setPnFontSize(Number(e.target.value))} />
              </Field>
              <Field id="pn-color" label="Color">
                <ColorInput id="pn-color" value={pnColor} onChange={e => setPnColor(e.target.value)} />
              </Field>
              <Field id="pn-margin" label="Margin (pt)">
                <TextInput id="pn-margin" type="number" min="10" max="100" value={pnMargin} onChange={e => setPnMargin(Number(e.target.value))} />
              </Field>
              <Field id="pn-start-num" label="Start Numbering From">
                <TextInput id="pn-start-num" type="number" min="1" value={pnStartNum} onChange={e => setPnStartNum(Number(e.target.value))} />
              </Field>
              <Field id="pn-range" label="Page Range (Optional)">
                <TextInput id="pn-range" type="text" value={pnPageRange} onChange={e => setPnPageRange(e.target.value)} placeholder="Leave blank for all (e.g. 2-10)" />
              </Field>
            </div>
            <Checkbox id="pn-skip-first" checked={pnSkipFirst} onChange={e => setPnSkipFirst(e.target.checked)} label="Skip first page (Cover / Title Page)" />
          </>
        )}

        <div className={ui.actions}>
          <Button variant="primary" onClick={handleProcess} disabled={busy || (isMultiFile ? selectedFiles.length === 0 : !singleFile)}>
            {busy ? "Processing..." : processLabel}
          </Button>
        </div>
      </Panel>

      <Panel title="Result" headingId={`${toolId}-result`} aria-busy={busy} padded>
        {error && <Callout kind="error">{error}</Callout>}
        {successNotice && <Callout kind="success">{successNotice}</Callout>}

        {previewUrl && (
          <>
            <PreviewFrame title="In-Memory PDF Preview" src={`${previewUrl}#toolbar=0`} height={540} />
            {processedBytes && singleFile && (
              <div className={ui.actions}>
                <Button variant="primary" onClick={() => {
                  const prefix = toolId === "pdf-watermark" ? "watermarked_" : "numbered_";
                  downloadBlob(processedBytes, `${prefix}${singleFile.name}`);
                }}>Download Modified PDF ({formatBytes(processedBytes.byteLength)})</Button>
              </div>
            )}
          </>
        )}

        {metaInfo && (
          <dl className={styles.metaGrid}>
            <div className={styles.metaItem}><dt className={styles.metaLabel}>Total Pages</dt><dd className={styles.metaValue}>{metaInfo.pageCount}</dd></div>
            <div className={styles.metaItem}><dt className={styles.metaLabel}>Title</dt><dd className={styles.metaValue}>{metaInfo.title}</dd></div>
            <div className={styles.metaItem}><dt className={styles.metaLabel}>Author</dt><dd className={styles.metaValue}>{metaInfo.author}</dd></div>
            <div className={styles.metaItem}><dt className={styles.metaLabel}>Producer</dt><dd className={styles.metaValue}>{metaInfo.producer || "N/A"}</dd></div>
            <div className={styles.metaItem}><dt className={styles.metaLabel}>Created</dt><dd className={styles.metaValue}>{metaInfo.creationDate ? new Date(metaInfo.creationDate).toLocaleString() : "N/A"}</dd></div>
            <div className={styles.metaItem}><dt className={styles.metaLabel}>Modified</dt><dd className={styles.metaValue}>{metaInfo.modificationDate ? new Date(metaInfo.modificationDate).toLocaleString() : "N/A"}</dd></div>
          </dl>
        )}

        {!error && !successNotice && !previewUrl && !metaInfo && (
          <EmptyState>Choose a document and run the tool to see its result here.</EmptyState>
        )}
      </Panel>
    </ToolLayout>
  );
}
