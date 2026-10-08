/**
 * Authoritative catalog for the browser-local Unit Converter.
 *
 * Factors convert a value to the category's base unit.  They are deliberately
 * metadata-only: parsing, bounds, and conversion live in lib/tools/unit.
 */
export const unitCategories = ["length", "mass", "area", "volume", "speed", "digital"] as const;
export type UnitCategory = (typeof unitCategories)[number];

export interface UnitDefinition {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly category: UnitCategory;
  /** Multiply by this factor to get the category base unit. */
  readonly toBaseFactor: number;
}

const length = [
  { id: "meter", name: "Meter", symbol: "m", category: "length", toBaseFactor: 1 },
  { id: "kilometer", name: "Kilometer", symbol: "km", category: "length", toBaseFactor: 1_000 },
  { id: "centimeter", name: "Centimeter", symbol: "cm", category: "length", toBaseFactor: 0.01 },
  { id: "millimeter", name: "Millimeter", symbol: "mm", category: "length", toBaseFactor: 0.001 },
  { id: "mile", name: "Mile", symbol: "mi", category: "length", toBaseFactor: 1_609.344 },
  { id: "yard", name: "Yard", symbol: "yd", category: "length", toBaseFactor: 0.9144 },
  { id: "foot", name: "Foot", symbol: "ft", category: "length", toBaseFactor: 0.3048 },
  { id: "inch", name: "Inch", symbol: "in", category: "length", toBaseFactor: 0.0254 },
] as const satisfies readonly UnitDefinition[];

const mass = [
  { id: "kilogram", name: "Kilogram", symbol: "kg", category: "mass", toBaseFactor: 1_000 },
  { id: "gram", name: "Gram", symbol: "g", category: "mass", toBaseFactor: 1 },
  { id: "milligram", name: "Milligram", symbol: "mg", category: "mass", toBaseFactor: 0.001 },
  { id: "metric-tonne", name: "Metric tonne", symbol: "t", category: "mass", toBaseFactor: 1_000_000 },
  { id: "ounce", name: "Ounce", symbol: "oz", category: "mass", toBaseFactor: 28.349_523_125 },
  { id: "pound", name: "Pound", symbol: "lb", category: "mass", toBaseFactor: 453.592_37 },
] as const satisfies readonly UnitDefinition[];

const area = [
  { id: "square-meter", name: "Square meter", symbol: "m²", category: "area", toBaseFactor: 1 },
  { id: "square-kilometer", name: "Square kilometer", symbol: "km²", category: "area", toBaseFactor: 1_000_000 },
  { id: "square-centimeter", name: "Square centimeter", symbol: "cm²", category: "area", toBaseFactor: 0.000_1 },
  { id: "square-millimeter", name: "Square millimeter", symbol: "mm²", category: "area", toBaseFactor: 0.000_001 },
  { id: "square-mile", name: "Square mile", symbol: "mi²", category: "area", toBaseFactor: 2_589_988.110_336 },
  { id: "square-yard", name: "Square yard", symbol: "yd²", category: "area", toBaseFactor: 0.836_127_36 },
  { id: "square-foot", name: "Square foot", symbol: "ft²", category: "area", toBaseFactor: 0.092_903_04 },
  { id: "square-inch", name: "Square inch", symbol: "in²", category: "area", toBaseFactor: 0.000_645_16 },
  { id: "hectare", name: "Hectare", symbol: "ha", category: "area", toBaseFactor: 10_000 },
  { id: "acre", name: "Acre", symbol: "ac", category: "area", toBaseFactor: 4_046.856_422_4 },
] as const satisfies readonly UnitDefinition[];

const volume = [
  { id: "cubic-meter", name: "Cubic meter", symbol: "m³", category: "volume", toBaseFactor: 1_000 },
  { id: "liter", name: "Liter", symbol: "L", category: "volume", toBaseFactor: 1 },
  { id: "milliliter", name: "Milliliter", symbol: "mL", category: "volume", toBaseFactor: 0.001 },
  { id: "cubic-centimeter", name: "Cubic centimeter", symbol: "cm³", category: "volume", toBaseFactor: 0.001 },
  { id: "cubic-foot", name: "Cubic foot", symbol: "ft³", category: "volume", toBaseFactor: 28.316_846_592 },
  { id: "cubic-inch", name: "Cubic inch", symbol: "in³", category: "volume", toBaseFactor: 0.016_387_064 },
  { id: "us-gallon", name: "US gallon", symbol: "gal", category: "volume", toBaseFactor: 3.785_411_784 },
  { id: "us-fluid-ounce", name: "US fluid ounce", symbol: "fl oz", category: "volume", toBaseFactor: 0.029_573_529_562_5 },
  { id: "imperial-gallon", name: "Imperial gallon", symbol: "imp gal", category: "volume", toBaseFactor: 4.546_09 },
  { id: "imperial-fluid-ounce", name: "Imperial fluid ounce", symbol: "imp fl oz", category: "volume", toBaseFactor: 0.028_413_062_5 },
] as const satisfies readonly UnitDefinition[];

const speed = [
  { id: "meter-per-second", name: "Meter per second", symbol: "m/s", category: "speed", toBaseFactor: 1 },
  { id: "kilometer-per-hour", name: "Kilometer per hour", symbol: "km/h", category: "speed", toBaseFactor: 1 / 3.6 },
  { id: "mile-per-hour", name: "Mile per hour", symbol: "mph", category: "speed", toBaseFactor: 0.447_04 },
  { id: "foot-per-second", name: "Foot per second", symbol: "ft/s", category: "speed", toBaseFactor: 0.3048 },
  { id: "knot", name: "Knot", symbol: "kn", category: "speed", toBaseFactor: 0.514_444_444_444_444_5 },
] as const satisfies readonly UnitDefinition[];

const digital = [
  { id: "bit", name: "Bit", symbol: "bit", category: "digital", toBaseFactor: 1 },
  { id: "kilobit", name: "Kilobit (decimal)", symbol: "kbit", category: "digital", toBaseFactor: 1_000 },
  { id: "megabit", name: "Megabit (decimal)", symbol: "Mbit", category: "digital", toBaseFactor: 1_000_000 },
  { id: "gigabit", name: "Gigabit (decimal)", symbol: "Gbit", category: "digital", toBaseFactor: 1_000_000_000 },
  { id: "terabit", name: "Terabit (decimal)", symbol: "Tbit", category: "digital", toBaseFactor: 1_000_000_000_000 },
  { id: "byte", name: "Byte", symbol: "B", category: "digital", toBaseFactor: 8 },
  { id: "kilobyte", name: "Kilobyte (decimal)", symbol: "kB", category: "digital", toBaseFactor: 8_000 },
  { id: "megabyte", name: "Megabyte (decimal)", symbol: "MB", category: "digital", toBaseFactor: 8_000_000 },
  { id: "gigabyte", name: "Gigabyte (decimal)", symbol: "GB", category: "digital", toBaseFactor: 8_000_000_000 },
  { id: "terabyte", name: "Terabyte (decimal)", symbol: "TB", category: "digital", toBaseFactor: 8_000_000_000_000 },
  { id: "kibibit", name: "Kibibit (binary)", symbol: "Kibit", category: "digital", toBaseFactor: 1_024 },
  { id: "mebibit", name: "Mebibit (binary)", symbol: "Mibit", category: "digital", toBaseFactor: 1_048_576 },
  { id: "gibibit", name: "Gibibit (binary)", symbol: "Gibit", category: "digital", toBaseFactor: 1_073_741_824 },
  { id: "tebibit", name: "Tebibit (binary)", symbol: "Tibit", category: "digital", toBaseFactor: 1_099_511_627_776 },
  { id: "kibibyte", name: "Kibibyte (binary)", symbol: "KiB", category: "digital", toBaseFactor: 8_192 },
  { id: "mebibyte", name: "Mebibyte (binary)", symbol: "MiB", category: "digital", toBaseFactor: 8_388_608 },
  { id: "gibibyte", name: "Gibibyte (binary)", symbol: "GiB", category: "digital", toBaseFactor: 8_589_934_592 },
  { id: "tebibyte", name: "Tebibyte (binary)", symbol: "TiB", category: "digital", toBaseFactor: 8_796_093_022_208 },
] as const satisfies readonly UnitDefinition[];

export const unitCatalog = { length, mass, area, volume, speed, digital } as const satisfies Record<UnitCategory, readonly UnitDefinition[]>;
export type UnitId = (typeof unitCatalog)[UnitCategory][number]["id"];
export const unitDefinitions: readonly UnitDefinition[] = Object.values(unitCatalog).flat();

/** Find a catalog entry without accepting aliases or category mismatches. */
export function getUnitDefinition(id: string): UnitDefinition | undefined {
  return unitDefinitions.find((unit) => unit.id === id);
}

/** Return the immutable list for one physical dimension. */
export function unitsForCategory(category: UnitCategory): readonly UnitDefinition[] {
  return unitCatalog[category];
}
