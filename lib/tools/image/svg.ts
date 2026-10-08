import { SaxesParser } from "saxes";
import { dimensions } from "./headers";
import { ImageError } from "./types";

type Node = { name: string; attributes: Record<string, string>; children: (Node | string)[] };
const elements = new Set(["svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "title", "desc", "clipPath", "linearGradient", "radialGradient", "stop"]);
const attributes = new Set(["xmlns", "id", "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke-opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "dx", "dy", "rotate", "textLength", "lengthAdjust", "preserveAspectRatio", "role", "aria-label", "aria-labelledby", "aria-describedby", "xml:space", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "spreadMethod", "fx", "fy", "fr", "version"]);
const textElements = new Set(["text", "tspan", "title", "desc"]);
const escapeText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (value: string) => escapeText(value).replace(/"/g, "&quot;").replace(/\t/g, "&#9;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");

/** Parse and reconstruct a deliberately small, non-network SVG subset. Never insert SVG into DOM. */
function parse(source: string): Node {
  if (!source.trim() || source.length > 1_000_000) throw new ImageError("Enter SVG source no larger than one million characters.", "source");
  const parser = new SaxesParser({ xmlns: true });
  let root: Node | undefined, count = 0;
  const stack: Node[] = [];
  const fail = (message: string): never => { throw new ImageError(message, "source"); };
  parser.on("error", () => fail("SVG must be well-formed XML."));
  parser.on("doctype", () => fail("SVG document types and custom entities are not allowed."));
  parser.on("processinginstruction", () => fail("SVG processing instructions are not allowed."));
  parser.on("opentag", tag => {
    if (++count > 10_000 || stack.length >= 64) fail("SVG exceeds the 10,000-element or 64-level limit.");
    if (!elements.has(tag.name) || tag.prefix || tag.uri !== "http://www.w3.org/2000/svg") fail(`Unsupported or unsafe SVG element: ${tag.name}. Use the SVG namespace and static shapes/text only.`);
    if (!stack.length && (root || tag.name !== "svg")) fail("A single SVG root is required.");
    const node: Node = { name: tag.name, attributes: {}, children: [] };
    for (const attribute of Object.values(tag.attributes)) {
      const name = attribute.name, value = attribute.value;
      const descriptive = ["aria-label", "aria-labelledby", "aria-describedby", "id", "role"].includes(name);
      if (!attributes.has(name) || !descriptive && (/url\s*\(|\\|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i.test(value) || name !== "xmlns" && /(?:javascript|https?|data|file):/i.test(value))) fail(`Unsupported or unsafe SVG attribute: ${name}. Events, styles and resource loads are not allowed.`);
      if (name === "xmlns" && (stack.length || value !== "http://www.w3.org/2000/svg")) fail("Only the SVG root namespace is allowed.");
      if (name === "xml:space" && !["default", "preserve"].includes(value)) fail("Invalid xml:space value.");
      node.attributes[name] = value;
    }
    if (stack.length) stack[stack.length - 1].children.push(node); else root = node;
    stack.push(node);
  });
  parser.on("closetag", () => { stack.pop(); });
  const text = (value: string) => {
    if (stack.length) stack[stack.length - 1].children.push(value);
    else if (value.trim()) fail("Text outside the SVG root is not allowed.");
  };
  parser.on("text", text); parser.on("cdata", text);
  // Comments cannot affect rendering and are intentionally removed from serialized source.
  try { parser.write(source).close(); }
  catch (error) { if (error instanceof ImageError) throw error; fail("SVG must be well-formed XML."); }
  if (!root) fail("A single SVG root is required.");
  return root!;
}

function serialize(node: Node, pretty: boolean, level = 0, preserveText = false): string {
  const attrs = Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join("");
  if (!node.children.length) return `<${node.name}${attrs}/>`;
  const protectedText = preserveText || textElements.has(node.name) || node.attributes["xml:space"] === "preserve";
  const mixed = node.children.some(child => typeof child === "string" && child.trim().length > 0);
  if (!pretty || protectedText || mixed) {
    const children = protectedText || mixed ? node.children : node.children.filter(child => typeof child !== "string" || child.trim());
    return `<${node.name}${attrs}>${children.map(child => typeof child === "string" ? escapeText(child) : serialize(child, pretty, level + 1, protectedText || mixed)).join("")}</${node.name}>`;
  }
  const children = node.children.filter(child => typeof child !== "string" || child.trim());
  if (!children.length) return `<${node.name}${attrs}>${node.children.map(child => typeof child === "string" ? escapeText(child) : "").join("")}</${node.name}>`;
  return `<${node.name}${attrs}>\n${children.map(child => `${"  ".repeat(level + 1)}${typeof child === "string" ? escapeText(child) : serialize(child, true, level + 1)}`).join("\n")}\n${"  ".repeat(level)}</${node.name}>`;
}

function intrinsicLength(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+(?:\.\d+)?(?:px)?$/.test(value)) throw new ImageError("SVG intrinsic width and height must use positive numbers or px units.", "source");
  const number = Number(value.replace(/px$/, ""));
  if (!Number.isFinite(number) || number <= 0) throw new ImageError("Invalid SVG intrinsic dimensions.", "source");
  return Math.ceil(number);
}

export function svgText(source: string, pretty: boolean): string { return serialize(parse(source), pretty); }
export function svgRasterSource(source: string, width?: number, height?: number): { text: string; width: number; height: number } {
  const root = parse(source);
  let defaultWidth = 300, defaultHeight = 150;
  if (root.attributes.viewBox !== undefined) {
    const parts = root.attributes.viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0 || parts.some(n => Math.abs(n) > 1_000_000)) throw new ImageError("SVG viewBox must contain four bounded numbers with positive width/height.", "source");
    defaultWidth = Math.ceil(parts[2]); defaultHeight = Math.ceil(parts[3]);
  }
  const intrinsicWidth = intrinsicLength(root.attributes.width, defaultWidth), intrinsicHeight = intrinsicLength(root.attributes.height, defaultHeight);
  dimensions(intrinsicWidth, intrinsicHeight);
  const w = width ?? intrinsicWidth, h = height ?? intrinsicHeight;
  dimensions(w, h);
  root.attributes.width = String(w); root.attributes.height = String(h);
  return { text: serialize(root, false), width: w, height: h };
}
