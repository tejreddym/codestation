// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cronTools } from "@/config/cron-tools";
import { runCron } from "@/lib/tools/cron/engine";
import type { CronValues } from "@/lib/tools/cron/types";
import CronStation from "./CronStation";
class LocalWorker {
  static hold = false; static last: LocalWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { LocalWorker.last = this; }
  postMessage({ toolId, values }: { toolId: string; values: CronValues }) {
    if (LocalWorker.hold) return;
    void runCron(toolId, values).then(result => this.onmessage?.({ data: { result } }), error => this.onmessage?.({ data: { error: (error as Error).message } }));
  }
}
beforeEach(() => { LocalWorker.hold = false; vi.stubGlobal("Worker", LocalWorker); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.documentElement.removeAttribute("data-theme"); });
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe.each(["light", "dark"])("Cron %s DOM theme (not visual acceptance)", theme => {
  it.each(cronTools)("$id exact fields, keyboard submit/Copy/Clear and no input transmission", async tool => {
    document.documentElement.dataset.theme = theme;
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const xhr = vi.spyOn(XMLHttpRequest.prototype, "send"); const storage = vi.spyOn(Storage.prototype, "setItem"); const log = vi.spyOn(console, "log");
    const { container } = render(<CronStation toolId={tool.id} />);
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("form input"), node => node.name)).toEqual(tool.cronContract.fields.map(field => field.name));
    expect(container.querySelector("textarea,select,input[type=file]")).toBeNull(); expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    for (const field of tool.cronContract.fields) expect(screen.getByLabelText(field.label, { exact: !field.optional })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Load example" })); screen.getByRole("button", { name: tool.cronContract.action }).focus(); await user.keyboard("{Enter}");
    for (const label of tool.cronContract.outputs) {
      const button = await screen.findByRole("button", { name: `Copy ${label}` }); button.focus(); await user.keyboard("{Enter}"); expect(copy).toHaveBeenLastCalledWith(screen.getByLabelText(`${label} value`).textContent);
    }
    const next = await runCron(tool.id, { ...tool.cronContract.defaults, ...tool.cronContract.example });
    for (const field of next.fields ?? []) {
      screen.getByRole("button", { name: `Copy ${field.label} expression` }).focus(); await user.keyboard("{Enter}"); expect(copy).toHaveBeenLastCalledWith(field.expression);
      screen.getByRole("button", { name: `Copy ${field.label} interpretation` }).focus(); await user.keyboard("{Enter}"); expect(copy).toHaveBeenLastCalledWith(field.interpretation); expect(screen.getByText(field.interpretation, { exact: true })).toBeTruthy();
    }
    screen.getByRole("button", { name: "Clear" }).focus(); await user.keyboard("{Enter}");
    for (const field of tool.cronContract.fields) expect((screen.getByLabelText(field.label, { exact: !field.optional }) as HTMLInputElement).value).toBe(tool.cronContract.defaults[field.name]);
    expect(container.querySelector("pre")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull(); expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
});
describe("Cron invalid and empty states", () => {
  it.each(cronTools)("$id exposes every contracted field and actions in keyboard tab order", async tool => {
    const user = userEvent.setup(); render(<CronStation toolId={tool.id} />);
    await user.tab(); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Load example" }));
    for (const field of tool.cronContract.fields) {
      await user.tab(); expect(document.activeElement).toBe(screen.getByLabelText(field.label, { exact: !field.optional }));
      if (field.name === "reference") for (const name of ["Open calendar for Reference date/time", "Open clock for Reference date/time", "Current date and time"]) {
        await user.tab(); expect(document.activeElement).toBe(screen.getByRole("button", { name }));
      }
    }
    await user.tab(); expect(document.activeElement).toBe(screen.getByRole("button", { name: tool.cronContract.action })); await user.tab(); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Clear" }));
  });
  it.each(cronTools)("$id handles empty inputs with an associated error/status", async tool => {
    render(<CronStation toolId={tool.id} />);
    for (const field of tool.cronContract.fields) set(field.label + (field.optional ? " (optional)" : ""), "");
    fireEvent.click(screen.getByRole("button", { name: tool.cronContract.action }));
    if (tool.id === "cron-validator") {
      expect((await screen.findByLabelText("Valid/Invalid status value")).textContent).toBe("Invalid"); expect(screen.getByLabelText("Cron expression").getAttribute("aria-invalid")).toBe("true"); expect(screen.getByLabelText("Cron expression").getAttribute("aria-describedby")).toContain("row-1");
    } else {
      const alert = await screen.findByRole("alert"); expect(alert.textContent).toContain("required"); expect(screen.getByLabelText(tool.cronContract.fields.find(field => !field.optional)!.label).getAttribute("aria-describedby")).toContain(alert.id);
    }
  });
  it.each(cronTools)("$id rejects large input without truncation", async tool => {
    render(<CronStation toolId={tool.id} />); fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    const field = tool.cronContract.fields.find(field => !field.optional)!; set(field.label, "x".repeat(2000)); fireEvent.click(screen.getByRole("button", { name: tool.cronContract.action }));
    if (tool.id === "cron-validator") expect((await screen.findByLabelText("Valid/Invalid status value")).textContent).toBe("Invalid"); else expect((await screen.findByRole("alert")).textContent).toMatch(/limit/);
    expect((screen.getByLabelText(field.label) as HTMLInputElement).value).toHaveLength(2000);
  });
  it("generator selects seconds only by an explicit Second and resets mode with Clear", async () => {
    const user = userEvent.setup(); render(<CronStation toolId="cron-generator" />);
    expect(screen.getByText("Mode: five-field Unix cron")).toBeTruthy(); set("Second (optional)", "*/10"); expect(screen.getByText("Mode: six-field seconds-first extension")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Generate cron expression" })); expect((await screen.findByLabelText("Cron expression value")).textContent).toBe("*/10 * * * * *");
    await user.click(screen.getByRole("button", { name: "Clear" })); expect(screen.getByText("Mode: five-field Unix cron")).toBeTruthy(); expect(screen.queryByLabelText("Cron expression value")).toBeNull();
    set("Second (optional)", " "); await user.click(screen.getByRole("button", { name: "Generate cron expression" })); expect((await screen.findByRole("alert")).textContent).toContain("clear Second completely");
  });
  it("Next Run starts without an implied timezone or reference", () => {
    render(<CronStation toolId="cron-next-run" />); expect((screen.getByLabelText("Timezone") as HTMLInputElement).value).toBe(""); expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toBe(""); expect(screen.getByLabelText("Timezone").getAttribute("list")).toBeTruthy();
  });
  it("malicious input stays text; unsupported Unicode content errors without echoing", async () => {
    const { container } = render(<CronStation toolId="cron-validator" />); const input = "<img src=x onerror=bad()> తెలుగు 👩‍💻"; set("Cron expression", input);
    fireEvent.click(screen.getByRole("button", { name: "Validate cron expression" })); await screen.findByLabelText("Valid/Invalid status value"); expect(container.querySelector("img,script")).toBeNull(); expect(screen.getByLabelText("Error message value").textContent).not.toContain("తెలుగు");
    expect((screen.getByLabelText("Cron expression") as HTMLInputElement).value).toBe(input);
  });
  it("editing a field invalidates results; changing tools resets state", async () => {
    const { rerender } = render(<CronStation toolId="cron-explainer" />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: "Explain cron expression" })); await screen.findByLabelText("Human-readable schedule value");
    set("Cron expression", "0 * * * *"); expect(screen.queryByLabelText("Human-readable schedule value")).toBeNull(); rerender(<CronStation toolId="cron-to-human" />); expect((screen.getByLabelText("Cron expression") as HTMLInputElement).value).toBe("");
  });
  it("Clear cancels pending worker results and does not reintroduce stale output", async () => {
    LocalWorker.hold = true; render(<CronStation toolId="cron-next-run" />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: "Calculate next run" }));
    await waitFor(() => expect(LocalWorker.last).toBeTruthy()); await act(async () => {}); const worker = LocalWorker.last; fireEvent.click(screen.getByRole("button", { name: "Clear" })); expect(worker.terminate).toHaveBeenCalled();
    await act(async () => worker.onmessage?.({ data: { result: { rows: [{ label: "Next run date/time", value: "stale" }] } } })); expect(screen.queryByText("stale")).toBeNull();
  });
  it("clipboard errors leave the readable result available", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied")); render(<CronStation toolId="cron-validator" />); set("Cron expression", "* * * * *");
    await user.click(screen.getByRole("button", { name: "Validate cron expression" })); await user.click(await screen.findByRole("button", { name: "Copy Valid/Invalid status" })); expect(screen.getByRole("status").textContent).toContain("Could not copy"); expect(screen.getByLabelText("Valid/Invalid status value").textContent).toBe("Valid");
  });
});
describe("Cron SSR hydration", () => {
  it.each(cronTools)("$id has stable IDs and preserved nodes without hydration warnings", async tool => {
    const container = document.createElement("div"); const ui = <CronStation toolId={tool.id} />; container.innerHTML = renderToString(ui, { identifierPrefix: "server" }); document.body.append(container);
    const nodes = [...container.querySelectorAll("[id]")]; const errors = vi.spyOn(console, "error"); const recoverable = vi.fn();
    const root = hydrateRoot(container, ui, { identifierPrefix: "client", onRecoverableError: recoverable }); await act(async () => {});
    expect([...container.querySelectorAll("[id]")]).toEqual(nodes); expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length); expect(errors).not.toHaveBeenCalled(); expect(recoverable).not.toHaveBeenCalled(); await act(async () => root.unmount()); container.remove();
  });
});

describe("Cron reference calendar, clock and current-instant actions", () => {
  it("starts blank and refreshes current timestamp on every click without changing the schedule zone", () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-05T03:30:15.123Z"));
    render(<CronStation toolId="cron-next-run" />); const input = screen.getByLabelText("Reference date/time") as HTMLInputElement;
    expect(input.value).toBe(""); set("Cron expression", "0 9 * * *"); set("Timezone", "Asia/Kolkata");
    fireEvent.click(screen.getByRole("button", { name: "Current date and time" })); expect(input.value).toBe("2026-10-05T03:30:15.123Z");
    vi.setSystemTime(new Date("2026-10-05T03:31:16.456Z")); expect(input.value).toBe("2026-10-05T03:30:15.123Z");
    fireEvent.click(screen.getByRole("button", { name: "Current date and time" })); expect(input.value).toBe("2026-10-05T03:31:16.456Z");
    expect((screen.getByLabelText("Timezone") as HTMLInputElement).value).toBe("Asia/Kolkata"); expect((screen.getByLabelText("Cron expression") as HTMLInputElement).value).toBe("0 9 * * *");
  });
  it("calendar selections edit the UTC day of an offset reference and retain time precision", async () => {
    const user = userEvent.setup(); render(<CronStation toolId="cron-next-run" />); set("Reference date/time", "2026-10-05T09:00:15.123+05:30");
    await user.click(screen.getByRole("button", { name: "Open calendar for Reference date/time" })); const dialog = screen.getByRole("dialog", { name: "UTC date and time picker for Reference date/time" });
    await user.click(within(dialog).getByText("6", { exact: true })); expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toBe("2026-10-06T03:30:15.123Z");
    await user.keyboard("{Escape}"); expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(screen.getByLabelText("Reference date/time"));
  });
  it("clock edits are UTC, remain valid across host DST, and preserve milliseconds", async () => {
    const user = userEvent.setup(); render(<CronStation toolId="cron-next-run" />); set("Reference date/time", "2026-03-08T01:30:15.123Z");
    await user.click(screen.getByRole("button", { name: "Open clock for Reference date/time" }));
    await user.click(screen.getByRole("button", { name: "Increase hour" })); expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toBe("2026-03-08T02:30:15.123Z");
    await user.click(screen.getByRole("button", { name: "Increase minute by 5" })); expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toBe("2026-03-08T02:35:15.123Z");
    await user.click(screen.getByRole("button", { name: "09:00" })); expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toBe("2026-03-08T09:00:00.123Z");
  });
  it("supports keyboard opening and resets open picker state with form Clear", async () => {
    const user = userEvent.setup(); render(<CronStation toolId="cron-next-run" />); screen.getByLabelText("Reference date/time").focus(); await user.keyboard("{ArrowDown}"); expect(screen.getByRole("dialog")).toBeTruthy();
    const form = screen.getByRole("button", { name: "Calculate next run" }).closest("form")!;
    fireEvent.click(within(form).getAllByRole("button", { name: "Clear" }).at(-1)!); expect(screen.queryByRole("dialog")).toBeNull(); expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toBe("");
  });
  it("current timestamp invalidates a previous calculated result", async () => {
    render(<CronStation toolId="cron-next-run" />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: "Calculate next run" })); await screen.findByLabelText("Next run date/time value");
    fireEvent.click(screen.getByRole("button", { name: "Current date and time" })); expect(screen.queryByLabelText("Next run date/time value")).toBeNull();
  });
  it("current timestamp cancels in-flight work and rejects stale replies", async () => {
    LocalWorker.hold = true; render(<CronStation toolId="cron-next-run" />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: "Calculate next run" }));
    await waitFor(() => expect(LocalWorker.last).toBeTruthy()); await act(async () => {}); const worker = LocalWorker.last;
    fireEvent.click(screen.getByRole("button", { name: "Current date and time" })); expect(worker.terminate).toHaveBeenCalled();
    await act(async () => worker.onmessage?.({ data: { result: { rows: [{ label: "Next run date/time", value: "stale" }] } } })); expect(screen.queryByText("stale")).toBeNull();
  });
  it("manual absolute input remains editable, retains errors and never silently truncates", async () => {
    render(<CronStation toolId="cron-next-run" />); fireEvent.click(screen.getByRole("button", { name: "Load example" })); set("Reference date/time", "2026-02-30T00:00:00Z");
    fireEvent.click(screen.getByRole("button", { name: "Calculate next run" })); const error = await screen.findByRole("alert"); expect(screen.getByLabelText("Reference date/time").getAttribute("aria-describedby")).toContain(error.id);
    expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toBe("2026-02-30T00:00:00Z");
    set("Reference date/time", "x".repeat(100)); expect((screen.getByLabelText("Reference date/time") as HTMLInputElement).value).toHaveLength(100); fireEvent.click(screen.getByRole("button", { name: "Calculate next run" })); expect((await screen.findByRole("alert")).textContent).toContain("64");
  });
});
