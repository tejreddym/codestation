import { localDefinition, type LocalDefinition } from "./local-contract";
import { POMODORO_DEFAULT_SETTINGS } from "@/lib/tools/productivity/pomodoro";

export const productivityToolIds = ["pomodoro-timer", "invoice-generator"] as const;
export type ProductivityToolId = (typeof productivityToolIds)[number];

const pomodoroBase = localDefinition<ProductivityToolId>(
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

const invoiceBase = localDefinition<ProductivityToolId>(
  "invoice-generator",
  "Invoice Generator",
  "Productivity",
  [
    { name: "invoiceNumber", label: "Invoice Number", control: "text" },
    { name: "currency", label: "Currency", control: "select", options: ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"] },
    { name: "fromName", label: "Your Business Name", control: "text" },
    { name: "toName", label: "Client Name", control: "text" },
    { name: "taxRate", label: "Tax Rate (%)", control: "number", min: 0, max: 100 },
    { name: "discount", label: "Discount", control: "number", min: 0 },
    { name: "template", label: "Template Design", control: "select", options: ["Modern", "Classic", "Minimalist"] },
  ],
  [
    "Interactive single & bulk invoice builder",
    "Real-time vector PDF preview & download",
    "Direct browser Save as PDF print layout",
    "Client-side logo upload and memory isolation",
    "Bulk invoice ZIP generation",
  ],
  {
    invoiceNumber: "INV-2026-001",
    currency: "USD",
    fromName: "Acme Web Studio LLC",
    toName: "Starlight Interactive Inc.",
    taxRate: 8.5,
    discount: 5,
    template: "Modern",
  },
  [
    "100% in-browser processing. Invoices, uploaded logos, client names, and financial amounts are kept in local memory and never uploaded or logged.",
    "Generate single invoices or batch-create bulk invoices with automatic sequential numbering, multi-currency support, and instant ZIP or PDF export.",
  ],
  "Generate Invoice",
);

export const productivityTools: readonly LocalDefinition<ProductivityToolId>[] = [
  {
    ...pomodoroBase,
    description: "Run a local focus and break cycle with absolute-time countdowns, configurable session lengths, optional auto-start and a completion beep. Nothing is saved or sent.",
    keywords: ["pomodoro", "timer", "focus", "break", "productivity", "countdown", "time management"],
    relatedTools: ["invoice-generator", "unix-timestamp-converter", "cron-validator", "text-counter"],
    seo: {
      title: "Pomodoro Timer — Focus and Break Cycles",
      description: "Use a private Pomodoro timer with configurable focus and break lengths, automatic session transitions and drift-resistant countdowns in your browser.",
    },
  },
  {
    ...invoiceBase,
    description: "Create professional single or bulk invoices in your browser with logo upload, line-item calculations, customizable taxes and discounts, and vector PDF or ZIP download.",
    keywords: ["invoice", "generator", "invoice maker", "billing", "pdf", "receipt", "bulk invoices", "line items", "tax calculator", "freelance"],
    relatedTools: ["pomodoro-timer", "gst-calculator", "emi-calculator", "csv-to-json"],
    seo: {
      title: "Invoice Generator — Free In-Browser Invoices with PDF & Bulk Export",
      description: "Create customizable single or bulk invoices locally in your browser. Upload logos, configure currencies and taxes, edit line items, and download clean vector PDFs or ZIP batches.",
    },
  },
];

export const getProductivityDefinition = (id: string) => productivityTools.find(tool => tool.id === id);
export const isProductivityToolId = (id: string): id is ProductivityToolId => (productivityToolIds as readonly string[]).includes(id);
