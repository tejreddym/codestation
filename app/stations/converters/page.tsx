import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/converters", "Converters Station", "Discover canonical browser-local conversion tools by format family.");
export default function ConvertersPage() { return <StationLanding stationId="converters" />; }
