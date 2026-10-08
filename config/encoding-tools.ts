/** Browser-independent metadata for the canonical, single-direction Encoding routes. */
export const encodingToolIds = [
  "base64-encoder", "base64-decoder", "url-encoder", "url-decoder", "url-component-encoder", "url-component-decoder", "jwt-decoder",
  "html-encoder", "html-decoder", "html-entity-encoder", "html-entity-decoder", "text-to-unicode", "unicode-to-text",
  "unicode-escape-encoder", "unicode-escape-decoder", "text-to-hex", "hex-to-text", "hexadecimal-encoder", "hexadecimal-decoder",
  "binary-encoder", "binary-decoder", "text-to-ascii", "ascii-to-text", "base32-encoder", "base32-decoder", "base58-encoder", "base58-decoder",
  "base64-url-encoder", "base64-url-decoder", "data-uri-encoder", "data-uri-decoder", "punycode-encoder", "punycode-decoder", "text-to-octal", "octal-to-text",
] as const;
export type EncodingToolId = (typeof encodingToolIds)[number];
export type EncodingInputField = {
  name: "input" | "mime";
  label: string;
  placeholder: string;
  hint?: string;
  control: "textarea" | "text";
};
export type EncodingToolContract = {
  fields: readonly EncodingInputField[];
  action: string;
  outputLabel: string;
  outputFormat: string;
  example: { input: string; mime?: string };
  notes: readonly string[];
  acceptedFormat: string;
  privacyMessage: string;
};
type CatalogOptions = {
  pairId?: string;
  pairedTool?: EncodingToolId;
  direction?: "forward" | "reverse";
  notes?: readonly string[];
  relatedTools?: readonly EncodingToolId[];
  fields?: readonly EncodingInputField[];
  mime?: string;
  outputLabel?: string;
  featured?: boolean;
};

const privacyMessage = "Processed in your browser. Inputs stay in this page’s memory and are not uploaded or saved.";
const utf8Note = "Text is encoded as UTF-8 bytes. Decoding rejects bytes that are not valid UTF-8.";
const htmlNote = "HTML is displayed as text, never rendered. Decoding resolves HTML5 named and numeric character references.";
const domainNote = "Enter a domain name only, without a scheme, path, port, or email address. IDNA normalization can change spelling; this is not a domain lookup.";
const jwtExample = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
// Construct escape notation at runtime: the production minifier folds literal
// escaped surrogate pairs into an emoji, which would misstate the accepted format.
const unicodeEscapeExample = [0x0048, 0x0069, 0x0020, 0xd83c, 0xdf0d].map(unit => `\\u${unit.toString(16).toUpperCase().padStart(4, "0")}`).join("");

function define(id: EncodingToolId, name: string, description: string, inputFormat: string, outputFormat: string, action: string, example: string, options: CatalogOptions = {}) {
  const encodingContract: EncodingToolContract = {
    fields: options.fields ?? [{ name: "input", label: `${inputFormat} input`, control: "textarea", placeholder: example }],
    action, outputLabel: options.outputLabel ?? `${outputFormat} output`, outputFormat,
    example: { input: example, ...(options.mime !== undefined ? { mime: options.mime } : {}) },
    notes: options.notes ?? [], acceptedFormat: inputFormat, privacyMessage,
  };
  const related = options.relatedTools ?? (options.direction === "reverse"
    ? ["base64-decoder", "url-component-decoder", "hex-to-text"] as const
    : ["base64-encoder", "url-component-encoder", "text-to-hex"] as const);
  return {
    id, slug: id, name, description, category: "Encoding" as const,
    keywords: [...new Set([inputFormat.toLowerCase(), outputFormat.toLowerCase(), ...name.toLowerCase().split(/\s+/)])],
    featured: options.featured, pairId: options.pairId, pairedTool: options.pairedTool, direction: options.direction,
    inputFormat, outputFormat, inputType: inputFormat, outputType: outputFormat, encodingContract,
    relatedTools: [...new Set([...(options.pairedTool ? [options.pairedTool] : []), ...related])].filter((relatedId) => relatedId !== id),
  };
}

export const encodingTools = [
  define("base64-encoder", "Base64 Encoder", "Encode UTF-8 text as standard RFC 4648 Base64 locally.", "UTF-8 text", "Base64", "Encode Base64", "Hello 🌍", { featured: true, pairId: "base64", direction: "forward", pairedTool: "base64-decoder", notes: [utf8Note] }),
  define("base64-decoder", "Base64 Decoder", "Decode standard Base64 into UTF-8 text with malformed-input checks.", "Base64", "UTF-8 text", "Decode Base64", "SGVsbG8g8J+MjQ==", { pairId: "base64", direction: "reverse", pairedTool: "base64-encoder", notes: ["Use the standard + and / alphabet with required = padding and no whitespace.", utf8Note] }),
  define("url-encoder", "URL Encoder", "Encode a complete URL while preserving its reserved URI delimiters.", "Complete URL", "Encoded URL", "Encode URL", "https://example.com/café?q=hello world#résumé", { featured: true, pairId: "url", direction: "forward", pairedTool: "url-decoder", notes: ["Uses encodeURI semantics: reserved delimiters such as : / ? # & = remain intact. Use URL Component Encoder for an individual query value."] }),
  define("url-decoder", "URL Decoder", "Decode URL escapes while retaining escapes for reserved URI delimiters.", "Encoded URL", "Decoded URL", "Decode URL", "https://example.com/caf%C3%A9?q=hello%20world%26more", { pairId: "url", direction: "reverse", pairedTool: "url-encoder", notes: ["Uses decodeURI semantics: escapes for reserved delimiters such as %2F, %3F, %23 and %26 remain encoded. A plus sign stays a plus sign. Malformed percent escapes and invalid UTF-8 are rejected."] }),
  define("url-component-encoder", "URL Component Encoder", "Percent-encode a single URL component, including reserved URL delimiters.", "URL component text", "Encoded URL component", "Encode component", "coffee & tea / café", { pairId: "url-component", direction: "forward", pairedTool: "url-component-decoder", notes: ["Uses encodeURIComponent semantics. Spaces become %20; this is not form-urlencoded encoding."] }),
  define("url-component-decoder", "URL Component Decoder", "Decode percent escapes in an individual URL component into text.", "Encoded URL component", "URL component text", "Decode component", "coffee%20%26%20tea%20%2F%20caf%C3%A9", { pairId: "url-component", direction: "reverse", pairedTool: "url-component-encoder", notes: ["Uses decodeURIComponent semantics, including reserved delimiters. A plus sign stays a plus sign; malformed escapes and invalid UTF-8 are rejected."] }),
  define("jwt-decoder", "JWT Decoder", "Inspect a JWT header, payload, and signature segment locally without verifying the token.", "Three-part JWT", "JWT parts", "Decode JWT", jwtExample, { outputLabel: "Decoded JWT parts", direction: "reverse", relatedTools: ["base64-url-decoder", "base64-decoder", "url-component-decoder"], notes: ["Decoding is not verification. Signatures, claims, expiration, authenticity, and authorization are not verified.", "The signature is shown as the original encoded segment. Header and payload are formatted JSON; token text is never sent to a server."] }),
  define("html-encoder", "HTML Encoder", "Escape HTML-significant text characters into HTML character references.", "Text", "Escaped HTML", "Encode HTML", '<p title="Hello">Tom & Ada</p>', { pairId: "html", direction: "forward", pairedTool: "html-decoder", notes: [htmlNote] }),
  define("html-decoder", "HTML Decoder", "Decode HTML character references into plain, selectable text.", "Escaped HTML", "Text", "Decode HTML", "&lt;p&gt;Tom &amp; Ada&lt;/p&gt;", { pairId: "html", direction: "reverse", pairedTool: "html-encoder", notes: [htmlNote] }),
  define("html-entity-encoder", "HTML Entity Encoder", "Convert text into HTML entities for inspecting character-reference notation.", "Text", "HTML entities", "Encode entities", "Café & <tea>", { pairId: "html-entity", direction: "forward", pairedTool: "html-entity-decoder", notes: [htmlNote] }),
  define("html-entity-decoder", "HTML Entity Decoder", "Resolve HTML5 named and numeric entities into readable text.", "HTML entities", "Text", "Decode entities", "Caf&eacute; &amp; &#x1F375;", { pairId: "html-entity", direction: "reverse", pairedTool: "html-entity-encoder", notes: [htmlNote] }),
  define("text-to-unicode", "Text to Unicode", "Represent text as Unicode scalar code points in U+ notation.", "Unicode text", "Unicode code points", "Convert to Unicode", "Hi 🌍", { pairId: "unicode", direction: "forward", pairedTool: "unicode-to-text", notes: ["Each U+ value represents one Unicode scalar, not a UTF-8 byte. Supplementary characters use one code point."] }),
  define("unicode-to-text", "Unicode to Text", "Convert U+ Unicode code points into their corresponding text characters.", "Unicode code points", "Unicode text", "Convert to text", "U+0048 U+0069 U+0020 U+1F30D", { pairId: "unicode", direction: "reverse", pairedTool: "text-to-unicode", notes: ["Enter whitespace-separated U+ hexadecimal code points. Surrogates and values above U+10FFFF are rejected."] }),
  define("unicode-escape-encoder", "Unicode Escape Encoder", "Encode non-ASCII and control characters as UTF-16 Unicode escape sequences.", "Unicode text", "Unicode escapes", "Encode Unicode escapes", "Hi 🌍", { pairId: "unicode-escape", direction: "forward", pairedTool: "unicode-escape-decoder", notes: ["Printable ASCII remains readable; backslashes are doubled. Supplementary characters use a pair of \\uXXXX UTF-16 escapes. Output has no enclosing quotes."] }),
  define("unicode-escape-decoder", "Unicode Escape Decoder", "Decode Unicode escape notation without executing JavaScript.", "Unicode escapes", "Unicode text", "Decode Unicode escapes", unicodeEscapeExample, { pairId: "unicode-escape", direction: "reverse", pairedTool: "unicode-escape-encoder", notes: ["Decodes \\uXXXX notation and doubled backslashes; other text stays literal. Braced escapes and unpaired surrogates are rejected. Use no enclosing quotes; no code is executed."] }),
  define("text-to-hex", "Text to Hex", "Convert text into hexadecimal representations of its UTF-8 bytes.", "UTF-8 text", "Hex bytes", "Convert to hex", "Hello", { pairId: "text-hex", direction: "forward", pairedTool: "hex-to-text", notes: [utf8Note] }),
  define("hex-to-text", "Hex to Text", "Read hexadecimal byte values as UTF-8 text.", "Hex bytes", "UTF-8 text", "Convert to text", "48 65 6c 6c 6f", { pairId: "text-hex", direction: "reverse", pairedTool: "text-to-hex", notes: ["Use complete two-digit bytes, either contiguous or separated by whitespace.", utf8Note] }),
  define("hexadecimal-encoder", "Hexadecimal Encoder", "Encode text in base 16 using its UTF-8 byte sequence.", "UTF-8 text", "Hexadecimal bytes", "Encode hexadecimal", "Café", { pairId: "hexadecimal", direction: "forward", pairedTool: "hexadecimal-decoder", notes: [utf8Note] }),
  define("hexadecimal-decoder", "Hexadecimal Decoder", "Decode a base-16 byte sequence into UTF-8 text.", "Hexadecimal bytes", "UTF-8 text", "Decode hexadecimal", "43 61 66 c3 a9", { pairId: "hexadecimal", direction: "reverse", pairedTool: "hexadecimal-encoder", notes: ["Use complete two-digit bytes, either contiguous or separated by whitespace.", utf8Note] }),
  define("binary-encoder", "Binary Encoder", "Encode UTF-8 text as eight-bit binary byte groups.", "UTF-8 text", "Binary bytes", "Encode binary", "Hi", { pairId: "binary", direction: "forward", pairedTool: "binary-decoder", notes: [utf8Note] }),
  define("binary-decoder", "Binary Decoder", "Decode eight-bit binary byte groups into UTF-8 text.", "Binary bytes", "UTF-8 text", "Decode binary", "01001000 01101001", { pairId: "binary", direction: "reverse", pairedTool: "binary-encoder", notes: ["Enter whitespace-separated eight-bit groups containing only 0 and 1.", utf8Note] }),
  define("text-to-ascii", "Text to ASCII", "Convert ASCII characters into decimal codes from 0 to 127.", "ASCII text", "ASCII decimal codes", "Convert to ASCII", "Hello!", { pairId: "ascii", direction: "forward", pairedTool: "ascii-to-text", notes: ["ASCII supports only U+0000–U+007F. For other characters, use Text to Unicode or a UTF-8 encoder."] }),
  define("ascii-to-text", "ASCII to Text", "Convert decimal ASCII codes into text without accepting non-ASCII values.", "ASCII decimal codes", "ASCII text", "Convert to text", "72 101 108 108 111 33", { pairId: "ascii", direction: "reverse", pairedTool: "text-to-ascii", notes: ["Enter whitespace-separated decimal integers from 0 to 127. Control codes remain literal control characters in the result."] }),
  define("base32-encoder", "Base32 Encoder", "Encode UTF-8 text using the RFC 4648 Base32 alphabet.", "UTF-8 text", "Base32", "Encode Base32", "Hello", { pairId: "base32", direction: "forward", pairedTool: "base32-decoder", notes: ["Uses the RFC 4648 A–Z and 2–7 alphabet, not Base32hex or Crockford Base32.", utf8Note] }),
  define("base32-decoder", "Base32 Decoder", "Decode RFC 4648 Base32 data into UTF-8 text.", "Base32", "UTF-8 text", "Decode Base32", "JBSWY3DP", { pairId: "base32", direction: "reverse", pairedTool: "base32-encoder", notes: ["Use uppercase RFC 4648 A–Z and 2–7 with required = padding and no whitespace. Base32hex and Crockford Base32 are not accepted.", utf8Note] }),
  define("base58-encoder", "Base58 Encoder", "Encode UTF-8 text with the Bitcoin Base58 alphabet.", "UTF-8 text", "Base58", "Encode Base58", "Hello", { pairId: "base58", direction: "forward", pairedTool: "base58-decoder", notes: ["Uses the Bitcoin alphabet; this is raw Base58, not Base58Check.", utf8Note] }),
  define("base58-decoder", "Base58 Decoder", "Decode Bitcoin-alphabet Base58 into UTF-8 text.", "Base58", "UTF-8 text", "Decode Base58", "9Ajdvzr", { pairId: "base58", direction: "reverse", pairedTool: "base58-encoder", notes: ["Uses the Bitcoin alphabet; this does not check a Base58Check checksum.", utf8Note] }),
  define("base64-url-encoder", "Base64 URL Encoder", "Encode UTF-8 text as URL-safe Base64 without padding.", "UTF-8 text", "Base64 URL", "Encode Base64 URL", "Hello 🌍", { pairId: "base64-url", direction: "forward", pairedTool: "base64-url-decoder", notes: ["Uses - and _ instead of + and /, and omits trailing = padding.", utf8Note] }),
  define("base64-url-decoder", "Base64 URL Decoder", "Decode URL-safe Base64 into UTF-8 text locally.", "Base64 URL", "UTF-8 text", "Decode Base64 URL", "SGVsbG8g8J-MjQ", { pairId: "base64-url", direction: "reverse", pairedTool: "base64-url-encoder", notes: ["Use the URL-safe - and _ alphabet with optional correct = padding and no whitespace.", utf8Note] }),
  define("data-uri-encoder", "Data URI Encoder", "Package text and its MIME type into a percent-encoded UTF-8 data URI.", "Text and MIME type", "Data URI", "Encode Data URI", "Hello 🌍", { pairId: "data-uri", direction: "forward", pairedTool: "data-uri-decoder", mime: "text/plain", fields: [{ name: "mime", label: "MIME type", control: "text", placeholder: "text/plain", hint: "Enter a media type such as text/plain or application/json, optionally with ;charset=UTF-8." }, { name: "input", label: "Text / data", control: "textarea", placeholder: "Hello 🌍", hint: "Text is encoded as UTF-8; files and binary uploads are not accepted." }], notes: ["Uses percent encoding. The result is URI text, not a rendered preview or a fetched resource."] }),
  define("data-uri-decoder", "Data URI Decoder", "Inspect a data URI’s MIME type, encoding mode, and decoded text.", "Data URI", "Data URI parts", "Decode Data URI", "data:text/plain;base64,SGVsbG8=", { pairId: "data-uri", direction: "reverse", pairedTool: "data-uri-encoder", outputLabel: "Decoded Data URI parts", notes: ["Accepts Base64 and percent-encoded data URIs containing UTF-8 text. Binary payloads that are not UTF-8 are rejected. Decoded data is displayed as text, never rendered or opened."] }),
  define("punycode-encoder", "Punycode Encoder", "Convert an internationalized domain name to its ASCII IDNA form.", "Unicode domain name", "ASCII domain name", "Encode Punycode", "münich.example", { pairId: "punycode", direction: "forward", pairedTool: "punycode-decoder", notes: [domainNote] }),
  define("punycode-decoder", "Punycode Decoder", "Decode ASCII IDNA domain labels into a Unicode domain name.", "ASCII domain name", "Unicode domain name", "Decode Punycode", "xn--mnich-kva.example", { pairId: "punycode", direction: "reverse", pairedTool: "punycode-encoder", notes: [domainNote] }),
  define("text-to-octal", "Text to Octal", "Represent each UTF-8 text byte as a three-digit octal value.", "UTF-8 text", "Octal bytes", "Convert to octal", "Hi", { pairId: "octal", direction: "forward", pairedTool: "octal-to-text", notes: [utf8Note] }),
  define("octal-to-text", "Octal to Text", "Decode octal byte values into their UTF-8 text representation.", "Octal bytes", "UTF-8 text", "Convert to text", "110 151", { pairId: "octal", direction: "reverse", pairedTool: "text-to-octal", notes: ["Enter whitespace-separated three-digit octal bytes from 000 to 377.", utf8Note] }),
] as const;

export type EncodingDefinition = (typeof encodingTools)[number];

export function isEncodingToolId(id: string): id is EncodingToolId {
  return encodingTools.some((tool) => tool.id === id);
}

export function getEncodingDefinition(idOrSlug: string): EncodingDefinition | undefined {
  return encodingTools.find((tool) => tool.id === idOrSlug || tool.slug === idOrSlug);
}

/** Old combined routes now redirect to their canonical encoding direction. */
export const encodingLegacyRedirects = {
  base64: "base64-encoder",
  "binary-encoder-decoder": "binary-encoder",
  "ascii-converter": "text-to-ascii",
  "unicode-converter": "text-to-unicode",
  "hex-converter": "text-to-hex",
  "punycode-converter": "punycode-encoder",
  "octal-converter": "text-to-octal",
} as const satisfies Record<string, EncodingToolId>;
