export type SpreadsheetValues = Record<string, unknown>;
export type SpreadsheetResult = { files?: { name: string; blob: Blob }[]; text?: string; data: Record<string, unknown>; preview?: { sheetNames: string[]; name: string; rows: string[][] }; warnings?: string[] };
export type SpreadsheetInfo = { sheetNames: string[]; sheets: { name: string; headers: string[]; rowCount: number; columnCount: number; formulaCount: number }[] };
export class SpreadsheetError extends Error { constructor(message: string, public field?: string) { super(message); this.name = "SpreadsheetError"; } }
