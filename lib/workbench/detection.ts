export type ConfidenceLevel = "high" | "possible";

export type Detection = {
  slug: string;
  reason: string;
  confidence: ConfidenceLevel;
  score: number; // 0 - 100 percentage
  format: string; // e.g. "JSON", "JWT", "Unix Timestamp", "CIDR / IP Range", etc.
};

export type DetectionResult = {
  matches: Detection[];
  topMatch: Detection | null;
  text: string;
  timestamp: number;
  format: string | null;
  confidence: ConfidenceLevel | null;
  score: number;
};

export const detectionLimit = 200_000;

// Helper to construct Detection objects
const match = (
  slug: string,
  reason: string,
  format: string,
  confidence: ConfidenceLevel = "high",
  score = confidence === "high" ? 95 : 65
): Detection => ({ slug, reason, confidence, score, format });

/** Local structural evidence only. Never execute, fetch or persist supplied text. */
export function detectTools(input: string): Detection[] {
  if (input.length > detectionLimit) {
    throw new Error("Detection supports up to 200,000 characters. Use a specific tool for larger input.");
  }
  const text = input.trim();
  if (!text) return [];

  // 1. Git Merge Conflict Markers (Highest priority structural signature)
  if (
    text.includes("<<<<<<<") &&
    text.includes("=======") &&
    text.includes(">>>>>>>") &&
    /(^|\n)<{7}[^\n]*\n[\s\S]*?\n={7}[^\n]*\n[\s\S]*?\n>{7}[^\n]*/.test(text)
  ) {
    return [match("conflict-parse", "Git merge conflict markers (<<<<<<<, =======, >>>>>>>)", "Git Merge Conflict", "high", 99)];
  }

  // 2. PEM Certificate / Key / CSR
  if (
    /-----BEGIN (?:[A-Z0-9 ]+ )?(?:CERTIFICATE|CERTIFICATE REQUEST|PRIVATE KEY|PUBLIC KEY|RSA PRIVATE KEY|RSA PUBLIC KEY|EC PRIVATE KEY|DSA PRIVATE KEY|X509 CRL)-----[\s\S]+?-----END [A-Z0-9 ]+-----/.test(
      text
    )
  ) {
    return [
      match("cert-inspector", "PEM certificate, CSR, or cryptographic key structure", "PEM Certificate / Key", "high", 99),
      match("rsa-key-generator", "Inspect or generate cryptographic keys", "PEM Certificate / Key", "high", 90),
    ];
  }

  // 3. Hex color notation (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)
  if (/^#[\da-f]{3}(?:[\da-f]{1}|[\da-f]{3}|[\da-f]{5})?$/i.test(text)) {
    return [match("color-converter", "HEX color notation", "Hex Color", "high", 98)];
  }

  // 4. UUID canonical format (8-4-4-4-12 hex)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    return [match("uuid-parser", "UUID-shaped identifier", "UUID", "high", 99)];
  }

  // 5. Unix timestamp (10 digits for seconds, 13 digits for milliseconds)
  if (/^-?\d{10}$/.test(text)) {
    return [
      match("unix-timestamp-converter", "10-digit Unix timestamp in seconds; convert to date", "Unix Timestamp", "high", 94),
      match("timestamp-to-date", "Convert seconds timestamp to calendar date", "Unix Timestamp", "high", 92),
      match("epoch-converter", "Epoch seconds converter", "Unix Timestamp", "high", 88),
    ];
  }
  if (/^-?\d{13}$/.test(text)) {
    return [
      match("unix-milliseconds-converter", "13-digit Unix timestamp in milliseconds; convert to date", "Unix Timestamp", "high", 96),
      match("unix-timestamp-converter", "Convert Unix milliseconds timestamp", "Unix Timestamp", "high", 93),
      match("epoch-converter", "Epoch milliseconds converter", "Unix Timestamp", "high", 89),
    ];
  }

  // 6. CIDR / IP Range & Addresses
  // IPv4 CIDR (e.g. 192.168.1.0/24)
  if (/^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/(3[0-2]|[12]?\d)$/.test(text)) {
    return [match("cidr-calculator", "IPv4 CIDR subnet block; calculate network bounds", "CIDR / IP Range", "high", 98)];
  }
  // IPv4 range (e.g. 192.168.1.1 - 192.168.1.254)
  if (
    /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\s*-\s*((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(
      text
    )
  ) {
    return [match("cidr-calculator", "IPv4 address range; calculate subnets", "CIDR / IP Range", "high", 96)];
  }
  // IPv4 standalone address
  if (/^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(text)) {
    return [
      match("cidr-calculator", "IPv4 address; inspect or calculate subnet", "CIDR / IP Range", "high", 92),
      match("ipv4-to-ipv6", "Convert IPv4 address to IPv6 notation", "CIDR / IP Range", "high", 88),
    ];
  }
  // IPv6 address or IPv6 CIDR
  if (
    text.includes(":") &&
    /^[0-9a-fA-F:]+(\/(12[0-8]|1[0-1]\d|[1-9]?\d))?$/.test(text) &&
    !text.includes(":::") &&
    text.split(":").length >= 3
  ) {
    return [
      match("ipv4-to-ipv6", "IPv6 address notation; format or convert", "CIDR / IP Range", "high", 95),
      match("cidr-calculator", "IPv6 prefix / subnet inspection", "CIDR / IP Range", "high", 89),
    ];
  }

  // 7. Cron Expression
  if (/^@(yearly|annually|monthly|weekly|daily|hourly|reboot)$/i.test(text)) {
    return [
      match("cron-explainer", "Cron shortcut expression; explain schedule", "Cron Expression", "high", 98),
      match("cron-validator", "Validate cron schedule", "Cron Expression", "high", 95),
      match("cron-next-run", "Calculate next run instant", "Cron Expression", "high", 92),
    ];
  }
  const cronTokens = text.split(/\s+/);
  if (cronTokens.length === 5 || cronTokens.length === 6) {
    const cronFieldPattern = /^(\*|\d+|\d+-\d+|\*\/\d+|\d+\/\d+|\?|L|W|#[0-9]|(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|(MON|TUE|WED|THU|FRI|SAT|SUN))(,(\*|\d+|\d+-\d+|\*\/\d+|\d+\/\d+|\?|L|W|#[0-9]|(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|(MON|TUE|WED|THU|FRI|SAT|SUN)))*$/i;
    const allValidFields = cronTokens.every(tok => cronFieldPattern.test(tok));
    const hasCronSpecial = cronTokens.some(tok => /[*?,/\-LW#]|(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|(MON|TUE|WED|THU|FRI|SAT|SUN)/i.test(tok));
    if (allValidFields && hasCronSpecial) {
      return [
        match("cron-explainer", "5 or 6-field cron expression; explain schedule", "Cron Expression", "high", 95),
        match("cron-validator", "Validate cron field syntax", "Cron Expression", "high", 93),
        match("cron-next-run", "Find next cron occurrence", "Cron Expression", "high", 90),
      ];
    }
  }

  // 8. JWT (JSON Web Token)
  const jwt = text.split(".");
  if (jwt.length === 3 && jwt.every(part => /^[A-Za-z0-9_-]*$/.test(part)) && jwt[0] && jwt[1]) {
    try {
      const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      const header = decode(jwt[0]);
      const payload = decode(jwt[1]);
      if (header && typeof header === "object" && !Array.isArray(header) && payload && typeof payload === "object" && !Array.isArray(payload)) {
        return [match("jwt-decoder", "JWT structure; signature is not verified", "JWT", "high", 99)];
      }
    } catch {
      /* Ambiguous or malformed input is never an automatic match. */
    }
  }

  // 9. HTTP(S) URL
  try {
    const url = new URL(text);
    if (["https:", "http:"].includes(url.protocol) && !/\s/.test(text)) {
      return [match("url-parser", "HTTP URL; inspected without fetching it", "URL", "high", 98)];
    }
  } catch {
    /* Not a valid URL. */
  }

  // 10. JSON
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      JSON.parse(text);
      return [
        match("json-formatter", "Valid JSON: format it", "JSON", "high", 98),
        match("json-tree-viewer", "Valid JSON: explore its structure", "JSON", "high", 95),
        match("json-validator", "Valid JSON: validate it", "JSON", "high", 93),
      ];
    } catch {
      return [match("json-validator", "Looks like JSON; check its syntax", "JSON", "possible", 65)];
    }
  }

  // 11. SQL
  const sqlPattern = /^\s*(SELECT\s+[\s\S]+?\s+FROM\s+|INSERT\s+INTO\s+[\s\S]+?(?:VALUES|\(|SELECT)|UPDATE\s+[\s\S]+?\s+SET\s+|DELETE\s+FROM\s+|CREATE\s+(?:TABLE|VIEW|INDEX|DATABASE|TRIGGER)\s+|ALTER\s+TABLE\s+|DROP\s+(?:TABLE|VIEW|INDEX|DATABASE)\s+|TRUNCATE\s+(?:TABLE\s+)?|WITH\s+[\w\s,()]+\s+AS\s*\()/i;
  if (sqlPattern.test(text)) {
    return [
      match("sql-formatter", "SQL query or DDL statement; format syntax", "SQL", "high", 94),
      match("sql-validator", "Validate SQL statement syntax", "SQL", "high", 91),
      match("sql-to-json", "Convert SQL records or schema to JSON", "SQL", "high", 87),
    ];
  }

  // 12. Base64 Data & Data URLs
  if (text.startsWith("data:") && /^data:([a-z0-9.+/-]+)?(?:;[a-z0-9-]+=[a-z0-9-]+)*(?:;base64)?,/i.test(text)) {
    if (text.includes(";base64,")) {
      return [
        match("data-uri-decoder", "Base64 Data URL; decode payload", "Base64 Data URL", "high", 96),
        match("base64-decoder", "Decode Base64 payload", "Base64 Data URL", "high", 91),
      ];
    }
    return [match("data-uri-decoder", "Data URI; decode payload", "Base64 Data URL", "high", 92)];
  }

  if (text.startsWith("H4sI") && text.length >= 12 && text.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    return [
      match("gzip-decompressor", "Base64 Gzip archive; decompress it", "Base64 Gzip", "possible", 85),
      match("base64-decoder", "Base64 data; decode it", "Base64 Gzip", "possible", 75),
    ];
  }

  if (text.length >= 12 && text.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    try {
      const decoded = atob(text);
      if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(decoded)) {
        return [match("base64-decoder", "Possibly Base64-encoded text; confirm before decoding", "Base64", "possible", 80)];
      }
    } catch {
      /* Not strict Base64. */
    }
  }

  // 12.5. Legal / Policy Document Detection
  if (
    /(?:privacy\s+policy|terms\s+(?:and|&)\s+conditions|terms\s+of\s+service|cookie\s+policy|refund\s+policy|disclaimer)/i.test(text) &&
    /(?:effective\s+date|last\s+updated|we\s+collect|personal\s+data|governing\s+law|cookies?|liability)/i.test(text)
  ) {
    return [
      match("privacy-policy-generator", "Legal policy document detected (Privacy, Terms, Cookies, or Disclaimer)", "Legal Policy", "high", 95),
      match("terms-and-conditions-generator", "Review or generate terms and conditions", "Legal Policy", "high", 90),
    ];
  }

  // 13. Markdown
  const hasMarkdownTable = /\|[^\n]+\|[^\n]*\n\|[-:\s|]+\|\s*(\n\|[^\n]+\|[^\n]*)+/.test(text);
  const hasFencedCodeBlock = /```[\w-]*\n[\s\S]+?\n```/.test(text);
  const hasHeading = /^#{1,6}\s+\S/m.test(text);
  const hasMarkdownLink = /\[[^\]]+\]\(https?:\/\/[^\s)]+\)/.test(text);
  const hasBlockquote = /^>\s+\S/m.test(text);
  const hasTaskList = /^[-*]\s+\[[ xX]\]\s+\S/m.test(text);
  const markdownFeatureCount = [hasHeading, hasMarkdownLink, hasBlockquote, hasTaskList, hasMarkdownTable, hasFencedCodeBlock].filter(Boolean).length;

  if (hasMarkdownTable || hasFencedCodeBlock || markdownFeatureCount >= 2) {
    return [
      match("markdown-preview", "Structured Markdown with headings, code blocks, or tables", "Markdown", "high", 92),
      match("markdown-formatter", "Format Markdown document", "Markdown", "high", 88),
      match("markdown-to-html", "Convert Markdown to sanitized HTML", "Markdown", "high", 85),
    ];
  }
  if (markdownFeatureCount === 1 && text.includes("\n")) {
    return [
      match("markdown-preview", "Possible Markdown document; preview formatted text", "Markdown", "possible", 70),
      match("markdown-formatter", "Format Markdown content", "Markdown", "possible", 65),
    ];
  }

  // 14. Fallback for unclassified text
  return [match("text-counter", "Plain or unrecognized text; inspect its length", "Plain Text", "possible", 30)];
}

/** Rich wrapper returning structured detection results, top match, confidence, score, and timestamp. */
export function detectClipboardContent(input: string): DetectionResult {
  const matches = detectTools(input);
  const topMatch = matches.length > 0 ? matches[0] : null;
  return {
    matches,
    topMatch,
    text: input,
    timestamp: Date.now(),
    format: topMatch ? topMatch.format : null,
    confidence: topMatch ? topMatch.confidence : null,
    score: topMatch ? topMatch.score : 0,
  };
}
