export type DateTimeValues = Record<string, string>;
export interface DateTimeResult { rows: { label: string; value: string }[] }
/** Optional deterministic environment for tests; production reads browser values on action. */
export interface DateTimeEnvironment { now?: number; localZone?: string }
