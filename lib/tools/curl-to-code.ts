import { convertApi, parseCurl, type RequestModel } from "./api/curl";

export type CurlTargetLanguage = "fetch" | "axios" | "python" | "go";

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

export async function curlToCode(
  curlCommand: string,
  target: CurlTargetLanguage = "fetch"
): Promise<{ code: string; language: string; target: CurlTargetLanguage; warnings: string[] }> {
  const trimmed = curlCommand.trim();
  if (!trimmed) {
    throw new Error("cURL command cannot be empty.");
  }

  if (target === "go") {
    const model = parseCurl(trimmed);
    const code = generateGoHttp(model);
    return {
      code,
      language: "go",
      target: "go",
      warnings: model.warnings || [],
    };
  }

  const mapTarget: Record<string, "curl-to-fetch" | "curl-to-axios" | "curl-to-python-requests"> = {
    fetch: "curl-to-fetch",
    axios: "curl-to-axios",
    python: "curl-to-python-requests",
  };

  const toolId = mapTarget[target] || "curl-to-fetch";
  const result = await convertApi(toolId, { command: trimmed });
  const lang = target === "python" ? "python" : "typescript";

  return {
    code: result.text,
    language: lang,
    target,
    warnings: result.warnings || [],
  };
}
