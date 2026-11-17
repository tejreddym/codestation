import { localDefinition, type LocalDefinition, type LocalField } from "./local-contract";

export const FINANCE_CATEGORY = "Finance & Calculators";

export const financeToolIds = [
  "emi-calculator",
  "loan-prepayment-calculator",
  "gst-calculator",
  "sip-calculator",
] as const;

export type FinanceToolId = (typeof financeToolIds)[number];

type FinanceMetadata = {
  description: string;
  keywords: string[];
  relatedTools: string[];
  seo: { title: string; description: string };
  notices: string[];
  action: string;
};

const define = (
  id: FinanceToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown>,
  metadata: FinanceMetadata
): LocalDefinition<FinanceToolId> => {
  const base = localDefinition(
    id,
    title,
    FINANCE_CATEGORY,
    fields,
    outputs,
    defaults,
    metadata.notices,
    metadata.action
  );
  return {
    ...base,
    description: metadata.description,
    keywords: [...new Set([...base.keywords, ...metadata.keywords])],
    relatedTools: metadata.relatedTools,
    seo: metadata.seo,
    localContract: { ...base.localContract, purpose: metadata.description },
  };
};

const privacyNotice =
  "Nothing leaves your browser: amounts, rates, and results are calculated in memory and are never uploaded, logged, or stored.";

export const financeTools: readonly LocalDefinition<FinanceToolId>[] = [
  define(
    "emi-calculator",
    "EMI Calculator",
    [
      { name: "principal", label: "Loan amount (INR)", control: "number", min: 1 },
      { name: "annualRate", label: "Annual interest rate (%)", control: "number", min: 0 },
      { name: "tenure", label: "Loan tenure", control: "number", min: 1 },
      { name: "tenureUnit", label: "Tenure unit", control: "select", options: ["Years", "Months"] },
      { name: "processingFee", label: "Processing fee (optional)", control: "number", min: 0, optional: true },
    ],
    ["Monthly EMI", "Total interest", "Total payment", "Reducing-balance amortization schedule"],
    { principal: 1_000_000, annualRate: 8.5, tenure: 20, tenureUnit: "Years", processingFee: 0 },
    {
      description:
        "Calculate the reducing-balance EMI for a loan from principal, annual rate, and tenure, with a month-by-month amortization schedule that never leaves your browser.",
      keywords: [
        "emi calculator",
        "home loan emi",
        "loan emi",
        "amortization schedule",
        "monthly instalment",
        "interest calculator",
        "reducing balance",
        "processing fee",
        "car loan emi",
        "personal loan emi",
        "inr loan",
      ],
      relatedTools: ["loan-prepayment-calculator", "sip-calculator", "business-days-calculator"],
      seo: {
        title: "EMI Calculator (INR) — Home Loan EMI & Amortization Schedule",
        description:
          "Estimate the monthly EMI, total interest, and a full reducing-balance amortization schedule for Indian home, car, or personal loans. All calculations run locally in INR.",
      },
      notices: [
        "Estimate only — not financial advice. Actual EMI, charges, and amortization vary by lender and rounding method.",
        "Rates and tenure are user-selected; confirm the current rate, fees, and repayment terms with your lender.",
        privacyNotice,
      ],
      action: "Calculate EMI",
    }
  ),
  define(
    "loan-prepayment-calculator",
    "Loan Prepayment Calculator",
    [
      { name: "principal", label: "Outstanding principal (INR)", control: "number", min: 1 },
      { name: "annualRate", label: "Annual interest rate (%)", control: "number", min: 0 },
      { name: "months", label: "Remaining months", control: "number", min: 1, max: 1200 },
      { name: "emi", label: "Current EMI (optional)", control: "number", min: 0, optional: true },
      { name: "oneTime", label: "One-time prepayment (INR)", control: "number", min: 0, optional: true },
      { name: "extraMonthly", label: "Extra monthly payment (INR)", control: "number", min: 0, optional: true },
      { name: "chargePercent", label: "Prepayment charge (%)", control: "number", min: 0, max: 100, optional: true },
      { name: "strategy", label: "Strategy", control: "select", options: ["Reduce tenure", "Reduce EMI"] },
    ],
    [
      "Interest saved",
      "Months saved",
      "New payoff point",
      "Baseline vs scenario totals",
      "Month-by-month comparison",
    ],
    {
      principal: 1_000_000,
      annualRate: 9,
      months: 240,
      emi: "",
      oneTime: 100_000,
      extraMonthly: 5_000,
      chargePercent: 1,
      strategy: "Reduce tenure",
    },
    {
      description:
        "Compare a loan's remaining schedule with one-time and recurring extra payments, reducing either tenure or EMI entirely in your browser.",
      keywords: [
        "loan prepayment calculator",
        "part payment",
        "extra emi",
        "reduce tenure",
        "reduce emi",
        "home loan prepayment",
        "interest saved",
        "amortization",
        "foreclosure",
        "monthly prepayment",
      ],
      relatedTools: ["emi-calculator", "sip-calculator", "business-days-calculator"],
      seo: {
        title: "Loan Prepayment Calculator — Extra EMI & Interest Savings (INR)",
        description:
          "See how a lump sum or extra monthly payment changes payoff time, EMI, and interest for an Indian loan. Compare reduce-tenure and reduce-EMI strategies locally in INR.",
      },
      notices: [
        "Estimate only — not financial advice. Lenders may apply different prepayment rules, charges, or reset dates.",
        "The charge is an optional percentage of the one-time prepayment; rates, charges, and the current EMI are user-selected.",
        privacyNotice,
      ],
      action: "Compare prepayment",
    }
  ),
  define(
    "gst-calculator",
    "GST Calculator (India)",
    [
      { name: "amount", label: "Amount (INR)", control: "number", min: 0 },
      { name: "rate", label: "GST rate (%)", control: "number", min: 0, max: 100 },
      { name: "mode", label: "Amount type", control: "select", options: ["Exclusive of GST", "Inclusive of GST"] },
      { name: "supply", label: "Supply type", control: "select", options: ["Intra-state (CGST + SGST)", "Inter-state (IGST)"] },
    ],
    ["Taxable value", "CGST", "SGST", "IGST", "Total tax", "Total payable"],
    { amount: 1_000, rate: 18, mode: "Exclusive of GST", supply: "Intra-state (CGST + SGST)" },
    {
      description:
        "Split exclusive or inclusive GST into taxable value, CGST, SGST, or IGST for Indian invoices, calculated locally in your browser.",
      keywords: [
        "gst calculator",
        "gst inclusive",
        "gst exclusive",
        "cgst sgst",
        "igst",
        "india gst",
        "reverse gst",
        "gst rate",
        "invoice tax",
        "tax calculator",
      ],
      relatedTools: ["emi-calculator", "sip-calculator"],
      seo: {
        title: "GST Calculator India — Inclusive & Exclusive CGST, SGST, IGST",
        description:
          "Calculate GST in India for inclusive or exclusive prices, split CGST and SGST or IGST, and total invoice lines. Rates are user-selected and all processing stays local.",
      },
      notices: [
        "Estimate only — not tax advice. GST rates and place-of-supply rules are user-selected and must be verified for your invoice.",
        "Rate presets are examples as of November 2026; confirm the current notified rate before filing or issuing an invoice.",
        privacyNotice,
      ],
      action: "Calculate GST",
    }
  ),
  define(
    "sip-calculator",
    "SIP Calculator",
    [
      { name: "monthly", label: "Monthly investment (INR)", control: "number", min: 1 },
      { name: "years", label: "Investment period (years)", control: "number", min: 1, max: 60 },
      { name: "annualReturn", label: "Expected annual return (%)", control: "number", min: 0, max: 100 },
      { name: "stepUpPercent", label: "Annual step-up (%)", control: "number", min: 0, max: 100, optional: true },
      { name: "inflationPercent", label: "Inflation (%)", control: "number", min: 0, max: 100, optional: true },
      { name: "compareRates", label: "Comparison rates (comma-separated %)", control: "text", optional: true },
    ],
    [
      "Total invested",
      "Estimated returns",
      "Projected corpus",
      "Inflation-adjusted corpus",
      "Year-by-year projection",
      "Comparison corpora",
    ],
    {
      monthly: 10_000,
      years: 10,
      annualReturn: 12,
      stepUpPercent: 0,
      inflationPercent: 6,
      compareRates: "10, 12",
    },
    {
      description:
        "Project a monthly SIP with optional annual step-up and inflation adjustment, compounding entirely in your browser.",
      keywords: [
        "sip calculator",
        "systematic investment plan",
        "step-up sip",
        "mutual fund returns",
        "inflation adjusted",
        "investment calculator",
        "monthly investment",
        "sip corpus",
        "compounding",
        "wealth projection",
      ],
      relatedTools: ["emi-calculator", "loan-prepayment-calculator", "business-days-calculator"],
      seo: {
        title: "SIP Calculator — Step-Up SIP Returns & Corpus Projection (INR)",
        description:
          "Project a monthly SIP in INR with annual step-up, inflation-adjusted value, and comparison return rates. Hypothetical returns are calculated locally in your browser.",
      },
      notices: [
        "Hypothetical projection only — not investment advice. Returns are not guaranteed and do not represent any specific fund.",
        "Assumes a constant user-selected return, monthly compounding, and contributions at the start of each month.",
        privacyNotice,
      ],
      action: "Project SIP",
    }
  ),
];

export const getFinanceDefinition = (id: string) => financeTools.find(tool => tool.id === id);
export const isFinanceToolId = (id: string): id is FinanceToolId =>
  (financeToolIds as readonly string[]).includes(id);
