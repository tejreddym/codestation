/** Build/start first: node scripts/verify-sql.mjs. Public fixtures only.
 * HTTP + compiled worker evidence, not live-browser acceptance.
 */
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { JSDOM } from "jsdom";
import ts from "typescript";

if (!isMainThread) {
  const assets = new Set([`/_next/static/chunks/${workerData.file}`]);
  const context = vm.createContext({ URL, URLSearchParams, TextEncoder, TextDecoder, Intl, setTimeout, clearTimeout });
  context.self = context;
  context.postMessage = reply => parentPort.postMessage({ reply, assets: [...assets] });
  context.importScripts = url => {
    const path = new URL(url, "http://localhost:3000").pathname;
    assert.ok(/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(path)); assets.add(path);
    vm.runInContext(readFileSync(`.next/${path.slice("/_next/".length)}`, "utf8"), context, { timeout: 15000 });
  };
  vm.runInContext(readFileSync(`.next/static/chunks/${workerData.file}`, "utf8"), context, { timeout: 15000 });
  parentPort.on("message", data => void context.onmessage({ data }));
  parentPort.postMessage({ ready: true });
} else {
  const origin = process.env.BASE_URL ?? "http://localhost:3000";
  async function moduleUrl(path) {
    let source = await readFile(path, "utf8");
    for (const match of [...source.matchAll(/from "(\.\.?\/[\w/-]+)"/g)]) source = source.replaceAll(match[0], `from "${await moduleUrl(resolve(dirname(path), `${match[1]}.ts`))}"`);
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  }
  const { sqlTools } = await import(await moduleUrl("config/sql-tools.ts"));
  const links = new Set(), scripts = new Set();
  for (const tool of sqlTools) {
    const response = await fetch(`${origin}/tools/${tool.slug}`); assert.equal(response.status, 200, tool.slug);
    const doc = new JSDOM(await response.text()).window.document;
    assert.equal(doc.querySelector("h1")?.textContent, tool.name); assert.ok(doc.title.includes(tool.name));
    assert.equal(doc.querySelector('meta[name="description"]')?.content, tool.description); assert.equal(doc.querySelector('meta[name="robots"]')?.content, "index, follow");
    assert.ok(doc.querySelector('link[rel="canonical"]')?.href.endsWith(`/tools/${tool.slug}`));
    // Lazy SSR forms can stream into hidden Suspense containers outside main.
    for (const field of tool.sqlContract.fields) {
      const node = doc.getElementById(`sql-${tool.slug}-${field.name}`); assert.ok(node, `${tool.id}:${field.name}`);
      if (["columns", "rows", "conditions", "assignments", "order"].includes(field.control)) assert.equal(node.querySelector("legend")?.textContent, field.label);
      else {
        assert.ok(doc.querySelector(`label[for="${node.id}"]`)); assert.equal(node.value, tool.sqlContract.defaults[field.name]);
        if (field.options) assert.deepEqual([...node.options].map(option => option.value), field.options);
        if (field.control === "password") assert.equal(node.type, "password");
      }
    }
    const form = doc.querySelector("form"); assert.ok(form); assert.equal(form.querySelectorAll('input[type="file"]').length, 0);
    assert.equal(doc.querySelector("pre"), null, "No persisted/generated source result on initial load");
    assert.ok([...form.querySelectorAll("button")].some(button => button.textContent === tool.sqlContract.action));
    assert.ok(![...form.querySelectorAll("button")].some(button => /Run SQL|Execute|Test connection|Download/.test(button.textContent)));
    for (const node of doc.querySelectorAll("main nav a,main .content a")) links.add(node.getAttribute("href"));
    for (const node of doc.querySelectorAll("script[src]")) scripts.add(node.getAttribute("src"));
  }
  const stationResponse = await fetch(`${origin}/stations/sql-database`); assert.equal(stationResponse.status, 200);
  const station = new JSDOM(await stationResponse.text()).window.document;
  assert.equal(station.querySelector("h1")?.textContent, "SQL & Database Station"); assert.equal(station.querySelectorAll(".tool-card").length, 17);
  assert.ok(station.getElementById("sql-database-search")); assert.ok(station.querySelector('link[rel="canonical"]')?.href.endsWith("/stations/sql-database"));
  for (const node of station.querySelectorAll("main a")) links.add(node.getAttribute("href"));
  const homepage = new JSDOM(await (await fetch(origin)).text()).window.document; assert.ok(homepage.querySelector('#categories a[href="/stations/sql-database"]'));
  assert.ok((await (await fetch(`${origin}/sitemap.xml`)).text()).includes("/stations/sql-database"));
  for (const url of [...links, ...scripts]) assert.equal((await fetch(new URL(url, origin))).status, 200, url);
  for (const slug of ["json-formatter", "base64-encoder", "uuid-generator", "regex-tester", "date-to-timestamp", "text-counter", "cron-generator"]) assert.equal((await fetch(`${origin}/tools/${slug}`)).status, 200);
  console.log(`PASS 17 SQL pages, exact emitted controls/defaults/password behavior/metadata, station search/cards, home/sitemap, ${links.size} links, ${scripts.size} scripts and seven completed-station pages.`);

  let file;
  for (const name of await readdir(".next/static/chunks")) {
    if (!name.endsWith(".js")) continue;
    const code = await readFile(`.next/static/chunks/${name}`, "utf8");
    if (code.includes("self.onmessage=") && code.includes("SQL processing failed.")) { file = name; break; }
  }
  assert.ok(file, "Compiled SQL worker missing");
  const worker = new Worker(new URL(import.meta.url), { workerData: { file } }); const assets = new Set();
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("SQL worker init timeout")); }, 15000);
    worker.once("message", data => { clearTimeout(timer); assert.ok(data.ready); resolveReady(); }); worker.once("error", reject);
  });
  function run(toolId, values) {
    return new Promise((resolveResult, reject) => {
      const done = data => { clearTimeout(timer); for (const asset of data.assets) assets.add(asset); resolveResult(data.reply); };
      const timer = setTimeout(() => { worker.off("message", done); worker.terminate(); reject(new Error("SQL worker timeout")); }, 15000);
      worker.once("message", done); worker.postMessage({ toolId, values });
    });
  }
  try {
    for (const tool of sqlTools) {
      const reply = await run(tool.id, { ...tool.sqlContract.defaults, ...tool.sqlContract.example }); assert.equal(reply.error, undefined, tool.id); assert.deepEqual(reply.result.rows.map(row => row.label), tool.sqlContract.outputs);
    }
    for (const dialect of ["PostgreSQL", "MySQL", "SQLite", "SQL Server"]) {
      for (const tool of sqlTools.filter(tool => tool.sqlContract.fields.some(field => field.name === "dialect"))) {
        const reply = await run(tool.id, { ...tool.sqlContract.defaults, ...tool.sqlContract.example, dialect }); assert.equal(reply.error, undefined, `${tool.id}:${dialect}`); assert.deepEqual(reply.result.rows.map(row => row.label), tool.sqlContract.outputs);
      }
      const generated = (await run("sql-insert-generator", { table: "users", columns: ["name"], rows: [[{ type: "String", value: "తెలుగు O'Reilly C:\\folder" }]], dialect })).result.rows[0].value;
      assert.deepEqual(JSON.parse((await run("sql-to-json", { sql: generated, dialect })).result.rows[0].value), [{ name: "తెలుగు O'Reilly C:\\folder" }]);
      const invalid = (await run("sql-validator", { sql: "SELECT FROM;", dialect })).result; assert.equal(invalid.rows[0].value, "Invalid");
    }
    const connection = (await run("database-connection-string-builder", { databaseType: "SQL Server", host: "db.example.com", port: "1433", database: "demo", username: "demo", password: "PUBLIC_DEMO_ONLY", parameters: "AccessToken=PUBLIC_TOKEN" })).result.rows[0].value;
    const parsed = (await run("database-connection-string-parser", { connectionString: connection })).result;
    assert.equal(parsed.rows[5].value, "••••••••"); assert.ok(!JSON.stringify(parsed).includes("PUBLIC_DEMO_ONLY")); assert.ok(!JSON.stringify(parsed).includes("PUBLIC_TOKEN"));
    assert.deepEqual((await run("er-diagram-generator", { sql: "CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE posts(id INTEGER PRIMARY KEY,user_id INTEGER);", dialect: "PostgreSQL" })).result.schema.relationships, []);
    assert.match((await run("sql-to-json", { sql: "SELECT 1;", dialect: "PostgreSQL" })).error, /syntax|INSERT/i);
  } finally { await worker.terminate(); }
  for (const asset of assets) assert.equal((await fetch(new URL(asset, origin))).status, 200);
  console.log(`PASS 17 compiled-worker examples plus all four dialect examples, Unicode/literal roundtrips, Invalid status, credential redaction and declared-only ER vectors; ${assets.size} worker/library assets. VM evidence, not browser/CSP proof.`);
}
