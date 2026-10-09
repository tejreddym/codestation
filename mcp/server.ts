import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  resolveLicense,
  PRO_TOOLS,
  getProUpgradeNotice,
  type LicenseStatus,
} from "./config";

// Direct imports from Code Station engine
import {
  formatJson,
  minifyJson,
  jsonToYaml,
  yamlToJson,
  decodeJwt,
  generateJsonSchema,
  testRegex,
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
import { runSql } from "../lib/tools/sql/engine";

export function createMcpServer(cliKey?: string) {
  const license: LicenseStatus = resolveLicense(cliKey);

  const server = new Server(
    {
      name: "codestation-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools: Tool[] = [
    // ----------------- FREE TOOLS -----------------
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
      name: "codestation_hex_codec",
      description: "Encode UTF-8 string to hexadecimal byte pairs or decode hex to text. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text or hex string" },
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
      name: "codestation_minify_json",
      description: "Minify JSON by stripping all whitespace. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          json: { type: "string", description: "JSON string to minify" },
        },
        required: ["json"],
      },
    },
    {
      name: "codestation_json_to_yaml",
      description: "Convert JSON to clean YAML format. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          json: { type: "string", description: "Valid JSON string" },
        },
        required: ["json"],
      },
    },
    {
      name: "codestation_yaml_to_json",
      description: "Convert YAML formatted text to JSON. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          yaml: { type: "string", description: "YAML text string" },
        },
        required: ["yaml"],
      },
    },
    {
      name: "codestation_case_convert",
      description: "Convert text into different naming conventions (camelCase, snake_case, kebab-case, PascalCase, CONSTANT_CASE, etc.). [Free Tier]",
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
      name: "codestation_slugify",
      description: "Convert strings to clean, SEO-friendly URL slugs. [Free Tier]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to slugify" },
          separator: { type: "string", description: "Separator character (default: '-')" },
        },
        required: ["text"],
      },
    },

    // ----------------- PRO TOOLS (₹199 / $2.99) -----------------
    {
      name: "codestation_hash",
      description: "Generate cryptographic hashes (SHA-256, SHA-512, MD5, SHA-1, CRC-32). [Pro Tier: ₹199/mo or $2.99/mo]",
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
      name: "codestation_hmac",
      description: "Compute HMAC signatures using Web Crypto. [Pro Tier: ₹199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Input message string" },
          secret: { type: "string", description: "Secret key" },
          algorithm: {
            type: "string",
            enum: ["SHA-256", "SHA-512"],
            description: "HMAC algorithm (default: SHA-256)",
          },
        },
        required: ["text", "secret"],
      },
    },
    {
      name: "codestation_jwt_decode",
      description: "Inspect & decode JSON Web Token (JWT) header, payload claims, and signature in local memory without transmitting secrets. [Pro Tier: ₹199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          token: { type: "string", description: "Full JWT string (header.payload.signature)" },
        },
        required: ["token"],
      },
    },
    {
      name: "codestation_format_sql",
      description: "Format, beautify, and indent SQL queries across PostgreSQL, MySQL, SQLite, and standard SQL. [Pro Tier: ₹199/mo or $2.99/mo]",
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
      name: "codestation_cron_explain",
      description: "Parse and explain 5-field Unix cron expressions in clear plain English. [Pro Tier: ₹199/mo or $2.99/mo]",
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
      name: "codestation_timezone_convert",
      description: "Accurately convert a date/time string from one IANA timezone to another using runtime IANA rules. [Pro Tier: ₹199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          dateTime: {
            type: "string",
            description: "ISO date-time string, e.g. '2026-10-09T14:30:00'",
          },
          sourceTimeZone: {
            type: "string",
            description: "Source IANA timezone (e.g. 'America/New_York', 'Asia/Kolkata', 'UTC')",
          },
          targetTimeZone: {
            type: "string",
            description: "Target IANA timezone (e.g. 'Asia/Kolkata', 'Europe/London', 'UTC')",
          },
        },
        required: ["dateTime", "sourceTimeZone", "targetTimeZone"],
      },
    },
    {
      name: "codestation_business_days",
      description: "Calculate exact working/business days between two dates, excluding weekends. [Pro Tier: ₹199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
          endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        },
        required: ["startDate", "endDate"],
      },
    },
    {
      name: "codestation_regex_test",
      description: "Test regular expressions against target text and return structured match groups and indices. [Pro Tier: ₹199/mo or $2.99/mo]",
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
      name: "codestation_json_schema",
      description: "Infer a Draft 2020-12 JSON Schema structure from sample JSON data. [Pro Tier: ₹199/mo or $2.99/mo]",
      inputSchema: {
        type: "object",
        properties: {
          json: { type: "string", description: "Sample JSON string" },
        },
        required: ["json"],
      },
    },
  ];

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    // Check Pro gate
    if (PRO_TOOLS.has(name) && !license.isPro) {
      return {
        content: [
          {
            type: "text",
            text: getProUpgradeNotice(name),
          },
        ],
        isError: true,
      };
    }

    try {
      let outputText = "";

      switch (name) {
        // --- Free tools ---
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

          if (action === "encode") {
            if (urlSafe) {
              outputText = encodeBase64Url(text);
            } else {
              outputText = Buffer.from(text, "utf-8").toString("base64");
            }
          } else {
            if (urlSafe) {
              outputText = decodeBase64Url(text);
            } else {
              outputText = Buffer.from(text, "base64").toString("utf-8");
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

        // --- Pro tools ---
        case "codestation_hash": {
          const text = String(args.text ?? "");
          const algo = String(args.algorithm ?? "SHA-256").toUpperCase();
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
          if (algo === "SHA-512") {
            outputText = await hmacSha512(text, secret);
          } else {
            outputText = await hmacSha256(text, secret);
          }
          break;
        }

        case "codestation_jwt_decode": {
          outputText = decodeJwt(String(args.token ?? ""));
          break;
        }

        case "codestation_format_sql": {
          const sql = String(args.sql ?? "");
          const dialect = String(args.dialect ?? "PostgreSQL") as any;
          const res = await runSql("sql-formatter", { sql, dialect });
          outputText = res.rows?.find((r) => r.label === "Formatted SQL")?.value ?? "";
          break;
        }

        case "codestation_cron_explain": {
          const parsed = parseCron(String(args.expression ?? ""));
          outputText = explainCron(parsed);
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

        default:
          throw new Error(`Unknown tool: ${name}`);
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
  });

  return { server, license };
}
