import { getTemperatureScale, type TemperatureScaleId } from "@/config/temperature-tools";
import { TEMPERATURE_MAX_ABS_VALUE, type TemperatureConversionRequest, type TemperatureConversionResult } from "./types";

const NUMBER_RE = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

function fail(message: string): never { throw new Error(message); }

function parseTemperature(value: string | number, scale: TemperatureScaleId): { input: string; number: number } {
  const input = typeof value === "number" ? String(value) : value.trim();
  if (!input || !NUMBER_RE.test(input)) fail("Temperature must be a finite decimal number.");
  const number = Number(input);
  const definition = getTemperatureScale(scale);
  if (!definition || !Number.isFinite(number) || Math.abs(number) > TEMPERATURE_MAX_ABS_VALUE) fail("Temperature must be finite and within the supported range.");
  if (number === 0 && /[1-9]/.test(input)) fail("Temperature is too small for the supported finite-number range.");
  if (number < definition.absoluteZero) fail(`${definition.name} cannot be below absolute zero (${definition.absoluteZero} ${definition.symbol}).`);
  return { input, number };
}

function toKelvin(value: number, scale: TemperatureScaleId): number {
  if (scale === "kelvin") return value;
  if (scale === "celsius") return value + 273.15;
  return (value + 459.67) * 5 / 9;
}

function fromKelvin(kelvin: number, scale: TemperatureScaleId): number {
  if (scale === "kelvin") return kelvin;
  if (scale === "celsius") return kelvin - 273.15;
  return kelvin * 9 / 5 - 459.67;
}

/** Format a temperature without avoidable floating-point tail noise. */
export function formatTemperature(value: number): string {
  if (!Number.isFinite(value)) return fail("Temperature result is outside the finite number range.");
  if (Object.is(value, -0)) return "0";
  return Number(value.toPrecision(15)).toString();
}

/** Convert Celsius, Fahrenheit, or Kelvin with an inclusive absolute-zero check. */
export function convertTemperatureValue(value: string | number, from: TemperatureScaleId, to: TemperatureScaleId): number {
  const parsed = parseTemperature(value, from);
  const kelvin = toKelvin(parsed.number, from);
  const result = fromKelvin(kelvin, to);
  if (!Number.isFinite(result) || Math.abs(result) > TEMPERATURE_MAX_ABS_VALUE) fail("Temperature result is outside the supported finite range.");
  const target = getTemperatureScale(to);
  if (!target) fail("Choose Celsius, Fahrenheit, or Kelvin.");
  const tolerance = 1e-12 * Math.max(1, Math.abs(target.absoluteZero));
  if (result < target.absoluteZero - tolerance) fail("Temperature result is below absolute zero.");
  return result;
}

/** Execute a complete Temperature Converter request. */
export function convertTemperature(request: TemperatureConversionRequest): TemperatureConversionResult {
  const parsed = parseTemperature(request.value, request.from);
  const value = convertTemperatureValue(parsed.input, request.from, request.to);
  return { from: request.from, to: request.to, input: parsed.input, value, text: formatTemperature(value) };
}

export const runTemperatureConverter = convertTemperature;
