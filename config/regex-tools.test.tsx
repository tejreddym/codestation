// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import { regexTools } from "./regex-tools";
import { getTool, tools } from "./tools";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const fields: Record<string, string[]> = {
  "regex-tester": ["pattern", "text", "flags"], "regex-escape": ["literal"], "regex-replace-tester": ["pattern", "text", "flags", "replacement"],
  "regex-match-inspector": ["pattern", "text", "flags"], "regex-group-extractor": ["pattern", "text", "flags"], "regex-flag-tester": ["pattern", "text"],
  "regex-pattern-builder": ["literal", "mode", "quantifier", "caseSensitivity"], "regex-capture-group-tester": ["pattern", "text", "flags"], "regex-split-tester": ["pattern", "text", "flags"],
};
describe("Regex metadata and contracts", () => {
  it("keeps exactly nine canonical routes in the central registry", () => {
    expect(regexTools.map(tool => tool.slug).sort()).toEqual(Object.keys(fields).sort());
    expect(tools.filter(tool => tool.category === "Regex")).toEqual([...regexTools]);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length); expect(new Set(tools.map(tool => tool.slug)).size).toBe(tools.length);
    expect(new Set(regexTools.map(tool => tool.description)).size).toBe(9);
  });
  it.each(regexTools)("$slug exact controls, metadata, heading and related route links", async tool => {
    expect(tool.regexContract.fields.map(field => field.name)).toEqual(fields[tool.id]);
    const flags = tool.regexContract.fields.find(field => field.name === "flags");
    if (flags) expect(flags.options).toEqual(["g", "i", "m", "s", "u", "y", "d"]);
    const params = Promise.resolve({ slug: tool.slug });
    expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug }); render(await ToolPage({ params }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
    for (const link of within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link")) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))?.category).toBe("Regex");
  });
  it("has responsive, focus, touch, monospace and scrolling CSS safeguards", () => {
    const css = readFileSync("components/RegexStation.module.css", "utf8");
    for (const rule of ["minmax(0,1fr)", "min-height:44px", ":focus-visible", "var(--surface)", "var(--ink)", "max-width:640px", "white-space:pre", "overflow:auto", "ui-monospace"]) expect(css).toContain(rule);
  });
});
