import { asMonths, asNonNegative, asPercentage, asPositive, round2 } from "./money";
import { reducingBalanceEmi } from "./emi";

export type PrepaymentStrategy = "reduce-tenure" | "reduce-emi";

export interface PrepaymentInput {
  /** Outstanding principal. */
  principal: number;
  annualRate: number;
  /** Remaining scheduled months. */
  months: number;
  /** Current EMI. When omitted, the standard EMI for the remaining term is used. */
  emi?: number;
  /** One-time lump sum applied before the first instalment. */
  oneTime?: number;
  /** Recurring extra amount added to every monthly instalment. */
  extraMonthly?: number;
  /** Processing charge on the one-time prepayment, in percent. */
  chargePercent?: number;
  strategy: PrepaymentStrategy;
}

export interface PrepaymentRow {
  month: number;
  opening: number;
  interest: number;
  scheduledPrincipal: number;
  extraPrincipal: number;
  payment: number;
  closing: number;
}

export interface PrepaymentSummary {
  emi: number;
  months: number;
  totalInterest: number;
  totalPayment: number;
  oneTimeApplied: number;
  charge: number;
  totalOutflow: number;
}

export interface PrepaymentComparisonRow {
  month: number;
  baselinePayment: number;
  baselineInterest: number;
  baselineClosing: number;
  scenarioPayment: number;
  scenarioInterest: number;
  scenarioClosing: number;
}

export interface PrepaymentResult {
  baseline: PrepaymentSummary;
  scenario: PrepaymentSummary;
  interestSaved: number;
  monthsSaved: number;
  payoffMonth: number;
  charge: number;
  noChange: boolean;
  comparison: PrepaymentComparisonRow[];
}

const MAX_SIMULATION_MONTHS = 1_200;

function assertStrategy(value: string): PrepaymentStrategy {
  if (value !== "reduce-tenure" && value !== "reduce-emi") {
    throw new Error('Strategy must be "reduce-tenure" or "reduce-emi".');
  }
  return value;
}

function amortize(
  opening: number,
  annualRate: number,
  emi: number,
  extraMonthly: number,
  absorbAtMonth?: number
): { rows: PrepaymentRow[]; totalInterest: number; totalPayment: number; months: number } {
  const monthlyRate = annualRate / 1200;
  let balance = round2(opening);
  let totalInterest = 0;
  let totalPayment = 0;
  const rows: PrepaymentRow[] = [];

  for (let month = 1; month <= MAX_SIMULATION_MONTHS && balance > 0; month += 1) {
    const openingBalance = balance;
    const interest = round2(openingBalance * monthlyRate);
    const isAbsorbing = absorbAtMonth !== undefined && month === absorbAtMonth;
    let scheduledPrincipal = isAbsorbing ? openingBalance : round2(emi - interest);

    if (!isAbsorbing && scheduledPrincipal <= 0) {
      throw new Error(
        `The EMI of ${emi.toFixed(2)} does not cover the monthly interest at instalment ${month}. Check the EMI and rate.`
      );
    }
    if (scheduledPrincipal > openingBalance) scheduledPrincipal = openingBalance;

    const extraPrincipal = Math.min(openingBalance - scheduledPrincipal, round2(extraMonthly));
    const principalPaid = round2(scheduledPrincipal + extraPrincipal);
    const payment = round2(interest + principalPaid);
    const closing = round2(openingBalance - principalPaid);

    rows.push({
      month,
      opening: openingBalance,
      interest,
      scheduledPrincipal,
      extraPrincipal,
      payment,
      closing,
    });
    totalInterest = round2(totalInterest + interest);
    totalPayment = round2(totalPayment + payment);
    balance = closing;
  }

  if (balance > 0.005) {
    throw new Error("These payments do not repay the loan within 1,200 months. Increase the EMI or the prepayment.");
  }

  return { rows, totalInterest, totalPayment, months: rows.length };
}

function summarise(
  emi: number,
  rows: PrepaymentRow[],
  totalInterest: number,
  totalPayment: number,
  oneTimeApplied: number,
  charge: number
): PrepaymentSummary {
  return {
    emi,
    months: rows.length,
    totalInterest,
    totalPayment,
    oneTimeApplied,
    charge,
    totalOutflow: round2(totalPayment + oneTimeApplied + charge),
  };
}

function compareRows(baseline: PrepaymentRow[], scenario: PrepaymentRow[]): PrepaymentComparisonRow[] {
  const length = Math.max(baseline.length, scenario.length);
  const rows: PrepaymentComparisonRow[] = [];
  for (let index = 0; index < length; index += 1) {
    const baselineRow = baseline[index];
    const scenarioRow = scenario[index];
    rows.push({
      month: index + 1,
      baselinePayment: baselineRow?.payment ?? 0,
      baselineInterest: baselineRow?.interest ?? 0,
      baselineClosing: baselineRow?.closing ?? 0,
      scenarioPayment: scenarioRow?.payment ?? 0,
      scenarioInterest: scenarioRow?.interest ?? 0,
      scenarioClosing: scenarioRow?.closing ?? 0,
    });
  }
  return rows;
}

/**
 * Compares the remaining loan schedule with one extra-payment scenario.
 *
 * Assumptions: nominal annual rate divided by twelve; each month's interest is
 * charged on the opening balance; the one-time payment is applied before the
 * first instalment and capped at the outstanding balance; the optional charge
 * is a percentage of the applied one-time amount. `reduce-tenure` keeps the
 * current EMI, while `reduce-emi` recalculates the EMI on the reduced balance
 * over the remaining months. Recurring extra amounts are paid every month and
 * can pay the loan off early.
 */
export function comparePrepayment(input: PrepaymentInput): PrepaymentResult {
  const principal = round2(asPositive(input.principal, "Outstanding principal"));
  const annualRate = asNonNegative(input.annualRate, "Annual interest rate");
  const months = asMonths(input.months, "Remaining months");
  const strategy = assertStrategy(input.strategy);
  const extraMonthly = round2(asNonNegative(input.extraMonthly ?? 0, "Extra monthly payment"));
  const oneTime = round2(asNonNegative(input.oneTime ?? 0, "One-time prepayment"));
  const chargePercent = asPercentage(input.chargePercent ?? 0, "Prepayment charge");

  const derivedEmi = input.emi === undefined;
  const providedEmi = derivedEmi ? undefined : round2(asPositive(input.emi, "Current EMI"));
  const baselineEmi = providedEmi ?? round2(reducingBalanceEmi(principal, annualRate, months));

  if (!Number.isFinite(baselineEmi) || baselineEmi <= 0) {
    throw new Error("The rate and tenure produce an EMI that cannot be represented. Check the inputs.");
  }

  const baselineRun = amortize(principal, annualRate, baselineEmi, 0, derivedEmi ? months : undefined);
  const baseline = summarise(
    baselineEmi,
    baselineRun.rows,
    baselineRun.totalInterest,
    baselineRun.totalPayment,
    0,
    0
  );

  const oneTimeApplied = Math.min(principal, oneTime);
  const charge = round2((oneTimeApplied * chargePercent) / 100);
  const noChange = oneTimeApplied === 0 && extraMonthly === 0;

  if (noChange) {
    const scenario = { ...baseline, oneTimeApplied: 0, charge: 0, totalOutflow: baseline.totalPayment };
    return {
      baseline,
      scenario,
      interestSaved: 0,
      monthsSaved: 0,
      payoffMonth: baseline.months,
      charge: 0,
      noChange: true,
      comparison: compareRows(baselineRun.rows, baselineRun.rows),
    };
  }

  const scenarioOpening = round2(principal - oneTimeApplied);
  const scenarioEmi = strategy === "reduce-tenure"
    ? baselineEmi
    : scenarioOpening > 0
      ? round2(reducingBalanceEmi(scenarioOpening, annualRate, months))
      : 0;

  const scenarioRun = scenarioOpening > 0
    ? amortize(scenarioOpening, annualRate, scenarioEmi, extraMonthly, strategy === "reduce-emi" ? months : baseline.months)
    : { rows: [], totalInterest: 0, totalPayment: 0, months: 0 };

  const scenario = summarise(
    scenarioEmi,
    scenarioRun.rows,
    scenarioRun.totalInterest,
    scenarioRun.totalPayment,
    oneTimeApplied,
    charge
  );

  return {
    baseline,
    scenario,
    interestSaved: round2(baseline.totalInterest - scenario.totalInterest),
    monthsSaved: Math.max(0, baseline.months - scenario.months),
    payoffMonth: scenario.months,
    charge,
    noChange: false,
    comparison: compareRows(baselineRun.rows, scenarioRun.rows),
  };
}
