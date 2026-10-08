/** Authoritative rules for Number Base Converter input and output. */
export const supportedNumberBases = Array.from({ length: 35 }, (_, index) => index + 2) as readonly number[];
export const NUMBER_BASE_MIN = 2;
export const NUMBER_BASE_MAX = 36;
export const NUMBER_BASE_MAX_INPUT_LENGTH = 4_096;

/** Conventional prefixes are opt-in by base and are never inferred for 3–36. */
export const numberBasePrefixes = { 2: "0b", 8: "0o", 10: "0d", 16: "0x" } as const;
export type NumberBasePrefix = (typeof numberBasePrefixes)[keyof typeof numberBasePrefixes];

export interface NumberBaseDefinition {
  readonly base: number;
  readonly label: string;
  readonly prefix?: NumberBasePrefix;
}

export const numberBaseCatalog: readonly NumberBaseDefinition[] = supportedNumberBases.map((base) => ({
  base,
  label: base === 2 ? "Binary" : base === 8 ? "Octal" : base === 10 ? "Decimal" : base === 16 ? "Hexadecimal" : `Base ${base}`,
  ...(base === 2 ? { prefix: "0b" as const } : base === 8 ? { prefix: "0o" as const } : base === 10 ? { prefix: "0d" as const } : base === 16 ? { prefix: "0x" as const } : {}),
}));
