import { getUnitDefinition, type UnitCategory, type UnitId } from "@/config/unit-tools";
import { UNIT_MAX_ABS_VALUE, type UnitConversionRequest, type UnitConversionResult } from "./types";

const NUMBER_RE = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

function fail(message: string): never { throw new Error(message); }

function parseNumber(value: string | number): { input: string; number: number } {
  const input = typeof value === "number" ? String(value) : value.trim();
  if (!input || !NUMBER_RE.test(input)) fail("Value must be a finite decimal number.");
  const number = Number(input);
  if (!Number.isFinite(number) || Math.abs(number) > UNIT_MAX_ABS_VALUE) fail("Value must be finite and no greater than 1e100 in magnitude.");
  if (number === 0 && /[1-9]/.test(input)) fail("Value is too small for the supported finite-number range.");
  return { input, number };
}

function unit(id: UnitId, category: UnitCategory) {
  const definition = getUnitDefinition(id);
  if (!definition || definition.category !== category) fail(`Choose a supported ${category} unit.`);
  return definition;
}

/** Format without exposing avoidable binary floating-point tail noise. */
export function formatUnitValue(value: number): string {
  if (!Number.isFinite(value)) return fail("Conversion result is outside the finite number range.");
  if (Object.is(value, -0)) return "0";
  return Number(value.toPrecision(15)).toString();
}

/** Convert a finite decimal value between two units in one physical category. */
export function convertUnitValue(value: string | number, from: UnitId, to: UnitId, category?: UnitCategory): number {
  const fromDefinition = getUnitDefinition(from);
  const selectedCategory = category ?? fromDefinition?.category;
  if (!selectedCategory) fail("Choose a supported unit category.");
  const source = unit(from, selectedCategory);
  const target = unit(to, selectedCategory);
  const parsed = parseNumber(value);
  const result = parsed.number * source.toBaseFactor / target.toBaseFactor;
  if (!Number.isFinite(result) || Math.abs(result) > UNIT_MAX_ABS_VALUE) fail("Conversion result is outside the supported finite range.");
  if (result === 0 && parsed.number !== 0) fail("Conversion result is too small for the supported finite-number range.");
  return result;
}

/** Execute a complete Unit Converter request and provide both numeric and display values. */
export function convertUnit(request: UnitConversionRequest): UnitConversionResult {
  const parsed = parseNumber(request.value);
  const value = convertUnitValue(parsed.input, request.from, request.to, request.category);
  return { category: request.category, from: request.from, to: request.to, input: parsed.input, value, text: formatUnitValue(value) };
}

/** Alias suitable for station/client callers. */
export const runUnitConverter = convertUnit;
