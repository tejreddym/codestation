import { tools } from "./tools";
import { converterToolIds } from "./converter-tools";

export interface StationDefinition {
  id: string;
  name: string;
  description: string;
  route: string;
  icon: "station-mark";
  toolCount: number;
  toolList: readonly string[];
  relatedStations: readonly string[];
}
const stationId = (name: string) => name.toLowerCase().replace(/ & /g, "-").replace(/[^a-z0-9]+/g, "-");
const localStations: Record<string, { description: string; related: string[]; shared?: string[] }> = {
  "JSON & Data": { description: "Format, validate, compare, transform, and inspect structured data locally in your browser.", related: ["encoding", "spreadsheet", "text"] },
  Encoding: { description: "Encode, decode, inspect, and transform text and byte representations locally.", related: ["json-data", "security", "text"] },
  Security: { description: "Generate, hash, compare, and inspect security values locally with browser cryptography.", related: ["encoding", "regex", "date-time"] },
  Regex: { description: "Test, inspect, build, and transform regular expressions locally in your browser.", related: ["text", "security", "json-data"] },
  "Date & Time": { description: "Convert, compare, format, and inspect dates, times, timestamps, and timezones locally.", related: ["cron", "text", "encoding"] },
  Text: { description: "Count, transform, generate, compare, and inspect text locally in your browser.", related: ["regex", "encoding", "markdown"] },
  Image: { description: "Convert, resize, compress, inspect, and transform images locally in your browser.", related: ["web", "encoding"], shared: ["favicon-generator"] },
  Spreadsheet: { description: "View, inspect, clean, convert, and transform spreadsheet data locally in your browser.", related: ["json-data", "text"] },
  Markdown: { description: "Format, preview, convert, inspect, and generate Markdown locally.", related: ["json-data", "text"] },
  "Color & CSS": { description: "Convert colors, check text contrast, and generate editable CSS visuals locally in your browser.", related: ["image", "web", "text"] },
  Converters: { description: "Discover canonical browser-local conversion tools by format family, without duplicating their owning stations.", related: ["json-data", "encoding", "image", "spreadsheet", "markdown", "color-css", "date-time", "text", "sql-database", "api"] },
  PDF: { description: "Merge, split, rotate, convert, and inspect PDF documents locally in your browser with zero server uploads.", related: ["image", "spreadsheet", "text"] },
  "QR & Barcode": { description: "Generate and scan custom QR codes, standard barcodes, and digital signatures locally in your browser.", related: ["web", "image", "security"] },
  "Code Generation": { description: "Generate TypeScript types, Zod schemas, Go structs, Python Pydantic models, Rust Serde structs, and React JSX components locally.", related: ["json-data", "sql-database", "web"] },
  "Network & DevOps": { description: "Calculate CIDR subnets, convert IPv4/IPv6, decode SSL certificates, generate Dockerfiles, and compose configurations locally.", related: ["security", "web", "api"] },
  "Frontend & CSS": { description: "Build and preview CSS Grid, Flexbox layouts, keyframe animations, glassmorphism, clip-paths, and custom scrollbars visually.", related: ["color-css", "web", "image"] },
  "Developer Math": { description: "Inspect IEEE-754 floats, test bitwise operators, compute arbitrary-precision BigInts, and perform matrix operations locally.", related: ["encoding", "security", "numeric"] },
};
/** Explicitly implemented stations are the only public station destinations. */
const implementedStationNames = ["JSON & Data", "Encoding", "Security", "Regex", "Date & Time", "Text", "Cron", "SQL & Database", "Web", "API", "Image", "Spreadsheet", "Markdown", "Color & CSS", "Converters", "PDF", "QR & Barcode", "Code Generation", "Network & DevOps", "Frontend & CSS", "Developer Math"] as const;
const canonicalRoutes: Record<string, string> = Object.fromEntries(implementedStationNames.map(name => [name, `/stations/${stationId(name)}`]));
const unique = (ids: readonly string[]) => [...new Set(ids)];

export const stations: readonly StationDefinition[] = implementedStationNames.map(name => {
  const local = localStations[name];
  const categoryTools = name === "Converters" ? converterToolIds : tools.filter(tool => tool.category === name).map(tool => tool.id);
  const toolList = unique([...categoryTools, ...local?.shared ?? []]);
  return {
    id: stationId(name), name, icon: "station-mark", toolCount: toolList.length,
    toolList,
    route: canonicalRoutes[name],
    description: name === "API" ? "Build, convert, format, inspect, and test common HTTP, REST, and GraphQL requests without unnecessary server-side processing." : name === "Web" ? "Inspect, generate, and transform common web URLs, metadata, headers, manifests, and browser-facing configuration locally." : name === "SQL & Database" ? "Format, validate, generate, inspect, and convert SQL and database structures locally without connecting to your database." : name === "Cron" ? "Generate, explain and validate cron schedules, convert supported human descriptions, and calculate the next occurrence locally." : local?.description ?? `Tools for focused ${name.toLowerCase()} work.`,
    relatedStations: local?.related ?? (name === "API" ? ["web", "json-data", "encoding"] : name === "Web" ? ["encoding", "json-data", "text"] : name === "SQL & Database" ? ["json-data", "text", "cron"] : name === "Cron" ? ["date-time", "text", "regex"] : []),
  };
});
export function getStation(id: string) { return stations.find(station => station.id === id); }
export function getStationByName(name: string) { return stations.find(station => station.name === name); }
