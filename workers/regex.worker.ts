import { runRegexOperation, type RegexRequest } from "@/lib/tools/regex-station";

self.onmessage = (event: MessageEvent<RegexRequest>) => {
  try { self.postMessage({ ok: true, result: runRegexOperation(event.data) }); }
  catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : "Regex operation failed." }); }
};
