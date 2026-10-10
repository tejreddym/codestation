import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const cssPlaygroundToolIds = [
  "css-grid-generator",
  "flexbox-playground",
  "css-animation-builder",
  "glassmorphism-generator",
  "clip-path-maker",
  "scrollbar-generator",
] as const;

export type CssPlaygroundToolId = (typeof cssPlaygroundToolIds)[number];

const notice =
  "100% in-browser visual CSS generator. Sliders, matrix values, and previews are computed locally with zero server requests.";

const define = (
  id: CssPlaygroundToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<CssPlaygroundToolId> =>
  localDefinition(id, title, "Frontend & CSS", fields, outputs, defaults, [notice, ...extra], "Generate");

export const cssPlaygroundTools: readonly LocalDefinition<CssPlaygroundToolId>[] = [
  define(
    "css-grid-generator",
    "CSS Grid Visual Generator",
    [
      { name: "columns", label: "Grid Columns (e.g. 1fr 2fr 1fr)", control: "text" },
      { name: "rows", label: "Grid Rows (e.g. auto 1fr auto)", control: "text" },
      { name: "gap", label: "Grid Gap (px)", control: "number", min: 0, max: 100 },
    ],
    ["CSS Grid rules", "HTML structure", "Interactive grid preview"],
    { columns: "200px 1fr", rows: "60px 1fr 40px", gap: 16 }
  ),
  define(
    "flexbox-playground",
    "Flexbox Visual Playground",
    [
      { name: "flexDirection", label: "Direction", control: "select", options: ["row", "row-reverse", "column", "column-reverse"] },
      { name: "justifyContent", label: "Justify Content", control: "select", options: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"] },
      { name: "alignItems", label: "Align Items", control: "select", options: ["stretch", "flex-start", "center", "flex-end", "baseline"] },
      { name: "gap", label: "Item Gap (px)", control: "number", min: 0, max: 80 },
    ],
    ["CSS Flexbox container rules", "Item flex rules", "Interactive flex preview"],
    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }
  ),
  define(
    "css-animation-builder",
    "CSS Keyframe Animation Builder",
    [
      { name: "name", label: "Animation Name", control: "text" },
      { name: "duration", label: "Duration (seconds)", control: "number", min: 0.1, max: 20 },
      { name: "timingFunction", label: "Timing Function", control: "select", options: ["ease", "linear", "ease-in", "ease-out", "ease-in-out"] },
    ],
    ["@keyframes CSS rule", "Animation shorthand", "Live animated preview"],
    { name: "bounceScale", duration: 1.5, timingFunction: "ease-in-out" }
  ),
  define(
    "glassmorphism-generator",
    "Glassmorphism & Neumorphism Generator",
    [
      { name: "blur", label: "Backdrop Blur (px)", control: "number", min: 0, max: 40 },
      { name: "transparency", label: "Transparency (Alpha)", control: "number", min: 0, max: 100 },
      { name: "borderRadius", label: "Border Radius (px)", control: "number", min: 0, max: 50 },
    ],
    ["CSS backdrop-filter", "Background RGBA", "Specular border", "Live preview"],
    { blur: 16, transparency: 25, borderRadius: 16 }
  ),
  define(
    "clip-path-maker",
    "Clip-Path Polygon Maker",
    [
      { name: "shape", label: "Preset Shape", control: "select", options: ["Star", "Triangle", "Trapezoid", "Parallelogram", "Rhombus", "Pentagon", "Hexagon", "Octagon", "Cross", "Arrow", "Message Bubble"] },
    ],
    ["CSS clip-path: polygon(...)", "Vendor prefix (-webkit)", "Interactive preview"],
    { shape: "Star" }
  ),
  define(
    "scrollbar-generator",
    "Custom Scrollbar Generator",
    [
      { name: "width", label: "Scrollbar Width (px)", control: "number", min: 2, max: 32 },
      { name: "thumbColor", label: "Thumb Color", control: "text" },
      { name: "trackColor", label: "Track Color", control: "text" },
    ],
    ["Modern CSS scrollbar-color", "WebKit ::-webkit-scrollbar rules", "Interactive scroll box"],
    { width: 8, thumbColor: "#3b82f6", trackColor: "#1e1e1e" }
  ),
];

export const getCssPlaygroundDefinition = (id: string) => cssPlaygroundTools.find((tool) => tool.id === id);
export const isCssPlaygroundToolId = (id: string): id is CssPlaygroundToolId => (cssPlaygroundToolIds as readonly string[]).includes(id);
