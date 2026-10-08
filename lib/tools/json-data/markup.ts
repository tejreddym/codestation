import { isAlias, isMap, isScalar, isSeq, parseDocument, stringify as stringifyYaml } from "yaml";
import { SaxesParser } from "saxes";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { DataInputs, DataResult } from "./types";
import { parseJson } from "./json";

const MAX_INPUT = 1_000_000;
const MAX_OUTPUT = 4_000_000;
const MAX_NODES = 50_000;
const MAX_DEPTH = 100;
type Value = null | boolean | number | string | Value[] | { [key: string]: Value };

function requireInput(input: string, format: string): void {
  if (!input.trim()) throw new Error(`${format} input is empty. Enter one document.`);
  if (input.length > MAX_INPUT) throw new Error(`Input exceeds the ${MAX_INPUT.toLocaleString("en-US")}-character limit.`);
}

function budget() {
  let nodes = 0;
  return (depth: number) => {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) {
      throw new Error(`Document exceeds the resource limit (${MAX_NODES} values/nodes or ${MAX_DEPTH} nesting levels).`);
    }
  };
}

/** Reject non-JSON data rather than letting JSON.stringify silently alter it. */
function jsonCompatible(value: unknown, source: string, rejectNull = false): Value {
  const check = budget();
  const active = new Set<object>();
  const walk = (node: unknown, path: string, depth: number): Value => {
    check(depth);
    if (node === null) {
      if (rejectNull) throw new Error(`${path}: TOML cannot represent null.`);
      return null;
    }
    if (typeof node === "string" || typeof node === "boolean") return node;
    if (typeof node === "number") {
      if (!Number.isFinite(node)) throw new Error(`${path}: non-finite numbers cannot be converted to ${rejectNull ? "TOML" : "JSON"}.`);
      if (Number.isInteger(node) && !Number.isSafeInteger(node)) throw new Error(`${path}: integer exceeds JavaScript's exact range; quote it as a string to preserve it.`);
      return node;
    }
    if (typeof node === "bigint") {
      const n = Number(node);
      if (!Number.isSafeInteger(n)) throw new Error(`${path}: integer exceeds JSON's exact numeric range; quote it as a string.`);
      return n;
    }
    if (typeof node !== "object") throw new Error(`${path}: unsupported ${source} value (${typeof node}).`);
    if (node instanceof Date) throw new Error(`${path}: TOML/YAML date or time has no lossless JSON type. Quote the original date/time value as a string before converting.`);
    if (active.has(node)) throw new Error(`${path}: cyclic references cannot be represented in JSON.`);
    active.add(node);
    let result: Value;
    if (Array.isArray(node)) result = node.map((item, i) => walk(item, `${path}[${i}]`, depth + 1));
    else {
      const prototype = Object.getPrototypeOf(node);
      if (prototype !== Object.prototype && prototype !== null) throw new Error(`${path}: unsupported ${source} type; conversion would lose information.`);
      result = Object.fromEntries(Object.entries(node).map(([key, item]) => [key, walk(item, `${path}[${JSON.stringify(key)}]`, depth + 1)]));
    }
    active.delete(node);
    return result;
  };
  return walk(value, "$", 0);
}

function readJson(input: string, rejectNull = false): Value {
  requireInput(input, "JSON");
  let value: unknown;
  try { value = parseJson(input); }
  catch (cause) { throw new Error(`Invalid JSON: ${message(cause)}`); }
  return jsonCompatible(value, "JSON", rejectNull);
}

function readYaml(input: string, checkNumbers = false) {
  requireInput(input, "YAML");
  // Document APIs retain anchors, tags, comments, and non-JSON collections for formatting.
  const doc = parseDocument(input, { intAsBigInt: true, prettyErrors: true, uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors.map(error => error.code === "MULTIPLE_DOCS" ? "Expected one YAML document; multiple documents are not accepted." : error.message).join("\n"));
  const check = budget();
  const walk = (node: unknown, depth: number): void => {
    check(depth);
    if (checkNumbers && isScalar(node) && typeof node.value === "number" && Number.isFinite(node.value) && node.source) {
      const raw = node.source.replaceAll("_", "").replace(/^\+/, "").replace(/^(-?)\./, "$10.").replace(/\.(?=[eE]|$)/, ".0");
      if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
        try { parseJson(raw); } catch { throw new Error("YAML number exceeds lossless numeric precision. Quote it as a string before converting or formatting."); }
      }
    }
    if (isAlias(node)) {
      if (!node.resolve(doc)) throw new Error(`Unresolved YAML alias: *${node.source}.`);
    } else if (isMap(node)) {
      for (const pair of node.items) { walk(pair.key, depth + 1); walk(pair.value, depth + 1); }
    } else if (isSeq(node)) for (const item of node.items) walk(item, depth + 1);
  };
  walk(doc.contents, 0);
  return doc;
}

function yamlValue(input: string): Value {
  const doc = readYaml(input, true);
  const check = budget();
  const active = new Set<unknown>();
  let expandedCharacters = 0;
  const countText = (value: string) => {
    expandedCharacters += value.length;
    if (expandedCharacters > MAX_OUTPUT) throw new Error("Expanded YAML aliases exceed the output resource limit.");
  };
  const walk = (node: unknown, path: string, depth: number): Value => {
    check(depth);
    if (node === null) return null;
    if (active.has(node)) throw new Error(`${path}: cyclic YAML aliases cannot be represented in JSON.`);
    active.add(node);
    let result: Value;
    if (isAlias(node)) result = walk(node.resolve(doc), path, depth + 1);
    else if (isScalar(node)) {
      if (node.tag && !["tag:yaml.org,2002:str", "tag:yaml.org,2002:int", "tag:yaml.org,2002:float", "tag:yaml.org,2002:bool", "tag:yaml.org,2002:null"].includes(node.tag)) {
        throw new Error(`${path}: YAML tag ${node.tag} has no lossless JSON representation.`);
      }
      result = jsonCompatible(node.value, "YAML");
      if (typeof result === "string") countText(result);
    } else if (isSeq(node)) {
      if (node.tag && node.tag !== "tag:yaml.org,2002:seq") throw new Error(`${path}: tagged YAML collection cannot be represented losslessly in JSON.`);
      result = node.items.map((item, i) => walk(item, `${path}[${i}]`, depth + 1));
    } else if (isMap(node)) {
      if (node.tag && node.tag !== "tag:yaml.org,2002:map") throw new Error(`${path}: tagged YAML collection cannot be represented losslessly in JSON.`);
      result = Object.fromEntries(node.items.map(pair => {
        if (!isScalar(pair.key) || typeof pair.key.value !== "string") throw new Error(`${path}: JSON object keys must be strings; YAML complex or non-string keys are unsupported.`);
        if (pair.key.tag && pair.key.tag !== "tag:yaml.org,2002:str") throw new Error(`${path}: tagged YAML keys have no lossless JSON representation.`);
        const key = pair.key.value;
        countText(key);
        return [key, walk(pair.value, `${path}[${JSON.stringify(key)}]`, depth + 1)];
      }));
    } else throw new Error(`${path}: unsupported YAML value.`);
    active.delete(node);
    return result;
  };
  return walk(doc.contents, "$", 0);
}

type Change = { path: string; type: "added" | "removed" | "changed"; oldValue?: Value; newValue?: Value };
function diffYaml(before: Value, after: Value) {
  const changes: Change[] = [];
  const walk = (a: Value, b: Value, path: string): void => {
    if (Object.is(a, b)) return;
    if (a !== null && b !== null && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
      const left = a as Record<string, Value>, right = b as Record<string, Value>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        const next = Array.isArray(a) ? `${path}[${key}]` : `${path}[${JSON.stringify(key)}]`;
        if (!Object.hasOwn(left, key)) changes.push({ path: next, type: "added", newValue: right[key] });
        else if (!Object.hasOwn(right, key)) changes.push({ path: next, type: "removed", oldValue: left[key] });
        else walk(left[key], right[key], next);
      }
    } else changes.push({ path, type: "changed", oldValue: a, newValue: b });
  };
  walk(before, after, "$");
  return { status: changes.length ? "changed" : "unchanged", changes };
}

type XmlElement = { kind: "element"; name: string; attributes: Record<string, string>; children: XmlNode[]; preserve: boolean };
type XmlNode = XmlElement | { kind: "text" | "comment" | "cdata" | "pi" | "declaration"; value: string };

function readXml(input: string): XmlNode[] {
  requireInput(input, "XML");
  const parser = new SaxesParser({ xmlns: true, position: true });
  const nodes: XmlNode[] = [];
  const stack: XmlElement[] = [];
  const check = budget();
  const append = (node: XmlNode) => {
    check(stack.length);
    (stack.length ? stack[stack.length - 1].children : nodes).push(node);
  };
  parser.on("error", error => { throw error; });
  parser.on("doctype", () => { throw new Error("DTD/DOCTYPE declarations are disabled. External entities are never resolved."); });
  parser.on("xmldecl", declaration => {
    if (declaration.version !== "1.0") throw new Error("Only XML 1.0 documents are supported.");
    append({ kind: "declaration", value: `<?xml version="1.0"${declaration.encoding ? ` encoding="${declaration.encoding}"` : ""}${declaration.standalone ? ` standalone="${declaration.standalone}"` : ""}?>` });
  });
  parser.on("opentag", tag => {
    const attributes = Object.fromEntries(Object.entries(tag.attributes).map(([name, attribute]) => [name, attribute.value]));
    const space = attributes["xml:space"];
    if (space !== undefined && space !== "preserve" && space !== "default") throw new Error(`Invalid xml:space value at line ${parser.line}, column ${parser.column}.`);
    const node: XmlElement = { kind: "element", name: tag.name, attributes, children: [], preserve: space === "preserve" || (space !== "default" && (stack.at(-1)?.preserve ?? false)) };
    append(node);
    stack.push(node);
  });
  parser.on("closetag", () => { stack.pop(); });
  parser.on("text", value => append({ kind: "text", value }));
  parser.on("cdata", value => append({ kind: "cdata", value }));
  parser.on("comment", value => append({ kind: "comment", value }));
  parser.on("processinginstruction", instruction => append({ kind: "pi", value: `<?${instruction.target}${instruction.body ? ` ${instruction.body}` : ""}?>` }));
  parser.write(input).close();
  return nodes;
}

function escapeXml(value: string, attribute = false): string {
  // Referenced carriage returns must not become literal line endings on reparse.
  const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#13;");
  return attribute ? escaped.replace(/"/g, "&quot;").replace(/\n/g, "&#10;").replace(/\t/g, "&#9;") : escaped;
}

/** Retain mixed-content spaces and xml:space; normalize newline-only indentation. */
function renderXml(nodes: XmlNode[], pretty: boolean): string {
  const render = (node: XmlNode, depth: number, allowIndent: boolean): string => {
    if (node.kind === "text") return escapeXml(node.value);
    if (node.kind === "cdata") return `<![CDATA[${node.value}]]>`;
    if (node.kind === "comment") return `<!--${node.value}-->`;
    if (node.kind === "pi" || node.kind === "declaration") return node.value;
    // TypeScript cannot discriminate the union of string literal kinds above.
    if (node.kind !== "element") return "";
    const attrs = Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escapeXml(value, true)}"`).join("");
    if (!node.children.length) return `<${node.name}${attrs}/>`;
    const elementOnly = !node.preserve && node.children.some(child => child.kind === "element") && node.children.every(child => child.kind !== "cdata" && (child.kind !== "text" || (!child.value.trim() && /[\r\n]/.test(child.value))));
    const content = elementOnly ? node.children.filter(child => child.kind !== "text") : node.children;
    const canIndent = pretty && allowIndent && !node.preserve && !content.some(child => child.kind === "text" || child.kind === "cdata");
    const children = content.map(child => render(child, depth + 1, canIndent));
    const body = canIndent ? `\n${children.map(child => `${"  ".repeat(depth + 1)}${child}`).join("\n")}\n${"  ".repeat(depth)}` : children.join("");
    return `<${node.name}${attrs}>${body}</${node.name}>`;
  };
  // Document-level whitespace is formatting; mixed-content text and xml:space survive.
  return nodes.filter(node => node.kind !== "text" || node.value.trim()).map(node => render(node, 0, true)).join(pretty ? "\n" : "");
}

function xmlValue(nodes: XmlNode[]): Value {
  const root = nodes.find((node): node is XmlElement => node.kind === "element");
  if (!root) throw new Error("XML must contain one root element.");
  const walk = (node: XmlElement): Value => {
    const children = node.children.filter((child): child is XmlElement => child.kind === "element");
    const text = node.children.filter((child): child is Exclude<XmlNode, XmlElement> => child.kind === "text" || child.kind === "cdata").map(child => child.value).join("");
    if (!children.length && !Object.keys(node.attributes).length) return text;
    const entries = new Map<string, Value>();
    if (Object.keys(node.attributes).length) entries.set("@attributes", node.attributes);
    const grouped = new Map<string, Value[]>();
    for (const child of children) {
      const group = grouped.get(child.name) ?? [];
      group.push(walk(child));
      grouped.set(child.name, group);
    }
    for (const [name, values] of grouped) entries.set(name, values.length === 1 ? values[0] : values);
    if (text || !children.length) entries.set("#text", text);
    return Object.fromEntries(entries);
  };
  // This conventional projection is intentionally not an XML round-trip format:
  // comments/PI are omitted, CDATA is text, mixed text joins under #text, and sibling
  // order across different names is not expressible. The UI documents this mapping.
  return { [root.name]: walk(root) };
}

function jsonXml(value: Value): string {
  const validName = /^[A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\u{10000}-\u{effff}][A-Z_a-z0-9.\-\u00b7\u0300-\u036f\u203f-\u2040\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\u{10000}-\u{effff}]*$/u;
  const element = (name: string, node: Value): string => {
    if (!validName.test(name)) throw new Error(`Invalid XML element name ${JSON.stringify(name)}. Use unprefixed XML names (namespace prefixes are not inferred).`);
    let body: string;
    if (Array.isArray(node)) body = node.map(item => element("item", item)).join("");
    else if (node !== null && typeof node === "object") body = Object.entries(node).map(([key, item]) => element(key, item)).join("");
    else {
       const text = String(node);
      for (const char of text) {
        const code = char.codePointAt(0)!;
        if (!(code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff))) {
          throw new Error(`Element ${name} contains a character forbidden by XML 1.0 (U+${code.toString(16).toUpperCase()}).`);
        }
      }
      body = escapeXml(text);
    }
    return body ? `<${name}>${body}</${name}>` : `<${name}/>`;
  };
  return element("root", value);
}

function message(cause: unknown): string {
  if (cause instanceof RangeError) return "Document is too deeply nested or exceeds a parser resource limit.";
  return cause instanceof Error ? cause.message : String(cause);
}

export function runMarkupTool(id: string, inputs: DataInputs): DataResult {
  const input = inputs.input ?? "";
  try {
    let text: string;
    switch (id) {
      case "json-to-yaml": text = stringifyYaml(readJson(input)); break;
      case "yaml-to-json": text = JSON.stringify(yamlValue(input), null, 2); break;
      case "yaml-formatter": text = readYaml(input, true).toString({ indent: 2, lineWidth: 0 }); break;
      case "yaml-validator": readYaml(input); text = "Valid YAML."; break;
      case "yaml-diff": text = JSON.stringify(diffYaml(yamlValue(input), yamlValue(inputs.secondary ?? "")), null, 2); break;
      case "json-to-xml": text = renderXml(readXml(jsonXml(readJson(input))), true); break;
      case "xml-to-json": text = JSON.stringify(xmlValue(readXml(input)), null, 2); break;
      case "xml-formatter": text = renderXml(readXml(input), true); break;
      case "xml-minifier": text = renderXml(readXml(input), false); break;
      case "xml-validator": readXml(input); text = "Valid XML."; break;
      case "json-to-toml": {
        const value = readJson(input, true);
        if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("TOML requires a JSON object root.");
        text = stringifyToml(value, { maxDepth: MAX_DEPTH });
        break;
      }
      case "toml-to-json": {
        requireInput(input, "TOML");
        const value = parseToml(input, { integersAsBigInt: "asNeeded", maxDepth: MAX_DEPTH, unsafeKeyBehaviour: "keep" });
        text = JSON.stringify(jsonCompatible(value, "TOML"), null, 2);
        break;
      }
      default: throw new Error(`Unsupported markup tool: ${id}.`);
    }
    if (text.length > MAX_OUTPUT) throw new Error(`Output exceeds the ${MAX_OUTPUT.toLocaleString("en-US")}-character limit.`);
    return { text };
  } catch (cause) {
    return { text: `Invalid input: ${message(cause)}`, invalid: true };
  }
}
