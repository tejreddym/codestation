"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { getFinanceDefinition, type FinanceToolId } from "@/config/finance-tools";
import { calculateEmi, type EmiResult } from "@/lib/tools/finance/emi";
import {
  comparePrepayment,
  type PrepaymentResult,
  type PrepaymentStrategy,
} from "@/lib/tools/finance/prepayment";
import {
  calculateGst,
  calculateGstLines,
  type GstBreakdown,
  type GstLinesResult,
  type GstMode,
  type GstSupply,
} from "@/lib/tools/finance/gst";
import { projectSip, type SipResult } from "@/lib/tools/finance/sip";
import { FINANCE_MAX_PRINCIPAL } from "@/lib/tools/finance/money";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Callout";
import { DataTable } from "./ui/DataTable";
import { EmptyState } from "./ui/EmptyState";
import { Field } from "./ui/Field";
import { OutputPanel } from "./ui/OutputPanel";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import { Checkbox, RadioGroup, Select, TextInput } from "./ui/controls";
import { useCopy } from "./ui/useCopy";
import { downloadBlob } from "./ui/useDownload";
import ui from "./ui/ui.module.css";
import styles from "./FinanceStation.module.css";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatInr = (value: number) => inrFormatter.format(value);
const formatPlain = (value: number) => plainFormatter.format(value);

type NumberRules = { min?: number; max?: number; optional?: boolean };

function parseNumber(value: string, label: string, rules: NumberRules = {}): number | undefined {
  const raw = value.trim();
  if (!raw) {
    if (rules.optional) return undefined;
    throw new Error(`${label} is required.`);
  }
  const number = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  if (rules.min !== undefined && number < rules.min) throw new Error(`${label} must be at least ${rules.min}.`);
  if (rules.max !== undefined && number > rules.max) throw new Error(`${label} must be ${rules.max} or less.`);
  return number;
}

function parseRate(value: string, label: string): number {
  const rate = parseNumber(value, label, { min: 0, max: 100 });
  return rate as number;
}

function tenureText(months: number): string {
  if (months === 0) return "Immediately";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  const parts = [years ? `${years} yr` : "", remainder ? `${remainder} mo` : ""].filter(Boolean);
  return `${months} instalment${months === 1 ? "" : "s"}${parts.length ? ` · ${parts.join(" ")}` : ""}`;
}

function csvText(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return rows
    .map(row =>
      row
        .map(cell => {
          const text = String(cell);
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(",")
    )
    .join("\n");
}

type Calc<T> = { result: T | null; errors: Record<string, string>; error: string };

function emptyCalc<T>(): Calc<T> {
  return { result: null, errors: {}, error: "" };
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Could not calculate a result. Check the inputs.";
}

function Metrics({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className={styles.metrics}>
      {items.map(item => (
        <div className={styles.metric} key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ EMI calculator ------------------------------ */

type EmiValues = {
  principal: string;
  annualRate: string;
  tenure: string;
  tenureUnit: "Years" | "Months";
  processingFee: string;
};

const emiDefaults: EmiValues = {
  principal: "1000000",
  annualRate: "8.5",
  tenure: "20",
  tenureUnit: "Years",
  processingFee: "0",
};

function EmiTool() {
  const id = "finance-emi";
  const [values, setValues] = useState<EmiValues>(emiDefaults);
  const [calculated, setCalculated] = useState(false);
  const { copy, message, setMessage } = useCopy();

  const calculation = useMemo<Calc<EmiResult>>(() => {
    if (!calculated) return emptyCalc<EmiResult>();
    const errors: Record<string, string> = {};
    const read = (key: keyof EmiValues, label: string, rules?: NumberRules) => {
      try {
        return parseNumber(values[key], label, rules);
      } catch (cause) {
        errors[key] = messageOf(cause);
        return undefined;
      }
    };

    const principal = read("principal", "Loan amount", { min: 1, max: FINANCE_MAX_PRINCIPAL });
    const annualRate = read("annualRate", "Annual interest rate", { min: 0, max: 100 });
    const tenure = read("tenure", "Loan tenure", { min: 0.01, max: 1200 });
    const processingFee = read("processingFee", "Processing fee", { min: 0, max: FINANCE_MAX_PRINCIPAL, optional: true });

    let months = values.tenureUnit === "Years" ? (tenure ?? 0) * 12 : tenure ?? 0;
    if (tenure !== undefined && values.tenureUnit === "Years") months = Math.round(months * 1e6) / 1e6;
    if (tenure !== undefined && (!Number.isInteger(months) || months < 1 || months > 1200)) {
      errors.tenure = "Tenure must equal between 1 and 1,200 whole months.";
    }
    if (Object.keys(errors).length) return { ...emptyCalc<EmiResult>(), errors };

    try {
      return {
        ...emptyCalc<EmiResult>(),
        result: calculateEmi({
          principal: principal as number,
          annualRate: annualRate as number,
          months: months as number,
          processingFee: processingFee ?? 0,
        }),
      };
    } catch (cause) {
      return { ...emptyCalc<EmiResult>(), error: messageOf(cause) };
    }
  }, [values, calculated]);

  const result = calculation.result;
  const summary = result
    ? [
        `Monthly EMI: ${formatInr(result.emi)}`,
        `Loan amount: ${formatInr(result.principal)}`,
        `Annual interest rate: ${result.annualRate}%`,
        `Tenure: ${result.months} months`,
        `Total interest: ${formatInr(result.totalInterest)}`,
        `Total payment: ${formatInr(result.totalPayment)}`,
        `Processing fee: ${formatInr(result.processingFee)}`,
        `Total including fee: ${formatInr(result.totalWithFee)}`,
        "Assumption: reducing balance; monthly rate = annual rate ÷ 12; EMI rounded to paise; the final instalment absorbs the residual.",
      ].join("\n")
    : "";

  function update<K extends keyof EmiValues>(key: K, value: EmiValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setMessage("");
  }

  function reset() {
    setValues(emiDefaults);
    setCalculated(false);
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalculated(true);
  }

  function download() {
    if (!result) return;
    const rows: Array<Array<string | number>> = [
      ["Month", "Opening balance", "Interest", "Principal", "Closing balance"],
      ...result.schedule.map(row => [
        row.month,
        row.opening.toFixed(2),
        row.interest.toFixed(2),
        row.principal.toFixed(2),
        row.closing.toFixed(2),
      ]),
    ];
    downloadBlob(csvText(rows), "emi-amortization-schedule.csv", "text/csv;charset=utf-8");
    setMessage("Downloaded emi-amortization-schedule.csv.");
  }

  return (
    <div className={styles.station}>
      <PrivacyNote>
        Loan amounts, rates, and results stay in this page. The EMI and schedule are estimates; your lender may
        round differently or charge additional fees.
      </PrivacyNote>
      <ToolLayout kind="form">
        <Panel title="Loan details" headingId={`${id}-form`} padded>
          <form className={styles.formBody} onSubmit={submit} noValidate>
            <div className={styles.fieldGrid}>
              <Field id={`${id}-principal`} label="Loan amount (INR)" error={calculation.errors.principal}>
                <TextInput
                  id={`${id}-principal`}
                  name="principal"
                  type="number"
                  min="1"
                  max={FINANCE_MAX_PRINCIPAL}
                  step="1000"
                  inputMode="decimal"
                  value={values.principal}
                  aria-invalid={calculation.errors.principal ? true : undefined}
                  aria-describedby={calculation.errors.principal ? `${id}-principal-error` : undefined}
                  onChange={event => update("principal", event.target.value)}
                />
              </Field>
              <Field id={`${id}-annualRate`} label="Annual interest rate (%)" error={calculation.errors.annualRate}>
                <TextInput
                  id={`${id}-annualRate`}
                  name="annualRate"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={values.annualRate}
                  aria-invalid={calculation.errors.annualRate ? true : undefined}
                  aria-describedby={calculation.errors.annualRate ? `${id}-annualRate-error` : undefined}
                  onChange={event => update("annualRate", event.target.value)}
                />
              </Field>
              <Field id={`${id}-tenure`} label="Loan tenure" error={calculation.errors.tenure}>
                <TextInput
                  id={`${id}-tenure`}
                  name="tenure"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="decimal"
                  value={values.tenure}
                  aria-invalid={calculation.errors.tenure ? true : undefined}
                  aria-describedby={calculation.errors.tenure ? `${id}-tenure-error` : undefined}
                  onChange={event => update("tenure", event.target.value)}
                />
              </Field>
              <Field id={`${id}-tenureUnit`} label="Tenure unit">
                <Select
                  id={`${id}-tenureUnit`}
                  name="tenureUnit"
                  value={values.tenureUnit}
                  onChange={event => update("tenureUnit", event.target.value as EmiValues["tenureUnit"])}
                >
                  <option value="Years">Years</option>
                  <option value="Months">Months</option>
                </Select>
              </Field>
              <Field
                id={`${id}-processingFee`}
                label="Processing fee (optional)"
                error={calculation.errors.processingFee}
              >
                <TextInput
                  id={`${id}-processingFee`}
                  name="processingFee"
                  type="number"
                  min="0"
                  max={FINANCE_MAX_PRINCIPAL}
                  step="100"
                  inputMode="decimal"
                  value={values.processingFee}
                  aria-invalid={calculation.errors.processingFee ? true : undefined}
                  aria-describedby={calculation.errors.processingFee ? `${id}-processingFee-error` : undefined}
                  onChange={event => update("processingFee", event.target.value)}
                />
              </Field>
            </div>
            <div className={styles.formActions}>
              <Button variant="primary" type="submit">Calculate EMI</Button>
              <Button type="button" onClick={reset}>Reset</Button>
            </div>
          </form>
        </Panel>
        <OutputPanel
          title="Results"
          headingId={`${id}-results`}
          label="EMI result"
          onCopy={() => void copy(summary)}
          onDownload={download}
          copyDisabled={!result}
          downloadDisabled={!result}
        >
          {result ? (
            <div className={styles.resultStack}>
              <Metrics
                items={[
                  { label: "Monthly EMI", value: formatInr(result.emi) },
                  { label: "Total interest", value: formatInr(result.totalInterest) },
                  { label: "Total payment", value: formatInr(result.totalPayment) },
                  { label: "Total including fee", value: formatInr(result.totalWithFee) },
                ]}
              />
              <p className={ui.hint}>
                Reducing balance, monthly rate = annual rate ÷ 12. The EMI is rounded to paise and the final
                instalment absorbs the residual so the closing balance reaches zero.
              </p>
              <DataTable
                caption="Reducing-balance amortization schedule"
                columns={["Month", "Opening", "Interest", "Principal", "Closing"]}
                rows={result.schedule.map(row => [
                  row.month,
                  formatPlain(row.opening),
                  formatPlain(row.interest),
                  formatPlain(row.principal),
                  formatPlain(row.closing),
                ])}
              />
            </div>
          ) : (
            <EmptyState>Enter the loan details and choose Calculate EMI to see the schedule.</EmptyState>
          )}
        </OutputPanel>
      </ToolLayout>
      {calculation.error ? <Callout kind="error">{calculation.error}</Callout> : null}
      {message ? <StatusLine>{message}</StatusLine> : null}
    </div>
  );
}

/* --------------------------- Prepayment calculator --------------------------- */

type PrepaymentValues = {
  principal: string;
  annualRate: string;
  months: string;
  emi: string;
  oneTime: string;
  extraMonthly: string;
  chargePercent: string;
  strategy: "Reduce tenure" | "Reduce EMI";
};

const prepaymentDefaults: PrepaymentValues = {
  principal: "1000000",
  annualRate: "9",
  months: "240",
  emi: "",
  oneTime: "100000",
  extraMonthly: "5000",
  chargePercent: "1",
  strategy: "Reduce tenure",
};

function PrepaymentTool() {
  const id = "finance-prepayment";
  const [values, setValues] = useState<PrepaymentValues>(prepaymentDefaults);
  const [calculated, setCalculated] = useState(false);
  const { copy, message, setMessage } = useCopy();

  const calculation = useMemo<Calc<PrepaymentResult>>(() => {
    if (!calculated) return emptyCalc<PrepaymentResult>();
    const errors: Record<string, string> = {};
    const read = (key: keyof PrepaymentValues, label: string, rules?: NumberRules) => {
      try {
        return parseNumber(values[key], label, rules);
      } catch (cause) {
        errors[key] = messageOf(cause);
        return undefined;
      }
    };

    const principal = read("principal", "Outstanding principal", { min: 1, max: FINANCE_MAX_PRINCIPAL });
    const annualRate = read("annualRate", "Annual interest rate", { min: 0, max: 100 });
    const months = read("months", "Remaining months", { min: 1, max: 1200 });
    if (months !== undefined && !Number.isInteger(months)) errors.months = "Remaining months must be a whole number.";
    const emi = read("emi", "Current EMI", { min: 0.01, max: FINANCE_MAX_PRINCIPAL, optional: true });
    const oneTime = read("oneTime", "One-time prepayment", { min: 0, max: FINANCE_MAX_PRINCIPAL, optional: true });
    const extraMonthly = read("extraMonthly", "Extra monthly payment", { min: 0, max: FINANCE_MAX_PRINCIPAL, optional: true });
    const chargePercent = read("chargePercent", "Prepayment charge", { min: 0, max: 100, optional: true });
    if (Object.keys(errors).length) return { ...emptyCalc<PrepaymentResult>(), errors };

    try {
      return {
        ...emptyCalc<PrepaymentResult>(),
        result: comparePrepayment({
          principal: principal as number,
          annualRate: annualRate as number,
          months: months as number,
          emi,
          oneTime: oneTime ?? 0,
          extraMonthly: extraMonthly ?? 0,
          chargePercent: chargePercent ?? 0,
          strategy: (values.strategy === "Reduce EMI" ? "reduce-emi" : "reduce-tenure") as PrepaymentStrategy,
        }),
      };
    } catch (cause) {
      return { ...emptyCalc<PrepaymentResult>(), error: messageOf(cause) };
    }
  }, [values, calculated]);

  const result = calculation.result;
  const summary = result
    ? [
        `Baseline: ${formatInr(result.baseline.emi)} EMI for ${result.baseline.months} instalments; interest ${formatInr(result.baseline.totalInterest)}.`,
        `Scenario: ${formatInr(result.scenario.emi)} EMI for ${result.scenario.months} instalments; interest ${formatInr(result.scenario.totalInterest)}.`,
        `Interest saved: ${formatInr(result.interestSaved)}`,
        `Months saved: ${result.monthsSaved}`,
        `Payoff: ${tenureText(result.payoffMonth)}`,
        `One-time prepayment: ${formatInr(result.scenario.oneTimeApplied)}`,
        `Prepayment charge: ${formatInr(result.charge)}`,
        `Scenario total outflow: ${formatInr(result.scenario.totalOutflow)}`,
        "Assumption: reducing balance; monthly rate = annual rate ÷ 12; the one-time amount is applied before the first instalment and capped at the balance; extra monthly payments are applied every month.",
      ].join("\n")
    : "";

  function update<K extends keyof PrepaymentValues>(key: K, value: PrepaymentValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setMessage("");
  }

  function reset() {
    setValues(prepaymentDefaults);
    setCalculated(false);
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalculated(true);
  }

  function download() {
    if (!result) return;
    const rows: Array<Array<string | number>> = [
      ["Month", "Baseline payment", "Baseline interest", "Baseline closing", "Scenario payment", "Scenario interest", "Scenario closing"],
      ...result.comparison.map(row => [
        row.month,
        row.baselinePayment.toFixed(2),
        row.baselineInterest.toFixed(2),
        row.baselineClosing.toFixed(2),
        row.scenarioPayment.toFixed(2),
        row.scenarioInterest.toFixed(2),
        row.scenarioClosing.toFixed(2),
      ]),
    ];
    downloadBlob(csvText(rows), "loan-prepayment-comparison.csv", "text/csv;charset=utf-8");
    setMessage("Downloaded loan-prepayment-comparison.csv.");
  }

  return (
    <div className={styles.station}>
      <PrivacyNote>
        Outstanding amounts, rates, and prepayment choices stay in this page. Lenders may use different reset
        dates, charges, or rounding, so treat the comparison as a planning estimate.
      </PrivacyNote>
      <ToolLayout kind="form">
        <Panel title="Loan and prepayment" headingId={`${id}-form`} padded>
          <form className={styles.formBody} onSubmit={submit} noValidate>
            <div className={styles.fieldGrid}>
              <Field id={`${id}-principal`} label="Outstanding principal (INR)" error={calculation.errors.principal}>
                <TextInput
                  id={`${id}-principal`}
                  name="principal"
                  type="number"
                  min="1"
                  max={FINANCE_MAX_PRINCIPAL}
                  step="1000"
                  inputMode="decimal"
                  value={values.principal}
                  aria-invalid={calculation.errors.principal ? true : undefined}
                  aria-describedby={calculation.errors.principal ? `${id}-principal-error` : undefined}
                  onChange={event => update("principal", event.target.value)}
                />
              </Field>
              <Field id={`${id}-annualRate`} label="Annual interest rate (%)" error={calculation.errors.annualRate}>
                <TextInput
                  id={`${id}-annualRate`}
                  name="annualRate"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={values.annualRate}
                  aria-invalid={calculation.errors.annualRate ? true : undefined}
                  aria-describedby={calculation.errors.annualRate ? `${id}-annualRate-error` : undefined}
                  onChange={event => update("annualRate", event.target.value)}
                />
              </Field>
              <Field id={`${id}-months`} label="Remaining months" error={calculation.errors.months}>
                <TextInput
                  id={`${id}-months`}
                  name="months"
                  type="number"
                  min="1"
                  max="1200"
                  step="1"
                  inputMode="numeric"
                  value={values.months}
                  aria-invalid={calculation.errors.months ? true : undefined}
                  aria-describedby={calculation.errors.months ? `${id}-months-error` : undefined}
                  onChange={event => update("months", event.target.value)}
                />
              </Field>
              <Field
                id={`${id}-emi`}
                label="Current EMI (optional)"
                hint="Leave blank to use the standard EMI for the remaining term."
                error={calculation.errors.emi}
              >
                <TextInput
                  id={`${id}-emi`}
                  name="emi"
                  type="number"
                  min="0"
                  max={FINANCE_MAX_PRINCIPAL}
                  step="0.01"
                  inputMode="decimal"
                  value={values.emi}
                  aria-invalid={calculation.errors.emi ? true : undefined}
                  aria-describedby={
                    [calculation.errors.emi ? `${id}-emi-error` : "", `${id}-emi-hint`].filter(Boolean).join(" ")
                  }
                  onChange={event => update("emi", event.target.value)}
                />
              </Field>
              <Field id={`${id}-oneTime`} label="One-time prepayment (INR)" error={calculation.errors.oneTime}>
                <TextInput
                  id={`${id}-oneTime`}
                  name="oneTime"
                  type="number"
                  min="0"
                  max={FINANCE_MAX_PRINCIPAL}
                  step="1000"
                  inputMode="decimal"
                  value={values.oneTime}
                  aria-invalid={calculation.errors.oneTime ? true : undefined}
                  aria-describedby={calculation.errors.oneTime ? `${id}-oneTime-error` : undefined}
                  onChange={event => update("oneTime", event.target.value)}
                />
              </Field>
              <Field id={`${id}-extraMonthly`} label="Extra monthly payment (INR)" error={calculation.errors.extraMonthly}>
                <TextInput
                  id={`${id}-extraMonthly`}
                  name="extraMonthly"
                  type="number"
                  min="0"
                  max={FINANCE_MAX_PRINCIPAL}
                  step="500"
                  inputMode="decimal"
                  value={values.extraMonthly}
                  aria-invalid={calculation.errors.extraMonthly ? true : undefined}
                  aria-describedby={calculation.errors.extraMonthly ? `${id}-extraMonthly-error` : undefined}
                  onChange={event => update("extraMonthly", event.target.value)}
                />
              </Field>
              <Field
                id={`${id}-chargePercent`}
                label="Prepayment charge (%)"
                hint="Applied to the one-time amount. Set 0 if your lender charges nothing."
                error={calculation.errors.chargePercent}
              >
                <TextInput
                  id={`${id}-chargePercent`}
                  name="chargePercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  value={values.chargePercent}
                  aria-invalid={calculation.errors.chargePercent ? true : undefined}
                  aria-describedby={
                    [calculation.errors.chargePercent ? `${id}-chargePercent-error` : "", `${id}-chargePercent-hint`]
                      .filter(Boolean)
                      .join(" ")
                  }
                  onChange={event => update("chargePercent", event.target.value)}
                />
              </Field>
            </div>
            <RadioGroup
              id={`${id}-strategy`}
              legend="Strategy"
              name="strategy"
              value={values.strategy}
              options={[
                { value: "Reduce tenure", label: "Reduce tenure — keep the EMI and finish earlier" },
                { value: "Reduce EMI", label: "Reduce EMI — recalculate the payment on the reduced balance" },
              ]}
              onChange={event => update("strategy", event.target.value as PrepaymentValues["strategy"])}
            />
            <div className={styles.formActions}>
              <Button variant="primary" type="submit">Compare prepayment</Button>
              <Button type="button" onClick={reset}>Reset</Button>
            </div>
          </form>
        </Panel>
        <OutputPanel
          title="Results"
          headingId={`${id}-results`}
          label="Prepayment comparison"
          onCopy={() => void copy(summary)}
          onDownload={download}
          copyDisabled={!result}
          downloadDisabled={!result}
        >
          {result ? (
            <div className={styles.resultStack}>
              <Metrics
                items={[
                  { label: "Interest saved", value: formatInr(result.interestSaved) },
                  { label: "Months saved", value: String(result.monthsSaved) },
                  { label: "New payoff", value: tenureText(result.payoffMonth) },
                  { label: "New EMI", value: result.scenario.emi > 0 ? formatInr(result.scenario.emi) : "—" },
                  { label: "Prepayment charge", value: formatInr(result.charge) },
                  { label: "Scenario outflow", value: formatInr(result.scenario.totalOutflow) },
                ]}
              />
              {result.noChange ? (
                <Callout kind="info">
                  No one-time or extra monthly amount is set, so the scenario matches the baseline.
                </Callout>
              ) : null}
              <DataTable
                caption="Baseline and prepayment scenario"
                columns={["Metric", "Baseline", "With prepayment"]}
                rows={[
                  ["EMI", formatInr(result.baseline.emi), result.scenario.emi > 0 ? formatInr(result.scenario.emi) : "—"],
                  ["Instalments", String(result.baseline.months), String(result.scenario.months)],
                  ["Total interest", formatInr(result.baseline.totalInterest), formatInr(result.scenario.totalInterest)],
                  ["Monthly payments", formatInr(result.baseline.totalPayment), formatInr(result.scenario.totalPayment)],
                  ["One-time prepayment", "—", formatInr(result.scenario.oneTimeApplied)],
                  ["Charge", "—", formatInr(result.charge)],
                  ["Total outflow", formatInr(result.baseline.totalOutflow), formatInr(result.scenario.totalOutflow)],
                ]}
              />
              <p className={ui.hint}>
                Reducing balance. The one-time amount is applied before the first instalment and capped at the
                outstanding balance. Extra monthly payments are applied on top of the scheduled EMI.
              </p>
              <DataTable
                caption="Month-by-month comparison"
                columns={[
                  "Month",
                  "Baseline payment",
                  "Baseline interest",
                  "Baseline closing",
                  "Scenario payment",
                  "Scenario interest",
                  "Scenario closing",
                ]}
                rows={result.comparison.map(row => [
                  row.month,
                  formatPlain(row.baselinePayment),
                  formatPlain(row.baselineInterest),
                  formatPlain(row.baselineClosing),
                  formatPlain(row.scenarioPayment),
                  formatPlain(row.scenarioInterest),
                  formatPlain(row.scenarioClosing),
                ])}
              />
            </div>
          ) : (
            <EmptyState>Enter the outstanding loan and prepayment amounts to compare the two strategies.</EmptyState>
          )}
        </OutputPanel>
      </ToolLayout>
      {calculation.error ? <Callout kind="error">{calculation.error}</Callout> : null}
      {message ? <StatusLine>{message}</StatusLine> : null}
    </div>
  );
}

/* ------------------------------ GST calculator ------------------------------ */

type GstValues = {
  amount: string;
  ratePreset: string;
  customRate: string;
  mode: "Exclusive of GST" | "Inclusive of GST";
  supply: "Intra-state (CGST + SGST)" | "Inter-state (IGST)";
};

type GstLineState = { id: number; description: string; amount: string; rate: string };

type GstCalcResult =
  | { kind: "single"; breakdown: GstBreakdown }
  | { kind: "lines"; lines: GstLinesResult };

const gstPresets = ["0", "5", "12", "18", "28"] as const;

const gstDefaults: GstValues = {
  amount: "1000",
  ratePreset: "18",
  customRate: "18",
  mode: "Exclusive of GST",
  supply: "Intra-state (CGST + SGST)",
};

const gstLineDefaults: GstLineState[] = [
  { id: 1, description: "Design services", amount: "1000", rate: "18" },
  { id: 2, description: "Hosting", amount: "500", rate: "12" },
];

function GstTool() {
  const id = "finance-gst";
  const [values, setValues] = useState<GstValues>(gstDefaults);
  const [lines, setLines] = useState<GstLineState[]>(gstLineDefaults.map(line => ({ ...line })));
  const [lineMode, setLineMode] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const nextLineId = useRef(3);
  const { copy, message, setMessage } = useCopy();

  const calculation = useMemo<Calc<GstCalcResult>>(() => {
    if (!calculated) return emptyCalc<GstCalcResult>();
    const errors: Record<string, string> = {};
    const mode: GstMode = values.mode === "Inclusive of GST" ? "inclusive" : "exclusive";
    const supply: GstSupply = values.supply === "Inter-state (IGST)" ? "inter" : "intra";
    if (lineMode) {
      if (lines.length === 0) errors.lines = "Add at least one invoice line.";
      const parsedLines = lines.map(line => {
        try {
          const amount = parseNumber(line.amount, "Line amount", { min: 0, max: FINANCE_MAX_PRINCIPAL }) as number;
          const rate = parseRate(line.rate, "Line rate");
          return { description: line.description.trim(), amount, rate };
        } catch (cause) {
          errors[`line-${line.id}`] = messageOf(cause);
          return null;
        }
      });
      if (Object.keys(errors).length) return { ...emptyCalc<GstCalcResult>(), errors };
      try {
        return {
          ...emptyCalc<GstCalcResult>(),
          result: { kind: "lines", lines: calculateGstLines(parsedLines as Array<{ description: string; amount: number; rate: number }>, supply, mode) },
        };
      } catch (cause) {
        return { ...emptyCalc<GstCalcResult>(), error: messageOf(cause) };
      }
    }

    let rate: number | undefined;
    if (values.ratePreset === "custom") {
      try {
        rate = parseRate(values.customRate, "Custom GST rate");
      } catch (cause) {
        errors.customRate = messageOf(cause);
      }
    } else {
      rate = Number(values.ratePreset);
    }
    let amount: number | undefined;
    try {
      amount = parseNumber(values.amount, "Amount", { min: 0, max: FINANCE_MAX_PRINCIPAL });
    } catch (cause) {
      errors.amount = messageOf(cause);
    }
    if (Object.keys(errors).length) return { ...emptyCalc<GstCalcResult>(), errors };

    try {
      return {
        ...emptyCalc<GstCalcResult>(),
        result: {
          kind: "single",
          breakdown: calculateGst({ amount: amount as number, rate: rate as number, mode, supply }),
        },
      };
    } catch (cause) {
      return { ...emptyCalc<GstCalcResult>(), error: messageOf(cause) };
    }
  }, [values, lines, lineMode, calculated]);

  const result = calculation.result;
  const breakdown = result?.kind === "single" ? result.breakdown : result?.kind === "lines" ? result.lines.totals : null;
  const summary = breakdown
    ? [
        `Taxable value: ${formatInr(breakdown.taxableValue)}`,
        `CGST: ${formatInr(breakdown.cgst)}`,
        `SGST: ${formatInr(breakdown.sgst)}`,
        `IGST: ${formatInr(breakdown.igst)}`,
        `Total tax: ${formatInr(breakdown.totalTax)}`,
        `Total payable: ${formatInr(breakdown.total)}`,
        "GST rates are user-selected; verify the current notified rate before filing.",
      ].join("\n")
    : "";

  function update<K extends keyof GstValues>(key: K, value: GstValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setMessage("");
  }

  function updateLine(lineId: number, key: "description" | "amount" | "rate", value: string) {
    setLines(current => current.map(line => (line.id === lineId ? { ...line, [key]: value } : line)));
    setMessage("");
  }

  function addLine() {
    const lineId = nextLineId.current;
    nextLineId.current += 1;
    setLines(current => [...current, { id: lineId, description: "", amount: "0", rate: "18" }]);
    setMessage("");
  }

  function removeLine(lineId: number) {
    setLines(current => current.filter(line => line.id !== lineId));
    setMessage("");
  }

  function reset() {
    setValues(gstDefaults);
    setLines(gstLineDefaults.map(line => ({ ...line })));
    setLineMode(false);
    setCalculated(false);
    setMessage("");
    nextLineId.current = 3;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalculated(true);
  }

  function download() {
    if (!result) return;
    const rows: Array<Array<string | number>> = [["Description", "Amount", "Rate %", "Taxable value", "CGST", "SGST", "IGST", "Total tax", "Total"]];
    if (result.kind === "lines") {
      for (const line of result.lines.lines) {
        rows.push([
          line.description,
          line.amount.toFixed(2),
          line.rate,
          line.taxableValue.toFixed(2),
          line.cgst.toFixed(2),
          line.sgst.toFixed(2),
          line.igst.toFixed(2),
          line.totalTax.toFixed(2),
          line.total.toFixed(2),
        ]);
      }
      const totals = result.lines.totals;
      rows.push([
        "Total",
        "",
        "",
        totals.taxableValue.toFixed(2),
        totals.cgst.toFixed(2),
        totals.sgst.toFixed(2),
        totals.igst.toFixed(2),
        totals.totalTax.toFixed(2),
        totals.total.toFixed(2),
      ]);
    } else {
      const line = result.breakdown;
      rows.push([
        "Single amount",
        line.amount.toFixed(2),
        line.rate,
        line.taxableValue.toFixed(2),
        line.cgst.toFixed(2),
        line.sgst.toFixed(2),
        line.igst.toFixed(2),
        line.totalTax.toFixed(2),
        line.total.toFixed(2),
      ]);
    }
    downloadBlob(csvText(rows), "gst-breakdown.csv", "text/csv;charset=utf-8");
    setMessage("Downloaded gst-breakdown.csv.");
  }

  return (
    <div className={styles.station}>
      <PrivacyNote>
        Invoice amounts and rates stay in this page. GST rates are user-selected examples, not a tax ruling;
        verify the notified rate and place-of-supply rules before issuing an invoice.
      </PrivacyNote>
      <ToolLayout kind="form">
        <Panel title="Invoice and rate" headingId={`${id}-form`} padded>
          <form className={styles.formBody} onSubmit={submit} noValidate>
            <Checkbox
              id={`${id}-lineMode`}
              name="lineMode"
              label="Use invoice line items"
              checked={lineMode}
              onChange={event => {
                setLineMode(event.target.checked);
                setMessage("");
              }}
            />
            {!lineMode ? (
              <div className={styles.fieldGrid}>
                <Field id={`${id}-amount`} label="Amount (INR)" error={calculation.errors.amount}>
                  <TextInput
                    id={`${id}-amount`}
                    name="amount"
                    type="number"
                    min="0"
                    max={FINANCE_MAX_PRINCIPAL}
                    step="0.01"
                    inputMode="decimal"
                    value={values.amount}
                    aria-invalid={calculation.errors.amount ? true : undefined}
                    aria-describedby={calculation.errors.amount ? `${id}-amount-error` : undefined}
                    onChange={event => update("amount", event.target.value)}
                  />
                </Field>
                <Field id={`${id}-ratePreset`} label="GST rate">
                  <Select
                    id={`${id}-ratePreset`}
                    name="ratePreset"
                    value={values.ratePreset}
                    onChange={event => update("ratePreset", event.target.value)}
                  >
                    {gstPresets.map(preset => (
                      <option value={preset} key={preset}>{preset}%</option>
                    ))}
                    <option value="custom">Custom rate</option>
                  </Select>
                </Field>
                {values.ratePreset === "custom" ? (
                  <Field id={`${id}-customRate`} label="Custom GST rate (%)" error={calculation.errors.customRate}>
                    <TextInput
                      id={`${id}-customRate`}
                      name="customRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      inputMode="decimal"
                      value={values.customRate}
                      aria-invalid={calculation.errors.customRate ? true : undefined}
                      aria-describedby={calculation.errors.customRate ? `${id}-customRate-error` : undefined}
                      onChange={event => update("customRate", event.target.value)}
                    />
                  </Field>
                ) : null}
              </div>
            ) : (
              <div className={styles.lineEditor}>
                <div className={styles.lineList}>
                  {lines.map((line, index) => (
                    <div className={styles.lineRow} key={line.id}>
                      <Field id={`${id}-line-${line.id}-description`} label={`Line ${index + 1} description`}>
                        <TextInput
                          id={`${id}-line-${line.id}-description`}
                          name={`line-${line.id}-description`}
                          type="text"
                          value={line.description}
                          onChange={event => updateLine(line.id, "description", event.target.value)}
                        />
                      </Field>
                      <Field
                        id={`${id}-line-${line.id}-amount`}
                        label="Amount (INR)"
                        error={calculation.errors[`line-${line.id}`]}
                      >
                        <TextInput
                          id={`${id}-line-${line.id}-amount`}
                          name={`line-${line.id}-amount`}
                          type="number"
                          min="0"
                          max={FINANCE_MAX_PRINCIPAL}
                          step="0.01"
                          inputMode="decimal"
                          value={line.amount}
                          aria-invalid={calculation.errors[`line-${line.id}`] ? true : undefined}
                          aria-describedby={
                            calculation.errors[`line-${line.id}`] ? `${id}-line-${line.id}-amount-error` : undefined
                          }
                          onChange={event => updateLine(line.id, "amount", event.target.value)}
                        />
                      </Field>
                      <Field id={`${id}-line-${line.id}-rate`} label="Rate (%)">
                        <TextInput
                          id={`${id}-line-${line.id}-rate`}
                          name={`line-${line.id}-rate`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          inputMode="decimal"
                          value={line.rate}
                          onChange={event => updateLine(line.id, "rate", event.target.value)}
                        />
                      </Field>
                      <div className={styles.lineAction}>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                        >
                          Remove line {index + 1}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.formActions}>
                  <Button type="button" onClick={addLine}>Add line</Button>
                </div>
              </div>
            )}
            <RadioGroup
              id={`${id}-mode`}
              legend="Amount type"
              name="gstMode"
              value={values.mode}
              options={[
                { value: "Exclusive of GST", label: "Exclusive — add GST to the amount" },
                { value: "Inclusive of GST", label: "Inclusive — back GST out of the amount" },
              ]}
              onChange={event => update("mode", event.target.value as GstValues["mode"])}
            />
            <RadioGroup
              id={`${id}-supply`}
              legend="Supply type"
              name="gstSupply"
              value={values.supply}
              options={[
                { value: "Intra-state (CGST + SGST)", label: "Intra-state — CGST + SGST" },
                { value: "Inter-state (IGST)", label: "Inter-state — IGST" },
              ]}
              onChange={event => update("supply", event.target.value as GstValues["supply"])}
            />
            <div className={styles.formActions}>
              <Button variant="primary" type="submit">Calculate GST</Button>
              <Button type="button" onClick={reset}>Reset</Button>
            </div>
          </form>
        </Panel>
        <OutputPanel
          title="Results"
          headingId={`${id}-results`}
          label="GST breakdown"
          onCopy={() => void copy(summary)}
          onDownload={download}
          copyDisabled={!breakdown}
          downloadDisabled={!breakdown}
        >
          {breakdown ? (
            <div className={styles.resultStack}>
              <Metrics
                items={[
                  { label: "Taxable value", value: formatInr(breakdown.taxableValue) },
                  { label: "CGST", value: formatInr(breakdown.cgst) },
                  { label: "SGST", value: formatInr(breakdown.sgst) },
                  { label: "IGST", value: formatInr(breakdown.igst) },
                  { label: "Total tax", value: formatInr(breakdown.totalTax) },
                  { label: "Total payable", value: formatInr(breakdown.total) },
                ]}
              />
              {result?.kind === "lines" ? (
                <DataTable
                  caption="Invoice line GST breakdown"
                  columns={["Description", "Amount", "Rate", "Taxable", "CGST", "SGST", "IGST", "Total"]}
                  rows={[
                    ...result.lines.lines.map(line => [
                      line.description,
                      formatPlain(line.amount),
                      `${line.rate}%`,
                      formatPlain(line.taxableValue),
                      formatPlain(line.cgst),
                      formatPlain(line.sgst),
                      formatPlain(line.igst),
                      formatPlain(line.total),
                    ]),
                    ["Total", "", "", formatPlain(result.lines.totals.taxableValue), formatPlain(result.lines.totals.cgst), formatPlain(result.lines.totals.sgst), formatPlain(result.lines.totals.igst), formatPlain(result.lines.totals.total)],
                  ]}
                />
              ) : null}
              <Callout kind="warning">
                GST rates are user-selected examples as of November 2026. Verify the current notified rate and
                place-of-supply rules; this tool does not determine legal tax liability.
              </Callout>
            </div>
          ) : (
            <EmptyState>Enter an amount and rate, then choose Calculate GST to see the split.</EmptyState>
          )}
        </OutputPanel>
      </ToolLayout>
      {calculation.error ? <Callout kind="error">{calculation.error}</Callout> : null}
      {message ? <StatusLine>{message}</StatusLine> : null}
    </div>
  );
}

/* ------------------------------ SIP calculator ------------------------------ */

type SipValues = {
  monthly: string;
  years: string;
  annualReturn: string;
  stepUpPercent: string;
  inflationPercent: string;
  compareRates: string;
};

const sipDefaults: SipValues = {
  monthly: "10000",
  years: "10",
  annualReturn: "12",
  stepUpPercent: "0",
  inflationPercent: "6",
  compareRates: "10, 12",
};

function SipTool() {
  const id = "finance-sip";
  const [values, setValues] = useState<SipValues>(sipDefaults);
  const [calculated, setCalculated] = useState(false);
  const { copy, message, setMessage } = useCopy();

  const calculation = useMemo<Calc<SipResult>>(() => {
    if (!calculated) return emptyCalc<SipResult>();
    const errors: Record<string, string> = {};
    const read = (key: keyof SipValues, label: string, rules?: NumberRules) => {
      try {
        return parseNumber(values[key], label, rules);
      } catch (cause) {
        errors[key] = messageOf(cause);
        return undefined;
      }
    };

    const monthly = read("monthly", "Monthly investment", { min: 1, max: FINANCE_MAX_PRINCIPAL });
    const years = read("years", "Investment period", { min: 1, max: 60 });
    if (years !== undefined && !Number.isInteger(years)) errors.years = "Investment period must be a whole number of years.";
    const annualReturn = read("annualReturn", "Expected annual return", { min: 0, max: 100 });
    const stepUpPercent = read("stepUpPercent", "Annual step-up", { min: 0, max: 100, optional: true });
    const inflationPercent = read("inflationPercent", "Inflation", { min: 0, max: 100, optional: true });

    const compareRates: number[] = [];
    const rawRates = values.compareRates.split(",").map(rate => rate.trim()).filter(Boolean);
    for (const raw of rawRates) {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        errors.compareRates = "Comparison rates must be numbers between 0 and 100, separated by commas.";
        break;
      }
      compareRates.push(parsed);
    }

    if (Object.keys(errors).length) return { ...emptyCalc<SipResult>(), errors };

    try {
      return {
        ...emptyCalc<SipResult>(),
        result: projectSip({
          monthly: monthly as number,
          years: years as number,
          annualReturn: annualReturn as number,
          stepUpPercent: stepUpPercent ?? 0,
          inflationPercent: inflationPercent ?? 0,
          compareRates,
        }),
      };
    } catch (cause) {
      return { ...emptyCalc<SipResult>(), error: messageOf(cause) };
    }
  }, [values, calculated]);

  const result = calculation.result;
  const summary = result
    ? [
        `Monthly investment: ${formatInr(result.monthly)}`,
        `Total invested: ${formatInr(result.invested)}`,
        `Estimated returns: ${formatInr(result.returns)}`,
        `Projected corpus: ${formatInr(result.corpus)}`,
        `Inflation-adjusted corpus: ${formatInr(result.realCorpus)}`,
        `Assumed annual return: ${result.annualReturn}%`,
        `Annual step-up: ${result.stepUpPercent}%`,
        `Inflation: ${result.inflationPercent}%`,
        "Hypothetical projection only; returns are not guaranteed.",
      ].join("\n")
    : "";

  function update<K extends keyof SipValues>(key: K, value: SipValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setMessage("");
  }

  function reset() {
    setValues(sipDefaults);
    setCalculated(false);
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalculated(true);
  }

  function download() {
    if (!result) return;
    const rows: Array<Array<string | number>> = [
      ["Year", "Monthly investment", "Invested", "Projected value", "Inflation-adjusted value"],
      ...result.schedule.map(row => [
        row.year,
        row.monthlyContribution.toFixed(2),
        row.invested.toFixed(2),
        row.value.toFixed(2),
        row.realValue.toFixed(2),
      ]),
    ];
    downloadBlob(csvText(rows), "sip-projection.csv", "text/csv;charset=utf-8");
    setMessage("Downloaded sip-projection.csv.");
  }

  return (
    <div className={styles.station}>
      <PrivacyNote>
        Investment amounts and assumptions stay in this page. SIP results are hypothetical projections, not
        investment advice or a promise of returns.
      </PrivacyNote>
      <ToolLayout kind="form">
        <Panel title="Investment plan" headingId={`${id}-form`} padded>
          <form className={styles.formBody} onSubmit={submit} noValidate>
            <div className={styles.fieldGrid}>
              <Field id={`${id}-monthly`} label="Monthly investment (INR)" error={calculation.errors.monthly}>
                <TextInput
                  id={`${id}-monthly`}
                  name="monthly"
                  type="number"
                  min="1"
                  max={FINANCE_MAX_PRINCIPAL}
                  step="500"
                  inputMode="decimal"
                  value={values.monthly}
                  aria-invalid={calculation.errors.monthly ? true : undefined}
                  aria-describedby={calculation.errors.monthly ? `${id}-monthly-error` : undefined}
                  onChange={event => update("monthly", event.target.value)}
                />
              </Field>
              <Field id={`${id}-years`} label="Investment period (years)" error={calculation.errors.years}>
                <TextInput
                  id={`${id}-years`}
                  name="years"
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  inputMode="numeric"
                  value={values.years}
                  aria-invalid={calculation.errors.years ? true : undefined}
                  aria-describedby={calculation.errors.years ? `${id}-years-error` : undefined}
                  onChange={event => update("years", event.target.value)}
                />
              </Field>
              <Field id={`${id}-annualReturn`} label="Expected annual return (%)" error={calculation.errors.annualReturn}>
                <TextInput
                  id={`${id}-annualReturn`}
                  name="annualReturn"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  inputMode="decimal"
                  value={values.annualReturn}
                  aria-invalid={calculation.errors.annualReturn ? true : undefined}
                  aria-describedby={calculation.errors.annualReturn ? `${id}-annualReturn-error` : undefined}
                  onChange={event => update("annualReturn", event.target.value)}
                />
              </Field>
              <Field id={`${id}-stepUpPercent`} label="Annual step-up (%)" error={calculation.errors.stepUpPercent}>
                <TextInput
                  id={`${id}-stepUpPercent`}
                  name="stepUpPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  inputMode="decimal"
                  value={values.stepUpPercent}
                  aria-invalid={calculation.errors.stepUpPercent ? true : undefined}
                  aria-describedby={calculation.errors.stepUpPercent ? `${id}-stepUpPercent-error` : undefined}
                  onChange={event => update("stepUpPercent", event.target.value)}
                />
              </Field>
              <Field id={`${id}-inflationPercent`} label="Inflation (%)" error={calculation.errors.inflationPercent}>
                <TextInput
                  id={`${id}-inflationPercent`}
                  name="inflationPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  inputMode="decimal"
                  value={values.inflationPercent}
                  aria-invalid={calculation.errors.inflationPercent ? true : undefined}
                  aria-describedby={calculation.errors.inflationPercent ? `${id}-inflationPercent-error` : undefined}
                  onChange={event => update("inflationPercent", event.target.value)}
                />
              </Field>
              <Field
                id={`${id}-compareRates`}
                label="Comparison rates (comma-separated %)"
                hint="Optional. Enter rates such as 10, 12 to compare corpora."
                error={calculation.errors.compareRates}
              >
                <TextInput
                  id={`${id}-compareRates`}
                  name="compareRates"
                  type="text"
                  value={values.compareRates}
                  aria-invalid={calculation.errors.compareRates ? true : undefined}
                  aria-describedby={
                    [calculation.errors.compareRates ? `${id}-compareRates-error` : "", `${id}-compareRates-hint`]
                      .filter(Boolean)
                      .join(" ")
                  }
                  onChange={event => update("compareRates", event.target.value)}
                />
              </Field>
            </div>
            <div className={styles.formActions}>
              <Button variant="primary" type="submit">Project SIP</Button>
              <Button type="button" onClick={reset}>Reset</Button>
            </div>
          </form>
        </Panel>
        <OutputPanel
          title="Results"
          headingId={`${id}-results`}
          label="SIP projection"
          onCopy={() => void copy(summary)}
          onDownload={download}
          copyDisabled={!result}
          downloadDisabled={!result}
        >
          {result ? (
            <div className={styles.resultStack}>
              <Metrics
                items={[
                  { label: "Total invested", value: formatInr(result.invested) },
                  { label: "Estimated returns", value: formatInr(result.returns) },
                  { label: "Projected corpus", value: formatInr(result.corpus) },
                  { label: "Inflation-adjusted corpus", value: formatInr(result.realCorpus) },
                ]}
              />
              {result.comparison.length ? (
                <ul className={styles.comparisonList} aria-label="Corpus at comparison rates">
                  {result.comparison.map(item => (
                    <li key={item.rate}>
                      <span>At {item.rate}% annual return</span>
                      <strong>{formatInr(item.corpus)}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className={ui.hint}>
                Monthly compounding with contributions at the start of each month. Step-up is applied once per
                year; the real corpus discounts the final value by the selected inflation rate.
              </p>
              <DataTable
                caption="Year-by-year SIP projection"
                columns={["Year", "Monthly investment", "Invested", "Projected value", "Inflation-adjusted value"]}
                rows={result.schedule.map(row => [
                  row.year,
                  formatPlain(row.monthlyContribution),
                  formatPlain(row.invested),
                  formatPlain(row.value),
                  formatPlain(row.realValue),
                ])}
              />
              <Callout kind="warning">
                Hypothetical projection only. Market returns vary, and the selected rate is not a guarantee or a
                forecast of any specific fund.
              </Callout>
            </div>
          ) : (
            <EmptyState>Enter the monthly amount, period, and return, then choose Project SIP.</EmptyState>
          )}
        </OutputPanel>
      </ToolLayout>
      {calculation.error ? <Callout kind="error">{calculation.error}</Callout> : null}
      {message ? <StatusLine>{message}</StatusLine> : null}
    </div>
  );
}

export default function FinanceStation({ toolId }: { toolId: FinanceToolId }) {
  const definition = getFinanceDefinition(toolId);
  if (!definition) return null;
  switch (toolId) {
    case "emi-calculator":
      return <EmiTool />;
    case "loan-prepayment-calculator":
      return <PrepaymentTool />;
    case "gst-calculator":
      return <GstTool />;
    case "sip-calculator":
      return <SipTool />;
    default:
      return null;
  }
}
