/** Page-selection parsing for the browser-local PDF tools. */

export class PageRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageRangeError";
  }
}

/**
 * Parses a human page range into zero-based page indexes.
 *
 * Accepted: `1-3,5`, `all` (or an empty string), open ranges such as `-3`
 * (pages 1-3) and `4-` (page 4 to the end), and arbitrary whitespace.
 * Duplicates are removed and the result is sorted ascending.
 */
export function parsePageRange(input: string, pageCount: number): number[] {
  const max = Number.isFinite(pageCount) ? Math.max(0, Math.trunc(pageCount)) : 0;
  const value = (input ?? "").trim();

  if (!value || value.toLowerCase() === "all") {
    return Array.from({ length: max }, (_, index) => index);
  }

  const parts = value.split(",").map((part) => part.trim().replace(/\s+/g, ""));
  if (parts.some((part) => part.length === 0)) {
    throw new PageRangeError("Page ranges cannot contain empty items. Remove extra commas and try again.");
  }

  const selected = new Set<number>();

  for (const part of parts) {
    if (part.toLowerCase() === "all") {
      throw new PageRangeError('Use "all" by itself, or list specific pages.');
    }

    if (/^\d+$/.test(part)) {
      const page = Number(part);
      if (!Number.isSafeInteger(page) || page < 1 || page > max) {
        throw new PageRangeError(`Page ${part} is outside this document (1-${max}).`);
      }
      selected.add(page - 1);
      continue;
    }

    const match = /^(\d*)-(\d*)$/.exec(part);
    if (!match || (!match[1] && !match[2])) {
      throw new PageRangeError(
        `"${part}" is not a valid page number or range. Use formats like 3, 1-3, -3 or 4-.`,
      );
    }

    const hasStart = match[1].length > 0;
    const hasEnd = match[2].length > 0;
    const start = hasStart ? Number(match[1]) : 1;
    const end = hasEnd ? Number(match[2]) : max;

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      throw new PageRangeError(`"${part}" is outside the valid page numbers.`);
    }

    if (hasStart && hasEnd && start > end) {
      throw new PageRangeError(`Page range ${start}-${end} is reversed. Put the smaller page first.`);
    }

    if (start < 1 || start > max || end < 1 || end > max) {
      const label = hasStart && hasEnd ? `Page range ${start}-${end}` : `Page range "${part}"`;
      throw new PageRangeError(`${label} is outside this document (1-${max}).`);
    }

    if (end < start) {
      throw new PageRangeError(`Page range "${part}" is outside this document (1-${max}).`);
    }

    for (let page = start; page <= end; page += 1) {
      selected.add(page - 1);
    }
  }

  return [...selected].sort((a, b) => a - b);
}

/** Formats zero-based indexes as a compact one-based label, e.g. 1-3, 5. */
export function formatPageRange(indexes: readonly number[]): string {
  const pages = [...new Set(indexes.map((index) => index + 1))].sort((a, b) => a - b);
  if (pages.length === 0) return "";
  const ranges: string[] = [];
  let start = pages[0];
  let previous = pages[0];

  for (let index = 1; index < pages.length; index += 1) {
    const page = pages[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = page;
    previous = page;
  }
  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(", ");
}
