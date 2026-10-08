export type ImageValues = Record<string, unknown>;
export type ImageResult = { blob?: Blob; extension?: string; text?: string; data: Record<string, unknown>; warnings?: string[] };
export class ImageError extends Error { constructor(message: string, public field?: string) { super(message); this.name = "ImageError"; } }
