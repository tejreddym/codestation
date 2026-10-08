import { describe, expect, it } from "vitest";
import { NUMBER_BASE_MAX_INPUT_LENGTH, numberBaseCatalog, supportedNumberBases } from "@/config/number-base-tools";
import { convertNumberBase, formatNumberBase, parseNumberBase } from "./engine";

describe("exact BigInt number-base engine", () => {
  it("catalogs every base from 2 through 36", () => {
    expect(supportedNumberBases).toHaveLength(35);
    expect(supportedNumberBases[0]).toBe(2);
    expect(supportedNumberBases.at(-1)).toBe(36);
    expect(numberBaseCatalog.find((entry) => entry.base === 16)?.prefix).toBe("0x");
  });

  it("converts signed values beyond JavaScript Number precision", () => {
    const result = convertNumberBase({ fromBase: 16, toBase: 10, value: "-0x100000000000000000000000000000001" });
    expect(result.value).toBe(BigInt("-340282366920938463463374607431768211457"));
    expect(result.text).toBe("-340282366920938463463374607431768211457");
    expect(convertNumberBase({ fromBase: 36, toBase: 2, value: "z" }).text).toBe("100011");
    expect(formatNumberBase(BigInt(-255), 16)).toBe("-ff");
  });

  it("accepts only the exact conventional prefix for the selected input base", () => {
    expect(parseNumberBase("-0b101", 2)).toBe(BigInt(-5));
    expect(parseNumberBase("+0O77", 8)).toBe(BigInt(63));
    expect(parseNumberBase("0d42", 10)).toBe(BigInt(42));
    expect(parseNumberBase("0Xff", 16)).toBe(BigInt(255));
    for (const [value, base] of [["0x10", 10], ["0b10", 16], ["0o10", 2], ["0d10", 8], ["0x10", 12]] as const) {
      expect(() => parseNumberBase(value, base)).toThrow(/Prefix/);
    }
    expect(convertNumberBase({ fromBase: 16, toBase: 2, value: "-ff", outputPrefix: true }).text).toBe("-0b11111111");
  });

  it("validates bases, digits, empty values, separators, and input bounds", () => {
    for (const base of [0, 1, 1.5, 37, Number.NaN]) expect(() => parseNumberBase("1", base)).toThrow(/2 through 36/);
    for (const value of ["", "0x", "2", "g", "1_000", "1 000", "+"]) expect(() => parseNumberBase(value, 2)).toThrow();
    expect(() => parseNumberBase("1".repeat(NUMBER_BASE_MAX_INPUT_LENGTH + 1), 2)).toThrow(/at most/);
  });
});
