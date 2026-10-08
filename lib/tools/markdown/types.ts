export type MarkdownValues = Record<string, unknown>;
export type MarkdownResult = { text: string; data: Record<string, unknown>; warnings?: string[] };
export class MarkdownError extends Error { constructor(message: string, public field?: string) { super(message); this.name = "MarkdownError"; } }
