// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { spreadsheetTools } from "./spreadsheet-tools";
import { getStation } from "./stations";
import ToolPage, { generateMetadata } from "@/app/tools/[slug]/page";
vi.mock("@/components/ToolWorkspace", () => ({ default: () => null }));
afterEach(cleanup);
it("registers exactly 21 spreadsheet contracts", () => { expect(spreadsheetTools).toHaveLength(21); expect(getStation("spreadsheet")).toMatchObject({ route: "/stations/spreadsheet", toolCount: 21 }); });
it.each(spreadsheetTools)("$id public direct metadata/contract/pair", async tool => {
  const params = Promise.resolve({ slug: tool.slug }); expect(await generateMetadata({ params })).toMatchObject({ title: tool.seo.title, alternates: { canonical: `/tools/${tool.slug}` } });
  render(await ToolPage({ params })); expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(tool.name);
  expect(screen.getByRole("heading", { name: "What does this tool do?" })).toBeTruthy(); expect(screen.getByRole("heading", { name: "How to use it?" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse the Spreadsheet station →" }).getAttribute("href")).toBe("/stations/spreadsheet");
  if (tool.pairedTool) expect(spreadsheetTools.find(entry => entry.id === tool.pairedTool)?.pairedTool).toBe(tool.id);
});

describe("SpreadsheetStation spreadsheet-sql-query UI component", () => {
  it("renders the interactive SQL station and executes the acceptance query", async () => {
    const { default: SpreadsheetStation } = await import("@/components/SpreadsheetStation");
    const { waitFor } = await import("@testing-library/react");
    render(<SpreadsheetStation toolId="spreadsheet-sql-query" />);

    expect(screen.getByRole("heading", { name: "Spreadsheet SQL Query" })).toBeTruthy();
    expect(screen.getByLabelText(/^SQL Query$/i)).toBeTruthy();
    expect(screen.getByLabelText(/CSV or TSV Data/i)).toBeTruthy();

    // Verify detected schema badges
    await waitFor(() => {
      expect(screen.getByText(/Table 'table':/i)).toBeTruthy();
    });

    // Verify acceptance query results table appears
    await waitFor(() => {
      expect(screen.getByTestId("sql-results-table")).toBeTruthy();
    });

    expect(screen.getByRole("columnheader", { name: "department" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "COUNT(*)" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "AVG(salary)" })).toBeTruthy();
    expect(screen.getByText("Engineering")).toBeTruthy();
    expect(screen.getByText("Marketing")).toBeTruthy();

    // Verify export buttons are present
    expect(screen.getByRole("button", { name: "Copy CSV" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeTruthy();
  });

  it("handles sample query selection and error states", async () => {
    const { default: SpreadsheetStation } = await import("@/components/SpreadsheetStation");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    render(<SpreadsheetStation toolId="spreadsheet-sql-query" />);

    await waitFor(() => {
      expect(screen.getByTestId("sql-results-table")).toBeTruthy();
    });

    // Click sample query "Select All (Limit 10)"
    const sampleBtn = screen.getByRole("button", { name: /Select All/i });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      const textarea = screen.getByLabelText(/^SQL Query$/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain("LIMIT 10");
    });

    // Enter invalid SQL query and click Execute SQL
    const queryInput = screen.getByLabelText(/^SQL Query$/i);
    fireEvent.change(queryInput, { target: { value: "SELEC INVALID FROM table" } });
    const executeBtn = screen.getByRole("button", { name: /Execute SQL/i });
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByRole("alert").textContent).toMatch(/parse error/i);
    });
  });
});

