import { describe, expect, it } from "vitest";
import { dispatchToolExecution } from "./dispatcher";

describe("WebMCP dispatcher: Finance & Calculators station", () => {
  it("dispatches emi-calculator options", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("emi-calculator", "", {
        principal: 1_000_000,
        annualRate: 8.5,
        months: 240,
        processingFee: 5_000,
      })
    );
    expect(parsed.emi).toBe(8678.23);
    expect(parsed.totalInterest).toBeCloseTo(1_082_776.63, 2);
    expect(parsed.totalWithFee).toBeCloseTo(2_087_776.63, 2);
    expect(parsed.schedule).toHaveLength(240);
    expect(parsed.schedule[0]).toEqual({
      month: 1,
      opening: 1_000_000,
      interest: 7_083.33,
      principal: 1_594.9,
      closing: 998_405.1,
    });
    expect(parsed.schedule[239].closing).toBe(0);
  });

  it("derives EMI months from a years option", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("emi-calculator", "", {
        principal: 500_000,
        annualRate: 0,
        years: 10,
      })
    );
    expect(parsed.months).toBe(120);
    expect(parsed.emi).toBeCloseTo(4166.67, 2);
  });

  it("dispatches loan-prepayment-calculator options", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("loan-prepayment-calculator", "", {
        principal: 1_000_000,
        annualRate: 9,
        months: 240,
        oneTime: 100_000,
        extraMonthly: 5_000,
        chargePercent: 1,
        strategy: "reduce-tenure",
      })
    );
    expect(parsed.baseline.emi).toBe(8997.26);
    expect(parsed.baseline.months).toBe(240);
    expect(parsed.scenario.months).toBe(89);
    expect(parsed.monthsSaved).toBe(151);
    expect(parsed.interestSaved).toBeCloseTo(826_265.9, 1);
    expect(parsed.charge).toBe(1_000);
    expect(parsed.noChange).toBe(false);
    expect(parsed.comparison).toHaveLength(240);
  });

  it("dispatches loan-prepayment-calculator with reduce-emi", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("loan-prepayment-calculator", "", {
        principal: 1_000_000,
        annualRate: 9,
        months: 240,
        oneTime: 100_000,
        strategy: "reduce-emi",
      })
    );
    expect(parsed.scenario.emi).toBe(8097.53);
    expect(parsed.scenario.months).toBe(240);
    expect(parsed.interestSaved).toBeCloseTo(115_932.63, 1);
  });

  it("dispatches gst-calculator inclusive intra-state options", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("gst-calculator", "", {
        amount: 1_180,
        rate: 18,
        mode: "inclusive",
        supply: "intra",
      })
    );
    expect(parsed.taxableValue).toBe(1_000);
    expect(parsed.cgst).toBe(90);
    expect(parsed.sgst).toBe(90);
    expect(parsed.igst).toBe(0);
    expect(parsed.totalTax).toBe(180);
    expect(parsed.total).toBe(1_180);
  });

  it("dispatches gst-calculator line items", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("gst-calculator", "", {
        supply: "inter",
        mode: "exclusive",
        lines: [
          { description: "Design services", amount: 1_000, rate: 18 },
          { description: "Hosting", amount: 500, rate: 12 },
        ],
      })
    );
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.totals.cgst).toBe(0);
    expect(parsed.totals.igst).toBe(240);
    expect(parsed.totals.totalTax).toBe(240);
    expect(parsed.totals.total).toBe(1_740);
  });

  it("dispatches sip-calculator options with an array comparison", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("sip-calculator", "", {
        monthly: 10_000,
        years: 10,
        annualReturn: 12,
        inflationPercent: 6,
        compareRates: [10, 12],
      })
    );
    expect(parsed.corpus).toBeCloseTo(2_323_390.76, 2);
    expect(parsed.invested).toBe(1_200_000);
    expect(parsed.returns).toBeCloseTo(1_123_390.76, 2);
    expect(parsed.schedule).toHaveLength(10);
    expect(parsed.comparison).toHaveLength(2);
    expect(parsed.comparison[1].rate).toBe(12);
    expect(parsed.comparison[1].corpus).toBeCloseTo(parsed.corpus, 2);
    expect(parsed.realCorpus).toBeLessThan(parsed.corpus);
  });

  it("accepts a comma-separated comparison string", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("sip-calculator", "", {
        monthly: 10_000,
        years: 5,
        annualReturn: 12,
        compareRates: "10, 12",
      })
    );
    expect(parsed.comparison.map((entry: { rate: number }) => entry.rate)).toEqual([10, 12]);
  });

  it("accepts the codestation_ prefixed WebMCP names", async () => {
    const parsed = JSON.parse(
      await dispatchToolExecution("codestation_emi_calculator", "", {
        principal: 100_000,
        annualRate: 12,
        months: 1,
      })
    );
    expect(parsed.emi).toBe(101_000);
    expect(parsed.totalInterest).toBe(1_000);

    const gst = JSON.parse(
      await dispatchToolExecution("codestation_gst_calculator", "", {
        amount: 1_000,
        rate: 18,
        mode: "exclusive",
        supply: "intra",
      })
    );
    expect(gst.total).toBe(1_180);
  });

  it("surfaces validation errors as rejections", async () => {
    await expect(
      dispatchToolExecution("emi-calculator", "", { principal: 1_000_000, annualRate: 8.5, months: 0 })
    ).rejects.toThrow(/between 1 and 1200/);
    await expect(
      dispatchToolExecution("gst-calculator", "", { amount: 1_000, rate: 101, mode: "exclusive", supply: "intra" })
    ).rejects.toThrow(/between 0% and 100%/);
    await expect(
      dispatchToolExecution("sip-calculator", "", { monthly: 0, years: 10, annualReturn: 12 })
    ).rejects.toThrow(/greater than zero/);
  });
});
