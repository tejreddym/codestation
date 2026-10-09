import * as fs from "node:fs";
import { decodeJwt, formatJson } from "../lib/tools/index";
import { runSql } from "../lib/tools/sql/engine";
import { parseCron } from "../lib/tools/cron/parser";
import { explainCron } from "../lib/tools/cron/explain";
import { nextCronRun } from "../lib/tools/cron/engine";
import { md5, sha1, sha256, sha512, crc32 } from "../lib/tools/security-station";
import { jsonToTypescript, jsonToZod } from "../lib/tools/json-to-types";

async function readInput(arg?: string): Promise<string> {
  if (arg && arg !== "-") {
    // Check if it's a file path that exists
    if (fs.existsSync(arg)) {
      return fs.readFileSync(arg, "utf-8");
    }
    return arg;
  }

  // Read from stdin if available
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

export async function handleCliSubcommand(command: string, args: string[]): Promise<boolean> {
  switch (command.toLowerCase()) {
    case "jwt": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp jwt <jwt_token>\n");
        return true;
      }
      try {
        const decoded = JSON.parse(decodeJwt(input));
        process.stdout.write("\n=== JWT HEADER ===\n");
        process.stdout.write(JSON.stringify(decoded.header, null, 2) + "\n");
        process.stdout.write("\n=== JWT PAYLOAD ===\n");
        process.stdout.write(JSON.stringify(decoded.payload, null, 2) + "\n");

        if (decoded.payload.exp) {
          const expDate = new Date(decoded.payload.exp * 1000);
          const isExpired = Date.now() > expDate.getTime();
          process.stdout.write(
            `\nExpiry: ${expDate.toISOString()} (${isExpired ? "EXPIRED" : "Valid until " + expDate.toLocaleString()})\n\n`
          );
        }
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      return true;
    }

    case "sql": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp sql \"<query>\" [--dialect postgresql|mysql|sqlite|sqlserver]\n");
        return true;
      }
      let dialect = "postgresql";
      const dialectIdx = args.indexOf("--dialect");
      if (dialectIdx !== -1 && args[dialectIdx + 1]) {
        dialect = args[dialectIdx + 1].toLowerCase();
      }
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
      try {
        const { format } = await import("sql-formatter");
        const formatted = format(input, { language: lang as any, tabWidth: 2 });
        process.stdout.write(formatted + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      return true;
    }

    case "cron": {
      const input = args.join(" ").replace(/--key\s+[^\s]+/g, "").trim();
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp cron \"<cron_expression>\"\nExample: npx codestation-mcp cron \"0 9 * * 1-5\"\n");
        return true;
      }
      try {
        const parsed = parseCron(input);
        const explanation = explainCron(parsed);
        const next = nextCronRun(parsed, new Date().toISOString(), "UTC");
        process.stdout.write(`\nExpression:  ${input}\n`);
        process.stdout.write(`Description: ${explanation}\n`);
        process.stdout.write(`Next run:    ${next.dateTime} (${next.duration})\n\n`);
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      return true;
    }

    case "hash": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp hash \"<string>\" [--alg sha256|sha512|md5|sha1|crc32]\n");
        return true;
      }
      let alg = "sha256";
      const algIdx = args.indexOf("--alg");
      if (algIdx !== -1 && args[algIdx + 1]) {
        alg = args[algIdx + 1].toLowerCase();
      }

      let result = "";
      if (alg === "sha256") result = await sha256(input);
      else if (alg === "sha512") result = await sha512(input);
      else if (alg === "md5") result = md5(input);
      else if (alg === "sha1") result = sha1(input);
      else if (alg === "crc32") result = crc32(input);
      else result = await sha256(input);

      process.stdout.write(`${alg.toUpperCase()}: ${result}\n`);
      return true;
    }

    case "ts":
    case "types": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp ts \"<json_string_or_file>\" [RootName]\n");
        return true;
      }
      const rootName = args[1] || "Root";
      try {
        const tsOutput = jsonToTypescript(input, rootName);
        process.stdout.write(tsOutput + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      return true;
    }

    case "zod": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp zod \"<json_string_or_file>\" [rootSchema]\n");
        return true;
      }
      const rootName = args[1] || "rootSchema";
      try {
        const zodOutput = jsonToZod(input, rootName);
        process.stdout.write(zodOutput + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      return true;
    }

    case "uuid": {
      const count = parseInt(args[0], 10) || 1;
      for (let i = 0; i < count; i++) {
        process.stdout.write(crypto.randomUUID() + "\n");
      }
      return true;
    }

    case "json": {
      const input = await readInput(args[0]);
      if (!input) {
        process.stderr.write("Usage: npx codestation-mcp json \"<raw_json>\"\n");
        return true;
      }
      try {
        const formatted = formatJson(input, 2);
        process.stdout.write(formatted + "\n");
      } catch (err) {
        process.stderr.write(`[Error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      return true;
    }

    default:
      return false;
  }
}
