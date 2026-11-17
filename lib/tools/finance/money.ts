/** Shared money and input guards for the finance calculators. */

export const FINANCE_MAX_PRINCIPAL = 1_000_000_000_000;
export const FINANCE_MAX_MONTHS = 1_200;

/** Rounds to paise using decimal-safe half-up behaviour. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

export function asNonNegative(value: unknown, label: string, max = FINANCE_MAX_PRINCIPAL): number {
  const number = asFiniteNumber(value, label);
  if (number < 0) throw new Error(`${label} cannot be negative.`);
  if (number > max) throw new Error(`${label} must be at most ${max}.`);
  return number;
}

export function asPositive(value: unknown, label: string, max = FINANCE_MAX_PRINCIPAL): number {
  const number = asFiniteNumber(value, label);
  if (number <= 0) throw new Error(`${label} must be greater than zero.`);
  if (number > max) throw new Error(`${label} must be at most ${max}.`);
  return number;
}

export function asIntegerInRange(value: unknown, min: number, max: number, label: string): number {
  const number = asFiniteNumber(value, label);
  if (!Number.isInteger(number)) throw new Error(`${label} must be a whole number.`);
  if (number < min || number > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return number;
}

export function asMonths(value: unknown, label = "Tenure"): number {
  return asIntegerInRange(value, 1, FINANCE_MAX_MONTHS, label);
}

export function asPercentage(value: unknown, label: string): number {
  const number = asFiniteNumber(value, label);
  if (number < 0 || number > 100) throw new Error(`${label} must be between 0% and 100%.`);
  return number;
}
