import * as fs from "node:fs";
import { decodeJwt, formatJson } from "../lib/tools/index";
import { parseCron } from "../lib/tools/cron/parser";
import { explainCron } from "../lib/tools/cron/explain";
import { nextCronRun } from "../lib/tools/cron/engine";
import { md5, sha1, sha256, sha512, crc32 } from "../lib/tools/security-station";
import { jsonToTypescript, jsonToZod } from "../lib/tools/json-to-types";
import { curlToCode, type CurlTargetLanguage } from "../lib/tools/curl-to-code";
import { auditEnv, formatEnvAuditReport } from "../lib/tools/env-audit";
import { generateMockDataset, type MockTemplate, type SqlDialect } from "../lib/tools/mock-data";
import { parseAndResolveGitConflicts, formatConflictReport, type ConflictStrategy } from "../lib/tools/git-conflict";
import { resolveLicense } from "./config";
import { SHARED_TOOLS } from "../config/shared-registry";

export interface CliExecutionResult {
  handled: boolean;
  exitCode: number;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

async function readInput(arg?: string): Promise<string> {
  // If argument is provided and not a flag or "-"
  if (arg && arg !== "-" && !arg.startsWith("-")) {
    if (fs.existsSync(arg)) {
      return fs.readFileSync(arg, "utf-8");
    }
    return arg;
  }

  // Read from stdin if piped
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data.trim()));
      process.stdin.on("error", reject);
    });
  }

  return "";
}

export async function handleCliSubcommand(command: string, args: string[]): Promise<CliExecutionResult> {
  const isNoColor = args.includes("--no-color") || process.env.NO_COLOR !== undefined;
  const isJson = args.includes("--json");
  const isHelp = args.includes("--help") || args.includes("-h");

  const out = (text: string) => {
    process.stdout.write(isNoColor ? stripAnsi(text) : text);
  };

  const err = (text: string) => {
    process.stderr.write(isNoColor ? stripAnsi(text) : text);
  };

  const cmd = command.toLowerCase();

  switch (cmd) {
    // -------------------------------------------------------------
    // STATUS
    // -------------------------------------------------------------
    case "status": {
      if (isHelp) {
        out("Usage: codestation status [--json] [--no-color]\nView Code Station license tier, active tools, and local MCP readiness.\n");
        return { handled: true, exitCode: 0 };
      }
      const license = resolveLicense();
      if (isJson) {
        out(
          JSON.stringify(
            {
              name: "Code Station",
              version: "1.2.0",
              license: {
                tier: license.tier,
                isPro: license.isPro,
                keyConfigured: Boolean(license.licenseKey),
              },
              toolCount: SHARED_TOOLS.length,
              privacy: "local-only",
              mcpReady: true,
            },
            null,
            2
          ) + "\n"
        );
      } else {
        out("\n=== CODE STATION STATUS ===\n");
        out("Version:     1.2.0\n");
        out(`License:     ${license.isPro ? "PRO TIER (Active)" : "FREE TIER (Pro key not active)"}\n`);
        out(`Tools:       ${SHARED_TOOLS.length} registered tools across Web, CLI & MCP\n`);
        out("MCP Server:  Ready (Stdio transport)\n");
        out("Privacy:     Zero telemetry, memory-only execution\n\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // cURL to Any Language Generator
    // -------------------------------------------------------------
    case "curl":
    case "curl-to-code":
    case "curl-to-any-language": {
      if (isHelp) {
        out("Usage: codestation curl-to-any-language \"<curl_command>\" [--target fetch|axios|python|go] [--json]\n");
        return { handled: true, exitCode: 0 };
      }
      const rawArg = args.find((a) => !a.startsWith("-"));
      const input = await readInput(rawArg);

      if (!input || !input.trim()) {
        err("Error: cURL command is required (provide as argument or via stdin).\n");
        return { handled: true, exitCode: 1 };
      }

      let target: CurlTargetLanguage = "fetch";
      const targetIdx = args.indexOf("--target");
      if (targetIdx !== -1 && args[targetIdx + 1]) {
        target = args[targetIdx + 1].toLowerCase() as CurlTargetLanguage;
      }

      try {
        const res = await curlToCode(input, target);
        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else {
          out(res.code + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // Environment & Secret Leak Scanner
    // -------------------------------------------------------------
    case "env":
    case "audit-env":
    case "env-audit": {
      if (isHelp) {
        out("Usage: codestation env-audit [path/.env] [--example path/.env.example] [--json]\n");
        return { handled: true, exitCode: 0 };
      }

      let envContent = "";
      let envPath: string | undefined;

      const pathArg = args.find((a) => !a.startsWith("-"));
      if (pathArg && fs.existsSync(pathArg)) {
        envPath = pathArg;
        envContent = fs.readFileSync(pathArg, "utf-8");
      } else if (pathArg) {
        envContent = pathArg;
      } else if (fs.existsSync(".env")) {
        envPath = ".env";
        envContent = fs.readFileSync(".env", "utf-8");
      } else {
        envContent = await readInput();
      }

      if (!envContent || !envContent.trim()) {
        err("Error: No environment file or content provided to scan.\n");
        return { handled: true, exitCode: 1 };
      }

      let exampleContent: string | undefined;
      const exIdx = args.indexOf("--example");
      if (exIdx !== -1 && args[exIdx + 1] && fs.existsSync(args[exIdx + 1])) {
        exampleContent = fs.readFileSync(args[exIdx + 1], "utf-8");
      } else if (fs.existsSync(".env.example")) {
        exampleContent = fs.readFileSync(".env.example", "utf-8");
      }

      try {
        const res = auditEnv(envContent, { example: exampleContent, filePath: envPath });
        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else {
          out(formatEnvAuditReport(res) + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // Mock Data & SQL Seeder
    // -------------------------------------------------------------
    case "mock":
    case "seeder":
    case "mock-data": {
      if (isHelp) {
        out("Usage: codestation mock-data [users|products|orders|custom] [--count <n>] [--format json|sql|csv] [--seed <n>]\n");
        return { handled: true, exitCode: 0 };
      }

      let template: MockTemplate = "users";
      const tmplArg = args.find((a) => !a.startsWith("-"));
      if (tmplArg && ["users", "products", "orders", "custom"].includes(tmplArg.toLowerCase())) {
        template = tmplArg.toLowerCase() as MockTemplate;
      }

      let count = 10;
      const countIdx = args.indexOf("--count");
      if (countIdx !== -1 && args[countIdx + 1]) {
        count = parseInt(args[countIdx + 1], 10);
      }

      let format: "json" | "sql" | "csv" = "json";
      if (args.includes("--sql")) format = "sql";
      else if (args.includes("--csv")) format = "csv";
      const formatIdx = args.indexOf("--format");
      if (formatIdx !== -1 && args[formatIdx + 1]) {
        format = args[formatIdx + 1].toLowerCase() as any;
      }

      let tableName: string | undefined;
      const tableIdx = args.indexOf("--table");
      if (tableIdx !== -1 && args[tableIdx + 1]) {
        tableName = args[tableIdx + 1];
      }

      let dialect: SqlDialect = "postgresql";
      const dialectIdx = args.indexOf("--dialect");
      if (dialectIdx !== -1 && args[dialectIdx + 1]) {
        dialect = args[dialectIdx + 1].toLowerCase() as any;
      }

      let seed: number | undefined;
      const seedIdx = args.indexOf("--seed");
      if (seedIdx !== -1 && args[seedIdx + 1]) {
        seed = parseInt(args[seedIdx + 1], 10);
      }

      try {
        const res = generateMockDataset({
          template,
          count,
          format,
          tableName,
          dialect,
          seed,
        });

        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else if (format === "sql") {
          out((res.sql || res.json) + "\n");
        } else if (format === "csv") {
          out((res.csv || res.json) + "\n");
        } else {
          out(res.json + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // Git Merge Conflict Resolver
    // -------------------------------------------------------------
    case "conflict":
    case "git-conflict":
    case "conflict-parse": {
      if (isHelp) {
        out("Usage: codestation conflict-parse <file_or_content> [--strategy analyze|ours|theirs|both] [--json]\n");
        return { handled: true, exitCode: 0 };
      }

      const fileArg = args.find((a) => !a.startsWith("-"));
      const input = await readInput(fileArg);

      if (!input || !input.trim()) {
        err("Error: Conflict file path or content required.\n");
        return { handled: true, exitCode: 1 };
      }

      let strategy: ConflictStrategy = "analyze";
      const stratIdx = args.indexOf("--strategy");
      if (stratIdx !== -1 && args[stratIdx + 1]) {
        strategy = args[stratIdx + 1].toLowerCase() as ConflictStrategy;
      }

      try {
        const res = parseAndResolveGitConflicts(input, strategy);
        if (isJson) {
          out(JSON.stringify(res, null, 2) + "\n");
        } else if (strategy === "analyze") {
          out(formatConflictReport(res) + "\n");
        } else {
          out((res.resolvedContent ?? input) + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // JWT Decoder
    // -------------------------------------------------------------
    case "jwt": {
      if (isHelp) {
        out("Usage: codestation jwt <token> [--json]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JWT token required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const decoded = JSON.parse(decodeJwt(input));
        if (isJson) {
          out(JSON.stringify(decoded, null, 2) + "\n");
        } else {
          out("\n=== JWT HEADER ===\n" + JSON.stringify(decoded.header, null, 2) + "\n");
          out("\n=== JWT PAYLOAD ===\n" + JSON.stringify(decoded.payload, null, 2) + "\n\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // SQL Formatter
    // -------------------------------------------------------------
    case "sql": {
      if (isHelp) {
        out("Usage: codestation sql \"<query>\" [--dialect postgresql|mysql|sqlite]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: SQL query required.\n");
        return { handled: true, exitCode: 1 };
      }
      let dialect = "postgresql";
      const dialectIdx = args.indexOf("--dialect");
      if (dialectIdx !== -1 && args[dialectIdx + 1]) {
        dialect = args[dialectIdx + 1].toLowerCase();
      }
      try {
        const { format } = await import("sql-formatter");
        const formatted = format(input, { language: dialect as any, tabWidth: 2 });
        out(formatted + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // Cron Explainer
    // -------------------------------------------------------------
    case "cron": {
      if (isHelp) {
        out("Usage: codestation cron \"<expression>\" [--json]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = args.filter((a) => !a.startsWith("-")).join(" ").trim();
      if (!input) {
        err("Error: Cron expression required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const parsed = parseCron(input);
        const explanation = explainCron(parsed);
        const next = nextCronRun(parsed, new Date().toISOString(), "UTC");
        if (isJson) {
          out(JSON.stringify({ expression: input, description: explanation, nextRun: next.dateTime }, null, 2) + "\n");
        } else {
          out(`\nExpression:  ${input}\nDescription: ${explanation}\nNext run:    ${next.dateTime} (${next.duration})\n\n`);
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // Hasher
    // -------------------------------------------------------------
    case "hash": {
      if (isHelp) {
        out("Usage: codestation hash \"<text>\" [--alg sha256|sha512|md5|sha1|crc32]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: Text required to hash.\n");
        return { handled: true, exitCode: 1 };
      }
      let alg = "sha256";
      const algIdx = args.indexOf("--alg");
      if (algIdx !== -1 && args[algIdx + 1]) {
        alg = args[algIdx + 1].toLowerCase();
      }
      try {
        let result = "";
        if (alg === "sha256") result = await sha256(input);
        else if (alg === "sha512") result = await sha512(input);
        else if (alg === "md5") result = md5(input);
        else if (alg === "sha1") result = sha1(input);
        else if (alg === "crc32") result = crc32(input);
        else result = await sha256(input);

        if (isJson) {
          out(JSON.stringify({ algorithm: alg, digest: result }, null, 2) + "\n");
        } else {
          out(`${alg.toUpperCase()}: ${result}\n`);
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // JSON to TypeScript Interfaces
    // -------------------------------------------------------------
    case "ts":
    case "types": {
      if (isHelp) {
        out("Usage: codestation ts \"<json_payload>\" [RootName]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JSON input required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const rootName = args[1] || "Root";
        out(jsonToTypescript(input, rootName) + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // JSON to Zod Schema
    // -------------------------------------------------------------
    case "zod": {
      if (isHelp) {
        out("Usage: codestation zod \"<json_payload>\" [rootSchema]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JSON input required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const rootName = args[1] || "rootSchema";
        out(jsonToZod(input, rootName) + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // UUID Generator
    // -------------------------------------------------------------
    case "uuid": {
      if (isHelp) {
        out("Usage: codestation uuid [count]\n");
        return { handled: true, exitCode: 0 };
      }
      const count = Math.min(Math.max(parseInt(args[0], 10) || 1, 1), 100);
      for (let i = 0; i < count; i++) {
        out(crypto.randomUUID() + "\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // JSON Formatter
    // -------------------------------------------------------------
    case "json": {
      if (isHelp) {
        out("Usage: codestation json \"<raw_json>\"\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: JSON input required.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        out(formatJson(input, 2) + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    default:
      return { handled: false, exitCode: 0 };
  }
}
