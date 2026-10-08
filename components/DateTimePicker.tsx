"use client";

import { useEffect, useId, useRef, useState } from "react";
import Calendar from "react-calendar";
import Clock from "react-clock";
import { Calendar as CalendarIcon, Clock as ClockIcon } from "lucide-react";
import "react-calendar/dist/Calendar.css";
import "react-clock/dist/Clock.css";
import styles from "./CalendarPicker.module.css";

export interface DateTimePickerProps {
  /** Explicit SSR-stable ID supplied by a scoped tool workspace. */
  id?: string;
  name?: string;
  required?: boolean;
  ariaDescribedBy?: string;
  invalid?: boolean;
  label: string;
  /** UTC mode edits an absolute ISO instant with Z or an explicit offset. */
  mode?: "local" | "utc";
  /** Local ISO/partial value, or a raw absolute ISO reference in UTC mode. */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
}

function parseDateTimeParts(val: string): { date: Date; hasTime: boolean; hasDate: boolean } {
  const trimmed = val.trim();
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = trimmed.match(/[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hour = 12;
  let minute = 0;
  let second = 0;

  let hasDate = false;
  let hasTime = false;

  if (dateMatch) {
    year = Number(dateMatch[1]);
    month = Number(dateMatch[2]) - 1;
    day = Number(dateMatch[3]);
    hasDate = true;
  }

  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    second = timeMatch[3] ? Number(timeMatch[3]) : 0;
    hasTime = true;
  }

  const d = new Date(year, month, day, hour, minute, second);
  return { date: Number.isNaN(d.getTime()) ? now : d, hasDate, hasTime };
}

function buildIsoString(date: Date, includeTime = true): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (!includeTime) return `${y}-${m}-${d}`;

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

/** Validate before constructing an instant so impossible dates never roll over. */
function parseUtcReference(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[0] !== value) return null;
  const [year, month, day, hour, minute, second] = [
    match[1], match[2], match[3], match[4], match[5], match[6] ?? "0",
  ].map(Number);
  if (year < 1970 || year > 2099 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second, milliseconds));
  if (wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day) return null;
  let offset = 0;
  if (match[8] !== "Z") {
    const offsetHour = Number(match[8].slice(1, 3));
    const offsetMinute = Number(match[8].slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
    offset = (offsetHour * 60 + offsetMinute) * 60_000 * (match[8][0] === "-" ? -1 : 1);
  }
  const instant = new Date(wall.getTime() - offset);
  return instant.getUTCFullYear() >= 1970 && instant.getUTCFullYear() <= 2099 ? instant : null;
}

function utcPickerFallback(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
}

/** react-calendar reads local fields; represent the UTC day at local noon. */
function utcCalendarDate(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
}

export default function DateTimePicker({
  id: explicitId,
  name,
  required,
  ariaDescribedBy,
  invalid,
  label,
  mode = "local",
  value,
  onChange,
  hint,
  placeholder = "YYYY-MM-DDTHH:mm:ss",
  maxLength = 64,
}: DateTimePickerProps) {
  const generatedId = useId();
  const id = explicitId ?? generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"date" | "time">("date");

  const isUtc = mode === "utc";
  const activeDate = isUtc ? parseUtcReference(value) ?? utcPickerFallback() : parseDateTimeParts(value).date;
  const describedBy = [...new Set([...(ariaDescribedBy?.split(/\s+/) ?? []), hint ? `${id}-hint` : ""].filter(Boolean))].join(" ") || undefined;
  const emitDate = (date: Date) => onChange(isUtc ? date.toISOString() : buildIsoString(date, true));

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

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (isUtc) inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, isUtc]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(isUtc ? e.target.value : e.target.value.slice(0, maxLength));
  };

  const handleCalendarSelect = (val: unknown) => {
    if (val instanceof Date) {
      const next = new Date(activeDate.getTime());
      if (isUtc) next.setUTCFullYear(val.getFullYear(), val.getMonth(), val.getDate());
      else next.setFullYear(val.getFullYear(), val.getMonth(), val.getDate());
      emitDate(next);
    }
  };

  const updateHours = (delta: number) => {
    const next = new Date(activeDate.getTime());
    if (isUtc) next.setUTCHours((next.getUTCHours() + delta + 24) % 24);
    else next.setHours((next.getHours() + delta + 24) % 24);
    emitDate(next);
  };

  const updateMinutes = (delta: number) => {
    const next = new Date(activeDate.getTime());
    if (isUtc) next.setUTCMinutes((next.getUTCMinutes() + delta + 60) % 60);
    else next.setMinutes((next.getMinutes() + delta + 60) % 60);
    emitDate(next);
  };

  const setPresetTime = (preset: string) => {
    const [h, m] = preset.split(":").map(Number);
    const next = new Date(activeDate.getTime());
    if (isUtc) next.setUTCHours(h, m, 0, next.getUTCMilliseconds());
    else next.setHours(h, m, 0, 0);
    emitDate(next);
  };

  const setNow = () => {
    const now = new Date();
    emitDate(now);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const openWithTab = (tab: "date" | "time") => {
    setActiveTab(tab);
    setOpen(true);
  };

  const currentHours = String(isUtc ? activeDate.getUTCHours() : activeDate.getHours()).padStart(2, "0");
  const currentMinutes = String(isUtc ? activeDate.getUTCMinutes() : activeDate.getMinutes()).padStart(2, "0");
  const currentSeconds = String(activeDate.getUTCSeconds()).padStart(2, "0");

  return (
    <div className={styles.pickerField} ref={containerRef}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrapper}>
        <input
          id={id}
          ref={inputRef}
          name={name}
          required={required}
          className={`${styles.input} ${styles.inputWithTwoIcons}`}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={isUtc ? (event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              openWithTab("date");
            }
          } : undefined}
          placeholder={placeholder}
          maxLength={isUtc ? undefined : maxLength}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete="off"
          spellCheck={false}
        />
        <div className={styles.iconGroup}>
          <button
            type="button"
            className={`${styles.iconButton} ${open && activeTab === "date" ? styles.iconButtonActive : ""}`}
            onClick={() => openWithTab("date")}
            aria-label={`Open calendar for ${label}`}
            tabIndex={isUtc ? 0 : -1}
            title="Select date and year"
          >
            <CalendarIcon size={15} />
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${open && activeTab === "time" ? styles.iconButtonActive : ""}`}
            onClick={() => openWithTab("time")}
            aria-label={`Open clock for ${label}`}
            tabIndex={isUtc ? 0 : -1}
            title="Select time"
          >
            <ClockIcon size={15} />
          </button>
        </div>
      </div>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={`${isUtc ? "UTC date" : "Date"} and time picker for ${label}`}>
          {isUtc && <p className={styles.hint}>Calendar and clock edits use UTC. Selections return an ISO instant ending in Z.</p>}
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "date" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("date")}
            >
              <CalendarIcon size={13} />
              Date & Year
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "time" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("time")}
            >
              <ClockIcon size={13} />
              Time (Clock)
            </button>
          </div>

          {activeTab === "date" ? (
            <Calendar
              value={isUtc ? utcCalendarDate(activeDate) : activeDate}
              onChange={handleCalendarSelect}
              calendarType="iso8601"
              minDetail="decade"
              maxDetail="month"
              minDate={isUtc ? new Date(1970, 0, 1) : new Date(1, 0, 1)}
              maxDate={isUtc ? new Date(2099, 11, 31) : new Date(9999, 11, 31)}
              showNeighboringMonth={isUtc ? false : undefined}
            />
          ) : (
            <div className={styles.clockSection}>
              <div className={styles.clockContainer}>
                <Clock
                  value={isUtc ? `${currentHours}:${currentMinutes}:${currentSeconds}` : activeDate}
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
                    <button type="button" className={styles.stepperBtn} onClick={() => updateHours(-1)} aria-label={isUtc ? "Decrease hour" : undefined}>
                      −
                    </button>
                    <span className={styles.stepperValue}>{currentHours}</span>
                    <button type="button" className={styles.stepperBtn} onClick={() => updateHours(1)} aria-label={isUtc ? "Increase hour" : undefined}>
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.stepperUnit}>
                  <span className={styles.stepperLabel}>Minute</span>
                  <div className={styles.stepperControls}>
                    <button type="button" className={styles.stepperBtn} onClick={() => updateMinutes(-5)} aria-label={isUtc ? "Decrease minute by 5" : undefined}>
                      −5
                    </button>
                    <span className={styles.stepperValue}>{currentMinutes}</span>
                    <button type="button" className={styles.stepperBtn} onClick={() => updateMinutes(5)} aria-label={isUtc ? "Increase minute by 5" : undefined}>
                      +5
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.presetChips}>
                <button type="button" className={styles.presetChip} onClick={() => setPresetTime("00:00")}>
                  00:00
                </button>
                <button type="button" className={styles.presetChip} onClick={() => setPresetTime("09:00")}>
                  09:00
                </button>
                <button type="button" className={styles.presetChip} onClick={() => setPresetTime("12:00")}>
                  12:00
                </button>
                <button type="button" className={styles.presetChip} onClick={() => setPresetTime("18:00")}>
                  18:00
                </button>
                <button type="button" className={styles.presetChip} onClick={setNow}>
                  Now
                </button>
              </div>
            </div>
          )}

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
