import type { UnitCategory, UnitId } from "@/config/unit-tools";

export interface UnitConversionRequest {
  readonly category: UnitCategory;
  readonly from: UnitId;
  readonly to: UnitId;
  readonly value: string | number;
}

export interface UnitConversionResult {
  readonly category: UnitCategory;
  readonly from: UnitId;
  readonly to: UnitId;
  readonly input: string;
  readonly value: number;
  readonly text: string;
}

export const UNIT_MAX_ABS_VALUE = 1e100;
