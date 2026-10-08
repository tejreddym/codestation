import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";
export const metadata = metadataForRoute("/stations/image", "Image Station", "Convert, resize, compress, inspect, and transform images locally in your browser.");
export default function Page() { return <StationLanding stationId="image" notice="Files stay in this browser. Native PNG/JPEG/WebP output is byte-checked; AVIF decoding depends on browser support. PNG/JPG to AVIF are not exposed because a genuine encoder is not implemented. SVG uses a restrictive static subset. Favicon reuses one canonical Web tool route." />; }
