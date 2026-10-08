import { runCron } from "../lib/tools/cron/engine";
import type { CronValues } from "../lib/tools/cron/types";
self.onmessage = async (event: MessageEvent<{ toolId: string; values: CronValues }>) => {
  try { self.postMessage({ result: await runCron(event.data.toolId, event.data.values) }); }
  catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "Cron calculation failed." }); }
  finally { event.data.values = {}; }
};
