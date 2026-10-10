/**
 * Code Station: Code Generation Engine
 * 100% Client-side AST/Regex transformations:
 * - JSON to TypeScript, Zod, Go Struct, Python Pydantic v2, Rust Serde
 * - SQL DDL to TypeScript
 * - HTML to React JSX/TSX
 * - SVG to React Component
 */

import { jsonToTypescript, jsonToZod } from "../json-to-types";

export { jsonToTypescript, jsonToZod };

// Helper string formatters
export function toPascalCase(str: string): string {
  const clean = str.replace(/[^a-zA-Z0-9]/g, " ");
  return (
    clean
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("") || "Root"
  );
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)/g, "_$1")
    .replace(/[-\s]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/** ----------------------------------------------------
 * 1. JSON to Go Struct
 * --------------------------------------------------- */
export function jsonToGo(jsonInput: string, rootName = "Root"): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const structs: Array<{ name: string; body: string }> = [];
  const createdNames = new Set<string>();

  function getUniqueName(base: string): string {
    let name = toPascalCase(base);
    let counter = 1;
    while (createdNames.has(name)) {
      counter += 1;
      name = `${toPascalCase(base)}${counter}`;
    }
    createdNames.add(name);
    return name;
  }

  function resolveGoType(val: unknown, keyHint: string): string {
    if (val === null || val === undefined) return "any";
    if (typeof val === "boolean") return "bool";
    if (typeof val === "number") return Number.isInteger(val) ? "int64" : "float64";
    if (typeof val === "string") return "string";

    if (Array.isArray(val)) {
      if (val.length === 0) return "[]any";
      const first = val[0];
      const itemType = resolveGoType(first, `${keyHint}Item`);
      return `[]${itemType}`;
    }

    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const structName = getUniqueName(keyHint);
      const fields: string[] = [];

      for (const [key, propVal] of Object.entries(obj)) {
        let fieldName = toPascalCase(key);
        // Common Go initialisms
        fieldName = fieldName.replace(/(Id|Url|Api|Ip|Http|Sql|Json)$/g, (m) => m.toUpperCase());
        if (/^id$/i.test(fieldName)) fieldName = "ID";
        else if (/^url$/i.test(fieldName)) fieldName = "URL";
        else if (/^api$/i.test(fieldName)) fieldName = "API";
        else if (/^ip$/i.test(fieldName)) fieldName = "IP";

        const fieldType = resolveGoType(propVal, key);
        fields.push(`\t${fieldName} ${fieldType} \`json:"${key}"\``);
      }

      structs.unshift({
        name: structName,
        body: `type ${structName} struct {\n${fields.join("\n")}\n}`,
      });
      return structName;
    }

    return "any";
  }

  const rootTypeName = toPascalCase(rootName) || "Root";
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const rootType = resolveGoType(parsed, rootTypeName);
    const found = structs.find((s) => s.name === rootType);
    if (found) {
      found.name = rootTypeName;
      found.body = found.body.replace(`type ${rootType} struct`, `type ${rootTypeName} struct`);
    }
    return structs.map((s) => s.body).join("\n\n");
  } else if (Array.isArray(parsed)) {
    const itemType = resolveGoType(parsed, rootTypeName);
    return `${structs.map((s) => s.body).join("\n\n")}\n\ntype ${rootTypeName} = ${itemType}`.trim();
  } else {
    const primitiveType = resolveGoType(parsed, rootTypeName);
    return `type ${rootTypeName} = ${primitiveType}`;
  }
}

/** ----------------------------------------------------
 * 2. JSON to Python Pydantic v2
 * --------------------------------------------------- */
export function jsonToPydantic(jsonInput: string, rootName = "RootModel"): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const classes: Array<{ name: string; body: string }> = [];
  const createdNames = new Set<string>();

  function getUniqueName(base: string): string {
    let name = toPascalCase(base);
    let counter = 1;
    while (createdNames.has(name)) {
      counter += 1;
      name = `${toPascalCase(base)}${counter}`;
    }
    createdNames.add(name);
    return name;
  }

  function resolvePyType(val: unknown, keyHint: string): string {
    if (val === null || val === undefined) return "Optional[Any]";
    if (typeof val === "boolean") return "bool";
    if (typeof val === "number") return Number.isInteger(val) ? "int" : "float";
    if (typeof val === "string") return "str";

    if (Array.isArray(val)) {
      if (val.length === 0) return "List[Any]";
      const itemType = resolvePyType(val[0], `${keyHint}Item`);
      return `List[${itemType}]`;
    }

    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const className = getUniqueName(keyHint);
      const fields: string[] = [];

      for (const [key, propVal] of Object.entries(obj)) {
        const pyKey = toSnakeCase(key);
        const propType = resolvePyType(propVal, key);
        if (pyKey !== key) {
          fields.push(`    ${pyKey}: ${propType} = Field(..., alias="${key}")`);
        } else {
          fields.push(`    ${pyKey}: ${propType}`);
        }
      }

      classes.unshift({
        name: className,
        body: `class ${className}(BaseModel):\n${fields.length > 0 ? fields.join("\n") : "    pass"}`,
      });
      return className;
    }

    return "Any";
  }

  const rootTypeName = toPascalCase(rootName) || "RootModel";
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const rootType = resolvePyType(parsed, rootTypeName);
    const found = classes.find((c) => c.name === rootType);
    if (found) {
      found.name = rootTypeName;
      found.body = found.body.replace(`class ${rootType}(BaseModel):`, `class ${rootTypeName}(BaseModel):`);
    }
    return `from pydantic import BaseModel, Field\nfrom typing import Any, List, Optional\n\n` + classes.map((c) => c.body).join("\n\n");
  } else if (Array.isArray(parsed)) {
    const itemType = resolvePyType(parsed, rootTypeName);
    return `from pydantic import BaseModel, Field\nfrom typing import Any, List, Optional\n\n${classes.map((c) => c.body).join("\n\n")}\n\n${rootTypeName} = ${itemType}`.trim();
  } else {
    return `from typing import Any\n\n${rootTypeName} = ${resolvePyType(parsed, rootTypeName)}`;
  }
}

/** ----------------------------------------------------
 * 3. JSON to Rust Serde
 * --------------------------------------------------- */
export function jsonToRust(jsonInput: string, rootName = "Root"): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const structs: Array<{ name: string; body: string }> = [];
  const createdNames = new Set<string>();

  function getUniqueName(base: string): string {
    let name = toPascalCase(base);
    let counter = 1;
    while (createdNames.has(name)) {
      counter += 1;
      name = `${toPascalCase(base)}${counter}`;
    }
    createdNames.add(name);
    return name;
  }

  function resolveRustType(val: unknown, keyHint: string): string {
    if (val === null || val === undefined) return "Option<serde_json::Value>";
    if (typeof val === "boolean") return "bool";
    if (typeof val === "number") return Number.isInteger(val) ? "i64" : "f64";
    if (typeof val === "string") return "String";

    if (Array.isArray(val)) {
      if (val.length === 0) return "Vec<serde_json::Value>";
      const itemType = resolveRustType(val[0], `${keyHint}Item`);
      return `Vec<${itemType}>`;
    }

    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const structName = getUniqueName(keyHint);
      const fields: string[] = [];

      for (const [key, propVal] of Object.entries(obj)) {
        const rustKey = toSnakeCase(key);
        const propType = resolveRustType(propVal, key);
        if (rustKey !== key) {
          fields.push(`    #[serde(rename = "${key}")]\n    pub ${rustKey}: ${propType},`);
        } else {
          fields.push(`    pub ${rustKey}: ${propType},`);
        }
      }

      structs.unshift({
        name: structName,
        body: `#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]\n#[serde(rename_all = "camelCase")]\npub struct ${structName} {\n${fields.join("\n")}\n}`,
      });
      return structName;
    }

    return "serde_json::Value";
  }

  const rootTypeName = toPascalCase(rootName) || "Root";
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const rootType = resolveRustType(parsed, rootTypeName);
    const found = structs.find((s) => s.name === rootType);
    if (found) {
      found.name = rootTypeName;
      found.body = found.body.replace(`pub struct ${rootType} {`, `pub struct ${rootTypeName} {`);
    }
    return `use serde::{Deserialize, Serialize};\n\n` + structs.map((s) => s.body).join("\n\n");
  } else if (Array.isArray(parsed)) {
    const itemType = resolveRustType(parsed, rootTypeName);
    return `use serde::{Deserialize, Serialize};\n\n${structs.map((s) => s.body).join("\n\n")}\n\npub type ${rootTypeName} = ${itemType};`.trim();
  } else {
    return `pub type ${rootTypeName} = ${resolveRustType(parsed, rootTypeName)};`;
  }
}

/** ----------------------------------------------------
 * 4. SQL DDL to TypeScript
 * --------------------------------------------------- */
export function sqlToTypescript(sql: string): string {
  if (!sql.trim()) return "";

  // Find CREATE TABLE statements
  const tableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:["`]?(\w+)["`]?\.)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)(?:;|\s*$)/gi;
  const interfaces: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[2] || match[1];
    const columnsBody = match[3];
    const lines = columnsBody.split("\n");

    const fields: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim().replace(/,\s*$/, "");
      if (!line) continue;

      // Skip constraints and indices
      if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|INDEX|CHECK)/i.test(line)) {
        continue;
      }

      // Parse: [column_name] [DATA_TYPE] [NULL | NOT NULL] ...
      const colMatch = line.match(/^["`]?([a-zA-Z0-9_]+)["`]?\s+([a-zA-Z0-9_]+(?:\([^\)]+\))?)([\s\S]*)$/);
      if (!colMatch) continue;

      const colName = colMatch[1];
      const colType = colMatch[2].toUpperCase().replace(/\([^\)]+\)/, "");
      const modifiers = colMatch[3].toUpperCase();

      const isNullable = !modifiers.includes("NOT NULL") && !modifiers.includes("PRIMARY KEY");

      let tsType = "string";
      if (/INT|SERIAL|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE|BIGINT|SMALLINT/i.test(colType)) {
        tsType = "number";
      } else if (/BOOL/i.test(colType)) {
        tsType = "boolean";
      } else if (/DATE|TIME|TIMESTAMP/i.test(colType)) {
        tsType = "Date | string";
      } else if (/JSON/i.test(colType)) {
        tsType = "Record<string, unknown>";
      } else if (/BYTEA|BLOB|BINARY/i.test(colType)) {
        tsType = "Uint8Array";
      }

      const nullableType = isNullable ? `${tsType} | null` : tsType;
      fields.push(`  ${colName}: ${nullableType};`);
    }

    const interfaceName = toPascalCase(tableName);
    interfaces.push(`export interface ${interfaceName} {\n${fields.join("\n")}\n}`);
  }

  if (interfaces.length === 0) {
    throw new Error("No valid CREATE TABLE statements detected in SQL DDL input.");
  }

  return interfaces.join("\n\n");
}

/** ----------------------------------------------------
 * 5. HTML to JSX / TSX
 * --------------------------------------------------- */
export function htmlToJsx(html: string): string {
  if (!html.trim()) return "";

  let jsx = html;

  // Replace HTML comments <!-- ... --> with {/* ... */}
  jsx = jsx.replace(/<!--([\s\S]*?)-->/g, "{/*$1*/}");

  // Replace common attributes: class -> className, for -> htmlFor
  jsx = jsx.replace(/\bclass=(["'])/g, "className=$1");
  jsx = jsx.replace(/\bfor=(["'])/g, "htmlFor=$1");
  jsx = jsx.replace(/\btabindex=(["'])/g, "tabIndex=$1");
  jsx = jsx.replace(/\bautocomplete=(["'])/g, "autoComplete=$1");
  jsx = jsx.replace(/\bautofocus=(["'])/g, "autoFocus=$1");
  jsx = jsx.replace(/\breadonly=(["'])/g, "readOnly=$1");
  jsx = jsx.replace(/\bmaxlength=(["'])/g, "maxLength=$1");
  jsx = jsx.replace(/\browspan=(["'])/g, "rowSpan=$1");
  jsx = jsx.replace(/\bcolspan=(["'])/g, "colSpan=$1");

  // Convert inline style strings style="color: red; margin-top: 10px;" to style={{ color: "red", marginTop: "10px" }}
  jsx = jsx.replace(/\bstyle=(["'])(.*?)\1/g, (_, __, styleContent) => {
    const rules = styleContent.split(";").filter((r: string) => r.trim());
    const objProps = rules.map((r: string) => {
      const [k, ...vParts] = r.split(":");
      if (!k || vParts.length === 0) return "";
      const propKey = toCamelCase(k.trim());
      const propVal = vParts.join(":").trim();
      return `${propKey}: "${propVal}"`;
    }).filter(Boolean);

    return `style={{ ${objProps.join(", ")} }}`;
  });

  // Self-close void elements: <img ...>, <input ...>, <br>, <hr>, <link ...>, <meta ...>
  const voidTags = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"];
  for (const tag of voidTags) {
    const regex = new RegExp(`<(${tag})((?:\\s+[^>/]+)?)(?<!/)>`, "gi");
    jsx = jsx.replace(regex, `<$1$2 />`);
  }

  return jsx;
}

/** ----------------------------------------------------
 * 6. SVG to React Component
 * --------------------------------------------------- */
export function svgToJsx(svg: string, componentName = "Icon"): string {
  if (!svg.trim()) return "";

  let cleanedSvg = svg.trim();

  // Strip XML prolog and DOCTYPE
  cleanedSvg = cleanedSvg.replace(/<\?xml[\s\S]*?\?>/i, "").trim();
  cleanedSvg = cleanedSvg.replace(/<!DOCTYPE[\s\S]*?>/i, "").trim();

  // Strip SVG comments
  cleanedSvg = cleanedSvg.replace(/<!--[\s\S]*?-->/g, "");

  // Convert kebab-case attributes to camelCase
  const svgAttributes = [
    "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
    "fill-rule", "fill-opacity", "clip-rule", "clip-path", "font-size", "font-family", "font-weight", "text-anchor", "stop-color", "stop-opacity"
  ];
  for (const attr of svgAttributes) {
    const camel = toCamelCase(attr);
    const regex = new RegExp(`\\b${attr}=`, "g");
    cleanedSvg = cleanedSvg.replace(regex, `${camel}=`);
  }

  // Convert class -> className
  cleanedSvg = cleanedSvg.replace(/\bclass=/g, "className=");

  // Ensure svg opening tag takes {...props}
  cleanedSvg = cleanedSvg.replace(/<svg\b([^>]*)>/i, `<svg$1 {...props}>`);

  // Void tags in SVG
  cleanedSvg = cleanedSvg.replace(/<(path|circle|rect|line|polyline|polygon|ellipse)((?:\s+[^>/]+)?)(?<!\/)>(\s*<\/\1>)?/gi, `<$1$2 />`);

  const safeComponentName = toPascalCase(componentName) || "Icon";

  return `import * as React from "react";

export function ${safeComponentName}(props: React.SVGProps<SVGSVGElement>) {
  return (
    ${cleanedSvg.split("\n").map(line => `    ${line}`).join("\n").trim()}
  );
}
`;
}
