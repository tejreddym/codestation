import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/api", "API Station", "Build, convert, format, inspect, and test common HTTP, REST, and GraphQL requests without unnecessary server-side processing.");
export default function ApiStationPage() { return <StationLanding stationId="api" />; }
