import { runEncoding } from "../lib/tools/encoding";
import type { EncodingInputs } from "../lib/tools/encoding/types";

self.onmessage = async (event: MessageEvent<{ slug: string; inputs: EncodingInputs }>) => {
  try { self.postMessage({ result: await runEncoding(event.data.slug, event.data.inputs) }); }
  catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "Conversion could not complete." }); }
};
