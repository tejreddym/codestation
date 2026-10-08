import { describe, expect, it } from "vitest";
import {
  age,
  businessDaysBetween,
  calculateAge,
  convertDateFormat,
  convertTimeZone,
  dateTimeDifference,
  dateToTimestamp,
  epoch,
  formatCurrentTime,
  formatDate,
  formatDateTime,
  formatIso,
  formatRelativeTime,
  formatRfc3339,
  getZonedDateTime,
  isBusinessDay,
  isLeapYear,
  isoWeek,
  isoWeekNumber,
  millisecondsToSeconds,
  parseDateTime,
  parseTimestamp,
  secondsToMilliseconds,
  timestampToDate,
  unixEpoch,
} from "./date-time-station";

describe("Date & Time Station", () => {
  it.each(["001", "007", "010", "100", "999"])("preserves fractional seconds .%s in explicit format conversion", (fraction) => {
    expect(convertDateFormat(`2024-01-01 00:00:00.${fraction}`, "YYYY-MM-DD HH:mm:ss.SSS", "YYYY-MM-DD[T]HH:mm:ss.SSSZ"))
      .toBe(`2024-01-01T00:00:00.${fraction}Z`);
  });

  it("uses default start inclusivity when a same-day range includes its end", () => {
    expect(businessDaysBetween("2024-01-01", "2024-01-01", { inclusiveEnd: true })).toBe(1);
    expect(businessDaysBetween("2024-01-06", "2024-01-06", { inclusiveEnd: true })).toBe(0);
  });

  it("rejects conflicting repeated fields in an input format", () => {
    expect(() => convertDateFormat("2024/25-01-01", "YYYY/YY-MM-DD", "YYYY-MM-DD")).toThrow(/repeat|duplicate/i);
  });

  it("converts Unix seconds and milliseconds and parses explicit date forms", () => {
    expect(timestampToDate(0, "seconds").toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(timestampToDate("1704067200000", "milliseconds").toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(secondsToMilliseconds(1.25)).toBe(1_250);
    expect(millisecondsToSeconds(1_250)).toBe(1.25);
    expect(parseTimestamp("1704067200", "seconds").toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(parseDateTime("2024-01-01T01:02:03.004+01:00").toISOString()).toBe("2024-01-01T00:02:03.004Z");
    expect(dateToTimestamp("1969-12-31T23:59:59.999Z", "seconds")).toBe(-1);
    expect(dateToTimestamp("2024-01-01T00:00:00.123Z", "milliseconds")).toBe(1_704_067_200_123);
  });

  it("formats ISO/RFC3339 values and applies IANA DST rules", () => {
    const instant = "2024-03-10T07:30:00.000Z";
    expect(formatIso(instant)).toBe(instant);
    expect(formatRfc3339(instant)).toBe("2024-03-10T07:30:00.000Z");
    expect(convertTimeZone(instant, "America/New_York")).toBe("2024-03-10T03:30:00.000-04:00");
    expect(getZonedDateTime(instant, "America/New_York")).toMatchObject({ hour: 3, minute: 30, offset: "-04:00", timeZone: "America/New_York" });
    expect(formatDateTime(instant, { timeZone: "Asia/Kolkata", format: { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" } })).toContain("13:00");
    expect(formatCurrentTime(instant, { timeZone: "UTC", format: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } })).toContain("07:30");
  });

  it("rejects invalid dates, zones, and DST-skipped local times", () => {
    expect(() => parseDateTime("2024-02-30")).toThrow(/Day/);
    expect(() => timestampToDate(Number.NaN)).toThrow(/finite/);
    expect(() => getZonedDateTime("2024-01-01T00:00:00Z", "Not/AZone")).toThrow(/IANA/);
    expect(() => parseDateTime("2024-03-10T02:30", { timeZone: "America/New_York" })).toThrow(/does not exist/);
    expect(() => parseDateTime("2024-11-03T01:30", { timeZone: "America/New_York" })).toThrow(/twice/);
    expect(parseDateTime("2024-11-03T01:30", { timeZone: "America/New_York", disambiguation: "later" }).toISOString()).toBe("2024-11-03T06:30:00.000Z");
  });

  it("returns elapsed date/time differences and localized relative time", () => {
    expect(dateTimeDifference("2024-01-01T00:00:00Z", "2024-01-03T04:05:06.007Z")).toEqual({
      totalMilliseconds: 187_506_007, totalSeconds: 187_506.007, sign: 1, days: 2, hours: 4, minutes: 5, seconds: 6, milliseconds: 7,
    });
    expect(dateTimeDifference("2024-01-03T04:05:06Z", "2024-01-01T00:00:00Z")).toMatchObject({ sign: -1, days: 2, hours: 4, minutes: 5, seconds: 6 });
    expect(formatRelativeTime("2024-01-03T00:00:00Z", "2024-01-01T00:00:00Z", { numeric: "always" })).toBe("in 2 days");
    expect(formatRelativeTime("2023-12-30T00:00:00Z", "2024-01-01T00:00:00Z", { numeric: "always" })).toBe("2 days ago");
  });

  it("converts explicit date formats without locale-dependent parsing", () => {
    expect(convertDateFormat("31/12/2024 23:05", "DD/MM/YYYY HH:mm", "YYYY-MM-DD HH:mm:ss")).toBe("2024-12-31 23:05:00");
    expect(formatDate("2024-12-31T23:05:06.007Z", "DD/MM/YYYY HH:mm:ss.SSS")).toBe("31/12/2024 23:05:06.007");
    expect(convertDateFormat("2024-01-01T00:00Z", "YYYY-MM-DDTHH:mmZ", "YYYY-MM-DD HH:mm", { timeZone: "UTC" })).toBe("2024-01-01 00:00");
  });

  it("handles epoch, ISO week numbers, leap years, and weekend-only business days", () => {
    expect(unixEpoch().getTime()).toBe(0);
    expect(epoch().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(isoWeek("2021-01-01")).toEqual({ year: 2020, week: 53 });
    expect(isoWeekNumber("2024-01-01")).toBe(1);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(businessDaysBetween("2024-01-01", "2024-01-08")).toBe(5);
    expect(businessDaysBetween("2024-01-01", "2024-01-08", { inclusiveStart: true, inclusiveEnd: true })).toBe(6);
    expect(businessDaysBetween("2024-01-08", "2024-01-01")).toBe(-5);
    expect(isBusinessDay("2024-01-06")).toBe(false);
    expect(isBusinessDay("2024-01-08")).toBe(true);
  });

  it("calculates calendar age and rejects future births", () => {
    expect(calculateAge("1990-06-15", "2024-08-20")).toEqual({ years: 34, months: 2, days: 5, totalDays: 12_485 });
    expect(age("2020-02-29", "2021-02-28")).toMatchObject({ years: 1, months: 0, days: 0 });
    expect(age("2020-02-29", "2021-02-28", { leapDay: "march-1" })).toMatchObject({ years: 0, months: 11, days: 30 });
    expect(() => calculateAge("2025-01-01", "2024-01-01")).toThrow(/after/);
  });

  it.each(["", " ", "2024-02-30", "2023-02-29", "0000-01-01", "10000-01-01", "2024-13-01", "2024-01-01T24:00", "2024-01-01T00:00:60Z", "2024-01-01T00:00:00.0001Z", "02/03/2024", "2024-01-01T00:00-00:00"])("rejects empty, ambiguous, or unsupported date input: %s", (value) => {
    expect(() => parseDateTime(value)).toThrow();
  });

  it.each(["", "Infinity", "NaN", "1e3", "0x10", "1_000", "9".repeat(300)])("rejects invalid timestamp input: %s", (value) => {
    expect(() => timestampToDate(value)).toThrow();
  });

  it("retains supported precision, epoch direction, and early Gregorian years", () => {
    expect(timestampToDate("-0.001").toISOString()).toBe("1969-12-31T23:59:59.999Z");
    expect(timestampToDate("1.2346").getTime()).toBe(1235);
    expect(() => timestampToDate("1.2", "milliseconds")).toThrow(/integer/);
    expect(formatIso("0001-01-01")).toBe("0001-01-01T00:00:00.000Z");
    expect(formatIso("0099-01-01")).toBe("0099-01-01T00:00:00.000Z");
    expect(convertDateFormat("2024-01-01 01:02:03.01", "YYYY-MM-DD HH:mm:ss.SSS", "ss.SSS")).toBe("03.010");
    expect(() => formatDate("2024-01-01", "MMMM")).toThrow(/Unsupported/);
  });

  it("handles fractional-offset zones, half-hour DST, and skipped civil days", () => {
    expect(convertTimeZone("2026-01-01T00:00:00Z", "Asia/Kathmandu")).toBe("2026-01-01T05:45:00.000+05:45");
    const options = { timeZone: "Australia/Lord_Howe" };
    const earlier = parseDateTime("2024-04-07T01:45", { ...options, disambiguation: "earlier" });
    const later = parseDateTime("2024-04-07T01:45", { ...options, disambiguation: "later" });
    expect(later.getTime() - earlier.getTime()).toBe(30 * 60 * 1000);
    expect(() => parseDateTime("2011-12-30T12:00", { timeZone: "Pacific/Apia" })).toThrow(/does not exist/);
    expect(dateTimeDifference("2024-03-09T12:00", "2024-03-10T12:00", { timeZone: "America/New_York" }).totalSeconds).toBe(23 * 3600);
    expect(dateTimeDifference("2024-11-02T12:00", "2024-11-03T12:00", { timeZone: "America/New_York" }).totalSeconds).toBe(25 * 3600);
  });

  it("retains calendar age policies at month and leap-day boundaries", () => {
    expect(calculateAge("2024-01-31", "2024-02-29")).toMatchObject({ years: 0, months: 1, days: 0 });
    expect(calculateAge("2020-02-29", "2021-03-01", { leapDay: "march-1" })).toMatchObject({ years: 1, months: 0, days: 0 });
    expect(calculateAge("2024-06-15", "2024-06-15")).toEqual({ years: 0, months: 0, days: 0, totalDays: 0 });
  });

  it("matches a calendar-day oracle for business-day inclusivity and reversed ranges", () => {
    const origin = Date.UTC(2024, 0, 1);
    const date = (day: number) => new Date(origin + day * 86400000).toISOString().slice(0, 10);
    for (const [start, end] of [[0, 0], [5, 5], [0, 1], [4, 7], [7, 4], [0, 60], [60, 0]]) {
      for (const inclusiveStart of [false, true]) for (const inclusiveEnd of [false, true]) {
        let expected = 0;
        const sign = start > end ? -1 : 1;
        for (let day = Math.min(start, end); day <= Math.max(start, end); day += 1) {
          if ((day === start && !inclusiveStart) || (day === end && !inclusiveEnd)) continue;
          const weekday = new Date(origin + day * 86400000).getUTCDay();
          if (weekday !== 0 && weekday !== 6) expected += sign;
        }
        expect(businessDaysBetween(date(start), date(end), { inclusiveStart, inclusiveEnd }) || 0).toBe(expected);
      }
    }
  });
});
