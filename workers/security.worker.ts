import { runSecurity } from "../lib/tools/security";
import type { SecurityRequest } from "../lib/tools/security/types";

self.onmessage = async (event: MessageEvent<{ slug: string; request: SecurityRequest }>) => {
  try { self.postMessage({ result: await runSecurity(event.data.slug, event.data.request) }); }
  catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "Local processing failed." }); }
  finally { delete event.data.request.file; event.data.request.values = {}; }
};
