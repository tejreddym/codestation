/** Run after build + start: node scripts/verify-regex.mjs.
 * HTTP and emitted-worker checks using public fixtures; NOT browser acceptance.
 */
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { JSDOM } from "jsdom";
import ts from "typescript";

if (!isMainThread) {
  // Execute the actual emitted browser worker in an isolated Node thread with
  // worker-like globals; never evaluate user patterns as JavaScript source.
  const assets = new Set([`/_next/static/chunks/${workerData.file}`]);
  const context = vm.createContext({ URL, TextEncoder, TextDecoder, setTimeout, clearTimeout });
  context.self = context;
  context.postMessage = reply => parentPort.postMessage({ reply, assets: [...assets] });
  context.importScripts = url => {
    const path = new URL(url, "http://localhost:3000").pathname;
    assert.ok(/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(path));
    assets.add(path);
    vm.runInContext(readFileSync(`.next/${path.slice("/_next/".length)}`, "utf8"), context, { timeout: 10_000 });
  };
  vm.runInContext(readFileSync(`.next/static/chunks/${workerData.file}`, "utf8"), context, { timeout: 10_000 });
  parentPort.on("message", data => context.onmessage({ data }));
  parentPort.postMessage({ ready: true });
} else {
  const origin = process.env.BASE_URL ?? "http://localhost:3000";
  const metadata = ts.transpileModule(await readFile("config/regex-tools.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  const { regexTools } = await import(`data:text/javascript;base64,${Buffer.from(metadata).toString("base64")}`);
  const links = new Set(), scripts = new Set();
  for (const tool of regexTools) {
    const response = await fetch(`${origin}/tools/${tool.slug}`); assert.equal(response.status, 200);
    const doc = new JSDOM(await response.text()).window.document;
    assert.equal(doc.querySelector("h1")?.textContent, tool.name);
    assert.ok(doc.title.includes(tool.name));
    assert.equal(doc.querySelector('meta[name="description"]')?.content, tool.description);
    assert.ok(doc.querySelector('link[rel="canonical"]')?.href.endsWith(`/tools/${tool.slug}`));
    assert.equal(doc.querySelector('meta[name="robots"]')?.content, "index, follow");
    const fields = [...doc.querySelectorAll("main form textarea,main form select,main form fieldset")];
    assert.deepEqual(fields.map(node => node.id), tool.regexContract.fields.map(field => `${tool.slug}-${field.name}`));
    for (const field of tool.regexContract.fields) {
      const node = doc.getElementById(`${tool.slug}-${field.name}`);
      if (field.control === "checkbox-group") {
        assert.deepEqual([...node.querySelectorAll("input")].map(input => input.id.split("-").at(-1)), field.options);
        assert.ok([...node.querySelectorAll("input")].every(input => !input.checked));
      } else {
        assert.ok(doc.querySelector(`label[for="${node.id}"]`));
        assert.equal(node.value, tool.regexContract.defaults[field.name]);
        if (field.options) assert.deepEqual([...node.options].map(option => option.value), field.options);
      }
    }
    assert.equal(doc.querySelector("main pre"), null);
    assert.ok([...doc.querySelectorAll("button")].some(button => button.textContent === tool.regexContract.action));
    assert.ok(![...doc.querySelectorAll("button")].some(button => button.textContent.includes("Download")));
    for (const link of doc.querySelectorAll('nav[aria-label="Related tools"] a,nav[aria-label="Breadcrumb"] a')) links.add(link.getAttribute("href"));
    for (const script of doc.querySelectorAll("script[src]")) scripts.add(script.getAttribute("src"));
  }
  for (const url of [...links, ...scripts]) assert.equal((await fetch(new URL(url, origin))).status, 200);
  for (const slug of ["json-formatter", "base64-encoder", "uuid-generator", "age-calculator", "text-counter"]) assert.equal((await fetch(`${origin}/tools/${slug}`)).status, 200);
  console.log(`PASS 9 Regex pages: exact controls/defaults, direct routes, titles, canonical/index metadata, labels, no SSR results/downloads; ${links.size} links, ${scripts.size} scripts, 5 other-station routes.`);

  let file;
  for (const name of await readdir(".next/static/chunks")) {
    if (!name.endsWith(".js")) continue;
    const source = await readFile(`.next/static/chunks/${name}`, "utf8");
    if (source.includes("self.onmessage=") && source.includes("Regex processing failed.")) { file = name; break; }
  }
  assert.ok(file, "Compiled Regex worker missing");
  async function start() {
    const worker = new Worker(new URL(import.meta.url), { workerData: { file } });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { worker.terminate(); reject(new Error("Worker initialization timed out")); }, 10_000);
      worker.once("message", data => { clearTimeout(timer); assert.ok(data.ready); resolve(); });
      worker.once("error", reject);
    });
    return worker;
  }
  const assets = new Set();
  function run(worker, slug, values, timeout = 1500) {
    return new Promise((resolve, reject) => {
      const done = data => { clearTimeout(timer); for (const asset of data.assets) assets.add(asset); resolve(data.reply); };
      const timer = setTimeout(() => { worker.off("message", done); worker.terminate(); reject(new Error("Regex timed out")); }, timeout);
      worker.once("message", done); worker.postMessage({ slug, values });
    });
  }
  let worker = await start();
  try {
    for (const tool of regexTools) {
      const reply = await run(worker, tool.slug, { ...tool.regexContract.defaults, ...tool.regexContract.example });
      assert.equal(reply.error, undefined, tool.slug); assert.equal(typeof reply.result.kind, "string");
    }
    assert.equal((await run(worker, "regex-replace-tester", { pattern: "cat", text: "cat cat", flags: "", replacement: "fox" })).result.text, "fox cat");
    assert.deepEqual((await run(worker, "regex-tester", { pattern: "", text: "🚀x", flags: "gu" })).result.matches.map(match => match.start), [0, 2, 3]);
    assert.deepEqual((await run(worker, "regex-split-tester", { pattern: "(,)|(;)" , text: "a,b;c", flags: "" })).result.parts, ["a", ",", null, "b", null, ";", "c"]);
    assert.ok((await run(worker, "regex-tester", { pattern: "[", text: "x", flags: "" })).error.includes("Invalid JavaScript"));
    await assert.rejects(run(worker, "regex-tester", { pattern: "(a+)+$", text: "a".repeat(200) + "!", flags: "" }), /Regex timed out/);
  } finally { await worker.terminate(); }
  worker = await start();
  try { assert.equal((await run(worker, "regex-tester", { pattern: "a", text: "a", flags: "" })).result.count, 1); }
  finally { await worker.terminate(); }
  for (const asset of assets) assert.equal((await fetch(new URL(asset, origin))).status, 200);
  console.log(`PASS 9 emitted-worker examples, replacement/Unicode/split/invalid vectors, actual pathological-regex thread termination at 1500 ms and fresh-worker recovery; ${assets.size} assets. Node thread/VM, NOT browser evidence.`);
}
