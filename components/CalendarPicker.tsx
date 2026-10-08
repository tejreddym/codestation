"use client";

import { useEffect, useId, useRef, useState } from "react";
import Calendar from "react-calendar";
import { Calendar as CalendarIcon, X } from "lucide-react";
import "react-calendar/dist/Calendar.css";
import styles from "./CalendarPicker.module.css";

export interface CalendarPickerProps {
  /** Stable field ID supplied by a containing form; otherwise React generates one. */
  id?: string;
  label: string;
  /** Internal value in YYYY-MM-DD format */
  value: string;
  /** Called with YYYY-MM-DD format */
  onChange: (value: string) => void;
  /** Hint text below the field */
  hint?: string;
  /** Min year allowed, default 1 */
  minYear?: number;
  /** Max year allowed, default 9999 */
  maxYear?: number;
}

function parseISO(iso: string): Date | null {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatISO(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDDMMYYYY(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d} ${m} ${y}`;
}

export default function CalendarPicker({
  id: explicitId,
  label,
  value,
  onChange,
  hint,
  minYear = 1,
  maxYear = 9999,
}: CalendarPickerProps) {
  const generatedId = useId();
  const id = explicitId ?? generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selectedDate = parseISO(value);
  const [typedValue, setTypedValue] = useState(selectedDate ? formatDDMMYYYY(selectedDate) : "");

  useEffect(() => {
    const parsed = parseISO(value);
    if (parsed) {
      setTypedValue(formatDDMMYYYY(parsed));
    } else {
      setTypedValue(value);
    }
  }, [value]);

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

  const handleDateSelect = (val: unknown) => {
    if (val instanceof Date) {
      onChange(formatISO(val));
      setOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTypedValue(raw);

    // Direct ISO input support (e.g. from fireEvent or typed YYYY-MM-DD)
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      onChange(raw);
      return;
    }

    // DD MM YYYY pattern support
    const dmyMatch = raw.match(/^(\d{2})[ \-\/.](\d{2})[ \-\/.](\d{4})$/);
    if (dmyMatch) {
      const d = Number(dmyMatch[1]);
      const m = Number(dmyMatch[2]) - 1;
      const y = Number(dmyMatch[3]);
      if (y >= minYear && y <= maxYear && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        const date = new Date(y, m, d);
        if (!Number.isNaN(date.getTime())) {
          onChange(formatISO(date));
          return;
        }
      }
    }

    if (!raw.trim()) {
      onChange("");
    }
  };

  const handleToday = () => {
    const now = new Date();
    onChange(formatISO(now));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setTypedValue("");
    setOpen(false);
  };

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
          value={typedValue}
          onChange={handleInputChange}
          placeholder="DD MM YYYY"
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
            aria-label={`Open calendar for ${label}`}
            tabIndex={-1}
          >
            <CalendarIcon size={15} />
          </button>
        </div>
      </div>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={`Calendar picker for ${label}`}>
          <Calendar
            value={selectedDate || new Date()}
            onChange={handleDateSelect}
            calendarType="iso8601"
            minDetail="decade"
            maxDetail="month"
            minDate={new Date(Math.max(1, minYear), 0, 1)}
            maxDate={new Date(Math.min(9999, maxYear), 11, 31)}
          />

          <div className={styles.popoverFooter}>
            <div className={styles.footerLeft}>
              <button type="button" className={styles.actionBtn} onClick={handleToday}>
                Today
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
