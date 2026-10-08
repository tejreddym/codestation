"use client";

import { useEffect, useId, useRef, useState } from "react";
import Clock from "react-clock";
import { Clock as ClockIcon } from "lucide-react";
import "react-clock/dist/Clock.css";
import styles from "./CalendarPicker.module.css";

export interface TimePickerProps {
  /** Explicit SSR-stable ID supplied by a scoped tool workspace. */
  id?: string;
  label: string;
  /** Value in HH:mm or HH:mm:ss format */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
}

function parseTimeToDate(timeStr: string): Date {
  const date = new Date();
  const parts = timeStr.trim().split(":");
  const h = parts[0] ? Number(parts[0]) : 0;
  const m = parts[1] ? Number(parts[1]) : 0;
  const s = parts[2] ? Number(parts[2].slice(0, 2)) : 0;
  date.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, Number.isNaN(s) ? 0 : s, 0);
  return date;
}

function formatTime(date: Date, includeSeconds = false): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  if (!includeSeconds) return `${h}:${m}`;
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function TimePicker({
  id: explicitId,
  label,
  value,
  onChange,
  hint,
  placeholder = "HH:mm",
  maxLength = 16,
}: TimePickerProps) {
  const generatedId = useId();
  const id = explicitId ?? generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Time date object for react-clock
  const clockDate = parseTimeToDate(value || "12:00");

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.slice(0, maxLength));
  };

  const updateHours = (delta: number) => {
    const next = new Date(clockDate.getTime());
    next.setHours((next.getHours() + delta + 24) % 24);
    onChange(formatTime(next, value.split(":").length > 2));
  };

  const updateMinutes = (delta: number) => {
    const next = new Date(clockDate.getTime());
    next.setMinutes((next.getMinutes() + delta + 60) % 60);
    onChange(formatTime(next, value.split(":").length > 2));
  };

  const setNow = () => {
    const now = new Date();
    onChange(formatTime(now, false));
  };

  const setPreset = (preset: string) => {
    onChange(preset);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const currentHours = String(clockDate.getHours()).padStart(2, "0");
  const currentMinutes = String(clockDate.getMinutes()).padStart(2, "0");

  return (
    <div className={styles.pickerField} ref={containerRef}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrapper}>
        <input
          id={id}
          className={styles.input}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={hint ? `${id}-hint` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <div className={styles.iconGroup}>
          <button
            type="button"
            className={`${styles.iconButton} ${open ? styles.iconButtonActive : ""}`}
            onClick={() => setOpen(!open)}
            aria-label={`Open clock for ${label}`}
            tabIndex={-1}
          >
            <ClockIcon size={15} />
          </button>
        </div>
      </div>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={`Clock picker for ${label}`}>
          <div className={styles.clockSection}>
            <div className={styles.clockContainer}>
              <Clock
                value={clockDate}
                size={145}
                renderNumbers={true}
                renderHourMarks={true}
                renderMinuteMarks={true}
              />
            </div>

            <div className={styles.digitalReadout}>
              {currentHours} : {currentMinutes}
            </div>

            <div className={styles.clockSteppers}>
              <div className={styles.stepperUnit}>
                <span className={styles.stepperLabel}>Hour</span>
                <div className={styles.stepperControls}>
                  <button type="button" className={styles.stepperBtn} onClick={() => updateHours(-1)}>
                    −
                  </button>
                  <span className={styles.stepperValue}>{currentHours}</span>
                  <button type="button" className={styles.stepperBtn} onClick={() => updateHours(1)}>
                    +
                  </button>
                </div>
              </div>

              <div className={styles.stepperUnit}>
                <span className={styles.stepperLabel}>Minute</span>
                <div className={styles.stepperControls}>
                  <button type="button" className={styles.stepperBtn} onClick={() => updateMinutes(-5)}>
                    −5
                  </button>
                  <span className={styles.stepperValue}>{currentMinutes}</span>
                  <button type="button" className={styles.stepperBtn} onClick={() => updateMinutes(5)}>
                    +5
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.presetChips}>
              <button type="button" className={styles.presetChip} onClick={() => setPreset("00:00")}>
                00:00
              </button>
              <button type="button" className={styles.presetChip} onClick={() => setPreset("09:00")}>
                09:00
              </button>
              <button type="button" className={styles.presetChip} onClick={() => setPreset("12:00")}>
                12:00
              </button>
              <button type="button" className={styles.presetChip} onClick={() => setPreset("18:00")}>
                18:00
              </button>
              <button type="button" className={styles.presetChip} onClick={setNow}>
                Now
              </button>
            </div>
          </div>

          <div className={styles.popoverFooter}>
            <div className={styles.footerLeft}>
              <button type="button" className={styles.actionBtn} onClick={setNow}>
                Now
              </button>
              <button type="button" className={styles.actionBtn} onClick={handleClear}>
                Clear
              </button>
            </div>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {hint && (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
