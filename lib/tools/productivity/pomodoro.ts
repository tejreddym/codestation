/** Pure state transitions and validation for a browser-only Pomodoro timer. */

export type PomodoroPhase = "focus" | "short-break" | "long-break";
export type PomodoroStatus = "idle" | "running" | "paused";

export type PomodoroDurations = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
};

export type PomodoroSettings = PomodoroDurations & {
  sessionsBeforeLongBreak: number;
  autoStartNext: boolean;
  beep: boolean;
};

export const POMODORO_MIN_MINUTES = 1;
export const POMODORO_MAX_MINUTES = 120;
export const POMODORO_MIN_SESSIONS = 2;
export const POMODORO_MAX_SESSIONS = 8;

export const POMODORO_DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: false,
  beep: false,
};

export const POMODORO_PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

export type PomodoroSettingsErrors = Partial<Record<"focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "sessionsBeforeLongBreak", string>>;

export function validatePomodoroSettings(settings: PomodoroSettings): PomodoroSettingsErrors {
  const errors: PomodoroSettingsErrors = {};
  const minutes = (key: "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes", label: string) => {
    const value = settings[key];
    if (!Number.isInteger(value)) errors[key] = `${label} must be a whole number of minutes.`;
    else if (value < POMODORO_MIN_MINUTES || value > POMODORO_MAX_MINUTES) {
      errors[key] = `${label} must be between ${POMODORO_MIN_MINUTES} and ${POMODORO_MAX_MINUTES} minutes.`;
    }
  };
  minutes("focusMinutes", "Focus length");
  minutes("shortBreakMinutes", "Short break length");
  minutes("longBreakMinutes", "Long break length");
  const sessions = settings.sessionsBeforeLongBreak;
  if (!Number.isInteger(sessions)) errors.sessionsBeforeLongBreak = "Sessions before a long break must be a whole number.";
  else if (sessions < POMODORO_MIN_SESSIONS || sessions > POMODORO_MAX_SESSIONS) {
    errors.sessionsBeforeLongBreak = `Sessions before a long break must be between ${POMODORO_MIN_SESSIONS} and ${POMODORO_MAX_SESSIONS}.`;
  }
  return errors;
}

export function durationMsForPhase(phase: PomodoroPhase, durations: PomodoroDurations): number {
  const minutes = phase === "focus"
    ? durations.focusMinutes
    : phase === "long-break"
      ? durations.longBreakMinutes
      : durations.shortBreakMinutes;
  return Math.max(0, Math.round(minutes * 60_000));
}

/** A completed focus session advances the completed count; breaks return to focus. */
export function nextSession(
  phase: PomodoroPhase,
  completedFocusSessions: number,
  sessionsBeforeLongBreak: number,
): { phase: PomodoroPhase; completedFocusSessions: number } {
  if (phase !== "focus") return { phase: "focus", completedFocusSessions };
  const completed = completedFocusSessions + 1;
  return {
    phase: completed % sessionsBeforeLongBreak === 0 ? "long-break" : "short-break",
    completedFocusSessions: completed,
  };
}

/** Skipping does not count a focus session as completed. */
export function skippedSession(
  phase: PomodoroPhase,
  completedFocusSessions: number,
): { phase: PomodoroPhase; completedFocusSessions: number } {
  return { phase: phase === "focus" ? "short-break" : "focus", completedFocusSessions };
}

/** Rounds up so a fresh 25-minute timer reads 25:00, and never shows a negative time. */
export function formatPomodoroClock(remainingMs: number): string {
  const totalSeconds = Number.isFinite(remainingMs) ? Math.max(0, Math.ceil(remainingMs / 1000)) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function elapsedSeconds(remainingMs: number, totalMs: number): number {
  if (!Number.isFinite(remainingMs) || !Number.isFinite(totalMs) || totalMs <= 0) return 0;
  return Math.max(0, Math.min(Math.round(totalMs / 1000), Math.round((totalMs - remainingMs) / 1000)));
}

export function completionAnnouncement(
  phase: PomodoroPhase,
  nextPhase: PomodoroPhase,
  autoStart: boolean,
): string {
  const nextLabel = POMODORO_PHASE_LABELS[nextPhase];
  return `${POMODORO_PHASE_LABELS[phase]} session complete. ${nextLabel} ${autoStart ? "started" : "ready"}.`;
}
