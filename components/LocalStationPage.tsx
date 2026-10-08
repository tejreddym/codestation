import StationLanding from "./StationLanding";

/** Legacy adapter retained for existing station-page imports. */
export default function LocalStationPage({ stationId, notice }: { stationId: string; notice: string }) {
  return <StationLanding stationId={stationId} notice={notice} />;
}
