/**
 * Pure, local-first Date & Time helpers. No DOM or network is used; core
 * calculations accept the current/reference time from callers (the convenience
 * current-time formatter reads the local clock only when its input is omitted).
 * The supported calendar is
 * Gregorian, years 0001–9999, with millisecond precision (no leap seconds).
 * Zone rules come from the runtime's Intl/IANA database, not fixed offsets.
 */

export type TimestampUnit = "seconds" | "milliseconds";
export type DateInput = Date | string | number;
export type TimeDisambiguation = "reject" | "earlier" | "later";

export interface ParseDateOptions {
  /** Numbers and numeric strings are milliseconds unless explicitly changed. */
  timestampUnit?: TimestampUnit;
  /** Zone for date-only or offset-free ISO text. Defaults to UTC. */
  timeZone?: string;
  /** Repeated local times are rejected by default; skipped times always fail. */
  disambiguation?: TimeDisambiguation;
}

export interface CalendarDate { year: number; month: number; day: number; }
export interface DateTimeParts extends CalendarDate {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export interface ZonedDateTime extends DateTimeParts {
  timeZone: string;
  /** Offset east of UTC; historical offsets may contain fractional minutes. */
  offsetMinutes: number;
  offset: string;
  unixMilliseconds: number;
  /** ISO timestamp for the underlying instant, always in UTC. */
  iso: string;
  /** Local wall time with numeric offset; historical offsets can include seconds. */
  dateTime: string;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MIN_DATE = -62_135_596_800_000; // 0001-01-01T00:00:00.000Z
const MAX_DATE = 253_402_300_799_999; // 9999-12-31T23:59:59.999Z

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function inputText(value: string, name = "Date", max = 256): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be text.`);
  const text = value.trim();
  if (!text) throw new Error(`${name} cannot be empty.`);
  if (text.length > max) throw new RangeError(`${name} must be at most ${max} characters.`);
  return text;
}

function isGregorianLeapYear(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
function daysInMonth(year: number, month: number): number { return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]; }

/** Gregorian leap-year rule, including century exceptions. */
export function isLeapYear(year: number): boolean { return isGregorianLeapYear(integer(year, "Year", 1, 9999)); }

function validateParts(parts: DateTimeParts): void {
  integer(parts.year, "Year", 1, 9999);
  integer(parts.month, "Month", 1, 12);
  integer(parts.day, "Day", 1, daysInMonth(parts.year, parts.month));
  integer(parts.hour, "Hour", 0, 23);
  integer(parts.minute, "Minute", 0, 59);
  integer(parts.second, "Second", 0, 59);
  integer(parts.millisecond, "Millisecond", 0, 999);
}

/** Avoid Date.UTC's special handling of years 0–99. */
function utcMilliseconds(parts: CalendarDate & Partial<DateTimeParts>): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0, parts.millisecond ?? 0);
  return date.getTime();
}

function checkedDate(milliseconds: number): Date {
  if (!Number.isFinite(milliseconds)) throw new RangeError("Date or timestamp must be finite and valid.");
  if (milliseconds < MIN_DATE || milliseconds > MAX_DATE) throw new RangeError("Date must be within Gregorian years 0001–9999 in UTC.");
  return new Date(milliseconds);
}

function timestampUnit(unit: TimestampUnit): TimestampUnit {
  if (unit !== "seconds" && unit !== "milliseconds") throw new Error("Timestamp unit must be seconds or milliseconds.");
  return unit;
}

/** Explicit units; fractional seconds round to the nearest millisecond. */
export function timestampToDate(value: number | string, unit: TimestampUnit = "seconds"): Date {
  timestampUnit(unit);
  let number: number;
  if (typeof value === "string") {
    const text = inputText(value, "Timestamp");
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) throw new Error("Timestamp must be a decimal number, without exponent notation.");
    number = Number(text);
  } else if (typeof value === "number") number = value;
  else throw new TypeError("Timestamp must be a number or numeric text.");
  if (!Number.isFinite(number)) throw new RangeError("Timestamp must be finite.");
  if (unit === "milliseconds" && !Number.isInteger(number)) throw new RangeError("A millisecond timestamp must be an integer.");
  return checkedDate(unit === "seconds" ? Math.round(number * SECOND) : number);
}

export const parseTimestamp = timestampToDate;
export const epochToDate = timestampToDate;
export const parseDate = parseDateTime;
export const parseDateInput = parseDateTime;

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const zone = inputText(timeZone, "Time zone", 128);
  if (/^[+-]/.test(zone)) throw new Error("Use an IANA time zone such as America/New_York, Asia/Kolkata, or UTC.");
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone, calendar: "gregory", numberingSystem: "latn", era: "short",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
      minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
  } catch { throw new Error(`Unknown or unsupported IANA time zone: ${zone}.`); }
}

/** Validate and return Intl's canonical zone name. */
export function validateTimeZone(timeZone: string): string { return zoneFormatter(timeZone).resolvedOptions().timeZone; }

function zoneParts(milliseconds: number, formatter: Intl.DateTimeFormat): DateTimeParts {
  const fields = Object.fromEntries(formatter.formatToParts(new Date(milliseconds)).map((part) => [part.type, part.value]));
  return {
    year: fields.era === "BC" ? 1 - Number(fields.year) : Number(fields.year),
    month: Number(fields.month), day: Number(fields.day), hour: Number(fields.hour),
    minute: Number(fields.minute), second: Number(fields.second),
    millisecond: ((milliseconds % SECOND) + SECOND) % SECOND,
  };
}

function disambiguation(value: TimeDisambiguation = "reject"): TimeDisambiguation {
  if (!["reject", "earlier", "later"].includes(value)) throw new Error("Time disambiguation must be reject, earlier, or later.");
  return value;
}

function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute && left.second === right.second && left.millisecond === right.millisecond;
}

function localToDate(parts: DateTimeParts, formatter: Intl.DateTimeFormat, choice: TimeDisambiguation): Date {
  const wall = utcMilliseconds(parts);
  // Nearby offsets cover DST folds, half-hour transitions, and skipped civil
  // days. Every candidate is checked against Intl rather than assumed valid.
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 12) {
    const sample = wall + hours * HOUR;
    offsets.add(utcMilliseconds(zoneParts(sample, formatter)) - sample);
  }
  const matches = [...offsets].map((offset) => wall - offset)
    .filter((candidate) => sameParts(zoneParts(candidate, formatter), parts)).sort((a, b) => a - b);
  const zone = formatter.resolvedOptions().timeZone;
  if (!matches.length) throw new Error(`This local time does not exist in ${zone} because of a time-zone clock change. Choose another time or an explicit UTC offset.`);
  if (matches.length > 1 && choice === "reject") throw new Error(`This local time occurs twice in ${zone}. Choose earlier or later, or supply an explicit UTC offset.`);
  return checkedDate(choice === "later" ? matches[matches.length - 1] : matches[0]);
}

function offsetMilliseconds(value: string): number {
  if (/^z$/i.test(value)) return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(value);
  if (!match) throw new Error("UTC offset must be Z or ±HH:mm.");
  const hours = integer(Number(match[2]), "Offset hour", 0, 23);
  const minutes = integer(Number(match[3]), "Offset minute", 0, 59);
  if (match[1] === "-" && hours === 0 && minutes === 0) throw new Error("The unknown UTC offset -00:00 cannot identify an instant. Use Z or a known offset.");
  return (match[1] === "-" ? -1 : 1) * (hours * HOUR + minutes * MINUTE);
}

function partsToDate(parts: DateTimeParts, offset: string | undefined, options: ParseDateOptions): Date {
  validateParts(parts);
  const choice = disambiguation(options.disambiguation);
  const formatter = zoneFormatter(options.timeZone ?? "UTC");
  return offset ? checkedDate(utcMilliseconds(parts) - offsetMilliseconds(offset)) : localToDate(parts, formatter, choice);
}

/**
 * Parse Date objects, explicit numeric timestamps, YYYY-MM-DD, or ISO text
 * (T/space + HH:mm[:ss[.SSS]] + optional Z/±HH:mm). No locale-dependent
 * Date.parse guesses are made. Explicit offsets take precedence over timeZone.
 */
export function parseDateTime(value: DateInput, options: ParseDateOptions = {}): Date {
  timestampUnit(options.timestampUnit ?? "milliseconds");
  disambiguation(options.disambiguation);
  if (options.timeZone !== undefined) validateTimeZone(options.timeZone);
  if (value instanceof Date) return checkedDate(value.getTime());
  if (typeof value === "number") return timestampToDate(value, options.timestampUnit ?? "milliseconds");
  const text = inputText(value);
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) return timestampToDate(text, options.timestampUnit ?? "milliseconds");
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  if (!match) throw new Error("Use YYYY-MM-DD, an ISO date/time with up to 3 fractional digits, or an explicit numeric timestamp.");
  return partsToDate({
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4] ?? 0), minute: Number(match[5] ?? 0), second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "").padEnd(3, "0")),
  }, match[8], options);
}

/** Unix seconds are floored, including instants before the Unix epoch. */
export function dateToTimestamp(value: DateInput, unit: TimestampUnit = "seconds", options: ParseDateOptions = {}): number {
  timestampUnit(unit);
  const milliseconds = parseDateTime(value, options).getTime();
  return unit === "seconds" ? Math.floor(milliseconds / SECOND) : milliseconds;
}

export const dateToEpoch = dateToTimestamp;
export function secondsToMilliseconds(value: number | string): number { return timestampToDate(value, "seconds").getTime(); }
export function millisecondsToSeconds(value: number | string): number { return timestampToDate(value, "milliseconds").getTime() / SECOND; }
export function unixSecondsToDate(value: number | string): Date { return timestampToDate(value, "seconds"); }
export function unixMillisecondsToDate(value: number | string): Date { return timestampToDate(value, "milliseconds"); }
export function dateToUnixSeconds(value: DateInput, options: ParseDateOptions = {}): number { return dateToTimestamp(value, "seconds", options); }
export function dateToUnixMilliseconds(value: DateInput, options: ParseDateOptions = {}): number { return dateToTimestamp(value, "milliseconds", options); }
export const secondsToDate = unixSecondsToDate;
export const millisecondsToDate = unixMillisecondsToDate;
export const dateToSeconds = dateToUnixSeconds;
export const dateToMilliseconds = dateToUnixMilliseconds;
export function formatIso(value: DateInput, options: ParseDateOptions = {}): string { return parseDateTime(value, options).toISOString(); }
export function formatTimestamp(value: number | string, unit: TimestampUnit = "seconds"): string { return timestampToDate(value, unit).toISOString(); }
export const formatISO = formatIso;

function pad(value: number, length = 2): string { return String(value).padStart(length, "0"); }
function calendarText(parts: CalendarDate): string { return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`; }
function clockText(parts: DateTimeParts): string { return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(parts.millisecond, 3)}`; }

function offsetText(milliseconds: number): string {
  if (!milliseconds) return "Z";
  const seconds = Math.abs(milliseconds) / SECOND;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return `${milliseconds < 0 ? "-" : "+"}${pad(hours)}:${pad(minutes)}${remainder ? `:${pad(remainder)}` : ""}`;
}

/** Obtain wall-clock fields without ever re-parsing locale-formatted text. */
export function getZonedDateTime(value: DateInput, timeZone = "UTC", options: ParseDateOptions = {}): ZonedDateTime {
  const date = parseDateTime(value, options);
  const formatter = zoneFormatter(timeZone);
  const parts = zoneParts(date.getTime(), formatter);
  validateParts(parts);
  const offset = utcMilliseconds(parts) - date.getTime();
  const renderedOffset = offsetText(offset);
  return { ...parts, timeZone: formatter.resolvedOptions().timeZone, offsetMinutes: offset / MINUTE,
    offset: renderedOffset, unixMilliseconds: date.getTime(), iso: date.toISOString(),
    dateTime: `${calendarText(parts)}T${clockText(parts)}${renderedOffset}` };
}

/** RFC3339 output with milliseconds. Historical sub-minute offsets are rejected. */
export function formatRfc3339(value: DateInput, timeZoneOrOptions: string | ParseDateOptions = "UTC", options: ParseDateOptions = {}): string {
  const timeZone = typeof timeZoneOrOptions === "string" ? timeZoneOrOptions : timeZoneOrOptions.timeZone ?? "UTC";
  const parseOptions = typeof timeZoneOrOptions === "string" ? options : timeZoneOrOptions;
  const zoned = getZonedDateTime(value, timeZone, parseOptions);
  if (!Number.isInteger(zoned.offsetMinutes)) throw new Error("RFC3339 cannot represent this historical sub-minute UTC offset. Format in UTC instead.");
  return zoned.dateTime;
}

/** Preserve the instant; options.timeZone identifies the source for naive text. */
export function convertTimeZone(value: DateInput, targetTimeZone: string, options: ParseDateOptions | string = {}): string {
  const parseOptions = typeof options === "string" ? { timeZone: options } : options;
  return formatRfc3339(value, targetTimeZone, parseOptions);
}
export const convertTimezone = convertTimeZone;
export const formatRFC3339 = formatRfc3339;
export function convertBetweenTimeZones(value: DateInput, sourceTimeZone: string, targetTimeZone: string): string {
  return convertTimeZone(value, targetTimeZone, { timeZone: sourceTimeZone });
}

export interface DateTimeFormatOptions extends ParseDateOptions {
  locale?: string;
  /** timeZone is controlled by the top-level option, not by these overrides. */
  format?: Omit<Intl.DateTimeFormatOptions, "timeZone">;
}

/** Localized date/time formatting; UTC and en-US are deterministic defaults. */
export function formatDateTime(value: DateInput, options: DateTimeFormatOptions = {}): string {
  const date = parseDateTime(value, options);
  const timeZone = validateTimeZone(options.timeZone ?? "UTC");
  const format: Intl.DateTimeFormatOptions = options.format ?? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" };
  return new Intl.DateTimeFormat(options.locale ?? "en-US", { ...format, timeZone }).format(date);
}

/** Supply a reference instant, or omit it for the user's current local clock. */
export function formatCurrentTime(options?: DateTimeFormatOptions): string;
export function formatCurrentTime(now: DateInput, options?: DateTimeFormatOptions): string;
export function formatCurrentTime(nowOrOptions?: DateInput | DateTimeFormatOptions, options: DateTimeFormatOptions = {}): string {
  if (nowOrOptions && typeof nowOrOptions === "object" && !(nowOrOptions instanceof Date)) return formatDateTime(new Date(), nowOrOptions);
  return formatDateTime(nowOrOptions ?? new Date(), options);
}
export const currentTime = formatCurrentTime;
export const formatNow = formatCurrentTime;
export const getCurrentTime = formatCurrentTime;

export interface DateTimeDifference {
  /** Signed elapsed duration from `start` to `end`. */
  totalMilliseconds: number;
  totalSeconds: number;
  sign: -1 | 0 | 1;
  /** Absolute decomposition of the elapsed duration. */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/** Compare instants; the component fields are absolute and `sign` carries direction. */
export function dateTimeDifference(start: DateInput, end: DateInput, options: ParseDateOptions = {}): DateTimeDifference {
  const totalMilliseconds = parseDateTime(end, options).getTime() - parseDateTime(start, options).getTime();
  const sign: -1 | 0 | 1 = totalMilliseconds < 0 ? -1 : totalMilliseconds > 0 ? 1 : 0;
  let remainder = Math.abs(totalMilliseconds);
  const days = Math.floor(remainder / DAY); remainder -= days * DAY;
  const hours = Math.floor(remainder / HOUR); remainder -= hours * HOUR;
  const minutes = Math.floor(remainder / MINUTE); remainder -= minutes * MINUTE;
  const seconds = Math.floor(remainder / SECOND);
  const milliseconds = remainder - seconds * SECOND;
  return { totalMilliseconds, totalSeconds: totalMilliseconds / SECOND, sign, days, hours, minutes, seconds, milliseconds };
}

export const differenceInTime = dateTimeDifference;
export const dateDifference = dateTimeDifference;

export type RelativeTimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
export interface RelativeTimeOptions extends ParseDateOptions {
  locale?: string;
  numeric?: "always" | "auto";
  unit?: RelativeTimeUnit;
}

const relativeUnits: ReadonlyArray<{ unit: RelativeTimeUnit; milliseconds: number }> = [
  { unit: "year", milliseconds: 365 * DAY }, { unit: "quarter", milliseconds: 91 * DAY },
  { unit: "month", milliseconds: 30 * DAY }, { unit: "week", milliseconds: 7 * DAY },
  { unit: "day", milliseconds: DAY }, { unit: "hour", milliseconds: HOUR },
  { unit: "minute", milliseconds: MINUTE }, { unit: "second", milliseconds: SECOND },
];

/** Format elapsed instant distance with the platform's localized relative-time rules. */
export function formatRelativeTime(value: DateInput, base: DateInput = new Date(), options: RelativeTimeOptions = {}): string {
  const difference = parseDateTime(value, options).getTime() - parseDateTime(base, options).getTime();
  const selected = options.unit ? relativeUnits.find((entry) => entry.unit === options.unit) : relativeUnits.find((entry) => Math.abs(difference) >= entry.milliseconds) ?? relativeUnits[relativeUnits.length - 1];
  if (!selected) throw new Error(`Unsupported relative-time unit: ${String(options.unit)}.`);
  const amount = Math.round(difference / selected.milliseconds);
  return new Intl.RelativeTimeFormat(options.locale ?? "en", { numeric: options.numeric ?? "auto" }).format(amount, selected.unit);
}

export const relativeTime = formatRelativeTime;
export const getRelativeTime = formatRelativeTime;

type DateFormatToken = "YYYY" | "YY" | "MM" | "M" | "DD" | "D" | "HH" | "H" | "mm" | "m" | "ss" | "s" | "SSS" | "Z";
const formatTokens: readonly DateFormatToken[] = ["YYYY", "SSS", "YY", "MM", "DD", "HH", "mm", "ss", "M", "D", "H", "m", "s", "Z"];

function formatText(value: string, name: string): string {
  const text = inputText(value, name, 128);
  const withoutLiterals = text.replace(/\[[^\]]*\]/gu, "");
  if (/[A-Za-z]/u.test(withoutLiterals.replace(/Y{1,4}|M{1,4}|D{1,2}|H{1,2}|m{1,2}|s{1,2}|S{1,3}|Z|T/gu, ""))) throw new Error(`${name} contains an unsupported alphabetic token.`);
  return text;
}

interface FormatPart { token?: DateFormatToken; literal?: string; }
function tokenizeFormat(format: string): FormatPart[] {
  const text = formatText(format, "Date format");
  const parts: FormatPart[] = [];
  const validRunLengths: Record<string, readonly number[]> = { Y: [2, 4], M: [1, 2], D: [1, 2], H: [1, 2], m: [1, 2], s: [1, 2], S: [3], Z: [1] };
  for (let index = 0; index < text.length;) {
    if (text[index] === "[") {
      const end = text.indexOf("]", index + 1);
      if (end < 0) throw new Error("Date format contains an unclosed literal.");
      parts.push({ literal: text.slice(index + 1, end) }); index = end + 1; continue;
    }
    if (/[A-Za-z]/u.test(text[index])) {
      if (text[index] === "T") { parts.push({ literal: "T" }); index += 1; continue; }
      const run = text.slice(index).match(/^([A-Za-z])\1*/u)?.[0] ?? text[index];
      const validLengths = validRunLengths[text[index]];
      if (!validLengths?.includes(run.length)) throw new Error(`Unsupported date format token: ${run}.`);
    }
    const token = formatTokens.find((candidate) => text.startsWith(candidate, index));
    if (token) { parts.push({ token }); index += token.length; continue; }
    parts.push({ literal: text[index] }); index += 1;
  }
  return parts;
}

function regexEscape(value: string): string { return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&"); }
function tokenPattern(token: DateFormatToken): string {
  if (token === "YYYY") return "(\\d{4})";
  if (token === "YY") return "(\\d{2})";
  if (token === "SSS") return "(\\d{1,3})";
  if (token === "Z") return "(Z|[+-]\\d{2}:?\\d{2})";
  return ["MM", "DD", "HH", "mm", "ss"].includes(token) ? "(\\d{2})" : "(\\d{1,2})";
}

function parseByFormat(value: string, sourceFormat: string, options: ParseDateOptions): Date {
  const input = inputText(value, "Date value");
  const parts = tokenizeFormat(sourceFormat);
  let expression = "^";
  const tokens: DateFormatToken[] = [];
  const fields = new Set<string>();
  for (const part of parts) {
    if (part.token) {
      // MM/M, YYYY/YY, etc. describe the same field; do not silently discard one.
      const field = part.token[0];
      if (fields.has(field)) throw new Error(`Input format repeats the ${part.token} field.`);
      fields.add(field);
      expression += tokenPattern(part.token);
      tokens.push(part.token);
    }
    else expression += regexEscape(part.literal ?? "");
  }
  const match = new RegExp(`${expression}$`, "u").exec(input);
  if (!match) throw new Error(`Date value does not match the format ${sourceFormat}.`);
  const values: Record<string, number | string> = {};
  tokens.forEach((token, index) => {
    values[token] = token === "Z" || token === "SSS" ? match[index + 1] : Number(match[index + 1]);
  });
  const year = values.YYYY !== undefined ? Number(values.YYYY) : values.YY !== undefined ? 2000 + Number(values.YY) : 1970;
  const dateParts: DateTimeParts = {
    year, month: Number(values.MM ?? values.M ?? 1), day: Number(values.DD ?? values.D ?? 1),
    hour: Number(values.HH ?? values.H ?? 0), minute: Number(values.mm ?? values.m ?? 0),
    second: Number(values.ss ?? values.s ?? 0), millisecond: Number(String(values.SSS ?? 0).padEnd(3, "0")),
  };
  return partsToDate(dateParts, typeof values.Z === "string" ? values.Z : undefined, options);
}

function formatByFormat(value: Date, format: string, timeZone: string): string {
  const parts = tokenizeFormat(format);
  const zoned = getZonedDateTime(value, timeZone);
  const values: Record<DateFormatToken, string> = {
    YYYY: pad(zoned.year, 4), YY: pad(zoned.year % 100), MM: pad(zoned.month), M: String(zoned.month),
    DD: pad(zoned.day), D: String(zoned.day), HH: pad(zoned.hour), H: String(zoned.hour),
    mm: pad(zoned.minute), m: String(zoned.minute), ss: pad(zoned.second), s: String(zoned.second),
    SSS: pad(zoned.millisecond, 3), Z: zoned.offset,
  };
  return parts.map((part) => part.token ? values[part.token] : part.literal ?? "").join("");
}

export interface DateFormatConversionOptions extends ParseDateOptions { outputTimeZone?: string; }

/** Format a parsed instant using small, explicit tokens (for example DD/MM/YYYY). */
export function formatDate(value: DateInput, format: string, options: DateFormatConversionOptions = {}): string {
  const date = parseDateTime(value, options);
  return formatByFormat(date, format, options.outputTimeZone ?? options.timeZone ?? "UTC");
}

/** Parse one explicit token format and render another without locale guessing. */
export function convertDateFormat(value: string, fromFormat: string, toFormat: string, options: DateFormatConversionOptions = {}): string {
  const date = parseByFormat(value, fromFormat, options);
  return formatByFormat(date, toFormat, options.outputTimeZone ?? options.timeZone ?? "UTC");
}

export const convertDate = convertDateFormat;
export const formatDateFormat = formatDate;

/** The Unix epoch is a fresh immutable-by-convention Date for each caller. */
export function unixEpoch(): Date { return new Date(0); }
export const epoch = unixEpoch;
export const getEpoch = unixEpoch;
export const getUnixEpoch = unixEpoch;

export interface IsoWeek { year: number; week: number; }
function calendarCompare(left: CalendarDate, right: CalendarDate): number {
  return utcMilliseconds(left) - utcMilliseconds(right);
}
function calendarDayNumber(date: CalendarDate): number { return Math.floor(utcMilliseconds(date) / DAY); }
function calendarFromDayNumber(day: number): CalendarDate {
  const date = new Date(day * DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
function calendarWeekday(date: CalendarDate): number { return new Date(utcMilliseconds(date)).getUTCDay(); }

/** ISO 8601 week date: Monday is day 1 and week 1 contains January 4. */
export function isoWeek(value: DateInput, options: ParseDateOptions = {}): IsoWeek {
  const zoned = getZonedDateTime(value, options.timeZone ?? "UTC", options);
  const calendar = { year: zoned.year, month: zoned.month, day: zoned.day };
  const mondayDay = calendarDayNumber(calendar) - ((calendarWeekday(calendar) + 6) % 7);
  const thursday = calendarFromDayNumber(mondayDay + 3);
  const firstThursday = calendarDayNumber({ year: thursday.year, month: 1, day: 4 }) - ((calendarWeekday({ year: thursday.year, month: 1, day: 4 }) + 6) % 7) + 3;
  return { year: thursday.year, week: Math.floor((mondayDay + 3 - firstThursday) / 7) + 1 };
}

export function isoWeekNumber(value: DateInput, options: ParseDateOptions = {}): number { return isoWeek(value, options).week; }
export const getIsoWeek = isoWeek;
export const getIsoWeekNumber = isoWeekNumber;
export const weekNumber = isoWeekNumber;
export const getISOWeek = isoWeek;
export const getISOWeekNumber = isoWeekNumber;
export const leapYear = isLeapYear;

export interface BusinessDayOptions {
  timeZone?: string;
  /** Defaults to start-inclusive/end-exclusive, like elapsed range APIs. */
  inclusiveStart?: boolean;
  inclusiveEnd?: boolean;
}

function dateCalendar(value: DateInput, options: BusinessDayOptions): CalendarDate {
  const zoned = getZonedDateTime(value, options.timeZone ?? "UTC", { timeZone: options.timeZone ?? "UTC" });
  return { year: zoned.year, month: zoned.month, day: zoned.day };
}

function weekdaysInclusive(start: CalendarDate, end: CalendarDate): number {
  if (calendarCompare(start, end) > 0) return -weekdaysInclusive(end, start);
  const first = calendarDayNumber(start); const total = calendarDayNumber(end) - first + 1;
  const weeks = Math.floor(total / 7); let count = weeks * 5;
  for (let day = first + weeks * 7; day <= calendarDayNumber(end); day += 1) {
    const weekday = new Date(day * DAY).getUTCDay(); if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

/** Count Monday–Friday only. This intentionally does not model holidays. */
export function businessDaysBetween(start: DateInput, end: DateInput, options: BusinessDayOptions = {}): number {
  const left = dateCalendar(start, options); const right = dateCalendar(end, options);
  if (calendarCompare(left, right) === 0) return (options.inclusiveStart ?? true) && (options.inclusiveEnd ?? false) && calendarWeekday(left) !== 0 && calendarWeekday(left) !== 6 ? 1 : 0;
  const direction = calendarCompare(left, right) < 0 ? 1 : -1;
  const earlier = direction > 0 ? left : right; const later = direction > 0 ? right : left;
  let first = calendarDayNumber(earlier);
  let last = calendarDayNumber(later);
  // For reversed ranges, the same named boundary belongs to the other side.
  const includeEarlier = direction > 0 ? options.inclusiveStart ?? true : options.inclusiveEnd ?? false;
  const includeLater = direction > 0 ? options.inclusiveEnd ?? false : options.inclusiveStart ?? true;
  if (!includeEarlier) first += 1;
  if (!includeLater) last -= 1;
  if (first > last) return 0;
  return direction * weekdaysInclusive(calendarFromDayNumber(first), calendarFromDayNumber(last));
}

export function isBusinessDay(value: DateInput, options: BusinessDayOptions = {}): boolean {
  const date = dateCalendar(value, options); const weekday = calendarWeekday(date); return weekday !== 0 && weekday !== 6;
}

export const countBusinessDays = businessDaysBetween;
export const businessDays = businessDaysBetween;
export const calculateBusinessDays = businessDaysBetween;

export interface Age {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}
export interface AgeOptions extends BusinessDayOptions { leapDay?: "february-28" | "march-1"; }

function addYears(date: CalendarDate, years: number, leapDay: "february-28" | "march-1"): CalendarDate {
  if (date.month === 2 && date.day === 29 && !isGregorianLeapYear(date.year + years) && leapDay === "march-1") return { year: date.year + years, month: 3, day: 1 };
  return { year: date.year + years, month: date.month, day: Math.min(date.day, daysInMonth(date.year + years, date.month)) };
}
function addMonths(date: CalendarDate, months: number): CalendarDate {
  const index = date.year * 12 + date.month - 1 + months;
  const year = Math.floor(index / 12); const month = index % 12 + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

/** Calendar age, normalized as years/months/days; future birth dates are invalid. */
export function calculateAge(birthDate: DateInput, asOf: DateInput = new Date(), options: AgeOptions = {}): Age {
  const birth = dateCalendar(birthDate, options); const current = dateCalendar(asOf, options);
  if (calendarCompare(birth, current) > 0) throw new RangeError("Birth date cannot be after the as-of date.");
  const leapDay = options.leapDay ?? "february-28";
  let years = current.year - birth.year;
  if (calendarCompare(current, addYears(birth, years, leapDay)) < 0) years -= 1;
  const afterYears = addYears(birth, years, leapDay);
  let months = (current.year - afterYears.year) * 12 + current.month - afterYears.month;
  if (months < 0) months += 12;
  // A non-leap-year February 29 birthday with the March 1 policy can leave
  // the nominal month delta at 12 while the first anniversary is still in
  // the future. Keep the public decomposition normalized to months < 12.
  if (months >= 12) months = 11;
  let afterMonths = addMonths(afterYears, months);
  if (calendarCompare(current, afterMonths) < 0) { months -= 1; afterMonths = addMonths(afterYears, months); }
  const days = calendarDayNumber(current) - calendarDayNumber(afterMonths);
  return { years, months, days, totalDays: calendarDayNumber(current) - calendarDayNumber(birth) };
}

export const age = calculateAge;
