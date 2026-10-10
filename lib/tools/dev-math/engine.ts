/**
 * Code Station: Developer Math Engine
 * 100% In-browser IEEE-754 inspection, Bitwise playground, BigInt, Matrix operations, GCD/LCM, Fraction converter.
 */

/** ----------------------------------------------------
 * 1. Bitwise Operations Playground
 * --------------------------------------------------- */
export interface BitwiseResult {
  a: number;
  b: number;
  bitWidth: 8 | 16 | 32;
  and: { dec: number; hex: string; bin: string; oct: string };
  or: { dec: number; hex: string; bin: string; oct: string };
  xor: { dec: number; hex: string; bin: string; oct: string };
  notA: { dec: number; hex: string; bin: string; oct: string };
  shl: { dec: number; hex: string; bin: string; oct: string };
  shr: { dec: number; hex: string; bin: string; oct: string };
  ushr: { dec: number; hex: string; bin: string; oct: string };
}

function formatBitVal(val: number, bits: 8 | 16 | 32) {
  const mask = bits === 8 ? 0xff : bits === 16 ? 0xffff : 0xffffffff;
  const unsigned = (val & mask) >>> 0;
  return {
    dec: val,
    hex: "0x" + unsigned.toString(16).toUpperCase().padStart(bits / 4, "0"),
    bin: unsigned.toString(2).padStart(bits, "0"),
    oct: "0o" + unsigned.toString(8),
  };
}

export function calculateBitwise(a: number, b: number, bitWidth: 8 | 16 | 32 = 32): BitwiseResult {
  const mask = bitWidth === 8 ? 0xff : bitWidth === 16 ? 0xffff : 0xffffffff;
  const maskedA = a & mask;
  const maskedB = b & mask;

  return {
    a: maskedA,
    b: maskedB,
    bitWidth,
    and: formatBitVal(maskedA & maskedB, bitWidth),
    or: formatBitVal(maskedA | maskedB, bitWidth),
    xor: formatBitVal(maskedA ^ maskedB, bitWidth),
    notA: formatBitVal((~maskedA) & mask, bitWidth),
    shl: formatBitVal((maskedA << (maskedB & 31)) & mask, bitWidth),
    shr: formatBitVal((maskedA >> (maskedB & 31)) & mask, bitWidth),
    ushr: formatBitVal((maskedA >>> (maskedB & 31)) & mask, bitWidth),
  };
}

/** ----------------------------------------------------
 * 2. IEEE-754 Floating-Point Inspector
 * --------------------------------------------------- */
export interface Ieee754Result {
  value: number;
  precision: "float32" | "float64";
  sign: number; // 0 or 1
  signText: "+" | "-";
  exponentRaw: number;
  exponentUnbiased: number;
  bias: number;
  mantissaRaw: number | bigint;
  binaryString: string;
  signBitString: string;
  exponentBitString: string;
  mantissaBitString: string;
  hexString: string;
  specialValue?: "Zero" | "Subnormal" | "Normal" | "Infinity" | "NaN";
}

export function inspectIeee754(value: number, precision: "float32" | "float64" = "float32"): Ieee754Result {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  if (precision === "float32") {
    view.setFloat32(0, value);
    const u32 = view.getUint32(0);
    const sign = (u32 >>> 31) & 1;
    const exponentRaw = (u32 >>> 23) & 0xff;
    const mantissaRaw = u32 & 0x7fffff;
    const bias = 127;
    const exponentUnbiased = exponentRaw === 0 ? -126 : exponentRaw - bias;

    const bin = u32.toString(2).padStart(32, "0");
    const signBitString = bin.slice(0, 1);
    const exponentBitString = bin.slice(1, 9);
    const mantissaBitString = bin.slice(9, 32);

    let specialValue: Ieee754Result["specialValue"] = "Normal";
    if (exponentRaw === 0) {
      specialValue = mantissaRaw === 0 ? "Zero" : "Subnormal";
    } else if (exponentRaw === 255) {
      specialValue = mantissaRaw === 0 ? "Infinity" : "NaN";
    }

    return {
      value,
      precision,
      sign,
      signText: sign === 1 ? "-" : "+",
      exponentRaw,
      exponentUnbiased,
      bias,
      mantissaRaw,
      binaryString: bin,
      signBitString,
      exponentBitString,
      mantissaBitString,
      hexString: "0x" + u32.toString(16).toUpperCase().padStart(8, "0"),
      specialValue,
    };
  } else {
    view.setFloat64(0, value);
    const u64 = view.getBigUint64(0);
    const sign = Number((u64 >> BigInt(63)) & BigInt(1));
    const exponentRaw = Number((u64 >> BigInt(52)) & BigInt(0x7ff));
    const mantissaRaw = u64 & BigInt("0xfffffffffffff");
    const bias = 1023;
    const exponentUnbiased = exponentRaw === 0 ? -1022 : exponentRaw - bias;

    const bin = u64.toString(2).padStart(64, "0");
    const signBitString = bin.slice(0, 1);
    const exponentBitString = bin.slice(1, 12);
    const mantissaBitString = bin.slice(12, 64);

    let specialValue: Ieee754Result["specialValue"] = "Normal";
    if (exponentRaw === 0) {
      specialValue = mantissaRaw === BigInt(0) ? "Zero" : "Subnormal";
    } else if (exponentRaw === 2047) {
      specialValue = mantissaRaw === BigInt(0) ? "Infinity" : "NaN";
    }

    return {
      value,
      precision,
      sign,
      signText: sign === 1 ? "-" : "+",
      exponentRaw,
      exponentUnbiased,
      bias,
      mantissaRaw,
      binaryString: bin,
      signBitString,
      exponentBitString,
      mantissaBitString,
      hexString: "0x" + u64.toString(16).toUpperCase().padStart(16, "0"),
      specialValue,
    };
  }
}

/** ----------------------------------------------------
 * 3. Two's Complement Calculator
 * --------------------------------------------------- */
export interface TwosComplementResult {
  bits: 8 | 16 | 32 | 64;
  signedValue: string;
  unsignedValue: string;
  binaryString: string;
  hexString: string;
  minSigned: string;
  maxSigned: string;
  isNegative: boolean;
}

export function calculateTwosComplement(input: number | string, bits: 8 | 16 | 32 | 64 = 32): TwosComplementResult {
  const b = BigInt(bits);
  const one = BigInt(1);
  const zero = BigInt(0);
  const mask = (one << b) - one;
  const maxSignedVal = (one << (b - one)) - one;
  const minSignedVal = -(one << (b - one));

  let val = BigInt(input);

  if (val > maxSignedVal || val < minSignedVal) {
    // If input is unsigned value e.g. 255 for 8 bits
    if (val >= zero && val <= mask) {
      if (val > maxSignedVal) {
        val = val - (one << b);
      }
    }
  }

  const unsigned = (val & mask);
  const binaryString = unsigned.toString(2).padStart(Number(bits), "0");
  const hexString = "0x" + unsigned.toString(16).toUpperCase().padStart(Number(bits) / 4, "0");

  return {
    bits,
    signedValue: val.toString(),
    unsignedValue: unsigned.toString(),
    binaryString,
    hexString,
    minSigned: minSignedVal.toString(),
    maxSigned: maxSignedVal.toString(),
    isNegative: val < zero,
  };
}

/** ----------------------------------------------------
 * 4. BigInt Arithmetic Calculator
 * --------------------------------------------------- */
export interface BigIntResult {
  a: string;
  b: string;
  result: string;
  operation: string;
  bitLength: number;
  digits: number;
}

function bigIntGcd(a: bigint, b: bigint): bigint {
  const zero = BigInt(0);
  let x = a < zero ? -a : a;
  let y = b < zero ? -b : b;
  while (y !== zero) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function modExp(base: bigint, exp: bigint, mod: bigint): bigint {
  const zero = BigInt(0);
  const one = BigInt(1);
  const two = BigInt(2);
  if (mod === one) return zero;
  let res = one;
  let b = base % mod;
  let e = exp;
  while (e > zero) {
    if (e % two === one) res = (res * b) % mod;
    e = e / two;
    b = (b * b) % mod;
  }
  return res;
}

export function calculateBigInt(
  aStr: string,
  bStr: string,
  op: "+" | "-" | "*" | "/" | "%" | "^" | "modExp" | "gcd",
  modStr = "1"
): BigIntResult {
  const a = BigInt(aStr.trim() || "0");
  const b = BigInt(bStr.trim() || "0");
  const zero = BigInt(0);

  let res = zero;
  switch (op) {
    case "+":
      res = a + b;
      break;
    case "-":
      res = a - b;
      break;
    case "*":
      res = a * b;
      break;
    case "/":
      if (b === zero) throw new Error("Division by zero");
      res = a / b;
      break;
    case "%":
      if (b === zero) throw new Error("Modulo by zero");
      res = a % b;
      break;
    case "^":
      if (b < zero) throw new Error("Negative exponent not supported for integers");
      if (b > BigInt(1000)) throw new Error("Exponent too large (max 1000 for client safety)");
      res = a ** b;
      break;
    case "modExp":
      const mod = BigInt(modStr.trim() || "1");
      if (mod <= zero) throw new Error("Modulus must be greater than zero");
      res = modExp(a, b, mod);
      break;
    case "gcd":
      res = bigIntGcd(a, b);
      break;
  }

  const resultStr = res.toString();
  const bitLength = res.toString(2).replace("-", "").length;

  return {
    a: a.toString(),
    b: b.toString(),
    result: resultStr,
    operation: op,
    bitLength,
    digits: resultStr.replace("-", "").length,
  };
}

/** ----------------------------------------------------
 * 5. Matrix Operations Calculator
 * --------------------------------------------------- */
export function addMatrices(a: number[][], b: number[][]): number[][] {
  if (a.length !== b.length || a[0].length !== b[0].length) {
    throw new Error("Matrices must have identical dimensions for addition");
  }
  return a.map((row, i) => row.map((val, j) => val + b[i][j]));
}

export function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const aRows = a.length;
  const aCols = a[0].length;
  const bRows = b.length;
  const bCols = b[0].length;

  if (aCols !== bRows) {
    throw new Error(`Cannot multiply matrix ${aRows}x${aCols} with ${bRows}x${bCols}`);
  }

  const result: number[][] = Array.from({ length: aRows }, () => Array(bCols).fill(0));
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      for (let k = 0; k < aCols; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

export function transposeMatrix(m: number[][]): number[][] {
  return m[0].map((_, colIndex) => m.map((row) => row[colIndex]));
}

export function determinantMatrix(m: number[][]): number {
  const n = m.length;
  if (n !== m[0].length) throw new Error("Matrix must be square to calculate determinant");

  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];

  let det = 0;
  for (let c = 0; c < n; c++) {
    const sub = m.slice(1).map((row) => row.filter((_, idx) => idx !== c));
    det += (c % 2 === 0 ? 1 : -1) * m[0][c] * determinantMatrix(sub);
  }
  return det;
}

/** ----------------------------------------------------
 * 6. Prime Factorization, GCD & LCM Calculator
 * --------------------------------------------------- */
export interface PrimeFactorizationResult {
  n: number;
  factors: Array<{ prime: number; power: number }>;
  factorizationString: string;
  isPrime: boolean;
}

export function primeFactors(n: number): PrimeFactorizationResult {
  if (n <= 1) {
    return { n, factors: [], factorizationString: String(n), isPrime: false };
  }

  let temp = n;
  const factors: Array<{ prime: number; power: number }> = [];

  for (let d = 2; d * d <= temp; d++) {
    if (temp % d === 0) {
      let count = 0;
      while (temp % d === 0) {
        count++;
        temp /= d;
      }
      factors.push({ prime: d, power: count });
    }
  }
  if (temp > 1) {
    factors.push({ prime: temp, power: 1 });
  }

  const isPrime = factors.length === 1 && factors[0].power === 1;
  const str = factors.map((f) => (f.power > 1 ? `${f.prime}^${f.power}` : `${f.prime}`)).join(" × ");

  return { n, factors, factorizationString: str, isPrime };
}

export function calculateGcdLcmPair(a: number, b: number): { gcd: number; lcm: number } {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  const gcd = x;
  const lcm = gcd === 0 ? 0 : Math.abs(a * b) / gcd;
  return { gcd, lcm };
}

/** ----------------------------------------------------
 * 7. Fraction ⇄ Decimal Converter
 * --------------------------------------------------- */
export interface FractionResult {
  numerator: number;
  denominator: number;
  fractionString: string;
  mixedString?: string;
  decimal: number;
  reciprocal: string;
}

export function convertToFraction(input: string): FractionResult {
  const trimmed = input.trim();
  let num: number;
  let den = 1;

  if (trimmed.includes("/")) {
    const [n, d] = trimmed.split("/").map((s) => parseInt(s.trim(), 10));
    if (isNaN(n) || isNaN(d) || d === 0) throw new Error("Invalid fraction format");
    num = n;
    den = d;
  } else {
    const dec = parseFloat(trimmed);
    if (isNaN(dec)) throw new Error("Invalid decimal number");

    const parts = trimmed.split(".");
    if (parts.length === 2) {
      const precision = parts[1].length;
      den = Math.pow(10, precision);
      num = Math.round(dec * den);
    } else {
      num = dec;
      den = 1;
    }
  }

  const g = calculateGcdLcmPair(num, den).gcd;
  const redNum = num / g;
  const redDen = den / g;

  let mixedString: string | undefined;
  if (Math.abs(redNum) >= redDen && redDen !== 1) {
    const whole = Math.trunc(redNum / redDen);
    const rem = Math.abs(redNum % redDen);
    if (rem > 0) {
      mixedString = `${whole} ${rem}/${redDen}`;
    }
  }

  return {
    numerator: redNum,
    denominator: redDen,
    fractionString: redDen === 1 ? `${redNum}` : `${redNum}/${redDen}`,
    mixedString,
    decimal: redNum / redDen,
    reciprocal: redNum === 0 ? "Undefined" : `${redDen}/${redNum}`,
  };
}
