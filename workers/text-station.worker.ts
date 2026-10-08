import { runText } from "../lib/tools/text/engine";
import type { TextValues } from "../lib/tools/text/types";
self.onmessage = async (event: MessageEvent<{ slug: string; values: TextValues }>) => {
  try { self.postMessage({ result: await runText(event.data.slug, event.data.values) }); }
  catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "Text processing failed." }); }
  finally { event.data.values = {}; }
};
