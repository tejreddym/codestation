import { asMonths, asNonNegative, asPositive, round2 } from "./money";

export interface EmiInput {
  /** Loan amount in the calculator currency. */
  principal: number;
  /** Nominal annual interest rate, in percent. */
  annualRate: number;
  /** Number of monthly instalments. */
  months: number;
  /** Optional one-time processing fee, excluded from the EMI itself. */
  processingFee?: number;
}

export interface EmiScheduleRow {
  month: number;
  opening: number;
  interest: number;
  principal: number;
  closing: number;
}

export interface EmiResult {
  principal: number;
  annualRate: number;
  months: number;
  processingFee: number;
  emi: number;
  totalInterest: number;
  totalPayment: number;
  totalWithFee: number;
  schedule: EmiScheduleRow[];
}

/** Standard reducing-balance EMI for a nominal annual rate. */
export function reducingBalanceEmi(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return principal / months;
  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

/**
 * Calculates an equated monthly instalment and a reducing-balance schedule.
 * The EMI is rounded to paise; the final instalment absorbs the rounding
 * residual so the closing balance reaches exactly zero.
 */
export function calculateEmi(input: EmiInput): EmiResult {
  const principal = round2(asPositive(input.principal, "Loan amount"));
  const annualRate = asNonNegative(input.annualRate, "Annual interest rate");
  const months = asMonths(input.months, "Tenure in months");
  const processingFee = round2(asNonNegative(input.processingFee ?? 0, "Processing fee"));

  if (principal <= 0) throw new Error("Loan amount must be greater than zero after rounding to paise.");

  const rawEmi = reducingBalanceEmi(principal, annualRate, months);
  const emi = round2(rawEmi);
  if (!Number.isFinite(emi) || emi <= 0) {
    throw new Error("The rate and tenure produce an EMI that cannot be represented. Check the inputs.");
  }

  const monthlyRate = annualRate / 1200;
  const schedule: EmiScheduleRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPayment = 0;

  for (let month = 1; month <= months && balance > 0; month += 1) {
    const opening = balance;
    const interest = round2(opening * monthlyRate);
    const isFinal = month === months;
    let principalPaid = isFinal ? opening : round2(emi - interest);

    if (!isFinal && principalPaid <= 0) {
      throw new Error("The monthly interest exceeds the EMI. Increase the tenure or lower the rate.");
    }
    if (principalPaid > opening) principalPaid = opening;

    const payment = round2(interest + principalPaid);
    const closing = round2(opening - principalPaid);
    schedule.push({ month, opening, interest, principal: principalPaid, closing });
    totalInterest = round2(totalInterest + interest);
    totalPayment = round2(totalPayment + payment);
    balance = closing;
  }

  return {
    principal,
    annualRate,
    months,
    processingFee,
    emi,
    totalInterest,
    totalPayment,
    totalWithFee: round2(totalPayment + processingFee),
    schedule,
  };
}
