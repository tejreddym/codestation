/**
 * Lazy bridge to pdf.js.
 *
 * IMPORTANT: never import `pdfjs-dist` at module scope. It touches DOM/worker
 * globals and is several hundred kilobytes of JavaScript. Every entry point
 * below loads it through `import()` inside an async function so that:
 *  - the PDF station can render (and all other tools can be used) without it;
 *  - the server bundle never contains pdf.js;
 *  - the worker, character maps and standard fonts are served from our own
 *    origin (/pdfjs/*), never a CDN.
 */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

export const PDFJS_ASSET_ROOT = "/pdfjs";
export const PDFJS_WORKER_URL = `${PDFJS_ASSET_ROOT}/pdf.worker.min.mjs`;
export const PDFJS_CMAP_URL = `${PDFJS_ASSET_ROOT}/cmaps/`;
export const PDFJS_STANDARD_FONT_URL = `${PDFJS_ASSET_ROOT}/standard_fonts/`;

type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocumentOptions = NonNullable<Parameters<PdfJsModule["getDocument"]>[0]>;
type HardenedDocumentOptions = PdfDocumentOptions & { isEvalSupported: boolean };

let pdfJsPromise: Promise<PdfJsModule> | null = null;

/** Loads the pdf.js module once per browser session. */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF.js can only be loaded in the browser."));
  }

  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist")
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs;
      })
      .catch((error: unknown) => {
        // Allow a later retry if the chunk failed to load (offline, redeploy).
        pdfJsPromise = null;
        throw error;
      });
  }

  return pdfJsPromise;
}

/**
 * Shared, self-hosted document options. `isEvalSupported` is intentionally
 * disabled for hardening; pdf.js 6 typings no longer list it but still accepts
 * document init parameters from older callers.
 */
export function pdfDocumentOptions(data: Uint8Array): HardenedDocumentOptions {
  return {
    data: data.slice(),
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
    verbosity: 0,
    isEvalSupported: false,
  };
}

/**
 * Opens a document from bytes. pdf.js transfers its input buffer to the
 * worker, so the caller's array is copied and remains usable afterwards.
 */
export async function openPdfDocument(data: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument(pdfDocumentOptions(data)).promise;
}

/** Tears down the worker side of a document opened by `openPdfDocument`. */
export async function destroyPdfDocument(doc: PDFDocumentProxy): Promise<void> {
  const task = doc.loadingTask;
  if (task && !task.destroyed) await task.destroy();
}

/** Renders one page to a canvas at the requested CSS-pixel scale. */
export async function renderPdfPageToCanvas(
  page: PDFPageProxy,
  scale: number,
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
): Promise<void> {
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("This browser could not create a canvas for PDF rendering.");
  }

  const task = page.render({
    canvas,
    canvasContext: context,
    viewport,
    intent: "display",
    background: "#ffffff",
  });

  if (!signal) {
    await task.promise;
    return;
  }

  const abort = () => task.cancel();
  if (signal.aborted) {
    task.cancel();
    throw new DOMException("PDF rendering was cancelled.", "AbortError");
  }
  signal.addEventListener("abort", abort, { once: true });
  try {
    await task.promise;
  } catch (error) {
    if (signal.aborted) {
      throw new DOMException("PDF rendering was cancelled.", "AbortError");
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

/** User-facing message for pdf.js failures, including password protection. */
export function describePdfError(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: unknown }).name);
    if (name === "PasswordException") {
      return "This PDF is password-protected. Remove the password in a PDF editor, then try again. Password prompts are not supported.";
    }
    if (name === "InvalidPDFException") {
      return "This file is not a valid PDF, or it is damaged. Try a different file.";
    }
  }
  if (error instanceof Error && error.message) {
    return `Could not read this PDF: ${error.message}`;
  }
  return "Could not read this PDF. The file may be damaged or use unsupported features.";
}
