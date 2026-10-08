import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/web", "Web Station", "Inspect, generate, and transform common web URLs, metadata, headers, manifests, and browser-facing configuration locally.");
export default function WebStationPage() { return <StationLanding stationId="web" />; }
