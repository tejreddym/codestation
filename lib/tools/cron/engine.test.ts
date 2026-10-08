import { describe, expect, it } from "vitest";
import { cronTools } from "@/config/cron-tools";
import { runCron, parseCron, nextCronRun, parseCronReference } from "./engine";
import { matchesCronDate } from "./parser";
import { explainCron } from "./explain";
import { humanToCron } from "./human";

describe("six exact Cron contracts", () => {
  it.each(cronTools)("$id executes its public example with exact outputs", async tool => {
    const values = { ...tool.cronContract.defaults, ...tool.cronContract.example }; const before = { ...values };
    const result = await runCron(tool.id, values); expect(result.rows.map(row => row.label)).toEqual(tool.cronContract.outputs); expect(values).toEqual(before);
  });
  it.each(cronTools)("$id handles empty fields explicitly", async tool => {
    const values = Object.fromEntries(tool.cronContract.fields.map(field => [field.name, ""]));
    if (tool.id === "cron-validator") expect((await runCron(tool.id, values)).rows[0].value).toBe("Invalid");
    else await expect(runCron(tool.id, values)).rejects.toThrow();
  });
  it("generator defaults are five fields; supplying Second explicitly selects six", async () => {
    const values = { ...cronTools[0].cronContract.defaults };
    expect((await runCron("cron-generator", values)).rows[0].value).toBe("* * * * *");
    expect((await runCron("cron-generator", { ...values, second: "*/10" })).rows[0].value).toBe("*/10 * * * * *");
    expect((await runCron("cron-generator", { ...values, second: "*" })).rows[0].value).toBe("* * * * * *");
    await expect(runCron("cron-generator", { ...values, second: " " })).rejects.toThrow(/Second|second/);
    await expect(runCron("cron-generator", { ...values, minute: " " })).rejects.toThrow(/required/);
    await expect(runCron("cron-generator", { ...values, minute: "1 2" })).rejects.toThrow(/one cron field/);
  });
});

describe("strict field parser and syntax bounds", () => {
  const positions = ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const;
  const maxima = [59, 59, 23, 31, 12, 7]; const minima = [0, 0, 0, 1, 1, 0];
  describe.each(positions)("%s", field => {
    const index = positions.indexOf(field); const min = minima[index], max = maxima[index];
    it.each(["*", String(min), String(max), `${min}-${max}`, `${min},${max}`, "*/2", `${min}-${max}/2`, `${min}/2`])("supports field notation %s", notation => {
      const tokens = ["*", "*", "*", "*", "*", "*"]; tokens[index] = notation;
      const parsed = parseCron(tokens.join(" ")); expect(parsed[field].values.length).toBeGreaterThan(0);
      const expected = new Set<number>();
      if (notation === "*") for (let n = min; n <= max; n++) expected.add(field === "dayOfWeek" && n === 7 ? 0 : n);
      else if (notation.includes(",")) for (const n of [min, max]) expected.add(field === "dayOfWeek" && n === 7 ? 0 : n);
      else if (notation.includes("/") || notation.includes("-")) {
        const step = notation.includes("/") ? 2 : 1; for (let n = min; n <= max; n += step) expected.add(field === "dayOfWeek" && n === 7 ? 0 : n);
      } else expected.add(field === "dayOfWeek" && Number(notation) === 7 ? 0 : Number(notation));
      expect(parsed[field].values).toEqual([...expected].sort((a, b) => a - b));
    });
    it.each([String(max + 1), "-1", `${max}-${min}`, "*/0", "*/1.5", "1,,2", "1,", "/2", "1/2/3", "1.2", "NaN", "*".repeat(129)])("rejects invalid notation %s", invalid => {
      const tokens = ["*", "*", "*", "*", "*", "*"]; tokens[index] = invalid; expect(() => parseCron(tokens.join(" "))).toThrow();
    });
  });
  it.each(["0 0 * JAN MON", "0 0 * jan-dec mon-fri", "0 0 * JAN,MAR MON,WED", "0 0 * jan/2 mon-fri/2"])("supports month/weekday aliases %s", expression => expect(parseCron(expression).fields).toHaveLength(5));
  it("maps Sunday 0 and 7 without duplicate occurrences", () => {
    for (const expression of ["0 0 * * 0", "0 0 * * 7", "0 0 * * 0,7"]) expect(parseCron(expression).dayOfWeek.values).toEqual([0]);
    expect(parseCron("0 0 * * 5-7").dayOfWeek.values).toEqual([0, 5, 6]);
  });
  it.each(["", "* * * *", "* * * * * * *", "0 0 ? * MON", "0 0 L * *", "0 0 15W * *", "0 0 * * MON#2", "H/5 * * * *", "H(1-5) * * * *", "@daily", "cron(0 10 * * ? *)", "rate(5 minutes)", "TZ=UTC 0 * * * *", "0 * * * * /bin/echo", "0 * * * * #comment"])("reports invalid/unsupported syntax without modifying %s", async expression => {
    const values = { expression }; const result = await runCron("cron-validator", values);
    expect(result.rows[0].value).toBe("Invalid"); expect(result.rows[1].value.length).toBeGreaterThan(0); expect(values.expression).toBe(expression);
    await expect(runCron("cron-explainer", values)).rejects.toThrow();
  });
  it("validator keeps the original expression and returns the first field error", async () => {
    const values = { expression: "  61 25 * * *  " }; const result = await runCron("cron-validator", values);
    expect(result.rows[1].value).toMatch(/^Minute:/); expect(result.rows[1].value).not.toContain("61"); expect(values.expression).toBe("  61 25 * * *  ");
    expect((await runCron("cron-validator", { expression: "0 0 31 FEB *" })).rows[0].value).toBe("Valid");
    expect((await runCron("cron-validator", { expression: "*".repeat(1025) })).rows[0].value).toBe("Invalid");
  });
  it("uses Vixie OR for two restricted days and AND with a leading star", () => {
    const restricted = parseCron("0 9 1 * MON"); expect(restricted.dayMode).toBe("or");
    expect(matchesCronDate(restricted, 2026, 10, 1)).toBe(true); expect(matchesCronDate(restricted, 2026, 10, 5)).toBe(true); expect(matchesCronDate(restricted, 2026, 10, 2)).toBe(false);
    const starred = parseCron("0 9 */2 * MON"); expect(starred.dayMode).toBe("and"); expect(matchesCronDate(starred, 2026, 10, 5)).toBe(true); expect(matchesCronDate(starred, 2026, 10, 12)).toBe(false);
    expect(explainCron(restricted)).toContain("OR"); expect(explainCron(starred)).toContain("AND");
  });
  it("field breakdown has original notation, readable interpretation and no raw parser metadata", async () => {
    const result = await runCron("cron-explainer", { expression: "0,30 9-17/2 * JAN,MAR MON-FRI" });
    expect(result.fields?.map(field => field.expression)).toEqual(["0,30", "9-17/2", "*", "JAN,MAR", "MON-FRI"]);
    expect(result.rows[0].value).toContain("List selection: 0, 30"); expect(result.rows[0].value).toContain("Step selection: 9, 11, 13, 15, 17"); expect(result.rows[0].value).toContain("January, March"); expect(result.rows[0].value).not.toContain('"values"');
  });
});

describe("deterministic Human to Cron", () => {
  it.each([["every minute", "* * * * *"], ["every 5 minutes", "*/5 * * * *"], ["every 59 minutes", "*/59 * * * *"], ["every hour", "0 * * * *"], ["every day at 9:00", "0 9 * * *"], ["every Monday at 10:30", "30 10 * * 1"], ["weekdays at 18:00", "0 18 * * 1-5"], ["every Sunday at 00:00", "0 0 * * 0"], ["EVERY FRIDAY AT 23:59", "59 23 * * 5"]])("%s yields %s", (description, expression) => {
    const parsed = humanToCron(description); expect(parsed.expression).toBe(expression); expect(parsed.schedule).toBe(explainCron(parseCron(expression)));
  });
  it.each(["", "every 0 minutes", "every 60 minutes", "every 1.5 minutes", "every day at 24:00", "every day at 12:60", "every other Monday", "tomorrow morning", "every Monday at 10:30 then run echo", "every day at 9:00 PM", "PRIVATE".repeat(100)])("rejects unsupported phrase %s", description => expect(() => humanToCron(description)).toThrow());
});

describe("next occurrence calendar and explicit timezones", () => {
  it.each([
    ["* * * * *", "2026-10-05T00:00:00Z", "2026-10-05T00:01:00Z"],
    ["0 * * * *", "2026-10-05T00:00:00Z", "2026-10-05T01:00:00Z"],
    ["0 9 * * *", "2026-10-05T08:59:59Z", "2026-10-05T09:00:00Z"],
    ["30 10 * * MON", "2026-10-05T10:30:00Z", "2026-10-12T10:30:00Z"],
    ["0 0 1 * *", "2026-10-05T00:00:00Z", "2026-11-01T00:00:00Z"],
    ["0 0 31 * *", "2026-04-30T00:00:00Z", "2026-05-31T00:00:00Z"],
    ["0 0 29 FEB *", "2025-03-01T00:00:00Z", "2028-02-29T00:00:00Z"],
    ["0 0 1 JAN *", "2026-12-31T23:59:59Z", "2027-01-01T00:00:00Z"],
    ["15-45/15 9-17 * * 1-5", "2026-10-05T09:15:00Z", "2026-10-05T09:30:00Z"],
    ["0,30 1,8,15 * * *", "2026-10-05T08:30:00Z", "2026-10-05T15:00:00Z"],
    ["*/10 * * * * *", "2026-10-05T00:00:10Z", "2026-10-05T00:00:20Z"],
    ["* * * * * *", "2026-10-05T00:00:00.500Z", "2026-10-05T00:00:01Z"],
    ["0 9 1 * MON", "2026-10-01T09:00:00Z", "2026-10-05T09:00:00Z"],
    ["0 9 */2 * MON", "2026-10-05T09:00:00Z", "2026-10-19T09:00:00Z"],
  ])("%s after %s is %s in UTC", (expression, reference, expected) => {
    const next = nextCronRun(expression, reference, "UTC"); expect(new Date(next.instant).toISOString()).toBe(new Date(expected).toISOString()); expect(next.durationMilliseconds).toBe(next.instant - Date.parse(reference)); expect(next.durationMilliseconds).toBeGreaterThan(0);
  });
  it.each([["UTC", "2026-10-05T09:00:00Z"], ["Asia/Kolkata", "2026-10-05T03:30:00Z"], ["Asia/Kathmandu", "2026-10-05T03:15:00Z"], ["America/New_York", "2026-10-05T13:00:00Z"], ["Pacific/Kiritimati", "2026-10-05T19:00:00Z"]])("daily 09:00 uses the wall clock in %s", (timezone, expected) => {
    const next = nextCronRun("0 9 * * *", "2026-10-05T00:00:00Z", timezone); expect(next.instant).toBe(Date.parse(expected)); expect(next.dateTime).toContain("T09:00:00"); expect(next.dateTime).toContain(`[${timezone}]`);
  });
  it("accepts explicit reference offsets and keeps fractional elapsed precision", () => {
    const next = nextCronRun("* * * * *", "2026-10-05T09:00:00.123+05:30", "Asia/Kolkata"); expect(next.durationMilliseconds).toBe(59877); expect(next.duration).toBe("+59 seconds, 877 milliseconds");
  });
  it.each(["", "2026-10-05", "2026-10-05T09:00", "2026-02-30T00:00Z", "2026-13-01T00:00Z", "2026-10-05T24:00Z", "2026-10-05T00:00:60Z", "2026-10-05T00:00+14:01", "2026-10-05T00:00+01:60", "1969-12-31T23:59Z", "2100-01-01T00:00Z", "2026-10-05T00:00:00.1234Z"])("rejects invalid reference %s", reference => expect(() => parseCronReference(reference)).toThrow());
  it.each(["", "Mars/Olympus", "+05:30", " UTC "])("requires a recognized explicit IANA zone %s", timezone => expect(() => nextCronRun("* * * * *", "2026-10-05T00:00Z", timezone)).toThrow());
  it("fails impossible dates and the upper-year/search boundary explicitly", () => {
    expect(() => nextCronRun("0 0 31 FEB *", "2026-01-01T00:00Z", "UTC")).toThrow(/No occurrence/);
    expect(() => nextCronRun("0 0 29 FEB *", "2097-01-01T00:00Z", "UTC")).toThrow(/2099/);
    expect(() => nextCronRun("* * * * *", "2099-12-31T23:59:59Z", "UTC")).toThrow(/2099/);
  });
});

describe("DST: gaps skipped; folds considered in instant order", () => {
  it.each([
    ["30 2 * * *", "2026-03-08T06:00:00Z", "America/New_York", "2026-03-09T06:30:00Z"],
    ["30 1 * * *", "2026-11-01T04:00:00Z", "America/New_York", "2026-11-01T05:30:00Z"],
    ["30 1 * * *", "2026-11-01T05:30:00Z", "America/New_York", "2026-11-01T06:30:00Z"],
    ["30 1 * * *", "2026-11-01T05:45:00Z", "America/New_York", "2026-11-01T06:30:00Z"],
    ["30 1 * * *", "2026-11-01T06:30:00Z", "America/New_York", "2026-11-02T06:30:00Z"],
    ["0 2 * * *", "2026-03-29T00:00:00Z", "Europe/Berlin", "2026-03-30T00:00:00Z"],
    ["30 1 * * *", "2026-04-04T14:30:00Z", "Australia/Lord_Howe", "2026-04-04T15:00:00Z"],
    ["15 2 * * *", "2026-10-03T14:00:00Z", "Australia/Lord_Howe", "2026-10-04T15:15:00Z"],
    ["0 0 * * *", "2011-12-29T10:01:00Z", "Pacific/Apia", "2011-12-30T10:00:00Z"],
    ["* * * * * *", "2026-03-08T06:59:59Z", "America/New_York", "2026-03-08T07:00:00Z"],
    ["* * * * * *", "2026-11-01T05:59:59Z", "America/New_York", "2026-11-01T06:00:00Z"],
  ])("%s after %s in %s yields %s", (expression, reference, timezone, expected) => expect(nextCronRun(expression, reference, timezone).instant).toBe(Date.parse(expected)));
  it("reports second-based historical offsets rather than rounding the instant", () => {
    expect(() => nextCronRun("0 0 * * *", "1971-01-01T00:00:00Z", "Africa/Monrovia")).toThrow(/offset includes seconds/);
  });
});

describe("independent bounded timeline oracle", () => {
  const patterns = [
    { expression: "* * * * *", minutes: Array.from({ length: 60 }, (_, i) => i), hours: Array.from({ length: 24 }, (_, i) => i) },
    { expression: "*/7 * * * *", minutes: [0, 7, 14, 21, 28, 35, 42, 49, 56], hours: Array.from({ length: 24 }, (_, i) => i) },
    { expression: "0,15,30,45 1-3 * * *", minutes: [0, 15, 30, 45], hours: [1, 2, 3] },
  ];
  const references = ["2026-03-08T06:59:30Z", "2026-11-01T05:45:30Z", "2026-04-04T14:45:30Z", "2026-10-03T15:00:30Z"];
  it.each(["UTC", "America/New_York", "Australia/Lord_Howe", "Asia/Kathmandu"])("agrees with direct UTC minute scans across %s", timezone => {
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    for (const reference of references) for (const pattern of patterns) {
      let expected: number | undefined; const start = Math.floor(Date.parse(reference) / 60000) * 60000 + 60000;
      for (let candidate = start; candidate < start + 2 * 86400000; candidate += 60000) {
        const parts = formatter.formatToParts(candidate); const hour = Number(parts.find(part => part.type === "hour")?.value); const minute = Number(parts.find(part => part.type === "minute")?.value);
        if (pattern.hours.includes(hour) && pattern.minutes.includes(minute)) { expected = candidate; break; }
      }
      expect(expected).toBeDefined(); expect(nextCronRun(pattern.expression, reference, timezone).instant).toBe(expected);
    }
  });
});
