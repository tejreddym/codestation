import {
  ArrowRightLeft,
  Binary,
  Braces,
  Calculator,
  CalendarDays,
  Clock3,
  Code2,
  Database,
  FileText,
  Globe2,
  Image,
  Layout,
  Network,
  Palette,
  QrCode,
  Regex,
  ShieldCheck,
  Table2,
  Type,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

const stationIcons: Record<string, LucideIcon> = {
  "JSON & Data": Braces,
  Encoding: Binary,
  Security: ShieldCheck,
  Regex,
  "Date & Time": Clock3,
  Text: Type,
  Cron: CalendarDays,
  "SQL & Database": Database,
  Web: Globe2,
  API: Waypoints,
  Image,
  Spreadsheet: Table2,
  Markdown: Type,
  "Color & CSS": Palette,
  Converters: ArrowRightLeft,
  PDF: FileText,
  "QR & Barcode": QrCode,
  "Code Generation": Code2,
  "Network & DevOps": Network,
  "Frontend & CSS": Layout,
  "Developer Math": Calculator,
};

export default function StationMark({ large = false, label }: { large?: boolean; label?: string }) {
  const Icon = label ? stationIcons[label] : undefined;
  return <span className={`station-mark ${large ? "large" : ""}`} aria-hidden="true">{large && Icon ? <Icon size={21} strokeWidth={1.8} /> : <span>{"{ }"}</span>}{!large && <><i /><i /><i /></>}</span>;
}
