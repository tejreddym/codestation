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
import {
  countTokens,
  repairJson,
  interpolatePrompt,
  parseVectorInput,
  computeVectorSimilarity,
  buildSystemPrompt,
  type AiModelId,
  type SystemPromptConfig,
} from "../tools/ai-prompts/engine";
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
} from "../tools/crypto-pki/engine";
import {
  applyWatermark,
  applyPageNumbers,
  type WatermarkOptions,
  type PageNumberOptions,
} from "../tools/pdf/engine";
import {
  executeSql,
} from "../tools/spreadsheet/sql-engine";
import {
  generatePolicyText,
} from "../tools/policy-generators/engine";
import type { PolicyToolId, PolicyOutputFormat } from "../tools/policy-generators/types";
import { getTool } from "../../config/tools";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
  const normId = toolId.toLowerCase().trim().replace(/^codestation[-_]/, "").replace(/_/g, "-");

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

    // ----------------- Station 25: AI & Prompt Engineering -----------------
    case "ai-token-counter": {
      const model = (options.model ?? options.modelFamily ?? "gpt-4o") as AiModelId;
      const pricing = (options.inputPrice !== undefined || options.outputPrice !== undefined)
        ? {
            inputPricePer1M: options.inputPrice !== undefined ? Number(options.inputPrice) : undefined,
            outputPricePer1M: options.outputPrice !== undefined ? Number(options.outputPrice) : undefined,
          }
        : undefined;
      const result = countTokens(input, model, pricing);
      return JSON.stringify(result, null, 2);
    }
    case "json-repair": {
      const result = repairJson(input);
      return JSON.stringify(result, null, 2);
    }
    case "prompt-interpolator": {
      let records: Record<string, string>[] = [{}];
      if (options.records) {
        if (typeof options.records === "string") {
          try {
            records = JSON.parse(options.records);
          } catch {
            records = [{}];
          }
        } else if (Array.isArray(options.records)) {
          records = options.records;
        }
      }
      const result = interpolatePrompt({
        records,
        template: input || options.userTemplate || options.template || "",
        systemTemplate: options.systemTemplate ?? options.system,
        assistantTemplate: options.assistantTemplate ?? options.assistant,
      });
      return JSON.stringify(result, null, 2);
    }
    case "vector-similarity": {
      let vecA: number[] = [];
      let vecB: number[] = [];
      if (options.vecA && options.vecB) {
        vecA = Array.isArray(options.vecA) ? options.vecA : parseVectorInput(String(options.vecA));
        vecB = Array.isArray(options.vecB) ? options.vecB : parseVectorInput(String(options.vecB));
      } else {
        vecA = parseVectorInput(input);
        const bInput = options.vecB ?? options.vectorB ?? options.b ?? options.compare ?? "";
        vecB = Array.isArray(bInput) ? bInput : parseVectorInput(String(bInput));
      }
      const result = computeVectorSimilarity(vecA, vecB);
      return JSON.stringify(result, null, 2);
    }
    case "system-prompt-builder": {
      let config: SystemPromptConfig;
      if (typeof options === "object" && (options.role || options.roleName || options.mission || options.coreTask || options.tone || options.roleTone)) {
        config = {
          roleName: options.roleName ?? options.role ?? "Senior Technical Assistant",
          roleTone: options.roleTone ?? options.tone ?? "Technical, precise, and concise",
          background: options.background,
          coreTask: options.coreTask ?? options.mission ?? input ?? "Provide expert code review and architecture analysis.",
          xmlWrapping: Boolean(options.xmlWrapping ?? options.xml ?? true),
          chainOfThought: Boolean(options.chainOfThought ?? options.cot ?? false),
          outputFormat: (options.outputFormat ? String(options.outputFormat).toLowerCase() : "markdown") as "json" | "markdown" | "plain" | "code" | "custom",
          guardrails: Array.isArray(options.guardrails) ? options.guardrails : ["Do not make up facts", "Never expose private keys"],
          examples: Array.isArray(options.examples) ? options.examples : [],
          customConstraints: Array.isArray(options.customConstraints ?? options.customRules) ? options.customConstraints ?? options.customRules : [],
        };
      } else {
        try {
          config = JSON.parse(input);
        } catch {
          config = {
            roleName: "Developer Assistant",
            roleTone: "Technical, direct",
            coreTask: input || "Help developers build reliable applications.",
            xmlWrapping: true,
            chainOfThought: false,
            outputFormat: "markdown",
            guardrails: [],
            examples: [],
            customConstraints: [],
          };
        }
      }
      const result = buildSystemPrompt(config);
      return JSON.stringify(result, null, 2);
    }

    // ----------------- Station 24: WebPKI & Advanced Cryptography -----------------
    case "aes-crypto": {
      const mode = (options.mode ?? "encrypt").toLowerCase();
      const keyMode = options.keyMode === "raw" || options.rawKey ? "raw" : "passphrase";
      const keyLength = Number(options.keyLength ?? 256) === 128 ? 128 : 256;
      const keyOptions: AesKeyOptions = {
        mode: keyMode,
        keyLength,
        passphrase: options.passphrase ?? "codestation-secure-passphrase",
        rawKey: options.rawKey,
        salt: options.salt,
      };

      if (mode === "decrypt") {
        let payload: any;
        try {
          payload = typeof input === "string" ? JSON.parse(input) : input;
        } catch {
          payload = {
            ciphertext: input,
            iv: options.iv ?? "",
            tag: options.tag ?? "",
            salt: options.salt,
            aad: options.aad,
          };
        }
        const plaintext = await decryptAesGcm(payload, keyOptions);
        return JSON.stringify({ plaintext, success: true }, null, 2);
      } else {
        const result = await encryptAesGcm(input, {
          ...keyOptions,
          iv: options.iv,
          aad: options.aad,
        });
        return JSON.stringify(result, null, 2);
      }
    }
    case "rsa-key-generator": {
      const modulus = Number(options.modulusLength ?? options.bits ?? input ?? 2048) as 2048 | 3072 | 4096;
      const validModulus = [2048, 3072, 4096].includes(modulus) ? modulus : 2048;
      const keyPair = await generateRsaKeyPair(validModulus);
      return JSON.stringify(
        {
          modulusLength: keyPair.modulusLength,
          publicKeyPem: keyPair.publicKeyPem,
          privateKeyPem: keyPair.privateKeyPem,
          fingerprint: keyPair.fingerprint,
        },
        null,
        2
      );
    }
    case "jwt-signer-verifier": {
      const action = (options.action ?? (input.includes(".") && input.split(".").length === 3 && !options.secret ? "verify" : "sign")).toLowerCase();
      if (action === "verify") {
        const token = input || String(options.token ?? "");
        const secretOrKey = options.secret ?? options.publicKey ?? options.key ?? "";
        const verifyOptions = {
          clockSkew: options.clockSkew !== undefined ? Number(options.clockSkew) : (options.clockSkewSeconds !== undefined ? Number(options.clockSkewSeconds) : 60),
        };
        const verification = await verifyJwt(token, secretOrKey, verifyOptions);
        return JSON.stringify(verification, null, 2);
      } else {
        const header = options.header ? (typeof options.header === "string" ? JSON.parse(options.header) : options.header) : { alg: options.alg ?? "HS256", typ: "JWT" };
        let payload = options.payload;
        if (!payload) {
          try {
            payload = JSON.parse(input);
          } catch {
            payload = { sub: input || "developer", iat: Math.floor(Date.now() / 1000) };
          }
        } else if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = { sub: payload };
          }
        }
        const secretOrKey = options.secret ?? options.privateKey ?? "secret-key-1234567890";
        const token = await signJwt(header, payload, secretOrKey);
        return JSON.stringify({ token, header, payload }, null, 2);
      }
    }
    case "csr-inspector": {
      const csrDetails = await parseCsr(input);
      return JSON.stringify(csrDetails, null, 2);
    }
    case "csp-builder": {
      let directives: CspDirectives;
      if (options.directives && typeof options.directives === "object") {
        directives = options.directives;
      } else {
        try {
          directives = JSON.parse(input);
        } catch {
          directives = {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
          };
        }
      }
      const cspResult = buildCspHeader(directives);
      return JSON.stringify(cspResult, null, 2);
    }

    // ----------------- PDF Station (Watermark & Page Numberer) -----------------
    case "pdf-watermark": {
      const pdfBytes = base64ToUint8Array(input);
      const watermarkOpts: WatermarkOptions = {
        type: (options.type ?? "text") as "text" | "image",
        text: options.text ?? "CONFIDENTIAL",
        fontSize: options.fontSize ? Number(options.fontSize) : 48,
        color: options.color ?? "#ff0000",
        opacity: options.opacity ? Number(options.opacity) : 0.3,
        rotation: options.rotation ? Number(options.rotation) : 45,
        position: options.position ?? "center",
        pageRange: options.pageRange,
      };
      const resultBytes = await applyWatermark(pdfBytes, watermarkOpts);
      return JSON.stringify(
        {
          success: true,
          outputSize: resultBytes.byteLength,
          pdfBase64: uint8ArrayToBase64(resultBytes),
        },
        null,
        2
      );
    }
    case "pdf-page-numberer": {
      const pdfBytes = base64ToUint8Array(input);
      const pageOpts: PageNumberOptions = {
        format: options.format ?? "page-x-of-y",
        verticalPosition: options.verticalPosition ?? "footer",
        alignment: options.alignment ?? "center",
        fontFamily: options.fontFamily ?? "Helvetica",
        fontSize: options.fontSize ? Number(options.fontSize) : 10,
        color: options.color ?? "#000000",
        margin: options.margin ? Number(options.margin) : 28,
        startNumber: options.startNumber ? Number(options.startNumber) : 1,
        pageRange: options.pageRange,
        skipFirstPage: Boolean(options.skipFirstPage ?? false),
      };
      const resultBytes = await applyPageNumbers(pdfBytes, pageOpts);
      return JSON.stringify(
        {
          success: true,
          outputSize: resultBytes.byteLength,
          pdfBase64: uint8ArrayToBase64(resultBytes),
        },
        null,
        2
      );
    }

    // ----------------- Spreadsheet Station (SQL Engine) -----------------
    case "spreadsheet-sql-query": {
      const query = options.query ?? options.sql ?? "SELECT * FROM table";
      const result = await executeSql(input, query);
      return JSON.stringify(result, null, 2);
    }

    // ----------------- Policy Generators Station -----------------
    case "privacy-policy-generator":
    case "terms-and-conditions-generator":
    case "terms-conditions-generator":
    case "cookie-policy-generator":
    case "disclaimer-generator":
    case "refund-policy-generator": {
      const canonicalId = (normId === "terms-conditions-generator" ? "terms-and-conditions-generator" : normId) as PolicyToolId;
      const format = (options.format as PolicyOutputFormat) || "markdown";
      return generatePolicyText(canonicalId, format, options);
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
