/** Production HTTP and emitted-worker verification; NOT real-browser acceptance.
 * Run after npm run build / npm run start: node scripts/verify-security.mjs
 * All fixtures are public test data; never pass real secrets to this script.
 */
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import ts from "typescript";

const origin = process.env.BASE_URL ?? "http://localhost:3000";
const metadata = ts.transpileModule(await readFile("config/security-tools.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { securityTools, securityLegacyRedirects } = await import(`data:text/javascript;base64,${Buffer.from(metadata).toString("base64")}`);
const links = new Set(), scripts = new Set();
for (const tool of securityTools) {
  const response = await fetch(`${origin}/tools/${tool.slug}`);
  assert.equal(response.status, 200, tool.slug);
  const doc = new JSDOM(await response.text()).window.document;
  assert.equal(doc.querySelector("h1")?.textContent, tool.name);
  assert.ok(doc.title.includes(tool.name));
  assert.equal(doc.querySelector('meta[name="description"]')?.content, tool.description);
  assert.ok(doc.querySelector('link[rel="canonical"]')?.href.endsWith(`/tools/${tool.slug}`));
  assert.equal(doc.querySelector('meta[name="robots"]')?.content, "index, follow");
  const controls = [...doc.querySelectorAll("main form input,main form textarea,main form select")];
  assert.deepEqual(controls.map(node => node.name), tool.securityContract.fields.map(field => field.name));
  for (const field of tool.securityContract.fields) {
    const node = doc.getElementById(`security-${tool.slug}-${field.name}`);
    assert.ok(node && doc.querySelector(`label[for="${node.id}"]`));
    if (field.control === "checkbox") assert.equal(node.checked, tool.securityContract.defaults[field.name]);
    else assert.equal(node.value, tool.securityContract.defaults[field.name] ?? "");
    if (field.options) assert.deepEqual([...node.options].map(option => option.value), field.options);
  }
  assert.equal(doc.querySelector("main pre"), null, "Never render generated secrets during SSR");
  assert.ok([...doc.querySelectorAll("button")].some(button => button.textContent === tool.securityContract.action));
  assert.ok([...doc.querySelectorAll("h2")].some(heading => heading.textContent === "What does this tool do?"));
  for (const link of doc.querySelectorAll('nav[aria-label="Related tools"] a,nav[aria-label="Breadcrumb"] a')) links.add(link.getAttribute("href"));
  for (const script of doc.querySelectorAll("script[src]")) scripts.add(script.getAttribute("src"));
}
for (const url of [...links, ...scripts]) assert.equal((await fetch(new URL(url, origin))).status, 200, url);
for (const [source, destination] of Object.entries(securityLegacyRedirects)) {
  const response = await fetch(`${origin}/tools/${source}`, { redirect: "manual" });
  assert.equal(response.status, 308); assert.equal(response.headers.get("location"), `/tools/${destination}`);
}
for (const slug of ["json-formatter", "base64-encoder", "age-calculator", "regex-tester", "text-counter"]) assert.equal((await fetch(`${origin}/tools/${slug}`)).status, 200);
console.log(`PASS ${securityTools.length} Security pages: direct routes, exact fields/defaults/options, titles, canonical/index metadata, labels and empty initial results.`);
console.log(`PASS ${links.size} navigation links, ${scripts.size} scripts, 3 legacy redirects and 5 other-station routes.`);

let workerFile;
for (const name of await readdir(".next/static/chunks")) {
  if (!name.endsWith(".js")) continue;
  const source = await readFile(`.next/static/chunks/${name}`, "utf8");
  if (source.includes("self.onmessage=") && source.includes("delete") && source.includes(".request.file")) { workerFile = name; break; }
}
assert.ok(workerFile, "Compiled Security worker missing");
const assets = new Set([`/_next/static/chunks/${workerFile}`]);
let reply;
const context = vm.createContext({ URL, TextEncoder, TextDecoder, setTimeout, clearTimeout, crypto: webcrypto });
context.self = context;
context.postMessage = message => { reply = message; };
context.importScripts = url => {
  const path = new URL(url, origin).pathname;
  assert.ok(/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(path));
  assets.add(path);
  vm.runInContext(readFileSync(`.next/${path.slice("/_next/".length)}`, "utf8"), context, { timeout: 10_000 });
};
vm.runInContext(readFileSync(`.next/static/chunks/${workerFile}`, "utf8"), context, { timeout: 10_000 });
for (const tool of securityTools) {
  reply = undefined;
  const request = { values: { ...tool.securityContract.defaults, ...tool.securityContract.example } };
  if (tool.slug === "file-hash-generator") request.file = new File(["public test fixture"], "public-test.txt");
  await context.onmessage({ data: { slug: tool.slug, request } });
  assert.equal(reply?.error, undefined, tool.slug);
  assert.equal(typeof reply?.result?.text, "string", tool.slug);
  assert.equal(request.file, undefined, "File ref released"); assert.equal(Object.keys(request.values).length, 0);
}
for (const algorithm of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) {
  await context.onmessage({ data: { slug: "file-hash-generator", request: { values: { algorithm }, file: new File([new Uint8Array([0, 255, 128])], "public.bin") } } });
  assert.equal(reply?.result?.parts[3].value, createHash(algorithm.toLowerCase().replaceAll("-", "")).update(new Uint8Array([0, 255, 128])).digest("hex"));
}
await context.onmessage({ data: { slug: "md5-generator", request: { values: { input: "abc" } } } });
assert.equal(reply?.result?.text, "900150983cd24fb0d6963f7d28e17f72");
await context.onmessage({ data: { slug: "uuid-generator", request: { values: { version: "7" } } } });
assert.match(reply?.result?.text, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
for (const path of assets) assert.equal((await fetch(new URL(path, origin))).status, 200);
console.log(`PASS all 22 compiled-worker examples, four binary-file SHA vectors, MD5 vector and UUID v7; ${assets.size} worker/engine assets. VM check, not browser evidence.`);
