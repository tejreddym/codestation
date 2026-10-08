import { describe, expect, it, vi } from "vitest";
import { dateTimeTools } from "@/config/date-time-tools";
import { runDateTime } from "./engine";
import type { DateTimeEnvironment, DateTimeValues } from "./types";
const env = { now: Date.parse("2026-10-03T12:00:00Z"), localZone: "UTC" };
const run = (slug: string, values: DateTimeValues, environment: DateTimeEnvironment = env) => Object.fromEntries(runDateTime(slug, values, environment).rows.map(row => [row.label, row.value]));

describe("calendar and elapsed differences", () => {
  it.each([["2026-10-03", "2026-10-03", "12:00", "12:00", "0"], ["2024-02-28", "2024-03-01", "00:00", "00:00", "172800"], ["2025-12-31", "2026-01-01", "23:00", "01:00", "7200"], ["2026-02-01", "2026-01-01", "00:00", "00:00", "-2678400"]])("date difference %s to %s is signed", (startDate, endDate, startTime, endTime, seconds) => {
    const result = run("date-difference-calculator", { startDate, endDate, startTime, endTime }); expect(result["Total seconds"]).toBe(seconds);
    if (seconds.startsWith("-")) expect(result["Calendar difference"]).toMatch(/^-\(/);
  });
  it("distinguishes calendar day from a 23-hour local DST day", () => {
    const result = run("date-difference-calculator", { startDate: "2026-03-07", endDate: "2026-03-08", startTime: "12:00", endTime: "12:00" }, { ...env, localZone: "America/New_York" });
    expect(result["Total hours"]).toBe("23"); expect(result["Calendar difference"]).toContain("1 days"); expect(result["Calendar difference"]).toContain("clock changes");
  });
  it("uses clamped month anniversaries and leap years", () => {
    expect(run("date-difference-calculator", { startDate: "2026-01-31", endDate: "2026-02-28", startTime: "00:00", endTime: "00:00" })["Calendar difference"]).toContain("0 years, 1 months, 0 days");
    expect(run("date-difference-calculator", { startDate: "2024-02-29", endDate: "2025-02-28", startTime: "00:00", endTime: "00:00" })["Calendar difference"]).toContain("1 years, 0 months, 0 days");
  });
  it.each([["09:00", "10:30:45", "5445"], ["23:30", "01:15", "6300"], ["12:00", "12:00", "0"], ["00:00:00.001", "00:00:00.002", "0.001"]])("time-only %s to %s automatically wraps midnight", (startTime, endTime, seconds) => expect(run("time-difference-calculator", { startTime, endTime })["Total seconds"]).toBe(seconds));
  it("requires paired dates and computes exact dated elapsed time", () => {
    expect(() => run("time-difference-calculator", { startTime: "09:00", endTime: "10:00", startDate: "2026-10-03" })).toThrow(/both/);
    const result = run("time-difference-calculator", { startTime: "12:00", endTime: "12:00", startDate: "2026-03-07", endDate: "2026-03-08" }, { ...env, localZone: "America/New_York" });
    expect(result).toEqual({ Hours: "23", Minutes: "0", Seconds: "0", "Total seconds": "82800" });
    expect(run("time-difference-calculator", { startTime: "12:30", endTime: "11:15", startDate: "2026-10-03", endDate: "2026-10-03" })).toEqual({ Hours: "-1", Minutes: "-15", Seconds: "0", "Total seconds": "-4500" });
  });
  it.each([["2026-10-06T12:00:00Z", "in 3 days", "259200 seconds"], ["2026-10-03T10:00:00Z", "2 hours ago", "-7200 seconds"], ["2026-10-03T12:00:00Z", "now", "0 seconds"]])("relative %s always uses explicit reference", (target, phrase, exact) => {
    expect(run("relative-time-generator", { target, reference: "2026-10-03T12:00:00Z" })).toEqual({ "Relative phrase": phrase, "Exact difference": exact });
    expect(() => run("relative-time-generator", { target, reference: "" })).toThrow();
  });
});

describe("format, week and leap conventions", () => {
  const formats = { "YYYY-MM-DD": "2026-10-03", "DD/MM/YYYY": "03/10/2026", "MM/DD/YYYY": "10/03/2026", "YYYY/MM/DD": "2026/10/03", "DD-MM-YYYY": "03-10-2026", "MM-DD-YYYY": "10-03-2026" };
  it.each(Object.entries(formats).flatMap(([inputFormat, value]) => Object.entries(formats).map(([outputFormat, expected]) => ({ inputFormat, value, outputFormat, expected }))))("$inputFormat to $outputFormat is strict date-only", ({ expected, ...values }) => {
    expect(run("date-format-converter", values)).toEqual({ "Converted date": expected });
  });
  it("does not infer ambiguous input or roll impossible days forward", () => {
    expect(run("date-format-converter", { value: "03/04/2026", inputFormat: "DD/MM/YYYY", outputFormat: "YYYY-MM-DD" })["Converted date"]).toBe("2026-04-03");
    expect(run("date-format-converter", { value: "03/04/2026", inputFormat: "MM/DD/YYYY", outputFormat: "YYYY-MM-DD" })["Converted date"]).toBe("2026-03-04");
    for (const value of ["2026-02-29", "2026-02-30", "03/04/2026", "2026-1-01", "0000-01-01"]) expect(() => run("date-format-converter", { value, inputFormat: "YYYY-MM-DD", outputFormat: "YYYY-MM-DD" })).toThrow();
    expect(() => run("date-format-converter", { value: "2026-10-03", inputFormat: "YYYY-MM-DD", outputFormat: "YY/MM/DD" })).toThrow();
  });
  it.each([["2021-01-01", "53", "2020"], ["2020-12-31", "53", "2020"], ["2021-01-04", "1", "2021"], ["2018-12-31", "1", "2019"]])("ISO boundary %s", (date, week, year) => expect(run("week-number-calculator", { date, convention: "ISO 8601" })).toMatchObject({ "Week number": week, "Week year": year }));
  it("Sunday-start uses calendar-year week1 containing Jan1", () => {
    expect(run("week-number-calculator", { date: "2021-01-01", convention: "Sunday-start" })).toEqual({ "Week number": "1", "Week year": "2021", "Day of week": "Friday" });
    expect(run("week-number-calculator", { date: "2021-01-03", convention: "Sunday-start" })["Week number"]).toBe("2");
    expect(() => run("week-number-calculator", { date: "2021-01-03", convention: "Other" })).toThrow();
  });
  it.each([["2024", "Yes"], ["1900", "No"], ["2000", "Yes"], ["2026", "No"], ["1", "No"], ["9999", "No"]])("leap year %s", (year, expected) => expect(run("leap-year-checker", { year })["Is leap year"]).toBe(expected));
  it.each(["0", "-1", "10000", "２０２４", "2024.0"])("rejects invalid year %s", year => expect(() => run("leap-year-checker", { year })).toThrow());
});

describe("business days and calendar age", () => {
  const business = { startDate: "2026-10-01", endDate: "2026-10-10", weekend: "Saturday + Sunday", holidays: "2026-10-02" };
  it("counts inclusive boundaries, explicit holidays and weekends separately", () => {
    expect(run("business-days-calculator", business)).toEqual({ "Business days": "6", "Calendar days": "10", "Weekend days": "3", "Excluded holiday count": "1" });
    expect(run("business-days-calculator", { ...business, holidays: "2026-10-02\n2026-10-02\n2026-10-03\n2026-12-25" })["Excluded holiday count"]).toBe("1");
    expect(run("business-days-calculator", { ...business, startDate: "2026-10-03", endDate: "2026-10-04" })["Business days"]).toBe("0");
    expect(() => run("business-days-calculator", { ...business, endDate: "2026-09-30" })).toThrow(/on or after/);
  });
  it.each([["Saturday + Sunday", "", "5"], ["Friday + Saturday", "", "5"], ["Sunday only", "", "6"], ["Custom weekend", "Monday,Wednesday,Friday", "4"], ["Custom weekend", "", "7"], ["Custom weekend", "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday", "0"]])("supports %s / %s", (weekend, weekdays, expected) => {
    expect(run("business-days-calculator", { startDate: "2026-10-01", endDate: "2026-10-07", weekend, weekdays })["Business days"]).toBe(expected);
  });
  it("handles leap/year boundaries, maximum range and malformed holidays", () => {
    const result = run("business-days-calculator", { ...business, startDate: "0001-01-01", endDate: "9999-12-31", holidays: "" });
    expect(Number(result["Calendar days"])).toBe(3652059); expect(Number(result["Business days"]) + Number(result["Weekend days"])).toBe(Number(result["Calendar days"]));
    expect(run("business-days-calculator", { ...business, startDate: "2024-02-28", endDate: "2024-03-01", holidays: "2024-02-29" })["Business days"]).toBe("2");
    expect(run("business-days-calculator", { ...business, startDate: "2025-12-31", endDate: "2026-01-01", holidays: "" })["Calendar days"]).toBe("2");
    for (const holidays of ["2026-02-30", "10/03/2026", "<script>", "x".repeat(10001)]) expect(() => run("business-days-calculator", { ...business, holidays })).toThrow();
  });
  it.each([["2004-10-27", "2026-10-27", "22 years, 0 months, 0 days"], ["2004-10-27", "2026-10-26", "21 years, 11 months, 29 days"], ["2000-02-29", "2026-02-28", "26 years, 0 months, 0 days"], ["2000-02-29", "2024-02-29", "24 years, 0 months, 0 days"]])("age %s at %s", (birthDate, targetDate, expected) => expect(run("age-calculator", { birthDate, targetDate })["Age in years/months/days"]).toBe(expected));
  it("rejects births after target or today and requires explicit target", () => {
    expect(() => run("age-calculator", { birthDate: "2020-01-01", targetDate: "2019-01-01" })).toThrow(/target/);
    expect(() => run("age-calculator", { birthDate: "2027-01-01", targetDate: "2030-01-01" })).toThrow(/today/);
    expect(() => run("age-calculator", { birthDate: "2000-01-01", targetDate: "" })).toThrow(/required/);
  });
});
describe("all 17 exact Date & Time contracts", () => {
  it.each(dateTimeTools)("$slug handles leap-day and year-boundary fixtures", tool => {
    for (const date of ["2024-02-29", "2025-12-31"]) {
      const instant = `${date}T12:00:00Z`;
      const values = { ...tool.dateTimeContract.defaults, ...tool.dateTimeContract.example };
      for (const field of tool.dateTimeContract.fields) {
        if (field.control === "date") values[field.name] = date;
        if (field.control === "time") values[field.name] = "12:00";
        if (field.control === "timezone") values[field.name] = "UTC";
      }
      if ("timestamp" in values) values.timestamp = String(Date.parse(instant) / (tool.id === "unix-milliseconds-converter" ? 1 : 1000));
      if ("epoch" in values) values.epoch = String(Date.parse(instant) / 1000);
      if ("unit" in values) values.unit = "Seconds";
      for (const field of ["iso", "target", "reference"]) if (field in values) values[field] = instant;
      if (tool.id === "date-format-converter") { values.value = date; values.inputFormat = "YYYY-MM-DD"; }
      if (tool.id === "leap-year-checker") values.year = date.slice(0, 4);
      expect(() => runDateTime(tool.id, values, { ...env, now: Date.parse(instant) })).not.toThrow();
    }
  });
  it.each(dateTimeTools)("$slug executes its example with exactly the output contract", tool => {
    const values = { ...tool.dateTimeContract.defaults, ...tool.dateTimeContract.example }; const before = { ...values };
    expect(runDateTime(tool.slug, values, env).rows.map(row => row.label)).toEqual(tool.dateTimeContract.outputs); expect(values).toEqual(before);
  });
  it.each(dateTimeTools)("$slug rejects empty and invalid inputs without personal-data errors", tool => {
    expect(() => run(tool.slug, {})).toThrow();
    const values = { ...tool.dateTimeContract.defaults, ...tool.dateTimeContract.example };
    values[tool.dateTimeContract.fields[0].name] = "PRIVATE-MARKER";
    let message = ""; try { run(tool.slug, values); } catch (cause) { message = String(cause); }
    expect(message.length).toBeGreaterThan(0); expect(message).not.toContain("PRIVATE-MARKER");
  });
  it("does not consult the clock except explicit Current Time and Age validation", () => {
    const now = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Clock access forbidden"); });
    try {
      for (const tool of dateTimeTools.filter(tool => !["current-time-in-timezone", "age-calculator"].includes(tool.id))) {
        expect(() => runDateTime(tool.id, { ...tool.dateTimeContract.defaults, ...tool.dateTimeContract.example }, { localZone: "UTC" })).not.toThrow();
      }
    } finally { now.mockRestore(); }
  });
});

describe("Unix and ISO instant conversions", () => {
  it.each(["unix-timestamp-converter", "epoch-converter", "timestamp-to-date"])("%s obeys units, zero, negative, fractional and large boundaries", slug => {
    for (const [value, unit, expected] of [["0", "Seconds", "1970-01-01T00:00:00.000Z"], ["-0.001", "Seconds", "1969-12-31T23:59:59.999Z"], ["-1", "Milliseconds", "1969-12-31T23:59:59.999Z"], ["1728000000", "Seconds", "2024-10-04T00:00:00.000Z"], ["1728000000", "Milliseconds", "1970-01-21T00:00:00.000Z"], ["-62135596800000", "Milliseconds", "0001-01-01T00:00:00.000Z"], ["253402300799999", "Milliseconds", "9999-12-31T23:59:59.999Z"]]) {
      expect(run(slug, { timestamp: value, epoch: value, unit, timezone: "UTC" })["ISO 8601"]).toBe(expected);
    }
    for (const value of ["", "abc", "1e3", "Infinity", "1,000", "1.0001", "253402300800", "-62135596801"]) expect(() => run(slug, { timestamp: value, epoch: value, unit: "Seconds", timezone: "UTC" })).toThrow();
    expect(() => run(slug, { timestamp: "1.5", epoch: "1.5", unit: "Milliseconds", timezone: "UTC" })).toThrow(/integer/);
    expect(() => run(slug, { timestamp: "1", epoch: "1", unit: "Minutes", timezone: "UTC" })).toThrow(/Seconds or Milliseconds/);
  });
  it("milliseconds converter never interprets input as seconds", () => {
    expect(run("unix-milliseconds-converter", { timestamp: "1000" })["ISO 8601"]).toBe("1970-01-01T00:00:01.000Z");
    expect(() => run("unix-milliseconds-converter", { timestamp: "0.5" })).toThrow();
  });
  it.each([["2026-10-03T14:30:00+05:30", "2026-10-03T09:00:00.000Z"], ["2026-10-03T01:00:00-04:00", "2026-10-03T05:00:00.000Z"], ["2024-02-29T23:59:59.123Z", "2024-02-29T23:59:59.123Z"], ["2026-01-01T00:15:00+01:00", "2025-12-31T23:15:00.000Z"]])("ISO %s preserves its instant", (iso, expected) => {
    const result = run("iso-8601-converter", { iso }, { ...env, localZone: "Asia/Kolkata" });
    expect(result["Normalized ISO 8601"]).toBe(expected); expect(result["Local date/time"]).toContain("UTC+05:30");
  });
  it.each(["2026-10-03", "2026-10-03T14:30:00", "03/04/2026", "2026-02-30T00:00:00Z", "2026-10-03T24:00:00Z", "2026-10-03T23:59:60Z", "2026-10-03T00:00:00-00:00"])("rejects ambiguous/impossible ISO %s", iso => expect(() => run("iso-8601-converter", { iso })).toThrow());
});

describe("IANA timezone and DST behavior", () => {
  it.each(["unix-timestamp-generator", "date-to-timestamp"])("%s uses supplied date/time/zone, not the clock", slug => {
    expect(run(slug, { date: "2026-10-03", time: "14:30", timezone: "Asia/Kolkata" })).toMatchObject({ "ISO 8601": "2026-10-03T09:00:00.000Z", "Unix milliseconds": String(Date.parse("2026-10-03T09:00:00Z")) });
    expect(run(slug, { date: "1969-12-31", time: "23:59:59.999", timezone: "UTC" })["Unix seconds"]).toBe("-0.001");
    for (const [date, time, error] of [["2026-03-08", "02:30", /does not exist/], ["2026-11-01", "01:30", /occurs twice/]] as const) expect(() => run(slug, { date, time, timezone: "America/New_York" })).toThrow(error);
    expect(() => run(slug, { date: "2026-02-30", time: "14:30", timezone: "UTC" })).toThrow();
    expect(() => run(slug, { date: "2026-10-03", time: "25:00", timezone: "UTC" })).toThrow();
    for (const timezone of ["", "Unknown/Zone", "+05:30"]) expect(() => run(slug, { date: "2026-10-03", time: "14:30", timezone })).toThrow();
  });
  it.each([["2026-01-01", "12:00", "America/New_York", "UTC", "UTC-05:00"], ["2026-07-01", "12:00", "America/New_York", "UTC", "UTC-04:00"], ["2026-01-01", "00:30", "Asia/Kolkata", "America/New_York", "UTC+05:30"], ["2024-02-29", "12:00", "Europe/London", "Europe/London", "UTC+00:00"]])("converts %s %s from %s to %s", (date, time, sourceTimezone, destinationTimezone, offset) => {
    const result = run("timezone-converter", { date, time, sourceTimezone, destinationTimezone });
    expect(result["Source UTC offset"]).toBe(offset); expect(result["Destination date/time"]).toContain(destinationTimezone);
    if (sourceTimezone === destinationTimezone) expect(result["Destination date/time"]).toBe(result["Source date/time"]);
    if (sourceTimezone === "Asia/Kolkata") expect(result["Destination date/time"]).toContain("2025-12-31");
  });
  it("handles half-hour DST transitions and a historically skipped day", () => {
    expect(() => run("date-to-timestamp", { date: "2026-10-04", time: "02:15", timezone: "Australia/Lord_Howe" })).toThrow(/does not exist/);
    expect(() => run("date-to-timestamp", { date: "2011-12-30", time: "12:00", timezone: "Pacific/Apia" })).toThrow(/does not exist/);
    expect(() => run("date-to-timestamp", { date: "2026-04-05", time: "01:45", timezone: "Australia/Lord_Howe" })).toThrow(/occurs twice/);
  });
  it.each([["UTC", "UTC+00:00"], ["Asia/Kolkata", "UTC+05:30"], ["America/New_York", "UTC-04:00"], ["Europe/London", "UTC+01:00"]])("current time reads the provided instant in %s", (timezone, offset) => {
    const first = run("current-time-in-timezone", { timezone }); const second = run("current-time-in-timezone", { timezone }, { ...env, now: env.now + 60_000 });
    expect(first["UTC offset"]).toBe(offset); expect(first["Current date/time"]).not.toBe(second["Current date/time"]);
    expect(first["Timezone ID"]).toBeTruthy();
  });
});
