import type { EncodingInputs, EncodingResult } from "./types";
import { assertWellFormedUnicode, decodeBase64Bytes, decodeBase64UrlBytes, decodeUtf8 } from "./bytes";

const INPUT_LIMIT = 1_000_000;
const OUTPUT_LIMIT = 8_000_000;
const MIME_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const MIME_TYPE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function multipart(parts: NonNullable<EncodingResult["parts"]>): EncodingResult {
  return { text: parts.map(({ label, value }) => `${label}:\n${value}`).join("\n\n"), parts };
}

/** Validate with JSON.parse, but format source tokens so large numbers never round. */
function formatJsonObject(source: string, name: string): { text: string; object: Record<string, unknown> } {
  let object: unknown;
  try { object = JSON.parse(source); } catch { throw new Error(`${name} must contain valid JSON.`); }
  if (object === null || typeof object !== "object" || Array.isArray(object)) {
    throw new Error(`${name} must be a JSON object.`);
  }
  const chunks: string[] = [];
  let depth = 0;
  let outputLength = 0;
  let previous = "";
  const append = (text: string) => {
    outputLength += text.length;
    if (outputLength > OUTPUT_LIMIT) throw new Error("Formatted JWT exceeds the output size limit.");
    chunks.push(text);
  };
  const newline = () => append(`\n${"  ".repeat(depth)}`);
  for (let i = 0; i < source.length;) {
    const char = source[i];
    if (/\s/.test(char)) { i++; continue; }
    if (char === '"') {
      const start = i++;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i++] === '"') break;
      }
      append(source.slice(start, i));
    } else if (char === "{" || char === "[") {
      append(char);
      if (++depth > 128) throw new Error("JWT JSON exceeds 128 nesting levels.");
      i++;
      let next = i;
      while (/\s/.test(source[next] ?? "") && next < source.length) next++;
      if (source[next] !== "}" && source[next] !== "]") newline();
    } else if (char === "}" || char === "]") {
      depth--;
      if (previous !== "{" && previous !== "[") newline();
      append(char);
      i++;
    } else if (char === ",") {
      append(","); newline(); i++;
    } else if (char === ":") {
      append(": "); i++;
    } else {
      const start = i++;
      while (i < source.length && !/[\s,\]}]/.test(source[i])) i++;
      append(source.slice(start, i));
    }
    previous = char;
  }
  return { text: chunks.join(""), object: object as Record<string, unknown> };
}

function decodeJwt(input: string): EncodingResult {
  const segments = input.split(".");
  if (segments.length !== 3 || !segments[0] || !segments[1]) {
    throw new Error("A JWT must have exactly three segments, with nonempty header and payload.");
  }
  // Compact JWS/JWT uses unpadded, canonical Base64URL in every segment.
  for (const segment of segments) {
    if (!/^[A-Za-z0-9_-]*$/.test(segment)) throw new Error("JWT segments must use unpadded Base64URL characters.");
  }
  const header = formatJsonObject(decodeUtf8(decodeBase64UrlBytes(segments[0])), "JWT header");
  const payload = formatJsonObject(decodeUtf8(decodeBase64UrlBytes(segments[1])), "JWT payload");
  if (typeof header.object.alg !== "string" || !header.object.alg) throw new Error("JWT header requires a nonempty string alg member.");
  if (header.object.alg === "none") {
    if (segments[2]) throw new Error("An unsecured alg:none JWT must have an empty signature segment.");
  } else if (!segments[2]) {
    throw new Error("An empty signature is allowed only for an unsecured alg:none JWT.");
  }
  // Signatures are arbitrary bytes, not UTF-8. This checks syntax only, never authenticity.
  decodeBase64UrlBytes(segments[2]);
  return multipart([
    { label: "Header JSON", value: header.text },
    { label: "Payload JSON", value: payload.text },
    { label: "Signature text", value: segments[2] },
  ]);
}

interface MediaType { text: string; charset: "utf-8" | "us-ascii"; base64: boolean }

/** MIME parameters are URL-escaped tokens or quoted strings; charset is UTF-8/US-ASCII only. */
function parseMediaType(metadata: string, encoder: boolean): MediaType {
  if (/[^\x21-\x7e]|[,#?]/.test(metadata)) throw new Error("MIME metadata contains an unsafe delimiter, whitespace, or control character.");
  const fields = metadata.split(";");
  const rawType = fields.shift() ?? "";
  if ((encoder && !rawType) || (rawType && !MIME_TYPE.test(rawType))) throw new Error("Enter a valid MIME type such as text/plain.");
  const type = rawType.toLowerCase() || "text/plain";
  let charset: "utf-8" | "us-ascii" = rawType ? "utf-8" : "us-ascii";
  let charsetSeen = false;
  let base64 = false;
  const parameters: string[] = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (field.toLowerCase() === "base64") {
      if (encoder || index !== fields.length - 1 || base64) throw new Error("The base64 marker is allowed only at the end of decoder metadata.");
      base64 = true;
      continue;
    }
    const equals = field.indexOf("=");
    if (equals <= 0) throw new Error("MIME parameters must have a name and value.");
    const name = field.slice(0, equals).toLowerCase();
    let value: string;
    try { value = decodeURIComponent(field.slice(equals + 1)); } catch { throw new Error("MIME parameter contains invalid percent encoding."); }
    if (!MIME_TOKEN.test(name) || !(MIME_TOKEN.test(value) || /^"(?:[\x20-\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*"$/.test(value))) {
      throw new Error("MIME parameter is malformed.");
    }
    if (encoder && name !== "charset") throw new Error("The encoder accepts a MIME type with an optional charset=UTF-8 parameter.");
    if (name === "charset") {
      if (charsetSeen) throw new Error("MIME metadata contains duplicate charset parameters.");
      charsetSeen = true;
      const normalized = value.replace(/^"|"$/g, "").toLowerCase();
      if (normalized !== "utf-8" && normalized !== "us-ascii") throw new Error("Only UTF-8 and US-ASCII charsets are supported.");
      if (encoder && normalized !== "utf-8") throw new Error("The encoder accepts only charset=UTF-8.");
      charset = normalized;
    }
    parameters.push(`${name}=${field.slice(equals + 1)}`);
  }
  if (!rawType && !charsetSeen) parameters.unshift("charset=US-ASCII");
  return { text: [type, ...parameters].join(";"), charset, base64 };
}

function percentBytes(payload: string): Uint8Array {
  const bytes = new Uint8Array(payload.length);
  let length = 0;
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === "%") {
      const hex = payload.slice(i + 1, i + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex)) throw new Error("Data URI contains a malformed percent escape.");
      bytes[length++] = Number.parseInt(hex, 16);
      i += 2;
    } else {
      const code = payload.charCodeAt(i);
      if (code < 0x21 || code > 0x7e || payload[i] === "#") throw new Error("Data URI payload must percent-encode whitespace, non-ASCII characters, and #.");
      bytes[length++] = code;
    }
  }
  return bytes.subarray(0, length);
}

function decodeDataUri(input: string): EncodingResult {
  if (!/^data:/i.test(input)) throw new Error("Enter a data: URI.");
  const comma = input.indexOf(",");
  if (comma < 0) throw new Error("A data URI must separate metadata and payload with a comma.");
  const metadata = parseMediaType(input.slice(5, comma), false);
  let bytes = percentBytes(input.slice(comma + 1));
  if (metadata.base64) {
    if (bytes.some((byte) => byte > 0x7f)) throw new Error("Base64 payload must contain only ASCII Base64 characters.");
    bytes = decodeBase64Bytes(decodeUtf8(bytes));
  }
  if (metadata.charset === "us-ascii" && bytes.some((byte) => byte > 0x7f)) {
    throw new Error("Data URI declares US-ASCII but contains non-ASCII bytes.");
  }
  let text: string;
  try { text = decodeUtf8(bytes); } catch { throw new Error("Data URI contains binary or invalid UTF-8 data that cannot be displayed faithfully as text."); }
  return multipart([
    { label: "MIME type", value: metadata.text },
    { label: "Encoding mode", value: metadata.base64 ? "Base64" : "Percent-encoded" },
    { label: "Decoded data", value: text },
  ]);
}

async function convertDomain(input: string, decode: boolean): Promise<string> {
  if (!input || /[\s/:?#@\\\[\]]/.test(input)) throw new Error("Enter a domain name or label only, without a scheme, path, port, or email address.");
  if (decode && /[^\x00-\x7f]/.test(input)) throw new Error("Punycode Decoder requires ASCII domain labels; use Punycode Encoder for Unicode text.");
  const tr46 = await import("tr46");
  const options = { checkBidi: true, checkJoiners: true, checkHyphens: true, useSTD3ASCIIRules: true, transitionalProcessing: false, ignoreInvalidPunycode: false };
  try {
    // UTS #46 owns case folding, NFC and Unicode separator mapping.
    const unicode = tr46.toUnicode(input, options);
    if (unicode.error) throw new Error("Invalid IDNA domain.");
    assertWellFormedUnicode(unicode.domain);
    const rooted = unicode.domain.endsWith(".");
    const body = rooted ? unicode.domain.slice(0, -1) : unicode.domain;
    const ascii = tr46.toASCII(body, { ...options, verifyDNSLength: true });
    if (!ascii) throw new Error("Invalid IDNA domain or DNS label/domain length.");
    const roundtrip = tr46.toUnicode(ascii, options);
    if (roundtrip.error || tr46.toASCII(roundtrip.domain, { ...options, verifyDNSLength: true }) !== ascii) throw new Error("Invalid A-label round trip.");
    // Check original ASCII ACE runs as well: do not silently canonicalize malformed A-labels.
    for (const match of input.matchAll(/xn--[a-z0-9-]*/gi)) {
      // Ask the library whether the preceding character is a domain separator.
      if (match.index > 0 && tr46.toUnicode(input[match.index - 1], options).domain !== ".") continue;
      const canonical = tr46.toASCII(match[0], { ...options, verifyDNSLength: true });
      if (!canonical || canonical !== match[0].toLowerCase()) throw new Error("Noncanonical A-label.");
    }
    return `${decode ? roundtrip.domain : ascii}${rooted ? "." : ""}`;
  } catch {
    throw new Error("Invalid IDNA domain: check Punycode, Unicode, hyphens, bidi/joiners, and DNS lengths (63 per label, 253 without a final root dot).");
  }
}

export async function runStructuredTool(slug: string, inputs: EncodingInputs): Promise<EncodingResult> {
  if (typeof inputs.input !== "string" || inputs.input.length > INPUT_LIMIT) throw new Error("Input must be text of at most 1,000,000 characters.");
  if (inputs.mime !== undefined && (typeof inputs.mime !== "string" || inputs.mime.length > 1_024)) throw new Error("MIME type must be text of at most 1,024 characters.");
  const input = inputs.input;
  assertWellFormedUnicode(input);
  switch (slug) {
    case "url-encoder": return { text: encodeURI(input) };
    case "url-decoder":
      // decodeURI deliberately retains escaped reserved delimiters ; / ? : @ & = + $ , #.
      try { return { text: decodeURI(input) }; } catch { throw new Error("URL contains malformed percent encoding or invalid UTF-8."); }
    case "url-component-encoder": return { text: encodeURIComponent(input) };
    case "url-component-decoder":
      try { return { text: decodeURIComponent(input) }; } catch { throw new Error("URL component contains malformed percent encoding or invalid UTF-8."); }
    case "html-encoder": return { text: input.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!) };
    case "html-decoder":
    case "html-entity-decoder": {
      const { decodeHTML } = await import("entities");
      // HTML5 text-context references, including legacy semicolonless references and numeric remapping.
      return { text: decodeHTML(input) };
    }
    case "html-entity-encoder": {
      const { encodeHTML } = await import("entities");
      return { text: encodeHTML(input) };
    }
    case "jwt-decoder": return decodeJwt(input);
    case "data-uri-encoder": {
      const mime = parseMediaType(inputs.mime ?? "", true);
      return { text: `data:${mime.text},${encodeURIComponent(input)}` };
    }
    case "data-uri-decoder": return decodeDataUri(input);
    case "punycode-encoder": return { text: await convertDomain(input, false) };
    case "punycode-decoder": return { text: await convertDomain(input, true) };
    default: throw new Error(`Unsupported structured encoding tool: ${slug}`);
  }
}
