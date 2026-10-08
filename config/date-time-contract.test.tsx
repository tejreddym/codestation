// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dateTimeTools } from "./date-time-tools";
import { getTool } from "./tools";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import nextConfig from "../next.config";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const fields: Record<string, string[]> = {
  "unix-timestamp-converter": ["timestamp", "unit"], "unix-timestamp-generator": ["date", "time", "timezone"], "unix-milliseconds-converter": ["timestamp"], "iso-8601-converter": ["iso"],
  "date-to-timestamp": ["date", "time", "timezone"], "timestamp-to-date": ["timestamp", "unit", "timezone"], "timezone-converter": ["date", "time", "sourceTimezone", "destinationTimezone"], "current-time-in-timezone": ["timezone"],
  "date-difference-calculator": ["startDate", "endDate", "startTime", "endTime"], "time-difference-calculator": ["startTime", "endTime", "startDate", "endDate"], "relative-time-generator": ["target", "reference"],
  "date-format-converter": ["value", "inputFormat", "outputFormat"], "epoch-converter": ["epoch", "unit"], "week-number-calculator": ["date", "convention"], "leap-year-checker": ["year"], "business-days-calculator": ["startDate", "endDate", "weekend", "weekdays", "holidays"], "age-calculator": ["birthDate", "targetDate"],
};
describe("Date & Time exact contract route shell", () => {
  it.each(dateTimeTools)("$slug has exact inputs, indexed unique metadata and factual content", async tool => {
    expect(tool.dateTimeContract.fields.map(field => field.name)).toEqual(fields[tool.id]);
    const params = Promise.resolve({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug }); render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy(); expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
    for (const link of within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link")) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))?.category).toBe("Date & Time");
  });
  it("redirects the old converter and keeps distinct paired metadata", async () => {
    expect(await nextConfig.redirects!()).toContainEqual({ source: "/tools/timestamp-converter", destination: "/tools/unix-timestamp-converter", permanent: true });
    expect(getTool("date-to-timestamp")?.description).not.toBe(getTool("timestamp-to-date")?.description);
    expect(getTool("date-to-timestamp")?.dateTimeContract?.action).not.toBe(getTool("timestamp-to-date")?.dateTimeContract?.action);
    expect(new Set(dateTimeTools.map(tool => tool.description)).size).toBe(17);
  });
  it("limits formatting to six explicit formats and weekend weekdays to seven", () => {
    expect(getTool("date-format-converter")?.dateTimeContract?.fields[1].options).toEqual(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD", "DD-MM-YYYY", "MM-DD-YYYY"]);
    expect(getTool("business-days-calculator")?.dateTimeContract?.fields.find(field => field.name === "weekdays")?.options).toHaveLength(7);
  });
  it("uses theme tokens, visible focus, touch sizing and mobile grid rules", () => {
    const css = readFileSync("components/DateTimeStation.module.css", "utf8");
    expect(css).toContain("var(--surface)"); expect(css).toContain(":focus-visible"); expect(css).toContain("44px"); expect(css).toContain("@media"); expect(css).toContain("minmax(0,");
  });
});
