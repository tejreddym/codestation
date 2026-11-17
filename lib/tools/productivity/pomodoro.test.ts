import { describe, expect, it } from "vitest";
import type { PomodoroPhase } from "./pomodoro";
import {
  POMODORO_DEFAULT_SETTINGS,
  completionAnnouncement,
  durationMsForPhase,
  elapsedSeconds,
  formatPomodoroClock,
  nextSession,
  skippedSession,
  validatePomodoroSettings,
} from "./pomodoro";

describe("Pomodoro helpers", () => {
  it("accepts the default plan and rejects out-of-range durations and session counts", () => {
    expect(validatePomodoroSettings(POMODORO_DEFAULT_SETTINGS)).toEqual({});
    expect(validatePomodoroSettings({
      ...POMODORO_DEFAULT_SETTINGS,
      focusMinutes: 0,
      shortBreakMinutes: 121,
      longBreakMinutes: 4.5,
      sessionsBeforeLongBreak: 9,
    })).toEqual({
      focusMinutes: "Focus length must be between 1 and 120 minutes.",
      shortBreakMinutes: "Short break length must be between 1 and 120 minutes.",
      longBreakMinutes: "Long break length must be a whole number of minutes.",
      sessionsBeforeLongBreak: "Sessions before a long break must be between 2 and 8.",
    });
    expect(validatePomodoroSettings({ ...POMODORO_DEFAULT_SETTINGS, sessionsBeforeLongBreak: 1 }).sessionsBeforeLongBreak).toBeDefined();
  });

  it("derives phase durations from configured minutes", () => {
    expect(durationMsForPhase("focus", POMODORO_DEFAULT_SETTINGS)).toBe(25 * 60_000);
    expect(durationMsForPhase("short-break", POMODORO_DEFAULT_SETTINGS)).toBe(5 * 60_000);
    expect(durationMsForPhase("long-break", POMODORO_DEFAULT_SETTINGS)).toBe(15 * 60_000);
  });

  it("inserts a long break after every configured number of completed focus sessions", () => {
    let state: { phase: PomodoroPhase; completedFocusSessions: number } = { phase: "focus", completedFocusSessions: 0 };
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    expect(state).toEqual({ phase: "short-break", completedFocusSessions: 1 });
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    expect(state).toEqual({ phase: "focus", completedFocusSessions: 1 });
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    expect(state).toEqual({ phase: "focus", completedFocusSessions: 2 });
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    expect(state).toEqual({ phase: "long-break", completedFocusSessions: 4 });
    state = nextSession(state.phase, state.completedFocusSessions, 4);
    expect(state).toEqual({ phase: "focus", completedFocusSessions: 4 });
  });

  it("does not count a skipped focus session", () => {
    expect(skippedSession("focus", 2)).toEqual({ phase: "short-break", completedFocusSessions: 2 });
    expect(skippedSession("short-break", 2)).toEqual({ phase: "focus", completedFocusSessions: 2 });
    expect(skippedSession("long-break", 4)).toEqual({ phase: "focus", completedFocusSessions: 4 });
  });

  it("formats a countdown without drift artefacts or negative values", () => {
    expect(formatPomodoroClock(25 * 60_000)).toBe("25:00");
    expect(formatPomodoroClock(59_001)).toBe("01:00");
    expect(formatPomodoroClock(1)).toBe("00:01");
    expect(formatPomodoroClock(0)).toBe("00:00");
    expect(formatPomodoroClock(-100)).toBe("00:00");
    expect(formatPomodoroClock(120 * 60_000)).toBe("120:00");
    expect(elapsedSeconds(24 * 60_000, 25 * 60_000)).toBe(60);
    expect(elapsedSeconds(0, 25 * 60_000)).toBe(1500);
    expect(elapsedSeconds(0, 0)).toBe(0);
  });

  it("announces completion with the next phase only", () => {
    expect(completionAnnouncement("focus", "short-break", false)).toBe("Focus session complete. Short break ready.");
    expect(completionAnnouncement("focus", "long-break", true)).toBe("Focus session complete. Long break started.");
  });
});
