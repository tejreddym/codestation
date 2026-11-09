import StationLanding from "@/components/StationLanding";
import { metadataForRoute } from "@/config/site";

export const metadata = metadataForRoute(
  "/stations/crypto-pki",
  "WebPKI & Advanced Cryptography Station",
  "Cryptographic key generation, AES-GCM operations, CSR inspection, and JWT signing run locally using Web Crypto API. Private keys and secrets never leave your device."
);

export default function CryptoPkiStationPage() {
  return <StationLanding stationId="crypto-pki" />;
}
