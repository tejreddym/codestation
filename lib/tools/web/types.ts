export type WebValues = Record<string, unknown>;
export type WebResult = {
  text: string;
  data?: Record<string, unknown>;
  copyText?: string;
  warnings?: string[];
  preview?: { title: string; description: string; url: string; imageUrl: string; siteName: string };
};
export class WebError extends Error {
  constructor(message: string, public field?: string) { super(message); this.name = "WebError"; }
}
export const webText = (values: WebValues, name: string): string => typeof values[name] === "string" ? values[name] as string : "";
export function webResult(data: Record<string, unknown>, warnings?: string[]): WebResult {
  return { text: JSON.stringify(data, null, 2), data, warnings };
}
