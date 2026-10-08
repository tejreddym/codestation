/** Five-field Unix cron, or the explicit seconds-first six-field extension. */
export type CronFieldName = "second" | "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";
export interface ParsedCronField {
  name: CronFieldName;
  label: string;
  expression: string;
  values: number[];
  /** Vixie cron's star flag is determined by the first character, including */
  wildcard: boolean;
  min: number;
  max: number;
}
export interface ParsedCron {
  expression: string;
  hasSeconds: boolean;
  fields: ParsedCronField[];
  second: ParsedCronField;
  minute: ParsedCronField;
  hour: ParsedCronField;
  dayOfMonth: ParsedCronField;
  month: ParsedCronField;
  dayOfWeek: ParsedCronField;
  dayMode: "and" | "or";
}

export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const SPECS: { name: CronFieldName; label: string; min: number; max: number }[] = [
  { name: "second", label: "Second", min: 0, max: 59 },
  { name: "minute", label: "Minute", min: 0, max: 59 },
  { name: "hour", label: "Hour", min: 0, max: 23 },
  { name: "dayOfMonth", label: "Day of month", min: 1, max: 31 },
  { name: "month", label: "Month", min: 1, max: 12 },
  { name: "dayOfWeek", label: "Day of week", min: 0, max: 7 },
];

function parseField(expression: string, spec: typeof SPECS[number]): ParsedCronField {
  const fail = (message: string): never => { throw new Error(`${spec.label}: ${message}`); };
  if (expression.length > 128) fail("field exceeds the 128-character limit.");
  if (!expression) fail("field cannot be empty.");
  const endpoint = (text: string): number => {
    let value: number;
    if (/^\d+$/.test(text)) value = Number(text);
    else if (spec.name === "month" && MONTH_NAMES.includes(text.toUpperCase())) value = MONTH_NAMES.indexOf(text.toUpperCase()) + 1;
    else if (spec.name === "dayOfWeek" && WEEKDAY_NAMES.includes(text.toUpperCase())) value = WEEKDAY_NAMES.indexOf(text.toUpperCase());
    else return fail("use integer values, permitted month/weekday names, *, ranges, lists or steps.");
    if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) fail(`value must be between ${spec.min} and ${spec.max}.`);
    return value;
  };
  const selected = new Set<number>();
  for (const item of expression.split(",")) {
    if (!item) fail("lists cannot contain empty items.");
    const pieces = item.split("/");
    if (pieces.length > 2 || !pieces[0]) fail("malformed step notation.");
    let step = 1;
    if (pieces.length === 2) {
      if (!/^\d+$/.test(pieces[1])) fail("step must be a positive integer.");
      step = Number(pieces[1]);
      if (!Number.isSafeInteger(step) || step < 1 || step > spec.max - spec.min + 1) fail(`step must be between 1 and ${spec.max - spec.min + 1}.`);
    }
    const base = pieces[0];
    let first: number;
    let last: number;
    if (base === "*") { first = spec.min; last = spec.max; }
    else {
      const range = base.split("-");
      if (range.length > 2 || range.some(value => !value)) fail("malformed range; negative values are not supported.");
      first = endpoint(range[0]);
      last = range.length === 2 ? endpoint(range[1]) : pieces.length === 2 ? spec.max : first;
      if (last < first) fail("descending or wrapping ranges are not supported.");
    }
    for (let value = first; value <= last; value += step) selected.add(spec.name === "dayOfWeek" && value === 7 ? 0 : value);
  }
  return { ...spec, expression, values: [...selected].sort((a, b) => a - b), wildcard: expression.startsWith("*") };
}

export function parseCron(expression: string): ParsedCron {
  if (typeof expression !== "string" || !expression.trim()) throw new Error("Enter a cron expression.");
  if (expression.length > 1024) throw new Error("Cron expression exceeds the 1,024-character limit.");
  // Reject unsupported dialects as complete tokens/patterns; names such as JUL and WED remain valid.
  if (/[?#]/.test(expression) || /(?:^|[\s,/-])(?:L|LW|\d+[LW]|W|H(?:\([^)]*\))?)(?=$|[\s,/-])/i.test(expression) || /\b(?:cron|rate)\s*\(/i.test(expression)) {
    throw new Error("Quartz, AWS and Jenkins extensions (?, L, W, # and H) are not supported; use Unix numeric cron notation.");
  }
  if (expression.includes("@")) throw new Error("Cron macros are not supported; enter five Unix fields or six seconds-first fields.");
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length !== 5 && tokens.length !== 6) throw new Error("Expected five Unix fields or six seconds-first fields; years, commands, comments and environment assignments are not supported.");
  const hasSeconds = tokens.length === 6;
  const fields = tokens.map((token, index) => parseField(token, SPECS[index + (hasSeconds ? 0 : 1)]));
  const second = hasSeconds ? fields[0] : parseField("0", SPECS[0]);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.slice(hasSeconds ? 1 : 0);
  return { expression, hasSeconds, fields, second, minute, hour, dayOfMonth, month, dayOfWeek, dayMode: dayOfMonth.wildcard || dayOfWeek.wildcard ? "and" : "or" };
}

export function matchesCronDate(cron: ParsedCron, year: number, month: number, day: number): boolean {
  if (!cron.month.values.includes(month)) return false;
  const dom = cron.dayOfMonth.values.includes(day);
  const dow = cron.dayOfWeek.values.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
  return cron.dayMode === "and" ? dom && dow : dom || dow;
}
