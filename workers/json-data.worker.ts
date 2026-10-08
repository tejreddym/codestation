import { runDataTool } from "../lib/tools/json-data";
import type { DataInputs } from "../lib/tools/json-data/types";

self.onmessage = async (event: MessageEvent<{ slug: string; inputs: DataInputs }>) => {
  try {
    const result = await runDataTool(event.data.slug, event.data.inputs);
    self.postMessage({ result });
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : "Invalid input. Processing could not complete." });
  }
};
