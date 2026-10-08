import {
  calculateAge,
  formatRelativeTime,
  getZonedDateTime,
  isLeapYear,
  isoWeek,
  parseDateTime,
  validateTimeZone,
  type ZonedDateTime,
} from "../date-time-station";
import type { DateTimeEnvironment, DateTimeResult, DateTimeValues } from "./types";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MIN_TIMESTAMP = BigInt("-62135596800000");
const MAX_TIMESTAMP = BigInt("253402300799999");
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD", "DD-MM-YYYY", "MM-DD-YYYY"];

function text(value: string | undefined, label: string, max = 128, optional = false): string {
  if (value === undefined && optional) return "";
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  if (value.length > max) throw new Error(`${label} must be at most ${max} characters.`);
  const result = value.trim();
  if (!result && !optional) throw new Error(`${label} is required.`);
  return result;
}

function zone(value: string | undefined, label = "Timezone"): string {
  const input = text(value, label);
  try { return validateTimeZone(input); }
  catch { throw new Error(`${label} must be a supported IANA timezone, such as UTC or America/New_York.`); }
}

function localZone(environment?: DateTimeEnvironment): string {
  return zone(environment?.localZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, "Browser timezone");
}

function now(environment?: DateTimeEnvironment): Date {
  const milliseconds = environment?.now ?? Date.now();
  if (!Number.isSafeInteger(milliseconds)) throw new Error("The current clock must provide a valid integer millisecond timestamp.");
  return parseDateTime(milliseconds);
}

function result(...entries: [string, string | number][]): DateTimeResult {
  return { rows: entries.map(([label, value]) => ({ label, value: String(value) })) };
}

function dateOnly(value: string | undefined, label: string): Date {
  const input = text(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error(`${label} must use YYYY-MM-DD.`);
  try { return parseDateTime(`${input}T00:00:00Z`, { timeZone: "UTC" }); }
  catch { throw new Error(`${label} must be a valid Gregorian date in years 0001–9999.`); }
}

function clock(value: string | undefined, label: string): { input: string; milliseconds: number } {
  const input = text(value, label, 12);
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(input);
  if (!match) throw new Error(`${label} must use HH:mm or HH:mm:ss with up to 3 fractional second digits.`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const millisecond = Number((match[4] ?? "").padEnd(3, "0"));
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`${label} must be a valid 24-hour time; leap seconds are not supported.`);
  return { input, milliseconds: hour * HOUR + minute * MINUTE + second * SECOND + millisecond };
}

function parseLocal(input: string, timeZone: string): Date {
  try { return parseDateTime(input, { timeZone, disambiguation: "reject" }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("occurs twice")) {
      throw new Error("This local time occurs twice during a timezone clock change. Choose an unambiguous local time or use the ISO 8601 Converter with an explicit UTC offset.");
    }
    if (message.includes("does not exist")) {
      throw new Error("This local time does not exist during a timezone clock change. Choose another local time or use the ISO 8601 Converter with an explicit UTC offset.");
    }
    throw new Error("Enter a valid Gregorian date/time in years 0001–9999, with a known UTC offset when supplied. Leap seconds are not supported.");
  }
}

function wallDate(dateValue: string | undefined, timeValue: string | undefined, timeZone: string, label = ""): { instant: Date; wall: Date } {
  const date = dateOnly(dateValue, `${label}date`.trim());
  const time = clock(timeValue, `${label}time`.trim());
  const input = `${date.toISOString().slice(0, 10)}T${time.input}`;
  return { instant: parseLocal(input, timeZone), wall: new Date(date.getTime() + time.milliseconds) };
}

function iso(value: string | undefined, label: string, requireOffset: boolean, environment?: DateTimeEnvironment): Date {
  const input = text(value, label, 40);
  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.exec(input);
  if (!match || (requireOffset && !match[1])) {
    throw new Error(`${label} must be a full ISO date/time (YYYY-MM-DDTHH:mm[:ss[.SSS]])${requireOffset ? " with Z or an explicit ±HH:mm offset" : "; offset-free values use the browser timezone"}.`);
  }
  return parseLocal(input, match[1] ? "UTC" : localZone(environment));
}

/** Parse with integer arithmetic: decimal seconds never pass through floating-point rounding. */
function timestamp(value: string | undefined, unit: string | undefined): Date {
  if (unit !== "Seconds" && unit !== "Milliseconds") throw new Error("Choose Seconds or Milliseconds as the timestamp unit.");
  const input = text(value, "Timestamp", 128);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(input);
  if (!match) throw new Error("Timestamp must be a decimal number without exponent notation or separators.");
  if (unit === "Milliseconds" && match[3] !== undefined) throw new Error("A millisecond timestamp must be an integer.");
  if (unit === "Seconds" && (match[3]?.length ?? 0) > 3) throw new Error("Seconds may have at most 3 fractional digits (millisecond precision).");
  const magnitude = unit === "Milliseconds" ? BigInt(match[2]) : BigInt(match[2]) * BigInt(1000) + BigInt((match[3] ?? "").padEnd(3, "0"));
  const milliseconds = match[1] === "-" ? -magnitude : magnitude;
  if (milliseconds < MIN_TIMESTAMP || milliseconds > MAX_TIMESTAMP) throw new Error("Timestamp must be within Gregorian years 0001–9999 in UTC.");
  return new Date(Number(milliseconds));
}

function seconds(milliseconds: number): string {
  const absolute = Math.abs(milliseconds);
  const fraction = absolute % SECOND;
  return `${milliseconds < 0 ? "-" : ""}${Math.floor(absolute / SECOND)}${fraction ? `.${String(fraction).padStart(3, "0").replace(/0+$/, "")}` : ""}`;
}

function utcOffset(zoned: ZonedDateTime): string { return `UTC${zoned.offset === "Z" ? "+00:00" : zoned.offset}`; }
function zonedText(zoned: ZonedDateTime): string { return `${zoned.dateTime} [${zoned.timeZone}; ${utcOffset(zoned)}]`; }
function inZone(date: Date, timeZone: string): string { return zonedText(getZonedDateTime(date, timeZone)); }

function timestampResult(date: Date, environment?: DateTimeEnvironment): DateTimeResult {
  const utc = inZone(date, "UTC");
  return result(["Date/time", utc], ["ISO 8601", date.toISOString()], ["UTC representation", utc], ["Local representation", inZone(date, localZone(environment))]);
}

function monthDays(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
}

function shifted(date: Date, years: number, months = 0): Date {
  const monthIndex = (date.getUTCFullYear() + years) * 12 + date.getUTCMonth() + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const moved = new Date(date.getTime());
  moved.setUTCFullYear(year, month, Math.min(date.getUTCDate(), monthDays(year, month)));
  return moved;
}

/** Clamped calendar anniversaries, then remaining wall-clock days and time. */
function calendarDifference(start: Date, end: Date): string {
  const backwards = end.getTime() < start.getTime();
  const first = backwards ? end : start;
  const last = backwards ? start : end;
  let years = last.getUTCFullYear() - first.getUTCFullYear();
  if (shifted(first, years).getTime() > last.getTime()) years -= 1;
  const afterYears = shifted(first, years);
  let months = Math.min(11, (last.getUTCFullYear() - afterYears.getUTCFullYear()) * 12 + last.getUTCMonth() - afterYears.getUTCMonth());
  if (shifted(afterYears, 0, months).getTime() > last.getTime()) months -= 1;
  let remaining = last.getTime() - shifted(afterYears, 0, months).getTime();
  const days = Math.floor(remaining / DAY); remaining %= DAY;
  const hours = Math.floor(remaining / HOUR); remaining %= HOUR;
  const minutes = Math.floor(remaining / MINUTE); remaining %= MINUTE;
  return `${backwards ? "-(" : ""}${years} years, ${months} months, ${days} days, ${hours} hours, ${minutes} minutes, ${seconds(remaining)} seconds${backwards ? ")" : ""}`;
}

function dateDifference(values: DateTimeValues, environment?: DateTimeEnvironment): DateTimeResult {
  const timeZone = localZone(environment);
  const start = wallDate(values.startDate, values.startTime, timeZone, "Start ");
  const end = wallDate(values.endDate, values.endTime, timeZone, "End ");
  const elapsed = end.instant.getTime() - start.instant.getTime();
  const calendar = calendarDifference(start.wall, end.wall);
  const note = elapsed !== end.wall.getTime() - start.wall.getTime() ? " (wall-clock calendar; elapsed totals reflect timezone clock changes)" : "";
  return result(["Calendar difference", calendar + note], ["Total days", elapsed / DAY], ["Total hours", elapsed / HOUR], ["Total minutes", elapsed / MINUTE], ["Total seconds", seconds(elapsed)]);
}

function timeDifference(values: DateTimeValues, environment?: DateTimeEnvironment): DateTimeResult {
  const startDate = text(values.startDate, "Start date", 10, true);
  const endDate = text(values.endDate, "End date", 10, true);
  if (Boolean(startDate) !== Boolean(endDate)) throw new Error("Provide both start and end dates, or leave both dates empty.");
  let elapsed: number;
  if (startDate && endDate) {
    const timeZone = localZone(environment);
    elapsed = wallDate(endDate, values.endTime, timeZone, "End ").instant.getTime() - wallDate(startDate, values.startTime, timeZone, "Start ").instant.getTime();
  } else {
    elapsed = clock(values.endTime, "End time").milliseconds - clock(values.startTime, "Start time").milliseconds;
    if (elapsed < 0) elapsed += DAY;
  }
  const sign = elapsed < 0 ? -1 : 1;
  const absolute = Math.abs(elapsed);
  return result(["Hours", sign * Math.floor(absolute / HOUR)], ["Minutes", sign * Math.floor(absolute % HOUR / MINUTE)], ["Seconds", seconds(sign * (absolute % MINUTE))], ["Total seconds", seconds(elapsed)]);
}

function formatConversion(values: DateTimeValues): DateTimeResult {
  const inputFormat = text(values.inputFormat, "Input format", 10);
  const outputFormat = text(values.outputFormat, "Output format", 10);
  if (!FORMATS.includes(inputFormat) || !FORMATS.includes(outputFormat)) throw new Error("Choose one of the six supported date formats.");
  const value = text(values.value, "Date value", 10);
  let match: RegExpExecArray | null;
  let year: string;
  let month: string;
  let day: string;
  if (inputFormat === "YYYY-MM-DD" || inputFormat === "YYYY/MM/DD") {
    match = (inputFormat === "YYYY-MM-DD" ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{4})\/(\d{2})\/(\d{2})$/).exec(value);
    if (!match) throw new Error("Date value must match the selected input format exactly.");
    [, year, month, day] = match;
  } else {
    match = (inputFormat.includes("/") ? /^(\d{2})\/(\d{2})\/(\d{4})$/ : /^(\d{2})-(\d{2})-(\d{4})$/).exec(value);
    if (!match) throw new Error("Date value must match the selected input format exactly.");
    year = match[3];
    [day, month] = inputFormat.startsWith("DD") ? [match[1], match[2]] : [match[2], match[1]];
  }
  dateOnly(`${year}-${month}-${day}`, "Date value");
  return result(["Converted date", outputFormat.replace("YYYY", year).replace("MM", month).replace("DD", day)]);
}

function businessDays(values: DateTimeValues): DateTimeResult {
  const start = dateOnly(values.startDate, "Start date");
  const end = dateOnly(values.endDate, "End date");
  if (start.getTime() > end.getTime()) throw new Error("End date must be on or after start date.");
  const choice = text(values.weekend, "Weekend pattern", 32);
  let weekend: Set<number>;
  switch (choice) {
    case "Saturday + Sunday": weekend = new Set([6, 0]); break;
    case "Friday + Saturday": weekend = new Set([5, 6]); break;
    case "Sunday only": weekend = new Set([0]); break;
    case "Custom weekend": {
      const names = text(values.weekdays, "Custom weekend weekdays", 256, true);
      weekend = new Set();
      if (names) {
        for (const name of names.split(",")) {
          const index = WEEKDAYS.indexOf(name.trim());
          if (index < 0) throw new Error("Custom weekend must be comma-separated full English weekday names, or empty for no weekends.");
          weekend.add(index);
        }
      }
      break;
    }
    default: throw new Error("Choose a supported weekend pattern.");
  }
  const holidaysInput = text(values.holidays, "Holidays", 10_000, true);
  const holidayValues = holidaysInput ? holidaysInput.split(/[,\r\n]+/).map((value) => value.trim()).filter(Boolean) : [];
  if (holidayValues.length > 1_000) throw new Error("Holidays must contain at most 1,000 dates.");
  const holidays = new Set(holidayValues.map((value) => dateOnly(value, "Holiday date").getTime()));
  const calendarDays = (end.getTime() - start.getTime()) / DAY + 1;
  const weeks = Math.floor(calendarDays / 7);
  let weekendDays = weeks * weekend.size;
  for (let day = 0; day < calendarDays % 7; day += 1) {
    if (weekend.has((start.getUTCDay() + day) % 7)) weekendDays += 1;
  }
  let excludedHolidays = 0;
  for (const holiday of holidays) {
    if (holiday >= start.getTime() && holiday <= end.getTime() && !weekend.has(new Date(holiday).getUTCDay())) excludedHolidays += 1;
  }
  return result(["Business days", calendarDays - weekendDays - excludedHolidays], ["Calendar days", calendarDays], ["Weekend days", weekendDays], ["Excluded holiday count", excludedHolidays]);
}

/** Synchronous, browser-local contract engine. Only Current Time and Age read the clock. */
export function runDateTime(slug: string, values: DateTimeValues, environment?: DateTimeEnvironment): DateTimeResult {
  switch (slug) {
    case "unix-timestamp-converter": return timestampResult(timestamp(values.timestamp, values.unit), environment);
    case "unix-milliseconds-converter": return timestampResult(timestamp(values.timestamp, "Milliseconds"), environment);
    case "epoch-converter": return timestampResult(timestamp(values.epoch, values.unit), environment);
    case "unix-timestamp-generator":
    case "date-to-timestamp": {
      const date = wallDate(values.date, values.time, zone(values.timezone)).instant;
      return result(["Unix seconds", seconds(date.getTime())], ["Unix milliseconds", date.getTime()], ["ISO 8601", date.toISOString()]);
    }
    case "timestamp-to-date": {
      const date = timestamp(values.timestamp, values.unit);
      const selected = getZonedDateTime(date, zone(values.timezone));
      return result(["Date/time", zonedText(selected)], ["ISO 8601", date.toISOString()], ["UTC date/time", inZone(date, "UTC")], ["Selected timezone date/time", zonedText(selected)], ["UTC offset", utcOffset(selected)]);
    }
    case "timezone-converter": {
      const sourceZone = zone(values.sourceTimezone, "Source timezone");
      const destinationZone = zone(values.destinationTimezone, "Destination timezone");
      const date = wallDate(values.date, values.time, sourceZone).instant;
      const source = getZonedDateTime(date, sourceZone);
      const destination = getZonedDateTime(date, destinationZone);
      return result(["Source date/time", zonedText(source)], ["Destination date/time", zonedText(destination)], ["Source UTC offset", utcOffset(source)], ["Destination UTC offset", utcOffset(destination)], ["UTC time", inZone(date, "UTC")]);
    }
    case "iso-8601-converter": {
      const date = iso(values.iso, "ISO date/time", true, environment);
      return result(["Normalized ISO 8601", date.toISOString()], ["UTC date/time", inZone(date, "UTC")], ["Local date/time", inZone(date, localZone(environment))]);
    }
    case "current-time-in-timezone": {
      const timeZone = zone(values.timezone);
      const current = getZonedDateTime(now(environment), timeZone);
      return result(["Current date/time", zonedText(current)], ["UTC offset", utcOffset(current)], ["Timezone ID", current.timeZone]);
    }
    case "date-difference-calculator": return dateDifference(values, environment);
    case "time-difference-calculator": return timeDifference(values, environment);
    case "relative-time-generator": {
      const target = iso(values.target, "Target date/time", false, environment);
      const reference = iso(values.reference, "Reference date/time", false, environment);
      return result(["Relative phrase", formatRelativeTime(target, reference)], ["Exact difference", `${seconds(target.getTime() - reference.getTime())} seconds`]);
    }
    case "date-format-converter": return formatConversion(values);
    case "week-number-calculator": {
      const date = dateOnly(values.date, "Date");
      const convention = text(values.convention, "Week convention", 16);
      let week: number;
      let year: number;
      if (convention === "ISO 8601") ({ week, year } = isoWeek(date));
      else if (convention === "Sunday-start") {
        year = date.getUTCFullYear();
        const first = new Date(date.getTime()); first.setUTCMonth(0, 1);
        week = Math.floor(((date.getTime() - first.getTime()) / DAY + first.getUTCDay()) / 7) + 1;
      } else throw new Error("Choose ISO 8601 or Sunday-start as the week convention.");
      return result(["Week number", week], ["Week year", year], ["Day of week", WEEKDAYS[date.getUTCDay()]]);
    }
    case "leap-year-checker": {
      const input = text(values.year, "Year", 4);
      if (!/^\d{1,4}$/.test(input) || Number(input) < 1) throw new Error("Year must be an integer from 1 through 9999.");
      const year = Number(input);
      const leap = isLeapYear(year);
      const reason = year % 400 === 0 ? "It is divisible by 400." : year % 100 === 0 ? "It is divisible by 100 but not by 400." : year % 4 === 0 ? "It is divisible by 4 and not by 100." : "It is not divisible by 4.";
      return result(["Is leap year", leap ? "Yes" : "No"], ["Explanation", `${reason} Gregorian rule: divisible by 4, except century years unless divisible by 400.`]);
    }
    case "business-days-calculator": return businessDays(values);
    case "age-calculator": {
      const birth = dateOnly(values.birthDate, "Birth date");
      const target = dateOnly(values.targetDate, "Target date");
      if (birth.getTime() > target.getTime()) throw new Error("Birth date cannot be after the target date.");
      const today = getZonedDateTime(now(environment), localZone(environment));
      const todayKey = today.year * 10_000 + today.month * 100 + today.day;
      const birthKey = birth.getUTCFullYear() * 10_000 + (birth.getUTCMonth() + 1) * 100 + birth.getUTCDate();
      if (birthKey > todayKey) throw new Error("Birth date cannot be after today in the browser timezone.");
      const age = calculateAge(birth, target, { timeZone: "UTC", leapDay: "february-28" });
      return result(["Age in years/months/days", `${age.years} years, ${age.months} months, ${age.days} days`], ["Total days", age.totalDays]);
    }
    default: throw new Error("Unsupported Date & Time tool.");
  }
}
