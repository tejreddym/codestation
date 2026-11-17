import { localDefinition, type LocalDefinition } from "./local-contract";
import { POMODORO_DEFAULT_SETTINGS } from "@/lib/tools/productivity/pomodoro";

export const productivityToolIds = ["pomodoro-timer"] as const;
export type ProductivityToolId = (typeof productivityToolIds)[number];

const base = localDefinition<ProductivityToolId>(
  "pomodoro-timer",
  "Pomodoro Timer",
  "Productivity",
  [
    { name: "focus", label: "Focus minutes", control: "number", min: 1, max: 120 },
    { name: "shortBreak", label: "Short break minutes", control: "number", min: 1, max: 120 },
    { name: "longBreak", label: "Long break minutes", control: "number", min: 1, max: 120 },
    { name: "sessions", label: "Focus sessions before a long break", control: "number", min: 2, max: 8 },
    { name: "autoStart", label: "Automatically start the next session", control: "checkbox" },
    { name: "beep", label: "Beep when a session completes", control: "checkbox" },
  ],
  ["Focus and break countdown", "Completed focus sessions"],
  {
    focus: String(POMODORO_DEFAULT_SETTINGS.focusMinutes),
    shortBreak: String(POMODORO_DEFAULT_SETTINGS.shortBreakMinutes),
    longBreak: String(POMODORO_DEFAULT_SETTINGS.longBreakMinutes),
    sessions: String(POMODORO_DEFAULT_SETTINGS.sessionsBeforeLongBreak),
    autoStart: POMODORO_DEFAULT_SETTINGS.autoStartNext,
    beep: POMODORO_DEFAULT_SETTINGS.beep,
  },
  [
    "The countdown uses absolute timestamps, so background-tab throttling does not make it drift. No timer state is saved after you leave or reload the page.",
    "No browser notification permission is requested and the document title is never changed. Completion is announced politely in the page and can optionally use a short Web Audio beep.",
  ],
  "Start focus session",
);

export const productivityTools: readonly LocalDefinition<ProductivityToolId>[] = [
  {
    ...base,
    description: "Run a local focus and break cycle with absolute-time countdowns, configurable session lengths, optional auto-start and a completion beep. Nothing is saved or sent.",
    keywords: ["pomodoro", "timer", "focus", "break", "productivity", "countdown", "time management"],
    relatedTools: ["unix-timestamp-converter", "cron-validator", "text-counter"],
    seo: {
      title: "Pomodoro Timer — Focus and Break Cycles",
      description: "Use a private Pomodoro timer with configurable focus and break lengths, automatic session transitions and drift-resistant countdowns in your browser.",
    },
  },
];

export const getProductivityDefinition = (id: string) => productivityTools.find(tool => tool.id === id);
export const isProductivityToolId = (id: string): id is ProductivityToolId => (productivityToolIds as readonly string[]).includes(id);
