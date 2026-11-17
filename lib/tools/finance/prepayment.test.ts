import { describe, expect, it } from "vitest";
import { comparePrepayment, type PrepaymentStrategy } from "./prepayment";

// Reference values come from an independent month-by-month spreadsheet model.
const base = {
  principal: 1_000_000,
  annualRate: 9,
  months: 240,
  chargePercent: 1,
} as const;

const strategy = (value: string): PrepaymentStrategy => value as PrepaymentStrategy;

describe("loan prepayment comparison", () => {
  it("derives the baseline EMI and full-term interest", () => {
    const result = comparePrepayment({ ...base, strategy: "reduce-tenure" });
    expect(result.baseline.emi).toBe(8997.26);
    expect(result.baseline.months).toBe(240);
    expect(result.baseline.totalInterest).toBeCloseTo(1_159_342.11, 1);
    expect(result.noChange).toBe(true);
    expect(result.interestSaved).toBe(0);
    expect(result.monthsSaved).toBe(0);
    expect(result.comparison).toHaveLength(240);
  });

  it("shows interest and tenure savings for reduce-tenure", () => {
    const result = comparePrepayment({
      ...base,
      oneTime: 100_000,
      extraMonthly: 5_000,
      strategy: "reduce-tenure",
    });
    expect(result.scenario.months).toBe(89);
    expect(result.payoffMonth).toBe(89);
    expect(result.scenario.totalInterest).toBeCloseTo(333_076.21, 1);
    expect(result.interestSaved).toBeCloseTo(826_265.9, 1);
    expect(result.monthsSaved).toBe(151);
    expect(result.scenario.oneTimeApplied).toBe(100_000);
    expect(result.charge).toBe(1_000);
    expect(result.scenario.totalOutflow).toBeCloseTo(
      result.scenario.totalPayment + 100_000 + 1_000,
      2
    );
    expect(result.scenario.emi).toBe(result.baseline.emi);
  });

  it("recalculates a lower EMI when the strategy is reduce-emi", () => {
    const result = comparePrepayment({
      ...base,
      oneTime: 100_000,
      strategy: "reduce-emi",
    });
    expect(result.scenario.emi).toBe(8097.53);
    expect(result.scenario.months).toBe(240);
    expect(result.scenario.totalInterest).toBeCloseTo(1_043_409.48, 1);
    expect(result.interestSaved).toBeCloseTo(115_932.63, 1);
    expect(result.monthsSaved).toBe(0);
  });

  it("keeps the recalculated EMI and still finishes early with recurring extras", () => {
    const result = comparePrepayment({
      ...base,
      oneTime: 100_000,
      extraMonthly: 5_000,
      strategy: "reduce-emi",
    });
    expect(result.scenario.emi).toBe(8097.53);
    expect(result.scenario.months).toBe(97);
    expect(result.scenario.totalInterest).toBeCloseTo(369_713.6, 1);
    expect(result.interestSaved).toBeGreaterThan(0);
    expect(result.monthsSaved).toBe(143);
    expect(result.comparison).toHaveLength(240);
  });

  it("caps the one-time payment at the outstanding balance", () => {
    const result = comparePrepayment({
      principal: 100_000,
      annualRate: 9,
      months: 12,
      oneTime: 250_000,
      chargePercent: 0,
      strategy: "reduce-tenure",
    });
    expect(result.scenario.oneTimeApplied).toBe(100_000);
    expect(result.scenario.months).toBe(0);
    expect(result.scenario.totalPayment).toBe(0);
    expect(result.scenario.totalInterest).toBe(0);
    expect(result.interestSaved).toBeCloseTo(result.baseline.totalInterest, 2);
    expect(result.monthsSaved).toBe(result.baseline.months);
  });

  it("honours a user-supplied EMI", () => {
    const result = comparePrepayment({ ...base, emi: 9_000, strategy: "reduce-tenure" });
    expect(result.baseline.emi).toBe(9_000);
    expect(result.baseline.months).toBeGreaterThan(0);
    expect(result.noChange).toBe(true);
    expect(result.scenario.months).toBe(result.baseline.months);
  });

  it("rounds the charge to paise and reports no-change plainly", () => {
    const charged = comparePrepayment({
      ...base,
      oneTime: 100_000,
      chargePercent: 1.25,
      strategy: "reduce-tenure",
    });
    expect(charged.charge).toBe(1_250);
    const empty = comparePrepayment({ ...base, strategy: "reduce-emi" });
    expect(empty.noChange).toBe(true);
    expect(empty.scenario).toMatchObject({ oneTimeApplied: 0, charge: 0 });
  });

  it("rejects invalid inputs and unreachable payments", () => {
    expect(() => comparePrepayment({ ...base, strategy: strategy("banana") })).toThrow(/Strategy/);
    expect(() => comparePrepayment({ ...base, emi: 100, strategy: "reduce-tenure" })).toThrow(/does not cover/);
    expect(() => comparePrepayment({ ...base, months: 0, strategy: "reduce-tenure" })).toThrow(/between 1 and 1200/);
    expect(() => comparePrepayment({ ...base, annualRate: -1, strategy: "reduce-tenure" })).toThrow(/negative/);
    expect(() => comparePrepayment({ ...base, oneTime: -1, strategy: "reduce-tenure" })).toThrow(/negative/);
    expect(() => comparePrepayment({ ...base, extraMonthly: -1, strategy: "reduce-tenure" })).toThrow(/negative/);
    expect(() => comparePrepayment({ ...base, chargePercent: 101, strategy: "reduce-tenure" })).toThrow(/between 0% and 100%/);
    expect(() => comparePrepayment({ ...base, principal: 0, strategy: "reduce-tenure" })).toThrow(/greater than zero/);
  });
});
