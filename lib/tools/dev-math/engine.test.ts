import { describe, expect, it } from "vitest";
import {
  calculateBitwise,
  inspectIeee754,
  calculateTwosComplement,
  calculateBigInt,
  addMatrices,
  multiplyMatrices,
  determinantMatrix,
  primeFactors,
  calculateGcdLcmPair,
  convertToFraction,
} from "./engine";

describe("developer math engine", () => {
  it("calculates bitwise operations", () => {
    const res = calculateBitwise(12, 2, 8); // 1100 & 0010 = 0000, 12 << 2 = 48
    expect(res.and.dec).toBe(0);
    expect(res.or.dec).toBe(14); // 1110
    expect(res.xor.dec).toBe(14); // 1110
    expect(res.shl.dec).toBe(48); // 12 << 2 = 48
  });

  it("inspects IEEE-754 floating point numbers", () => {
    const f32 = inspectIeee754(0.15625, "float32");
    expect(f32.sign).toBe(0);
    expect(f32.signText).toBe("+");
    expect(f32.specialValue).toBe("Normal");
    expect(f32.binaryString).toHaveLength(32);

    const zero = inspectIeee754(0, "float32");
    expect(zero.specialValue).toBe("Zero");
  });

  it("calculates two's complement", () => {
    const res = calculateTwosComplement(-5, 8);
    expect(res.isNegative).toBe(true);
    expect(res.signedValue).toBe("-5");
    expect(res.unsignedValue).toBe("251");
    expect(res.binaryString).toBe("11111011");
  });

  it("performs BigInt arbitrary precision arithmetic", () => {
    const add = calculateBigInt("9007199254740995", "10", "+");
    expect(add.result).toBe("9007199254741005");

    const gcd = calculateBigInt("1071", "462", "gcd");
    expect(gcd.result).toBe("21");

    const mod = calculateBigInt("7", "256", "modExp", "13");
    expect(mod.result).toBe("9");
  });

  it("performs matrix addition and multiplication", () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];

    const sum = addMatrices(a, b);
    expect(sum).toEqual([[6, 8], [10, 12]]);

    const prod = multiplyMatrices(a, b);
    expect(prod).toEqual([[19, 22], [43, 50]]);

    const det = determinantMatrix(a);
    expect(det).toBe(-2); // 1*4 - 2*3 = -2
  });

  it("calculates prime factorization and GCD/LCM", () => {
    const pf = primeFactors(84);
    expect(pf.factorizationString).toBe("2^2 × 3 × 7");
    expect(pf.isPrime).toBe(false);

    const { gcd, lcm } = calculateGcdLcmPair(24, 36);
    expect(gcd).toBe(12);
    expect(lcm).toBe(72);
  });

  it("converts decimals to irreducible fractions", () => {
    const frac = convertToFraction("0.75");
    expect(frac.fractionString).toBe("3/4");
    expect(frac.reciprocal).toBe("4/3");

    const mixed = convertToFraction("2.5");
    expect(mixed.fractionString).toBe("5/2");
    expect(mixed.mixedString).toBe("2 1/2");
  });
});
