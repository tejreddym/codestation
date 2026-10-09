/**
 * Code Station: JSON to TypeScript and Zod Schema Generator
 * Deterministic client/CLI utility for developers and AI coding agents.
 */

function toPascalCase(str: string): string {
  const clean = str.replace(/[^a-zA-Z0-9]/g, " ");
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("") || "NestedType";
}

function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

function formatKey(key: string): string {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}

export function jsonToTypescript(jsonInput: string, rootName = "Root"): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const interfaces: Array<{ name: string; body: string }> = [];
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

  function resolveType(val: unknown, keyHint: string): string {
    if (val === null) return "null";
    if (val === undefined) return "undefined";

    const type = typeof val;
    if (type === "string" || type === "number" || type === "boolean") {
      return type;
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return "unknown[]";
      // Merge array item types
      const itemTypes = new Set<string>();
      const sampleObjects: Record<string, unknown>[] = [];

      for (const item of val) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          sampleObjects.push(item as Record<string, unknown>);
        } else {
          itemTypes.add(resolveType(item, `${keyHint}Item`));
        }
      }

      if (sampleObjects.length > 0) {
        // Merge object properties
        const merged: Record<string, { types: Set<string>; count: number }> = {};
        for (const obj of sampleObjects) {
          for (const [k, v] of Object.entries(obj)) {
            if (!merged[k]) merged[k] = { types: new Set(), count: 0 };
            merged[k].count += 1;
            merged[k].types.add(resolveType(v, k));
          }
        }

        const lines: string[] = [];
        for (const [k, meta] of Object.entries(merged)) {
          const isOptional = meta.count < sampleObjects.length;
          const typeStr = Array.from(meta.types).join(" | ") || "unknown";
          const formattedKey = formatKey(k) + (isOptional ? "?" : "");
          lines.push(`  ${formattedKey}: ${typeStr};`);
        }

        const interfaceName = getUniqueName(`${keyHint}Item`);
        interfaces.unshift({
          name: interfaceName,
          body: `export interface ${interfaceName} {\n${lines.join("\n")}\n}`,
        });
        itemTypes.add(interfaceName);
      }

      const union = Array.from(itemTypes).join(" | ");
      return union.includes(" | ") ? `(${union})[]` : `${union}[]`;
    }

    if (type === "object") {
      const obj = val as Record<string, unknown>;
      const lines: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const typeStr = resolveType(v, k);
        lines.push(`  ${formatKey(k)}: ${typeStr};`);
      }

      const interfaceName = getUniqueName(keyHint);
      interfaces.unshift({
        name: interfaceName,
        body: `export interface ${interfaceName} {\n${lines.join("\n")}\n}`,
      });
      return interfaceName;
    }

    return "unknown";
  }

  const rootTypeName = toPascalCase(rootName) || "Root";
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const rootType = resolveType(parsed, rootTypeName);
    // If the root interface was generated under another name, rename it to rootTypeName
    const found = interfaces.find((i) => i.name === rootType);
    if (found) {
      found.name = rootTypeName;
      found.body = found.body.replace(`export interface ${rootType}`, `export interface ${rootTypeName}`);
    }
    return interfaces.map((i) => i.body).join("\n\n");
  } else if (Array.isArray(parsed)) {
    const itemType = resolveType(parsed, rootTypeName);
    return `${interfaces.map((i) => i.body).join("\n\n")}\n\nexport type ${rootTypeName} = ${itemType};`.trim();
  } else {
    const primitiveType = resolveType(parsed, rootTypeName);
    return `export type ${rootTypeName} = ${primitiveType};`;
  }
}

export function jsonToZod(jsonInput: string, rootName = "rootSchema"): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const schemas: Array<{ name: string; body: string }> = [];
  const createdNames = new Set<string>();

  function getUniqueName(base: string): string {
    let name = base.endsWith("Schema") ? base : `${base}Schema`;
    let counter = 1;
    while (createdNames.has(name)) {
      counter += 1;
      name = `${base}${counter}Schema`;
    }
    createdNames.add(name);
    return name;
  }

  function resolveZod(val: unknown, keyHint: string): string {
    if (val === null) return "z.null()";
    if (val === undefined) return "z.undefined()";

    if (typeof val === "string") return "z.string()";
    if (typeof val === "number") return Number.isInteger(val) ? "z.number().int()" : "z.number()";
    if (typeof val === "boolean") return "z.boolean()";

    if (Array.isArray(val)) {
      if (val.length === 0) return "z.array(z.unknown())";
      const sampleObjects: Record<string, unknown>[] = [];
      const itemSchemas = new Set<string>();

      for (const item of val) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          sampleObjects.push(item as Record<string, unknown>);
        } else {
          itemSchemas.add(resolveZod(item, `${keyHint}Item`));
        }
      }

      if (sampleObjects.length > 0) {
        const merged: Record<string, { schemas: Set<string>; count: number }> = {};
        for (const obj of sampleObjects) {
          for (const [k, v] of Object.entries(obj)) {
            if (!merged[k]) merged[k] = { schemas: new Set(), count: 0 };
            merged[k].count += 1;
            merged[k].schemas.add(resolveZod(v, k));
          }
        }

        const lines: string[] = [];
        for (const [k, meta] of Object.entries(merged)) {
          const isOptional = meta.count < sampleObjects.length;
          let schemaStr = Array.from(meta.schemas)[0] || "z.unknown()";
          if (meta.schemas.size > 1) {
            schemaStr = `z.union([${Array.from(meta.schemas).join(", ")}])`;
          }
          if (isOptional) {
            schemaStr += ".optional()";
          }
          lines.push(`  ${formatKey(k)}: ${schemaStr},`);
        }

        const schemaName = getUniqueName(`${keyHint}Item`);
        schemas.unshift({
          name: schemaName,
          body: `export const ${schemaName} = z.object({\n${lines.join("\n")}\n});`,
        });
        itemSchemas.add(schemaName);
      }

      const union = Array.from(itemSchemas);
      if (union.length === 1) return `z.array(${union[0]})`;
      return `z.array(z.union([${union.join(", ")}]))`;
    }

    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const lines: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        lines.push(`  ${formatKey(k)}: ${resolveZod(v, k)},`);
      }

      const schemaName = getUniqueName(keyHint);
      schemas.unshift({
        name: schemaName,
        body: `export const ${schemaName} = z.object({\n${lines.join("\n")}\n});`,
      });
      return schemaName;
    }

    return "z.unknown()";
  }

  const safeRootName = rootName.endsWith("Schema") ? rootName : `${rootName}Schema`;
  const typeName = toPascalCase(rootName.replace(/Schema$/i, "")) || "Root";

  const rootResult = resolveZod(parsed, safeRootName);
  const found = schemas.find((s) => s.name === rootResult);
  if (found) {
    found.name = safeRootName;
    found.body = found.body.replace(`export const ${rootResult}`, `export const ${safeRootName}`);
  }

  const header = `import { z } from "zod";\n\n`;
  const schemaDeclarations = schemas.map((s) => s.body).join("\n\n");
  const typeExport = `\n\nexport type ${typeName} = z.infer<typeof ${safeRootName}>;`;

  return header + (schemaDeclarations ? `${schemaDeclarations}${typeExport}` : `export const ${safeRootName} = ${rootResult};${typeExport}`);
}
