// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DevMathStation from "./DevMathStation";

afterEach(cleanup);

describe("DevMathStation component", () => {
  it("renders Bitwise operator playground", () => {
    render(<DevMathStation toolId="bitwise-calculator" />);
    expect(screen.getByText("Bitwise Operator Playground")).toBeDefined();
    expect(screen.getByText("A AND B (A & B)")).toBeDefined();
    expect(screen.getByText("A OR B (A | B)")).toBeDefined();
  });

  it("renders IEEE-754 floating-point inspector", () => {
    render(<DevMathStation toolId="ieee754-converter" />);
    expect(screen.getByText("IEEE-754 Floating-Point Inspector")).toBeDefined();
    expect(screen.getByText("Binary Bit Ribbon (Sign | Exponent | Mantissa)")).toBeDefined();
    expect(screen.getByText(/Raw Exponent/)).toBeDefined();
  });

  it("renders BigInt calculator and calculates large numbers", () => {
    render(<DevMathStation toolId="bigint-calculator" />);
    expect(screen.getByText("BigInt Arbitrary Precision Calculator")).toBeDefined();
    expect(screen.getByDisplayValue("9007199254740995")).toBeDefined();
    expect(screen.getByText("9007200254740995")).toBeDefined();
  });

  it("renders Fraction to Decimal converter", () => {
    render(<DevMathStation toolId="fraction-converter" />);
    expect(screen.getByText("Fraction ⇄ Decimal Converter")).toBeDefined();
    expect(screen.getByText("3/4")).toBeDefined();
    expect(screen.getByText("4/3")).toBeDefined();
  });
});
