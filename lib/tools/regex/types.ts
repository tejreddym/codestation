export type RegexValues = Record<string, string>;
export interface RegexGroup { number: number; name?: string; value: string | null; indices?: [number, number] | null }
export interface RegexMatch { number: number; value: string; start: number; end: number; length: number; groups: RegexGroup[]; indices?: [number, number] }
export interface RegexDefinition { kind: "capturing" | "named" | "non-capturing" | "lookahead" | "lookbehind"; number?: number; name?: string; source: string; start: number; end: number }
export interface RegexFlagRow { flags: string; valid: boolean; matched: boolean | null; count: number | null; first: string | null; error?: string }
export interface RegexResult {
  kind: "test" | "escape" | "replace" | "inspect" | "groups" | "flags" | "builder" | "capture" | "split";
  text?: string;
  count?: number;
  matched?: boolean;
  matches?: RegexMatch[];
  definitions?: RegexDefinition[];
  rows?: RegexFlagRow[];
  parts?: (string | null)[];
}
