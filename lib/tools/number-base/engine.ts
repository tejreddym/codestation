import {
  NUMBER_BASE_MAX,
  NUMBER_BASE_MAX_INPUT_LENGTH,
  NUMBER_BASE_MIN,
  numberBasePrefixes,
} from "@/config/number-base-tools";
import type { NumberBaseConversionRequest, NumberBaseConversionResult } from "./types";

function fail(message: string): never { throw new Error(message); }

function validateBase(base: number): void {
  if (!Number.isInteger(base) || base < NUMBER_BASE_MIN || base > NUMBER_BASE_MAX) fail("Base must be an integer from 2 through 36.");
}

function prefixFor(base: number): string {
  return (numberBasePrefixes as Record<number, string | undefined>)[base] ?? "";
}

function digitValue(character: string): number {
  const code = character.toUpperCase().charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 90) return code - 55;
  return -1;
}

/** Parse an optionally signed integer, accepting only the exact prefix for its selected base. */
export function parseNumberBase(value: string, base: number): bigint {
  validateBase(base);
  if (typeof value !== "string") fail("Number value must be text.");
  if (value.length > NUMBER_BASE_MAX_INPUT_LENGTH) fail(`Number input must be at most ${NUMBER_BASE_MAX_INPUT_LENGTH} characters.`);
  const input = value.trim();
  if (!input) fail("Enter a number to convert.");

  const sign = input[0] === "+" || input[0] === "-" ? input[0] : "";
  const unsigned = sign ? input.slice(1) : input;
  if (!unsigned) fail("Enter at least one digit.");
  const expectedPrefix = prefixFor(base);
  const suppliedPrefix = /^0([bBoOdDxX])/.exec(unsigned)?.[0].toLowerCase() ?? "";
  if (suppliedPrefix && suppliedPrefix !== expectedPrefix) fail(`Prefix ${suppliedPrefix} does not match base ${base}.`);
  const digits = suppliedPrefix ? unsigned.slice(2) : unsigned;
  if (!digits || /\s/.test(digits)) fail("Use digits only; spaces and separators are not accepted.");

  let result = BigInt(0);
  const radix = BigInt(base);
  for (const character of digits) {
    const digit = digitValue(character);
    if (digit < 0 || digit >= base) fail(`Digit ${character} is not valid in base ${base}.`);
    result = result * radix + BigInt(digit);
  }
  return sign === "-" && result !== BigInt(0) ? -result : result;
}

/** Format an exact BigInt in base 2–36 using lowercase digits and no prefix. */
export function formatNumberBase(value: bigint, base: number): string {
  validateBase(base);
  return value.toString(base).toLowerCase();
}

/** Add the canonical prefix for bases that have one; bases 3–7, 9, 11–15, and 17–36 remain unprefixed. */
export function prefixNumberBase(value: string, base: number): string {
  validateBase(base);
  const prefix = prefixFor(base);
  return prefix ? `${value.startsWith("-") || value.startsWith("+") ? value[0] : ""}${prefix}${value.startsWith("-") || value.startsWith("+") ? value.slice(1) : value}` : value;
}

/** Convert signed arbitrary-size integers exactly, without Number precision loss. */
export function convertNumberBase(request: NumberBaseConversionRequest): NumberBaseConversionResult {
  validateBase(request.fromBase);
  validateBase(request.toBase);
  const value = parseNumberBase(request.value, request.fromBase);
  const text = formatNumberBase(value, request.toBase);
  const prefixedText = prefixNumberBase(text, request.toBase);
  return { input: request.value.trim(), value, fromBase: request.fromBase, toBase: request.toBase, text: request.outputPrefix ? prefixedText : text, prefixedText };
}

export const runNumberBaseConverter = convertNumberBase;
