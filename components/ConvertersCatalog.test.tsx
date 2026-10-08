// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ConvertersCatalog from "./ConvertersCatalog";
import { converterEntries } from "@/config/converter-tools";

afterEach(cleanup);

describe("ConvertersCatalog", () => {
  it("renders canonical cards and supports text search", () => {
    render(<ConvertersCatalog />);
    expect(screen.getByRole("heading", { name: "Converters" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(`${converterEntries.length} of ${converterEntries.length}`);
    fireEvent.change(screen.getByRole("textbox", { name: "Search converter tools" }), { target: { value: "yaml" } });
    expect(screen.getByRole("link", { name: /JSON to YAML/ })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("2 of");
  });

  it("combines category and search filters and exposes an empty state", () => {
    render(<ConvertersCatalog />);
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "image" } });
    expect(screen.getByRole("status").textContent).toMatch(/of/);
    fireEvent.change(screen.getByRole("textbox", { name: "Search converter tools" }), { target: { value: "does-not-exist" } });
    expect(screen.getByText("No converter tools match those filters.")).toBeTruthy();
  });
});
