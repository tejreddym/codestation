// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PomodoroTimer from "./PomodoroTimer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PomodoroTimer", () => {
  it("runs, pauses, resumes and completes a focus session into a short break", () => {
    render(<PomodoroTimer />);
    expect(screen.getByLabelText("Focus timer: 25:00")).toBeTruthy();
    expect(screen.getByText(/Completed focus sessions:/).textContent).toContain("0");

    fireEvent.click(screen.getByRole("button", { name: "Start focus" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.getByLabelText("Focus minutes")).toHaveProperty("disabled", true);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByLabelText("Focus timer: 24:59")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByLabelText("Focus timer: 24:59")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    act(() => {
      vi.advanceTimersByTime(25 * 60_000);
    });

    expect(screen.getByText("Short break", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText(/Short break timer: 04:5\d|Short break timer: 05:00/)).toBeTruthy();
    expect(screen.getByText(/Completed focus sessions:/).textContent).toContain("1");
    expect(screen.getByRole("status").textContent).toBe("Focus session complete. Short break ready.");
    expect(screen.getByRole("button", { name: "Start break" })).toBeTruthy();
  });

  it("rejects out-of-range settings and never writes browser storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<PomodoroTimer />);
    fireEvent.change(screen.getByLabelText("Focus minutes"), { target: { value: "0" } });
    expect(screen.getByText("Focus length must be between 1 and 120 minutes.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start focus" })).toHaveProperty("disabled", true);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("skips without counting a completed focus session", () => {
    render(<PomodoroTimer />);
    fireEvent.click(screen.getByRole("button", { name: "Start focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Short break", { exact: true })).toBeTruthy();
    expect(screen.getByText(/Completed focus sessions:/).textContent).toContain("0");
    expect(screen.getByRole("status").textContent).toBe("Skipped focus. Short break ready.");
  });
});
