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
import { Button } from "./ui/Button";
import { CanvasStage } from "./ui/CanvasStage";
import { Field } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { RangeInput, Select, TextInput } from "./ui/controls";
import { useCopy } from "./ui/useCopy";
import { ToolLayout } from "./ui/ToolLayout";
import ui from "./ui/ui.module.css";
import styles from "./CssPlaygroundStation.module.css";

interface CssPlaygroundStationProps {
  toolId: CssPlaygroundToolId;
}

export default function CssPlaygroundStation({ toolId }: { toolId: CssPlaygroundToolId }) {
  const activeToolId = toolId;
  const definition = getCssPlaygroundDefinition(activeToolId)!;

  const [copied, setCopied] = useState<string | null>(null);
  const { copy } = useCopy();

  async function copyText(text: string, id: string) {
    if (!(await copy(text))) return;
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

  const generatedCss = (() => {
    if (activeToolId === "css-grid-generator") return generateCssGrid({ columns: gridCols, rows: gridRows, columnGap: gridGap, rowGap: gridGap }).css;
    if (activeToolId === "flexbox-playground") return generateFlexbox({ flexDirection: flexDir, flexWrap: "wrap", justifyContent: flexJustify, alignItems: flexAlign, alignContent: "stretch", gap: flexGap }).css;
    if (activeToolId === "css-animation-builder") return generateCssAnimation({ name: "bounceScale", duration: animDuration, timingFunction: animTiming, iterationCount: "infinite", direction: "alternate", keyframes: [{ percent: 0, transform: "scale(1)" }, { percent: 100, transform: `scale(${animScale}) rotate(${animRotate}deg)` }] }).css;
    if (activeToolId === "glassmorphism-generator") return generateGlassmorphism({ blur: glassBlur, transparency: glassAlpha / 100, baseColor: "#ffffff", borderWidth: 1, borderOpacity: glassBorderOpacity / 100, borderRadius: glassRadius, shadowElevation: glassShadow });
    if (activeToolId === "clip-path-maker") return generateClipPath(clipShape);
    if (activeToolId === "scrollbar-generator") return generateScrollbar({ width: scrollWidth, trackBackground: scrollTrackColor, thumbBackground: scrollThumbColor, thumbHoverBackground: "#60a5fa", borderRadius: scrollRadius });
    return "";
  })();

  return (
    <ToolLayout kind="form">
      <Panel title="Interactive Controls" headingId={`${activeToolId}-controls`} padded>
        {/* 1. Grid Controls */}
        {activeToolId === "css-grid-generator" && (
          <>
            <Field id="css-grid-columns" label="Columns (e.g. 200px 1fr or 1fr 1fr)">
              <TextInput id="css-grid-columns" type="text" value={gridCols} onChange={e => setGridCols(e.target.value)} />
            </Field>
            <Field id="css-grid-rows" label="Rows (e.g. 60px 1fr 40px)">
              <TextInput id="css-grid-rows" type="text" value={gridRows} onChange={e => setGridRows(e.target.value)} />
            </Field>
            <Field id="css-grid-gap" label={`Gap (${gridGap}px)`}>
              <RangeInput id="css-grid-gap" min="0" max="48" value={gridGap} onChange={e => setGridGap(parseInt(e.target.value, 10))} />
            </Field>
            <div className={styles.chipGroup}>
              <Button size="sm" onClick={() => { setGridCols("200px 1fr"); setGridRows("60px 1fr 40px"); }}>Sidebar Layout</Button>
              <Button size="sm" onClick={() => { setGridCols("1fr 1fr 1fr"); setGridRows("auto auto"); }}>3-Column Cards</Button>
            </div>
          </>
        )}

        {/* 2. Flexbox Controls */}
        {activeToolId === "flexbox-playground" && (
          <>
            <Field id="flex-direction" label="Direction">
              <Select id="flex-direction" value={flexDir} onChange={e => setFlexDir(e.target.value as "row" | "column")}>
                <option value="row">row</option>
                <option value="column">column</option>
              </Select>
            </Field>
            <Field id="flex-justify" label="Justify Content">
              <Select id="flex-justify" value={flexJustify} onChange={e => setFlexJustify(e.target.value as typeof flexJustify)}>
                <option value="flex-start">flex-start</option>
                <option value="center">center</option>
                <option value="flex-end">flex-end</option>
                <option value="space-between">space-between</option>
                <option value="space-around">space-around</option>
              </Select>
            </Field>
            <Field id="flex-align" label="Align Items">
              <Select id="flex-align" value={flexAlign} onChange={e => setFlexAlign(e.target.value as typeof flexAlign)}>
                <option value="stretch">stretch</option>
                <option value="center">center</option>
                <option value="flex-start">flex-start</option>
                <option value="flex-end">flex-end</option>
              </Select>
            </Field>
            <Field id="flex-gap" label={`Gap (${flexGap}px)`}>
              <RangeInput id="flex-gap" min="0" max="60" value={flexGap} onChange={e => setFlexGap(parseInt(e.target.value, 10))} />
            </Field>
            <Field id="flex-count" label={`Item Count (${flexItemsCount})`}>
              <div className={styles.chipGroup}>
                <Button size="sm" onClick={() => setFlexItemsCount(c => Math.max(1, c - 1))}>- Remove Item</Button>
                <Button size="sm" onClick={() => setFlexItemsCount(c => Math.min(8, c + 1))}>+ Add Item</Button>
              </div>
            </Field>
          </>
        )}

        {/* 3. Animation Controls */}
        {activeToolId === "css-animation-builder" && (
          <>
            <Field id="anim-duration" label={`Duration (${animDuration}s)`}>
              <RangeInput id="anim-duration" min="0.2" max="5" step="0.1" value={animDuration} onChange={e => setAnimDuration(parseFloat(e.target.value))} />
            </Field>
            <Field id="anim-timing" label="Timing Function">
              <Select id="anim-timing" value={animTiming} onChange={e => setAnimTiming(e.target.value as typeof animTiming)}>
                <option value="ease-in-out">ease-in-out</option>
                <option value="ease">ease</option>
                <option value="linear">linear</option>
              </Select>
            </Field>
            <Field id="anim-scale" label={`Scale Factor (${animScale}x)`}>
              <RangeInput id="anim-scale" min="0.5" max="2" step="0.1" value={animScale} onChange={e => setAnimScale(parseFloat(e.target.value))} />
            </Field>
            <Field id="anim-rotate" label={`Rotation (${animRotate}deg)`}>
              <RangeInput id="anim-rotate" min="0" max="360" step="5" value={animRotate} onChange={e => setAnimRotate(parseInt(e.target.value, 10))} />
            </Field>
          </>
        )}

        {/* 4. Glassmorphism Controls */}
        {activeToolId === "glassmorphism-generator" && (
          <>
            <Field id="glass-blur" label={`Backdrop Blur (${glassBlur}px)`}>
              <RangeInput id="glass-blur" min="0" max="40" value={glassBlur} onChange={e => setGlassBlur(parseInt(e.target.value, 10))} />
            </Field>
            <Field id="glass-alpha" label={`Transparency (${glassAlpha}%)`}>
              <RangeInput id="glass-alpha" min="5" max="95" value={glassAlpha} onChange={e => setGlassAlpha(parseInt(e.target.value, 10))} />
            </Field>
            <Field id="glass-radius" label={`Border Radius (${glassRadius}px)`}>
              <RangeInput id="glass-radius" min="0" max="40" value={glassRadius} onChange={e => setGlassRadius(parseInt(e.target.value, 10))} />
            </Field>
            <Field id="glass-border-opacity" label={`Border Specular Opacity (${glassBorderOpacity}%)`}>
              <RangeInput id="glass-border-opacity" min="0" max="100" value={glassBorderOpacity} onChange={e => setGlassBorderOpacity(parseInt(e.target.value, 10))} />
            </Field>
          </>
        )}

        {/* 5. Clip Path Controls */}
        {activeToolId === "clip-path-maker" && (
          <fieldset className={ui.fieldset}>
            <legend className={ui.legend}>Choose Preset Shape</legend>
            <div className={styles.chipGroup}>
              {Object.keys(CLIP_PATH_PRESETS).map(shape => (
                <Button
                  key={shape}
                  size="sm"
                  variant={clipShape === shape ? "primary" : "secondary"}
                  aria-pressed={clipShape === shape}
                  onClick={() => setClipShape(shape)}
                >
                  {shape}
                </Button>
              ))}
            </div>
          </fieldset>
        )}

        {/* 6. Scrollbar Controls */}
        {activeToolId === "scrollbar-generator" && (
          <>
            <Field id="scrollbar-width" label={`Width (${scrollWidth}px)`}>
              <RangeInput id="scrollbar-width" min="4" max="24" value={scrollWidth} onChange={e => setScrollWidth(parseInt(e.target.value, 10))} />
            </Field>
            <Field id="scrollbar-thumb" label="Thumb Color">
              <TextInput id="scrollbar-thumb" type="text" value={scrollThumbColor} onChange={e => setScrollThumbColor(e.target.value)} />
            </Field>
            <Field id="scrollbar-track" label="Track Background">
              <TextInput id="scrollbar-track" type="text" value={scrollTrackColor} onChange={e => setScrollTrackColor(e.target.value)} />
            </Field>
            <Field id="scrollbar-radius" label={`Thumb Radius (${scrollRadius}px)`}>
              <RangeInput id="scrollbar-radius" min="0" max="20" value={scrollRadius} onChange={e => setScrollRadius(parseInt(e.target.value, 10))} />
            </Field>
          </>
        )}
      </Panel>

      <Panel
        title="Preview & Generated CSS"
        headingId={`${activeToolId}-output`}
        actions={<Button size="sm" onClick={() => copyText(generatedCss, "css")}>{copied === "css" ? "Copied" : "Copy CSS"}</Button>}
        padded
      >
        <CanvasStage kind="html" label={`${definition.name} preview`} background="plain">
          {activeToolId === "css-grid-generator" && (
            <div
              className={styles.previewSurface}
              style={{ display: "grid", gridTemplateColumns: gridCols, gridTemplateRows: gridRows, gap: `${gridGap}px` }}
            >
              <div className={styles.gridItem}>Header</div>
              <div className={styles.gridItem}>Content Area</div>
              <div className={styles.gridItem}>Sidebar</div>
              <div className={styles.gridItem}>Footer</div>
            </div>
          )}

          {activeToolId === "flexbox-playground" && (
            <div
              className={styles.previewSurface}
              style={{ display: "flex", flexDirection: flexDir, justifyContent: flexJustify, alignItems: flexAlign, gap: `${flexGap}px`, padding: "1rem" }}
            >
              {Array.from({ length: flexItemsCount }).map((_, i) => (
                <div key={i} className={styles.flexItem}>Item {i + 1}</div>
              ))}
            </div>
          )}

          {activeToolId === "css-animation-builder" && (
            <>
              <style>{`
                @keyframes customLivePulse {
                  0% { transform: scale(1) rotate(0deg); }
                  50% { transform: scale(${animScale}) rotate(${animRotate}deg); }
                  100% { transform: scale(1) rotate(0deg); }
                }
              `}</style>
              <div className={styles.animatedBox} style={{ animation: `customLivePulse ${animDuration}s ${animTiming} infinite` }}>Pulse</div>
            </>
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
                <span style={{ fontSize: "0.8rem", opacity: 0.8, marginTop: "4px" }}>blur: {glassBlur}px</span>
              </div>
            </div>
          )}

          {activeToolId === "clip-path-maker" && (
            <div className={styles.clippedBox} style={{ clipPath: CLIP_PATH_PRESETS[clipShape], WebkitClipPath: CLIP_PATH_PRESETS[clipShape] }}>
              {clipShape}
            </div>
          )}

          {activeToolId === "scrollbar-generator" && (
            <>
              <style>{`
                .custom-scroll-demo::-webkit-scrollbar { width: ${scrollWidth}px; }
                .custom-scroll-demo::-webkit-scrollbar-track { background: ${scrollTrackColor}; border-radius: ${scrollRadius}px; }
                .custom-scroll-demo::-webkit-scrollbar-thumb { background: ${scrollThumbColor}; border-radius: ${scrollRadius}px; }
              `}</style>
              <div className={`${styles.scrollBox} custom-scroll-demo`}>
                <p>Scroll down to test custom styling!</p>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate.</p>
                <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
              </div>
            </>
          )}
        </CanvasStage>

        <h3 className={styles.subhead}>Generated CSS</h3>
        <pre className={ui.output} tabIndex={0} aria-label="Generated CSS"><code>{generatedCss}</code></pre>
      </Panel>
    </ToolLayout>
  );
}
