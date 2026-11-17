import { asNonNegative, asPercentage, round2 } from "./money";

export type GstMode = "exclusive" | "inclusive";
export type GstSupply = "intra" | "inter";

export interface GstInput {
  /** Amount as entered: taxable value for exclusive mode, gross value for inclusive mode. */
  amount: number;
  /** GST rate in percent. */
  rate: number;
  mode: GstMode;
  supply: GstSupply;
}

export interface GstBreakdown {
  amount: number;
  rate: number;
  mode: GstMode;
  supply: GstSupply;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
}

export interface GstLineInput {
  description?: string;
  amount: number;
  rate: number;
}

export interface GstLineBreakdown extends GstBreakdown {
  description: string;
}

export interface GstLinesResult {
  lines: GstLineBreakdown[];
  totals: Omit<GstBreakdown, "amount" | "rate" | "mode" | "supply">;
}

function assertMode(value: string): GstMode {
  if (value !== "exclusive" && value !== "inclusive") {
    throw new Error('GST mode must be "exclusive" or "inclusive".');
  }
  return value;
}

function assertSupply(value: string): GstSupply {
  if (value !== "intra" && value !== "inter") {
    throw new Error('Supply type must be "intra" or "inter".');
  }
  return value;
}

function splitTax(tax: number, supply: GstSupply): Pick<GstBreakdown, "cgst" | "sgst" | "igst"> {
  if (supply === "inter") return { cgst: 0, sgst: 0, igst: tax };
  const cgst = round2(tax / 2);
  return { cgst, sgst: round2(tax - cgst), igst: 0 };
}

/**
 * Splits a GST amount into taxable value, central/state or integrated tax.
 * Inclusive mode works backwards from the gross amount, so the returned total
 * always equals the entered amount.
 */
export function calculateGst(input: GstInput): GstBreakdown {
  const amount = round2(asNonNegative(input.amount, "Amount"));
  const rate = asPercentage(input.rate, "GST rate");
  const mode = assertMode(input.mode);
  const supply = assertSupply(input.supply);

  const taxableValue = mode === "inclusive"
    ? rate === 0 ? amount : round2(amount / (1 + rate / 100))
    : amount;
  const totalTax = mode === "inclusive"
    ? round2(amount - taxableValue)
    : round2((taxableValue * rate) / 100);
  const split = splitTax(totalTax, supply);
  const total = mode === "inclusive" ? amount : round2(taxableValue + totalTax);

  return {
    amount,
    rate,
    mode,
    supply,
    taxableValue,
    ...split,
    totalTax: round2(split.cgst + split.sgst + split.igst),
    total,
  };
}

/** Applies the same supply and mode to a list of invoice lines and sums the columns. */
export function calculateGstLines(
  lines: readonly GstLineInput[],
  supply: GstSupply,
  mode: GstMode = "exclusive"
): GstLinesResult {
  const validatedSupply = assertSupply(supply);
  const validatedMode = assertMode(mode);
  const breakdowns: GstLineBreakdown[] = lines.map((line, index) => ({
    ...calculateGst({
      amount: line.amount,
      rate: line.rate,
      mode: validatedMode,
      supply: validatedSupply,
    }),
    description: line.description?.trim() || `Line ${index + 1}`,
  }));

  const totals = breakdowns.reduce(
    (sum, line) => ({
      taxableValue: round2(sum.taxableValue + line.taxableValue),
      cgst: round2(sum.cgst + line.cgst),
      sgst: round2(sum.sgst + line.sgst),
      igst: round2(sum.igst + line.igst),
      totalTax: round2(sum.totalTax + line.totalTax),
      total: round2(sum.total + line.total),
    }),
    { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, total: 0 }
  );

  return { lines: breakdowns, totals };
}
