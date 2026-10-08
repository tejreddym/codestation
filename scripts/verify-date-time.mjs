/** Production HTTP + compiled-engine checks, not browser visual acceptance.
 * Run after build/start: node scripts/verify-date-time.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
import { JSDOM } from "jsdom";
const origin = process.env.BASE_URL ?? "http://localhost:3000";
const source = ts.transpileModule(await readFile("config/date-time-tools.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { dateTimeTools } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const links = new Set(), scripts = new Set();
for (const tool of dateTimeTools) {
  const response = await fetch(`${origin}/tools/${tool.slug}`); assert.equal(response.status, 200, tool.slug);
  const doc = new JSDOM(await response.text()).window.document;
  assert.equal(doc.querySelector("h1")?.textContent, tool.name);
  assert.ok(doc.title.includes(tool.name));
  assert.equal(doc.querySelector('meta[name="description"]')?.content, tool.description);
  assert.ok(doc.querySelector('link[rel="canonical"]')?.href.endsWith(`/tools/${tool.slug}`));
  assert.equal(doc.querySelector('meta[name="robots"]')?.content, "index, follow");
  const fields = tool.dateTimeContract.fields.filter(field => !field.when);
  assert.deepEqual([...doc.querySelectorAll("main form input,main form select,main form textarea")].map(node => node.name), fields.map(field => field.name));
  for (const field of fields) {
    const node = doc.getElementById(`date-time-${tool.slug}-${field.name}`);
    assert.ok(node && doc.querySelector(`label[for="${node.id}"]`));
    assert.equal(node.value, tool.dateTimeContract.defaults[field.name]);
    if (field.options) assert.deepEqual([...node.options].map(option => option.value), field.options);
  }
  assert.equal(doc.querySelector("main pre"), null);
  assert.ok([...doc.querySelectorAll("button")].some(node => node.textContent === tool.dateTimeContract.action));
  assert.ok(![...doc.querySelectorAll("button")].some(node => node.textContent.includes("Download")));
  if (tool.pairedTool) assert.equal(doc.querySelector('nav[aria-label="Date and timestamp conversion direction"] a')?.getAttribute("href"), `/tools/${tool.pairedTool}`);
  for (const node of doc.querySelectorAll("main nav a")) links.add(node.getAttribute("href"));
  for (const node of doc.querySelectorAll("script[src]")) scripts.add(node.getAttribute("src"));
}
for (const url of [...links, ...scripts]) assert.equal((await fetch(new URL(url, origin))).status, 200, url);
const redirect = await fetch(`${origin}/tools/timestamp-converter`, { redirect: "manual" });
assert.equal(redirect.status, 308); assert.equal(redirect.headers.get("location"), "/tools/unix-timestamp-converter");
for (const slug of ["json-formatter", "base64-encoder", "uuid-generator", "regex-tester", "text-counter"]) assert.equal((await fetch(`${origin}/tools/${slug}`)).status, 200);
console.log(`PASS 17 Date & Time pages, exact SSR contracts, direction links, canonical/index metadata, ${links.size} navigation links, ${scripts.size} scripts, legacy redirect and 5 other-station routes.`);

// Load only local production code; never evaluate user text as JavaScript.
const registrations = [];
const context = vm.createContext({ Intl, Date, self: { webpackChunk_N_E: registrations } });
let file;
for (const name of await readdir(".next/static/chunks")) {
  if (!name.endsWith(".js")) continue;
  const text = await readFile(`.next/static/chunks/${name}`, "utf8");
  if (text.includes("Unsupported Date & Time tool.")) { file = name; vm.runInContext(text, context, { timeout: 10_000 }); break; }
}
assert.ok(file, "Compiled engine missing");
const modules = Object.assign({}, ...registrations.map(entry => entry[1]));
const cache = {};
function requireModule(id) {
  if (cache[id]) return cache[id].exports;
  const module = { exports: {} }; cache[id] = module;
  assert.ok(modules[id], `Missing local engine module ${id}`); modules[id](module, module.exports, requireModule); return module.exports;
}
requireModule.d = (exports, definitions) => { for (const [key, get] of Object.entries(definitions)) Object.defineProperty(exports, key, { enumerable: true, get }); };
let runDateTime;
for (const id of Object.keys(modules)) { const exports = requireModule(id); if (exports.runDateTime) runDateTime = exports.runDateTime; }
assert.ok(runDateTime);
const environment = { now: Date.parse("2026-10-03T12:00:00Z"), localZone: "UTC" };
for (const tool of dateTimeTools) {
  const result = runDateTime(tool.id, { ...tool.dateTimeContract.defaults, ...tool.dateTimeContract.example }, environment);
  assert.deepEqual(Array.from(result.rows, row => row.label), tool.dateTimeContract.outputs);
}
for (const [date, time, error] of [["2026-03-08", "02:30", /does not exist/], ["2026-11-01", "01:30", /occurs twice/]]) assert.throws(() => runDateTime("date-to-timestamp", { date, time, timezone: "America/New_York" }, environment), error);
assert.equal(runDateTime("unix-timestamp-converter", { timestamp: "-0.001", unit: "Seconds" }, environment).rows[1].value, "1969-12-31T23:59:59.999Z");
assert.equal((await fetch(`${origin}/_next/static/chunks/${file}`)).status, 200);
console.log("PASS all 17 compiled-engine examples, DST gap/fold rejection and exact negative timestamp; engine asset served. VM check, not browser evidence.");
