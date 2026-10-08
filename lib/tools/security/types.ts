/** Security values exist only in page/worker memory and never become URL or telemetry data. */
export type SecurityValues = Record<string, string | boolean>;
export interface SecurityRequest { values: SecurityValues; file?: File }
export interface SecurityResult { text: string; parts?: { label: string; value: string }[] }
