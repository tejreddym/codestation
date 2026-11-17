"use client";

import { useState } from "react";
import { decodeBase64, decodeUrl, encodeBase64, encodeUrl, formatJson, minifyJson, validateJson, generatePassword, generateUuid, timestampToDate, countText, jsonToYaml, yamlToJson, jsonToCsv, csvToJson, jsonDiff, jsonTree, generateJsonSchema, testJsonPath, formatJsonLines, validateJsonLines, jsonToJsonLines, jsonLinesToJson, decodeJwt, encodeHtml, decodeHtml, encodeUnicode, decodeUnicode, encodeHex, decodeHex, digestText, generateRandomString, testRegex } from "@/lib/tools";
import { validateJsonAgainstSchema, escapeJson, unescapeJson, stableJson, jsonArrayToObject, jsonObjectToArray, inspectJson, jsonStats, csvFormat, validateCsv, analyzeCsvColumns, detectDelimiter, csvToTsv, tsvToCsv, csvToMarkdown, csvToHtml, cleanCsv, reorderCsv, filterCsv, deduplicateCsv, transposeCsv, jsonToXml, xmlToJson, jsonToToml, tomlToJson, yamlDiff, formatYaml, validateYaml, formatXml, validateXml, minifyXml } from "@/lib/tools/data-station";
import { runEncoding, type EncodingKind } from "@/lib/tools/encoding-station";
import { md5, sha1, sha384, hmac, crc32, checksum, compareHashes, hashFile, entropy, parseUuid, ulid, nanoid, secureRandomToken, secureRandomHex, secureRandomSecret } from "@/lib/tools/security-station";
import { getTool, type ToolId } from "@/config/tools";
import RangeGenerator from "./RangeGenerator";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import RegexStation from "./RegexStation";
import TextStation from "./TextStation";
import { GeneratorShell, ToolWorkbenchShell } from "./ToolWorkbenchShell";
import { Button } from "./ui/Button";
import { Checkbox, CodeArea, Select, TextInput } from "./ui/controls";
import { Field, Hint } from "./ui/Field";
import { Panel } from "./ui/Panel";
import { downloadBlob } from "./ui/useDownload";
import { useCopy } from "./ui/useCopy";
import ui from "./ui/ui.module.css";

const examples: Partial<Record<ToolId, string>> = { "json-formatter": '{"station":"Code Station","private":true}', "json-validator": '{"valid": true}', "json-minifier": '{\n  "fast": true\n}', "json-to-yaml": '{"name":"Code Station","private":true}', "yaml-to-json": "name: Code Station\nprivate: true", "json-to-csv": '[{"name":"Ada","role":"Engineer"},{"name":"Lin","role":"Designer"}]', "csv-to-json": "name,role\nAda,Engineer\nLin,Designer", "json-diff": '{"version":1}', "json-schema-generator": '{"name":"Code Station","version":1}', "json-schema-validator": '{"name":"Code Station","version":1}', "jsonpath-tester": '{"users":[{"name":"Ada"},{"name":"Lin"}]}', "json-escape": "line 1\nline 2", "json-key-sorter": '{"z":1,"a":{"y":2,"b":3}}', "json-array-to-object": '[{"id":"a","value":1},{"id":"b","value":2}]', "json-object-to-array": '{"a":1,"b":2}', "jsonl-formatter": '{"id":1}\n{"id":2}', "jsonl-validator": '{"id":1}\nnot json', "json-to-jsonl": '[{"id":1},{"id":2}]', "jsonl-to-json": '{"id":1}\n{"id":2}', "json-structure-inspector": '{"user":{"name":"Ada"}}', "json-statistics-analyzer": '{"items":[1,2,3],"active":true}', "csv-formatter": "name,role\nAda,Engineer", "csv-validator": "name,role\nAda,Engineer", "csv-column-analyzer": "name,age\nAda,36\nLin,", "csv-delimiter-detector": "name\trole\nAda\tEngineer", "csv-to-tsv": "name,role\nAda,Engineer", "tsv-to-csv": "name\trole\nAda\tEngineer", "csv-to-markdown": "name,role\nAda,Engineer", "csv-to-html": "name,role\nAda,Engineer", "csv-cleaner": " name , role \n Ada , Engineer ", "csv-column-reorderer": "name,role\nAda,Engineer", "csv-row-filter": "name,role\nAda,Engineer\nLin,Designer", "csv-deduplicator": "name,role\nAda,Engineer\nAda,Engineer", "csv-transposer": "a,b\n1,2", "json-to-xml": '{"user":{"name":"Ada"}}', "xml-to-json": "<user><name>Ada</name></user>", "json-to-toml": '{"title":"Code Station","active":true}', "toml-to-json": "title = \"Code Station\"\nactive = true", "yaml-diff": "name: Code Station", "yaml-formatter": "name: Code Station\nactive: true", "yaml-validator": "name: Code Station\nactive: true", "xml-formatter": "<root><name>Ada</name></root>", "xml-validator": "<root><name>Ada</name></root>", "xml-minifier": "<root>\n  <name>Ada</name>\n</root>", base64: "Code Station", "url-encoder": "https://codestation.in/tools?mode=local", "jwt-decoder": "eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vIn0.signature", "html-encoder": "<section>Code Station</section>", "html-decoder": "&lt;section&gt;Code Station&lt;/section&gt;", "unicode-converter": "Code Station 🚀", "hex-converter": "Code Station", "sha-256": "Code Station", "sha-512": "Code Station", "random-string": "", "regex-tester": "Code Station\nCode Tools", "timestamp-converter": "1710000000", "text-counter": "Paste text here to count it.", "binary-encoder-decoder": "Code Station 🚀", "ascii-converter": "Code Station", "base32-encoder": "Code Station", "base32-decoder": "IJQXGZJTGIQGK3TB", "base58-encoder": "Code Station", "base58-decoder": "2NEpo7TZRRrL", "base64-url-encoder": "Code Station?local=true", "base64-url-decoder": "Q29kZSBTdGF0aW9uP2xvY2FsPXRydWU", "data-uri-encoder": "Code Station", "data-uri-decoder": "data:text/plain;charset=utf-8,Code%20Station", "html-entity-encoder": "<section>Code Station</section>", "html-entity-decoder": "&lt;section&gt;Code Station&lt;/section&gt;", "unicode-escape-encoder": "Code Station 🚀", "unicode-escape-decoder": "Code Station \\ud83d\\ude80", "url-component-encoder": "Code Station?local=true", "url-component-decoder": "Code%20Station%3Flocal%3Dtrue", "punycode-converter": "münich.example", "hexadecimal-encoder": "Code Station", "hexadecimal-decoder": "43 6f 64 65 20 53 74 61 74 69 6f 6e", "octal-converter": "Code Station" };
const schemaExample = '{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}';

/* ── Helpers ─────────────────────────────────────────────────── */

function fileExtension(toolId: string): string {
  if (toolId.includes("json") || toolId.includes("jsonl") || toolId === "csv-to-json" || toolId === "xml-to-json" || toolId === "toml-to-json" || toolId === "yaml-to-json") return ".json";
  if (toolId.includes("csv") || toolId === "json-to-csv" || toolId === "tsv-to-csv") return ".csv";
  if (toolId.includes("tsv") || toolId === "csv-to-tsv") return ".tsv";
  if (toolId.includes("yaml") || toolId === "json-to-yaml") return ".yaml";
  if (toolId.includes("xml") || toolId === "json-to-xml") return ".xml";
  if (toolId.includes("toml") || toolId === "json-to-toml") return ".toml";
  if (toolId.includes("markdown")) return ".md";
  if (toolId.includes("html") && toolId !== "html-encoder" && toolId !== "html-decoder" && toolId !== "html-entity-encoder" && toolId !== "html-entity-decoder") return ".html";
  return ".txt";
}

/* ── Main component ──────────────────────────────────────────── */

export default function ToolWorkbench({ toolId }: { toolId: ToolId }) {
  const [input, setInput] = useState(examples[toolId] ?? "");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { copy } = useCopy();

  /* Password Generator options */
  const [passwordLength, setPasswordLength] = useState(16);
  const [passwordCount, setPasswordCount] = useState(1);
  const [passwordOptions, setPasswordOptions] = useState({ upper: true, lower: true, numbers: true, symbols: true, excludeAmbiguous: true });

  /* UUID / ULID / NanoID options */
  const [uuidCount, setUuidCount] = useState(1);
  const [ulidCount, setUlidCount] = useState(1);
  const [nanoidLength, setNanoidLength] = useState(21);
  const [nanoidCount, setNanoidCount] = useState(1);

  /* Secondary input for diff/schema/HMAC/hash-compare */
  const [secondaryInput, setSecondaryInput] = useState(schemaExample);

  /* JSON Formatter options */
  const [indentSize, setIndentSize] = useState(2);
  const [indentStyle, setIndentStyle] = useState<"spaces" | "tabs">("spaces");
  const [sortKeys, setSortKeys] = useState(false);

  /* JSON Key Sorter options */
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  /* JSON Array to Object key field */
  const [arrayKey, setArrayKey] = useState("id");

  /* CSV options */
  const [csvDelimiter, setCsvDelimiter] = useState(",");
  const [csvHasHeaders, setCsvHasHeaders] = useState(true);
  const [csvTrim, setCsvTrim] = useState(false);

  /* CSV Row Filter */
  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] = useState<"equals" | "contains" | "starts" | "ends">("contains");
  const [filterValue, setFilterValue] = useState("");

  /* XML options */
  const [xmlRootName, setXmlRootName] = useState("root");

  /* Regex / JSONPath */
  const [regexPattern, setRegexPattern] = useState("Code");
  const [regexFlags, setRegexFlags] = useState("gi");
  const [jsonPath, setJsonPath] = useState("$.users[*].name");

  /* Security options */
  const [algorithm, setAlgorithm] = useState("SHA-256");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [checksumAlgorithm, setChecksumAlgorithm] = useState<"SHA-256" | "SHA-384" | "SHA-512">("SHA-256");

  /* Secure token options */
  const [tokenLength, setTokenLength] = useState(32);
  const [tokenEncoding, setTokenEncoding] = useState<"base64url" | "hex">("base64url");

  /* ── Routing to sub-stations ────────────────────────────── */

  if (toolId === "random-number-generator") return <RangeGenerator />;
  if ((toolId as string) === "regex-tester" || toolId.startsWith("regex-")) return <RegexStation toolId={toolId} />;
  if ((toolId as string) === "text-counter" || toolId.startsWith("text-") || ["case-converter", "duplicate-line-remover", "sort-lines", "reverse-lines", "reverse-text", "whitespace-cleaner", "empty-line-remover", "prefix-suffix-adder", "find-replace", "text-diff", "slug-generator", "lorem-ipsum-generator", "random-text-generator", "url-extractor", "email-extractor", "number-extractor", "regex-line-extractor", "line-deduplicator", "line-shuffler", "text-normalizer", "tabs-to-spaces", "spaces-to-tabs", "line-ending-converter", "lf-to-crlf", "crlf-to-lf", "bom-detector", "bom-remover", "sentence-counter", "paragraph-counter", "character-counter-no-spaces"].includes(toolId as string)) return <TextStation toolId={toolId} />;

  /* ── Processing dispatch ────────────────────────────────── */

  const run = async (action: "primary" | "secondary" = "primary") => {
    setError(""); setMetadata(""); setNotice(""); setBusy(true);
    try {
      let result = "";
      let meta = "";

      /* ═══ JSON & Data Station ═══ */
      if (toolId === "json-formatter") {
        const indent = indentStyle === "tabs" ? "\t" : indentSize;
        let parsed = JSON.parse(input);
        if (sortKeys) parsed = JSON.parse(stableJson(parsed, 0));
        result = JSON.stringify(parsed, null, indent);
        meta = `✓ Valid JSON · ${result.split("\n").length} lines`;
      }
      else if (toolId === "json-validator") {
        try {
          const parsed = JSON.parse(input);
          result = JSON.stringify(parsed, null, 2);
          meta = "✓ Valid JSON";
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const lineMatch = msg.match(/position (\d+)/);
          result = "";
          meta = `✗ Invalid JSON`;
          throw new Error(`Invalid JSON: ${msg}${lineMatch ? ` (near character ${lineMatch[1]})` : ""}`);
        }
      }
      else if (toolId === "json-minifier") {
        result = minifyJson(input);
        meta = `✓ Valid JSON · ${result.length} characters`;
      }
      else if (toolId === "json-to-yaml") result = jsonToYaml(input);
      else if (toolId === "yaml-to-json") result = yamlToJson(input);
      else if (toolId === "json-to-csv") {
        result = jsonToCsv(input);
        const lines = result.split("\n");
        meta = `${lines.length - 1} rows · ${lines[0]?.split(",").length ?? 0} columns`;
      }
      else if (toolId === "csv-to-json") {
        result = csvToJson(input);
        const parsed = JSON.parse(result);
        meta = `${parsed.length} records converted`;
      }
      else if (toolId === "json-diff") {
        result = jsonDiff(input, secondaryInput);
        const parsed = JSON.parse(result);
        const countChanges = (obj: Record<string, unknown>): { added: number; removed: number; changed: number } => {
          let added = 0, removed = 0, changed = 0;
          for (const val of Object.values(obj)) {
            if (val && typeof val === "object" && "status" in (val as Record<string, unknown>)) {
              const status = (val as Record<string, string>).status;
              if (status === "added") added++;
              else if (status === "removed") removed++;
              else if (status === "changed") changed++;
            } else if (val && typeof val === "object") {
              const sub = countChanges(val as Record<string, unknown>);
              added += sub.added; removed += sub.removed; changed += sub.changed;
            }
          }
          return { added, removed, changed };
        };
        const counts = countChanges(parsed);
        meta = `${counts.added} added · ${counts.removed} removed · ${counts.changed} changed`;
      }
      else if (toolId === "json-tree-viewer") {
        result = jsonTree(input);
        meta = `✓ Valid JSON`;
      }
      else if (toolId === "json-schema-generator") {
        result = generateJsonSchema(input);
        const schema = JSON.parse(result);
        meta = `Generated schema · ${(schema.required ?? []).length} required fields · ${Object.keys(schema.properties ?? {}).length} properties`;
      }
      else if (toolId === "json-schema-validator") {
        const resultValue = validateJsonAgainstSchema(input, secondaryInput);
        result = JSON.stringify(resultValue, null, 2);
        meta = resultValue.valid ? "✓ Valid against schema" : `✗ ${resultValue.errors.length} validation error${resultValue.errors.length === 1 ? "" : "s"}`;
      }
      else if (toolId === "jsonpath-tester") {
        result = testJsonPath(input, jsonPath);
        const parsed = JSON.parse(result);
        meta = `${parsed.count} match${parsed.count === 1 ? "" : "es"}`;
      }
      else if (toolId === "json-escape") result = action === "primary" ? escapeJson(input) : unescapeJson(input);
      else if (toolId === "json-key-sorter") {
        const parsed = JSON.parse(input);
        const sorted = JSON.parse(stableJson(parsed, 0));
        if (sortDirection === "desc") {
          const reverseSort = <T,>(v: T): T => {
            if (Array.isArray(v)) return v.map(reverseSort) as T;
            if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().reverse().map(k => [k, reverseSort((v as Record<string, unknown>)[k])])) as T;
            return v;
          };
          result = JSON.stringify(reverseSort(sorted), null, 2);
        } else {
          result = JSON.stringify(sorted, null, 2);
        }
        meta = `Keys sorted ${sortDirection === "asc" ? "ascending" : "descending"}`;
      }
      else if (toolId === "json-array-to-object") {
        result = JSON.stringify(jsonArrayToObject(input, arrayKey), null, 2);
        const parsed = JSON.parse(result);
        meta = `${Object.keys(parsed).length} entries keyed by "${arrayKey}"`;
      }
      else if (toolId === "json-object-to-array") {
        result = JSON.stringify(jsonObjectToArray(input), null, 2);
        const parsed = JSON.parse(result);
        meta = `${parsed.length} entries`;
      }
      else if (toolId === "jsonl-formatter") {
        result = formatJsonLines(input);
        meta = `${result.split("\n\n").length} records formatted`;
      }
      else if (toolId === "jsonl-validator") {
        result = validateJsonLines(input);
        meta = result;
      }
      else if (toolId === "json-to-jsonl") {
        result = jsonToJsonLines(input);
        meta = `${result.split("\n").length} records`;
      }
      else if (toolId === "jsonl-to-json") {
        result = jsonLinesToJson(input);
        const parsed = JSON.parse(result);
        meta = `${parsed.length} records`;
      }
      else if (toolId === "json-structure-inspector") {
        result = JSON.stringify(inspectJson(input), null, 2);
        meta = "Structure inspected";
      }
      else if (toolId === "json-statistics-analyzer") {
        const stats = jsonStats(input);
        result = JSON.stringify(stats, null, 2);
        meta = `${stats.nodes} nodes · ${stats.objects} objects · ${stats.arrays} arrays · depth ${stats.maxDepth}`;
      }
      else if (toolId === "csv-formatter") {
        result = csvFormat(input, { delimiter: csvDelimiter, trim: csvTrim });
        meta = `${result.split("\n").length} rows`;
      }
      else if (toolId === "csv-validator") {
        const validation = validateCsv(input, { delimiter: csvDelimiter });
        result = JSON.stringify(validation, null, 2);
        meta = validation.valid ? `✓ Valid CSV` : `✗ ${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"}`;
      }
      else if (toolId === "csv-column-analyzer") {
        const analysis = analyzeCsvColumns(input, { delimiter: csvDelimiter });
        result = JSON.stringify(analysis, null, 2);
        meta = `${analysis.length} columns analyzed`;
      }
      else if (toolId === "csv-delimiter-detector") {
        const detected = detectDelimiter(input);
        const name = detected === "\t" ? "Tab" : detected === "," ? "Comma" : detected === ";" ? "Semicolon" : detected === "|" ? "Pipe" : JSON.stringify(detected);
        result = JSON.stringify({ delimiter: detected, name, confidence: "High" }, null, 2);
        meta = `Detected: ${name}`;
      }
      else if (toolId === "csv-to-tsv") {
        result = csvToTsv(input);
        meta = `${result.split("\n").length} rows · converted to TSV`;
      }
      else if (toolId === "tsv-to-csv") {
        result = tsvToCsv(input);
        meta = `${result.split("\n").length} rows · converted to CSV`;
      }
      else if (toolId === "csv-to-markdown") {
        result = csvToMarkdown(input);
        meta = `Markdown table generated`;
      }
      else if (toolId === "csv-to-html") {
        result = csvToHtml(input);
        meta = `HTML table generated`;
      }
      else if (toolId === "csv-cleaner") {
        result = cleanCsv(input, { delimiter: csvDelimiter, trim: true });
        meta = `CSV cleaned and trimmed`;
      }
      else if (toolId === "csv-column-reorderer") {
        const headers = input.split(/\r?\n/)[0].split(csvDelimiter);
        result = reorderCsv(input, headers.reverse(), { delimiter: csvDelimiter });
        meta = `Columns reordered: ${headers.join(", ")}`;
      }
      else if (toolId === "csv-row-filter") {
        const col = filterColumn || input.split(/\r?\n/)[0]?.split(csvDelimiter)[0] || "";
        result = filterCsv(input, col, (value) => {
          switch (filterOperator) {
            case "equals": return value === filterValue;
            case "contains": return value.toLowerCase().includes(filterValue.toLowerCase());
            case "starts": return value.toLowerCase().startsWith(filterValue.toLowerCase());
            case "ends": return value.toLowerCase().endsWith(filterValue.toLowerCase());
            default: return Boolean(value);
          }
        }, { delimiter: csvDelimiter });
        const matchRows = result.split("\n").length - 1;
        meta = `${matchRows} matching rows`;
      }
      else if (toolId === "csv-deduplicator") {
        const originalRows = input.split("\n").length;
        result = deduplicateCsv(input, undefined, { delimiter: csvDelimiter });
        const finalRows = result.split("\n").length;
        meta = `${originalRows - finalRows} duplicates removed · ${finalRows} rows remain`;
      }
      else if (toolId === "csv-transposer") {
        result = transposeCsv(input, { delimiter: csvDelimiter });
        const rows = result.split("\n").length;
        const cols = result.split("\n")[0]?.split(csvDelimiter).length ?? 0;
        meta = `Transposed to ${rows} × ${cols}`;
      }
      else if (toolId === "json-to-xml") {
        result = jsonToXml(input, xmlRootName);
        meta = `XML generated with root <${xmlRootName}>`;
      }
      else if (toolId === "xml-to-json") {
        result = xmlToJson(input);
        meta = `Converted to JSON`;
      }
      else if (toolId === "json-to-toml") result = jsonToToml(input);
      else if (toolId === "toml-to-json") result = tomlToJson(input);
      else if (toolId === "yaml-diff") {
        result = yamlDiff(input, secondaryInput);
        meta = JSON.parse(result).status === "unchanged" ? "Documents are identical" : "Documents differ";
      }
      else if (toolId === "yaml-formatter") result = formatYaml(input);
      else if (toolId === "yaml-validator") {
        const validation = validateYaml(input);
        result = JSON.stringify(validation, null, 2);
        meta = validation.valid ? "✓ Valid YAML" : `✗ Invalid YAML`;
      }
      else if (toolId === "xml-formatter") result = formatXml(input);
      else if (toolId === "xml-validator") {
        const validation = validateXml(input);
        result = JSON.stringify(validation, null, 2);
        meta = validation.valid ? "✓ Valid XML" : `✗ Invalid XML`;
      }
      else if (toolId === "xml-minifier") result = minifyXml(input);

      /* ═══ Encoding Station ═══ */
      else if (toolId === "binary-encoder-decoder" || toolId === "ascii-converter" || toolId === "punycode-converter" || toolId === "octal-converter") {
        const kind: EncodingKind = toolId === "binary-encoder-decoder" ? "binary" : toolId === "ascii-converter" ? "ascii" : toolId === "punycode-converter" ? "punycode" : "octal";
        result = runEncoding(kind, action === "primary" ? "encode" : "decode", input);
      }
      else if (toolId === "base32-encoder" || toolId === "base32-decoder") result = runEncoding("base32", toolId === "base32-encoder" ? "encode" : "decode", input);
      else if (toolId === "base58-encoder" || toolId === "base58-decoder") result = runEncoding("base58", toolId === "base58-encoder" ? "encode" : "decode", input);
      else if (toolId === "base64-url-encoder" || toolId === "base64-url-decoder") result = runEncoding("base64url", toolId === "base64-url-encoder" ? "encode" : "decode", input);
      else if (toolId === "data-uri-encoder" || toolId === "data-uri-decoder") {
        result = runEncoding("data-uri", toolId === "data-uri-encoder" ? "encode" : "decode", input);
        if (toolId === "data-uri-encoder") meta = `Data URI · ${result.length} characters`;
        else {
          const mimeMatch = input.match(/^data:([^;,]+)/);
          meta = mimeMatch ? `MIME type: ${mimeMatch[1]}` : "Data URI decoded";
        }
      }
      else if (toolId === "html-entity-encoder" || toolId === "html-entity-decoder") result = runEncoding("html-entity", toolId === "html-entity-encoder" ? "encode" : "decode", input);
      else if (toolId === "unicode-escape-encoder" || toolId === "unicode-escape-decoder") result = runEncoding("unicode-escape", toolId === "unicode-escape-encoder" ? "encode" : "decode", input);
      else if (toolId === "url-component-encoder" || toolId === "url-component-decoder") result = runEncoding("url-component", toolId === "url-component-encoder" ? "encode" : "decode", input);
      else if (toolId === "hexadecimal-encoder" || toolId === "hexadecimal-decoder") result = runEncoding("hex", toolId === "hexadecimal-encoder" ? "encode" : "decode", input);
      else if (toolId === "base64") result = action === "primary" ? encodeBase64(input) : decodeBase64(input);
      else if (toolId === "url-encoder") result = action === "primary" ? encodeUrl(input) : decodeUrl(input);
      else if (toolId === "jwt-decoder") {
        result = decodeJwt(input);
        meta = "⚠ Decoding does not verify the JWT signature.";
      }
      else if (toolId === "html-encoder") result = encodeHtml(input);
      else if (toolId === "html-decoder") result = decodeHtml(input);
      else if (toolId === "unicode-converter") result = action === "primary" ? encodeUnicode(input) : decodeUnicode(input);
      else if (toolId === "hex-converter") result = action === "primary" ? encodeHex(input) : decodeHex(input);

      /* ═══ Security Station ═══ */
      else if (toolId === "uuid-generator") {
        result = Array.from({ length: uuidCount }, () => generateUuid()).join("\n");
        meta = `${uuidCount} UUID v4 generated`;
      }
      else if (toolId === "password-generator") result = generatePasswords();
      else if (toolId === "sha-256" || toolId === "sha-512") {
        result = await digestText(input, toolId === "sha-256" ? "SHA-256" : "SHA-512");
        meta = `Algorithm: ${toolId === "sha-256" ? "SHA-256" : "SHA-512"} · ${result.length * 4} bits`;
      }
      else if (toolId === "random-string") {
        result = generateRandomString(passwordLength);
        meta = `${passwordLength} characters · secure random`;
      }
      else if (toolId === "md5-generator") {
        result = md5(input);
        meta = "⚠ MD5 is not secure for modern applications. Use SHA-256+.";
      }
      else if (toolId === "sha-1-generator") {
        result = sha1(input);
        meta = "⚠ SHA-1 is considered insecure. Use SHA-256+.";
      }
      else if (toolId === "sha-384-generator") {
        result = await sha384(input);
        meta = "Algorithm: SHA-384 · 384 bits";
      }
      else if (toolId === "hmac-generator") {
        result = await hmac(input, secondaryInput, algorithm as "SHA-256" | "SHA-384" | "SHA-512");
        meta = `Algorithm: HMAC-${algorithm}`;
      }
      else if (toolId === "crc32-generator") {
        result = crc32(input);
        meta = "CRC32 checksum · 32 bits";
      }
      else if (toolId === "checksum-generator") {
        result = await checksum(input, checksumAlgorithm);
        meta = `Algorithm: ${checksumAlgorithm}`;
      }
      else if (toolId === "hash-compare") {
        const match = compareHashes(input, secondaryInput);
        result = match ? "✓ Hashes match." : "✗ Hashes do not match.";
        meta = match ? "Constant-time comparison: equal" : "Constant-time comparison: not equal";
      }
      else if (toolId === "file-hash-generator") {
        if (!selectedFile) throw new Error("Choose a file before generating its hash.");
        result = await hashFile(await selectedFile.arrayBuffer(), algorithm as "SHA-256" | "SHA-384" | "SHA-512");
        meta = `File: ${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(1)} KB · ${algorithm}`;
      }
      else if (toolId === "entropy-calculator") {
        const ent = entropy(input);
        result = JSON.stringify({ ...ent, strengthCategory: ent.entropy < 28 ? "Very weak" : ent.entropy < 36 ? "Weak" : ent.entropy < 60 ? "Reasonable" : ent.entropy < 128 ? "Strong" : "Very strong", estimatedSearchSpace: `2^${ent.entropy.toFixed(1)}` }, null, 2);
        meta = `Entropy: ${ent.entropy.toFixed(1)} bits · ${ent.entropy < 28 ? "Very weak" : ent.entropy < 36 ? "Weak" : ent.entropy < 60 ? "Reasonable" : ent.entropy < 128 ? "Strong" : "Very strong"}`;
      }
      else if (toolId === "password-strength-checker") {
        const ent = entropy(input);
        const weaknesses: string[] = [];
        if (input.length < 8) weaknesses.push("Too short (< 8 characters)");
        if (!/[A-Z]/.test(input)) weaknesses.push("No uppercase letters");
        if (!/[a-z]/.test(input)) weaknesses.push("No lowercase letters");
        if (!/[0-9]/.test(input)) weaknesses.push("No digits");
        if (!/[^A-Za-z0-9]/.test(input)) weaknesses.push("No special characters");
        if (/(.)\1{2,}/.test(input)) weaknesses.push("Contains repeated characters");
        const strength = ent.entropy < 28 ? "Very weak" : ent.entropy < 36 ? "Weak" : ent.entropy < 60 ? "Fair" : ent.entropy < 128 ? "Strong" : "Very strong";
        result = JSON.stringify({ strength, entropy: `${ent.entropy.toFixed(1)} bits`, length: input.length, uniqueCharacters: ent.uniqueCharacters, weaknesses, recommendations: weaknesses.length ? ["Use a longer password", "Mix uppercase, lowercase, digits, and symbols"] : ["Your password meets basic complexity requirements"] }, null, 2);
        meta = `Strength: ${strength} · ${ent.entropy.toFixed(1)} bits · ${weaknesses.length} weakness${weaknesses.length === 1 ? "" : "es"}`;
      }
      else if (toolId === "ulid-generator") {
        result = Array.from({ length: ulidCount }, () => ulid()).join("\n");
        meta = `${ulidCount} ULID generated`;
      }
      else if (toolId === "nanoid-generator") {
        result = Array.from({ length: nanoidCount }, () => nanoid(nanoidLength)).join("\n");
        meta = `${nanoidCount} NanoID · ${nanoidLength} characters each`;
      }
      else if (toolId === "uuid-parser") {
        const parsed = parseUuid(input);
        result = JSON.stringify(parsed, null, 2);
        meta = `Version: ${parsed.version ?? "unknown"} · Variant: ${parsed.variant}`;
      }
      else if (toolId === "secure-token-generator") {
        result = tokenEncoding === "hex" ? secureRandomHex(tokenLength) : secureRandomToken(tokenLength);
        meta = `${tokenLength} characters · ${tokenEncoding} · secure random`;
      }
      else if (toolId === "hex-random-generator") {
        result = secureRandomHex(tokenLength);
        meta = `${tokenLength} hex characters · ${tokenLength / 2} bytes`;
      }
      else if (toolId === "secret-key-generator") {
        result = secureRandomSecret(tokenLength);
        meta = `${tokenLength} characters · printable secret`;
      }
      else if (toolId === "regex-tester") result = testRegex(regexPattern, regexFlags, input);
      else if (toolId === "timestamp-converter") {
        result = formatTimestampInput(input);
        meta = `Converted · ${Math.abs(Number(input.trim())) > 1e11 ? "milliseconds" : "seconds"}`;
      }
      else if (toolId === "text-counter") {
        const counts = countText(input);
        result = `Characters: ${counts.characters}\nCharacters (no spaces): ${counts.charactersNoSpaces}\nWords: ${counts.words}\nLines: ${counts.lines}`;
        meta = `${counts.words} words · ${counts.characters} characters`;
      }

      setOutput(result);
      if (meta) setMetadata(meta);
    } catch (cause) {
      setOutput(""); setError(cause instanceof Error ? cause.message : "Could not process this input.");
    } finally { setBusy(false); }
  };

  const generatePasswords = () => {
    if (!Number.isInteger(passwordLength) || passwordLength < 4 || passwordLength > 128) throw new Error("Length must be an integer between 4 and 128.");
    if (!Number.isInteger(passwordCount) || passwordCount < 1 || passwordCount > 20) throw new Error("Password count must be an integer between 1 and 20.");
    const ambiguous = "Il1O0o";
    let alphabet = "";
    if (passwordOptions.upper) alphabet += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (passwordOptions.lower) alphabet += "abcdefghijklmnopqrstuvwxyz";
    if (passwordOptions.numbers) alphabet += "0123456789";
    if (passwordOptions.symbols) alphabet += "!@#$%^&*()-_=+[]{};:,.?";
    if (passwordOptions.excludeAmbiguous) alphabet = [...alphabet].filter((character) => !ambiguous.includes(character)).join("");
    if (!alphabet) throw new Error("Choose at least one character set.");
    const result = Array.from({ length: passwordCount }, () => generatePassword({ length: passwordLength, alphabet })).join("\n");
    setMetadata(`${passwordCount} password${passwordCount > 1 ? "s" : ""} · ${passwordLength} characters · ${alphabet.length} character alphabet`);
    return result;
  };

  const copyOutput = async () => {
    if (!output) return;
    const ok = await copy(output);
    setNotice(ok ? "Copied to clipboard" : "Copy failed — select and copy manually");
  };

  const clear = () => { setInput(""); setOutput(""); setError(""); setMetadata(""); setNotice(""); setPasswordLength(16); setPasswordCount(1); setPasswordOptions({ upper: true, lower: true, numbers: true, symbols: true, excludeAmbiguous: true }); };

  /* ── Password Generator layout ─────────────────────────── */

  if (toolId === "password-generator") {
    const alphabetSize = [passwordOptions.upper ? 26 : 0, passwordOptions.lower ? 26 : 0, passwordOptions.numbers ? 10 : 0, passwordOptions.symbols ? 23 : 0].reduce((a, b) => a + b, 0) - (passwordOptions.excludeAmbiguous ? [passwordOptions.upper, passwordOptions.lower, passwordOptions.numbers].filter(Boolean).length * 2 : 0);
    return <GeneratorShell title="Password settings" output={output} error={error} metadata={metadata} onCopy={copyOutput} onDownload={() => downloadBlob(output, "passwords.txt")} onClear={clear}>
      <div className={ui.optionGrid}>
        <Field id="password-length" label="Length">
          <TextInput id="password-length" type="number" min="4" max="128" value={passwordLength} onChange={(event) => setPasswordLength(Number(event.target.value))} />
        </Field>
        <Field id="password-count" label="Passwords">
          <TextInput id="password-count" type="number" min="1" max="20" value={passwordCount} onChange={(event) => setPasswordCount(Number(event.target.value))} />
        </Field>
      </div>
      <PasswordStrengthMeter length={passwordLength} alphabetSize={Math.max(0, alphabetSize)} />
      <fieldset className={ui.fieldset}>
        <legend className={ui.legend}>Include characters</legend>
        <div className={ui.checkGrid}>
          {(["upper", "lower", "numbers", "symbols"] as const).map((key) => (
            <Checkbox key={key} id={`password-charset-${key}`} label={key === "upper" ? "Uppercase" : key === "lower" ? "Lowercase" : key === "numbers" ? "Numbers" : "Symbols"} checked={passwordOptions[key]} onChange={(event) => setPasswordOptions({ ...passwordOptions, [key]: event.target.checked })} />
          ))}
          <Checkbox id="password-exclude-ambiguous" label="Exclude ambiguous characters" checked={passwordOptions.excludeAmbiguous} onChange={(event) => setPasswordOptions({ ...passwordOptions, excludeAmbiguous: event.target.checked })} />
        </div>
      </fieldset>
      <Button variant="primary" onClick={() => run()}>Generate passwords</Button>
    </GeneratorShell>;
  }

  /* ── UUID Generator layout ─────────────────────────────── */

  if (toolId === "uuid-generator") return <GeneratorShell title="UUID v4 settings" output={output} error={error} metadata={metadata} onCopy={copyOutput} onDownload={() => downloadBlob(output, "uuids.txt")} onClear={clear}>
    <Field id="uuid-count" label="UUIDs to generate">
      <TextInput id="uuid-count" type="number" min="1" max="50" value={uuidCount} onChange={(event) => setUuidCount(Number(event.target.value))} />
    </Field>
    <Hint>Cryptographically secure RFC 4122 version 4 UUIDs. One UUID is generated per line.</Hint>
    <Button variant="primary" onClick={() => run()}>Generate UUIDs</Button>
  </GeneratorShell>;

  /* ── ULID Generator layout ─────────────────────────────── */

  if (toolId === "ulid-generator") return <GeneratorShell title="ULID settings" output={output} error={error} metadata={metadata} onCopy={copyOutput} onDownload={() => downloadBlob(output, "ulids.txt")} onClear={clear}>
    <Field id="ulid-count" label="ULIDs to generate">
      <TextInput id="ulid-count" type="number" min="1" max="50" value={ulidCount} onChange={(event) => setUlidCount(Number(event.target.value))} />
    </Field>
    <Hint>Sortable ULIDs with secure randomness generated locally.</Hint>
    <Button variant="primary" onClick={() => run()}>Generate ULIDs</Button>
  </GeneratorShell>;

  /* ── NanoID Generator layout ───────────────────────────── */

  if (toolId === "nanoid-generator") return <GeneratorShell title="NanoID settings" output={output} error={error} metadata={metadata} onCopy={copyOutput} onDownload={() => downloadBlob(output, "nanoids.txt")} onClear={clear}>
    <div className={ui.optionGrid}>
      <Field id="nanoid-length" label="Length">
        <TextInput id="nanoid-length" type="number" min="1" max="128" value={nanoidLength} onChange={(event) => setNanoidLength(Number(event.target.value))} />
      </Field>
      <Field id="nanoid-count" label="Count">
        <TextInput id="nanoid-count" type="number" min="1" max="50" value={nanoidCount} onChange={(event) => setNanoidCount(Number(event.target.value))} />
      </Field>
    </div>
    <Hint>Compact secure random identifiers generated locally.</Hint>
    <Button variant="primary" onClick={() => run()}>Generate NanoIDs</Button>
  </GeneratorShell>;

  /* ── Render per-tool options panel ──────────────────────── */

  const renderOptions = () => {
    /* JSON Formatter options */
    if (toolId === "json-formatter") return <fieldset className={ui.fieldset}>
      <legend className={ui.legend}>Formatting options</legend>
      <div className={ui.optionGrid}>
        <Field id="json-indent-size" label="Indent size">
          <Select id="json-indent-size" value={indentSize} onChange={(e) => setIndentSize(Number(e.target.value))}><option value="2">2</option><option value="4">4</option><option value="8">8</option></Select>
        </Field>
        <Field id="json-indent-style" label="Indent style">
          <Select id="json-indent-style" value={indentStyle} onChange={(e) => setIndentStyle(e.target.value as "spaces" | "tabs")}><option value="spaces">Spaces</option><option value="tabs">Tabs</option></Select>
        </Field>
      </div>
      <div className={ui.checkGrid}>
        <Checkbox label="Sort keys alphabetically" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
      </div>
    </fieldset>;

    /* JSON Key Sorter */
    if (toolId === "json-key-sorter") return <fieldset className={ui.fieldset}>
      <legend className={ui.legend}>Sort options</legend>
      <div className={ui.optionGrid}>
        <Field id="json-sort-direction" label="Direction">
          <Select id="json-sort-direction" value={sortDirection} onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}><option value="asc">Ascending (A→Z)</option><option value="desc">Descending (Z→A)</option></Select>
        </Field>
      </div>
    </fieldset>;

    /* JSON Array to Object */
    if (toolId === "json-array-to-object") return <fieldset className={ui.fieldset}>
      <legend className={ui.legend}>Key field</legend>
      <div className={ui.optionGrid}>
        <Field id="json-array-key" label="Object key property">
          <TextInput id="json-array-key" value={arrayKey} onChange={(e) => setArrayKey(e.target.value)} placeholder="id" />
        </Field>
      </div>
    </fieldset>;

    /* JSON to XML root name */
    if (toolId === "json-to-xml") return <fieldset className={ui.fieldset}>
      <legend className={ui.legend}>XML options</legend>
      <div className={ui.optionGrid}>
        <Field id="xml-root-name" label="Root element name">
          <TextInput id="xml-root-name" value={xmlRootName} onChange={(e) => setXmlRootName(e.target.value)} placeholder="root" />
        </Field>
      </div>
    </fieldset>;

    /* CSV tools options */
    if (["csv-formatter", "csv-validator", "csv-column-analyzer", "csv-cleaner", "csv-column-reorderer", "csv-deduplicator", "csv-transposer", "csv-to-tsv", "csv-to-markdown", "csv-to-html", "csv-to-json"].includes(toolId)) {
      return <fieldset className={ui.fieldset}>
        <legend className={ui.legend}>CSV options</legend>
        <div className={ui.optionGrid}>
          <Field id="csv-delimiter" label="Delimiter">
            <Select id="csv-delimiter" value={csvDelimiter} onChange={(e) => setCsvDelimiter(e.target.value)}><option value=",">Comma (,)</option><option value=";">Semicolon (;)</option><option value={"\t"}>Tab</option><option value="|">Pipe (|)</option></Select>
          </Field>
        </div>
        <div className={ui.checkGrid}>
          <Checkbox label="First row is header" checked={csvHasHeaders} onChange={(e) => setCsvHasHeaders(e.target.checked)} />
          <Checkbox label="Trim whitespace" checked={csvTrim} onChange={(e) => setCsvTrim(e.target.checked)} />
        </div>
      </fieldset>;
    }

    /* CSV Row Filter */
    if (toolId === "csv-row-filter") return <fieldset className={ui.fieldset}>
      <legend className={ui.legend}>Filter options</legend>
      <div className={ui.optionGrid}>
        <Field id="csv-filter-column" label="Column">
          <TextInput id="csv-filter-column" value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} placeholder="Column name" />
        </Field>
        <Field id="csv-filter-operator" label="Operator">
          <Select id="csv-filter-operator" value={filterOperator} onChange={(e) => setFilterOperator(e.target.value as typeof filterOperator)}><option value="equals">Equals</option><option value="contains">Contains</option><option value="starts">Starts with</option><option value="ends">Ends with</option></Select>
        </Field>
        <Field id="csv-filter-value" label="Value">
          <TextInput id="csv-filter-value" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="Filter value" />
        </Field>
      </div>
    </fieldset>;

    /* JSONPath Tester */
    if (toolId === "jsonpath-tester") return <div className={ui.optionGrid}>
      <Field id="jsonpath-expression" label="JSONPath expression">
        <TextInput id="jsonpath-expression" value={jsonPath} onChange={(event) => setJsonPath(event.target.value)} placeholder="$.users[*].name" />
      </Field>
    </div>;

    /* Checksum Generator algorithm selection */
    if (toolId === "checksum-generator") return <fieldset className={ui.fieldset}>
      <legend className={ui.legend}>Algorithm</legend>
      <div className={ui.optionGrid}>
        <Field id="checksum-algorithm" label="Hash algorithm">
          <Select id="checksum-algorithm" value={checksumAlgorithm} onChange={(e) => setChecksumAlgorithm(e.target.value as typeof checksumAlgorithm)}><option value="SHA-256">SHA-256</option><option value="SHA-384">SHA-384</option><option value="SHA-512">SHA-512</option></Select>
        </Field>
      </div>
    </fieldset>;

    /* Secure Token / Hex Random / Secret Key length */
    if (["secure-token-generator", "hex-random-generator", "secret-key-generator", "random-string"].includes(toolId)) return <fieldset className={ui.fieldset}>
      <legend className={ui.legend}>Options</legend>
      <div className={ui.optionGrid}>
        <Field id="token-length" label="Length">
          <TextInput id="token-length" type="number" min="1" max="512" value={tokenLength} onChange={(e) => setTokenLength(Number(e.target.value))} />
        </Field>
        {toolId === "secure-token-generator" && <Field id="token-encoding" label="Encoding">
          <Select id="token-encoding" value={tokenEncoding} onChange={(e) => setTokenEncoding(e.target.value as typeof tokenEncoding)}><option value="base64url">Base64URL</option><option value="hex">Hexadecimal</option></Select>
        </Field>}
      </div>
    </fieldset>;

    /* HMAC options */
    if (toolId === "hmac-generator") return <div className={ui.optionGrid}>
      <Field id="hmac-secret" label="Secret">
        <TextInput id="hmac-secret" type="password" value={secondaryInput} onChange={(event) => setSecondaryInput(event.target.value)} placeholder="HMAC secret key" />
      </Field>
      <Field id="hmac-algorithm" label="Algorithm">
        <Select id="hmac-algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option></Select>
      </Field>
    </div>;

    /* Hash Compare */
    if (toolId === "hash-compare") return <div className={ui.optionGrid}>
      <Field id="hash-compare-value" label="Compare hash">
        <TextInput id="hash-compare-value" value={secondaryInput} onChange={(event) => setSecondaryInput(event.target.value)} placeholder="Expected hash" />
      </Field>
    </div>;

    /* File Hash Generator */
    if (toolId === "file-hash-generator") return <div className={ui.optionGrid}>
      <Field id="file-hash-file" label="File">
        <TextInput id="file-hash-file" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
      </Field>
      <Field id="file-hash-algorithm" label="Algorithm">
        <Select id="file-hash-algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option></Select>
      </Field>
      {selectedFile && <Hint>File: {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB</Hint>}
    </div>;

    /* Diff / Schema secondary input */
    if (["json-diff", "yaml-diff"].includes(toolId) || toolId === "json-schema-validator") return <Panel title={toolId === "json-schema-validator" ? "JSON Schema" : "Compare with"}>
      <CodeArea className={ui.codeAreaCompact} value={secondaryInput} onChange={(event) => setSecondaryInput(event.target.value)} aria-label={toolId === "json-schema-validator" ? "JSON Schema" : "Comparison input"} />
    </Panel>;

    return null;
  };

  /* ── Action button label ───────────────────────────────── */

  const toolMeta = getTool(toolId);
  const pair = toolMeta?.pairedTool ? getTool(toolMeta.pairedTool) : undefined;
  const label = toolMeta?.direction === "reverse" ? "Decode" : toolMeta?.direction === "forward" || ["base64", "url-encoder", "unicode-converter", "hex-converter", "json-escape", "binary-encoder-decoder", "ascii-converter", "punycode-converter", "octal-converter"].includes(toolId) ? "Encode" : ["json-validator", "jsonl-validator", "json-schema-validator", "csv-validator", "yaml-validator", "xml-validator"].includes(toolId) ? "Validate" : ["md5-generator", "sha-1-generator", "sha-384-generator", "sha-256", "sha-512", "crc32-generator", "checksum-generator", "hmac-generator", "file-hash-generator"].includes(toolId) ? "Generate hash" : ["ulid-generator", "nanoid-generator", "random-number-generator", "secure-token-generator", "hex-random-generator", "secret-key-generator"].includes(toolId) ? "Generate" : toolId === "json-minifier" || toolId === "xml-minifier" ? "Minify" : toolId === "json-formatter" ? "Format" : toolId === "json-to-yaml" ? "Convert to YAML" : toolId === "yaml-to-json" ? "Convert to JSON" : toolId === "json-to-csv" ? "Convert to CSV" : toolId === "csv-to-json" ? "Convert to JSON" : toolId === "json-to-jsonl" ? "Convert to JSON Lines" : toolId === "jsonl-to-json" ? "Convert to JSON" : toolId === "jsonl-formatter" ? "Format records" : toolId === "json-key-sorter" ? "Sort keys" : toolId === "json-array-to-object" ? "Convert to object" : toolId === "json-object-to-array" ? "Convert to array" : toolId === "json-to-xml" ? "Convert to XML" : toolId === "xml-to-json" ? "Convert to JSON" : toolId === "json-to-toml" ? "Convert to TOML" : toolId === "toml-to-json" ? "Convert to JSON" : toolId === "entropy-calculator" ? "Calculate entropy" : toolId === "password-strength-checker" ? "Check strength" : toolId === "uuid-parser" ? "Parse UUID" : "Process";

  /* ── Render ─────────────────────────────────────────────── */

  const secondaryLabel = ["base64", "url-encoder", "unicode-converter", "hex-converter", "binary-encoder-decoder", "ascii-converter", "punycode-converter", "octal-converter"].includes(toolId)
    ? "Decode"
    : toolId === "json-escape"
      ? "Unescape"
      : undefined;

  return <ToolWorkbenchShell
    pair={pair ? { slug: pair.slug, name: pair.name } : undefined}
    direction={pair ? <>{toolMeta?.inputFormat} → {toolMeta?.outputFormat}</> : undefined}
    options={renderOptions()}
    input={input}
    onInputChange={setInput}
    onLoadExample={() => setInput(examples[toolId] ?? "")}
    output={output}
    outputEmpty="Your result will appear here."
    onCopy={copyOutput}
    onDownload={() => downloadBlob(output, `${toolId}${fileExtension(toolId)}`)}
    primaryLabel={label}
    onPrimary={() => run()}
    busy={busy}
    secondaryLabel={secondaryLabel}
    onSecondary={secondaryLabel ? () => run("secondary") : undefined}
    onClear={clear}
    metadata={metadata}
    error={error}
    notice={notice}
    privacy="↳ Runs locally in your browser. Nothing is sent to Code Station."
  />;
}

function formatTimestampInput(input: string) {
  const value = Number(input.trim());
  if (!Number.isFinite(value)) throw new Error("Enter a Unix timestamp in seconds or milliseconds.");
  const unit = Math.abs(value) > 1e11 ? "milliseconds" : "seconds";
  const date = timestampToDate(value, unit);
  return `ISO 8601: ${date.toISOString()}\nUTC: ${date.toUTCString()}\nLocal: ${date.toString()}\nUnit: ${unit}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}\nUnix milliseconds: ${date.getTime()}`;
}
