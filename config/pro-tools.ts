export const PRO_TOOL_IDS = new Set<string>([
  "jwt-decoder",
  "hmac-generator",
  "sql-formatter",
  "cron-next-run",
  "business-days-calculator",
  "regex-match-inspector",
  "json-schema-generator",
  "er-diagram-generator",
]);

export function isProTool(toolId: string): boolean {
  return PRO_TOOL_IDS.has(toolId);
}
