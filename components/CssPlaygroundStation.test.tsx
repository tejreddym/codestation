// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import CssPlaygroundStation from "./CssPlaygroundStation";

afterEach(cleanup);

describe("CssPlaygroundStation component", () => {
  it("renders CSS Grid visual generator", () => {
    render(<CssPlaygroundStation toolId="css-grid-generator" />);
    expect(screen.getByText("Interactive Controls")).toBeDefined();
    expect(screen.getByText("Generated CSS")).toBeDefined();
    const code = screen.getByLabelText("Generated CSS");
    expect(code.textContent).toContain("display: grid;");
  });

  it("renders Flexbox playground", () => {
    render(<CssPlaygroundStation toolId="flexbox-playground" />);
    const code = screen.getByLabelText("Generated CSS");
    expect(code.textContent).toContain("display: flex;");
  });

  it("renders Glassmorphism generator", () => {
    render(<CssPlaygroundStation toolId="glassmorphism-generator" />);
    const code = screen.getByLabelText("Generated CSS");
    expect(code.textContent).toContain("backdrop-filter: blur(");
  });
});
