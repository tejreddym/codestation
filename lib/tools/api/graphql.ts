import { ApiError, apiResult, type ApiResult, type ApiValues } from "./types";
import { API_ROW_LIMIT, API_TEXT_LIMIT, rows, text } from "./request";
import { runJsonTool } from "../json-data/json";

type Token = { kind: "name" | "string" | "number" | "punct" | "comment"; value: string; position: number };

function lex(source: string): Token[] {
  if (source.length > API_TEXT_LIMIT) throw new ApiError("GraphQL exceeds the 200,000 character limit.", "query");
  const tokens: Token[] = []; let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (/[ \t\r\n,]/.test(c) || c === "\ufeff") { i++; continue; }
    if (tokens.length > 20_000) throw new ApiError("GraphQL exceeds the 20,000-token limit.", "query");
    if (c === "#") { const start = i; while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i++; tokens.push({ kind: "comment", value: source.slice(start, i), position: start }); continue; }
    if (source.startsWith("...", i)) { tokens.push({ kind: "punct", value: "...", position: i }); i += 3; continue; }
    if ("!$():=@[]{|}&".includes(c)) { tokens.push({ kind: "punct", value: c, position: i++ }); continue; }
    if (c === '"') {
      if (source.startsWith('"""', i)) {
        const start = i; i += 3; let closed = false;
        while (i < source.length) { if (source.startsWith('\\"""', i)) { i += 4; continue; } if (source.startsWith('"""', i)) { i += 3; closed = true; break; } i++; }
        if (!closed) throw new ApiError(`Unterminated block string near character ${start + 1}.`, "query");
        tokens.push({ kind: "string", value: source.slice(start, i), position: start }); continue;
      }
      const start = i++; let escaped = false; let closed = false;
      while (i < source.length) { const char = source[i++]; if (escaped) { escaped = false; continue; } if (char === "\\") { escaped = true; continue; } if (char === '"') { closed = true; break; } if (char === "\n" || char === "\r") break; }
      if (!closed) throw new ApiError(`Unterminated string near character ${start + 1}.`, "query");
      try { JSON.parse(source.slice(start, i)); } catch { throw new ApiError(`Invalid string escape near character ${start + 1}.`, "query"); }
      tokens.push({ kind: "string", value: source.slice(start, i), position: start }); continue;
    }
    const number = source.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (number) { const end = i + number[0].length; if (/[._0-9A-Za-z]/.test(source[end] ?? "")) throw new ApiError(`Invalid number near character ${i + 1}.`, "query"); tokens.push({ kind: "number", value: number[0], position: i }); i = end; continue; }
    const name = source.slice(i).match(/^[_A-Za-z][_0-9A-Za-z]*/);
    if (name) { tokens.push({ kind: "name", value: name[0], position: i }); i += name[0].length; continue; }
    throw new ApiError(`Unsupported GraphQL character '${c}' near character ${i + 1}.`, "query");
  }
  return tokens;
}

/** A bounded executable-document parser; no schema or resolver evaluation. */
class GraphqlParser {
  private cursor = 0;
  private nesting = 0;
  constructor(private tokens: Token[]) {}
  private peek(value?: string): boolean { const next = this.tokens[this.cursor]; return !!next && (value === undefined || next.value === value); }
  private take(value: string): boolean { if (!this.peek(value)) return false; this.cursor++; return true; }
  private fail(message: string): never { const token = this.tokens[this.cursor]; throw new ApiError(`${message}${token ? ` near character ${token.position + 1}` : " at end of document"}.`, "query"); }
  private expect(value: string): void { if (!this.take(value)) this.fail(`Expected '${value}'`); }
  private name(): string { const token = this.tokens[this.cursor]; if (token?.kind !== "name") this.fail("Expected a GraphQL name"); this.cursor++; return token.value; }
  private nested<T>(read: () => T): T { if (++this.nesting > 100) this.fail("GraphQL nesting exceeds the 100-level limit"); try { return read(); } finally { this.nesting--; } }
  document(): string {
    const definitions: string[] = [];
    while (this.peek()) {
      if (this.peek("{")) { definitions.push(this.selection(0)); continue; }
      const operation = this.name();
      if (operation === "fragment") {
        const fragment = this.name(); if (fragment === "on") this.fail("Fragment name cannot be 'on'"); this.expect("on"); const type = this.name(); const directives = this.directives();
        definitions.push(`fragment ${fragment} on ${type}${directives} ${this.selection(0)}`); continue;
      }
      if (!["query", "mutation", "subscription"].includes(operation)) this.fail("Expected query, mutation, subscription, fragment, or a selection set; schema definitions are not supported");
      const name = this.tokens[this.cursor]?.kind === "name" ? ` ${this.name()}` : "";
      const variables = this.peek("(") ? this.variables() : ""; const directives = this.directives();
      definitions.push(`${operation}${name}${variables}${directives} ${this.selection(0)}`);
    }
    if (!definitions.length) this.fail("Enter a GraphQL operation or fragment");
    return definitions.join("\n\n");
  }
  private selection(indent: number): string {
    return this.nested(() => {
      this.expect("{"); const fields: string[] = [];
      while (!this.peek("}")) {
        if (!this.peek()) this.fail("Missing '}' in selection set");
        let field: string;
        if (this.take("...")) {
          if (this.take("on")) { field = `... on ${this.name()}${this.directives()} ${this.selection(indent + 1)}`; }
          else if (this.peek("@") || this.peek("{")) { field = `...${this.directives()} ${this.selection(indent + 1)}`; }
          else { field = `...${this.name()}${this.directives()}`; }
        } else {
          field = this.name(); if (this.take(":")) field += `: ${this.name()}`;
          if (this.peek("(")) field += this.arguments(); field += this.directives();
          if (this.peek("{")) field += ` ${this.selection(indent + 1)}`;
        }
        fields.push("  ".repeat(indent + 1) + field);
      }
      this.expect("}"); if (!fields.length) this.fail("Selection sets cannot be empty");
      return `{\n${fields.join("\n")}\n${"  ".repeat(indent)}}`;
    });
  }
  private arguments(): string {
    this.expect("("); const args: string[] = []; const names = new Set<string>();
    while (!this.peek(")")) { const name = this.name(); if (names.has(name)) this.fail("Duplicate argument name"); names.add(name); this.expect(":"); args.push(`${name}: ${this.value(false)}`); }
    this.expect(")"); if (!args.length) this.fail("Argument lists cannot be empty"); return `(${args.join(", ")})`;
  }
  private directives(): string {
    let result = ""; while (this.take("@")) { result += ` @${this.name()}`; if (this.peek("(")) result += this.arguments(); } return result;
  }
  private variables(): string {
    this.expect("("); const variables: string[] = []; const names = new Set<string>();
    while (!this.peek(")")) { this.expect("$"); const name = this.name(); if (names.has(name)) this.fail("Duplicate variable name"); names.add(name); this.expect(":"); let variable = `$${name}: ${this.type()}`; if (this.take("=")) variable += ` = ${this.value(true)}`; variable += this.directives(); variables.push(variable); }
    this.expect(")"); if (!variables.length) this.fail("Variable definitions cannot be empty"); return `(${variables.join(", ")})`;
  }
  private type(): string {
    return this.nested(() => { let type: string; if (this.take("[")) { type = `[${this.type()}`; this.expect("]"); type += "]"; } else type = this.name(); if (this.take("!")) type += "!"; return type; });
  }
  private value(constant: boolean): string {
    return this.nested(() => {
      if (this.take("$")) { if (constant) this.fail("Variable references are not allowed in default values"); return `$${this.name()}`; }
      if (this.take("[")) { const list: string[] = []; while (!this.peek("]")) list.push(this.value(constant)); this.expect("]"); return `[${list.join(", ")}]`; }
      if (this.take("{")) { const entries: string[] = []; const names = new Set<string>(); while (!this.peek("}")) { const name = this.name(); if (names.has(name)) this.fail("Duplicate input object field"); names.add(name); this.expect(":"); entries.push(`${name}: ${this.value(constant)}`); } this.expect("}"); return `{${entries.join(", ")}}`; }
      const token = this.tokens[this.cursor]; if (!token || !["name", "string", "number"].includes(token.kind)) this.fail("Expected a GraphQL value"); this.cursor++; return token.value;
    });
  }
}

export function formatGraphql(source: string): string {
  const tokens = lex(source); const comments = tokens.filter(token => token.kind === "comment").map(token => token.value);
  const formatted = new GraphqlParser(tokens.filter(token => token.kind !== "comment")).document();
  return (comments.length ? comments.join("\n") + "\n" : "") + formatted;
}

export function graphqlFormat(values: ApiValues): ApiResult {
  const query = text(values.query ?? values.graphql, "query"); const formatted = formatGraphql(query);
  return apiResult({ formatted, valid: true }, lex(query).some(token => token.kind === "comment") ? ["Comments are retained in their original order at the start of the formatted document. Syntax is checked without schema validation or execution."] : undefined);
}

function gqlValue(value: unknown, type: string, field: string): string {
  const raw = text(value, field);
  if (type === "String") return JSON.stringify(raw);
  if (type === "Int") { if (!/^-?(?:0|[1-9][0-9]*)$/.test(raw) || Number(raw) < -2_147_483_648 || Number(raw) > 2_147_483_647) throw new ApiError(`${field} must be a signed 32-bit GraphQL integer.`, field); return raw; }
  if (type === "Float") { if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(raw) || !Number.isFinite(Number(raw))) throw new ApiError(`${field} must be a finite GraphQL float.`, field); return /[.eE]/.test(raw) ? raw : `${raw}.0`; }
  if (type === "Boolean") { if (raw !== "true" && raw !== "false") throw new ApiError(`${field} must be true or false.`, field); return raw; }
  if (type === "Null") return "null";
  if (type === "Enum") { if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(raw) || ["true", "false", "null"].includes(raw)) throw new ApiError(`${field} must be a GraphQL enum name, not a reserved literal.`, field); return raw; }
  throw new ApiError(`${field} has an unsupported value type.`, field);
}

function selection(value: unknown, budget: { count: number }, level = 0): string {
  if (++budget.count > API_ROW_LIMIT) throw new ApiError("Selected fields exceed the 1,000-row total limit.", "selectedFields");
  if (level > 30) throw new ApiError("Selection nesting is too deep.", "selectedFields");
  if (typeof value === "string") {
    const name = value.trim();
    if (!/^[_A-Za-z][_0-9A-Za-z\s{}]*$/.test(name)) throw new ApiError("Use field names or nested field selections such as profile { id name }.", "selectedFields");
    let depth = 0;
    for (const character of name) { if (character === "{") depth++; if (character === "}" && --depth < 0) throw new ApiError("Selected fields must use valid GraphQL names and balanced braces.", "selectedFields"); }
    if (depth !== 0) throw new ApiError("Unbalanced selected field braces.", "selectedFields");
    try { formatGraphql(`{ ${name} }`); } catch { throw new ApiError("Invalid nested field selection.", "selectedFields"); }
    return name;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("Each selected field must have a name.", "selectedFields");
  const row = value as Record<string, unknown>; const name = text(row.name ?? row.field, "selectedFields name");
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(name)) throw new ApiError("Selected field names must be valid GraphQL names.", "selectedFields");
  const children = row.fields ?? row.selectedFields ?? row.children;
  if (children === undefined || (Array.isArray(children) && children.length === 0)) return name;
  if (!Array.isArray(children) || children.length > API_ROW_LIMIT) throw new ApiError("Selected fields must be a list with at most 1,000 rows.", "selectedFields");
  return `${name} { ${children.map(child => selection(child, budget, level + 1)).join(" ")} }`;
}

export function buildGraphqlQuery(values: ApiValues): ApiResult {
  const operationType = values.operationType === "mutation" ? "mutation" : values.operationType === "query" || values.operationType === undefined ? "query" : (() => { throw new ApiError("Select query or mutation.", "operationType"); })();
  const rootField = text(values.rootField, "rootField"); if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(rootField)) throw new ApiError("Root field must be a valid GraphQL name.", "rootField");
  const name = text(values.operationName, "operationName"); if (name && !/^[_A-Za-z][_0-9A-Za-z]*$/.test(name)) throw new ApiError("Operation name must be a valid GraphQL name.", "operationName");
  const args = rows<Record<string, unknown>>(values.arguments, "arguments").map((row, i) => { const key = text(row.name, `arguments row ${i + 1} name`); if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(key)) throw new ApiError("Argument names must be valid GraphQL names.", "arguments"); return `${key}: ${gqlValue(row.value, text(row.valueType, "valueType"), `arguments row ${i + 1} value`)}`; });
  const fieldsValue = values.selectedFields ?? values.fields; const fields = Array.isArray(fieldsValue) ? fieldsValue : []; if (!fields.length) throw new ApiError("Select at least one field.", "selectedFields"); if (fields.length > API_ROW_LIMIT) throw new ApiError("selectedFields exceeds the 1,000 row limit.", "selectedFields");
  const budget = { count: 0 };
  const query = `${operationType}${name ? ` ${name}` : ""} { ${rootField}${args.length ? `(${args.join(", ")})` : ""} { ${fields.map(field => selection(field, budget)).join(" ")} } }`;
  const formatted = formatGraphql(query); return apiResult({ query: formatted, operationType, operationName: name || null, rootField }, undefined);
}

export function formatVariables(values: ApiValues): ApiResult {
  const raw = text(values.json ?? values.variables ?? values.body, "variables"); let formatted: string; let parsed: unknown;
  try { formatted = runJsonTool("json-formatter", { input: raw }).text; parsed = JSON.parse(raw); }
  catch { return apiResult({ valid: false, formatted: raw, error: "Variables must be valid JSON." }, ["Variables must be valid JSON."]); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiResult({ valid: false, formatted, error: "GraphQL variables must have a JSON object at the root." }, ["GraphQL variables must have a JSON object at the root."]);
  return apiResult({ valid: true, formatted }, undefined);
}
