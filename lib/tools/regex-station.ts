export const REGEX_FLAGS = ["g", "m", "i", "s", "u", "y"] as const;
export type RegexOperation = "test" | "replace" | "inspect" | "groups" | "flags" | "capture" | "split";
export interface RegexRequest { operation: RegexOperation; pattern: string; flags: string; text: string; replacement?: string; limit?: number; }
export interface RegexMatch { match: string; index: number; end: number; captures: Array<string | undefined>; groups: Record<string, string | undefined>; }
export interface RegexResult { matches?: RegexMatch[]; count?: number; output?: string; parts?: string[]; pattern?: string; flags?: string; escaped?: string; truncated?: boolean; }

const MAX_TEXT = 200_000;
const MAX_RESULTS = 2_000;
export function escapeRegexLiteral(value: string): string { return value.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&"); }
export function advanceStringIndex(value: string, index: number, unicode: boolean): number {
  if (!unicode || index >= value.length) return index + 1;
  const code = value.charCodeAt(index);
  return code >= 0xd800 && code <= 0xdbff && index + 1 < value.length && (value.charCodeAt(index + 1) & 0xfc00) === 0xdc00 ? index + 2 : index + 1;
}
function compile(pattern: string, flags: string): RegExp {
  const unique = [...new Set(flags)].join("");
  if ([...unique].some((flag) => !(REGEX_FLAGS as readonly string[]).includes(flag))) throw new Error("Supported flags are g, m, i, s, u, and y.");
  try { return new RegExp(pattern, unique); } catch (error) { throw new Error(error instanceof Error ? error.message : "Invalid regular expression."); }
}
function collect(regex: RegExp, text: string, limit: number): RegexMatch[] {
  const result: RegexMatch[] = []; let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    result.push({ match: match[0], index: match.index, end: match.index + match[0].length, captures: match.slice(1), groups: { ...(match.groups ?? {}) } });
    if (result.length >= limit || !regex.global) break;
    if (match[0] === "") regex.lastIndex = advanceStringIndex(text, regex.lastIndex, regex.unicode);
  }
  return result;
}
export function runRegexOperation(request: RegexRequest): RegexResult {
  const text = request.text.slice(0, MAX_TEXT); const limit = Math.max(1, Math.min(request.limit ?? MAX_RESULTS, MAX_RESULTS));
  if (request.operation === "test") { const regex = compile(request.pattern, request.flags); return { count: collect(regex, text, 1).length }; }
  if (request.operation === "replace") { const regex = compile(request.pattern, request.flags.includes("g") ? request.flags : `${request.flags}g`); const matches = collect(regex, text, limit); return { output: text.replace(regex, request.replacement ?? ""), count: matches.length, matches }; }
  if (request.operation === "split") { const regex = compile(request.pattern, request.flags); return { parts: text.split(regex).slice(0, limit), count: text.split(regex).length }; }
  const regex = compile(request.pattern, request.flags); const matches = collect(regex, text, limit);
  if (request.operation === "groups" || request.operation === "capture") return { matches, count: matches.length };
  return { matches, count: matches.length, pattern: request.pattern, flags: [...new Set(request.flags)].join(""), truncated: matches.length >= limit };
}
