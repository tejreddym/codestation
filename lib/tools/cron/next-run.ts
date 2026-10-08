import { matchesCronDate, parseCron, type ParsedCron } from "./parser";

const DAY = 86_400_000;
const SIX_HOURS = 6 * 3_600_000;
const pad = (value: number, width = 2) => String(value).padStart(width, "0");
interface WallTime { year: number; month: number; day: number; hour: number; minute: number; second: number }
interface OffsetInterval { start: number; end: number; offset: number }
export interface CronNextRun {
  instant: number;
  dateTime: string;
  timezone: string;
  durationMilliseconds: number;
  duration: string;
}

/** Absolute, millisecond-precision ISO input; no Date.parse rollover or implicit clock. */
export function parseCronReference(reference: string): number {
  if (reference.length > 64) throw new Error("Reference exceeds the 64-character limit.");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(reference);
  if (!match) throw new Error("Reference must be an absolute ISO date/time: YYYY-MM-DDTHH:mm[:ss[.sss]] followed by Z or ±HH:mm.");
  const [year, month, day, hour, minute, second] = [match[1], match[2], match[3], match[4], match[5], match[6] ?? "0"].map(Number);
  if (year < 1970 || year > 2099) throw new Error("Reference years must be between 1970 and 2099.");
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days || hour > 23 || minute > 59 || second > 59) throw new Error("Reference contains an impossible calendar date or time.");
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  let offset = 0;
  if (match[8] !== "Z") {
    const offsetHour = Number(match[8].slice(1, 3));
    const offsetMinute = Number(match[8].slice(4, 6));
    if (offsetMinute > 59 || offsetHour > 14 || (offsetHour === 14 && offsetMinute !== 0)) throw new Error("Reference offset must be within ±14:00, with valid minutes.");
    offset = (offsetHour * 60 + offsetMinute) * 60_000 * (match[8][0] === "-" ? -1 : 1);
  }
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds) - offset;
  const utcYear = new Date(instant).getUTCFullYear();
  if (utcYear < 1970 || utcYear > 2099) throw new Error("Reference instant must fall within UTC years 1970–2099.");
  return instant;
}

function zoneFormatter(timezone: string): Intl.DateTimeFormat {
  if (!timezone || timezone !== timezone.trim()) throw new Error("Select a nonempty IANA timezone.");
  if (timezone.length > 128 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(timezone)) throw new Error("Enter a valid IANA timezone name; numeric offsets are not timezone names.");
  try {
    return new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
  } catch { throw new Error("Timezone is not a recognized IANA timezone in this runtime."); }
}

function wallTime(formatter: Intl.DateTimeFormat, instant: number): WallTime {
  const parts = formatter.formatToParts(instant);
  const get = (name: string) => Number(parts.find(part => part.type === name)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetAt(formatter: Intl.DateTimeFormat, instant: number): number {
  const wholeSecond = Math.floor(instant / 1000) * 1000;
  const wall = wallTime(formatter, wholeSecond);
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - wholeSecond;
}

/**
 * Probe an expanded UTC neighborhood, then locate changed offsets to the second.
 * IANA transitions in the supported 1970–2099 era are separated by more than six
 * hours. Each interval is converted to a wall-time range, so gaps have no range
 * and folds have two ranges. This includes non-hour transitions and date jumps.
 */
function offsetIntervals(formatter: Intl.DateTimeFormat, midnight: number): OffsetInterval[] {
  const start = midnight - 2 * DAY;
  const end = midnight + 3 * DAY;
  const intervals: OffsetInterval[] = [];
  let intervalStart = start;
  let priorOffset = offsetAt(formatter, start);
  for (let probe = start + SIX_HOURS; probe <= end; probe += SIX_HOURS) {
    const nextOffset = offsetAt(formatter, probe);
    if (nextOffset !== priorOffset) {
      let low = probe - SIX_HOURS;
      let high = probe;
      while (high - low > 1000) {
        const middle = Math.floor((low + high) / 2000) * 1000;
        if (offsetAt(formatter, middle) === priorOffset) low = middle;
        else high = middle;
      }
      intervals.push({ start: intervalStart, end: high, offset: priorOffset });
      intervalStart = high;
      priorOffset = nextOffset;
    }
  }
  intervals.push({ start: intervalStart, end, offset: priorOffset });
  return intervals;
}

/** Find the first selected second-of-day at or after a bound, without per-second scanning. */
function selectedSecond(cron: ParsedCron, lower: number, upper: number): number | undefined {
  if (lower >= upper || lower >= 86_400) return undefined;
  lower = Math.max(0, Math.ceil(lower));
  const firstHour = Math.floor(lower / 3600);
  for (const hour of cron.hour.values) {
    if (hour < firstHour) continue;
    const firstMinute = hour === firstHour ? Math.floor((lower % 3600) / 60) : 0;
    for (const minute of cron.minute.values) {
      if (minute < firstMinute) continue;
      const base = hour * 3600 + minute * 60;
      if (base >= upper) return undefined;
      const second = cron.second.values.find(value => base + value >= lower);
      if (second !== undefined) return base + second < upper ? base + second : undefined;
    }
  }
  return undefined;
}

export function formatCronDuration(milliseconds: number): string {
  if (!Number.isSafeInteger(milliseconds)) throw new Error("Duration is outside supported integer precision.");
  const sign = milliseconds < 0 ? "-" : "+";
  let remainder = Math.abs(milliseconds);
  const pieces: string[] = [];
  for (const [size, name] of [[DAY, "day"], [3_600_000, "hour"], [60_000, "minute"], [1000, "second"], [1, "millisecond"]] as const) {
    const count = Math.floor(remainder / size);
    remainder %= size;
    if (count) pieces.push(`${count} ${name}${count === 1 ? "" : "s"}`);
  }
  return sign + (pieces.join(", ") || "0 seconds");
}

/** Strictly after the supplied reference; at most eight calendar years, ending in 2099. */
export function nextCronRun(expression: string | ParsedCron, reference: string, timezone: string): CronNextRun {
  const cron = typeof expression === "string" ? parseCron(expression) : expression;
  const instant = parseCronReference(reference);
  const formatter = zoneFormatter(timezone);
  const referenceWall = wallTime(formatter, instant);
  if (referenceWall.year < 1970 || referenceWall.year > 2099) throw new Error("Reference in the selected timezone must fall within years 1970–2099.");
  const referenceDay = Date.UTC(referenceWall.year, referenceWall.month - 1, referenceWall.day);
  // The extra preceding dates also handle large backward calendar-date shifts.
  const firstDay = Math.max(Date.UTC(1970, 0, 1), referenceDay - 2 * DAY);
  const searchEnd = Math.min(Date.UTC(2100, 0, 1), Date.UTC(referenceWall.year + 8, referenceWall.month - 1, referenceWall.day + 1));
  const utcReference = new Date(instant);
  const eightYearLimit = Date.UTC(utcReference.getUTCFullYear() + 8, utcReference.getUTCMonth(), utcReference.getUTCDate(), utcReference.getUTCHours(), utcReference.getUTCMinutes(), utcReference.getUTCSeconds(), utcReference.getUTCMilliseconds());
  const absoluteEnd = Math.min(Date.UTC(2100, 0, 1), eightYearLimit + 1);
  let best: number | undefined;
  let bestOffset = 0;
  for (let midnight = firstDay; midnight < searchEnd; midnight += DAY) {
    // Even a ±24-hour date-line shift cannot make later wall dates beat this candidate.
    if (best !== undefined && midnight - DAY > best) break;
    const date = new Date(midnight);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (!matchesCronDate(cron, year, month, day)) continue;
    for (const interval of offsetIntervals(formatter, midnight)) {
      const lowerUtc = Math.max(interval.start, instant + 1, midnight - interval.offset, Date.UTC(1970, 0, 1));
      const upperUtc = Math.min(interval.end, midnight + DAY - interval.offset, absoluteEnd, best ?? Infinity);
      const second = selectedSecond(cron, (lowerUtc + interval.offset - midnight) / 1000, (upperUtc + interval.offset - midnight) / 1000);
      if (second === undefined) continue;
      const candidate = midnight + second * 1000 - interval.offset;
      const actual = wallTime(formatter, candidate);
      // Verify the original wall date/time, never normalize a gap into a different time.
      if (actual.year !== year || actual.month !== month || actual.day !== day || actual.hour !== Math.floor(second / 3600) || actual.minute !== Math.floor(second % 3600 / 60) || actual.second !== second % 60) continue;
      if (candidate > instant && (best === undefined || candidate < best)) { best = candidate; bestOffset = interval.offset; }
    }
  }
  if (best === undefined) throw new Error("No occurrence found within eight calendar years after the reference, ending no later than 2099. The expression may select impossible calendar dates.");
  if (bestOffset % 60_000 !== 0) throw new Error("This historical timezone offset includes seconds and cannot be represented by an RFC 3339 ±HH:mm offset; choose a reference after the zone adopted minute-based offsets.");
  const wall = wallTime(formatter, best);
  const offsetMinutes = Math.abs(bestOffset / 60_000);
  const offset = `${bestOffset < 0 ? "-" : "+"}${pad(Math.floor(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`;
  const dateTime = `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}${offset}[${timezone}]`;
  const durationMilliseconds = best - instant;
  return { instant: best, dateTime, timezone, durationMilliseconds, duration: formatCronDuration(durationMilliseconds) };
}
