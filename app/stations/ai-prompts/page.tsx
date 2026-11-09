import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
import { getStation } from "@/config/stations";
import AiPromptsStation from "@/components/AiPromptsStation";

export const metadata = metadataForRoute(
  "/stations/ai-prompts",
  "AI & Prompt Engineering Station",
  "AI prompt construction, token estimation, LLM JSON repair, and vector calculations run entirely in your browser with zero server uploads or external LLM API calls."
);

export default function AiPromptsStationPage() {
  const station = getStation("ai-prompts");
  if (station) {
    return (
      <StationLanding
        stationId="ai-prompts"
        notice="AI prompt construction, token estimation, and vector calculations run entirely in your browser with zero server uploads or external LLM API calls."
      />
    );
  }

  return (
    <main className="shell">
      <section className="tool-page station-page">
        <AiPromptsStation />
      </section>
    </main>
  );
}
