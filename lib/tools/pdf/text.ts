/** Plain-text assembly for pdf.js text items. */

export type PdfTextItemLike = {
  str?: unknown;
  transform?: readonly unknown[];
  height?: unknown;
  hasEOL?: unknown;
  type?: unknown;
};

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function baseline(item: PdfTextItemLike): number | null {
  const y = item.transform?.[5];
  return numeric(y);
}

function itemHeight(item: PdfTextItemLike): number {
  const height = numeric(item.height);
  return height && height > 0 ? height : 12;
}

function endsWithNewline(value: string): boolean {
  return value.endsWith("\n");
}

function appendNewlines(output: string, count: 1 | 2): string {
  let next = output.replace(/[ \t]+$/g, "");
  if (count === 1) {
    if (!endsWithNewline(next)) next += "\n";
  } else {
    next = next.replace(/\n+$/g, "");
    if (next.length > 0) next += "\n\n";
  }
  return next;
}

/**
 * Turns a page's pdf.js text items into readable plain text.
 *
 * - honors `hasEOL` for line breaks;
 * - inserts a blank line for large vertical gaps between runs;
 * - collapses repeated spaces;
 * - joins word-broken lines only for a conservative lowercase `word-` pattern.
 */
export function assemblePageText(items: readonly PdfTextItemLike[]): string {
  let output = "";
  let previous: PdfTextItemLike | null = null;
  let previousText = "";

  for (const item of items) {
    const raw = typeof item.str === "string" ? item.str : "";
    const text = raw.replace(/[ \t]+/g, " ").replace(/^ +| +$/g, "");
    const hasEOL = item.hasEOL === true;

    if (!text) {
      if (hasEOL && output && !endsWithNewline(output)) output += "\n";
      continue;
    }

    const previousBaseline = previous ? baseline(previous) : null;
    const currentBaseline = baseline(item);
    const largeGap =
      previousBaseline !== null &&
      currentBaseline !== null &&
      Math.abs(previousBaseline - currentBaseline) > itemHeight(previous ?? item) * 1.8;

    if (output.length > 0) {
      if (largeGap) {
        output = appendNewlines(output, 2);
      } else if (previous?.hasEOL === true) {
        // Only join a hyphenated line when both sides are clearly lowercase
        // Latin words. This avoids destroying intentional hyphens and ranges.
        if (/[a-z]-$/.test(previousText) && /^[a-z]/.test(text)) {
          output = output.replace(/-$/, "");
        } else {
          output = appendNewlines(output, 1);
        }
      }
    }

    output += text;
    previous = item;
    previousText = text;
  }

  return output
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type PageText = {
  /** One-based page number used in the download separators. */
  pageNumber: number;
  text: string;
};

/** Builds the complete TXT download with stable page markers. */
export function buildTextDownload(pages: readonly PageText[]): string {
  if (pages.length === 0) return "";
  return `${pages
    .map((page) => `--- Page ${page.pageNumber} ---\n${page.text.trim()}`)
    .join("\n\n")}\n`;
}
