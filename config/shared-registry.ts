import { curlToCode, type CurlTargetLanguage } from "../lib/tools/curl-to-code";
import { auditEnv, formatEnvAuditReport, type EnvAuditResult } from "../lib/tools/env-audit";
import { generateMockDataset, type MockDataOptions } from "../lib/tools/mock-data";
import { parseAndResolveGitConflicts, formatConflictReport, type ConflictStrategy } from "../lib/tools/git-conflict";
import {
  decodeJwt,
  formatJson,
  minifyJson,
  jsonToYaml,
  yamlToJson,
  generateJsonSchema,
  testRegex,
  jsonDiff,
  testJsonPath,
  encodeHtml,
  decodeHtml,
  csvToJson,
  jsonToCsv,
} from "../lib/tools/index";
import { md5, sha1, sha256, sha512, crc32, hmacSha256, hmacSha512, ulid, nanoid } from "../lib/tools/security-station";
import {
  encodeBase64Url,
  decodeBase64Url,
  encodeHexadecimal,
  decodeHexadecimal,
  encodeUrlComponent,
  decodeUrlComponent,
} from "../lib/tools/encoding-station";
import { convertCase, slugify, diffText, type TextCase } from "../lib/tools/text-station";
import { jsonToTypescript, jsonToZod } from "../lib/tools/json-to-types";
import { convertBetweenTimeZones, businessDaysBetween } from "../lib/tools/date-time-station";
import { parseCron } from "../lib/tools/cron/parser";
import { explainCron } from "../lib/tools/cron/explain";
import { nextCronRun } from "../lib/tools/cron/engine";
import type { LicenseStatus } from "../mcp/config";

export type ToolAccessLevel = "free" | "pro" | "local-only" | "paid-key";
export type ToolPrivacyClassification = "local-only" | "client-side" | "memory-only";

export interface SharedToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  accessLevel: ToolAccessLevel;
  privacyClassification: ToolPrivacyClassification;
  category: string;
  keywords: readonly string[];
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  cliMetadata: {
    command: string;
    aliases: string[];
    description: string;
    examples: string[];
  };
  mcpMetadata: {
    toolName: string;
    description: string;
  };
  routeMetadata: {
    route: string;
    slug: string;
  };
  execute: (input: any, context?: { license?: LicenseStatus }) => Promise<any> | any;
}

export interface AccessCheckResult {
  allowed: boolean;
  status: "granted" | "denied";
  reason?: string;
  requiredTier?: "free" | "pro" | "paid-key";
}

/**
 * Single authoritative access policy engine across Web App, CLI, and MCP.
 */
export function checkToolAccess(
  toolId: string,
  license?: LicenseStatus | null
): AccessCheckResult {
  const tool = SHARED_TOOLS.find(
    (t) => t.id === toolId || t.mcpMetadata.toolName === toolId || t.cliMetadata.command === toolId || t.cliMetadata.aliases.includes(toolId)
  );

  if (!tool) {
    return {
      allowed: false,
      status: "denied",
      reason: `Tool "${toolId}" is not registered in Code Station registry.`,
    };
  }

  // Free tools are always granted
  if (tool.accessLevel === "free" || tool.accessLevel === "local-only") {
    return { allowed: true, status: "granted" };
  }

  // Pro tools require valid Pro license
  if (tool.accessLevel === "pro") {
    if (license?.isPro) {
      return { allowed: true, status: "granted" };
    }
    return {
      allowed: false,
      status: "denied",
      requiredTier: "pro",
      reason: `Tool "${tool.name}" requires Code Station Pro. Upgrade at https://codestation.in/pro or launch with --key CS-PRO-YOURKEY.`,
    };
  }

  // Paid key required
  if (tool.accessLevel === "paid-key") {
    if (license?.isPro) {
      return { allowed: true, status: "granted" };
    }
    return {
      allowed: false,
      status: "denied",
      requiredTier: "paid-key",
      reason: `Tool "${tool.name}" requires a valid paid key.`,
    };
  }

  return { allowed: true, status: "granted" };
}

export const SHARED_TOOLS: SharedToolDefinition[] = [
  // 1. cURL to Any Language Generator
  {
    id: "curl-to-any-language",
    name: "cURL to Any Language Generator",
    description: "Convert literal cURL commands into idiomatic TypeScript (fetch/axios), Python (requests), or Go (net/http).",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "API",
    keywords: ["curl", "fetch", "axios", "python", "go", "generator", "api", "converter"],
    inputSchema: {
      type: "object",
      properties: {
        curl: { type: "string", description: "cURL command string to convert" },
        target: {
          type: "string",
          enum: ["fetch", "axios", "python", "go"],
          default: "fetch",
          description: "Target programming language/library",
        },
      },
      required: ["curl"],
    },
    outputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        language: { type: "string" },
        target: { type: "string" },
        warnings: { type: "array", items: { type: "string" } },
      },
    },
    cliMetadata: {
      command: "curl-to-any-language",
      aliases: ["curl", "curl-to-code"],
      description: "Convert cURL commands to TypeScript, Python, or Go code",
      examples: [
        'codestation curl-to-any-language "curl https://api.example.com" --target fetch',
        'codestation curl "curl -X POST https://api.example.com -d \'{\\"name\\":\\"test\\"}\'" --target python',
      ],
    },
    mcpMetadata: {
      toolName: "codestation_curl_to_code",
      description: "Convert cURL commands to TypeScript fetch/axios, Python requests, or Go net/http. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/curl-to-any-language",
      slug: "curl-to-any-language",
    },
    execute: async (input: { curl: string; target?: CurlTargetLanguage }) => {
      const target = input.target || "fetch";
      return await curlToCode(input.curl, target);
    },
  },

  // 2. Environment & Secret Leak Scanner
  {
    id: "env-audit",
    name: "Environment & Secret Leak Scanner",
    description: "Audit .env and configuration files for exposed live secrets (Stripe, AWS, OpenAI, GitHub PAT, private keys) and diff against .env.example.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Security",
    keywords: ["env", "audit", "secrets", "scanner", "leak", "security", "credentials"],
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "Content of environment or configuration file" },
        example: { type: "string", description: "Optional content of .env.example to compare against" },
        format: { type: "string", enum: ["report", "json"], default: "report" },
      },
      required: ["env"],
    },
    outputSchema: {
      type: "object",
      properties: {
        totalVariables: { type: "integer" },
        findings: { type: "array" },
        isSecure: { type: "boolean" },
        summary: { type: "string" },
      },
    },
    cliMetadata: {
      command: "env-audit",
      aliases: ["env", "audit-env"],
      description: "Scan .env files for leaked secrets and diff against .env.example",
      examples: [
        "codestation env-audit .env --example .env.example",
        "codestation env .env --json",
      ],
    },
    mcpMetadata: {
      toolName: "codestation_env_audit",
      description: "Scan environment variables for secret leaks and validate against .env.example. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/env-audit",
      slug: "env-audit",
    },
    execute: async (input: { env: string; example?: string; format?: "report" | "json" }) => {
      const res = auditEnv(input.env, input.example);
      if (input.format === "json") return res;
      return { report: formatEnvAuditReport(res), ...res };
    },
  },

  // 3. Realistic Mock Data & SQL Seeder
  {
    id: "mock-data",
    name: "Realistic Mock Data & SQL Seeder",
    description: "Generate realistic mock data records and SQL INSERT seed statements with deterministic seeds.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["mock", "data", "seed", "sql", "faker", "testing", "fixtures"],
    inputSchema: {
      type: "object",
      properties: {
        template: { type: "string", enum: ["users", "products", "orders", "custom"], default: "users" },
        count: { type: "integer", minimum: 1, maximum: 1000, default: 10 },
        format: { type: "string", enum: ["json", "sql", "csv"], default: "json" },
        tableName: { type: "string", description: "Table name for SQL output" },
        seed: { type: "integer", description: "Deterministic random seed" },
        customSchema: { type: "object", description: "Custom field mapping" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        count: { type: "integer" },
        data: { type: "array" },
        json: { type: "string" },
        sql: { type: "string" },
      },
    },
    cliMetadata: {
      command: "mock-data",
      aliases: ["mock", "seeder"],
      description: "Generate realistic mock data in JSON or SQL format",
      examples: [
        "codestation mock-data users --count 10",
        "codestation mock products --count 5 --sql --table catalog",
      ],
    },
    mcpMetadata: {
      toolName: "codestation_mock_data",
      description: "Generate realistic mock data and SQL seeders for users, products, orders, or custom schemas. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/mock-data",
      slug: "mock-data",
    },
    execute: async (options: MockDataOptions) => {
      return generateMockDataset(options);
    },
  },

  // 4. Git Merge Conflict Resolver
  {
    id: "conflict-parse",
    name: "Git Merge Conflict Resolver",
    description: "Parse and resolve standard or diff3 Git merge conflict markers (<<<<<<< HEAD, =======, >>>>>>>).",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Git & Version Control",
    keywords: ["git", "conflict", "merge", "resolver", "diff3", "ours", "theirs"],
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "File content containing conflict markers" },
        strategy: { type: "string", enum: ["analyze", "ours", "theirs", "both"], default: "analyze" },
      },
      required: ["content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        hasConflicts: { type: "boolean" },
        conflictCount: { type: "integer" },
        hunks: { type: "array" },
        resolvedContent: { type: "string" },
        summary: { type: "string" },
      },
    },
    cliMetadata: {
      command: "conflict-parse",
      aliases: ["conflict", "git-conflict"],
      description: "Parse and resolve Git merge conflict markers",
      examples: [
        "codestation conflict-parse path/to/file.ts --strategy analyze",
        "codestation conflict path/to/file.ts --strategy ours",
      ],
    },
    mcpMetadata: {
      toolName: "codestation_git_conflict",
      description: "Parse and resolve Git merge conflict markers (<<<<<<< HEAD, =======, >>>>>>>). [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/conflict-parse",
      slug: "conflict-parse",
    },
    execute: async (input: { content: string; strategy?: ConflictStrategy }) => {
      const strategy = input.strategy || "analyze";
      const res = parseAndResolveGitConflicts(input.content, strategy);
      if (strategy === "analyze") {
        return { report: formatConflictReport(res), ...res };
      }
      return res;
    },
  },

  // 5. JSON to TypeScript Interfaces
  {
    id: "json-to-typescript",
    name: "JSON to TypeScript",
    description: "Generate type-safe TypeScript interfaces and types from sample JSON data.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "typescript", "interfaces", "types", "generator"],
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or payload" },
        rootName: { type: "string", default: "Root", description: "Name of root interface" },
      },
      required: ["json"],
    },
    outputSchema: {
      type: "object",
      properties: { code: { type: "string" } },
    },
    cliMetadata: {
      command: "ts",
      aliases: ["types", "json-to-ts"],
      description: "Generate clean TypeScript interfaces from JSON",
      examples: ['codestation ts \'{"id":1,"name":"Ada"}\' User'],
    },
    mcpMetadata: {
      toolName: "codestation_json_to_typescript",
      description: "Generate clean TypeScript interfaces and types from sample JSON data. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/json-to-typescript",
      slug: "json-to-typescript",
    },
    execute: async (input: { json: string; rootName?: string }) => {
      return jsonToTypescript(input.json, input.rootName || "Root");
    },
  },

  // 6. JSON to Zod Validation Schema
  {
    id: "json-to-zod",
    name: "JSON to Zod",
    description: "Generate production-ready Zod validation schemas and inferred types from sample JSON.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "zod", "schema", "validation", "generator"],
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Sample JSON string or payload" },
        rootName: { type: "string", default: "rootSchema", description: "Name of root schema" },
      },
      required: ["json"],
    },
    outputSchema: {
      type: "object",
      properties: { code: { type: "string" } },
    },
    cliMetadata: {
      command: "zod",
      aliases: ["json-to-zod"],
      description: "Generate production-ready Zod schema from JSON",
      examples: ['codestation zod \'{"id":1,"name":"Ada"}\' userSchema'],
    },
    mcpMetadata: {
      toolName: "codestation_json_to_zod",
      description: "Generate production-ready Zod validation schema and inferred types from sample JSON data. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/json-to-zod",
      slug: "json-to-zod",
    },
    execute: async (input: { json: string; rootName?: string }) => {
      return jsonToZod(input.json, input.rootName || "rootSchema");
    },
  },

  // 7. JWT Decoder
  {
    id: "jwt-decoder",
    name: "JWT Decoder",
    description: "Inspect claims, header, and expiry of JSON Web Tokens in local memory.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Security",
    keywords: ["jwt", "token", "decode", "claims", "header", "auth"],
    inputSchema: {
      type: "object",
      properties: { token: { type: "string", description: "JWT string" } },
      required: ["token"],
    },
    outputSchema: {
      type: "object",
      properties: { header: { type: "object" }, payload: { type: "object" } },
    },
    cliMetadata: {
      command: "jwt",
      aliases: ["jwt-decode"],
      description: "Decode & inspect JWT header, payload, and expiry",
      examples: ["codestation jwt eyJhbGci..."],
    },
    mcpMetadata: {
      toolName: "codestation_jwt_decode",
      description: "Inspect & decode JSON Web Token (JWT) header, payload claims, and signature in local memory. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/jwt-decoder",
      slug: "jwt-decoder",
    },
    execute: async (input: { token: string }) => {
      return JSON.parse(decodeJwt(input.token));
    },
  },

  // 8. SQL Formatter
  {
    id: "sql-formatter",
    name: "SQL Formatter",
    description: "Beautify, indent, and format SQL queries across PostgreSQL, MySQL, SQLite, and Transact-SQL.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "SQL & Database",
    keywords: ["sql", "format", "beautify", "postgres", "mysql", "sqlite"],
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query string" },
        dialect: { type: "string", default: "postgresql", description: "SQL dialect" },
      },
      required: ["sql"],
    },
    outputSchema: {
      type: "object",
      properties: { formatted: { type: "string" } },
    },
    cliMetadata: {
      command: "sql",
      aliases: ["format-sql"],
      description: "Format SQL query across dialects",
      examples: ['codestation sql "SELECT id, name FROM users WHERE active = true;" --dialect postgresql'],
    },
    mcpMetadata: {
      toolName: "codestation_format_sql",
      description: "Format, beautify, and indent SQL queries across PostgreSQL, MySQL, SQLite, and standard SQL. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/sql-formatter",
      slug: "sql-formatter",
    },
    execute: async (input: { sql: string; dialect?: string }) => {
      const { format } = await import("sql-formatter");
      const dialectMap: Record<string, string> = {
        postgresql: "postgresql",
        postgres: "postgresql",
        mysql: "mysql",
        sqlite: "sqlite",
        sqlserver: "transactsql",
      };
      const lang = dialectMap[(input.dialect || "postgresql").toLowerCase()] || "sql";
      return format(input.sql, { language: lang as any, tabWidth: 2 });
    },
  },

  // 9. Cron Explainer
  {
    id: "cron-explain",
    name: "Cron Schedule Explainer",
    description: "Translate 5-field Unix cron expressions into human-readable English and calculate upcoming runtimes.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "Cron",
    keywords: ["cron", "schedule", "explain", "next-run", "unix"],
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "5-field cron expression, e.g. 0 9 * * 1-5" },
      },
      required: ["expression"],
    },
    outputSchema: {
      type: "object",
      properties: {
        expression: { type: "string" },
        explanation: { type: "string" },
      },
    },
    cliMetadata: {
      command: "cron",
      aliases: ["cron-explain"],
      description: "Explain cron schedule and project next 5 runtimes",
      examples: ['codestation cron "0 9 * * 1-5"'],
    },
    mcpMetadata: {
      toolName: "codestation_cron_explain",
      description: "Parse and explain 5-field Unix cron expressions in clear plain English. [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/cron-expression-explainer",
      slug: "cron-expression-explainer",
    },
    execute: async (input: { expression: string }) => {
      const parsed = parseCron(input.expression);
      return {
        expression: input.expression,
        explanation: explainCron(parsed),
      };
    },
  },

  // 10. Cryptographic Hasher
  {
    id: "hash-generator",
    name: "Cryptographic Digest Engine",
    description: "Compute deterministic cryptographic digests (SHA-256, SHA-512, MD5, SHA-1, CRC-32).",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "local-only",
    category: "Security",
    keywords: ["hash", "sha256", "sha512", "md5", "sha1", "crc32", "digest"],
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Input text" },
        algorithm: { type: "string", enum: ["sha256", "sha512", "md5", "sha1", "crc32"], default: "sha256" },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
      properties: { hash: { type: "string" } },
    },
    cliMetadata: {
      command: "hash",
      aliases: ["digest"],
      description: "Compute cryptographic digest (sha256, sha512, md5, sha1, crc32)",
      examples: ['codestation hash "sample text" --alg sha256'],
    },
    mcpMetadata: {
      toolName: "codestation_hash",
      description: "Compute deterministic cryptographic hashes (SHA-256, SHA-512, MD5, SHA-1, CRC-32). [Pro Tier]",
    },
    routeMetadata: {
      route: "/tools/sha-256",
      slug: "sha-256",
    },
    execute: async (input: { text: string; algorithm?: string }) => {
      const alg = (input.algorithm || "sha256").toLowerCase();
      if (alg === "sha256" || alg === "sha-256") return await sha256(input.text);
      if (alg === "sha512" || alg === "sha-512") return await sha512(input.text);
      if (alg === "md5") return md5(input.text);
      if (alg === "sha1" || alg === "sha-1") return sha1(input.text);
      if (alg === "crc32") return crc32(input.text);
      return await sha256(input.text);
    },
  },

  // 11. UUID Generator (Free Tier)
  {
    id: "uuid-generator",
    name: "UUID v4 Generator",
    description: "Generate RFC 4122 v4 cryptographically secure random UUIDs.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "local-only",
    category: "Security",
    keywords: ["uuid", "random", "guid", "v4"],
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "integer", minimum: 1, maximum: 50, default: 1 },
      },
    },
    outputSchema: {
      type: "object",
      properties: { uuids: { type: "array", items: { type: "string" } } },
    },
    cliMetadata: {
      command: "uuid",
      aliases: ["guid"],
      description: "Generate random RFC 4122 v4 UUIDs",
      examples: ["codestation uuid 5"],
    },
    mcpMetadata: {
      toolName: "codestation_uuid",
      description: "Generate cryptographically secure v4 UUIDs. [Free Tier]",
    },
    routeMetadata: {
      route: "/tools/uuid-generator",
      slug: "uuid-generator",
    },
    execute: async (input: { count?: number }) => {
      const count = Math.min(Math.max(input.count || 1, 1), 50);
      return Array.from({ length: count }, () => crypto.randomUUID());
    },
  },

  // 12. JSON Formatter & Minifier (Free Tier)
  {
    id: "json-formatter",
    name: "JSON Formatter & Validator",
    description: "Validate, beautify, indent, or compact raw JSON strings.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "format", "validate", "minify", "beautify"],
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "Raw JSON string" },
        indent: { type: "integer", default: 2 },
      },
      required: ["json"],
    },
    outputSchema: {
      type: "object",
      properties: { formatted: { type: "string" } },
    },
    cliMetadata: {
      command: "json",
      aliases: ["format-json"],
      description: "Validate and pretty-print JSON",
      examples: ['codestation json \'{"k":"v"}\''],
    },
    mcpMetadata: {
      toolName: "codestation_format_json",
      description: "Format, validate, and pretty-print raw JSON with indentation. [Free Tier]",
    },
    routeMetadata: {
      route: "/tools/json-formatter",
      slug: "json-formatter",
    },
    execute: async (input: { json: string; indent?: number }) => {
      return formatJson(input.json, input.indent ?? 2);
    },
  },

  // 13. Base64 Encode / Decode (Free Tier)
  {
    id: "base64-encoder",
    name: "Base64 Encode / Decode",
    description: "Encode UTF-8 text to Base64 or URL-safe Base64 and decode back.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "Encoding",
    keywords: ["base64", "encode", "decode", "base64url"],
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, action: { type: "string", enum: ["encode", "decode"] }, urlSafe: { type: "boolean" } },
      required: ["text", "action"],
    },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: {
      command: "base64",
      aliases: ["b64"],
      description: "Encode or decode Base64 text",
      examples: ['codestation base64 "hello"'],
    },
    mcpMetadata: {
      toolName: "codestation_base64",
      description: "Encode or decode Base64 and URL-safe Base64 strings. [Free Tier]",
    },
    routeMetadata: { route: "/tools/base64-encoder", slug: "base64-encoder" },
    execute: async (input: { text: string; action: "encode" | "decode"; urlSafe?: boolean }) =>
      input.action === "encode"
        ? input.urlSafe ? encodeBase64Url(input.text) : Buffer.from(input.text, "utf-8").toString("base64")
        : input.urlSafe ? decodeBase64Url(input.text) : Buffer.from(input.text, "base64").toString("utf-8"),
  },

  // 14. URL Codec (Free Tier)
  {
    id: "url-encoder",
    name: "URL Component Codec",
    description: "Encode or decode URI string components locally.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "Encoding",
    keywords: ["url", "uri", "percent-encode"],
    inputSchema: { type: "object", properties: { text: { type: "string" }, action: { type: "string", enum: ["encode", "decode"] } }, required: ["text", "action"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "url-codec", aliases: [], description: "URL encode or decode strings", examples: [] },
    mcpMetadata: { toolName: "codestation_url_codec", description: "URL encode or decode string components. [Free Tier]" },
    routeMetadata: { route: "/tools/url-encoder", slug: "url-encoder" },
    execute: async (input: { text: string; action: "encode" | "decode" }) =>
      input.action === "encode" ? encodeUrlComponent(input.text) : decodeUrlComponent(input.text),
  },

  // 15. Hexadecimal Codec (Free Tier)
  {
    id: "hexadecimal-encoder",
    name: "Hexadecimal Codec",
    description: "Encode UTF-8 text to hexadecimal byte pairs or decode hex back to text.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "Encoding",
    keywords: ["hex", "hexadecimal", "bytes"],
    inputSchema: { type: "object", properties: { text: { type: "string" }, action: { type: "string", enum: ["encode", "decode"] } }, required: ["text", "action"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "hex-codec", aliases: [], description: "Hex encode or decode text", examples: [] },
    mcpMetadata: { toolName: "codestation_hex_codec", description: "Encode UTF-8 string to hexadecimal byte pairs or decode hex to text. [Free Tier]" },
    routeMetadata: { route: "/tools/hexadecimal-encoder", slug: "hexadecimal-encoder" },
    execute: async (input: { text: string; action: "encode" | "decode" }) =>
      input.action === "encode" ? encodeHexadecimal(input.text) : decodeHexadecimal(input.text),
  },

  // 16. JSON Minifier (Free Tier)
  {
    id: "json-minifier",
    name: "JSON Minifier",
    description: "Minify JSON by stripping all whitespace.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "minify", "compact"],
    inputSchema: { type: "object", properties: { json: { type: "string" } }, required: ["json"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "minify-json", aliases: [], description: "Minify JSON", examples: [] },
    mcpMetadata: { toolName: "codestation_minify_json", description: "Minify JSON by stripping all whitespace. [Free Tier]" },
    routeMetadata: { route: "/tools/json-minifier", slug: "json-minifier" },
    execute: async (input: { json: string }) => minifyJson(input.json),
  },

  // 17. JSON to YAML (Free Tier)
  {
    id: "json-to-yaml",
    name: "JSON to YAML Converter",
    description: "Convert JSON to clean YAML format.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "yaml", "convert"],
    inputSchema: { type: "object", properties: { json: { type: "string" } }, required: ["json"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "json-to-yaml", aliases: [], description: "Convert JSON to YAML", examples: [] },
    mcpMetadata: { toolName: "codestation_json_to_yaml", description: "Convert JSON to clean YAML format. [Free Tier]" },
    routeMetadata: { route: "/tools/json-to-yaml", slug: "json-to-yaml" },
    execute: async (input: { json: string }) => jsonToYaml(input.json),
  },

  // 18. YAML to JSON (Free Tier)
  {
    id: "yaml-to-json",
    name: "YAML to JSON Converter",
    description: "Convert YAML formatted text to JSON.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["yaml", "json", "convert"],
    inputSchema: { type: "object", properties: { yaml: { type: "string" } }, required: ["yaml"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "yaml-to-json", aliases: [], description: "Convert YAML to JSON", examples: [] },
    mcpMetadata: { toolName: "codestation_yaml_to_json", description: "Convert YAML formatted text to JSON. [Free Tier]" },
    routeMetadata: { route: "/tools/yaml-to-json", slug: "yaml-to-json" },
    execute: async (input: { yaml: string }) => yamlToJson(input.yaml),
  },

  // 19. Case Converter (Free Tier)
  {
    id: "text-case-converter",
    name: "Case Converter",
    description: "Convert text between camelCase, snake_case, kebab-case, PascalCase, and CONSTANT_CASE.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "Text",
    keywords: ["case", "camel", "snake", "kebab", "pascal"],
    inputSchema: { type: "object", properties: { text: { type: "string" }, targetCase: { type: "string" } }, required: ["text", "targetCase"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "case-convert", aliases: [], description: "Convert naming conventions", examples: [] },
    mcpMetadata: { toolName: "codestation_case_convert", description: "Convert text into different naming conventions. [Free Tier]" },
    routeMetadata: { route: "/tools/text-case-converter", slug: "text-case-converter" },
    execute: async (input: { text: string; targetCase: TextCase }) => convertCase(input.text, input.targetCase),
  },

  // 20. Unified Text Diff (Free Tier)
  {
    id: "text-diff",
    name: "Unified Text Diff",
    description: "Generate a clean line-by-line unified diff between original and modified text.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "Text",
    keywords: ["diff", "compare", "unified", "patch"],
    inputSchema: { type: "object", properties: { original: { type: "string" }, modified: { type: "string" } }, required: ["original", "modified"] },
    outputSchema: { type: "object", properties: { diff: { type: "string" } } },
    cliMetadata: { command: "diff", aliases: ["text-diff"], description: "Compute unified line diff", examples: [] },
    mcpMetadata: { toolName: "codestation_text_diff", description: "Generate a clean line-by-line unified diff between original and modified text. [Free Tier]" },
    routeMetadata: { route: "/tools/text-diff", slug: "text-diff" },
    execute: async (input: { original: string; modified: string }) => diffText(input.original, input.modified),
  },

  // 21. Slugify (Free Tier)
  {
    id: "slug-generator",
    name: "Slug Generator",
    description: "Convert strings to clean URL slugs.",
    version: "1.2.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "Text",
    keywords: ["slug", "url", "kebab"],
    inputSchema: { type: "object", properties: { text: { type: "string" }, separator: { type: "string" } }, required: ["text"] },
    outputSchema: { type: "object", properties: { slug: { type: "string" } } },
    cliMetadata: { command: "slugify", aliases: [], description: "Generate URL-safe slugs", examples: [] },
    mcpMetadata: { toolName: "codestation_slugify", description: "Convert strings to clean, SEO-friendly URL slugs. [Free Tier]" },
    routeMetadata: { route: "/tools/slug-generator", slug: "slug-generator" },
    execute: async (input: { text: string; separator?: string }) => slugify(input.text, input.separator ?? "-"),
  },

  // 22. Structural JSON Diff (Free Tier)
  {
    id: "json-diff",
    name: "JSON Diff",
    description: "Compute a structural key-by-key diff between two JSON documents.",
    version: "1.3.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json", "diff", "compare", "structural"],
    inputSchema: { type: "object", properties: { left: { type: "string" }, right: { type: "string" } }, required: ["left", "right"] },
    outputSchema: { type: "object", properties: { diff: { type: "string" } } },
    cliMetadata: { command: "json-diff", aliases: ["jdiff"], description: "Compare two JSON documents structurally", examples: ['codestation json-diff \'{"a":1}\' \'{"a":2}\''] },
    mcpMetadata: { toolName: "codestation_json_diff", description: "Compute a structural key-by-key diff between two JSON documents. [Free Tier]" },
    routeMetadata: { route: "/tools/json-diff", slug: "json-diff" },
    execute: async (input: { left: string; right: string }) => jsonDiff(input.left, input.right),
  },

  // 23. JSONPath Query Extractor (Free Tier)
  {
    id: "jsonpath-tester",
    name: "JSONPath Query Extractor",
    description: "Evaluate JSONPath expressions ($.property, $[0], $[*]) against JSON payloads.",
    version: "1.3.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["jsonpath", "query", "extract", "json"],
    inputSchema: { type: "object", properties: { json: { type: "string" }, expression: { type: "string" } }, required: ["json", "expression"] },
    outputSchema: { type: "object", properties: { matches: { type: "string" } } },
    cliMetadata: { command: "jsonpath", aliases: ["json-path"], description: "Extract values using JSONPath", examples: ['codestation jsonpath \'{"users":[{"name":"Ada"}]}\' "$.users[*].name"'] },
    mcpMetadata: { toolName: "codestation_json_path", description: "Query and extract values from JSON using JSONPath expressions ($.field, $[0], $[*]). [Free Tier]" },
    routeMetadata: { route: "/tools/jsonpath-tester", slug: "jsonpath-tester" },
    execute: async (input: { json: string; expression: string }) => testJsonPath(input.json, input.expression),
  },

  // 24. ULID Generator (Free Tier)
  {
    id: "ulid-generator",
    name: "ULID Generator",
    description: "Generate Crockford Base32 lexicographically sortable ULIDs.",
    version: "1.3.0",
    accessLevel: "free",
    privacyClassification: "local-only",
    category: "Security",
    keywords: ["ulid", "id", "sortable", "unique"],
    inputSchema: { type: "object", properties: { count: { type: "integer", minimum: 1, maximum: 50 } } },
    outputSchema: { type: "object", properties: { ulids: { type: "string" } } },
    cliMetadata: { command: "ulid", aliases: [], description: "Generate sortable ULIDs", examples: ["codestation ulid 5"] },
    mcpMetadata: { toolName: "codestation_ulid", description: "Generate lexicographically sortable ULID identifiers. [Free Tier]" },
    routeMetadata: { route: "/tools/ulid-generator", slug: "ulid-generator" },
    execute: async (input: { count?: number }) => Array.from({ length: Math.min(Math.max(input.count ?? 1, 1), 50) }, () => ulid()).join("\n"),
  },

  // 25. NanoID Generator (Free Tier)
  {
    id: "nanoid-generator",
    name: "NanoID Generator",
    description: "Generate URL-safe cryptographic NanoID strings.",
    version: "1.3.0",
    accessLevel: "free",
    privacyClassification: "local-only",
    category: "Security",
    keywords: ["nanoid", "id", "token"],
    inputSchema: { type: "object", properties: { length: { type: "integer" }, count: { type: "integer" } } },
    outputSchema: { type: "object", properties: { ids: { type: "string" } } },
    cliMetadata: { command: "nanoid", aliases: [], description: "Generate compact NanoIDs", examples: ["codestation nanoid --length 16"] },
    mcpMetadata: { toolName: "codestation_nanoid", description: "Generate URL-safe cryptographic NanoID strings with custom length. [Free Tier]" },
    routeMetadata: { route: "/tools/nanoid-generator", slug: "nanoid-generator" },
    execute: async (input: { length?: number; count?: number }) => Array.from({ length: input.count ?? 1 }, () => nanoid(input.length ?? 21)).join("\n"),
  },

  // 26. HTML Entity Codec (Free Tier)
  {
    id: "html-entity-encoder",
    name: "HTML Entity Codec",
    description: "Escape or unescape HTML entities (&lt;, &gt;, &amp;, numeric codes).",
    version: "1.3.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "Encoding",
    keywords: ["html", "entity", "escape", "unescape"],
    inputSchema: { type: "object", properties: { text: { type: "string" }, action: { type: "string", enum: ["encode", "decode"] } }, required: ["text", "action"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "html-codec", aliases: [], description: "Encode or decode HTML entities", examples: [] },
    mcpMetadata: { toolName: "codestation_html_codec", description: "Encode or decode HTML character entities safely. [Free Tier]" },
    routeMetadata: { route: "/tools/html-entity-encoder", slug: "html-entity-encoder" },
    execute: async (input: { text: string; action: "encode" | "decode" }) =>
      input.action === "encode" ? encodeHtml(input.text) : decodeHtml(input.text),
  },

  // 27. CSV <-> JSON Converter (Free Tier)
  {
    id: "csv-to-json",
    name: "CSV <-> JSON Converter",
    description: "Convert CSV tables with header rows to JSON arrays or JSON arrays to CSV.",
    version: "1.3.0",
    accessLevel: "free",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["csv", "json", "table", "convert"],
    inputSchema: { type: "object", properties: { input: { type: "string" }, direction: { type: "string", enum: ["csv-to-json", "json-to-csv"] } }, required: ["input", "direction"] },
    outputSchema: { type: "object", properties: { output: { type: "string" } } },
    cliMetadata: { command: "csv-json", aliases: [], description: "Convert between CSV and JSON", examples: [] },
    mcpMetadata: { toolName: "codestation_csv_json", description: "Convert CSV tables to JSON or JSON arrays of objects to CSV. [Free Tier]" },
    routeMetadata: { route: "/tools/csv-to-json", slug: "csv-to-json" },
    execute: async (input: { input: string; direction: "csv-to-json" | "json-to-csv" }) =>
      input.direction === "csv-to-json" ? csvToJson(input.input) : jsonToCsv(input.input),
  },

  // 28. HMAC Signature Generator (Pro Tier)
  {
    id: "hmac-generator",
    name: "HMAC Signature Generator",
    description: "Compute HMAC-SHA256 or HMAC-SHA512 message signatures.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "Security",
    keywords: ["hmac", "signature", "sha256", "sha512"],
    inputSchema: { type: "object", properties: { text: { type: "string" }, secret: { type: "string" }, algorithm: { type: "string" } }, required: ["text", "secret"] },
    outputSchema: { type: "object", properties: { signature: { type: "string" } } },
    cliMetadata: { command: "hmac", aliases: [], description: "Compute HMAC signature", examples: [] },
    mcpMetadata: { toolName: "codestation_hmac", description: "Compute HMAC signatures using Web Crypto. [Pro Tier: ₹199/mo or $2.99/mo]" },
    routeMetadata: { route: "/tools/hmac-generator", slug: "hmac-generator" },
    execute: async (input: { text: string; secret: string; algorithm?: string }) =>
      input.algorithm?.toUpperCase() === "SHA-512" ? hmacSha512(input.text, input.secret) : hmacSha256(input.text, input.secret),
  },

  // 29. IANA Timezone Converter (Pro Tier)
  {
    id: "timezone-converter",
    name: "IANA Timezone Converter",
    description: "Convert timestamps across runtime IANA timezones.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "Date & Time",
    keywords: ["timezone", "iana", "dst", "date"],
    inputSchema: { type: "object", properties: { dateTime: { type: "string" }, sourceTimeZone: { type: "string" }, targetTimeZone: { type: "string" } }, required: ["dateTime", "sourceTimeZone", "targetTimeZone"] },
    outputSchema: { type: "object", properties: { converted: { type: "string" } } },
    cliMetadata: { command: "tz", aliases: [], description: "Convert IANA timezones", examples: [] },
    mcpMetadata: { toolName: "codestation_timezone_convert", description: "Convert a date/time string between IANA timezones. [Pro Tier: ₹199/mo or $2.99/mo]" },
    routeMetadata: { route: "/tools/timezone-converter", slug: "timezone-converter" },
    execute: async (input: { dateTime: string; sourceTimeZone: string; targetTimeZone: string }) =>
      convertBetweenTimeZones(input.dateTime, input.sourceTimeZone, input.targetTimeZone),
  },

  // 30. Business Days Calculator (Pro Tier)
  {
    id: "business-days-calculator",
    name: "Business Days Calculator",
    description: "Calculate working days between two dates.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "Date & Time",
    keywords: ["business days", "weekends", "date"],
    inputSchema: { type: "object", properties: { startDate: { type: "string" }, endDate: { type: "string" } }, required: ["startDate", "endDate"] },
    outputSchema: { type: "object", properties: { days: { type: "number" } } },
    cliMetadata: { command: "business-days", aliases: [], description: "Count working days between dates", examples: [] },
    mcpMetadata: { toolName: "codestation_business_days", description: "Calculate exact working/business days between two dates. [Pro Tier: ₹199/mo or $2.99/mo]" },
    routeMetadata: { route: "/tools/business-days-calculator", slug: "business-days-calculator" },
    execute: async (input: { startDate: string; endDate: string }) => businessDaysBetween(input.startDate, input.endDate),
  },

  // 31. Regex Tester (Pro Tier)
  {
    id: "regex-match-inspector",
    name: "Regex Match Tester",
    description: "Test JavaScript regular expressions and inspect match groups.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "Regex",
    keywords: ["regex", "regexp", "match", "groups"],
    inputSchema: { type: "object", properties: { pattern: { type: "string" }, text: { type: "string" }, flags: { type: "string" } }, required: ["pattern", "text"] },
    outputSchema: { type: "object", properties: { matches: { type: "string" } } },
    cliMetadata: { command: "regex", aliases: [], description: "Test regex against text", examples: [] },
    mcpMetadata: { toolName: "codestation_regex_test", description: "Test regular expressions and return structured match groups. [Pro Tier: ₹199/mo or $2.99/mo]" },
    routeMetadata: { route: "/tools/regex-match-inspector", slug: "regex-match-inspector" },
    execute: async (input: { pattern: string; text: string; flags?: string }) => testRegex(input.pattern, input.flags ?? "g", input.text),
  },

  // 32. JSON Schema Generator (Pro Tier)
  {
    id: "json-schema-generator",
    name: "JSON Schema Generator",
    description: "Infer Draft 2020-12 JSON Schema from sample JSON.",
    version: "1.2.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "JSON & Data",
    keywords: ["json schema", "draft 2020-12", "infer"],
    inputSchema: { type: "object", properties: { json: { type: "string" } }, required: ["json"] },
    outputSchema: { type: "object", properties: { schema: { type: "string" } } },
    cliMetadata: { command: "json-schema", aliases: [], description: "Infer JSON Schema", examples: [] },
    mcpMetadata: { toolName: "codestation_json_schema", description: "Infer a Draft 2020-12 JSON Schema structure from sample JSON. [Pro Tier: ₹199/mo or $2.99/mo]" },
    routeMetadata: { route: "/tools/json-schema-generator", slug: "json-schema-generator" },
    execute: async (input: { json: string }) => generateJsonSchema(input.json),
  },

  // 33. Cron Next Run Calculator (Pro Tier)
  {
    id: "cron-next-run",
    name: "Cron Next Run Calculator",
    description: "Compute upcoming cron execution timestamps in any IANA timezone.",
    version: "1.3.0",
    accessLevel: "pro",
    privacyClassification: "memory-only",
    category: "Cron",
    keywords: ["cron", "schedule", "next run", "timezone"],
    inputSchema: { type: "object", properties: { expression: { type: "string" }, count: { type: "integer" }, timeZone: { type: "string" }, startFrom: { type: "string" } }, required: ["expression"] },
    outputSchema: { type: "object", properties: { runs: { type: "array" } } },
    cliMetadata: { command: "cron-next", aliases: [], description: "List next cron execution times", examples: ['codestation cron "0 9 * * 1-5"'] },
    mcpMetadata: { toolName: "codestation_cron_next_runs", description: "Calculate upcoming cron run timestamps in a chosen IANA timezone. [Pro Tier: ₹199/mo or $2.99/mo]" },
    routeMetadata: { route: "/tools/cron-next-run", slug: "cron-next-run" },
    execute: async (input: { expression: string; count?: number; timeZone?: string; startFrom?: string }) => {
      const parsed = parseCron(input.expression);
      let cursor = input.startFrom ?? new Date().toISOString();
      const runs = [];
      const limit = Math.min(Math.max(input.count ?? 5, 1), 20);
      for (let i = 0; i < limit; i += 1) {
        const next = nextCronRun(parsed, cursor, input.timeZone ?? "UTC");
        runs.push(next.dateTime);
        cursor = new Date(next.instant).toISOString();
      }
      return runs;
    },
  },
];

export function getSharedTool(idOrAlias: string): SharedToolDefinition | undefined {
  const norm = idOrAlias.toLowerCase().trim();
  return SHARED_TOOLS.find(
    (t) =>
      t.id.toLowerCase() === norm ||
      t.mcpMetadata.toolName.toLowerCase() === norm ||
      t.cliMetadata.command.toLowerCase() === norm ||
      t.cliMetadata.aliases.some((a) => a.toLowerCase() === norm)
  );
}
