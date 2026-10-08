/** Browser-independent Cron contracts; processing loads only on an explicit action. */
export const cronToolIds = ["cron-generator", "cron-explainer", "cron-validator", "cron-next-run", "human-to-cron", "cron-to-human"] as const;
export type CronToolId = (typeof cronToolIds)[number];

export type CronInputField = {
  name: string;
  label: string;
  control: "text" | "timezone";
  placeholder?: string;
  hint?: string;
  optional?: boolean;
};

export type CronToolContract = {
  fields: readonly CronInputField[];
  defaults: Readonly<Record<string, string>>;
  example: Readonly<Record<string, string>>;
  action: string;
  outputLabel: string;
  outputs: readonly string[];
  notices: readonly string[];
  purpose: string;
  usage: string;
  privacyMessage: string;
};

export type CronToolDefinition = {
  id: CronToolId;
  slug: CronToolId;
  name: string;
  description: string;
  category: "Cron";
  keywords: readonly string[];
  cronContract: CronToolContract;
  relatedTools: readonly CronToolId[];
  seo: { title: string; description: string };
};

const notation = "Supported notation: '*' / '1-5' / '1,3,5' / '*/5' / '5-20/3'.";
const expression: CronInputField = {
  name: "expression", label: "Cron expression", control: "text", placeholder: "0 9 * * 1-5",
  hint: "Five fields: minute hour day-of-month month day-of-week. Six fields add seconds first. Bounds: seconds/minutes 0–59, hours 0–23, day-of-month 1–31, months 1–12 (JAN–DEC), weekdays 0–7 (MON–SUN; 0 and 7 are Sunday).",
};
const syntaxNotice = "Five-field Unix cron or an explicit six-field seconds-first extension. " + notation + " Month names JAN–DEC and weekday names MON–SUN are supported.";
const dayNotice = "Unix day rules: if either day field begins with '*', both day fields must match. Otherwise day-of-month and day-of-week use OR: a match on either is sufficient.";
const privacyMessage = "Processed locally in your browser. Inputs and results are not uploaded or saved by this page.";

function define(
  id: CronToolId, name: string, description: string, fields: readonly CronInputField[],
  action: string, outputs: readonly string[], usage: string, example: Record<string, string>,
  notices: readonly string[], relatedTools: readonly CronToolId[], defaults: Record<string, string> = {},
): CronToolDefinition {
  return {
    id, slug: id, name, description, category: "Cron",
    keywords: [...new Set([...name.toLowerCase().split(/[\s-]+/), "cron", "schedule", "local", "browser"])],
    relatedTools,
    seo: { title: `${name} — Browser-local Cron Tool`, description },
    cronContract: {
      fields, action, outputs, outputLabel: outputs.length === 1 ? outputs[0] : `${name} results`,
      defaults: { ...Object.fromEntries(fields.map(field => [field.name, ""])), ...defaults },
      example, notices, purpose: description, privacyMessage,
      usage: `${usage} Choose “${action}”, then copy individual result values. Clear restores the initial field defaults and removes results and messages.`,
    },
  };
}

export const cronTools: readonly CronToolDefinition[] = [
  define(
    "cron-generator", "Cron Expression Generator",
    "Build a cron expression from explicit second, minute, hour, day-of-month, month and weekday fields, with a readable schedule.",
    [
      { name: "second", label: "Second", control: "text", optional: true, placeholder: "Not used (five-field Unix)", hint: "Optional: leave blank for five-field Unix. Any nonempty value, including '*', selects six fields with seconds first. Bounds: 0–59. " + notation },
      { name: "minute", label: "Minute", control: "text", placeholder: "*", hint: "Bounds: 0–59. " + notation },
      { name: "hour", label: "Hour", control: "text", placeholder: "*", hint: "Bounds: 0–23. " + notation },
      { name: "dayOfMonth", label: "Day of month", control: "text", placeholder: "*", hint: "Bounds: 1–31. " + notation },
      { name: "month", label: "Month", control: "text", placeholder: "*", hint: "Bounds: 1–12 or JAN–DEC. " + notation },
      { name: "dayOfWeek", label: "Day of week", control: "text", placeholder: "*", hint: "Bounds: 0–7 or MON–SUN; 0 and 7 are Sunday. " + notation },
    ],
    "Generate cron expression", ["Cron expression", "Human-readable schedule"],
    "Enter each schedule field using the supported notation. Leave Second blank for five-field Unix or enter it to use six fields.",
    { second: "", minute: "*/5", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" },
    ["Five-field Unix by default. A supplied Second enables only the seconds-first extension; this is not Quartz, Jenkins or AWS syntax.", dayNotice], ["cron-explainer", "cron-validator", "cron-next-run"],
    { second: "", minute: "*", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" },
  ),
  define(
    "cron-explainer", "Cron Explainer",
    "Explain a cron expression with a field-by-field breakdown and a human-readable schedule in your browser.",
    [expression], "Explain cron expression", ["Field breakdown", "Human-readable schedule"],
    "Enter a five-field expression or an explicit seconds-first six-field expression.",
    { expression: "0 9 * * 1-5" }, [syntaxNotice, dayNotice], ["cron-generator", "cron-validator", "cron-to-human"],
  ),
  define(
    "cron-validator", "Cron Validator",
    "Validate cron field syntax and bounds locally and see a clear Valid or Invalid status with the error message.",
    [expression], "Validate cron expression", ["Valid/Invalid status", "Error message"],
    "Enter the expression to validate. Invalid expressions are reported as a status and error message.",
    { expression: "0 9 * * 1-5" }, [syntaxNotice, "Syntax validation does not guarantee that a schedule has a future occurrence."], ["cron-generator", "cron-explainer", "cron-next-run"],
  ),
  define(
    "cron-next-run", "Cron Next Run",
    "Find the next cron occurrence after an explicit reference instant in a required IANA timezone and show the elapsed time until it.",
    [
      expression,
      { name: "reference", label: "Reference date/time", control: "text", placeholder: "2026-10-05T09:00:00+05:30", hint: "The picker edits UTC. You can manually enter an ISO date/time in 1970–2099 with an explicit Z or ±HH:mm offset. Date-only and offset-free values are not accepted. Current date and time uses a fresh snapshot of your device clock only when clicked." },
      { name: "timezone", label: "Timezone", control: "timezone", placeholder: "Search an IANA timezone", hint: "Required: search or enter an IANA timezone, such as Asia/Kolkata, America/New_York or UTC. Cron fields match the wall clock in this zone." },
    ],
    "Calculate next run", ["Next run date/time", "Time until next run"],
    "Enter the expression, the reference instant with its UTC offset and the schedule’s IANA timezone. The picker edits UTC; manual ISO values with an explicit offset are allowed. No reference time or timezone is filled automatically. Click “Current date and time” to fill only the reference with a fresh device-clock snapshot in UTC; it does not refresh automatically.",
    { expression: "0 9 * * 1-5", reference: "2026-10-05T00:00:00Z", timezone: "Asia/Kolkata" },
    [syntaxNotice, dayNotice, "The next run is strictly after the supplied reference. Timezone rules come from your browser’s IANA database; supported reference years are 1970–2099. Search is limited to eight years and ends in 2099. Skipped wall times do not run; repeated wall times can run at either matching instant. Historical offsets containing seconds cannot be represented in this output and produce an error."],
    ["cron-validator", "cron-explainer", "cron-generator"],
  ),
  define(
    "human-to-cron", "Human to Cron",
    "Convert supported human schedule descriptions to a five-field cron expression and inspect the parsed schedule locally.",
    [{ name: "description", label: "Human schedule description", control: "text", placeholder: "every Monday at 10:30", hint: "Supported: every minute, every N minutes (1–59), every hour, every day at HH:mm, every Monday (or another weekday) at HH:mm, and weekdays at HH:mm. Times use a 24-hour clock." }],
    "Convert human schedule", ["Cron expression", "Parsed schedule"],
    "Enter a supported schedule description, for example every Monday at 10:30.",
    { description: "every Monday at 10:30" }, ["Descriptions use a deterministic supported grammar, not an AI service. Ambiguous or unsupported text is rejected rather than guessed."],
    ["cron-to-human", "cron-generator", "cron-validator"],
  ),
  define(
    "cron-to-human", "Cron to Human",
    "Translate a cron expression into a readable explanation with individual field interpretations, entirely in your browser.",
    [expression], "Convert cron to human", ["Human-readable explanation"],
    "Enter a five-field cron expression or the explicit six-field seconds-first extension.",
    { expression: "0 9 * * 1-5" }, [syntaxNotice, dayNotice], ["human-to-cron", "cron-explainer", "cron-validator"],
  ),
];

export function isCronToolId(id: string): id is CronToolId { return cronTools.some(tool => tool.id === id); }
export function getCronDefinition(idOrSlug: string): CronToolDefinition | undefined { return cronTools.find(tool => tool.id === idOrSlug || tool.slug === idOrSlug); }
