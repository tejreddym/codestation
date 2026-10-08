export type Detection = { slug: string; reason: string; confidence: "high" | "possible" };
export const detectionLimit = 200_000;
/** Local structural evidence only. Never execute, fetch or persist supplied text. */
export function detectTools(input: string): Detection[] {
  if (input.length > detectionLimit) throw new Error("Detection supports up to 200,000 characters. Use a specific tool for larger input.");
  const text = input.trim();
  if (!text) return [];
  const match = (slug: string, reason: string, confidence: Detection["confidence"] = "high") => ({ slug, reason, confidence });
  if (/^#[\da-f]{3}(?:[\da-f]{1}|[\da-f]{3}|[\da-f]{5})?$/i.test(text)) return [match("color-converter", "HEX color notation")];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return [match("uuid-parser", "UUID-shaped identifier")];
  const jwt = text.split(".");
  if (jwt.length === 3 && jwt.every(part => /^[A-Za-z0-9_-]*$/.test(part)) && jwt[0] && jwt[1]) {
    try {
      const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      const header = decode(jwt[0]); const payload = decode(jwt[1]);
      if (header && typeof header === "object" && !Array.isArray(header) && payload && typeof payload === "object" && !Array.isArray(payload)) return [match("jwt-decoder", "JWT structure; signature is not verified")];
    } catch { /* Ambiguous or malformed input is never an automatic match. */ }
  }
  try {
    const url = new URL(text);
    if (["https:", "http:"].includes(url.protocol) && !/\s/.test(text)) return [match("url-parser", "HTTP URL; inspected without fetching it")];
  } catch { /* Not a URL. */ }
  if (text.startsWith("{") || text.startsWith("[")) {
    try { JSON.parse(text); return [match("json-formatter", "Valid JSON: format it"), match("json-tree-viewer", "Valid JSON: explore its structure"), match("json-validator", "Valid JSON: validate it")]; }
    catch { return [match("json-validator", "Looks like JSON; check its syntax", "possible")]; }
  }
  if (text.length >= 12 && text.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    try { const decoded = atob(text); if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(decoded)) return [match("base64-decoder", "Possibly Base64-encoded text; confirm before decoding", "possible")]; } catch { /* Not strict Base64. */ }
  }
  return [match("text-counter", "Plain or unrecognized text; inspect its length", "possible")];
}
