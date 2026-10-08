// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dateTimeTools } from "@/config/date-time-tools";
import DateTimeStation from "./DateTimeStation";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-03T12:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe.each(["light", "dark"])("Date & Time %s DOM-theme workflows (not visual acceptance)", theme => {
  it.each(dateTimeTools)("$slug exact fields, keyboard run/copy/clear and no personal-data sinks", async tool => {
    document.documentElement.dataset.theme = theme;
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const xhr = vi.spyOn(XMLHttpRequest.prototype, "send");
    const storage = vi.spyOn(Storage.prototype, "setItem"); const log = vi.spyOn(console, "log"); const errors = vi.spyOn(console, "error");
    const user = userEvent.setup(); const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const { container } = render(<DateTimeStation toolId={tool.id} />);
    const visibleFields = tool.dateTimeContract.fields.filter(field => !field.when);
    expect(Array.from(container.querySelectorAll<HTMLInputElement>("form input,form textarea,form select"), node => node.name)).toEqual(visibleFields.map(field => field.name));
    for (const field of visibleFields) expect(screen.getByLabelText(field.label)).toBeTruthy();
    for (const field of visibleFields.filter(field => field.control === "timezone")) expect((screen.getByLabelText(field.label) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Load example" }));
    screen.getByRole("button", { name: tool.dateTimeContract.action }).focus(); await user.keyboard("{Enter}");
    await screen.findAllByRole("button", { name: /^Copy / });
    const outputs = Array.from(container.querySelectorAll("pre"));
    expect(outputs.map(node => node.getAttribute("aria-label")?.replace(/ value$/, ""))).toEqual(tool.dateTimeContract.outputs);
    const copies = screen.getAllByRole("button", { name: /^Copy / });
    for (let index = 0; index < copies.length; index++) { copies[index].focus(); await user.keyboard("{Enter}"); expect(copy).toHaveBeenLastCalledWith(outputs[index].textContent); }
    screen.getByRole("button", { name: "Clear" }).focus(); await user.keyboard("{Enter}");
    for (const field of visibleFields) expect((screen.getByLabelText(field.label) as HTMLInputElement).value).toBe(tool.dateTimeContract.defaults[field.name]);
    expect(container.querySelector("pre")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
    expect(fetch).not.toHaveBeenCalled(); expect(xhr).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
  });
});

describe("Date & Time validation and route state", () => {
  it.each(dateTimeTools)("$slug empty inputs show accessible validation without crashing", async tool => {
    const { container } = render(<DateTimeStation toolId={tool.id} />);
    fireEvent.click(screen.getByRole("button", { name: tool.dateTimeContract.action }));
    const alert = await screen.findByRole("alert"); expect(alert.textContent).toContain("required");
    for (const field of container.querySelectorAll("form input,form textarea,form select")) expect(field.getAttribute("aria-describedby")).toContain(alert.id);
    expect(container.querySelector("pre")).toBeNull();
  });
  it("does not add timezone/unit fields to milliseconds or converter ISO input", () => {
    const { rerender } = render(<DateTimeStation toolId="unix-milliseconds-converter" />);
    expect(screen.queryByLabelText("Unit")).toBeNull(); expect(screen.queryByLabelText("Timezone")).toBeNull();
    rerender(<DateTimeStation toolId="iso-8601-converter" />); expect(screen.queryByLabelText("Timezone")).toBeNull();
  });
  it("requires offset-bearing ISO and retains invalid text", async () => {
    render(<DateTimeStation toolId="iso-8601-converter" />); set("ISO 8601 date/time", "2026-10-03T14:30:00");
    fireEvent.click(screen.getByRole("button", { name: "Normalize ISO 8601" })); expect((await screen.findByRole("alert")).textContent).toMatch(/explicit.*offset/);
    expect((screen.getByLabelText("ISO 8601 date/time") as HTMLInputElement).value).toBe("2026-10-03T14:30:00");
  });
  it.each([["2026-03-08", "02:30", /does not exist/], ["2026-11-01", "01:30", /occurs twice/]] as const)("rejects DST %s %s without adding a disambiguation setting", async (date, time, message) => {
    render(<DateTimeStation toolId="date-to-timestamp" />); set("Date", date); set("Time", time); set("Timezone", "America/New_York");
    fireEvent.click(screen.getByRole("button", { name: "Convert date to timestamp" })); expect((await screen.findByRole("alert")).textContent).toMatch(message);
    expect(screen.queryByRole("combobox", { name: /Repeated/ })).toBeNull(); expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe(time);
  });
  it("uses real directional routes and remounts correct inputs/results on direction changes", async () => {
    const { rerender, container } = render(<DateTimeStation toolId="date-to-timestamp" />);
    expect(screen.getByRole("link", { name: /Switch to Timestamp to Date/ }).getAttribute("href")).toBe("/tools/timestamp-to-date");
    fireEvent.click(screen.getByRole("button", { name: "Load example" })); fireEvent.click(screen.getByRole("button", { name: "Convert date to timestamp" })); await screen.findByLabelText("Unix seconds value");
    rerender(<DateTimeStation toolId="timestamp-to-date" />); expect(screen.queryByLabelText("Date")).toBeNull(); expect(container.querySelector("pre")).toBeNull();
    expect((screen.getByLabelText("Timestamp") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("link", { name: /Switch to Date to Timestamp/ }).getAttribute("href")).toBe("/tools/date-to-timestamp");
  });
  it("reads actual time on each refresh, not initial render or example load", async () => {
    render(<DateTimeStation toolId="current-time-in-timezone" />); set("Timezone", "UTC");
    expect(screen.queryByLabelText("Current date/time value")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Refresh time" }));
    expect((await screen.findByLabelText("Current date/time value")).textContent).toContain("2026-10-03T12:00:00.000Z");
    vi.setSystemTime(new Date("2026-10-03T12:01:00Z")); fireEvent.click(screen.getByRole("button", { name: "Refresh time" }));
    await waitFor(() => expect(screen.getByLabelText("Current date/time value").textContent).toContain("12:01:00.000Z"));
  });
  it("supports keyboard custom-weekend choice and avoids duplicate/weekend holiday deductions", async () => {
    const user = userEvent.setup(); render(<DateTimeStation toolId="business-days-calculator" />);
    await user.click(screen.getByRole("button", { name: "Load example" })); await user.selectOptions(screen.getByLabelText("Weekend definition"), "Custom weekend");
    const sunday = screen.getByRole("checkbox", { name: "Sunday" }); sunday.focus(); await user.keyboard(" ");
    set("Holidays (optional)", "2026-10-02\n2026-10-02\n2026-10-04"); await user.click(screen.getByRole("button", { name: "Calculate business days" }));
    expect((await screen.findByLabelText("Business days value")).textContent).toBe("8"); expect(screen.getByLabelText("Excluded holiday count value").textContent).toBe("1");
    await user.click(screen.getByRole("button", { name: "Clear" })); expect(screen.queryByRole("checkbox", { name: "Sunday" })).toBeNull();
  });
  it("invalidates old results on edits and handles clipboard denial", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied")); render(<DateTimeStation toolId="leap-year-checker" />);
    set("Year", "2000"); await user.click(screen.getByRole("button", { name: "Check leap year" })); await user.click(await screen.findByRole("button", { name: "Copy Is leap year" }));
    expect(screen.getByRole("status").textContent).toContain("Could not copy"); set("Year", "1900"); expect(screen.queryByLabelText("Is leap year value")).toBeNull();
  });
});
