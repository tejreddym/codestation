import { inspectSpreadsheet, runSpreadsheet } from "../lib/tools/spreadsheet/engine";
import type { SpreadsheetValues } from "../lib/tools/spreadsheet/types";

type Request = { action: "inspect"; file: File } | { action: "run"; toolId: string; values: SpreadsheetValues };
self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    const request = event.data;
    if (request.action === "inspect") self.postMessage({ info: await inspectSpreadsheet(request.file) });
    else self.postMessage({ result: await runSpreadsheet(request.toolId, request.values) });
  } catch (cause) {
    const error = cause as { message?: unknown; field?: unknown };
    self.postMessage({ error: typeof error.message === "string" ? error.message : "Spreadsheet processing failed.", field: typeof error.field === "string" ? error.field : undefined });
  }
};
