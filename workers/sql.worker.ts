import { runSql } from "../lib/tools/sql/engine";
import type { SqlValues } from "../lib/tools/sql/types";
self.onmessage = async (event: MessageEvent<{ toolId: string; values: SqlValues }>) => {
  try { self.postMessage({ result: await runSql(event.data.toolId, event.data.values) }); }
  catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "SQL processing failed." }); }
  finally { event.data.values = {}; }
};
