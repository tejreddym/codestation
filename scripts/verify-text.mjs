/** After build/start: node scripts/verify-text.mjs. Public fixtures only.
 * Production HTTP + emitted-worker checks, NOT real-browser acceptance.
 */
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import assert from "node:assert/strict";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { JSDOM } from "jsdom";
import ts from "typescript";

if (!isMainThread) {
  const assets = new Set([`/_next/static/chunks/${workerData.file}`]);
  const context = vm.createContext({ URL, TextEncoder, TextDecoder, Intl, crypto: webcrypto, setTimeout, clearTimeout });
  context.self = context;
  context.postMessage = reply => parentPort.postMessage({ reply, assets: [...assets] });
  context.importScripts = url => {
    const path = new URL(url, "http://localhost:3000").pathname;
    assert.ok(/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(path)); assets.add(path);
    vm.runInContext(readFileSync(`.next/${path.slice("/_next/".length)}`, "utf8"), context, { timeout: 10000 });
  };
  vm.runInContext(readFileSync(`.next/static/chunks/${workerData.file}`, "utf8"), context, { timeout: 10000 });
  parentPort.on("message", data => void context.onmessage({ data }));
  parentPort.postMessage({ ready: true });
} else {
  const origin = process.env.BASE_URL ?? "http://localhost:3000";
  const metadata = ts.transpileModule(await readFile("config/text-tools.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { textTools } = await import(`data:text/javascript;base64,${Buffer.from(metadata).toString("base64")}`);
  const links = new Set(), scripts = new Set();
  for (const tool of textTools) {
    const response = await fetch(`${origin}/tools/${tool.slug}`); assert.equal(response.status, 200, tool.slug);
    const doc = new JSDOM(await response.text()).window.document;
    assert.equal(doc.querySelector("h1")?.textContent, tool.name); assert.ok(doc.title.includes(tool.name));
    assert.equal(doc.querySelector('meta[name="description"]')?.content, tool.description);
    assert.ok(doc.querySelector('link[rel="canonical"]')?.href.endsWith(`/tools/${tool.slug}`));
    assert.equal(doc.querySelector('meta[name="robots"]')?.content, "index, follow");
    const nodes = [...doc.querySelectorAll("main form input,main form select,main form textarea")];
    assert.deepEqual([...new Set(nodes.map(node => node.name))], tool.textContract.fields.map(field => field.name));
    for (const field of tool.textContract.fields) {
      const node = doc.getElementById(`text-${tool.slug}-${field.name}`);
      assert.ok(node);
      if (field.control === "checkbox-group") {
        assert.deepEqual([...node.querySelectorAll("input")].map(input => input.value), field.options);
        assert.ok([...node.querySelectorAll("input")].every(input => !input.checked));
      } else {
        assert.ok(doc.querySelector(`label[for="${node.id}"]`));
        if (field.control === "checkbox") assert.equal(node.checked, tool.textContract.defaults[field.name]);
        else assert.equal(node.value, tool.textContract.defaults[field.name]);
        if (field.options) assert.deepEqual([...node.options].map(option => option.value), field.options);
      }
    }
    if (["lorem-ipsum-generator", "random-text-generator"].includes(tool.id)) assert.equal(doc.querySelector("main textarea"), null, "No fake generator source input");
    assert.equal(doc.querySelector("main pre"), null);
    assert.ok([...doc.querySelectorAll("button")].some(button => button.textContent === tool.textContract.action));
    assert.ok(![...doc.querySelectorAll("button")].some(button => button.textContent === "Download"));
    if (tool.pairedTool) assert.equal(doc.querySelector('nav[aria-label="Text conversion direction"] a')?.getAttribute("href"), `/tools/${tool.pairedTool}`);
    for (const node of doc.querySelectorAll("main nav a")) links.add(node.getAttribute("href"));
    for (const node of doc.querySelectorAll("script[src]")) scripts.add(node.getAttribute("src"));
  }
  for (const url of [...links, ...scripts]) assert.equal((await fetch(new URL(url, origin))).status, 200, url);
  const alias = await fetch(`${origin}/tools/character-counter-no-spaces`, { redirect: "manual" });
  assert.equal(alias.status, 308); assert.equal(alias.headers.get("location"), "/tools/character-counter-without-spaces");
  for (const slug of ["json-formatter", "base64-encoder", "uuid-generator", "regex-tester", "date-to-timestamp"]) assert.equal((await fetch(`${origin}/tools/${slug}`)).status, 200);
  console.log(`PASS 31 Text pages, exact fields/defaults, generator isolation, direction links, metadata, ${links.size} navigation links, ${scripts.size} scripts, one alias and five other-station routes.`);

  let file;
  for (const name of await readdir(".next/static/chunks")) {
    if (!name.endsWith(".js")) continue;
    const source = await readFile(`.next/static/chunks/${name}`, "utf8");
    if (source.includes("self.onmessage=") && source.includes("Text processing failed.")) { file = name; break; }
  }
  assert.ok(file, "Compiled Text worker missing");
  async function start() {
    const worker = new Worker(new URL(import.meta.url), { workerData: { file } });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { worker.terminate(); reject(new Error("Worker initialization timed out")); }, 10000);
      worker.once("message", data => { clearTimeout(timer); assert.ok(data.ready); resolve(); }); worker.once("error", reject);
    });
    return worker;
  }
  const assets = new Set();
  function run(worker, slug, values) {
    return new Promise((resolve, reject) => {
      const done = data => { clearTimeout(timer); for (const asset of data.assets) assets.add(asset); resolve(data.reply); };
      const timer = setTimeout(() => { worker.off("message", done); worker.terminate(); reject(new Error("Text worker timeout")); }, slug === "regex-line-extractor" ? 1500 : 10000);
      worker.once("message", done); worker.postMessage({ slug, values });
    });
  }
  let worker = await start();
  try {
    for (const tool of textTools) {
      const reply = await run(worker, tool.id, { ...tool.textContract.defaults, ...tool.textContract.example });
      assert.equal(reply.error, undefined, tool.id); assert.deepEqual(reply.result.rows.map(row => row.label), tool.textContract.outputs);
    }
    assert.equal((await run(worker, "reverse-text", { text: "e\u0301👩‍💻🇮🇳" })).result.rows[0].value, "🇮🇳👩‍💻e\u0301");
    assert.equal((await run(worker, "lf-to-crlf", { text: "a\r\nb\rc\n" })).result.rows[0].value, "a\r\nb\r\nc\r\n");
    assert.equal((await run(worker, "find-replace", { text: "a.a", find: ".", replacement: "$&", replaceAll: true })).result.rows[0].value, "a$&a");
    assert.equal((await run(worker, "regex-line-extractor", { text: "a\na", pattern: "a", flags: "gy" })).result.rows[1].value, "2");
    const diff = (await run(worker, "text-diff", { textA: "same\nold\n", textB: "same\nnew\n" })).result;
    assert.equal(diff.rows[1].value, "new\n"); assert.equal(diff.rows[2].value, "old\n");
    await assert.rejects(run(worker, "regex-line-extractor", { text: "a".repeat(200) + "!", pattern: "(a+)+$", flags: "" }), /timeout/);
  } finally { await worker.terminate(); }
  worker = await start();
  try { assert.equal((await run(worker, "regex-line-extractor", { text: "a", pattern: "a", flags: "" })).result.rows[1].value, "1"); }
  finally { await worker.terminate(); }
  for (const asset of assets) assert.equal((await fetch(new URL(asset, origin))).status, 200);
  console.log(`PASS 31 emitted-worker examples, Unicode/CRLF/literal replacement/diff/regex vectors, pathological regex thread termination and recovery; ${assets.size} assets. VM/thread evidence, not browser acceptance.`);
}
