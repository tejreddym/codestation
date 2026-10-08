import type { TextDiffRow, TextResult } from "./types";
import { assertOutputSize } from "./shared";

/** Tokens include their original terminator, making final newlines and CR/LF changes visible. */
function tokens(text: string): string[] {
  const result = text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g) ?? [];
  if (result.length > 2_000) throw new Error("Text Diff supports at most 2,000 lines in each input.");
  return result;
}

function display(row: TextDiffRow): string {
  const prefix = row.kind === "added" ? "+ " : row.kind === "removed" ? "- " : "  ";
  const ending = /\r\n$/.test(row.text) ? "CRLF" : /\n$/.test(row.text) ? "LF" : /\r$/.test(row.text) ? "CR" : "no line ending";
  return `${prefix}${row.text.replace(/(?:\r\n|\r|\n)$/, "")} [${ending}]`;
}

export function diffText(textA: string, textB: string): TextResult {
  const a = tokens(textA);
  const b = tokens(textB);
  if (a.length * b.length > 4_000_000) throw new Error("Text Diff exceeds the 4,000,000-cell comparison limit.");
  const width = b.length + 1;
  const lengths = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] = a[i] === b[j] ? lengths[(i + 1) * width + j + 1] + 1
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }
  const diff: TextDiffRow[] = [];
  let i = 0;
  let j = 0;
  let size = "Diff resultAdded contentRemoved contentUnchanged content".length;
  const add = (kind: TextDiffRow["kind"], text: string) => {
    // Count cards, readable diff, and content rows before allocating output strings.
    const endingLength = text.endsWith("\r\n") ? 2 : /[\r\n]$/.test(text) ? 1 : 0;
    const tagLength = endingLength === 2 ? 4 : endingLength === 1 ? 2 : 14;
    size += text.length * 3 - endingLength + 5 + tagLength + kind.length + Number(diff.length > 0);
    assertOutputSize(size);
    diff.push({ kind, text });
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      add("unchanged", a[i]); i++; j++;
    } else if (i < a.length && (j === b.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      add("removed", a[i++]);
    } else {
      add("added", b[j++]);
    }
  }
  return { rows: [
    { label: "Diff result", value: diff.map(display).join("\n") },
    { label: "Added content", value: diff.filter((row) => row.kind === "added").map((row) => row.text).join("") },
    { label: "Removed content", value: diff.filter((row) => row.kind === "removed").map((row) => row.text).join("") },
    { label: "Unchanged content", value: diff.filter((row) => row.kind === "unchanged").map((row) => row.text).join("") },
  ], diff };
}
