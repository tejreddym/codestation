/* Explicit, bounded offline PWA worker. Never cache API/payment/license routes or tool inputs. */
let installing = false;

const CACHE_VERSION = "v2";
const CORE_CACHE = `code-station-core-${CACHE_VERSION}`;
const PAGES_CACHE = `code-station-pages-${CACHE_VERSION}`;
const STATIC_CACHE = `code-station-static-${CACHE_VERSION}`;
const PACK_PREFIX = "code-station-offline-v1-";

const CORE_ASSETS = ["/offline", "/app-icon.svg", "/manifest.webmanifest"];
const PACK_PAGES = ["/offline", "/tools/json-formatter", "/tools/text-counter"];
const EXCLUDED_NAV_PREFIXES = ["/api/", "/pro", "/tools/api-request-tester"];

function isExcludedPath(pathname) {
  return EXCLUDED_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

function isCacheableNavigation(pathname) {
  if (isExcludedPath(pathname)) return false;
  return (
    pathname === "/" ||
    pathname === "/offline" ||
    pathname.startsWith("/tools/")
  );
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/brand/platform/") ||
    pathname === "/app-icon.svg" ||
    pathname === "/manifest.webmanifest"
  );
}

async function openReadyPackCache() {
  const names = (await caches.keys()).filter((n) => n.startsWith(PACK_PREFIX));
  for (const name of names) {
    const cache = await caches.open(name);
    if (await cache.match("/__code-station-offline-ready")) return cache;
  }
  return null;
}

async function matchAny(key, names) {
  for (const name of names) {
    const cache = await caches.open(name);
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  return null;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const coreCache = await caches.open(CORE_CACHE);
        const staticCache = await caches.open(STATIC_CACHE);
        await Promise.all(
          CORE_ASSETS.map(async (assetPath) => {
            try {
              const res = await fetch(assetPath, { credentials: "same-origin" });
              if (!res.ok || res.redirected) return;
              if (assetPath === "/offline") {
                const html = await res.clone().text();
                await coreCache.put(assetPath, res);
                const staticRefs = [
                  ...new Set(html.match(/\/_next\/static\/[^"'\\<>\s)]+/g) ?? []),
                ].slice(0, 64);
                await Promise.all(
                  staticRefs.map(async (ref) => {
                    try {
                      const assetRes = await fetch(ref, { credentials: "same-origin" });
                      if (assetRes.ok && !assetRes.redirected) {
                        await staticCache.put(ref, assetRes);
                      }
                    } catch {
                      // Ignore individual chunk prefetch errors during install.
                    }
                  })
                );
              } else {
                await coreCache.put(assetPath, res);
              }
            } catch {
              // Offline or test environments may not serve core assets during install.
            }
          })
        );
      } finally {
        await self.skipWaiting();
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([CORE_CACHE, PAGES_CACHE, STATIC_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.map(async (name) => {
          if (keep.has(name)) return;
          if (name.startsWith("code-station-core-") || name.startsWith("code-station-pages-") || name.startsWith("code-station-static-")) {
            await caches.delete(name);
            return;
          }
          if (name.startsWith(PACK_PREFIX)) {
            const cache = await caches.open(name);
            const ready = await cache.match("/__code-station-offline-ready");
            if (!ready) await caches.delete(name);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "INSTALL_PACK" || !event.ports[0]) return;
  const port = event.ports[0];
  if (installing) {
    port.postMessage({ error: "Another offline download is in progress. Wait for it to finish." });
    return;
  }
  installing = true;
  event.waitUntil(
    (async () => {
      let name = "";
      try {
        const response = await fetch("/offline-assets.json", { cache: "no-store" });
        if (!response.ok) throw Error("Offline packs require a production build.");
        const manifest = await response.json();
        if (
          !/^[a-f0-9]{16}$/.test(manifest.version) ||
          !Array.isArray(manifest.assets) ||
          manifest.assets.length > 1500 ||
          manifest.bytes > 40 * 1024 * 1024 ||
          manifest.assets.some(
            (p) =>
              typeof p !== "string" ||
              !p.startsWith("/_next/static/") ||
              p.includes("..") ||
              p.includes("?") ||
              p.includes("#")
          )
        ) {
          throw Error("Invalid offline manifest.");
        }
        name = PACK_PREFIX + manifest.version;
        const cache = await caches.open(name);
        const paths = [...PACK_PAGES, "/app-icon.svg", "/manifest.webmanifest", ...manifest.assets];
        let completed = 0;
        if (await cache.match("/__code-station-offline-ready")) {
          port.postMessage({ done: true });
          return;
        }
        for (const assetPath of paths) {
          const result = await fetch(assetPath, { cache: "reload", credentials: "same-origin" });
          if (!result.ok || result.redirected) {
            throw Error("A required offline asset could not be downloaded.");
          }
          await cache.put(assetPath, result);
          port.postMessage({ progress: ++completed, total: paths.length });
        }
        await cache.put("/__code-station-offline-ready", new Response("ready"));
        for (const old of await caches.keys()) {
          if (old.startsWith(PACK_PREFIX) && old !== name) await caches.delete(old);
        }
        port.postMessage({ done: true });
      } catch (error) {
        if (name) {
          const cache = await caches.open(name);
          if (!(await cache.match("/__code-station-offline-ready"))) {
            await caches.delete(name);
          }
        }
        port.postMessage({
          error: error instanceof Error ? error.message : "Offline download failed.",
        });
      } finally {
        installing = false;
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.search ||
    isExcludedPath(url.pathname) ||
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch")
  ) {
    return;
  }

  if (request.mode === "navigate" && isCacheableNavigation(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok && !networkResponse.redirected) {
            const cache = await caches.open(PAGES_CACHE);
            await cache.put(url.pathname, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const readyPack = await openReadyPackCache();
          const packed = readyPack ? await readyPack.match(url.pathname) : null;
          if (packed) return packed;

          const cached = await matchAny(url.pathname, [PAGES_CACHE, CORE_CACHE]);
          if (cached) return cached;

          const offlineFallback = await matchAny("/offline", [PAGES_CACHE, CORE_CACHE]);
          if (offlineFallback) return offlineFallback;

          return new Response("Offline pack unavailable. Reconnect and download it in Settings.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })()
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const readyPack = await openReadyPackCache();
        const packed = readyPack ? await readyPack.match(url.pathname) : null;
        if (packed) return packed;

        const cached = await matchAny(url.pathname, [STATIC_CACHE, CORE_CACHE]);
        const isImmutable = url.pathname.startsWith("/_next/static/");
        if (cached && isImmutable) return cached;

        const networkPromise = fetch(request)
          .then(async (res) => {
            if (res.ok && !res.redirected) {
              const cache = await caches.open(STATIC_CACHE);
              await cache.put(url.pathname, res.clone());
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          // Stale-while-revalidate for mutable icons/manifest
          void networkPromise;
          return cached;
        }

        const fresh = await networkPromise;
        return fresh || new Response("Asset unavailable offline.", { status: 503 });
      })()
    );
  }
});
