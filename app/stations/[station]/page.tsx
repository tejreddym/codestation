import { notFound } from "next/navigation";
import StationLanding from "@/components/StationLanding";
import { getStation, stations } from "@/config/stations";
import { metadataForRoute } from "@/config/site";

const staticStationIds = new Set(["cron", "sql-database", "web", "api", "image", "spreadsheet", "markdown", "color-css", "converters"]);

export function generateStaticParams() {
  return stations.filter(station => !staticStationIds.has(station.id)).map(station => ({ station: station.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ station: string }> }) {
  const { station: id } = await params;
  const station = getStation(id);
   return station ? metadataForRoute(station.route, `${station.name} Station`, station.description) : {};
}

export default async function StationPage({ params }: { params: Promise<{ station: string }> }) {
  const { station: id } = await params;
  if (!getStation(id) || staticStationIds.has(id)) notFound();
  return <StationLanding stationId={id} />;
}
