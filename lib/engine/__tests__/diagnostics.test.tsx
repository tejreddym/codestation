// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  APP_VERSION,
  clearEngineDiagnostics,
  ENGINE_DIAGNOSTICS_STORAGE_KEY,
  formatDiagnosticsBugReport,
  MAX_ENGINE_DIAGNOSTICS,
  readEngineDiagnostics,
  recordEngineDiagnostic,
  sanitizeErrorMessage,
  _resetMemoryDiagnosticsForTest,
} from "../diagnostics";
import { executeTool, ExecutionRuntimeController } from "../runtime";
import type { ToolDefinition, ToolEngine } from "../types";
import ToolEngineErrorBoundary from "@/components/ToolEngineErrorBoundary";
import DiagnosticsSettings from "@/components/DiagnosticsSettings";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  _resetMemoryDiagnosticsForTest();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("lib/engine privacy-first diagnostics buffer", () => {
  it("sanitizes URLs, JWTs, secrets, emails, paths, and quoted user payloads", () => {
    const raw =
      'Unexpected token \'{"secretApiKey":"sk_live_1234567890abcd"}\' at https://user:pass@secret.internal/v1?token=abc for alice@example.com (/Users/alice/secrets.json) eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig';
    const clean = sanitizeErrorMessage(raw);

    expect(clean).not.toContain("secretApiKey");
    expect(clean).not.toContain("sk_live_1234567890abcd");
    expect(clean).not.toContain("secret.internal");
    expect(clean).not.toContain("alice@example.com");
    expect(clean).not.toContain("/Users/alice/secrets.json");
    expect(clean).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(clean.length).toBeLessThanOrEqual(160);
  });

  it("caps stored diagnostics at 20 events and excludes tool inputs/outputs", () => {
    for (let i = 0; i < 25; i += 1) {
      recordEngineDiagnostic({
        toolSlug: `json-formatter-${i}`,
        stage: "processing",
        error: new TypeError(`Cannot read property "secret-${i}"`),
      });
    }

    const events = readEngineDiagnostics();
    expect(events).toHaveLength(MAX_ENGINE_DIAGNOSTICS);
    expect(events[0]?.toolSlug).toBe("json-formatter-5");
    expect(events[19]?.toolSlug).toBe("json-formatter-24");
    expect(events[19]?.appVersion).toBe(APP_VERSION);
    expect(events[19]?.stage).toBe("processing");
    expect(events[19]?.errorMessage).not.toContain("secret-24");

    const stored = JSON.parse(
      localStorage.getItem(ENGINE_DIAGNOSTICS_STORAGE_KEY) || "[]"
    ) as Array<Record<string, unknown>>;
    expect(stored).toHaveLength(20);
    for (const item of stored) {
      expect(Object.keys(item).sort()).toEqual([
        "appVersion",
        "errorMessage",
        "errorName",
        "id",
        "stage",
        "timestamp",
        "toolSlug",
      ]);
    }
  });

  it("records sanitized processing failures from executeTool once without user input", async () => {
    const def: ToolDefinition = {
      id: "json-formatter",
      name: "JSON Formatter",
      category: "JSON & Data",
      description: "Format JSON",
      processing: "local",
      offlineSupported: true,
      input: [],
      output: [],
    };
    const engine: ToolEngine<{ text: string }, string> = {
      validate: () => ({ valid: true }),
      process: async () => {
        throw new Error('Syntax failure near "SUPER_SECRET_USER_INPUT"');
      },
    };

    const controller = new ExecutionRuntimeController(engine, {}, undefined, def);
    await controller.run({ text: "SUPER_SECRET_USER_INPUT" });

    const events = readEngineDiagnostics();
    expect(events).toHaveLength(1);
    expect(events[0]?.toolSlug).toBe("json-formatter");
    expect(events[0]?.stage).toBe("processing");
    expect(events[0]?.errorMessage).not.toContain("SUPER_SECRET_USER_INPUT");

    // Normal validation gate failures should not pollute the crash buffer
    const valEngine: ToolEngine<string, string> = {
      validate: () => ({ valid: false, errors: ["Empty input"] }),
      process: async () => ({ data: "", durationMs: 0 }),
    };
    await expect(executeTool(def, valEngine, "")).rejects.toThrow();
    expect(readEngineDiagnostics()).toHaveLength(1);
  });

  it("captures render crashes in ToolEngineErrorBoundary and renders accessible recovery UI", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function CrashingTool(): never {
      throw new Error('Boom with "private-payload"');
    }

    render(
      <ToolEngineErrorBoundary toolSlug="base64-encoder">
        <CrashingTool />
      </ToolEngineErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/This tool encountered an unexpected error/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Copy bug report" })).toBeDefined();

    const preview = screen.getByLabelText("Sanitized bug report preview");
    expect(preview.textContent).toContain('"toolSlug": "base64-encoder"');
    expect(preview.textContent).not.toContain("private-payload");

    expect(errorSpy).toHaveBeenCalled();
  });

  it("lets users inspect and clear diagnostics from DiagnosticsSettings", () => {
    recordEngineDiagnostic({
      toolSlug: "uuid-generator",
      stage: "worker",
      error: new Error("Worker failure"),
    });

    render(<DiagnosticsSettings />);
    expect(screen.getByText(/1 \/ 20/)).toBeDefined();

    const reportPre = screen.getByLabelText("Local engine diagnostics report");
    expect(reportPre.textContent).toContain("uuid-generator");
    expect(formatDiagnosticsBugReport(readEngineDiagnostics())).toContain("uuid-generator");

    fireEvent.click(screen.getByRole("button", { name: "Clear diagnostics" }));
    expect(screen.getByText(/0 \/ 20/)).toBeDefined();
    expect(readEngineDiagnostics()).toEqual([]);

    clearEngineDiagnostics();
    expect(readEngineDiagnostics()).toEqual([]);
  });
});
