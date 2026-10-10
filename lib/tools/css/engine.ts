/**
 * Code Station: Frontend & CSS Playground Engine
 * Pure in-browser CSS generation for Grid, Flexbox, Animations, Glassmorphism, Clip-Path, Scrollbar.
 */

/** ----------------------------------------------------
 * 1. CSS Grid Generator
 * --------------------------------------------------- */
export interface GridConfig {
  columns: string; // e.g. "1fr 2fr 1fr"
  rows: string; // e.g. "auto 1fr auto"
  columnGap: number; // px
  rowGap: number; // px
  areas?: string[][]; // 2D array of area names
}

export function generateCssGrid(config: GridConfig): { css: string; html: string } {
  const { columns, rows, columnGap, rowGap, areas } = config;

  let css = `.grid-container {\n  display: grid;\n  grid-template-columns: ${columns};\n  grid-template-rows: ${rows};\n  gap: ${rowGap}px ${columnGap}px;\n`;

  const uniqueAreas = new Set<string>();
  if (areas && areas.length > 0) {
    const areaLines = areas.map((row) => `    "${row.join(" ")}"`).join("\n");
    css += `  grid-template-areas:\n${areaLines};\n`;
    areas.forEach((r) => r.forEach((a) => { if (a && a !== ".") uniqueAreas.add(a); }));
  }
  css += `}\n`;

  let itemCss = "";
  let html = `<div class="grid-container">\n`;

  if (uniqueAreas.size > 0) {
    Array.from(uniqueAreas).forEach((area) => {
      itemCss += `\n.${area} {\n  grid-area: ${area};\n}\n`;
      html += `  <div class="${area}">${area.charAt(0).toUpperCase() + area.slice(1)}</div>\n`;
    });
  } else {
    // Generate standard numbered cells
    const colCount = columns.trim().split(/\s+/).length;
    const rowCount = rows.trim().split(/\s+/).length;
    const totalCells = colCount * rowCount;
    for (let i = 1; i <= totalCells; i++) {
      html += `  <div class="grid-item">Item ${i}</div>\n`;
    }
  }
  html += `</div>`;

  return { css: css + itemCss, html };
}

/** ----------------------------------------------------
 * 2. Flexbox Playground
 * --------------------------------------------------- */
export interface FlexItemConfig {
  id: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "baseline" | "stretch";
}

export interface FlexConfig {
  flexDirection: "row" | "row-reverse" | "column" | "column-reverse";
  flexWrap: "nowrap" | "wrap" | "wrap-reverse";
  justifyContent: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
  alignItems: "stretch" | "flex-start" | "flex-end" | "center" | "baseline";
  alignContent: "stretch" | "flex-start" | "flex-end" | "center" | "space-between" | "space-around";
  gap: number;
  items?: FlexItemConfig[];
}

export function generateFlexbox(config: FlexConfig): { css: string; html: string } {
  const { flexDirection, flexWrap, justifyContent, alignItems, alignContent, gap, items = [] } = config;

  let css = `.flex-container {\n  display: flex;\n  flex-direction: ${flexDirection};\n  flex-wrap: ${flexWrap};\n  justify-content: ${justifyContent};\n  align-items: ${alignItems};\n  align-content: ${alignContent};\n  gap: ${gap}px;\n}\n`;

  let itemCss = "";
  let html = `<div class="flex-container">\n`;

  items.forEach((item, index) => {
    html += `  <div class="flex-item flex-item-${item.id}">Item ${item.id}</div>\n`;
    if (
      (item.flexGrow !== undefined && item.flexGrow !== 0) ||
      (item.flexShrink !== undefined && item.flexShrink !== 1) ||
      (item.flexBasis !== undefined && item.flexBasis !== "auto") ||
      (item.alignSelf && item.alignSelf !== "auto")
    ) {
      itemCss += `\n.flex-item-${item.id} {\n`;
      if (item.flexGrow !== undefined) itemCss += `  flex-grow: ${item.flexGrow};\n`;
      if (item.flexShrink !== undefined) itemCss += `  flex-shrink: ${item.flexShrink};\n`;
      if (item.flexBasis !== undefined) itemCss += `  flex-basis: ${item.flexBasis};\n`;
      if (item.alignSelf) itemCss += `  align-self: ${item.alignSelf};\n`;
      itemCss += `}\n`;
    }
  });

  html += `</div>`;
  return { css: css + itemCss, html };
}

/** ----------------------------------------------------
 * 3. CSS Animation Builder
 * --------------------------------------------------- */
export interface KeyframeStep {
  percent: number; // 0 to 100
  transform?: string;
  opacity?: number;
  backgroundColor?: string;
  borderRadius?: string;
}

export interface AnimationConfig {
  name: string;
  duration: number; // in seconds
  timingFunction: "ease" | "linear" | "ease-in" | "ease-out" | "ease-in-out";
  iterationCount: "infinite" | "1" | "2" | "3";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  keyframes: KeyframeStep[];
}

export function generateCssAnimation(config: AnimationConfig): { css: string; animationProperty: string } {
  const { name, duration, timingFunction, iterationCount, direction, keyframes } = config;

  const sorted = [...keyframes].sort((a, b) => a.percent - b.percent);

  let kfCss = `@keyframes ${name || "customAnimation"} {\n`;
  sorted.forEach((kf) => {
    kfCss += `  ${kf.percent}% {\n`;
    if (kf.transform) kfCss += `    transform: ${kf.transform};\n`;
    if (kf.opacity !== undefined) kfCss += `    opacity: ${kf.opacity};\n`;
    if (kf.backgroundColor) kfCss += `    background-color: ${kf.backgroundColor};\n`;
    if (kf.borderRadius) kfCss += `    border-radius: ${kf.borderRadius};\n`;
    kfCss += `  }\n`;
  });
  kfCss += `}\n\n`;

  const animProp = `${name || "customAnimation"} ${duration}s ${timingFunction} ${iterationCount} ${direction}`;
  const ruleCss = `.animated-element {\n  animation: ${animProp};\n}\n`;

  return { css: kfCss + ruleCss, animationProperty: animProp };
}

/** ----------------------------------------------------
 * 4. Glassmorphism Generator
 * --------------------------------------------------- */
export interface GlassConfig {
  blur: number; // px, 0-40
  transparency: number; // 0-1
  baseColor: string; // hex
  borderWidth: number; // px
  borderOpacity: number; // 0-1
  borderRadius: number; // px
  shadowElevation: number; // 0-100
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function generateGlassmorphism(config: GlassConfig): string {
  const { blur, transparency, baseColor, borderWidth, borderOpacity, borderRadius, shadowElevation } = config;
  const [r, g, b] = hexToRgb(baseColor || "#ffffff");

  const shadowAlpha = (shadowElevation / 100) * 0.35;
  const shadowSpread = Math.round(shadowElevation * 0.4);

  return `.glass-card {
  background: rgba(${r}, ${g}, ${b}, ${transparency.toFixed(2)});
  backdrop-filter: blur(${blur}px);
  -webkit-backdrop-filter: blur(${blur}px);
  border-radius: ${borderRadius}px;
  border: ${borderWidth}px solid rgba(255, 255, 255, ${borderOpacity.toFixed(2)});
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, ${shadowAlpha.toFixed(2)});
}`;
}

/** ----------------------------------------------------
 * 5. Clip-Path Polygon Maker
 * --------------------------------------------------- */
export const CLIP_PATH_PRESETS: Record<string, string> = {
  Triangle: "polygon(50% 0%, 0% 100%, 100% 100%)",
  Trapezoid: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
  Parallelogram: "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)",
  Rhombus: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  Pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  Hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  Octagon: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  Star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  Cross: "polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)",
  Arrow: "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)",
  "Message Bubble": "polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 75% 100%, 50% 75%, 0% 75%)",
};

export function generateClipPath(presetName: string, customPolygon?: string): string {
  const polygon = customPolygon || CLIP_PATH_PRESETS[presetName] || CLIP_PATH_PRESETS["Triangle"];
  return `.clipped-element {\n  clip-path: ${polygon};\n  -webkit-clip-path: ${polygon};\n}`;
}

/** ----------------------------------------------------
 * 6. Custom Scrollbar Generator
 * --------------------------------------------------- */
export interface ScrollbarConfig {
  width: number; // px
  trackBackground: string;
  thumbBackground: string;
  thumbHoverBackground: string;
  borderRadius: number; // px
}

export function generateScrollbar(config: ScrollbarConfig): string {
  const { width, trackBackground, thumbBackground, thumbHoverBackground, borderRadius } = config;

  return `/* Modern standard Firefox & Chrome */
* {
  scrollbar-width: thin;
  scrollbar-color: ${thumbBackground} ${trackBackground};
}

/* WebKit (Chrome, Safari, Edge, Opera) */
::-webkit-scrollbar {
  width: ${width}px;
  height: ${width}px;
}

::-webkit-scrollbar-track {
  background: ${trackBackground};
  border-radius: ${borderRadius}px;
}

::-webkit-scrollbar-thumb {
  background: ${thumbBackground};
  border-radius: ${borderRadius}px;
}

::-webkit-scrollbar-thumb:hover {
  background: ${thumbHoverBackground};
}
`;
}
