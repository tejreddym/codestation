// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { spreadsheetTools } from "./spreadsheet-tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata } from "@/app/tools/[slug]/page";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
it("registers exactly20 spreadsheet contracts", () => { expect(spreadsheetTools).toHaveLength(20); expect(getStation("spreadsheet")).toMatchObject({ route: "/stations/spreadsheet", toolCount: 20 }); });
it.each(spreadsheetTools)("$id public direct metadata/contract/pair", async tool => {
  const params = Promise.resolve({ slug: tool.slug }); expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, alternates: { canonical: `/tools/${tool.slug}` } });
  render(await ToolPage({ params })); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
  expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy(); expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse the Spreadsheet station →" }).getAttribute("href")).toBe("/stations/spreadsheet");
  if (tool.pairedTool) expect(spreadsheetTools.find(entry => entry.id === tool.pairedTool)?.pairedTool).toBe(tool.id);
});
