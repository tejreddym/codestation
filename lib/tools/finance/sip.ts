import { asFiniteNumber, asIntegerInRange, asPercentage, asPositive, round2 } from "./money";

export interface SipInput {
  /** Contribution at the start of each month. */
  monthly: number;
  years: number;
  /** Expected nominal annual return, in percent. */
  annualReturn: number;
  /** Annual increase applied to the monthly contribution, in percent. */
  stepUpPercent?: number;
  /** Annual inflation used for the real-value projection, in percent. */
  inflationPercent?: number;
  /** Additional annual return rates to compare, in percent. */
  compareRates?: readonly number[];
}

export interface SipYearRow {
  year: number;
  monthlyContribution: number;
  invested: number;
  value: number;
  realValue: number;
}

export interface SipComparison {
  rate: number;
  corpus: number;
}

export interface SipResult {
  monthly: number;
  years: number;
  annualReturn: number;
  stepUpPercent: number;
  inflationPercent: number;
  schedule: SipYearRow[];
  invested: number;
  returns: number;
  corpus: number;
  realCorpus: number;
  comparison: SipComparison[];
}

function futureValue(monthly: number, annualRate: number, years: number, stepUpPercent: number): number {
  const monthlyRate = annualRate / 1200;
  let contribution = monthly;
  let corpus = 0;
  for (let year = 1; year <= years; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      corpus = (corpus + contribution) * (1 + monthlyRate);
    }
    contribution *= 1 + stepUpPercent / 100;
  }
  return corpus;
}

/**
 * Projects a systematic investment plan with monthly compounding and
 * contributions at the start of each month. Step-up is applied once per year.
 * All figures are hypothetical and depend entirely on the selected return.
 */
export function projectSip(input: SipInput): SipResult {
  const monthly = round2(asPositive(input.monthly, "Monthly investment"));
  const years = asIntegerInRange(input.years, 1, 60, "Investment years");
  const annualReturn = asPercentage(input.annualReturn, "Expected annual return");
  const stepUpPercent = asPercentage(input.stepUpPercent ?? 0, "Annual step-up");
  const inflationPercent = asPercentage(input.inflationPercent ?? 0, "Inflation");
  const compareRates = (input.compareRates ?? []).map((rate, index) =>
    asPercentage(asFiniteNumber(rate, `Comparison rate ${index + 1}`), `Comparison rate ${index + 1}`)
  );

  const monthlyRate = annualReturn / 1200;
  const inflationFactor = Math.pow(1 + inflationPercent / 100, 1);
  let contribution = monthly;
  let invested = 0;
  let corpus = 0;
  const schedule: SipYearRow[] = [];

  for (let year = 1; year <= years; year += 1) {
    const openingContribution = contribution;
    for (let month = 0; month < 12; month += 1) {
      corpus = (corpus + contribution) * (1 + monthlyRate);
      invested += contribution;
    }
    schedule.push({
      year,
      monthlyContribution: round2(openingContribution),
      invested: round2(invested),
      value: round2(corpus),
      realValue: round2(corpus / Math.pow(inflationFactor, year)),
    });
    contribution *= 1 + stepUpPercent / 100;
  }

  const roundedCorpus = round2(corpus);
  const roundedInvested = round2(invested);
  const comparison = compareRates.map(rate => ({
    rate,
    corpus: round2(futureValue(monthly, rate, years, stepUpPercent)),
  }));

  return {
    monthly,
    years,
    annualReturn,
    stepUpPercent,
    inflationPercent,
    schedule,
    invested: roundedInvested,
    returns: round2(roundedCorpus - roundedInvested),
    corpus: roundedCorpus,
    realCorpus: round2(corpus / Math.pow(1 + inflationPercent / 100, years)),
    comparison,
  };
}
