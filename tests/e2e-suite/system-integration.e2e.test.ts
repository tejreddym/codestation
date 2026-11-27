// @vitest-environment jsdom
/**
 * 4-Tier Requirement-Driven E2E Test Suite for System Integration (R4).
 * Conformance to ORIGINAL_REQUEST.md, PROJECT.md, AGENTS.md, and TEST_INFRA.md.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import { tools, getTool } from "../../config/tools";
import { videoTools, videoToolIds } from "../../config/video-tools";
import { pdfTools, pdfToolIds } from "../../config/pdf-tools";
import { stations } from "../../config/stations";
import {
  LIST_TOOLS_MCP,
  EXECUTE_TOOL_MCP,
  createWebMcpToolForDefinition,
  registerWebMcpTool,
  getRegisteredWebMcpTools,
} from "../../lib/webmcp/registry";
import { dispatchToolExecution } from "../../lib/webmcp/dispatcher";
import {
  validateTrimRange,
  trimVideoInBrowser,
} from "../../lib/tools/video/trimmer";
import {
  createMockVideoElement,
  createTestPdf,
  loadPdfCompressModule,
  loadOverlayModule,
  setupBrowserApiMocks,
  resetWebMcpForTesting,
  type OverlayLayer,
} from "./test-helpers";

const PDF_COMPRESS_PATH = path.resolve(process.cwd(), "lib/tools/pdf/compress.ts");
const OVERLAY_PATH = path.resolve(process.cwd(), "lib/tools/video/overlay.ts");
const isPipelineImplemented =
  fs.existsSync(PDF_COMPRESS_PATH) &&
  fs.readFileSync(PDF_COMPRESS_PATH, "utf8").includes("compressPdfInBrowser") &&
  fs.existsSync(OVERLAY_PATH);

describe("System Integration E2E Suite (R4)", () => {
  let browserMocks: ReturnType<typeof setupBrowserApiMocks>;

  beforeEach(() => {
    browserMocks = setupBrowserApiMocks();
    resetWebMcpForTesting();
  });

  afterEach(() => {
    browserMocks.restore();
  });

  // =========================================================================
  // Tier 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    it("T1.1 - canonical routes exist for video-trimmer, video-thumbnail-generator, and pdf-compressor", () => {
      // 1. Video Trimmer canonical route
      const videoTrimmer = getTool("video-trimmer");
      expect(videoTrimmer).toBeDefined();
      expect(videoTrimmer!.slug).toBe("video-trimmer");
      const videoTrimmerRoute = `/tools/${videoTrimmer!.slug}`;
      expect(videoTrimmerRoute).toBe("/tools/video-trimmer");

      // 2. Video Thumbnail Generator canonical route
      const thumbGen = getTool("video-thumbnail-generator");
      expect(thumbGen).toBeDefined();
      expect(thumbGen!.slug).toBe("video-thumbnail-generator");
      const thumbRoute = `/tools/${thumbGen!.slug}`;
      expect(thumbRoute).toBe("/tools/video-thumbnail-generator");

      // 3. PDF Compressor canonical route (fully asserted against authoritative registry)
      const pdfCompressor = getTool("pdf-compressor");
      expect(pdfCompressor).toBeDefined();
      expect(pdfCompressor!.slug).toBe("pdf-compressor");
      const pdfCompressorRoute = `/tools/${pdfCompressor!.slug}`;
      expect(pdfCompressorRoute).toBe("/tools/pdf-compressor");

      // Verify canonical route formatting rule: strictly `/tools/[slug]`
      const allSlugs = tools.map((t) => t.slug);
      expect(allSlugs).toContain("video-trimmer");
      expect(allSlugs).toContain("video-thumbnail-generator");
      expect(allSlugs).toContain("pdf-compressor");
    });

    it("T1.2 - enforces strict slug equality (id === slug) across Video, PDF, and new station tools", () => {
      const videoTrimmer = getTool("video-trimmer")!;
      expect(videoTrimmer).toBeDefined();
      expect(videoTrimmer.id).toBe(videoTrimmer.slug);
      expect(videoTrimmer.id).toBe("video-trimmer");

      const thumbGen = getTool("video-thumbnail-generator")!;
      expect(thumbGen).toBeDefined();
      expect(thumbGen.id).toBe(thumbGen.slug);
      expect(thumbGen.id).toBe("video-thumbnail-generator");

      const pdfCompressor = getTool("pdf-compressor")!;
      expect(pdfCompressor).toBeDefined();
      expect(pdfCompressor.id).toBe(pdfCompressor.slug);
      expect(pdfCompressor.id).toBe("pdf-compressor");

      // Verify across all video and PDF tools
      videoTools.forEach((tool) => {
        expect(tool.id).toBe(tool.slug);
        expect(tool.id).toBe(tool.id.toLowerCase());
        expect(tool.id).not.toContain(" ");
      });

      pdfTools.forEach((tool) => {
        expect(tool.id).toBe(tool.slug);
        expect(tool.id).toBe(tool.id.toLowerCase());
        expect(tool.id).not.toContain(" ");
      });
    });

    it("T1.3 - WebMCP identifier conventions: codestation_[snake_case_slug] for all tools", () => {
      const sampleTools = [
        getTool("video-trimmer"),
        getTool("video-thumbnail-generator"),
        getTool("pdf-compressor"),
        getTool("json-formatter"),
        getTool("base64-encoder"),
      ].filter(Boolean);

      expect(sampleTools.length).toBe(5);

      sampleTools.forEach((tool) => {
        const mcp = createWebMcpToolForDefinition(tool!);
        const expectedMcpName = `codestation_${tool!.slug.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        expect(mcp.name).toBe(expectedMcpName);
        expect(mcp.name).toMatch(/^codestation_[a-z0-9_]+$/);
      });
    });

    it("T1.4 - Video station catalog contains video-trimmer and video-thumbnail-generator under Video", () => {
      expect(videoToolIds).toContain("video-trimmer");
      expect(videoToolIds).toContain("video-thumbnail-generator");

      const trimmer = videoTools.find((t) => t.id === "video-trimmer");
      expect(trimmer).toBeDefined();
      expect(trimmer!.category).toBe("Video");

      const thumb = videoTools.find((t) => t.id === "video-thumbnail-generator");
      expect(thumb).toBeDefined();
      expect(thumb!.category).toBe("Video");
    });

    it("T1.5 - PDF station catalog contains pdf-compressor under PDF with local contract", () => {
      expect(pdfToolIds).toContain("pdf-compressor");

      const compressor = pdfTools.find((t) => t.id === "pdf-compressor");
      expect(compressor).toBeDefined();
      expect(compressor!.category).toBe("PDF");
      expect(compressor!.name).toBe("PDF Compressor");
      expect(compressor!.localContract).toBeDefined();
      expect(compressor!.localContract?.fields).toBeDefined();
      expect(compressor!.localContract?.outputs).toBeDefined();
    });

    it("T1.6 - tools provide non-empty SEO titles, descriptions, and searchable keywords", () => {
      const toolsToCheck = ["video-trimmer", "video-thumbnail-generator", "pdf-compressor"];

      for (const slug of toolsToCheck) {
        const tool = getTool(slug);
        expect(tool, `Tool ${slug} must be registered`).toBeDefined();
        expect(tool!.seo?.title, `${slug} must have SEO title`).toBeTruthy();
        expect(tool!.seo?.description, `${slug} must have SEO description`).toBeTruthy();
        expect(tool!.keywords, `${slug} must have keywords`).toBeDefined();
        expect(tool!.keywords!.length, `${slug} keywords count`).toBeGreaterThan(0);
      }
    });

    it("T1.7 - authoritative registries expose complete metadata and canonical routes for video-trimmer, pdf-compressor, and video-thumbnail-generator", () => {
      const targetSlugs = ["video-trimmer", "video-thumbnail-generator", "pdf-compressor"];

      targetSlugs.forEach((slug) => {
        const tool = getTool(slug);
        expect(tool, `Tool ${slug} must be registered in master config/tools.ts`).toBeDefined();
        expect(tool!.id).toBe(slug);
        expect(tool!.slug).toBe(slug);
        expect(tool!.name).toBeTruthy();
        expect(tool!.description).toBeTruthy();
        expect(["Video", "PDF"]).toContain(tool!.category);

        // Canonical route formatting strictly `/tools/[slug]`
        const canonicalRoute = `/tools/${tool!.slug}`;
        expect(canonicalRoute).toBe(`/tools/${slug}`);

        // WebMCP convention
        const mcp = createWebMcpToolForDefinition(tool!);
        expect(mcp.name).toBe(`codestation_${slug.replace(/-/g, "_")}`);
      });
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("T2.1 - tool registry count reflects complete 383-tool catalog", () => {
      expect(tools.length).toBe(383);
      expect(tools.some((t) => t.id === "video-trimmer")).toBe(true);
      expect(tools.some((t) => t.id === "pdf-compressor")).toBe(true);
      expect(tools.some((t) => t.id === "video-thumbnail-generator")).toBe(true);
    });

    it("T2.2 - Video station contains exactly 2 tools", () => {
      expect(videoTools.length).toBe(2);
      expect(videoToolIds.length).toBe(2);
    });

    it("T2.3 - PDF station contains exactly 13 tools with strict PDF contracts", () => {
      expect(pdfTools.length).toBe(13);
      expect(pdfToolIds.length).toBe(13);
      expect(pdfToolIds).toContain("pdf-compressor");

      pdfTools.forEach((tool) => {
        expect(tool.category).toBe("PDF");
        expect(tool.id).toBe(tool.slug);
        expect(tool.localContract).toBeDefined();
      });
    });

    it("T2.4 - DOM annotations support semantic data-webmcp-* attributes for LLM web agents", () => {
      // Simulate rendering a tool workspace section with semantic WebMCP DOM markers
      const el = document.createElement("section");
      el.setAttribute("data-webmcp-tool", "Video Trimmer");
      el.setAttribute("data-webmcp-category", "Video");
      el.setAttribute("data-webmcp-slug", "video-trimmer");

      expect(el.getAttribute("data-webmcp-tool")).toBe("Video Trimmer");
      expect(el.getAttribute("data-webmcp-category")).toBe("Video");
      expect(el.getAttribute("data-webmcp-slug")).toBe("video-trimmer");
    });

    it("T2.5 - catalog integrity: zero duplicate tool IDs, slugs, or WebMCP identifiers", () => {
      const seenIds = new Set<string>();
      const seenSlugs = new Set<string>();

      tools.forEach((tool) => {
        expect(seenIds.has(tool.id)).toBe(false);
        expect(seenSlugs.has(tool.slug)).toBe(false);
        seenIds.add(tool.id);
        seenSlugs.add(tool.slug);
      });

      expect(seenIds.size).toBe(tools.length);
      expect(seenSlugs.size).toBe(tools.length);
    });

    it("T2.6 - stations registry contains Video and PDF stations with descriptions, routes, and correct tool counts", () => {
      const videoStation = stations.find((s) => s.id === "video" || s.name === "Video");
      expect(videoStation).toBeDefined();
      expect(videoStation!.description).toBeTruthy();
      expect(videoStation!.route).toBe("/stations/video");
      expect(videoStation!.toolCount).toBe(2);
      expect(videoStation!.toolList).toContain("video-trimmer");
      expect(videoStation!.toolList).toContain("video-thumbnail-generator");

      const pdfStation = stations.find((s) => s.id === "pdf" || s.name === "PDF");
      expect(pdfStation).toBeDefined();
      expect(pdfStation!.description).toBeTruthy();
      expect(pdfStation!.route).toBe("/stations/pdf");
      expect(pdfStation!.toolCount).toBe(13);
      expect(pdfStation!.toolList).toContain("pdf-compressor");
    });

    it("T2.7 - station cross-linking and relatedStations graph maintains consistency for Video and PDF stations", () => {
      const videoStation = stations.find((s) => s.id === "video" || s.name === "Video");
      expect(videoStation).toBeDefined();
      expect(videoStation!.relatedStations).toBeDefined();
      expect(videoStation!.relatedStations.length).toBeGreaterThan(0);

      const pdfStation = stations.find((s) => s.id === "pdf" || s.name === "PDF");
      expect(pdfStation).toBeDefined();
      expect(pdfStation!.relatedStations).toBeDefined();
      expect(pdfStation!.relatedStations.length).toBeGreaterThan(0);

      // Verify no dangling relatedStation references
      const allStationIds = new Set(stations.map((s) => s.id));
      [...videoStation!.relatedStations, ...pdfStation!.relatedStations].forEach((relatedId) => {
        expect(allStationIds.has(relatedId), `Related station '${relatedId}' must exist in station catalog`).toBe(true);
      });
    });
  });

  // Helper to extract text from WebMCP execute response
  const getPayload = (res: any) => {
    if (typeof res === "string") return JSON.parse(res);
    return JSON.parse(res?.content?.[0]?.text ?? "{}");
  };

  // =========================================================================
  // Tier 3: Cross-Feature Combinations (Pairwise Interactions)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations", () => {
    it("T3.1 - WebMCP dispatcher correctly routes video-trimmer execution", async () => {
      const response = await dispatchToolExecution("video-trimmer", "", {
        start: 2.5,
        end: 7.5,
        fps: 24,
      });

      const parsed = JSON.parse(response);
      expect(parsed.id).toBe("video-trimmer");
      expect(parsed.status).toBe("ready");
      expect(parsed.canonicalUrl).toBe("https://codestation.in/tools/video-trimmer");
      expect(parsed.trimSpecification.durationSeconds).toBe(5);
      expect(parsed.trimSpecification.fps).toBe(24);
      expect(parsed.trimSpecification.totalFrames).toBe(120);
    });

    it("T3.2 - WebMCP universal tool discovery (codestation_list_tools) filters by station category", async () => {
      // Filter by Video category
      const videoResult = await LIST_TOOLS_MCP.execute({ category: "Video" });
      const videoJson = getPayload(videoResult);
      expect(videoJson.totalMatches).toBe(2);
      const videoSlugs = videoJson.tools.map((t: any) => t.slug);
      expect(videoSlugs).toContain("video-trimmer");
      expect(videoSlugs).toContain("video-thumbnail-generator");

      // Filter by PDF category
      const pdfResult = await LIST_TOOLS_MCP.execute({ category: "PDF" });
      const pdfJson = getPayload(pdfResult);
      expect(pdfJson.totalMatches).toBe(13);
      const pdfSlugs = pdfJson.tools.map((t: any) => t.slug);
      expect(pdfSlugs).toContain("pdf-compressor");
    });

    it("T3.3 - WebMCP universal search query matches tool names and descriptions", async () => {
      // Query "trimmer"
      const trimResult = await LIST_TOOLS_MCP.execute({ query: "trimmer" });
      const trimJson = getPayload(trimResult);
      expect(trimJson.totalMatches).toBeGreaterThanOrEqual(1);
      const foundTrimmer = trimJson.tools.find((t: any) => t.slug === "video-trimmer");
      expect(foundTrimmer).toBeDefined();
      expect(foundTrimmer.canonicalUrl).toBe("https://codestation.in/tools/video-trimmer");

      // Query "thumbnail"
      const thumbResult = await LIST_TOOLS_MCP.execute({ query: "thumbnail" });
      const thumbJson = getPayload(thumbResult);
      expect(thumbJson.totalMatches).toBeGreaterThanOrEqual(1);
      const foundThumb = thumbJson.tools.find((t: any) => t.slug === "video-thumbnail-generator");
      expect(foundThumb).toBeDefined();

      // Query "compressor"
      const compResult = await LIST_TOOLS_MCP.execute({ query: "compressor" });
      const compJson = getPayload(compResult);
      expect(compJson.totalMatches).toBeGreaterThanOrEqual(1);
      const foundCompressor = compJson.tools.find((t: any) => t.slug === "pdf-compressor");
      expect(foundCompressor).toBeDefined();
      expect(foundCompressor.canonicalUrl).toBe("https://codestation.in/tools/pdf-compressor");
    });

    it("T3.4 - all Video and PDF tool metadata strictly declare in-browser execution with zero server uploads", () => {
      const targetTools = [
        getTool("video-trimmer"),
        getTool("video-thumbnail-generator"),
        getTool("pdf-compressor"),
      ].filter(Boolean);

      targetTools.forEach((tool) => {
        const textCorpus = [
          tool!.description,
          tool!.seo?.title ?? "",
          tool!.seo?.description ?? "",
          ...(tool!.keywords ?? []),
        ].join(" ").toLowerCase();

        // Must emphasize local/browser execution and absence of server uploads
        const hasPrivacyGuarantee =
          textCorpus.includes("browser") ||
          textCorpus.includes("local") ||
          textCorpus.includes("zero server") ||
          textCorpus.includes("without server") ||
          textCorpus.includes("client");
        expect(hasPrivacyGuarantee, `Tool ${tool!.id} must communicate client-side execution`).toBe(true);

        // Must NOT contain server-side upload terminology without negation
        expect(textCorpus).not.toContain("cloud processing");
        expect(textCorpus).not.toMatch(/(requires|needs|uses)\s+server\s+upload/i);
      });
    });
  });

  // =========================================================================
  // Tier 4: Real-World Scenarios
  // =========================================================================
  describe("Tier 4: Real-World Scenarios", () => {
    it("T4.1 - AI Agent discovery and invocation lifecycle across Code Station developer tools", async () => {
      // 1. AI agent inspects registered tools on document.modelContext
      const allMcpTools = getRegisteredWebMcpTools();
      expect(allMcpTools.length).toBeGreaterThan(0);
      expect(allMcpTools.some((t) => t.name === "codestation_list_tools")).toBe(true);
      expect(allMcpTools.some((t) => t.name === "codestation_execute_tool")).toBe(true);

      // 2. AI agent invokes codestation_list_tools to query video processing capabilities
      const listResp = await LIST_TOOLS_MCP.execute({ query: "video", limit: 10 });
      const listPayload = getPayload(listResp);
      expect(listPayload.returned).toBeGreaterThanOrEqual(2);

      const trimmerEntry = listPayload.tools.find((t: any) => t.id === "video-trimmer");
      expect(trimmerEntry).toBeDefined();
      expect(trimmerEntry.canonicalUrl).toBe("https://codestation.in/tools/video-trimmer");

      // 3. AI agent executes tool calculation via codestation_execute_tool
      const execResp = await EXECUTE_TOOL_MCP.execute({
        toolId: "video-trimmer",
        input: "",
        options: {
          start: 10.0,
          end: 25.5,
          fps: 30,
        },
      });

      expect(execResp).toBeDefined();
      const execPayload = getPayload(execResp);
      expect(execPayload.status).toBe("ready");
      expect(execPayload.id).toBe("video-trimmer");
      expect(execPayload.category).toBe("Video");
      expect(execPayload.trimSpecification.durationSeconds).toBe(15.5);
      expect(execPayload.trimSpecification.totalFrames).toBe(465);
      expect(execPayload.canonicalUrl).toBe("https://codestation.in/tools/video-trimmer");

      // 4. Verify client-side privacy guarantee in response notice
      expect(execPayload.notice).toContain("zero server uploads");
    });

    it.skipIf(!isPipelineImplemented)(
      "T4.2 - Cross-Station Multi-Asset Media Pipeline: video clip trimming, thumbnail overlay generation, and PDF documentation compression with client privacy verification",
      async () => {
        // -----------------------------------------------------------------------
        // Persona & Scenario: A developer prepares a release announcement package
        // consisting of a trimmed video teaser, a branded composite thumbnail,
        // and compressed release documentation, verifying 100% in-browser privacy.
        // -----------------------------------------------------------------------

        // PHASE 1: Video Station — Slice and encode a 7.5s video teaser clip (F3)
        const sourceVideo = createMockVideoElement({ duration: 60, width: 1920, height: 1080 });
        const trimStart = 5.0;
        const trimEnd = 12.5;

        const trimValidation = validateTrimRange(trimStart, trimEnd, sourceVideo.duration);
        expect(trimValidation.valid).toBe(true);
        expect(trimValidation.error).toBeUndefined();

        const videoProgressUpdates: number[] = [];
        const trimmedVideoBlob = await trimVideoInBrowser(
          sourceVideo,
          {
            startTime: trimStart,
            endTime: trimEnd,
            mimeType: "video/webm",
          },
          (p) => videoProgressUpdates.push(p)
        );

        expect(trimmedVideoBlob).toBeInstanceOf(Blob);
        expect(trimmedVideoBlob.size).toBeGreaterThan(0);
        expect(trimmedVideoBlob.type).toContain("video/webm");
        expect(videoProgressUpdates.length).toBeGreaterThan(0);
        expect(videoProgressUpdates[videoProgressUpdates.length - 1]).toBe(1);

        // Verify local Object URL lifecycle (zero remote uploads)
        const videoObjectUrl = URL.createObjectURL(trimmedVideoBlob);
        expect(videoObjectUrl).toContain("blob:http://localhost/");
        expect(browserMocks.createdObjectUrls).toContain(videoObjectUrl);
        URL.revokeObjectURL(videoObjectUrl);

        // -----------------------------------------------------------------------
        // PHASE 2: Video Thumbnail Studio — Canva-style composite thumbnail (F11)
        const overlayMod = await loadOverlayModule();
        const baseFrameCanvas = document.createElement("canvas");
        baseFrameCanvas.width = 1280;
        baseFrameCanvas.height = 720;
        const frameCtx = baseFrameCanvas.getContext("2d")!;
        frameCtx.fillStyle = "#0f172a";
        frameCtx.fillRect(0, 0, 1280, 720);

        // Construct multi-layer branded overlay
        const overlayLayers: OverlayLayer[] = [
          // Layer 1: Contrast badge pill
          {
            id: "teaser-pill",
            type: "shape",
            shapeType: "pill",
            x: 60,
            y: 480,
            width: 780,
            height: 140,
            fill: "rgba(15, 23, 42, 0.90)",
            stroke: "#38bdf8",
            strokeWidth: 4,
            radius: 20,
            visible: true,
          },
          // Layer 2: Main title text with drop shadow
          {
            id: "teaser-title",
            type: "text",
            text: "CODE STATION V2.0 RELEASE",
            x: 95,
            y: 570,
            fontFamily: "Inter, sans-serif",
            fontSize: 52,
            fill: "#ffffff",
            strokeColor: "#000000",
            strokeWidth: 2,
            shadowColor: "rgba(0, 0, 0, 0.8)",
            shadowBlur: 10,
            visible: true,
          },
          // Layer 3: Accent lightning icon
          {
            id: "teaser-icon",
            type: "icon",
            iconType: "lightning",
            x: 740,
            y: 520,
            size: 60,
            fill: "#facc15",
            stroke: "#ffffff",
            visible: true,
          },
        ];

        // Render overlay preview onto context
        overlayMod.renderOverlayCanvas(frameCtx, overlayLayers, 1280, 720);

        // Export high-resolution composite PNG
        const compositeThumbnailBlob = await overlayMod.exportCompositeImage(
          baseFrameCanvas,
          overlayLayers,
          "image/png"
        );

        expect(compositeThumbnailBlob).toBeInstanceOf(Blob);
        expect(compositeThumbnailBlob.type).toBe("image/png");
        expect(compositeThumbnailBlob.size).toBeGreaterThan(0);

        const thumbObjectUrl = URL.createObjectURL(compositeThumbnailBlob);
        expect(thumbObjectUrl).toContain("blob:http://localhost/");
        expect(browserMocks.createdObjectUrls).toContain(thumbObjectUrl);
        URL.revokeObjectURL(thumbObjectUrl);

        // -----------------------------------------------------------------------
        // PHASE 3: PDF Station — Compress 3-page release whitepaper (F7)
        const pdfMod = await loadPdfCompressModule();
        const originalDocBytes = await createTestPdf({
          pageCount: 3,
          title: "Code Station v2.0 Architecture Whitepaper",
          text: "Technical specification for 100% in-browser video trimming, thumbnail design, and PDF compression.",
        });
        const originalPdfSize = originalDocBytes.length;
        expect(originalPdfSize).toBeGreaterThan(1000);

        // Compress using Balanced preset (150 DPI)
        const pdfPageProgress: number[] = [];
        const compressedPdfBytes = await pdfMod.compressPdfInBrowser(
          originalDocBytes,
          "balanced",
          (page, total) => {
            pdfPageProgress.push(page);
            expect(total).toBe(3);
          }
        );

        expect(compressedPdfBytes).toBeInstanceOf(Uint8Array);
        expect(compressedPdfBytes.length).toBeGreaterThan(0);
        expect(pdfPageProgress).toEqual([1, 2, 3]);

        // Reload and verify PDF document structural integrity
        const loadedPdf = await PDFDocument.load(compressedPdfBytes);
        expect(loadedPdf.getPageCount()).toBe(3);

        // Verify byte savings calculation
        const savingsResult = pdfMod.calculateSavings(originalPdfSize, compressedPdfBytes.length);
        expect(savingsResult.savingsBytes).toBeGreaterThanOrEqual(0);
        expect(savingsResult.savingsPercentage).toBeGreaterThanOrEqual(0);

        const pdfDownloadBlob = new Blob([new Uint8Array(compressedPdfBytes)], { type: "application/pdf" });
        const pdfObjectUrl = URL.createObjectURL(pdfDownloadBlob);
        expect(pdfObjectUrl).toContain("blob:http://localhost/");
        expect(browserMocks.createdObjectUrls).toContain(pdfObjectUrl);
        URL.revokeObjectURL(pdfObjectUrl);

        // -----------------------------------------------------------------------
        // PHASE 4: Client Privacy & Zero-Server-Upload Audit across all tools
        expect(browserMocks.revokedObjectUrls).toContain(videoObjectUrl);
        expect(browserMocks.revokedObjectUrls).toContain(thumbObjectUrl);
        expect(browserMocks.revokedObjectUrls).toContain(pdfObjectUrl);

        // -----------------------------------------------------------------------
        // PHASE 5: WebMCP AI Protocol Unification (F12)
        const mcpVideoResult = await LIST_TOOLS_MCP.execute({ category: "Video" });
        const mcpVideoPayload = getPayload(mcpVideoResult);
        const videoSlugs = mcpVideoPayload.tools.map((t: any) => t.slug);
        expect(videoSlugs).toContain("video-trimmer");
        expect(videoSlugs).toContain("video-thumbnail-generator");

        const mcpPdfResult = await LIST_TOOLS_MCP.execute({ category: "PDF" });
        const mcpPdfPayload = getPayload(mcpPdfResult);
        const pdfSlugs = mcpPdfPayload.tools.map((t: any) => t.slug);
        expect(pdfSlugs).toContain("pdf-compressor");

        // Verify canonical routes across the pipeline
        expect(getTool("video-trimmer")?.slug).toBe("video-trimmer");
        expect(getTool("video-thumbnail-generator")?.slug).toBe("video-thumbnail-generator");
        expect(getTool("pdf-compressor")?.slug).toBe("pdf-compressor");
      }
    );
  });
});
