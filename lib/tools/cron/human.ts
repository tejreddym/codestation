import { explainCron, FULL_WEEKDAYS } from "./explain";
import { parseCron } from "./parser";

/** Anchored, deterministic phrases; this deliberately does not infer fuzzy natural language. */
export function humanToCron(description: string): { expression: string; schedule: string } {
  if (description.length > 500) throw new Error("Description exceeds the 500-character limit.");
  const text = description.trim();
  let expression: string | undefined;
  const minutes = /^every(?: (\d+))? minutes?$/i.exec(text);
  if (minutes) {
    const step = minutes[1] === undefined ? 1 : Number(minutes[1]);
    if (!Number.isSafeInteger(step) || step < 1 || step > 59) throw new Error("Minute interval must be an integer between 1 and 59.");
    expression = `${step === 1 ? "*" : `*/${step}`} * * * *`;
  } else if (/^every hour$/i.test(text)) expression = "0 * * * *";
  else {
    const timed = /^(every day|every (?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)|weekdays) at (\d{1,2}):(\d{2})$/i.exec(text);
    if (timed) {
      const hour = Number(timed[2]);
      const minute = Number(timed[3]);
      if (hour > 23 || minute > 59) throw new Error("Time must use a valid 24-hour hour and minute (HH:mm).");
      const day = timed[1].toLowerCase();
      const weekday = day === "weekdays" ? "1-5" : day === "every day" ? "*" : String(FULL_WEEKDAYS.findIndex(value => value.toLowerCase() === day.slice(6)));
      expression = `${minute} ${hour} * * ${weekday}`;
    }
  }
  if (!expression) throw new Error("Supported phrases: every minute, every N minutes (1–59), every hour, every day at HH:mm, every Monday (or another weekday) at HH:mm, and weekdays at HH:mm.");
  return { expression, schedule: explainCron(parseCron(expression)) };
}
