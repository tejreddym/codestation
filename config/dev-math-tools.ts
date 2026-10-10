import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const devMathToolIds = [
  "bitwise-calculator",
  "ieee754-converter",
  "twos-complement",
  "bigint-calculator",
  "matrix-calculator",
  "gcd-lcm-calculator",
  "fraction-converter",
] as const;

export type DevMathToolId = (typeof devMathToolIds)[number];

const notice =
  "100% in-browser developer math and low-level arithmetic. IEEE-754 conversions, BigInt, and matrix computations run locally on client hardware.";

const define = (
  id: DevMathToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<DevMathToolId> =>
  localDefinition(id, title, "Developer Math", fields, outputs, defaults, [notice, ...extra], "Calculate");

export const devMathTools: readonly LocalDefinition<DevMathToolId>[] = [
  define(
    "bitwise-calculator",
    "Bitwise Operator Playground",
    [
      { name: "operandA", label: "Operand A", control: "number" },
      { name: "operandB", label: "Operand B", control: "number" },
      { name: "bitWidth", label: "Bit Width", control: "select", options: ["8", "16", "32"] },
    ],
    ["AND", "OR", "XOR", "NOT A", "Left Shift", "Right Shift", "Unsigned Shift", "Hex / Bin / Oct representation"],
    { operandA: 12, operandB: 2, bitWidth: "32" }
  ),
  define(
    "ieee754-converter",
    "IEEE-754 Floating Point Inspector",
    [
      { name: "value", label: "Decimal Float Value", control: "text" },
      { name: "precision", label: "Precision", control: "select", options: ["Single Precision (32-bit)", "Double Precision (64-bit)"] },
    ],
    ["Sign bit", "Exponent bits", "Mantissa / Fraction bits", "Unbiased exponent", "Hexadecimal representation"],
    { value: "0.15625", precision: "Single Precision (32-bit)" }
  ),
  define(
    "twos-complement",
    "Two's Complement Calculator",
    [
      { name: "value", label: "Integer Value", control: "text" },
      { name: "bitWidth", label: "Bit Width", control: "select", options: ["8", "16", "32", "64"] },
    ],
    ["Signed value", "Unsigned value", "Binary bit pattern", "Hexadecimal", "Valid signed range"],
    { value: "-42", bitWidth: "8" }
  ),
  define(
    "bigint-calculator",
    "BigInt Arithmetic Calculator",
    [
      { name: "operandA", label: "Operand A", control: "text" },
      { name: "operation", label: "Operation", control: "select", options: ["+", "-", "*", "/", "%", "^", "modExp", "gcd"] },
      { name: "operandB", label: "Operand B", control: "text" },
      { name: "modulus", label: "Modulus (for modExp)", control: "text", optional: true },
    ],
    ["Exact integer result", "Bit length", "Decimal digit count"],
    { operandA: "9007199254740995", operation: "+", operandB: "1000000000" }
  ),
  define(
    "matrix-calculator",
    "Matrix Operations Calculator",
    [
      { name: "operation", label: "Matrix Operation", control: "select", options: ["A + B", "A - B", "A × B", "Determinant det(A)", "Transpose A^T"] },
      { name: "matrixA", label: "Matrix A (CSV / spaces)", control: "textarea" },
      { name: "matrixB", label: "Matrix B (CSV / spaces)", control: "textarea", optional: true },
    ],
    ["Resulting Matrix", "Determinant value", "Dimension validation"],
    { operation: "A + B", matrixA: "1 2\n3 4", matrixB: "5 6\n7 8" }
  ),
  define(
    "gcd-lcm-calculator",
    "Prime Factorization & GCD / LCM",
    [
      { name: "numA", label: "First Integer", control: "number" },
      { name: "numB", label: "Second Integer", control: "number" },
    ],
    ["GCD (Greatest Common Divisor)", "LCM (Least Common Multiple)", "Prime Factorization of A", "Prime Factorization of B"],
    { numA: 84, numB: 126 }
  ),
  define(
    "fraction-converter",
    "Fraction ⇄ Decimal Converter",
    [
      { name: "input", label: "Decimal or Fraction (e.g. 0.75 or 7/4)", control: "text" },
    ],
    ["Irreducible fraction", "Mixed number", "Decimal expansion", "Reciprocal fraction"],
    { input: "0.75" }
  ),
];

export const getDevMathDefinition = (id: string) => devMathTools.find((tool) => tool.id === id);
export const isDevMathToolId = (id: string): id is DevMathToolId => (devMathToolIds as readonly string[]).includes(id);
