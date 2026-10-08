/** Resource budgets count UTF-16 code units, as JavaScript strings do. */
export const INPUT_LIMIT = 1_000_000;
export const OUTPUT_LIMIT = 4_000_000;
export const LINE_LIMIT = 100_000;
export const HIT_LIMIT = 10_000;

export function assertOutputSize(size: number): void {
  if (!Number.isSafeInteger(size) || size > OUTPUT_LIMIT) {
    throw new Error("The result exceeds the 4,000,000-character output limit. Use a smaller input.");
  }
}

export function assertLineCount(text: string): void {
  if (!text) return;
  let count = 0;
  const endings = /\r\n|\r|\n/g;
  let match: RegExpExecArray | null;
  let end = 0;
  while ((match = endings.exec(text))) {
    count++;
    end = match.index + match[0].length;
    if (count > LINE_LIMIT) throw new Error("Input exceeds the 100,000-line limit.");
  }
  if (end < text.length) count++;
  if (count > LINE_LIMIT) throw new Error("Input exceeds the 100,000-line limit.");
}

export interface Lines {
  records: string[];
  separator: string;
  terminal: boolean;
}

/** A terminal separator terminates the last record; it never adds a phantom record. */
export function readLines(text: string): Lines {
  assertLineCount(text);
  if (!text) return { records: [], separator: "\n", terminal: false };
  const separator = /\r\n|\r|\n/.exec(text)?.[0] ?? "\n";
  const terminal = /[\r\n]$/.test(text);
  const records = text.split(/\r\n|\r|\n/);
  if (terminal) records.pop();
  return { records, separator, terminal };
}

export function writeLines(lines: Lines, records = lines.records): string {
  if (!records.length) return "";
  // A final empty record needs its own terminator or it would disappear when
  // re-read (e.g. reversing "\nb" must retain the blank line after b).
  const terminal = lines.terminal || records[records.length - 1] === "";
  const size = records.reduce((sum, line) => sum + line.length, 0)
    + (records.length - 1 + Number(terminal)) * lines.separator.length;
  assertOutputSize(size);
  return records.join(lines.separator) + (terminal ? lines.separator : "");
}

export function positiveInteger(value: string, maximum: number, label: string): number {
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > maximum) {
    throw new Error(`${label} must be a whole number from 1 to ${maximum.toLocaleString("en-US")}.`);
  }
  return Number(value);
}

/** Rejection sampling avoids modulo bias, including for Fisher–Yates. */
export function randomIndex(bound: number): number {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure local randomness is unavailable in this browser.");
  const range = 0x1_0000_0000;
  const ceiling = range - range % bound;
  const word = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(word); } while (word[0] >= ceiling);
  return word[0] % bound;
}
