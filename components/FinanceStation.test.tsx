// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FinanceStation from "./FinanceStation";

afterEach(cleanup);

function submitWith(value: string, expected: string) {
  render(<FinanceStation toolId="emi-calculator" />);
  const amount = screen.getByLabelText("Loan amount (INR)") as HTMLInputElement;
  fireEvent.change(amount, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate EMI" }));
  const error = screen.getByText(expected);
  expect(amount.getAttribute("aria-invalid")).toBe("true");
  expect(amount.getAttribute("aria-describedby")).toContain(error.id);
  expect(screen.queryByRole("alert", { name: /must be at most/ })).toBeNull();
  return { amount, error };
}

describe("FinanceStation field validation", () => {
  it("routes an overflowing loan amount through the field error path", () => {
    submitWith("1e20", "Loan amount must be 1000000000000 or less.");
  });

  it("keeps zero and negative amounts on the same visible field path", () => {
    submitWith("0", "Loan amount must be at least 1.");
    cleanup();
    submitWith("-500", "Loan amount must be at least 1.");
  });
});
