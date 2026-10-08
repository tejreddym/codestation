import type { CronFieldBreakdown } from "./types";
import { MONTH_NAMES, WEEKDAY_NAMES, type ParsedCron, type ParsedCronField } from "./parser";

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const FULL_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (value: number) => String(value).padStart(2, "0");

function valueLabel(field: ParsedCronField, value: number): string {
  return field.name === "month" ? FULL_MONTHS[value - 1] : field.name === "dayOfWeek" ? FULL_WEEKDAYS[value] : String(value);
}

export function interpretField(field: ParsedCronField): string {
  const all = field.name === "dayOfWeek" ? 7 : field.max - field.min + 1;
  if (field.expression === "*") return `Every ${field.label.toLowerCase()} (${field.min}–${field.max}${field.name === "dayOfWeek" ? "; 0 and 7 are Sunday" : ""}).`;
  const selected = field.values.map(value => valueLabel(field, value)).join(", ");
  const kind = field.expression.includes("/") ? "Step selection" : field.expression.includes(",") ? "List selection" : field.expression.includes("-") ? "Inclusive range" : "Selected value";
  return `${kind}: ${selected}.${field.values.length === all ? " Selects every allowed value." : ""}${field.name === "dayOfWeek" ? " Sunday is 0 or 7; range/step expansion uses 0–7 before merging Sunday." : ""}`;
}

export function cronFields(cron: ParsedCron): CronFieldBreakdown[] {
  return cron.fields.map(field => ({ label: field.label, expression: field.expression, interpretation: interpretField(field) }));
}

export function explainCron(cron: ParsedCron): string {
  let timing: string;
  if (cron.hour.values.length === 1 && cron.minute.values.length === 1 && cron.second.values.length === 1) {
    timing = `At ${pad(cron.hour.values[0])}:${pad(cron.minute.values[0])}${cron.hasSeconds ? `:${pad(cron.second.values[0])}` : ""}`;
  } else if (cron.hasSeconds && cron.hour.expression === "*" && cron.minute.expression === "*" && cron.second.expression === "*") timing = "Every second";
  else if (cron.hour.expression === "*" && cron.minute.expression === "*" && !cron.hasSeconds) timing = "Every minute (at second 0)";
  else if (cron.hour.expression === "*" && /^\*\/\d+$/.test(cron.minute.expression) && !cron.hasSeconds) timing = `Every ${Number(cron.minute.expression.slice(2))} minutes within each hour (at second 0)`;
  else if (cron.hour.expression === "*" && cron.minute.values.length === 1 && cron.second.values.length === 1) timing = `Every hour at minute ${cron.minute.values[0]}, second ${cron.second.values[0]}`;
  else timing = `${cron.hasSeconds ? "Seconds-first schedule" : "Unix schedule (at second 0)"}: hours ${cron.hour.expression === "*" ? "every hour" : cron.hour.values.map(pad).join(", ")}; minutes ${cron.minute.expression === "*" ? "every minute" : cron.minute.values.map(pad).join(", ")}${cron.hasSeconds ? `; seconds ${cron.second.expression === "*" ? "every second" : cron.second.values.map(pad).join(", ")}` : ""}`;
  const months = cron.month.values.length === 12 ? "" : `; in ${cron.month.values.map(value => FULL_MONTHS[value - 1]).join(", ")}`;
  const dom = cron.dayOfMonth.values.length === 31 ? "every day of month" : `day of month ${cron.dayOfMonth.values.join(", ")}`;
  const dow = cron.dayOfWeek.values.length === 7 ? "every weekday (Sunday–Saturday)" : cron.dayOfWeek.values.map(value => FULL_WEEKDAYS[value]).join(", ");
  const days = cron.dayMode === "or" ? `when either ${dom} OR weekday ${dow} matches`
    : cron.dayOfMonth.values.length === 31 && cron.dayOfWeek.values.length === 7 ? "every day"
    : cron.dayOfMonth.values.length === 31 ? `on ${dow}`
    : cron.dayOfWeek.values.length === 7 ? `on ${dom}`
    : `when both ${dom} AND weekday ${dow} match`;
  return `${timing}; ${days}${months}.`;
}

export function fieldBreakdownText(cron: ParsedCron): string {
  return cronFields(cron).map(field => `${field.label}: ${field.expression} — ${field.interpretation}`).join("\n");
}

// Exported names are also useful to callers presenting supported aliases.
export { MONTH_NAMES, WEEKDAY_NAMES };
