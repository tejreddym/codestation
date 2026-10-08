import type { TemperatureScaleId } from "@/config/temperature-tools";

export interface TemperatureConversionRequest {
  readonly from: TemperatureScaleId;
  readonly to: TemperatureScaleId;
  readonly value: string | number;
}

export interface TemperatureConversionResult {
  readonly from: TemperatureScaleId;
  readonly to: TemperatureScaleId;
  readonly input: string;
  readonly value: number;
  readonly text: string;
}

export const TEMPERATURE_MAX_ABS_VALUE = 1e100;
