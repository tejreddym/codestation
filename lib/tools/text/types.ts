export type TextValues = Record<string, string | boolean>;
export interface TextDiffRow { kind: "added" | "removed" | "unchanged"; text: string }
export interface TextResult { rows: { label: string; value: string }[]; diff?: TextDiffRow[] }
