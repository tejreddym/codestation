import { runRegex } from "../lib/tools/regex/engine";
import type { RegexValues } from "../lib/tools/regex/types";

self.onmessage = (event: MessageEvent<{ slug: string; values: RegexValues }>) => {
  try { self.postMessage({ result: runRegex(event.data.slug, event.data.values) }); }
  catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "Regex processing failed." }); }
  finally { event.data.values = {}; }
};
