import { Validator, format as schemaFormats, type Schema, type SchemaDraft } from "@cfworker/json-schema";
import type { DataInputs, DataResult } from "./types";

const MAX_INPUT = 1_000_000;
const MAX_NODES = 50_000;
const MAX_DEPTH = 100;
const MAX_WORK = 500_000;
const MAX_OUTPUT = 8_000_000;
const sourceKeys = new WeakMap<object, string[]>();
const own = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>): string[] => sourceKeys.get(value) ?? Object.keys(value);
export const jsonObjectKeys = keys;
const typeOf = (value: unknown): string => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const childPath = (path: string, key: string | number): string => `${path}[${typeof key === "number" ? key : JSON.stringify(key)}]`;
const message = (error: unknown): string => error instanceof Error ? error.message : "Unable to process this input.";

function checkInput(input: string): void {
  if (input.length > MAX_INPUT) throw new Error("Input exceeds the 1,000,000-character limit. Split it into smaller documents.");
}

class JsonError extends Error {
  readonly line: number;
  readonly column: number;
  constructor(input: string, offset: number, reason: string) {
    const lines = input.slice(0, offset).split(/\r\n|\r|\n/);
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    super(`${reason} (line ${line}, column ${column}).`);
    this.line = line;
    this.column = column;
  }
}

// Compare decimal values rather than binary representations: ordinary 0.1 is
// accepted, while a decimal that changes on a JS number round trip is rejected.
function decimalIdentity(raw: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw)!;
  let digits = (match[2] + (match[3] ?? "")).replace(/^0+/, "");
  if (!digits) return "0";
  let exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  const trailing = /0+$/.exec(digits)?.[0].length ?? 0;
  if (trailing) { digits = digits.slice(0, -trailing); exponent += trailing; }
  return `${match[1]}${digits}e${exponent}`;
}

type Token = { raw: string; kind: "literal" | "punctuation" };

/** Strict, bounded parser. Objects have no prototype; duplicate keys fail. */
function readJson(input: string, preserveNumbers = false): { value: unknown; tokens: Token[] } {
  checkInput(input);
  let position = 0;
  let nodes = 0;
  const tokens: Token[] = [];
  const fail = (reason: string, at = position): never => { throw new JsonError(input, at, reason); };
  const white = (): void => { while (position < input.length && /[ \t\r\n]/.test(input[position])) position++; };
  const punctuation = (): string => { const raw = input[position++]; tokens.push({ raw, kind: "punctuation" }); return raw; };
  const string = (): string => {
    const start = position++;
    while (position < input.length) {
      const char = input[position++];
      if (char === '"') {
        const raw = input.slice(start, position);
        try { const value: string = JSON.parse(raw); tokens.push({ raw, kind: "literal" }); return value; }
        catch { return fail("Invalid JSON string or escape sequence", start); }
      }
      if (char.charCodeAt(0) < 32) fail("Unescaped control character in JSON string", position - 1);
      if (char === "\\") {
        const escaped = input[position++];
        if (escaped === "u") {
          if (!/^[\da-fA-F]{4}$/.test(input.slice(position, position + 4))) fail("Unicode escapes require four hexadecimal digits", position);
          position += 4;
        } else if (!escaped || !'"\\/bfnrt'.includes(escaped)) fail("Invalid JSON escape sequence", position - 1);
      }
    }
    return fail("Unterminated JSON string", start);
  };
  const value = (depth: number): unknown => {
    white();
    if (depth > MAX_DEPTH) fail(`JSON nesting exceeds the ${MAX_DEPTH}-level limit`);
    if (++nodes > MAX_NODES) fail(`JSON exceeds the ${MAX_NODES.toLocaleString("en-US")}-node limit`);
    const char = input[position];
    if (char === '"') return string();
    if (char === "{" || char === "[") {
      const isArray = punctuation() === "[";
      const close = isArray ? "]" : "}";
      const result: unknown[] | Record<string, unknown> = isArray ? [] : Object.create(null) as Record<string, unknown>;
      const ordered: string[] = [];
      white();
      if (input[position] !== close) {
        while (true) {
          white();
          if (isArray) (result as unknown[]).push(value(depth + 1));
          else {
            if (input[position] !== '"') fail("Expected a double-quoted object property name");
            const keyPosition = position;
            const key = string();
            if (!preserveNumbers && own(result, key)) fail(`Duplicate object key ${JSON.stringify(key)} is ambiguous for this transformation; no values were discarded`, keyPosition);
            white();
            if (input[position] !== ":") fail("Expected ':' after object property name");
            punctuation();
            (result as Record<string, unknown>)[key] = value(depth + 1);
            ordered.push(key);
          }
          white();
          if (input[position] === close) break;
          if (input[position] !== ",") fail(`Expected ',' or '${close}'`);
          punctuation();
        }
      }
      punctuation();
      if (!isArray) sourceKeys.set(result, ordered);
      return result;
    }
    const start = position;
    const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(input.slice(position))?.[0];
    if (!literal) fail(position === input.length ? "Expected a JSON value; input is empty or incomplete" : "Expected a JSON value");
    position += literal!.length;
    tokens.push({ raw: literal!, kind: "literal" });
    if (literal === "true") return true;
    if (literal === "false") return false;
    if (literal === "null") return null;
    const number = Number(literal);
    if (!preserveNumbers && (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number)) || decimalIdentity(literal!) !== decimalIdentity(String(number)))) {
      fail(`Number ${literal!.slice(0, 80)} cannot be represented without precision loss. Use a quoted string, or the source-preserving JSON Formatter/Minifier`, start);
    }
    return number;
  };
  const parsed = value(0);
  white();
  if (position !== input.length) fail("Unexpected characters after JSON value");
  return { value: parsed, tokens };
}

export function parseJson(input: string): unknown { return readJson(input).value; }

function formatSource(input: string, pretty: boolean): string {
  const { tokens } = readJson(input, true);
  if (!pretty) return tokens.map(token => token.raw).join("");
  let depth = 0;
  const out: string[] = [];
  const newline = (): void => { out.push("\n", "  ".repeat(depth)); };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === "literal") { out.push(token.raw); continue; }
    if (token.raw === "{" || token.raw === "[") {
      out.push(token.raw); depth++;
      if (tokens[i + 1]?.raw !== "}" && tokens[i + 1]?.raw !== "]") newline();
    } else if (token.raw === "}" || token.raw === "]") {
      depth--;
      if (tokens[i - 1]?.raw !== "{" && tokens[i - 1]?.raw !== "[") newline();
      out.push(token.raw);
    } else if (token.raw === ",") { out.push(","); newline(); }
    else out.push(": ");
  }
  return out.join("");
}

// Explicit serialization preserves textual ordering of integer-looking keys.
function serialize(value: unknown, pretty = true, direction?: "asc" | "desc"): string {
  let length = 0;
  let work = 0;
  const append = (text: string): string => {
    length += text.length;
    if (length > MAX_OUTPUT) throw new Error("Result exceeds the 8,000,000-character limit. Use a smaller input or narrower query.");
    return text;
  };
  const render = (node: unknown, depth: number): string => {
    if (++work > MAX_WORK || depth > MAX_DEPTH * 3) throw new Error("Serialization exceeds the nesting or operation limit.");
    if (!Array.isArray(node) && !object(node)) return append(Object.is(node, -0) ? "-0" : JSON.stringify(node));
    const array = Array.isArray(node);
    const names = array ? node.map((_, index) => String(index)) : [...keys(node as Record<string, unknown>)];
    if (!array && direction) names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0) * (direction === "desc" ? -1 : 1));
    const open = array ? "[" : "{";
    const close = array ? "]" : "}";
    if (!names.length) return append(open + close);
    const pad = pretty ? "  ".repeat(depth + 1) : "";
    const parts = names.map(key => append(pad + (array ? "" : JSON.stringify(key) + (pretty ? ": " : ":"))) + render((node as Record<string, unknown>)[key], depth + 1));
    const separator = pretty ? ",\n" : ",";
    length += separator.length * (parts.length - 1);
    return append(open + (pretty ? "\n" : "")) + parts.join(separator) + append((pretty ? "\n" + "  ".repeat(depth) : "") + close);
  };
  return render(value, 0);
}

type Change = { path: string; status: "added" | "removed" | "changed"; before?: unknown; after?: unknown };
/** Object order is ignored; arrays are compared by index. Paths use JSONPath brackets. */
export function diffValues(left: unknown, right: unknown): { status: "changed" | "unchanged"; changes: Change[] } {
  const changes: Change[] = [];
  let work = 0;
  const walk = (a: unknown, b: unknown, path: string, depth: number): void => {
    if (++work > MAX_WORK || depth > MAX_DEPTH) throw new Error("Diff exceeds the nesting or operation limit.");
    if (a === b) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (i >= a.length) changes.push({ path: childPath(path, i), status: "added", after: b[i] });
        else if (i >= b.length) changes.push({ path: childPath(path, i), status: "removed", before: a[i] });
        else walk(a[i], b[i], childPath(path, i), depth + 1);
      }
    } else if (object(a) && object(b)) {
      for (const key of new Set([...keys(a), ...keys(b)])) {
        if (!own(a, key)) changes.push({ path: childPath(path, key), status: "added", after: b[key] });
        else if (!own(b, key)) changes.push({ path: childPath(path, key), status: "removed", before: a[key] });
        else walk(a[key], b[key], childPath(path, key), depth + 1);
      }
    } else changes.push({ path, status: "changed", before: a, after: b });
  };
  walk(left, right, "$", 0);
  return { status: changes.length ? "changed" : "unchanged", changes };
}

function inferSchema(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const alternatives = new Map<string, Record<string, unknown>>();
    for (const item of value) {
      const schema = inferSchema(item);
      alternatives.set(serialize(schema, false, "asc"), schema);
    }
    const schemas = [...alternatives.values()];
    return { type: "array", items: schemas.length === 0 ? {} : schemas.length === 1 ? schemas[0] : { anyOf: schemas } };
  }
  if (object(value)) return {
    type: "object",
    properties: Object.fromEntries(keys(value).map(key => [key, inferSchema(value[key])])),
    ...(keys(value).length ? { required: keys(value) } : {}),
    additionalProperties: false,
  };
  return { type: typeof value === "number" && Number.isInteger(value) ? "integer" : typeOf(value) };
}

type Selector = { kind: "key"; key: string } | { kind: "index"; index: number } | { kind: "wildcard" } | { kind: "slice"; start?: number; end?: number; step: number } | { kind: "filter"; test: Filter };
type Segment = { recursive: boolean; selectors: Selector[] };
type Operand = { kind: "literal"; value: unknown } | { kind: "path"; root: boolean; segments: Segment[] };
type Filter = { kind: "and" | "or"; left: Filter; right: Filter } | { kind: "not"; child: Filter } | { kind: "exists"; operand: Operand } | { kind: "compare"; op: string; left: Operand; right: Operand };

class PathParser {
  position = 0;
  constructor(readonly source: string) {
    if (source.length > 4096) throw new Error("JSONPath exceeds the 4,096-character limit.");
  }
  fail(reason: string): never { throw new Error(`Invalid or unsupported JSONPath at character ${this.position + 1}: ${reason}`); }
  white(): void { while (/\s/.test(this.source[this.position] ?? "") && this.position < this.source.length) this.position++; }
  consume(text: string): boolean {
    this.white();
    if (!this.source.startsWith(text, this.position)) return false;
    this.position += text.length;
    return true;
  }
  quoted(): string {
    const quote = this.source[this.position++];
    let result = "";
    while (this.position < this.source.length) {
      const char = this.source[this.position++];
      if (char === quote) return result;
      if (char.charCodeAt(0) < 32) this.fail("control character in quoted string");
      if (char !== "\\") { result += char; continue; }
      const escaped = this.source[this.position++];
      if (escaped === "u") {
        const hex = this.source.slice(this.position, this.position + 4);
        if (!/^[\da-fA-F]{4}$/.test(hex)) this.fail("invalid Unicode escape");
        result += String.fromCharCode(parseInt(hex, 16)); this.position += 4;
      } else {
        const escapes: Record<string, string> = { '"': '"', "'": "'", "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (!own(escapes, escaped)) this.fail("invalid string escape");
        result += escapes[escaped];
      }
    }
    return this.fail("unterminated quoted string");
  }
  integer(): number | undefined {
    this.white();
    const raw = /^-?(?:0|[1-9]\d*)/.exec(this.source.slice(this.position))?.[0];
    if (raw === undefined) return undefined;
    this.position += raw.length;
    const number = Number(raw);
    if (!Number.isSafeInteger(number)) this.fail("array index is outside the safe integer range");
    return number;
  }
  segments(filterOperand = false): Segment[] {
    const segments: Segment[] = [];
    while (true) {
      this.white();
      let recursive = false;
      if (this.consume("..")) recursive = true;
      else if (!this.consume(".")) {
        if (this.source[this.position] !== "[") break;
      }
      this.white();
      const selectors: Selector[] = [];
      if (this.consume("[")) {
        do {
          this.white();
          const char = this.source[this.position];
          if (char === '"' || char === "'") selectors.push({ kind: "key", key: this.quoted() });
          else if (this.consume("*")) selectors.push({ kind: "wildcard" });
          else if (this.consume("?")) {
            if (filterOperand) this.fail("nested filters inside filter operands are unsupported");
            const wrapped = this.consume("(");
            const test = this.filter();
            if (wrapped && !this.consume(")")) this.fail("expected ')' after filter");
            selectors.push({ kind: "filter", test });
          } else {
            const start = this.integer();
            if (this.consume(":")) {
              const end = this.integer();
              const step = this.consume(":") ? this.integer() ?? 1 : 1;
              if (!step) this.fail("slice step cannot be zero");
              selectors.push({ kind: "slice", start, end, step });
            } else if (start !== undefined) selectors.push({ kind: "index", index: start });
            else this.fail("expected a quoted key, index, wildcard, slice, or filter");
          }
        } while (this.consume(","));
        if (!this.consume("]")) this.fail("expected ']' after selector");
      } else if (this.consume("*")) selectors.push({ kind: "wildcard" });
      else {
        const name = /^[\p{L}_$][\p{L}\p{N}_$-]*/u.exec(this.source.slice(this.position))?.[0];
        if (!name) this.fail("expected a property name after '.' or '..'");
        this.position += name!.length;
        selectors.push({ kind: "key", key: name! });
      }
      segments.push({ recursive, selectors });
      if (segments.length > MAX_DEPTH) this.fail("too many path segments");
    }
    return segments;
  }
  operand(): Operand {
    this.white();
    const char = this.source[this.position];
    if (char === "$" || char === "@") { this.position++; return { kind: "path", root: char === "$", segments: this.segments(true) }; }
    if (char === '"' || char === "'") return { kind: "literal", value: this.quoted() };
    const raw = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(this.source.slice(this.position))?.[0];
    if (!raw) return this.fail("filters accept paths and JSON scalar literals; scripts and functions are unsupported");
    this.position += raw.length;
    return { kind: "literal", value: parseJson(raw) };
  }
  filter(level = 0, depth = 0): Filter {
    if (depth > 32) this.fail("filter nesting exceeds 32 levels");
    if (level < 2) {
      let left = this.filter(level + 1, depth);
      const op = level === 0 ? "||" : "&&";
      while (this.consume(op)) left = { kind: level === 0 ? "or" : "and", left, right: this.filter(level + 1, depth) };
      return left;
    }
    if (this.consume("!")) return { kind: "not", child: this.filter(2, depth + 1) };
    if (this.consume("(")) {
      const result = this.filter(0, depth + 1);
      if (!this.consume(")")) this.fail("expected ')' in filter");
      return result;
    }
    const left = this.operand();
    this.white();
    const op = /^(?:===|!==|==|!=|<=|>=|<|>)/.exec(this.source.slice(this.position))?.[0];
    if (!op) return { kind: "exists", operand: left };
    this.position += op.length;
    return { kind: "compare", op, left, right: this.operand() };
  }
}

function jsonPath(root: unknown, expression: string): unknown[] {
  const parser = new PathParser(expression.trim());
  if (!parser.consume("$")) parser.fail("path must start with '$'");
  const segments = parser.segments();
  parser.white();
  if (parser.position !== parser.source.length) parser.fail("unexpected trailing syntax");
  let work = 0;
  const tick = (): void => { if (++work > MAX_WORK) throw new Error("JSONPath exceeds the 500,000-operation limit. Use a narrower query."); };
  const children = (node: unknown): unknown[] => Array.isArray(node) ? node : object(node) ? keys(node).map(key => node[key]) : [];
  const operands = (operand: Operand, node: unknown): unknown[] => operand.kind === "literal" ? [operand.value] : apply([operand.root ? root : node], operand.segments);
  const test = (filter: Filter, node: unknown): boolean => {
    tick();
    if (filter.kind === "and" || filter.kind === "or") return filter.kind === "and" ? test(filter.left, node) && test(filter.right, node) : test(filter.left, node) || test(filter.right, node);
    if (filter.kind === "not") return !test(filter.child, node);
    if (filter.kind === "exists") return filter.operand.kind === "path" ? operands(filter.operand, node).length > 0 : Boolean(filter.operand.value);
    if (filter.kind !== "compare") return false;
    const left = operands(filter.left, node);
    const right = operands(filter.right, node);
    return left.some(a => right.some(b => {
      tick();
      const equal = (object(a) || Array.isArray(a)) && (object(b) || Array.isArray(b)) ? serialize(a, false, "asc") === serialize(b, false, "asc") : a === b;
      if (filter.op === "==" || filter.op === "===") return equal;
      if (filter.op === "!=" || filter.op === "!==") return !equal;
      if (!((typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string"))) return false;
      if (filter.op === "<") return a < b;
      if (filter.op === ">") return a > b;
      if (filter.op === "<=") return a <= b;
      return a >= b;
    }));
  };
  const select = (node: unknown, selector: Selector): unknown[] => {
    tick();
    if (selector.kind === "key") return object(node) && own(node, selector.key) ? [node[selector.key]] : [];
    if (selector.kind === "wildcard") return children(node);
    if (selector.kind === "filter") return children(node).filter(child => test(selector.test, child));
    if (!Array.isArray(node)) return [];
    if (selector.kind === "index") {
      const index = selector.index < 0 ? node.length + selector.index : selector.index;
      return index >= 0 && index < node.length ? [node[index]] : [];
    }
    const { step } = selector;
    const clamp = (index: number): number => Math.max(step > 0 ? 0 : -1, Math.min(step > 0 ? node.length : node.length - 1, index < 0 ? node.length + index : index));
    const start = selector.start === undefined ? step > 0 ? 0 : node.length - 1 : clamp(selector.start);
    const end = selector.end === undefined ? step > 0 ? node.length : -1 : clamp(selector.end);
    const result: unknown[] = [];
    for (let index = start; step > 0 ? index < end : index > end; index += step) { tick(); result.push(node[index]); }
    return result;
  };
  const apply = (start: unknown[], parts: Segment[]): unknown[] => {
    let current = start;
    for (const segment of parts) {
      const next: unknown[] = [];
      const visit = (node: unknown): void => {
        tick();
        for (const selector of segment.selectors) {
          for (const match of select(node, selector)) { tick(); next.push(match); }
          if (next.length > MAX_NODES) throw new Error("JSONPath exceeds the 50,000-match limit.");
        }
        if (segment.recursive) for (const child of children(node)) visit(child);
      };
      current.forEach(visit);
      current = next;
    }
    return current;
  };
  return apply([root], segments);
}

const schemaTypes = new Set(["null", "boolean", "object", "array", "number", "string", "integer"]);
const singleSchemas = new Set(["not", "if", "then", "else", "additionalProperties", "unevaluatedProperties", "propertyNames", "additionalItems", "unevaluatedItems", "contains"]);
const schemaMaps = new Set(["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"]);
const schemaArrays = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);
const schemaStrings = new Set(["$id", "id", "$anchor", "$ref", "$recursiveRef", "$schema", "$comment", "title", "description", "format", "pattern"]);
const nonnegative = new Set(["minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties", "minContains", "maxContains"]);
const schemaBooleans = new Set(["uniqueItems", "readOnly", "writeOnly", "deprecated", "$recursiveAnchor"]);
const annotations = new Set(["default", "examples"]);

function schemaDraft(schema: unknown): SchemaDraft {
  if (!object(schema) || schema.$schema === undefined) return "2020-12";
  if (typeof schema.$schema !== "string") throw new Error("Schema $schema must be a string URI.");
  const uri = schema.$schema.replace(/^http:/, "https:").replace(/#$/, "");
  const drafts: Record<string, SchemaDraft> = {
    "https://json-schema.org/draft-04/schema": "4", "https://json-schema.org/draft-07/schema": "7",
    "https://json-schema.org/draft/2019-09/schema": "2019-09", "https://json-schema.org/draft/2020-12/schema": "2020-12",
  };
  if (!own(drafts, uri)) throw new Error(`Unsupported schema dialect ${JSON.stringify(schema.$schema)}. Supported drafts: 4, 7, 2019-09, 2020-12.`);
  return drafts[uri];
}

/** Check schemas before the interpretive validator: malformed/unknown rules must never silently pass. */
function checkSchema(root: unknown, draft: SchemaDraft): { schema: Schema | boolean; count: number } {
  const nodes = new Set<object>();
  const anchors = new Map<string, unknown>();
  const refs: Array<{ node: Record<string, unknown>; ref: string; path: string }> = [];
  const edges = new Map<object, object[]>();
  let count = 0;
  const error = (path: string, reason: string): never => { throw new Error(`Invalid or unsupported JSON Schema at ${path}: ${reason}`); };
  const regex = (pattern: string, path: string): void => {
    if (pattern.length > 512) error(path, "regular expressions are limited to 512 characters");
    // Disallow common exponential forms before interpretive validation.
    if (/\\[1-9]|\(\?[=!<]|\)[+*{]/.test(pattern)) error(path, "backreferences, lookarounds, and quantified groups are unsupported");
    try { new RegExp(pattern, "u"); } catch { error(path, "invalid Unicode regular expression"); }
  };
  const stringArray = (value: unknown, path: string, nonempty = false): void => {
    if (!Array.isArray(value) || value.some(item => typeof item !== "string") || new Set(value).size !== value.length || (nonempty && !value.length)) error(path, "expected an array of unique strings");
  };
  const visit = (node: unknown, path: string, depth: number): void => {
    if (++count > 2000 || depth > 60) error(path, "schema exceeds the 2,000-schema / 60-level limit");
    if (typeof node === "boolean") { if (draft === "4") error(path, "draft 4 requires object schemas"); return; }
    if (!object(node)) error(path, "a schema must be an object or boolean");
    const rule = node as Record<string, unknown>;
    nodes.add(rule);
    const immediate: object[] = [];
    edges.set(rule, immediate);
    const sub = (value: unknown, at: string, sameInstance = false): void => {
      visit(value, at, depth + 1);
      if (sameInstance && object(value)) immediate.push(value);
    };
    for (const [key, value] of Object.entries(rule)) {
      const at = `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      if ((draft === "4" || draft === "7") && ["$defs", "$anchor", "$recursiveAnchor", "$recursiveRef", "$vocabulary", "dependentRequired", "dependentSchemas", "unevaluatedItems", "unevaluatedProperties", "minContains", "maxContains", "prefixItems"].includes(key)) error(at, `keyword is not supported in draft ${draft}`);
      if (draft === "4" && ["$id", "const", "contains", "propertyNames", "if", "then", "else"].includes(key)) error(at, "keyword is not supported in draft 4");
      if (draft !== "2020-12" && key === "prefixItems") error(at, "prefixItems requires draft 2020-12");
      if (draft !== "2019-09" && ["$recursiveRef", "$recursiveAnchor"].includes(key)) error(at, "recursive keywords require draft 2019-09");
      if (draft === "2020-12" && ["additionalItems", "dependencies"].includes(key)) error(at, "use items / dependentRequired / dependentSchemas in draft 2020-12");
      if (schemaStrings.has(key)) {
        if (typeof value !== "string") error(at, "expected a string");
        const text = value as string;
        if ((key === "$id" || key === "id") && path !== "#") error(at, "nested schema resource IDs are unsupported; use local definitions and fragment references");
        if (key === "$id" || key === "id") { try { new URL(text, "https://code-station.invalid/"); } catch { error(at, "invalid schema URI"); } }
        if (key === "$schema" && schemaDraft(rule) !== draft) error(at, "mixed schema dialects are unsupported");
        if (key === "pattern") regex(text, at);
        if (key === "format" && !own(schemaFormats, text)) error(at, `unsupported format ${JSON.stringify(text)}`);
        if (key === "$anchor") {
          if (!/^[A-Za-z][A-Za-z0-9._:-]*$/.test(text) || anchors.has(text)) error(at, "invalid or duplicate anchor");
          anchors.set(text, rule);
        }
        if (key === "$ref" || key === "$recursiveRef") {
          if (!text.startsWith("#")) error(at, "only local fragment references are supported; remote references are never fetched");
          if (key === "$recursiveRef" && text !== "#") error(at, "$recursiveRef must be '#'");
          refs.push({ node: rule, ref: text, path: at });
        }
      } else if (key === "type") {
        const types = Array.isArray(value) ? value : [value];
        if (!types.length || types.some(type => typeof type !== "string" || !schemaTypes.has(type)) || new Set(types).size !== types.length) error(at, "expected a valid type or nonempty array of unique valid types");
      } else if (singleSchemas.has(key)) {
        if (!(draft === "4" && typeof value === "boolean" && ["additionalProperties", "additionalItems"].includes(key))) sub(value, at, ["not", "if", "then", "else"].includes(key));
      }
      else if (schemaMaps.has(key)) {
        if (!object(value)) error(at, "expected an object mapping names to schemas");
        for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
          if (key === "patternProperties") regex(name, at);
          sub(child, `${at}/${name.replace(/~/g, "~0").replace(/\//g, "~1")}`, key === "dependentSchemas");
        }
      } else if (schemaArrays.has(key) || key === "items") {
        if (key === "items" && !Array.isArray(value)) sub(value, at);
        else {
          if (!Array.isArray(value) || !value.length) error(at, "expected a nonempty array of schemas");
          if (key === "items" && draft === "2020-12") error(at, "tuple arrays use prefixItems in draft 2020-12");
          (value as unknown[]).forEach((child, index) => sub(child, `${at}/${index}`, ["anyOf", "allOf", "oneOf"].includes(key)));
        }
      } else if (key === "required") stringArray(value, at, draft === "4");
      else if (key === "dependentRequired" || key === "dependencies") {
        if (!object(value)) error(at, "expected an object");
        for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
          if (key === "dependentRequired" || Array.isArray(child)) stringArray(child, `${at}/${name}`);
          else sub(child, `${at}/${name}`, true);
        }
      } else if (nonnegative.has(key)) {
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) error(at, "expected a nonnegative safe integer");
      } else if (["minimum", "maximum", "multipleOf", "exclusiveMinimum", "exclusiveMaximum"].includes(key)) {
        if (draft === "4" && key.startsWith("exclusive")) {
          if (typeof value !== "boolean") error(at, "draft 4 exclusive bounds must be booleans");
          if (!own(rule, key === "exclusiveMinimum" ? "minimum" : "maximum")) error(at, "exclusive bound requires the corresponding minimum or maximum");
        } else if (typeof value !== "number" || !Number.isFinite(value) || (key === "multipleOf" && value <= 0)) error(at, "expected a finite number (multipleOf must be positive)");
      } else if (schemaBooleans.has(key)) { if (typeof value !== "boolean") error(at, "expected a boolean"); }
      else if (key === "enum") {
        if (!Array.isArray(value) || !value.length) error(at, "expected a nonempty array");
        const values = (value as unknown[]).map(item => serialize(item, false, "asc"));
        if (new Set(values).size !== values.length) error(at, "enum values must be unique");
      } else if (key === "const" || annotations.has(key)) {
        if (key === "examples" && !Array.isArray(value)) error(at, "examples must be an array");
      } else if (key === "$vocabulary") error(at, "custom vocabulary declarations are unsupported");
      else error(at, `unsupported keyword ${JSON.stringify(key)}`);
    }
  };
  visit(root, "#", 0);
  for (const entry of refs) {
    let fragment: string;
    try { fragment = decodeURIComponent(entry.ref.slice(1)); } catch { error(entry.path, "malformed URI fragment"); }
    let target: unknown = root;
    if (fragment! && !fragment!.startsWith("/")) target = anchors.get(fragment!);
    else if (fragment!) {
      for (const part of fragment!.slice(1).split("/")) {
        if (/~(?:[^01]|$)/.test(part)) error(entry.path, "malformed JSON Pointer escape");
        const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
        if ((object(target) || Array.isArray(target)) && own(target, key)) target = (target as Record<string, unknown>)[key];
        else { target = undefined; break; }
      }
    }
    if (typeof target !== "boolean" && (!object(target) || !nodes.has(target))) error(entry.path, `unresolved reference ${entry.ref}`);
    if (object(target)) edges.get(entry.node)!.push(target);
  }
  const visiting = new Set<object>();
  const costs = new Map<object, number>();
  const cycle = (node: object): number => {
    if (visiting.has(node)) error("#", "cyclic references that do not descend into a child value are unsupported");
    if (costs.has(node)) return costs.get(node)!;
    visiting.add(node);
    let cost = 1;
    for (const child of edges.get(node) ?? []) {
      cost += cycle(child);
      if (cost > MAX_WORK) error("#", "schema reference expansion exceeds the operation limit");
    }
    visiting.delete(node); costs.set(node, cost);
    return cost;
  };
  for (const node of nodes) cycle(node);
  return { schema: root as Schema | boolean, count: Math.max(count, ...costs.values()) };
}

type Structure = { path: string; type: string; children?: Structure[] };
function structure(value: unknown, path = "$"): Structure {
  return {
    path, type: typeOf(value),
    ...(Array.isArray(value) ? { children: value.map((child, index) => structure(child, childPath(path, index))) }
      : object(value) ? { children: keys(value).map(key => structure(value[key], childPath(path, key))) } : {}),
  };
}

function statistics(value: unknown): Record<string, number> {
  const result = { objects: 0, arrays: 0, keys: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0, nodes: 0, maxDepth: 0 };
  const visit = (node: unknown, depth: number): void => {
    result.nodes++; result.maxDepth = Math.max(result.maxDepth, depth);
    if (Array.isArray(node)) { result.arrays++; node.forEach(child => visit(child, depth + 1)); }
    else if (object(node)) { result.objects++; result.keys += keys(node).length; keys(node).forEach(key => visit(node[key], depth + 1)); }
    else if (node === null) result.nulls++;
    else if (typeof node === "string") result.strings++;
    else if (typeof node === "number") result.numbers++;
    else if (typeof node === "boolean") result.booleans++;
  };
  visit(value, 0);
  return result;
}

function jsonLines(input: string, preserveNumbers: boolean): { records: unknown[]; compact: string[]; errors: Array<{ line: number; column?: number; message: string }> } {
  checkInput(input);
  const records: unknown[] = [];
  const compact: string[] = [];
  const errors: Array<{ line: number; column?: number; message: string }> = [];
  const lines = input.split(/\r\n|\n|\r/);
  if (lines.length > MAX_NODES) throw new Error("JSON Lines exceeds the 50,000-physical-line limit.");
  let totalNodes = 0;
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const parsed = readJson(line, preserveNumbers);
      totalNodes += parsed.tokens.length;
      if (totalNodes > MAX_WORK) throw new Error("JSON Lines exceeds the 500,000-token limit.");
      records.push(parsed.value); compact.push(parsed.tokens.map(token => token.raw).join(""));
    } catch (error) {
      errors.push({ line: index + 1, ...(error instanceof JsonError ? { column: error.column } : {}), message: message(error).replace(/ \(line \d+, column \d+\)\.$/, "") });
    }
  });
  if (!records.length && !errors.length) errors.push({ line: 1, column: 1, message: "JSON Lines is empty. Enter at least one nonempty physical line; blank lines are ignored." });
  return { records, compact, errors };
}

function output(value: unknown, invalid = false): DataResult {
  return { text: serialize(value), ...(invalid ? { invalid: true } : {}) };
}

function run(id: string, inputs: DataInputs): DataResult {
  const input = inputs.input ?? "";
  checkInput(input);
  if (id === "json-escape") return { text: JSON.stringify(input) };
  if (id === "json-formatter") return { text: formatSource(input, true) };
  if (id === "json-minifier") return { text: formatSource(input, false) };
  if (id === "json-validator") {
    try { readJson(input, true); return output({ valid: true, errors: [] }); }
    catch (error) { return output({ valid: false, errors: [{ message: message(error), ...(error instanceof JsonError ? { line: error.line, column: error.column } : {}) }] }, true); }
  }
  if (["json-lines-formatter", "json-lines-validator", "json-lines-to-json", "jsonl-formatter", "jsonl-validator", "jsonl-to-json"].includes(id)) {
    const { records, compact, errors } = jsonLines(input, id.endsWith("validator") || id.endsWith("formatter"));
    if (id.endsWith("validator")) return output({ valid: !errors.length, errors }, !!errors.length);
    if (errors.length) throw new Error(errors.map(error => `Line ${error.line}${error.column ? `, column ${error.column}` : ""}: ${error.message}`).join("\n"));
    return id.endsWith("formatter") ? { text: compact.join("\n") } : output(records);
  }
  const value = parseJson(input);
  switch (id) {
    case "json-unescape":
      if (typeof value !== "string") throw new Error("JSON Unescape requires a JSON string literal, including its surrounding double quotes.");
      return { text: value };
    case "json-diff": return output(diffValues(value, parseJson(inputs.secondary ?? "")));
    case "json-tree-viewer": return { text: serialize(value), tree: value };
    case "json-schema-validator": {
      const schema = parseJson(inputs.secondary ?? "");
      const draft = schemaDraft(schema);
      const checked = checkSchema(schema, draft);
      if (statistics(value).nodes * checked.count > MAX_WORK) throw new Error("Schema validation exceeds the 500,000 node × schema limit. Reduce the document or schema.");
      let result;
      try { result = new Validator(checked.schema, draft, false).validate(value); }
      catch (error) { throw new Error(`Schema validation could not complete: ${message(error)}`); }
      return output({ valid: result.valid, errors: result.errors.map(error => ({ path: error.instanceLocation || "#", message: error.error })) }, !result.valid);
    }
    case "json-schema-generator": return output({ $schema: "https://json-schema.org/draft/2020-12/schema", ...inferSchema(value) });
    case "jsonpath-tester":
    case "json-path-tester": {
      const matches = jsonPath(value, inputs.expression ?? "");
      return output({ matches, count: matches.length });
    }
    case "json-key-sorter": {
      const direction = (inputs.direction ?? "asc").toLowerCase();
      if (!["asc", "ascending", "desc", "descending"].includes(direction)) throw new Error("Key sort direction must be Ascending or Descending.");
      return { text: serialize(value, true, direction.startsWith("desc") ? "desc" : "asc") };
    }
    case "json-array-to-object": {
      if (!Array.isArray(value)) throw new Error("Expected a JSON array of objects.");
      const key = inputs.key;
      if (key === undefined || key === "") throw new Error("Enter the object property to use as the key.");
      const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      const ordered: string[] = [];
      value.forEach((row, index) => {
        if (!object(row) || !own(row, key)) throw new Error(`Array item ${index} must be an object with its own ${JSON.stringify(key)} property.`);
        const selected = row[key];
        const name = typeof selected === "object" && selected !== null ? serialize(selected, false) : String(selected);
        if (own(result, name)) throw new Error(`Duplicate key ${JSON.stringify(name)} at array item ${index}; no items were overwritten.`);
        result[name] = row; ordered.push(name);
      });
      sourceKeys.set(result, ordered);
      return output(result);
    }
    case "json-object-to-array":
      if (!object(value)) throw new Error("Expected a JSON object.");
      return output(keys(value).map(key => ({ key, value: value[key] })));
    case "json-to-json-lines":
    case "json-to-jsonl":
      if (!Array.isArray(value)) throw new Error("JSON to JSON Lines requires a top-level array.");
      return { text: value.map(item => serialize(item, false)).join("\n") };
    case "json-structure-inspector": {
      const hierarchy = structure(value);
      return { text: serialize(hierarchy), structure: hierarchy };
    }
    case "json-statistics-analyzer": return output(statistics(value));
    default: throw new Error(`Unsupported JSON tool: ${id}`);
  }
}

export function runJsonTool(id: string, inputs: DataInputs): DataResult {
  try {
    const result = run(id, inputs);
    if (result.text.length > MAX_OUTPUT) throw new Error("Result exceeds the 8,000,000-character limit. Use a smaller input or narrower query.");
    return result;
  } catch (error) {
    if (error instanceof RangeError) throw new Error("Processing exceeded the nesting or resource limit. Use a smaller document or simpler schema.");
    throw new Error(message(error));
  }
}
