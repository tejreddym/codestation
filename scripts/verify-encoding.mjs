/** Production HTTP + compiled-worker checks, NOT real-browser visual/history tests.
 * Run after npm run build and npm run start: node scripts/verify-encoding.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import ts from "typescript";

const origin = process.env.BASE_URL ?? "http://localhost:3000";
const metadata = ts.transpileModule(await readFile("config/encoding-tools.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { encodingTools, encodingLegacyRedirects } = await import(`data:text/javascript;base64,${Buffer.from(metadata).toString("base64")}`);
const links = new Set();
const scripts = new Set();
for (const tool of encodingTools) {
  const response = await fetch(`${origin}/tools/${tool.slug}`);
  assert.equal(response.status, 200, tool.slug);
  const doc = new JSDOM(await response.text()).window.document;
  assert.equal(doc.querySelector("h1")?.textContent, tool.name, tool.slug);
  assert.ok(doc.title.includes(tool.name), `Title: ${tool.slug}`);
  assert.equal(doc.querySelector('meta[name="description"]')?.content, tool.description);
  assert.ok(doc.querySelector('link[rel="canonical"]')?.href.endsWith(`/tools/${tool.slug}`));
  assert.equal(doc.querySelector('meta[name="robots"]')?.content, "index, follow");
  const controls = [...doc.querySelectorAll("main form input,main form textarea,main form select")];
  assert.deepEqual(controls.map(node => node.name), tool.encodingContract.fields.map(field => field.name));
  for (const field of tool.encodingContract.fields) {
    const node = doc.getElementById(`encoding-${tool.slug}-${field.name}`);
    assert.equal(node?.getAttribute("placeholder"), field.placeholder, `Placeholder: ${tool.slug}`);
    assert.equal(node?.value, "", `Initially empty: ${tool.slug}/${field.name}`);
  }
  assert.ok([...doc.querySelectorAll("button")].some(button => button.textContent === tool.encodingContract.action));
  assert.ok([...doc.querySelectorAll("h2")].some(heading => heading.textContent === tool.encodingContract.outputLabel));
  for (const link of doc.querySelectorAll('nav[aria-label="Related tools"] a,nav[aria-label="Conversion direction"] a,nav[aria-label="Breadcrumb"] a')) links.add(link.getAttribute("href"));
  for (const script of doc.querySelectorAll("script[src]")) scripts.add(script.getAttribute("src"));
}
for (const url of [...links, ...scripts]) assert.equal((await fetch(new URL(url, origin))).status, 200, url);
for (const [source, destination] of Object.entries(encodingLegacyRedirects)) {
  const response = await fetch(`${origin}/tools/${source}`, { redirect: "manual" });
  assert.equal(response.status, 308, source);
  assert.equal(response.headers.get("location"), `/tools/${destination}`, source);
}
for (const slug of ["json-formatter", "age-calculator", "password-generator", "regex-tester", "text-counter"]) {
  assert.equal((await fetch(`${origin}/tools/${slug}`)).status, 200, slug);
}
console.log(`PASS ${encodingTools.length} Encoding pages: SSR fields/placeholders, titles, metadata, output labels, CTAs.`);
console.log(`PASS ${links.size} navigation links, ${scripts.size} page scripts, 7 legacy redirects and 5 other station routes.`);

// Execute the emitted worker, loading only its local emitted chunks. This tests
// the bundler output without controlling or claiming to emulate a real browser.
let workerFile;
for (const name of await readdir(".next/static/chunks")) {
  if (!name.endsWith(".js")) continue;
  const source = await readFile(`.next/static/chunks/${name}`, "utf8");
  if (source.includes("self.onmessage=") && source.includes("Unknown Encoding tool.")) { workerFile = name; break; }
}
assert.ok(workerFile, "Production Encoding worker missing");
const assets = new Set([`/_next/static/chunks/${workerFile}`]);
let reply;
const context = vm.createContext({ console, URL, TextEncoder, TextDecoder, setTimeout, clearTimeout });
context.self = context;
context.postMessage = message => { reply = message; };
context.importScripts = url => {
  const path = new URL(url, origin).pathname;
  assert.ok(/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(path), "Unexpected worker import");
  assets.add(path);
  vm.runInContext(readFileSync(`.next/${path.slice("/_next/".length)}`, "utf8"), context, { timeout: 10_000 });
};
vm.runInContext(readFileSync(`.next/static/chunks/${workerFile}`, "utf8"), context, { timeout: 10_000 });
for (const tool of encodingTools) {
  reply = undefined;
  await context.onmessage({ data: { slug: tool.slug, inputs: tool.encodingContract.example } });
  assert.equal(reply?.error, undefined, `${tool.slug}: ${reply?.error}`);
  assert.equal(typeof reply?.result?.text, "string", tool.slug);
}
await context.onmessage({ data: { slug: "unicode-escape-decoder", inputs: { input: String.raw`\uD83D\uDE80` } } });
assert.equal(reply?.result?.text, "🚀", "Compiled Unicode escape decoder");
for (const path of assets) assert.equal((await fetch(new URL(path, origin))).status, 200, path);
console.log(`PASS all 35 compiled-worker examples and Unicode regression; ${assets.size} worker/parser assets. Not a browser-worker/layout test.`);
