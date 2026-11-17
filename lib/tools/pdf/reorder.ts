/** Immutable list operations for the PDF page reorderer. */

function assertIndex(index: number, length: number, label: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError(`${label} ${index} is outside the list of ${length} pages.`);
  }
}

/** Returns a new list with one item moved. The input is not mutated. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  assertIndex(from, items.length, "Page index");
  assertIndex(to, items.length, "Target index");
  if (from === to) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Returns a copy without the selected zero-based indexes. */
export function removeItems<T>(items: readonly T[], removed: ReadonlySet<number> | readonly number[]): T[] {
  const indexes = removed instanceof Set ? removed : new Set(removed);
  for (const index of indexes) assertIndex(index, items.length, "Page index");
  return items.filter((_, index) => !indexes.has(index));
}

export type PageOrderEntry = {
  /** One-based position in the new document. */
  position: number;
  /** One-based source page number. */
  originalPage: number;
};

/** Describes the final page order for the mapping summary. */
export function orderMap(originalPageIndexes: readonly number[]): PageOrderEntry[] {
  return originalPageIndexes.map((originalPage, index) => {
    if (!Number.isInteger(originalPage) || originalPage < 0) {
      throw new RangeError(`Original page index ${originalPage} is invalid.`);
    }
    return { position: index + 1, originalPage: originalPage + 1 };
  });
}
