import { cronFields, explainCron, fieldBreakdownText } from "./explain";
import { humanToCron } from "./human";
import { nextCronRun } from "./next-run";
import { parseCron } from "./parser";
import type { CronResult, CronValues } from "./types";

export { parseCron } from "./parser";
export { nextCronRun, parseCronReference, formatCronDuration } from "./next-run";

export async function runCron(toolId: string, values: CronValues): Promise<CronResult> {
  if (toolId === "cron-validator") {
    try {
      parseCron(values.expression ?? "");
      return { rows: [{ label: "Valid/Invalid status", value: "Valid" }, { label: "Error message", value: "No validation errors." }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid cron expression.";
      return { rows: [{ label: "Valid/Invalid status", value: "Invalid" }, { label: "Error message", value: message }] };
    }
  }
  if (toolId === "cron-generator") {
    const names = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];
    for (const name of ["second", ...names]) {
      if ((values[name] ?? "").length > 128) throw new Error("Generator fields cannot exceed 128 characters.");
    }
    if (values.second !== undefined && values.second !== "") {
      if (!values.second.trim()) throw new Error("Enter a second field, or clear Second completely for five-field Unix.");
      names.unshift("second");
    }
    const tokens = names.map(name => (values[name] ?? "").trim());
    if (tokens.some(token => !token)) throw new Error("Each required generator field needs a value; use * for every value.");
    if (tokens.some(token => /\s/.test(token))) throw new Error("Each generator input must contain exactly one cron field, without embedded whitespace.");
    const expression = tokens.join(" ");
    const parsed = parseCron(expression);
    return { rows: [{ label: "Cron expression", value: expression }, { label: "Human-readable schedule", value: explainCron(parsed) }] };
  }
  if (toolId === "human-to-cron") {
    const parsed = humanToCron(values.description ?? "");
    return { rows: [{ label: "Cron expression", value: parsed.expression }, { label: "Parsed schedule", value: parsed.schedule }] };
  }
  if (toolId === "cron-next-run") {
    const next = nextCronRun(values.expression ?? "", values.reference ?? "", values.timezone ?? "");
    return { rows: [{ label: "Next run date/time", value: next.dateTime }, { label: "Time until next run", value: next.duration }] };
  }
  if (toolId === "cron-explainer" || toolId === "cron-to-human") {
    const parsed = parseCron(values.expression ?? "");
    const fields = cronFields(parsed);
    if (toolId === "cron-explainer") return { rows: [{ label: "Field breakdown", value: fieldBreakdownText(parsed) }, { label: "Human-readable schedule", value: explainCron(parsed) }], fields };
    return { rows: [{ label: "Human-readable explanation", value: `${explainCron(parsed)}\n\n${fieldBreakdownText(parsed)}` }], fields };
  }
  throw new Error("Unknown Cron tool.");
}
