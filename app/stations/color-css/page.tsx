import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/color-css", "Color & CSS Station", "Convert colors, check text contrast, and generate editable CSS visuals locally in your browser.");
export default function Page() { return <StationLanding stationId="color-css" notice="Color calculations use sRGB locally. CSS generators produce validated declarations and keep previews bounded. Contrast results are scoped to text contrast." />; }
