/** Text stays in local page/worker memory; multipart values are copied individually. */
export interface EncodingInputs { input: string; mime?: string }
export interface EncodingResult {
  text: string;
  parts?: { label: string; value: string }[];
}
