import { ApiError, apiResult, type ApiResult, type ApiValues } from "./types";
export { executeApiRequest } from "./request";
import { buildGraphqlQuery, formatVariables, graphqlFormat } from "./graphql";
import { boundedResult, buildBasicAuth, buildBearer, buildHeaderBlock, buildRawHttp, buildRest, parseHeaderBlock, rows, text, validateApiInput } from "./request";
import { parseJson, runJsonTool } from "../json-data/json";

function buildJson(values: ApiValues): ApiResult {
  const fields = rows<Record<string, unknown>>(values.fields, "fields");
  const body: Record<string, unknown> = Object.create(null);
  fields.forEach((field, index) => {
    const key = text(field.key, `fields row ${index + 1} key`);
    const raw = text(field.value, `fields row ${index + 1} value`);
    if (Object.hasOwn(body, key)) throw new ApiError(`Duplicate key in row ${index + 1}.`, "fields");
    switch (field.valueType ?? "String") {
      case "String": body[key] = raw; break;
      case "Number": {
        if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(raw) || !Number.isFinite(Number(raw))) throw new ApiError(`Row ${index + 1} must contain a finite JSON number.`, "fields");
        try { body[key] = parseJson(raw); } catch { throw new ApiError(`Row ${index + 1} number cannot be represented without precision loss. Use a String for exact large values.`, "fields"); } break;
      }
      case "Boolean": if (raw !== "true" && raw !== "false") throw new ApiError(`Row ${index + 1} Boolean must be true or false.`, "fields"); body[key] = raw === "true"; break;
      case "Null": body[key] = null; break;
      case "JSON object": case "JSON array": {
        let nested: unknown;
        try { nested = parseJson(raw); } catch { throw new ApiError(`Row ${index + 1} contains invalid or ambiguous JSON; duplicate keys and lossy numbers are not supported.`, "fields"); }
        if (field.valueType === "JSON object" ? !nested || typeof nested !== "object" || Array.isArray(nested) : !Array.isArray(nested)) throw new ApiError(`Row ${index + 1} must contain a ${field.valueType}.`, "fields");
        body[key] = nested; break;
      }
      default: throw new ApiError(`Row ${index + 1} has an unsupported value type.`, "fields");
    }
  });
  const formatted = fields.length ? `{\n${fields.map(field => `  ${JSON.stringify(field.key)}: ${JSON.stringify(body[String(field.key)], null, 2).replace(/\n/g, "\n  ")}`).join(",\n")}\n}` : "{}";
  return apiResult({ body: formatted, formatted, object: body, count: fields.length });
}

// Source tokenization only: this never creates a DOM, loads a resource, or executes content.
function markupTokens(source: string): string[] {
  const tokens: string[] = []; let start = 0; let cursor = 0;
  while (cursor < source.length) {
    if (source[cursor] !== "<") { cursor++; continue; }
    if (cursor > start) tokens.push(source.slice(start, cursor));
    start = cursor;
    const marker = source.startsWith("<!--", cursor) ? "-->" : source.startsWith("<![CDATA[", cursor) ? "]]>" : source.startsWith("<?", cursor) ? "?>" : undefined;
    if (marker) { const end = source.indexOf(marker, cursor + 2); if (end < 0) { tokens.push(source.slice(start)); return tokens; } cursor = end + marker.length; }
    else {
      let quote = ""; cursor++;
      while (cursor < source.length) { const char = source[cursor++]; if (quote) { if (char === quote) quote = ""; } else if (char === '"' || char === "'") quote = char; else if (char === ">") break; }
    }
    tokens.push(source.slice(start, cursor)); start = cursor;
  }
  if (start < source.length) tokens.push(source.slice(start));
  return tokens;
}

function indentMarkup(tokens: string[], html: boolean): string {
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  type Node = { raw: string; opening?: string; closing?: string; children?: Node[] };
  let cursor = 0;
  const parse = (level: number): Node => {
    if (level > 100) throw new ApiError("Markup nesting exceeds the 100-level limit.", "body");
    const start = cursor; const token = tokens[cursor++]; const match = token.match(/^<([A-Za-z_:][\w:.-]*)/);
    if (!match || /\/\s*>$/.test(token) || (html && voidTags.has(match[1].toLowerCase()))) return { raw: token };
    const children: Node[] = [];
    while (cursor < tokens.length && !/^<\//.test(tokens[cursor])) children.push(parse(level + 1));
    const closing = tokens[cursor++]; const closingName = closing?.match(/^<\/([^\s>]+)/)?.[1];
    if (!closingName || (html ? closingName.toLowerCase() !== match[1].toLowerCase() : closingName !== match[1])) throw new ApiError("HTML with omitted or mismatched closing tags is preserved as source.", "body");
    return { raw: tokens.slice(start, cursor).join(""), opening: token, closing, children };
  };
  const render = (node: Node, level: number): string => {
    const prefix = "  ".repeat(level);
    if (!node.children || !node.opening || !node.closing) return prefix + node.raw;
    const hasElements = node.children.some(child => /^<[A-Za-z_:]/.test(child.raw));
    const hasText = node.children.some(child => (!child.raw.startsWith("<") && !!child.raw.trim()) || child.raw.startsWith("<![CDATA["));
    if (!hasElements || hasText) return prefix + node.raw;
    return `${prefix}${node.opening}\n${node.children.filter(child => child.raw.trim()).map(child => render(child, level + 1)).join("\n")}\n${prefix}${node.closing}`;
  };
  const roots: Node[] = []; while (cursor < tokens.length) roots.push(parse(0));
  return roots.filter(node => node.raw.trim()).map(node => render(node, 0)).join("\n");
}

async function formatResponse(values: ApiValues): Promise<ApiResult> {
  const body = text(values.body ?? values.response, "body");
  let format = text(values.format ?? "Auto Detect", "format");
  if (!["Auto Detect", "JSON", "XML", "HTML", "Text"].includes(format)) throw new ApiError("Select a supported response format.", "format");
  if (format === "Auto Detect") {
    try { JSON.parse(body); format = "JSON"; }
    catch { format = /^\s*(?:<!doctype\s+html|<(?:html|head|body|div|span|p|h[1-6]|script|style|img|a|ul|ol|li|table|br|input|section|article|main|form)\b)/i.test(body) ? "HTML" : /^\s*<(?:\?xml\b|[A-Za-z_:])/.test(body) ? "XML" : "Text"; }
  }
  let formatted = body; let warnings: string[] | undefined;
  if (format === "JSON") {
    try { formatted = runJsonTool("json-formatter", { input: body }).text; }
    catch { throw new ApiError("Response body is not valid JSON.", "body"); }
  } else if (format === "XML") {
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(body)) throw new ApiError("DOCTYPE and entity declarations are not supported. XML is parsed locally without external entities or network access.", "body");
    const { SaxesParser } = await import("saxes");
    const parser = new SaxesParser({ xmlns: true });
    parser.on("error", () => { throw new ApiError("Response body is not well-formed XML. Check tags, attributes, and entities.", "body"); });
    parser.write(body).close();
    const tokens = markupTokens(body);
    if (/xml:space\s*=\s*["']preserve["']/.test(body)) warnings = ["XML with xml:space=preserve is kept unchanged to preserve significant whitespace."];
    else formatted = indentMarkup(tokens, false);
  } else if (format === "HTML") {
    if (/<(?:script|style|pre|textarea)\b/i.test(body)) warnings = ["HTML raw-text and preformatted content is kept unchanged; source is never rendered or executed."];
    else { try { formatted = indentMarkup(markupTokens(body), true); } catch (error) { if (error instanceof ApiError && error.message.startsWith("HTML with")) warnings = [error.message]; else throw error; } }
  }
  return apiResult({ format, formatted }, warnings);
}

/** All tools in this dispatcher are local. Only executeApiRequest may use fetch. */
export async function localApi(id: string, values: ApiValues): Promise<ApiResult> {
  validateApiInput(values);
  let result: ApiResult;
  switch (id) {
    case "http-header-builder": result = buildHeaderBlock(values); break;
    case "http-header-parser": result = parseHeaderBlock(values); break;
    case "rest-api-request-builder": result = buildRest(values); break;
    case "http-request-builder": result = buildRawHttp(values); break;
    case "json-request-body-builder": result = buildJson(values); break;
    case "api-response-formatter": result = await formatResponse(values); break;
    case "graphql-formatter": result = graphqlFormat(values); break;
    case "graphql-query-builder": result = buildGraphqlQuery(values); break;
    case "graphql-variables-formatter": result = formatVariables(values); break;
    case "basic-auth-header-generator": result = buildBasicAuth(values); break;
    case "bearer-token-header-generator": result = buildBearer(values); break;
    default: throw new ApiError("Unknown local API tool.");
  }
  if (id === "http-header-builder") result.text = `${result.data?.raw ?? ""}\n\n${result.data?.javascript ?? ""}`;
  if (id === "http-header-parser") result.text = JSON.stringify({ entries: (result.data?.entries as Record<string, unknown>[] ?? []).map(entry => ({ name: entry.name, value: entry.value })), count: result.data?.count }, null, 2);
  if (id === "graphql-variables-formatter") result.text = JSON.stringify({ formatted: result.data?.valid ? result.data.formatted : "", status: result.data?.valid ? "Valid" : "Invalid" }, null, 2);
  return boundedResult(result);
}
