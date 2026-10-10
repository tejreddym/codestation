import { describe, expect, it } from "vitest";
import {
  generateCssGrid,
  generateFlexbox,
  generateCssAnimation,
  generateGlassmorphism,
  generateClipPath,
  generateScrollbar,
} from "./engine";

describe("CSS playground engine", () => {
  it("generates CSS Grid layout with areas", () => {
    const grid = generateCssGrid({
      columns: "200px 1fr",
      rows: "60px 1fr 40px",
      columnGap: 16,
      rowGap: 16,
      areas: [
        ["header", "header"],
        ["sidebar", "main"],
        ["footer", "footer"],
      ],
    });
    expect(grid.css).toContain("display: grid;");
    expect(grid.css).toContain("grid-template-columns: 200px 1fr;");
    expect(grid.css).toContain(".header {");
    expect(grid.html).toContain('<div class="header">Header</div>');
  });

  it("generates Flexbox properties and item rules", () => {
    const flex = generateFlexbox({
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      alignContent: "stretch",
      gap: 12,
      items: [{ id: 1, flexGrow: 1 }, { id: 2, flexGrow: 2 }],
    });
    expect(flex.css).toContain("display: flex;");
    expect(flex.css).toContain("justify-content: space-between;");
    expect(flex.css).toContain(".flex-item-1 {\n  flex-grow: 1;");
    expect(flex.html).toContain('<div class="flex-item flex-item-1">Item 1</div>');
  });

  it("generates CSS Animation keyframes and animation shorthand", () => {
    const anim = generateCssAnimation({
      name: "pulseScale",
      duration: 1.5,
      timingFunction: "ease-in-out",
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        { percent: 0, transform: "scale(1)", opacity: 1 },
        { percent: 100, transform: "scale(1.2)", opacity: 0.8 },
      ],
    });
    expect(anim.css).toContain("@keyframes pulseScale {");
    expect(anim.css).toContain("0% {\n    transform: scale(1);\n    opacity: 1;");
    expect(anim.css).toContain("animation: pulseScale 1.5s ease-in-out infinite alternate;");
  });

  it("generates Glassmorphism CSS with backdrop filter", () => {
    const glass = generateGlassmorphism({
      blur: 16,
      transparency: 0.25,
      baseColor: "#ffffff",
      borderWidth: 1,
      borderOpacity: 0.2,
      borderRadius: 12,
      shadowElevation: 50,
    });
    expect(glass).toContain("backdrop-filter: blur(16px);");
    expect(glass).toContain("-webkit-backdrop-filter: blur(16px);");
    expect(glass).toContain("background: rgba(255, 255, 255, 0.25);");
    expect(glass).toContain("border-radius: 12px;");
  });

  it("generates Clip-Path presets", () => {
    const star = generateClipPath("Star");
    expect(star).toContain("clip-path: polygon(");
    expect(star).toContain("-webkit-clip-path: polygon(");
  });

  it("generates custom scrollbar styles for WebKit and modern Firefox", () => {
    const scroll = generateScrollbar({
      width: 8,
      trackBackground: "#1e1e1e",
      thumbBackground: "#3b82f6",
      thumbHoverBackground: "#60a5fa",
      borderRadius: 4,
    });
    expect(scroll).toContain("scrollbar-color: #3b82f6 #1e1e1e;");
    expect(scroll).toContain("::-webkit-scrollbar");
    expect(scroll).toContain("::-webkit-scrollbar-thumb:hover");
  });
});
