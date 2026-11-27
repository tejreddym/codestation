/**
 * Code Station — Privacy-First Local Engine Diagnostics Buffer
 * lib/engine/diagnostics.ts
 *
 * Captures anonymized crash metadata ONLY (tool slug, engine stage, sanitized
 * error name/message, app version, timestamp) in local browser storage capped
 * at the most recent 20 events. Never captures tool input or output payloads
 * and never transmits background telemetry.
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
export const MAX_ENGINE_DIAGNOSTICS = 20;
export const ENGINE_DIAGNOSTICS_STORAGE_KEY = "codestation-engine-diagnostics-v1";
export const ENGINE_DIAGNOSTICS_UPDATED_EVENT = "codestation-diagnostics-updated";

export type EngineDiagnosticStage =
  | "validating"
  | "processing"
  | "worker"
  | "timeout"
  | "render"
  | "route";

export interface EngineDiagnosticEvent {
  id: string;
  timestamp: string;
  toolSlug: string;
  stage: EngineDiagnosticStage;
  errorName: string;
  errorMessage: string;
  appVersion: string;
}

export interface RecordEngineDiagnosticInput {
  toolSlug: string;
  stage: EngineDiagnosticStage;
  error: unknown;
  timestamp?: string;
}

const recordedErrors = new WeakSet<object>();
let memoryFallbackBuffer: EngineDiagnosticEvent[] = [];

export function sanitizeToolSlug(rawSlug: unknown): string {
  if (typeof rawSlug !== "string") return "unknown-tool";
  const cleaned = rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "unknown-tool";
}

export function sanitizeErrorName(rawName: unknown): string {
  if (typeof rawName !== "string") return "Error";
  const cleaned = rawName.trim().replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 64);
  return cleaned || "Error";
}

/**
 * Strips user-supplied values, URLs, emails, paths, tokens, secrets, and
 * quoted data excerpts from error messages while preserving diagnostic context.
 */
export function sanitizeErrorMessage(rawMessage: unknown): string {
  let msg =
    typeof rawMessage === "string"
      ? rawMessage
      : rawMessage instanceof Error
        ? rawMessage.message
        : rawMessage == null
          ? "Unknown error"
          : String(rawMessage);

  msg = msg.replace(/\s+/g, " ").trim();
  if (!msg) return "Unknown error";

  // Redact URLs & data URIs (which often embed user query strings or payloads)
  msg = msg.replace(/\b(?:https?|ftp|file):\/\/[^\s"'`<>]+/gi, "[redacted-url]");
  msg = msg.replace(/\bdata:[^\s"'`<>]+/gi, "[redacted-data-uri]");

  // Redact JWTs and dotted bearer tokens
  msg = msg.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g,
    "[redacted-token]"
  );

  // Redact common credential/token patterns
  msg = msg.replace(/\bBearer\s+\S+/gi, "Bearer [redacted-secret]");
  msg = msg.replace(
    /\b(?:sk|pk|rk|ak|ghp|gho|xoxb|AIza)[A-Za-z0-9_-]{8,}\b/g,
    "[redacted-secret]"
  );

  // Redact email addresses
  msg = msg.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    "[redacted-email]"
  );

  // Redact filesystem paths
  msg = msg.replace(/(?:[A-Za-z]:\\[^\s"'`<>]+|\/(?:Users|home|var|tmp|etc)\/[^\s"'`<>]+)/g, "[redacted-path]");

  // Redact quoted/backticked snippets of length >= 3 (e.g. JSON.parse payloads)
  msg = msg.replace(/(["'`])(?:\\.|(?!\1).){3,}\1/g, '"[redacted]"');

  // Redact inline JSON objects or arrays
  msg = msg.replace(/\{[^}]{2,}\}/g, "[redacted-data]");
  msg = msg.replace(/\[[^\]]{2,}\]/g, "[redacted-data]");

  // Strip unclosed quote payloads left by truncated engine errors (e.g. V8 JSON.parse)
  msg = msg.replace(/(["'`])(?:\\.|(?!\1).){12,}$/g, '"[redacted]');

  msg = msg.replace(/\s+/g, " ").trim();
  if (msg.length > 160) {
    msg = `${msg.slice(0, 157)}...`;
  }
  return msg || "Unknown error";
}

function getStorageTargets(): Storage[] {
  if (typeof window === "undefined") return [];
  const targets: Storage[] = [];
  try {
    if (window.localStorage) targets.push(window.localStorage);
  } catch {
    // Private browsing or blocked storage
  }
  try {
    if (window.sessionStorage) targets.push(window.sessionStorage);
  } catch {
    // Blocked sessionStorage
  }
  return targets;
}

function isValidEvent(value: unknown): value is EngineDiagnosticEvent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.timestamp === "string" &&
    typeof record.toolSlug === "string" &&
    typeof record.stage === "string" &&
    typeof record.errorName === "string" &&
    typeof record.errorMessage === "string" &&
    typeof record.appVersion === "string"
  );
}

function notifyUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ENGINE_DIAGNOSTICS_UPDATED_EVENT));
  } catch {
    // Ignore custom event dispatch failures in restricted environments
  }
}

export function readEngineDiagnostics(): EngineDiagnosticEvent[] {
  for (const storage of getStorageTargets()) {
    try {
      const raw = storage.getItem(ENGINE_DIAGNOSTICS_STORAGE_KEY);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(isValidEvent).slice(-MAX_ENGINE_DIAGNOSTICS);
        memoryFallbackBuffer = clean;
        return clean;
      }
    } catch {
      // Try next storage target
    }
  }
  return [...memoryFallbackBuffer];
}

function writeEngineDiagnostics(events: EngineDiagnosticEvent[]): void {
  const capped = events.slice(-MAX_ENGINE_DIAGNOSTICS);
  memoryFallbackBuffer = capped;
  const serialized = JSON.stringify(capped);
  for (const storage of getStorageTargets()) {
    try {
      storage.setItem(ENGINE_DIAGNOSTICS_STORAGE_KEY, serialized);
      break;
    } catch {
      // Fall through to next storage target or memory fallback
    }
  }
  notifyUpdated();
}

export function clearEngineDiagnostics(): void {
  memoryFallbackBuffer = [];
  for (const storage of getStorageTargets()) {
    try {
      storage.removeItem(ENGINE_DIAGNOSTICS_STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }
  }
  notifyUpdated();
}

function createDiagnosticId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `diag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordEngineDiagnostic({
  toolSlug,
  stage,
  error,
  timestamp,
}: RecordEngineDiagnosticInput): EngineDiagnosticEvent | null {
  if (error !== null && typeof error === "object") {
    if (recordedErrors.has(error)) {
      return null;
    }
    recordedErrors.add(error);
  }

  const rawName =
    error instanceof Error
      ? error.name
      : error && typeof error === "object" && "name" in error
        ? (error as { name?: unknown }).name
        : "Error";

  const entry: EngineDiagnosticEvent = {
    id: createDiagnosticId(),
    timestamp: timestamp ?? new Date().toISOString(),
    toolSlug: sanitizeToolSlug(toolSlug),
    stage,
    errorName: sanitizeErrorName(rawName),
    errorMessage: sanitizeErrorMessage(error),
    appVersion: APP_VERSION,
  };

  const existing = readEngineDiagnostics();
  writeEngineDiagnostics([...existing, entry]);
  return entry;
}

export function formatDiagnosticsBugReport(
  events: readonly EngineDiagnosticEvent[]
): string {
  const payload = {
    product: "Code Station",
    appVersion: APP_VERSION,
    privacy: "No tool inputs, outputs, cookies, or credentials are included.",
    eventCount: events.length,
    events: events.slice(-MAX_ENGINE_DIAGNOSTICS),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Exposed strictly for deterministic unit tests to reset module-level memory state.
 */
export function _resetMemoryDiagnosticsForTest(): void {
  memoryFallbackBuffer = [];
}
