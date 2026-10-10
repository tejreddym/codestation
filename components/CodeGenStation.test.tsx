// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import CodeGenStation from "./CodeGenStation";

afterEach(cleanup);

describe("CodeGenStation component", () => {
  it("renders JSON to TypeScript generator and displays initial output", () => {
    render(<CodeGenStation toolId="json-to-typescript" />);
    expect(screen.getByText("Source Input")).toBeDefined();
    expect(screen.getByText("Generated Output")).toBeDefined();
    const output = screen.getByLabelText("Generated output");
    expect(output.textContent).toContain("export interface User");
  });

  it("updates generated output when source input changes", () => {
    render(<CodeGenStation toolId="json-to-go" />);
    const textarea = screen.getByLabelText("Source code input");
    fireEvent.change(textarea, { target: { value: '{"server_id": 99, "is_live": false}' } });
    const output = screen.getByLabelText("Generated output");
    expect(output.textContent).toContain("type UserPayload struct {");
    expect(output.textContent).toContain('ServerID int64 `json:"server_id"`');
    expect(output.textContent).toContain('IsLive bool `json:"is_live"`');
  });

  it("renders HTML to JSX converter", () => {
    render(<CodeGenStation toolId="html-to-jsx" />);
    const output = screen.getByLabelText("Generated output");
    expect(output.textContent).toContain('className="card"');
    expect(output.textContent).toContain("style={{ padding:");
  });
});
