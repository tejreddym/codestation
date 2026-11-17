"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { describePdfError, destroyPdfDocument, openPdfDocument } from "./pdfjs";

const MAX_PDF_BYTES = 100 * 1024 * 1024;

export type PdfSource = {
  file: File;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
  pageCount: number;
};

export function validatePdfFile(file: File): string | null {
  const looksLikePdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  if (!looksLikePdf) {
    return "Please choose a PDF file. Other file types are not supported here.";
  }
  if (file.size === 0) {
    return "This file is empty. Choose a PDF that contains at least one page.";
  }
  if (file.size > MAX_PDF_BYTES) {
    return "This PDF is larger than 100 MB. Split it into smaller files and try again.";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

/**
 * Owns one pdf.js document for a client tool. Loading a new file, clearing,
 * or unmounting destroys the worker-side document.
 */
export function usePdfDocument() {
  const [source, setSource] = useState<PdfSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const requestRef = useRef(0);

  const destroyCurrent = useCallback(() => {
    const current = documentRef.current;
    documentRef.current = null;
    if (current) {
      void destroyPdfDocument(current).catch(() => {
        // The worker may already be gone after a cancelled render.
      });
    }
  }, []);

  const clear = useCallback(() => {
    requestRef.current += 1;
    destroyCurrent();
    setSource(null);
    setLoading(false);
    setError(null);
  }, [destroyCurrent]);

  const open = useCallback(async (file: File): Promise<PdfSource | null> => {
    const message = validatePdfFile(file);
    if (message) {
      setError(message);
      return null;
    }

    const request = requestRef.current + 1;
    requestRef.current = request;
    setError(null);
    setLoading(true);
    setSource(null);
    destroyCurrent();

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await openPdfDocument(bytes);
      if (request !== requestRef.current) {
        await destroyPdfDocument(doc).catch(() => {});
        return null;
      }
      const next: PdfSource = {
        file,
        bytes,
        doc,
        pageCount: doc.numPages,
      };
      documentRef.current = doc;
      setSource(next);
      return next;
    } catch (loadError) {
      if (request === requestRef.current) {
        setError(describePdfError(loadError));
      }
      return null;
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [destroyCurrent]);

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      destroyCurrent();
    };
  }, [destroyCurrent]);

  return { source, loading, error, open, clear, setError };
}
