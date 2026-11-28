/**
 * Node Registry Bridge for Code Station MCP
 *
 * Discovers all registered tools from config/tools.ts and executes every `node-pure`
 * tool through the existing pure lib/tools engines with zero duplicated implementations.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  tools,
  getTool,
  classifyToolRuntime,
  type ToolDefinition,
  type ToolRuntimeCompatibility,
} from "../config/tools";
import { stations } from "../config/stations";
import { resolveToolKey } from "../lib/engine/adapters/registryAdapter";
import { getProUpgradeNotice, isFreeTierSlug, type LicenseStatus } from "./config";

// Pure engine entrypoints (zero DOM/Canvas/WebAudio dependencies)
import { runDataTool } from "../lib/tools/json-data";
import { generateMockDataset, type MockTemplate, type MockFieldType } from "../lib/tools/mock-data";
import { runEncoding } from "../lib/tools/encoding";
import { runSecurity } from "../lib/tools/security";
import { auditEnv, formatEnvAuditReport } from "../lib/tools/env-audit";
import { runRegex } from "../lib/tools/regex/engine";
import { runDateTime } from "../lib/tools/date-time/engine";
import { runText } from "../lib/tools/text/engine";
import { runCron } from "../lib/tools/cron/engine";
import { runSql } from "../lib/tools/sql/engine";
import { inspectWeb } from "../lib/tools/web/inspect";
import { generateWeb } from "../lib/tools/web/generate";
import { localApi } from "../lib/tools/api/local";
import { convertApi } from "../lib/tools/api/curl";
import { curlToCode, type CurlTargetLanguage } from "../lib/tools/curl-to-code";
import { svgText } from "../lib/tools/image/svg";
import { runMarkdown } from "../lib/tools/markdown/engine";
import { runColor } from "../lib/tools/color/engine";
import { runUnitConverter } from "../lib/tools/unit/engine";
import { runTemperatureConverter } from "../lib/tools/temperature/engine";
import { runNumberBaseConverter } from "../lib/tools/number-base/engine";
import {
  parseAndResolveGitConflicts,
  formatConflictReport,
  type ConflictStrategy,
} from "../lib/tools/git-conflict";
import {
  buildConventionalCommit,
  formatCommitBuilderOutput,
  parseConventionalCommit,
  explainGitCommand,
  generateChangelog,
  generateGitAttributes,
  generateGitHook,
  type GitAttributesEol,
  type GitHookType,
  type GitLinguistFlag,
} from "../lib/tools/git";
import { generateQrCodeSvg } from "../lib/tools/qr-barcode/engine";
import {
  jsonToTypescript,
  jsonToZod,
  jsonToGo,
  jsonToPydantic,
  jsonToRust,
  sqlToTypescript,
  htmlToJsx,
  svgToJsx,
} from "../lib/tools/code-gen/engine";
import {
  calculateCidr,
  convertIp,
  inspectCertificate,
  searchPorts,
  generateGitignore,
  generateDockerfile,
  dockerRunToCompose,
  parseSemver,
  compareSemver,
} from "../lib/tools/network/engine";
import { generateCssGrid, generateGlassmorphism } from "../lib/tools/css/engine";
import {
  calculateBitwise,
  inspectIeee754,
  calculateTwosComplement,
  calculateBigInt,
  addMatrices,
  multiplyMatrices,
  transposeMatrix,
  determinantMatrix,
  calculateGcdLcmPair,
  primeFactors,
  convertToFraction,
} from "../lib/tools/dev-math/engine";
import { compressGzip, decompressGzip } from "../lib/tools/compression/engine";
import {
  encryptAesGcm,
  decryptAesGcm,
  generateRsaKeyPair,
  signJwt,
  verifyJwt,
  parseCsr,
  buildCspHeader,
  type AesKeyOptions,
  type CspDirectives,
} from "../lib/tools/crypto-pki/engine";
import {
  countTokens,
  repairJson,
  interpolatePrompt,
  parseVectorInput,
  computeVectorSimilarity,
  buildSystemPrompt,
  type AiModelId,
  type SystemPromptConfig,
} from "../lib/tools/ai-prompts/engine";
import { generatePolicyText } from "../lib/tools/policy-generators/engine";
import type { PolicyOutputFormat, PolicyToolId } from "../lib/tools/policy-generators/types";
import { calculateEmi } from "../lib/tools/finance/emi";
import { comparePrepayment, type PrepaymentStrategy } from "../lib/tools/finance/prepayment";
import {
  calculateGst,
  calculateGstLines,
  type GstLineInput,
  type GstMode,
  type GstSupply,
} from "../lib/tools/finance/gst";
import { projectSip } from "../lib/tools/finance/sip";
import { calculateInvoiceTotals, getSampleInvoice } from "../lib/tools/productivity/invoice";

import {
  VIRTUAL_NODE_FILE_DESCRIPTORS,
  VIRTUAL_NODE_FILE_MAP,
  WIRED_NODE_FILE_SLUGS,
  executeNodeFileTool,
  type NodeFileToolDescriptor,
} from "./file-tools";

export type BridgeToolTier = "free" | "pro";

export interface BridgeToolSample {
  input?: string;
  options?: Record<string, unknown>;
}

export interface BridgeToolMetadata {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  stationId: string;
  stationName: string;
  mcpName: string;
  tier: BridgeToolTier;
  runtimeCompatibility: ToolRuntimeCompatibility;
  nodeFileSupported: boolean;
  canonicalUrl: string;
  keywords: readonly string[];
  inputSchema: Record<string, unknown>;
  examples: Array<{ description: string; arguments: { slug: string; input?: string; options?: Record<string, unknown> } }>;
}

export interface BridgeListFilter {
  station?: string;
  query?: string;
  tier?: "free" | "pro" | "all";
  runtime?: ToolRuntimeCompatibility | "all";
  limit?: number;
}

/** Build category/tool -> station lookup from config/stations.ts */
const stationLookupByToolId = new Map<string, { id: string; name: string }>();
const stationLookupByCategory = new Map<string, { id: string; name: string }>();
for (const station of stations) {
  stationLookupByCategory.set(station.name, { id: station.id, name: station.name });
  if (station.id !== "converters") {
    for (const toolId of station.toolList) {
      if (!stationLookupByToolId.has(toolId)) {
        stationLookupByToolId.set(toolId, { id: station.id, name: station.name });
      }
    }
  }
}

export function slugToMcpName(slug: string): string {
  return `codestation_${slug.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export function resolveStationForTool(tool: Pick<ToolDefinition, "id" | "category">): { id: string; name: string } {
  return (
    stationLookupByToolId.get(tool.id) ??
    stationLookupByCategory.get(tool.category) ?? {
      id: tool.category.toLowerCase().replace(/ & /g, "-").replace(/[^a-z0-9]+/g, "-"),
      name: tool.category,
    }
  );
}

export function resolveBridgeToolTier(slugOrMcpName: string): BridgeToolTier {
  const norm = slugOrMcpName.toLowerCase().trim().replace(/^codestation[-_]/, "").replace(/_/g, "-");
  if (isFreeTierSlug(norm) || isFreeTierSlug(resolveToolKey(norm))) return "free";
  return "pro";
}

function resolveDefinition(slugOrId: string): ToolDefinition | undefined {
  const cleaned = slugOrId.trim();
  const direct = getTool(cleaned) ?? tools.find((t) => t.id === cleaned || slugToMcpName(t.slug) === cleaned);
  if (direct) return direct;
  const resolved = resolveToolKey(cleaned.replace(/^codestation[-_]/, "").replace(/_/g, "-"));
  return getTool(resolved) ?? tools.find((t) => t.id === resolved || t.slug === resolved);
}

const SAMPLE_CERT_PEM = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBZjCCAQygAwIBAgIUF3WXiINRKH4dpsjzp5KEHnvrZ1IwCgYIKoZIzj0EAwIw",
  "GTEXMBUGA1UEAwwOY29kZXN0YXRpb24uaW4wHhcNMjYxMTI4MDMwMzI2WhcNMjcx",
  "MTI4MDMwMzI2WjAZMRcwFQYDVQQDDA5jb2Rlc3RhdGlvbi5pbjBZMBMGByqGSM49",
  "AgEGCCqGSM49AwEHA0IABCjIotqsMD4tKje4z6q7anSoF1VzLAYwl85P1UTyyVxy",
  "Ni6pro6HSj6kRVryXsDCj/6AYCdRWdTsaDvIhkm6WmijMjAwMB0GA1UdDgQWBBSB",
  "Lzt3hTsnvbLrVZYUlmuPVCt8UTAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMC",
  "A0gAMEUCIQDinvVdsuJVYxeTHc1C3DBT3PJLQv02muKMC+gpNUgvYwIgSnsvWX1f",
  "BG8CDin5GbrzRr977Qc+8wN1Vdbey58Mewg=",
  "-----END CERTIFICATE-----",
].join("\n");

/**
 * Generates deterministic, valid sample inputs & options for every `node-pure` tool.
 * Used both for `codestation_describe_tool` examples and exhaustive Node runtime verification.
 */
export function getToolSampleArgs(tool: ToolDefinition): BridgeToolSample {
  const id = tool.id;
  switch (id) {
    // JSON & Data
    case "json-formatter":
    case "json-minifier":
    case "json-validator":
    case "json-tree-viewer":
    case "json-schema-generator":
    case "json-key-sorter":
    case "json-object-to-array":
    case "json-structure-inspector":
    case "json-statistics-analyzer":
    case "json-to-yaml":
    case "json-to-xml":
    case "json-to-toml":
      return { input: '{"b":2,"a":1,"tags":["mcp","node"]}' };
    case "json-diff":
      return { input: '{"a":1,"b":2}', options: { secondary: '{"a":1,"b":3}' } };
    case "json-schema-validator":
      return {
        input: '{"name":"Code Station"}',
        options: { secondary: '{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}' },
      };
    case "jsonpath-tester":
      return { input: '{"users":[{"name":"Ada"},{"name":"Grace"}]}', options: { expression: "$.users[*].name" } };
    case "json-escape":
      return { input: 'hello "world"\nline2' };
    case "json-unescape":
      return { input: '"hello \\"world\\""' };
    case "json-array-to-object":
      return { input: '[{"key":"a","value":1},{"key":"b","value":2}]', options: { key: "key" } };
    case "jsonl-formatter":
    case "jsonl-validator":
    case "jsonl-to-json":
      return { input: '{"id":1}\n{"id":2}' };
    case "json-to-jsonl":
    case "json-to-csv":
      return { input: '[{"name":"Ada","role":"Engineer"},{"name":"Lin","role":"Designer"}]' };
    case "csv-formatter":
    case "csv-validator":
    case "csv-delimiter-detector":
    case "csv-to-json":
    case "csv-to-tsv":
    case "csv-to-markdown":
    case "csv-to-html":
    case "csv-cleaner":
    case "csv-deduplicator":
    case "csv-transposer":
      return { input: "name,role\nAda,Engineer\nLin,Designer" };
    case "csv-column-analyzer":
      return { input: "name,score\nAda,10\nLin,20", options: { column: "score" } };
    case "csv-column-reorderer":
      return { input: "name,role\nAda,Engineer", options: { order: "role\nname" } };
    case "csv-row-filter":
      return { input: "name,role\nAda,Engineer\nLin,Designer", options: { column: "name", operator: "Equals", value: "Ada" } };
    case "tsv-to-csv":
      return { input: "name\trole\nAda\tEngineer" };
    case "yaml-to-json":
    case "yaml-formatter":
    case "yaml-validator":
      return { input: "name: Code Station\nversion: 1" };
    case "yaml-diff":
      return { input: "name: Code Station", options: { secondary: "name: Code Station Pro" } };
    case "xml-to-json":
    case "xml-formatter":
    case "xml-validator":
    case "xml-minifier":
      return { input: "<root><item>hello</item></root>" };
    case "toml-to-json":
      return { input: 'title = "Code Station"\nport = 3000' };
    case "mock-data":
      return { options: { template: "users", count: 2, format: "json" } };

    // Encoding
    case "base64-decoder":
      return { input: "SGVsbG8gd29ybGQ=" };
    case "base64-url-decoder":
      return { input: "SGVsbG8gd29ybGQ" };
    case "base32-decoder":
      return { input: "JBSWY3DPEBLW64TMMQ======" };
    case "base58-decoder":
      return { input: "JxF12TrwUP45BMd" };
    case "url-decoder":
    case "url-component-decoder":
      return { input: "hello%20world" };
    case "jwt-decoder":
      return { input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSJ9.sig" };
    case "html-decoder":
    case "html-entity-decoder":
      return { input: "&lt;div&gt;hello&lt;/div&gt;" };
    case "text-to-unicode":
      return { input: "Hello" };
    case "unicode-to-text":
      return { input: "U+0048 U+0069" };
    case "unicode-escape-decoder":
      return { input: "Hello \\u0041" };
    case "hex-to-text":
    case "hexadecimal-decoder":
      return { input: "48656c6c6f" };
    case "binary-decoder":
      return { input: "01001000 01101001" };
    case "ascii-to-text":
      return { input: "72 105" };
    case "data-uri-encoder":
      return { input: "Hello", options: { mime: "text/plain" } };
    case "data-uri-decoder":
      return { input: "data:text/plain;base64,SGVsbG8=" };
    case "punycode-encoder":
      return { input: "münchen.de" };
    case "punycode-decoder":
      return { input: "xn--mnchen-3ya.de" };
    case "octal-to-text":
      return { input: "110 151" };

    // Security
    case "uuid-parser":
      return { input: "550e8400-e29b-41d4-a716-446655440000" };
    case "hmac-generator":
      return { input: "message", options: { secret: "top-secret", algorithm: "HMAC-SHA-256" } };
    case "hash-compare":
      return { input: "abc123", options: { hashB: "abc123" } };
    case "random-number-generator":
      return { options: { minimum: "1", maximum: "100", count: "3" } };
    case "random-string-generator":
      return { options: { length: "16", characterSet: "Alphanumeric" } };
    case "secure-token-generator":
    case "hex-random-generator":
      return { options: { bytes: "16", encoding: "Hex" } };
    case "secret-key-generator":
      return { options: { keySize: "256" } };
    case "checksum-generator":
      return { input: "hello", options: { algorithm: "SHA-256" } };
    case "env-audit":
      return { input: "NODE_ENV=production\nPORT=3000" };

    // Regex
    case "regex-escape":
      return { input: "a.b*c?" };
    case "regex-pattern-builder":
      return { input: "hello", options: { mode: "Exact text", quantifier: "Exactly once" } };
    case "regex-replace-tester":
      return { input: "foo 123 bar", options: { pattern: "\\d+", replacement: "NUM", flags: "g" } };
    case "regex-split-tester":
      return { input: "a,b,c", options: { pattern: ",", flags: "" } };
    case "regex-tester":
    case "regex-match-inspector":
    case "regex-group-extractor":
    case "regex-flag-tester":
    case "regex-capture-group-tester":
      return { input: "user=ada id=42", options: { pattern: "(\\w+)=(\\w+)", flags: "g" } };

    // Date & Time
    case "unix-timestamp-converter":
    case "epoch-converter":
      return { input: "1700000000", options: { unit: "Seconds" } };
    case "unix-milliseconds-converter":
      return { input: "1700000000000" };
    case "unix-timestamp-generator":
    case "date-to-timestamp":
      return { options: { date: "2026-10-01", time: "12:00:00", timezone: "UTC" } };
    case "timestamp-to-date":
      return { input: "1700000000", options: { unit: "Seconds", timezone: "UTC" } };
    case "timezone-converter":
      return { options: { date: "2026-10-01", time: "12:00", sourceTimezone: "UTC", destinationTimezone: "Asia/Kolkata" } };
    case "iso-8601-converter":
      return { input: "2026-10-01T12:00:00Z" };
    case "current-time-in-timezone":
      return { options: { timezone: "UTC" } };
    case "date-difference-calculator":
      return { options: { startDate: "2026-01-01", startTime: "00:00", endDate: "2026-01-10", endTime: "00:00" } };
    case "time-difference-calculator":
      return { options: { startTime: "09:00:00", endTime: "17:30:00" } };
    case "relative-time-generator":
      return { options: { target: "2026-10-02T12:00:00Z", reference: "2026-10-01T12:00:00Z" } };
    case "date-format-converter":
      return { input: "2026-10-01", options: { inputFormat: "YYYY-MM-DD", outputFormat: "DD/MM/YYYY" } };
    case "week-number-calculator":
      return { input: "2026-10-01", options: { convention: "ISO 8601" } };
    case "leap-year-checker":
      return { input: "2024" };
    case "business-days-calculator":
      return { options: { startDate: "2026-10-01", endDate: "2026-10-15", weekend: "Saturday + Sunday" } };
    case "age-calculator":
      return { options: { birthDate: "1995-05-15", targetDate: "2026-10-01" } };

    // Text
    case "find-replace":
      return { input: "hello world", options: { find: "world", replacement: "node" } };
    case "text-diff":
      return { input: "line 1\nline 2", options: { textB: "line 1\nline 3" } };
    case "regex-line-extractor":
      return { input: "ERROR failed\nINFO ok", options: { pattern: "^ERROR", flags: "" } };

    // Cron
    case "cron-generator":
      return { options: { minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1-5" } };
    case "human-to-cron":
      return { input: "every day at 09:00" };
    case "cron-validator":
    case "cron-explainer":
    case "cron-to-human":
    case "cron-next-run":
      return { input: "0 9 * * 1-5", options: { reference: "2026-10-01T00:00:00Z", timezone: "UTC" } };

    // SQL & Database
    case "sql-formatter":
    case "sql-minifier":
    case "sql-validator":
      return { input: "SELECT id, name FROM users WHERE active = 1;", options: { dialect: "PostgreSQL" } };
    case "json-to-sql":
      return { input: '[{"id":1,"name":"Ada"}]', options: { table: "users", dialect: "PostgreSQL" } };
    case "sql-to-json":
    case "sql-to-csv":
    case "sql-to-markdown":
      return { input: "INSERT INTO users (id, name) VALUES (1, 'Ada');", options: { dialect: "PostgreSQL" } };
    case "csv-to-sql":
      return { input: "id,name\n1,Ada", options: { table: "users", dialect: "PostgreSQL" } };
    case "sql-insert-generator":
      return {
        options: {
          dialect: "PostgreSQL",
          table: "users",
          columns: ["id", "name"],
          rows: [[{ type: "Number", value: "1" }, { type: "String", value: "Ada" }]],
        },
      };
    case "sql-update-generator":
      return {
        options: {
          dialect: "PostgreSQL",
          table: "users",
          assignments: [{ column: "name", value: { type: "String", value: "Ada" } }],
          conditions: [{ column: "id", operator: "=", values: [{ type: "Number", value: "1" }] }],
        },
      };
    case "sql-delete-generator":
      return {
        options: {
          dialect: "PostgreSQL",
          table: "users",
          conditions: [{ column: "id", operator: "=", values: [{ type: "Number", value: "1" }] }],
        },
      };
    case "sql-select-builder":
      return {
        options: {
          dialect: "PostgreSQL",
          table: "users",
          columns: ["id", "name"],
          conditions: [],
          orderBy: [],
        },
      };
    case "sql-where-builder":
      return {
        options: {
          dialect: "PostgreSQL",
          logicalOperator: "AND",
          conditions: [{ column: "active", operator: "=", values: [{ type: "Boolean", value: "true" }] }],
        },
      };
    case "database-connection-string-builder":
      return { options: { databaseType: "PostgreSQL", host: "localhost", port: "5432", database: "app", username: "postgres", password: "" } };
    case "database-connection-string-parser":
      return { input: "postgresql://user@localhost:5432/app?sslmode=require" };
    case "er-diagram-generator":
      return { input: "CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255) NOT NULL);", options: { dialect: "PostgreSQL" } };
    case "sql-escape-helper":
      return { input: "O'Reilly", options: { valueType: "String", dialect: "PostgreSQL" } };

    // Web
    case "url-parser":
    case "url-path-analyzer":
    case "url-encoding-inspector":
    case "canonical-url-generator":
      return { input: "https://codestation.in/tools/json-formatter?a=1#top" };
    case "url-builder":
      return { options: { scheme: "https", hostname: "codestation.in", pathname: "/tools" } };
    case "query-string-parser":
      return { input: "?a=1&b=hello" };
    case "query-string-generator":
      return { options: { parameters: [{ key: "a", value: "1" }, { key: "b", value: "two" }] } };
    case "url-fragment-parser":
      return { input: "#section-one" };
    case "http-status-code-lookup":
      return { input: "200" };
    case "mime-type-lookup":
      return { input: ".json" };
    case "http-header-reference":
      return { input: "Content-Type" };
    case "user-agent-parser":
      return { input: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36" };
    case "meta-tag-generator":
    case "open-graph-generator":
    case "open-graph-preview":
      return { options: { title: "Code Station", description: "Local developer toolbox", url: "https://codestation.in" } };
    case "twitter-card-generator":
      return { options: { cardType: "summary_large_image", title: "Code Station", description: "Local developer toolbox" } };
    case "robots-txt-generator":
      return { options: { groups: [{ userAgent: "*", disallow: ["/admin"] }] } };
    case "sitemap-generator":
      return { options: { entries: [{ url: "https://codestation.in/" }] } };
    case "web-app-manifest-generator":
      return { options: { name: "Code Station", shortName: "CodeStation", startUrl: "/" } };
    case "html-entity-reference":
      return { input: "&amp;" };

    // API
    case "curl-to-fetch":
    case "curl-to-axios":
    case "curl-to-python-requests":
    case "curl-to-any-language":
      return { input: "curl -X GET https://api.example.com/health" };
    case "fetch-to-curl":
      return { input: 'fetch("https://api.example.com/health", { method: "GET" })' };
    case "http-header-builder":
      return { options: { entries: [{ name: "Accept", value: "application/json" }] } };
    case "http-header-parser":
      return { input: "Content-Type: application/json\nAccept: */*" };
    case "rest-api-request-builder":
      return { options: { method: "GET", url: "https://api.example.com/users" } };
    case "json-request-body-builder":
      return { options: { fields: [{ key: "name", value: "Ada", valueType: "String" }] } };
    case "api-response-formatter":
      return { input: '{"ok":true}', options: { format: "JSON" } };
    case "graphql-formatter":
      return { input: "query { user { id name } }" };
    case "graphql-query-builder":
      return { options: { operationType: "query", operationName: "GetUser", rootField: "user", selectedFields: ["id", "name"] } };
    case "graphql-variables-formatter":
      return { input: '{"userId":123}' };
    case "http-request-builder":
      return { options: { method: "GET", path: "/health", headers: [{ name: "Host", value: "api.example.com" }] } };
    case "basic-auth-header-generator":
      return { options: { username: "dev", password: "secret" } };
    case "bearer-token-header-generator":
      return { input: "tok_example_123" };

    // SVG (Image station pure subset)
    case "svg-formatter":
    case "svg-minifier":
      return { input: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>' };

    // Markdown
    case "markdown-table-generator":
      return { options: { columns: "Name, Role", rows: "Ada, Engineer" } };
    case "markdown-task-list-generator":
      return { options: { items: "Build MCP,true\nWrite tests,false" } };
    case "markdown-blockquote-generator":
      return { input: "Local-first tooling" };
    case "markdown-code-block-generator":
      return { input: "console.log('hello');", options: { language: "ts" } };
    case "markdown-list-generator":
      return { options: { items: "First\nSecond", listType: "Bullet" } };
    case "html-to-markdown":
      return { input: "<h1>Hello</h1><p>World</p>" };
    case "csv-to-markdown-table":
      return { input: "name,role\nAda,Engineer" };
    case "markdown-frontmatter-parser":
      return { input: "---\ntitle: Guide\n---\n# Hello" };
    case "markdown-formatter":
    case "markdown-preview":
    case "markdown-toc-generator":
    case "markdown-to-html":
    case "markdown-to-text":
    case "markdown-escape":
    case "markdown-link-extractor":
    case "markdown-image-extractor":
    case "markdown-heading-analyzer":
    case "markdown-statistics":
      return { input: "# Title\n\nSome **bold** text with [link](https://codestation.in) and ![img](https://codestation.in/a.png)." };

    // Color & CSS
    case "color-converter":
    case "palette-generator":
      return { input: "#336699" };
    case "contrast-checker":
      return { options: { foreground: "#111111", background: "#ffffff" } };
    case "css-gradient-generator":
      return { options: { type: "Linear", angle: 90, stops: "#336699 0%\n#66ccff 100%" } };
    case "box-shadow-generator":
      return { options: { layers: "0px 8px 24px 0px rgba(0, 0, 0, 0.2)" } };
    case "border-radius-generator":
      return { options: { unit: "px", mode: "Uniform", values: "12px" } };

    // Converters
    case "unit-converter":
      return { input: "5", options: { category: "length", from: "kilometer", to: "meter" } };
    case "temperature-converter":
      return { input: "100", options: { from: "celsius", to: "fahrenheit" } };
    case "number-base-converter":
      return { input: "255", options: { fromBase: 10, toBase: 16 } };

    // Git
    case "conflict-parse":
      return { input: "<<<<<<< HEAD\nconst a = 1;\n=======\nconst a = 2;\n>>>>>>> branch" };
    case "conventional-commit-builder":
      return { input: "add hybrid mcp bridge", options: { type: "feat", scope: "mcp" } };
    case "conventional-commit-validator":
      return { input: "feat(mcp): add hybrid registry bridge" };
    case "git-command-explainer":
      return { input: "git rebase -i HEAD~3" };
    case "changelog-generator":
      return { input: "abc1234 feat(mcp): add tools\ndef5678 fix: handle edge case" };
    case "gitattributes-generator":
      return { options: { eol: "lf" } };
    case "git-hooks-generator":
      return { input: "npm run typecheck", options: { hook: "pre-commit" } };

    // QR
    case "qr-code-generator":
      return { input: "https://codestation.in" };

    // Code Generation
    case "json-to-typescript":
    case "json-to-zod":
    case "json-to-go":
    case "json-to-pydantic":
    case "json-to-rust":
      return { input: '{"id":1,"name":"Code Station","active":true}' };
    case "sql-to-typescript":
      return { input: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL);" };
    case "html-to-jsx":
      return { input: '<div class="card"><label for="email">Email</label></div>' };
    case "svg-to-jsx":
      return { input: '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>' };

    // Network & DevOps
    case "cidr-calculator":
      return { input: "192.168.1.0/24" };
    case "ipv4-to-ipv6":
      return { input: "192.0.2.1" };
    case "cert-inspector":
      return { input: SAMPLE_CERT_PEM };
    case "port-reference":
      return { input: "5432" };
    case "gitignore-generator":
      return { options: { presets: ["Node", "macOS"] } };
    case "dockerfile-generator":
      return { options: { language: "node", version: "22-alpine", port: 3000 } };
    case "docker-run-to-compose":
      return { input: "docker run -d -p 8080:80 --name web nginx:alpine" };
    case "semver-calculator":
      return { input: "1.2.3", options: { compareTo: "1.3.0" } };

    // Frontend & CSS (pure CSS generators)
    case "css-grid-generator":
      return { options: { columns: "1fr 1fr", rows: "auto auto", columnGap: 16, rowGap: 16 } };
    case "glassmorphism-generator":
      return { options: { blur: 12, transparency: 0.2 } };

    // Developer Math
    case "bitwise-calculator":
      return { input: "12", options: { b: 5, bitWidth: 32 } };
    case "ieee754-converter":
      return { input: "3.14", options: { precision: "float32" } };
    case "twos-complement":
      return { input: "-42", options: { bits: 32 } };
    case "bigint-calculator":
      return { input: "9007199254740993", options: { b: "10", op: "+" } };
    case "matrix-calculator":
      return { options: { operation: "multiply", a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]] } };
    case "gcd-lcm-calculator":
      return { input: "24", options: { b: 36 } };
    case "fraction-converter":
      return { input: "0.75" };

    // Compression (pure text/base64 gzip)
    case "gzip-compressor":
      return { input: "Hello Code Station!", options: { format: "gzip" } };
    case "gzip-decompressor":
      return { input: "H4sIAAAAAAAAE/NIzcnJVyjOT1FILC5JzM8DAELcP9MQAAAA", options: { format: "gzip" } };

    // WebPKI
    case "aes-crypto":
      return { input: "secret message", options: { mode: "encrypt", passphrase: "demo-passphrase" } };
    case "rsa-key-generator":
      return { options: { modulusLength: 2048 } };
    case "jwt-signer-verifier":
      return { input: '{"sub":"ada"}', options: { action: "sign", secret: "super-secret-signing-key-1234" } };
    case "csr-inspector":
      return {
        input:
          "-----BEGIN CERTIFICATE REQUEST-----\nMIIDATCCAekCAQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWEx\nFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFDASBgNVBAoMC0NvZGVTdGF0aW9uMRQw\nEgYDVQQLDAtFbmdpbmVlcmluZzEUMBIGA1UEAwwLZXhhbXBsZS5jb20wggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJmvSQ210ROEgCHZMq1LW/zonwJsZZ\n1qUYgGC07Zph+zxX5kpZG51jcVmz1TlufkD9J4NQA9Y+6GMa08CL+33C4JlMV7D7\neQ7KpYYpnWlwOtN+K4juD1gCL0bhEaYiuzSQPDud1kwiXIswRerAVj7nf0hBvU9p\ngI64lLJFo3nd/DBtgn+Ddk6ttbvNPvBymo4nci4uIOySL9TxQF9fty7ytpN65shA\nyeYIx9T/k8G0L01iRUQ0ad9R2Rqsmtt+YsV6fVdwy94sjvZ9sUAePSZGsskpmUnN\n/hZMuPJvudSsqNeTdbUWRzqw643jSoYijG16EPkDHBmLyS299WsDq+z1AgMBAAGg\nQDA+BgkqhkiG9w0BCQ4xMTAvMC0GA1UdEQQmMCSCC2V4YW1wbGUuY29tgg93d3cu\nZXhhbXBsZS5jb22HBMCoAWQwDQYJKoZIhvcNAQELBQADggEBAL5qqIhyUM+fazXC\nBGT5khvCtIUMJsshMHXFW+IcjTmF5VG1GtnZ3Oey5+Z3vTJ3PcUiJpovQ6+HPoct\nO6ec405DIoggf660Q56AMSk3khoaAdWcq3guMFJcSP4+0afKF7kYzbESRAVccsRz\n/n7dHfXCedJzDrsdUyIucidxFVhwrLzBRv0MmjRDXEtSCDMiP+dosJWMxbPkS/HW\nhS5G+58QVDKcFgWaZ7HIKbu0tNLKiCqP06/dH5vf+fldF54PvIq1/fQjCiTx0qF/\n7FGRe334sHNay2UjDWxMWN/IAHqCWKfGJ6fE2Vv8qr+TTOziUscwC0e00zrGaeuX\nlQKOGyc=\n-----END CERTIFICATE REQUEST-----",
      };
    case "csp-builder":
      return { input: '{"default-src":["\'self\'"],"script-src":["\'self\'"]}' };

    // AI & Prompt Engineering
    case "ai-token-counter":
      return { input: "Count tokens cleanly across models.", options: { model: "gpt-4o" } };
    case "json-repair":
      return { input: "{name: 'Code Station', active: True,}" };
    case "prompt-interpolator":
      return { input: "Hello {{name}}", options: { records: [{ name: "Ada" }] } };
    case "vector-similarity":
      return { input: "1, 0, 0", options: { vecB: "0.8, 0.6, 0" } };
    case "system-prompt-builder":
      return { input: "Review TypeScript changes carefully.", options: { roleName: "Code Reviewer" } };

    // Policy Generators
    case "privacy-policy-generator":
    case "terms-and-conditions-generator":
    case "cookie-policy-generator":
    case "disclaimer-generator":
    case "refund-policy-generator":
      return { options: { companyName: "Code Station", websiteUrl: "https://codestation.in", contactEmail: "support@codestation.in", format: "markdown" } };

    // Finance & Productivity
    case "emi-calculator":
      return { options: { principal: 500000, annualRate: 8.5, months: 60 } };
    case "loan-prepayment-calculator":
      return { options: { principal: 500000, annualRate: 9, months: 60, oneTime: 50000 } };
    case "gst-calculator":
      return { options: { amount: 1000, rate: 18, mode: "exclusive", supply: "intra" } };
    case "sip-calculator":
      return { options: { monthly: 5000, years: 10, annualReturn: 12 } };
    case "invoice-generator":
      return { options: { currency: "USD", currencySymbol: "$", taxRate: 10 } };

    // Node File Tools (local file path / base64 without native addons)
    case "pdf-merge":
      return { options: { inputPaths: ["/path/to/first.pdf", "/path/to/second.pdf"], outputPath: "/path/to/merged.pdf" } };
    case "pdf-split":
      return { options: { inputPath: "/path/to/document.pdf", pages: "1-2", outputPath: "/path/to/split.pdf" } };
    case "pdf-rotate":
      return { options: { inputPath: "/path/to/document.pdf", angle: 90, pages: "1", outputPath: "/path/to/rotated.pdf" } };
    case "pdf-watermark":
      return { options: { inputPath: "/path/to/document.pdf", text: "CONFIDENTIAL", opacity: 0.35, fontSize: 48, outputPath: "/path/to/watermarked.pdf" } };
    case "pdf-page-deleter":
      return { options: { inputPath: "/path/to/document.pdf", pages: "2", outputPath: "/path/to/trimmed.pdf" } };
    case "pdf-page-numberer":
      return { options: { inputPath: "/path/to/document.pdf", position: "bottom-center", fontSize: 12, outputPath: "/path/to/numbered.pdf" } };
    case "pdf-compressor":
      return { options: { inputPath: "/path/to/document.pdf", outputPath: "/path/to/compressed.pdf" } };
    case "workbook-inspector":
      return { options: { inputPath: "/path/to/workbook.xlsx" } };
    case "excel-to-json":
      return { options: { inputPath: "/path/to/workbook.xlsx", sheet: "Sheet1", outputPath: "/path/to/output.json" } };
    case "json-to-excel":
    case "csv-to-excel":
      return { options: { inputPath: "/path/to/input.json", outputPath: "/path/to/output.xlsx" } };
    case "excel-to-csv":
      return { options: { inputPath: "/path/to/workbook.xlsx", sheet: "Sheet1", outputPath: "/path/to/output.csv" } };
    case "zip-creator":
      return { options: { inputPaths: ["/path/to/a.txt", "/path/to/b.json"], outputPath: "/path/to/archive.zip" } };
    case "zip-extractor":
      return { options: { inputPath: "/path/to/archive.zip", outputDir: "/path/to/extracted" } };
    case "image-dimension-inspector":
    case "image-metadata-viewer":
      return { options: { inputPath: "/path/to/image.png" } };
    case "file-hash-generator":
      return { options: { inputPath: "/path/to/file.bin", algorithm: "sha256" } };

    default:
      return { input: "Hello Code Station" };
  }
}

function buildOptionsSchema(tool: ToolDefinition): Record<string, unknown> {
  const sample = getToolSampleArgs(tool);
  const sampleOpts = sample.options ?? {};
  const properties: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(sampleOpts)) {
    const t = Array.isArray(val) ? "array" : typeof val;
    properties[key] = {
      type: t === "number" ? "number" : t === "boolean" ? "boolean" : t === "array" ? "array" : t === "object" ? "object" : "string",
      description: `Optional parameter '${key}' (example: ${JSON.stringify(val)})`,
    };
  }
  return {
    type: "object",
    description: "Optional tool-specific configuration parameters.",
    properties,
  };
}

export function buildBridgeMetadata(tool: ToolDefinition): BridgeToolMetadata {
  const station = resolveStationForTool(tool);
  const runtimeCompatibility = tool.runtimeCompatibility ?? classifyToolRuntime(tool.id);
  const nodeFileSupported = runtimeCompatibility === "node-file" && WIRED_NODE_FILE_SLUGS.has(tool.slug);
  const tier = resolveBridgeToolTier(tool.id);
  const sample = getToolSampleArgs(tool);

  const schema: Record<string, unknown> = {
    type: "object",
    properties: {
      input: {
        type: "string",
        description:
          runtimeCompatibility === "node-file"
            ? `Optional inline/base64 payload for ${tool.name} (prefer options.inputPath for local files).`
            : `Primary text/code input for ${tool.name}.`,
      },
      options: buildOptionsSchema(tool),
    },
  };

  return {
    id: tool.id,
    slug: tool.slug,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    stationId: station.id,
    stationName: station.name,
    mcpName: slugToMcpName(tool.slug),
    tier,
    runtimeCompatibility,
    nodeFileSupported,
    canonicalUrl: `https://codestation.in/tools/${tool.slug}`,
    keywords: tool.keywords,
    inputSchema: schema,
    examples: [
      {
        description: `Run ${tool.name} via codestation_run_tool`,
        arguments: {
          slug: tool.slug,
          ...(sample.input !== undefined ? { input: sample.input } : {}),
          ...(sample.options !== undefined ? { options: sample.options } : {}),
        },
      },
    ],
  };
}

function buildVirtualBridgeMetadata(desc: NodeFileToolDescriptor): BridgeToolMetadata {
  return {
    id: desc.slug,
    slug: desc.slug,
    name: desc.name,
    description: desc.description,
    category: desc.category,
    stationId: desc.stationId,
    stationName: desc.stationName,
    mcpName: slugToMcpName(desc.slug),
    tier: resolveBridgeToolTier(desc.slug),
    runtimeCompatibility: "node-file",
    nodeFileSupported: true,
    canonicalUrl: `https://codestation.in/tools/${desc.slug}`,
    keywords: [desc.slug, desc.category.toLowerCase(), "local file", "node-file"],
    inputSchema: desc.inputSchema,
    examples: [
      {
        description: `Run ${desc.name} via codestation_run_tool`,
        arguments: {
          slug: desc.slug,
          ...(desc.sampleArgs.input !== undefined ? { input: desc.sampleArgs.input } : {}),
          ...(desc.sampleArgs.options !== undefined ? { options: desc.sampleArgs.options } : {}),
        },
      },
    ],
  };
}

export function getRuntimeCompatibilityManifest(): Readonly<Record<string, ToolRuntimeCompatibility>> {
  const manifest: Record<string, ToolRuntimeCompatibility> = {};
  for (const t of tools) {
    manifest[t.id] = t.runtimeCompatibility ?? classifyToolRuntime(t.id);
  }
  for (const desc of VIRTUAL_NODE_FILE_DESCRIPTORS) {
    if (!(desc.slug in manifest)) {
      manifest[desc.slug] = "node-file";
    }
  }
  return manifest;
}

export function getAllBridgeTools(): BridgeToolMetadata[] {
  const catalogMeta = tools.map(buildBridgeMetadata);
  const existingSlugs = new Set(catalogMeta.map((t) => t.slug));
  const virtualMeta = VIRTUAL_NODE_FILE_DESCRIPTORS
    .filter((desc) => !existingSlugs.has(desc.slug))
    .map(buildVirtualBridgeMetadata);
  return [...catalogMeta, ...virtualMeta];
}

export function getNodePureTools(): BridgeToolMetadata[] {
  return getAllBridgeTools().filter((t) => t.runtimeCompatibility === "node-pure");
}

export function getNodePureToolCount(): number {
  return getNodePureTools().length;
}

export function getWiredNodeFileTools(): BridgeToolMetadata[] {
  return getAllBridgeTools().filter((t) => t.runtimeCompatibility === "node-file" && t.nodeFileSupported);
}

export function getExecutableBridgeTools(): BridgeToolMetadata[] {
  return getAllBridgeTools().filter((t) => t.runtimeCompatibility === "node-pure" || t.nodeFileSupported);
}

export function listBridgeTools(filter: BridgeListFilter = {}): {
  totalRegistered: number;
  totalMatching: number;
  returned: number;
  countsByRuntime: Record<ToolRuntimeCompatibility, number>;
  tools: Array<{
    slug: string;
    name: string;
    category: string;
    station: string;
    tier: BridgeToolTier;
    runtimeCompatibility: ToolRuntimeCompatibility;
    nodeFileSupported: boolean;
    mcpName: string;
    description: string;
  }>;
} {
  const all = getAllBridgeTools();
  const countsByRuntime: Record<ToolRuntimeCompatibility, number> = {
    "node-pure": 0,
    "node-file": 0,
    "browser-only": 0,
  };
  for (const item of all) countsByRuntime[item.runtimeCompatibility] += 1;

  const runtimeFilter = filter.runtime ?? "all";
  const stationFilter = filter.station?.trim().toLowerCase();
  const queryFilter = filter.query?.trim().toLowerCase();
  const tierFilter = filter.tier ?? "all";
  const limit = Math.min(Math.max(Number(filter.limit ?? 30), 1), 150);

  let matched = all;
  if (runtimeFilter !== "all") {
    matched = matched.filter((t) => t.runtimeCompatibility === runtimeFilter);
    if (runtimeFilter === "node-file") {
      matched = [...matched].sort((a, b) => Number(b.nodeFileSupported) - Number(a.nodeFileSupported));
    }
  }
  if (tierFilter !== "all") {
    matched = matched.filter((t) => t.tier === tierFilter);
  }
  if (stationFilter) {
    matched = matched.filter(
      (t) =>
        t.stationId.toLowerCase() === stationFilter ||
        t.stationId.toLowerCase().includes(stationFilter) ||
        t.stationName.toLowerCase().includes(stationFilter) ||
        t.category.toLowerCase().includes(stationFilter),
    );
  }
  if (queryFilter) {
    matched = matched.filter(
      (t) =>
        t.slug.toLowerCase().includes(queryFilter) ||
        t.name.toLowerCase().includes(queryFilter) ||
        t.description.toLowerCase().includes(queryFilter) ||
        t.keywords.some((k) => k.toLowerCase().includes(queryFilter)),
    );
  }

  const sliced = matched.slice(0, limit).map((t) => ({
    slug: t.slug,
    name: t.name,
    category: t.category,
    station: t.stationId,
    tier: t.tier,
    runtimeCompatibility: t.runtimeCompatibility,
    nodeFileSupported: t.nodeFileSupported,
    mcpName: t.mcpName,
    description: t.description,
  }));

  return {
    totalRegistered: all.length,
    totalMatching: matched.length,
    returned: sliced.length,
    countsByRuntime,
    tools: sliced,
  };
}

export function describeBridgeTool(slug: string): BridgeToolMetadata | null {
  const def = resolveDefinition(slug);
  if (def) return buildBridgeMetadata(def);
  const normalized = slug.trim().toLowerCase().replace(/^codestation[-_]/, "").replace(/_/g, "-");
  const virtual = VIRTUAL_NODE_FILE_MAP.get(slug.trim()) ?? VIRTUAL_NODE_FILE_MAP.get(normalized);
  return virtual ? buildVirtualBridgeMetadata(virtual) : null;
}

/**
 * Resolves `--stations=json,security,sql` or `CODESTATION_MCP_STATIONS` tokens into
 * additional `Tool` MCP schemas for direct exposure alongside the core Hybrid set.
 */
export function getExposedStationTools(
  stationFilters: readonly string[],
  excludeMcpNames: ReadonlySet<string> = new Set(),
): Tool[] {
  const filters = stationFilters.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (filters.length === 0) return [];

  const result: Tool[] = [];
  const seenNames = new Set(excludeMcpNames);

  for (const item of getExecutableBridgeTools()) {
    const matches = filters.some(
      (f) =>
        item.stationId.toLowerCase() === f ||
        item.stationId.toLowerCase().startsWith(f) ||
        item.stationName.toLowerCase().includes(f) ||
        item.category.toLowerCase().includes(f),
    );
    if (!matches || seenNames.has(item.mcpName)) continue;
    seenNames.add(item.mcpName);
    const tierLabel = item.tier === "pro" ? "[Pro Tier]" : "[Free Tier]";
    result.push({
      name: item.mcpName,
      description: `[${item.stationName}] ${item.description} ${tierLabel}`,
      inputSchema: {
        type: "object",
        properties: {
          input: { type: "string", description: `Primary input for ${item.name}` },
          options: item.inputSchema && typeof item.inputSchema === "object"
            ? (item.inputSchema as { properties?: Record<string, unknown> }).properties?.options ?? {
                type: "object",
                description: "Optional tool-specific options",
              }
            : { type: "object" },
        },
      },
    });
  }

  return result;
}

function formatSqlRowsOutput(result: { rows?: Array<{ label: string; value: string }>; warnings?: string[] }): string {
  const rows = result.rows ?? [];
  if (rows.length === 1 && (!result.warnings || result.warnings.length === 0)) {
    return rows[0].value;
  }
  return JSON.stringify(result, null, 2);
}

const DUAL_MODE_FILE_SLUGS = new Set([
  "csv-to-json",
  "json-to-csv",
  "gzip-compressor",
  "gzip-decompressor",
]);

function hasFileModeOptions(opts: Record<string, unknown>): boolean {
  return (
    (typeof opts.inputPath === "string" && opts.inputPath.trim().length > 0) ||
    (Array.isArray(opts.inputPaths) && opts.inputPaths.length > 0) ||
    (typeof opts.inputBase64 === "string" && opts.inputBase64.trim().length > 0) ||
    (typeof opts.outputPath === "string" && opts.outputPath.trim().length > 0)
  );
}

/**
 * Executes any Node-compatible Code Station tool (`node-pure` or wired `node-file`).
 */
export async function executeNodeTool(
  slugOrId: string,
  rawInput = "",
  rawOptions: Record<string, unknown> = {},
): Promise<string> {
  const opts: Record<string, unknown> =
    rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions) ? rawOptions : {};
  const cleanedSlug = slugOrId.trim();
  const normalizedSlug = cleanedSlug.toLowerCase().replace(/^codestation[-_]/, "").replace(/_/g, "-");

  const virtualDesc = VIRTUAL_NODE_FILE_MAP.get(cleanedSlug) ?? VIRTUAL_NODE_FILE_MAP.get(normalizedSlug);
  if (virtualDesc) {
    return executeNodeFileTool(virtualDesc.slug, rawInput, opts);
  }

  const def = resolveDefinition(cleanedSlug);
  if (!def) {
    throw new Error(`Unknown tool "${slugOrId}". Call codestation_list_tools to browse available tools.`);
  }

  const runtime = def.runtimeCompatibility ?? classifyToolRuntime(def.id);
  if (runtime === "browser-only") {
    throw new Error(
      `Tool "${def.slug}" requires browser APIs (runtime: browser-only — DOM/Canvas/WebAudio/Video). Open https://codestation.in/tools/${def.slug} to use it interactively.`,
    );
  }
  if (runtime === "node-file") {
    if (WIRED_NODE_FILE_SLUGS.has(def.slug)) {
      return executeNodeFileTool(def.slug, rawInput, opts);
    }
    throw new Error(
      `Tool "${def.slug}" is a local file tool (runtime: node-file) not yet wired for Node CLI/MCP execution (use supported PDF, Spreadsheet, ZIP/Gzip, SVG, or image-inspect tools instead, or run in browser at https://codestation.in/tools/${def.slug}).`,
    );
  }

  if (DUAL_MODE_FILE_SLUGS.has(def.slug) && hasFileModeOptions(opts)) {
    return executeNodeFileTool(def.slug, rawInput, opts);
  }

  return executeNodePureTool(def.id, rawInput, opts);
}

/**
 * Executes a `node-pure` tool strictly using the pure TypeScript engines under lib/tools/.
 */
export async function executeNodePureTool(
  slugOrId: string,
  rawInput = "",
  rawOptions: Record<string, unknown> = {},
): Promise<string> {
  const def = resolveDefinition(slugOrId);
  if (!def) {
    throw new Error(`Unknown tool "${slugOrId}". Call codestation_list_tools to browse available tools.`);
  }

  const runtime = def.runtimeCompatibility ?? classifyToolRuntime(def.id);
  if (runtime === "node-file") {
    if (WIRED_NODE_FILE_SLUGS.has(def.slug)) {
      return executeNodeFileTool(def.slug, rawInput, rawOptions);
    }
    throw new Error(
      `Tool "${def.slug}" is a local file tool (runtime: node-file) not yet wired for Node CLI/MCP execution. Run it in the browser at https://codestation.in/tools/${def.slug}.`,
    );
  }
  if (runtime === "browser-only") {
    throw new Error(
      `Tool "${def.slug}" requires browser APIs (runtime: browser-only — DOM/Canvas/WebAudio/Video). Open https://codestation.in/tools/${def.slug} to use it interactively.`,
    );
  }

  const id = def.id;
  const opts: Record<string, unknown> =
    rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions) ? rawOptions : {};
  const input = typeof rawInput === "string" && rawInput.length > 0
    ? rawInput
    : typeof opts.input === "string"
      ? opts.input
      : typeof opts.text === "string"
        ? opts.text
        : "";

  switch (def.category) {
    case "JSON & Data": {
      if (id === "mock-data") {
        const res = generateMockDataset({
          template: (opts.template ? String(opts.template) : "users") as MockTemplate,
          count: Number(opts.count ?? 10),
          format: (opts.format ? String(opts.format) : "json") as "json" | "sql",
          tableName: opts.tableName ? String(opts.tableName) : undefined,
          customSchema: opts.customSchema as Record<string, MockFieldType> | undefined,
        });
        return opts.format === "sql" && res.sql ? res.sql : opts.format === "csv" && res.csv ? res.csv : res.json;
      }
      const dataInputs: Record<string, string> = {
        input: input || (typeof opts.json === "string" ? opts.json : typeof opts.yaml === "string" ? opts.yaml : ""),
      };
      const secondary =
        typeof opts.secondary === "string"
          ? opts.secondary
          : typeof opts.right === "string"
            ? opts.right
            : typeof opts.schema === "string"
              ? opts.schema
              : typeof opts.compare === "string"
                ? opts.compare
                : undefined;
      if (secondary !== undefined) dataInputs.secondary = secondary;
      if (typeof opts.expression === "string") dataInputs.expression = opts.expression;
      if (typeof opts.direction === "string") dataInputs.direction = opts.direction;
      if (typeof opts.key === "string") dataInputs.key = opts.key;
      if (typeof opts.column === "string") dataInputs.column = opts.column;
      if (typeof opts.order === "string") dataInputs.order = opts.order;
      if (typeof opts.operator === "string") dataInputs.operator = opts.operator;
      if (typeof opts.value === "string") dataInputs.value = opts.value;
      if (typeof opts.keys === "string") dataInputs.keys = opts.keys;
      const res = await runDataTool(id, dataInputs);
      return res.text;
    }

    case "Encoding": {
      const mime = typeof opts.mime === "string" ? opts.mime : undefined;
      const res = await runEncoding(id, { input, mime });
      return res.text;
    }

    case "Security": {
      if (id === "env-audit") {
        const envText = input || String(opts.env ?? "");
        const exampleText = typeof opts.example === "string" ? opts.example : undefined;
        const result = auditEnv(envText, exampleText);
        return opts.format === "json" ? JSON.stringify(result, null, 2) : formatEnvAuditReport(result);
      }
      const securityValues: Record<string, string | boolean> = {};
      for (const [k, v] of Object.entries(opts)) {
        if (typeof v === "boolean") securityValues[k] = v;
        else if (typeof v === "string" || typeof v === "number") securityValues[k] = String(v);
      }
      if (id === "uuid-generator") securityValues.version = securityValues.version ?? "4";
      if (id === "password-generator") {
        securityValues.length = securityValues.length ?? "16";
        securityValues.lowercase = typeof opts.lowercase === "boolean" ? opts.lowercase : true;
        securityValues.uppercase = typeof opts.uppercase === "boolean" ? opts.uppercase : true;
        securityValues.numbers = typeof opts.numbers === "boolean" ? opts.numbers : true;
        securityValues.symbols = typeof opts.symbols === "boolean" ? opts.symbols : true;
      }
      if (id === "random-string-generator") {
        securityValues.length = securityValues.length ?? "24";
        securityValues.characterSet = securityValues.characterSet ?? "Alphanumeric";
      }
      if (id === "random-number-generator") {
        securityValues.minimum = securityValues.minimum ?? "1";
        securityValues.maximum = securityValues.maximum ?? "100";
        securityValues.count = securityValues.count ?? "1";
      }
      if (id === "secure-token-generator") {
        securityValues.bytes = securityValues.bytes ?? "32";
        securityValues.encoding = securityValues.encoding ?? "Hex";
      }
      if (id === "hex-random-generator") securityValues.bytes = securityValues.bytes ?? "16";
      if (id === "secret-key-generator") securityValues.keySize = securityValues.keySize ?? "256";
      if (id === "checksum-generator") securityValues.algorithm = securityValues.algorithm ?? "SHA-256";
      if (id === "hmac-generator") {
        securityValues.algorithm = securityValues.algorithm ?? "HMAC-SHA-256";
        securityValues.message = securityValues.message ?? input;
      }
      if (id === "hash-compare") {
        securityValues.hashA = securityValues.hashA ?? input;
        securityValues.hashB = securityValues.hashB ?? String(opts.target ?? opts.right ?? "");
      }
      if (!securityValues.input && input) securityValues.input = input;
      const res = await runSecurity(id, { values: securityValues });
      return res.text;
    }

    case "Regex": {
      const stringValues: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts)) {
        if (v !== undefined) stringValues[k] = String(v);
      }
      if (!stringValues.text && input) stringValues.text = input;
      if (id === "regex-escape" && !stringValues.literal) stringValues.literal = input;
      if (id === "regex-pattern-builder" && !stringValues.literal) stringValues.literal = input;
      const res = runRegex(id, stringValues);
      if (res.text !== undefined) return res.text;
      return JSON.stringify(res, null, 2);
    }

    case "Date & Time": {
      const dtValues: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts)) {
        if (typeof v === "string" || typeof v === "number") dtValues[k] = String(v);
      }
      if (!dtValues.timestamp && input && (id.includes("timestamp") || id === "unix-milliseconds-converter")) dtValues.timestamp = input;
      if (!dtValues.epoch && input && id === "epoch-converter") dtValues.epoch = input;
      if (!dtValues.iso && input && id === "iso-8601-converter") dtValues.iso = input;
      if (!dtValues.value && input && id === "date-format-converter") dtValues.value = input;
      if (!dtValues.date && input && id === "week-number-calculator") dtValues.date = input;
      if (!dtValues.year && input && id === "leap-year-checker") dtValues.year = input;
      if (!dtValues.timezone && input && id === "current-time-in-timezone") dtValues.timezone = input;
      if ((id === "unix-timestamp-converter" || id === "epoch-converter" || id === "timestamp-to-date") && !dtValues.unit) {
        dtValues.unit = "Seconds";
      }
      const res = runDateTime(id, dtValues);
      return formatSqlRowsOutput(res);
    }

    case "Text": {
      const textValues: Record<string, string | boolean> = {};
      for (const [k, v] of Object.entries(opts)) {
        if (typeof v === "string" || typeof v === "boolean") textValues[k] = v;
        else if (typeof v === "number") textValues[k] = String(v);
      }
      if (id === "text-diff") {
        textValues.textA = String(opts.textA ?? opts.original ?? input);
        textValues.textB = String(opts.textB ?? opts.modified ?? "");
      } else if (!textValues.text) {
        textValues.text = input;
      }
      if (id === "case-converter" && typeof opts.targetCase === "string" && !textValues.caseType) {
        textValues.caseType = opts.targetCase;
      }
      const res = await runText(id, textValues);
      if (res.diff) return JSON.stringify(res, null, 2);
      return formatSqlRowsOutput(res);
    }

    case "Cron": {
      const cronValues: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts)) {
        if (typeof v === "string") cronValues[k] = v;
      }
      if (id === "human-to-cron") {
        cronValues.description = cronValues.description || input;
      } else if (id !== "cron-generator" && !cronValues.expression) {
        cronValues.expression = input;
      }
      const res = await runCron(id, cronValues);
      return formatSqlRowsOutput(res);
    }

    case "SQL & Database": {
      const sqlValues: Record<string, unknown> = { dialect: "PostgreSQL", ...opts };
      if (!sqlValues.sql && (id === "sql-formatter" || id === "sql-minifier" || id === "sql-validator" || id.startsWith("sql-to-") || id === "er-diagram-generator")) {
        sqlValues.sql = input;
      }
      if (id === "json-to-sql" && !sqlValues.json) sqlValues.json = input;
      if (id === "csv-to-sql" && !sqlValues.csv) sqlValues.csv = input;
      if (id === "database-connection-string-parser" && !sqlValues.connectionString) {
        sqlValues.connectionString = input;
        sqlValues.input = input;
      }
      if (id === "sql-escape-helper" && !sqlValues.value) {
        sqlValues.value = input;
        sqlValues.valueType = sqlValues.valueType ?? "String";
      }
      const res = await runSql(id, sqlValues);
      return formatSqlRowsOutput(res);
    }

    case "Web": {
      const webValues: Record<string, unknown> = { ...opts };
      if (!webValues.input && input) webValues.input = input;
      if (!webValues.url && input) webValues.url = input;
      const isGenerator = [
        "meta-tag-generator",
        "open-graph-generator",
        "open-graph-preview",
        "twitter-card-generator",
        "canonical-url-generator",
        "robots-txt-generator",
        "sitemap-generator",
        "web-app-manifest-generator",
      ].includes(id);
      const res = isGenerator ? await generateWeb(id, webValues) : await inspectWeb(id, webValues);
      return res.text || JSON.stringify(res.data ?? res, null, 2);
    }

    case "API": {
      if (id === "curl-to-any-language") {
        const res = await curlToCode(input || String(opts.curl ?? ""), (opts.target ? String(opts.target) : "fetch") as CurlTargetLanguage);
        return res.code;
      }
      const apiValues: Record<string, unknown> = { ...opts };
      if (!apiValues.input && input) apiValues.input = input;
      if (!apiValues.command && input) apiValues.command = input;
      if (!apiValues.code && input) apiValues.code = input;
      if (!apiValues.body && input) apiValues.body = input;
      if (!apiValues.query && input) apiValues.query = input;
      if (!apiValues.raw && input) apiValues.raw = input;
      if (!apiValues.token && input) apiValues.token = input;
      if (["curl-to-fetch", "fetch-to-curl", "curl-to-axios", "curl-to-python-requests"].includes(id)) {
        const res = await convertApi(id, apiValues);
        return res.text;
      }
      const res = await localApi(id, apiValues);
      return res.text || JSON.stringify(res.data ?? res, null, 2);
    }

    case "Image": {
      return svgText(input, id === "svg-formatter");
    }

    case "Markdown": {
      const mdValues: Record<string, unknown> = { ...opts };
      if (!mdValues.source && input) mdValues.source = input;
      if (!mdValues.markdown && input) mdValues.markdown = input;
      if (!mdValues.text && input) mdValues.text = input;
      if (!mdValues.code && input) mdValues.code = input;
      const res = await runMarkdown(id, mdValues);
      return res.text;
    }

    case "Color & CSS": {
      const colorValues: Record<string, unknown> = { ...opts };
      if (!colorValues.color && input) colorValues.color = input;
      const res = await runColor(id, colorValues);
      return res.text || JSON.stringify(res.data, null, 2);
    }

    case "Converters": {
      if (id === "unit-converter") {
        const res = runUnitConverter({
          category: (opts.category ? String(opts.category) : "length") as any,
          from: (opts.from ? String(opts.from) : "kilometer") as any,
          to: (opts.to ? String(opts.to) : "meter") as any,
          value: input || String(opts.value ?? "1"),
        });
        return JSON.stringify(res, null, 2);
      }
      if (id === "temperature-converter") {
        const res = runTemperatureConverter({
          from: (opts.from ? String(opts.from) : "celsius") as any,
          to: (opts.to ? String(opts.to) : "fahrenheit") as any,
          value: input || String(opts.value ?? "0"),
        });
        return JSON.stringify(res, null, 2);
      }
      if (id === "number-base-converter") {
        const res = runNumberBaseConverter({
          value: input || String(opts.value ?? "0"),
          fromBase: Number(opts.fromBase ?? 10),
          toBase: Number(opts.toBase ?? 16),
          outputPrefix: Boolean(opts.outputPrefix),
        });
        return JSON.stringify({ ...res, value: res.value.toString() }, null, 2);
      }
      throw new Error(`Unsupported converter tool: ${id}`);
    }

    case "Git & Version Control": {
      if (id === "conflict-parse") {
        const strategy = (opts.strategy ? String(opts.strategy) : "analyze") as ConflictStrategy;
        const res = parseAndResolveGitConflicts(input, strategy);
        return strategy === "analyze" ? formatConflictReport(res) : res.resolvedContent ?? input;
      }
      if (id === "conventional-commit-builder") {
        const res = buildConventionalCommit({
          type: String(opts.type ?? "feat"),
          scope: opts.scope ? String(opts.scope) : undefined,
          description: String(opts.description ?? input),
          body: opts.body ? String(opts.body) : undefined,
          footer: opts.footer ? String(opts.footer) : undefined,
          breaking: opts.breaking === true || opts.breaking === "true",
          breakingDescription: opts.breakingDescription ? String(opts.breakingDescription) : undefined,
        });
        return formatCommitBuilderOutput(res);
      }
      if (id === "conventional-commit-validator") {
        return JSON.stringify(parseConventionalCommit(input), null, 2);
      }
      if (id === "git-command-explainer") {
        return JSON.stringify(explainGitCommand(input), null, 2);
      }
      if (id === "changelog-generator") {
        return generateChangelog(input).markdown;
      }
      if (id === "gitattributes-generator") {
        return generateGitAttributes({
          eol: (opts.eol ?? "auto") as GitAttributesEol,
          binaryGlobs: opts.binaryGlobs ? String(opts.binaryGlobs) : undefined,
          linguistGlobs: opts.linguistGlobs ? String(opts.linguistGlobs) : undefined,
          linguistFlag: (opts.linguistFlag ?? "none") as GitLinguistFlag,
          exportIgnore: opts.exportIgnore ? String(opts.exportIgnore) : undefined,
        }).content;
      }
      if (id === "git-hooks-generator") {
        return JSON.stringify(
          generateGitHook({
            hook: (opts.hook ?? "pre-commit") as GitHookType,
            commands: String(opts.commands ?? input),
            failFast: opts.failFast !== false && opts.failFast !== "false",
          }),
          null,
          2,
        );
      }
      throw new Error(`Unsupported Git tool: ${id}`);
    }

    case "QR & Barcode": {
      return await generateQrCodeSvg(input || String(opts.text ?? ""), opts as any);
    }

    case "Code Generation": {
      if (id === "json-to-typescript") return jsonToTypescript(input, String(opts.rootName ?? "Root"));
      if (id === "json-to-zod") return jsonToZod(input, String(opts.rootName ?? "rootSchema"));
      if (id === "json-to-go") return jsonToGo(input, String(opts.rootName ?? "Root"));
      if (id === "json-to-pydantic") return jsonToPydantic(input, String(opts.rootName ?? "RootModel"));
      if (id === "json-to-rust") return jsonToRust(input, String(opts.rootName ?? "Root"));
      if (id === "sql-to-typescript") return sqlToTypescript(input);
      if (id === "html-to-jsx") return htmlToJsx(input);
      if (id === "svg-to-jsx") return svgToJsx(input, String(opts.componentName ?? "Icon"));
      throw new Error(`Unsupported Code Generation tool: ${id}`);
    }

    case "Network & DevOps": {
      if (id === "cidr-calculator") return JSON.stringify(calculateCidr(input), null, 2);
      if (id === "ipv4-to-ipv6") return JSON.stringify(convertIp(input), null, 2);
      if (id === "cert-inspector") return JSON.stringify(inspectCertificate(input), null, 2);
      if (id === "port-reference") return JSON.stringify(searchPorts(input), null, 2);
      if (id === "gitignore-generator") {
        const presets = Array.isArray(opts.presets)
          ? opts.presets.map(String)
          : (input ? input.split(",").map((s) => s.trim()).filter(Boolean) : ["Node"]);
        return generateGitignore(presets);
      }
      if (id === "dockerfile-generator") {
        return generateDockerfile({
          language: (opts.language ? String(opts.language) : "node") as any,
          version: String(opts.version ?? "22-alpine"),
          port: Number(opts.port ?? 3000),
          multiStage: Boolean(opts.multiStage),
          nonRoot: Boolean(opts.nonRoot),
        });
      }
      if (id === "docker-run-to-compose") return dockerRunToCompose(input);
      if (id === "semver-calculator") {
        const parsed = parseSemver(input);
        const compareTo = opts.compareTo ?? opts.target ?? opts.compare;
        if (compareTo !== undefined) {
          return JSON.stringify({ ...parsed, compareTo: String(compareTo), comparison: compareSemver(input, String(compareTo)) }, null, 2);
        }
        return JSON.stringify(parsed, null, 2);
      }
      throw new Error(`Unsupported Network & DevOps tool: ${id}`);
    }

    case "Frontend & CSS": {
      if (id === "css-grid-generator") {
        return JSON.stringify(
          generateCssGrid({
            columns: String(opts.columns ?? "1fr 1fr"),
            rows: String(opts.rows ?? "auto auto"),
            columnGap: Number(opts.columnGap ?? 16),
            rowGap: Number(opts.rowGap ?? 16),
          }),
          null,
          2,
        );
      }
      if (id === "glassmorphism-generator") {
        return generateGlassmorphism({
          blur: Number(opts.blur ?? 12),
          transparency: Number(opts.transparency ?? 0.2),
          baseColor: String(opts.baseColor ?? "#ffffff"),
          borderWidth: Number(opts.borderWidth ?? 1),
          borderOpacity: Number(opts.borderOpacity ?? 0.2),
          borderRadius: Number(opts.borderRadius ?? 16),
          shadowElevation: Number(opts.shadowElevation ?? 10),
        });
      }
      throw new Error(`Unsupported Frontend & CSS node-pure tool: ${id}`);
    }

    case "Developer Math": {
      if (id === "bitwise-calculator") {
        return JSON.stringify(calculateBitwise(Number(input || 0), Number(opts.b ?? 0), Number(opts.bitWidth ?? 32) as 8 | 16 | 32), null, 2);
      }
      if (id === "ieee754-converter") {
        return JSON.stringify(inspectIeee754(Number(input || 0), (opts.precision ?? "float32") as "float32" | "float64"), null, 2);
      }
      if (id === "twos-complement") {
        return JSON.stringify(calculateTwosComplement(input || "0", Number(opts.bits ?? 32) as 8 | 16 | 32 | 64), null, 2);
      }
      if (id === "bigint-calculator") {
        return JSON.stringify(calculateBigInt(input || "0", String(opts.b ?? "0"), (opts.op ?? "+") as any, String(opts.mod ?? "1")), null, 2);
      }
      if (id === "matrix-calculator") {
        const a = (Array.isArray(opts.a) ? opts.a : [[1, 2], [3, 4]]) as number[][];
        const b = (Array.isArray(opts.b) ? opts.b : [[5, 6], [7, 8]]) as number[][];
        const op = String(opts.operation ?? "multiply");
        if (op === "add") return JSON.stringify({ result: addMatrices(a, b) }, null, 2);
        if (op === "transpose") return JSON.stringify({ result: transposeMatrix(a) }, null, 2);
        if (op === "determinant") return JSON.stringify({ determinant: determinantMatrix(a) }, null, 2);
        return JSON.stringify({ result: multiplyMatrices(a, b) }, null, 2);
      }
      if (id === "gcd-lcm-calculator") {
        const a = Number(input || 0);
        const b = Number(opts.b ?? 0);
        return JSON.stringify({ ...calculateGcdLcmPair(a, b), primeFactorsA: primeFactors(a) }, null, 2);
      }
      if (id === "fraction-converter") {
        return JSON.stringify(convertToFraction(input), null, 2);
      }
      throw new Error(`Unsupported Developer Math tool: ${id}`);
    }

    case "Compression": {
      if (id === "gzip-compressor") {
        const res = await compressGzip(input, { format: (opts.format as "gzip" | "deflate") || "gzip", level: Number(opts.level ?? 6) });
        return JSON.stringify({ format: res.format, originalSize: res.originalSize, compressedSize: res.compressedSize, ratioPercent: res.ratioPercent, base64: res.base64 }, null, 2);
      }
      if (id === "gzip-decompressor") {
        const res = await decompressGzip(input, { format: (opts.format as "auto" | "gzip" | "deflate") || "auto", isBase64: true });
        return res.isText && res.text ? res.text : JSON.stringify(res, null, 2);
      }
      throw new Error(`Unsupported Compression node-pure tool: ${id}`);
    }

    case "WebPKI & Advanced Cryptography": {
      if (id === "aes-crypto") {
        const mode = String(opts.mode ?? "encrypt").toLowerCase();
        const keyOpts: AesKeyOptions = {
          mode: opts.keyMode === "raw" || opts.rawKey ? "raw" : "passphrase",
          keyLength: Number(opts.keyLength ?? 256) === 128 ? 128 : 256,
          passphrase: String(opts.passphrase ?? "codestation-secure-passphrase"),
          rawKey: opts.rawKey ? String(opts.rawKey) : undefined,
        };
        if (mode === "decrypt") {
          let payload: any;
          try { payload = JSON.parse(input); } catch { payload = { ciphertext: input, iv: opts.iv ?? "", tag: opts.tag ?? "", salt: opts.salt }; }
          const plaintext = await decryptAesGcm(payload, keyOpts);
          return JSON.stringify({ plaintext, success: true }, null, 2);
        }
        return JSON.stringify(await encryptAesGcm(input, keyOpts), null, 2);
      }
      if (id === "rsa-key-generator") {
        const bits = Number(opts.modulusLength ?? opts.bits ?? 2048);
        const mod = [2048, 3072, 4096].includes(bits) ? (bits as 2048 | 3072 | 4096) : 2048;
        const kp = await generateRsaKeyPair(mod);
        return JSON.stringify({ modulusLength: kp.modulusLength, fingerprint: kp.fingerprint, publicKeyPem: kp.publicKeyPem, privateKeyPem: kp.privateKeyPem }, null, 2);
      }
      if (id === "jwt-signer-verifier") {
        const action = String(opts.action ?? "sign").toLowerCase();
        if (action === "verify") {
          return JSON.stringify(await verifyJwt(input || String(opts.token ?? ""), String(opts.secret ?? opts.publicKey ?? "")), null, 2);
        }
        const header = opts.header ? (typeof opts.header === "string" ? JSON.parse(opts.header) : opts.header) : { alg: String(opts.alg ?? "HS256"), typ: "JWT" };
        let payload: any = opts.payload;
        if (!payload) {
          try { payload = JSON.parse(input); } catch { payload = { sub: input || "developer" }; }
        }
        const token = await signJwt(header, payload, String(opts.secret ?? opts.privateKey ?? "secret-key-1234567890"));
        return JSON.stringify({ token, header, payload }, null, 2);
      }
      if (id === "csr-inspector") {
        return JSON.stringify(await parseCsr(input), null, 2);
      }
      if (id === "csp-builder") {
        let directives: CspDirectives;
        if (opts.directives && typeof opts.directives === "object") directives = opts.directives as CspDirectives;
        else directives = JSON.parse(input || '{"default-src":["\'self\'"]}');
        return JSON.stringify(buildCspHeader(directives), null, 2);
      }
      throw new Error(`Unsupported WebPKI tool: ${id}`);
    }

    case "AI & Prompt Engineering": {
      if (id === "ai-token-counter") {
        return JSON.stringify(countTokens(input, (opts.model ?? "gpt-4o") as AiModelId), null, 2);
      }
      if (id === "json-repair") {
        return JSON.stringify(repairJson(input), null, 2);
      }
      if (id === "prompt-interpolator") {
        const records = Array.isArray(opts.records) ? opts.records : [{}];
        return JSON.stringify(interpolatePrompt({ records, template: input || String(opts.template ?? "") }), null, 2);
      }
      if (id === "vector-similarity") {
        const vecA = Array.isArray(opts.vecA) ? opts.vecA.map(Number) : parseVectorInput(input);
        const vecB = Array.isArray(opts.vecB) ? opts.vecB.map(Number) : parseVectorInput(String(opts.vecB ?? opts.vectorB ?? "0, 0, 0"));
        return JSON.stringify(computeVectorSimilarity(vecA, vecB), null, 2);
      }
      if (id === "system-prompt-builder") {
        const cfg: SystemPromptConfig = {
          roleName: String(opts.roleName ?? opts.role ?? "Developer Assistant"),
          roleTone: String(opts.roleTone ?? "Technical, precise, concise"),
          coreTask: String(opts.coreTask ?? (input || "Assist with engineering tasks.")),
          xmlWrapping: Boolean(opts.xmlWrapping ?? true),
          chainOfThought: Boolean(opts.chainOfThought ?? false),
          outputFormat: (opts.outputFormat ? String(opts.outputFormat) : "markdown") as "json" | "markdown" | "plain" | "code" | "custom",
          guardrails: Array.isArray(opts.guardrails) ? opts.guardrails.map(String) : [],
          examples: [],
          customConstraints: [],
        };
        return JSON.stringify(buildSystemPrompt(cfg), null, 2);
      }
      throw new Error(`Unsupported AI & Prompt tool: ${id}`);
    }

    case "Policy Generators": {
      const format = (opts.format ? String(opts.format) : "markdown") as PolicyOutputFormat;
      return generatePolicyText(id as PolicyToolId, format, opts);
    }

    case "Finance & Calculators": {
      if (id === "emi-calculator") {
        return JSON.stringify(calculateEmi({ principal: Number(opts.principal ?? input), annualRate: Number(opts.annualRate ?? opts.rate ?? 8.5), months: Number(opts.months ?? 240) }), null, 2);
      }
      if (id === "loan-prepayment-calculator") {
        return JSON.stringify(
          comparePrepayment({
            principal: Number(opts.principal ?? input),
            annualRate: Number(opts.annualRate ?? opts.rate ?? 9),
            months: Number(opts.months ?? 240),
            oneTime: Number(opts.oneTime ?? 0),
            extraMonthly: Number(opts.extraMonthly ?? 0),
            chargePercent: Number(opts.chargePercent ?? 0),
            strategy: String(opts.strategy ?? "reduce-tenure") as PrepaymentStrategy,
          }),
          null,
          2,
        );
      }
      if (id === "gst-calculator") {
        const supply = String(opts.supply ?? "intra") as GstSupply;
        const mode = String(opts.mode ?? "exclusive") as GstMode;
        if (Array.isArray(opts.lines)) return JSON.stringify(calculateGstLines(opts.lines as GstLineInput[], supply, mode), null, 2);
        return JSON.stringify(calculateGst({ amount: Number(opts.amount ?? input), rate: Number(opts.rate ?? 18), mode, supply }), null, 2);
      }
      if (id === "sip-calculator") {
        return JSON.stringify(projectSip({ monthly: Number(opts.monthly ?? input), years: Number(opts.years ?? 10), annualReturn: Number(opts.annualReturn ?? 12), stepUpPercent: Number(opts.stepUpPercent ?? 0), inflationPercent: Number(opts.inflationPercent ?? 0), compareRates: [] }), null, 2);
      }
      throw new Error(`Unsupported Finance tool: ${id}`);
    }

    case "Productivity": {
      const sample = getSampleInvoice();
      const items = Array.isArray(opts.items) && opts.items.length > 0 ? opts.items : sample.items;
      const totals = calculateInvoiceTotals({
        items,
        taxRate: Number(opts.taxRate ?? sample.taxRate),
        discount: Number(opts.discount ?? sample.discount),
        discountType: opts.discountType === "fixed" ? "fixed" : "percentage",
        shipping: Number(opts.shipping ?? sample.shipping),
      });
      return JSON.stringify({ invoiceNumber: String(opts.invoiceNumber ?? sample.invoiceNumber), currency: String(opts.currency ?? sample.currency), items, totals }, null, 2);
    }

    default:
      throw new Error(`No Node pure executor registered for category "${def.category}" (tool "${id}").`);
  }
}

export async function executeBridgeTool(
  slugOrId: string,
  args: Record<string, unknown>,
  license: LicenseStatus,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const cleaned = slugOrId.trim();
  const normalized = cleaned.toLowerCase().replace(/^codestation[-_]/, "").replace(/_/g, "-");
  const virtualDesc = VIRTUAL_NODE_FILE_MAP.get(cleaned) ?? VIRTUAL_NODE_FILE_MAP.get(normalized);
  const def = virtualDesc ? undefined : resolveDefinition(cleaned);

  if (!def && !virtualDesc) {
    return {
      content: [
        {
          type: "text",
          text: `Tool "${slugOrId}" is not registered in Code Station registry.`,
        },
      ],
      isError: true,
    };
  }

  const targetSlug = virtualDesc ? virtualDesc.slug : def!.id;
  const tier = resolveBridgeToolTier(targetSlug);
  if (tier === "pro" && !license.isPro) {
    return {
      content: [{ type: "text", text: getProUpgradeNotice(slugToMcpName(virtualDesc ? virtualDesc.slug : def!.slug)) }],
      isError: true,
    };
  }

  try {
    const input = typeof args.input === "string" ? args.input : "";
    const options = args.options && typeof args.options === "object" && !Array.isArray(args.options)
      ? (args.options as Record<string, unknown>)
      : args;
    const outputText = await executeNodeTool(targetSlug, input, options);
    return { content: [{ type: "text", text: outputText }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}
