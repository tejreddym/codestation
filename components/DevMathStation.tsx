"use client";

import { useState } from "react";
import { getDevMathDefinition, type DevMathToolId } from "@/config/dev-math-tools";
import {
  calculateBitwise,
  inspectIeee754,
  calculateTwosComplement,
  calculateBigInt,
  addMatrices,
  multiplyMatrices,
  determinantMatrix,
  transposeMatrix,
  primeFactors,
  calculateGcdLcmPair,
  convertToFraction,
  type BitwiseResult,
  type Ieee754Result,
  type TwosComplementResult,
} from "@/lib/tools/dev-math/engine";
import styles from "./DevMathStation.module.css";

interface DevMathStationProps {
  toolId: DevMathToolId;
}

export default function DevMathStation({ toolId }: { toolId: DevMathToolId }) {
  const definition = getDevMathDefinition(toolId)!;
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // 1. Bitwise State
  const [bitOpA, setBitOpA] = useState(12);
  const [bitOpB, setBitOpB] = useState(2);
  const [bitWidth, setBitWidth] = useState<8 | 16 | 32>(32);

  // 2. IEEE-754 State
  const [floatInput, setFloatInput] = useState("0.15625");
  const [floatPrecision, setFloatPrecision] = useState<"float32" | "float64">("float32");

  // 3. Two's Complement State
  const [tcInput, setTcInput] = useState("-42");
  const [tcBits, setTcBits] = useState<8 | 16 | 32 | 64>(8);

  // 4. BigInt State
  const [biA, setBiA] = useState("9007199254740995");
  const [biB, setBiB] = useState("1000000000");
  const [biOp, setBiOp] = useState<"+" | "-" | "*" | "/" | "%" | "^" | "modExp" | "gcd">("+");
  const [biMod, setBiMod] = useState("13");

  // 5. Matrix State
  const [matA, setMatA] = useState("1 2\n3 4");
  const [matB, setMatB] = useState("5 6\n7 8");
  const [matOp, setMatOp] = useState<"add" | "multiply" | "det" | "transpose">("add");

  // 6. GCD/LCM State
  const [gcdA, setGcdA] = useState(84);
  const [gcdB, setGcdB] = useState(126);

  // 7. Fraction State
  const [fracInput, setFracInput] = useState("0.75");

  function parseMatrix(str: string): number[][] {
    return str
      .trim()
      .split("\n")
      .map((row) =>
        row
          .trim()
          .split(/[\s,]+/)
          .map((v) => parseFloat(v))
      );
  }

  return (
    <div className={styles.container}>
      {/* 1. Bitwise Calculator */}
      {toolId === "bitwise-calculator" && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Bitwise Operator Playground</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Operand A (Decimal)</label>
              <input
                type="number"
                className={styles.input}
                value={bitOpA}
                onChange={(e) => setBitOpA(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className={styles.field}>
              <label>Operand B (Decimal / Shift Amount)</label>
              <input
                type="number"
                className={styles.input}
                value={bitOpB}
                onChange={(e) => setBitOpB(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className={styles.field}>
              <label>Bit Width</label>
              <select
                className={styles.select}
                value={bitWidth}
                onChange={(e) => setBitWidth(parseInt(e.target.value, 10) as any)}
              >
                <option value="8">8-bit</option>
                <option value="16">16-bit</option>
                <option value="32">32-bit</option>
              </select>
            </div>
          </div>

          {(() => {
            const res = calculateBitwise(bitOpA, bitOpB, bitWidth);
            const ops: Array<{ name: string; val: typeof res.and }> = [
              { name: "A AND B (A & B)", val: res.and },
              { name: "A OR B (A | B)", val: res.or },
              { name: "A XOR B (A ^ B)", val: res.xor },
              { name: "NOT A (~A)", val: res.notA },
              { name: "Left Shift (A << B)", val: res.shl },
              { name: "Right Shift (A >> B)", val: res.shr },
              { name: "Zero-fill Right Shift (A >>> B)", val: res.ushr },
            ];

            return (
              <div className={styles.resultsGrid}>
                {ops.map(({ name, val }) => (
                  <div key={name} className={styles.statCard}>
                    <div className={styles.statLabel}>
                      <span>{name}</span>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => copyText(String(val.dec), name)}
                      >
                        {copied === name ? "✓" : "Copy"}
                      </button>
                    </div>
                    <span className={styles.statValue}>{val.dec}</span>
                    <span className={styles.statMeta}>
                      HEX: {val.hex} · OCT: {val.oct}
                    </span>
                    <span className={styles.statMeta}>BIN: {val.bin}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* 2. IEEE-754 Inspector */}
      {toolId === "ieee754-converter" && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>IEEE-754 Floating-Point Inspector</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Decimal Float Value</label>
              <input
                type="text"
                className={styles.input}
                value={floatInput}
                onChange={(e) => setFloatInput(e.target.value)}
                placeholder="e.g. 0.15625, -42.5, Infinity, NaN"
              />
            </div>
            <div className={styles.field}>
              <label>Precision</label>
              <select
                className={styles.select}
                value={floatPrecision}
                onChange={(e) => setFloatPrecision(e.target.value as any)}
              >
                <option value="float32">Single Precision (32-bit)</option>
                <option value="float64">Double Precision (64-bit)</option>
              </select>
            </div>
          </div>

          {(() => {
            const parsedNum = parseFloat(floatInput);
            if (isNaN(parsedNum) && floatInput !== "NaN") {
              return <div className={styles.errorBanner}>Please enter a valid floating-point number.</div>;
            }

            const res = inspectIeee754(floatInput === "NaN" ? NaN : parsedNum, floatPrecision);

            return (
              <>
                <div className={styles.field}>
                  <label>Binary Bit Ribbon (Sign | Exponent | Mantissa)</label>
                  <div className={styles.bitRibbon}>
                    <div className={styles.bitGroup}>
                      <span className={styles.bitLabel}>Sign</span>
                      <div className={styles.bitRow}>
                        <div className={`${styles.bitCell} ${styles.bitSign}`}>{res.signBitString}</div>
                      </div>
                    </div>
                    <div className={styles.bitGroup} style={{ marginLeft: "6px" }}>
                      <span className={styles.bitLabel}>Exponent ({res.exponentBitString.length}b)</span>
                      <div className={styles.bitRow}>
                        {res.exponentBitString.split("").map((b, i) => (
                          <div key={i} className={`${styles.bitCell} ${styles.bitExponent}`}>
                            {b}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={styles.bitGroup} style={{ marginLeft: "6px" }}>
                      <span className={styles.bitLabel}>Mantissa ({res.mantissaBitString.length}b)</span>
                      <div className={styles.bitRow}>
                        {res.mantissaBitString.slice(0, 23).split("").map((b, i) => (
                          <div key={i} className={`${styles.bitCell} ${styles.bitMantissa}`}>
                            {b}
                          </div>
                        ))}
                        {res.mantissaBitString.length > 23 && (
                          <span style={{ fontSize: "0.75rem", alignSelf: "center", marginLeft: "4px" }}>
                            +{res.mantissaBitString.length - 23} bits
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.resultsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Sign</span>
                    <span className={styles.statValue}>
                      {res.sign} ({res.signText} positive/negative)
                    </span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Raw Exponent</span>
                    <span className={styles.statValue}>
                      {res.exponentRaw} (Unbiased: {res.exponentUnbiased})
                    </span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Classification</span>
                    <span className={styles.statValue}>{res.specialValue}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Hex Representation</span>
                    <span className={styles.statValue}>{res.hexString}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* 3. Two's Complement */}
      {toolId === "twos-complement" && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Two&apos;s Complement Calculator</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Integer Value (Decimal)</label>
              <input
                type="text"
                className={styles.input}
                value={tcInput}
                onChange={(e) => setTcInput(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Bit Width</label>
              <select
                className={styles.select}
                value={tcBits}
                onChange={(e) => setTcBits(parseInt(e.target.value, 10) as any)}
              >
                <option value="8">8-bit (-128 to 127)</option>
                <option value="16">16-bit (-32,768 to 32,767)</option>
                <option value="32">32-bit</option>
                <option value="64">64-bit</option>
              </select>
            </div>
          </div>

          {(() => {
            try {
              const res = calculateTwosComplement(tcInput, tcBits);
              return (
                <div className={styles.resultsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Signed Value</span>
                    <span className={styles.statValue}>{res.signedValue}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Unsigned Value</span>
                    <span className={styles.statValue}>{res.unsignedValue}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Binary Representation</span>
                    <span className={styles.statValue}>{res.binaryString}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Hexadecimal</span>
                    <span className={styles.statValue}>{res.hexString}</span>
                  </div>
                  <div className={styles.statCard} style={{ gridColumn: "1 / -1" }}>
                    <span className={styles.statLabel}>Valid Signed Range</span>
                    <span className={styles.statValue}>
                      {res.minSigned} to {res.maxSigned}
                    </span>
                  </div>
                </div>
              );
            } catch (err) {
              return <div className={styles.errorBanner}>{(err as Error).message}</div>;
            }
          })()}
        </div>
      )}

      {/* 4. BigInt Calculator */}
      {toolId === "bigint-calculator" && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>BigInt Arbitrary Precision Calculator</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Operand A (Arbitrarily large integer)</label>
              <input
                type="text"
                className={styles.input}
                value={biA}
                onChange={(e) => setBiA(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Operation</label>
              <select
                className={styles.select}
                value={biOp}
                onChange={(e) => setBiOp(e.target.value as any)}
              >
                <option value="+">Addition (+)</option>
                <option value="-">Subtraction (-)</option>
                <option value="*">Multiplication (×)</option>
                <option value="/">Integer Division (/)</option>
                <option value="%">Modulo (%)</option>
                <option value="^">Exponentiation (a^b)</option>
                <option value="modExp">Modular Exponentiation (a^b mod m)</option>
                <option value="gcd">Greatest Common Divisor gcd(a, b)</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Operand B</label>
              <input
                type="text"
                className={styles.input}
                value={biB}
                onChange={(e) => setBiB(e.target.value)}
              />
            </div>
            {biOp === "modExp" && (
              <div className={styles.field}>
                <label>Modulus (m)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={biMod}
                  onChange={(e) => setBiMod(e.target.value)}
                />
              </div>
            )}
          </div>

          {(() => {
            try {
              const res = calculateBigInt(biA, biB, biOp, biMod);
              return (
                <div className={styles.resultsGrid}>
                  <div className={styles.statCard} style={{ gridColumn: "1 / -1" }}>
                    <div className={styles.statLabel}>
                      <span>Result</span>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => copyText(res.result, "bigint")}
                      >
                        {copied === "bigint" ? "✓ Copied" : "Copy Result"}
                      </button>
                    </div>
                    <span className={styles.statValue} style={{ fontSize: "1.1rem" }}>
                      {res.result}
                    </span>
                    <span className={styles.statMeta}>
                      {res.digits} decimal digits · {res.bitLength} bits
                    </span>
                  </div>
                </div>
              );
            } catch (err) {
              return <div className={styles.errorBanner}>{(err as Error).message}</div>;
            }
          })()}
        </div>
      )}

      {/* 5. Matrix Operations */}
      {toolId === "matrix-calculator" && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Matrix Operations Calculator</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Operation</label>
              <select
                className={styles.select}
                value={matOp}
                onChange={(e) => setMatOp(e.target.value as any)}
              >
                <option value="add">Addition (A + B)</option>
                <option value="multiply">Multiplication (A × B)</option>
                <option value="det">Determinant det(A)</option>
                <option value="transpose">Transpose A^T</option>
              </select>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Matrix A (Rows on newlines, elements spaced)</label>
              <textarea
                className={styles.textarea}
                value={matA}
                onChange={(e) => setMatA(e.target.value)}
              />
            </div>
            {(matOp === "add" || matOp === "multiply") && (
              <div className={styles.field}>
                <label>Matrix B</label>
                <textarea
                  className={styles.textarea}
                  value={matB}
                  onChange={(e) => setMatB(e.target.value)}
                />
              </div>
            )}
          </div>

          {(() => {
            try {
              const mA = parseMatrix(matA);
              let resultStr = "";

              if (matOp === "add") {
                const mB = parseMatrix(matB);
                const sum = addMatrices(mA, mB);
                resultStr = sum.map((r) => r.join("\t")).join("\n");
              } else if (matOp === "multiply") {
                const mB = parseMatrix(matB);
                const prod = multiplyMatrices(mA, mB);
                resultStr = prod.map((r) => r.join("\t")).join("\n");
              } else if (matOp === "det") {
                const det = determinantMatrix(mA);
                resultStr = `Determinant det(A) = ${det}`;
              } else if (matOp === "transpose") {
                const trans = transposeMatrix(mA);
                resultStr = trans.map((r) => r.join("\t")).join("\n");
              }

              return (
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>
                    <span>Matrix Output</span>
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => copyText(resultStr, "matrix")}
                    >
                      {copied === "matrix" ? "✓ Copied" : "Copy Output"}
                    </button>
                  </div>
                  <pre className={styles.matrixOutput}>{resultStr}</pre>
                </div>
              );
            } catch (err) {
              return <div className={styles.errorBanner}>{(err as Error).message}</div>;
            }
          })()}
        </div>
      )}

      {/* 6. GCD / LCM & Prime Factorization */}
      {toolId === "gcd-lcm-calculator" && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Prime Factorization &amp; GCD / LCM</div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>First Integer (A)</label>
              <input
                type="number"
                className={styles.input}
                value={gcdA}
                onChange={(e) => setGcdA(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className={styles.field}>
              <label>Second Integer (B)</label>
              <input
                type="number"
                className={styles.input}
                value={gcdB}
                onChange={(e) => setGcdB(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>

          {(() => {
            const { gcd, lcm } = calculateGcdLcmPair(gcdA, gcdB);
            const pfA = primeFactors(Math.abs(gcdA));
            const pfB = primeFactors(Math.abs(gcdB));

            return (
              <div className={styles.resultsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>GCD (Greatest Common Divisor)</span>
                  <span className={styles.statValue}>{gcd}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>LCM (Least Common Multiple)</span>
                  <span className={styles.statValue}>{lcm}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Prime Factorization of A</span>
                  <span className={styles.statValue}>{pfA.factorizationString}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Prime Factorization of B</span>
                  <span className={styles.statValue}>{pfB.factorizationString}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 7. Fraction ⇄ Decimal Converter */}
      {toolId === "fraction-converter" && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Fraction ⇄ Decimal Converter</div>

          <div className={styles.field}>
            <label>Input Decimal or Fraction (e.g. 0.75 or 7/4)</label>
            <input
              type="text"
              className={styles.input}
              value={fracInput}
              onChange={(e) => setFracInput(e.target.value)}
              placeholder="e.g. 0.75 or 7/4"
            />
          </div>

          {(() => {
            try {
              const res = convertToFraction(fracInput);
              return (
                <div className={styles.resultsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Irreducible Fraction</span>
                    <span className={styles.statValue}>{res.fractionString}</span>
                  </div>
                  {res.mixedString && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Mixed Number</span>
                      <span className={styles.statValue}>{res.mixedString}</span>
                    </div>
                  )}
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Decimal Expansion</span>
                    <span className={styles.statValue}>{res.decimal}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Reciprocal (1 / x)</span>
                    <span className={styles.statValue}>{res.reciprocal}</span>
                  </div>
                </div>
              );
            } catch (err) {
              return <div className={styles.errorBanner}>{(err as Error).message}</div>;
            }
          })()}
        </div>
      )}
    </div>
  );
}
