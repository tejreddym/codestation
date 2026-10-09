export type ToolId = "json-formatter" | "json-validator" | "json-minifier" | "json-to-yaml" | "yaml-to-json" | "json-to-csv" | "csv-to-json" | "json-diff" | "json-tree-viewer" | "json-schema-validator" | "json-schema-generator" | "jsonpath-tester" | "json-escape" | "json-key-sorter" | "json-array-to-object" | "json-object-to-array" | "jsonl-formatter" | "jsonl-validator" | "json-to-jsonl" | "jsonl-to-json" | "json-structure-inspector" | "json-statistics-analyzer" | "csv-formatter" | "csv-validator" | "csv-column-analyzer" | "csv-delimiter-detector" | "csv-to-tsv" | "tsv-to-csv" | "csv-to-markdown" | "csv-to-html" | "csv-cleaner" | "csv-column-reorderer" | "csv-row-filter" | "csv-deduplicator" | "csv-transposer" | "json-to-xml" | "xml-to-json" | "json-to-toml" | "toml-to-json" | "yaml-diff" | "yaml-formatter" | "yaml-validator" | "xml-formatter" | "xml-validator" | "xml-minifier" | "base64" | "url-encoder" | "jwt-decoder" | "html-encoder" | "html-decoder" | "unicode-converter" | "hex-converter" | "uuid-generator" | "password-generator" | "sha-256" | "sha-512" | "random-string" | "regex-tester" | "regex-escape" | "regex-replace-tester" | "regex-match-inspector" | "regex-group-extractor" | "regex-flag-tester" | "regex-pattern-builder" | "regex-capture-group-tester" | "regex-split-tester" | "timestamp-converter" | "text-counter" | "binary-encoder-decoder" | "ascii-converter" | "base32-encoder" | "base32-decoder" | "base58-encoder" | "base58-decoder" | "base64-url-encoder" | "base64-url-decoder" | "data-uri-encoder" | "data-uri-decoder" | "html-entity-encoder" | "html-entity-decoder" | "unicode-escape-encoder" | "unicode-escape-decoder" | "url-component-encoder" | "url-component-decoder" | "punycode-converter" | "hexadecimal-encoder" | "hexadecimal-decoder" | "octal-converter" | "md5-generator" | "sha-1-generator" | "sha-384-generator" | "hmac-generator" | "crc32-generator" | "checksum-generator" | "hash-compare" | "file-hash-generator" | "entropy-calculator" | "password-strength-checker" | "ulid-generator" | "nanoid-generator" | "uuid-parser" | "random-number-generator" | "secure-token-generator" | "hex-random-generator" | "secret-key-generator" | "text-counter" | "case-converter" | "duplicate-line-remover" | "sort-lines" | "reverse-lines" | "reverse-text" | "whitespace-cleaner" | "empty-line-remover" | "prefix-suffix-adder" | "find-replace" | "text-diff" | "slug-generator" | "lorem-ipsum-generator" | "random-text-generator" | "url-extractor" | "email-extractor" | "number-extractor" | "regex-line-extractor" | "line-deduplicator" | "line-shuffler" | "text-normalizer" | "tabs-to-spaces" | "spaces-to-tabs" | "line-ending-converter" | "lf-to-crlf" | "crlf-to-lf" | "bom-detector" | "bom-remover" | "sentence-counter" | "paragraph-counter" | "character-counter-no-spaces";

import { dateTimeTools, type DateTimeToolContract, type DateTimeToolId } from "./date-time-tools";
import { jsonDataTools, type DataToolContract, type JsonDataToolId } from "./json-data-tools";
import { encodingTools, type EncodingToolContract, type EncodingToolId } from "./encoding-tools";
import { securityTools, type SecurityToolContract, type SecurityToolId } from "./security-tools";
import { regexTools, type RegexToolContract, type RegexToolId } from "./regex-tools";
import { textTools, type TextToolContract, type TextToolId } from "./text-tools";
import { cronTools, type CronToolContract, type CronToolId } from "./cron-tools";
import { sqlTools, type SqlToolContract, type SqlToolId } from "./sql-tools";
import { webTools, type WebToolContract, type WebToolId } from "./web-tools";
import { apiTools, type ApiToolContract, type ApiToolId } from "./api-tools";
import { imageTools, type ImageToolId } from "./image-tools";
import type { LocalContract } from "./local-contract";
import { spreadsheetTools, type SpreadsheetToolId } from "./spreadsheet-tools";
import { markdownTools, type MarkdownToolId } from "./markdown-tools";
import { colorTools, type ColorToolId } from "./color-tools";
import { numericTools, type NumericToolId } from "./numeric-tools";
import { extendedTools, type ExtendedToolId } from "./extended-tools";

/** Includes the legacy catalog plus typed station metadata; no browser code. */
export type RegisteredToolId = ToolId | DateTimeToolId | JsonDataToolId | EncodingToolId | SecurityToolId | RegexToolId | TextToolId | CronToolId | SqlToolId | WebToolId | ApiToolId | ImageToolId | SpreadsheetToolId | MarkdownToolId | ColorToolId | NumericToolId | ExtendedToolId;
export type ToolDefinition = { id: RegisteredToolId; slug: string; name: string; description: string; category: string; keywords: readonly string[]; featured?: boolean; pairId?: string; direction?: "forward" | "reverse"; pairedTool?: RegisteredToolId; inputFormat?: string; outputFormat?: string; inputType?: string; outputType?: string; dataContract?: DataToolContract; encodingContract?: EncodingToolContract; securityContract?: SecurityToolContract; regexContract?: RegexToolContract; dateTimeContract?: DateTimeToolContract; textContract?: TextToolContract; cronContract?: CronToolContract; sqlContract?: SqlToolContract; webContract?: WebToolContract; apiContract?: ApiToolContract; localContract?: LocalContract; relatedTools?: readonly string[]; seo?: { title?: string; description?: string }; };

export const tools: ToolDefinition[] = [
  ...jsonDataTools,
  ...encodingTools,
  ...securityTools,
  ...regexTools,
  ...dateTimeTools,
  ...textTools,
  ...cronTools,
  ...sqlTools,
  ...webTools,
  ...apiTools,
  ...imageTools.filter(tool => tool.id !== "favicon-generator"),
  ...spreadsheetTools,
  ...markdownTools,
  ...colorTools,
  ...numericTools,
  ...(extendedTools as unknown as ToolDefinition[]),
];

export function getTool(slug: string) { return tools.find((tool) => tool.slug === slug); }
