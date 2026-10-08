export type ApiValues = Record<string, unknown>;
export type ApiResult = { text: string; data?: Record<string, unknown>; copyText?: string; warnings?: string[] };
export class ApiError extends Error { constructor(message: string, public field?: string) { super(message); this.name = "ApiError"; } }
export const apiText = (values: ApiValues, field: string): string => typeof values[field] === "string" ? values[field] as string : "";
export function apiResult(data: Record<string, unknown>, warnings?: string[]): ApiResult { return { text: JSON.stringify(data, null, 2), data, warnings }; }
