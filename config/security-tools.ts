/** Browser-independent metadata for the canonical Security station. */
export const securityToolIds = [
  "uuid-generator", "uuid-parser", "password-generator", "sha-256-generator", "sha-384-generator", "sha-512-generator",
  "sha-1-generator", "md5-generator", "hmac-generator", "crc32-generator", "checksum-generator", "hash-compare",
  "file-hash-generator", "entropy-calculator", "password-strength-checker", "ulid-generator", "nanoid-generator",
  "random-number-generator", "random-string-generator", "secure-token-generator", "hex-random-generator", "secret-key-generator",
] as const;
export type SecurityToolId = (typeof securityToolIds)[number];
export type SecurityFieldName = "version" | "input" | "length" | "uppercase" | "lowercase" | "numbers" | "symbols" | "message" | "secret" | "algorithm" | "hashA" | "hashB" | "file" | "minimum" | "maximum" | "count" | "characterSet" | "bytes" | "encoding" | "keySize";
export type SecurityInputField = {
  name: SecurityFieldName;
  label: string;
  control: "textarea" | "text" | "password" | "number" | "checkbox" | "select" | "file";
  options?: readonly string[];
  min?: number;
  max?: number;
  hint?: string;
  placeholder?: string;
};
export type SecurityToolContract = {
  fields: readonly SecurityInputField[];
  action: string;
  outputLabel: string;
  outputs: readonly string[];
  defaults: Readonly<Record<string, string | boolean>>;
  example?: Readonly<Record<string, string | boolean>>;
  notices: readonly string[];
  privacyMessage: string;
  purpose: string;
  usage: string;
};

const privacyMessage = "Processed locally in your browser. Inputs and results are not uploaded or saved by this page.";
const hashNotice = "Hashes are one-way digests, not encryption. These fast hashes are not password-storage algorithms.";
const legacyNotice = "MD5 and SHA-1 are legacy algorithms with known collision weaknesses. Do not use them for new security-sensitive applications.";
const crcNotice = "CRC32 is a non-cryptographic checksum for accidental-error detection, not a security or authenticity check.";
const secretNotice = "Secrets are generated locally with cryptographically secure browser randomness. Store them securely and do not share them publicly.";
const textField: SecurityInputField = { name: "input", label: "Text", control: "textarea", hint: "Exact text is encoded as UTF-8, including spaces and line breaks. Empty text is valid.", placeholder: "Hello, world!" };
const select = (name: SecurityFieldName, label: string, options: readonly string[]): SecurityInputField => ({ name, label, control: "select", options });
const number = (name: SecurityFieldName, label: string, min: number, max: number): SecurityInputField => ({ name, label, control: "number", min, max });
const text = (name: SecurityFieldName, label: string, control: "text" | "password" = "text"): SecurityInputField => ({ name, label, control });
const algorithms = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512", "CRC32"] as const;
const fileAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

type Options = {
  defaults?: Record<string, string | boolean>;
  example?: Record<string, string | boolean>;
  notices?: readonly string[];
  outputs?: readonly string[];
  relatedTools?: readonly SecurityToolId[];
  featured?: boolean;
};

function define(id: SecurityToolId, name: string, description: string, fields: readonly SecurityInputField[], action: string, outputLabel: string, usage: string, options: Options = {}) {
  const defaults = Object.fromEntries(fields.filter(field => field.control !== "file").map(field => [field.name, field.control === "checkbox" ? false : ""]));
  const securityContract: SecurityToolContract = {
    fields, action, outputLabel, outputs: options.outputs ?? [outputLabel],
    defaults: { ...defaults, ...options.defaults }, example: options.example,
    notices: options.notices ?? [], privacyMessage, purpose: description,
    usage: `${usage} Choose “${action}”, then copy the result if needed. Clear removes text, secrets, file selection and results, and restores option defaults.`,
  };
  return {
    id, slug: id, name, description, category: "Security" as const, featured: options.featured,
    keywords: [...new Set([...name.toLowerCase().split(/[\s-]+/), "local", "browser"])],
    securityContract,
    relatedTools: (options.relatedTools ?? ["uuid-generator", "sha-256-generator", "secure-token-generator"]).filter(slug => slug !== id),
    seo: { title: `${name} — Browser-local ${outputLabel.toLowerCase()}`, description },
  };
}

function fixedHash(id: SecurityToolId, algorithm: string, legacy = false) {
  return define(id, `${algorithm} Generator`, `Compute a ${algorithm} hexadecimal digest of UTF-8 text locally${legacy ? " for legacy compatibility" : ""}.`, [textField], `Generate ${algorithm}`, `${algorithm} hash`, "Enter the text to hash, preserving any spaces or line breaks.", {
    example: { input: "Hello, world!" }, notices: [hashNotice, ...(legacy ? [legacyNotice] : [])],
    relatedTools: ["checksum-generator", "hash-compare", "file-hash-generator"],
  });
}

export const securityTools = [
  define("uuid-generator", "UUID Generator", "Generate one RFC 9562 UUID using version 4 randomness or version 7 time ordering.", [select("version", "UUID version", ["4", "7"])], "Generate UUID", "UUID", "Choose version 4 or version 7.", {
    defaults: { version: "4" }, featured: true, notices: ["UUID v4 uses random bits. UUID v7 includes the device's current timestamp and random bits; UUIDs are identifiers, not secret tokens."], relatedTools: ["uuid-parser", "ulid-generator", "nanoid-generator"],
  }),
  define("uuid-parser", "UUID Parser", "Inspect a UUID's version, variant, normalized value and structural validity locally.", [{ ...text("input", "UUID"), placeholder: "550e8400-e29b-41d4-a716-446655440000" }], "Parse UUID", "UUID details", "Enter a UUID string.", {
    example: { input: "550e8400-e29b-41d4-a716-446655440000" }, outputs: ["UUID version", "UUID variant", "Normalized UUID", "Validity status"], notices: ["Structural validity does not establish uniqueness, origin or authenticity."], relatedTools: ["uuid-generator", "ulid-generator", "nanoid-generator"],
  }),
  define("password-generator", "Password Generator", "Generate a random password locally from the selected character groups.", [number("length", "Length", 4, 256), ...(["uppercase", "lowercase", "numbers", "symbols"] as const).map(name => ({ name, label: `Include ${name}`, control: "checkbox" as const }))], "Generate password", "Password", "Choose a length from 4 to 256 and at least one character group.", {
    defaults: { length: "20", uppercase: true, lowercase: true, numbers: true, symbols: true }, featured: true, notices: [secretNotice], relatedTools: ["password-strength-checker", "entropy-calculator", "secure-token-generator"],
  }),
  fixedHash("sha-256-generator", "SHA-256"),
  fixedHash("sha-384-generator", "SHA-384"),
  fixedHash("sha-512-generator", "SHA-512"),
  fixedHash("sha-1-generator", "SHA-1", true),
  fixedHash("md5-generator", "MD5", true),
  define("hmac-generator", "HMAC Generator", "Create a keyed HMAC-SHA-256, HMAC-SHA-384 or HMAC-SHA-512 authentication code from UTF-8 text locally.", [{ ...textField, name: "message", label: "Message" }, { ...text("secret", "Secret key", "password"), hint: "The secret is interpreted as UTF-8 text, not decoded hexadecimal." }, select("algorithm", "Algorithm", ["HMAC-SHA-256", "HMAC-SHA-384", "HMAC-SHA-512"])], "Generate HMAC", "HMAC", "Enter a message and secret key, then choose the HMAC algorithm.", {
    defaults: { algorithm: "HMAC-SHA-256" }, example: { message: "Hello, world!", secret: "public-example-key", algorithm: "HMAC-SHA-256" }, notices: ["HMAC is a keyed message authentication code, not encryption. Keep real keys secret. The example key is public and must not be used as a real secret."], relatedTools: ["secret-key-generator", "sha-256-generator", "hash-compare"],
  }),
  define("crc32-generator", "CRC32 Generator", "Compute the CRC32 hexadecimal checksum of UTF-8 text locally.", [textField], "Generate CRC32", "CRC32 checksum", "Enter the text whose CRC32 checksum you need.", {
    example: { input: "123456789" }, notices: [crcNotice], relatedTools: ["checksum-generator", "hash-compare", "sha-256-generator"],
  }),
  define("checksum-generator", "Checksum Generator", "Calculate a text checksum using MD5, SHA-1, SHA-256, SHA-384, SHA-512 or CRC32.", [textField, select("algorithm", "Algorithm", algorithms)], "Generate checksum", "Checksum", "Enter text and choose a checksum algorithm.", {
    defaults: { algorithm: "SHA-256" }, example: { input: "Hello, world!", algorithm: "SHA-256" }, relatedTools: ["sha-256-generator", "crc32-generator", "hash-compare"],
  }),
  define("hash-compare", "Hash Compare", "Compare two hash strings locally after trimming leading and trailing whitespace, with case-sensitive equality.", [text("hashA", "Hash A"), text("hashB", "Hash B")], "Compare hashes", "Comparison", "Enter the two hash strings to compare.", {
    example: { hashA: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", hashB: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }, notices: ["Comparison trims only leading and trailing whitespace and is case-sensitive. Matching text does not establish file authenticity or verify an algorithm."], relatedTools: ["checksum-generator", "file-hash-generator", "sha-256-generator"],
  }),
  define("file-hash-generator", "File Hash Generator", "Hash one browser-local file up to 64 MiB using SHA-1, SHA-256, SHA-384 or SHA-512.", [{ name: "file", label: "File", control: "file", hint: "One file, up to 64 MiB (67,108,864 bytes). Read in this browser only; never uploaded." }, select("algorithm", "Algorithm", fileAlgorithms)], "Hash file", "File hash details", "Select one local file and choose its hash algorithm. Reselect the file for another run.", {
    defaults: { algorithm: "SHA-256" }, outputs: ["File name", "File size", "Algorithm", "Hash"], notices: ["The file is processed locally, never uploaded. Its selection is released after processing, an error, cancellation or Clear. Maximum size: 64 MiB."], relatedTools: ["hash-compare", "checksum-generator", "sha-256-generator"],
  }),
  define("entropy-calculator", "Entropy Calculator", "Estimate text entropy in bits using input length and a character-set model, entirely in your browser.", [{ ...text("input", "Text or password", "password"), placeholder: "correct horse battery staple" }], "Estimate entropy", "Entropy estimate", "Enter the text or password to estimate.", {
    example: { input: "Public-example-42!" }, outputs: ["Length", "Character set size", "Estimated entropy in bits"], notices: ["Estimated bits = code-point length × log2(character set size). Present ASCII classes contribute 26 lowercase, 26 uppercase, 10 digits, 32 punctuation and 1 space; other distinct observed code points add one each.", "This character-set-model estimate assumes independent, uniformly chosen characters. It is not measured randomness, a cracking-time prediction or a security guarantee."], relatedTools: ["password-generator", "password-strength-checker", "random-string-generator"],
  }),
  define("password-strength-checker", "Password Strength Checker", "Estimate password strength with a local heuristic and show a score, label and practical feedback.", [{ ...text("input", "Password", "password"), placeholder: "Enter a password to analyze" }], "Check strength", "Strength assessment", "Enter the password to assess.", {
    example: { input: "public-example-password" }, outputs: ["Strength score", "Strength label", "Feedback"], notices: ["Strength is a heuristic estimate, not a security guarantee. This tool does not check breached-password databases or contact a server."], relatedTools: ["password-generator", "entropy-calculator", "secure-token-generator"],
  }),
  define("ulid-generator", "ULID Generator", "Generate one 26-character ULID using the device timestamp and cryptographically secure randomness.", [], "Generate ULID", "ULID", "No input is needed.", {
    notices: ["ULIDs encode the device timestamp and random bits. They are sortable identifiers, not secret tokens; clock accuracy depends on your device."], relatedTools: ["uuid-generator", "uuid-parser", "nanoid-generator"],
  }),
  define("nanoid-generator", "NanoID Generator", "Generate a compact random identifier using the URL-safe NanoID alphabet.", [number("length", "Length", 4, 256)], "Generate NanoID", "NanoID", "Choose an identifier length from 4 to 256; the default is 21.", {
    defaults: { length: "21" }, notices: ["Uses A–Z, a–z, 0–9, underscore and hyphen with secure random sampling. Shorter identifiers have a greater collision probability."], relatedTools: ["uuid-generator", "ulid-generator", "random-string-generator"],
  }),
  define("random-number-generator", "Random Number Generator", "Generate secure random integers within inclusive minimum and maximum bounds.", [number("minimum", "Minimum", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), number("maximum", "Maximum", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), number("count", "Count", 1, 1000)], "Generate numbers", "Random numbers", "Set inclusive integer bounds and a count from 1 to 1,000.", {
    defaults: { minimum: "1", maximum: "100", count: "1" }, notices: ["Bounds must be safe integers; repeated numbers are possible. Values are sampled using cryptographically secure browser randomness."], relatedTools: ["random-string-generator", "hex-random-generator", "secure-token-generator"],
  }),
  define("random-string-generator", "Random String Generator", "Generate a secure random string using one of five predefined character sets.", [number("length", "Length", 1, 256), select("characterSet", "Character set", ["Alphanumeric", "Lowercase letters", "Uppercase letters", "Digits", "Letters + digits + symbols"])], "Generate string", "Random string", "Choose a length from 1 to 256 and a character set.", {
    defaults: { length: "32", characterSet: "Alphanumeric" }, notices: [secretNotice], relatedTools: ["password-generator", "nanoid-generator", "secure-token-generator"],
  }),
  define("secure-token-generator", "Secure Token Generator", "Generate 8 to 256 secure random bytes encoded as hexadecimal or unpadded Base64URL.", [number("bytes", "Byte length", 8, 256), select("encoding", "Encoding", ["Hex", "Base64URL"])], "Generate token", "Secure token", "Choose the random byte length and output encoding.", {
    defaults: { bytes: "32", encoding: "Base64URL" }, notices: [secretNotice, "Byte length is the number of random bytes, not the encoded character count. Base64URL output has no padding."], relatedTools: ["hex-random-generator", "secret-key-generator", "random-string-generator"],
  }),
  define("hex-random-generator", "Hex Random Generator", "Generate 1 to 256 secure random bytes as hexadecimal text.", [number("bytes", "Byte length", 1, 256)], "Generate hex", "Random hex", "Choose the number of random bytes.", {
    defaults: { bytes: "32" }, notices: [secretNotice, "Each random byte is represented by two hexadecimal characters."], relatedTools: ["secure-token-generator", "secret-key-generator", "random-string-generator"],
  }),
  define("secret-key-generator", "Secret Key Generator", "Generate a random 128-bit, 192-bit or 256-bit secret key and display its hexadecimal value and size.", [select("keySize", "Key size (bits)", ["128", "192", "256"])], "Generate key", "Secret key details", "Choose a key size of 128, 192 or 256 bits.", {
    defaults: { keySize: "256" }, outputs: ["Random secret key", "Key size"], notices: [secretNotice, "The hexadecimal output represents random key material, not a derived key or a public/private key pair."], relatedTools: ["hmac-generator", "secure-token-generator", "hex-random-generator"],
  }),
] as const;

export type SecurityDefinition = (typeof securityTools)[number];
export function isSecurityToolId(id: string): id is SecurityToolId { return securityTools.some(tool => tool.id === id); }
export function getSecurityDefinition(idOrSlug: string): SecurityDefinition | undefined { return securityTools.find(tool => tool.id === idOrSlug || tool.slug === idOrSlug); }

/** Algorithm-specific notices remain accurate when a selector changes. */
export function getSecurityNotices(definition: SecurityDefinition, values: Readonly<Record<string, string | boolean>>): readonly string[] {
  if (definition.id !== "checksum-generator" && definition.id !== "file-hash-generator") return definition.securityContract.notices;
  const algorithm = values.algorithm;
  return [...definition.securityContract.notices, ...(algorithm === "CRC32" ? [crcNotice] : [hashNotice]), ...(algorithm === "MD5" || algorithm === "SHA-1" ? [legacyNotice] : [])];
}

export const securityLegacyRedirects = {
  "sha-256": "sha-256-generator",
  "sha-512": "sha-512-generator",
  "random-string": "random-string-generator",
} as const satisfies Record<string, SecurityToolId>;
