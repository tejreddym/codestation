import { curlToCode, type CurlTargetLanguage } from "../lib/tools/curl-to-code";
import { auditEnv, formatEnvAuditReport, type EnvAuditResult } from "../lib/tools/env-audit";
import { generateMockDataset, type MockDataOptions } from "../lib/tools/mock-data";
import { parseAndResolveGitConflicts, formatConflictReport, type ConflictStrategy } from "../lib/tools/git-conflict";
import { decodeJwt, formatJson, minifyJson, jsonToYaml, yamlToJson, generateJsonSchema, testRegex } from "../lib/tools/index";
import { md5, sha1, sha256, sha512, crc32 } from "../lib/tools/security-station";
import { jsonToTypescript, jsonToZod } from "../lib/tools/json-to-types";
import { convertBetweenTimeZones, businessDaysBetween } from "../lib/tools/date-time-station";
import { parseCron } from "../lib/tools/cron/parser";
import { explainCron } from "../lib/tools/cron/explain";
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
    category: "Security & Crypto",
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
    category: "Text",
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
    category: "Security & Crypto",
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
    category: "Security & Crypto",
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
    category: "Security & Crypto",
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
