"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Checkbox, TextInput } from "./ui/controls";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { PrivacyNote } from "./ui/PrivacyNote";
import { ProgressBar } from "./ui/ProgressBar";
import { StatusLine } from "./ui/StatusLine";
import { ToolLayout } from "./ui/ToolLayout";
import styles from "./PomodoroTimer.module.css";
import {
  POMODORO_DEFAULT_SETTINGS,
  POMODORO_MAX_MINUTES,
  POMODORO_MAX_SESSIONS,
  POMODORO_MIN_MINUTES,
  POMODORO_MIN_SESSIONS,
  POMODORO_PHASE_LABELS,
  completionAnnouncement,
  durationMsForPhase,
  elapsedSeconds,
  formatPomodoroClock,
  nextSession,
  skippedSession,
  validatePomodoroSettings,
  type PomodoroPhase,
  type PomodoroSettings,
  type PomodoroStatus,
} from "@/lib/tools/productivity/pomodoro";

const id = "pomodoro";

function phaseAction(phase: PomodoroPhase): string {
  return phase === "focus" ? "Start focus" : "Start break";
}

export default function PomodoroTimer() {
  const [settings, setSettings] = useState<PomodoroSettings>(POMODORO_DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<PomodoroPhase>("focus");
  const [status, setStatus] = useState<PomodoroStatus>("idle");
  const [remainingMs, setRemainingMs] = useState(() => durationMsForPhase("focus", POMODORO_DEFAULT_SETTINGS));
  const [endAt, setEndAt] = useState<number | null>(null);
  const [completed, setCompleted] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const audio = useRef<AudioContext | null>(null);
  const handledEnd = useRef<number | null>(null);

  const errors = validatePomodoroSettings(settings);
  const settingsValid = Object.keys(errors).length === 0;
  const totalMs = durationMsForPhase(phase, settings);
  const locked = status !== "idle";

  useEffect(() => () => {
    void audio.current?.close().catch(() => undefined);
    audio.current = null;
  }, []);

  function ensureAudio() {
    if (!settings.beep || audio.current) return;
    try {
      const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      audio.current = new AudioCtor();
      if (audio.current.state === "suspended") void audio.current.resume().catch(() => undefined);
    } catch {
      audio.current = null;
    }
  }

  function beep() {
    const context = audio.current;
    if (!context) return;
    try {
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    } catch {
      // A blocked or closed audio context must never interrupt the timer.
    }
  }

  useEffect(() => {
    if (status !== "running" || endAt === null) return;
    let active = true;

    const tick = () => {
      if (!active) return;
      const left = Math.max(0, endAt - performance.now());
      if (left > 0) {
        setRemainingMs(left);
        return;
      }
      if (handledEnd.current === endAt) return;
      handledEnd.current = endAt;

      const next = nextSession(phase, completed, settings.sessionsBeforeLongBreak);
      const nextMs = durationMsForPhase(next.phase, settings);
      setPhase(next.phase);
      setCompleted(next.completedFocusSessions);
      setRemainingMs(nextMs);
      setAnnouncement(completionAnnouncement(phase, next.phase, settings.autoStartNext));
      if (settings.beep) beep();

      if (settings.autoStartNext) {
        setEndAt(performance.now() + nextMs);
        setStatus("running");
      } else {
        setEndAt(null);
        setStatus("idle");
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, endAt, phase, completed, settings]);

  function update(next: Partial<PomodoroSettings>) {
    const candidate = { ...settings, ...next };
    setSettings(candidate);
    if (status === "idle" && Object.keys(validatePomodoroSettings(candidate)).length === 0) {
      setRemainingMs(durationMsForPhase(phase, candidate));
    }
  }

  function start() {
    if (!settingsValid) return;
    ensureAudio();
    handledEnd.current = null;
    setEndAt(performance.now() + Math.max(0, remainingMs));
    setStatus("running");
  }

  function pause() {
    if (status !== "running" || endAt === null) return;
    const left = Math.max(0, endAt - performance.now());
    handledEnd.current = null;
    setEndAt(null);
    setRemainingMs(left);
    setStatus("paused");
  }

  function resume() {
    if (status !== "paused") return;
    ensureAudio();
    handledEnd.current = null;
    setEndAt(performance.now() + Math.max(0, remainingMs));
    setStatus("running");
  }

  function reset() {
    handledEnd.current = null;
    setEndAt(null);
    setStatus("idle");
    setRemainingMs(durationMsForPhase(phase, settings));
  }

  function skip() {
    const next = skippedSession(phase, completed);
    const nextMs = durationMsForPhase(next.phase, settings);
    handledEnd.current = null;
    setEndAt(null);
    setStatus("idle");
    setPhase(next.phase);
    setCompleted(next.completedFocusSessions);
    setRemainingMs(nextMs);
    setAnnouncement(`Skipped ${POMODORO_PHASE_LABELS[phase].toLowerCase()}. ${POMODORO_PHASE_LABELS[next.phase]} ready.`);
  }

  const clock = formatPomodoroClock(remainingMs);
  const phaseLabel = POMODORO_PHASE_LABELS[phase];

  return (
    <div className={styles.pomodoroContainer}>
      <ToolLayout kind="form">
        <Panel title="Focus timer" headingId={`${id}-timer`} padded>
          <div className={styles.clockBlock}>
            <span className={styles.phase}>{phaseLabel}</span>
            <p className={styles.clock} aria-label={`${phaseLabel} timer: ${clock}`}>{clock}</p>
            <ProgressBar
              label="Session progress"
              value={elapsedSeconds(remainingMs, totalMs)}
              max={Math.max(1, Math.round(totalMs / 1000))}
            />
            <p className={styles.completed}>Completed focus sessions: <strong>{completed}</strong></p>
            <div className={styles.controls}>
              {status === "idle" && (
                <Button variant="primary" disabled={!settingsValid} onClick={start}>{phaseAction(phase)}</Button>
              )}
              {status === "running" && <Button variant="primary" onClick={pause}>Pause</Button>}
              {status === "paused" && <Button variant="primary" onClick={resume}>Resume</Button>}
              <Button onClick={reset}>Reset timer</Button>
              <Button onClick={skip}>Skip</Button>
            </div>
            <StatusLine className={styles.announcement}>{announcement}</StatusLine>
          </div>
        </Panel>

        <Panel title="Session settings" headingId={`${id}-settings`} padded>
          <div className={styles.settings}>
            <Field id={`${id}-focus`} label="Focus minutes" error={errors.focusMinutes}>
              <TextInput
                id={`${id}-focus`}
                type="number"
                min={POMODORO_MIN_MINUTES}
                max={POMODORO_MAX_MINUTES}
                step="1"
                inputMode="numeric"
                value={settings.focusMinutes}
                disabled={locked}
                aria-invalid={errors.focusMinutes ? true : undefined}
                aria-describedby={errors.focusMinutes ? `${id}-focus-error` : undefined}
                onChange={event => update({ focusMinutes: Number(event.target.value) })}
              />
            </Field>
            <Field id={`${id}-short`} label="Short break minutes" error={errors.shortBreakMinutes}>
              <TextInput
                id={`${id}-short`}
                type="number"
                min={POMODORO_MIN_MINUTES}
                max={POMODORO_MAX_MINUTES}
                step="1"
                inputMode="numeric"
                value={settings.shortBreakMinutes}
                disabled={locked}
                aria-invalid={errors.shortBreakMinutes ? true : undefined}
                aria-describedby={errors.shortBreakMinutes ? `${id}-short-error` : undefined}
                onChange={event => update({ shortBreakMinutes: Number(event.target.value) })}
              />
            </Field>
            <Field id={`${id}-long`} label="Long break minutes" error={errors.longBreakMinutes}>
              <TextInput
                id={`${id}-long`}
                type="number"
                min={POMODORO_MIN_MINUTES}
                max={POMODORO_MAX_MINUTES}
                step="1"
                inputMode="numeric"
                value={settings.longBreakMinutes}
                disabled={locked}
                aria-invalid={errors.longBreakMinutes ? true : undefined}
                aria-describedby={errors.longBreakMinutes ? `${id}-long-error` : undefined}
                onChange={event => update({ longBreakMinutes: Number(event.target.value) })}
              />
            </Field>
            <Field
              id={`${id}-sessions`}
              label="Focus sessions before a long break"
              error={errors.sessionsBeforeLongBreak}
            >
              <TextInput
                id={`${id}-sessions`}
                type="number"
                min={POMODORO_MIN_SESSIONS}
                max={POMODORO_MAX_SESSIONS}
                step="1"
                inputMode="numeric"
                value={settings.sessionsBeforeLongBreak}
                disabled={locked}
                aria-invalid={errors.sessionsBeforeLongBreak ? true : undefined}
                aria-describedby={errors.sessionsBeforeLongBreak ? `${id}-sessions-error` : undefined}
                onChange={event => update({ sessionsBeforeLongBreak: Number(event.target.value) })}
              />
            </Field>
            <Checkbox
              id={`${id}-auto`}
              label="Automatically start the next session"
              checked={settings.autoStartNext}
              disabled={locked}
              onChange={event => update({ autoStartNext: event.target.checked })}
            />
            <Checkbox
              id={`${id}-beep`}
              label="Beep when a session completes"
              checked={settings.beep}
              disabled={locked}
              onChange={event => update({ beep: event.target.checked })}
            />
            <Hint>Settings lock while a session is running. Reset the timer to change them. A beep uses a short Web Audio oscillator only; no audio file is loaded.</Hint>
          </div>
        </Panel>
      </ToolLayout>
      <PrivacyNote>Timer state lives only in this page. Nothing is saved to local storage or IndexedDB, no notification permission is requested, and the page title is never changed.</PrivacyNote>
    </div>
  );
}
