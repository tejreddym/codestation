const base = (process.env.PREVIEW_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const expectIndexing = process.env.EXPECTED_INDEXING === "index";
const expectedOrigin = process.env.EXPECTED_ORIGIN ?? "";
const minSitemapUrls = Number(process.env.EXPECTED_MIN_SITEMAP_URLS || 380);
const checks = [
  ["/", 200],
  ["/stations/json-data", 200],
  ["/tools/json-formatter", 200],
  ["/workbench", 200],
  ["/manifest.webmanifest", 200],
  ["/offline-assets.json", 200],
  ["/robots.txt", 200],
  ["/sitemap.xml", 200],
  ["/tools/timestamp-converter", 308],
];

function fail(message) {
  throw new Error(message);
}

for (const [path, expectedStatus] of checks) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  if (response.status !== expectedStatus) fail(`${path}: expected HTTP ${expectedStatus}, got ${response.status}`);
  if (path !== "/tools/timestamp-converter") {
    for (const [header, expected] of [["x-content-type-options", "nosniff"], ["x-frame-options", "DENY"], ["referrer-policy", "strict-origin-when-cross-origin"]]) {
      if (response.headers.get(header) !== expected) fail(`${path}: missing ${header}=${expected}`);
    }
  }
  if (path === "/tools/timestamp-converter" && response.headers.get("location") !== "/tools/unix-timestamp-converter") fail(`${path}: canonical redirect is incorrect`);

  const body = await response.text();
  if (path === "/robots.txt") {
    const expected = expectIndexing ? "Allow: /" : "Disallow: /";
    if (!body.includes(expected)) fail(`${path}: expected ${expected}`);
  }
  if (path === "/sitemap.xml") {
    const urls = (body.match(/<loc>/g) ?? []).length;
    if (expectedOrigin) {
      if (urls < minSitemapUrls) fail(`${path}: expected at least ${minSitemapUrls} URLs, got ${urls}`);
      if (!body.includes(expectedOrigin)) fail(`${path}: expected origin is absent`);
    } else if (urls !== 0) {
      fail(`${path}: expected 0 URLs without EXPECTED_ORIGIN, got ${urls}`);
    }
  }
  if (path === "/offline-assets.json") {
    const manifest = JSON.parse(body);
    if (!/^[a-f0-9]{16}$/.test(manifest.version) || !Array.isArray(manifest.assets) || manifest.assets.length === 0) fail(`${path}: invalid offline manifest`);
  }
}

console.log(`Cloudflare preview checks passed at ${base} (${expectIndexing ? "indexing enabled" : "noindex"}).`);
