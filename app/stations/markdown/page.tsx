import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/markdown", "Markdown Station", "Format, preview, convert, inspect, and generate Markdown locally.");
export default function Page() { return <StationLanding stationId="markdown" notice="Markdown is processed in this browser. Generated HTML is sanitized inert text; links are not followed, but remote image URLs in a preview may be requested by the browser." />; }
