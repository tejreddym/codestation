"use client";

import { useState } from "react";
import { getCssPlaygroundDefinition, type CssPlaygroundToolId } from "@/config/css-playground-tools";
import {
  generateCssGrid,
  generateFlexbox,
  generateCssAnimation,
  generateGlassmorphism,
  generateClipPath,
  generateScrollbar,
  CLIP_PATH_PRESETS,
} from "@/lib/tools/css/engine";
import styles from "./CssPlaygroundStation.module.css";

interface CssPlaygroundStationProps {
  toolId: CssPlaygroundToolId;
}

export default function CssPlaygroundStation({ toolId }: { toolId: CssPlaygroundToolId }) {
  const activeToolId = toolId;
  const definition = getCssPlaygroundDefinition(activeToolId)!;

  const [copied, setCopied] = useState<string | null>(null);

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // 1. Grid State
  const [gridCols, setGridCols] = useState("200px 1fr");
  const [gridRows, setGridRows] = useState("60px 1fr 40px");
  const [gridGap, setGridGap] = useState(16);

  // 2. Flexbox State
  const [flexDir, setFlexDir] = useState<"row" | "column">("row");
  const [flexJustify, setFlexJustify] = useState<"flex-start" | "center" | "flex-end" | "space-between" | "space-around">("space-between");
  const [flexAlign, setFlexAlign] = useState<"stretch" | "center" | "flex-start" | "flex-end">("center");
  const [flexGap, setFlexGap] = useState(16);
  const [flexItemsCount, setFlexItemsCount] = useState(3);

  // 3. Animation State
  const [animDuration, setAnimDuration] = useState(1.5);
  const [animTiming, setAnimTiming] = useState<"ease" | "linear" | "ease-in-out">("ease-in-out");
  const [animScale, setAnimScale] = useState(1.2);
  const [animRotate, setAnimRotate] = useState(20);

  // 4. Glassmorphism State
  const [glassBlur, setGlassBlur] = useState(16);
  const [glassAlpha, setGlassAlpha] = useState(25);
  const [glassRadius, setGlassRadius] = useState(16);
  const [glassBorderOpacity, setGlassBorderOpacity] = useState(20);
  const [glassShadow, setGlassShadow] = useState(40);

  // 5. Clip Path State
  const [clipShape, setClipShape] = useState("Star");

  // 6. Scrollbar State
  const [scrollWidth, setScrollWidth] = useState(10);
  const [scrollThumbColor, setScrollThumbColor] = useState("#3b82f6");
  const [scrollTrackColor, setScrollTrackColor] = useState("#1e1e1e");
  const [scrollRadius, setScrollRadius] = useState(5);

  return (
    <div className={styles.container}>
      <div className={styles.playgroundGrid}>
        {/* Controls Column */}
        <div className={styles.controlsPanel}>
          <span className={styles.panelTitle}>Interactive Controls</span>

          {/* 1. Grid Controls */}
          {activeToolId === "css-grid-generator" && (
            <>
              <div className={styles.field}>
                <label>Columns (e.g. 200px 1fr or 1fr 1fr)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={gridCols}
                  onChange={(e) => setGridCols(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Rows (e.g. 60px 1fr 40px)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={gridRows}
                  onChange={(e) => setGridRows(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>
                  <span>Gap</span>
                  <span>{gridGap}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="48"
                  className={styles.slider}
                  value={gridGap}
                  onChange={(e) => setGridGap(parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.chipGroup}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => {
                    setGridCols("200px 1fr");
                    setGridRows("60px 1fr 40px");
                  }}
                >
                  Sidebar Layout
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => {
                    setGridCols("1fr 1fr 1fr");
                    setGridRows("auto auto");
                  }}
                >
                  3-Column Cards
                </button>
              </div>
            </>
          )}

          {/* 2. Flexbox Controls */}
          {activeToolId === "flexbox-playground" && (
            <>
              <div className={styles.field}>
                <label>Direction</label>
                <select
                  className={styles.select}
                  value={flexDir}
                  onChange={(e) => setFlexDir(e.target.value as any)}
                >
                  <option value="row">row</option>
                  <option value="column">column</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Justify Content</label>
                <select
                  className={styles.select}
                  value={flexJustify}
                  onChange={(e) => setFlexJustify(e.target.value as any)}
                >
                  <option value="flex-start">flex-start</option>
                  <option value="center">center</option>
                  <option value="flex-end">flex-end</option>
                  <option value="space-between">space-between</option>
                  <option value="space-around">space-around</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Align Items</label>
                <select
                  className={styles.select}
                  value={flexAlign}
                  onChange={(e) => setFlexAlign(e.target.value as any)}
                >
                  <option value="stretch">stretch</option>
                  <option value="center">center</option>
                  <option value="flex-start">flex-start</option>
                  <option value="flex-end">flex-end</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>
                  <span>Gap</span>
                  <span>{flexGap}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  className={styles.slider}
                  value={flexGap}
                  onChange={(e) => setFlexGap(parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.field}>
                <label>
                  <span>Item Count</span>
                  <span>{flexItemsCount}</span>
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => setFlexItemsCount((c) => Math.max(1, c - 1))}
                  >
                    - Remove Item
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => setFlexItemsCount((c) => Math.min(8, c + 1))}
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 3. Animation Controls */}
          {activeToolId === "css-animation-builder" && (
            <>
              <div className={styles.field}>
                <label>
                  <span>Duration</span>
                  <span>{animDuration}s</span>
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="5"
                  step="0.1"
                  className={styles.slider}
                  value={animDuration}
                  onChange={(e) => setAnimDuration(parseFloat(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label>Timing Function</label>
                <select
                  className={styles.select}
                  value={animTiming}
                  onChange={(e) => setAnimTiming(e.target.value as any)}
                >
                  <option value="ease-in-out">ease-in-out</option>
                  <option value="ease">ease</option>
                  <option value="linear">linear</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>
                  <span>Scale Factor</span>
                  <span>{animScale}x</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  className={styles.slider}
                  value={animScale}
                  onChange={(e) => setAnimScale(parseFloat(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label>
                  <span>Rotation</span>
                  <span>{animRotate}deg</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  className={styles.slider}
                  value={animRotate}
                  onChange={(e) => setAnimRotate(parseInt(e.target.value, 10))}
                />
              </div>
            </>
          )}

          {/* 4. Glassmorphism Controls */}
          {activeToolId === "glassmorphism-generator" && (
            <>
              <div className={styles.field}>
                <label>
                  <span>Backdrop Blur</span>
                  <span>{glassBlur}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  className={styles.slider}
                  value={glassBlur}
                  onChange={(e) => setGlassBlur(parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.field}>
                <label>
                  <span>Transparency (Alpha)</span>
                  <span>{glassAlpha}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="95"
                  className={styles.slider}
                  value={glassAlpha}
                  onChange={(e) => setGlassAlpha(parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.field}>
                <label>
                  <span>Border Radius</span>
                  <span>{glassRadius}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  className={styles.slider}
                  value={glassRadius}
                  onChange={(e) => setGlassRadius(parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.field}>
                <label>
                  <span>Border Specular Opacity</span>
                  <span>{glassBorderOpacity}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  className={styles.slider}
                  value={glassBorderOpacity}
                  onChange={(e) => setGlassBorderOpacity(parseInt(e.target.value, 10))}
                />
              </div>
            </>
          )}

          {/* 5. Clip Path Controls */}
          {activeToolId === "clip-path-maker" && (
            <>
              <div className={styles.field}>
                <label>Choose Preset Shape</label>
                <div className={styles.chipGroup}>
                  {Object.keys(CLIP_PATH_PRESETS).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      className={`${styles.chip} ${clipShape === shape ? styles.chipActive : ""}`}
                      onClick={() => setClipShape(shape)}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 6. Scrollbar Controls */}
          {activeToolId === "scrollbar-generator" && (
            <>
              <div className={styles.field}>
                <label>
                  <span>Width</span>
                  <span>{scrollWidth}px</span>
                </label>
                <input
                  type="range"
                  min="4"
                  max="24"
                  className={styles.slider}
                  value={scrollWidth}
                  onChange={(e) => setScrollWidth(parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.field}>
                <label>Thumb Color</label>
                <input
                  type="text"
                  className={styles.input}
                  value={scrollThumbColor}
                  onChange={(e) => setScrollThumbColor(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Track Background</label>
                <input
                  type="text"
                  className={styles.input}
                  value={scrollTrackColor}
                  onChange={(e) => setScrollTrackColor(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>
                  <span>Thumb Radius</span>
                  <span>{scrollRadius}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  className={styles.slider}
                  value={scrollRadius}
                  onChange={(e) => setScrollRadius(parseInt(e.target.value, 10))}
                />
              </div>
            </>
          )}
        </div>

        {/* Visual Preview & Generated Code Column */}
        <div className={styles.previewSection}>
          {/* Live Previews */}
          {activeToolId === "css-grid-generator" && (
            <div className={styles.previewCanvas}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: gridCols,
                  gridTemplateRows: gridRows,
                  gap: `${gridGap}px`,
                  width: "100%",
                  minHeight: "220px",
                }}
              >
                <div className={styles.gridItem}>Header</div>
                <div className={styles.gridItem}>Content Area</div>
                <div className={styles.gridItem}>Sidebar</div>
                <div className={styles.gridItem}>Footer</div>
              </div>
            </div>
          )}

          {activeToolId === "flexbox-playground" && (
            <div className={styles.previewCanvas}>
              <div
                style={{
                  display: "flex",
                  flexDirection: flexDir,
                  justifyContent: flexJustify,
                  alignItems: flexAlign,
                  gap: `${flexGap}px`,
                  width: "100%",
                  minHeight: "200px",
                  padding: "1rem",
                  background: "var(--surface)",
                  borderRadius: "8px",
                }}
              >
                {Array.from({ length: flexItemsCount }).map((_, i) => (
                  <div key={i} className={styles.flexItem}>
                    Item {i + 1}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeToolId === "css-animation-builder" && (
            <div className={styles.previewCanvas}>
              <style>{`
                @keyframes customLivePulse {
                  0% { transform: scale(1) rotate(0deg); }
                  50% { transform: scale(${animScale}) rotate(${animRotate}deg); }
                  100% { transform: scale(1) rotate(0deg); }
                }
              `}</style>
              <div
                className={styles.animatedBox}
                style={{
                  animation: `customLivePulse ${animDuration}s ${animTiming} infinite`,
                }}
              >
                Pulse
              </div>
            </div>
          )}

          {activeToolId === "glassmorphism-generator" && (
            <div className={styles.gradientBackdrop}>
              <div
                style={{
                  width: "280px",
                  height: "170px",
                  background: `rgba(255, 255, 255, ${(glassAlpha / 100).toFixed(2)})`,
                  backdropFilter: `blur(${glassBlur}px)`,
                  WebkitBackdropFilter: `blur(${glassBlur}px)`,
                  borderRadius: `${glassRadius}px`,
                  border: `1px solid rgba(255, 255, 255, ${(glassBorderOpacity / 100).toFixed(2)})`,
                  boxShadow: `0 8px 32px 0 rgba(0, 0, 0, ${(glassShadow / 100).toFixed(2)})`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "1.1rem",
                }}
              >
                Glass Card
                <span style={{ fontSize: "0.8rem", opacity: 0.8, marginTop: "4px" }}>
                  blur: {glassBlur}px
                </span>
              </div>
            </div>
          )}

          {activeToolId === "clip-path-maker" && (
            <div className={styles.previewCanvas}>
              <div
                className={styles.clippedBox}
                style={{
                  clipPath: CLIP_PATH_PRESETS[clipShape],
                  WebkitClipPath: CLIP_PATH_PRESETS[clipShape],
                }}
              >
                {clipShape}
              </div>
            </div>
          )}

          {activeToolId === "scrollbar-generator" && (
            <div className={styles.previewCanvas}>
              <style>{`
                .custom-scroll-demo::-webkit-scrollbar {
                  width: ${scrollWidth}px;
                }
                .custom-scroll-demo::-webkit-scrollbar-track {
                  background: ${scrollTrackColor};
                  border-radius: ${scrollRadius}px;
                }
                .custom-scroll-demo::-webkit-scrollbar-thumb {
                  background: ${scrollThumbColor};
                  border-radius: ${scrollRadius}px;
                }
              `}</style>
              <div className={`${styles.scrollBox} custom-scroll-demo`}>
                <p>Scroll down to test custom styling!</p>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
                <p>
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate.
                </p>
                <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
              </div>
            </div>
          )}

          {/* Generated Code Area */}
          <div className={styles.codePanel}>
            <div className={styles.codeHeader}>
              <span className={styles.codeTitle}>Generated CSS</span>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => {
                  let textToCopy = "";
                  if (activeToolId === "css-grid-generator") textToCopy = generateCssGrid({ columns: gridCols, rows: gridRows, columnGap: gridGap, rowGap: gridGap }).css;
                  else if (activeToolId === "flexbox-playground") textToCopy = generateFlexbox({ flexDirection: flexDir, flexWrap: "wrap", justifyContent: flexJustify, alignItems: flexAlign, alignContent: "stretch", gap: flexGap }).css;
                  else if (activeToolId === "css-animation-builder") textToCopy = generateCssAnimation({ name: "bounceScale", duration: animDuration, timingFunction: animTiming, iterationCount: "infinite", direction: "alternate", keyframes: [{ percent: 0, transform: "scale(1)" }, { percent: 100, transform: `scale(${animScale}) rotate(${animRotate}deg)` }] }).css;
                  else if (activeToolId === "glassmorphism-generator") textToCopy = generateGlassmorphism({ blur: glassBlur, transparency: glassAlpha / 100, baseColor: "#ffffff", borderWidth: 1, borderOpacity: glassBorderOpacity / 100, borderRadius: glassRadius, shadowElevation: glassShadow });
                  else if (activeToolId === "clip-path-maker") textToCopy = generateClipPath(clipShape);
                  else if (activeToolId === "scrollbar-generator") textToCopy = generateScrollbar({ width: scrollWidth, trackBackground: scrollTrackColor, thumbBackground: scrollThumbColor, thumbHoverBackground: "#60a5fa", borderRadius: scrollRadius });
                  copyText(textToCopy, "css");
                }}
              >
                {copied === "css" ? "✓ Copied" : "Copy CSS"}
              </button>
            </div>

            <pre className={styles.codeBox} aria-label="Generated CSS">
              <code>
                {(() => {
                  if (activeToolId === "css-grid-generator") return generateCssGrid({ columns: gridCols, rows: gridRows, columnGap: gridGap, rowGap: gridGap }).css;
                  if (activeToolId === "flexbox-playground") return generateFlexbox({ flexDirection: flexDir, flexWrap: "wrap", justifyContent: flexJustify, alignItems: flexAlign, alignContent: "stretch", gap: flexGap }).css;
                  if (activeToolId === "css-animation-builder") return generateCssAnimation({ name: "bounceScale", duration: animDuration, timingFunction: animTiming, iterationCount: "infinite", direction: "alternate", keyframes: [{ percent: 0, transform: "scale(1)" }, { percent: 100, transform: `scale(${animScale}) rotate(${animRotate}deg)` }] }).css;
                  if (activeToolId === "glassmorphism-generator") return generateGlassmorphism({ blur: glassBlur, transparency: glassAlpha / 100, baseColor: "#ffffff", borderWidth: 1, borderOpacity: glassBorderOpacity / 100, borderRadius: glassRadius, shadowElevation: glassShadow });
                  if (activeToolId === "clip-path-maker") return generateClipPath(clipShape);
                  if (activeToolId === "scrollbar-generator") return generateScrollbar({ width: scrollWidth, trackBackground: scrollTrackColor, thumbBackground: scrollThumbColor, thumbHoverBackground: "#60a5fa", borderRadius: scrollRadius });
                  return "";
                })()}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
