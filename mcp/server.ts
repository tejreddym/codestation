import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  resolveLicense,
  revalidateLicenseInBackground,
  PRO_TOOLS,
  getProUpgradeNotice,
  type LicenseStatus,
} from "./config";
import { checkToolAccess } from "../config/shared-registry";
import {
  describeBridgeTool,
  executeBridgeTool,
  executeNodeTool,
  getExposedStationTools,
  getNodePureToolCount,
  listBridgeTools,
  type BridgeListFilter,
} from "./registry-bridge";

// Direct imports from Code Station engine for fast-path first-class tools & legacy aliases
import {
  formatJson,
  minifyJson,
  jsonToYaml,
  yamlToJson,
  decodeJwt,
  generateJsonSchema,
  testRegex,
  jsonDiff,
  testJsonPath,
  encodeHtml,
  decodeHtml,
  csvToJson,
  jsonToCsv,
} from "../lib/tools/index";
import {
  md5,
  sha1,
  sha256,
  sha384,
  sha512,
  hmacSha256,
  hmacSha512,
  crc32,
  ulid,
  nanoid,
} from "../lib/tools/security-station";
import {
  encodeBase64Url,
  decodeBase64Url,
  encodeHexadecimal,
  decodeHexadecimal,
  encodeUrlComponent,
  decodeUrlComponent,
} from "../lib/tools/encoding-station";
import {
  convertCase,
  slugify,
  diffText,
  type TextCase,
} from "../lib/tools/text-station";
import {
  convertBetweenTimeZones,
  businessDaysBetween,
} from "../lib/tools/date-time-station";
import { parseCron } from "../lib/tools/cron/parser";
import { explainCron } from "../lib/tools/cron/explain";
import { nextCronRun } from "../lib/tools/cron/engine";
import { jsonToTypescript, jsonToZod } from "../lib/tools/json-to-types";
import { curlToCode, type CurlTargetLanguage } from "../lib/tools/curl-to-code";
import { auditEnv, formatEnvAuditReport } from "../lib/tools/env-audit";
import { generateMockDataset, type MockTemplate } from "../lib/tools/mock-data";
import {
  parseAndResolveGitConflicts,
  formatConflictReport,
  type ConflictStrategy,
} from "../lib/tools/git-conflict";
import { runMarkdown } from "../lib/tools/markdown/engine";
import { runDateTime } from "../lib/tools/date-time/engine";
import { calculateCidr } from "../lib/tools/network/engine";
import { countTokens, type AiModelId } from "../lib/tools/ai-prompts/engine";

export interface McpServerOptions {
  stations?: string[];
}

export const UNIVERSAL_META_TOOLS: Tool[] = [
  {
    name: "codestation_list_tools",
    description:
      "Discover all 380+ Code Station tools across 29 developer stations (300+ Node-executable utilities), filterable by station, search query, tier, or runtime compatibility.",
    inputSchema: {
      type: "object",
      properties: {
        station: {
          type: "string",
          description:
            "Filter by station slug or category name (e.g. 'json-data', 'security', 'encoding', 'sql-database', 'markdown', 'git', 'network-devops', 'ai-prompts', 'date-time')",
        },
        query: {
          type: "string",
          description: "Search keyword matching tool slug, name, description, or keywords",
        },
        tier: {
          type: "string",
          enum: ["all", "free", "pro"],
          description: "Filter by license tier (default: 'all')",
        },
        runtime: {
          type: "string",
          enum: ["all", "node-pure", "node-file", "browser-only"],
          description: "Filter by runtime compatibility (default: 'all')",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 150,
          description: "Maximum results to return (default: 30, max: 150)",
        },
      },
    },
  },
  {
    name: "codestation_describe_tool",
    description:
      "Return the exact input/options JSON schema, runtime compatibility, tier, and runnable examples for any Code Station tool slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Tool slug or ID (e.g. 'cidr-calculator', 'json-to-go', 'conventional-commit-builder')",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "codestation_run_tool",
    description:
      "Execute any Node-compatible Code Station tool (300+ pure tools across JSON, Encoding, Security, Regex, SQL, Date/Time, Text, Markdown, Codegen, Network, Math, Crypto, AI, Finance, Git) by slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Target tool slug (from codestation_list_tools)",
        },
        input: {
          type: "string",
          description: "Primary string, JSON, SQL, code, or text input",
        },
        options: {
          type: "object",
          description: "Optional tool-specific configuration parameters (inspect with codestation_describe_tool)",
        },
      },
      required: ["slug"],
    },
  },
];

export const TOP_25_MCP_TOOLS: Tool[] = [
  {
    name: "codestation_format_json",
    description: "Prettify, format, and validate a JSON string. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Raw JSON string to format" },
        indent: {
          type: "integer",
          description: "Number of spaces for indentation (0-8, default: 2)",
          minimum: 0,
          maximum: 8,
        },
      },
      required: ["json"],
    },
  },
  {
    name: "codestation_json_to_yaml",
    description: "Convert JSON to clean YAML format. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Valid JSON string" },
      },
      required: ["json"],
    },
  },
  {
    name: "codestation_json_path",
    description: "Query and extract matching nodes from JSON using JSONPath (e.g. $.users[*].name, $[0].id). [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Valid JSON payload to query" },
        expression: { type: "string", description: "JSONPath expression starting with $" },
      },
      required: ["json", "expression"],
    },
  },
  {
    name: "codestation_json_diff",
    description: "Compute a structural key-by-key diff between two JSON documents. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        left: { type: "string", description: "Original JSON document" },
        right: { type: "string", description: "Updated JSON document" },
      },
      required: ["left", "right"],
    },
  },
  {
    name: "codestation_csv_json",
    description: "Convert CSV tables (with header row) to JSON arrays or JSON arrays of objects to CSV. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "CSV or JSON input text" },
        direction: {
          type: "string",
          enum: ["csv-to-json", "json-to-csv"],
          description: "Conversion direction",
        },
      },
      required: ["input", "direction"],
    },
  },
  {
    name: "codestation_jwt_decode",
    description:
      "Inspect & decode JSON Web Token (JWT) header, payload claims, and signature in local memory without transmitting secrets. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Full JWT string (header.payload.signature)" },
      },
      required: ["token"],
    },
  },
  {
    name: "codestation_base64",
    description: "Encode or decode Base64 and URL-safe Base64 strings. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The string to encode or decode" },
        action: {
          type: "string",
          enum: ["encode", "decode"],
          description: "Whether to encode or decode",
        },
        urlSafe: {
          type: "boolean",
          description: "Whether to use URL-safe Base64 (default: false)",
        },
      },
      required: ["text", "action"],
    },
  },
  {
    name: "codestation_url_codec",
    description: "URL encode or decode string components. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to URL-encode or URL-decode" },
        action: {
          type: "string",
          enum: ["encode", "decode"],
          description: "Action to perform",
        },
      },
      required: ["text", "action"],
    },
  },
  {
    name: "codestation_uuid",
    description: "Generate cryptographically secure v4 UUIDs. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "integer",
          description: "Number of UUIDs to generate (1 to 50, default: 1)",
          minimum: 1,
          maximum: 50,
        },
      },
    },
  },
  {
    name: "codestation_hash",
    description: "Generate cryptographic hashes (SHA-256 Free; SHA-384, SHA-512, MD5, SHA-1, CRC-32 require Pro Tier).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to hash" },
        algorithm: {
          type: "string",
          enum: ["SHA-256", "SHA-384", "SHA-512", "MD5", "SHA-1", "CRC32"],
          description: "Hash algorithm to apply (default: SHA-256)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "codestation_text_diff",
    description: "Generate a clean line-by-line unified diff between original and modified text. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        original: { type: "string", description: "The original text content" },
        modified: { type: "string", description: "The updated text content" },
      },
      required: ["original", "modified"],
    },
  },
  {
    name: "codestation_case_convert",
    description:
      "Convert text into different naming conventions (camelCase, snake_case, kebab-case, PascalCase, CONSTANT_CASE, etc.). [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The string or identifier to convert" },
        targetCase: {
          type: "string",
          enum: ["camel", "pascal", "snake", "kebab", "constant", "title", "sentence", "upper", "lower"],
          description: "Target casing style",
        },
      },
      required: ["text", "targetCase"],
    },
  },
  {
    name: "codestation_regex_test",
    description:
      "Test regular expressions against target text and return structured match groups and indices. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern (without bounding slashes)" },
        text: { type: "string", description: "Text to search within" },
        flags: {
          type: "string",
          description: "Regex flags (e.g. 'g', 'i', 'm', default: 'g')",
        },
      },
      required: ["pattern", "text"],
    },
  },
  {
    name: "codestation_cron_explain",
    description: "Parse and explain 5-field Unix cron expressions in clear plain English. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "5-field cron expression, e.g. '*/15 9-17 * * 1-5'",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "codestation_format_sql",
    description:
      "Format, beautify, and indent SQL queries across PostgreSQL, MySQL, SQLite, and standard SQL. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "Raw SQL query to format" },
        dialect: {
          type: "string",
          enum: ["PostgreSQL", "MySQL", "SQLite", "SQL Server"],
          description: "SQL dialect (default: PostgreSQL)",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "codestation_markdown_to_html",
    description: "Convert Markdown into sanitized HTML locally with headings, tables, lists, and code blocks. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        markdown: { type: "string", description: "Markdown text to render as HTML" },
      },
      required: ["markdown"],
    },
  },
  {
    name: "codestation_timestamp_convert",
    description: "Convert a Unix epoch timestamp (seconds or milliseconds) to ISO 8601 and UTC/local date representations. [Free Tier]",
    inputSchema: {
      type: "object",
      properties: {
        timestamp: { type: "string", description: "Unix timestamp string (e.g. '1700000000')" },
        unit: {
          type: "string",
          enum: ["Seconds", "Milliseconds"],
          description: "Timestamp unit (default: 'Seconds')",
        },
      },
      required: ["timestamp"],
    },
  },
  {
    name: "codestation_cidr_calc",
    description: "Calculate CIDR subnet mask, network address, broadcast address, usable IP range, and host count. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        cidr: { type: "string", description: "IPv4 CIDR block (e.g. '192.168.1.0/24')" },
      },
      required: ["cidr"],
    },
  },
  {
    name: "codestation_token_count",
    description: "Estimate LLM token count, character stats, and API cost across GPT-4o, Claude 3.5, Gemini 1.5, and Llama 3. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Prompt or text to tokenize" },
        model: {
          type: "string",
          enum: ["gpt-4o", "claude-3-5", "gemini-1-5", "llama-3", "generic-bpe"],
          description: "Target model tokenizer preset (default: 'gpt-4o')",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "codestation_json_to_typescript",
    description: "Generate clean TypeScript interfaces and types from sample JSON data. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or object representation" },
        rootName: { type: "string", description: "Name for the root interface (default: 'Root')" },
      },
      required: ["json"],
    },
  },
  {
    name: "codestation_json_to_zod",
    description: "Generate production-ready Zod validation schema and inferred types from sample JSON data. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or object representation" },
        rootName: { type: "string", description: "Name for the root schema (default: 'rootSchema')" },
      },
      required: ["json"],
    },
  },
  {
    name: "codestation_curl_to_code",
    description: "Convert cURL commands to TypeScript fetch/axios, Python requests, or Go net/http. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        curl: { type: "string", description: "cURL command string" },
        target: {
          type: "string",
          enum: ["fetch", "axios", "python", "go"],
          description: "Target programming language/library (default: 'fetch')",
        },
      },
      required: ["curl"],
    },
  },
  {
    name: "codestation_env_audit",
    description:
      "Scan environment variables for secret leaks (Stripe, AWS, OpenAI, GitHub PAT, private keys) and validate against .env.example. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "Contents of the .env file" },
        example: { type: "string", description: "Optional contents of .env.example to diff against" },
        format: {
          type: "string",
          enum: ["report", "json"],
          description: "Output format (default: 'report')",
        },
      },
      required: ["env"],
    },
  },
  {
    name: "codestation_mock_data",
    description: "Generate realistic mock data and SQL seeders for users, products, orders, or custom schemas. [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        template: {
          type: "string",
          enum: ["users", "products", "orders", "custom"],
          description: "Template type (default: 'users')",
        },
        count: {
          type: "integer",
          minimum: 1,
          maximum: 1000,
          description: "Number of records to generate (default: 10)",
        },
        format: {
          type: "string",
          enum: ["json", "sql"],
          description: "Output format (default: 'json')",
        },
        tableName: {
          type: "string",
          description: "Optional SQL table name (defaults to template name)",
        },
        customSchema: {
          type: "object",
          description: "Optional custom schema mapping field names to types (uuid, name, email, price, date, boolean, number, status, role)",
        },
      },
    },
  },
  {
    name: "codestation_git_conflict",
    description: "Parse and resolve Git merge conflict markers (<<<<<<< HEAD, =======, >>>>>>>). [Pro Tier: ₹199/mo or $2.99/mo]",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "File content containing Git conflict markers" },
        strategy: {
          type: "string",
          enum: ["analyze", "ours", "theirs", "both"],
          description: "Resolution strategy: analyze (report), ours (keep current), theirs (keep incoming), or both (keep both). Default: 'analyze'",
        },
      },
      required: ["content"],
    },
  },
];

/** Canonical tool slugs already represented directly by TOP_25_MCP_TOOLS */
const TOP_25_CANONICAL_MCP_EQUIVALENTS = new Set([
  "codestation_json_formatter",
  "codestation_json_to_yaml",
  "codestation_jsonpath_tester",
  "codestation_json_diff",
  "codestation_csv_to_json",
  "codestation_json_to_csv",
  "codestation_jwt_decoder",
  "codestation_base64_encoder",
  "codestation_base64_decoder",
  "codestation_url_encoder",
  "codestation_url_decoder",
  "codestation_uuid_generator",
  "codestation_sha_256_generator",
  "codestation_text_diff",
  "codestation_case_converter",
  "codestation_regex_match_inspector",
  "codestation_cron_explainer",
  "codestation_sql_formatter",
  "codestation_markdown_to_html",
  "codestation_unix_timestamp_converter",
  "codestation_cidr_calculator",
  "codestation_ai_token_counter",
  "codestation_json_to_typescript",
  "codestation_json_to_zod",
  "codestation_curl_to_any_language",
  "codestation_env_audit",
  "codestation_mock_data",
  "codestation_conflict_parse",
]);

/** Default Hybrid MCP tool surface: 3 universal meta-tools + top 25 everyday developer tools. */
export const MCP_TOOLS: Tool[] = [...UNIVERSAL_META_TOOLS, ...TOP_25_MCP_TOOLS];

export function parseStationFilters(stations?: string[] | string): string[] {
  const raw = Array.isArray(stations)
    ? stations
    : typeof stations === "string"
      ? stations.split(",")
      : (process.env.CODESTATION_MCP_STATIONS ?? "").split(",");
  return raw.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function getMcpTools(options?: McpServerOptions, license?: LicenseStatus): Tool[] {
  const stationFilters = parseStationFilters(options?.stations);
  if (stationFilters.length === 0) {
    return MCP_TOOLS;
  }
  const effectiveLicense = license ?? resolveLicense();
  if (!effectiveLicense.isPro) {
    return MCP_TOOLS;
  }
  const excludeNames = new Set([
    ...MCP_TOOLS.map((t) => t.name),
    ...TOP_25_CANONICAL_MCP_EQUIVALENTS,
  ]);
  const extraTools = getExposedStationTools(stationFilters, excludeNames);
  return [...MCP_TOOLS, ...extraTools];
}

export async function executeMcpTool(
  name: string,
  args: Record<string, any> = {},
  license: LicenseStatus
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  // Check Pro gate using checkToolAccess and PRO_TOOLS
  const access = checkToolAccess(name, license);
  if (!access.allowed || (PRO_TOOLS.has(name) && !license.isPro)) {
    return {
      content: [
        {
          type: "text",
          text: access.reason || getProUpgradeNotice(name),
        },
      ],
      isError: true,
    };
  }

  try {
    let outputText = "";

    switch (name) {
      // ----------------- 3 UNIVERSAL HYBRID META-TOOLS -----------------
      case "codestation_list_tools": {
        const filter: BridgeListFilter = {
          station: typeof args.station === "string" ? args.station : undefined,
          query: typeof args.query === "string" ? args.query : undefined,
          tier: args.tier === "free" || args.tier === "pro" || args.tier === "all" ? args.tier : "all",
          runtime:
            args.runtime === "node-pure" ||
            args.runtime === "node-file" ||
            args.runtime === "browser-only" ||
            args.runtime === "all"
              ? args.runtime
              : "all",
          limit: args.limit !== undefined ? Number(args.limit) : 30,
        };
        outputText = JSON.stringify(listBridgeTools(filter), null, 2);
        break;
      }

      case "codestation_describe_tool": {
        const slug = String(args.slug ?? args.tool ?? "").trim();
        if (!slug) {
          throw new Error("Missing required parameter 'slug'. Call codestation_list_tools to browse slugs.");
        }
        const described = describeBridgeTool(slug);
        if (!described) {
          throw new Error(`Unknown Code Station tool slug "${slug}". Call codestation_list_tools to search.`);
        }
        outputText = JSON.stringify(described, null, 2);
        break;
      }

      case "codestation_run_tool": {
        const slug = String(args.slug ?? args.toolId ?? args.tool ?? "").trim();
        if (!slug) {
          throw new Error("Missing required parameter 'slug'. Call codestation_list_tools to find a tool slug.");
        }
        return await executeBridgeTool(slug, args, license);
      }

      // ----------------- TOP 25 EVERYDAY TOOLS & LEGACY ALIASES -----------------
      case "codestation_uuid": {
        const count = Math.min(Math.max(Number(args.count ?? 1), 1), 50);
        const uuids = Array.from({ length: count }, () => crypto.randomUUID());
        outputText = count === 1 ? uuids[0] : uuids.join("\n");
        break;
      }

      case "codestation_base64": {
        const text = String(args.text ?? "");
        const action = String(args.action ?? "encode");
        const urlSafe = Boolean(args.urlSafe);
        if (action !== "encode" && action !== "decode") {
          throw new Error(`Invalid Base64 action "${action}". Expected "encode" or "decode".`);
        }

        if (action === "encode") {
          outputText = urlSafe ? encodeBase64Url(text) : Buffer.from(text, "utf-8").toString("base64");
        } else {
          if (urlSafe) {
            outputText = decodeBase64Url(text);
          } else {
            const cleaned = text.replace(/\s+/g, "");
            if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(cleaned)) {
              throw new Error("Invalid standard Base64 input.");
            }
            outputText = Buffer.from(cleaned, "base64").toString("utf-8");
          }
        }
        break;
      }

      case "codestation_url_codec": {
        const text = String(args.text ?? "");
        const action = String(args.action ?? "encode");
        outputText = action === "encode" ? encodeUrlComponent(text) : decodeUrlComponent(text);
        break;
      }

      case "codestation_hex_codec": {
        const text = String(args.text ?? "");
        const action = String(args.action ?? "encode");
        outputText = action === "encode" ? encodeHexadecimal(text) : decodeHexadecimal(text);
        break;
      }

      case "codestation_format_json": {
        const json = String(args.json ?? "");
        const indent = args.indent !== undefined ? Number(args.indent) : 2;
        outputText = formatJson(json, indent);
        break;
      }

      case "codestation_minify_json": {
        outputText = minifyJson(String(args.json ?? ""));
        break;
      }

      case "codestation_json_to_yaml": {
        outputText = jsonToYaml(String(args.json ?? ""));
        break;
      }

      case "codestation_yaml_to_json": {
        outputText = yamlToJson(String(args.yaml ?? ""));
        break;
      }

      case "codestation_case_convert": {
        const text = String(args.text ?? "");
        const targetCase = String(args.targetCase ?? "camel") as TextCase;
        outputText = convertCase(text, targetCase);
        break;
      }

      case "codestation_text_diff": {
        outputText = diffText(String(args.original ?? ""), String(args.modified ?? ""));
        break;
      }

      case "codestation_slugify": {
        outputText = slugify(String(args.text ?? ""), String(args.separator ?? "-"));
        break;
      }

      case "codestation_ulid": {
        const count = args.count === undefined ? 1 : Number(args.count);
        if (!Number.isInteger(count) || count < 1 || count > 50) {
          throw new RangeError("count must be an integer between 1 and 50.");
        }
        const ulids = Array.from({ length: count }, () => ulid());
        outputText = count === 1 ? ulids[0] : ulids.join("\n");
        break;
      }

      case "codestation_nanoid": {
        const length = args.length === undefined ? 21 : Number(args.length);
        const count = args.count === undefined ? 1 : Number(args.count);
        if (!Number.isInteger(length) || length < 2 || length > 128) {
          throw new RangeError("length must be an integer between 2 and 128.");
        }
        if (!Number.isInteger(count) || count < 1 || count > 50) {
          throw new RangeError("count must be an integer between 1 and 50.");
        }
        const ids = Array.from({ length: count }, () => nanoid(length));
        outputText = count === 1 ? ids[0] : ids.join("\n");
        break;
      }

      case "codestation_json_diff": {
        const left = args.left;
        const right = args.right;
        if (typeof left !== "string" || typeof right !== "string" || !left.trim() || !right.trim()) {
          throw new Error("Both left and right JSON strings are required.");
        }
        outputText = jsonDiff(left, right);
        break;
      }

      case "codestation_json_path": {
        const json = args.json;
        const expression = args.expression;
        if (typeof json !== "string" || !json.trim()) {
          throw new Error("A JSON string is required.");
        }
        if (typeof expression !== "string" || !expression.trim()) {
          throw new Error("A JSONPath expression starting with $ is required.");
        }
        outputText = testJsonPath(json, expression);
        break;
      }

      case "codestation_html_codec": {
        const text = args.text;
        const action = String(args.action ?? "");
        if (typeof text !== "string") {
          throw new Error("A text string is required.");
        }
        if (action !== "encode" && action !== "decode") {
          throw new Error(`Invalid action "${action}". Expected "encode" or "decode".`);
        }
        outputText = action === "encode" ? encodeHtml(text) : decodeHtml(text);
        break;
      }

      case "codestation_csv_json": {
        const input = args.input;
        const direction = String(args.direction ?? "");
        if (typeof input !== "string" || !input.trim()) {
          throw new Error("Non-empty CSV or JSON input is required.");
        }
        if (direction === "csv-to-json") {
          outputText = csvToJson(input);
        } else if (direction === "json-to-csv") {
          outputText = jsonToCsv(input);
        } else {
          throw new Error(`Invalid direction "${direction}". Expected "csv-to-json" or "json-to-csv".`);
        }
        break;
      }

      case "codestation_markdown_to_html": {
        const markdown = String(args.markdown ?? args.input ?? "");
        outputText = (await runMarkdown("markdown-to-html", { source: markdown })).text;
        break;
      }

      case "codestation_timestamp_convert": {
        const timestamp = String(args.timestamp ?? args.input ?? "");
        const unit = args.unit === "Milliseconds" ? "Milliseconds" : "Seconds";
        const res = runDateTime("unix-timestamp-converter", { timestamp, unit });
        outputText = JSON.stringify(res.rows, null, 2);
        break;
      }

      case "codestation_cidr_calc": {
        const cidr = String(args.cidr ?? args.input ?? "");
        outputText = JSON.stringify(calculateCidr(cidr), null, 2);
        break;
      }

      case "codestation_token_count": {
        const text = String(args.text ?? args.input ?? "");
        const model = (args.model ? String(args.model) : "gpt-4o") as AiModelId;
        outputText = JSON.stringify(countTokens(text, model), null, 2);
        break;
      }

      // --- Pro tools ---
      case "codestation_hash": {
        const text = String(args.text ?? "");
        const algo = String(args.algorithm ?? "SHA-256").toUpperCase();
        if (algo !== "SHA-256" && !license.isPro) {
          return {
            content: [{ type: "text", text: getProUpgradeNotice(`codestation_hash (${algo})`) }],
            isError: true,
          };
        }
        if (algo === "MD5") outputText = md5(text);
        else if (algo === "SHA-1") outputText = sha1(text);
        else if (algo === "SHA-256") outputText = await sha256(text);
        else if (algo === "SHA-384") outputText = await sha384(text);
        else if (algo === "SHA-512") outputText = await sha512(text);
        else if (algo === "CRC32") outputText = crc32(text);
        else throw new Error(`Unsupported hash algorithm: ${algo}`);
        break;
      }

      case "codestation_hmac": {
        const text = String(args.text ?? "");
        const secret = String(args.secret ?? "");
        const algo = String(args.algorithm ?? "SHA-256").toUpperCase();
        outputText = algo === "SHA-512" ? await hmacSha512(text, secret) : await hmacSha256(text, secret);
        break;
      }

      case "codestation_jwt_decode": {
        outputText = decodeJwt(String(args.token ?? ""));
        break;
      }

      case "codestation_format_sql": {
        const sql = String(args.sql ?? "");
        const dialect = String(args.dialect ?? "PostgreSQL").toLowerCase();
        const { format } = await import("sql-formatter");
        const dialectMap: Record<string, string> = {
          postgresql: "postgresql",
          postgres: "postgresql",
          mysql: "mysql",
          sqlite: "sqlite",
          sqlserver: "transactsql",
          tsql: "transactsql",
          "sql server": "transactsql",
        };
        const lang = dialectMap[dialect] || "sql";
        outputText = format(sql, { language: lang as any, tabWidth: 2 });
        break;
      }

      case "codestation_cron_explain": {
        const parsed = parseCron(String(args.expression ?? ""));
        outputText = explainCron(parsed);
        break;
      }

      case "codestation_cron_next_runs": {
        const expression = String(args.expression ?? "");
        const count = args.count === undefined ? 5 : Number(args.count);
        if (!Number.isInteger(count) || count < 1 || count > 20) {
          throw new RangeError("count must be an integer between 1 and 20.");
        }
        const timeZone = args.timeZone !== undefined ? String(args.timeZone) : "UTC";
        let cursor = args.startFrom !== undefined ? String(args.startFrom) : new Date().toISOString();
        const parsed = parseCron(expression);
        const runs: Array<{ run: number; dateTime: string; duration: string }> = [];
        for (let i = 0; i < count; i += 1) {
          const next = nextCronRun(parsed, cursor, timeZone);
          runs.push({ run: i + 1, dateTime: next.dateTime, duration: next.duration });
          cursor = new Date(next.instant).toISOString();
        }
        outputText = JSON.stringify({ expression, timeZone, runs }, null, 2);
        break;
      }

      case "codestation_timezone_convert": {
        const dateTime = String(args.dateTime ?? "");
        const sourceZone = String(args.sourceTimeZone ?? "UTC");
        const targetZone = String(args.targetTimeZone ?? "UTC");
        outputText = convertBetweenTimeZones(dateTime, sourceZone, targetZone);
        break;
      }

      case "codestation_business_days": {
        const start = String(args.startDate ?? "");
        const end = String(args.endDate ?? "");
        const days = businessDaysBetween(start, end);
        outputText = `${days} business day${days === 1 ? "" : "s"}`;
        break;
      }

      case "codestation_regex_test": {
        const pattern = String(args.pattern ?? "");
        const text = String(args.text ?? "");
        const flags = String(args.flags ?? "g");
        outputText = testRegex(pattern, flags, text);
        break;
      }

      case "codestation_json_schema": {
        outputText = generateJsonSchema(String(args.json ?? ""));
        break;
      }

      case "codestation_json_to_typescript": {
        const json = String(args.json ?? "");
        const rootName = args.rootName ? String(args.rootName) : "Root";
        outputText = jsonToTypescript(json, rootName);
        break;
      }

      case "codestation_json_to_zod": {
        const json = String(args.json ?? "");
        const rootName = args.rootName ? String(args.rootName) : "rootSchema";
        outputText = jsonToZod(json, rootName);
        break;
      }

      case "codestation_curl_to_code": {
        const curl = String(args.curl ?? "");
        const target = (args.target ? String(args.target) : "fetch") as CurlTargetLanguage;
        const result = await curlToCode(curl, target);
        outputText = result.code;
        break;
      }

      case "codestation_env_audit": {
        const env = String(args.env ?? "");
        const example = args.example ? String(args.example) : undefined;
        const format = args.format ? String(args.format) : "report";
        const result = auditEnv(env, example);
        outputText = format === "json" ? JSON.stringify(result, null, 2) : formatEnvAuditReport(result);
        break;
      }

      case "codestation_mock_data": {
        const template = (args.template ? String(args.template) : "users") as MockTemplate;
        const count = args.count ? Number(args.count) : 10;
        const format = (args.format ? String(args.format) : "json") as "json" | "sql";
        const tableName = args.tableName ? String(args.tableName) : undefined;
        const customSchema = args.customSchema as Record<string, any> | undefined;
        const result = generateMockDataset({ template, count, format, tableName, customSchema });
        outputText = format === "sql" && result.sql ? result.sql : result.json;
        break;
      }

      case "codestation_git_conflict": {
        const content = String(args.content ?? "");
        const strategy = (args.strategy ? String(args.strategy) : "analyze") as ConflictStrategy;
        const result = parseAndResolveGitConflicts(content, strategy);
        outputText = strategy === "analyze" ? formatConflictReport(result) : result.resolvedContent ?? content;
        break;
      }

      default: {
        // Delegate dynamically bridged station tools (`codestation_<slug>`) cleanly
        outputText = await executeNodeTool(
          name,
          typeof args.input === "string" ? args.input : "",
          args.options && typeof args.options === "object" ? args.options : args
        );
        break;
      }
    }

    return {
      content: [{ type: "text", text: outputText }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
}

export function createMcpServer(cliKey?: string, options?: McpServerOptions) {
  const license: LicenseStatus = resolveLicense(cliKey);
  if (license.source === "cache") {
    void revalidateLicenseInBackground(license);
  }
  const server = new Server(
    {
      name: "codestation-mcp",
      version: "1.4.1",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools = getMcpTools(options, license);
  const nodePureToolCount = getNodePureToolCount();

  // Standard MCP List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Standard MCP Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return executeMcpTool(request.params.name, request.params.arguments || {}, license);
  });

  // Extended JSON-RPC tools.list
  server.setRequestHandler(
    z.object({ method: z.literal("tools.list"), params: z.any().optional() }),
    async () => {
      return { tools };
    }
  );

  // Extended JSON-RPC tools.describe
  server.setRequestHandler(
    z.object({ method: z.literal("tools.describe"), params: z.any().optional() }),
    async (request) => {
      const params = (request.params as any) || {};
      const toolName = String(params.name || params.tool || params.slug || "");
      const found = tools.find((t) => t.name === toolName);
      if (found) {
        const isPro = PRO_TOOLS.has(found.name);
        return {
          tool: found,
          accessLevel: isPro ? "pro" : "free",
          tier: isPro ? "pro" : "free",
        };
      }
      const bridged = describeBridgeTool(toolName);
      if (bridged) {
        return {
          tool: bridged,
          accessLevel: bridged.tier,
          tier: bridged.tier,
        };
      }
      throw new Error(`Unknown tool: ${toolName}`);
    }
  );

  // Extended JSON-RPC tools.execute
  server.setRequestHandler(
    z.object({ method: z.literal("tools.execute"), params: z.any().optional() }),
    async (request) => {
      const params = (request.params as any) || {};
      const toolName = params.name || params.tool;
      const toolArgs = params.arguments || params.parameters || {};
      return executeMcpTool(toolName, toolArgs, license);
    }
  );

  // Extended JSON-RPC auth.status
  server.setRequestHandler(
    z.object({ method: z.literal("auth.status"), params: z.any().optional() }),
    async () => {
      return {
        authenticated: license.isPro,
        tier: license.tier,
        isPro: license.isPro,
        licenseKey: license.licenseKey ? license.licenseKey.slice(0, 8) + "..." : null,
      };
    }
  );

  // Extended JSON-RPC entitlements.status
  server.setRequestHandler(
    z.object({ method: z.literal("entitlements.status"), params: z.any().optional() }),
    async () => {
      return {
        tier: license.tier,
        isPro: license.isPro,
        active: true,
        entitlements: license.isPro
          ? ["all-tools", "offline-crypto", "high-volume-seeding", "pro-converters"]
          : ["free-tools", "standard-rate-limit"],
      };
    }
  );

  // Extended JSON-RPC capabilities.list
  server.setRequestHandler(
    z.object({ method: z.literal("capabilities.list"), params: z.any().optional() }),
    async () => {
      return {
        capabilities: ["tools", "hybrid-registry", "crypto", "offline", "pro-access", "zero-latency"],
        exposedTools: tools.length,
        nodePureTools: nodePureToolCount,
      };
    }
  );

  return {
    server,
    license,
    exposedToolCount: tools.length,
    nodePureToolCount,
  };
}
