// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { textTools } from "./text-tools";
import { tools, getTool } from "./tools";
import ToolPage, { generateMetadata, generateStaticParams } from "@/app/tools/[slug]/page";
import nextConfig from "../next.config";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
const special: Record<string, string[]> = {
  "case-converter": ["text", "caseType"], "duplicate-line-remover": ["text", "caseSensitivity"], "sort-lines": ["text", "sortOrder", "caseSensitivity"], "prefix-suffix-adder": ["text", "prefix", "suffix"], "find-replace": ["text", "find", "replacement", "caseSensitivity", "replaceAll"], "text-diff": ["textA", "textB"], "lorem-ipsum-generator": ["amount", "unit"], "random-text-generator": ["length", "unit"], "regex-line-extractor": ["text", "pattern", "flags"], "line-deduplicator": ["text", "caseSensitivity"], "tabs-to-spaces": ["text", "width"], "spaces-to-tabs": ["text", "width"], "line-ending-converter": ["text", "lineEnding"],
};
describe("Text public registry and metadata", () => {
  it("has 31 unique exact public identities and keeps Regex Line Extractor in Text", () => {
    expect(textTools).toHaveLength(31); expect(tools.filter(tool => tool.category === "Text")).toEqual(textTools); expect(new Set(tools.map(tool => tool.slug)).size).toBe(tools.length);
    expect(getTool("regex-line-extractor")?.category).toBe("Text"); expect(getTool("character-counter-without-spaces")).toBeTruthy(); expect(getTool("character-counter-no-spaces")).toBeUndefined();
    expect(new Set(textTools.map(tool => tool.description)).size).toBe(31);
  });
  it.each(textTools)("$slug exact controls, metadata, headings and related routes", async tool => {
    expect(tool.textContract.fields.map(field => field.name)).toEqual(special[tool.id] ?? ["text"]);
    const params = Promise.resolve({ slug: tool.slug }); expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` }, robots: { index: false, follow: false } });
    expect(generateStaticParams()).toContainEqual({ slug: tool.slug }); render(await ToolPage({ params })); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
    expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy(); expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
    for (const link of within(screen.getByRole("navigation", { name: "Related tools" })).getAllByRole("link")) expect(getTool(link.getAttribute("href")!.replace("/tools/", ""))?.category).toBe("Text");
  });
  it.each(textTools.filter(tool => tool.pairedTool))("$slug has reciprocal direction metadata", tool => {
    const paired = getTool(tool.pairedTool!)!; expect(paired.pairedTool).toBe(tool.id); expect(paired.direction).not.toBe(tool.direction); expect(paired.inputFormat).toBe(tool.outputFormat); expect(paired.description).not.toBe(tool.description);
  });
  it("redirects old character counter and never invents generator fields", async () => {
    expect(await nextConfig.redirects!()).toContainEqual({ source: "/tools/character-counter-no-spaces", destination: "/tools/character-counter-without-spaces", permanent: true });
    for (const id of ["lorem-ipsum-generator", "random-text-generator"]) expect(getTool(id)?.textContract?.fields.every(field => !["textarea", "text"].includes(field.control))).toBe(true);
  });
  it("has theme-token, keyboard, touch, monospace and mobile layout safeguards", () => {
    const css = readFileSync("components/TextWorkspace.module.css", "utf8");
    for (const text of ["var(--surface)", "var(--ink)", ":focus-visible", "44px", "@media", "minmax(0,", "overflow", "monospace"]) expect(css).toContain(text);
  });
});
