import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/cron", "Cron Station", "Generate, explain and validate cron schedules, convert supported human descriptions, and calculate the next occurrence locally.");
export default function CronStationPage() { return <StationLanding stationId="cron" />; }
