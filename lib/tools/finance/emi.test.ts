import { describe, expect, it } from "vitest";
import { calculateEmi } from "./emi";

// Reference values in this file were produced by an independent spreadsheet-style
// amortization calculation, not by reusing the production implementation.
describe("EMI calculator", () => {
  it("matches the reference reducing-balance EMI for a 20-year home loan", () => {
    const result = calculateEmi({ principal: 1_000_000, annualRate: 8.5, months: 240, processingFee: 5_000 });
    expect(result.emi).toBe(8678.23);
    expect(result.schedule[0]).toMatchObject({
      opening: 1_000_000,
      interest: 7083.33,
      principal: 1594.9,
      closing: 998_405.1,
    });
    expect(result.schedule.at(-1)?.closing).toBe(0);
    expect(result.schedule.reduce((sum, row) => sum + row.principal, 0)).toBeCloseTo(1_000_000, 1);
    expect(result.schedule.reduce((sum, row) => sum + row.interest, 0)).toBeCloseTo(result.totalInterest, 1);
    expect(result.totalInterest).toBeCloseTo(1_082_776.63, 1);
    expect(result.totalPayment).toBeCloseTo(2_082_776.63, 1);
    expect(result.totalWithFee).toBeCloseTo(2_087_776.63, 1);
  });

  it("uses straight-line instalments at zero percent", () => {
    const result = calculateEmi({ principal: 120_000, annualRate: 0, months: 12 });
    expect(result.emi).toBe(10_000);
    expect(result.totalInterest).toBe(0);
    expect(result.totalPayment).toBe(120_000);
    expect(result.schedule).toHaveLength(12);
    expect(result.schedule.every(row => row.interest === 0 && row.closing >= 0)).toBe(true);
    expect(result.schedule.at(-1)?.closing).toBe(0);
  });

  it("matches a one-month loan with one month of interest", () => {
    const result = calculateEmi({ principal: 100_000, annualRate: 12, months: 1 });
    expect(result.emi).toBe(101_000);
    expect(result.schedule).toHaveLength(1);
    expect(result.schedule[0]).toMatchObject({ interest: 1_000, principal: 100_000, closing: 0 });
    expect(result.totalPayment).toBe(101_000);
  });

  it("rejects invalid values", () => {
    expect(() => calculateEmi({ principal: 0, annualRate: 8, months: 12 })).toThrow(/greater than zero/);
    expect(() => calculateEmi({ principal: 100, annualRate: -1, months: 12 })).toThrow(/negative/);
    expect(() => calculateEmi({ principal: 100, annualRate: 8, months: 0 })).toThrow(/between 1 and 1200/);
    expect(() => calculateEmi({ principal: 100, annualRate: 8, months: 1_201 })).toThrow(/between 1 and 1200/);
    expect(() => calculateEmi({ principal: 100, annualRate: 8, months: 12.5 })).toThrow(/whole number/);
    expect(() => calculateEmi({ principal: 100, annualRate: Number.NaN, months: 12 })).toThrow(/finite/);
    expect(() => calculateEmi({ principal: 100, annualRate: 8, months: 12, processingFee: -1 })).toThrow(/negative/);
  });
});
