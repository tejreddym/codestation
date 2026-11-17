"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { LocalDefinition } from "@/config/local-contract";
import type { PdfToolId } from "@/config/pdf-tools";
import { buildOutputName } from "@/lib/tools/pdf/filenames";
import { parsePageRange, formatPageRange } from "@/lib/tools/pdf/page-range";
import { assemblePageText, buildTextDownload, type PageText } from "@/lib/tools/pdf/text";
import { formatFileSize, usePdfDocument } from "@/lib/tools/pdf/usePdfDocument";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { DropZone } from "./ui/DropZone";
import { Field, Hint } from "./ui/Field";
import { OutputPanel } from "./ui/OutputPanel";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { ProgressBar } from "./ui/ProgressBar";
import { StatusLine } from "./ui/StatusLine";
import { TextInput } from "./ui/controls";
import { ToolLayout } from "./ui/ToolLayout";
import { downloadBlob } from "./ui/useDownload";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";
import styles from "./PdfTextTool.module.css";

const MIN_EXTRACTABLE_CHARS = 10;

type Selection = {
  indexes: number[];
  error: string | null;
};

function readSelection(input: string, pageCount: number): Selection {
  try {
    return { indexes: parsePageRange(input, pageCount), error: null };
  } catch (selectionError) {
    return {
      indexes: [],
      error:
        selectionError instanceof Error
          ? selectionError.message
          : "Enter page numbers or ranges, for example 1-3, 5.",
    };
  }
}

function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const haystack = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const haystack = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(<mark key={`${index}-${needle}`} className={styles.textMatch}>{text.slice(index, index + needle.length)}</mark>);
    cursor = index + needle.length;
    index = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

type PdfTextToolProps = {
  definition: LocalDefinition<PdfToolId>;
};

export default function PdfTextTool({ definition }: PdfTextToolProps) {
  const { source, loading, error: fileError, open, clear, setError } = usePdfDocument();
  const [rangeInput, setRangeInput] = useState("all");
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState<PageText[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [extractError, setExtractError] = useState<string | null>(null);
  const runRef = useRef(0);
  const copy = useCopy({ success: "Extracted text copied", failure: "Copy failed — select the page text and copy manually" });

  const selection = useMemo(
    () => (source ? readSelection(rangeInput, source.pageCount) : { indexes: [], error: null }),
    [rangeInput, source],
  );

  const selectedPages = useMemo(() => {
    const wanted = new Set(selection.indexes);
    return pages.filter((page) => wanted.has(page.pageNumber - 1));
  }, [pages, selection.indexes]);

  const normalizedSearch = search.trim();
  const matches = useMemo(
    () =>
      selectedPages.map((page) => ({
        pageNumber: page.pageNumber,
        count: countMatches(page.text, normalizedSearch),
      })),
    [selectedPages, normalizedSearch],
  );
  const totalMatches = matches.reduce((total, entry) => total + entry.count, 0);
  const matchingPages = matches.filter((entry) => entry.count > 0).length;

  const emptyTextPages = selectedPages.filter(
    (page) => page.text.replace(/\s+/g, "").length < MIN_EXTRACTABLE_CHARS,
  );
  const downloadText = buildTextDownload(selectedPages);

  function resetExtraction() {
    runRef.current += 1;
    setPages([]);
    setProgress(0);
    setBusy(false);
    setRangeInput("all");
    setSearch("");
    setNotice("");
    setExtractError(null);
    copy.setMessage("");
  }

  async function handleFiles(files: FileList) {
    const file = files[0];
    if (!file) return;
    resetExtraction();
    setError(null);
    await open(file);
  }

  function handleClear() {
    resetExtraction();
    clear();
  }

  async function extractText() {
    if (!source) return;
    const run = runRef.current + 1;
    runRef.current = run;
    setBusy(true);
    setExtractError(null);
    setNotice("");
    setPages([]);
    setProgress(0);
    copy.setMessage("");

    try {
      const extracted: PageText[] = [];
      for (let pageNumber = 1; pageNumber <= source.pageCount; pageNumber += 1) {
        if (run !== runRef.current) return;
        const page = await source.doc.getPage(pageNumber);
        const content = await page.getTextContent();
        extracted.push({ pageNumber, text: assemblePageText(content.items) });
        page.cleanup();
        if (run !== runRef.current) return;
        setProgress(pageNumber);
      }
      setPages(extracted);
      setNotice(
        `Extracted ${extracted.length} page${extracted.length === 1 ? "" : "s"} from "${source.file.name}".`,
      );
    } catch (error) {
      if (run === runRef.current) {
        setExtractError(
          error instanceof Error && error.message
            ? `Could not extract text: ${error.message}`
            : "Could not extract text from this PDF.",
        );
      }
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  return (
    <ToolLayout kind="file" className={styles.textContainer}>
      <Panel title={definition.name} headingId="pdf-to-text-heading" padded>
        <Hint>{definition.description}</Hint>

        <div className={ui.field}>
          <span className={ui.fieldLabel}>Source PDF</span>
          <span className={ui.hint}>Choose a PDF. Text extraction runs locally; nothing is uploaded.</span>
        </div>
        <DropZone
          label="Choose a PDF file"
          accept=".pdf,application/pdf"
          disabled={loading || busy}
          onFiles={handleFiles}
        >
          <span className={styles.textDropTitle}>
            {source ? `Selected: ${source.file.name}` : "Click or drag a PDF file here"}
          </span>
          <span className={styles.textDropSub}>
            {source
              ? `${formatFileSize(source.file.size)} · ${source.pageCount} page${source.pageCount === 1 ? "" : "s"}`
              : "PDF only · processed in this browser"}
          </span>
        </DropZone>

        {loading && <StatusLine>Reading the PDF and starting the local worker…</StatusLine>}
        {fileError && <Callout kind="error">{fileError}</Callout>}

        <div className={styles.textControls}>
          <Field
            id="pdf-text-range"
            label="Pages to show"
            hint='Use all, or numbers and ranges such as 1-3, 5, -4 or 4-.'
          >
            <TextInput
              id="pdf-text-range"
              name="pdf-text-range"
              value={rangeInput}
              disabled={!source || busy}
              onChange={(event) => setRangeInput(event.target.value)}
              placeholder="all"
            />
          </Field>
          <Field
            id="pdf-text-search"
            label="Search extracted text"
            hint="Case-insensitive. Match counts include every selected page."
          >
            <TextInput
              id="pdf-text-search"
              name="pdf-text-search"
              type="search"
              value={search}
              disabled={pages.length === 0}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. invoice"
            />
          </Field>
        </div>

        {selection.error && <Callout kind="error">{selection.error}</Callout>}

        <div className={ui.actions}>
          <Button
            variant="primary"
            onClick={extractText}
            disabled={!source || loading || busy}
          >
            {busy ? "Extracting text…" : "Extract Text"}
          </Button>
          <Button onClick={handleClear} disabled={!source || loading || busy}>Clear</Button>
        </div>

        {busy && (
          <ProgressBar
            label="Extracting page text"
            value={progress}
            max={source?.pageCount ?? 0}
            detail={`Page ${Math.min(progress + 1, source?.pageCount ?? 1)} of ${source?.pageCount ?? 0}`}
          />
        )}

        <StatusLine>{notice || (busy ? "Reading embedded text page by page." : "")}</StatusLine>
        {extractError && <Callout kind="error">{extractError}</Callout>}
        {emptyTextPages.length > 0 && (
          <Callout kind="warning">
            {emptyTextPages.length === 1 ? "Page" : "Pages"}{" "}
            {formatPageRange(emptyTextPages.map((page) => page.pageNumber - 1))}
            {emptyTextPages.length === 1 ? " has" : " have"} little or no embedded text. It may be a scan or an image-only page.
            This extractor reads the PDF&apos;s text layer; it does not perform OCR.
          </Callout>
        )}
        <PrivacyNote>
          The file is parsed by a self-hosted PDF.js worker in your browser. No document bytes or extracted text leave this device.
        </PrivacyNote>
      </Panel>

      <OutputPanel
        title="Extracted text"
        headingId="pdf-to-text-output"
        label="Extracted text"
        value={downloadText}
        empty={source && pages.length === 0 ? "Extract text to see page-by-page results." : "Choose a PDF and extract its text."}
        filename={source ? buildOutputName(source.file.name, "text", "txt") : undefined}
        mimeType="text/plain"
        onCopy={() => void copy.copy(downloadText)}
        onDownload={() =>
          source && downloadBlob(downloadText, buildOutputName(source.file.name, "text", "txt"), "text/plain;charset=utf-8")
        }
        downloadDisabled={!downloadText}
        copyDisabled={!downloadText}
        busy={busy}
      >
        {pages.length > 0 ? (
          <>
            {normalizedSearch ? (
              <StatusLine>
                {totalMatches === 0
                  ? `No matches for "${normalizedSearch}" on the selected pages.`
                  : `${totalMatches} match${totalMatches === 1 ? "" : "es"} for "${normalizedSearch}" across ${matchingPages} page${matchingPages === 1 ? "" : "s"}.`}
              </StatusLine>
            ) : (
              <StatusLine>
                {selectedPages.length} of {pages.length} extracted page{pages.length === 1 ? "" : "s"} shown.
              </StatusLine>
            )}
            {copy.message && <StatusLine>{copy.message}</StatusLine>}
            {selectedPages.length === 0 ? (
              <Callout kind="info">No pages match the current page selection.</Callout>
            ) : (
              <div className={styles.textPages}>
                {selectedPages.map((page) => {
                  const count = normalizedSearch ? countMatches(page.text, normalizedSearch) : 0;
                  const noText = page.text.replace(/\s+/g, "").length < MIN_EXTRACTABLE_CHARS;
                  return (
                    <section key={page.pageNumber} className={styles.textPage} aria-labelledby={`pdf-text-page-${page.pageNumber}`}>
                      <div className={styles.textPageHeader}>
                        <h3 id={`pdf-text-page-${page.pageNumber}`} className={styles.textPageTitle}>
                          Page {page.pageNumber}
                        </h3>
                        <span className={styles.textPageMeta}>
                          {noText
                            ? "No extractable text"
                            : `${page.text.replace(/\s+/g, "").length} characters`}
                          {normalizedSearch ? ` · ${count} match${count === 1 ? "" : "es"}` : ""}
                        </span>
                      </div>
                      <pre tabIndex={0} aria-label={`Extracted text for page ${page.pageNumber}`} className={`${ui.output} ${styles.textPageText}`}>
                        {page.text ? <HighlightedText text={page.text} query={normalizedSearch} /> : "No extractable text on this page. It may be a scan; OCR is not performed."}
                      </pre>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        ) : undefined}
      </OutputPanel>
    </ToolLayout>
  );
}
