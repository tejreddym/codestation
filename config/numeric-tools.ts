import { localDefinition, type LocalDefinition, type LocalField } from "./local-contract";

/** Public metadata authority for the three isolated numeric converter tools. */
export const numericToolIds = ["unit-converter", "temperature-converter", "number-base-converter"] as const;
export type NumericToolId = (typeof numericToolIds)[number];

const select = (name: string, label: string, options: readonly string[]): LocalField => ({ name, label, control: "select", options });
const text = (name: string, label: string): LocalField => ({ name, label, control: "text" });

export const numericTools = [
  localDefinition(
    "unit-converter",
    "Unit Converter",
    "Converters",
    [select("category", "Category", ["length", "mass", "area", "volume", "speed", "digital"]), text("value", "Value"), select("from", "From unit", []), select("to", "To unit", [])],
    ["Converted value"],
    { category: "length", value: "1", from: "meter", to: "foot" },
    ["Supports length, mass, area, volume, speed, and decimal/binary digital units. Values are converted locally with bounded finite decimal arithmetic."],
    "Convert",
  ),
  localDefinition(
    "temperature-converter",
    "Temperature Converter",
    "Converters",
    [text("value", "Temperature"), select("from", "From scale", ["celsius", "fahrenheit", "kelvin"]), select("to", "To scale", ["celsius", "fahrenheit", "kelvin"])],
    ["Converted temperature"],
    { value: "0", from: "celsius", to: "fahrenheit" },
    ["Supports Celsius, Fahrenheit, and Kelvin. Values below absolute zero are rejected."],
    "Convert",
  ),
  localDefinition(
    "number-base-converter",
    "Number Base Converter",
    "Converters",
    [text("value", "Number"), select("fromBase", "From base", []), select("toBase", "To base", []), { name: "outputPrefix", label: "Use canonical output prefix", control: "checkbox" }],
    ["Converted number"],
    { value: "255", fromBase: "10", toBase: "16", outputPrefix: false },
    ["Supports exact signed BigInt values in bases 2–36. Prefixes must match their selected input base and input is bounded."],
    "Convert",
  ),
] as const satisfies readonly LocalDefinition<NumericToolId>[];

export type NumericToolDefinition = (typeof numericTools)[number];
export function isNumericToolId(id: string): id is NumericToolId { return (numericToolIds as readonly string[]).includes(id); }
export function getNumericDefinition(idOrSlug: string): NumericToolDefinition | undefined { return numericTools.find(tool => tool.id === idOrSlug || tool.slug === idOrSlug); }

export * from "./unit-tools";
export * from "./temperature-tools";
export * from "./number-base-tools";
