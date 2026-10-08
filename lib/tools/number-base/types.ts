export interface NumberBaseConversionRequest {
  readonly value: string;
  readonly fromBase: number;
  readonly toBase: number;
  readonly outputPrefix?: boolean;
}

export interface NumberBaseConversionResult {
  readonly input: string;
  readonly value: bigint;
  readonly fromBase: number;
  readonly toBase: number;
  readonly text: string;
  readonly prefixedText: string;
}
