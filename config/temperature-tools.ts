/** Authoritative metadata for the three absolute temperature scales. */
export const temperatureScaleIds = ["celsius", "fahrenheit", "kelvin"] as const;
export type TemperatureScaleId = (typeof temperatureScaleIds)[number];

export interface TemperatureScaleDefinition {
  readonly id: TemperatureScaleId;
  readonly name: string;
  readonly symbol: string;
  /** Absolute-zero boundary in this scale, inclusive. */
  readonly absoluteZero: number;
}

export const temperatureScales = [
  { id: "celsius", name: "Celsius", symbol: "°C", absoluteZero: -273.15 },
  { id: "fahrenheit", name: "Fahrenheit", symbol: "°F", absoluteZero: -459.67 },
  { id: "kelvin", name: "Kelvin", symbol: "K", absoluteZero: 0 },
] as const satisfies readonly TemperatureScaleDefinition[];

export function getTemperatureScale(id: string): TemperatureScaleDefinition | undefined {
  return temperatureScales.find((scale) => scale.id === id);
}
