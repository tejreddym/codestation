import { getSecurityDefinition } from "@/config/security-tools";
import type { SecurityRequest, SecurityResult } from "./types";

/** Dispatch without logging, persisting, serializing to a URL or transmitting secrets. */
export async function runSecurity(slug: string, request: SecurityRequest): Promise<SecurityResult> {
  if (!getSecurityDefinition(slug)) throw new Error("Unknown Security tool.");
  for (const value of Object.values(request.values)) {
    if (typeof value === "string" && value.length > 1_000_000) throw new Error("Input exceeds the 1,000,000-character limit. Use a smaller input.");
  }
  const hashing = /^(?:sha-|md5-|crc32-|checksum-|hmac-|hash-compare|file-hash-)/.test(slug);
  return hashing ? (await import("./hashes")).runSecurityHash(slug, request)
    : (await import("./generators")).runSecurityGenerators(slug, request.values);
}
