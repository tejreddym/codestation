/** Browser-memory-only inputs and contracted outputs for the JSON & Data station. */
export type DataInputs = Record<string, string>;
export interface DataResult {
  text: string;
  tree?: unknown;
  structure?: unknown;
  invalid?: boolean;
}
