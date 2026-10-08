// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SpreadsheetControls from "./SpreadsheetControls";
import SpreadsheetPreview from "./SpreadsheetPreview";
import type { SpreadsheetInfo } from "@/lib/tools/spreadsheet/types";
const info: SpreadsheetInfo = { sheetNames: ["Sheet"], sheets: [{ name: "Sheet", headers: ["same", "same", ""], rowCount: 5, columnCount: 3, formulaCount: 0 }] };
afterEach(cleanup);
describe("Standalone spreadsheet editors", () => {
  it("hides workbook selectors before local inspection", () => {
    render(<SpreadsheetControls id="test" fields={[{ name: "sheet", label: "Sheet", control: "select" }, { name: "column", label: "Column", control: "select" }]} values={{}} info={null} onChange={vi.fn()} onFiles={vi.fn()} />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("indexes duplicate/empty headers and preserves numeric zero column", () => {
    const change = vi.fn(); render(<SpreadsheetControls id="test" fields={[{ name: "column", label: "Column", control: "select" }]} values={{ column: 0 }} info={info} onChange={change} onFiles={vi.fn()} />);
    const control = screen.getByLabelText("Column") as HTMLSelectElement; expect(control.value).toBe("0");
    expect(within(control).getAllByRole("option").map(option => option.textContent)).toEqual(["Choose a column", "1: same", "2: same", "3: (empty header)"]);
    fireEvent.change(control, { target: { value: "2" } }); expect(change).toHaveBeenCalledWith("column", "2");
  });
  it("keyboard ordering uses indexes rather than duplicate labels", () => {
    const change = vi.fn(); render(<SpreadsheetControls id="test" fields={[{ name: "order", label: "Order", control: "order" }]} values={{ order: [0, 1, 2] }} info={info} onChange={change} onFiles={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder 2: same" }), { key: "ArrowUp" }); expect(change).toHaveBeenCalledWith("order", ["1", "0", "2"]);
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder 3: (empty header)" }), { key: "ArrowDown" }); expect(change).toHaveBeenCalledTimes(1);
  });
  it("dedup empty keys are whole-row and checkbox sends an index", () => {
    const change = vi.fn(); render(<SpreadsheetControls id="test" fields={[{ name: "keys", label: "Keys", control: "keys" }]} values={{ keys: [] }} info={info} onChange={change} onFiles={vi.fn()} />);
    expect(screen.getByText("No selected keys compares the whole row.")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "2: same" })); expect(change).toHaveBeenCalledWith("keys", ["1"]);
  });
  it("preview safely renders text and exposes bounded keyboard-scroll region", () => {
    const rows = Array.from({ length: 110 }, (_, index) => [`${index}`, "<script>alert(1)</script>"]);
    const { container } = render(<SpreadsheetPreview id="test" preview={{ name: "Sheet", sheetNames: ["Sheet"], rows }} />);
    expect(screen.getAllByRole("row")).toHaveLength(100); expect(container.querySelector("script")).toBeNull();
    expect(screen.getByRole("region").getAttribute("tabindex")).toBe("0"); expect(screen.getByText(/at most 100 rows/)).toBeTruthy(); expect(screen.queryByText("109")).toBeNull();
  });
  it("preview sheet control is an output-only labeled switch", () => {
    const switchSheet = vi.fn(); render(<SpreadsheetPreview id="test" preview={{ name: "One", sheetNames: ["One", "Two"], rows: [] }} onSheet={switchSheet} />);
    fireEvent.change(screen.getByLabelText("Preview sheet"), { target: { value: "Two" } }); expect(switchSheet).toHaveBeenCalledWith("Two"); expect(screen.getByText("This sheet has no preview rows.")).toBeTruthy();
  });
});
