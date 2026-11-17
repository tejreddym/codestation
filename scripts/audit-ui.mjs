#!/usr/bin/env node
/**
 * UI token audit — dependency free.
 *
 * Errors (fail the build):
 *   1. var(--x) referenced under app/ or components/ but not defined in
 *      app/styles/tokens.css and not declared locally.
 *   2. A :root or [data-theme] block that declares custom properties outside
 *      app/styles/.
 *
 * Warnings (advisory in W0, promoted by --strict in later waves):
 *   3. Raw hex colors outside the documented allowlist.
 *   4. Media-query breakpoints outside 1200 / 1024 / 900 / 720 / 560.
 *   5. Button/panel class names duplicated across CSS modules.
 *
 * Usage: node scripts/audit-ui.mjs [--strict]
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const TOKEN_FILES = new Set(["app/styles/tokens.css"]);
const HEX_ALLOWLIST = new Set([
  ...TOKEN_FILES,
  "app/globals.css",
  "app/Home.module.css",
  "components/SqlErDiagram.module.css",
]);
const ALLOWED_BREAKPOINTS = [1200, 1024, 900, 720, 560];
const ALLOWED_BREAKPOINT_SET = new Set(ALLOWED_BREAKPOINTS);
const STRICT = process.argv.includes("--strict");
const MAX_WARNINGS_PER_CHECK = 40;
const MAX_DUPLICATES = 15;

const errors = [];
const warnings = [];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function collectDeclarations(css) {
  const names = new Set();
  for (const match of css.matchAll(/(--[\w-]+)\s*:/g)) names.add(match[1]);
  return names;
}

function collectReferences(css) {
  const names = new Set();
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1]);
  return names;
}

async function collectCssFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await collectCssFiles(full));
    else if (entry.name.endsWith(".css")) found.push(full);
  }
  return found;
}

const globalTokens = new Set();
for (const rel of TOKEN_FILES) {
  try {
    const css = stripComments(await readFile(path.join(ROOT, rel), "utf8"));
    for (const name of collectDeclarations(css)) globalTokens.add(name);
  } catch {
    errors.push(`${rel}: token file is missing`);
  }
}

const files = [];
for (const dir of SCAN_DIRS) files.push(...await collectCssFiles(path.join(ROOT, dir)));
files.sort();

const classOwners = new Map();

for (const absolute of files) {
  const rel = toPosix(path.relative(ROOT, absolute));
  const raw = await readFile(absolute, "utf8");
  const css = stripComments(raw);
  const localTokens = collectDeclarations(css);

  for (const name of collectReferences(css)) {
    if (globalTokens.has(name) || localTokens.has(name)) continue;
    errors.push(`${rel}: var(${name}) is not defined in tokens.css or locally`);
  }

  if (!TOKEN_FILES.has(rel)) {
    for (const match of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const selector = match[1].trim();
      const body = match[2];
      if (!/^(:root|\[data-theme)/.test(selector)) continue;
      if (!/--[\w-]+\s*:/.test(body)) continue;
      errors.push(`${rel}: token block "${selector}" must live in app/styles/`);
    }
  }

  const breakpoints = new Set();
  for (const match of css.matchAll(/@media[^{]*?\(\s*(?:max|min)-width\s*:\s*(\d+)px\s*\)/g)) {
    breakpoints.add(Number(match[1]));
  }
  const unexpected = [...breakpoints]
    .filter(value => !ALLOWED_BREAKPOINT_SET.has(value))
    .sort((a, b) => a - b);
  if (unexpected.length > 0) {
    warnings.push(
      `${rel}: breakpoints ${unexpected.join(", ")}px outside ${ALLOWED_BREAKPOINTS.join("/")}`,
    );
  }

  if (!HEX_ALLOWLIST.has(rel)) {
    const withoutUrls = css.replace(/url\([^)]*\)/g, "url()");
    const hexes = withoutUrls.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/g);
    if (hexes && hexes.length > 0) {
      warnings.push(`${rel}: ${hexes.length} raw hex color${hexes.length === 1 ? "" : "s"}`);
    }
  }

  if (!TOKEN_FILES.has(rel)) {
    for (const match of css.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      const name = match[1];
      if (!/(button|btn|panel)/i.test(name)) continue;
      if (!classOwners.has(name)) classOwners.set(name, new Set());
      classOwners.get(name).add(rel);
    }
  }
}

const duplicates = [...classOwners.entries()]
  .filter(([, owners]) => owners.size > 1)
  .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
for (const [name, owners] of duplicates.slice(0, MAX_DUPLICATES)) {
  warnings.push(`duplicate class .${name} in ${owners.size} modules: ${[...owners].join(", ")}`);
}
if (duplicates.length > MAX_DUPLICATES) {
  warnings.push(`duplicate class names: ${duplicates.length - MAX_DUPLICATES} more not listed`);
}

console.log("UI token audit");
console.log(`  css files scanned: ${files.length}`);
console.log(`  tokens defined: ${globalTokens.size}`);
console.log(
  `  errors: ${errors.length}  warnings: ${warnings.length}${STRICT ? "  (strict)" : ""}`,
);

if (errors.length > 0) {
  console.log("\nERRORS");
  for (const message of errors) console.log(`  x ${message}`);
}

if (warnings.length > 0) {
  console.log(`\nWARNINGS (advisory${STRICT ? "" : " until later waves"})`);
  for (const message of warnings.slice(0, MAX_WARNINGS_PER_CHECK)) console.log(`  ! ${message}`);
  if (warnings.length > MAX_WARNINGS_PER_CHECK) {
    console.log(`  ! ...and ${warnings.length - MAX_WARNINGS_PER_CHECK} more`);
  }
}

const failed = errors.length > 0 || (STRICT && warnings.length > 0);
console.log(`\n${failed ? "Audit failed." : "Audit passed."}`);
process.exitCode = failed ? 1 : 0;
