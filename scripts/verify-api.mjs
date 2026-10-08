/** Read-only production markup checks. Does not send API tester inputs or execute snippets. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const origin = process.env.VERIFY_ORIGIN || "http://localhost:3000";
const source = await readFile(new URL("../config/api-tools.ts", import.meta.url), "utf8");
const ids = [...source.matchAll(/define\("([a-z-]+)"/g)].map(match => match[1]);
assert.equal(ids.length, 16);
async function page(path) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, path);
  return response.text();
}
for (const id of ids) {
  const html = await page(`/tools/${id}`);
  assert.match(html, /<h1/); assert.match(html, /What does this tool do\?/); assert.match(html, /How to use it\?/);
  assert.match(html, /rel="canonical"/); assert.ok(html.includes(`/tools/${id}`)); assert.ok(html.includes('/stations/api'));
}
const landing = await page('/stations/api');
for (const id of ids) assert.ok(landing.includes(`/tools/${id}`), id);
const home = await page('/'); assert.ok(home.includes('/stations/api'));
const sitemap = await page('/sitemap.xml'); for (const id of ids) assert.ok(sitemap.includes(`/tools/${id}`));
const previous = ['json-formatter', 'base64-encoder', 'uuid-generator', 'regex-tester', 'timezone-converter', 'text-counter', 'cron-next-run', 'sql-formatter', 'url-parser'];
for (const id of previous) assert.match(await page(`/tools/${id}`), /<h1/);
console.log(`API production markup passed: ${ids.length} tools, landing/home/sitemap, ${previous.length} prior-station routes. No tester requests executed.`);
