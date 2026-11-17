import { describe, expect, it } from "vitest";
import { projectSip } from "./sip";

// Reference corpus values were produced by the standard annuity-due formula and
// an independent step-up spreadsheet, not by the production loop.
describe("SIP projection", () => {
  it("matches the annuity-due formula without a step-up", () => {
    const result = projectSip({ monthly: 10_000, years: 10, annualReturn: 12 });
    expect(result.corpus).toBe(2_323_390.76);
    expect(result.invested).toBe(1_200_000);
    expect(result.returns).toBe(1_123_390.76);
    expect(result.schedule).toHaveLength(10);
    expect(result.schedule[0].value).toBe(128_093.28);
    expect(result.schedule.at(-1)?.value).toBe(result.corpus);
    expect(result.realCorpus).toBe(result.corpus);
    expect(result.comparison).toEqual([]);
  });

  it("raises the corpus with an annual step-up", () => {
    const flat = projectSip({ monthly: 5_000, years: 5, annualReturn: 10 });
    const stepped = projectSip({ monthly: 5_000, years: 5, annualReturn: 10, stepUpPercent: 10 });
    expect(stepped.corpus).toBe(467_755.12);
    expect(stepped.invested).toBe(366_306);
    expect(stepped.corpus).toBeGreaterThan(flat.corpus);
    expect(stepped.schedule[0].monthlyContribution).toBe(5_000);
    expect(stepped.schedule[1].monthlyContribution).toBe(5_500);
    expect(stepped.schedule[4].monthlyContribution).toBe(7_320.5);
  });

  it("lowers the real corpus when inflation is applied", () => {
    const nominal = projectSip({ monthly: 10_000, years: 10, annualReturn: 12 });
    const real = projectSip({ monthly: 10_000, years: 10, annualReturn: 12, inflationPercent: 6 });
    expect(real.realCorpus).toBe(1_297_369.27);
    expect(real.realCorpus).toBeLessThan(real.corpus);
    expect(real.corpus).toBe(nominal.corpus);
    expect(real.schedule.at(-1)?.realValue).toBe(real.realCorpus);
  });

  it("projects one corpus per comparison rate in input order", () => {
    const result = projectSip({
      monthly: 10_000,
      years: 10,
      annualReturn: 12,
      compareRates: [10, 12],
    });
    expect(result.comparison).toHaveLength(2);
    expect(result.comparison[0]).toEqual({ rate: 10, corpus: 2_065_520.2 });
    expect(result.comparison[1]).toEqual({ rate: 12, corpus: result.corpus });
  });

  it("rejects invalid inputs", () => {
    expect(() => projectSip({ monthly: 0, years: 10, annualReturn: 12 })).toThrow(/greater than zero/);
    expect(() => projectSip({ monthly: 1_000, years: 0, annualReturn: 12 })).toThrow(/between 1 and 60/);
    expect(() => projectSip({ monthly: 1_000, years: 61, annualReturn: 12 })).toThrow(/between 1 and 60/);
    expect(() => projectSip({ monthly: 1_000, years: 10, annualReturn: -1 })).toThrow(/between 0% and 100%/);
    expect(() => projectSip({ monthly: 1_000, years: 10, annualReturn: 101 })).toThrow(/between 0% and 100%/);
    expect(() => projectSip({ monthly: 1_000, years: 10, annualReturn: 12, stepUpPercent: -1 })).toThrow(/between 0% and 100%/);
    expect(() => projectSip({ monthly: 1_000, years: 10, annualReturn: 12, inflationPercent: 101 })).toThrow(/between 0% and 100%/);
    expect(() => projectSip({ monthly: 1_000, years: 10, annualReturn: 12, compareRates: [-1] })).toThrow(/between 0% and 100%/);
  });
});
