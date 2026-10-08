import { ArrowRightLeft, Binary, Braces, CalendarDays, Clock3, Database, Globe2, Image, Palette, Regex, ShieldCheck, Table2, Type, Waypoints, type LucideIcon } from "lucide-react";

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
};

export default function StationMark({ large = false, label }: { large?: boolean; label?: string }) {
  const Icon = label ? stationIcons[label] : undefined;
  return <span className={`station-mark ${large ? "large" : ""}`} aria-hidden="true">{large && Icon ? <Icon size={21} strokeWidth={1.8} /> : <span>{"{ }"}</span>}{!large && <><i /><i /><i /></>}</span>;
}
