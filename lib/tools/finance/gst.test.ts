import { describe, expect, it } from "vitest";
import { calculateGst, calculateGstLines } from "./gst";

describe("GST calculator", () => {
  it("adds tax to an exclusive amount and splits intra-state tax", () => {
    const result = calculateGst({ amount: 1_000, rate: 18, mode: "exclusive", supply: "intra" });
    const inter = calculateGst({ amount: 1_000, rate: 18, mode: "exclusive", supply: "inter" });
    expect(result).toMatchObject({
      taxableValue: 1_000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      totalTax: 180,
      total: 1_180,
    });
    expect(result.cgst + result.sgst).toBe(inter.igst);
  });

  it("backs tax out of an inclusive amount without changing the total", () => {
    const result = calculateGst({ amount: 1_180, rate: 18, mode: "inclusive", supply: "intra" });
    expect(result.taxableValue).toBe(1_000);
    expect(result.totalTax).toBe(180);
    expect(result.total).toBe(1_180);
    expect(result.totalTax).toBeLessThanOrEqual(result.amount);
    expect(result.cgst).toBe(90);
    expect(result.sgst).toBe(90);
  });

  it("uses integrated tax for inter-state supply", () => {
    const result = calculateGst({ amount: 1_000, rate: 18, mode: "exclusive", supply: "inter" });
    expect(result).toMatchObject({ cgst: 0, sgst: 0, igst: 180, totalTax: 180 });
  });

  it("round-trips exclusive and inclusive amounts to the paisa", () => {
    const exclusive = calculateGst({ amount: 1_000, rate: 18, mode: "exclusive", supply: "intra" });
    const inclusive = calculateGst({
      amount: exclusive.total,
      rate: 18,
      mode: "inclusive",
      supply: "intra",
    });
    expect(inclusive.taxableValue).toBe(1_000);
    expect(inclusive.totalTax).toBe(180);
    expect(inclusive.total).toBe(exclusive.total);
  });

  it("handles a zero rate and a zero amount", () => {
    const zeroRate = calculateGst({ amount: 2_500, rate: 0, mode: "exclusive", supply: "intra" });
    expect(zeroRate).toMatchObject({ taxableValue: 2_500, cgst: 0, sgst: 0, igst: 0, totalTax: 0, total: 2_500 });
    const zeroAmount = calculateGst({ amount: 0, rate: 18, mode: "inclusive", supply: "intra" });
    expect(zeroAmount).toMatchObject({ taxableValue: 0, totalTax: 0, total: 0 });
  });

  it("splits an odd paisa without losing a cent", () => {
    const result = calculateGst({ amount: 100, rate: 18, mode: "inclusive", supply: "intra" });
    expect(result.totalTax).toBe(15.25);
    expect(result.cgst + result.sgst).toBe(15.25);
    expect(result.cgst).toBe(7.63);
    expect(result.sgst).toBe(7.62);
  });

  it("sums invoice lines with the same tax treatment", () => {
    const lines = calculateGstLines(
      [
        { description: "Design", amount: 1_000, rate: 18 },
        { description: "Hosting", amount: 500, rate: 12 },
      ],
      "intra"
    );
    expect(lines.lines).toHaveLength(2);
    expect(lines.lines[0]).toMatchObject({ description: "Design", taxableValue: 1_000, totalTax: 180 });
    expect(lines.lines[1]).toMatchObject({ description: "Hosting", taxableValue: 500, totalTax: 60 });
    expect(lines.totals).toMatchObject({
      taxableValue: 1_500,
      cgst: 120,
      sgst: 120,
      igst: 0,
      totalTax: 240,
      total: 1_740,
    });

    const single = calculateGst({ amount: 1_000, rate: 18, mode: "exclusive", supply: "intra" });
    const oneLine = calculateGstLines([{ amount: 1_000, rate: 18 }], "intra");
    expect(oneLine.totals.taxableValue).toBe(single.taxableValue);
    expect(oneLine.totals.totalTax).toBe(single.totalTax);
    expect(oneLine.totals.total).toBe(single.total);
  });

  it("names unnamed lines and supports inclusive line mode", () => {
    const result = calculateGstLines([{ amount: 1_180, rate: 18 }], "intra", "inclusive");
    expect(result.lines[0].description).toBe("Line 1");
    expect(result.totals.taxableValue).toBe(1_000);
    expect(result.totals.total).toBe(1_180);
  });

  it("rejects invalid rates, amounts, modes and supplies", () => {
    expect(() => calculateGst({ amount: 100, rate: -1, mode: "exclusive", supply: "intra" })).toThrow(/between 0% and 100%/);
    expect(() => calculateGst({ amount: 100, rate: 101, mode: "exclusive", supply: "intra" })).toThrow(/between 0% and 100%/);
    expect(() => calculateGst({ amount: -1, rate: 18, mode: "exclusive", supply: "intra" })).toThrow(/negative/);
    expect(() => calculateGst({ amount: 100, rate: 18, mode: "other" as never, supply: "intra" })).toThrow(/mode/);
    expect(() => calculateGst({ amount: 100, rate: 18, mode: "exclusive", supply: "other" as never })).toThrow(/Supply/);
    expect(() => calculateGstLines([{ amount: 100, rate: 18 }], "other" as never)).toThrow(/Supply/);
  });
});
