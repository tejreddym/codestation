import * as fs from "node:fs";
import * as path from "node:path";
import { decodeJwt, formatJson, jsonDiff, testJsonPath } from "../lib/tools/index";
import { parseCron } from "../lib/tools/cron/parser";
import { explainCron } from "../lib/tools/cron/explain";
import { nextCronRun } from "../lib/tools/cron/engine";
import { md5, sha1, sha256, sha512, crc32, ulid, nanoid } from "../lib/tools/security-station";
import { encodeBase64Url, decodeBase64Url } from "../lib/tools/encoding-station";
import { jsonToTypescript, jsonToZod } from "../lib/tools/json-to-types";
import { curlToCode, type CurlTargetLanguage } from "../lib/tools/curl-to-code";
import { auditEnv, formatEnvAuditReport } from "../lib/tools/env-audit";
import { generateMockDataset, type MockTemplate, type SqlDialect } from "../lib/tools/mock-data";
import { parseAndResolveGitConflicts, formatConflictReport, type ConflictStrategy } from "../lib/tools/git-conflict";
import {
  OFFLINE_GRACE_WINDOW_MS,
  clearCachedLicense,
  getLicenseCacheFilePath,
  getProUpgradeNotice,
  getStableMachineFingerprint,
  readCachedLicense,
  resolveLicense,
  verifyLicenseOnline,
  type LicenseCacheOptions,
  type OnlineVerifyOptions,
} from "./config";
import {
  describeBridgeTool,
  executeBridgeTool,
  getNodePureToolCount,
  getWiredNodeFileTools,
  listBridgeTools,
  resolveBridgeToolTier,
  type BridgeListFilter,
} from "./registry-bridge";
import { SHARED_TOOLS } from "../config/shared-registry";

export interface CliExecutionResult {
  handled: boolean;
  exitCode: number;
}

export interface CliIoContext {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
  stdinText?: () => Promise<string>;
  isStdinTTY?: boolean;
  cacheOptions?: LicenseCacheOptions;
  verifyOptions?: OnlineVerifyOptions;
}

const DUAL_MODE_FILE_SLUGS = new Set([
  "csv-to-json",
  "json-to-csv",
  "gzip-compressor",
  "gzip-decompressor",
]);

interface ParsedCliArgs {
  positional: string[];
  values: Record<string, string>;
  multiValues: Record<string, string[]>;
  flags: Set<string>;
}

function parseCliFlags(
  args: string[],
  valueFlags: ReadonlySet<string>,
  multiValueFlags: ReadonlySet<string> = new Set(),
): ParsedCliArgs {
  const positional: string[] = [];
  const values: Record<string, string> = {};
  const multiValues: Record<string, string[]> = {};
  const flags = new Set<string>();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        const key = arg.slice(0, eqIdx);
        const val = arg.slice(eqIdx + 1);
        flags.add(key);
        if (multiValueFlags.has(key)) {
          (multiValues[key] ??= []).push(val);
        }
        values[key] = val;
        continue;
      }
      flags.add(arg);
      if ((valueFlags.has(arg) || multiValueFlags.has(arg)) && i + 1 < args.length) {
        const val = args[i + 1];
        if (multiValueFlags.has(arg)) {
          (multiValues[arg] ??= []).push(val);
        }
        values[arg] = val;
        i += 1;
      }
      continue;
    }
    if (arg.startsWith("-") && arg.length === 2) {
      flags.add(arg);
      if ((valueFlags.has(arg) || multiValueFlags.has(arg)) && i + 1 < args.length) {
        const val = args[i + 1];
        if (multiValueFlags.has(arg)) {
          (multiValues[arg] ??= []).push(val);
        }
        values[arg] = val;
        i += 1;
      }
      continue;
    }
    positional.push(arg);
  }

  return { positional, values, multiValues, flags };
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

async function readRawStdin(io?: CliIoContext): Promise<string> {
  if (io?.stdinText) {
    return io.stdinText();
  }
  const isTTY = io?.isStdinTTY ?? Boolean(process.stdin.isTTY);
  if (isTTY) return "";
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export async function handleCliSubcommand(
  command: string,
  args: string[],
  io?: CliIoContext
): Promise<CliExecutionResult> {
  const isNoColor = args.includes("--no-color") || process.env.NO_COLOR !== undefined;
  const isJson = args.includes("--json");
  const isHelp = args.includes("--help") || args.includes("-h");

  const writeOut = io?.stdout ?? ((text: string) => { process.stdout.write(text); });
  const writeErr = io?.stderr ?? ((text: string) => { process.stderr.write(text); });

  const out = (text: string) => {
    writeOut(isNoColor ? stripAnsi(text) : text);
  };

  const err = (text: string) => {
    writeErr(isNoColor ? stripAnsi(text) : text);
  };

  const cmd = command.toLowerCase();

  switch (cmd) {
    // -------------------------------------------------------------
    // LOGIN (Verify & Cache Pro/Team License Key)
    // -------------------------------------------------------------
    case "login": {
      if (isHelp) {
        out("Usage: codestation login <license_key> [--json] [--no-color]\nActivate Code Station Pro / Team locally with 14-day offline grace caching.\n");
        return { handled: true, exitCode: 0 };
      }
      const parsed = parseCliFlags(args, new Set(["--key"]));
      const rawKey = parsed.values["--key"] ?? parsed.positional[0];
      if (!rawKey || !rawKey.trim()) {
        err("Error: License key is required. Usage: codestation login <CS-PRO-YOURKEY>\n");
        return { handled: true, exitCode: 1 };
      }

      const verifyRes = await verifyLicenseOnline(rawKey.trim(), {
        ...io?.cacheOptions,
        ...io?.verifyOptions,
      });

      if (!verifyRes.valid) {
        err(`Error: ${verifyRes.message}\n`);
        return { handled: true, exitCode: 1 };
      }

      const cacheFile = getLicenseCacheFilePath(io?.cacheOptions?.cacheFile);
      const fingerprint = io?.cacheOptions?.fingerprint ?? getStableMachineFingerprint();
      if (isJson) {
        out(
          JSON.stringify(
            {
              activated: true,
              tier: "pro",
              planType: verifyRes.planType ?? "individual",
              orgName: verifyRes.orgName,
              offlineFallback: Boolean(verifyRes.offlineFallback),
              offlineGraceDays: 14,
              cacheFile,
              machineFingerprint: fingerprint,
              message: verifyRes.message,
            },
            null,
            2
          ) + "\n"
        );
      } else {
        out("\n✔ Code Station Pro license activated\n");
        out(`Status:      ${verifyRes.message}\n`);
        out(`Plan:        ${verifyRes.planType ?? "individual"}${verifyRes.orgName ? ` (${verifyRes.orgName})` : ""}\n`);
        out(`Offline:     14-day grace window cached at ${cacheFile}\n`);
        out(`Fingerprint: ${fingerprint.slice(0, 16)}...\n\n`);
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // LOGOUT (Clear Cached License)
    // -------------------------------------------------------------
    case "logout": {
      if (isHelp) {
        out("Usage: codestation logout [--json]\nRemove locally cached Code Station Pro license.\n");
        return { handled: true, exitCode: 0 };
      }
      const cacheFile = getLicenseCacheFilePath(io?.cacheOptions?.cacheFile);
      const removed = clearCachedLicense(io?.cacheOptions);
      if (isJson) {
        out(JSON.stringify({ loggedOut: true, cacheCleared: removed, cacheFile }, null, 2) + "\n");
      } else if (removed) {
        out(`✔ Logged out. Removed cached license (${cacheFile}).\n`);
      } else {
        out("No cached license found. Running in Free Tier.\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // STATUS
    // -------------------------------------------------------------
    case "status": {
      if (isHelp) {
        out("Usage: codestation status [--key <key>] [--json] [--no-color]\nView Code Station license tier, offline grace cache, machine fingerprint, and active tool counts.\n");
        return { handled: true, exitCode: 0 };
      }
      const parsed = parseCliFlags(args, new Set(["--key"]));
      const license = resolveLicense(parsed.values["--key"], io?.cacheOptions);
      const cached = readCachedLicense(io?.cacheOptions);
      const now = io?.cacheOptions?.now ?? Date.now();
      const cacheFile = getLicenseCacheFilePath(io?.cacheOptions?.cacheFile);
      const nodePureCount = getNodePureToolCount();
      const nodeFileCount = getWiredNodeFileTools().length;
      const graceRemainingMs = cached
        ? Math.max(0, cached.verifiedAt + OFFLINE_GRACE_WINDOW_MS - now)
        : 0;
      const graceRemainingDays = Number((graceRemainingMs / (24 * 60 * 60 * 1000)).toFixed(1));

      if (isJson) {
        out(
          JSON.stringify(
            {
              name: "Code Station",
              version: "1.4.0",
              license: {
                tier: license.tier,
                isPro: license.isPro,
                source: license.source,
                planType: license.planType,
                orgName: license.orgName,
                keyPrefix: license.licenseKey ? `${license.licenseKey.slice(0, 10)}...` : null,
                machineFingerprint: license.machineFingerprint,
                cacheFile,
                offlineGraceRemainingDays: cached ? graceRemainingDays : 0,
              },
              toolCounts: {
                nodePure: nodePureCount,
                nodeFileWired: nodeFileCount,
                sharedRegistry: SHARED_TOOLS.length,
              },
              privacy: "local-only",
              mcpReady: true,
            },
            null,
            2
          ) + "\n"
        );
      } else {
        out("\n=== CODE STATION STATUS ===\n");
        out("Version:     1.4.0\n");
        out(
          `License:     ${
            license.isPro
              ? `PRO TIER (Active via ${license.source}${license.planType === "team" ? " · Team" : ""})`
              : "FREE TIER (15 core tools + 3 discovery tools)"
          }\n`
        );
        if (license.licenseKey) {
          out(`Key Prefix:  ${license.licenseKey.slice(0, 10)}...\n`);
        }
        if (cached) {
          out(`Grace Cache: Valid (${graceRemainingDays} / 14 days remaining offline)\n`);
        }
        if (license.machineFingerprint) {
          out(`Machine FP:  ${license.machineFingerprint.slice(0, 16)}...\n`);
        }
        out(`Tools:       ${nodePureCount} node-pure + ${nodeFileCount} local file tools (${SHARED_TOOLS.length} shared shortcuts)\n`);
        out("MCP Server:  Ready (Stdio transport)\n");
        out("Privacy:     Zero telemetry, local execution only\n\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // LIST (Browse Registered Tools)
    // -------------------------------------------------------------
    case "list": {
      if (isHelp) {
        out("Usage: codestation list [--station <name>] [--tier free|pro|all] [--search <q>] [--runtime node-pure|node-file|browser-only|all] [--limit <n>] [--json]\n");
        return { handled: true, exitCode: 0 };
      }
      const parsed = parseCliFlags(
        args,
        new Set(["--station", "-s", "--tier", "--search", "--query", "-q", "--runtime", "--limit", "-n"])
      );
      const tierRaw = (parsed.values["--tier"] ?? "all").toLowerCase();
      if (!["all", "free", "pro"].includes(tierRaw)) {
        err(`Error: Invalid --tier "${tierRaw}". Expected free, pro, or all.\n`);
        return { handled: true, exitCode: 1 };
      }
      const runtimeRaw = (parsed.values["--runtime"] ?? "all").toLowerCase();
      if (!["all", "node-pure", "node-file", "browser-only"].includes(runtimeRaw)) {
        err(`Error: Invalid --runtime "${runtimeRaw}". Expected node-pure, node-file, browser-only, or all.\n`);
        return { handled: true, exitCode: 1 };
      }

      const limitRaw = parsed.values["--limit"] ?? parsed.values["-n"];
      const filter: BridgeListFilter = {
        station: parsed.values["--station"] ?? parsed.values["-s"] ?? parsed.positional[0],
        tier: tierRaw as "all" | "free" | "pro",
        query: parsed.values["--search"] ?? parsed.values["--query"] ?? parsed.values["-q"],
        runtime: runtimeRaw as BridgeListFilter["runtime"],
        limit: limitRaw ? Number(limitRaw) : 50,
      };

      const res = listBridgeTools(filter);
      if (isJson) {
        out(JSON.stringify(res, null, 2) + "\n");
      } else {
        out(
          `\nCode Station Tools — showing ${res.returned} of ${res.totalMatching} matching (${res.totalRegistered} total)\n`
        );
        out(
          `Runtime: node-pure=${res.countsByRuntime["node-pure"]} · node-file=${res.countsByRuntime["node-file"]} · browser-only=${res.countsByRuntime["browser-only"]}\n\n`
        );
        for (const t of res.tools) {
          const tierTag = t.tier === "free" ? "[FREE]" : "[PRO] ";
          const rtTag = t.runtimeCompatibility === "node-file"
            ? (t.nodeFileSupported ? "node-file" : "browser  ")
            : t.runtimeCompatibility;
          out(`  ${tierTag} ${t.slug.padEnd(32)} ${rtTag.padEnd(13)} ${t.station.padEnd(18)} ${t.name}\n`);
        }
        out("\nRun: codestation info <slug> | codestation run <slug> --input ...\n\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // INFO (Inspect Tool Metadata, Tier, Runtime & Options Schema)
    // -------------------------------------------------------------
    case "info": {
      if (isHelp) {
        out("Usage: codestation info <slug> [--json]\nShow description, tier, runtime compatibility, options schema, and examples.\n");
        return { handled: true, exitCode: 0 };
      }
      const parsed = parseCliFlags(args, new Set());
      const slug = parsed.positional[0];
      if (!slug) {
        err("Error: Tool slug is required. Usage: codestation info <slug>\n");
        return { handled: true, exitCode: 1 };
      }
      const meta = describeBridgeTool(slug);
      if (!meta) {
        err(`Error: Unknown tool "${slug}". Run 'codestation list --search ${slug}' to find tools.\n`);
        return { handled: true, exitCode: 1 };
      }

      if (isJson) {
        out(JSON.stringify(meta, null, 2) + "\n");
      } else {
        const optionProps =
          ((meta.inputSchema?.properties as Record<string, any> | undefined)?.options?.properties as
            | Record<string, { type?: string; description?: string }>
            | undefined) ?? {};
        const optionEntries = Object.entries(optionProps);

        out(`\n=== ${meta.name} (${meta.slug}) ===\n`);
        out(`Tier:        ${meta.tier.toUpperCase()}\n`);
        out(
          `Runtime:     ${meta.runtimeCompatibility}${
            meta.runtimeCompatibility === "node-file"
              ? meta.nodeFileSupported
                ? " (Node-native file support ready)"
                : " (Browser-only fallback)"
              : ""
          }\n`
        );
        out(`Station:     ${meta.stationName} (${meta.stationId})\n`);
        out(`MCP Tool:    ${meta.mcpName}\n`);
        out(`Description: ${meta.description}\n`);
        if (optionEntries.length > 0) {
          out("\nOptions:\n");
          for (const [k, v] of optionEntries) {
            out(`  --options '{"${k}": ...}'  (${v?.type ?? "any"}) ${v?.description ?? ""}\n`);
          }
        }
        if (meta.examples[0]) {
          out(`\nExample:\n  codestation run ${meta.slug}`);
          if (meta.examples[0].arguments.input) {
            out(` --input ${JSON.stringify(meta.examples[0].arguments.input)}`);
          }
          if (meta.examples[0].arguments.options) {
            out(` --options '${JSON.stringify(meta.examples[0].arguments.options)}'`);
          }
          out("\n");
        }
        out("\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // RUN (Pipeable Execution for Any Registered Node-Compatible Tool)
    // -------------------------------------------------------------
    case "run": {
      if (isHelp) {
        out("Usage: codestation run <slug> [--input <text>] [--in <file>] [--out <file>] [--options '<json>'] [--key <license_key>] [--json]\nSupports piped stdin: cat data.json | codestation run json-to-yaml\n");
        return { handled: true, exitCode: 0 };
      }

      const parsed = parseCliFlags(
        args,
        new Set(["--input", "-i", "--out", "-o", "--options", "--key"]),
        new Set(["--in"])
      );
      const slug = parsed.positional[0];
      if (!slug) {
        err("Error: Tool slug is required. Usage: codestation run <slug> [--input <text>]\n");
        return { handled: true, exitCode: 1 };
      }

      const meta = describeBridgeTool(slug);
      if (!meta) {
        err(`Error: Tool "${slug}" is not registered in Code Station registry.\n`);
        return { handled: true, exitCode: 1 };
      }

      const license = resolveLicense(parsed.values["--key"], io?.cacheOptions);
      const requiredTier = resolveBridgeToolTier(meta.slug);
      if (requiredTier === "pro" && !license.isPro) {
        err(getProUpgradeNotice(meta.slug) + "\n");
        return { handled: true, exitCode: 1 };
      }

      let toolOptions: Record<string, unknown> = {};
      if (parsed.values["--options"]) {
        try {
          const decodedOpts = JSON.parse(parsed.values["--options"]);
          if (!decodedOpts || typeof decodedOpts !== "object" || Array.isArray(decodedOpts)) {
            err("Error: --options must be a JSON object.\n");
            return { handled: true, exitCode: 1 };
          }
          toolOptions = decodedOpts as Record<string, unknown>;
        } catch (e) {
          err(`Error: Invalid JSON in --options: ${e instanceof Error ? e.message : String(e)}\n`);
          return { handled: true, exitCode: 1 };
        }
      }

      const inFiles = parsed.multiValues["--in"] ?? [];
      const singleInFile = inFiles[0];
      const outFile = parsed.values["--out"] ?? parsed.values["-o"];
      let inputText = parsed.values["--input"] ?? parsed.values["-i"] ?? "";

      const isFileRuntime =
        meta.runtimeCompatibility === "node-file" ||
        (DUAL_MODE_FILE_SLUGS.has(meta.slug) && inFiles.length > 0);

      if (isFileRuntime) {
        if (inFiles.length > 1 || ((meta.slug === "pdf-merge" || meta.slug === "zip-create" || meta.slug === "zip-creator") && inFiles.length > 0)) {
          if (!toolOptions.inputPaths) {
            toolOptions.inputPaths = inFiles.map((f) => path.resolve(f));
          }
        } else if (singleInFile && !toolOptions.inputPath) {
          toolOptions.inputPath = path.resolve(singleInFile);
        } else if (!inputText && parsed.positional[1]) {
          const candidate = parsed.positional[1];
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            toolOptions.inputPath = path.resolve(candidate);
          } else {
            inputText = candidate;
          }
        } else if (!inputText && !toolOptions.inputPath && !toolOptions.inputPaths && !toolOptions.inputBase64) {
          const stdinRaw = await readRawStdin(io);
          if (stdinRaw) {
            inputText = stdinRaw.replace(/\r?\n$/, "");
          }
        }

        if (outFile && !toolOptions.outputPath && meta.slug !== "zip-extract" && meta.slug !== "zip-extractor") {
          toolOptions.outputPath = path.resolve(outFile);
        } else if (outFile && !toolOptions.outputDir && (meta.slug === "zip-extract" || meta.slug === "zip-extractor")) {
          toolOptions.outputDir = path.resolve(outFile);
        }
      } else {
        if (!inputText && singleInFile) {
          const resolvedIn = path.resolve(singleInFile);
          if (!fs.existsSync(resolvedIn)) {
            err(`Error: Input file not found: ${resolvedIn}\n`);
            return { handled: true, exitCode: 1 };
          }
          inputText = fs.readFileSync(resolvedIn, "utf-8");
        } else if (!inputText && parsed.positional[1]) {
          inputText = parsed.positional[1];
        } else if (!inputText) {
          const stdinRaw = await readRawStdin(io);
          if (stdinRaw) {
            inputText = stdinRaw.replace(/\r?\n$/, "");
          }
        }
      }

      const execRes = await executeBridgeTool(
        meta.slug,
        { input: inputText, options: toolOptions },
        license
      );

      if (execRes.isError) {
        err(execRes.content.map((c) => c.text).join("\n") + "\n");
        return { handled: true, exitCode: 1 };
      }

      const resultText = execRes.content.map((c) => c.text).join("\n");
      if (outFile && !isFileRuntime) {
        const resolvedOut = path.resolve(outFile);
        fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
        fs.writeFileSync(
          resolvedOut,
          resultText.endsWith("\n") ? resultText : `${resultText}\n`,
          "utf-8"
        );
        if (isJson) {
          out(JSON.stringify({ slug: meta.slug, outputPath: resolvedOut, bytes: Buffer.byteLength(resultText, "utf-8") }, null, 2) + "\n");
        }
        return { handled: true, exitCode: 0 };
      }

      out(resultText.endsWith("\n") ? resultText : `${resultText}\n`);
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

    // -------------------------------------------------------------
    // ULID Generator
    // -------------------------------------------------------------
    case "ulid": {
      if (isHelp) {
        out("Usage: codestation ulid [count]\n");
        return { handled: true, exitCode: 0 };
      }
      const count = Math.min(Math.max(parseInt(args[0], 10) || 1, 1), 100);
      for (let i = 0; i < count; i++) {
        out(ulid() + "\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // NanoID Generator
    // -------------------------------------------------------------
    case "nanoid": {
      if (isHelp) {
        out("Usage: codestation nanoid [count] [--length <2-128>]\n");
        return { handled: true, exitCode: 0 };
      }
      const countArg = args.find((a) => !a.startsWith("-"));
      const count = Math.min(Math.max(parseInt(countArg ?? "1", 10) || 1, 1), 100);
      const lenIdx = args.indexOf("--length");
      const length = lenIdx !== -1 && args[lenIdx + 1] ? parseInt(args[lenIdx + 1], 10) || 21 : 21;
      for (let i = 0; i < count; i++) {
        out(nanoid(length) + "\n");
      }
      return { handled: true, exitCode: 0 };
    }

    // -------------------------------------------------------------
    // Base64 Encode / Decode
    // -------------------------------------------------------------
    case "base64":
    case "b64": {
      if (isHelp) {
        out("Usage: codestation base64 \"<text>\" [--decode] [--url-safe]\n");
        return { handled: true, exitCode: 0 };
      }
      const input = await readInput(args.find((a) => !a.startsWith("-")));
      if (!input) {
        err("Error: Input text is required.\n");
        return { handled: true, exitCode: 1 };
      }
      const decode = args.includes("--decode") || args.includes("-d");
      const urlSafe = args.includes("--url-safe");
      try {
        if (decode) {
          out((urlSafe ? decodeBase64Url(input) : Buffer.from(input, "base64").toString("utf-8")) + "\n");
        } else {
          out((urlSafe ? encodeBase64Url(input) : Buffer.from(input, "utf-8").toString("base64")) + "\n");
        }
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // Structural JSON Diff
    // -------------------------------------------------------------
    case "json-diff":
    case "jdiff": {
      if (isHelp) {
        out("Usage: codestation json-diff <left_json_or_file> <right_json_or_file>\n");
        return { handled: true, exitCode: 0 };
      }
      const positional = args.filter((a) => !a.startsWith("-"));
      if (positional.length < 2) {
        err("Error: Provide both left and right JSON inputs or files.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const left = await readInput(positional[0]);
        const right = await readInput(positional[1]);
        out(jsonDiff(left, right) + "\n");
        return { handled: true, exitCode: 0 };
      } catch (e) {
        err(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
        return { handled: true, exitCode: 1 };
      }
    }

    // -------------------------------------------------------------
    // JSONPath Query Extractor
    // -------------------------------------------------------------
    case "jsonpath":
    case "json-path": {
      if (isHelp) {
        out("Usage: codestation jsonpath <json_or_file> \"<expression>\"\n");
        return { handled: true, exitCode: 0 };
      }
      const positional = args.filter((a) => !a.startsWith("-"));
      if (positional.length < 2) {
        err("Error: Provide both JSON input and a JSONPath expression starting with $.\n");
        return { handled: true, exitCode: 1 };
      }
      try {
        const json = await readInput(positional[0]);
        out(testJsonPath(json, positional[1]) + "\n");
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
