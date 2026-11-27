/**
 * Shared test infrastructure, synthetic browser mocks, and test fixtures for E2E testing suites.
 * Strict conformance to ORIGINAL_REQUEST.md and TEST_INFRA.md.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { resetWebMcpForTesting as resetRegistryWebMcp } from "../../lib/webmcp/registry";

// ---------------------------------------------------------------------------
// 1. MockMediaRecorder
// ---------------------------------------------------------------------------

export type MediaRecorderState = "inactive" | "recording" | "paused";

export class MockMediaRecorder extends EventTarget {
  stream: MediaStream;
  mimeType: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  state: MediaRecorderState = "inactive";

  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;
  onpause: ((event: Event) => void) | null = null;
  onresume: ((event: Event) => void) | null = null;

  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private recordedChunks: Blob[] = [];

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.stream = stream;
    this.mimeType = options?.mimeType || "video/webm";
    this.videoBitsPerSecond = options?.videoBitsPerSecond;
    this.audioBitsPerSecond = options?.audioBitsPerSecond;
  }

  static isTypeSupported(type: string): boolean {
    if (!type) return false;
    const lower = type.toLowerCase();
    return (
      lower.includes("video/webm") ||
      lower.includes("video/mp4") ||
      lower.includes("video/ogg") ||
      lower.includes("audio/webm") ||
      lower.includes("audio/mp4")
    );
  }

  start(timeslice?: number): void {
    if (this.state !== "inactive") {
      throw new DOMException("Cannot start MediaRecorder: state is not inactive", "InvalidStateError");
    }
    this.state = "recording";
    this.recordedChunks = [];

    const startEvent = new Event("start");
    this.dispatchEvent(startEvent);
    this.onstart?.(startEvent);

    const emitChunk = () => {
      if (this.state !== "recording") return;
      const chunkData = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]);
      const chunk = new Blob([chunkData], { type: this.mimeType });
      this.recordedChunks.push(chunk);

      const blobEvent = new BlobEvent("dataavailable", { data: chunk });
      this.dispatchEvent(blobEvent);
      this.ondataavailable?.(blobEvent);
    };

    // Emit initial chunk quickly
    setTimeout(emitChunk, 20);

    const interval = Math.max(timeslice ?? 100, 20);
    this.chunkTimer = setInterval(emitChunk, interval);
  }

  stop(): void {
    if (this.state === "inactive") {
      return;
    }
    this.state = "inactive";
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }

    // Final chunk
    const finalChunk = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x08])], { type: this.mimeType });
    this.recordedChunks.push(finalChunk);
    const blobEvent = new BlobEvent("dataavailable", { data: finalChunk });
    this.dispatchEvent(blobEvent);
    this.ondataavailable?.(blobEvent);

    // Stop event
    setTimeout(() => {
      const stopEvent = new Event("stop");
      this.dispatchEvent(stopEvent);
      this.onstop?.(stopEvent);
    }, 10);
  }

  pause(): void {
    if (this.state !== "recording") return;
    this.state = "paused";
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }
    const pauseEvent = new Event("pause");
    this.dispatchEvent(pauseEvent);
    this.onpause?.(pauseEvent);
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "recording";
    const resumeEvent = new Event("resume");
    this.dispatchEvent(resumeEvent);
    this.onresume?.(resumeEvent);
  }

  requestData(): void {
    if (this.state === "inactive") return;
    const chunk = new Blob([new Uint8Array([0x01, 0x02])], { type: this.mimeType });
    const event = new BlobEvent("dataavailable", { data: chunk });
    this.dispatchEvent(event);
    this.ondataavailable?.(event);
  }
}

// ---------------------------------------------------------------------------
// 2. createMockVideoElement
// ---------------------------------------------------------------------------

export interface MockVideoOptions {
  duration?: number;
  width?: number;
  height?: number;
  currentTime?: number;
}

export function createMockVideoElement(options?: MockVideoOptions): HTMLVideoElement {
  const video = document.createElement("video");
  const durationVal = options?.duration ?? 60;
  const widthVal = options?.width ?? 1920;
  const heightVal = options?.height ?? 1080;
  let currentTimeVal = options?.currentTime ?? 0;
  let isPaused = true;
  let isEnded = false;

  Object.defineProperty(video, "duration", {
    get: () => durationVal,
    configurable: true,
  });

  Object.defineProperty(video, "videoWidth", {
    get: () => widthVal,
    configurable: true,
  });

  Object.defineProperty(video, "videoHeight", {
    get: () => heightVal,
    configurable: true,
  });

  Object.defineProperty(video, "readyState", {
    get: () => 4, // HAVE_ENOUGH_DATA
    configurable: true,
  });

  Object.defineProperty(video, "paused", {
    get: () => isPaused,
    configurable: true,
  });

  Object.defineProperty(video, "ended", {
    get: () => isEnded,
    configurable: true,
  });

  Object.defineProperty(video, "currentTime", {
    get: () => currentTimeVal,
    set: (val: number) => {
      const clamped = Math.max(0, Math.min(val, durationVal));
      currentTimeVal = clamped;
      video.dispatchEvent(new Event("seeking"));
      setTimeout(() => {
        video.dispatchEvent(new Event("seeked"));
        video.dispatchEvent(new Event("timeupdate"));
      }, 0);
    },
    configurable: true,
  });

  let playTicker: ReturnType<typeof setInterval> | null = null;

  video.play = async () => {
    isPaused = false;
    isEnded = false;
    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("playing"));
    if (playTicker) clearInterval(playTicker);
    playTicker = setInterval(() => {
      if (isPaused) {
        if (playTicker) {
          clearInterval(playTicker);
          playTicker = null;
        }
        return;
      }
      currentTimeVal = Math.min(durationVal, currentTimeVal + 0.5);
      video.dispatchEvent(new Event("timeupdate"));
      if (currentTimeVal >= durationVal) {
        isEnded = true;
        isPaused = true;
        if (playTicker) {
          clearInterval(playTicker);
          playTicker = null;
        }
        video.dispatchEvent(new Event("ended"));
      }
    }, 25);
    return Promise.resolve();
  };

  video.pause = () => {
    isPaused = true;
    if (playTicker) {
      clearInterval(playTicker);
      playTicker = null;
    }
    video.dispatchEvent(new Event("pause"));
  };

  // Mock captureStream & mozCaptureStream
  const mockTrack = {
    kind: "video",
    enabled: true,
    readyState: "live",
    stop: () => {},
  };
  const mockStream = {
    active: true,
    getTracks: () => [mockTrack],
    getVideoTracks: () => [mockTrack],
    getAudioTracks: () => [],
    clone: () => mockStream,
  } as unknown as MediaStream;

  (video as any).captureStream = (_fps?: number) => mockStream;
  (video as any).mozCaptureStream = (_fps?: number) => mockStream;

  return video;
}

// ---------------------------------------------------------------------------
// 3. setupCanvasMocks
// ---------------------------------------------------------------------------

export interface RecordedCanvasCall {
  method: string;
  args: any[];
}

export interface CanvasMockController {
  calls: RecordedCanvasCall[];
  restore: () => void;
  clearCalls: () => void;
}

export function setupCanvasMocks(): CanvasMockController {
  const calls: RecordedCanvasCall[] = [];
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;

  const stateStack: Record<string, any>[] = [];
  let currentState: Record<string, any> = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1.0,
    globalCompositeOperation: "source-over",
  };

  const record = (method: string, args: any[]) => {
    calls.push({ method, args: Array.from(args) });
  };

  const mockContext: Partial<CanvasRenderingContext2D> = {
    get fillStyle() {
      return currentState.fillStyle;
    },
    set fillStyle(val: any) {
      currentState.fillStyle = val;
      record("set:fillStyle", [val]);
    },
    get strokeStyle() {
      return currentState.strokeStyle;
    },
    set strokeStyle(val: any) {
      currentState.strokeStyle = val;
      record("set:strokeStyle", [val]);
    },
    get lineWidth() {
      return currentState.lineWidth;
    },
    set lineWidth(val: number) {
      currentState.lineWidth = val;
      record("set:lineWidth", [val]);
    },
    get font() {
      return currentState.font;
    },
    set font(val: string) {
      currentState.font = val;
      record("set:font", [val]);
    },
    get textAlign() {
      return currentState.textAlign;
    },
    set textAlign(val: CanvasTextAlign) {
      currentState.textAlign = val;
      record("set:textAlign", [val]);
    },
    get textBaseline() {
      return currentState.textBaseline;
    },
    set textBaseline(val: CanvasTextBaseline) {
      currentState.textBaseline = val;
      record("set:textBaseline", [val]);
    },
    get shadowColor() {
      return currentState.shadowColor;
    },
    set shadowColor(val: string) {
      currentState.shadowColor = val;
      record("set:shadowColor", [val]);
    },
    get shadowBlur() {
      return currentState.shadowBlur;
    },
    set shadowBlur(val: number) {
      currentState.shadowBlur = val;
      record("set:shadowBlur", [val]);
    },
    get shadowOffsetX() {
      return currentState.shadowOffsetX;
    },
    set shadowOffsetX(val: number) {
      currentState.shadowOffsetX = val;
    },
    get shadowOffsetY() {
      return currentState.shadowOffsetY;
    },
    set shadowOffsetY(val: number) {
      currentState.shadowOffsetY = val;
    },
    get globalAlpha() {
      return currentState.globalAlpha;
    },
    set globalAlpha(val: number) {
      currentState.globalAlpha = val;
      record("set:globalAlpha", [val]);
    },
    get globalCompositeOperation() {
      return currentState.globalCompositeOperation;
    },
    set globalCompositeOperation(val: GlobalCompositeOperation) {
      currentState.globalCompositeOperation = val;
    },

    save: function () {
      stateStack.push({ ...currentState });
      record("save", []);
    },
    restore: function () {
      if (stateStack.length > 0) {
        currentState = stateStack.pop()!;
      }
      record("restore", []);
    },
    beginPath: function () {
      record("beginPath", []);
    },
    closePath: function () {
      record("closePath", []);
    },
    moveTo: function (x: number, y: number) {
      record("moveTo", [x, y]);
    },
    lineTo: function (x: number, y: number) {
      record("lineTo", [x, y]);
    },
    arc: function (x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean) {
      record("arc", [x, y, radius, startAngle, endAngle, counterclockwise]);
    },
    roundRect: function (x: number, y: number, w: number, h: number, radii?: number | number[]) {
      record("roundRect", [x, y, w, h, radii]);
    },
    rect: function (x: number, y: number, w: number, h: number) {
      record("rect", [x, y, w, h]);
    },
    fillRect: function (x: number, y: number, w: number, h: number) {
      record("fillRect", [x, y, w, h]);
    },
    strokeRect: function (x: number, y: number, w: number, h: number) {
      record("strokeRect", [x, y, w, h]);
    },
    clearRect: function (x: number, y: number, w: number, h: number) {
      record("clearRect", [x, y, w, h]);
    },
    fill: function () {
      record("fill", []);
    },
    stroke: function () {
      record("stroke", []);
    },
    fillText: function (text: string, x: number, y: number, maxWidth?: number) {
      record("fillText", [text, x, y, maxWidth]);
    },
    strokeText: function (text: string, x: number, y: number, maxWidth?: number) {
      record("strokeText", [text, x, y, maxWidth]);
    },
    drawImage: function (...args: any[]) {
      record("drawImage", args);
    },
    translate: function (x: number, y: number) {
      record("translate", [x, y]);
    },
    rotate: function (angle: number) {
      record("rotate", [angle]);
    },
    scale: function (x: number, y: number) {
      record("scale", [x, y]);
    },
    clip: function () {
      record("clip", []);
    },
    measureText: function (text: string): TextMetrics {
      const len = text ? text.length : 0;
      const width = len * 12; // Realistic approx 12px per char
      return {
        width,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 3,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: width,
        fontBoundingBoxAscent: 12,
        fontBoundingBoxDescent: 4,
        emHeightAscent: 10,
        emHeightDescent: 3,
        hangingBaseline: 8,
        alphabeticBaseline: 0,
        ideographicBaseline: -3,
      } as TextMetrics;
    },
  };

  HTMLCanvasElement.prototype.getContext = function (contextId: string, ..._args: any[]) {
    if (contextId === "2d") {
      return mockContext as CanvasRenderingContext2D;
    }
    return null;
  } as any;

  HTMLCanvasElement.prototype.toBlob = function (
    callback: (blob: Blob | null) => void,
    type?: string,
    _quality?: any
  ) {
    const mime = type || "image/png";
    const syntheticImageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const blob = new Blob([syntheticImageBytes], { type: mime });
    setTimeout(() => callback(blob), 0);
  };

  HTMLCanvasElement.prototype.toDataURL = function (type?: string, _quality?: any) {
    const mime = type || "image/png";
    return `data:${mime};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  };

  return {
    calls,
    clearCalls: () => {
      calls.length = 0;
    },
    restore: () => {
      HTMLCanvasElement.prototype.getContext = origGetContext;
      HTMLCanvasElement.prototype.toBlob = origToBlob;
      HTMLCanvasElement.prototype.toDataURL = origToDataURL;
    },
  };
}

// ---------------------------------------------------------------------------
// 4. setupBrowserApiMocks
// ---------------------------------------------------------------------------

export interface BrowserApiMockController {
  restore: () => void;
  createdObjectUrls: string[];
  revokedObjectUrls: string[];
}

export function setupBrowserApiMocks(): BrowserApiMockController {
  const origMediaRecorder = (window as any).MediaRecorder;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  const origRequestAnimationFrame = window.requestAnimationFrame;
  const origCancelAnimationFrame = window.cancelAnimationFrame;

  const createdObjectUrls: string[] = [];
  const revokedObjectUrls: string[] = [];

  (window as any).MediaRecorder = MockMediaRecorder;

  URL.createObjectURL = (blob: Blob | MediaSource) => {
    const url = `blob:http://localhost/mock-${Math.random().toString(36).substring(2, 9)}`;
    createdObjectUrls.push(url);
    return url;
  };

  URL.revokeObjectURL = (url: string) => {
    revokedObjectUrls.push(url);
  };

  let rafIdCounter = 1;
  const rafMap = new Map<number, NodeJS.Timeout>();

  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = rafIdCounter++;
    const timer = setTimeout(() => {
      rafMap.delete(id);
      callback(performance.now());
    }, 16);
    rafMap.set(id, timer);
    return id;
  };

  window.cancelAnimationFrame = (id: number): void => {
    const timer = rafMap.get(id);
    if (timer) {
      clearTimeout(timer);
      rafMap.delete(id);
    }
  };

  return {
    createdObjectUrls,
    revokedObjectUrls,
    restore: () => {
      (window as any).MediaRecorder = origMediaRecorder;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
      window.requestAnimationFrame = origRequestAnimationFrame;
      window.cancelAnimationFrame = origCancelAnimationFrame;
      for (const timer of rafMap.values()) {
        clearTimeout(timer);
      }
      rafMap.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// 5. createTestPdf
// ---------------------------------------------------------------------------

export interface TestPdfOptions {
  pageCount?: number;
  title?: string;
  text?: string;
  width?: number;
  height?: number;
}

export async function createTestPdf(options?: TestPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const count = options?.pageCount ?? 1;
  const title = options?.title ?? "Code Station Test PDF Document";
  const body = options?.text ?? "Synthetic 100% in-browser document fixture for compression testing.";
  const width = options?.width ?? 595.28;
  const height = options?.height ?? 841.89;

  for (let i = 0; i < count; i++) {
    const page = doc.addPage([width, height]);
    page.drawText(`${title} - Page ${i + 1} of ${count}`, {
      x: 50,
      y: height - 50,
      size: 16,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(body, {
      x: 50,
      y: height - 80,
      size: 11,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    // Add some geometric elements to ensure real content
    page.drawRectangle({
      x: 50,
      y: height - 200,
      width: 200,
      height: 100,
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 2,
    });
  }

  return await doc.save();
}

// ---------------------------------------------------------------------------
// 6. resetWebMcpForTesting
// ---------------------------------------------------------------------------

export function resetWebMcpForTesting(): void {
  resetRegistryWebMcp();
}

// ---------------------------------------------------------------------------
// 7. Dynamic module loaders for progressive testability
// ---------------------------------------------------------------------------

export interface PdfCompressionPreset {
  name: string;
  dpi: number;
  quality: number;
  description: string;
}

export type CompressionPresetKey = "max" | "balanced" | "high";

export interface PdfCompressModule {
  COMPRESSION_PRESETS: Record<CompressionPresetKey, PdfCompressionPreset>;
  calculateSavings: (originalSize: number, compressedSize: number) => { savingsBytes: number; savingsPercentage: number };
  compressPdfInBrowser: (
    pdfDocOrBytes: any,
    presetKey: CompressionPresetKey,
    onProgress?: (page: number, total: number) => void,
    signal?: AbortSignal
  ) => Promise<Uint8Array>;
}

export async function loadPdfCompressModule(): Promise<PdfCompressModule> {
  const modPath = "../../lib/tools/pdf/compress";
  const mod = await import(/* @vite-ignore */ modPath);
  if (!mod || !mod.COMPRESSION_PRESETS || !mod.calculateSavings || !mod.compressPdfInBrowser) {
    throw new Error(
      "Module lib/tools/pdf/compress is missing required contract exports: COMPRESSION_PRESETS, calculateSavings, compressPdfInBrowser"
    );
  }
  return mod as unknown as PdfCompressModule;
}

// Overlay layer models & types matching PROJECT.md interface contracts
export type OverlayShapeType = "rect" | "pill" | "badge" | "circle" | "arrow";
export type OverlayIconType = "play" | "fire" | "alert" | "star" | "check" | "lightning";

export interface BaseOverlayLayer {
  id: string;
  x: number;
  y: number;
  visible?: boolean;
}

export interface TextLayer extends BaseOverlayLayer {
  type: "text";
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  badgeBg?: string;
}

export interface ShapeLayer extends BaseOverlayLayer {
  type: "shape";
  shapeType: OverlayShapeType;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  direction?: "right" | "left" | "up" | "down";
}

export interface IconLayer extends BaseOverlayLayer {
  type: "icon";
  iconType: OverlayIconType;
  size: number;
  fill?: string;
  stroke?: string;
}

export type OverlayLayer = TextLayer | ShapeLayer | IconLayer;

export interface OverlayModule {
  renderOverlayCanvas: (ctx: CanvasRenderingContext2D, layers: OverlayLayer[], width: number, height: number) => void;
  exportCompositeImage: (
    baseImage: HTMLImageElement | HTMLCanvasElement,
    layers: OverlayLayer[],
    format: "image/png" | "image/jpeg",
    quality?: number
  ) => Promise<Blob>;
}

export async function loadOverlayModule(): Promise<OverlayModule> {
  const modPath = "../../lib/tools/video/overlay";
  const mod = await import(/* @vite-ignore */ modPath);
  if (!mod || !mod.renderOverlayCanvas || !mod.exportCompositeImage) {
    throw new Error(
      "Module lib/tools/video/overlay is missing required contract exports: renderOverlayCanvas, exportCompositeImage"
    );
  }
  return mod as unknown as OverlayModule;
}
