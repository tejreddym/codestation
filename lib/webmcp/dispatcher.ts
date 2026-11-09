/**
 * WebMCP Dispatcher: In-Browser Tool Execution Engine
 * Maps tool identifiers to pure client-side processing functions with zero server roundtrips.
 */

import {
  formatJson,
  validateJson,
  minifyJson,
  jsonToYaml,
  yamlToJson,
  jsonToCsv,
  csvToJson,
  jsonDiff,
  generateJsonSchema,
  testJsonPath,
  formatJsonLines,
  validateJsonLines,
  jsonToJsonLines,
  jsonLinesToJson,
  decodeJwt,
} from "../tools/index";

import {
  encodeBase64Url,
  decodeBase64Url,
  encodeHexadecimal,
  decodeHexadecimal,
  decodeUrlComponent,
  encodeBinary,
  decodeBinary,
  encodeAscii,
  decodeAscii,
  encodeBase32,
  decodeBase32,
  encodeBase58,
  decodeBase58,
  encodeDataUri,
  decodeDataUri,
  encodeHtmlEntities,
  decodeHtmlEntities,
  encodeUnicodeEscapes,
  decodeUnicodeEscapes,
  encodeOctal,
  decodeOctal,
} from "../tools/encoding-station";

import {
  md5,
  sha1,
  crc32,
  compareHashes,
  entropy,
  parseUuid,
  uuid,
  ulid,
  nanoid,
  secureRandomToken,
} from "../tools/security-station";

import {
  convertCase,
  slugify,
  countText,
  dedupeLines,
  sortLines,
  type TextCase,
} from "../tools/text-station";

import { explainCron } from "../tools/cron/explain";
import { parseCron } from "../tools/cron/parser";
import { nextCronRun } from "../tools/cron/engine";

import {
  jsonToTypescript,
  jsonToZod,
  jsonToGo,
  jsonToPydantic,
  jsonToRust,
  htmlToJsx,
  svgToJsx,
} from "../tools/code-gen/engine";

import {
  calculateCidr,
  convertIp,
  dockerRunToCompose,
  compareSemver,
} from "../tools/network/engine";

import {
  calculateBitwise,
  inspectIeee754,
  calculateTwosComplement,
  calculateBigInt,
  calculateGcdLcmPair,
  convertToFraction,
} from "../tools/dev-math/engine";

import {
  generateCssGrid,
  generateFlexbox,
  generateGlassmorphism,
} from "../tools/css/engine";

import { curlToCode, type CurlTargetLanguage } from "../tools/curl-to-code";
import { auditEnv, formatEnvAuditReport } from "../tools/env-audit";
import { generateMockDataset, type MockTemplate } from "../tools/mock-data";
import { parseAndResolveGitConflicts, formatConflictReport, type ConflictStrategy } from "../tools/git-conflict";
import {
  compressGzip,
  decompressGzip,
  createZip,
  inspectZip,
  parseTar,
  base64ToUint8Array,
} from "../tools/compression/engine";
import { getTool } from "../../config/tools";

/** Native SubtleCrypto helpers for SHA-256 / SHA-512 / SHA-384 / HMAC */
async function digestHex(algorithm: "SHA-256" | "SHA-384" | "SHA-512", message: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest(algorithm, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `(Native WebCrypto unavailable for ${algorithm})`;
}

async function hmacHex(algorithm: "SHA-256" | "SHA-512", message: string, secret: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: { name: algorithm } },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `(Native WebCrypto unavailable for HMAC ${algorithm})`;
}

export async function dispatchToolExecution(
  toolId: string,
  input: string = "",
  options: Record<string, any> = {}
): Promise<string> {
  const normId = toolId.toLowerCase().trim().replace(/_/g, "-");

  switch (normId) {
    // ----------------- JSON & Data -----------------
    case "json-formatter":
      return formatJson(input, Number(options.indent ?? 2));
    case "json-validator":
      return validateJson(input) ? "Valid JSON syntax." : "Invalid JSON syntax.";
    case "json-minifier":
      return minifyJson(input);
    case "json-to-yaml":
      return jsonToYaml(input);
    case "yaml-to-json":
      return yamlToJson(input);
    case "json-to-csv":
      return jsonToCsv(input);
    case "csv-to-json":
      return csvToJson(input);
    case "json-diff":
      return jsonDiff(input, String(options.right ?? options.compare ?? "{}"));
    case "json-schema-generator":
      return generateJsonSchema(input);
    case "jsonpath-tester":
      return testJsonPath(input, String(options.expression ?? "$"));
    case "jsonl-formatter":
      return formatJsonLines(input);
    case "jsonl-validator":
      return validateJsonLines(input);
    case "json-to-jsonl":
      return jsonToJsonLines(input);
    case "jsonl-to-json":
      return jsonLinesToJson(input);
    case "jwt-decoder":
      return JSON.stringify(decodeJwt(input), null, 2);

    // ----------------- Encoding -----------------
    case "base64": {
      const isDecode = options.action === "decode" || options.decode === true;
      if (isDecode) {
        return typeof atob !== "undefined" ? atob(input) : Buffer.from(input, "base64").toString("utf-8");
      }
      return typeof btoa !== "undefined" ? btoa(input) : Buffer.from(input, "utf-8").toString("base64");
    }
    case "base64-url-encoder":
      return encodeBase64Url(input);
    case "base64-url-decoder":
      return decodeBase64Url(input);
    case "url-encoder": {
      const isDecode = options.action === "decode" || options.decode === true;
      return isDecode ? decodeUrlComponent(input) : encodeURIComponent(input);
    }
    case "url-component-encoder":
      return encodeURIComponent(input);
    case "url-component-decoder":
      return decodeUrlComponent(input);
    case "hex-converter":
    case "hexadecimal-encoder":
      return encodeHexadecimal(input);
    case "hexadecimal-decoder":
      return decodeHexadecimal(input);
    case "html-encoder":
    case "html-entity-encoder":
      return encodeHtmlEntities(input);
    case "html-decoder":
    case "html-entity-decoder":
      return decodeHtmlEntities(input);
    case "binary-encoder-decoder":
      return options.action === "decode" ? decodeBinary(input) : encodeBinary(input);
    case "ascii-converter":
      return options.action === "decode" ? decodeAscii(input) : encodeAscii(input);
    case "base32-encoder":
      return encodeBase32(input);
    case "base32-decoder":
      return decodeBase32(input);
    case "base58-encoder":
      return encodeBase58(input);
    case "base58-decoder":
      return decodeBase58(input);
    case "data-uri-encoder":
      return encodeDataUri(input, options.mime);
    case "data-uri-decoder":
      return decodeDataUri(input);
    case "unicode-escape-encoder":
      return encodeUnicodeEscapes(input);
    case "unicode-escape-decoder":
      return decodeUnicodeEscapes(input);
    case "octal-converter":
      return options.action === "decode" ? decodeOctal(input) : encodeOctal(input);

    // ----------------- Security & Crypto -----------------
    case "sha-256":
      return await digestHex("SHA-256", input);
    case "sha-512":
      return await digestHex("SHA-512", input);
    case "sha-384-generator":
      return await digestHex("SHA-384", input);
    case "sha-1-generator":
      return sha1(input);
    case "md5-generator":
      return md5(input);
    case "crc32-generator":
      return crc32(input);
    case "hmac-generator":
      return await hmacHex(
        options.algorithm === "SHA-512" ? "SHA-512" : "SHA-256",
        input,
        String(options.secret ?? "")
      );
    case "uuid-generator": {
      const count = Math.min(Math.max(Number(options.count ?? 1), 1), 50);
      return Array.from({ length: count }, () => uuid()).join("\n");
    }
    case "ulid-generator":
      return ulid();
    case "nanoid-generator":
      return nanoid(Number(options.length ?? 21));
    case "password-generator":
    case "secure-token-generator":
    case "random-string":
      return secureRandomToken(Number(options.length ?? 24));
    case "entropy-calculator":
      return JSON.stringify(entropy(input), null, 2);
    case "hash-compare":
      return compareHashes(input, String(options.target ?? options.right ?? ""))
        ? "Hashes match identically."
        : "Hashes do not match.";
    case "uuid-parser":
      return JSON.stringify(parseUuid(input), null, 2);

    // ----------------- Text -----------------
    case "case-converter":
      return convertCase(input, (options.targetCase ?? "camel") as TextCase);
    case "slug-generator":
      return slugify(input, String(options.separator ?? "-"));
    case "text-counter":
      return JSON.stringify(countText(input), null, 2);
    case "line-deduplicator":
    case "duplicate-line-remover":
      return dedupeLines(input);
    case "sort-lines":
      return sortLines(input, { order: options.order === "descending" ? "descending" : "ascending" });
    case "reverse-text":
      return [...input].reverse().join("");

    // ----------------- Cron -----------------
    case "cron-explainer":
    case "cron-to-human":
      return explainCron(parseCron(input));
    case "cron-validator": {
      const parsed = parseCron(input);
      return JSON.stringify(parsed, null, 2);
    }
    case "cron-next-run": {
      const ref = options.reference ? String(options.reference) : new Date().toISOString();
      const tz = options.timezone ? String(options.timezone) : "UTC";
      const next = nextCronRun(input, ref, tz);
      return JSON.stringify(next, null, 2);
    }

    // ----------------- Code Generation -----------------
    case "json-to-typescript":
      return jsonToTypescript(input, options.rootName ?? "Root");
    case "json-to-zod":
      return jsonToZod(input, options.rootName ?? "rootSchema");
    case "json-to-go":
      return jsonToGo(input, options.rootName ?? "Root");
    case "json-to-python-pydantic":
      return jsonToPydantic(input, options.rootName ?? "RootModel");
    case "json-to-rust-serde":
      return jsonToRust(input, options.rootName ?? "Root");
    case "html-to-jsx":
      return htmlToJsx(input);
    case "svg-to-react":
    case "svg-to-jsx":
      return svgToJsx(input, options.componentName ?? "Icon");

    // ----------------- Network & DevOps -----------------
    case "cidr-calculator":
      return JSON.stringify(calculateCidr(input), null, 2);
    case "ipv4-to-ipv6":
      return JSON.stringify(convertIp(input), null, 2);
    case "docker-run-to-compose":
      return dockerRunToCompose(input);
    case "semver-compare":
      return JSON.stringify({
        comparison: compareSemver(input, String(options.target ?? options.compare ?? "")),
        message: `${input} vs ${options.target ?? options.compare}`
      }, null, 2);

    // ----------------- Developer Math -----------------
    case "bitwise-calculator":
      return JSON.stringify(
        calculateBitwise(Number(input || 0), Number(options.b ?? 0), Number(options.bitWidth ?? 32) as any),
        null,
        2
      );
    case "ieee754-float-converter":
      return JSON.stringify(inspectIeee754(Number(input || 0), options.precision ?? "float32"), null, 2);
    case "twos-complement":
      return JSON.stringify(calculateTwosComplement(Number(input || 0), Number(options.bits ?? 32) as any), null, 2);
    case "bigint-calculator":
      return JSON.stringify(
        calculateBigInt(input || "0", String(options.b ?? "0"), (options.op ?? "+") as any),
        null,
        2
      );
    case "gcd-lcm-primes":
      return JSON.stringify(calculateGcdLcmPair(Number(input || 0), Number(options.b ?? 0)), null, 2);
    case "fraction-decimal-converter":
      return JSON.stringify(convertToFraction(input), null, 2);

    // ----------------- Frontend & CSS -----------------
    case "css-grid-generator":
      return generateCssGrid({
        columns: options.columns ?? "1fr 1fr",
        rows: options.rows ?? "auto auto",
        columnGap: Number(options.columnGap ?? 16),
        rowGap: Number(options.rowGap ?? 16),
      }).css;
    case "css-flexbox-playground":
      return generateFlexbox({
        flexDirection: options.direction ?? "row",
        flexWrap: options.wrap ?? "nowrap",
        justifyContent: options.justifyContent ?? "center",
        alignItems: options.alignItems ?? "center",
        alignContent: options.alignContent ?? "stretch",
        gap: Number(options.gap ?? 16),
        items: [],
      }).css;
    case "css-glassmorphism-generator":
      return generateGlassmorphism({
        blur: Number(options.blur ?? 12),
        transparency: Number(options.transparency ?? 0.2),
        baseColor: options.baseColor ?? "#ffffff",
        borderWidth: Number(options.borderWidth ?? 1),
        borderOpacity: Number(options.borderOpacity ?? 0.2),
        borderRadius: Number(options.borderRadius ?? 16),
        shadowElevation: Number(options.shadowElevation ?? 10),
      });

    // ----------------- Developer Utilities -----------------
    case "curl-to-code":
      return (await curlToCode(input, (options.targetLanguage ?? "typescript-fetch") as CurlTargetLanguage)).code;
    case "env-audit":
      return formatEnvAuditReport(auditEnv(input, options.example));
    case "git-conflict":
      return formatConflictReport(
        parseAndResolveGitConflicts(input, (options.strategy ?? "analyze") as ConflictStrategy)
      );
    case "mock-data": {
      const mockResult = generateMockDataset({
        template: (options.template ?? "users") as MockTemplate,
        count: Number(options.count ?? 10),
        format: options.format ?? "json",
        tableName: options.tableName,
      });
      return options.format === "sql" ? mockResult.sql ?? mockResult.json : options.format === "csv" ? mockResult.csv ?? mockResult.json : mockResult.json;
    }

    // ----------------- Compression & Archive Station -----------------
    case "gzip-compressor": {
      const compRes = await compressGzip(input, {
        format: (options.format as "gzip" | "deflate") || "gzip",
        level: Number(options.level ?? 6),
      });
      return JSON.stringify(
        {
          format: compRes.format,
          originalSize: compRes.originalSize,
          compressedSize: compRes.compressedSize,
          ratioPercent: compRes.ratioPercent,
          engine: compRes.engine,
          base64: compRes.base64,
        },
        null,
        2
      );
    }
    case "gzip-decompressor": {
      const decompRes = await decompressGzip(input, {
        format: options.format as "auto" | "gzip" | "deflate",
        isBase64: true,
      });
      return decompRes.isText && decompRes.text
        ? decompRes.text
        : JSON.stringify(
            {
              format: decompRes.format,
              originalSize: decompRes.originalSize,
              decompressedSize: decompRes.decompressedSize,
              isText: decompRes.isText,
              engine: decompRes.engine,
            },
            null,
            2
          );
    }
    case "zip-creator": {
      const files: Array<{ path: string; data: Uint8Array }> = [];
      if (Array.isArray(options.files)) {
        for (const f of options.files) {
          files.push({
            path: f.path || "file.txt",
            data: typeof f.content === "string" ? new TextEncoder().encode(f.content) : new Uint8Array(0),
          });
        }
      } else {
        files.push({
          path: options.filename || "file.txt",
          data: new TextEncoder().encode(input || ""),
        });
      }
      const zipBytes = createZip(files, Number(options.level ?? 6));
      return JSON.stringify(
        {
          fileCount: files.length,
          size: zipBytes.length,
          base64: Buffer.from(zipBytes).toString("base64"),
        },
        null,
        2
      );
    }
    case "zip-extractor": {
      const zipBytes = base64ToUint8Array(input);
      const zipInspection = inspectZip(zipBytes);
      return JSON.stringify(
        {
          fileCount: zipInspection.fileCount,
          dirCount: zipInspection.dirCount,
          totalUncompressedSize: zipInspection.totalUncompressedSize,
          totalCompressedSize: zipInspection.totalCompressedSize,
          entries: zipInspection.entries.map((e) => ({
            path: e.path,
            size: e.size,
            isDirectory: e.isDirectory,
          })),
        },
        null,
        2
      );
    }
    case "tar-inspector": {
      const tarBytes = base64ToUint8Array(input);
      const tarInspection = parseTar(tarBytes);
      return JSON.stringify(
        {
          isGzipped: tarInspection.isGzipped,
          fileCount: tarInspection.fileCount,
          dirCount: tarInspection.dirCount,
          totalSize: tarInspection.totalSize,
          entries: tarInspection.entries.map((e) => ({
            name: e.name,
            mode: e.formattedMode,
            size: e.size,
            mtime: e.mtime.toISOString(),
            type: e.typeName,
          })),
        },
        null,
        2
      );
    }

    // ----------------- Generic Registered Tool Fallback -----------------
    default: {
      const toolDef = getTool(normId);
      if (toolDef) {
        return JSON.stringify(
          {
            tool: toolDef.name,
            id: toolDef.id,
            category: toolDef.category,
            description: toolDef.description,
            canonicalUrl: `https://codestation.in/tools/${toolDef.slug}`,
            status: "ready",
            notice: "This tool is registered in Code Station. Processing executes 100% in-browser.",
            echo: input ? input.slice(0, 100) : undefined,
          },
          null,
          2
        );
      }
      throw new Error(`Unknown Code Station tool '${toolId}'. Use 'codestation_list_tools' to see available tools.`);
    }
  }
}
