import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/spreadsheet", "Spreadsheet Station", "View, inspect, clean, convert, and transform spreadsheet data locally in your browser.");
export default function Page() { return <StationLanding stationId="spreadsheet" notice="XLSX processing stays in a local worker. Macros are never executed; formulas use cached results and are not recalculated. Text exports protect against formula injection. Workbook metadata retention is limited to supported values/styles/sizing." />; }
