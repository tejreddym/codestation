import { convertApi, parseCurl, type RequestModel } from "./api/curl";

export type CurlTargetLanguage = "fetch" | "axios" | "python" | "go";

export interface CurlToCodeOptions {
  redactAuth?: boolean;
}

function goEscapeString(str: string): string {
  return JSON.stringify(str);
}

function generateGoHttp(req: RequestModel): string {
  const lines: string[] = [
    'package main',
    '',
    'import (',
    '\t"fmt"',
    '\t"io"',
    '\t"net/http"',
  ];

  if (req.body !== undefined && req.body !== "") {
    lines.push('\t"strings"');
  }

  lines.push(')', '', 'func main() {', '\tclient := &http.Client{}', '');

  if (req.body !== undefined && req.body !== "") {
    lines.push(`\tbody := strings.NewReader(${goEscapeString(req.body)})`);
    lines.push(`\treq, err := http.NewRequest(${goEscapeString(req.method)}, ${goEscapeString(req.url)}, body)`);
  } else {
    lines.push(`\treq, err := http.NewRequest(${goEscapeString(req.method)}, ${goEscapeString(req.url)}, nil)`);
  }

  lines.push('\tif err != nil {', '\t\tpanic(err)', '\t}', '');

  if (req.headers.length > 0) {
    for (const [name, val] of req.headers) {
      lines.push(`\treq.Header.Set(${goEscapeString(name)}, ${goEscapeString(val)})`);
    }
    lines.push('');
  }

  lines.push(
    '\tresp, err := client.Do(req)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tdefer resp.Body.Close()',
    '',
    '\tresBody, err := io.ReadAll(resp.Body)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '',
    '\tfmt.Println(string(resBody))',
    '}'
  );

  return lines.join("\n");
}

function preprocessCurlCommand(cmd: string): { processed: string; warnings: string[] } {
  let processed = cmd;
  const warnings: string[] = [];

  // 1. Detect -k or --insecure
  if (/(?:^|\s)(?:-k|--insecure)(?:\s|$)/.test(processed)) {
    warnings.push("TLS certificate verification disabled (--insecure).");
    processed = processed.replace(/(?:^|\s)(?:-k|--insecure)(?=\s|$)/g, " ");
  }

  // 2. Detect -L or --location (redirects)
  if (/(?:^|\s)(?:-L|--location)(?:\s|$)/.test(processed)) {
    warnings.push("Follow redirects requested (--location).");
    processed = processed.replace(/(?:^|\s)(?:-L|--location)(?=\s|$)/g, " ");
  }

  // 3. Detect --compressed
  if (/(?:^|\s)--compressed(?:\s|$)/.test(processed)) {
    warnings.push("Request compression requested (--compressed).");
    processed = processed.replace(/(?:^|\s)--compressed(?=\s|$)/g, " -H 'Accept-Encoding: gzip, deflate, br'");
  }

  // 4. Detect -b or --cookie
  const cookieMatch = processed.match(/(?:^|\s)(?:-b|--cookie)\s+(['"]?)([^'"\s]+)\1/);
  if (cookieMatch) {
    const cookieVal = cookieMatch[2];
    processed = processed.replace(cookieMatch[0], ` -H 'Cookie: ${cookieVal}'`);
  }

  // 5. Detect -F or --form multipart
  const formMatch = processed.match(/(?:^|\s)(?:-F|--form)\s+(['"]?)([^'"]+)\1/);
  if (formMatch) {
    warnings.push("Multipart form data parsed into request body.");
    const formVal = formMatch[2];
    processed = processed.replace(formMatch[0], ` -d '${formVal}' -H 'Content-Type: multipart/form-data'`);
  }

  // 6. Detect unsupported flags e.g. --retry, --max-time, etc.
  const unknownFlags = processed.match(/(?:^|\s)(--(?:retry|max-time|connect-timeout|retry-delay)\s+[^\s]+)/g);
  if (unknownFlags) {
    for (const flag of unknownFlags) {
      warnings.push(`Unsupported option ${flag.trim()} omitted from code generation.`);
      processed = processed.replace(flag, " ");
    }
  }

  return { processed: processed.replace(/\s+/g, " ").trim(), warnings };
}

function redactAuthTokens(code: string): string {
  // Redact Bearer tokens: Bearer <token> -> Bearer [REDACTED]
  let result = code.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{8,}/g, "Bearer [REDACTED]");
  // Redact Basic tokens: Basic <base64> -> Basic [REDACTED]
  result = result.replace(/Basic\s+[a-zA-Z0-9+/=]{10,}/g, "Basic [REDACTED]");
  return result;
}

export async function curlToCode(
  curlCommand: string,
  target: CurlTargetLanguage = "fetch",
  options: CurlToCodeOptions = { redactAuth: true }
): Promise<{ code: string; language: string; target: CurlTargetLanguage; warnings: string[] }> {
  const trimmed = curlCommand.trim();
  if (!trimmed) {
    throw new Error("cURL command cannot be empty.");
  }

  const { processed, warnings: prepWarnings } = preprocessCurlCommand(trimmed);

  let generatedCode = "";
  let lang = "typescript";
  const allWarnings = [...prepWarnings];

  if (target === "go") {
    const model = parseCurl(processed);
    generatedCode = generateGoHttp(model);
    lang = "go";
    if (model.warnings) allWarnings.push(...model.warnings);
  } else {
    const mapTarget: Record<string, "curl-to-fetch" | "curl-to-axios" | "curl-to-python-requests"> = {
      fetch: "curl-to-fetch",
      axios: "curl-to-axios",
      python: "curl-to-python-requests",
    };

    const toolId = mapTarget[target] || "curl-to-fetch";
    const result = await convertApi(toolId, { command: processed });
    generatedCode = result.text;
    lang = target === "python" ? "python" : "typescript";
    if (result.warnings) allWarnings.push(...result.warnings);
  }

  if (options.redactAuth !== false) {
    generatedCode = redactAuthTokens(generatedCode);
  }

  return {
    code: generatedCode,
    language: lang,
    target,
    warnings: allWarnings,
  };
}
