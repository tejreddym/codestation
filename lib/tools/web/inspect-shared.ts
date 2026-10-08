import { WebError, type WebValues } from "./types";

export const INSPECT_TEXT_LIMIT = 200_000;
export const INSPECT_ROW_LIMIT = 1_000;

export function inspectText(values: WebValues, field: string, required = false): string {
  const value = values[field];
  if (value !== undefined && typeof value !== "string") throw new WebError("Enter a text value.", field);
  const text = typeof value === "string" ? value : "";
  if (text.length > INSPECT_TEXT_LIMIT) throw new WebError("Text is limited to 200,000 characters.", field);
  if (required && !text.trim()) throw new WebError("Enter a value.", field);
  return text;
}

export function assertScalars(text: string, field: string): void {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new WebError("Text contains an unpaired Unicode surrogate.", field);
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new WebError("Text contains an unpaired Unicode surrogate.", field);
  }
}

export function absoluteUrl(text: string, field: string): URL {
  try { return new URL(text); } catch { throw new WebError("Enter a valid absolute URL, including its scheme.", field); }
}

export type InspectParameter = { key: string; value: string };

export function parameterRows(values: WebValues): InspectParameter[] {
  const rows = values.parameters ?? [];
  if (!Array.isArray(rows)) throw new WebError("Parameters must be key/value rows.", "parameters");
  if (rows.length > INSPECT_ROW_LIMIT) throw new WebError("Use at most 1,000 parameter rows.", "parameters");
  let size = 0;
  return rows.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new WebError("Each parameter needs a text key and value.", "parameters");
    const record = row as Record<string, unknown>;
    if (typeof record.key !== "string" || typeof record.value !== "string") throw new WebError("Each parameter needs a text key and value.", "parameters");
    size += record.key.length + record.value.length;
    if (size > INSPECT_TEXT_LIMIT) throw new WebError("Combined parameter text is limited to 200,000 characters.", "parameters");
    assertScalars(record.key, "parameters");
    assertScalars(record.value, "parameters");
    return { key: record.key, value: record.value };
  });
}

export function searchRows(query: string, field: string): InspectParameter[] {
  const rows: InspectParameter[] = [];
  for (const [key, value] of new URLSearchParams(query)) {
    if (rows.length >= INSPECT_ROW_LIMIT) throw new WebError("Use at most 1,000 query parameters.", field);
    rows.push({ key, value });
  }
  return rows;
}

export type PercentRun = { raw: string; decoded: string; position: number; end: number; valid: boolean; issue?: string; invalidPositions?: number[] };
export type PercentInspection = { runs: PercentRun[]; decoded: string; warnings: string[] };

/** Positions are zero-based UTF-16 offsets; only valid UTF-8 is decoded. Invalid source survives verbatim. */
export function inspectPercent(text: string, field = "input"): PercentInspection {
  const runs: PercentRun[] = [];
  const chunks: string[] = [];
  const warnings: string[] = [];
  let cursor = 0;
  for (let i = 0; i < text.length;) {
    if (text[i] !== "%") { i++; continue; }
    if (runs.length >= INSPECT_ROW_LIMIT) throw new WebError("Use at most 1,000 percent-encoded runs or malformed escapes.", field);
    chunks.push(text.slice(cursor, i));
    const start = i;
    if (!/^[0-9a-f]{2}$/i.test(text.slice(i + 1, i + 3))) {
      let end = Math.min(i + 3, text.length);
      for (let next = i + 1; next < end; next++) if (text[next] === "%") { end = next; break; }
      const raw = text.slice(i, end);
      const issue = "Malformed percent escape";
      runs.push({ raw, decoded: raw, position: start, end: start + raw.length, valid: false, issue });
      // Advance only past %, so a later valid escape is still independently inspected.
      chunks.push("%");
      i++;
      cursor = i;
      if (warnings.length < 10) warnings.push(`${issue} at position ${start}; preserved in the decoded preview.`);
      continue;
    }
    while (text[i] === "%" && /^[0-9a-f]{2}$/i.test(text.slice(i + 1, i + 3))) i += 3;
    const raw = text.slice(start, i);
    const decodedParts: string[] = [];
    const invalidPositions: number[] = [];
    for (let offset = 0; offset < raw.length;) {
      const first = Number.parseInt(raw.slice(offset + 1, offset + 3), 16);
      const byteCount = first < 0x80 ? 1 : first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
      const candidate = raw.slice(offset, offset + byteCount * 3);
      let decodedPart: string | undefined;
      if (byteCount && candidate.length === byteCount * 3) {
        try { decodedPart = decodeURIComponent(candidate); } catch { /* Invalid UTF-8 stays verbatim. */ }
      }
      if (decodedPart !== undefined) { decodedParts.push(decodedPart); offset += byteCount * 3; }
      else { decodedParts.push(raw.slice(offset, offset + 3)); invalidPositions.push(start + offset); offset += 3; }
    }
    const decoded = decodedParts.join("");
    const issue = invalidPositions.length ? "Invalid UTF-8 percent sequence" : undefined;
    runs.push({ raw, decoded, position: start, end: i, valid: !issue, ...(issue ? { issue, invalidPositions } : {}) });
    chunks.push(decoded);
    cursor = i;
    if (issue && warnings.length < 10) warnings.push(`${issue} at position ${invalidPositions[0]}; invalid bytes preserved in the decoded preview.`);
  }
  chunks.push(text.slice(cursor));
  return { runs, decoded: chunks.join(""), warnings };
}
