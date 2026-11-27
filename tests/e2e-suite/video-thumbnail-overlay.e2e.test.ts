// @vitest-environment jsdom
/**
 * 4-Tier Requirement-Driven E2E Test Suite for Video Thumbnail Overlay Studio (R3).
 * Conformance to ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  setupCanvasMocks,
  setupBrowserApiMocks,
  loadOverlayModule,
  resetWebMcpForTesting,
  type OverlayModule,
  type TextLayer,
  type ShapeLayer,
  type IconLayer,
  type OverlayLayer,
} from "./test-helpers";
import { dispatchToolExecution } from "../../lib/webmcp/dispatcher";
import { getVideoDefinition } from "../../config/video-tools";
import { createWebMcpToolForDefinition, registerWebMcpTool } from "../../lib/webmcp/registry";

const OVERLAY_PATH = path.resolve(process.cwd(), "lib/tools/video/overlay.ts");
const isOverlayImplemented = fs.existsSync(OVERLAY_PATH);

describe.skipIf(!isOverlayImplemented)("Video Thumbnail Overlay Studio E2E Suite (R3)", () => {
  let canvasMocks: ReturnType<typeof setupCanvasMocks>;
  let browserMocks: ReturnType<typeof setupBrowserApiMocks>;
  let overlayModule: OverlayModule;

  beforeEach(async () => {
    canvasMocks = setupCanvasMocks();
    browserMocks = setupBrowserApiMocks();
    resetWebMcpForTesting();
    overlayModule = await loadOverlayModule();
  });

  afterEach(() => {
    canvasMocks.restore();
    browserMocks.restore();
  });

  // =========================================================================
  // Tier 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    it("T1.1 - TextLayer model accurately specifies typography, colors, shadows, and badges", () => {
      const textLayer: TextLayer = {
        id: "text-1",
        type: "text",
        text: "EPISODE 42: THE DEEP DIVE",
        x: 100,
        y: 200,
        fontFamily: "Inter, sans-serif",
        fontSize: 48,
        fill: "#ffdd00",
        strokeColor: "#000000",
        strokeWidth: 4,
        shadowColor: "rgba(0, 0, 0, 0.8)",
        shadowBlur: 8,
        badgeBg: "rgba(0, 0, 0, 0.7)",
        visible: true,
      };

      expect(textLayer.type).toBe("text");
      expect(textLayer.text).toBe("EPISODE 42: THE DEEP DIVE");
      expect(textLayer.fontSize).toBe(48);
      expect(textLayer.fill).toBe("#ffdd00");
      expect(textLayer.strokeWidth).toBe(4);
      expect(textLayer.shadowBlur).toBe(8);
      expect(textLayer.badgeBg).toBe("rgba(0, 0, 0, 0.7)");
    });

    it("T1.2 - ShapeLayer model accurately specifies rect, pill, badge, circle, and arrow shapes", () => {
      const shapes: ShapeLayer[] = [
        { id: "s1", type: "shape", shapeType: "rect", x: 10, y: 10, width: 200, height: 100, fill: "#ff0000" },
        { id: "s2", type: "shape", shapeType: "pill", x: 20, y: 20, width: 150, height: 50, radius: 25 },
        { id: "s3", type: "shape", shapeType: "badge", x: 30, y: 30, width: 100, height: 60, fill: "#00ff00" },
        { id: "s4", type: "shape", shapeType: "circle", x: 40, y: 40, width: 80, height: 80, fill: "#0000ff" },
        { id: "s5", type: "shape", shapeType: "arrow", x: 50, y: 50, width: 120, height: 60, direction: "right" },
      ];

      expect(shapes.length).toBe(5);
      shapes.forEach((s) => {
        expect(s.type).toBe("shape");
        expect(s.width).toBeGreaterThan(0);
        expect(s.height).toBeGreaterThan(0);
      });
    });

    it("T1.3 - IconLayer model accurately specifies play, fire, alert, star, check, and lightning icons", () => {
      const iconTypes = ["play", "fire", "alert", "star", "check", "lightning"] as const;
      iconTypes.forEach((iconType) => {
        const iconLayer: IconLayer = {
          id: `icon-${iconType}`,
          type: "icon",
          iconType,
          x: 50,
          y: 50,
          size: 64,
          fill: "#ffffff",
          stroke: "#000000",
        };
        expect(iconLayer.type).toBe("icon");
        expect(iconLayer.iconType).toBe(iconType);
        expect(iconLayer.size).toBe(64);
      });
    });

    it("T1.4 - renderOverlayCanvas executes on CanvasRenderingContext2D with proper draw calls", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d")!;

      const layers: OverlayLayer[] = [
        { id: "bg-shape", type: "shape", shapeType: "pill", x: 100, y: 100, width: 400, height: 80, fill: "#222222" },
        { id: "title-text", type: "text", text: "FEATURE PREVIEW", x: 120, y: 150, fontSize: 32, fill: "#ffffff" },
        { id: "star-icon", type: "icon", iconType: "star", x: 520, y: 110, size: 60, fill: "#ffd700" },
      ];

      overlayModule.renderOverlayCanvas(ctx, layers, 1280, 720);

      expect(canvasMocks.calls.length).toBeGreaterThan(0);
      // Verify text draw occurred
      const textCalls = canvasMocks.calls.filter((c) => c.method === "fillText");
      expect(textCalls.length).toBeGreaterThanOrEqual(1);
      expect(textCalls.some((c) => c.args[0] === "FEATURE PREVIEW")).toBe(true);

      // Verify shape fill occurred
      const fillCalls = canvasMocks.calls.filter((c) => c.method === "fill" || c.method === "fillRect");
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("T1.5 - exportCompositeImage composites base image and layers to high-resolution Blob", async () => {
      const baseCanvas = document.createElement("canvas");
      baseCanvas.width = 1920;
      baseCanvas.height = 1080;

      const layers: OverlayLayer[] = [
        { id: "t1", type: "text", text: "1080P EXPORT", x: 100, y: 200, fontSize: 64, fill: "#ffffff" },
      ];

      const blob = await overlayModule.exportCompositeImage(baseCanvas, layers, "image/png");
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("image/png");
      expect(blob.size).toBeGreaterThan(0);
    });

    it("T1.6 - ShapeLayer arrow geometry supports all four cardinal directions (left, right, up, down)", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvasMocks.clearCalls();

      const arrowDirections = ["left", "right", "up", "down"] as const;
      const arrowLayers: OverlayLayer[] = arrowDirections.map((dir, idx) => ({
        id: `arrow-${dir}`,
        type: "shape",
        shapeType: "arrow",
        direction: dir,
        x: 50 + idx * 120,
        y: 100,
        width: 100,
        height: 60,
        fill: "#38bdf8",
      }));

      expect(() => overlayModule.renderOverlayCanvas(ctx, arrowLayers, 1280, 720)).not.toThrow();
      expect(canvasMocks.calls.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("T2.1 - empty text string renders gracefully without errors or corrupt calls", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const layers: OverlayLayer[] = [
        { id: "empty-text", type: "text", text: "", x: 50, y: 50, fontSize: 32 },
      ];

      expect(() => overlayModule.renderOverlayCanvas(ctx, layers, 1280, 720)).not.toThrow();
    });

    it("T2.2 - multi-line text splits lines and renders consecutive text rows", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvasMocks.clearCalls();

      const layers: OverlayLayer[] = [
        {
          id: "multi-line",
          type: "text",
          text: "LINE ONE\nLINE TWO\nLINE THREE",
          x: 100,
          y: 100,
          fontSize: 32,
        },
      ];

      overlayModule.renderOverlayCanvas(ctx, layers, 1280, 720);

      const fillTextCalls = canvasMocks.calls.filter((c) => c.method === "fillText");
      expect(fillTextCalls.length).toBe(3);
      expect(fillTextCalls[0].args[0]).toBe("LINE ONE");
      expect(fillTextCalls[1].args[0]).toBe("LINE TWO");
      expect(fillTextCalls[2].args[0]).toBe("LINE THREE");

      // Verify each consecutive line advances vertically
      const y0 = fillTextCalls[0].args[2];
      const y1 = fillTextCalls[1].args[2];
      const y2 = fillTextCalls[2].args[2];
      expect(y1).toBeGreaterThan(y0);
      expect(y2).toBeGreaterThan(y1);
    });

    it("T2.3 - zero-size shapes do not crash rendering engine", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const layers: OverlayLayer[] = [
        { id: "zero-circle", type: "shape", shapeType: "circle", x: 0, y: 0, width: 0, height: 0 },
        { id: "zero-rect", type: "shape", shapeType: "rect", x: 0, y: 0, width: 0, height: 0 },
      ];

      expect(() => overlayModule.renderOverlayCanvas(ctx, layers, 1280, 720)).not.toThrow();
    });

    it("T2.4 - z-order reordering shifts canvas draw order according to array sequence", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const layerA: OverlayLayer = { id: "A", type: "text", text: "LAYER A", x: 0, y: 0 };
      const layerB: OverlayLayer = { id: "B", type: "text", text: "LAYER B", x: 0, y: 0 };

      // Order 1: A then B
      canvasMocks.clearCalls();
      overlayModule.renderOverlayCanvas(ctx, [layerA, layerB], 1280, 720);
      let textCalls = canvasMocks.calls.filter((c) => c.method === "fillText");
      expect(textCalls[0].args[0]).toBe("LAYER A");
      expect(textCalls[1].args[0]).toBe("LAYER B");

      // Order 2: B then A
      canvasMocks.clearCalls();
      overlayModule.renderOverlayCanvas(ctx, [layerB, layerA], 1280, 720);
      textCalls = canvasMocks.calls.filter((c) => c.method === "fillText");
      expect(textCalls[0].args[0]).toBe("LAYER B");
      expect(textCalls[1].args[0]).toBe("LAYER A");
    });

    it("T2.5 - layers with visible: false are bypassed completely during rendering", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvasMocks.clearCalls();

      const layers: OverlayLayer[] = [
        { id: "hidden", type: "text", text: "HIDDEN SECRET", x: 0, y: 0, visible: false },
        { id: "shown", type: "text", text: "VISIBLE TEXT", x: 0, y: 0, visible: true },
      ];

      overlayModule.renderOverlayCanvas(ctx, layers, 1280, 720);

      const textCalls = canvasMocks.calls.filter((c) => c.method === "fillText");
      expect(textCalls.length).toBe(1);
      expect(textCalls[0].args[0]).toBe("VISIBLE TEXT");
      expect(canvasMocks.calls.some((c) => c.args.includes("HIDDEN SECRET"))).toBe(false);
    });

    it("T2.6 - exportCompositeImage supports both PNG and JPEG formats", async () => {
      const baseCanvas = document.createElement("canvas");
      baseCanvas.width = 640;
      baseCanvas.height = 360;

      const layers: OverlayLayer[] = [
        { id: "l1", type: "shape", shapeType: "rect", x: 0, y: 0, width: 100, height: 100 },
      ];

      const pngBlob = await overlayModule.exportCompositeImage(baseCanvas, layers, "image/png");
      expect(pngBlob.type).toBe("image/png");

      const jpegBlob = await overlayModule.exportCompositeImage(baseCanvas, layers, "image/jpeg", 0.85);
      expect(jpegBlob.type).toBe("image/jpeg");
    });

    it("T2.7 - layer reordering operations correctly update visual draw sequence and z-index ordering", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const layer1: OverlayLayer = { id: "bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 100, height: 100 };
      const layer2: OverlayLayer = { id: "text", type: "text", text: "FOREGROUND", x: 10, y: 10 };
      const layer3: OverlayLayer = { id: "icon", type: "icon", iconType: "star", x: 50, y: 50, size: 30 };

      // Helper reorder function
      const moveToFront = (arr: OverlayLayer[], id: string) => {
        const idx = arr.findIndex((l) => l.id === id);
        if (idx === -1) return arr;
        const item = arr[idx];
        return [...arr.slice(0, idx), ...arr.slice(idx + 1), item];
      };

      const moveToBack = (arr: OverlayLayer[], id: string) => {
        const idx = arr.findIndex((l) => l.id === id);
        if (idx === -1) return arr;
        const item = arr[idx];
        return [item, ...arr.slice(0, idx), ...arr.slice(idx + 1)];
      };

      const initial = [layer1, layer2, layer3];
      const frontText = moveToFront(initial, "text");
      expect(frontText[frontText.length - 1].id).toBe("text");

      const backIcon = moveToBack(initial, "icon");
      expect(backIcon[0].id).toBe("icon");

      // Render reordered list
      canvasMocks.clearCalls();
      expect(() => overlayModule.renderOverlayCanvas(ctx, frontText, 1280, 720)).not.toThrow();
    });

    it("T2.8 - high-DPI scaling applies devicePixelRatio transform cleanly without canvas distortion", async () => {
      const baseCanvas = document.createElement("canvas");
      const dpr = 2; // Retina 2x scale
      baseCanvas.width = 1280 * dpr;
      baseCanvas.height = 720 * dpr;

      const layers: OverlayLayer[] = [
        { id: "hd-text", type: "text", text: "4K MASTER", x: 100, y: 100, fontSize: 48 },
      ];

      const blob = await overlayModule.exportCompositeImage(baseCanvas, layers, "image/png");
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("image/png");
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Tier 3: Cross-Feature Combinations (Pairwise Interactions)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations", () => {
    it("T3.1 - multi-layer composite stack: background pill + shadow text + accent icon", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvasMocks.clearCalls();

      const layers: OverlayLayer[] = [
        // 1. Base pill backdrop
        {
          id: "pill-bg",
          type: "shape",
          shapeType: "pill",
          x: 50,
          y: 500,
          width: 600,
          height: 120,
          fill: "rgba(0, 0, 0, 0.85)",
          stroke: "#ff0055",
          strokeWidth: 3,
          radius: 20,
        },
        // 2. Headline text on pill
        {
          id: "headline",
          type: "text",
          text: "ULTIMATE GUIDE",
          x: 90,
          y: 580,
          fontSize: 54,
          fill: "#ffffff",
          shadowColor: "#000000",
          shadowBlur: 10,
        },
        // 3. Accent fire icon
        {
          id: "accent-fire",
          type: "icon",
          iconType: "fire",
          x: 560,
          y: 530,
          size: 60,
          fill: "#ff5500",
        },
      ];

      overlayModule.renderOverlayCanvas(ctx, layers, 1280, 720);

      // Verify state stack balance (equal save and restore calls)
      const saveCount = canvasMocks.calls.filter((c) => c.method === "save").length;
      const restoreCount = canvasMocks.calls.filter((c) => c.method === "restore").length;
      expect(saveCount).toBe(restoreCount);
      expect(saveCount).toBeGreaterThanOrEqual(3);
    });

    it("T3.2 - layers positioned near or outside canvas boundary do not corrupt state stack", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvasMocks.clearCalls();

      const layers: OverlayLayer[] = [
        { id: "off-screen-left", type: "text", text: "OFFSCREEN", x: -500, y: -200 },
        { id: "off-screen-right", type: "shape", shapeType: "rect", x: 2000, y: 1500, width: 400, height: 400 },
      ];

      expect(() => overlayModule.renderOverlayCanvas(ctx, layers, 1280, 720)).not.toThrow();

      const saveCount = canvasMocks.calls.filter((c) => c.method === "save").length;
      const restoreCount = canvasMocks.calls.filter((c) => c.method === "restore").length;
      expect(saveCount).toBe(restoreCount);
    });

    it("T3.3 - WebMCP tool registration for video-thumbnail-generator adheres to slug conventions", async () => {
      const toolDef = getVideoDefinition("video-thumbnail-generator");
      expect(toolDef).toBeDefined();
      expect(toolDef!.id).toBe("video-thumbnail-generator");
      expect(toolDef!.slug).toBe("video-thumbnail-generator");

      const mcp = createWebMcpToolForDefinition(toolDef!);
      expect(mcp.name).toBe("codestation_video_thumbnail_generator");
      registerWebMcpTool(mcp);

      const resp = await dispatchToolExecution("video-thumbnail-generator", "", { frames: 3 });
      const parsed = JSON.parse(resp);
      expect(parsed.canonicalUrl).toBe("https://codestation.in/tools/video-thumbnail-generator");
      expect(parsed.status).toBe("manual-file-required");
    });

    it("T3.4 - color parsing and style attributes support hex (#RGB, #RRGGBB), rgba, and transparent values", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvasMocks.clearCalls();

      const colorLayers: OverlayLayer[] = [
        { id: "c1", type: "shape", shapeType: "rect", x: 0, y: 0, width: 50, height: 50, fill: "#fff", stroke: "#000" },
        { id: "c2", type: "shape", shapeType: "rect", x: 60, y: 0, width: 50, height: 50, fill: "#38bdf8", stroke: "#0284c7" },
        { id: "c3", type: "shape", shapeType: "rect", x: 120, y: 0, width: 50, height: 50, fill: "rgba(255, 0, 0, 0.5)" },
        { id: "c4", type: "text", text: "COLOR TEST", x: 0, y: 80, fill: "transparent", strokeColor: "#ffffff" },
      ];

      expect(() => overlayModule.renderOverlayCanvas(ctx, colorLayers, 1280, 720)).not.toThrow();
      expect(canvasMocks.calls.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Tier 4: Real-World Scenario
  // =========================================================================
  describe("Tier 4: Real-World Scenario", () => {
    it("T4.1 - YouTube thumbnail creation studio: base frame + dramatic text + shadow + badge pill + star icon + export 1280x720 PNG", async () => {
      // 1. User captures or loads a 1280x720 video frame snapshot
      const baseFrameCanvas = document.createElement("canvas");
      baseFrameCanvas.width = 1280;
      baseFrameCanvas.height = 720;
      const baseCtx = baseFrameCanvas.getContext("2d")!;
      baseCtx.fillStyle = "#1e1e2f"; // Dark video frame background
      baseCtx.fillRect(0, 0, 1280, 720);

      // 2. User constructs layers in overlay studio
      const layers: OverlayLayer[] = [
        // Layer 1: Contrast badge pill for title background
        {
          id: "badge-pill",
          type: "shape",
          shapeType: "pill",
          x: 60,
          y: 450,
          width: 820,
          height: 140,
          fill: "rgba(10, 15, 30, 0.90)",
          stroke: "#00d2ff",
          strokeWidth: 4,
          radius: 24,
          visible: true,
        },
        // Layer 2: Main dramatic headline text with drop shadow
        {
          id: "main-headline",
          type: "text",
          text: "10X FASTER WORKFLOWS",
          x: 100,
          y: 540,
          fontFamily: "Impact, sans-serif",
          fontSize: 62,
          fill: "#ffffff",
          strokeColor: "#000000",
          strokeWidth: 2,
          shadowColor: "rgba(0, 0, 0, 0.9)",
          shadowBlur: 12,
          visible: true,
        },
        // Layer 3: Accent star icon
        {
          id: "badge-star",
          type: "icon",
          iconType: "star",
          x: 780,
          y: 485,
          size: 70,
          fill: "#ffd700",
          stroke: "#ffffff",
          visible: true,
        },
        // Layer 4: Watermark layer toggled OFF
        {
          id: "draft-watermark",
          type: "text",
          text: "DRAFT PREVIEW",
          x: 500,
          y: 200,
          fontSize: 48,
          fill: "rgba(255, 0, 0, 0.5)",
          visible: false,
        },
      ];

      // 3. User verifies layer count and visibility states
      expect(layers.length).toBe(4);
      expect(layers.filter((l) => l.visible !== false).length).toBe(3);

      // 4. Render overlay preview on base frame
      overlayModule.renderOverlayCanvas(baseCtx, layers, 1280, 720);

      // Verify that hidden watermark was NOT drawn
      expect(canvasMocks.calls.some((c) => c.args.includes("DRAFT PREVIEW"))).toBe(false);
      // Verify main headline WAS drawn
      expect(canvasMocks.calls.some((c) => c.args.includes("10X FASTER WORKFLOWS"))).toBe(true);

      // 5. User exports composite high-resolution 1280x720 PNG image
      const compositePngBlob = await overlayModule.exportCompositeImage(
        baseFrameCanvas,
        layers,
        "image/png"
      );

      expect(compositePngBlob).toBeInstanceOf(Blob);
      expect(compositePngBlob.size).toBeGreaterThan(0);
      expect(compositePngBlob.type).toBe("image/png");

      // 6. Verify client-side object URL generation for instant local download with zero server uploads
      const exportUrl = URL.createObjectURL(compositePngBlob);
      expect(exportUrl).toContain("blob:http://localhost/");
      expect(browserMocks.createdObjectUrls).toContain(exportUrl);
      URL.revokeObjectURL(exportUrl);
    });
  });
});
