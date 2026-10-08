import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/sql-database", "SQL & Database Station", "Format, validate, generate, inspect, and convert SQL and database structures locally without connecting to your database.");
export default function SqlDatabaseStationPage() { return <StationLanding stationId="sql-database" />; }
