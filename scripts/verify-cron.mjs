/** Build/start first, then node scripts/verify-cron.mjs. Public fixtures only.
 * HTTP and emitted-worker evidence, NOT browser acceptance.
 */
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { JSDOM } from "jsdom";
import ts from "typescript";

if (!isMainThread) {
  const assets = new Set([`/_next/static/chunks/${workerData.file}`]);
  const context = vm.createContext({ URL, TextEncoder, TextDecoder, Intl, setTimeout, clearTimeout });
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
  const source = ts.transpileModule(await readFile("config/cron-tools.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { cronTools } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const links = new Set(), scripts = new Set();
  for (const tool of cronTools) {
    const response = await fetch(`${origin}/tools/${tool.slug}`); assert.equal(response.status, 200, tool.slug);
    const doc = new JSDOM(await response.text()).window.document;
    assert.equal(doc.querySelector("h1")?.textContent, tool.name); assert.ok(doc.title.includes(tool.name));
    assert.equal(doc.querySelector('meta[name="description"]')?.content, tool.description);
    assert.ok(doc.querySelector('link[rel="canonical"]')?.href.endsWith(`/tools/${tool.slug}`));
    assert.equal(doc.querySelector('meta[name="robots"]')?.content, "index, follow");
    // Next may stream lazy controls in hidden Suspense containers outside main.
    // Check the emitted form without pretending this proves browser hydration.
    const inputs = [...doc.querySelectorAll("form input")];
    assert.deepEqual(inputs.map(node => node.name), tool.cronContract.fields.map(field => field.name));
    for (const field of tool.cronContract.fields) {
      const node = doc.getElementById(`cron-${tool.id}-${field.name}`);
      assert.ok(node); assert.ok(doc.querySelector(`label[for="${node.id}"]`)); assert.equal(node.value, tool.cronContract.defaults[field.name]);
    }
    assert.equal(doc.querySelector("form textarea,form select,form input[type=file],pre"), null);
    assert.ok([...doc.querySelectorAll("button")].some(button => button.textContent === tool.cronContract.action));
    assert.ok(![...doc.querySelectorAll("button")].some(button => button.textContent.includes("Download")));
    if (tool.id === "cron-next-run") {
      assert.ok(doc.querySelector('button[aria-label="Open calendar for Reference date/time"]'));
      assert.ok(doc.querySelector('button[aria-label="Open clock for Reference date/time"]'));
      assert.ok([...doc.querySelectorAll("button")].some(button => button.textContent === "Current date and time"));
    }
    for (const node of doc.querySelectorAll("main nav a,main .content a")) links.add(node.getAttribute("href"));
    for (const node of doc.querySelectorAll("script[src]")) scripts.add(node.getAttribute("src"));
  }
  const landingResponse = await fetch(`${origin}/stations/cron`); assert.equal(landingResponse.status, 200);
  const landing = new JSDOM(await landingResponse.text()).window.document;
  assert.equal(landing.querySelector("h1")?.textContent, "Cron Station"); assert.ok(landing.querySelector('link[rel="canonical"]')?.href.endsWith("/stations/cron"));
  assert.equal(landing.querySelectorAll(".tool-card").length, 6); assert.ok(landing.getElementById("cron-tool-search"));
  for (const node of landing.querySelectorAll("main a")) links.add(node.getAttribute("href"));
  const homepage = new JSDOM(await (await fetch(origin)).text()).window.document;
  assert.ok(homepage.querySelector('#categories a[href="/stations/cron"]'));
  assert.ok((await (await fetch(`${origin}/sitemap.xml`)).text()).includes("/stations/cron"));
  for (const url of [...links, ...scripts]) assert.equal((await fetch(new URL(url, origin))).status, 200, url);
  for (const slug of ["json-formatter", "base64-encoder", "uuid-generator", "regex-tester", "date-to-timestamp", "text-counter"]) assert.equal((await fetch(`${origin}/tools/${slug}`)).status, 200);
  console.log(`PASS six Cron pages, station landing/search/cards, homepage/sitemap, exact fields/defaults, metadata, ${links.size} navigation links, ${scripts.size} scripts and six other-station routes.`);

  let file;
  for (const name of await readdir(".next/static/chunks")) {
    if (!name.endsWith(".js")) continue;
    const code = await readFile(`.next/static/chunks/${name}`, "utf8");
    if (code.includes("self.onmessage=") && code.includes("Cron calculation failed.")) { file = name; break; }
  }
  assert.ok(file, "Compiled Cron worker missing");
  const worker = new Worker(new URL(import.meta.url), { workerData: { file } });
  const assets = new Set();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("Cron worker init timeout")); }, 10000);
    worker.once("message", data => { clearTimeout(timer); assert.ok(data.ready); resolve(); }); worker.once("error", reject);
  });
  function run(toolId, values) {
    return new Promise((resolve, reject) => {
      const done = data => { clearTimeout(timer); for (const asset of data.assets) assets.add(asset); resolve(data.reply); };
      const timer = setTimeout(() => { worker.off("message", done); worker.terminate(); reject(new Error("Cron worker timeout")); }, 10000);
      worker.once("message", done); worker.postMessage({ toolId, values });
    });
  }
  try {
    for (const tool of cronTools) {
      const reply = await run(tool.id, { ...tool.cronContract.defaults, ...tool.cronContract.example }); assert.equal(reply.error, undefined, tool.id); assert.deepEqual(reply.result.rows.map(row => row.label), tool.cronContract.outputs);
    }
    assert.equal((await run("cron-generator", { ...cronTools[0].cronContract.defaults, second: "*/10" })).result.rows[0].value, "*/10 * * * * *");
    assert.equal((await run("human-to-cron", { description: "weekdays at 18:00" })).result.rows[0].value, "0 18 * * 1-5");
    assert.equal((await run("cron-validator", { expression: "0 0 ? * MON" })).result.rows[0].value, "Invalid");
    assert.equal((await run("cron-validator", { expression: "0 0 31 FEB *" })).result.rows[0].value, "Valid");
    for (const [expression, reference, timezone, expected] of [
      ["0 9 * * *", "2026-10-05T00:00:00Z", "Asia/Kolkata", "2026-10-05T09:00:00+05:30[Asia/Kolkata]"],
      ["30 2 * * *", "2026-03-08T06:00:00Z", "America/New_York", "2026-03-09T02:30:00-04:00[America/New_York]"],
      ["30 1 * * *", "2026-11-01T05:45:00Z", "America/New_York", "2026-11-01T01:30:00-05:00[America/New_York]"],
      ["0 0 29 FEB *", "2025-01-01T00:00:00Z", "UTC", "2028-02-29T00:00:00+00:00[UTC]"],
      ["* * * * * *", "2026-10-05T00:00:00.500Z", "UTC", "2026-10-05T00:00:01+00:00[UTC]"],
    ]) assert.equal((await run("cron-next-run", { expression, reference, timezone })).result.rows[0].value, expected);
    assert.match((await run("cron-next-run", { expression: "0 0 31 FEB *", reference: "2026-01-01T00:00:00Z", timezone: "UTC" })).error, /No occurrence/);
  } finally { await worker.terminate(); }
  for (const asset of assets) assert.equal((await fetch(new URL(asset, origin))).status, 200);
  console.log(`PASS six emitted-worker examples, seconds mode, deterministic human conversion, validation, timezone/DST/leap/strict-next vectors and impossible-calendar error; ${assets.size} worker assets. Not browser/CSP proof.`);
}
