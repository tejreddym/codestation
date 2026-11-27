"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { Select, TextInput } from "./ui/controls";
import { downloadBlob } from "./ui/useDownload";
import styles from "./ThumbnailOverlayEditor.module.css";
import {
  createThumbnailPreset,
  exportCompositeImage,
  hitTestLayers,
  normalizeLayerBounds,
  renderOverlayCanvas,
  reorderLayers,
  type ArrowDirection,
  type IconLayer,
  type IconType,
  type OverlayLayer,
  type ShapeLayer,
  type ShapeType,
  type TextLayer,
  type ThumbnailPresetId,
} from "@/lib/tools/video/overlay";

interface ThumbnailOverlayEditorProps {
  src: string;
  name: string;
  initialWidth?: number;
  initialHeight?: number;
  onClose: () => void;
}

type DragState = {
  type: "move" | "nw" | "ne" | "sw" | "se";
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
};

export default function ThumbnailOverlayEditor({
  src,
  name,
  initialWidth = 1280,
  initialHeight = 720,
  onClose,
}: ThumbnailOverlayEditorProps) {
  const [layers, setLayers] = useState<OverlayLayer[]>(() =>
    createThumbnailPreset("youtube-impact", initialWidth, initialHeight)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [exportQuality, setExportQuality] = useState<number>(92);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [naturalWidth, setNaturalWidth] = useState<number>(initialWidth);
  const [naturalHeight, setNaturalHeight] = useState<number>(initialHeight);

  const imgRef = useRef<HTMLImageElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const selectedLayer = layers.find(l => l.id === selectedId) || null;

  // Render layers on canvas whenever layers, width, or height change
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderOverlayCanvas(ctx, layers, canvas.width, canvas.height);
  }, [layers, naturalWidth, naturalHeight]);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setNaturalWidth(img.naturalWidth);
      setNaturalHeight(img.naturalHeight);
    }
  }

  // Update a single layer property
  function updateSelectedLayer(patch: Partial<OverlayLayer>) {
    if (!selectedId) return;
    setLayers(prev =>
      prev.map(l => (l.id === selectedId ? ({ ...l, ...patch } as OverlayLayer) : l))
    );
  }

  // Add a text layer
  function addTextLayer() {
    const w = naturalWidth;
    const h = naturalHeight;
    const newLayer: TextLayer = {
      id: `text-${Date.now()}`,
      type: "text",
      text: "NEW TITLE",
      fontFamily: "Impact",
      fontSize: Math.max(24, Math.round(h * 0.12)),
      fill: "#facc15",
      strokeColor: "#000000",
      strokeWidth: Math.max(3, Math.round(h * 0.012)),
      shadowColor: "rgba(0,0,0,0.85)",
      shadowBlur: 14,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      x: Math.round(w * 0.1),
      y: Math.round(h * 0.2),
      width: Math.round(w * 0.5),
      height: Math.round(h * 0.18),
      visible: true,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  }

  // Add a shape layer
  function addShapeLayer(shapeType: ShapeType) {
    const w = naturalWidth;
    const h = naturalHeight;
    const newLayer: ShapeLayer = {
      id: `shape-${shapeType}-${Date.now()}`,
      type: "shape",
      shapeType,
      direction: "right",
      fill: shapeType === "arrow" ? "#ef4444" : "#dc2626",
      stroke: "#ffffff",
      strokeWidth: 3,
      radius: shapeType === "pill" ? 50 : 12,
      x: Math.round(w * 0.2),
      y: Math.round(h * 0.3),
      width: shapeType === "circle" ? Math.round(h * 0.25) : Math.round(w * 0.3),
      height: Math.round(h * 0.2),
      visible: true,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  }

  // Add an icon layer
  function addIconLayer(iconType: IconType) {
    const w = naturalWidth;
    const h = naturalHeight;
    const size = Math.round(h * 0.14);
    const newLayer: IconLayer = {
      id: `icon-${iconType}-${Date.now()}`,
      type: "icon",
      iconType,
      fill: iconType === "play" ? "#ffffff" : iconType === "fire" ? "#f97316" : "#facc15",
      stroke: "#000000",
      strokeWidth: 2,
      size,
      x: Math.round(w * 0.15),
      y: Math.round(h * 0.15),
      width: size,
      height: size,
      visible: true,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  }

  // Apply a 1-click preset
  function applyPreset(presetId: ThumbnailPresetId) {
    const newLayers = createThumbnailPreset(presetId, naturalWidth, naturalHeight);
    setLayers(newLayers);
    setSelectedId(newLayers[newLayers.length - 1]?.id ?? null);
  }

  // Reorder layers
  function handleReorder(layerId: string, action: "bringToFront" | "sendToBack" | "moveUp" | "moveDown") {
    setLayers(prev => reorderLayers(prev, layerId, action));
  }

  // Duplicate layer
  function duplicateLayer(layerId: string) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const duplicated: OverlayLayer = {
      ...layer,
      id: `${layer.type}-${Date.now()}`,
      x: layer.x + 20,
      y: layer.y + 20,
    };
    setLayers(prev => [...prev, duplicated]);
    setSelectedId(duplicated.id);
  }

  // Delete layer
  function deleteLayer(layerId: string) {
    setLayers(prev => prev.filter(l => l.id !== layerId));
    if (selectedId === layerId) setSelectedId(null);
  }

  // Toggle layer visibility
  function toggleVisibility(layerId: string) {
    setLayers(prev =>
      prev.map(l => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  }

  // Canvas pointer down for hit-testing / selection
  function handleCanvasPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = naturalWidth / rect.width;
    const scaleY = naturalHeight / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const hit = hitTestLayers(layers, clickX, clickY);
    if (hit) {
      setSelectedId(hit.id);
      startDrag(e, "move", hit);
    } else {
      setSelectedId(null);
    }
  }

  // Start dragging layer or resize handle
  function startDrag(
    e: PointerEvent<HTMLElement>,
    type: "move" | "nw" | "ne" | "sw" | "se",
    layer: OverlayLayer
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    dragStateRef.current = {
      type,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
      origW: layer.width,
      origH: layer.height,
    };
  }

  function handlePointerMove(e: PointerEvent<HTMLElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !selectedLayer) return;

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = naturalWidth / rect.width;
    const scaleY = naturalHeight / rect.height;

    const dx = (e.clientX - drag.startX) * scaleX;
    const dy = (e.clientY - drag.startY) * scaleY;

    let nextX = drag.origX;
    let nextY = drag.origY;
    let nextW = drag.origW;
    let nextH = drag.origH;

    if (drag.type === "move") {
      nextX = drag.origX + dx;
      nextY = drag.origY + dy;
    } else if (drag.type === "se") {
      nextW = drag.origW + dx;
      nextH = drag.origH + dy;
    } else if (drag.type === "sw") {
      nextX = drag.origX + dx;
      nextW = drag.origW - dx;
      nextH = drag.origH + dy;
    } else if (drag.type === "ne") {
      nextY = drag.origY + dy;
      nextW = drag.origW + dx;
      nextH = drag.origH - dy;
    } else if (drag.type === "nw") {
      nextX = drag.origX + dx;
      nextY = drag.origY + dy;
      nextW = drag.origW - dx;
      nextH = drag.origH - dy;
    }

    const norm = normalizeLayerBounds(nextX, nextY, nextW, nextH, naturalWidth, naturalHeight);
    updateSelectedLayer(norm);
  }

  function handlePointerUp(e: PointerEvent<HTMLElement>) {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
    }
  }

  // Keyboard nudge for selected layer
  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!selectedLayer) return;
    const step = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;

    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else if (e.key === "Delete" || e.key === "Backspace") {
      if ((e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        e.preventDefault();
        deleteLayer(selectedLayer.id);
        return;
      }
    } else {
      return;
    }

    e.preventDefault();
    updateSelectedLayer({
      x: selectedLayer.x + dx,
      y: selectedLayer.y + dy,
    });
  }

  // High-res composite export
  async function handleExport() {
    if (!imgRef.current) return;
    setIsExporting(true);
    try {
      const mime = exportFormat === "png" ? "image/png" : "image/jpeg";
      const quality = exportQuality / 100;
      const blob = await exportCompositeImage(imgRef.current, layers, mime, quality);
      const ext = exportFormat === "png" ? "png" : "jpg";
      const baseTitle = name.replace(/\.[^/.]+$/, "") || "thumbnail";
      downloadBlob(blob, `${baseTitle}-composite.${ext}`);
    } catch (err) {
      console.error("Failed to export thumbnail:", err);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className={styles.editorRoot} onKeyDown={handleKeyDown}>
      {/* Top Bar Header */}
      <div className={styles.topBar}>
        <div className={styles.topBarGroup}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            ← Back to Frames
          </Button>
          <span className={styles.topBarTitle}>Canvas Overlay Studio</span>
        </div>

        <div className={styles.topBarGroup}>
          <Select
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value as "png" | "jpeg")}
            aria-label="Export format"
          >
            <option value="png">PNG (Lossless)</option>
            <option value="jpeg">JPEG (Compressed)</option>
          </Select>

          {exportFormat === "jpeg" && (
            <TextInput
              type="number"
              min="1"
              max="100"
              value={exportQuality}
              onChange={e => setExportQuality(Number(e.target.value))}
              aria-label="JPEG Quality"
              style={{ width: "70px" }}
            />
          )}

          <Button variant="primary" size="sm" disabled={isExporting} onClick={handleExport}>
            {isExporting ? "Exporting..." : "Download Thumbnail"}
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className={styles.workspaceGrid}>
        {/* Left Toolbar */}
        <div className={styles.toolsPanel}>
          <div className={styles.panelSection}>
            <h4 className={styles.sectionTitle}>Add Text</h4>
            <Button size="sm" onClick={addTextLayer}>
              + Add Heading
            </Button>
          </div>

          <div className={styles.panelSection}>
            <h4 className={styles.sectionTitle}>Add Shape</h4>
            <div className={styles.buttonGrid}>
              <Button size="sm" onClick={() => addShapeLayer("pill")}>Pill</Button>
              <Button size="sm" onClick={() => addShapeLayer("rect")}>Rect</Button>
              <Button size="sm" onClick={() => addShapeLayer("badge")}>Badge</Button>
              <Button size="sm" onClick={() => addShapeLayer("circle")}>Circle</Button>
              <Button size="sm" onClick={() => addShapeLayer("arrow")}>Arrow</Button>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h4 className={styles.sectionTitle}>Add Stickers</h4>
            <div className={styles.buttonGrid}>
              <Button size="sm" onClick={() => addIconLayer("play")}>▶ Play</Button>
              <Button size="sm" onClick={() => addIconLayer("fire")}>🔥 Fire</Button>
              <Button size="sm" onClick={() => addIconLayer("alert")}>⚠ Alert</Button>
              <Button size="sm" onClick={() => addIconLayer("star")}>★ Star</Button>
              <Button size="sm" onClick={() => addIconLayer("check")}>✓ Check</Button>
              <Button size="sm" onClick={() => addIconLayer("lightning")}>⚡ Bolt</Button>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h4 className={styles.sectionTitle}>1-Click Presets</h4>
            <div className={styles.buttonGrid}>
              <Button size="sm" onClick={() => applyPreset("youtube-impact")}>Impact</Button>
              <Button size="sm" onClick={() => applyPreset("tech-clean")}>Tech</Button>
              <Button size="sm" onClick={() => applyPreset("breaking-alert")}>Breaking</Button>
              <Button size="sm" onClick={() => applyPreset("gaming-badge")}>Gaming</Button>
            </div>
          </div>
        </div>

        {/* Center Canvas Stage */}
        <div className={styles.canvasStageWrapper}>
          <div
            ref={viewportRef}
            className={styles.canvasViewport}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Base Thumbnail / Frame Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Thumbnail background"
              className={styles.baseImage}
              onLoad={handleImageLoad}
            />

            {/* In-Browser Overlay Vector Canvas */}
            <canvas
              ref={overlayCanvasRef}
              width={naturalWidth}
              height={naturalHeight}
              className={styles.overlayCanvas}
              onPointerDown={handleCanvasPointerDown}
            />

            {/* Visual Selection Bounding Box & Handles */}
            {selectedLayer && (
              <div
                className={styles.selectionBox}
                tabIndex={0}
                style={{
                  left: `${(selectedLayer.x / naturalWidth) * 100}%`,
                  top: `${(selectedLayer.y / naturalHeight) * 100}%`,
                  width: `${(selectedLayer.width / naturalWidth) * 100}%`,
                  height: `${(selectedLayer.height / naturalHeight) * 100}%`,
                }}
                onPointerDown={e => startDrag(e, "move", selectedLayer)}
                role="group"
                aria-label={`Selected layer: ${selectedLayer.id}`}
              >
                <div
                  className={`${styles.handle} ${styles.handleNw}`}
                  onPointerDown={e => startDrag(e, "nw", selectedLayer)}
                />
                <div
                  className={`${styles.handle} ${styles.handleNe}`}
                  onPointerDown={e => startDrag(e, "ne", selectedLayer)}
                />
                <div
                  className={`${styles.handle} ${styles.handleSw}`}
                  onPointerDown={e => startDrag(e, "sw", selectedLayer)}
                />
                <div
                  className={`${styles.handle} ${styles.handleSe}`}
                  onPointerDown={e => startDrag(e, "se", selectedLayer)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Inspector & Layer List Panel */}
        <div className={styles.inspectorPanel}>
          {/* Layer Hierarchy Stack */}
          <div className={styles.panelSection}>
            <h4 className={styles.sectionTitle}>Layers ({layers.length})</h4>
            <div className={styles.layerList}>
              {layers.map(layer => (
                <div
                  key={layer.id}
                  className={`${styles.layerItem} ${
                    layer.id === selectedId ? styles.layerItemSelected : ""
                  }`}
                  onClick={() => setSelectedId(layer.id)}
                >
                  <div className={styles.layerItemLabel}>
                    <span>
                      {layer.type === "text"
                        ? "📝"
                        : layer.type === "shape"
                        ? "🔷"
                        : "⭐"}
                    </span>
                    <span>
                      {layer.type === "text"
                        ? layer.text.slice(0, 16) || "Empty Text"
                        : layer.type === "shape"
                        ? `${layer.shapeType}`
                        : `${layer.iconType}`}
                    </span>
                  </div>

                  <div className={styles.layerActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={layer.visible ? "Hide layer" : "Show layer"}
                      onClick={e => {
                        e.stopPropagation();
                        toggleVisibility(layer.id);
                      }}
                    >
                      {layer.visible ? "👁" : "🚫"}
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Duplicate"
                      onClick={e => {
                        e.stopPropagation();
                        duplicateLayer(layer.id);
                      }}
                    >
                      ⎘
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Delete"
                      onClick={e => {
                        e.stopPropagation();
                        deleteLayer(layer.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selectedLayer && (
              <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
                <Button size="sm" onClick={() => handleReorder(selectedLayer.id, "moveUp")}>↑ Up</Button>
                <Button size="sm" onClick={() => handleReorder(selectedLayer.id, "moveDown")}>↓ Down</Button>
                <Button size="sm" onClick={() => handleReorder(selectedLayer.id, "bringToFront")}>Top</Button>
                <Button size="sm" onClick={() => handleReorder(selectedLayer.id, "sendToBack")}>Bottom</Button>
              </div>
            )}
          </div>

          {/* Dynamic Inspector Controls */}
          {selectedLayer ? (
            <div className={styles.panelSection}>
              <h4 className={styles.sectionTitle}>
                Edit {selectedLayer.type.toUpperCase()}
              </h4>

              {/* Text Layer Inspector */}
              {selectedLayer.type === "text" && (
                <>
                  <Field id="layer-text" label="Content">
                    <textarea
                      id="layer-text"
                      rows={2}
                      value={selectedLayer.text}
                      onChange={e => updateSelectedLayer({ text: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "var(--space-2)",
                        background: "var(--bg)",
                        color: "var(--foreground)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-sm)",
                        fontFamily: "inherit",
                        fontSize: "var(--text-sm)",
                      }}
                    />
                  </Field>

                  <Field id="layer-font" label="Font Family">
                    <Select
                      id="layer-font"
                      value={selectedLayer.fontFamily}
                      onChange={e => updateSelectedLayer({ fontFamily: e.target.value })}
                    >
                      <option value="Impact">Impact (YouTube)</option>
                      <option value="Inter">Inter (Clean Sans)</option>
                      <option value="Arial">Arial</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Courier New">Courier New (Mono)</option>
                      <option value="Georgia">Georgia (Serif)</option>
                    </Select>
                  </Field>

                  <Field id="layer-font-size" label={`Font Size (${selectedLayer.fontSize}px)`}>
                    <input
                      id="layer-font-size"
                      type="range"
                      min="12"
                      max="200"
                      className={styles.rangeInput}
                      value={selectedLayer.fontSize}
                      onChange={e => updateSelectedLayer({ fontSize: Number(e.target.value) })}
                    />
                  </Field>

                  <Field id="layer-fill" label="Text Fill Color">
                    <div className={styles.colorPickerRow}>
                      <input
                        id="layer-fill"
                        type="color"
                        className={styles.colorInput}
                        value={selectedLayer.fill}
                        onChange={e => updateSelectedLayer({ fill: e.target.value })}
                      />
                      <span className={styles.colorValue}>{selectedLayer.fill}</span>
                    </div>
                  </Field>

                  <Field id="layer-stroke" label="Outline Stroke">
                    <div className={styles.colorPickerRow}>
                      <input
                        id="layer-stroke"
                        type="color"
                        className={styles.colorInput}
                        value={selectedLayer.strokeColor || "#000000"}
                        onChange={e => updateSelectedLayer({ strokeColor: e.target.value })}
                      />
                      <TextInput
                        type="number"
                        min="0"
                        max="24"
                        value={selectedLayer.strokeWidth ?? 0}
                        onChange={e => updateSelectedLayer({ strokeWidth: Number(e.target.value) })}
                        style={{ width: "70px" }}
                        placeholder="Width"
                      />
                    </div>
                  </Field>

                  <Field id="layer-shadow" label="Shadow Blur">
                    <input
                      id="layer-shadow"
                      type="range"
                      min="0"
                      max="30"
                      className={styles.rangeInput}
                      value={selectedLayer.shadowBlur ?? 0}
                      onChange={e =>
                        updateSelectedLayer({
                          shadowBlur: Number(e.target.value),
                          shadowColor: selectedLayer.shadowColor || "rgba(0,0,0,0.8)",
                        })
                      }
                    />
                  </Field>

                  <Field id="layer-badge" label="Background Badge">
                    <div className={styles.colorPickerRow}>
                      <input
                        id="layer-badge"
                        type="color"
                        className={styles.colorInput}
                        value={selectedLayer.badgeBg || "#000000"}
                        onChange={e => updateSelectedLayer({ badgeBg: e.target.value })}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          updateSelectedLayer({
                            badgeBg: selectedLayer.badgeBg ? undefined : "#000000",
                            badgePadding: selectedLayer.badgePadding ?? 8,
                          })
                        }
                      >
                        {selectedLayer.badgeBg ? "Remove Badge" : "Enable Badge"}
                      </Button>
                    </div>
                  </Field>

                  <Field id="layer-opacity" label={`Opacity (${Math.round((selectedLayer.opacity ?? 1) * 100)}%)`}>
                    <input
                      id="layer-opacity"
                      type="range"
                      min="0"
                      max="100"
                      className={styles.rangeInput}
                      value={Math.round((selectedLayer.opacity ?? 1) * 100)}
                      onChange={e => updateSelectedLayer({ opacity: Number(e.target.value) / 100 })}
                    />
                  </Field>
                </>
              )}

              {/* Shape Layer Inspector */}
              {selectedLayer.type === "shape" && (
                <>
                  <Field id="shape-fill" label="Fill Color">
                    <div className={styles.colorPickerRow}>
                      <input
                        id="shape-fill"
                        type="color"
                        className={styles.colorInput}
                        value={selectedLayer.fill}
                        onChange={e => updateSelectedLayer({ fill: e.target.value })}
                      />
                      <span className={styles.colorValue}>{selectedLayer.fill}</span>
                    </div>
                  </Field>

                  <Field id="shape-stroke" label="Border Stroke">
                    <div className={styles.colorPickerRow}>
                      <input
                        id="shape-stroke"
                        type="color"
                        className={styles.colorInput}
                        value={selectedLayer.stroke || "#ffffff"}
                        onChange={e => updateSelectedLayer({ stroke: e.target.value })}
                      />
                      <TextInput
                        type="number"
                        min="0"
                        max="20"
                        value={selectedLayer.strokeWidth ?? 0}
                        onChange={e => updateSelectedLayer({ strokeWidth: Number(e.target.value) })}
                        style={{ width: "70px" }}
                        placeholder="Width"
                      />
                    </div>
                  </Field>

                  {selectedLayer.shapeType === "arrow" && (
                    <Field id="shape-direction" label="Arrow Direction">
                      <Select
                        id="shape-direction"
                        value={selectedLayer.direction || "right"}
                        onChange={e =>
                          updateSelectedLayer({ direction: e.target.value as ArrowDirection })
                        }
                      >
                        <option value="right">Right →</option>
                        <option value="left">Left ←</option>
                        <option value="up">Up ↑</option>
                        <option value="down">Down ↓</option>
                      </Select>
                    </Field>
                  )}

                  {(selectedLayer.shapeType === "rect" || selectedLayer.shapeType === "badge") && (
                    <Field id="shape-radius" label={`Corner Radius (${selectedLayer.radius ?? 0}px)`}>
                      <input
                        id="shape-radius"
                        type="range"
                        min="0"
                        max="60"
                        className={styles.rangeInput}
                        value={selectedLayer.radius ?? 0}
                        onChange={e => updateSelectedLayer({ radius: Number(e.target.value) })}
                      />
                    </Field>
                  )}

                  <Field id="shape-opacity" label={`Opacity (${Math.round((selectedLayer.opacity ?? 1) * 100)}%)`}>
                    <input
                      id="shape-opacity"
                      type="range"
                      min="0"
                      max="100"
                      className={styles.rangeInput}
                      value={Math.round((selectedLayer.opacity ?? 1) * 100)}
                      onChange={e => updateSelectedLayer({ opacity: Number(e.target.value) / 100 })}
                    />
                  </Field>
                </>
              )}

              {/* Icon Layer Inspector */}
              {selectedLayer.type === "icon" && (
                <>
                  <Field id="icon-fill" label="Icon Color">
                    <div className={styles.colorPickerRow}>
                      <input
                        id="icon-fill"
                        type="color"
                        className={styles.colorInput}
                        value={selectedLayer.fill}
                        onChange={e => updateSelectedLayer({ fill: e.target.value })}
                      />
                      <span className={styles.colorValue}>{selectedLayer.fill}</span>
                    </div>
                  </Field>

                  <Field id="icon-stroke" label="Outline Stroke">
                    <div className={styles.colorPickerRow}>
                      <input
                        id="icon-stroke"
                        type="color"
                        className={styles.colorInput}
                        value={selectedLayer.stroke || "#000000"}
                        onChange={e => updateSelectedLayer({ stroke: e.target.value })}
                      />
                      <TextInput
                        type="number"
                        min="0"
                        max="12"
                        value={selectedLayer.strokeWidth ?? 0}
                        onChange={e => updateSelectedLayer({ strokeWidth: Number(e.target.value) })}
                        style={{ width: "70px" }}
                        placeholder="Width"
                      />
                    </div>
                  </Field>

                  <Field id="icon-size" label={`Icon Size (${selectedLayer.width}px)`}>
                    <input
                      id="icon-size"
                      type="range"
                      min="16"
                      max="400"
                      className={styles.rangeInput}
                      value={selectedLayer.width}
                      onChange={e => {
                        const val = Number(e.target.value);
                        updateSelectedLayer({ width: val, height: val, size: val });
                      }}
                    />
                  </Field>

                  <Field id="icon-opacity" label={`Opacity (${Math.round((selectedLayer.opacity ?? 1) * 100)}%)`}>
                    <input
                      id="icon-opacity"
                      type="range"
                      min="0"
                      max="100"
                      className={styles.rangeInput}
                      value={Math.round((selectedLayer.opacity ?? 1) * 100)}
                      onChange={e => updateSelectedLayer({ opacity: Number(e.target.value) / 100 })}
                    />
                  </Field>
                </>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "var(--text-xs)" }}>
              Select a layer on the canvas or layer list to edit styles.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
